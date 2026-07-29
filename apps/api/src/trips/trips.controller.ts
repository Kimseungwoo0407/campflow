import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  createTripSchema,
  transitionTripSchema,
  updateTripSchema,
  type CreateTripInput,
  type TransitionTripInput,
  type UpdateTripInput,
} from "@campflow/contracts";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/http/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { TripsService } from "./trips.service";

@ApiTags("Trips")
@ApiBearerAuth()
@Controller()
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Get("trips")
  @ApiOperation({ summary: "내 여행 목록" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.trips.list(user.id);
  }

  @Get("groups/:groupId/trips")
  @ApiOperation({ summary: "그룹의 여행 목록" })
  listForGroup(@CurrentUser() user: AuthenticatedUser, @Param("groupId") groupId: string) {
    return this.trips.listForGroup(user.id, groupId);
  }

  @Post("groups/:groupId/trips")
  @ApiOperation({ summary: "확정 날짜로 여행 생성" })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("groupId") groupId: string,
    @Body(new ZodValidationPipe(createTripSchema)) input: CreateTripInput,
  ) {
    return this.trips.create(user.id, groupId, input);
  }

  @Get("trips/:id")
  @ApiOperation({ summary: "여행 대시보드 데이터" })
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") tripId: string) {
    return this.trips.get(user.id, tripId);
  }

  @Patch("trips/:id")
  @ApiOperation({ summary: "여행 기본 정보 변경" })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") tripId: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodValidationPipe(updateTripSchema)) input: UpdateTripInput,
  ) {
    const expectedVersion = ifMatch ? Number(ifMatch.replaceAll('"', "")) : undefined;
    return this.trips.update(
      user.id,
      tripId,
      input,
      Number.isInteger(expectedVersion) ? expectedVersion : undefined,
    );
  }

  @Post("trips/:id/transition")
  @ApiOperation({ summary: "여행 단계 진행" })
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") tripId: string,
    @Body(new ZodValidationPipe(transitionTripSchema)) input: TransitionTripInput,
  ) {
    return this.trips.transition(user.id, tripId, input);
  }

  @Delete("trips/:id")
  @ApiOperation({ summary: "여행 소프트 삭제" })
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") tripId: string) {
    return this.trips.remove(user.id, tripId);
  }
}
