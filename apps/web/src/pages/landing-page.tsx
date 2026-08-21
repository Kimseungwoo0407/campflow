import {
  ArrowRight,
  CalendarCheck,
  Check,
  CircleDollarSign,
  Clock3,
  Compass,
  ListChecks,
  MapPinned,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  TentTree,
  Users,
  Vote,
} from "lucide-react";
import { Link } from "react-router-dom";

const tripFlow = [
  {
    icon: Vote,
    step: "01",
    title: "후보를 모으고",
    copy: "장소와 날짜를 한곳에 올리고, 친구들과 바로 투표해요.",
    accent: "coral",
  },
  {
    icon: ListChecks,
    step: "02",
    title: "준비를 나누고",
    copy: "장보기, 차량, 식단, 준비물을 담당자와 일정으로 정리해요.",
    accent: "blue",
  },
  {
    icon: CircleDollarSign,
    step: "03",
    title: "회비를 똑같이",
    copy: "결제자는 기록만 남기고, 총지출은 모든 멤버가 균등 부담해요.",
    accent: "green",
  },
] as const;

function scrollToFlow() {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  document.getElementById("landing-flow")?.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
    block: "start",
  });
}

export function LandingPage() {
  return (
    <main className="landing">
      <header className="landing-header">
        <nav className="landing-nav" aria-label="홈페이지 메뉴">
          <Link className="landing-brand" to="/" aria-label="CampFlow 홈">
            <span className="landing-brand__mark" aria-hidden="true">
              <TentTree size={22} strokeWidth={2.2} />
            </span>
            <span>CampFlow</span>
          </Link>
          <div className="landing-nav__actions">
            <Link className="landing-nav__login" to="/login">
              친구 계정 로그인
            </Link>
            <Link className="button landing-button landing-button--dark" to="/login">
              데모 시작하기
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__copy">
          <span className="landing-kicker">
            <Sparkles size={16} aria-hidden="true" />
            친구 넷의 여행 준비, 한 화면에서
          </span>
          <h1 id="landing-title">
            단톡방에 흩어진 여행,
            <br />
            이제 <em>한 흐름으로.</em>
          </h1>
          <p>
            장소 투표부터 준비물, 일정, 차량, 회비 정산까지. 말만 오가던 여행 계획을 모두가 확인하고
            함께 끝내는 공간이에요.
          </p>
          <div className="landing-hero__actions">
            <Link className="button landing-button landing-button--primary" to="/login">
              여행 보드 둘러보기
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <button
              className="button landing-button landing-button--quiet"
              type="button"
              onClick={scrollToFlow}
            >
              어떻게 쓰나요?
            </button>
          </div>
          <ul className="landing-hero__proof" aria-label="CampFlow 주요 특징">
            <li>
              <Check size={15} aria-hidden="true" /> 무료 데모
            </li>
            <li>
              <Check size={15} aria-hidden="true" /> 모바일 지원
            </li>
            <li>
              <Check size={15} aria-hidden="true" /> 친구별 계정
            </li>
          </ul>
        </div>

        <div className="landing-preview" aria-label="CampFlow 여행 보드 미리보기">
          <div className="landing-preview__topbar">
            <span className="landing-preview__brand">
              <TentTree size={16} aria-hidden="true" /> CampFlow
            </span>
            <span className="landing-preview__live">
              <i aria-hidden="true" /> 여행 준비 중
            </span>
          </div>

          <div className="landing-preview__trip">
            <div>
              <span>다가오는 여행</span>
              <strong>우리 넷의 여름 글램핑</strong>
              <small>
                <CalendarCheck size={14} aria-hidden="true" /> 8월 29일 — 30일
              </small>
            </div>
            <div className="landing-avatar-stack" aria-label="참여자 4명">
              <i>승</i>
              <i>훈</i>
              <i>진</i>
              <i>윤</i>
            </div>
          </div>

          <div className="landing-progress" aria-label="여행 준비율 78%">
            <div>
              <span>여행 준비율</span>
              <strong>78%</strong>
            </div>
            <span className="landing-progress__track" aria-hidden="true">
              <i />
            </span>
          </div>

          <div className="landing-preview__grid">
            <article className="landing-mini-card landing-mini-card--place">
              <span className="landing-mini-card__icon">
                <MapPinned size={18} aria-hidden="true" />
              </span>
              <small>장소 투표</small>
              <strong>숲속 글램핑장</strong>
              <span className="landing-mini-card__meta">4명 모두 찬성</span>
            </article>
            <article className="landing-mini-card landing-mini-card--task">
              <span className="landing-mini-card__icon">
                <ListChecks size={18} aria-hidden="true" />
              </span>
              <small>오늘의 준비</small>
              <strong>장보기 목록 확정</strong>
              <span className="landing-mini-card__meta">7개 중 5개 완료</span>
            </article>
            <article className="landing-mini-card landing-mini-card--settlement">
              <div>
                <span className="landing-mini-card__icon">
                  <CircleDollarSign size={18} aria-hidden="true" />
                </span>
                <small>회비 정산</small>
              </div>
              <strong>총지출 454,500원</strong>
              <span>4명 모두 · 1인 113,625원</span>
            </article>
          </div>

          <div className="landing-float-note" aria-hidden="true">
            <MessageCircle size={17} />
            <span>
              <strong>경윤</strong> 준비물 체크했어!
            </span>
          </div>
        </div>
      </section>

      <section className="landing-signal" aria-label="CampFlow가 정리하는 여행 정보">
        <span>장소 후보</span>
        <i aria-hidden="true" />
        <span>실시간 투표</span>
        <i aria-hidden="true" />
        <span>준비물 담당</span>
        <i aria-hidden="true" />
        <span>4인 균등 정산</span>
      </section>

      <section className="landing-section landing-flow" id="landing-flow">
        <div className="landing-section__heading">
          <span className="landing-kicker">여행 준비의 새로운 순서</span>
          <h2>말은 줄이고, 결정은 남겨요.</h2>
          <p>누가 무엇을 해야 하는지 찾느라 단톡방을 위로 올릴 필요가 없어요.</p>
        </div>
        <div className="landing-flow__grid">
          {tripFlow.map(({ icon: Icon, step, title, copy, accent }) => (
            <article className={`landing-flow-card landing-flow-card--${accent}`} key={step}>
              <span className="landing-flow-card__step">STEP {step}</span>
              <span className="landing-flow-card__icon">
                <Icon size={24} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-showcase" aria-labelledby="showcase-title">
        <div className="landing-section__heading landing-section__heading--left">
          <span className="landing-kicker">한 여행, 하나의 기준</span>
          <h2 id="showcase-title">친구 모두가 같은 화면을 봐요.</h2>
        </div>
        <div className="landing-bento">
          <article className="landing-bento__main">
            <div className="landing-bento__copy">
              <span className="landing-bento__icon">
                <Compass size={22} aria-hidden="true" />
              </span>
              <h3>처음부터 끝까지 이어지는 여행 타임라인</h3>
              <p>후보 탐색, 투표, 일정 확정, 준비, 여행 중 기록, 정산이 끊기지 않아요.</p>
            </div>
            <ol className="landing-timeline" aria-label="여행 진행 단계">
              <li className="is-done">
                <Check size={14} aria-hidden="true" /> 후보 찾기
              </li>
              <li className="is-done">
                <Check size={14} aria-hidden="true" /> 투표 완료
              </li>
              <li className="is-current">
                <Clock3 size={14} aria-hidden="true" /> 준비 중
              </li>
              <li>여행 시작</li>
              <li>회비 정산</li>
            </ol>
          </article>

          <article className="landing-bento__card landing-bento__card--people">
            <span className="landing-bento__icon">
              <Users size={22} aria-hidden="true" />
            </span>
            <h3>역할은 선명하게</h3>
            <p>담당자와 마감일이 보여서 서로 눈치 볼 일이 줄어요.</p>
            <div className="landing-assignees" aria-hidden="true">
              <span>승우 · 차량</span>
              <span>기훈 · 장보기</span>
              <span>성진 · 준비물</span>
            </div>
          </article>

          <article className="landing-bento__card landing-bento__card--safe">
            <span className="landing-bento__icon">
              <ShieldCheck size={22} aria-hidden="true" />
            </span>
            <h3>우리끼리 안전하게</h3>
            <p>친구별 계정과 권한으로 우리 모임 정보만 나눠요.</p>
            <span className="landing-security-pill">
              <i aria-hidden="true" /> 멤버 4명 연결됨
            </span>
          </article>
        </div>
      </section>

      <section className="landing-cta" aria-labelledby="landing-cta-title">
        <div>
          <span className="landing-kicker landing-kicker--light">다음 여행은 더 가볍게</span>
          <h2 id="landing-cta-title">친구를 모았다면, 준비는 CampFlow에서.</h2>
          <p>데모 여행을 열어 실제 일정과 정산 흐름을 바로 확인해 보세요.</p>
        </div>
        <Link className="button landing-button landing-button--light" to="/login">
          데모 여행 입장하기
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>

      <footer className="landing-footer">
        <Link className="landing-brand" to="/" aria-label="CampFlow 홈">
          <span className="landing-brand__mark" aria-hidden="true">
            <TentTree size={20} />
          </span>
          <span>CampFlow</span>
        </Link>
        <p>친구들과 함께 완성하는 여행 플래너</p>
        <Link to="/login">로그인</Link>
      </footer>
    </main>
  );
}
