import { Award, CheckCircle2, Coins, Gift, Layers3, LockKeyhole, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Button, Card, Spinner } from "@campflow/ui";
import { apiRequest } from "../api/client";
import { PointsTabs } from "./points-tabs";
import { point, type Achievement, type AchievementsData } from "./points-shared";
import { WorkspaceShell } from "./trip-workspace-pages";

const seriesEmoji: Record<string, string> = {
  CHECK_IN: "👣",
  ACTIVITY_TOTAL: "🧭",
  ACTIVITY_TYPES: "🧰",
  GAME_TYPES: "🕹️",
  GAME_ROUNDS: "🎮",
  GAME_WINS: "🏆",
  TAP_TOTAL: "👆",
  TAP_BEST: "⚡",
  SNAIL_ROUNDS: "🐌",
  SNAIL_WINS: "🥇",
  SNAIL_STREAK: "🔥",
  ODD_EVEN_ROUNDS: "🪜",
  RPS_ROUNDS: "✊",
  PENALTY_ROUNDS: "⚽",
  LOTTERY_DRAWS: "🎟️",
  REWARD_USES: "🎁",
};

const categoryInfo = {
  TRIP: {
    title: "여행 참여",
    description: "출석과 여행 준비를 꾸준히 이어 가는 업적",
  },
  ARCADE: {
    title: "게임 정복",
    description: "기록, 플레이, 승리를 쌓아 올리는 업적",
  },
  COLLECTION: {
    title: "아이템 활용",
    description: "포인트 아이템을 전략적으로 사용하는 업적",
  },
} as const;

function groupBySeries(items: Achievement[]) {
  const groups = new Map<string, Achievement[]>();
  for (const item of items) {
    const series = groups.get(item.seriesKey);
    if (series) series.push(item);
    else groups.set(item.seriesKey, [item]);
  }
  return [...groups.entries()].map(([key, stages]) => ({ key, stages }));
}

