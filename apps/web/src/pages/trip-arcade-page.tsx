import {
  ArrowLeft,
  CircleDollarSign,
  Dices,
  Hand,
  LockKeyhole,
  Play,
  RotateCw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Button, Card, Spinner } from "@campflow/ui";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";
import {
  direction,
  gameName,
  point,
  type GameRound,
  type PenaltyMatch,
  type PointsDashboard,
} from "./points-shared";
import { WorkspaceShell } from "./trip-workspace-pages";

const arcadeGames = [
  { id: "tap", label: "10초 탭", emoji: "👆" },
  { id: "odd-even", label: "홀짝 사다리", emoji: "🪜" },
  { id: "snail-race", label: "달팽이", emoji: "🐌" },
  { id: "rps-roulette", label: "짱깸보", emoji: "✊" },
  { id: "lottery", label: "로또", emoji: "🎟️" },
  { id: "penalty-kick", label: "승부차기", emoji: "⚽" },
] as const;

type ArcadeGameId = (typeof arcadeGames)[number]["id"];
type Direction = "LEFT" | "CENTER" | "RIGHT";
type RpsChoice = "ROCK" | "PAPER" | "SCISSORS";
type LadderSide = "LEFT" | "RIGHT";

const LADDER_LEFT_X = 76;
const LADDER_RIGHT_X = 224;

function makeLadderPath(rungYs: number[], startSide: LadderSide): string {
  let currentX = startSide === "LEFT" ? LADDER_LEFT_X : LADDER_RIGHT_X;
  const segments = [`M ${currentX} 28`];
  for (const y of rungYs) {
    const nextX = currentX === LADDER_LEFT_X ? LADDER_RIGHT_X : LADDER_LEFT_X;
    segments.push(`L ${currentX} ${y}`, `L ${nextX} ${y}`);
    currentX = nextX;
  }
  segments.push(`L ${currentX} 332`);
  return segments.join(" ");
}

const gameHeadings: Record<ArcadeGameId, { title: string; description: string }> = {
  tap: {
    title: "10초 탭 챌린지",
    description: "10초 동안 직접 버튼을 두드려 기록을 만들고 하루 세 번 포인트를 받습니다.",
  },
  "odd-even": {
    title: "비공개 홀짝 사다리",
    description:
      "출발 좌·우, 가로줄 3·4개, 도착 홀·짝을 하나씩 또는 조합으로 고르세요. 숨겨진 사다리가 공개되면 실제 경로를 따라 내려갑니다.",
  },
  "snail-race": {
    title: "달팽이 네 마리 레이스",
    description: "달팽이를 선택하면 네 마리가 트랙을 달리고 우승 결과가 공개됩니다.",
  },
  "rps-roulette": {
    title: "짱깸보 배수 룰렛",
    description: "가위바위보 대결을 먼저 보여주고, 승리하면 배수 룰렛이 회전합니다.",
  },
  lottery: {
    title: "초정밀 포인트 로또",
    description: "추첨기가 충분히 섞인 뒤 티켓이 뒤집히며 등수와 당첨 포인트를 보여줍니다.",
  },
  "penalty-kick": {
    title: "비공개 승부차기 경기장",
    description:
      "예약한 방향은 숨겨지고, 상대 참가 후 킥과 다이빙 애니메이션으로 결과를 확인합니다.",
  },
};

const rpsSymbol: Record<RpsChoice, string> = {
  ROCK: "✊",
  PAPER: "🖐️",
  SCISSORS: "✌️",
};

function numberResult(result: Record<string, unknown>, key: string, fallback = 0): number {
  return typeof result[key] === "number" ? result[key] : fallback;
}

function stringResult(result: Record<string, unknown>, key: string): string {
  return typeof result[key] === "string" ? result[key] : "";
}

function ResultBanner({ round }: { round: GameRound }) {
  const won = round.pointDelta > 0;
  const resultLabel =
    round.gameType === "TAP"
      ? round.pointDelta > 0
        ? "보상 획득"
        : "오늘 보상 소진"
      : round.pointDelta > 0
        ? "승리"
        : round.pointDelta < 0
          ? "아쉽게 실패"
          : "무승부";
  return (
    <div className={`game-result-reveal ${won ? "is-win" : round.pointDelta < 0 ? "is-loss" : ""}`}>
      <Sparkles aria-hidden="true" />
      <div>
        <span>{gameName(round.gameType)} 최종 결과</span>
        <strong>{resultLabel}</strong>
      </div>
      <b>
        {round.pointDelta >= 0 ? "+" : ""}
        {point(round.pointDelta)}
      </b>
    </div>
  );
}

