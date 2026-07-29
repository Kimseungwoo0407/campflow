import { ArrowRight, CalendarCheck, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <main className="landing">
      <nav className="landing__nav">
        <a className="brand" href="#/">
          <span className="brand__mark" aria-hidden="true">
            △
          </span>
          CampFlow
        </a>
        <div>
          <Link className="text-link" to="/login">
            로그인
          </Link>
          <Link className="button button--primary" to="/signup">
            시작하기
          </Link>
        </div>
      </nav>
      <section className="hero">
        <div className="hero__content">
          <span className="eyebrow">
            <Sparkles size={16} aria-hidden="true" />
            흩어진 대화를 하나의 여행으로
          </span>
          <h1>
            날짜부터 정산까지,
            <br />
            친구들과 <em>한곳에서.</em>
          </h1>
          <p>
            글램핑 장소를 함께 고르고, 준비할 일을 나누고, 마지막 1원까지 깔끔하게
            정리하세요.
          </p>
          <div className="hero__actions">
            <Link className="button button--primary button--large" to="/signup">
              우리 모임 만들기
              <ArrowRight size={18} />
            </Link>
            <Link className="button button--secondary button--large" to="/login">
              데모 계정으로 보기
            </Link>
          </div>
          <small>외부 API 키 없이도 개발용 Mock Provider로 시작할 수 있습니다.</small>
        </div>
        <div className="hero__visual" aria-label="여행 준비 흐름 미리보기">
          <div className="camp-card camp-card--date">
            <CalendarCheck aria-hidden="true" />
            <span>날짜 합의</span>
            <strong>8월 15일 — 16일</strong>
            <small>3명 모두 가능</small>
          </div>
          <div className="camp-card camp-card--group">
            <Users aria-hidden="true" />
            <span>주말엔 밖으로</span>
            <div className="avatar-row" aria-label="참여자 3명">
              <i>캠</i>
              <i>불</i>
              <i>별</i>
            </div>
          </div>
          <div className="hero__tent" aria-hidden="true">
            <span>△</span>
          </div>
        </div>
      </section>
      <section className="trust-strip" aria-label="CampFlow 원칙">
        <div>
          <ShieldCheck aria-hidden="true" />
          <span>내 PC에 보관하는 여행 데이터</span>
        </div>
        <div>
          <CalendarCheck aria-hidden="true" />
          <span>의사결정이 보이는 협업 흐름</span>
        </div>
        <div>
          <Users aria-hidden="true" />
          <span>친구마다 분리된 계정과 권한</span>
        </div>
      </section>
    </main>
  );
}
