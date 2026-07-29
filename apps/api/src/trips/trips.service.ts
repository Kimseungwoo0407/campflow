import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TripRole, TripStatus } from "@prisma/client";
import type { CreateTripInput, TransitionTripInput, UpdateTripInput } from "@campflow/contracts";
import { canTransitionTrip, newId, tripProgress } from "@campflow/domain";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

const FIXED_START_DATE = new Date("2026-08-29T00:00:00.000Z");
const FIXED_END_DATE = new Date("2026-08-30T00:00:00.000Z");

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string) {
    const memberships = await this.prisma.tripMember.findMany({
      where: {
        userId,
        attendanceStatus: { not: "REMOVED" },
        trip: { deletedAt: null, group: { deletedAt: null } },
      },
      include: {
        trip: {
          include: {
            group: { select: { id: true, name: true } },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { trip: { updatedAt: "desc" } },
    });
    return memberships.map(({ role, trip }) => this.toSummary(trip, role));
  }

  async listForGroup(userId: string, groupId: string) {
    await this.requireGroupMembership(userId, groupId);
    const trips = await this.prisma.trip.findMany({
      where: { groupId, deletedAt: null },
      include: {
        group: { select: { id: true, name: true } },
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: { select: { members: true } },
      },
      orderBy: [{ startDate: "asc" }, { updatedAt: "desc" }],
    });
    return trips.map((trip) => this.toSummary(trip, trip.members[0]?.role ?? "GUEST"));
  }

  async create(userId: string, groupId: string, input: CreateTripInput) {
    const groupMembership = await this.requireGroupOwner(userId, groupId);
    const groupMembers = await this.prisma.groupMember.findMany({
      where: { groupId, status: "ACTIVE" },
      select: { userId: true, role: true },
    });
    const trip = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.trip.create({
        data: {
          id: newId(),
          groupId,
          createdById: userId,
          title: input.title,
          ...(input.purpose === undefined ? {} : { purpose: input.purpose }),
          status: "SEARCHING",
          startDate: FIXED_START_DATE,
          endDate: FIXED_END_DATE,
          dateRangeStart: FIXED_START_DATE,
          dateRangeEnd: FIXED_END_DATE,
          nights: 1,
          regionText: input.regionText,
          ...(input.budgetPerPerson === undefined
            ? {}
            : { budgetPerPerson: input.budgetPerPerson }),
          attendeeCount: input.attendeeCount ?? groupMembers.length,
          settings: {
            datesLocked: true,
            timezone: "Asia/Seoul",
            currency: "KRW",
          },
        },
      });
      await transaction.tripMember.createMany({
        data: groupMembers.map((member) => ({
          tripId: created.id,
          userId: member.userId,
          role: this.tripRole(member.role, member.userId === userId),
          isCoreMember: member.userId === userId,
        })),
      });
      await transaction.decisionLog.create({
        data: {
          id: newId(),
          tripId: created.id,
          decisionType: "DATE_CONFIRMED",
          decidedById: userId,
          reason: "사용자가 확정한 2026년 8월 29~30일 일정",
          snapshot: {
            startDate: "2026-08-29",
            endDate: "2026-08-30",
            nights: 1,
            timezone: "Asia/Seoul",
          },
        },
      });
      return created;
    });
    await this.audit.record({
      actorId: userId,
      action: "trip.created",
      targetType: "Trip",
      targetId: trip.id,
      metadata: { groupId, fixedDates: true, groupRole: groupMembership.role },
    });
    return this.get(userId, trip.id);
  }

  async get(userId: string, tripId: string) {
    const membership = await this.requireTripMembership(userId, tripId);
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      include: {
        group: { select: { id: true, name: true } },
        members: {
          where: { attendanceStatus: { not: "REMOVED" } },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profile: {
                  select: { canDrive: true, allergies: true, foodDislikes: true },
                },
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        decisions: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!trip) throw this.notFound();
    return {
      ...trip,
      myRole: membership.role,
      progress: tripProgress(trip.status),
      datesLocked: true,
    };
  }

  async update(userId: string, tripId: string, input: UpdateTripInput, expectedVersion?: number) {
    await this.requireManager(userId, tripId);
    const current = await this.prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      select: { version: true },
    });
    if (!current) throw this.notFound();
    const version = expectedVersion ?? current.version;
    const updated = await this.prisma.trip.updateMany({
      where: { id: tripId, version, deletedAt: null },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.purpose === undefined ? {} : { purpose: input.purpose }),
        ...(input.regionText === undefined ? {} : { regionText: input.regionText }),
        ...(input.budgetPerPerson === undefined ? {} : { budgetPerPerson: input.budgetPerPerson }),
        ...(input.attendeeCount === undefined ? {} : { attendeeCount: input.attendeeCount }),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException({
        code: "VERSION_CONFLICT",
        message: "다른 사용자가 먼저 여행 정보를 수정했습니다.",
        details: { currentVersion: current.version },
      });
    }
    await this.audit.record({
      actorId: userId,
      action: "trip.updated",
      targetType: "Trip",
      targetId: tripId,
      metadata: { fields: Object.keys(input) },
    });
    return this.get(userId, tripId);
  }

  async transition(userId: string, tripId: string, input: TransitionTripInput) {
    await this.requireManager(userId, tripId);
    const current = await this.prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      select: { status: true, version: true },
    });
    if (!current) throw this.notFound();
    if (!canTransitionTrip(current.status, input.status)) {
      throw new ConflictException({
        code: "INVALID_TRIP_TRANSITION",
        message: "현재 단계에서는 요청한 여행 단계로 이동할 수 없습니다.",
        details: { current: current.status, requested: input.status },
      });
    }
    await this.prisma.$transaction([
      this.prisma.trip.update({
        where: { id: tripId },
        data: { status: input.status, version: { increment: 1 } },
      }),
      this.prisma.decisionLog.create({
        data: {
          id: newId(),
          tripId,
          decisionType: "STATUS_TRANSITION",
          decidedById: userId,
          ...(input.reason === undefined ? {} : { reason: input.reason }),
          snapshot: { from: current.status, to: input.status },
        },
      }),
    ]);
    await this.audit.record({
      actorId: userId,
      action: "trip.transitioned",
      targetType: "Trip",
      targetId: tripId,
      metadata: { from: current.status, to: input.status },
    });
    return this.get(userId, tripId);
  }

  async remove(userId: string, tripId: string) {
    await this.requireManager(userId, tripId);
    await this.prisma.trip.update({
      where: { id: tripId },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    await this.audit.record({
      actorId: userId,
      action: "trip.soft_deleted",
      targetType: "Trip",
      targetId: tripId,
    });
    return { deleted: true };
  }

  private async requireGroupMembership(userId: string, groupId: string) {
    const membership = await this.prisma.groupMember.findFirst({
      where: { groupId, userId, status: "ACTIVE", group: { deletedAt: null } },
    });
    if (!membership) throw this.notFound();
    return membership;
  }

  private async requireGroupOwner(userId: string, groupId: string) {
    const membership = await this.requireGroupMembership(userId, groupId);
    if (membership.role !== "OWNER") {
      throw new ForbiddenException({
        code: "GROUP_OWNER_REQUIRED",
        message: "그룹 소유자만 여행을 만들 수 있습니다.",
      });
    }
    return membership;
  }

  private async requireTripMembership(userId: string, tripId: string) {
    const membership = await this.prisma.tripMember.findFirst({
      where: {
        tripId,
        userId,
        attendanceStatus: { not: "REMOVED" },
        trip: { deletedAt: null, group: { deletedAt: null } },
      },
    });
    if (!membership) throw this.notFound();
    return membership;
  }

  private async requireManager(userId: string, tripId: string) {
    const membership = await this.requireTripMembership(userId, tripId);
    if (membership.role !== "MANAGER") {
      throw new ForbiddenException({
        code: "TRIP_MANAGER_REQUIRED",
        message: "여행 관리자만 이 작업을 할 수 있습니다.",
      });
    }
    return membership;
  }

  private tripRole(groupRole: string, creator: boolean): TripRole {
    if (creator || groupRole === "OWNER") return "MANAGER";
    return groupRole === "GUEST" ? "GUEST" : "MEMBER";
  }

  private toSummary(
    trip: {
      id: string;
      title: string;
      purpose: string | null;
      status: TripStatus;
      startDate: Date;
      endDate: Date;
      regionText: string;
      budgetPerPerson: number | null;
      attendeeCount: number;
      version: number;
      updatedAt: Date;
      group: { id: string; name: string };
      _count: { members: number };
    },
    role: TripRole,
  ) {
    return {
      ...trip,
      myRole: role,
      memberCount: trip._count.members,
      progress: tripProgress(trip.status),
      datesLocked: true,
      _count: undefined,
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: "TRIP_NOT_FOUND",
      message: "여행을 찾을 수 없습니다.",
    });
  }
}
