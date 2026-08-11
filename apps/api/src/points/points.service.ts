import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { Prisma, type GameType, type PointEntryKind } from "@prisma/client";
import type {
  AchievementKey,
  LotteryDrawInput,
  ManagerPointGrantInput,
  ManagerPointSetInput,
  ManagerRewardGrantInput,
  PointTransferInput,
  OddEvenGameInput,
  CreatePenaltyMatchInput,
  JoinPenaltyMatchInput,
  RedeemRewardInput,
  RpsRouletteGameInput,
  SnailRaceGameInput,
  SubmitTapScoreInput,
} from "@campflow/contracts";
import { newId } from "@campflow/domain";
import { PrismaService } from "../prisma/prisma.service";
import { TripAccessService } from "../trips/trip-access.service";

const activityRules = [
  { key: "CHECK_IN", label: "하루 출석", points: 20, note: "연속 출석 보너스 별도" },
  { key: "MANUAL_PLACE", label: "장소 직접 등록", points: 15 },
  { key: "CANDIDATE", label: "장소 후보 추가", points: 10 },
  { key: "POLL", label: "투표 참여", points: 5 },
  { key: "POST", label: "게시글 작성", points: 8 },
  { key: "COMMENT", label: "댓글 작성", points: 4 },
  { key: "ITINERARY", label: "일정 추가", points: 5 },
  { key: "TASK", label: "준비 항목 완료", points: 6 },
  { key: "EXPENSE", label: "지출 등록", points: 3 },
] as const;

const defaultRewards = [
  {
    seedKey: "choose-drinking-game",
    title: "술게임 선택권",
    description: "이번 라운드의 술게임을 직접 고릅니다. 패스·무알코올 대체 가능.",
    cost: 120,
    type: "PRIVILEGE" as const,
    effect: { action: "CHOOSE_DRINKING_GAME" },
  },
  {
    seedKey: "one-drink-target",
    title: "한 잔 지목권",
    description: "친구 한 명을 한 잔 대상으로 지목합니다. 현장에서 패스·무알코올 대체 가능.",
    cost: 180,
    type: "PRIVILEGE" as const,
    effect: { action: "NOMINATE_ONE_DRINK", targetRequired: true },
  },
  {
    seedKey: "one-drink-shield",
    title: "한 잔 방어권",
    description: "나에게 적용된 한 잔 지목 1회를 막습니다. 받은 지목이 있을 때 사용할 수 있습니다.",
    cost: 150,
    type: "PROTECTION" as const,
    effect: { action: "BLOCK_ONE_DRINK" },
  },
  {
    seedKey: "campaign-vote",
    title: "투표 선동권",
    description: "투표 전에 1분 동안 원하는 안건을 공개적으로 홍보합니다.",
    cost: 100,
    type: "PRIVILEGE" as const,
    effect: { action: "CAMPAIGN_VOTE" },
  },
  {
    seedKey: "reroll-penalty",
    title: "벌칙 재추첨권",
    description: "본인에게 나온 벌칙을 한 번 다시 뽑습니다.",
    cost: 80,
    type: "PRIVILEGE" as const,
    effect: { action: "REROLL_PENALTY" },
  },
  {
    seedKey: "point-freeze-bomb",
    title: "포인트 얼음폭탄",
    description: "지목한 친구의 포인트를 최대 75P 낮춥니다. 잔액은 0 아래로 내려가지 않습니다.",
    cost: 600,
    type: "TARGET_PENALTY" as const,
    effect: { action: "REDUCE_POINTS", points: 75, targetRequired: true },
  },
  {
    seedKey: "point-shield",
    title: "포인트 방어권",
    description: "다음 포인트 감소 아이템을 한 번 막는 현장용 권한입니다.",
    cost: 300,
    type: "PROTECTION" as const,
    effect: { action: "BLOCK_POINT_PENALTY" },
  },
] as const;

const lotteryTiers = [
  { key: "JACKPOT", label: "특별 1등", weight: 1, probability: "0.0000001%", prize: 100_000 },
  { key: "FIRST", label: "1등", weight: 1_000, probability: "0.0001%", prize: 10_000 },
  { key: "SECOND", label: "2등", weight: 100_000, probability: "0.01%", prize: 2_000 },
  { key: "THIRD", label: "3등", weight: 5_000_000, probability: "0.5%", prize: 300 },
  { key: "FOURTH", label: "4등", weight: 94_898_999, probability: "9.4898999%", prize: 40 },
  { key: "BLANK", label: "꽝", weight: 900_000_000, probability: "90%", prize: 0 },
] as const;

export const rpsMultipliers = [
  { multiplier: 1, weight: 200_000, probability: "20%" },
  { multiplier: 2, weight: 200_000, probability: "20%" },
  { multiplier: 3, weight: 200_000, probability: "20%" },
  { multiplier: 4, weight: 200_000, probability: "20%" },
  { multiplier: 10, weight: 200_000, probability: "20%" },
] as const;

export const rpsOutcomeProbabilities = [
  { outcome: "WIN", weight: 150_000, probability: "15%" },
  { outcome: "DRAW", weight: 200_000, probability: "20%" },
  { outcome: "LOSS", weight: 650_000, probability: "65%" },
] as const;

const ladderPayouts = [
  { selectionCount: 1, probability: "50%", multiplier: 1.9 },
  { selectionCount: 2, probability: "25%", multiplier: 3.6 },
  { selectionCount: 3, probability: "25%", multiplier: 3.8 },
] as const;

type AchievementMetric =
  | "CHECK_INS"
  | "ACTIVITY_TOTAL"
  | "ACTIVITY_TYPES"
  | "GAME_TYPES"
  | "GAME_ROUNDS"
  | "GAME_WINS"
  | "TAP_TOTAL"
  | "TAP_BEST"
  | "SNAIL_ROUNDS"
  | "SNAIL_WINS"
  | "SNAIL_WIN_STREAK"
  | "ODD_EVEN_ROUNDS"
  | "RPS_ROUNDS"
  | "PENALTY_ROUNDS"
  | "LOTTERY_DRAWS"
  | "REWARD_USES";

type AchievementCategory = "TRIP" | "ARCADE" | "COLLECTION";

interface AchievementDefinition {
  key: AchievementKey;
  title: string;
  description: string;
  reward: number;
  target: number;
  metric: AchievementMetric;
  seriesKey: string;
  seriesTitle: string;
  category: AchievementCategory;
  stage: number;
  stageCount: number;
  unit: string;
}

function achievementSeries(input: {
  seriesKey: string;
  seriesTitle: string;
  category: AchievementCategory;
  metric: AchievementMetric;
  unit: string;
  describe: (target: number) => string;
  stages: ReadonlyArray<{
    key: AchievementKey;
    target: number;
    reward: number;
    title?: string;
  }>;
}): AchievementDefinition[] {
  return input.stages.map((stage, index) => ({
    key: stage.key,
    title: stage.title ?? `${input.seriesTitle} ${index + 1}단계`,
    description: input.describe(stage.target),
    reward: stage.reward,
    target: stage.target,
    metric: input.metric,
    seriesKey: input.seriesKey,
    seriesTitle: input.seriesTitle,
    category: input.category,
    stage: index + 1,
    stageCount: input.stages.length,
    unit: input.unit,
  }));
}

