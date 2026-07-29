import { ArrowRight, CalendarDays, CheckCircle2, Plus, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@campflow/ui";
import type { TripSummary } from "./trips-pages";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const trips = useQuery({
    queryKey: ["trips"],
    queryFn: () => apiRequest<TripSummary[]>("trips"),
  });
  const activeTrip = trips.data?.[0];
  return (
    <div className="page">
      <header className="page-heading page-heading--split">
        <div>
          <span className="eyebrow">오늘의 CampFlow</span>
          <h1>{user?.nickname}님, 다음 여행을 준비해 볼까요?</h1>
          <p>그룹을 만들거나 초대 코드로 친구들의 모임에 참여할 수 있습니다.</p>
        </div>
        <Link className="button button--primary" to="/groups">
          <Plus size={18} />
          그룹 만들기
        </Link>
      </header>

      <section className="dashboard-grid">
        <Card className="decision-card decision-card--active">
          <div className="decision-card__icon">
            <Users />
          </div>
          <span>현재 단계</span>
          <h2>친구 모으기</h2>
          <p>그룹과 초대 링크를 만들고 멤버 권한을 확인하세요.</p>
          <Link to="/groups">
            내 그룹 보기 <ArrowRight size={16} />
          </Link>
        </Card>
        <Card className="decision-card decision-card--active">
          <div className="decision-card__icon">
            <CalendarDays />
          </div>
          <span>다음 단계</span>
          <h2>{activeTrip?.title ?? "여행 준비"}</h2>
          <p>
            {activeTrip
              ? "확정 날짜를 기준으로 장소 후보를 모으고 투표를 시작하세요."
              : "그룹에서 8월 29~30일 여행을 만들 수 있습니다."}
          </p>
          <Link to={activeTrip ? `/trips/${activeTrip.id}` : "/groups"}>
            {activeTrip ? "여행 계속하기" : "그룹에서 여행 만들기"} <ArrowRight size={16} />
          </Link>
        </Card>
        <Card className="decision-card">
          <div className="decision-card__icon decision-card__icon--muted">
            <CheckCircle2 />
          </div>
          <span>기반 상태</span>
          <h2>안전한 협업 준비</h2>
          <p>세션 회전, 그룹 권한, 감사 로그가 적용되어 있습니다.</p>
          <small>Phase 0·1</small>
        </Card>
      </section>
    </div>
  );
}
