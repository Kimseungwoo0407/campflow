import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Castle,
  CircleDot,
  Coins,
  Gift,
  Gauge,
  GitFork,
  Hand,
  History,
  Medal,
  Megaphone,
  MousePointerClick,
  PackagePlus,
  Settings2,
  Shield,
  Target,
  Ticket,
  Trophy,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Card, Spinner } from "@campflow/ui";
import {
  managerPointGrantSchema,
  managerPointSetSchema,
  managerRewardGrantSchema,
} from "@campflow/contracts";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { PointsTabs } from "./points-tabs";
import {
  point,
  time,
  type PointsDashboard,
  type RewardInventoryEntry,
  type RewardItem,
} from "./points-shared";
import { WorkspaceShell } from "./trip-workspace-pages";

const arcadeGames = [
  {
    id: "tap",
    icon: MousePointerClick,
    title: "10초 탭",
    description: "손가락으로 직접 기록을 만들고 포인트를 획득",
  },
  {
    id: "odd-even",
    icon: GitFork,
    title: "비공개 사다리",
    description: "좌·우, 3·4줄, 홀·짝을 단일 또는 조합으로 맞히는 실제 경로 게임",
  },
  {
    id: "snail-race",
    icon: Gauge,
    title: "달팽이 레이스",
    description: "네 마리가 실제 트랙을 달리는 4배 레이스",
  },
  {
    id: "rps-roulette",
    icon: Hand,
    title: "짱깸보 룰렛",
    description: "가위바위보 뒤 배수판이 회전하는 게임",
  },
  {
    id: "lottery",
    icon: Ticket,
    title: "포인트 로또",
    description: "추첨기가 돌고 티켓이 열리는 세부 확률 뽑기",
  },
  {
    id: "penalty-kick",
    icon: CircleDot,
    title: "비공개 승부차기",
    description: "숨긴 방향을 상대 선택 뒤 경기로 확인",
  },
  {
    id: "afterglow-frontier",
    icon: Castle,
    title: "잔광전선",
    description: "영지를 성장시키고 다섯 방어 구역을 직접 돌파하는 비동기 공성 전략",
  },
] as const;

function rewardRequiresTarget(reward: RewardItem): boolean {
  return (
    reward.type === "TARGET_PENALTY" ||
    (typeof reward.effect === "object" &&
      reward.effect !== null &&
      "targetRequired" in reward.effect &&
      reward.effect.targetRequired === true)
  );
}

