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

const gameHeadings: Record<ArcadeGameId, { title: string; description: string }> = {
  tap: {
    title: "10초 탭 챌린지",
    description: "10초 동안 직접 버튼을 두드려 기록을 만들고 하루 세 번 포인트를 받습니다.",
  },
  "odd-even": {
    title: "네온 홀짝 사다리",
    description: "홀 또는 짝을 고르면 사다리 경로가 실제로 내려간 뒤 서버 숫자를 공개합니다.",
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
  return (
    <div className={`game-result-reveal ${won ? "is-win" : round.pointDelta < 0 ? "is-loss" : ""}`}>
      <Sparkles aria-hidden="true" />
      <div>
        <span>{gameName(round.gameType)} 최종 결과</span>
        <strong>
          {round.pointDelta > 0 ? "승리" : round.pointDelta < 0 ? "아쉽게 실패" : "무승부"}
        </strong>
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
  const [wager, setWager] = useState(50);
  const [stage, setStage] = useState<"idle" | "running" | "result">("idle");
  const [animationResult, setAnimationResult] = useState<GameRound | null>(null);
  const [revealedResult, setRevealedResult] = useState<GameRound | null>(null);
  const [oddChoice, setOddChoice] = useState<"ODD" | "EVEN">("ODD");
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
    }: {
      path: string;
      body: Record<string, unknown>;
      duration: number;
    }) => ({
      round: await apiRequest<GameRound>(`trips/${tripId}/games/${path}`, {
        method: "POST",
        body: JSON.stringify({ ...body, clientRoundId: crypto.randomUUID() }),
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
    onError: () => setStage("idle"),
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
          return 0;
        }
        return seconds - 1;
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [tapActive]);

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
    setTapScore(0);
    setTapSeconds(10);
    setRevealedResult(null);
    setAnimationResult(null);
    setStage("running");
    setTapActive(true);
  };
  const resetRound = () => {
    setStage("idle");
    setAnimationResult(null);
    setRevealedResult(null);
  };

  const ladderAnswer = animationResult ? stringResult(animationResult.result, "answer") : oddChoice;
  const ladderStartX = oddChoice === "ODD" ? 76 : 224;
  const ladderEndX = ladderAnswer === "ODD" ? 76 : 224;
  const ladderPath = `M ${ladderStartX} 34 C ${ladderStartX} 90, ${
    ladderStartX === ladderEndX ? (ladderStartX === 76 ? 224 : 76) : ladderEndX
  } 120, ${ladderEndX} 180 S ${ladderStartX} 260, ${ladderEndX} 326`;

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
                min="5"
                max="500"
                step="5"
                value={wager}
                onChange={(event) => setWager(Number(event.target.value))}
              />
            </label>
            <span>현재 잔액 {point(data.myWallet.balance)}</span>
            {!canWager && <strong>포인트가 부족합니다. 출석이나 10초 탭부터 해보세요.</strong>}
          </Card>
        )}

      {selectedGame.id === "tap" && (
        <section className={`arcade-machine tap-machine ${tapActive ? "is-running" : ""}`}>
          <div className="tap-timer-ring" style={{ "--tap-progress": tapSeconds } as CSSProperties}>
            <strong>{tapSeconds}</strong>
            <span>SECONDS</span>
          </div>
          <div className="tap-live-score">
            <span>현재 기록</span>
            <strong>{tapScore}</strong>
            <small>하루 3회 보상 · 최고 300회</small>
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
              onClick={() => setTapScore((score) => Math.min(300, score + 1))}
            >
              TAP!
              <i aria-hidden="true" />
            </button>
          )}
          {!tapActive && tapSeconds === 0 && !revealedResult && (
            <Button
              disabled={tapScore < 1 || play.isPending}
              onClick={() =>
                play.mutate({
                  path: "tap-score",
                  body: { score: tapScore },
                  duration: 1_400,
                })
              }
            >
              <Trophy size={18} /> {tapScore}회 기록 등록
            </Button>
          )}
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
          <div className="machine-choice-row">
            <button
              className={oddChoice === "ODD" ? "active" : ""}
              type="button"
              onClick={() => setOddChoice("ODD")}
              disabled={busy}
            >
              홀 ODD
            </button>
            <button
              className={oddChoice === "EVEN" ? "active" : ""}
              type="button"
              onClick={() => setOddChoice("EVEN")}
              disabled={busy}
            >
              짝 EVEN
            </button>
          </div>
          <div className={`ladder-board ${busy ? "is-running" : ""}`}>
            <div className="ladder-labels ladder-labels--top">
              <span>홀</span>
              <span>짝</span>
            </div>
            <svg viewBox="0 0 300 360" role="img" aria-label="홀짝 사다리 진행 화면">
              <path d="M76 28 V332 M224 28 V332" className="ladder-rail" />
              <path
                d="M76 72 H224 M76 128 H224 M76 190 H224 M76 250 H224 M76 300 H224"
                className="ladder-rungs"
              />
              {animationResult && (
                <>
                  <path d={ladderPath} className="ladder-route" />
                  <circle key={animationResult.id} r="10" className="ladder-ball">
                    <animateMotion dur="3.6s" fill="freeze" path={ladderPath} />
                  </circle>
                </>
              )}
            </svg>
            <div className="ladder-labels">
              <span>홀 결과</span>
              <span>짝 결과</span>
            </div>
          </div>
          {stage === "idle" && (
            <Button
              disabled={!canWager}
              onClick={() =>
                play.mutate({
                  path: "odd-even",
                  body: { choice: oddChoice, wager },
                  duration: 4_000,
                })
              }
            >
              <Dices size={18} /> {point(wager)} 걸고 사다리 시작
            </Button>
          )}
          {busy && (
            <p className="machine-status">
              <RotateCw size={17} /> 사다리를 따라 결과 확인 중…
            </p>
          )}
          {revealedResult && (
            <>
              <div className="number-reveal">
                <span>서버 추첨 숫자</span>
                <strong>{numberResult(revealedResult.result, "rolled")}</strong>
                <b>{stringResult(revealedResult.result, "answer") === "ODD" ? "홀" : "짝"}</b>
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
              <small>1회 30P</small>
            </div>
            <div>
              <span>{String(lotteryDraw?.label ?? "추첨 중")}</span>
              <strong>{point(numberResult(lotteryDraw ?? {}, "prize"))}</strong>
            </div>
          </div>
          {stage === "idle" && (
            <Button
              disabled={data.myWallet.balance < 30}
              onClick={() =>
                play.mutate({
                  path: "lottery",
                  body: { count: 1 },
                  duration: 4_000,
                })
              }
            >
              <Sparkles size={18} /> 30P로 추첨 시작
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
