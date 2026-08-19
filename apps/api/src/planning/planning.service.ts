import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateItineraryItemInput,
  CreatePollCommentInput,
  CreatePollInput,
  PollVoteInput,
  UpdateItineraryItemInput,
} from "@campflow/contracts";
import { newId } from "@campflow/domain";
import { PrismaService } from "../prisma/prisma.service";
import { PointsService } from "../points/points.service";
import { TripAccessService } from "../trips/trip-access.service";

interface PollOption {
  id: string;
  label: string;
}

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
    private readonly points: PointsService,
  ) {}

  async polls(userId: string, tripId: string) {
    const membership = await this.access.requireMembership(userId, tripId);
    const polls = await this.prisma.poll.findMany({
      where: { tripId },
      include: {
        createdBy: { select: { id: true, nickname: true } },
        votes: true,
        comments: {
          where: { deletedAt: null },
          include: { author: { select: { id: true, nickname: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return polls.map((poll) => this.presentPoll(poll, userId, membership.role === "MANAGER"));
  }

  async createPoll(userId: string, tripId: string, input: CreatePollInput) {
    const membership = await this.access.requireWriter(userId, tripId);
    const options = input.optionLabels.map((label) => ({ id: newId(), label }));
    const maxSelections =
      input.type === "SINGLE" ? 1 : (input.maxSelections ?? input.optionLabels.length);
    const poll = await this.prisma.poll.create({
      data: {
        id: newId(),
        tripId,
        createdById: userId,
        type: input.type,
        title: input.title,
        ...(input.description === undefined ? {} : { description: input.description }),
        options,
        maxSelections,
        anonymous: input.anonymous,
        resultsVisibility: input.resultsVisibility,
        ...(input.closesAt === undefined ? {} : { closesAt: new Date(input.closesAt) }),
      },
      include: {
        createdBy: { select: { id: true, nickname: true } },
        votes: true,
        comments: {
          where: { deletedAt: null },
          include: { author: { select: { id: true, nickname: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    await this.prisma.trip.updateMany({
      where: { id: tripId, status: "SEARCHING" },
      data: { status: "VOTING", version: { increment: 1 } },
    });
    return this.presentPoll(poll, userId, membership.role === "MANAGER");
  }

  async vote(userId: string, pollId: string, input: PollVoteInput) {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { votes: true, createdBy: { select: { id: true, nickname: true } } },
    });
    if (!poll) throw this.pollNotFound();
    const membership = await this.access.requireMembership(userId, poll.tripId);
    if (poll.status !== "OPEN" || (poll.closesAt && poll.closesAt <= new Date())) {
      throw new ConflictException({
        code: "POLL_CLOSED",
        message: "마감된 투표입니다.",
      });
    }
    const options = poll.options as unknown as PollOption[];
    const validIds = new Set(options.map((option) => option.id));
    const uniqueOptionIds = [...new Set(input.optionIds)];
    if (uniqueOptionIds.some((optionId) => !validIds.has(optionId))) {
      throw new ConflictException({
        code: "INVALID_POLL_VOTE",
        message: "투표 선택값을 확인해 주세요.",
      });
    }
    if (uniqueOptionIds.length > poll.maxSelections) {
      throw new ConflictException({
        code: "POLL_SELECTION_LIMIT_EXCEEDED",
        message: `이 투표는 최대 ${poll.maxSelections}개까지 선택할 수 있습니다.`,
      });
    }
    if (poll.type === "SINGLE" && uniqueOptionIds.length !== 1) {
      throw new ConflictException({
        code: "INVALID_POLL_VOTE",
        message: "투표 선택값을 확인해 주세요.",
      });
    }
    const existingVote = poll.votes.some((vote) => vote.userId === userId);
    await this.prisma.pollVote.upsert({
      where: { pollId_userId: { pollId, userId } },
      update: {
        payload: { optionIds: uniqueOptionIds },
        revision: { increment: 1 },
        castAt: new Date(),
      },
      create: {
        pollId,
        userId,
        payload: { optionIds: uniqueOptionIds },
      },
    });
    const refreshed = await this.prisma.poll.findUniqueOrThrow({
      where: { id: pollId },
      include: {
        votes: true,
        createdBy: { select: { id: true, nickname: true } },
        comments: {
          where: { deletedAt: null },
          include: { author: { select: { id: true, nickname: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!existingVote) {
      await this.points.awardActivity(poll.tripId, userId, "POLL", pollId);
    }
    return this.presentPoll(refreshed, userId, membership.role === "MANAGER");
  }

  async addPollComment(userId: string, pollId: string, input: CreatePollCommentInput) {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      select: { tripId: true },
    });
    if (!poll) throw this.pollNotFound();
    await this.access.requireMembership(userId, poll.tripId);
    return this.prisma.pollComment.create({
      data: { id: newId(), pollId, authorId: userId, body: input.body },
      include: { author: { select: { id: true, nickname: true } } },
    });
  }

  async removePollComment(userId: string, commentId: string) {
    const comment = await this.prisma.pollComment.findUnique({
      where: { id: commentId },
      include: { poll: { select: { tripId: true } } },
    });
    if (!comment || comment.deletedAt) throw this.pollCommentNotFound();
    const membership = await this.access.requireMembership(userId, comment.poll.tripId);
    if (comment.authorId !== userId && membership.role !== "MANAGER") {
      throw new ForbiddenException({
        code: "POLL_COMMENT_DELETE_FORBIDDEN",
        message: "본인이 작성한 의견만 삭제할 수 있습니다.",
      });
    }
    await this.prisma.pollComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  async closePoll(userId: string, pollId: string) {
    const poll = await this.prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw this.pollNotFound();
    await this.access.requireManager(userId, poll.tripId);
    const updated = await this.prisma.poll.update({
      where: { id: pollId },
      data: { status: "CLOSED" },
      include: {
        votes: true,
        createdBy: { select: { id: true, nickname: true } },
        comments: {
          where: { deletedAt: null },
          include: { author: { select: { id: true, nickname: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    await this.prisma.decisionLog.create({
      data: {
        id: newId(),
        tripId: poll.tripId,
        decisionType: "POLL_CLOSED",
        entityId: pollId,
        decidedById: userId,
        snapshot: this.pollResults(updated),
      },
    });
    return this.presentPoll(updated, userId, true);
  }

  async removePoll(userId: string, pollId: string) {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      select: { tripId: true, createdById: true },
    });
    if (!poll) throw this.pollNotFound();
    const membership = await this.access.requireWriter(userId, poll.tripId);
    if (poll.createdById !== userId && membership.role !== "MANAGER") {
      throw new ForbiddenException({
        code: "POLL_DELETE_FORBIDDEN",
        message: "투표 작성자나 여행 관리자만 삭제할 수 있습니다.",
      });
    }
    await this.prisma.poll.delete({ where: { id: pollId } });
    return { deleted: true };
  }

  async itinerary(userId: string, tripId: string) {
    await this.access.requireMembership(userId, tripId);
    return this.prisma.itineraryDay.findMany({
      where: { tripId },
      include: {
        items: {
          include: {
            place: true,
            assignee: { select: { id: true, nickname: true } },
          },
          orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
        },
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  async generateTemplate(userId: string, tripId: string) {
    await this.access.requireWriter(userId, tripId);
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      select: { startDate: true, endDate: true },
    });
    if (!trip) throw this.tripNotFound();
    const firstDay = await this.prisma.itineraryDay.upsert({
      where: { tripId_date: { tripId, date: trip.startDate } },
      update: {},
      create: {
        id: newId(),
        tripId,
        date: trip.startDate,
        title: "첫째 날",
        sortOrder: 0,
      },
    });
    const secondDay = await this.prisma.itineraryDay.upsert({
      where: { tripId_date: { tripId, date: trip.endDate } },
      update: {},
      create: {
        id: newId(),
        tripId,
        date: trip.endDate,
        title: "둘째 날",
        sortOrder: 1,
      },
    });
    const existing = await this.prisma.itineraryItem.count({
      where: { day: { tripId } },
    });
    if (existing === 0) {
      await this.prisma.itineraryItem.createMany({
        data: [
          this.templateItem(
            firstDay.id,
            userId,
            "TRANSPORT",
            "서울 출발",
            "2026-08-29T09:00:00+09:00",
            0,
          ),
          this.templateItem(
            firstDay.id,
            userId,
            "SHOPPING",
            "가평 마트 장보기",
            "2026-08-29T11:30:00+09:00",
            1,
          ),
          this.templateItem(
            firstDay.id,
            userId,
            "CHECK_IN",
            "글램핑장 체크인",
            "2026-08-29T15:00:00+09:00",
            2,
          ),
          this.templateItem(
            firstDay.id,
            userId,
            "MEAL",
            "바비큐 저녁",
            "2026-08-29T18:00:00+09:00",
            3,
          ),
          this.templateItem(
            firstDay.id,
            userId,
            "ACTIVITY",
            "불멍과 대화",
            "2026-08-29T21:00:00+09:00",
            4,
          ),
          this.templateItem(
            secondDay.id,
            userId,
            "MEAL",
            "아침 식사",
            "2026-08-30T09:00:00+09:00",
            0,
          ),
          this.templateItem(
            secondDay.id,
            userId,
            "CHECK_OUT",
            "체크아웃",
            "2026-08-30T11:00:00+09:00",
            1,
          ),
          this.templateItem(
            secondDay.id,
            userId,
            "ACTIVITY",
            "가평 카페 또는 산책",
            "2026-08-30T12:00:00+09:00",
            2,
          ),
          this.templateItem(
            secondDay.id,
            userId,
            "TRANSPORT",
            "서울 귀가",
            "2026-08-30T15:00:00+09:00",
            3,
          ),
        ],
      });
    }
    return this.itinerary(userId, tripId);
  }

  async addItineraryItem(userId: string, tripId: string, input: CreateItineraryItemInput) {
    await this.access.requireWriter(userId, tripId);
    const day = await this.prisma.itineraryDay.findFirst({
      where: { id: input.dayId, tripId },
      include: { _count: { select: { items: true } } },
    });
    if (!day) throw this.itineraryNotFound();
    const item = await this.prisma.itineraryItem.create({
      data: {
        id: newId(),
        dayId: input.dayId,
        type: input.type,
        title: input.title,
        ...(input.startsAt === undefined ? {} : { startsAt: new Date(input.startsAt) }),
        ...(input.endsAt === undefined ? {} : { endsAt: new Date(input.endsAt) }),
        ...(input.placeId === undefined ? {} : { placeId: input.placeId }),
        ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
        ...(input.costEstimate === undefined ? {} : { costEstimate: input.costEstimate }),
        details: input.note ? { note: input.note } : {},
        sortOrder: day._count.items,
        createdById: userId,
      },
      include: { place: true, assignee: { select: { id: true, nickname: true } } },
    });
    await this.points.awardActivity(tripId, userId, "ITINERARY", item.id);
    return item;
  }

  async updateItineraryItem(userId: string, itemId: string, input: UpdateItineraryItemInput) {
    const item = await this.requireItineraryItem(itemId);
    await this.access.requireWriter(userId, item.day.tripId);
    return this.prisma.itineraryItem.update({
      where: { id: itemId },
      data: {
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.startsAt === undefined ? {} : { startsAt: new Date(input.startsAt) }),
        ...(input.endsAt === undefined ? {} : { endsAt: new Date(input.endsAt) }),
        ...(input.placeId === undefined ? {} : { placeId: input.placeId }),
        ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
        ...(input.costEstimate === undefined ? {} : { costEstimate: input.costEstimate }),
        ...(input.note === undefined ? {} : { details: { note: input.note } }),
        version: { increment: 1 },
      },
      include: { place: true, assignee: { select: { id: true, nickname: true } } },
    });
  }

  async removeItineraryItem(userId: string, itemId: string) {
    const item = await this.requireItineraryItem(itemId);
    await this.access.requireWriter(userId, item.day.tripId);
    await this.prisma.itineraryItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  private presentPoll(
    poll: {
      id: string;
      tripId: string;
      type: string;
      title: string;
      description: string | null;
      options: unknown;
      maxSelections: number;
      anonymous: boolean;
      resultsVisibility: string;
      closesAt: Date | null;
      status: string;
      createdAt: Date;
      createdBy: { id: string; nickname: string };
      votes: Array<{ userId: string; payload: unknown; revision: number; castAt: Date }>;
      comments: Array<{
        id: string;
        authorId: string;
        body: string;
        createdAt: Date;
        author: { id: string; nickname: string };
      }>;
    },
    userId: string,
    canManage: boolean,
  ) {
    const resultsVisible = poll.resultsVisibility === "ALWAYS" || poll.status === "CLOSED";
    return {
      ...poll,
      voteCount: poll.votes.length,
      myVote: poll.votes.find((vote) => vote.userId === userId)?.payload ?? null,
      results: resultsVisible ? this.pollResults(poll) : null,
      canClose: canManage && poll.status === "OPEN",
      canDelete: canManage || poll.createdBy.id === userId,
      comments: poll.comments.map((comment) => ({
        ...comment,
        canDelete: canManage || comment.authorId === userId,
      })),
      votes: undefined,
    };
  }

  private pollResults(poll: { options: unknown; votes: Array<{ payload: unknown }> }) {
    const options = poll.options as PollOption[];
    const counts = new Map(options.map((option) => [option.id, 0]));
    for (const vote of poll.votes) {
      const optionIds = (vote.payload as { optionIds?: unknown }).optionIds;
      if (!Array.isArray(optionIds)) continue;
      optionIds.forEach((optionId) => {
        if (typeof optionId === "string" && counts.has(optionId)) {
          counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
        }
      });
    }
    return options.map((option) => ({
      ...option,
      count: counts.get(option.id) ?? 0,
    }));
  }

  private templateItem(
    dayId: string,
    createdById: string,
    type: "TRANSPORT" | "SHOPPING" | "CHECK_IN" | "MEAL" | "ACTIVITY" | "CHECK_OUT",
    title: string,
    startsAt: string,
    sortOrder: number,
  ) {
    return {
      id: newId(),
      dayId,
      createdById,
      type,
      title,
      startsAt: new Date(startsAt),
      sortOrder,
    };
  }

  private async requireItineraryItem(itemId: string) {
    const item = await this.prisma.itineraryItem.findUnique({
      where: { id: itemId },
      include: { day: true },
    });
    if (!item) throw this.itineraryNotFound();
    return item;
  }

  private pollNotFound() {
    return new NotFoundException({
      code: "POLL_NOT_FOUND",
      message: "투표를 찾을 수 없습니다.",
    });
  }

  private pollCommentNotFound() {
    return new NotFoundException({
      code: "POLL_COMMENT_NOT_FOUND",
      message: "투표 의견을 찾을 수 없습니다.",
    });
  }

  private itineraryNotFound() {
    return new NotFoundException({
      code: "ITINERARY_NOT_FOUND",
      message: "일정 항목을 찾을 수 없습니다.",
    });
  }

  private tripNotFound() {
    return new NotFoundException({
      code: "TRIP_NOT_FOUND",
      message: "여행을 찾을 수 없습니다.",
    });
  }
}
