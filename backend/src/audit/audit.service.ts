import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditEntity, Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    profileId: string | null,
    action: string,
    entity: string,
    entityId?: string | null,
    details?: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        profileId: profileId ?? undefined,
        action: action as AuditAction,
        entity: entity as AuditEntity,
        entityId: entityId ?? null,
        details: (details ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