export function TripAchievementsPage() {
  const { tripId = "" } = useParams();
  const queryClient = useQueryClient();
  const achievements = useQuery({
    queryKey: ["achievements", tripId],
    queryFn: () => apiRequest<AchievementsData>(`trips/${tripId}/achievements`),
  });
  const claim = useMutation({
    mutationFn: (achievement: Achievement) =>
      apiRequest(`trips/${tripId}/achievements/${achievement.key}/claim`, { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["achievements", tripId] }),
        queryClient.invalidateQueries({ queryKey: ["points", tripId] }),
      ]);
    },
  });

  return (
    <WorkspaceShell
      eyebrow="포인트 · 업적"
      title="작은 기록부터 전설까지, 84단계에 도전하세요"
      description="16개 업적 트랙은 단계가 오를수록 목표와 포인트 보상이 함께 커집니다. 달성한 단계마다 보상을 받을 수 있습니다."
    >
      <PointsTabs tripId={tripId} />
      {achievements.isPending && <Spinner label="업적 불러오는 중" />}
      {!achievements.data && !achievements.isPending && (
        <Card>
          <p className="form-error">
            {achievements.error?.message ?? "업적을 불러오지 못했습니다."}
          </p>
          <Button onClick={() => void achievements.refetch()}>다시 시도</Button>
        </Card>
      )}
      {achievements.data && (
        <>
          <section className="achievement-summary" aria-label="업적 현황">
            <Card>
              <Layers3 />
              <span>업적 트랙</span>
              <strong>{achievements.data.seriesCount}개</strong>
            </Card>
            <Card>
              <Award />
              <span>전체 단계</span>
              <strong>{achievements.data.totalCount}개</strong>
            </Card>
            <Card className={achievements.data.claimableCount > 0 ? "is-highlighted" : ""}>
              <Sparkles />
              <span>보상 대기</span>
              <strong>{achievements.data.claimableCount}개</strong>
            </Card>
            <Card>
              <Coins />
              <span>전체 보상</span>
              <strong>{point(achievements.data.totalReward)}</strong>
            </Card>
          </section>

          <div className="achievement-overall-progress">
            <div>
              <span>나의 전체 달성도</span>
              <strong>
                {achievements.data.achievedCount} / {achievements.data.totalCount}단계
              </strong>
            </div>
            <div
              className="achievement-progress"
              role="progressbar"
              aria-label="전체 업적 달성도"
              aria-valuemin={0}
              aria-valuemax={achievements.data.totalCount}
              aria-valuenow={achievements.data.achievedCount}
            >
              <i
                style={{
                  width: `${(achievements.data.achievedCount / achievements.data.totalCount) * 100}%`,
                }}
              />
            </div>
            <small>보상 수령 완료 {achievements.data.claimedCount}단계</small>
          </div>

          {claim.error && <p className="form-error">{claim.error.message}</p>}

          {(Object.keys(categoryInfo) as Array<keyof typeof categoryInfo>).map((category) => {
            const categoryItems = achievements.data.items.filter(
              (achievement) => achievement.category === category,
            );
            const series = groupBySeries(categoryItems);
            if (series.length === 0) return null;
            return (
              <section className="achievement-category" key={category}>
                <div className="achievement-category-heading">
                  <div>
                    <span className="eyebrow">{series.length}개 트랙</span>
                    <h2>{categoryInfo[category].title}</h2>
                    <p>{categoryInfo[category].description}</p>
                  </div>
                  <strong>{categoryItems.length}단계</strong>
                </div>

                <div className="achievement-series-grid">
                  {series.map(({ key, stages }) => {
                    const claimedStages = stages.filter((stage) => stage.claimed).length;
                    const achievedStages = stages.filter((stage) => stage.achieved).length;
                    const nextStage = stages.find((stage) => !stage.achieved) ?? stages.at(-1)!;
                    return (
                      <Card className="achievement-series-card" key={key}>
                        <header>
                          <div className="achievement-icon" aria-hidden="true">
                            {seriesEmoji[key] ?? "🏅"}
                          </div>
                          <div>
                            <span>
                              {achievedStages === stages.length
                                ? "전 단계 달성"
                                : `다음 ${nextStage.stage}단계`}
                            </span>
                            <h3>{stages[0]!.seriesTitle}</h3>
                          </div>
                          <strong>
                            {claimedStages}/{stages.length}
                          </strong>
                        </header>

                        <div className="achievement-series-next">
                          <span>
                            현재 {nextStage.progress.toLocaleString("ko-KR")}
                            {nextStage.unit}
                          </span>
                          <b>
                            다음 목표 {nextStage.target.toLocaleString("ko-KR")}
                            {nextStage.unit}
                          </b>
                        </div>

                        <ol className="achievement-stage-list">
                          {stages.map((achievement) => {
                            const percent = Math.min(
                              100,
                              (achievement.progress / achievement.target) * 100,
                            );
                            const claiming =
                              claim.isPending && claim.variables?.key === achievement.key;
                            return (
                              <li
                                className={`${achievement.claimable ? "is-claimable" : ""} ${achievement.claimed ? "is-claimed" : ""}`}
                                key={achievement.key}
                              >
                                <div className="achievement-stage-number">
                                  {achievement.claimed ? (
                                    <CheckCircle2 size={17} />
                                  ) : (
                                    achievement.stage
                                  )}
                                </div>
                                <div className="achievement-stage-copy">
                                  <strong>
                                    {achievement.stage}단계 · {achievement.title}
                                  </strong>
                                  <span>{achievement.description}</span>
                                  <div
                                    className="achievement-progress"
                                    role="progressbar"
                                    aria-label={`${achievement.title} 진행도`}
                                    aria-valuemin={0}
                                    aria-valuemax={achievement.target}
                                    aria-valuenow={achievement.progress}
                                  >
                                    <i style={{ width: `${percent}%` }} />
                                  </div>
                                  <small>
                                    {achievement.progress.toLocaleString("ko-KR")} /{" "}
                                    {achievement.target.toLocaleString("ko-KR")}
                                    {achievement.unit}
                                  </small>
                                </div>
                                <div className="achievement-stage-reward">
                                  <strong>+{point(achievement.reward)}</strong>
                                  <Button
                                    variant={achievement.claimable ? "primary" : "secondary"}
                                    disabled={!achievement.claimable || claim.isPending}
                                    onClick={() => claim.mutate(achievement)}
                                    aria-label={`${achievement.seriesTitle} ${achievement.stage}단계 보상`}
                                  >
                                    {achievement.claimed ? (
                                      <CheckCircle2 size={16} />
                                    ) : achievement.claimable ? (
                                      claiming ? (
                                        "지급 중…"
                                      ) : (
                                        <>
                                          <Gift size={16} /> 받기
                                        </>
                                      )
                                    ) : (
                                      <LockKeyhole size={16} />
                                    )}
                                  </Button>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}
    </WorkspaceShell>
  );
}
