import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { PrismaService } from '../prisma';
import { IdempotencyService } from './idempotency.service';
import { AuditModule } from '../audit';
4;
import { RedisModule } from 'src/redis';

@Module({
  imports: [AuditModule, RedisModule],
  controllers: [AccountController],
  providers: [AccountService, PrismaService, IdempotencyService],
})
export class AccountModule {}
