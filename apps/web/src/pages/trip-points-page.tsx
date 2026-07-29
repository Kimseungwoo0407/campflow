import {
  BadgeCheck,
  CalendarCheck,
  Coins,
  Dices,
  Gift,
  Goal,
  Medal,
  MousePointerClick,
  Rocket,
  Shield,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button, Card, Spinner } from "@campflow/ui";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { WorkspaceShell } from "./trip-workspace-pages";
import { useParams } from "react-router-dom";

interface UserRef {
  id: string;
  nickname: string;
}

interface PointWallet {
  tripId: string;
  userId: string;
  balance: number;
  earnedTotal: number;
  spentTotal: number;
  checkInStreak: number;
  lastCheckInDate: string | null;
  user: UserRef;
}

interface PointEntry {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
  user: UserRef;
}

interface RewardItem {
  id: string;
  title: string;
  description: string;
  cost: number;
  type: "PRIVILEGE" | "TARGET_PENALTY" | "PROTECTION";
  effect: unknown;
}

interface RewardRedemption {
  id: string;
  cost: number;
  createdAt: string;
  rewardItem: RewardItem;
  buyer: UserRef;
  target: UserRef | null;
}

interface GameRound {
  id: string;
  gameType: string;
  wager: number;
  score: number | null;
  pointDelta: number;
  result: Record<string, unknown>;
  createdAt: string;
  user: UserRef;
}

interface ActivityRule {
  key: string;
  label: string;
  points: number;
  note?: string;
}

interface LotteryTier {
  key: string;
  label: string;
  probability: string;
  prize: number;
}

interface PointsRules {
  notice: string;
  activityRules: ActivityRule[];
  games: {
    lottery: { pricePerDraw: number; tiers: LotteryTier[] };
    rpsRoulette: {
      multipliers: Array<{ multiplier: number; probability: string }>;
    };
  };
}

interface PointsDashboard {
  myWallet: PointWallet;
  balanceLeaderboard: PointWallet[];
  activityLeaderboard: PointWallet[];
  recentEntries: PointEntry[];
  rewards: RewardItem[];
  recentRedemptions: RewardRedemption[];
  recentGames: GameRound[];
  rules: PointsRules;
}

