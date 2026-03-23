import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UserRole } from '../common';
import { IdempotencyService } from './idempotency.service';
import { AuditService, AuditAction } from '../audit';
import { RedisCacheService } from 'src/redis/redis-cache.service';
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotencyService: IdempotencyService,
    private readonly auditService: AuditService,
    private readonly cacheService: RedisCacheService,
  ) {}

  private async findAccountByUserId(
    userId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const account = await client.account.findFirst({ where: { userId } });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async createAccount(data: CreateAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });
    if (!user) throw new NotFoundException('User does not exist');

    const account = await this.prisma.account.create({
      data: {
        userId: data.userId,
        currency: data.currency || 'INR',
      },
    });

    await this.auditService.log(data.userId, AuditAction.CREATE_ACCOUNT, {
      accountId: account.id,
      currency: account.currency,
    });

    return account;
  }

  async getAccount(userId: number) {
    const cached = await this.cacheService.getAccount(userId);
    if (cached) {
      console.log('CACHE HIT  — returned from Redis');
      return cached;
    }
    console.log('CACHE MISS  — hitting DB');;
    const account = await this.findAccountByUserId(userId);
    await this.cacheService.setAccount(userId, account);
    return account;
  }

  async getAll(options?: { skip?: number; take?: number }) {
    const pagination = { skip: options?.skip || 0, take: options?.take || 10 };

    const cached = await this.cacheService.getAllAccounts(
      pagination.skip,
      pagination.take,
    );
    if (cached) return cached;

    const totalAccounts = await this.prisma.account.count();
    const accounts = await this.prisma.account.findMany({
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { id: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
      },
    });
    const result = {
      count: totalAccounts,
      skip: pagination.skip,
      take: pagination.take,
      data: accounts,
    };
    await this.cacheService.setAllAccounts(
      pagination.skip,
      pagination.take,
      result,
    );

    return result;
  }

  async deposit(amount: number, userId: number, idempotencyKey?: string) {
    console.log('idempotencyKey received:', idempotencyKey);
    if (idempotencyKey) {
      const existing =
        await this.idempotencyService.getExistingResponse(idempotencyKey);
      console.log('existing response:', existing);
      if (existing) return existing.response;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const account = await this.findAccountByUserId(userId, tx);

      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: { balance: { increment: amount } },
      });

      const transaction = await tx.transaction.create({
        data: {
          accountId: account.id,
          amount,
          type: 'DEPOSIT',
          status: 'SUCCESS',
        },
      });

      return { account: updatedAccount, transaction };
    });

    await this.cacheService.invalidateAfterTransaction(userId);

    if (idempotencyKey) {
      await this.idempotencyService.saveResponse(idempotencyKey, result);
    }

    await this.auditService.log(userId, AuditAction.DEPOSIT, {
      amount,
      accountId: result.account.id,
      transactionId: result.transaction.id,
    });
    return result;
  }

  async withdraw(amount: number, userId: number, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existing =
        await this.idempotencyService.getExistingResponse(idempotencyKey);
      if (existing) return existing.response;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const account = await this.findAccountByUserId(userId, tx);

      if (account.balance < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: { balance: { decrement: amount } },
      });

      const transaction = await tx.transaction.create({
        data: {
          accountId: account.id,
          amount,
          type: 'WITHDRAW',
          status: 'SUCCESS',
        },
      });

      return { account: updatedAccount, transaction };
    });

    await this.cacheService.invalidateAfterTransaction(userId);
    if (idempotencyKey) {
      await this.idempotencyService.saveResponse(idempotencyKey, result);
    }

    await this.auditService.log(userId, AuditAction.WITHDRAW, {
      amount,
      accountId: result.account.id,
      transactionId: result.transaction.id,
    });
    return result;
  }

  async transfer(
    amount: number,
    senderUserId: number,
    receiverUserId: number,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const existing =
        await this.idempotencyService.getExistingResponse(idempotencyKey);
      if (existing) return existing.response;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const senderAccount = await this.findAccountByUserId(senderUserId, tx);
      const receiverAccount = await this.findAccountByUserId(
        receiverUserId,
        tx,
      );

      if (senderAccount.id === receiverAccount.id) {
        throw new BadRequestException('Cannot transfer to your own account');
      }

      if (senderAccount.balance < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      const updatedSender = await tx.account.update({
        where: { id: senderAccount.id },
        data: { balance: { decrement: amount } },
      });

      const updatedReceiver = await tx.account.update({
        where: { id: receiverAccount.id },
        data: { balance: { increment: amount } },
      });

      const transaction = await tx.transaction.create({
        data: {
          accountId: senderAccount.id,
          amount,
          type: 'TRANSFER',
          status: 'SUCCESS',
        },
      });

      await tx.ledgerEntry.createMany({
        data: [
          {
            accountId: senderAccount.id,
            transactionId: transaction.id,
            amount,
            type: 'DEBIT',
          },
          {
            accountId: receiverAccount.id,
            transactionId: transaction.id,
            amount,
            type: 'CREDIT',
          },
        ],
      });

      return { sender: updatedSender, receiver: updatedReceiver, transaction };
    });
    await Promise.all([
      this.cacheService.invalidateAfterTransaction(senderUserId),
      this.cacheService.invalidateAfterTransaction(receiverUserId),
    ]);
    if (idempotencyKey) {
      await this.idempotencyService.saveResponse(idempotencyKey, result);
    }

    await this.auditService.log(senderUserId, AuditAction.TRANSFER, {
      amount,
      senderAccountId: result.sender.id,
      receiverAccountId: result.receiver.id,
      transactionId: result.transaction.id,
    });

    return result;
  }

  async getTransactionHistory(
    userId: number,
    options?: { skip?: number; take?: number },
  ) {
    const pagination = { skip: options?.skip || 0, take: options?.take || 10 };

    const cached = await this.cacheService.getTransactions(
      userId,
      pagination.skip,
      pagination.take,
    );
    if (cached) return cached;
    const account = await this.findAccountByUserId(userId);
    const totalTransactions = await this.prisma.transaction.count({
      where: { accountId: account.id },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    });

    const result = {
      count: totalTransactions,
      take: pagination.take,
      skip: pagination.skip,
      data: transactions,
    };
    await this.cacheService.setTransactions(
      userId,
      pagination.skip,
      pagination.take,
      result,
    );
    return result;
  }

  async getAllTransactions(options?: { skip?: number; take?: number }) {
    const pagination = { skip: options?.skip || 0, take: options?.take || 10 };

    const totalTransactions = await this.prisma.transaction.count();

    const transactions = await this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        account: {
          select: { id: true, userId: true, currency: true },
        },
      },
    });

    return {
      count: totalTransactions,
      skip: pagination.skip,
      take: pagination.take,
      data: transactions,
    };
  }

  async getAccountForUser(
    requestingUserId: number,
    requestingUserRole: string | undefined,
    queryUserId?: number,
    options?: { skip?: number; take?: number },
  ) {
    if (requestingUserRole === UserRole.Customer) {
      return this.getAccount(requestingUserId);
    }
    if (queryUserId) {
      return this.getAccount(queryUserId);
    }
    return this.getAll(options);
  }

  async getTransactions(
    requestingUserId: number,
    requestingUserRole: string | undefined,
    queryUserId?: number,
    options?: { skip?: number; take?: number },
  ) {
    if (requestingUserRole === UserRole.Customer) {
      return this.getTransactionHistory(requestingUserId, options);
    }
    if (queryUserId) {
      return this.getTransactionHistory(queryUserId, options);
    }
    return this.getAllTransactions(options);
  }
}
