import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import type { ApiSuccess, AuthResult } from "@campflow/contracts";
import { PrismaService } from "../src/prisma/prisma.service";

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
    const prisma = app.get(PrismaService);
    await prisma.user.update({
      where: { id: owner.user.id },
      data: { username: `소유자-${randomUUID()}` },
    });

    const secondaryLoginResponse = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({
        identifier: (await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } }))
          .username,
        password: "SafePassword2026!",
      })
      .expect(200);
    const secondaryLogin = (secondaryLoginResponse.body as ApiSuccess<AuthResult>).data;

    await request(app.getHttpServer())
      .post("/v1/auth/change-password")
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ currentPassword: "wrong-password", newPassword: "SaferPassword2026!" })
      .expect(401);
    await request(app.getHttpServer())
      .post("/v1/auth/change-password")
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        currentPassword: "SafePassword2026!",
        newPassword: "SaferPassword2026!",
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.changed).toBe(true);
        expect(body.data.revokedSessionCount).toBeGreaterThanOrEqual(1);
      });
    await request(app.getHttpServer())
      .get("/v1/me")
      .set("authorization", `Bearer ${secondaryLogin.accessToken}`)
      .expect(401);

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

    await request(app.getHttpServer()).get(`/v1/invites/${invite.token}/preview`).expect(200);

    await request(app.getHttpServer())
      .post(`/v1/invites/${invite.token}/accept`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/v1/groups/${group.id}`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .expect(200);

    const tripResponse = await request(app.getHttpServer())
      .post(`/v1/groups/${group.id}/trips`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        title: "E2E 고정 날짜 여행",
        purpose: "Phase 2 권한과 날짜 검증",
        regionText: "가평",
        budgetPerPerson: 180000,
        attendeeCount: 2,
      })
      .expect(201);
    const trip = (
      tripResponse.body as ApiSuccess<{
        id: string;
        startDate: string;
        endDate: string;
        status: string;
      }>
    ).data;
    expect(trip.startDate.slice(0, 10)).toBe("2026-08-29");
    expect(trip.endDate.slice(0, 10)).toBe("2026-08-30");
    expect(trip.status).toBe("SEARCHING");

    await request(app.getHttpServer())
      .get(`/v1/trips/${trip.id}`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/transition`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .send({ status: "VOTING" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/transition`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "VOTING", reason: "후보 수집 완료" })
      .expect(201);

    const ownerCheckIn = await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/points/check-in`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);
    expect(ownerCheckIn.body).toMatchObject({
      data: { alreadyCheckedIn: false, awarded: 20 },
    });
    await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/points/check-in`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: { alreadyCheckedIn: true, awarded: 0 },
        });
      });
    await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/points/check-in`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .expect(201);

    const grantRequestId = randomUUID();
    await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/points/grants`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .send({
        targetUserId: owner.user.id,
        amount: 100,
        reason: "권한 없는 지급",
        clientRequestId: randomUUID(),
      })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/points/grants`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        targetUserId: owner.user.id,
        amount: 100,
        reason: "본인 지급",
        clientRequestId: randomUUID(),
      })
      .expect(409);
    const pointGrant = await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/points/grants`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        targetUserId: friend.user.id,
        amount: 100,
        reason: "장보기 담당 보상",
        clientRequestId: grantRequestId,
      })
      .expect(201);
    expect(pointGrant.body).toMatchObject({
      data: {
        duplicate: false,
        entry: { delta: 100, user: { id: friend.user.id } },
      },
    });
    const duplicatePointGrant = await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/points/grants`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        targetUserId: friend.user.id,
        amount: 100,
        reason: "장보기 담당 보상",
        clientRequestId: grantRequestId,
      })
      .expect(201);
    expect(duplicatePointGrant.body.data.entry.id).toBe(pointGrant.body.data.entry.id);
    expect(duplicatePointGrant.body.data.duplicate).toBe(true);

    const publicMessages = await request(app.getHttpServer())
      .get(`/v1/trips/${trip.id}/messages`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .expect(200);
    expect(publicMessages.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: expect.stringContaining("소유자 관리자가 친구님에게 +100P"),
        }),
      ]),
    );

    await prisma.gameRound.createMany({
      data: Array.from({ length: 3 }, () => ({
        id: randomUUID(),
        tripId: trip.id,
        userId: friend.user.id,
        gameType: "SNAIL_RACE" as const,
        clientRoundId: randomUUID(),
        wager: 10,
        pointDelta: 30,
        result: { selected: 1, winner: 1, won: true },
      })),
    });
    const achievementProgress = await request(app.getHttpServer())
      .get(`/v1/trips/${trip.id}/achievements`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .expect(200);
    expect(achievementProgress.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "SNAIL_STREAK_3",
          progress: 3,
          target: 3,
          reward: 100,
          claimable: true,
        }),
      ]),
    );
    const achievementClaim = await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/achievements/SNAIL_STREAK_3/claim`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .expect(201);
    expect(achievementClaim.body).toMatchObject({
      data: { alreadyClaimed: false, entry: { delta: 100 } },
    });
    const duplicateAchievementClaim = await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/achievements/SNAIL_STREAK_3/claim`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .expect(201);
    expect(duplicateAchievementClaim.body).toMatchObject({
      data: {
        alreadyClaimed: true,
        entry: { id: achievementClaim.body.data.entry.id },
      },
    });

    const placeResponse = await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/places/manual`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        canonicalName: "E2E 비공개 글램핑장",
        address: "경기도 가평군 테스트로 1",
        lat: 37.8,
        lng: 127.5,
        category: "글램핑",
        amenities: ["주차"],
      })
      .expect(201);
    const place = (placeResponse.body as ApiSuccess<{ id: string }>).data;

    await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/candidates`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ placeId: place.id, pros: ["테스트"], cons: [] })
      .expect(201);

    const pollResponse = await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/polls`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        type: "SINGLE",
        title: "E2E 메뉴 투표",
        optionLabels: ["바비큐", "닭갈비"],
        anonymous: false,
        resultsVisibility: "ALWAYS",
      })
      .expect(201);
    const poll = (
      pollResponse.body as ApiSuccess<{
        id: string;
        options: Array<{ id: string }>;
      }>
    ).data;
    await request(app.getHttpServer())
      .post(`/v1/polls/${poll.id}/votes`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .send({ optionIds: [poll.options[0]!.id] })
      .expect(201);

    const tapRoundId = randomUUID();
    const tapResult = await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/games/tap-score`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ score: 40, clientRoundId: tapRoundId })
      .expect(201);
    expect(tapResult.body).toMatchObject({
      data: { gameType: "TAP", score: 40, pointDelta: 15 },
    });

    const duplicateTapResult = await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/games/tap-score`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ score: 40, clientRoundId: tapRoundId })
      .expect(201);
    expect(duplicateTapResult.body.data.id).toBe(tapResult.body.data.id);

    const ladderResult = await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/games/odd-even`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        startChoice: "LEFT",
        rungCountChoice: 3,
        wager: 10,
        clientRoundId: randomUUID(),
      })
      .expect(201);
    expect(ladderResult.body.data.result).toMatchObject({
      startChoice: "LEFT",
      rungCountChoice: 3,
      selectedCount: 2,
      payoutMultiplier: 3.6,
    });
    expect([3, 4]).toContain(ladderResult.body.data.result.rungCount);
    expect(ladderResult.body.data.result.rungYs).toHaveLength(
      ladderResult.body.data.result.rungCount,
    );
    expect(["LEFT", "RIGHT"]).toContain(ladderResult.body.data.result.startSide);

    const penaltyResponse = await request(app.getHttpServer())
      .post(`/v1/trips/${trip.id}/games/penalty-matches`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ action: "KICK", direction: "RIGHT", wager: 10 })
      .expect(201);
    const penalty = (penaltyResponse.body as ApiSuccess<{ id: string }>).data;
    const hiddenPenalty = await request(app.getHttpServer())
      .get(`/v1/trips/${trip.id}/games/penalty-matches`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .expect(200);
    expect(hiddenPenalty.body.data[0]).not.toHaveProperty("creatorDirection");
    await request(app.getHttpServer())
      .post(`/v1/games/penalty-matches/${penalty.id}/join`)
      .set("authorization", `Bearer ${friend.accessToken}`)
      .send({ action: "DIVE", direction: "RIGHT" })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({ data: { status: "RESOLVED", goal: false } });
      });

    const pointsDashboard = await request(app.getHttpServer())
      .get(`/v1/trips/${trip.id}/points`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(pointsDashboard.body.data.balanceLeaderboard).toHaveLength(2);
    expect(pointsDashboard.body.data.myRole).toBe("MANAGER");
    expect(pointsDashboard.body.data.recentEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          delta: 100,
          reason: expect.stringContaining("관리자 공개 지급"),
        }),
      ]),
    );
    expect(pointsDashboard.body.data.rules.games.lottery.tiers[0]).toMatchObject({
      probability: "0.0000001%",
    });

    const denied = await request(app.getHttpServer())
      .get(`/v1/groups/${group.id}`)
      .set("authorization", `Bearer ${outsider.accessToken}`)
      .expect(404);
    expect(denied.body).toMatchObject({
      error: { code: "GROUP_NOT_FOUND" },
    });

    await request(app.getHttpServer())
      .get(`/v1/trips/${trip.id}`)
      .set("authorization", `Bearer ${outsider.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/v1/trips/${trip.id}/points`)
      .set("authorization", `Bearer ${outsider.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({
        identifier: (await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } }))
          .username,
        password: "SafePassword2026!",
      })
      .expect(401);
    await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({
        identifier: (await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } }))
          .username,
        password: "SaferPassword2026!",
      })
      .expect(200);
  });
});