export function TripArcadePage() {
  const { tripId = "", gameId = "" } = useParams();
  const selectedGame = arcadeGames.find((game) => game.id === gameId);
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const revealTimer = useRef<number | undefined>(undefined);
  const tapMachineRef = useRef<HTMLElement | null>(null);
  const tapRoundIdRef = useRef("");
  const tapSubmitLockedRef = useRef(false);
  const [wager, setWager] = useState(10);
  const [stage, setStage] = useState<"idle" | "running" | "result">("idle");
  const [animationResult, setAnimationResult] = useState<GameRound | null>(null);
  const [revealedResult, setRevealedResult] = useState<GameRound | null>(null);
  const [ladderStartChoice, setLadderStartChoice] = useState<LadderSide | null>(null);
  const [oddChoice, setOddChoice] = useState<"ODD" | "EVEN" | null>(null);
  const [ladderRungChoice, setLadderRungChoice] = useState<3 | 4 | null>(null);
  const [snailChoice, setSnailChoice] = useState(1);
  const [rpsChoice, setRpsChoice] = useState<RpsChoice>("ROCK");
  const [tapSeconds, setTapSeconds] = useState(10);
  const [tapScore, setTapScore] = useState(0);
  const [tapActive, setTapActive] = useState(false);
  const [penaltyAction, setPenaltyAction] = useState<"KICK" | "DIVE">("KICK");
  const [penaltyDirection, setPenaltyDirection] = useState<Direction>("RIGHT");
  const [penaltyVisual, setPenaltyVisual] = useState<PenaltyMatch | null>(null);
  const [penaltyMessage, setPenaltyMessage] = useState("");

  const dashboard = useQuery({
    queryKey: ["points", tripId],
    queryFn: () => apiRequest<PointsDashboard>(`trips/${tripId}/points`),
  });
  const penaltyMatches = useQuery({
    queryKey: ["penalty-matches", tripId],
    queryFn: () => apiRequest<PenaltyMatch[]>(`trips/${tripId}/games/penalty-matches`),
    enabled: gameId === "penalty-kick",
    refetchInterval: gameId === "penalty-kick" ? 10_000 : false,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["points", tripId] });
    void queryClient.invalidateQueries({ queryKey: ["penalty-matches", tripId] });
  };

  const play = useMutation({
    mutationFn: async ({
      path,
      body,
      duration,
      clientRoundId,
    }: {
      path: string;
      body: Record<string, unknown>;
      duration: number;
      clientRoundId?: string;
    }) => ({
      round: await apiRequest<GameRound>(`trips/${tripId}/games/${path}`, {
        method: "POST",
        body: JSON.stringify({ ...body, clientRoundId: clientRoundId ?? crypto.randomUUID() }),
      }),
      duration,
    }),
    onMutate: () => {
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      setAnimationResult(null);
      setRevealedResult(null);
      setStage("running");
    },
    onSuccess: ({ round, duration }) => {
      setAnimationResult(round);
      revealTimer.current = window.setTimeout(() => {
        setRevealedResult(round);
        setStage("result");
        refresh();
      }, duration);
    },
    onError: (_error, variables) => {
      if (variables.path === "tap-score") tapSubmitLockedRef.current = false;
      setStage("idle");
    },
  });

  const createPenalty = useMutation({
    mutationFn: () =>
      apiRequest<PenaltyMatch>(`trips/${tripId}/games/penalty-matches`, {
        method: "POST",
        body: JSON.stringify({
          action: penaltyAction,
          direction: penaltyDirection,
          wager,
        }),
      }),
    onMutate: () => {
      setPenaltyMessage("선택한 방향을 비밀 금고에 잠그는 중…");
      setStage("running");
    },
    onSuccess: () => {
      window.setTimeout(() => {
        setPenaltyMessage("비공개 예약 완료! 다른 친구에게는 방향이 보이지 않습니다.");
        setStage("result");
        refresh();
      }, 1_600);
    },
    onError: () => setStage("idle"),
  });
  const joinPenalty = useMutation({
    mutationFn: ({
      match,
      selectedDirection,
    }: {
      match: PenaltyMatch;
      selectedDirection: Direction;
    }) =>
      apiRequest<PenaltyMatch>(`games/penalty-matches/${match.id}/join`, {
        method: "POST",
        body: JSON.stringify({
          action: match.requiredAction,
          direction: selectedDirection,
        }),
      }),
    onMutate: () => {
      setPenaltyMessage("두 선택을 확인하고 경기장으로 이동 중…");
      setPenaltyVisual(null);
      setStage("running");
    },
    onSuccess: (match) => {
      setPenaltyVisual(match);
      window.setTimeout(() => {
        setPenaltyMessage(
          `${match.goal ? "GOAL" : "SAVE"} · ${match.winner?.nickname ?? "승자"} 승리`,
        );
        setStage("result");
        refresh();
      }, 3_600);
    },
    onError: () => setStage("idle"),
  });
  const cancelPenalty = useMutation({
    mutationFn: (matchId: string) =>
      apiRequest(`games/penalty-matches/${matchId}/cancel`, { method: "POST" }),
    onSuccess: refresh,
  });

  const submitTapRound = () => {
    if (tapSubmitLockedRef.current || tapScore < 1) return;
    tapSubmitLockedRef.current = true;
    play.mutate({
      path: "tap-score",
      body: { score: tapScore },
      duration: 250,
      clientRoundId: tapRoundIdRef.current,
    });
  };

  useEffect(
    () => () => {
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!tapActive) return;
    const timer = window.setInterval(() => {
      setTapSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          setTapActive(false);
          setStage("idle");
          return 0;
        }
        return seconds - 1;
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [tapActive]);

  useEffect(() => {
    const machine = tapMachineRef.current;
    if (!tapActive || !machine) return;
    const preventGameScroll = (event: TouchEvent) => event.preventDefault();
    machine.addEventListener("touchmove", preventGameScroll, { passive: false });
    return () => machine.removeEventListener("touchmove", preventGameScroll);
  }, [tapActive]);

  useEffect(() => {
    if (tapActive || tapSeconds !== 0 || tapScore < 1 || tapSubmitLockedRef.current) return;
    submitTapRound();
  }, [tapActive, tapScore, tapSeconds]);

  if (!selectedGame) {
    return <Navigate to={`/trips/${tripId}/points`} replace />;
  }

  if (dashboard.isPending) {
    return (
      <WorkspaceShell
        eyebrow="게임장"
        title="경기장을 준비하는 중"
        description="내 포인트와 게임 규칙을 불러오고 있습니다."
      >
        <Spinner label="게임장 준비 중" />
      </WorkspaceShell>
    );
  }
  if (!dashboard.data) {
    return (
      <WorkspaceShell
        eyebrow="게임장"
        title="게임장을 열 수 없습니다"
        description={dashboard.error?.message ?? "잠시 후 다시 시도해 주세요."}
      >
        <Button onClick={() => void dashboard.refetch()}>다시 시도</Button>
      </WorkspaceShell>
    );
  }

  const data = dashboard.data;
  const heading = gameHeadings[selectedGame.id];
  const busy = stage === "running" || play.isPending;
  const canWager = data.myWallet.balance >= wager;
  const error =
    play.error ??
    createPenalty.error ??
    joinPenalty.error ??
    cancelPenalty.error ??
    penaltyMatches.error;

  const startTap = () => {
    play.reset();
    setTapScore(0);
    setTapSeconds(10);
    setRevealedResult(null);
    setAnimationResult(null);
    tapRoundIdRef.current = crypto.randomUUID();
    tapSubmitLockedRef.current = false;
    setStage("running");
    setTapActive(true);
  };
  const resetRound = () => {
    setStage("idle");
    setAnimationResult(null);
    setRevealedResult(null);
    tapSubmitLockedRef.current = false;
  };

  const ladderRungCount = numberResult(
    animationResult?.result ?? {},
    "rungCount",
    ladderRungChoice ?? 3,
  );
  const rawRungYs = Array.isArray(animationResult?.result.rungYs)
    ? animationResult.result.rungYs
    : [];
  const ladderRungYs = rawRungYs.filter((value): value is number => typeof value === "number");
  const fallbackRungYs = ladderRungCount === 4 ? [76, 146, 216, 286] : [102, 182, 262];
  const visibleRungYs = ladderRungYs.length > 0 ? ladderRungYs : fallbackRungYs;
  const ladderStartSide = (stringResult(animationResult?.result ?? {}, "startSide") ||
    "LEFT") as LadderSide;
  const ladderPath = makeLadderPath(visibleRungYs, ladderStartSide);
  const ladderRungsPath = visibleRungYs
    .map((y) => `M ${LADDER_LEFT_X} ${y} H ${LADDER_RIGHT_X}`)
    .join(" ");
  const ladderSelectedCount = [ladderStartChoice, ladderRungChoice, oddChoice].filter(
    (choice) => choice !== null,
  ).length;
  const expectedEndChoice =
    ladderStartChoice && ladderRungChoice
      ? (ladderRungChoice % 2 === 0
          ? ladderStartChoice
          : ladderStartChoice === "LEFT"
            ? "RIGHT"
            : "LEFT") === "LEFT"
        ? "ODD"
        : "EVEN"
      : null;
  const ladderCombinationValid = !(
    ladderSelectedCount === 3 &&
    expectedEndChoice &&
    oddChoice !== expectedEndChoice
  );
  const ladderPayoutMultiplier = [0, 1.9, 3.6, 3.8][ladderSelectedCount] ?? 0;
  const ladderWinProbability = ladderSelectedCount === 1 ? "50%" : "25%";
  const ladderSelectionLabel = [
    ladderStartChoice === "LEFT" ? "좌" : ladderStartChoice === "RIGHT" ? "우" : "",
    ladderRungChoice ? `${ladderRungChoice}줄` : "",
    oddChoice === "ODD" ? "홀" : oddChoice === "EVEN" ? "짝" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const ladderAnswer = stringResult(animationResult?.result ?? {}, "answer");
  const ladderActualPattern = animationResult
    ? `${ladderStartSide === "LEFT" ? "좌" : "우"}${ladderRungCount}${ladderAnswer === "ODD" ? "홀" : "짝"}`
    : "";

  const snailProgress = Array.isArray(animationResult?.result.progress)
    ? animationResult.result.progress
    : [];
  const rpsMachine = stringResult(animationResult?.result ?? {}, "machine") as RpsChoice;
  const rpsMultiplier = numberResult(animationResult?.result ?? {}, "multiplier", 1);
  const rpsOutcome = stringResult(animationResult?.result ?? {}, "outcome");
  const lotteryDraw =
    Array.isArray(animationResult?.result.draws) &&
    typeof animationResult.result.draws[0] === "object" &&
    animationResult.result.draws[0]
      ? (animationResult.result.draws[0] as Record<string, unknown>)
      : null;

  return (
    <WorkspaceShell
      eyebrow="포인트 게임장"
      title={heading.title}
      description={heading.description}
      actions={
        <div className="arcade-balance-chip">
          <CircleDollarSign size={18} />
          <span>내 포인트</span>
          <strong>{point(data.myWallet.balance)}</strong>
        </div>
      }
    >
      <div className="arcade-screen-nav" aria-label="게임 종목 선택">
        <Link to={`/trips/${tripId}/points`}>
          <ArrowLeft size={16} /> 포인트 홈
        </Link>
        {arcadeGames.map((game) => (
          <Link
            className={game.id === selectedGame.id ? "active" : ""}
            key={game.id}
            to={`/trips/${tripId}/games/${game.id}`}
          >
            <span aria-hidden="true">{game.emoji}</span>
            {game.label}
          </Link>
        ))}
      </div>

      {error && <div className="form-error">{error.message}</div>}

      {selectedGame.id !== "tap" &&
        selectedGame.id !== "lottery" &&
        selectedGame.id !== "rps-roulette" &&
        selectedGame.id !== "penalty-kick" && (
          <Card className="arcade-control-bar">
            <label>
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
            <span>현재 잔액 {point(data.myWallet.balance)}</span>
            {!canWager && <strong>포인트가 부족합니다. 출석이나 10초 탭부터 해보세요.</strong>}
          </Card>
        )}

      {selectedGame.id === "tap" && (
        <section
          ref={tapMachineRef}
          className={`arcade-machine tap-machine ${tapActive ? "is-running" : ""}`}
        >
          <div className="tap-timer-ring" style={{ "--tap-progress": tapSeconds } as CSSProperties}>
            <strong>{tapSeconds}</strong>
            <span>SECONDS</span>
          </div>
          <div className="tap-live-score">
            <span>현재 기록</span>
            <strong>{tapScore}</strong>
            <small>
              오늘 보상 {data.tapRewardStatus.rewardedToday}/3회 · 남은{" "}
              {data.tapRewardStatus.remainingToday}회
            </small>
          </div>
          {!tapActive && tapSeconds === 10 && (
            <Button onClick={startTap}>
              <Play size={18} /> 10초 측정 시작
            </Button>
          )}
          {tapActive && (
            <button
              className="tap-stage-button"
              type="button"
              aria-label="탭 횟수 올리기"
              onPointerDown={(event) => {
                if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0))
                  return;
                event.preventDefault();
                setTapScore((score) => Math.min(300, score + 1));
              }}
              onClick={(event) => {
                if (event.detail === 0) setTapScore((score) => Math.min(300, score + 1));
              }}
            >
              TAP!
              <i aria-hidden="true" />
            </button>
          )}
          {!tapActive &&
            tapSeconds === 0 &&
            !revealedResult &&
            (play.isError ? (
              <Button disabled={play.isPending} onClick={submitTapRound}>
                <Trophy size={18} /> {tapScore}회 기록 저장 다시 시도
              </Button>
            ) : (
              <p className="machine-status tap-submit-status">
                <Trophy size={18} /> {tapScore}회 기록을 자동 저장하는 중…
              </p>
            ))}
          {revealedResult && (
            <>
              <ResultBanner round={revealedResult} />
              <Button
                variant="secondary"
                onClick={() => {
                  resetRound();
                  setTapSeconds(10);
                  setTapScore(0);
                }}
              >
                다시 도전
              </Button>
            </>
          )}
        </section>
      )}

      {selectedGame.id === "odd-even" && (
        <section className="arcade-machine ladder-machine">
          <div className="ladder-picks">
            <div>
              <span>출발점</span>
              <div className="machine-choice-row">
                <button
                  className={ladderStartChoice === "LEFT" ? "active" : ""}
                  type="button"
                  aria-pressed={ladderStartChoice === "LEFT"}
                  onClick={() =>
                    setLadderStartChoice((choice) => (choice === "LEFT" ? null : "LEFT"))
                  }
                  disabled={busy}
                >
                  좌 LEFT
                </button>
                <button
                  className={ladderStartChoice === "RIGHT" ? "active" : ""}
                  type="button"
                  aria-pressed={ladderStartChoice === "RIGHT"}
                  onClick={() =>
                    setLadderStartChoice((choice) => (choice === "RIGHT" ? null : "RIGHT"))
                  }
                  disabled={busy}
                >
                  우 RIGHT
                </button>
              </div>
            </div>
            <div>
              <span>가로줄 수</span>
              <div className="machine-choice-row">
                {([3, 4] as const).map((count) => (
                  <button
                    className={ladderRungChoice === count ? "active" : ""}
                    type="button"
                    key={count}
                    aria-pressed={ladderRungChoice === count}
                    onClick={() =>
                      setLadderRungChoice((choice) => (choice === count ? null : count))
                    }
                    disabled={busy}
                  >
                    {count}줄
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span>도착 결과</span>
              <div className="machine-choice-row">
                <button
                  className={oddChoice === "ODD" ? "active" : ""}
                  type="button"
                  aria-pressed={oddChoice === "ODD"}
                  onClick={() => setOddChoice((choice) => (choice === "ODD" ? null : "ODD"))}
                  disabled={busy}
                >
                  홀 ODD
                </button>
                <button
                  className={oddChoice === "EVEN" ? "active" : ""}
                  type="button"
                  aria-pressed={oddChoice === "EVEN"}
                  onClick={() => setOddChoice((choice) => (choice === "EVEN" ? null : "EVEN"))}
                  disabled={busy}
                >
                  짝 EVEN
                </button>
              </div>
            </div>
          </div>
          <div className={`ladder-bet-summary ${!ladderCombinationValid ? "is-invalid" : ""}`}>
            {ladderSelectedCount === 0 ? (
              <span>원하는 항목을 하나 이상 선택하세요.</span>
            ) : ladderCombinationValid ? (
              <>
                <span>내 선택 · {ladderSelectionLabel}</span>
                <strong>×{ladderPayoutMultiplier.toFixed(1)}</strong>
                <b>
                  적중 확률 {ladderWinProbability} · 순이익{" "}
                  {point(Math.floor(wager * ladderPayoutMultiplier))} + 판돈 반환
                </b>
              </>
            ) : (
              <span>이 조합은 실제 사다리로 이어지지 않습니다. 홀·짝 선택을 바꿔 주세요.</span>
            )}
          </div>
          <div className="ladder-pattern-guide" aria-label="가능한 전체 사다리 패턴">
            <span>가능 패턴</span>
            {[
              ["좌4홀", "왼쪽 출발 · 4줄 · 홀 도착"],
              ["우3홀", "오른쪽 출발 · 3줄 · 홀 도착"],
              ["좌3짝", "왼쪽 출발 · 3줄 · 짝 도착"],
              ["우4짝", "오른쪽 출발 · 4줄 · 짝 도착"],
            ].map(([pattern, label]) => (
              <b key={pattern} title={label}>
                {pattern}
              </b>
            ))}
          </div>
          <div className={`ladder-board ${busy ? "is-running" : ""}`}>
            <div className="ladder-labels ladder-labels--top">
              <span className={animationResult && ladderStartSide === "LEFT" ? "is-start" : ""}>
                좌 LEFT {animationResult && ladderStartSide === "LEFT" ? "●" : ""}
              </span>
              <span className={animationResult && ladderStartSide === "RIGHT" ? "is-start" : ""}>
                우 RIGHT {animationResult && ladderStartSide === "RIGHT" ? "●" : ""}
              </span>
            </div>
            <svg viewBox="0 0 300 360" role="img" aria-label="홀짝 사다리 진행 화면">
              <path d="M76 28 V332 M224 28 V332" className="ladder-rail" />
              {!animationResult && (
                <g className="ladder-secret" aria-hidden="true">
                  <rect x="89" y="48" width="122" height="264" rx="18" />
                  <text x="150" y="174">
                    ?
                  </text>
                  <text x="150" y="205" className="ladder-secret-label">
                    가로줄 비공개
                  </text>
                </g>
              )}
              {animationResult && (
                <g key={animationResult.id}>
                  <path d={ladderRungsPath} className="ladder-rungs ladder-rungs--revealed" />
                  <path d={ladderPath} className="ladder-route" pathLength="1" />
                  <circle key={animationResult.id} r="10" className="ladder-ball">
                    <animateMotion begin="0.7s" dur="3.8s" fill="freeze" path={ladderPath} />
                  </circle>
                </g>
              )}
            </svg>
            <div className="ladder-labels">
              <span className={animationResult && ladderAnswer === "ODD" ? "is-result" : ""}>
                홀 ODD {animationResult && ladderAnswer === "ODD" ? "●" : ""}
              </span>
              <span className={animationResult && ladderAnswer === "EVEN" ? "is-result" : ""}>
                짝 EVEN {animationResult && ladderAnswer === "EVEN" ? "●" : ""}
              </span>
            </div>
          </div>
          {stage === "idle" && (
            <Button
              disabled={!canWager || ladderSelectedCount === 0 || !ladderCombinationValid}
              onClick={() =>
                play.mutate({
                  path: "odd-even",
                  body: {
                    ...(ladderStartChoice ? { startChoice: ladderStartChoice } : {}),
                    ...(ladderRungChoice ? { rungCountChoice: ladderRungChoice } : {}),
                    ...(oddChoice ? { endChoice: oddChoice } : {}),
                    wager,
                  },
                  duration: 4_900,
                })
              }
            >
              <Dices size={18} /> {point(wager)} · {ladderSelectionLabel || "선택 필요"} 배팅
            </Button>
          )}
          {busy && (
            <p className="machine-status">
              <RotateCw size={17} />
              {animationResult ? " 숨은 사다리를 따라 내려가는 중…" : " 사다리를 비공개로 섞는 중…"}
            </p>
          )}
          {revealedResult && (
            <>
              <div className="number-reveal">
                <div>
                  <span>최종 사다리 패턴</span>
                  <strong>{ladderActualPattern}</strong>
                  <b>실제 경로 일치</b>
                </div>
                <div>
                  <span>내 선택</span>
                  <strong>{ladderSelectionLabel}</strong>
                  <b>
                    순이익 ×{numberResult(revealedResult.result, "payoutMultiplier").toFixed(1)}
                  </b>
                </div>
              </div>
              <ResultBanner round={revealedResult} />
              <Button variant="secondary" onClick={resetRound}>
                다시 하기
              </Button>
            </>
          )}
        </section>
      )}

      {selectedGame.id === "snail-race" && (
        <section className="arcade-machine snail-machine">
          <div className="snail-selector">
            {[1, 2, 3, 4].map((snail) => (
              <button
                className={snailChoice === snail ? "active" : ""}
                type="button"
                key={snail}
                onClick={() => setSnailChoice(snail)}
                disabled={busy}
              >
                🐌 {snail}번
              </button>
            ))}
          </div>
          <div className="snail-track">
            {[1, 2, 3, 4].map((snail, index) => {
              const progress = snailProgress.find(
                (entry) =>
                  typeof entry === "object" &&
                  entry !== null &&
                  "snail" in entry &&
                  entry.snail === snail,
              ) as { distance?: number } | undefined;
              const distance = progress?.distance ?? (busy ? 18 + index * 3 : 3);
              return (
                <div className="snail-lane" key={snail}>
                  <b>{snail}</b>
                  <span
                    className={busy && animationResult ? "is-racing" : ""}
                    style={
                      {
                        "--snail-distance": `${distance}%`,
                        "--snail-delay": `${index * 0.11}s`,
                      } as CSSProperties
                    }
                  >
                    🐌
                  </span>
                  <i>FINISH</i>
                </div>
              );
            })}
          </div>
          {stage === "idle" && (
            <Button
              disabled={!canWager}
              onClick={() =>
                play.mutate({
                  path: "snail-race",
                  body: { snail: snailChoice, wager },
                  duration: 4_800,
                })
              }
            >
              <Play size={18} /> {snailChoice}번 달팽이에 {point(wager)}
            </Button>
          )}
          {busy && <p className="machine-status">🐌 결승선을 향해 달리는 중…</p>}
          {revealedResult && (
            <>
              <div className="race-winner">
                🏁 {numberResult(revealedResult.result, "winner")}번 달팽이 우승!
              </div>
              <ResultBanner round={revealedResult} />
              <Button variant="secondary" onClick={resetRound}>
                다시 경기
              </Button>
            </>
          )}
        </section>
      )}

      {selectedGame.id === "rps-roulette" && (
        <section className="arcade-machine rps-machine">
          <div className="rps-wager">
            {[10, 50, 100].map((amount) => (
              <button
                className={wager === amount ? "active" : ""}
                type="button"
                key={amount}
                onClick={() => setWager(amount)}
                disabled={busy}
              >
                {point(amount)}
              </button>
            ))}
          </div>
          <div className="odds-mini" aria-label="짱깸보 결과 확률">
            {data.rules.games.rpsRoulette.outcomes.map((outcome) => (
              <span key={outcome.outcome}>
                {{ WIN: "승", DRAW: "무", LOSS: "패" }[outcome.outcome]} {outcome.probability}
              </span>
            ))}
          </div>
          <div className="rps-arena">
            <div className={busy ? "rps-hand is-shaking" : "rps-hand"}>
              <span>나</span>
              <strong>{rpsSymbol[rpsChoice]}</strong>
            </div>
            <b>VS</b>
            <div className={busy ? "rps-hand rps-hand--machine is-shaking" : "rps-hand"}>
              <span>머신</span>
              <strong>{animationResult ? rpsSymbol[rpsMachine] : "❔"}</strong>
            </div>
          </div>
          <div className="rps-selector">
            {(Object.keys(rpsSymbol) as RpsChoice[]).map((choice) => (
              <button
                className={rpsChoice === choice ? "active" : ""}
                type="button"
                key={choice}
                onClick={() => setRpsChoice(choice)}
                disabled={busy}
              >
                {rpsSymbol[choice]}
              </button>
            ))}
          </div>
          <div className="roulette-wrap">
            <i className="roulette-pointer" />
            <div
              className={`multiplier-wheel ${
                busy && animationResult && rpsOutcome === "WIN" ? "is-spinning" : ""
              }`}
              style={
                {
                  "--wheel-turn": `${1_440 + [2, 3, 5, 10, 100].indexOf(rpsMultiplier) * 72}deg`,
                } as CSSProperties
              }
            >
              <span>×2</span>
              <span>×3</span>
              <span>×5</span>
              <span>×10</span>
              <span>×100</span>
            </div>
          </div>
          {stage === "idle" && (
            <Button
              disabled={data.myWallet.balance < wager}
              onClick={() =>
                play.mutate({
                  path: "rps-roulette",
                  body: { choice: rpsChoice, wager },
                  duration: 4_600,
                })
              }
            >
              <Hand size={18} /> {point(wager)} 짱깸보!
            </Button>
          )}
          {busy && (
            <p className="machine-status">
              {animationResult && rpsOutcome !== "WIN"
                ? "가위바위보 결과를 판정 중…"
                : "배수 룰렛 회전 중…"}
            </p>
          )}
          {revealedResult && (
            <>
              <div className="rps-outcome">
                {stringResult(revealedResult.result, "outcome")} · ×
                {numberResult(revealedResult.result, "multiplier")} 배수
              </div>
              <ResultBanner round={revealedResult} />
              <Button variant="secondary" onClick={resetRound}>
                다시 대결
              </Button>
            </>
          )}
        </section>
      )}

      {selectedGame.id === "lottery" && (
        <section className="arcade-machine lottery-machine">
          <div className={`lottery-drum ${busy ? "is-mixing" : ""}`}>
            {Array.from({ length: 14 }, (_, index) => (
              <i key={index} style={{ "--ball-index": index } as CSSProperties}>
                {index + 1}
              </i>
            ))}
          </div>
          <div className={`lottery-ticket ${revealedResult ? "is-open" : ""}`}>
            <div>
              <span>CampFlow</span>
              <strong>행운 추첨권</strong>
              <small>1회 {point(data.rules.games.lottery.pricePerDraw)}</small>
            </div>
            <div>
              <span>{String(lotteryDraw?.label ?? "추첨 중")}</span>
              <strong>{point(numberResult(lotteryDraw ?? {}, "prize"))}</strong>
            </div>
          </div>
          {stage === "idle" && (
            <Button
              disabled={data.myWallet.balance < data.rules.games.lottery.pricePerDraw}
              onClick={() =>
                play.mutate({
                  path: "lottery",
                  body: { count: 1 },
                  duration: 4_000,
                })
              }
            >
              <Sparkles size={18} /> {point(data.rules.games.lottery.pricePerDraw)}로 추첨 시작
            </Button>
          )}
          {busy && <p className="machine-status">추첨 공을 충분히 섞는 중…</p>}
          {revealedResult && (
            <>
              <ResultBanner round={revealedResult} />
              <Button variant="secondary" onClick={resetRound}>
                새 티켓 뽑기
              </Button>
            </>
          )}
          <Card className="lottery-odds lottery-odds--screen">
            {data.rules.games.lottery.tiers.map((tier) => (
              <div key={tier.key}>
                <strong>{tier.label}</strong>
                <span>{tier.probability}</span>
                <b>{point(tier.prize)}</b>
              </div>
            ))}
          </Card>
        </section>
      )}

      {selectedGame.id === "penalty-kick" && (
        <section className="penalty-arena-page">
          {(busy || penaltyVisual) && (
            <div className={`penalty-stadium ${penaltyVisual ? "is-playing" : "is-locking"}`}>
              <div className="goal-net" />
              {penaltyVisual ? (
                <>
                  <span
                    className={`penalty-keeper direction-${(penaltyVisual.creatorAction === "DIVE"
                      ? penaltyVisual.creatorDirection
                      : penaltyVisual.opponentDirection
                    )?.toLowerCase()}`}
                  >
                    🧤
                  </span>
                  <span
                    className={`penalty-ball direction-${(penaltyVisual.creatorAction === "KICK"
                      ? penaltyVisual.creatorDirection
                      : penaltyVisual.opponentDirection
                    )?.toLowerCase()}`}
                  >
                    ⚽
                  </span>
                </>
              ) : (
                <LockKeyhole className="penalty-lock" />
              )}
              <strong>{penaltyMessage}</strong>
            </div>
          )}
          {penaltyMessage && stage === "result" && !penaltyVisual && (
            <p className="form-notice">{penaltyMessage}</p>
          )}

          <Card className="penalty-reservation">
            <div>
              <span>내 비공개 예약 만들기</span>
              <h2>상대에게 역할과 판돈만 보입니다</h2>
            </div>
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
              onChange={(event) => setPenaltyDirection(event.target.value as Direction)}
            >
              <option value="LEFT">왼쪽</option>
              <option value="CENTER">가운데</option>
              <option value="RIGHT">오른쪽</option>
            </select>
            <label>
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
            <Button disabled={busy || !canWager} onClick={() => createPenalty.mutate()}>
              <LockKeyhole size={17} /> 방향 숨기고 예약
            </Button>
          </Card>

          <div className="penalty-list">
            {penaltyMatches.isPending && <Spinner label="승부차기 대기방 불러오는 중" />}
            {penaltyMatches.data?.length === 0 && (
              <Card>
                <p className="empty-inline">아직 예약된 경기가 없습니다.</p>
              </Card>
            )}
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
                        disabled={busy || data.myWallet.balance < match.wager}
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
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => cancelPenalty.mutate(match.id)}
                    >
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
      )}
    </WorkspaceShell>
  );
}
