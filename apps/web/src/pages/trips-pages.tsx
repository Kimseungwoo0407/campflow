import {
  ArrowRight,
  Car,
  CalendarDays,
  CheckCircle2,
  Coins,
  ListChecks,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Route,
  Utensils,
  Vote,
  Trophy,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import type { TripRole, TripStatus } from "@campflow/contracts";
import { Button, Card, EmptyState, Spinner } from "@campflow/ui";
import { apiRequest } from "../api/client";

export interface TripSummary {
  id: string;
  title: string;
  purpose: string | null;
  status: TripStatus;
  startDate: string;
  endDate: string;
  regionText: string;
  budgetPerPerson: number | null;
  attendeeCount: number;
  memberCount: number;
  progress: number;
  datesLocked: boolean;
  myRole: TripRole;
  group: { id: string; name: string };
}

interface TripDetail extends Omit<TripSummary, "memberCount"> {
  version: number;
  nights: number;
  members: Array<{
    role: TripRole;
    attendanceStatus: string;
    isCoreMember: boolean;
    user: {
      id: string;
      username: string | null;
      nickname: string;
      profile: {
        canDrive: boolean;
        allergies: string[];
        foodDislikes: string[];
      } | null;
    };
  }>;
  decisions: Array<{
    id: string;
    decisionType: string;
    reason: string | null;
    createdAt: string;
  }>;
}

interface CharacterProfile {
  userId: string;
  concept: string;
  reason: string;
}

function CharacterAvatar({
  tripId,
  userId,
  fallback,
}: {
  tripId: string;
  userId: string;
  fallback: string;
}) {
  const image = useQuery({
    queryKey: ["character-content", tripId, userId],
    queryFn: () =>
      apiRequest<{ mime: string; dataBase64: string }>(
        `trips/${tripId}/characters/${userId}/content`,
      ),
    retry: false,
  });
  if (!image.data) {
    return (
      <span className="member-card__avatar" aria-hidden="true">
        {fallback}
      </span>
    );
  }
  return (
    <img
      className="member-card__avatar member-card__avatar--image"
      src={`data:${image.data.mime};base64,${image.data.dataBase64}`}
      alt=""
    />
  );
}

const statusCopy: Record<TripStatus, string> = {
  DRAFT: "초안",
  SEARCHING: "장소 찾기",
  VOTING: "후보 투표",
  CONFIRMED: "여행 확정",
  IN_PROGRESS: "여행 중",
  SETTLING: "정산 중",
  ARCHIVED: "완료",
};

const steps: Array<{ status: TripStatus; label: string }> = [
  { status: "SEARCHING", label: "장소" },
  { status: "VOTING", label: "투표" },
  { status: "CONFIRMED", label: "일정·준비" },
  { status: "IN_PROGRESS", label: "여행" },
  { status: "SETTLING", label: "정산" },
  { status: "ARCHIVED", label: "완료" },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatMoney(value: number | null): string {
  return value === null ? "미정" : `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export function TripsPage() {
  const trips = useQuery({
    queryKey: ["trips"],
    queryFn: () => apiRequest<TripSummary[]>("trips"),
  });

  return (
    <div className="page">
      <header className="page-heading">
        <span className="eyebrow">확정된 여행</span>
        <h1>내 여행</h1>
        <p>장소 선정부터 정산까지 한 여행 안에서 이어서 준비합니다.</p>
      </header>
      {trips.isPending && <Spinner label="여행 불러오는 중" />}
      {trips.isError && (
        <div className="state-panel state-panel--error" role="alert">
          <p>{trips.error.message}</p>
          <Button variant="secondary" onClick={() => void trips.refetch()}>
            다시 시도
          </Button>
        </div>
      )}
      {trips.data?.length === 0 && (
        <EmptyState title="아직 참여 중인 여행이 없어요">
          그룹 소유자가 그룹 화면에서 여행을 만들 수 있습니다.
        </EmptyState>
      )}
      <div className="trip-list">
        {trips.data?.map((trip) => (
          <Link className="trip-card" to={`/trips/${trip.id}`} key={trip.id}>
            <div className="trip-card__top">
              <span className="badge">{statusCopy[trip.status]}</span>
              <strong>{trip.progress}%</strong>
            </div>
            <h2>{trip.title}</h2>
            <p>{trip.purpose || "여행 설명이 아직 없습니다."}</p>
            <div className="trip-card__facts">
              <span>
                <CalendarDays size={16} />
                {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
              </span>
              <span>
                <MapPin size={16} />
                {trip.regionText}
              </span>
              <span>
                <Users size={16} />
                {trip.memberCount}명
              </span>
            </div>
            <progress
              value={trip.progress}
              max={100}
              aria-label={`여행 진행률 ${trip.progress}%`}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function TripDetailPage() {
  const { tripId } = useParams();
  const trip = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => apiRequest<TripDetail>(`trips/${tripId ?? ""}`),
    enabled: Boolean(tripId),
  });
  const characters = useQuery({
    queryKey: ["characters", tripId],
    queryFn: () => apiRequest<CharacterProfile[]>(`trips/${tripId ?? ""}/characters`),
    enabled: Boolean(tripId),
    retry: false,
  });

  if (trip.isPending) {
    return (
      <div className="page">
        <Spinner label="여행 대시보드 불러오는 중" />
      </div>
    );
  }
  if (trip.isError || !trip.data) {
    return (
      <div className="page state-panel state-panel--error" role="alert">
        <h1>여행을 열 수 없습니다</h1>
        <p>{trip.error?.message ?? "접근 권한과 서버 상태를 확인해 주세요."}</p>
        <Button variant="secondary" onClick={() => void trip.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }

  const currentIndex = steps.findIndex((step) => step.status === trip.data.status);
  return (
    <div className="page trip-workspace">
      <header className="trip-hero">
        <div>
          <span className="eyebrow">{trip.data.group.name}</span>
          <h1>{trip.data.title}</h1>
          <p>{trip.data.purpose}</p>
          <div className="trip-hero__facts">
            <span>
              <CalendarDays size={18} />
              {formatDate(trip.data.startDate)} – {formatDate(trip.data.endDate)}
            </span>
            <span>
              <MapPin size={18} />
              {trip.data.regionText}
            </span>
            <span>
              <Users size={18} />
              {trip.data.members.length}명
            </span>
          </div>
        </div>
        <div className="trip-hero__status">
          <span>{statusCopy[trip.data.status]}</span>
          <strong>{trip.data.progress}%</strong>
          <progress value={trip.data.progress} max={100} />
        </div>
      </header>

      <ol className="trip-stepper" aria-label="여행 진행 단계">
        {steps.map((step, index) => (
          <li
            key={step.status}
            className={index <= currentIndex ? "trip-stepper__active" : ""}
            aria-current={step.status === trip.data.status ? "step" : undefined}
          >
            <span>{index < currentIndex ? <CheckCircle2 size={17} /> : index + 1}</span>
            {step.label}
          </li>
        ))}
      </ol>

      <div className="trip-dashboard-grid">
        <Card className="trip-decision-card trip-decision-card--primary">
          <span className="badge">지금 할 일</span>
          <h2>글램핑 장소 후보 모으기</h2>
          <p>가평 지역 샘플과 직접 등록한 장소를 비교하고 친구들과 투표하세요.</p>
          <Link className="button button--primary" to={`/trips/${trip.data.id}/discover`}>
            장소 찾기
            <ArrowRight size={17} />
          </Link>
        </Card>
        <Card className="trip-decision-card">
          <LockKeyhole />
          <span>확정 일정</span>
          <h2>8월 29일 – 30일</h2>
          <p>요청에 따라 1박 2일 일정이 잠겨 있습니다.</p>
          <small>Asia/Seoul · 날짜 설문 생략</small>
        </Card>
        <Card className="trip-decision-card">
          <span>1인 목표 예산</span>
          <h2>{formatMoney(trip.data.budgetPerPerson)}</h2>
          <p>숙박·교통·식비·활동비를 합쳐 진행 상황을 계산합니다.</p>
        </Card>
      </div>

      <section>
        <h2 className="section-title">여행 준비 바로가기</h2>
        <div className="trip-module-grid">
          {[
            { path: "polls", label: "투표", copy: "친구들과 빠르게 결정", icon: Vote },
            { path: "itinerary", label: "일정", copy: "1박 2일 타임라인", icon: Route },
            { path: "tasks", label: "준비물", copy: "담당자와 완료 체크", icon: ListChecks },
            { path: "meals", label: "식단", copy: "메뉴와 장보기 자동 합산", icon: Utensils },
            { path: "transport", label: "차량", copy: "운전자와 탑승자 배정", icon: Car },
            { path: "expenses", label: "정산", copy: "1원 단위 더치페이", icon: Coins },
            { path: "points", label: "포인트", copy: "출석·게임·권한 상점", icon: Trophy },
            {
              path: "board",
              label: "게시판",
              copy: "공지와 질문 모아보기",
              icon: MessageSquareText,
            },
          ].map(({ path, label, copy, icon: Icon }) => (
            <Link className="trip-module-card" to={`/trips/${trip.data.id}/${path}`} key={path}>
              <Icon size={21} />
              <span>
                <strong>{label}</strong>
                <small>{copy}</small>
              </span>
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">참여 멤버</h2>
        <div className="member-list member-list--compact">
          {trip.data.members.map((member) => (
            <Card
              className="member-card member-card--character"
              key={member.user.id}
              title={characters.data?.find((profile) => profile.userId === member.user.id)?.reason}
            >
              <CharacterAvatar
                tripId={trip.data.id}
                userId={member.user.id}
                fallback={member.user.nickname.slice(0, 1)}
              />
              <span className="member-card__body">
                <strong>{member.user.nickname}</strong>
                <small>{member.role === "MANAGER" ? "여행 관리자" : "참여자"}</small>
                {characters.data?.find((profile) => profile.userId === member.user.id) && (
                  <small className="member-card__concept">
                    {characters.data.find((profile) => profile.userId === member.user.id)?.concept}
                  </small>
                )}
              </span>
              <span className="member-card__flags">
                {member.user.profile?.canDrive && <i>운전 가능</i>}
                {(member.user.profile?.allergies.length ?? 0) > 0 && <i>알레르기 확인</i>}
              </span>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
