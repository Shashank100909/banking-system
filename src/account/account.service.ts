import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async createAccount(data: CreateAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new NotFoundException('User does not exist');
    }

    return this.prisma.account.create({
      data: {
        userId: data.userId,
        currency: data.currency || 'INR',
      },
    });
  }

  async getAccount(userId: number) {
    const account = await this.prisma.account.findFirst({
      where: { userId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }

  async deposit(amount: number, UserId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: { userId: UserId },
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          accountId: account.id,
          amount: amount,
          type: 'DEPOSIT',
          status: 'SUCCESS',
        },
      });
      return { account: updatedAccount, transaction };
    });
  }

  async getAll(options?: { skip?: number; take?: number }) {
    const pagination = { skip: options?.skip || 0, take: options?.take || 10 };

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

    return {
      count: totalAccounts,
      skip: pagination.skip,
      take: pagination.take,
      data: accounts,
    };
  }

  async withdraw(amount: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: { userId },
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      if (account.balance < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          balance: { decrement: amount },
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          accountId: account.id,
          amount: amount,
          type: 'WITHDRAW',
          status: 'SUCCESS',
        },
      });

      return { account: updatedAccount, transaction };
    });
  }

  async transfer(amount: number, senderUserId: number, receiverUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const senderAccount = await tx.account.findFirst({
        where: { userId: senderUserId },
      });
      if (!senderAccount) {
        throw new NotFoundException('Sender account not found');
      }

      const receiverAccount = await tx.account.findFirst({
        where: { userId: receiverUserId },
      });
      if (!receiverAccount) {
        throw new NotFoundException('Receiver account not found');
      }

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

      return {
        sender: updatedSender,
        receiver: updatedReceiver,
        transaction,
      };
    });
  }

  async getTransactionHistory(
    userId: number,
    options?: { skip?: number; take?: number },
  ) {
    const pagination = { skip: options?.skip || 0, take: options?.take || 10 };

    const account = await this.prisma.account.findFirst({
      where: { userId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const totalTransactions = await this.prisma.transaction.count({
      where: { accountId: account.id },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    });

    return {
      count: totalTransactions,
      skip: pagination.skip,
      take: pagination.take,
      data: transactions,
    };
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
          select: {
            id: true,
            userId: true,
            currency: true,
          },
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
}