export function TripPointsPage() {
  const { tripId = "" } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [targetUserId, setTargetUserId] = useState("");
  const [grantTargetUserId, setGrantTargetUserId] = useState("");
  const [grantAmount, setGrantAmount] = useState("10");
  const [grantReason, setGrantReason] = useState("");
  const [grantRequestId, setGrantRequestId] = useState(() => crypto.randomUUID());
  const [balanceTargetUserId, setBalanceTargetUserId] = useState("");
  const [setBalance, setSetBalance] = useState("0");
  const [setReason, setSetReason] = useState("");
  const [setRequestId, setSetRequestId] = useState(() => crypto.randomUUID());
  const [rewardGrantTargetUserId, setRewardGrantTargetUserId] = useState("");
  const [rewardGrantItemId, setRewardGrantItemId] = useState("");
  const [rewardGrantQuantity, setRewardGrantQuantity] = useState("1");
  const [rewardGrantReason, setRewardGrantReason] = useState("");
  const [rewardGrantRequestId, setRewardGrantRequestId] = useState(() => crypto.randomUUID());
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
        body: JSON.stringify({}),
      }),
    onSuccess: refresh,
  });
  const useGrantedReward = useMutation({
    mutationFn: (entry: RewardInventoryEntry) =>
      apiRequest(`trips/${tripId}/rewards/inventory/${entry.grantIds[0]}/use`, {
        method: "POST",
        body: JSON.stringify({
          ...(rewardRequiresTarget(entry.rewardItem) ? { targetUserId } : {}),
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
  const managerSetBalance = useMutation({
    mutationFn: () => {
      const parsed = managerPointSetSchema.parse({
        targetUserId: balanceTargetUserId,
        balance: Number(setBalance),
        reason: setReason,
        clientRequestId: setRequestId,
      });
      return apiRequest(`trips/${tripId}/points/set-balance`, {
        method: "POST",
        body: JSON.stringify(parsed),
      });
    },
    onSuccess: () => {
      setSetReason("");
      setSetRequestId(crypto.randomUUID());
      refresh();
    },
  });
  const managerGrantReward = useMutation({
    mutationFn: () => {
      const parsed = managerRewardGrantSchema.parse({
        targetUserId: rewardGrantTargetUserId,
        rewardItemId: rewardGrantItemId,
        quantity: Number(rewardGrantQuantity),
        reason: rewardGrantReason,
        clientRequestId: rewardGrantRequestId,
      });
      return apiRequest(`trips/${tripId}/rewards/grants`, {
        method: "POST",
        body: JSON.stringify(parsed),
      });
    },
    onSuccess: () => {
      setRewardGrantQuantity("1");
      setRewardGrantReason("");
      setRewardGrantRequestId(crypto.randomUUID());
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
  const myRewardInventory = data.rewardInventory.filter(
    (entry) => entry.userId === currentUser?.id,
  );
  const error =
    checkIn.error ??
    redeem.error ??
    useGrantedReward.error ??
    managerGrant.error ??
    managerSetBalance.error ??
    managerGrantReward.error;

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
            <Settings2 />
            <div>
              <span className="eyebrow">관리자 전용</span>
              <h2>포인트·아이템 관리</h2>
              <p>
                승우 계정에서 모든 멤버의 잔액을 정확한 값으로 설정하고, 포인트 추가 지급과 상점
                아이템 지급을 관리할 수 있습니다. 변경 내용은 전체 내역과 단체 라운지에 기록됩니다.
              </p>
            </div>
          </div>

          <div className="manager-control-grid">
            <section className="manager-control-panel">
              <h3>
                <Settings2 size={18} /> 잔액 직접 설정
              </h3>
              <p>현재 값과 상관없이 선택한 멤버의 최종 보유 포인트를 지정합니다.</p>
              <form
                className="manager-point-grant-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  managerSetBalance.mutate();
                }}
              >
                <label>
                  <span>대상 멤버</span>
                  <select
                    className="input"
                    value={balanceTargetUserId}
                    onChange={(event) => {
                      const nextUserId = event.target.value;
                      setBalanceTargetUserId(nextUserId);
                      const wallet = data.balanceLeaderboard.find(
                        (entry) => entry.userId === nextUserId,
                      );
                      if (wallet) setSetBalance(String(wallet.balance));
                    }}
                    required
                  >
                    <option value="">선택</option>
                    {data.balanceLeaderboard.map((wallet) => (
                      <option key={wallet.userId} value={wallet.userId}>
                        {wallet.user.nickname} · 현재 {point(wallet.balance)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>최종 보유 포인트</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={1_000_000}
                    step={1}
                    value={setBalance}
                    onChange={(event) => setSetBalance(event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>변경 사유</span>
                  <input
                    className="input"
                    value={setReason}
                    onChange={(event) => setSetReason(event.target.value)}
                    minLength={2}
                    maxLength={100}
                    placeholder="예: 게임 수익 정산"
                    required
                  />
                </label>
                <Button type="submit" disabled={managerSetBalance.isPending}>
                  {managerSetBalance.isPending ? "설정 중…" : "잔액 설정"}
                </Button>
              </form>
              {managerSetBalance.isSuccess && (
                <p className="form-notice" role="status">
                  선택한 멤버의 포인트를 설정했습니다.
                </p>
              )}
            </section>

            <section className="manager-control-panel">
              <h3>
                <Megaphone size={18} /> 포인트 추가 지급
              </h3>
              <p>선택한 멤버의 현재 잔액에 포인트를 더합니다.</p>
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
                  <span>지급 사유</span>
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
                  {managerGrant.isPending ? "지급 중…" : "포인트 지급"}
                </Button>
              </form>
              {managerGrant.isSuccess && (
                <p className="form-notice" role="status">
                  포인트를 추가 지급했습니다.
                </p>
              )}
            </section>

            <section className="manager-control-panel">
              <h3>
                <PackagePlus size={18} /> 아이템 지급
              </h3>
              <p>지급된 아이템은 멤버의 보유함에 들어가며 포인트 차감 없이 사용할 수 있습니다.</p>
              <form
                className="manager-point-grant-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  managerGrantReward.mutate();
                }}
              >
                <label>
                  <span>받을 멤버</span>
                  <select
                    className="input"
                    value={rewardGrantTargetUserId}
                    onChange={(event) => setRewardGrantTargetUserId(event.target.value)}
                    required
                  >
                    <option value="">선택</option>
                    {data.balanceLeaderboard.map((wallet) => (
                      <option key={wallet.userId} value={wallet.userId}>
                        {wallet.user.nickname}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>지급 아이템</span>
                  <select
                    className="input"
                    value={rewardGrantItemId}
                    onChange={(event) => setRewardGrantItemId(event.target.value)}
                    required
                  >
                    <option value="">선택</option>
                    {data.rewards.map((reward) => (
                      <option key={reward.id} value={reward.id}>
                        {reward.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>수량</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={rewardGrantQuantity}
                    onChange={(event) => setRewardGrantQuantity(event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>지급 사유</span>
                  <input
                    className="input"
                    value={rewardGrantReason}
                    onChange={(event) => setRewardGrantReason(event.target.value)}
                    minLength={2}
                    maxLength={100}
                    placeholder="예: 현장 진행용 지급"
                    required
                  />
                </label>
                <Button type="submit" disabled={managerGrantReward.isPending}>
                  {managerGrantReward.isPending ? "지급 중…" : "아이템 지급"}
                </Button>
              </form>
              {rewardGrantTargetUserId && rewardGrantItemId && (
                <small className="manager-current-inventory">
                  현재 보유 수량:{" "}
                  {data.rewardInventory.find(
                    (entry) =>
                      entry.userId === rewardGrantTargetUserId &&
                      entry.rewardItemId === rewardGrantItemId,
                  )?.quantity ?? 0}
                  개
                </small>
              )}
              {managerGrantReward.isSuccess && (
                <p className="form-notice" role="status">
                  아이템을 보유함에 지급했습니다.
                </p>
              )}
            </section>

            <section className="manager-control-panel manager-bag-overview">
              <h3>
                <PackagePlus size={18} /> 멤버별 아이템 가방
              </h3>
              <p>현재 사용하지 않고 보유 중인 아이템의 총개수와 종류별 수량입니다.</p>
              <div className="manager-bag-grid" aria-label="멤버별 아이템 보유 현황">
                {data.balanceLeaderboard.map((wallet) => {
                  const memberInventory = data.rewardInventory.filter(
                    (entry) => entry.userId === wallet.userId,
                  );
                  const totalQuantity = memberInventory.reduce(
                    (total, entry) => total + entry.quantity,
                    0,
                  );
                  return (
                    <article
                      className="manager-bag-card"
                      key={wallet.userId}
                      aria-label={`${wallet.user.nickname} 아이템 가방, 총 ${totalQuantity}개`}
                    >
                      <header>
                        <strong>{wallet.user.nickname}</strong>
                        <span>{totalQuantity}개</span>
                      </header>
                      {memberInventory.length === 0 ? (
                        <p>보유 아이템 없음</p>
                      ) : (
                        <ul>
                          {memberInventory.map((entry) => (
                            <li key={entry.id}>
                              <span>{entry.rewardItem.title}</span>
                              <strong>{entry.quantity}개</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
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
          {arcadeGames.map((game) => {
            const GameIcon = game.icon;
            return (
              <Link key={game.id} to={`/trips/${tripId}/games/${game.id}`}>
                <span aria-hidden="true">
                  <GameIcon size={23} />
                </span>
                <div>
                  <strong>{game.title}</strong>
                  <small>{game.description}</small>
                </div>
                <ArrowRight size={17} />
              </Link>
            );
          })}
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

      {myRewardInventory.length > 0 && (
        <section className="workspace-section granted-reward-section">
          <div className="section-heading-row">
            <div>
              <h2>내 아이템 보유함</h2>
              <small>
                구매하거나 관리자가 지급한 아이템의 보유량입니다. 사용할 때 대상을 선택합니다.
              </small>
            </div>
            <select
              className="input target-select"
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
              aria-label="지급 아이템 대상"
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
            {myRewardInventory.map((entry) => (
              <Card className="reward-card granted-reward-card" key={entry.id}>
                <Gift />
                <span className="badge">보유 아이템</span>
                <h3>{entry.rewardItem.title}</h3>
                <p>{entry.rewardItem.description}</p>
                <div>
                  <strong>{entry.quantity}개 보유</strong>
                  <Button
                    disabled={
                      useGrantedReward.isPending ||
                      (rewardRequiresTarget(entry.rewardItem) && !targetUserId)
                    }
                    onClick={() => useGrantedReward.mutate(entry)}
                  >
                    사용
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="workspace-section">
        <div className="section-heading-row">
          <div>
            <h2>포인트 상점</h2>
            <small>구매한 아이템은 내 보유함에 쌓이며, 사용할 때 대상을 선택합니다.</small>
          </div>
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
                  disabled={redeem.isPending || data.myWallet.balance < reward.cost}
                  onClick={() => redeem.mutate(reward)}
                >
                  구매
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
                  {entry.sourceKey?.startsWith("manager-set:")
                    ? "관리자 잔액 설정"
                    : entry.sourceKey?.startsWith("manager-grant:")
                      ? "관리자 공개 지급"
                      : entry.reason}
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

      <section className="history-layout history-layout--single">
        <Card>
          <h2>아이템 사용 기록</h2>
          <div className="history-list">
            {data.recentRedemptions.length === 0 && (
              <p className="empty-inline">아직 아이템 사용 기록이 없습니다.</p>
            )}
            {data.recentRedemptions.map((redemption) => (
              <div key={redemption.id}>
                <span>
                  {redemption.buyer.nickname} ·{" "}
                  {time(redemption.resolvedAt ?? redemption.createdAt)}
                </span>
                <strong>{redemption.rewardItem.title}</strong>
                <b>{redemption.target ? `→ ${redemption.target.nickname}` : "대상 없음"}</b>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </WorkspaceShell>
  );
}
