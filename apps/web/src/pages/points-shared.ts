export interface UserRef {
  id: string;
  nickname: string;
}

export interface PointWallet {
  tripId: string;
  userId: string;
  balance: number;
  earnedTotal: number;
  spentTotal: number;
  checkInStreak: number;
  lastCheckInDate: string | null;
  user: UserRef;
}

export interface PointEntry {
  id: string;
  delta: number;
  balanceAfter: number;
  kind: "EARN" | "SPEND" | "WIN" | "LOSS" | "ADJUST";
  reason: string;
  sourceKey: string | null;
  metadata: unknown;
  createdAt: string;
  user: UserRef;
}

export interface Achievement {
  key: string;
  title: string;
  description: string;
  reward: number;
  seriesKey: string;
  seriesTitle: string;
  category: "TRIP" | "ARCADE" | "COLLECTION";
  stage: number;
  stageCount: number;
  unit: string;
  progress: number;
  target: number;
  achieved: boolean;
  claimed: boolean;
  claimable: boolean;
}

export interface AchievementsData {
  items: Achievement[];
  totalCount: number;
  seriesCount: number;
  achievedCount: number;
  claimedCount: number;
  claimableCount: number;
  totalReward: number;
}

export interface RewardItem {
  id: string;
  title: string;
  description: string;
  cost: number;
  type: "PRIVILEGE" | "TARGET_PENALTY" | "PROTECTION";
  effect: unknown;
}

export interface RewardRedemption {
  id: string;
  cost: number;
  status: "APPLIED" | "PENDING" | "ACCEPTED" | "REJECTED" | "SOLD";
  createdAt: string;
  resolvedAt: string | null;
  outcome: Record<string, unknown>;
  rewardItem: RewardItem;
  buyer: UserRef;
  target: UserRef | null;
}

export interface OneDrinkTargetCount {
  userId: string;
  user: UserRef;
  count: number;
}

export interface RewardInventoryEntry {
  id: string;
  userId: string;
  rewardItemId: string;
  quantity: number;
  grantIds: string[];
  sellableGrantIds: string[];
  nextSaleValue: number;
  user: UserRef;
  rewardItem: RewardItem;
}

export interface GameRound {
  id: string;
  gameType: string;
  wager: number;
  score: number | null;
  pointDelta: number;
  result: Record<string, unknown>;
  createdAt: string;
  user: UserRef;
}

export interface GameRoundHistory {
  items: GameRound[];
  total: number;
  limit: number;
}

export interface ActivityRule {
  key: string;
  label: string;
  points: number;
  note?: string;
}

export interface LotteryTier {
  key: string;
  label: string;
  probability: string;
  prize: number;
}

export interface PointsRules {
  notice: string;
  activityRules: ActivityRule[];
  games: {
    lottery: { pricePerDraw: number; tiers: LotteryTier[] };
    rpsRoulette: {
      outcomes: Array<{ outcome: "WIN" | "DRAW" | "LOSS"; probability: string }>;
      multipliers: Array<{ multiplier: number; probability: string }>;
    };
  };
}

export interface PointsDashboard {
  myWallet: PointWallet;
  myRole: "MANAGER" | "MEMBER" | "GUEST";
  balanceLeaderboard: PointWallet[];
  activityLeaderboard: PointWallet[];
  recentEntries: PointEntry[];
  rewards: RewardItem[];
  rewardInventory: RewardInventoryEntry[];
  recentRedemptions: RewardRedemption[];
  oneDrinkTargetCounts: OneDrinkTargetCount[];
  tapRewardStatus: {
    rewardedToday: number;
    remainingToday: number;
  };
  rules: PointsRules;
}

export interface PenaltyMatch {
  id: string;
  creator: UserRef;
  opponent: UserRef | null;
  winner: UserRef | null;
  wager: number;
  status: "OPEN" | "RESOLVED" | "CANCELLED";
  requiredAction: "KICK" | "DIVE";
  creatorAction?: "KICK" | "DIVE";
  creatorDirection?: "LEFT" | "CENTER" | "RIGHT";
  opponentAction?: "KICK" | "DIVE";
  opponentDirection?: "LEFT" | "CENTER" | "RIGHT";
  goal?: boolean;
  createdAt: string;
}

export function point(value: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(value)}P`;
}

export function time(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export function direction(value: unknown): string {
  return { LEFT: "왼쪽", CENTER: "가운데", RIGHT: "오른쪽" }[String(value)] ?? "비공개";
}

export function gameName(value: string): string {
  return (
    {
      TAP: "10초 탭",
      ODD_EVEN: "홀짝 사다리",
      SNAIL_RACE: "달팽이 레이스",
      RPS_ROULETTE: "짱깸보 룰렛",
      PENALTY_KICK: "승부차기",
      LOTTERY: "포인트 로또",
    }[value] ?? value
  );
}

export function describeResult(round: GameRound): string {
  const result = round.result;
  if (round.gameType === "ODD_EVEN") {
    if (typeof result.startSide === "string" && typeof result.rungCount === "number") {
      const pattern = `${result.startSide === "LEFT" ? "좌" : "우"}${result.rungCount}${result.answer === "ODD" ? "홀" : "짝"}`;
      return `${result.won ? "적중" : "실패"} · ${pattern}`;
    }
    return `${result.won ? "적중" : "실패"} · 나온 수 ${String(result.rolled)}`;
  }
  if (round.gameType === "SNAIL_RACE") {
    return `${result.won ? "적중" : "실패"} · ${String(result.winner)}번 달팽이 우승`;
  }
  if (round.gameType === "RPS_ROULETTE") {
    return `${String(result.outcome)} · ${String(result.multiplier)}배`;
  }
  if (round.gameType === "LOTTERY") {
    const draws = Array.isArray(result.draws) ? result.draws : [];
    return draws
      .map((draw) =>
        typeof draw === "object" && draw && "label" in draw ? String(draw.label) : "결과",
      )
      .join(", ");
  }
  if (round.gameType === "TAP") {
    const rewardedPlay = Number(result.rewardedPlay);
    if (result.rewarded === false) return `${round.score ?? 0}회 · 오늘 보상 소진`;
    return `${round.score ?? 0}회${Number.isFinite(rewardedPlay) ? ` · 보상 ${rewardedPlay}/3회` : ""}`;
  }
  return result.goal === true ? "골" : result.goal === false ? "선방" : "결과 확정";
}
