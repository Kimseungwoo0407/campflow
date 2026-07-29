import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Coins,
  Gamepad2,
  MapPinned,
  MessageCircle,
  ShieldCheck,
  Trophy,
  Vote,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@campflow/ui";
import { apiRequest } from "../api/client";
import type { TripSummary } from "./trips-pages";

const activityRules = [
  ["출석", "포인트 화면에서 하루 한 번 출석하면 기본 20P를 받습니다."],
  ["장소", "새 장소 등록 15P, 후보 등록 10P를 받습니다."],
  ["의견", "처음 투표하면 5P, 게시글은 8P, 댓글은 4P를 받습니다."],
  ["준비", "일정 등록 5P, 할 일을 처음 완료하면 6P, 지출 등록은 3P입니다."],
] as const;

export function GuidePage() {
  const trips = useQuery({
    queryKey: ["trips"],
    queryFn: () => apiRequest<TripSummary[]>("trips"),
  });
  const trip = trips.data?.[0];
  const tripPath = trip ? `/trips/${trip.id}` : "/trips";
  const pointsPath = trip ? `/trips/${trip.id}/points` : "/trips";

  return (
    <div className="page guide-page">
      <header className="page-heading page-heading--split">
        <div>
          <span className="eyebrow">CampFlow 사용 가이드</span>
          <h1>로그인한 뒤에는 이렇게 사용하세요</h1>
          <p>
            네 명 모두 0P에서 시작합니다. 여행 준비 활동으로 포인트를 모으고, 같은 여행 안에서
            순위·아이템·미니게임을 함께 즐기면 됩니다.
          </p>
        </div>
        <Link className="button button--primary" to={tripPath}>
          여행으로 이동
          <ArrowRight size={18} />
        </Link>
      </header>

      <section className="guide-start">
        <div>
          <span>가장 먼저</span>
          <h2>내 여행에서 8월 29~30일 여행을 여세요</h2>
          <p>
            이미 친구 네 명과 날짜가 등록되어 있습니다. 회원가입이나 새 그룹 만들기는 필요하지
            않습니다.
          </p>
        </div>
        <CalendarDays size={38} aria-hidden="true" />
      </section>

      <section className="guide-flow" aria-label="기본 이용 순서">
        <Card className="guide-step">
          <b>1</b>
          <MapPinned aria-hidden="true" />
          <h2>장소 후보 모으기</h2>
          <p>발견 탭에서 숙소·식당·관광지를 등록하고 후보 보드에 올립니다.</p>
          <Link to={trip ? `${tripPath}/discover` : "/trips"}>
            장소 화면 <ArrowRight size={15} />
          </Link>
        </Card>
        <Card className="guide-step">
          <b>2</b>
          <Vote aria-hidden="true" />
          <h2>투표하고 일정 확정</h2>
          <p>후보를 두고 투표한 뒤 일정표에 시간과 담당자를 기록합니다.</p>
          <Link to={trip ? `${tripPath}/polls` : "/trips"}>
            투표 화면 <ArrowRight size={15} />
          </Link>
        </Card>
        <Card className="guide-step">
          <b>3</b>
          <MessageCircle aria-hidden="true" />
          <h2>준비 내용 공유</h2>
          <p>게시글·댓글·채팅, 할 일·식단·차량·비용 메뉴를 함께 채웁니다.</p>
          <Link to={trip ? `${tripPath}/board` : "/trips"}>
            게시판 화면 <ArrowRight size={15} />
          </Link>
        </Card>
        <Card className="guide-step">
          <b>4</b>
          <Coins aria-hidden="true" />
          <h2>포인트 사용하기</h2>
          <p>활동과 출석으로 모은 포인트를 상점·게임·승부차기에 사용합니다.</p>
          <Link to={pointsPath}>
            포인트 화면 <ArrowRight size={15} />
          </Link>
        </Card>
      </section>

      <section className="guide-detail-grid">
        <Card className="guide-panel">
          <div className="guide-panel__heading">
            <Trophy aria-hidden="true" />
            <div>
              <span>포인트 적립</span>
              <h2>많이 준비할수록 쌓입니다</h2>
            </div>
          </div>
          <div className="guide-rule-list">
            {activityRules.map(([title, description]) => (
              <div key={title}>
                <CheckCircle2 size={18} aria-hidden="true" />
                <p>
                  <strong>{title}</strong>
                  <span>{description}</span>
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="guide-panel">
          <div className="guide-panel__heading">
            <Gamepad2 aria-hidden="true" />
            <div>
              <span>게임과 상점</span>
              <h2>결과는 모두에게 공유됩니다</h2>
            </div>
          </div>
          <ul className="guide-list">
            <li>홀짝·달팽이·짱깸보는 걸 포인트를 먼저 정한 뒤 서버가 결과를 냅니다.</li>
            <li>로또는 화면에 표시된 세부 확률 그대로 정수 가중치로 추첨합니다.</li>
            <li>
              승부차기는 먼저 찰지 막을지와 방향을 숨겨 예약하고, 상대가 참가하면 방향을 공개해
              승패와 포인트를 정산합니다.
            </li>
            <li>보유 포인트 순위와 누적 활동 순위는 별도로 표시됩니다.</li>
          </ul>
        </Card>

        <Card className="guide-panel guide-panel--safe">
          <div className="guide-panel__heading">
            <ShieldCheck aria-hidden="true" />
            <div>
              <span>꼭 지킬 규칙</span>
              <h2>현금 없는 친구들끼리의 놀이입니다</h2>
            </div>
          </div>
          <ul className="guide-list">
            <li>포인트는 구매·현금화·환전·외부 양도가 불가능합니다.</li>
            <li>다른 사람의 포인트를 낮추는 아이템은 상점 가격과 효과가 공개됩니다.</li>
            <li>음주 관련 권한은 상대방 동의가 필요하며 거부나 무알코올 대체가 가능합니다.</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
