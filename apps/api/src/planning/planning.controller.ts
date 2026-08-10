import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  createItineraryItemSchema,
  createPollCommentSchema,
  createPollSchema,
  pollVoteSchema,
  updateItineraryItemSchema,
  type CreateItineraryItemInput,
  type CreatePollCommentInput,
  type CreatePollInput,
  type PollVoteInput,
  type UpdateItineraryItemInput,
} from "@campflow/contracts";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/http/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { PlanningService } from "./planning.service";

@ApiTags("Polls & Itinerary")
@ApiBearerAuth()
@Controller()
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Get("trips/:tripId/polls")
  polls(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.planning.polls(user.id, tripId);
  }

  @Post("trips/:tripId/polls")
  createPoll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(createPollSchema)) input: CreatePollInput,
  ) {
    return this.planning.createPoll(user.id, tripId, input);
  }

  @Post("polls/:id/votes")
  vote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") pollId: string,
    @Body(new ZodValidationPipe(pollVoteSchema)) input: PollVoteInput,
  ) {
    return this.planning.vote(user.id, pollId, input);
  }

  @Post("polls/:id/comments")
  addPollComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") pollId: string,
    @Body(new ZodValidationPipe(createPollCommentSchema)) input: CreatePollCommentInput,
  ) {
    return this.planning.addPollComment(user.id, pollId, input);
  }

  @Delete("poll-comments/:id")
  removePollComment(@CurrentUser() user: AuthenticatedUser, @Param("id") commentId: string) {
    return this.planning.removePollComment(user.id, commentId);
  }

  @Post("polls/:id/close")
  closePoll(@CurrentUser() user: AuthenticatedUser, @Param("id") pollId: string) {
    return this.planning.closePoll(user.id, pollId);
  }

  @Get("trips/:tripId/itinerary/days")
  itinerary(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.planning.itinerary(user.id, tripId);
  }

  @Post("trips/:tripId/itinerary/generate-template")
  @ApiOperation({ summary: "확정 날짜 기반 1박 2일 일정 템플릿 생성" })
  generateTemplate(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.planning.generateTemplate(user.id, tripId);
  }

  @Post("trips/:tripId/itinerary/items")
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(createItineraryItemSchema)) input: CreateItineraryItemInput,
  ) {
    return this.planning.addItineraryItem(user.id, tripId, input);
  }

  @Patch("itinerary/items/:id")
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") itemId: string,
    @Body(new ZodValidationPipe(updateItineraryItemSchema)) input: UpdateItineraryItemInput,
  ) {
    return this.planning.updateItineraryItem(user.id, itemId, input);
  }

  @Delete("itinerary/items/:id")
  removeItem(@CurrentUser() user: AuthenticatedUser, @Param("id") itemId: string) {
    return this.planning.removeItineraryItem(user.id, itemId);
  }
}
