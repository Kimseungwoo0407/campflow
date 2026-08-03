import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Coins,
  Gift,
  History,
  Medal,
  Megaphone,
  Shield,
  Target,
  Trophy,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Card, Spinner } from "@campflow/ui";
import { managerPointGrantSchema } from "@campflow/contracts";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { PointsTabs } from "./points-tabs";
import {
  describeResult,
  gameName,
  point,
  time,
  type PointsDashboard,
  type RewardItem,
} from "./points-shared";
import { WorkspaceShell } from "./trip-workspace-pages";

const arcadeGames = [
  {
    id: "tap",
    emoji: "👆",
    title: "10초 탭",
    description: "손가락으로 직접 기록을 만들고 포인트를 획득",
  },
  {
    id: "odd-even",
    emoji: "🪜",
    title: "비공개 사다리",
    description: "좌·우, 3·4줄, 홀·짝을 단일 또는 조합으로 맞히는 실제 경로 게임",
  },
  {
    id: "snail-race",
    emoji: "🐌",
    title: "달팽이 레이스",
    description: "네 마리가 실제 트랙을 달리는 4배 레이스",
  },
  {
    id: "rps-roulette",
    emoji: "✊",
    title: "짱깸보 룰렛",
    description: "가위바위보 뒤 배수판이 회전하는 게임",
  },
  {
    id: "lottery",
    emoji: "🎟️",
    title: "포인트 로또",
    description: "추첨기가 돌고 티켓이 열리는 세부 확률 뽑기",
  },
  {
    id: "penalty-kick",
    emoji: "⚽",
    title: "비공개 승부차기",
    description: "숨긴 방향을 상대 선택 뒤 경기로 확인",
  },
] as const;

