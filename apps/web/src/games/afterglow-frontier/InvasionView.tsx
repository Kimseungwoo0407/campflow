import {
  Binoculars,
  Castle,
  ChevronRight,
  Coins,
  Crosshair,
  Eye,
  Gauge,
  RefreshCw,
  Shield,
  Swords,
} from "lucide-react";
import { Button } from "@campflow/ui";
import { DEFENSE_FACILITIES, DEFENSE_UNITS, HEROES } from "./game-data";
import type { MatchCandidate, TerritoryState } from "./types";

function number(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function InvasionView({
  territory,
  candidate,
  onNextTarget,
  onScout,
  onStart,
  notice,
}: {
  territory: TerritoryState;
  candidate: MatchCandidate;
  onNextTarget: () => void;
  onScout: () => void;
  onStart: () => void;
  notice: string;
}) {
  const facility = DEFENSE_FACILITIES[candidate.signatureFacility];
  const activeHero = HEROES[territory.activeHeroKey];
  return (
    <div className="af-view af-invasion-view">
      <section className="af-match-brief">
        <div className="af-match-radar" aria-hidden="true">
          <i />
          <span>
            <Castle />
          </span>
        </div>
        <div className="af-match-copy">
          <span>자동 매칭 완료</span>
          <h2>{candidate.callsign}</h2>
          <p>
            {candidate.league} · 최근 방어 성공률 {(candidate.recentDefenseRate * 100).toFixed(0)}%
          </p>
          <div className="af-grade-line">
            <b>방어 등급 {candidate.defenseGrade}</b>
            <span>권장 전투력 {number(candidate.power)}</span>
          </div>
        </div>
        <Button variant="secondary" onClick={onNextTarget}>
          <RefreshCw size={17} /> 대상 변경
        </Button>
      </section>

      <p className="af-live-notice" role="status" aria-live="polite">
        {notice}
      </p>

      <section className="af-intel-layout">
        <div className="af-intel-main">
          <article className="af-loot-preview">
            <div>
              <Coins />
              <span>예상 확보 보급</span>
              <strong>
                {number(candidate.estimatedLoot[0])}–{number(candidate.estimatedLoot[1])}
              </strong>
            </div>
            <small>완전 승리 기준 · 구간별 전리품은 체크포인트에서 확정</small>
          </article>
          <article className="af-battlefield-card">
            <Gauge />
            <div>
              <span>전장 속성</span>
              <strong>{candidate.battlefield}</strong>
            </div>
          </article>
          <section className="af-visible-defense">
            <header>
              <div>
                <span>제한 공개 정보</span>
                <h3>확인된 방어 전력</h3>
              </div>
              <Eye size={18} />
            </header>
            <div className="af-unit-intel-grid">
              {candidate.visibleUnits.map((key) => (
                <article key={key}>
                  {key === "slinger" ? <Crosshair /> : <Shield />}
                  <strong>{DEFENSE_UNITS[key].name}</strong>
                  <small>{DEFENSE_UNITS[key].role}</small>
                </article>
              ))}
              <article>
                <Castle />
                <strong>{facility.name}</strong>
                <small>{facility.role}</small>
              </article>
            </div>
          </section>
        </div>

        <aside className="af-scout-panel">
          <Binoculars />
          <span>추가 정찰</span>
          <h3>{candidate.scouted ? "숨겨진 정보 확인됨" : "불확실성을 줄이시겠습니까?"}</h3>
          <p>
            {candidate.scouted
              ? candidate.hiddenIntel
              : "함정 구역 하나와 긴급 웨이브 또는 수호자 교리 중 하나를 공개합니다."}
          </p>
          <Button
            variant="secondary"
            onClick={onScout}
            disabled={candidate.scouted || territory.battlePoints < 25}
          >
            <Binoculars size={17} /> {candidate.scouted ? "정찰 완료" : "25 인장으로 정찰"}
          </Button>
          <div className="af-cost-list">
            <span>
              <b>침략 행동력</b>
              <strong>1 / {territory.invasionEnergy}</strong>
            </span>
            <span>
              <b>준비 비용</b>
              <strong>30 / {number(territory.battlePoints)}</strong>
            </span>
            <span>
              <b>출전 지휘관</b>
              <strong>{activeHero.name}</strong>
            </span>
            <span>
              <b>공격 인구</b>
              <strong>최대 {10 + activeHero.populationBonus}</strong>
            </span>
          </div>
        </aside>
      </section>

      <section className="af-invasion-ready">
        <div>
          <Swords />
          <span>원정 준비 완료</span>
          <strong>실패해도 돌파 구간의 전리품과 숙련도는 남습니다.</strong>
        </div>
        <Button
          className="af-invasion-cta"
          onClick={onStart}
          disabled={territory.invasionEnergy < 1 || territory.battlePoints < 30}
        >
          침략 시작 <ChevronRight size={19} />
        </Button>
      </section>
    </div>
  );
}
