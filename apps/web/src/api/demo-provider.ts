const DEMO_GROUP_ID = "demo-group";
const DEMO_TRIP_ID = "demo-trip";

const demoUser = { id: "public-demo-user", nickname: "데모 여행자" };
const minseo = { id: "demo-minseo", nickname: "민서" };
const junho = { id: "demo-junho", nickname: "준호" };
const soyeon = { id: "demo-soyeon", nickname: "소연" };
const users = [demoUser, minseo, junho, soyeon];

const tripSummary = {
  id: DEMO_TRIP_ID,
  title: "8월 29~30일 가평 글램핑",
  purpose: "친구들과 함께 준비하는 1박 2일 여름 여행",
  status: "CONFIRMED",
  startDate: "2026-08-29T00:00:00.000Z",
  endDate: "2026-08-30T00:00:00.000Z",
  regionText: "경기 가평",
  budgetPerPerson: 180_000,
  attendeeCount: 4,
  memberCount: 4,
  progress: 78,
  datesLocked: true,
  myRole: "MANAGER",
  group: { id: DEMO_GROUP_ID, name: "여름 글램핑 모임" },
};

const members = users.map((user, index) => ({
  role: index === 0 ? "MANAGER" : "MEMBER",
  attendanceStatus: "ATTENDING",
  isCoreMember: index === 0,
  user: {
    ...user,
    username: index === 0 ? "demo" : `friend${index}`,
    profile: {
      canDrive: index < 2,
      allergies: index === 2 ? ["견과류"] : [],
      foodDislikes: index === 3 ? ["매운 음식"] : [],
    },
  },
}));

const tripDetail = {
  ...tripSummary,
  version: 1,
  nights: 1,
  members,
  decisions: [
    {
      id: "demo-decision-1",
      decisionType: "DATES_LOCKED",
      reason: "네 명 모두 참석 가능한 날짜로 확정",
      createdAt: "2026-08-02T11:00:00.000Z",
    },
  ],
};

const pointWallets = [
  { user: demoUser, balance: 640, earnedTotal: 910, spentTotal: 270, checkInStreak: 5 },
  { user: minseo, balance: 520, earnedTotal: 740, spentTotal: 220, checkInStreak: 4 },
  { user: junho, balance: 430, earnedTotal: 610, spentTotal: 180, checkInStreak: 3 },
  { user: soyeon, balance: 380, earnedTotal: 530, spentTotal: 150, checkInStreak: 2 },
].map((entry) => ({
  tripId: DEMO_TRIP_ID,
  userId: entry.user.id,
  balance: entry.balance,
  earnedTotal: entry.earnedTotal,
  spentTotal: entry.spentTotal,
  checkInStreak: entry.checkInStreak,
  lastCheckInDate: "2026-08-11",
  user: entry.user,
}));

const recentRounds = [
  {
    id: "demo-round-1",
    gameType: "TAP",
    wager: 0,
    score: 86,
    pointDelta: 30,
    result: { rewarded: true, rewardedPlay: 2 },
    createdAt: "2026-08-11T05:20:00.000Z",
    user: demoUser,
  },
  {
    id: "demo-round-2",
    gameType: "ODD_EVEN",
    wager: 20,
    score: null,
    pointDelta: 18,
    result: {
      won: true,
      startSide: "LEFT",
      rungCount: 3,
      rungYs: [102, 182, 262],
      answer: "EVEN",
      payoutMultiplier: 1.9,
    },
    createdAt: "2026-08-10T13:10:00.000Z",
    user: minseo,
  },
];

const rewards = [
  {
    id: "demo-reward-priority",
    title: "방 선택 우선권",
    description: "숙소 도착 후 원하는 방을 먼저 고릅니다.",
    cost: 250,
    type: "PRIVILEGE",
    effect: { action: "ROOM_PRIORITY" },
  },
  {
    id: "demo-reward-drink",
    title: "음료 한 잔 부탁하기",
    description: "지목한 친구에게 음료 한 잔을 부탁합니다. 거절과 무알코올 대체가 가능합니다.",
    cost: 120,
    type: "TARGET_PENALTY",
    effect: { action: "ONE_DRINK", targetRequired: true },
  },
  {
    id: "demo-reward-shield",
    title: "벌칙 방어권",
    description: "이번 여행에서 벌칙 한 번을 방어합니다.",
    cost: 180,
    type: "PROTECTION",
    effect: { action: "PENALTY_SHIELD" },
  },
];

