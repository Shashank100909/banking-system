import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { PrismaService } from '../prisma';
import { IdempotencyService } from './idempotency.service';
import { AuditModule } from '../audit';
import { RedisModule } from 'src/redis';
import { FraudModule } from 'src/fraud/fraud.module';
import { MailModule } from 'src/mail';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [AuditModule, RedisModule, FraudModule, MailModule, FirebaseModule],
  controllers: [AccountController],
  providers: [AccountService, PrismaService, IdempotencyService],
})
export class AccountModule {}
