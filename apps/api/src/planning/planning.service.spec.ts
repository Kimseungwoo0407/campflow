import { ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PointsService } from "../points/points.service";
import { TripAccessService } from "../trips/trip-access.service";
import { PlanningService } from "./planning.service";

describe("PlanningService", () => {
  it("여행 멤버가 투표에 의견을 남긴다", async () => {
    const createComment = jest.fn().mockResolvedValue({ id: "comment-1" });
    const prisma = {
      poll: { findUnique: jest.fn().mockResolvedValue({ tripId: "trip-1" }) },
      pollComment: { create: createComment },
    } as unknown as PrismaService;
    const access = {
      requireMembership: jest.fn().mockResolvedValue({ role: "MEMBER" }),
    } as unknown as TripAccessService;
    const service = new PlanningService(prisma, access, {} as PointsService);

    await service.addPollComment("member-user-01", "poll-1", { body: "9시 출발이 좋아요." });

    expect(createComment).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pollId: "poll-1",
        authorId: "member-user-01",
        body: "9시 출발이 좋아요.",
      }),
      include: { author: { select: { id: true, nickname: true } } },
    });
  });

  it("일반 멤버는 다른 사람의 투표 의견을 삭제하지 못한다", async () => {
    const prisma = {
      pollComment: {
        findUnique: jest.fn().mockResolvedValue({
          id: "comment-1",
          authorId: "member-user-02",
          deletedAt: null,
          poll: { tripId: "trip-1" },
        }),
        update: jest.fn(),
      },
    } as unknown as PrismaService;
    const access = {
      requireMembership: jest.fn().mockResolvedValue({ role: "MEMBER" }),
    } as unknown as TripAccessService;
    const service = new PlanningService(prisma, access, {} as PointsService);

    await expect(service.removePollComment("member-user-01", "comment-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