const pointsDashboard = {
  myWallet: pointWallets[0],
  myRole: "MANAGER",
  balanceLeaderboard: pointWallets,
  activityLeaderboard: [...pointWallets].sort((a, b) => b.earnedTotal - a.earnedTotal),
  recentPointResults: recentRounds,
  rewards,
  rewardInventory: [
    {
      id: "demo-inventory-1",
      userId: demoUser.id,
      rewardItemId: rewards[2]!.id,
      quantity: 1,
      grantIds: ["demo-grant-1"],
      sellableGrantIds: ["demo-grant-1"],
      nextSaleValue: 90,
      user: demoUser,
      rewardItem: rewards[2],
    },
  ],
  recentRedemptions: [
    {
      id: "demo-redemption-1",
      cost: 120,
      status: "ACCEPTED",
      createdAt: "2026-08-09T12:00:00.000Z",
      resolvedAt: "2026-08-09T12:05:00.000Z",
      outcome: { accepted: true },
      rewardItem: rewards[1],
      buyer: minseo,
      target: junho,
    },
  ],
  oneDrinkTargetCounts: users.slice(1).map((user, index) => ({
    userId: user.id,
    user,
    count: [1, 2, 0][index],
  })),
  tapRewardStatus: { rewardedToday: 2, remainingToday: 1 },
  rules: {
    notice: "포인트는 여행 안에서만 사용하는 가상 점수이며 현금 가치가 없습니다.",
    activityRules: [
      { key: "CHECK_IN", label: "매일 출석", points: 20 },
      { key: "PLACE", label: "장소 후보 등록", points: 30 },
      { key: "POLL", label: "투표 참여", points: 15 },
      { key: "TASK", label: "준비물 완료", points: 25 },
    ],
    games: {
      lottery: {
        pricePerDraw: 20,
        tiers: [
          { key: "JACKPOT", label: "대박", probability: "1%", prize: 1_000 },
          { key: "LUCKY", label: "행운", probability: "9%", prize: 100 },
          { key: "SMALL", label: "소소한 당첨", probability: "30%", prize: 30 },
          { key: "MISS", label: "다음 기회", probability: "60%", prize: 0 },
        ],
      },
      rpsRoulette: {
        outcomes: [
          { outcome: "WIN", probability: "33%" },
          { outcome: "DRAW", probability: "34%" },
          { outcome: "LOSS", probability: "33%" },
        ],
        multipliers: [1, 1.5, 2, 3, 5].map((multiplier) => ({
          multiplier,
          probability: "20%",
        })),
      },
    },
  },
};

const achievements = [
  {
    key: "CHECK_IN_1",
    title: "첫 출석",
    description: "여행 준비 출석을 1회 완료합니다.",
    reward: 20,
    seriesKey: "CHECK_IN",
    seriesTitle: "꾸준한 여행자",
    category: "TRIP",
    stage: 1,
    stageCount: 2,
    unit: "회",
    progress: 5,
    target: 1,
    achieved: true,
    claimed: true,
    claimable: false,
  },
  {
    key: "CHECK_IN_7",
    title: "일주일 출석",
    description: "여행 준비 출석을 7회 완료합니다.",
    reward: 100,
    seriesKey: "CHECK_IN",
    seriesTitle: "꾸준한 여행자",
    category: "TRIP",
    stage: 2,
    stageCount: 2,
    unit: "회",
    progress: 5,
    target: 7,
    achieved: false,
    claimed: false,
    claimable: false,
  },
  {
    key: "GAME_ROUNDS_5",
    title: "아케이드 입문",
    description: "미니게임을 5회 플레이합니다.",
    reward: 50,
    seriesKey: "GAME_ROUNDS",
    seriesTitle: "아케이드 정복",
    category: "ARCADE",
    stage: 1,
    stageCount: 1,
    unit: "판",
    progress: 8,
    target: 5,
    achieved: true,
    claimed: false,
    claimable: true,
  },
  {
    key: "REWARD_USES_1",
    title: "알뜰한 사용",
    description: "상점 아이템을 1회 사용합니다.",
    reward: 30,
    seriesKey: "REWARD_USES",
    seriesTitle: "아이템 수집가",
    category: "COLLECTION",
    stage: 1,
    stageCount: 1,
    unit: "개",
    progress: 1,
    target: 1,
    achieved: true,
    claimed: true,
    claimable: false,
  },
];

