import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateCommentInput, CreateMessageInput, CreatePostInput } from "@campflow/contracts";
import { newId } from "@campflow/domain";
import { PrismaService } from "../prisma/prisma.service";
import { PointsService } from "../points/points.service";
import { TripAccessService } from "../trips/trip-access.service";

@Injectable()
export class CollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
    private readonly points: PointsService,
  ) {}

  async posts(userId: string, tripId: string) {
    await this.access.requireMembership(userId, tripId);
    return this.prisma.boardPost.findMany({
      where: { tripId, deletedAt: null },
      include: {
        author: { select: { id: true, nickname: true } },
        comments: {
          where: { deletedAt: null },
          include: { author: { select: { id: true, nickname: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ pinnedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
  }

  async createPost(userId: string, tripId: string, input: CreatePostInput) {
    await this.access.requireWriter(userId, tripId);
    const post = await this.prisma.boardPost.create({
      data: {
        id: newId(),
        tripId,
        authorId: userId,
        ...input,
      },
      include: {
        author: { select: { id: true, nickname: true } },
        comments: true,
      },
    });
    await this.notifyTripMembers(tripId, userId, "POST_CREATED", {
      tripId,
      postId: post.id,
      title: post.title,
    });
    await this.points.awardActivity(tripId, userId, "POST", post.id);
    return post;
  }

  async addComment(userId: string, postId: string, input: CreateCommentInput) {
    const post = await this.prisma.boardPost.findFirst({
      where: { id: postId, deletedAt: null },
    });
    if (!post) throw this.postNotFound();
    await this.access.requireWriter(userId, post.tripId);
    if (input.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: input.parentId, postId, deletedAt: null },
      });
      if (!parent) {
        throw new NotFoundException({
          code: "COMMENT_NOT_FOUND",
          message: "답글 대상 댓글을 찾을 수 없습니다.",
        });
      }
    }
    const comment = await this.prisma.comment.create({
      data: {
        id: newId(),
        postId,
        authorId: userId,
        bodyMarkdown: input.bodyMarkdown,
        ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
      },
      include: { author: { select: { id: true, nickname: true } } },
    });
    await this.points.awardActivity(post.tripId, userId, "COMMENT", comment.id);
    return comment;
  }

  async deletePost(userId: string, postId: string) {
    const post = await this.prisma.boardPost.findFirst({
      where: { id: postId, deletedAt: null },
    });
    if (!post) throw this.postNotFound();
    const membership = await this.access.requireMembership(userId, post.tripId);
    if (post.authorId !== userId && membership.role !== "MANAGER") {
      throw this.authorRequired();
    }
    await this.prisma.boardPost.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  async messages(userId: string, tripId: string) {
    await this.access.requireMembership(userId, tripId);
    return this.prisma.chatMessage.findMany({
      where: { tripId, deletedAt: null },
      include: { author: { select: { id: true, nickname: true } } },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
  }

  async createMessage(userId: string, tripId: string, input: CreateMessageInput) {
    await this.access.requireWriter(userId, tripId);
    return this.prisma.chatMessage.upsert({
      where: {
        tripId_clientMessageId: { tripId, clientMessageId: input.clientMessageId },
      },
      update: {},
      create: {
        id: newId(),
        tripId,
        authorId: userId,
        body: input.body,
        clientMessageId: input.clientMessageId,
      },
      include: { author: { select: { id: true, nickname: true } } },
    });
  }

  async notifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async readNotifications(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  private async notifyTripMembers(
    tripId: string,
    actorId: string,
    type: string,
    payload: Record<string, string>,
  ) {
    const members = await this.access.members(tripId);
    const recipients = members.filter((member) => member.userId !== actorId);
    if (recipients.length === 0) return;
    await this.prisma.notification.createMany({
      data: recipients.map((member) => ({
        id: newId(),
        userId: member.userId,
        type,
        payload,
      })),
    });
  }

  private postNotFound() {
    return new NotFoundException({
      code: "POST_NOT_FOUND",
      message: "게시글을 찾을 수 없습니다.",
    });
  }

  private authorRequired() {
    return new ForbiddenException({
      code: "AUTHOR_OR_MANAGER_REQUIRED",
      message: "작성자 또는 여행 관리자만 삭제할 수 있습니다.",
    });
  }
}
