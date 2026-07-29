import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { newId } from "@campflow/domain";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    actorId?: string | undefined;
    action: string;
    targetType: string;
    targetId?: string | undefined;
    metadata?: Prisma.InputJsonValue | undefined;
    ipHash?: string | undefined;
  }): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      id: newId(),
      action: input.action,
      targetType: input.targetType,
      metadataSafe: input.metadata ?? {},
      ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
      ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
      ...(input.ipHash === undefined ? {} : { ipHash: input.ipHash }),
    };
    await this.prisma.auditLog.create({
      data,
    });
  }
}
