import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { updateProfileSchema, type UpdateProfileInput } from "@campflow/contracts";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/http/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { UsersService } from "./users.service";

@ApiTags("Users")
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "내 프로필 조회" })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.me(user.id);
  }

  @Patch("me")
  @ApiOperation({ summary: "내 프로필 변경" })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) input: UpdateProfileInput,
  ) {
    return this.users.update(user.id, input);
  }

  @Get("users/:id/public")
  @ApiOperation({ summary: "그룹 표시용 공개 프로필" })
  publicProfile(@Param("id") id: string) {
    return this.users.publicProfile(id);
  }
}
