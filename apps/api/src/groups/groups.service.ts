import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import type {
  CreateGroupInput,
  CreateInviteInput,
  UpdateGroupInput,
  UpdateMemberInput,
} from "@campflow/contracts";
import { canManageGroup, newId } from "@campflow/domain";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

const defaultGroupSettings = {
  currency: "KRW",
  settlementRule: "EQUAL",
  boardCategories: ["공지", "자유", "장소", "준비", "질문", "후기"],
};

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: {
        userId,
        status: "ACTIVE",
        group: { deletedAt: null },
      },
      include: {
        group: {
          include: {
            _count: { select: { members: { where: { status: "ACTIVE" } } } },
          },
        },
      },
      orderBy: { group: { updatedAt: "desc" } },
    });
    return memberships.map(({ group, role, joinedAt }) => ({
      ...group,
      role,
      joinedAt,
      memberCount: group._count.members,
      _count: undefined,
    }));
  }

  async create(userId: string, input: CreateGroupInput) {
    const group = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.group.create({
        data: {
          id: newId(),
          ownerId: userId,
          name: input.name,
          ...(input.description === undefined ? {} : { description: input.description }),
          settings: (input.settings ?? defaultGroupSettings) as Prisma.InputJsonValue,
        },
      });
      await transaction.groupMember.create({
        data: {
          groupId: created.id,
          userId,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      return created;
    });
    await this.audit.record({
      actorId: userId,
      action: "group.created",
      targetType: "Group",
      targetId: group.id,
    });
    return group;
  }

  async get(userId: string, groupId: string) {
    const membership = await this.requireMembership(userId, groupId);
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, deletedAt: null },
      include: {
        members: {
          where: { status: { not: "REMOVED" } },
          select: {
            role: true,
            status: true,
            joinedAt: true,
            user: {
              select: { id: true, nickname: true, locale: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });
    if (!group) {
      throw this.notFound();
    }
    return { ...group, myRole: membership.role };
  }

  async update(userId: string, groupId: string, input: UpdateGroupInput) {
    await this.requireOwner(userId, groupId);
    const group = await this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.settings === undefined
          ? {}
          : { settings: input.settings as Prisma.InputJsonValue }),
      },
    });
    await this.audit.record({
      actorId: userId,
      action: "group.updated",
      targetType: "Group",
      targetId: groupId,
      metadata: { fields: Object.keys(input) },
    });
    return group;
  }

  async remove(userId: string, groupId: string) {
    await this.requireOwner(userId, groupId);
    await this.prisma.$transaction([
      this.prisma.group.update({
        where: { id: groupId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.invite.updateMany({
        where: { groupId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.record({
      actorId: userId,
      action: "group.soft_deleted",
      targetType: "Group",
      targetId: groupId,
    });
    return { deleted: true };
  }

  async members(userId: string, groupId: string) {
    await this.requireMembership(userId, groupId);
    return this.prisma.groupMember.findMany({
      where: { groupId, status: { not: "REMOVED" } },
      select: {
        role: true,
        status: true,
        displayName: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            nickname: true,
            locale: true,
            profile: {
              select: {
                canDrive: true,
                allergies: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
  }

  async updateMember(
    userId: string,
    groupId: string,
    targetUserId: string,
    input: UpdateMemberInput,
  ) {
    await this.requireOwner(userId, groupId);
    const target = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!target || target.status === "REMOVED") {
      throw this.memberNotFound();
    }
    if (target.role === "OWNER" || targetUserId === userId) {
      throw new ForbiddenException({
        code: "OWNER_ROLE_IMMUTABLE",
        message: "그룹 소유자의 역할은 변경할 수 없습니다.",
      });
    }

    const updated = await this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: {
        ...(input.role === undefined ? {} : { role: input.role }),
        ...(input.status === undefined ? {} : { status: input.status }),
      },
    });
    await this.audit.record({
      actorId: userId,
      action: "group.member_updated",
      targetType: "GroupMember",
      targetId: targetUserId,
      metadata: { groupId, fields: Object.keys(input) },
    });
    return updated;
  }

  async removeMember(userId: string, groupId: string, targetUserId: string) {
    await this.requireOwner(userId, groupId);
    const target = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!target || target.status === "REMOVED") {
      throw this.memberNotFound();
    }
    if (target.role === "OWNER") {
      throw new ForbiddenException({
        code: "OWNER_CANNOT_BE_REMOVED",
        message: "그룹 소유자는 제거할 수 없습니다.",
      });
    }

    await this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: { status: "REMOVED" },
    });
    await this.audit.record({
      actorId: userId,
      action: "group.member_removed",
      targetType: "GroupMember",
      targetId: targetUserId,
      metadata: { groupId },
    });
    return { removed: true };
  }

  async createInvite(userId: string, groupId: string, input: CreateInviteInput) {
    await this.requireOwner(userId, groupId);
    const token = randomBytes(24).toString("base64url");
    const code = this.randomCode();
    const invite = await this.prisma.invite.create({
      data: {
        id: newId(),
        groupId,
        tokenHash: this.hashInviteSecret(token),
        codeHash: this.hashInviteSecret(code),
        role: input.role,
        expiresAt: new Date(Date.now() + input.expiresInHours * 3_600_000),
        maxUses: input.maxUses,
        requireApproval: input.requireApproval,
        createdById: userId,
      },
      select: {
        id: true,
        role: true,
        expiresAt: true,
        maxUses: true,
        requireApproval: true,
      },
    });
    await this.audit.record({
      actorId: userId,
      action: "group.invite_created",
      targetType: "Invite",
      targetId: invite.id,
      metadata: { groupId, role: invite.role, maxUses: invite.maxUses },
    });
    return { ...invite, token, code };
  }

  async previewInvite(tokenOrCode: string) {
    const invite = await this.findInvite(tokenOrCode);
    this.assertInviteUsable(invite);
    return {
      group: {
        id: invite.group.id,
        name: invite.group.name,
        description: invite.group.description,
      },
      role: invite.role,
      expiresAt: invite.expiresAt,
      remainingUses: invite.maxUses - invite.usedCount,
      requireApproval: invite.requireApproval,
    };
  }

  async acceptInvite(userId: string, tokenOrCode: string) {
    const hashed = this.hashInviteSecret(tokenOrCode.trim());
    const result = await this.prisma.$transaction(async (transaction) => {
      const invite = await transaction.invite.findFirst({
        where: {
          OR: [{ tokenHash: hashed }, { codeHash: hashed }],
        },
        include: { group: true },
      });
      if (!invite) {
        throw this.inviteNotFound();
      }
      this.assertInviteUsable(invite);

      const existing = await transaction.groupMember.findUnique({
        where: { groupId_userId: { groupId: invite.groupId, userId } },
      });
      if (existing?.status === "ACTIVE" || existing?.status === "PENDING") {
        return { group: invite.group, membership: existing, alreadyMember: true };
      }

      const claimed = await transaction.invite.updateMany({
        where: {
          id: invite.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          usedCount: { lt: invite.maxUses },
        },
        data: { usedCount: { increment: 1 } },
      });
      if (claimed.count !== 1) {
        throw new ConflictException({
          code: "INVITE_LIMIT_REACHED",
          message: "초대 사용 가능 횟수가 모두 소진되었습니다.",
        });
      }

      const membership = await transaction.groupMember.upsert({
        where: { groupId_userId: { groupId: invite.groupId, userId } },
        update: {
          role: invite.role,
          status: invite.requireApproval ? "PENDING" : "ACTIVE",
          joinedAt: new Date(),
        },
        create: {
          groupId: invite.groupId,
          userId,
          role: invite.role,
          status: invite.requireApproval ? "PENDING" : "ACTIVE",
        },
      });
      return { group: invite.group, membership, alreadyMember: false };
    });

    await this.audit.record({
      actorId: userId,
      action: "group.invite_accepted",
      targetType: "Group",
      targetId: result.group.id,
      metadata: {
        status: result.membership.status,
        alreadyMember: result.alreadyMember,
      },
    });
    return result;
  }

  private async requireMembership(userId: string, groupId: string) {
    const membership = await this.prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: "ACTIVE",
        group: { deletedAt: null },
      },
    });
    if (!membership) {
      throw this.notFound();
    }
    return membership;
  }

  private async requireOwner(userId: string, groupId: string): Promise<void> {
    const membership = await this.requireMembership(userId, groupId);
    if (!canManageGroup(membership.role)) {
      throw new ForbiddenException({
        code: "GROUP_OWNER_REQUIRED",
        message: "그룹 소유자만 이 작업을 할 수 있습니다.",
      });
    }
  }

  private async findInvite(tokenOrCode: string) {
    const hashed = this.hashInviteSecret(tokenOrCode.trim());
    const invite = await this.prisma.invite.findFirst({
      where: { OR: [{ tokenHash: hashed }, { codeHash: hashed }] },
      include: { group: true },
    });
    if (!invite) {
      throw this.inviteNotFound();
    }
    return invite;
  }

  private assertInviteUsable(invite: {
    revokedAt: Date | null;
    expiresAt: Date;
    usedCount: number;
    maxUses: number;
    group: { deletedAt: Date | null };
  }): void {
    if (
      invite.revokedAt ||
      invite.expiresAt <= new Date() ||
      invite.usedCount >= invite.maxUses ||
      invite.group.deletedAt
    ) {
      throw new GoneException({
        code: "INVITE_EXPIRED",
        message: "만료되었거나 더 이상 사용할 수 없는 초대입니다.",
      });
    }
  }

  private hashInviteSecret(value: string): string {
    return createHmac("sha256", this.config.getOrThrow<string>("INVITE_TOKEN_PEPPER"))
      .update(value)
      .digest("hex");
  }

  private randomCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: "GROUP_NOT_FOUND",
      message: "그룹을 찾을 수 없습니다.",
    });
  }

  private memberNotFound(): NotFoundException {
    return new NotFoundException({
      code: "MEMBER_NOT_FOUND",
      message: "그룹 멤버를 찾을 수 없습니다.",
    });
  }

  private inviteNotFound(): NotFoundException {
    return new NotFoundException({
      code: "INVITE_NOT_FOUND",
      message: "초대를 찾을 수 없습니다.",
    });
  }
}