export function TripPointsPage() {
  const { tripId = "" } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [targetUserId, setTargetUserId] = useState("");
  const [grantTargetUserId, setGrantTargetUserId] = useState("");
  const [grantAmount, setGrantAmount] = useState("10");
  const [grantReason, setGrantReason] = useState("");
  const [grantRequestId, setGrantRequestId] = useState(() => crypto.randomUUID());
  const dashboard = useQuery({
    queryKey: ["points", tripId],
    queryFn: () => apiRequest<PointsDashboard>(`trips/${tripId}/points`),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["points", tripId] });
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
  const managerGrant = useMutation({
    mutationFn: () => {
      const parsed = managerPointGrantSchema.parse({
        targetUserId: grantTargetUserId,
        amount: Number(grantAmount),
        reason: grantReason,
        clientRequestId: grantRequestId,
      });
      return apiRequest(`trips/${tripId}/points/grants`, {
        method: "POST",
        body: JSON.stringify(parsed),
      });
    },
    onSuccess: () => {
      setGrantTargetUserId("");
      setGrantAmount("10");
      setGrantReason("");
      setGrantRequestId(crypto.randomUUID());
      refresh();
    },
  });

  if (dashboard.isPending) {
    return (
      <WorkspaceShell
        eyebrow="포인트 홈"
        title="포인트 정보를 불러오는 중"
        description="잠시만 기다려 주세요."
      >
        <Spinner label="포인트 불러오는 중" />
      </WorkspaceShell>
    );
  }
  if (!dashboard.data) {
    return (
      <WorkspaceShell
        eyebrow="포인트 홈"
        title="포인트를 열 수 없습니다"
        description={dashboard.error?.message ?? "잠시 후 다시 시도해 주세요."}
      >
        <Button onClick={() => void dashboard.refetch()}>다시 시도</Button>
      </WorkspaceShell>
    );
  }

  const data = dashboard.data;
  const error = checkIn.error ?? redeem.error ?? managerGrant.error;

  return (
    <WorkspaceShell
      eyebrow="포인트 홈"
      title="활동으로 모으고, 게임장에서 사용하세요"
      description="출석과 여행 준비 활동, 업적 보상으로 포인트를 쌓을 수 있습니다."
      actions={
        <Button onClick={() => checkIn.mutate()} disabled={checkIn.isPending}>
          <CalendarCheck size={18} />
          오늘 출석 +20P
        </Button>
      }
    >
      <PointsTabs tripId={tripId} />
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
                  : "오늘 출석하고 포인트 받기"}
            </strong>
            <span>출석 +20P · 3일 연속 +10P · 7일 연속 +30P · 여행 당일 +50P</span>
          </div>
        </Card>
      </section>

      {data.myRole === "MANAGER" && (
        <Card className="manager-point-grant-card">
          <div className="manager-point-grant-copy">
            <Megaphone />
            <div>
              <span className="eyebrow">관리자 전용</span>
              <h2>멤버에게 포인트 지급</h2>
              <p>
                본인에게는 지급할 수 없습니다. 지급자·대상·금액·사유는 전체 포인트 내역과 단체
                라운지에 즉시 공개됩니다.
              </p>
            </div>
          </div>
          <form
            className="manager-point-grant-form"
            onSubmit={(event) => {
              event.preventDefault();
              managerGrant.mutate();
            }}
          >
            <label>
              <span>받을 멤버</span>
              <select
                className="input"
                value={grantTargetUserId}
                onChange={(event) => setGrantTargetUserId(event.target.value)}
                required
              >
                <option value="">선택</option>
                {data.balanceLeaderboard
                  .filter((wallet) => wallet.userId !== currentUser?.id)
                  .map((wallet) => (
                    <option key={wallet.userId} value={wallet.userId}>
                      {wallet.user.nickname}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>지급 포인트</span>
              <input
                className="input"
                type="number"
                min={10}
                max={10_000}
                step={10}
                value={grantAmount}
                onChange={(event) => setGrantAmount(event.target.value)}
                required
              />
            </label>
            <label>
              <span>공개 지급 사유</span>
              <input
                className="input"
                value={grantReason}
                onChange={(event) => setGrantReason(event.target.value)}
                minLength={2}
                maxLength={100}
                placeholder="예: 장보기 담당 수고비"
                required
              />
            </label>
            <Button type="submit" disabled={managerGrant.isPending}>
              {managerGrant.isPending ? "공개 지급 중…" : "전체 공개 후 지급"}
            </Button>
          </form>
          {managerGrant.isSuccess && (
            <p className="form-notice" role="status">
              포인트를 지급하고 전체 공개 내역과 단체 라운지에 기록했습니다.
            </p>
          )}
        </Card>
      )}

      <section className="workspace-section arcade-lobby">
        <div className="section-heading-row">
          <div>
            <h2>게임장</h2>
            <small>종목마다 독립된 화면과 진행 애니메이션이 있습니다.</small>
          </div>
        </div>
        <div className="arcade-lobby-grid">
          {arcadeGames.map((game) => (
            <Link key={game.id} to={`/trips/${tripId}/games/${game.id}`}>
              <span aria-hidden="true">{game.emoji}</span>
              <div>
                <strong>{game.title}</strong>
                <small>{game.description}</small>
              </div>
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      </section>

      <section className="leaderboard-layout">
        <Card className="leaderboard-card">
          <div className="section-heading-row">
            <h2>
              <Trophy size={19} /> 보유 포인트 순위
            </h2>
            <small>현재 사용할 수 있는 잔액</small>
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
            <small>포인트를 써도 내려가지 않습니다.</small>
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

      <section className="workspace-section point-ledger-section">
        <div className="section-heading-row">
          <div>
            <h2>
              <History size={19} /> 전체 공개 포인트 내역
            </h2>
            <small>관리자 지급을 포함해 모든 멤버에게 동일한 기록이 표시됩니다.</small>
          </div>
        </div>
        <Card className="point-ledger-card">
          <div className="history-list">
            {data.recentEntries.length === 0 && (
              <p className="empty-inline">아직 포인트 내역이 없습니다.</p>
            )}
            {data.recentEntries.map((entry) => (
              <div key={entry.id}>
                <span>
                  {entry.user.nickname} · {time(entry.createdAt)}
                </span>
                <strong>
                  {entry.sourceKey?.startsWith("admin-grant-") ? "관리자 공개 지급" : entry.reason}
                </strong>
                <b className={entry.delta >= 0 ? "point-positive" : "point-negative"}>
                  {entry.delta >= 0 ? "+" : ""}
                  {point(entry.delta)}
                </b>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="history-layout">
        <Card>
          <h2>공유 게임 결과</h2>
          <div className="history-list">
            {data.recentGames.length === 0 && (
              <p className="empty-inline">아직 게임 결과가 없습니다.</p>
            )}
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
            {data.recentRedemptions.length === 0 && (
              <p className="empty-inline">아직 아이템 사용 기록이 없습니다.</p>
            )}
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
