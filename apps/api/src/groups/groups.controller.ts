import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  createGroupSchema,
  createInviteSchema,
  updateGroupSchema,
  updateMemberSchema,
  type CreateGroupInput,
  type CreateInviteInput,
  type UpdateGroupInput,
  type UpdateMemberInput,
} from "@campflow/contracts";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { Public } from "../common/auth/public.decorator";
import type { AuthenticatedUser } from "../common/http/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { GroupsService } from "./groups.service";

@ApiTags("Groups")
@Controller()
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @ApiBearerAuth()
  @Get("groups")
  @ApiOperation({ summary: "내 그룹 목록" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.groups.list(user.id);
  }

  @ApiBearerAuth()
  @Post("groups")
  @ApiOperation({ summary: "그룹 생성" })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createGroupSchema)) input: CreateGroupInput,
  ) {
    return this.groups.create(user.id, input);
  }

  @ApiBearerAuth()
  @Get("groups/:id")
  @ApiOperation({ summary: "그룹 상세" })
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") groupId: string) {
    return this.groups.get(user.id, groupId);
  }

  @ApiBearerAuth()
  @Patch("groups/:id")
  @ApiOperation({ summary: "그룹 설정 변경(소유자)" })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") groupId: string,
    @Body(new ZodValidationPipe(updateGroupSchema)) input: UpdateGroupInput,
  ) {
    return this.groups.update(user.id, groupId, input);
  }

  @ApiBearerAuth()
  @Delete("groups/:id")
  @ApiOperation({ summary: "그룹 소프트 삭제(소유자)" })
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") groupId: string) {
    return this.groups.remove(user.id, groupId);
  }

  @ApiBearerAuth()
  @Get("groups/:id/members")
  @ApiOperation({ summary: "그룹 멤버 목록" })
  members(@CurrentUser() user: AuthenticatedUser, @Param("id") groupId: string) {
    return this.groups.members(user.id, groupId);
  }

  @ApiBearerAuth()
  @Patch("groups/:id/members/:userId")
  @ApiOperation({ summary: "멤버 역할/상태 변경(소유자)" })
  updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") groupId: string,
    @Param("userId") targetUserId: string,
    @Body(new ZodValidationPipe(updateMemberSchema)) input: UpdateMemberInput,
  ) {
    return this.groups.updateMember(user.id, groupId, targetUserId, input);
  }

  @ApiBearerAuth()
  @Delete("groups/:id/members/:userId")
  @ApiOperation({ summary: "멤버 제거(소유자)" })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") groupId: string,
    @Param("userId") targetUserId: string,
  ) {
    return this.groups.removeMember(user.id, groupId, targetUserId);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post("groups/:id/invites")
  @ApiOperation({ summary: "초대 링크와 8자리 코드 생성(소유자)" })
  createInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") groupId: string,
    @Body(new ZodValidationPipe(createInviteSchema)) input: CreateInviteInput,
  ) {
    return this.groups.createInvite(user.id, groupId, input);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get("invites/:token/preview")
  @ApiOperation({ summary: "초대 공개 미리보기" })
  preview(@Param("token") token: string) {
    return this.groups.previewInvite(token);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post("invites/:token/accept")
  @ApiOperation({ summary: "로그인 사용자 초대 수락" })
  accept(@CurrentUser() user: AuthenticatedUser, @Param("token") token: string) {
    return this.groups.acceptInvite(user.id, token);
  }
}
