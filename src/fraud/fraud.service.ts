import { Injectable, BadRequestException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { FRAUD_LIMITS } from './fraud.constants';

@Injectable()
export class FraudService {
    constructor(private readonly redisService: RedisService) { }

    private get redis() {
        return this.redisService.client;
    }

    private dailyAmountKey(userId: number): string {
        return `fraud:daily:amount:userId:${userId}`;
    }

    private dailyCountKey(userId: number): string {
        return `fraud:daily:count:userId:${userId}`;
    }

    private getSecondsUntilMidnight(): number {
        const now = new Date();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        return Math.floor((midnight.getTime() - now.getTime()) / 1000);
    }

    async getDailyStats(userId: number): Promise<{ dailyAmount: number; dailyCount: number }> {
        const [amountStr, countStr] = await Promise.all([
            this.redis.get(this.dailyAmountKey(userId)),
            this.redis.get(this.dailyCountKey(userId)),
        ]);

        return {
            dailyAmount: amountStr ? parseInt(amountStr) : 0,
            dailyCount: countStr ? parseInt(countStr) : 0,
        };
    }

    async recordTransaction(userId: number, amount: number): Promise<void> {
        const ttl = this.getSecondsUntilMidnight();

        const amountKey = this.dailyAmountKey(userId);
        const countKey = this.dailyCountKey(userId);

        await Promise.all([
            this.redis.incrby(amountKey, amount),
            this.redis.incr(countKey),
        ]);

        await Promise.all([
            this.redis.expire(amountKey, ttl),
            this.redis.expire(countKey, ttl),
        ]);
    }

    async checkFraud(userId: number, amount: number): Promise<void> {
        if (amount < FRAUD_LIMITS.MIN_TRANSACTION_AMOUNT) {
            throw new BadRequestException(
                `Minimum transaction amount is ₹${FRAUD_LIMITS.MIN_TRANSACTION_AMOUNT}`,
            );
        }

        if (amount > FRAUD_LIMITS.MAX_SINGLE_TRANSACTION) {
            throw new BadRequestException(
                `Maximum single transaction limit is ₹${FRAUD_LIMITS.MAX_SINGLE_TRANSACTION}`,
            );
        }

        const { dailyAmount, dailyCount } = await this.getDailyStats(userId);

        if (dailyAmount + amount > FRAUD_LIMITS.MAX_DAILY_AMOUNT) {
            throw new BadRequestException(
                `Daily transaction limit of ₹${FRAUD_LIMITS.MAX_DAILY_AMOUNT} exceeded`,
            );
        }

        if (dailyCount >= FRAUD_LIMITS.MAX_DAILY_COUNT) {
            throw new BadRequestException(
                `Maximum ${FRAUD_LIMITS.MAX_DAILY_COUNT} transactions allowed per day`,
            );
        }
    }
}