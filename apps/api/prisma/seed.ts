import { createHmac } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import argon2 from "argon2";
import { Prisma, PrismaClient } from "@prisma/client";
import { calculateSettlements, newId, normalizeEmail, splitAmountEvenly } from "@campflow/domain";

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
  const accounts = privateAccounts ?? [
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

  const users: Prisma.UserGetPayload<Record<string, never>>[] = [];
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
      update: {
        username,
        nickname: account.nickname,
        passwordHash,
        mustChangePassword: false,
        status: "ACTIVE",
      },
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

  const trip = await prisma.trip.upsert({
    where: { seedKey: "fixed-2026-08-29-glamping" },
    update: {
      groupId: group.id,
      createdById: owner.id,
      title: "8월 29~30일 가평 글램핑",
      purpose: "네 친구가 함께 준비하는 1박 2일 글램핑",
      status: "SEARCHING",
      startDate: new Date("2026-08-29T00:00:00.000Z"),
      endDate: new Date("2026-08-30T00:00:00.000Z"),
      dateRangeStart: new Date("2026-08-29T00:00:00.000Z"),
      dateRangeEnd: new Date("2026-08-30T00:00:00.000Z"),
      nights: 1,
      regionText: "가평",
      budgetPerPerson: 180_000,
      attendeeCount: users.length,
      deletedAt: null,
      settings: {
        datesLocked: true,
        timezone: "Asia/Seoul",
        currency: "KRW",
      },
    },
    create: {
      id: newId(),
      groupId: group.id,
      createdById: owner.id,
      seedKey: "fixed-2026-08-29-glamping",
      title: "8월 29~30일 가평 글램핑",
      purpose: "네 친구가 함께 준비하는 1박 2일 글램핑",
      status: "SEARCHING",
      startDate: new Date("2026-08-29T00:00:00.000Z"),
      endDate: new Date("2026-08-30T00:00:00.000Z"),
      dateRangeStart: new Date("2026-08-29T00:00:00.000Z"),
      dateRangeEnd: new Date("2026-08-30T00:00:00.000Z"),
      nights: 1,
      regionText: "가평",
      budgetPerPerson: 180_000,
      attendeeCount: users.length,
      settings: {
        datesLocked: true,
        timezone: "Asia/Seoul",
        currency: "KRW",
      },
    },
  });

  await Promise.all(
    users.map((user, index) =>
      prisma.tripMember.upsert({
        where: { tripId_userId: { tripId: trip.id, userId: user.id } },
        update: {
          attendanceStatus: "ATTENDING",
          role: index === 0 ? "MANAGER" : "MEMBER",
        },
        create: {
          tripId: trip.id,
          userId: user.id,
          role: index === 0 ? "MANAGER" : "MEMBER",
          attendanceStatus: "ATTENDING",
          isCoreMember: index === 0,
        },
      }),
    ),
  );

  await Promise.all(
    users.map((user) =>
      prisma.pointWallet.upsert({
        where: { tripId_userId: { tripId: trip.id, userId: user.id } },
        update: {},
        create: {
          tripId: trip.id,
          userId: user.id,
          balance: 0,
          earnedTotal: 0,
          spentTotal: 0,
        },
      }),
    ),
  );

  const characterRoots = [
    resolve(process.cwd(), "character"),
    resolve(process.cwd(), "..", "..", "character"),
  ];
  let characterRoot = characterRoots[0]!;
  let profileFiles: string[] = [];
  for (const candidate of characterRoots) {
    const files = await readdir(resolve(candidate, "profiles")).catch(() => undefined);
    if (files) {
      characterRoot = candidate;
      profileFiles = files;
      break;
    }
  }
  const profileDirectory = resolve(characterRoot, "profiles");
  const characterPlan = await readFile(resolve(characterRoot, "캐릭터_기획.md"), "utf8").catch(
    () => "",
  );
  for (const fileName of profileFiles.filter((name) => name.endsWith("_프로필.png"))) {
    const nameKey = fileName.replace(/_프로필\.png$/u, "");
    const user = users.find(
      (candidate) => candidate.nickname.includes(nameKey) || candidate.username?.includes(nameKey),
    );
    if (!user) continue;
    const imageData = await readFile(resolve(profileDirectory, fileName));
    const planSection = characterPlan
      .split("\n## ")
      .find((section) => section.startsWith(`${nameKey} ·`));
    const sectionLines = planSection?.split("\n") ?? [];
    const concept =
      sectionLines[0]?.split("·")[1]?.trim() ?? "단톡방에서 드러난 역할을 가진 여행 코미디 능력자";
    const reason =
      sectionLines
        .filter(
          (line) =>
            line.startsWith("- 말투·성격:") ||
            line.startsWith("- 역할:") ||
            line.startsWith("- 웃긴 포인트:"),
        )
        .map((line) => line.slice(line.indexOf(":") + 1).trim())
        .join(" ") ||
      "실제 사진의 핵심 외모와 단톡방에서 반복된 말투·행동·관심사를 대표 소품과 상황으로 반영했습니다.";
    await prisma.tripCharacterProfile.upsert({
      where: { tripId_userId: { tripId: trip.id, userId: user.id } },
      update: {
        concept,
        reason,
        mime: "image/png",
        imageData,
      },
      create: {
        tripId: trip.id,
        userId: user.id,
        concept,
        reason,
        mime: "image/png",
        imageData,
      },
    });
  }

  const fixedDateDecision = await prisma.decisionLog.findFirst({
    where: { tripId: trip.id, decisionType: "DATE_CONFIRMED" },
  });
  if (!fixedDateDecision) {
    await prisma.decisionLog.create({
      data: {
        id: newId(),
        tripId: trip.id,
        decisionType: "DATE_CONFIRMED",
        decidedById: owner.id,
        reason: "사용자가 확정한 2026년 8월 29~30일 일정",
        snapshot: {
          startDate: "2026-08-29",
          endDate: "2026-08-30",
          nights: 1,
          timezone: "Asia/Seoul",
        },
      },
    });
  }

  const placeSeeds = [
    {
      canonicalName: "북한강 별빛 글램핑",
      address: "경기도 가평군 청평면 북한강로 100",
      lat: 37.7256,
      lng: 127.4218,
      description: "강변 불멍 공간과 개별 바비큐가 있는 샘플 후보",
      amenities: ["개별 바비큐", "불멍", "주차", "침대", "개별 화장실"],
      estimatedTotal: 620_000,
      pros: ["강 전망", "개별 화장실"],
      cons: ["주말 교통 혼잡 가능"],
    },
    {
      canonicalName: "가평 숲속 캐빈 글램핑",
      address: "경기도 가평군 상면 수목원로 220",
      lat: 37.7668,
      lng: 127.3532,
      description: "숲속 독립형 객실과 넓은 공용 주방을 갖춘 샘플 후보",
      amenities: ["독립 객실", "공용 주방", "주차", "산책로", "빔프로젝터"],
      estimatedTotal: 560_000,
      pros: ["조용한 숲", "넓은 공용 공간"],
      cons: ["대중교통 접근이 어려움"],
    },
    {
      canonicalName: "자라섬 리버뷰 캠프",
      address: "경기도 가평군 가평읍 자라섬로 60",
      lat: 37.8184,
      lng: 127.5191,
      description: "역과 가까우며 강 전망을 볼 수 있는 샘플 후보",
      amenities: ["리버뷰", "대중교통", "바비큐", "주차", "매점"],
      estimatedTotal: 590_000,
      pros: ["대중교통 접근", "마트와 가까움"],
      cons: ["객실 간격이 비교적 가까움"],
    },
  ];
  const candidates: Prisma.TripCandidateGetPayload<{ include: { place: true } }>[] = [];
  for (const placeSeed of placeSeeds) {
    const existingPlace = await prisma.place.findFirst({
      where: { canonicalName: placeSeed.canonicalName, sourceProvider: "MOCK" },
    });
    const place =
      existingPlace ??
      (await prisma.place.create({
        data: {
          id: newId(),
          canonicalName: placeSeed.canonicalName,
          address: placeSeed.address,
          lat: placeSeed.lat,
          lng: placeSeed.lng,
          category: "글램핑",
          description: placeSeed.description,
          amenities: placeSeed.amenities,
          sourceProvider: "MOCK",
          isSample: true,
          websiteUrl: `https://example.com/${encodeURIComponent(placeSeed.canonicalName)}`,
        },
      }));
    const candidate = await prisma.tripCandidate.upsert({
      where: { tripId_placeId: { tripId: trip.id, placeId: place.id } },
      update: {
        estimatedTotal: placeSeed.estimatedTotal,
        pros: placeSeed.pros,
        cons: placeSeed.cons,
      },
      create: {
        id: newId(),
        tripId: trip.id,
        placeId: place.id,
        addedById: owner.id,
        estimatedTotal: placeSeed.estimatedTotal,
        priceNote: "샘플 예상액 · 실제 예약 전 재확인 필요",
        pros: placeSeed.pros,
        cons: placeSeed.cons,
      },
      include: { place: true },
    });
    candidates.push(candidate);
  }

  let poll = await prisma.poll.findFirst({
    where: { tripId: trip.id, title: "우리 숙소 1순위 고르기" },
  });
  if (!poll) {
    poll = await prisma.poll.create({
      data: {
        id: newId(),
        tripId: trip.id,
        createdById: owner.id,
        type: "SINGLE",
        title: "우리 숙소 1순위 고르기",
        description: "후보 비교 후 가장 마음에 드는 한 곳을 선택해 주세요.",
        options: candidates.map((candidate) => ({
          id: candidate.id,
          label: candidate.place.canonicalName,
        })),
        anonymous: false,
        resultsVisibility: "ALWAYS",
        closesAt: new Date("2026-08-05T21:00:00+09:00"),
      },
    });
  }
  await Promise.all(
    users.map((user, index) => {
      const candidate = candidates[index % candidates.length];
      if (!candidate) throw new Error("투표 후보를 만들지 못했습니다.");
      return prisma.pollVote.upsert({
        where: { pollId_userId: { pollId: poll.id, userId: user.id } },
        update: { payload: { optionIds: [candidate.id] } },
        create: {
          pollId: poll.id,
          userId: user.id,
          payload: { optionIds: [candidate.id] },
        },
      });
    }),
  );

  const itineraryDays = await Promise.all(
    [
      { date: new Date("2026-08-29T00:00:00.000Z"), title: "첫째 날", sortOrder: 0 },
      { date: new Date("2026-08-30T00:00:00.000Z"), title: "둘째 날", sortOrder: 1 },
    ].map((day) =>
      prisma.itineraryDay.upsert({
        where: { tripId_date: { tripId: trip.id, date: day.date } },
        update: { title: day.title, sortOrder: day.sortOrder },
        create: { id: newId(), tripId: trip.id, ...day },
      }),
    ),
  );
  if ((await prisma.itineraryItem.count({ where: { day: { tripId: trip.id } } })) === 0) {
    const [firstDay, secondDay] = itineraryDays;
    if (!firstDay || !secondDay) throw new Error("일정 날짜를 만들지 못했습니다.");
    const itinerarySeed = [
      [firstDay.id, "TRANSPORT", "서울 출발", "2026-08-29T09:00:00+09:00", 0],
      [firstDay.id, "SHOPPING", "가평 마트 장보기", "2026-08-29T11:30:00+09:00", 1],
      [firstDay.id, "CHECK_IN", "글램핑장 체크인", "2026-08-29T15:00:00+09:00", 2],
      [firstDay.id, "MEAL", "바비큐 저녁", "2026-08-29T18:00:00+09:00", 3],
      [firstDay.id, "ACTIVITY", "불멍과 보드게임", "2026-08-29T21:00:00+09:00", 4],
      [secondDay.id, "MEAL", "아침 식사", "2026-08-30T09:00:00+09:00", 0],
      [secondDay.id, "CHECK_OUT", "체크아웃", "2026-08-30T11:00:00+09:00", 1],
      [secondDay.id, "ACTIVITY", "가평 카페", "2026-08-30T12:00:00+09:00", 2],
      [secondDay.id, "TRANSPORT", "서울 귀가", "2026-08-30T15:00:00+09:00", 3],
    ] as const;
    await prisma.itineraryItem.createMany({
      data: itinerarySeed.map(([dayId, type, title, startsAt, sortOrder]) => ({
        id: newId(),
        dayId,
        createdById: owner.id,
        type,
        title,
        startsAt: new Date(startsAt),
        sortOrder,
      })),
    });
  }

  if ((await prisma.boardPost.count({ where: { tripId: trip.id } })) === 0) {
    await prisma.boardPost.createMany({
      data: [
        {
          id: newId(),
          tripId: trip.id,
          authorId: owner.id,
          category: "공지",
          title: "여행 날짜 확정: 8월 29~30일",
          bodyMarkdown: "날짜는 확정입니다. 이제 숙소와 차량, 준비물을 정해요.",
          pinnedAt: new Date(),
        },
        {
          id: newId(),
          tripId: trip.id,
          authorId: users[1]?.id ?? owner.id,
          category: "준비",
          title: "먹고 싶은 메뉴 적어주세요",
          bodyMarkdown: "바비큐 외에 아침과 야식 아이디어를 댓글로 남겨주세요.",
        },
        {
          id: newId(),
          tripId: trip.id,
          authorId: users[2]?.id ?? owner.id,
          category: "장소",
          title: "숙소 후보 비교 포인트",
          bodyMarkdown: "개별 화장실, 주차, 불멍 가능 여부를 우선으로 봅시다.",
        },
      ],
    });
  }

  if ((await prisma.tripTask.count({ where: { tripId: trip.id } })) === 0) {
    const taskSeeds = [
      ["숙박", "예약 정보와 체크인 시간 확인", "HIGH"],
      ["취사", "바비큐 고기와 채소 준비", "HIGH"],
      ["취사", "물·음료·얼음 준비", "MEDIUM"],
      ["의약", "상비약과 벌레 퇴치제", "HIGH"],
      ["전자기기", "멀티탭과 충전기", "MEDIUM"],
      ["날씨", "우산과 여벌 옷", "MEDIUM"],
      ["공용", "보드게임", "LOW"],
      ["공용", "쓰레기봉투와 키친타월", "MEDIUM"],
      ["개인", "세면도구와 수건", "MEDIUM"],
      ["개인", "신분증과 개인 약", "HIGH"],
      ["공용", "예약금 정산", "HIGH"],
      ["공용", "차량별 출발 시간 확인", "HIGH"],
    ] as const;
    await prisma.tripTask.createMany({
      data: taskSeeds.map(([category, title, priority], index) => ({
        id: newId(),
        tripId: trip.id,
        createdById: owner.id,
        assigneeId: users[index % users.length]?.id ?? owner.id,
        category,
        title,
        priority,
        dueAt: new Date("2026-08-28T12:00:00+09:00"),
        completedAt: index < 3 ? new Date() : null,
      })),
    });
  }

  if ((await prisma.meal.count({ where: { tripId: trip.id } })) === 0) {
    await prisma.meal.createMany({
      data: [
        {
          id: newId(),
          tripId: trip.id,
          assigneeId: owner.id,
          mealAt: new Date("2026-08-29T18:00:00+09:00"),
          menu: "숯불 바비큐",
          ingredients: [
            { name: "삼겹살", quantity: 2, unit: "kg" },
            { name: "쌈 채소", quantity: 4, unit: "봉" },
            { name: "김치", quantity: 1, unit: "kg" },
          ],
        },
        {
          id: newId(),
          tripId: trip.id,
          assigneeId: users[1]?.id ?? owner.id,
          mealAt: new Date("2026-08-29T22:00:00+09:00"),
          menu: "어묵탕",
          ingredients: [
            { name: "어묵", quantity: 2, unit: "봉" },
            { name: "대파", quantity: 1, unit: "단" },
          ],
        },
        {
          id: newId(),
          tripId: trip.id,
          assigneeId: users[2]?.id ?? owner.id,
          mealAt: new Date("2026-08-30T09:00:00+09:00"),
          menu: "라면과 계란",
          ingredients: [
            { name: "라면", quantity: users.length, unit: "개" },
            { name: "계란", quantity: users.length, unit: "개" },
          ],
        },
        {
          id: newId(),
          tripId: trip.id,
          assigneeId: users[3]?.id ?? owner.id,
          mealAt: new Date("2026-08-30T12:00:00+09:00"),
          menu: "가평 카페 브런치",
          ingredients: [],
        },
      ],
    });
  }

  if ((await prisma.vehicle.count({ where: { tripId: trip.id } })) === 0) {
    const vehicle = await prisma.vehicle.create({
      data: {
        id: newId(),
        tripId: trip.id,
        ownerId: owner.id,
        driverId: owner.id,
        name: "1호 차량",
        seats: Math.max(4, users.length),
        departureLocation: "서울역",
        departureAt: new Date("2026-08-29T09:00:00+09:00"),
        note: "출발 10분 전 집합",
      },
    });
    await prisma.rideAssignment.createMany({
      data: users
        .filter((user) => user.id !== owner.id)
        .map((user) => ({ vehicleId: vehicle.id, userId: user.id })),
    });
  }

  if ((await prisma.expense.count({ where: { tripId: trip.id } })) === 0) {
    const expenseSeeds = [
      { payerId: owner.id, amount: 320_000, category: "ACCOMMODATION", memo: "숙소 예약금" },
      {
        payerId: users[1]?.id ?? owner.id,
        amount: 86_500,
        category: "FOOD",
        memo: "바비큐 장보기",
      },
      { payerId: users[2]?.id ?? owner.id, amount: 48_000, category: "TRANSPORT", memo: "주유비" },
      {
        payerId: users[3]?.id ?? owner.id,
        amount: 32_000,
        category: "ACTIVITY",
        memo: "카페 비용",
      },
      { payerId: owner.id, amount: 21_500, category: "OTHER", memo: "공용 준비물" },
    ] as const;
    for (const expenseSeed of expenseSeeds) {
      const expense = await prisma.expense.create({
        data: {
          id: newId(),
          tripId: trip.id,
          payerId: expenseSeed.payerId,
          amount: expenseSeed.amount,
          category: expenseSeed.category,
          spentAt: new Date("2026-08-29T12:00:00+09:00"),
          memo: expenseSeed.memo,
        },
      });
      await prisma.expenseShare.createMany({
        data: splitAmountEvenly(
          expenseSeed.amount,
          users.map((user) => user.id),
        ).map((share) => ({ expenseId: expense.id, ...share })),
      });
    }
  }

  if ((await prisma.settlementRevision.count({ where: { tripId: trip.id } })) === 0) {
    const [tripExpenses, tripMembers] = await Promise.all([
      prisma.expense.findMany({ where: { tripId: trip.id }, include: { shares: true } }),
      prisma.tripMember.findMany({ where: { tripId: trip.id } }),
    ]);
    const settlementResult = calculateSettlements(
      tripMembers.map((member) => member.userId),
      tripExpenses.map((expense) => ({
        payerId: expense.payerId,
        amount: expense.amount,
        shares: expense.shares.map((share) => ({
          userId: share.userId,
          amount: share.amount,
        })),
      })),
    );
    const settlement = await prisma.settlementRevision.create({
      data: {
        id: newId(),
        tripId: trip.id,
        revisionNo: 1,
        result: JSON.parse(JSON.stringify(settlementResult)) as Prisma.InputJsonValue,
      },
    });
    if (settlementResult.transfers.length > 0) {
      await prisma.settlementPayment.createMany({
        data: settlementResult.transfers.map((transfer) => ({
          id: newId(),
          settlementId: settlement.id,
          ...transfer,
        })),
      });
    }
  }

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
  console.info(`여행: ${trip.title}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
