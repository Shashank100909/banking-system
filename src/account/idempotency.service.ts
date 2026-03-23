import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async getExistingResponse(key: string) {
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key },
    });
    return existing;
  }

  async saveResponse(key: string, response: object) {
    return this.prisma.idempotencyKey.create({
      data: {
        key,
        response,
      },
    });
  }
}