const demoDataByPath: Record<string, unknown> = {
  "health/live": { status: "ok" },
  me: {
    id: demoUser.id,
    email: "demo@campflow.local",
    nickname: demoUser.nickname,
    timezone: "Asia/Seoul",
    locale: "ko-KR",
    profile: {
      phone: "010-0000-0000",
      allergies: [],
      foodDislikes: [],
      canDrive: true,
    },
  },
  groups: [
    {
      id: DEMO_GROUP_ID,
      name: "여름 글램핑 모임",
      description: "가평으로 떠나는 네 친구의 여름 여행",
      role: "OWNER",
      memberCount: 4,
      updatedAt: "2026-08-11T05:20:00.000Z",
    },
  ],
  [`groups/${DEMO_GROUP_ID}`]: {
    id: DEMO_GROUP_ID,
    name: "여름 글램핑 모임",
    description: "가평으로 떠나는 네 친구의 여름 여행",
    myRole: "OWNER",
    members: members.map((member, index) => ({
      role: index === 0 ? "OWNER" : "MEMBER",
      status: "ACTIVE",
      joinedAt: `2026-08-0${index + 1}T09:00:00.000Z`,
      user: {
        id: member.user.id,
        nickname: member.user.nickname,
        locale: "ko-KR",
        profile: member.user.profile,
      },
    })),
  },
  [`groups/${DEMO_GROUP_ID}/trips`]: [tripSummary],
  trips: [tripSummary],
  [`trips/${DEMO_TRIP_ID}`]: tripDetail,
  [`trips/${DEMO_TRIP_ID}/characters`]: users.map((user, index) => ({
    userId: user.id,
    concept: ["캠프 대장", "불멍 요정", "별빛 기록가", "맛집 탐험가"][index],
    reason: "여행 준비 기록을 바탕으로 만든 데모 캐릭터입니다.",
  })),
  [`trips/${DEMO_TRIP_ID}/candidates`]: [
    {
      id: "demo-candidate-1",
      status: "SELECTED",
      estimatedTotal: 420_000,
      priceNote: "4인 기준, 바비큐 별도",
      note: "계곡과 가까우며 개별 화장실이 있습니다.",
      pros: ["넓은 데크", "불멍 세트", "무료 주차"],
      cons: ["마트까지 차량 15분"],
      place: {
        id: "demo-place-1",
        canonicalName: "별빛 숲 글램핑",
        address: "경기 가평군 북면 별빛로 29",
        sourceUrl: "https://example.com/demo-place",
      },
      addedBy: minseo,
    },
    {
      id: "demo-candidate-2",
      status: "ACTIVE",
      estimatedTotal: 380_000,
      priceNote: "조식 포함",
      note: "역에서 픽업을 제공합니다.",
      pros: ["대중교통 편리", "조식 포함"],
      cons: ["객실이 조금 작음"],
      place: {
        id: "demo-place-2",
        canonicalName: "가평 리버 캠프",
        address: "경기 가평군 가평읍 강변로 88",
        sourceUrl: null,
      },
      addedBy: junho,
    },
  ],
  [`trips/${DEMO_TRIP_ID}/polls`]: [
    {
      id: "demo-poll-1",
      title: "첫날 저녁 메뉴",
      description: "숙소 도착 후 함께 먹을 메뉴를 골라 주세요.",
      type: "SINGLE",
      status: "OPEN",
      options: [
        { id: "demo-option-1", label: "숯불 바비큐" },
        { id: "demo-option-2", label: "닭갈비" },
        { id: "demo-option-3", label: "밀푀유나베" },
      ],
      voteCount: 4,
      myVote: { optionIds: ["demo-option-1"] },
      results: [
        { id: "demo-option-1", label: "숯불 바비큐", count: 3 },
        { id: "demo-option-2", label: "닭갈비", count: 1 },
        { id: "demo-option-3", label: "밀푀유나베", count: 0 },
      ],
      canClose: false,
      canDelete: false,
      comments: [
        {
          id: "demo-poll-comment-1",
          body: "채소도 넉넉히 준비해요!",
          createdAt: "2026-08-10T08:30:00.000Z",
          author: soyeon,
          canDelete: false,
        },
      ],
    },
  ],
  [`trips/${DEMO_TRIP_ID}/itinerary/days`]: [
    {
      id: "demo-day-1",
      date: "2026-08-29T00:00:00.000Z",
      title: "출발과 체크인",
      items: [
        {
          id: "demo-item-1",
          type: "MOVE",
          title: "서울역 집합 및 출발",
          startsAt: "2026-08-29T00:00:00.000Z",
          assignee: minseo,
        },
        {
          id: "demo-item-2",
          type: "ACTIVITY",
          title: "마트 장보기",
          startsAt: "2026-08-29T02:00:00.000Z",
          assignee: junho,
        },
        {
          id: "demo-item-3",
          type: "CHECK_IN",
          title: "숙소 체크인과 방 배정",
          startsAt: "2026-08-29T06:00:00.000Z",
          assignee: demoUser,
        },
      ],
    },
    {
      id: "demo-day-2",
      date: "2026-08-30T00:00:00.000Z",
      title: "아침 산책과 귀가",
      items: [
        {
          id: "demo-item-4",
          type: "MEAL",
          title: "브런치",
          startsAt: "2026-08-30T01:00:00.000Z",
          assignee: soyeon,
        },
        {
          id: "demo-item-5",
          type: "MOVE",
          title: "체크아웃 후 서울로 출발",
          startsAt: "2026-08-30T03:00:00.000Z",
          assignee: demoUser,
        },
      ],
    },
  ],
  [`trips/${DEMO_TRIP_ID}/tasks`]: [
    {
      id: "demo-task-1",
      category: "예약",
      title: "숙소 예약금 확인",
      priority: "HIGH",
      completedAt: "2026-08-06T10:00:00.000Z",
      assignee: demoUser,
    },
    {
      id: "demo-task-2",
      category: "장보기",
      title: "바비큐 장보기 목록 확정",
      priority: "MEDIUM",
      completedAt: null,
      assignee: minseo,
    },
    {
      id: "demo-task-3",
      category: "공용",
      title: "블루투스 스피커 충전",
      priority: "LOW",
      completedAt: null,
      assignee: junho,
    },
  ],
  [`trips/${DEMO_TRIP_ID}/meals`]: [
    {
      id: "demo-meal-1",
      mealAt: "2026-08-29T10:00:00.000Z",
      menu: "숯불 바비큐와 구운 채소",
      note: "소연 몫은 맵지 않게 따로 준비",
      ingredients: [
        { name: "삼겹살", quantity: 1.2, unit: "kg" },
        { name: "버섯", quantity: 4, unit: "팩" },
        { name: "쌈 채소", quantity: 2, unit: "봉" },
      ],
      assignee: minseo,
    },
    {
      id: "demo-meal-2",
      mealAt: "2026-08-30T01:00:00.000Z",
      menu: "프렌치토스트와 과일",
      note: null,
      ingredients: [
        { name: "식빵", quantity: 1, unit: "봉" },
        { name: "달걀", quantity: 8, unit: "개" },
      ],
      assignee: soyeon,
    },
  ],
  [`trips/${DEMO_TRIP_ID}/shopping-list`]: [
    { name: "삼겹살", quantity: 1.2, unit: "kg", meals: ["숯불 바비큐와 구운 채소"] },
    { name: "버섯", quantity: 4, unit: "팩", meals: ["숯불 바비큐와 구운 채소"] },
    { name: "달걀", quantity: 8, unit: "개", meals: ["프렌치토스트와 과일"] },
    { name: "식빵", quantity: 1, unit: "봉", meals: ["프렌치토스트와 과일"] },
  ],
  [`trips/${DEMO_TRIP_ID}/vehicles`]: [
    {
      id: "demo-vehicle-1",
      name: "준호 SUV",
      seats: 5,
      departureLocation: "서울역 3번 출구",
      departureAt: "2026-08-29T00:00:00.000Z",
      note: "트렁크 공간 넉넉함",
      owner: junho,
      driver: junho,
      passengers: [{ user: demoUser }, { user: minseo }, { user: soyeon }],
    },
  ],
  [`trips/${DEMO_TRIP_ID}/transport/validation`]: {
    totalMembers: 4,
    totalSeats: 5,
    assignedCount: 4,
    unassigned: [],
    valid: true,
  },
  [`trips/${DEMO_TRIP_ID}/expenses`]: {
    expenses: [
      {
        id: "demo-expense-1",
        amount: 420_000,
        category: "ACCOMMODATION",
        spentAt: "2026-08-05T04:00:00.000Z",
        memo: "글램핑 숙소 예약",
        payer: demoUser,
        shares: users.map((user) => ({ amount: 105_000, user })),
      },
      {
        id: "demo-expense-2",
        amount: 68_000,
        category: "FOOD",
        spentAt: "2026-08-10T09:00:00.000Z",
        memo: "공용 간식 사전 구매",
        payer: minseo,
        shares: users.map((user) => ({ amount: 17_000, user })),
      },
    ],
    total: 488_000,
    latestSettlement: {
      id: "demo-settlement-1",
      revisionNo: 1,
      status: "DRAFT",
      payments: [
        {
          id: "demo-payment-1",
          amount: 88_000,
          status: "PENDING",
          fromUser: junho,
          toUser: demoUser,
        },
        {
          id: "demo-payment-2",
          amount: 88_000,
          status: "PAID",
          fromUser: soyeon,
          toUser: demoUser,
        },
      ],
    },
  },
  [`trips/${DEMO_TRIP_ID}/posts`]: [
    {
      id: "demo-post-1",
      category: "공지",
      title: "출발 전 마지막 확인",
      bodyMarkdown: "토요일 오전 9시까지 서울역 3번 출구로 모여 주세요.",
      createdAt: "2026-08-10T01:00:00.000Z",
      author: demoUser,
      comments: [
        {
          id: "demo-comment-1",
          bodyMarkdown: "간식 챙겨 갈게요!",
          createdAt: "2026-08-10T02:00:00.000Z",
          author: soyeon,
        },
      ],
    },
    {
      id: "demo-post-2",
      category: "장소",
      title: "숙소 근처 산책 코스",
      bodyMarkdown: "아침에 걸을 수 있는 30분짜리 계곡 코스를 찾았습니다.",
      createdAt: "2026-08-09T08:00:00.000Z",
      author: junho,
      comments: [],
    },
  ],
  [`trips/${DEMO_TRIP_ID}/messages`]: [
    {
      id: "demo-message-1",
      body: "투표 결과대로 바비큐로 예약할게요.",
      createdAt: "2026-08-11T02:10:00.000Z",
      author: minseo,
    },
    {
      id: "demo-message-2",
      body: "좋아요! 제가 보드게임도 챙기겠습니다.",
      createdAt: "2026-08-11T02:12:00.000Z",
      author: junho,
    },
    {
      id: "demo-message-3",
      body: "차량 좌석 배정도 완료했어요.",
      createdAt: "2026-08-11T02:15:00.000Z",
      author: demoUser,
    },
  ],
  [`trips/${DEMO_TRIP_ID}/files`]: [
    {
      id: "demo-file-1",
      originalName: "여행_준비_체크리스트.txt",
      mime: "text/plain",
      size: 58,
      createdAt: "2026-08-10T05:00:00.000Z",
      owner: demoUser,
    },
  ],
  "files/demo-file-1/content": {
    originalName: "여행_준비_체크리스트.txt",
    mime: "text/plain",
    dataBase64: "Q2FtcEZsb3cgZGVtbyB0cmlwIGNoZWNrbGlzdA==",
  },
  [`trips/${DEMO_TRIP_ID}/points`]: pointsDashboard,
  [`trips/${DEMO_TRIP_ID}/achievements`]: {
    items: achievements,
    totalCount: achievements.length,
    seriesCount: new Set(achievements.map((item) => item.seriesKey)).size,
    achievedCount: achievements.filter((item) => item.achieved).length,
    claimedCount: achievements.filter((item) => item.claimed).length,
    claimableCount: achievements.filter((item) => item.claimable).length,
    totalReward: achievements.reduce((sum, item) => sum + item.reward, 0),
  },
  [`trips/${DEMO_TRIP_ID}/games/penalty-matches`]: [
    {
      id: "demo-match-1",
      creator: minseo,
      opponent: null,
      winner: null,
      wager: 30,
      status: "OPEN",
      requiredAction: "DIVE",
      createdAt: "2026-08-11T03:00:00.000Z",
    },
  ],
  [`trips/${DEMO_TRIP_ID}/games/odd-even/rounds`]: {
    items: recentRounds.filter((round) => round.gameType === "ODD_EVEN"),
    total: 1,
    limit: 20,
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function demoRequest<T>(path: string, init: RequestInit = {}): T {
  const normalizedPath = path.replace(/^\/+|\/+$/g, "");
  const method = (init.method ?? "GET").toUpperCase();

  if (method === "POST" && normalizedPath === "auth/logout") {
    return undefined as T;
  }

  if (method !== "GET") {
    throw new Error("데모는 조회 전용입니다. 로그인하면 데이터를 직접 변경할 수 있습니다.");
  }

  if (normalizedPath.includes("/characters/") && normalizedPath.endsWith("/content")) {
    throw new Error("데모 캐릭터는 기본 아바타로 표시됩니다.");
  }

  if (!(normalizedPath in demoDataByPath)) {
    throw new Error("이 화면의 데모 데이터를 찾을 수 없습니다.");
  }

  return clone(demoDataByPath[normalizedPath]) as T;
}

export const demoIds = {
  groupId: DEMO_GROUP_ID,
  tripId: DEMO_TRIP_ID,
} as const;
