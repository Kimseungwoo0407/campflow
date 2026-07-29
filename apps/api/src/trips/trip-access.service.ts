import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TripAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireMembership(userId: string, tripId: string) {
    const membership = await this.prisma.tripMember.findFirst({
      where: {
        tripId,
        userId,
        attendanceStatus: { not: "REMOVED" },
        trip: { deletedAt: null, group: { deletedAt: null } },
      },
    });
    if (!membership) {
      throw new NotFoundException({
        code: "TRIP_NOT_FOUND",
        message: "여행을 찾을 수 없습니다.",
      });
    }
    return membership;
  }

  async requireWriter(userId: string, tripId: string) {
    const membership = await this.requireMembership(userId, tripId);
    if (membership.role === "GUEST") {
      throw new ForbiddenException({
        code: "TRIP_WRITE_REQUIRED",
        message: "여행 멤버만 내용을 추가하거나 변경할 수 있습니다.",
      });
    }
    return membership;
  }

  async requireManager(userId: string, tripId: string) {
    const membership = await this.requireMembership(userId, tripId);
    if (membership.role !== "MANAGER") {
      throw new ForbiddenException({
        code: "TRIP_MANAGER_REQUIRED",
        message: "여행 관리자만 이 작업을 할 수 있습니다.",
      });
    }
    return membership;
  }

  async members(tripId: string) {
    return this.prisma.tripMember.findMany({
      where: { tripId, attendanceStatus: { not: "REMOVED" } },
      select: {
        userId: true,
        role: true,
        user: { select: { id: true, username: true, nickname: true } },
      },
      orderBy: { joinedAt: "asc" },
    });
  }
}
