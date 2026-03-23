// src/redis/redis-cache.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class RedisCacheService {
  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.client;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  private accountKey(userId: number): string {
    return `cache:account:userId:${userId}`;
  }

  async getAccount<T>(userId: number): Promise<T | null> {
    const key = this.accountKey(userId);
    return this.get<T>(key);
  }

  async setAccount(userId: number, data: unknown): Promise<void> {
    const key = this.accountKey(userId);
    await this.set(key, data, 60);
  }

  async invalidateAccount(userId: number): Promise<void> {
    const key = this.accountKey(userId);
    await this.del(key);
  }

  private transactionKey(userId: number, skip: number, take: number): string {
    return `cache:transactions:userId:${userId}:${skip}:${take}`;
  }

  async getTransactions<T>(
    userId: number,
    skip: number,
    take: number,
  ): Promise<T | null> {
    const key = this.transactionKey(userId, skip, take);
    return this.get<T>(key);
  }

  async setTransactions(
    userId: number,
    skip: number,
    take: number,
    data: unknown,
  ): Promise<void> {
    const key = this.transactionKey(userId, skip, take);
    await this.set(key, data, 30);
  }

  async invalidateTransactions(userId: number): Promise<void> {
    await this.delByPattern(`cache:transactions:userId:${userId}:*`);
  }

  private allAccountsKey(skip: number, take: number): string {
    return `cache:accounts:all:${skip}:${take}`;
  }

  async getAllAccounts<T>(skip: number, take: number): Promise<T | null> {
    const key = this.allAccountsKey(skip, take);
    return this.get<T>(key);
  }

  async setAllAccounts(
    skip: number,
    take: number,
    data: unknown,
  ): Promise<void> {
    const key = this.allAccountsKey(skip, take);
    await this.set(key, data, 60);
  }

  async invalidateAllAccounts(): Promise<void> {
    await this.delByPattern(`cache:accounts:all:*`);
  }

  async invalidateAfterTransaction(userId: number): Promise<void> {
    await Promise.all([
      this.invalidateAccount(userId),
      this.invalidateTransactions(userId),
      this.invalidateAllAccounts(),
    ]);
  }
}
