import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import type { ApiSuccess, AuthResult } from "@campflow/contracts";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://campflow:campflow_dev@127.0.0.1:5433/campflow";
process.env.JWT_ACCESS_SECRET = "test-access-secret-at-least-32-characters";
process.env.REFRESH_TOKEN_PEPPER = "test-refresh-pepper-at-least-32-characters";
process.env.INVITE_TOKEN_PEPPER = "test-invite-pepper-at-least-32-characters";
process.env.APP_ORIGIN = "http://localhost:5173";
process.env.API_PUBLIC_URL = "http://localhost:4000";

describe("인증 → 그룹 → 초대 권한 흐름 (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("v1");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function signUp(label: string) {
    const response = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({
        email: `e2e-${randomUUID()}@campflow.local`,
        password: "SafePassword2026!",
        nickname: label,
      })
      .expect(201);
    return (response.body as ApiSuccess<AuthResult>).data;
  }

  it("별도 계정 초대와 IDOR 차단을 검증한다", async () => {
    const owner = await signUp("소유자");
    const friend = await signUp("친구");
    const outsider = await signUp("외부인");

    const groupResponse = await request(app.getHttpServer())
      .post("/v1/groups")
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "E2E 글램핑 모임", description: "권한 통합 테스트" })
      .expect(201);
    const group = (groupResponse.body as ApiSuccess<{ id: string }>).data;

    const inviteResponse = await request(app.getHttpServer())
      .post(`/v1/groups/${group.id}/invites`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        role: "MEMBER",
        expiresInHours: 24,
        maxUses: 2,
        requireApproval: false,
      })
      .expect(201);
    const invite = (inviteResponse.body as ApiSuccess<{ token: string }>).data;

    await request(app.getHttpServer())
      .get(`/v1/invites/${invite.token}/preview`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/v1/invites/${invite.token}/accept`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/v1/groups/${group.id}`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .expect(200);

    const denied = await request(app.getHttpServer())
      .get(`/v1/groups/${group.id}`)
      .set("authorization", `Bearer ${outsider.accessToken}`)
      .expect(404);
    expect(denied.body).toMatchObject({
      error: { code: "GROUP_NOT_FOUND" },
    });
  });
});
