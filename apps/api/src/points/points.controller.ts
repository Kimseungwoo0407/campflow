import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  lotteryDrawSchema,
  createPenaltyMatchSchema,
  joinPenaltyMatchSchema,
  oddEvenGameSchema,
  redeemRewardSchema,
  rpsRouletteGameSchema,
  snailRaceGameSchema,
  submitTapScoreSchema,
  type LotteryDrawInput,
  type CreatePenaltyMatchInput,
  type JoinPenaltyMatchInput,
  type OddEvenGameInput,
  type RedeemRewardInput,
  type RpsRouletteGameInput,
  type SnailRaceGameInput,
  type SubmitTapScoreInput,
} from "@campflow/contracts";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/http/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { PointsService } from "./points.service";

@ApiTags("Points, Rewards & Arcade")
@ApiBearerAuth()
@Controller()
export class PointsController {
  constructor(private readonly points: PointsService) {}

  @Get("trips/:tripId/points")
  dashboard(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.points.dashboard(user.id, tripId);
  }

  @Get("trips/:tripId/points/rules")
  rules(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.points.dashboard(user.id, tripId).then((data) => data.rules);
  }

  @Post("trips/:tripId/points/check-in")
  checkIn(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.points.checkIn(user.id, tripId);
  }

  @Post("trips/:tripId/rewards/:rewardId/redeem")
  redeem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Param("rewardId") rewardId: string,
    @Body(new ZodValidationPipe(redeemRewardSchema)) input: RedeemRewardInput,
  ) {
    return this.points.redeem(user.id, tripId, rewardId, input);
  }

  @Post("trips/:tripId/games/odd-even")
  oddEven(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(oddEvenGameSchema)) input: OddEvenGameInput,
  ) {
    return this.points.playOddEven(user.id, tripId, input);
  }

  @Post("trips/:tripId/games/snail-race")
  snailRace(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(snailRaceGameSchema)) input: SnailRaceGameInput,
  ) {
    return this.points.playSnailRace(user.id, tripId, input);
  }

  @Post("trips/:tripId/games/rps-roulette")
  rpsRoulette(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(rpsRouletteGameSchema)) input: RpsRouletteGameInput,
  ) {
    return this.points.playRpsRoulette(user.id, tripId, input);
  }

  @Post("trips/:tripId/games/lottery")
  lottery(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(lotteryDrawSchema)) input: LotteryDrawInput,
  ) {
    return this.points.drawLottery(user.id, tripId, input);
  }

  @Post("trips/:tripId/games/tap-score")
  tapScore(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(submitTapScoreSchema)) input: SubmitTapScoreInput,
  ) {
    return this.points.submitTapScore(user.id, tripId, input);
  }

  @Get("trips/:tripId/games/penalty-matches")
  penaltyMatches(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.points.penaltyMatches(user.id, tripId);
  }

  @Post("trips/:tripId/games/penalty-matches")
  createPenaltyMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(createPenaltyMatchSchema))
    input: CreatePenaltyMatchInput,
  ) {
    return this.points.createPenaltyMatch(user.id, tripId, input);
  }

  @Post("games/penalty-matches/:matchId/join")
  joinPenaltyMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param("matchId") matchId: string,
    @Body(new ZodValidationPipe(joinPenaltyMatchSchema)) input: JoinPenaltyMatchInput,
  ) {
    return this.points.joinPenaltyMatch(user.id, matchId, input);
  }

  @Post("games/penalty-matches/:matchId/cancel")
  cancelPenaltyMatch(@CurrentUser() user: AuthenticatedUser, @Param("matchId") matchId: string) {
    return this.points.cancelPenaltyMatch(user.id, matchId);
  }

  @Get("trips/:tripId/characters")
  characters(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.points.characterProfiles(user.id, tripId);
  }

  @Get("trips/:tripId/characters/:memberUserId/content")
  characterContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Param("memberUserId") memberUserId: string,
  ) {
    return this.points.characterContent(user.id, tripId, memberUserId);
  }
}
