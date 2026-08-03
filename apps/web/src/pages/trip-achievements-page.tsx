import { Award, CheckCircle2, Gift, LockKeyhole, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Button, Card, Spinner } from "@campflow/ui";
import { apiRequest } from "../api/client";
import { PointsTabs } from "./points-tabs";
import { point, type Achievement, type AchievementsData } from "./points-shared";
import { WorkspaceShell } from "./trip-workspace-pages";

const achievementEmoji: Record<string, string> = {
  FIRST_CHECK_IN: "👣",
  TRIP_HELPER_3: "🧰",
  ARCADE_EXPLORER: "🕹️",
  TAP_TOTAL_200: "👆",
  SNAIL_STREAK_3: "🐌",
  GAME_ROUNDS_10: "🎮",
  FIRST_REWARD: "🎁",
};

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
      title="여행을 즐기고 업적 보상을 받으세요"
      description="실제 활동 기록으로 달성 여부를 확인합니다. 달성한 업적은 직접 보상을 받아야 포인트가 지급됩니다."
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
              <Award />
              <span>전체 업적</span>
              <strong>{achievements.data.totalCount}개</strong>
            </Card>
            <Card>
              <Sparkles />
              <span>달성</span>
              <strong>{achievements.data.achievedCount}개</strong>
            </Card>
            <Card>
              <Gift />
              <span>보상 수령</span>
              <strong>{achievements.data.claimedCount}개</strong>
            </Card>
          </section>

          {claim.error && <p className="form-error">{claim.error.message}</p>}
          <section className="achievement-grid">
            {achievements.data.items.map((achievement) => {
              const percent = Math.min(100, (achievement.progress / achievement.target) * 100);
              const claiming = claim.isPending && claim.variables?.key === achievement.key;
              return (
                <Card
                  className={`achievement-card ${achievement.claimable ? "is-claimable" : ""} ${achievement.claimed ? "is-claimed" : ""}`}
                  key={achievement.key}
                >
                  <div className="achievement-icon" aria-hidden="true">
                    {achievementEmoji[achievement.key] ?? "🏅"}
                  </div>
                  <div className="achievement-copy">
                    <span className="badge">
                      {achievement.claimed
                        ? "보상 완료"
                        : achievement.achieved
                          ? "달성 완료"
                          : "진행 중"}
                    </span>
                    <h2>{achievement.title}</h2>
                    <p>{achievement.description}</p>
                  </div>
                  <strong className="achievement-reward">+{point(achievement.reward)}</strong>
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
                    진행 {achievement.progress.toLocaleString("ko-KR")} /{" "}
                    {achievement.target.toLocaleString("ko-KR")}
                  </small>
                  <Button
                    variant={achievement.claimable ? "primary" : "secondary"}
                    disabled={!achievement.claimable || claim.isPending}
                    onClick={() => claim.mutate(achievement)}
                  >
                    {achievement.claimed ? (
                      <>
                        <CheckCircle2 size={17} /> 보상 받기 완료
                      </>
                    ) : achievement.claimable ? (
                      <>
                        <Gift size={17} />{" "}
                        {claiming ? "지급 중…" : `성공 · ${point(achievement.reward)} 받기`}
                      </>
                    ) : (
                      <>
                        <LockKeyhole size={17} /> 아직 진행 중
                      </>
                    )}
                  </Button>
                </Card>
              );
            })}
          </section>
        </>
      )}
    </WorkspaceShell>
  );
}