export const achievementDefinitions: ReadonlyArray<AchievementDefinition> = [
  ...achievementSeries({
    seriesKey: "CHECK_IN",
    seriesTitle: "출석 원정대",
    category: "TRIP",
    metric: "CHECK_INS",
    unit: "일",
    describe: (target) => `서로 다른 날짜에 출석 체크를 ${target}회 완료하세요.`,
    stages: [
      { key: "FIRST_CHECK_IN", target: 1, reward: 30, title: "첫 발자국" },
      { key: "CHECK_IN_3", target: 3, reward: 60 },
      { key: "CHECK_IN_7", target: 7, reward: 120 },
      { key: "CHECK_IN_14", target: 14, reward: 240 },
      { key: "CHECK_IN_30", target: 30, reward: 500 },
      { key: "CHECK_IN_60", target: 60, reward: 1_000 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "ACTIVITY_TOTAL",
    seriesTitle: "여행 해결사",
    category: "TRIP",
    metric: "ACTIVITY_TOTAL",
    unit: "회",
    describe: (target) => `여행 준비 활동을 누적 ${target}회 완료하세요.`,
    stages: [
      { key: "ACTIVITY_TOTAL_1", target: 1, reward: 20 },
      { key: "ACTIVITY_TOTAL_5", target: 5, reward: 50 },
      { key: "ACTIVITY_TOTAL_15", target: 15, reward: 100 },
      { key: "ACTIVITY_TOTAL_30", target: 30, reward: 200 },
      { key: "ACTIVITY_TOTAL_60", target: 60, reward: 400 },
      { key: "ACTIVITY_TOTAL_100", target: 100, reward: 800 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "ACTIVITY_TYPES",
    seriesTitle: "만능 준비꾼",
    category: "TRIP",
    metric: "ACTIVITY_TYPES",
    unit: "종",
    describe: (target) => `서로 다른 여행 준비 활동 ${target}종에 참여하세요.`,
    stages: [
      { key: "TRIP_HELPER_3", target: 3, reward: 60, title: "여행 준비 도우미" },
      { key: "ACTIVITY_TYPES_5", target: 5, reward: 120 },
      { key: "ACTIVITY_TYPES_7", target: 7, reward: 240 },
      { key: "ACTIVITY_TYPES_9", target: 9, reward: 480 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "GAME_TYPES",
    seriesTitle: "게임장 탐험가",
    category: "ARCADE",
    metric: "GAME_TYPES",
    unit: "종",
    describe: (target) => `서로 다른 포인트 게임 ${target}종을 플레이하세요.`,
    stages: [
      { key: "GAME_TYPES_2", target: 2, reward: 30 },
      { key: "ARCADE_EXPLORER", target: 4, reward: 80, title: "게임장 탐험가" },
      { key: "GAME_TYPES_6", target: 6, reward: 200 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "GAME_ROUNDS",
    seriesTitle: "게임 마라토너",
    category: "ARCADE",
    metric: "GAME_ROUNDS",
    unit: "판",
    describe: (target) => `포인트 게임을 누적 ${target}판 플레이하세요.`,
    stages: [
      { key: "GAME_ROUNDS_1", target: 1, reward: 20 },
      { key: "GAME_ROUNDS_10", target: 10, reward: 100, title: "게임 마니아" },
      { key: "GAME_ROUNDS_25", target: 25, reward: 200 },
      { key: "GAME_ROUNDS_50", target: 50, reward: 400 },
      { key: "GAME_ROUNDS_100", target: 100, reward: 800 },
      { key: "GAME_ROUNDS_250", target: 250, reward: 1_600 },
      { key: "GAME_ROUNDS_500", target: 500, reward: 3_000 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "GAME_WINS",
    seriesTitle: "승리 수집가",
    category: "ARCADE",
    metric: "GAME_WINS",
    unit: "승",
    describe: (target) => `게임 결과로 포인트 순이익을 얻은 판을 ${target}회 만드세요.`,
    stages: [
      { key: "GAME_WINS_1", target: 1, reward: 30 },
      { key: "GAME_WINS_5", target: 5, reward: 70 },
      { key: "GAME_WINS_15", target: 15, reward: 150 },
      { key: "GAME_WINS_30", target: 30, reward: 300 },
      { key: "GAME_WINS_60", target: 60, reward: 600 },
      { key: "GAME_WINS_100", target: 100, reward: 1_200 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "TAP_TOTAL",
    seriesTitle: "광속 손가락",
    category: "ARCADE",
    metric: "TAP_TOTAL",
    unit: "탭",
    describe: (target) => `10초 탭에서 누적 ${target.toLocaleString("ko-KR")}회를 기록하세요.`,
    stages: [
      { key: "TAP_TOTAL_200", target: 200, reward: 50, title: "손가락 예열 완료" },
      { key: "TAP_TOTAL_500", target: 500, reward: 100 },
      { key: "TAP_TOTAL_1000", target: 1_000, reward: 180 },
      { key: "TAP_TOTAL_2500", target: 2_500, reward: 320 },
      { key: "TAP_TOTAL_5000", target: 5_000, reward: 600 },
      { key: "TAP_TOTAL_10000", target: 10_000, reward: 1_000 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "TAP_BEST",
    seriesTitle: "10초의 지배자",
    category: "ARCADE",
    metric: "TAP_BEST",
    unit: "탭",
    describe: (target) => `10초 탭 한 판에서 ${target}회 이상 기록하세요.`,
    stages: [
      { key: "TAP_BEST_50", target: 50, reward: 20 },
      { key: "TAP_BEST_100", target: 100, reward: 40 },
      { key: "TAP_BEST_150", target: 150, reward: 80 },
      { key: "TAP_BEST_200", target: 200, reward: 150 },
      { key: "TAP_BEST_250", target: 250, reward: 250 },
      { key: "TAP_BEST_300", target: 300, reward: 500 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "SNAIL_ROUNDS",
    seriesTitle: "달팽이 조련사",
    category: "ARCADE",
    metric: "SNAIL_ROUNDS",
    unit: "판",
    describe: (target) => `달팽이 레이스를 누적 ${target}판 플레이하세요.`,
    stages: [
      { key: "SNAIL_ROUNDS_1", target: 1, reward: 30 },
      { key: "SNAIL_ROUNDS_5", target: 5, reward: 100 },
      { key: "SNAIL_ROUNDS_15", target: 15, reward: 250 },
      { key: "SNAIL_ROUNDS_30", target: 30, reward: 500 },
      { key: "SNAIL_ROUNDS_60", target: 60, reward: 1_000 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "SNAIL_WINS",
    seriesTitle: "달팽이 우승 감독",
    category: "ARCADE",
    metric: "SNAIL_WINS",
    unit: "승",
    describe: (target) => `달팽이 레이스에서 누적 ${target}승을 기록하세요.`,
    stages: [
      { key: "SNAIL_WINS_1", target: 1, reward: 40 },
      { key: "SNAIL_WINS_3", target: 3, reward: 100 },
      { key: "SNAIL_WINS_10", target: 10, reward: 250 },
      { key: "SNAIL_WINS_25", target: 25, reward: 500 },
      { key: "SNAIL_WINS_50", target: 50, reward: 1_000 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "SNAIL_STREAK",
    seriesTitle: "연승의 달팽이",
    category: "ARCADE",
    metric: "SNAIL_WIN_STREAK",
    unit: "연승",
    describe: (target) => `달팽이 레이스에서 최고 ${target}연승을 달성하세요.`,
    stages: [
      { key: "SNAIL_STREAK_3", target: 3, reward: 100, title: "달팽이 승부사" },
      { key: "SNAIL_STREAK_5", target: 5, reward: 250 },
      { key: "SNAIL_STREAK_7", target: 7, reward: 500 },
      { key: "SNAIL_STREAK_10", target: 10, reward: 1_000 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "ODD_EVEN_ROUNDS",
    seriesTitle: "사다리 등반가",
    category: "ARCADE",
    metric: "ODD_EVEN_ROUNDS",
    unit: "판",
    describe: (target) => `홀짝 사다리를 누적 ${target}판 플레이하세요.`,
    stages: [
      { key: "ODD_EVEN_ROUNDS_1", target: 1, reward: 30 },
      { key: "ODD_EVEN_ROUNDS_5", target: 5, reward: 100 },
      { key: "ODD_EVEN_ROUNDS_15", target: 15, reward: 250 },
      { key: "ODD_EVEN_ROUNDS_30", target: 30, reward: 500 },
      { key: "ODD_EVEN_ROUNDS_60", target: 60, reward: 1_000 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "RPS_ROUNDS",
    seriesTitle: "짱깸보 도전자",
    category: "ARCADE",
    metric: "RPS_ROUNDS",
    unit: "판",
    describe: (target) => `짱깸보 룰렛을 누적 ${target}판 플레이하세요.`,
    stages: [
      { key: "RPS_ROUNDS_1", target: 1, reward: 30 },
      { key: "RPS_ROUNDS_5", target: 5, reward: 100 },
      { key: "RPS_ROUNDS_15", target: 15, reward: 250 },
      { key: "RPS_ROUNDS_30", target: 30, reward: 500 },
      { key: "RPS_ROUNDS_60", target: 60, reward: 1_000 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "PENALTY_ROUNDS",
    seriesTitle: "승부차기 키커",
    category: "ARCADE",
    metric: "PENALTY_ROUNDS",
    unit: "판",
    describe: (target) => `승부차기 대결을 누적 ${target}판 완료하세요.`,
    stages: [
      { key: "PENALTY_ROUNDS_1", target: 1, reward: 30 },
      { key: "PENALTY_ROUNDS_5", target: 5, reward: 100 },
      { key: "PENALTY_ROUNDS_15", target: 15, reward: 250 },
      { key: "PENALTY_ROUNDS_30", target: 30, reward: 500 },
      { key: "PENALTY_ROUNDS_60", target: 60, reward: 1_000 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "LOTTERY_DRAWS",
    seriesTitle: "행운의 티켓",
    category: "ARCADE",
    metric: "LOTTERY_DRAWS",
    unit: "장",
    describe: (target) => `포인트 로또를 누적 ${target}장 구매하세요.`,
    stages: [
      { key: "LOTTERY_DRAWS_1", target: 1, reward: 20 },
      { key: "LOTTERY_DRAWS_10", target: 10, reward: 70 },
      { key: "LOTTERY_DRAWS_50", target: 50, reward: 200 },
      { key: "LOTTERY_DRAWS_100", target: 100, reward: 450 },
      { key: "LOTTERY_DRAWS_250", target: 250, reward: 1_000 },
    ],
  }),
  ...achievementSeries({
    seriesKey: "REWARD_USES",
    seriesTitle: "아이템 전략가",
    category: "COLLECTION",
    metric: "REWARD_USES",
    unit: "회",
    describe: (target) => `포인트 아이템을 누적 ${target}회 사용하세요.`,
    stages: [
      { key: "FIRST_REWARD", target: 1, reward: 50, title: "포인트 첫 사용" },
      { key: "REWARD_USES_3", target: 3, reward: 100 },
      { key: "REWARD_USES_10", target: 10, reward: 250 },
      { key: "REWARD_USES_25", target: 25, reward: 500 },
      { key: "REWARD_USES_50", target: 50, reward: 1_000 },
      { key: "REWARD_USES_100", target: 100, reward: 2_000 },
    ],
  }),
];

export function maximumConsecutiveWins(results: unknown[]): number {
  let current = 0;
  let maximum = 0;
  for (const result of results) {
    const won =
      typeof result === "object" && result !== null && "won" in result && result.won === true;
    current = won ? current + 1 : 0;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

export function payoutWithProfitMultiplier(wager: number, multiplier: number): number {
  return wager + Math.floor(wager * multiplier);
}

export function payoutWithTotalMultiplier(wager: number, multiplier: number): number {
  return Math.floor(wager * multiplier);
}

export function rewardResaleValue(cost: number): number {
  return Math.floor((Math.max(0, cost) * 70) / 100);
}

export function expectedRpsNetMultiplier(): number {
  const averageWinMultiplier = rpsMultipliers.reduce(
    (total, outcome) => total + outcome.multiplier * (outcome.weight / 1_000_000),
    0,
  );
  const winProbability = rpsOutcomeProbabilities[0].weight / 1_000_000;
  const lossProbability = rpsOutcomeProbabilities[2].weight / 1_000_000;
  return winProbability * averageWinMultiplier - lossProbability;
}

@Injectable()
export class PointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
  ) {}

  async dashboard(userId: string, tripId: string) {
    const membership = await this.access.requireMembership(userId, tripId);
    await Promise.all([this.ensureWallets(tripId), this.ensureRewards(tripId)]);
    const { start: todayStart, end: todayEnd } = this.kstDayRange();
    const [
      wallets,
      recentPointResults,
      rewards,
      recentRedemptions,
      grantedRewards,
      activeOneDrinkTargets,
      tapRewardedToday,
    ] = await Promise.all([
      this.prisma.pointWallet.findMany({
        where: { tripId },
        include: { user: { select: { id: true, nickname: true } } },
      }),
      this.prisma.gameRound.findMany({
        where: { tripId, pointDelta: { not: 0 } },
        include: { user: { select: { id: true, nickname: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      this.prisma.rewardItem.findMany({
        where: { tripId, active: true },
        orderBy: [{ sortOrder: "asc" }, { cost: "asc" }],
      }),
      this.prisma.rewardRedemption.findMany({
        where: { tripId, status: { not: "PENDING" } },
        include: {
          rewardItem: true,
          buyer: { select: { id: true, nickname: true } },
          target: { select: { id: true, nickname: true } },
        },
        orderBy: { resolvedAt: "desc" },
        take: 30,
      }),
      this.prisma.rewardRedemption.findMany({
        where: {
          tripId,
          status: "PENDING",
          ...(membership.role === "MANAGER" ? {} : { buyerId: userId }),
        },
        include: {
          rewardItem: true,
          buyer: { select: { id: true, nickname: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.rewardRedemption.findMany({
        where: {
          tripId,
          status: "APPLIED",
          targetId: { not: null },
          rewardItem: { seedKey: "one-drink-target" },
        },
        select: { targetId: true },
      }),
      this.prisma.gameRound.count({
        where: {
          tripId,
          userId,
          gameType: "TAP",
          pointDelta: { gt: 0 },
          createdAt: { gte: todayStart, lt: todayEnd },
        },
      }),
    ]);
    const byBalance = [...wallets].sort(
      (left, right) => right.balance - left.balance || right.earnedTotal - left.earnedTotal,
    );
    const byActivity = [...wallets].sort(
      (left, right) => right.earnedTotal - left.earnedTotal || right.balance - left.balance,
    );
    const oneDrinkCountByUserId = new Map<string, number>();
    for (const redemption of activeOneDrinkTargets) {
      if (!redemption.targetId) continue;
      oneDrinkCountByUserId.set(
        redemption.targetId,
        (oneDrinkCountByUserId.get(redemption.targetId) ?? 0) + 1,
      );
    }
    const inventoryByMemberAndItem = new Map<
      string,
      {
        id: string;
        userId: string;
        rewardItemId: string;
        quantity: number;
        grantIds: string[];
        sellableGrantIds: string[];
        nextSaleValue: number;
        user: (typeof grantedRewards)[number]["buyer"];
        rewardItem: (typeof grantedRewards)[number]["rewardItem"];
      }
    >();
    for (const grant of grantedRewards) {
      const key = `${grant.buyerId}:${grant.rewardItemId}`;
      const current = inventoryByMemberAndItem.get(key);
      if (current) {
        current.quantity += 1;
        current.grantIds.push(grant.id);
        if (grant.cost > 0) {
          current.sellableGrantIds.push(grant.id);
          if (current.sellableGrantIds.length === 1) {
            current.nextSaleValue = rewardResaleValue(grant.cost);
          }
        }
      } else {
        inventoryByMemberAndItem.set(key, {
          id: key,
          userId: grant.buyerId,
          rewardItemId: grant.rewardItemId,
          quantity: 1,
          grantIds: [grant.id],
          sellableGrantIds: grant.cost > 0 ? [grant.id] : [],
          nextSaleValue: grant.cost > 0 ? rewardResaleValue(grant.cost) : 0,
          user: grant.buyer,
          rewardItem: grant.rewardItem,
        });
      }
    }
    return {
      myWallet: wallets.find((wallet) => wallet.userId === userId),
      myRole: membership.role,
      balanceLeaderboard: byBalance,
      activityLeaderboard: byActivity,
      recentPointResults,
      rewards,
      rewardInventory: [...inventoryByMemberAndItem.values()],
      recentRedemptions,
      oneDrinkTargetCounts: wallets
        .map((wallet) => ({
          userId: wallet.userId,
          user: wallet.user,
          count: oneDrinkCountByUserId.get(wallet.userId) ?? 0,
        }))
        .sort(
          (left, right) =>
            right.count - left.count || left.user.nickname.localeCompare(right.user.nickname, "ko"),
        ),
      tapRewardStatus: {
        rewardedToday: Math.min(tapRewardedToday, 3),
        remainingToday: Math.max(0, 3 - tapRewardedToday),
      },
      rules: this.rules(),
    };
  }

  rules() {
    return {
      notice: "모든 포인트는 CampFlow 여행 안에서만 쓰며 현금 구매·환전·양도가 불가능합니다.",
      activityRules,
      games: {
        tap: { rewardedPlaysPerDay: 3, maximumScore: 300, maximumReward: 60 },
        oddEven: {
          patterns: ["좌4홀", "우3홀", "좌3짝", "우4짝"],
          payouts: ladderPayouts,
          payoutBasis: "판돈을 포함한 총 지급액에 배수 적용",
          selections: "출발 좌·우, 가로줄 3·4개, 도착 홀·짝을 단일 또는 조합으로 선택",
        },
        snailRace: { winProbability: "25%", payout: "원금 포함 4배", snails: 4 },
        rpsRoulette: {
          draw: "원금 반환",
          loss: "0배",
          win: "배수만큼 순이익 지급 후 판돈 별도 반환",
          outcomes: rpsOutcomeProbabilities,
          multipliers: rpsMultipliers,
        },
        lottery: { pricePerDraw: 10, tiers: lotteryTiers },
      },
    };
  }

  async checkIn(userId: string, tripId: string) {
    const membership = await this.access.requireMembership(userId, tripId);
    const trip = await this.prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: { startDate: true, endDate: true },
    });
    const today = this.kstDate();
    const sourceKey = `check-in:${this.dateKey(today)}`;
    const existing = await this.prisma.pointLedger.findUnique({
      where: { tripId_userId_sourceKey: { tripId, userId, sourceKey } },
    });
    if (existing) {
      return {
        alreadyCheckedIn: true,
        wallet: await this.wallet(tripId, userId),
        awarded: 0,
      };
    }
    const current = await this.wallet(tripId, userId);
    const yesterday = new Date(today.getTime() - 86_400_000);
    const streak =
      current.lastCheckInDate && this.dateKey(current.lastCheckInDate) === this.dateKey(yesterday)
        ? current.checkInStreak + 1
        : 1;
    const streakBonus = streak >= 7 ? 30 : streak >= 3 ? 10 : 0;
    const tripDayBonus = today >= trip.startDate && today <= trip.endDate ? 50 : 0;
    const awarded = 20 + streakBonus + tripDayBonus;
    const wallet = await this.prisma.$transaction(async (transaction) => {
      const updated = await this.changeBalance(
        transaction,
        tripId,
        userId,
        awarded,
        "EARN",
        `출석 ${streak}일차`,
        sourceKey,
        { streak, streakBonus, tripDayBonus },
      );
      await transaction.pointWallet.update({
        where: { tripId_userId: { tripId, userId } },
        data: { checkInStreak: streak, lastCheckInDate: today },
      });
      return updated;
    });
    return { alreadyCheckedIn: false, wallet, awarded, streak, membership };
  }

  async grantPoints(managerId: string, tripId: string, input: ManagerPointGrantInput) {
    await this.access.requireManager(managerId, tripId);
    if (managerId === input.targetUserId) {
      throw new ConflictException({
        code: "POINT_SELF_GRANT_FORBIDDEN",
        message: "관리자는 본인에게 포인트를 지급할 수 없습니다.",
      });
    }
    await this.access.requireMembership(input.targetUserId, tripId);
    const [manager, target] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: managerId },
        select: { id: true, nickname: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: input.targetUserId },
        select: { id: true, nickname: true },
      }),
    ]);
    const sourceKey = `manager-grant:${managerId}:${input.clientRequestId}`;
    const findExisting = () =>
      this.prisma.pointLedger.findUnique({
        where: {
          tripId_userId_sourceKey: {
            tripId,
            userId: input.targetUserId,
            sourceKey,
          },
        },
        include: { user: { select: { id: true, nickname: true } } },
      });
    const existing = await findExisting();
    if (existing) return { entry: existing, duplicate: true };

    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        await this.changeBalance(
          transaction,
          tripId,
          input.targetUserId,
          input.amount,
          "ADJUST",
          `${manager.nickname} 관리자 공개 지급 · ${input.reason}`,
          sourceKey,
          {
            category: "MANAGER_GRANT",
            managerId,
            managerNickname: manager.nickname,
            targetNickname: target.nickname,
            amount: input.amount,
            reason: input.reason,
          },
        );
        const entry = await transaction.pointLedger.findUniqueOrThrow({
          where: {
            tripId_userId_sourceKey: {
              tripId,
              userId: input.targetUserId,
              sourceKey,
            },
          },
          include: { user: { select: { id: true, nickname: true } } },
        });
        const announcement = await transaction.chatMessage.create({
          data: {
            id: newId(),
            tripId,
            authorId: managerId,
            body: `📢 ${manager.nickname} 관리자가 ${target.nickname}님에게 +${input.amount.toLocaleString("ko-KR")}P를 지급했습니다. 사유: ${input.reason}`,
            clientMessageId: `point-grant-${entry.id}`,
          },
          include: { author: { select: { id: true, nickname: true } } },
        });
        await transaction.auditLog.create({
          data: {
            id: newId(),
            actorId: managerId,
            action: "points.manager_grant",
            targetType: "PointWallet",
            targetId: input.targetUserId,
            metadataSafe: {
              tripId,
              amount: input.amount,
              reason: input.reason,
              pointLedgerId: entry.id,
            },
          },
        });
        return { entry, announcement, duplicate: false };
      });
      return result;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await findExisting();
        if (duplicate) return { entry: duplicate, duplicate: true };
      }
      throw error;
    }
  }

  async setPointBalance(managerId: string, tripId: string, input: ManagerPointSetInput) {
    await this.access.requireManager(managerId, tripId);
    await this.access.requireMembership(input.targetUserId, tripId);
    const [manager, target] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: managerId },
        select: { id: true, nickname: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: input.targetUserId },
        select: { id: true, nickname: true },
      }),
    ]);
    const sourceKey = `manager-set:${managerId}:${input.clientRequestId}`;
    const findExisting = () =>
      this.prisma.pointLedger.findUnique({
        where: {
          tripId_userId_sourceKey: {
            tripId,
            userId: input.targetUserId,
            sourceKey,
          },
        },
        include: { user: { select: { id: true, nickname: true } } },
      });
    const existing = await findExisting();
    if (existing) return { entry: existing, duplicate: true };

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const current = await this.walletWithTransaction(transaction, tripId, input.targetUserId);
        const delta = input.balance - current.balance;
        await this.changeBalance(
          transaction,
          tripId,
          input.targetUserId,
          delta,
          "ADJUST",
          `${manager.nickname} 관리자 잔액 설정 · ${input.reason}`,
          sourceKey,
          {
            category: "MANAGER_BALANCE_SET",
            managerId,
            managerNickname: manager.nickname,
            targetNickname: target.nickname,
            previousBalance: current.balance,
            balance: input.balance,
            reason: input.reason,
          },
        );
        const entry = await transaction.pointLedger.findUniqueOrThrow({
          where: {
            tripId_userId_sourceKey: {
              tripId,
              userId: input.targetUserId,
              sourceKey,
            },
          },
          include: { user: { select: { id: true, nickname: true } } },
        });
        await transaction.chatMessage.create({
          data: {
            id: newId(),
            tripId,
            authorId: managerId,
            body: `🛠️ ${manager.nickname} 관리자가 ${target.nickname}님의 포인트를 ${current.balance.toLocaleString("ko-KR")}P에서 ${input.balance.toLocaleString("ko-KR")}P로 설정했습니다. 사유: ${input.reason}`,
            clientMessageId: `point-set-${entry.id}`,
          },
        });
        await transaction.auditLog.create({
          data: {
            id: newId(),
            actorId: managerId,
            action: "points.manager_set_balance",
            targetType: "PointWallet",
            targetId: input.targetUserId,
            metadataSafe: {
              tripId,
              previousBalance: current.balance,
              balance: input.balance,
              reason: input.reason,
              pointLedgerId: entry.id,
            },
          },
        });
        return { entry, duplicate: false };
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await findExisting();
        if (duplicate) return { entry: duplicate, duplicate: true };
      }
      throw error;
    }
  }

  async transferPoints(senderId: string, tripId: string, input: PointTransferInput) {
    await this.access.requireMembership(senderId, tripId);
    if (senderId === input.targetUserId) {
      throw new ConflictException({
        code: "POINT_SELF_TRANSFER_FORBIDDEN",
        message: "본인에게는 포인트를 보낼 수 없습니다.",
      });
    }
    await this.access.requireMembership(input.targetUserId, tripId);
    const [sender, target] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: senderId },
        select: { id: true, nickname: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: input.targetUserId },
        select: { id: true, nickname: true },
      }),
    ]);
    const transferKey = `member-transfer:${senderId}:${input.clientRequestId}`;
    const debitSourceKey = `${transferKey}:debit`;
    const creditSourceKey = `${transferKey}:credit`;
    const findExisting = async () => {
      const [debitEntry, creditEntry] = await Promise.all([
        this.prisma.pointLedger.findUnique({
          where: {
            tripId_userId_sourceKey: { tripId, userId: senderId, sourceKey: debitSourceKey },
          },
          include: { user: { select: { id: true, nickname: true } } },
        }),
        this.prisma.pointLedger.findUnique({
          where: {
            tripId_userId_sourceKey: {
              tripId,
              userId: input.targetUserId,
              sourceKey: creditSourceKey,
            },
          },
          include: { user: { select: { id: true, nickname: true } } },
        }),
      ]);
      return debitEntry && creditEntry ? { debitEntry, creditEntry, duplicate: true } : null;
    };
    const existing = await findExisting();
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (transaction) => {
        await this.changeBalance(
          transaction,
          tripId,
          senderId,
          -input.amount,
          "ADJUST",
          `${target.nickname}님에게 포인트 보내기`,
          debitSourceKey,
          {
            category: "MEMBER_TRANSFER",
            direction: "DEBIT",
            senderId,
            targetUserId: input.targetUserId,
            amount: input.amount,
            ...(input.note ? { note: input.note } : {}),
          },
        );
        await this.changeBalance(
          transaction,
          tripId,
          input.targetUserId,
          input.amount,
          "ADJUST",
          `${sender.nickname}님에게 받은 포인트`,
          creditSourceKey,
          {
            category: "MEMBER_TRANSFER",
            direction: "CREDIT",
            senderId,
            targetUserId: input.targetUserId,
            amount: input.amount,
            ...(input.note ? { note: input.note } : {}),
          },
        );
        const [debitEntry, creditEntry] = await Promise.all([
          transaction.pointLedger.findUniqueOrThrow({
            where: {
              tripId_userId_sourceKey: { tripId, userId: senderId, sourceKey: debitSourceKey },
            },
            include: { user: { select: { id: true, nickname: true } } },
          }),
          transaction.pointLedger.findUniqueOrThrow({
            where: {
              tripId_userId_sourceKey: {
                tripId,
                userId: input.targetUserId,
                sourceKey: creditSourceKey,
              },
            },
            include: { user: { select: { id: true, nickname: true } } },
          }),
        ]);
        await transaction.auditLog.create({
          data: {
            id: newId(),
            actorId: senderId,
            action: "points.member_transfer",
            targetType: "PointWallet",
            targetId: input.targetUserId,
            metadataSafe: {
              tripId,
              amount: input.amount,
              ...(input.note ? { note: input.note } : {}),
              debitPointLedgerId: debitEntry.id,
              creditPointLedgerId: creditEntry.id,
            },
          },
        });
        return { debitEntry, creditEntry, duplicate: false };
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await findExisting();
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }

  async grantReward(managerId: string, tripId: string, input: ManagerRewardGrantInput) {
    await this.access.requireManager(managerId, tripId);
    await this.access.requireMembership(input.targetUserId, tripId);
    await this.ensureRewards(tripId);
    const [manager, target, reward] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: managerId },
        select: { id: true, nickname: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: input.targetUserId },
        select: { id: true, nickname: true },
      }),
      this.prisma.rewardItem.findFirst({
        where: { id: input.rewardItemId, tripId, active: true },
      }),
    ]);
    if (!reward) {
      throw new NotFoundException({
        code: "REWARD_NOT_FOUND",
        message: "포인트 아이템을 찾을 수 없습니다.",
      });
    }
    const sourcePrefix = `manager-reward:${managerId}:${input.clientRequestId}`;
    const findExisting = () =>
      this.prisma.rewardRedemption.findMany({
        where: { tripId, sourceKey: { startsWith: `${sourcePrefix}:` } },
        include: {
          rewardItem: true,
          buyer: { select: { id: true, nickname: true } },
          target: { select: { id: true, nickname: true } },
        },
        orderBy: { sourceKey: "asc" },
      });
    const existing = await findExisting();
    if (existing.length > 0) {
      return { grants: existing, quantity: existing.length, duplicate: true };
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        await transaction.rewardRedemption.createMany({
          data: Array.from({ length: input.quantity }, (_, index) => ({
            id: newId(),
            tripId,
            rewardItemId: reward.id,
            buyerId: input.targetUserId,
            sourceKey: `${sourcePrefix}:${index + 1}`,
            cost: 0,
            status: "PENDING" as const,
            note: input.reason,
            outcome: {
              category: "MANAGER_REWARD_GRANT",
              managerId,
              managerNickname: manager.nickname,
              reason: input.reason,
            },
          })),
        });
        const grants = await transaction.rewardRedemption.findMany({
          where: { tripId, sourceKey: { startsWith: `${sourcePrefix}:` } },
          include: {
            rewardItem: true,
            buyer: { select: { id: true, nickname: true } },
            target: { select: { id: true, nickname: true } },
          },
          orderBy: { sourceKey: "asc" },
        });
        await transaction.chatMessage.create({
          data: {
            id: newId(),
            tripId,
            authorId: managerId,
            body: `🎁 ${manager.nickname} 관리자가 ${target.nickname}님에게 ‘${reward.title}’ ${input.quantity.toLocaleString("ko-KR")}개를 지급했습니다. 사유: ${input.reason}`,
            clientMessageId: `reward-grant-${grants[0]!.id}`,
          },
        });
        await transaction.auditLog.create({
          data: {
            id: newId(),
            actorId: managerId,
            action: "rewards.manager_grant",
            targetType: "RewardRedemption",
            targetId: input.targetUserId,
            metadataSafe: {
              tripId,
              rewardItemId: reward.id,
              rewardTitle: reward.title,
              quantity: input.quantity,
              reason: input.reason,
              grantIds: grants.map((grant) => grant.id),
            },
          },
        });
        return { grants, quantity: grants.length, duplicate: false };
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await findExisting();
        if (duplicate.length > 0) {
          return { grants: duplicate, quantity: duplicate.length, duplicate: true };
        }
      }
      throw error;
    }
  }

  async useGrantedReward(
    userId: string,
    tripId: string,
    grantId: string,
    input: RedeemRewardInput,
  ) {
    await this.access.requireMembership(userId, tripId);
    const grant = await this.prisma.rewardRedemption.findFirst({
      where: { id: grantId, tripId, buyerId: userId },
      include: {
        rewardItem: true,
        buyer: { select: { id: true, nickname: true } },
        target: { select: { id: true, nickname: true } },
      },
    });
    if (!grant) {
      throw new NotFoundException({
        code: "GRANTED_REWARD_NOT_FOUND",
        message: "지급받은 아이템을 찾을 수 없습니다.",
      });
    }
    if (grant.status === "APPLIED") return grant;
    if (grant.status !== "PENDING") {
      throw new ConflictException({
        code: "GRANTED_REWARD_UNAVAILABLE",
        message: "사용할 수 없는 아이템입니다.",
      });
    }
    const effect = grant.rewardItem.effect as {
      action?: string;
      points?: number;
      targetRequired?: boolean;
    };
    if (effect.targetRequired && !input.targetUserId) {
      throw new ConflictException({
        code: "REWARD_TARGET_REQUIRED",
        message: "이 아이템을 사용할 친구를 선택해 주세요.",
      });
    }
    if (input.targetUserId) {
      await this.access.requireMembership(input.targetUserId, tripId);
    }

    if (effect.action === "BLOCK_ONE_DRINK") {
      return this.blockOneDrinkTarget(userId, tripId, grant);
    }

    return this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.rewardRedemption.updateMany({
        where: { id: grant.id, status: "PENDING" },
        data: { status: "APPLIED", resolvedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: "GRANTED_REWARD_ALREADY_USED",
          message: "이미 사용한 아이템입니다.",
        });
      }
      let targetLoss = 0;
      if (
        grant.rewardItem.type === "TARGET_PENALTY" &&
        input.targetUserId &&
        typeof effect.points === "number"
      ) {
        const targetWallet = await this.walletWithTransaction(
          transaction,
          tripId,
          input.targetUserId,
        );
        targetLoss = Math.min(effect.points, targetWallet.balance);
        if (targetLoss > 0) {
          await this.changeBalance(
            transaction,
            tripId,
            input.targetUserId,
            -targetLoss,
            "LOSS",
            `${grant.rewardItem.title} 피격`,
            `reward:${grant.id}:target`,
            { buyerId: userId, grantedReward: true },
          );
        }
      }
      const previousOutcome =
        typeof grant.outcome === "object" && grant.outcome !== null && !Array.isArray(grant.outcome)
          ? grant.outcome
          : {};
      const redemption = await transaction.rewardRedemption.update({
        where: { id: grant.id },
        data: {
          ...(input.targetUserId === undefined ? {} : { targetId: input.targetUserId }),
          ...(input.note === undefined ? {} : { note: input.note }),
          outcome: {
            ...previousOutcome,
            action: effect.action ?? "PRIVILEGE",
            targetLoss,
            usedFromGrant: true,
          },
        },
        include: {
          rewardItem: true,
          buyer: { select: { id: true, nickname: true } },
          target: { select: { id: true, nickname: true } },
        },
      });
      await transaction.chatMessage.create({
        data: {
          id: newId(),
          tripId,
          authorId: userId,
          body: `${grant.buyer.nickname}님이 지급받은 아이템 ‘${grant.rewardItem.title}’을 사용했습니다.`,
          clientMessageId: `reward-use-${grant.id}`,
        },
      });
      return redemption;
    });
  }

  private async blockOneDrinkTarget(
    userId: string,
    tripId: string,
    shield: Prisma.RewardRedemptionGetPayload<{
      include: {
        rewardItem: true;
        buyer: { select: { id: true; nickname: true } };
        target: { select: { id: true; nickname: true } };
      };
    }>,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const claimedShield = await transaction.rewardRedemption.updateMany({
        where: { id: shield.id, tripId, buyerId: userId, status: "PENDING" },
        data: { status: "APPLIED", resolvedAt: new Date() },
      });
      if (claimedShield.count === 0) {
        throw new ConflictException({
          code: "GRANTED_REWARD_ALREADY_USED",
          message: "이미 사용한 아이템입니다.",
        });
      }

      const targetRedemption = await transaction.rewardRedemption.findFirst({
        where: {
          tripId,
          targetId: userId,
          status: "APPLIED",
          rewardItem: { seedKey: "one-drink-target" },
        },
        include: {
          rewardItem: true,
          buyer: { select: { id: true, nickname: true } },
          target: { select: { id: true, nickname: true } },
        },
        orderBy: [{ resolvedAt: "desc" }, { createdAt: "desc" }],
      });
      if (!targetRedemption) {
        throw new ConflictException({
          code: "ONE_DRINK_TARGET_NOT_FOUND",
          message: "방어할 한 잔 지목이 없습니다.",
        });
      }

      const blocked = await transaction.rewardRedemption.updateMany({
        where: { id: targetRedemption.id, status: "APPLIED", targetId: userId },
        data: {
          status: "REJECTED",
          resolvedAt: new Date(),
          outcome: {
            ...(typeof targetRedemption.outcome === "object" &&
            targetRedemption.outcome !== null &&
            !Array.isArray(targetRedemption.outcome)
              ? targetRedemption.outcome
              : {}),
            blocked: true,
            blockedByRewardId: shield.id,
          },
        },
      });
      if (blocked.count === 0) {
        throw new ConflictException({
          code: "ONE_DRINK_TARGET_ALREADY_BLOCKED",
          message: "이미 방어된 한 잔 지목입니다.",
        });
      }

      const previousShieldOutcome =
        typeof shield.outcome === "object" &&
        shield.outcome !== null &&
        !Array.isArray(shield.outcome)
          ? shield.outcome
          : {};
      const redemption = await transaction.rewardRedemption.update({
        where: { id: shield.id },
        data: {
          outcome: {
            ...previousShieldOutcome,
            action: "BLOCK_ONE_DRINK",
            blockedRedemptionId: targetRedemption.id,
            blockedBuyerId: targetRedemption.buyerId,
            usedFromGrant: true,
          },
        },
        include: {
          rewardItem: true,
          buyer: { select: { id: true, nickname: true } },
          target: { select: { id: true, nickname: true } },
        },
      });
      await transaction.chatMessage.create({
        data: {
          id: newId(),
          tripId,
          authorId: userId,
          body: `🛡️ ${shield.buyer.nickname}님이 한 잔 방어권을 사용해 ${targetRedemption.buyer.nickname}님의 지목 1회를 막았습니다.`,
          clientMessageId: `one-drink-shield-${shield.id}`,
        },
      });
      return redemption;
    });
  }

  async sellReward(userId: string, tripId: string, grantId: string) {
    await this.access.requireMembership(userId, tripId);
    const grant = await this.prisma.rewardRedemption.findFirst({
      where: { id: grantId, tripId, buyerId: userId },
      include: {
        rewardItem: true,
        buyer: { select: { id: true, nickname: true } },
        target: { select: { id: true, nickname: true } },
      },
    });
    if (!grant) {
      throw new NotFoundException({
        code: "REWARD_NOT_FOUND",
        message: "판매할 아이템을 찾을 수 없습니다.",
      });
    }
    const refundedPoints = rewardResaleValue(grant.cost);
    if (grant.status === "SOLD") {
      return {
        redemption: grant,
        refundedPoints,
        alreadySold: true,
        wallet: await this.wallet(tripId, userId),
      };
    }
    if (grant.status !== "PENDING") {
      throw new ConflictException({
        code: "REWARD_NOT_SELLABLE",
        message: "이미 사용했거나 판매할 수 없는 아이템입니다.",
      });
    }
    if (grant.cost <= 0 || refundedPoints <= 0) {
      throw new ConflictException({
        code: "FREE_REWARD_NOT_SELLABLE",
        message: "무료로 지급받은 아이템은 판매할 수 없습니다.",
      });
    }

    return this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.rewardRedemption.updateMany({
        where: { id: grant.id, tripId, buyerId: userId, status: "PENDING", cost: { gt: 0 } },
        data: { status: "SOLD", resolvedAt: new Date() },
      });
      if (claimed.count === 0) {
        const existing = await transaction.rewardRedemption.findUniqueOrThrow({
          where: { id: grant.id },
          include: {
            rewardItem: true,
            buyer: { select: { id: true, nickname: true } },
            target: { select: { id: true, nickname: true } },
          },
        });
        if (existing.status !== "SOLD") {
          throw new ConflictException({
            code: "REWARD_NOT_SELLABLE",
            message: "이미 사용했거나 판매할 수 없는 아이템입니다.",
          });
        }
        return {
          redemption: existing,
          refundedPoints: rewardResaleValue(existing.cost),
          alreadySold: true,
          wallet: await this.walletWithTransaction(transaction, tripId, userId),
        };
      }

      const wallet = await this.changeBalance(
        transaction,
        tripId,
        userId,
        refundedPoints,
        "ADJUST",
        `${grant.rewardItem.title} 판매`,
        `reward:${grant.id}:sale`,
        {
          rewardItemId: grant.rewardItemId,
          purchaseCost: grant.cost,
          resaleRate: 0.7,
          refundedPoints,
        },
      );
      const previousOutcome =
        typeof grant.outcome === "object" && grant.outcome !== null && !Array.isArray(grant.outcome)
          ? grant.outcome
          : {};
      const redemption = await transaction.rewardRedemption.update({
        where: { id: grant.id },
        data: {
          outcome: {
            ...previousOutcome,
            category: "POINT_RESALE",
            purchaseCost: grant.cost,
            resaleRate: 0.7,
            refundedPoints,
          },
        },
        include: {
          rewardItem: true,
          buyer: { select: { id: true, nickname: true } },
          target: { select: { id: true, nickname: true } },
        },
      });
      await transaction.chatMessage.create({
        data: {
          id: newId(),
          tripId,
          authorId: userId,
          body: `${grant.buyer.nickname}님이 아이템 ‘${grant.rewardItem.title}’을 ${refundedPoints.toLocaleString("ko-KR")}P에 판매했습니다.`,
          clientMessageId: `reward-sale-${grant.id}`,
        },
      });
      return { redemption, refundedPoints, alreadySold: false, wallet };
    });
  }

  async achievements(userId: string, tripId: string) {
    await this.access.requireMembership(userId, tripId);
    const [pointEntries, gameRounds, rewardUses] = await Promise.all([
      this.prisma.pointLedger.findMany({
        where: { tripId, userId },
        select: { sourceKey: true },
      }),
      this.prisma.gameRound.findMany({
        where: { tripId, userId },
        select: { gameType: true, score: true, pointDelta: true, result: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.rewardRedemption.count({
        where: { tripId, buyerId: userId, status: "APPLIED" },
      }),
    ]);
    const sourceKeys = pointEntries
      .map((entry) => entry.sourceKey)
      .filter((sourceKey): sourceKey is string => Boolean(sourceKey));
    const activityTypes = new Set(
      sourceKeys
        .filter((sourceKey) => sourceKey.startsWith("activity:"))
        .map((sourceKey) => sourceKey.split(":")[1])
        .filter((ruleKey): ruleKey is string => Boolean(ruleKey)),
    );
    const claimedKeys = new Set(
      sourceKeys
        .filter((sourceKey) => sourceKey.startsWith("achievement:"))
        .map((sourceKey) => sourceKey.slice("achievement:".length)),
    );
    const snailResults = gameRounds
      .filter((round) => round.gameType === "SNAIL_RACE")
      .map((round) => round.result);
    const activityTotal = sourceKeys.filter((sourceKey) =>
      sourceKey.startsWith("activity:"),
    ).length;
    const roundsByType = (gameType: GameType) =>
      gameRounds.filter((round) => round.gameType === gameType).length;
    const lotteryDraws = gameRounds
      .filter((round) => round.gameType === "LOTTERY")
      .reduce((total, round) => {
        if (
          typeof round.result !== "object" ||
          round.result === null ||
          Array.isArray(round.result) ||
          !("draws" in round.result) ||
          !Array.isArray(round.result.draws)
        ) {
          return total;
        }
        return total + round.result.draws.length;
      }, 0);
    const tapScores = gameRounds
      .filter((round) => round.gameType === "TAP")
      .map((round) => round.score ?? 0);
    const progressByMetric: Record<AchievementMetric, number> = {
      CHECK_INS: sourceKeys.filter((sourceKey) => sourceKey.startsWith("check-in:")).length,
      ACTIVITY_TOTAL: activityTotal,
      ACTIVITY_TYPES: activityTypes.size,
      GAME_TYPES: new Set(gameRounds.map((round) => round.gameType)).size,
      GAME_ROUNDS: gameRounds.length,
      GAME_WINS: gameRounds.filter((round) => round.pointDelta > 0).length,
      TAP_TOTAL: tapScores.reduce((sum, score) => sum + score, 0),
      TAP_BEST: Math.max(0, ...tapScores),
      SNAIL_ROUNDS: roundsByType("SNAIL_RACE"),
      SNAIL_WINS: snailResults.filter(
        (result) =>
          typeof result === "object" && result !== null && "won" in result && result.won === true,
      ).length,
      SNAIL_WIN_STREAK: maximumConsecutiveWins(snailResults),
      ODD_EVEN_ROUNDS: roundsByType("ODD_EVEN"),
      RPS_ROUNDS: roundsByType("RPS_ROULETTE"),
      PENALTY_ROUNDS: roundsByType("PENALTY_KICK"),
      LOTTERY_DRAWS: lotteryDraws,
      REWARD_USES: rewardUses,
    };
    const items = achievementDefinitions.map((definition) => {
      const progress = Math.min(progressByMetric[definition.metric], definition.target);
      const claimed = claimedKeys.has(definition.key);
      return {
        key: definition.key,
        title: definition.title,
        description: definition.description,
        reward: definition.reward,
        seriesKey: definition.seriesKey,
        seriesTitle: definition.seriesTitle,
        category: definition.category,
        stage: definition.stage,
        stageCount: definition.stageCount,
        unit: definition.unit,
        progress,
        target: definition.target,
        achieved: progress >= definition.target,
        claimed,
        claimable: progress >= definition.target && !claimed,
      };
    });
    return {
      items,
      totalCount: items.length,
      seriesCount: new Set(items.map((item) => item.seriesKey)).size,
      achievedCount: items.filter((item) => item.achieved).length,
      claimedCount: items.filter((item) => item.claimed).length,
      claimableCount: items.filter((item) => item.claimable).length,
      totalReward: items.reduce((total, item) => total + item.reward, 0),
    };
  }

  async claimAchievement(userId: string, tripId: string, achievementKey: AchievementKey) {
    const progress = await this.achievements(userId, tripId);
    const achievement = progress.items.find((item) => item.key === achievementKey);
    if (!achievement) {
      throw new NotFoundException({
        code: "ACHIEVEMENT_NOT_FOUND",
        message: "업적을 찾을 수 없습니다.",
      });
    }
    const sourceKey = `achievement:${achievement.key}`;
    const findExisting = () =>
      this.prisma.pointLedger.findUnique({
        where: { tripId_userId_sourceKey: { tripId, userId, sourceKey } },
        include: { user: { select: { id: true, nickname: true } } },
      });
    if (achievement.claimed) {
      return { achievement, entry: await findExisting(), alreadyClaimed: true };
    }
    if (!achievement.claimable) {
      throw new ConflictException({
        code: "ACHIEVEMENT_NOT_COMPLETED",
        message: "아직 달성하지 못한 업적입니다.",
      });
    }

    try {
      const entry = await this.prisma.$transaction(async (transaction) => {
        await this.changeBalance(
          transaction,
          tripId,
          userId,
          achievement.reward,
          "EARN",
          `업적 달성 · ${achievement.title}`,
          sourceKey,
          {
            achievementKey: achievement.key,
            achievementSeriesKey: achievement.seriesKey,
            achievementStage: achievement.stage,
            reward: achievement.reward,
          },
        );
        return transaction.pointLedger.findUniqueOrThrow({
          where: { tripId_userId_sourceKey: { tripId, userId, sourceKey } },
          include: { user: { select: { id: true, nickname: true } } },
        });
      });
      return {
        achievement: { ...achievement, claimed: true, claimable: false },
        entry,
        alreadyClaimed: false,
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await findExisting();
        if (existing) {
          return {
            achievement: { ...achievement, claimed: true, claimable: false },
            entry: existing,
            alreadyClaimed: true,
          };
        }
      }
      throw error;
    }
  }

  async awardActivity(
    tripId: string,
    userId: string,
    ruleKey: (typeof activityRules)[number]["key"],
    sourceId: string,
  ) {
    const rule = activityRules.find((entry) => entry.key === ruleKey);
    if (!rule) return;
    await this.prisma
      .$transaction((transaction) =>
        this.changeBalance(
          transaction,
          tripId,
          userId,
          rule.points,
          "EARN",
          rule.label,
          `activity:${ruleKey}:${sourceId}`,
          { ruleKey },
        ),
      )
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return undefined;
        }
        throw error;
      });
  }

  async redeem(userId: string, tripId: string, rewardItemId: string, input: RedeemRewardInput) {
    await this.access.requireMembership(userId, tripId);
    const reward = await this.prisma.rewardItem.findFirst({
      where: { id: rewardItemId, tripId, active: true },
    });
    if (!reward) {
      throw new NotFoundException({
        code: "REWARD_NOT_FOUND",
        message: "포인트 아이템을 찾을 수 없습니다.",
      });
    }
    const effect = reward.effect as { action?: string };
    const redemptionId = newId();
    const buyer = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { nickname: true },
    });
    return this.prisma.$transaction(async (transaction) => {
      await this.changeBalance(
        transaction,
        tripId,
        userId,
        -reward.cost,
        "SPEND",
        `${reward.title} 구매`,
        `reward:${redemptionId}:cost`,
        { rewardItemId: reward.id },
      );
      const redemption = await transaction.rewardRedemption.create({
        data: {
          id: redemptionId,
          tripId,
          rewardItemId: reward.id,
          buyerId: userId,
          cost: reward.cost,
          status: "PENDING",
          ...(input.note === undefined ? {} : { note: input.note }),
          outcome: { action: effect.action ?? "PRIVILEGE", category: "POINT_PURCHASE" },
        },
        include: {
          rewardItem: true,
          buyer: { select: { id: true, nickname: true } },
          target: { select: { id: true, nickname: true } },
        },
      });
      await transaction.chatMessage.create({
        data: {
          id: newId(),
          tripId,
          authorId: userId,
          body: `${buyer.nickname}님이 포인트 아이템 ‘${reward.title}’을 구매해 보유함에 넣었습니다.`,
          clientMessageId: `reward-${redemptionId}`,
        },
      });
      return redemption;
    });
  }

  async playOddEven(userId: string, tripId: string, input: OddEvenGameInput) {
    await this.access.requireMembership(userId, tripId);
    const existing = await this.existingRound(tripId, userId, input.clientRoundId);
    if (existing) return existing;
    const startSide = randomInt(0, 2) === 0 ? "LEFT" : "RIGHT";
    const rungCount = randomInt(0, 2) === 0 ? 3 : 4;
    const rungBases = rungCount === 3 ? [102, 182, 262] : [76, 146, 216, 286];
    const rungYs = rungBases.map((base) => base + randomInt(-9, 10));
    const endSide = rungCount % 2 === 0 ? startSide : startSide === "LEFT" ? "RIGHT" : "LEFT";
    const answer = endSide === "LEFT" ? "ODD" : "EVEN";
    const selectedCount = [input.startChoice, input.rungCountChoice, input.endChoice].filter(
      (choice) => choice !== undefined,
    ).length;
    const payoutRule = ladderPayouts.find((rule) => rule.selectionCount === selectedCount)!;
    const won =
      (input.startChoice === undefined || input.startChoice === startSide) &&
      (input.rungCountChoice === undefined || input.rungCountChoice === rungCount) &&
      (input.endChoice === undefined || input.endChoice === answer);
    const payout = won ? payoutWithTotalMultiplier(input.wager, payoutRule.multiplier) : 0;
    return this.finishWagerRound(
      userId,
      tripId,
      "ODD_EVEN",
      input.wager,
      payout,
      input.clientRoundId,
      {
        ...(input.startChoice ? { startChoice: input.startChoice } : {}),
        ...(input.rungCountChoice ? { rungCountChoice: input.rungCountChoice } : {}),
        ...(input.endChoice ? { endChoice: input.endChoice } : {}),
        selectedCount,
        payoutMultiplier: payoutRule.multiplier,
        answer,
        rungCount,
        rungYs,
        startSide,
        endSide,
        won,
      },
    );
  }

  async gameRoundHistory(userId: string, tripId: string, gameType: GameType) {
    await this.access.requireMembership(userId, tripId);
    const where = { tripId, gameType };
    const [items, total] = await Promise.all([
      this.prisma.gameRound.findMany({
        where,
        include: { user: { select: { id: true, nickname: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
      }),
      this.prisma.gameRound.count({ where }),
    ]);
    return { items, total, limit: 50 };
  }

  async playSnailRace(userId: string, tripId: string, input: SnailRaceGameInput) {
    await this.access.requireMembership(userId, tripId);
    const existing = await this.existingRound(tripId, userId, input.clientRoundId);
    if (existing) return existing;
    const winner = randomInt(1, 5);
    const won = input.snail === winner;
    const progress = [1, 2, 3, 4].map((snail) => ({
      snail,
      distance: snail === winner ? 100 : randomInt(60, 96),
    }));
    return this.finishWagerRound(
      userId,
      tripId,
      "SNAIL_RACE",
      input.wager,
      won ? input.wager * 4 : 0,
      input.clientRoundId,
      { selected: input.snail, winner, progress, won },
    );
  }

  async playRpsRoulette(userId: string, tripId: string, input: RpsRouletteGameInput) {
    await this.access.requireMembership(userId, tripId);
    const existing = await this.existingRound(tripId, userId, input.clientRoundId);
    if (existing) return existing;
    const desiredOutcome = this.weighted(rpsOutcomeProbabilities, 1_000_000).outcome;
    const machineByOutcome = {
      ROCK: { WIN: "SCISSORS", DRAW: "ROCK", LOSS: "PAPER" },
      PAPER: { WIN: "ROCK", DRAW: "PAPER", LOSS: "SCISSORS" },
      SCISSORS: { WIN: "PAPER", DRAW: "SCISSORS", LOSS: "ROCK" },
    } as const;
    const machine = machineByOutcome[input.choice][desiredOutcome];
    const draw = machine === input.choice;
    const won =
      (input.choice === "ROCK" && machine === "SCISSORS") ||
      (input.choice === "PAPER" && machine === "ROCK") ||
      (input.choice === "SCISSORS" && machine === "PAPER");
    const multiplier = won ? this.weighted(rpsMultipliers, 1_000_000).multiplier : draw ? 1 : 0;
    const payout = won
      ? payoutWithProfitMultiplier(input.wager, multiplier)
      : draw
        ? input.wager
        : 0;
    return this.finishWagerRound(
      userId,
      tripId,
      "RPS_ROULETTE",
      input.wager,
      payout,
      input.clientRoundId,
      {
        choice: input.choice,
        machine,
        outcome: won ? "WIN" : draw ? "DRAW" : "LOSS",
        multiplier,
        disclosedOdds: true,
      },
    );
  }

  async drawLottery(userId: string, tripId: string, input: LotteryDrawInput) {
    await this.access.requireMembership(userId, tripId);
    const existing = await this.existingRound(tripId, userId, input.clientRoundId);
    if (existing) return existing;
    const wager = input.count * 10;
    const draws = Array.from({ length: input.count }, () => {
      const tier = this.weighted(lotteryTiers, 1_000_000_000);
      return { key: tier.key, label: tier.label, prize: tier.prize };
    });
    const payout = draws.reduce((total, draw) => total + draw.prize, 0);
    return this.finishWagerRound(userId, tripId, "LOTTERY", wager, payout, input.clientRoundId, {
      count: input.count,
      draws,
      disclosedOdds: true,
    });
  }

  async submitTapScore(userId: string, tripId: string, input: SubmitTapScoreInput) {
    await this.access.requireMembership(userId, tripId);
    const existing = await this.existingRound(tripId, userId, input.clientRoundId);
    if (existing) return existing;
    const { start, end } = this.kstDayRange();
    const rewardedToday = await this.prisma.gameRound.count({
      where: {
        tripId,
        userId,
        gameType: "TAP",
        pointDelta: { gt: 0 },
        createdAt: { gte: start, lt: end },
      },
    });
    const reward = rewardedToday >= 3 ? 0 : Math.min(60, 5 + Math.floor(input.score / 4));
    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (reward > 0) {
          await this.changeBalance(
            transaction,
            tripId,
            userId,
            reward,
            "WIN",
            "10초 탭 게임 보상",
            `game:${input.clientRoundId}:payout`,
            { score: input.score },
          );
        }
        return transaction.gameRound.create({
          data: {
            id: newId(),
            tripId,
            userId,
            gameType: "TAP",
            clientRoundId: input.clientRoundId,
            score: input.score,
            pointDelta: reward,
            result: {
              score: input.score,
              rewarded: reward > 0,
              rewardedPlay: reward > 0 ? Math.min(rewardedToday + 1, 3) : rewardedToday,
              rewardLimit: 3,
            },
          },
          include: { user: { select: { id: true, nickname: true } } },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await this.existingRound(tripId, userId, input.clientRoundId);
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }

  async penaltyMatches(userId: string, tripId: string) {
    await this.access.requireMembership(userId, tripId);
    const matches = await this.prisma.penaltyMatch.findMany({
      where: { tripId },
      include: {
        creator: { select: { id: true, nickname: true } },
        opponent: { select: { id: true, nickname: true } },
        winner: { select: { id: true, nickname: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return matches.map((match) => {
      const reveal = match.status !== "OPEN" || match.creatorId === userId;
      return {
        id: match.id,
        tripId: match.tripId,
        creator: match.creator,
        opponent: match.opponent,
        winner: match.winner,
        wager: match.wager,
        status: match.status,
        requiredAction: match.creatorAction === "KICK" ? "DIVE" : "KICK",
        ...(reveal
          ? {
              creatorAction: match.creatorAction,
              creatorDirection: match.creatorDirection,
            }
          : {}),
        ...(match.status === "RESOLVED"
          ? {
              opponentAction: match.opponentAction,
              opponentDirection: match.opponentDirection,
              goal:
                (match.creatorAction === "KICK"
                  ? match.creatorDirection
                  : match.opponentDirection) !==
                (match.creatorAction === "DIVE" ? match.creatorDirection : match.opponentDirection),
            }
          : {}),
        createdAt: match.createdAt,
        resolvedAt: match.resolvedAt,
      };
    });
  }

  async createPenaltyMatch(userId: string, tripId: string, input: CreatePenaltyMatchInput) {
    await this.access.requireMembership(userId, tripId);
    const matchId = newId();
    await this.prisma.$transaction(async (transaction) => {
      await this.changeBalance(
        transaction,
        tripId,
        userId,
        -input.wager,
        "SPEND",
        "비공개 승부차기 판돈 예치",
        `penalty:${matchId}:creator-stake`,
        { matchId },
      );
      await transaction.penaltyMatch.create({
        data: {
          id: matchId,
          tripId,
          creatorId: userId,
          creatorAction: input.action,
          creatorDirection: input.direction,
          wager: input.wager,
        },
      });
    });
    return this.penaltyMatches(userId, tripId).then((matches) =>
      matches.find((match) => match.id === matchId),
    );
  }

  async joinPenaltyMatch(userId: string, matchId: string, input: JoinPenaltyMatchInput) {
    const match = await this.prisma.penaltyMatch.findUnique({ where: { id: matchId } });
    if (!match) throw this.penaltyNotFound();
    await this.access.requireMembership(userId, match.tripId);
    if (match.creatorId === userId) {
      throw new ConflictException({
        code: "PENALTY_SELF_JOIN",
        message: "본인이 만든 승부에는 참가할 수 없습니다.",
      });
    }
    if (match.creatorAction === input.action) {
      throw new ConflictException({
        code: "PENALTY_OPPOSITE_ROLE_REQUIRED",
        message: `이 경기에서는 ${match.creatorAction === "KICK" ? "막기" : "차기"}를 선택해 주세요.`,
      });
    }
    const kickerId = match.creatorAction === "KICK" ? match.creatorId : userId;
    const keeperId = match.creatorAction === "DIVE" ? match.creatorId : userId;
    const kickDirection = match.creatorAction === "KICK" ? match.creatorDirection : input.direction;
    const diveDirection = match.creatorAction === "DIVE" ? match.creatorDirection : input.direction;
    const goal = kickDirection !== diveDirection;
    const winnerId = goal ? kickerId : keeperId;
    await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.penaltyMatch.updateMany({
        where: { id: matchId, status: "OPEN", opponentId: null },
        data: {
          opponentId: userId,
          opponentAction: input.action,
          opponentDirection: input.direction,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          code: "PENALTY_ALREADY_JOINED",
          message: "다른 친구가 먼저 참가한 경기입니다.",
        });
      }
      await this.changeBalance(
        transaction,
        match.tripId,
        userId,
        -match.wager,
        "SPEND",
        "비공개 승부차기 판돈 예치",
        `penalty:${matchId}:opponent-stake`,
        { matchId },
      );
      await this.changeBalance(
        transaction,
        match.tripId,
        winnerId,
        match.wager * 2,
        "WIN",
        "승부차기 대결 승리",
        `penalty:${matchId}:payout`,
        { matchId, goal },
      );
      await transaction.penaltyMatch.update({
        where: { id: matchId },
        data: {
          status: "RESOLVED",
          winnerId,
          resolvedAt: new Date(),
        },
      });
      await transaction.gameRound.createMany({
        data: [
          {
            id: newId(),
            tripId: match.tripId,
            userId: match.creatorId,
            gameType: "PENALTY_KICK",
            wager: match.wager,
            pointDelta: winnerId === match.creatorId ? match.wager : -match.wager,
            result: { matchId, goal, winnerId },
          },
          {
            id: newId(),
            tripId: match.tripId,
            userId,
            gameType: "PENALTY_KICK",
            wager: match.wager,
            pointDelta: winnerId === userId ? match.wager : -match.wager,
            result: { matchId, goal, winnerId },
          },
        ],
      });
    });
    return this.penaltyMatches(userId, match.tripId).then((matches) =>
      matches.find((entry) => entry.id === matchId),
    );
  }

  async cancelPenaltyMatch(userId: string, matchId: string) {
    const match = await this.prisma.penaltyMatch.findUnique({ where: { id: matchId } });
    if (!match) throw this.penaltyNotFound();
    if (match.creatorId !== userId || match.status !== "OPEN") {
      throw new ConflictException({
        code: "PENALTY_CANCEL_FORBIDDEN",
        message: "열린 경기의 생성자만 취소할 수 있습니다.",
      });
    }
    await this.prisma.$transaction(async (transaction) => {
      const cancelled = await transaction.penaltyMatch.updateMany({
        where: { id: matchId, status: "OPEN", opponentId: null },
        data: { status: "CANCELLED", resolvedAt: new Date() },
      });
      if (cancelled.count === 0) {
        throw new ConflictException({
          code: "PENALTY_ALREADY_JOINED",
          message: "이미 참가자가 있어 취소할 수 없습니다.",
        });
      }
      await this.changeBalance(
        transaction,
        match.tripId,
        userId,
        match.wager,
        "ADJUST",
        "승부차기 취소 환불",
        `penalty:${matchId}:refund`,
        { matchId },
      );
    });
    return { cancelled: true };
  }

  async characterProfiles(userId: string, tripId: string) {
    await this.access.requireMembership(userId, tripId);
    return this.prisma.tripCharacterProfile.findMany({
      where: { tripId },
      select: {
        tripId: true,
        userId: true,
        concept: true,
        reason: true,
        mime: true,
        updatedAt: true,
      },
    });
  }

  async characterContent(userId: string, tripId: string, memberUserId: string) {
    await this.access.requireMembership(userId, tripId);
    const profile = await this.prisma.tripCharacterProfile.findUnique({
      where: { tripId_userId: { tripId, userId: memberUserId } },
    });
    if (!profile) {
      throw new NotFoundException({
        code: "CHARACTER_PROFILE_NOT_FOUND",
        message: "멤버 프로필 이미지를 찾을 수 없습니다.",
      });
    }
    return {
      mime: profile.mime,
      dataBase64: Buffer.from(profile.imageData).toString("base64"),
      concept: profile.concept,
      reason: profile.reason,
    };
  }

  private async finishWagerRound(
    userId: string,
    tripId: string,
    gameType: GameType,
    wager: number,
    payout: number,
    clientRoundId: string,
    result: Prisma.InputJsonObject,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await this.changeBalance(
        transaction,
        tripId,
        userId,
        -wager,
        "SPEND",
        `${this.gameLabel(gameType)} 참가`,
        `game:${clientRoundId}:stake`,
        { gameType, wager },
      );
      if (payout > 0) {
        await this.changeBalance(
          transaction,
          tripId,
          userId,
          payout,
          "WIN",
          `${this.gameLabel(gameType)} 결과`,
          `game:${clientRoundId}:payout`,
          { gameType, payout },
        );
      }
      return transaction.gameRound.create({
        data: {
          id: newId(),
          tripId,
          userId,
          gameType,
          clientRoundId,
          wager,
          pointDelta: payout - wager,
          result,
        },
        include: { user: { select: { id: true, nickname: true } } },
      });
    });
  }

  private async existingRound(tripId: string, userId: string, clientRoundId: string) {
    return this.prisma.gameRound.findUnique({
      where: {
        tripId_userId_clientRoundId: { tripId, userId, clientRoundId },
      },
      include: { user: { select: { id: true, nickname: true } } },
    });
  }

  private weighted<T extends { weight: number }>(entries: readonly T[], totalWeight: number): T {
    let roll = randomInt(0, totalWeight);
    for (const entry of entries) {
      if (roll < entry.weight) return entry;
      roll -= entry.weight;
    }
    return entries[entries.length - 1]!;
  }

  private gameLabel(gameType: GameType) {
    return {
      TAP: "10초 탭 게임",
      ODD_EVEN: "홀짝",
      SNAIL_RACE: "달팽이 레이스",
      RPS_ROULETTE: "짱깸보",
      PENALTY_KICK: "승부차기 대결",
      LOTTERY: "포인트 로또",
    }[gameType];
  }

  private async ensureWallets(tripId: string) {
    const members = await this.access.members(tripId);
    await Promise.all(
      members.map((member) =>
        this.prisma.pointWallet.upsert({
          where: { tripId_userId: { tripId, userId: member.userId } },
          update: {},
          create: { tripId, userId: member.userId },
        }),
      ),
    );
  }

  private async ensureRewards(tripId: string) {
    await Promise.all(
      defaultRewards.map((reward, index) =>
        this.prisma.rewardItem.upsert({
          where: { tripId_seedKey: { tripId, seedKey: reward.seedKey } },
          update: {
            title: reward.title,
            description: reward.description,
            cost: reward.cost,
            type: reward.type,
            effect: reward.effect,
            sortOrder: index,
          },
          create: {
            id: newId(),
            tripId,
            ...reward,
            sortOrder: index,
          },
        }),
      ),
    );
  }

  private async wallet(tripId: string, userId: string) {
    return this.prisma.pointWallet.upsert({
      where: { tripId_userId: { tripId, userId } },
      update: {},
      create: { tripId, userId },
      include: { user: { select: { id: true, nickname: true } } },
    });
  }

  private async walletWithTransaction(
    transaction: Prisma.TransactionClient,
    tripId: string,
    userId: string,
  ) {
    return transaction.pointWallet.upsert({
      where: { tripId_userId: { tripId, userId } },
      update: {},
      create: { tripId, userId },
    });
  }

  private async changeBalance(
    transaction: Prisma.TransactionClient,
    tripId: string,
    userId: string,
    delta: number,
    kind: PointEntryKind,
    reason: string,
    sourceKey: string,
    metadata: Prisma.InputJsonObject,
  ) {
    const duplicate = await transaction.pointLedger.findUnique({
      where: { tripId_userId_sourceKey: { tripId, userId, sourceKey } },
    });
    if (duplicate) {
      return this.walletWithTransaction(transaction, tripId, userId);
    }
    await this.walletWithTransaction(transaction, tripId, userId);
    if (delta < 0) {
      const changed = await transaction.pointWallet.updateMany({
        where: { tripId, userId, balance: { gte: Math.abs(delta) } },
        data: {
          balance: { increment: delta },
          ...(kind === "ADJUST" ? {} : { spentTotal: { increment: Math.abs(delta) } }),
        },
      });
      if (changed.count === 0) {
        throw new ConflictException({
          code: "INSUFFICIENT_POINTS",
          message: "포인트가 부족합니다.",
        });
      }
    } else {
      await transaction.pointWallet.update({
        where: { tripId_userId: { tripId, userId } },
        data: {
          balance: { increment: delta },
          ...(kind === "ADJUST" ? {} : { earnedTotal: { increment: delta } }),
        },
      });
    }
    const wallet = await transaction.pointWallet.findUniqueOrThrow({
      where: { tripId_userId: { tripId, userId } },
    });
    await transaction.pointLedger.create({
      data: {
        id: newId(),
        tripId,
        userId,
        delta,
        balanceAfter: wallet.balance,
        kind,
        reason,
        sourceKey,
        metadata,
      },
    });
    return wallet;
  }

  private kstDate() {
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return new Date(`${key}T00:00:00.000Z`);
  }

  private dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private kstDayRange() {
    const date = this.kstDate();
    const start = new Date(date.getTime() - 9 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 86_400_000);
    return { start, end };
  }

  private penaltyNotFound() {
    return new NotFoundException({
      code: "PENALTY_MATCH_NOT_FOUND",
      message: "승부차기 경기를 찾을 수 없습니다.",
    });
  }
}
