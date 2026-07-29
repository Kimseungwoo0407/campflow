import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { CookieOptions, Response } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signUpSchema,
  verifyEmailSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
  type SignUpInput,
  type VerifyEmailInput,
} from "@campflow/contracts";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { Public } from "../common/auth/public.decorator";
import type { AuthenticatedUser, RequestContext } from "../common/http/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { CSRF_COOKIE_NAME, CsrfGuard } from "./csrf.guard";

const REFRESH_COOKIE_NAME = "campflow_refresh";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("signup")
  @ApiOperation({ summary: "이메일 회원가입" })
  async signUp(
    @Body(new ZodValidationPipe(signUpSchema)) input: SignUpInput,
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.signUp(input, this.clientMetadata(request));
    this.setSessionCookies(response, result.refreshToken, result.csrfToken);
    return this.publicResult(result);
  }

  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("login")
  @ApiOperation({ summary: "이름 아이디 또는 이메일 로그인" })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input, this.clientMetadata(request));
    this.setSessionCookies(response, result.refreshToken, result.csrfToken);
    return this.publicResult(result);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post("verify-email")
  @ApiOperation({ summary: "단일 사용 토큰으로 이메일 확인" })
  verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) input: VerifyEmailInput,
  ) {
    return this.auth.verifyEmail(input);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post("forgot-password")
  @ApiOperation({ summary: "계정 열거를 방지하는 비밀번호 재설정 요청" })
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) input: ForgotPasswordInput,
  ) {
    return this.auth.forgotPassword(input);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post("reset-password")
  @ApiOperation({ summary: "단일 사용 토큰으로 비밀번호 재설정" })
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) input: ResetPasswordInput,
  ) {
    return this.auth.resetPassword(input);
  }

  @Public()
  @UseGuards(CsrfGuard)
  @HttpCode(200)
  @Post("refresh")
  @ApiOperation({ summary: "회전식 refresh cookie로 access token 갱신" })
  async refresh(
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies[REFRESH_COOKIE_NAME] as string | undefined;
    const result = await this.auth.refresh(token ?? "");
    this.setSessionCookies(response, result.refreshToken, result.csrfToken);
    return this.publicResult(result);
  }

  @Public()
  @UseGuards(CsrfGuard)
  @HttpCode(200)
  @Post("logout")
  @ApiOperation({ summary: "현재 refresh session 로그아웃" })
  async logout(
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.cookies[REFRESH_COOKIE_NAME] as string | undefined);
    this.clearSessionCookies(response);
    return { loggedOut: true };
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post("logout-all")
  @ApiOperation({ summary: "사용자의 전체 세션 로그아웃" })
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.logoutAll(user.id, user.sessionId);
  }

  @ApiBearerAuth()
  @Get("sessions")
  @ApiOperation({ summary: "활성 기기 세션 목록" })
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.listSessions(user.id, user.sessionId);
  }

  @ApiBearerAuth()
  @Delete("sessions/:id")
  @ApiOperation({ summary: "지정 기기 세션 해제" })
  revokeSession(@CurrentUser() user: AuthenticatedUser, @Param("id") sessionId: string) {
    return this.auth.revokeSession(user.id, sessionId);
  }

  private clientMetadata(request: RequestContext) {
    return {
      ip: request.ip,
      userAgent: request.header("user-agent"),
    };
  }

  private publicResult<T extends { refreshToken: string }>(result: T): Omit<T, "refreshToken"> {
    const { refreshToken, ...safe } = result;
    void refreshToken;
    return safe;
  }

  private cookieBase(): CookieOptions {
    return {
      secure: this.config.get<boolean>("COOKIE_SECURE", false),
      sameSite: this.config.get<"lax" | "strict" | "none">("COOKIE_SAME_SITE", "lax"),
    };
  }

  private setSessionCookies(response: Response, refreshToken: string, csrfToken: string): void {
    const days = this.config.get<number>("REFRESH_TOKEN_TTL_DAYS", 30);
    const maxAge = days * 86_400_000;
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...this.cookieBase(),
      httpOnly: true,
      path: "/v1/auth",
      maxAge,
    });
    response.cookie(CSRF_COOKIE_NAME, csrfToken, {
      ...this.cookieBase(),
      httpOnly: false,
      path: "/",
      maxAge,
      ...(this.config.get<string>("COOKIE_DOMAIN")
        ? { domain: this.config.getOrThrow<string>("COOKIE_DOMAIN") }
        : {}),
    });
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, {
      ...this.cookieBase(),
      httpOnly: true,
      path: "/v1/auth",
    });
    response.clearCookie(CSRF_COOKIE_NAME, {
      ...this.cookieBase(),
      httpOnly: false,
      path: "/",
      ...(this.config.get<string>("COOKIE_DOMAIN")
        ? { domain: this.config.getOrThrow<string>("COOKIE_DOMAIN") }
        : {}),
    });
  }
}
