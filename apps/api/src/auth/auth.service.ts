import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import type { Prisma, Session, User } from "@prisma/client";
import argon2 from "argon2";
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type {
  AuthResult,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignUpInput,
  VerifyEmailInput,
} from "@campflow/contracts";
import { newId, normalizeEmail } from "@campflow/domain";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";

interface ClientMetadata {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

interface RefreshPayload {
  sub: string;
  sid: string;
  jti: string;
  typ: "refresh";
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async signUp(
    input: SignUpInput,
    metadata: ClientMetadata,
  ): Promise<
    AuthResult & {
      refreshToken: string;
      emailDelivery: "smtp" | "preview" | "failed";
      developmentVerificationToken?: string;
    }
  > {
    const email = normalizeEmail(input.email);
    const passwordHash = await this.hashPassword(input.password);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          id: newId(),
          email,
          passwordHash,
          nickname: input.nickname,
          profile: { create: {} },
        },
      });
    } catch (error: unknown) {
      if (this.hasPrismaCode(error, "P2002")) {
        throw new ConflictException({
          code: "EMAIL_ALREADY_USED",
          message: "이미 사용 중인 이메일입니다.",
        });
      }
      throw error;
    }

    const verificationToken = await this.createAuthToken(
      user.id,
      "EMAIL_VERIFICATION",
      24 * 60,
    );
    const emailDelivery = await this.mail.sendVerification(user.email, verificationToken);
    const result = await this.createSession(user, metadata);
    await this.audit.record({
      actorId: user.id,
      action: "auth.signup",
      targetType: "User",
      targetId: user.id,
    });
    return {
      ...result,
      emailDelivery,
      ...(emailDelivery === "preview" ? { developmentVerificationToken: verificationToken } : {}),
    };
  }

  async login(input: LoginInput, metadata: ClientMetadata): Promise<AuthResult & { refreshToken: string }> {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const verified = user ? await argon2.verify(user.passwordHash, input.password).catch(() => false) : false;

    if (!user || !verified || user.status !== "ACTIVE") {
      await this.audit.record({
        action: "auth.login_failed",
        targetType: "User",
        metadata: { emailHash: this.hashSensitive(email) },
        ipHash: metadata.ip ? this.hashSensitive(metadata.ip) : undefined,
      });
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "이메일 또는 비밀번호를 확인해 주세요.",
      });
    }

    const result = await this.createSession(user, metadata);
    await this.audit.record({
      actorId: user.id,
      action: "auth.login",
      targetType: "Session",
      targetId: this.extractSessionId(result.refreshToken),
      ipHash: metadata.ip ? this.hashSensitive(metadata.ip) : undefined,
    });
    return result;
  }

  async refresh(
    refreshToken: string,
  ): Promise<AuthResult & { refreshToken: string }> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== "ACTIVE"
    ) {
      throw this.invalidRefresh();
    }

    const currentHash = this.hashRefreshToken(refreshToken);
    if (!this.constantTimeEquals(session.refreshTokenHash, currentHash)) {
      await this.prisma.session.updateMany({
        where: { id: payload.sid, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "refresh_token_reuse" },
      });
      await this.audit.record({
        actorId: session.userId,
        action: "auth.refresh_reuse_detected",
        targetType: "Session",
        targetId: session.id,
      });
      throw new UnauthorizedException({
        code: "REFRESH_TOKEN_REUSED",
        message: "세션 보안을 위해 다시 로그인해 주세요.",
      });
    }

    const rotatedToken = await this.signRefreshToken(session);
    const update = await this.prisma.session.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: currentHash,
        revokedAt: null,
      },
      data: {
        refreshTokenHash: this.hashRefreshToken(rotatedToken),
        lastUsedAt: new Date(),
      },
    });
    if (update.count !== 1) {
      await this.prisma.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "concurrent_refresh_or_reuse" },
      });
      throw new UnauthorizedException({
        code: "REFRESH_TOKEN_REUSED",
        message: "세션 보안을 위해 다시 로그인해 주세요.",
      });
    }

    return {
      accessToken: await this.signAccessToken(session.user, session.id),
      refreshToken: rotatedToken,
      csrfToken: this.createCsrfToken(),
      user: this.toSessionUser(session.user),
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      await this.prisma.session.updateMany({
        where: { id: payload.sid, userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "logout" },
      });
    } catch {
      return;
    }
  }

  async verifyEmail(input: VerifyEmailInput): Promise<{ verified: true }> {
    const tokenHash = this.hashAuthToken(input.token);
    const token = await this.prisma.authToken.findFirst({
      where: {
        tokenHash,
        purpose: "EMAIL_VERIFICATION",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!token) {
      throw new UnauthorizedException({
        code: "INVALID_EMAIL_TOKEN",
        message: "만료되었거나 이미 사용된 이메일 확인 링크입니다.",
      });
    }

    const claimed = await this.prisma.$transaction(async (transaction) => {
      const update = await transaction.authToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (update.count !== 1) return false;
      await transaction.user.update({
        where: { id: token.userId },
        data: { emailVerifiedAt: new Date() },
      });
      return true;
    });
    if (!claimed) {
      throw new UnauthorizedException({
        code: "INVALID_EMAIL_TOKEN",
        message: "만료되었거나 이미 사용된 이메일 확인 링크입니다.",
      });
    }
    await this.audit.record({
      actorId: token.userId,
      action: "auth.email_verified",
      targetType: "User",
      targetId: token.userId,
    });
    return { verified: true };
  }

  async forgotPassword(
    input: ForgotPasswordInput,
  ): Promise<{
    accepted: true;
    delivery: "smtp" | "preview" | "failed" | "not_applicable" | "accepted";
    developmentResetToken?: string;
  }> {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findFirst({
      where: { email, status: "ACTIVE" },
    });
    if (!user) {
      return {
        accepted: true,
        delivery:
          this.config.get<string>("NODE_ENV") === "production"
            ? "accepted"
            : "not_applicable",
      };
    }

    const resetToken = await this.createAuthToken(user.id, "PASSWORD_RESET", 30);
    const delivery = await this.mail.sendPasswordReset(user.email, resetToken);
    await this.audit.record({
      actorId: user.id,
      action: "auth.password_reset_requested",
      targetType: "User",
      targetId: user.id,
    });
    if (this.config.get<string>("NODE_ENV") === "production") {
      return { accepted: true, delivery: "accepted" };
    }
    return {
      accepted: true,
      delivery,
      ...(delivery === "preview" ? { developmentResetToken: resetToken } : {}),
    };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ reset: true }> {
    const tokenHash = this.hashAuthToken(input.token);
    const token = await this.prisma.authToken.findFirst({
      where: {
        tokenHash,
        purpose: "PASSWORD_RESET",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!token) {
      throw new UnauthorizedException({
        code: "INVALID_RESET_TOKEN",
        message: "만료되었거나 이미 사용된 비밀번호 재설정 링크입니다.",
      });
    }

    const passwordHash = await this.hashPassword(input.password);
    const claimed = await this.prisma.$transaction(async (transaction) => {
      const update = await transaction.authToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (update.count !== 1) return false;
      await transaction.user.update({
        where: { id: token.userId },
        data: { passwordHash, mustChangePassword: false },
      });
      await transaction.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "password_reset" },
      });
      return true;
    });
    if (!claimed) {
      throw new UnauthorizedException({
        code: "INVALID_RESET_TOKEN",
        message: "만료되었거나 이미 사용된 비밀번호 재설정 링크입니다.",
      });
    }
    await this.audit.record({
      actorId: token.userId,
      action: "auth.password_reset",
      targetType: "User",
      targetId: token.userId,
    });
    return { reset: true };
  }

  async logoutAll(userId: string, currentSessionId: string): Promise<{ revokedCount: number }> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "logout_all" },
    });
    await this.audit.record({
      actorId: userId,
      action: "auth.logout_all",
      targetType: "Session",
      targetId: currentSessionId,
      metadata: { revokedCount: result.count },
    });
    return { revokedCount: result.count };
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });
    return sessions.map((session) => ({
      ...session,
      current: session.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<{ revoked: boolean }> {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "device_logout" },
    });
    return { revoked: result.count === 1 };
  }

  private async createSession(
    user: User,
    metadata: ClientMetadata,
  ): Promise<AuthResult & { refreshToken: string }> {
    const sessionId = newId();
    const ttlDays = this.config.get<number>("REFRESH_TOKEN_TTL_DAYS", 30);
    const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
    const session: Pick<Session, "id" | "userId" | "expiresAt"> = {
      id: sessionId,
      userId: user.id,
      expiresAt,
    };
    const refreshToken = await this.signRefreshToken(session);

    const sessionData: Prisma.SessionUncheckedCreateInput = {
      id: sessionId,
      userId: user.id,
      refreshTokenHash: this.hashRefreshToken(refreshToken),
      expiresAt,
      ...(metadata.userAgent === undefined
        ? {}
        : { userAgent: metadata.userAgent.slice(0, 500) }),
      ...(metadata.ip === undefined ? {} : { ipHash: this.hashSensitive(metadata.ip) }),
    };
    await this.prisma.session.create({
      data: sessionData,
    });

    return {
      accessToken: await this.signAccessToken(user, sessionId),
      refreshToken,
      csrfToken: this.createCsrfToken(),
      user: this.toSessionUser(user),
    };
  }

  private async createAuthToken(
    userId: string,
    purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET",
    ttlMinutes: number,
  ): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.prisma.$transaction([
      this.prisma.authToken.updateMany({
        where: { userId, purpose, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.authToken.create({
        data: {
          id: newId(),
          userId,
          purpose,
          tokenHash: this.hashAuthToken(token),
          expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        },
      }),
    ]);
    return token;
  }

  private async signAccessToken(user: User, sessionId: string): Promise<string> {
    const expiresIn = (this.config.get<string>("ACCESS_TOKEN_TTL") ??
      "15m") as NonNullable<JwtSignOptions["expiresIn"]>;
    return this.jwt.signAsync(
      { sub: user.id, sid: sessionId, email: user.email, typ: "access" },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn,
        audience: "campflow-web",
        issuer: "campflow-api",
      },
    );
  }

  private async signRefreshToken(session: Pick<Session, "id" | "userId" | "expiresAt">): Promise<string> {
    const expiresIn = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
    return this.jwt.signAsync(
      {
        sub: session.userId,
        sid: session.id,
        jti: randomUUID(),
        typ: "refresh",
      },
      {
        secret: this.config.getOrThrow<string>("REFRESH_TOKEN_PEPPER"),
        expiresIn,
        audience: "campflow-api",
        issuer: "campflow-api",
      },
    );
  }

  private async verifyRefreshToken(token: string): Promise<RefreshPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>("REFRESH_TOKEN_PEPPER"),
        audience: "campflow-api",
        issuer: "campflow-api",
      });
      if (payload.typ !== "refresh") {
        throw this.invalidRefresh();
      }
      return payload;
    } catch {
      throw this.invalidRefresh();
    }
  }

  private extractSessionId(token: string): string | undefined {
    const decoded = this.jwt.decode<{ sid?: string }>(token);
    return decoded?.sid;
  }

  private hashRefreshToken(token: string): string {
    return createHmac("sha256", this.config.getOrThrow<string>("REFRESH_TOKEN_PEPPER"))
      .update(token)
      .digest("hex");
  }

  private hashAuthToken(token: string): string {
    return createHmac("sha256", this.config.getOrThrow<string>("REFRESH_TOKEN_PEPPER"))
      .update(`auth-token:${token}`)
      .digest("hex");
  }

  private hashSensitive(value: string): string {
    return createHmac("sha256", this.config.getOrThrow<string>("REFRESH_TOKEN_PEPPER"))
      .update(value)
      .digest("hex");
  }

  private createCsrfToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private constantTimeEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  private toSessionUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      locale: user.locale,
      timezone: user.timezone,
    };
  }

  private invalidRefresh(): UnauthorizedException {
    return new UnauthorizedException({
      code: "INVALID_REFRESH_TOKEN",
      message: "세션이 만료되었습니다. 다시 로그인해 주세요.",
    });
  }

  private hasPrismaCode(error: unknown, code: string): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === code
    );
  }
}
