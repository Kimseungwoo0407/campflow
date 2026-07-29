import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  createCandidateSchema,
  createPlaceSchema,
  updateCandidateSchema,
  type CreateCandidateInput,
  type CreatePlaceInput,
  type UpdateCandidateInput,
} from "@campflow/contracts";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/http/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { PlacesService } from "./places.service";

@ApiTags("Places & Candidates")
@ApiBearerAuth()
@Controller()
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get("trips/:tripId/places/search")
  @ApiOperation({ summary: "OpenStreetMap 기반 실제 장소 검색" })
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Query("q") query = "",
  ) {
    return this.places.search(user.id, tripId, query);
  }

  @Post("trips/:tripId/places/manual")
  @ApiOperation({ summary: "사용자 장소 직접 등록" })
  createManual(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(createPlaceSchema)) input: CreatePlaceInput,
  ) {
    return this.places.createManual(user.id, tripId, input);
  }

  @Get("trips/:tripId/candidates")
  @ApiOperation({ summary: "후보 및 비교 데이터" })
  candidates(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.places.candidates(user.id, tripId);
  }

  @Post("trips/:tripId/candidates")
  @ApiOperation({ summary: "장소 후보 추가" })
  addCandidate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(createCandidateSchema)) input: CreateCandidateInput,
  ) {
    return this.places.addCandidate(user.id, tripId, input);
  }

  @Patch("candidates/:id")
  @ApiOperation({ summary: "후보 메모·가격·확정 상태 변경" })
  updateCandidate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") candidateId: string,
    @Body(new ZodValidationPipe(updateCandidateSchema)) input: UpdateCandidateInput,
  ) {
    return this.places.updateCandidate(user.id, candidateId, input);
  }

  @Delete("candidates/:id")
  @ApiOperation({ summary: "후보 제거" })
  removeCandidate(@CurrentUser() user: AuthenticatedUser, @Param("id") candidateId: string) {
    return this.places.removeCandidate(user.id, candidateId);
  }
}
