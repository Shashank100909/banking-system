import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { PrismaService } from '../prisma';
import { IdempotencyService } from './idempotency.service';
import { AuditModule } from '../audit';

@Module({
  imports: [AuditModule],
  controllers: [AccountController],
  providers: [AccountService, PrismaService, IdempotencyService],
})
export class AccountModule {}
