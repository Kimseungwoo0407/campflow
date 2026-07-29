import { createHmac } from "node:crypto";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { newId, normalizeEmail } from "@campflow/domain";

const prisma = new PrismaClient();

interface SeedAccount {
  username: string;
  email: string;
  nickname: string;
  password: string;
}

function tokenHash(value: string): string {
  const pepper = process.env.INVITE_TOKEN_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error("INVITE_TOKEN_PEPPER는 32자 이상이어야 합니다.");
  }
  return createHmac("sha256", pepper).update(value).digest("hex");
}

function friendAccounts(): SeedAccount[] | undefined {
  const raw = process.env.SEED_FRIEND_ACCOUNTS_JSON?.trim();
  if (!raw) return undefined;

  const parsed = JSON.parse(raw) as unknown;
  if (
    !Array.isArray(parsed) ||
    parsed.length < 2 ||
    parsed.some(
      (account) =>
        typeof account !== "object" ||
        account === null ||
        !("username" in account) ||
        typeof account.username !== "string" ||
        account.username.trim().length < 2 ||
        !("email" in account) ||
        typeof account.email !== "string" ||
        !account.email.includes("@") ||
        !("nickname" in account) ||
        typeof account.nickname !== "string" ||
        account.nickname.trim().length < 2 ||
        !("password" in account) ||
        typeof account.password !== "string" ||
        account.password.length < 4,
    )
  ) {
    throw new Error("SEED_FRIEND_ACCOUNTS_JSON 형식이 올바르지 않습니다.");
  }
  return parsed as SeedAccount[];
}

async function main() {
  const privateAccounts = friendAccounts();
  if (
    process.env.NODE_ENV === "production" &&
    (process.env.ALLOW_PRODUCTION_SEED !== "true" || !privateAccounts)
  ) {
    throw new Error(
      "운영 seed는 비공개 친구 계정과 ALLOW_PRODUCTION_SEED=true가 있을 때만 실행할 수 있습니다.",
    );
  }

  const developmentPassword = process.env.SEED_PASSWORD ?? "CampFlow2026!";
  const accounts =
    privateAccounts ??
    [
      {
        username: "owner",
        email: "owner@campflow.local",
        nickname: "캠프장",
        password: developmentPassword,
      },
      {
        username: "friend1",
        email: "friend1@campflow.local",
        nickname: "불멍이",
        password: developmentPassword,
      },
      {
        username: "friend2",
        email: "friend2@campflow.local",
        nickname: "별보러가자",
        password: developmentPassword,
      },
    ];

  const users = [];
  for (const account of accounts) {
    const email = normalizeEmail(account.email);
    const username = account.username.trim().normalize("NFKC").toLocaleLowerCase("ko-KR");
    const passwordHash = await argon2.hash(account.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    const user = await prisma.user.upsert({
      where: { email },
      update: { username, nickname: account.nickname },
      create: {
        id: newId(),
        username,
        email,
        nickname: account.nickname,
        passwordHash,
        mustChangePassword: false,
        emailVerifiedAt: new Date(),
        profile: { create: {} },
      },
    });
    users.push(user);
  }

  const owner = users[0];
  if (!owner) {
    throw new Error("Seed 소유자를 만들지 못했습니다.");
  }

  const existingGroup = await prisma.group.findFirst({
    where: { ownerId: owner.id, name: "8월 29~30일 글램핑" },
  });
  const group =
    existingGroup ??
    (await prisma.group.create({
      data: {
        id: newId(),
        ownerId: owner.id,
        name: "8월 29~30일 글램핑",
        description: "2026년 8월 29일부터 30일까지 함께 준비하는 1박 2일 여행",
        settings: {
          currency: "KRW",
          settlementRule: "EQUAL",
          boardCategories: ["공지", "자유", "장소", "준비", "질문", "후기"],
        },
      },
    }));

  await Promise.all(
    users.map((user, index) =>
      prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: user.id } },
        update: { status: "ACTIVE" },
        create: {
          groupId: group.id,
          userId: user.id,
          role: index === 0 ? "OWNER" : "MEMBER",
          status: "ACTIVE",
        },
      }),
    ),
  );

  const demoToken = "demo-invite-token-2026";
  const demoCode = "DEMO2026";
  await prisma.invite.upsert({
    where: { tokenHash: tokenHash(demoToken) },
    update: { expiresAt: new Date("2099-12-31T00:00:00.000Z"), revokedAt: null },
    create: {
      id: newId(),
      groupId: group.id,
      tokenHash: tokenHash(demoToken),
      codeHash: tokenHash(demoCode),
      role: "MEMBER",
      expiresAt: new Date("2099-12-31T00:00:00.000Z"),
      maxUses: 100,
      requireApproval: false,
      createdById: owner.id,
    },
  });

  console.info("Seed 완료");
  console.info(`계정: ${accounts.map((account) => account.username).join(", ")}`);
  if (!privateAccounts) {
    console.info("개발 전용 공통 비밀번호는 SEED_PASSWORD 또는 README를 확인하세요.");
  }
  console.info(`초대 코드: ${demoCode}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
