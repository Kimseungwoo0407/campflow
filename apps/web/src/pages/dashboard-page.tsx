import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Coins,
  Plus,
  Users,
} from "lucide-react";
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

      <section className="onboarding-card">
        <div className="onboarding-card__title">
          <BookOpenCheck size={26} aria-hidden="true" />
          <div>
            <span>처음 로그인했다면</span>
            <h2>네 명 모두 0P에서 시작해요</h2>
          </div>
        </div>
        <ol>
          <li>
            <b>1</b>내 여행 열기
          </li>
          <li>
            <b>2</b>
            장소·투표·일정 채우기
          </li>
          <li>
            <b>3</b>
            출석과 활동으로 포인트 모으기
          </li>
          <li>
            <b>4</b>
            상점·게임·승부차기 즐기기
          </li>
        </ol>
        <div className="onboarding-card__actions">
          <Link className="button button--secondary" to="/guide">
            전체 사용법 보기
          </Link>
          <Link
            className="button button--primary"
            to={activeTrip ? `/trips/${activeTrip.id}` : "/trips"}
          >
            바로 시작하기 <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="dashboard-grid">
        <Card className="decision-card decision-card--active">
          <div className="decision-card__icon">
            <Users />
          </div>
          <span>현재 단계</span>
          <h2>{activeTrip ? "친구 모으기 완료" : "친구 모으기"}</h2>
          <p>
            {activeTrip
              ? "네 명의 계정과 여행 멤버 연결이 끝났습니다."
              : "그룹과 초대 링크를 만들고 멤버 권한을 확인하세요."}
          </p>
          <Link to={activeTrip ? `/trips/${activeTrip.id}` : "/groups"}>
            {activeTrip ? "여행 멤버 보기" : "내 그룹 보기"} <ArrowRight size={16} />
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
          <div className="decision-card__icon">
            <Coins />
          </div>
          <span>활동 포인트</span>
          <h2>0P부터 공정하게 시작</h2>
          <p>출석, 장소, 투표, 글과 댓글, 일정과 준비 활동으로 포인트를 모으세요.</p>
          <Link to={activeTrip ? `/trips/${activeTrip.id}/points` : "/guide"}>
            포인트 규칙 보기 <ArrowRight size={16} />
          </Link>
        </Card>
      </section>
    </div>
  );
}
