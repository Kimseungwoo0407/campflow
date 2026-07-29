import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  createCommentSchema,
  createMessageSchema,
  createPostSchema,
  type CreateCommentInput,
  type CreateMessageInput,
  type CreatePostInput,
} from "@campflow/contracts";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/http/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { CollaborationService } from "./collaboration.service";

@ApiTags("Board, Lounge & Notifications")
@ApiBearerAuth()
@Controller()
export class CollaborationController {
  constructor(private readonly collaboration: CollaborationService) {}

  @Get("trips/:tripId/posts")
  posts(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.collaboration.posts(user.id, tripId);
  }

  @Post("trips/:tripId/posts")
  createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(createPostSchema)) input: CreatePostInput,
  ) {
    return this.collaboration.createPost(user.id, tripId, input);
  }

  @Post("posts/:id/comments")
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") postId: string,
    @Body(new ZodValidationPipe(createCommentSchema)) input: CreateCommentInput,
  ) {
    return this.collaboration.addComment(user.id, postId, input);
  }

  @Delete("posts/:id")
  deletePost(@CurrentUser() user: AuthenticatedUser, @Param("id") postId: string) {
    return this.collaboration.deletePost(user.id, postId);
  }

  @Get("trips/:tripId/messages")
  messages(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.collaboration.messages(user.id, tripId);
  }

  @Post("trips/:tripId/messages")
  createMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(createMessageSchema)) input: CreateMessageInput,
  ) {
    return this.collaboration.createMessage(user.id, tripId, input);
  }

  @Get("notifications")
  notifications(@CurrentUser() user: AuthenticatedUser) {
    return this.collaboration.notifications(user.id);
  }

  @Post("notifications/read")
  readNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.collaboration.readNotifications(user.id);
  }
}
