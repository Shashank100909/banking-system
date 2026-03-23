import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AUDIT_QUEUE, AuditAction } from './audit.constants';

@Injectable()
export class AuditService {
  constructor(@InjectQueue(AUDIT_QUEUE) private readonly auditQueue: Queue) {}

  async log(userId: number, action: AuditAction, metadata?: object) {
    await this.auditQueue.add('audit-log', {
      userId,
      action,
      metadata,
    });
  }
}