interface PenaltyMatch {
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

function point(value: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(value)}P`;
}

function time(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function direction(value: unknown): string {
  return { LEFT: "왼쪽", CENTER: "가운데", RIGHT: "오른쪽" }[String(value)] ?? "비공개";
}

function gameName(value: string): string {
  return (
    {
      TAP: "10초 탭",
      ODD_EVEN: "홀짝",
      SNAIL_RACE: "달팽이",
      RPS_ROULETTE: "짱깸보",
      PENALTY_KICK: "승부차기",
      LOTTERY: "로또",
    }[value] ?? value
  );
}

function describeResult(round: GameRound): string {
  const result = round.result;
  if (round.gameType === "ODD_EVEN") {
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
  if (round.gameType === "TAP") return `${round.score ?? 0}회`;
  return result.goal === true ? "골" : result.goal === false ? "선방" : "결과 확정";
}

export function TripPointsPage() {
  const { tripId = "" } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [wager, setWager] = useState(50);
  const [targetUserId, setTargetUserId] = useState("");
  const [lastResult, setLastResult] = useState<GameRound | null>(null);
  const [tapSeconds, setTapSeconds] = useState(0);
  const [tapScore, setTapScore] = useState(0);
  const [penaltyAction, setPenaltyAction] = useState<"KICK" | "DIVE">("KICK");
  const [penaltyDirection, setPenaltyDirection] = useState<"LEFT" | "CENTER" | "RIGHT">("RIGHT");

  const dashboard = useQuery({
    queryKey: ["points", tripId],
    queryFn: () => apiRequest<PointsDashboard>(`trips/${tripId}/points`),
  });
  const penaltyMatches = useQuery({
    queryKey: ["penalty-matches", tripId],
    queryFn: () => apiRequest<PenaltyMatch[]>(`trips/${tripId}/games/penalty-matches`),
  });

  useEffect(() => {
    if (tapSeconds <= 0) return;
    const timer = window.setTimeout(() => setTapSeconds((value) => value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [tapSeconds]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["points", tripId] });
    void queryClient.invalidateQueries({ queryKey: ["penalty-matches", tripId] });
  };

  const checkIn = useMutation({
    mutationFn: () =>
      apiRequest<{ awarded: number; alreadyCheckedIn: boolean }>(
        `trips/${tripId}/points/check-in`,
        { method: "POST" },
      ),
    onSuccess: refresh,
  });
  const redeem = useMutation({
    mutationFn: (reward: RewardItem) =>
      apiRequest(`trips/${tripId}/rewards/${reward.id}/redeem`, {
        method: "POST",
        body: JSON.stringify({
          ...(reward.type === "TARGET_PENALTY" ||
          (typeof reward.effect === "object" &&
            reward.effect !== null &&
            "targetRequired" in reward.effect)
            ? { targetUserId }
            : {}),
        }),
      }),
    onSuccess: refresh,
  });
  const play = useMutation({
    mutationFn: ({ path, body }: { path: string; body: Record<string, unknown> }) =>
      apiRequest<GameRound>(`trips/${tripId}/games/${path}`, {
        method: "POST",
        body: JSON.stringify({ ...body, clientRoundId: crypto.randomUUID() }),
      }),
    onSuccess: (result) => {
      setLastResult(result);
      refresh();
    },
  });
  const createPenalty = useMutation({
    mutationFn: () =>
      apiRequest(`trips/${tripId}/games/penalty-matches`, {
        method: "POST",
        body: JSON.stringify({
          action: penaltyAction,
          direction: penaltyDirection,
          wager,
        }),
      }),
    onSuccess: refresh,
  });
  const joinPenalty = useMutation({
    mutationFn: ({
      match,
      selectedDirection,
    }: {
      match: PenaltyMatch;
      selectedDirection: "LEFT" | "CENTER" | "RIGHT";
    }) =>
      apiRequest(`games/penalty-matches/${match.id}/join`, {
        method: "POST",
        body: JSON.stringify({
          action: match.requiredAction,
          direction: selectedDirection,
        }),
      }),
    onSuccess: refresh,
  });
  const cancelPenalty = useMutation({
    mutationFn: (matchId: string) =>
      apiRequest(`games/penalty-matches/${matchId}/cancel`, { method: "POST" }),
    onSuccess: refresh,
  });

  if (dashboard.isPending) {
    return (
      <WorkspaceShell
        eyebrow="포인트 아케이드"
        title="여행 활동을 게임 포인트로"
        description="포인트 정보를 불러오는 중입니다."
      >
        <Spinner label="포인트 불러오는 중" />
      </WorkspaceShell>
    );
  }
  if (!dashboard.data) {
    return (
      <WorkspaceShell
        eyebrow="포인트 아케이드"
        title="포인트를 열 수 없습니다"
        description={dashboard.error?.message ?? "잠시 후 다시 시도해 주세요."}
      >
        <Button onClick={() => void dashboard.refetch()}>다시 시도</Button>
      </WorkspaceShell>
    );
  }

  const data = dashboard.data;
  const error =
    checkIn.error ??
    redeem.error ??
    play.error ??
    createPenalty.error ??
    joinPenalty.error ??
    cancelPenalty.error;

  return (
    <WorkspaceShell
      eyebrow="포인트 아케이드"
      title="놀수록 쌓이고, 모이면 권력이 된다"
      description="여행 활동과 미니게임으로 포인트를 모아 현장에서 쓸 권한과 벌칙 아이템을 교환하세요."
      actions={
        <Button onClick={() => checkIn.mutate()} disabled={checkIn.isPending}>
          <CalendarCheck size={18} />
          오늘 출석 +20P
        </Button>
      }
    >
      <p className="arcade-notice">{data.rules.notice}</p>
      {error && <div className="form-error">{error.message}</div>}

      <section className="points-hero-grid">
        <Card className="points-balance-card">
          <Coins />
          <span>내 보유 포인트</span>
          <strong>{point(data.myWallet.balance)}</strong>
          <small>
            누적 {point(data.myWallet.earnedTotal)} · 연속 출석 {data.myWallet.checkInStreak}일
          </small>
        </Card>
        <Card className="checkin-card">
          <BadgeCheck />
          <div>
            <strong>
              {checkIn.data?.alreadyCheckedIn
                ? "오늘 출석 완료"
                : checkIn.data
                  ? `출석 보상 ${point(checkIn.data.awarded)}`
                  : "매일 출석 보상"}
            </strong>
            <span>3일 연속 +10P · 7일 연속 +30P · 여행 당일 +50P</span>
          </div>
        </Card>
      </section>

      <section className="leaderboard-layout">
        <Card className="leaderboard-card">
          <div className="section-heading-row">
            <h2>
              <Trophy size={19} /> 보유 포인트 순위
            </h2>
            <small>지금 바로 쓸 수 있는 잔액</small>
          </div>
          <ol>
            {data.balanceLeaderboard.map((wallet, index) => (
              <li key={wallet.userId}>
                <i>{index + 1}</i>
                <strong>{wallet.user.nickname}</strong>
                <span>{point(wallet.balance)}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="leaderboard-card">
          <div className="section-heading-row">
            <h2>
              <Medal size={19} /> 누적 활동 순위
            </h2>
            <small>써도 내려가지 않는 활동량</small>
          </div>
          <ol>
            {data.activityLeaderboard.map((wallet, index) => (
              <li key={wallet.userId}>
                <i>{index + 1}</i>
                <strong>{wallet.user.nickname}</strong>
                <span>{point(wallet.earnedTotal)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="workspace-section">
        <div className="section-heading-row">
          <h2>활동 보상표</h2>
          <small>같은 활동을 취소했다 다시 해도 중복 지급되지 않습니다.</small>
        </div>
        <div className="activity-rule-grid">
          {data.rules.activityRules.map((rule) => (
            <Card key={rule.key}>
              <span>{rule.label}</span>
              <strong>+{rule.points}P</strong>
              {rule.note && <small>{rule.note}</small>}
            </Card>
          ))}
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading-row">
          <h2>포인트 상점</h2>
          <select
            className="input target-select"
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
            aria-label="아이템 대상"
          >
            <option value="">지목할 친구 선택</option>
            {data.balanceLeaderboard
              .filter((wallet) => wallet.userId !== currentUser?.id)
              .map((wallet) => (
                <option key={wallet.userId} value={wallet.userId}>
                  {wallet.user.nickname}
                </option>
              ))}
          </select>
        </div>
        <div className="reward-grid">
          {data.rewards.map((reward) => (
            <Card className="reward-card" key={reward.id}>
              {reward.type === "TARGET_PENALTY" ? (
                <Target />
              ) : reward.type === "PROTECTION" ? (
                <Shield />
              ) : (
                <Gift />
              )}
              <span className="badge">
                {reward.type === "TARGET_PENALTY" ? "공격 아이템" : "현장 권한"}
              </span>
              <h3>{reward.title}</h3>
              <p>{reward.description}</p>
              <div>
                <strong>{point(reward.cost)}</strong>
                <Button
                  disabled={
                    data.myWallet.balance < reward.cost ||
                    (reward.type === "TARGET_PENALTY" && !targetUserId)
                  }
                  onClick={() => redeem.mutate(reward)}
                >
                  사용
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading-row">
          <h2>포인트 미니게임</h2>
          <label className="wager-field">
            판돈
            <input
              className="input"
              type="number"
              min="10"
              max="500"
              step="10"
              value={wager}
              onChange={(event) => setWager(Number(event.target.value))}
            />
          </label>
        </div>
        {lastResult && (
          <Card className="arcade-result arcade-result--spin">
            <Sparkles />
            <div>
              <span>{gameName(lastResult.gameType)} 결과</span>
              <strong>{describeResult(lastResult)}</strong>
            </div>
            <b className={lastResult.pointDelta >= 0 ? "point-positive" : "point-negative"}>
              {lastResult.pointDelta >= 0 ? "+" : ""}
              {point(lastResult.pointDelta)}
            </b>
          </Card>
        )}
        <div className="game-grid">
          <Card className="game-card">
            <MousePointerClick />
            <h3>10초 탭 대결</h3>
            <p>하루 3판까지 점수에 따라 포인트가 쌓입니다.</p>
            <div className="tap-score">
              <strong>{tapScore}</strong>
              <span>{tapSeconds > 0 ? `${tapSeconds}초` : "대기"}</span>
            </div>
            {tapSeconds === 0 && tapScore === 0 && (
              <Button onClick={() => setTapSeconds(10)}>측정 시작</Button>
            )}
            {tapSeconds > 0 && (
              <Button
                className="tap-button"
                onClick={() => setTapScore((value) => Math.min(300, value + 1))}
              >
                TAP!
              </Button>
            )}
            {tapSeconds === 0 && tapScore > 0 && (
              <Button
                onClick={() => {
                  play.mutate({ path: "tap-score", body: { score: tapScore } });
                  setTapScore(0);
                }}
              >
                점수 등록
              </Button>
            )}
          </Card>

          <Card className="game-card">
            <Dices />
            <h3>홀짝</h3>
            <p>1부터 100까지 서버가 뽑은 수의 홀짝을 맞히면 원금 포함 2배.</p>
            <div className="game-actions">
              <Button
                onClick={() => play.mutate({ path: "odd-even", body: { choice: "ODD", wager } })}
              >
                홀
              </Button>
              <Button
                variant="secondary"
                onClick={() => play.mutate({ path: "odd-even", body: { choice: "EVEN", wager } })}
              >
                짝
              </Button>
            </div>
          </Card>

          <Card className="game-card">
            <Rocket />
            <h3>달팽이 레이스</h3>
            <p>네 마리 중 우승 달팽이를 고르면 원금 포함 4배.</p>
            <div className="snail-actions">
              {[1, 2, 3, 4].map((snail) => (
                <button
                  type="button"
                  key={snail}
                  onClick={() => play.mutate({ path: "snail-race", body: { snail, wager } })}
                >
                  🐌 {snail}
                </button>
              ))}
            </div>
          </Card>

          <Card className="game-card">
            <Coins />
            <h3>짱깸보 배수 룰렛</h3>
            <p>이기면 배수 룰렛, 비기면 원금 반환, 지면 0배.</p>
            <select
              className="input"
              value={wager}
              onChange={(event) => setWager(Number(event.target.value))}
            >
              <option value="10">10P</option>
              <option value="50">50P</option>
              <option value="100">100P</option>
            </select>
            <div className="game-actions game-actions--three">
              {[
                ["SCISSORS", "가위"],
                ["ROCK", "바위"],
                ["PAPER", "보"],
              ].map(([choice, label]) => (
                <Button
                  variant="secondary"
                  key={choice}
                  onClick={() =>
                    play.mutate({
                      path: "rps-roulette",
                      body: { choice, wager: [10, 50, 100].includes(wager) ? wager : 50 },
                    })
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="odds-mini">
              {data.rules.games.rpsRoulette.multipliers.map((entry) => (
                <span key={entry.multiplier}>
                  ×{entry.multiplier} {entry.probability}
                </span>
              ))}
            </div>
          </Card>

          <Card className="game-card lottery-card">
            <Sparkles />
            <h3>초정밀 포인트 로또</h3>
            <p>1회 30P. 모든 등수와 극소 확률을 숨김없이 공개합니다.</p>
            <Button onClick={() => play.mutate({ path: "lottery", body: { count: 1 } })}>
              1회 뽑기
            </Button>
            <div className="lottery-odds">
              {data.rules.games.lottery.tiers.map((tier) => (
                <div key={tier.key}>
                  <strong>{tier.label}</strong>
                  <span>{tier.probability}</span>
                  <b>{point(tier.prize)}</b>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="workspace-section penalty-section">
        <div className="section-heading-row">
          <div>
            <h2>
              <Goal size={21} /> 비공개 승부차기 대기방
            </h2>
            <small>도전자의 방향은 상대가 참가할 때까지 숨겨집니다.</small>
          </div>
        </div>
        <Card className="penalty-create">
          <select
            className="input"
            value={penaltyAction}
            onChange={(event) => setPenaltyAction(event.target.value as "KICK" | "DIVE")}
          >
            <option value="KICK">공 차기</option>
            <option value="DIVE">골키퍼로 뛰기</option>
          </select>
          <select
            className="input"
            value={penaltyDirection}
            onChange={(event) =>
              setPenaltyDirection(event.target.value as "LEFT" | "CENTER" | "RIGHT")
            }
          >
            <option value="LEFT">왼쪽</option>
            <option value="CENTER">가운데</option>
            <option value="RIGHT">오른쪽</option>
          </select>
          <Button onClick={() => createPenalty.mutate()}>
            <Goal size={17} /> {point(wager)} 걸고 비공개 예약
          </Button>
        </Card>
        {penaltyMatches.isPending && <Spinner label="승부차기 경기 불러오는 중" />}
        <div className="penalty-list">
          {penaltyMatches.data?.map((match) => (
            <Card
              className={`penalty-match penalty-match--${match.status.toLowerCase()}`}
              key={match.id}
            >
              <div>
                <span className="badge">
                  {match.status === "OPEN"
                    ? "도전자 대기"
                    : match.status === "RESOLVED"
                      ? match.goal
                        ? "GOAL"
                        : "SAVE"
                      : "취소"}
                </span>
                <h3>
                  {match.creator.nickname}
                  {match.opponent ? ` vs ${match.opponent.nickname}` : "의 비공개 도전"}
                </h3>
                <p>판돈 각 {point(match.wager)}</p>
              </div>
              {match.status === "OPEN" && match.creator.id !== currentUser?.id && (
                <div className="penalty-join">
                  <span>{match.requiredAction === "KICK" ? "어디로 찰까?" : "어디로 뛸까?"}</span>
                  {(["LEFT", "CENTER", "RIGHT"] as const).map((side) => (
                    <Button
                      variant="secondary"
                      key={side}
                      onClick={() => joinPenalty.mutate({ match, selectedDirection: side })}
                    >
                      {direction(side)}
                    </Button>
                  ))}
                </div>
              )}
              {match.status === "OPEN" && match.creator.id === currentUser?.id && (
                <div className="secret-choice">
                  <span>내 비공개 선택</span>
                  <strong>
                    {match.creatorAction === "KICK" ? "차기" : "막기"} ·{" "}
                    {direction(match.creatorDirection)}
                  </strong>
                  <Button variant="ghost" onClick={() => cancelPenalty.mutate(match.id)}>
                    취소·환불
                  </Button>
                </div>
              )}
              {match.status === "RESOLVED" && (
                <div className="penalty-reveal">
                  <span>
                    도전자 {direction(match.creatorDirection)} · 상대{" "}
                    {direction(match.opponentDirection)}
                  </span>
                  <strong>
                    {match.winner?.nickname} 승리 · {point(match.wager * 2)}
                  </strong>
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section className="history-layout">
        <Card>
          <h2>공유 게임 결과</h2>
          <div className="history-list">
            {data.recentGames.map((round) => (
              <div key={round.id}>
                <span>
                  {round.user.nickname} · {gameName(round.gameType)}
                </span>
                <strong>{describeResult(round)}</strong>
                <b className={round.pointDelta >= 0 ? "point-positive" : "point-negative"}>
                  {round.pointDelta >= 0 ? "+" : ""}
                  {point(round.pointDelta)}
                </b>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2>아이템 사용 기록</h2>
          <div className="history-list">
            {data.recentRedemptions.map((redemption) => (
              <div key={redemption.id}>
                <span>{redemption.buyer.nickname}</span>
                <strong>{redemption.rewardItem.title}</strong>
                <b>{redemption.target?.nickname ?? time(redemption.createdAt)}</b>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </WorkspaceShell>
  );
}
