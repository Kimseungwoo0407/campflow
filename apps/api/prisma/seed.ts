import { createHmac } from "node:crypto";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { newId, normalizeEmail } from "@campflow/domain";

const prisma = new PrismaClient();

function tokenHash(value: string): string {
  const pepper = process.env.INVITE_TOKEN_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error("INVITE_TOKEN_PEPPER는 32자 이상이어야 합니다.");
  }
  return createHmac("sha256", pepper).update(value).digest("hex");
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("개발 seed는 production에서 실행할 수 없습니다.");
  }

  const password = process.env.SEED_PASSWORD ?? "CampFlow2026!";
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const accounts = [
    { email: "owner@campflow.local", nickname: "캠프장" },
    { email: "friend1@campflow.local", nickname: "불멍이" },
    { email: "friend2@campflow.local", nickname: "별보러가자" },
  ];

  const users = [];
  for (const account of accounts) {
    const email = normalizeEmail(account.email);
    const user = await prisma.user.upsert({
      where: { email },
      update: { nickname: account.nickname },
      create: {
        id: newId(),
        email,
        nickname: account.nickname,
        passwordHash,
        mustChangePassword: true,
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
    where: { ownerId: owner.id, name: "주말엔 밖으로" },
  });
  const group =
    existingGroup ??
    (await prisma.group.create({
      data: {
        id: newId(),
        ownerId: owner.id,
        name: "주말엔 밖으로",
        description: "CampFlow Phase 1 데모 그룹",
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
  console.info(`계정: ${accounts.map((account) => account.email).join(", ")}`);
  console.info(`개발 전용 임시 비밀번호: ${password}`);
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
