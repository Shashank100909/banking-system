import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { AUDIT_QUEUE } from './audit.constants';

@Injectable()
@Processor(AUDIT_QUEUE)
export class AuditProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditProcessor.name);
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job) {
    const { userId, action, metadata } = job.data;

    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        metadata,
      },
    });
    this.logger.log(`Audit logged — user: ${userId}, action: ${action}`);
  }
}
