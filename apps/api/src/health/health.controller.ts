import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/auth/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("Health")
@Public()
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health/live")
  @ApiOperation({ summary: "API 프로세스 생존 확인" })
  live() {
    return {
      status: "ok",
      service: "campflow-api",
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get("health/ready")
  @ApiOperation({ summary: "DB 연결과 API 준비 상태 확인" })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ready", database: "up" };
    } catch {
      throw new ServiceUnavailableException({
        code: "NOT_READY",
        message: "데이터베이스 연결을 확인해 주세요.",
        details: { database: "down" },
      });
    }
  }

  @Get("health/dependencies")
  @ApiOperation({ summary: "의존 서비스의 단계별 상태 확인" })
  async dependencies() {
    const database = await this.prisma.$queryRaw`SELECT 1`
      .then(() => "up" as const)
      .catch(() => "down" as const);
    return {
      status: database === "up" ? "degraded" : "down",
      dependencies: {
        database,
        redis: process.env.REDIS_URL ? "configured-not-required" : "disabled",
        storage: process.env.STORAGE_DRIVER ?? "local",
        providers: "mock-only",
      },
    };
  }

  @Get("version")
  @ApiOperation({ summary: "배포 버전 확인" })
  version() {
    return {
      name: "campflow-api",
      version: process.env.APP_VERSION ?? "0.1.0",
      phase: "phase-0-1",
    };
  }
}
