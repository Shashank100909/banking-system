import { Module } from '@nestjs/common';
import { QueueModule } from '../queue';
import { PrismaModule } from '../prisma';
import { AuditService } from './audit.service';
import { AuditProcessor } from './audit.processor';
import { AUDIT_QUEUE } from './audit.constants';

@Module({
  imports: [QueueModule.registerAsync(AUDIT_QUEUE), PrismaModule],
  providers: [AuditService, AuditProcessor],
  exports: [AuditService],
})
export class AuditModule {}
