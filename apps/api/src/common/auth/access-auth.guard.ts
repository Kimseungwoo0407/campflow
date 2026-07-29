import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service";
import { IS_PUBLIC_KEY } from "./public.decorator";
import type { RequestContext } from "../http/request-context";

interface AccessPayload {
  sub: string;
  sid: string;
  email: string;
  typ: "access";
}

@Injectable()
export class AccessAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestContext>();
    const authorization = request.header("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw this.unauthorized();
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(authorization.slice(7), {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      if (payload.typ !== "access") {
        throw this.unauthorized();
      }

      const session = await this.prisma.session.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: { status: "ACTIVE" },
        },
        select: { id: true },
      });
      if (!session) {
        throw this.unauthorized();
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        sessionId: payload.sid,
      };
      return true;
    } catch {
      throw this.unauthorized();
    }
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({
      code: "AUTH_REQUIRED",
      message: "로그인이 필요합니다.",
    });
  }
}
