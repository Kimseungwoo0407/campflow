import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  Compass,
  ListChecks,
  MapPin,
  Plus,
  Sparkles,
  Users,
  Vote,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Spinner } from "@campflow/ui";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";
import type { TripSummary } from "./trips-pages";

const statusCopy: Record<TripSummary["status"], string> = {
  DRAFT: "초안",
  SEARCHING: "장소 찾는 중",
  VOTING: "투표 진행 중",
  CONFIRMED: "여행 확정",
  IN_PROGRESS: "여행 중",
  SETTLING: "정산 중",
  ARCHIVED: "완료",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatMoney(value: number | null) {
  return value === null ? "미정" : `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const trips = useQuery({
    queryKey: ["trips"],
    queryFn: () => apiRequest<TripSummary[]>("trips"),
  });

  if (trips.isPending) {
    return (
      <div className="page dashboard-page dashboard-page--loading">
        <Spinner label="여행 대시보드를 준비하는 중" />
        <div className="dashboard-skeleton" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  }

  if (trips.isError) {
    return (
      <div className="page dashboard-page">
        <header className="dashboard-welcome">
          <span className="dashboard-kicker">오늘의 CampFlow</span>
          <h1>{user?.nickname ?? "여행자"}님, 다시 연결해 볼까요?</h1>
        </header>
        <div className="state-panel state-panel--error" role="alert">
          <p>{trips.error.message}</p>
          <Button variant="secondary" onClick={() => void trips.refetch()}>
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  const activeTrip = trips.data?.[0];
  const nickname = user?.nickname ?? "여행자";

  if (!activeTrip) {
    return (
      <div className="page dashboard-page dashboard-page--empty">
        <header className="dashboard-welcome">
          <span className="dashboard-kicker">오늘의 CampFlow</span>
          <h1>{nickname}님, 첫 여행을 시작해 볼까요?</h1>
          <p>그룹을 만들거나 초대 코드로 친구들의 여행에 합류할 수 있어요.</p>
        </header>
        <section className="dashboard-empty-card" aria-labelledby="empty-dashboard-title">
          <span className="dashboard-empty-card__icon" aria-hidden="true">
            <Compass size={34} />
          </span>
          <div>
            <span className="dashboard-kicker">새로운 여행의 시작</span>
            <h2 id="empty-dashboard-title">친구부터 모으면 준비가 쉬워져요.</h2>
            <p>그룹을 만든 뒤 날짜, 장소, 준비물과 정산을 한곳에서 이어가세요.</p>
          </div>
          <div className="dashboard-empty-card__actions">
            <Link className="button button--primary" to="/groups">
              <Plus size={18} aria-hidden="true" /> 그룹 만들기
            </Link>
            <Link className="button button--secondary" to="/guide">
              사용법 보기
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const tripPath = `/trips/${activeTrip.id}`;
  const quickActions = [
    {
      to: `${tripPath}/candidates`,
      label: "장소 후보",
      copy: "후보를 모아 비교해요",
      icon: MapPin,
      tone: "coral",
    },
    {
      to: `${tripPath}/polls`,
      label: "친구 투표",
      copy: "의견을 빠르게 정해요",
      icon: Vote,
      tone: "blue",
    },
    {
      to: `${tripPath}/tasks`,
      label: "준비물",
      copy: "담당과 완료를 확인해요",
      icon: ListChecks,
      tone: "yellow",
    },
    {
      to: `${tripPath}/expenses`,
      label: "회비 정산",
      copy: `${activeTrip.memberCount}명이 함께 나눠요`,
      icon: CircleDollarSign,
      tone: "green",
    },
  ] as const;

  return (
    <div className="page dashboard-page">
      <header className="dashboard-welcome">
        <div>
          <span className="dashboard-kicker">
            <Sparkles size={15} aria-hidden="true" /> 오늘의 CampFlow
          </span>
          <h1>{nickname}님, 여행이 착착 준비되고 있어요.</h1>
          <p>지금 필요한 결정부터 하나씩 이어가면 돼요.</p>
        </div>
        <Link className="button button--secondary dashboard-new-trip" to="/groups">
          <Plus size={18} aria-hidden="true" /> 새 여행 만들기
        </Link>
      </header>

      <section className="dashboard-spotlight" aria-labelledby="active-trip-title">
        <div className="dashboard-spotlight__content">
          <span className="dashboard-live-badge">
            <i aria-hidden="true" /> {statusCopy[activeTrip.status]}
          </span>
          <span className="dashboard-spotlight__group">{activeTrip.group.name}</span>
          <h2 id="active-trip-title">{activeTrip.title}</h2>
          <p>{activeTrip.purpose || "친구들과 함께 만드는 다음 여행"}</p>
          <div className="dashboard-spotlight__facts">
            <span>
              <CalendarDays size={17} aria-hidden="true" />
              {formatDate(activeTrip.startDate)} – {formatDate(activeTrip.endDate)}
            </span>
            <span>
              <MapPin size={17} aria-hidden="true" /> {activeTrip.regionText}
            </span>
          </div>
          <div className="dashboard-spotlight__actions">
            <Link className="button dashboard-button--light" to={tripPath}>
              여행 계속하기 <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="dashboard-text-link" to="/trips">
              전체 여행 보기
            </Link>
          </div>
        </div>

        <div className="dashboard-progress-card">
          <div className="dashboard-progress-card__heading">
            <span>여행 준비율</span>
            <strong>{activeTrip.progress}%</strong>
          </div>
          <progress
            max="100"
            value={activeTrip.progress}
            aria-label={`여행 준비율 ${activeTrip.progress}%`}
          >
            {activeTrip.progress}%
          </progress>
          <div className="dashboard-avatar-row" aria-label={`참여 멤버 ${activeTrip.memberCount}명`}>
            {Array.from({ length: Math.min(activeTrip.memberCount, 4) }, (_, index) => (
              <i key={index} aria-hidden="true">
                {index + 1}
              </i>
            ))}
            <span>{activeTrip.memberCount}명이 함께 준비 중</span>
          </div>
        </div>
      </section>

      <section className="dashboard-metrics" aria-label="현재 여행 요약">
        <article>
          <span className="dashboard-metric__icon dashboard-metric__icon--coral">
            <Users size={20} aria-hidden="true" />
          </span>
          <div>
            <small>함께 가는 친구</small>
            <strong>{activeTrip.memberCount}명</strong>
          </div>
          <span className="dashboard-metric__note">참석 {activeTrip.attendeeCount}명</span>
        </article>
        <article>
          <span className="dashboard-metric__icon dashboard-metric__icon--yellow">
            <CircleDollarSign size={20} aria-hidden="true" />
          </span>
          <div>
            <small>1인 예상 회비</small>
            <strong>{formatMoney(activeTrip.budgetPerPerson)}</strong>
          </div>
          <span className="dashboard-metric__note">모두 균등 분담</span>
        </article>
        <article>
          <span className="dashboard-metric__icon dashboard-metric__icon--blue">
            <Compass size={20} aria-hidden="true" />
          </span>
          <div>
            <small>현재 단계</small>
            <strong>{statusCopy[activeTrip.status]}</strong>
          </div>
          <span className="dashboard-metric__note">다음 결정을 확인해요</span>
        </article>
      </section>

      <section className="dashboard-section" aria-labelledby="quick-actions-title">
        <div className="dashboard-section__heading">
          <div>
            <span className="dashboard-kicker">Quick action</span>
            <h2 id="quick-actions-title">바로 이어서 준비해요</h2>
          </div>
          <Link to={tripPath}>
            여행 보드 전체보기 <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="dashboard-quick-grid">
          {quickActions.map(({ to, label, copy, icon: Icon, tone }) => (
            <Link className={`dashboard-quick-card dashboard-quick-card--${tone}`} to={to} key={to}>
              <span className="dashboard-quick-card__icon">
                <Icon size={22} aria-hidden="true" />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{copy}</small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-lower-grid">
        <article className="dashboard-flow-card">
          <div className="dashboard-section__heading">
            <div>
              <span className="dashboard-kicker">준비 흐름</span>
              <h2>말은 줄이고, 결정은 남겨요</h2>
            </div>
          </div>
          <ol>
            <li className="is-done">
              <span>
                <Check size={16} aria-hidden="true" />
              </span>
              <div>
                <strong>친구 모으기</strong>
                <small>그룹과 여행 멤버 연결</small>
              </div>
            </li>
            <li className={activeTrip.progress >= 35 ? "is-done" : "is-current"}>
              <span>{activeTrip.progress >= 35 ? <Check size={16} aria-hidden="true" /> : "2"}</span>
              <div>
                <strong>장소와 날짜 정하기</strong>
                <small>후보를 모으고 함께 투표</small>
              </div>
            </li>
            <li className={activeTrip.progress >= 70 ? "is-done" : "is-current"}>
              <span>{activeTrip.progress >= 70 ? <Check size={16} aria-hidden="true" /> : "3"}</span>
              <div>
                <strong>준비와 이동 맞추기</strong>
                <small>준비물, 식단, 차량을 한눈에</small>
              </div>
            </li>
            <li>
              <span>4</span>
              <div>
                <strong>회비 정산하기</strong>
                <small>결제자와 관계없이 전원이 균등 분담</small>
              </div>
            </li>
          </ol>
        </article>

        <article className="dashboard-trip-list-card">
          <div className="dashboard-section__heading">
            <div>
              <span className="dashboard-kicker">My trips</span>
              <h2>함께 준비 중인 여행</h2>
            </div>
            <Link to="/trips" aria-label="모든 여행 보기">
              전체보기 <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="dashboard-trip-list">
            {trips.data.slice(0, 3).map((trip, index) => (
              <Link to={`/trips/${trip.id}`} key={trip.id}>
                <span className={`dashboard-trip-list__number dashboard-trip-list__number--${index + 1}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{trip.title}</strong>
                  <small>
                    {formatDate(trip.startDate)} · {trip.regionText}
                  </small>
                </span>
                <span className="dashboard-trip-list__progress">{trip.progress}%</span>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
