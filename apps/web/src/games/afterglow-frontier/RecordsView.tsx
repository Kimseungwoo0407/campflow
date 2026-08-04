import {
  Castle,
  ChevronRight,
  Clock3,
  Coins,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import type { BattleRecord } from "./types";

const commandNames: Record<string, string> = {
  MOVE_FORWARD: "영웅 전진",
  MOVE_BACK: "영웅 후퇴",
  BASIC_ATTACK: "기본 공격",
  SKILL_RALLY: "진군 신호",
  SKILL_MEND: "응급 맥동",
  ULTIMATE: "새벽 균열",
  SUMMON: "부대 소환",
  FOCUS: "집중 공격 전환",
  RETREAT: "전략 철수",
};

function outcomeLabel(record: BattleRecord): string {
  if (record.outcome === "ATTACKER_WIN") return "완전 승리";
  if (record.outcome === "RETREATED") return "전략 철수";
  return record.reachedZone > 0 ? "부분 성공" : "방어 저지";
}

export function RecordsView({
  records,
  selected,
  onSelect,
  onFindTarget,
}: {
  records: BattleRecord[];
  selected: BattleRecord | null;
  onSelect: (record: BattleRecord | null) => void;
  onFindTarget: () => void;
}) {
  if (selected) {
    return (
      <div className="af-view af-replay-view">
        <button className="af-text-back" type="button" onClick={() => onSelect(null)}>
          <RotateCcw /> 전투 기록으로
        </button>
        <section className="af-replay-hero">
          <div>
            <span>결정론적 입력 리플레이</span>
            <h2>{selected.opponent} {selected.mode === "FRIENDLY" ? "친선전" : "침략"}</h2>
            <p>
              시드 {selected.seed} · 입력 {selected.commands.length}개 · 영상 파일 미저장
            </p>
          </div>
          <div className={`af-result-seal is-${selected.outcome.toLowerCase()}`}>
            <PlayCircle />
            <strong>{outcomeLabel(selected)}</strong>
          </div>
        </section>
        <section className="af-replay-summary">
          <article>
            <Clock3 />
            <span>전투 시간</span>
            <strong>{selected.duration}초</strong>
          </article>
          <article>
            <Castle />
            <span>최종 도달</span>
            <strong>{selected.reachedZone}구역</strong>
          </article>
          <article>
            {selected.mode === "FRIENDLY" ? <Users /> : <Coins />}
            <span>{selected.mode === "FRIENDLY" ? "전투 유형" : "확보 전리품"}</span>
            <strong>{selected.mode === "FRIENDLY" ? "친선전" : selected.securedLoot}</strong>
          </article>
          <article>
            <Trophy />
            <span>MVP 부대</span>
            <strong>{selected.mvpUnit}</strong>
          </article>
        </section>
        <section className="af-replay-timeline">
          <header>
            <span>명령 이벤트 로그</span>
            <strong>밸런스 mvp-2026.08.04.3</strong>
          </header>
          {selected.commands.length === 0 ? (
            <p>기록된 조작 명령이 없습니다.</p>
          ) : (
            <ol>
              {selected.commands.map((command) => (
                <li key={command.sequence}>
                  <time>{command.at.toFixed(1)}s</time>
                  <i />
                  <div>
                    <strong>{commandNames[command.kind] ?? command.kind}</strong>
                    {command.payload && <small>{command.payload}</small>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="af-view af-records-view">
      <section className="af-records-heading">
        <div>
          <span>침략·방어 기록</span>
          <h2>패배 원인을 보고 다음 원정을 바꾸세요</h2>
          <p>최근 20건의 입력 로그를 이 브라우저에 보관합니다.</p>
        </div>
        <button type="button" onClick={onFindTarget}>
          <Swords /> 새 침략 찾기 <ChevronRight />
        </button>
      </section>
      {records.length === 0 ? (
        <section className="af-empty-records">
          <ShieldCheck />
          <h3>아직 전투 기록이 없습니다</h3>
          <p>첫 침략을 시작하면 돌파 구간과 입력 리플레이가 여기에 저장됩니다.</p>
          <button type="button" onClick={onFindTarget}>
            첫 상대 탐색
          </button>
        </section>
      ) : (
        <div className="af-record-list">
          {records.map((record) => (
            <button type="button" key={record.id} onClick={() => onSelect(record)}>
              <span className={`af-record-icon is-${record.outcome.toLowerCase()}`}>
                {record.outcome === "ATTACKER_WIN" ? (
                  <Trophy />
                ) : record.outcome === "RETREATED" ? (
                  <RotateCcw />
                ) : (
                  <ShieldCheck />
                )}
              </span>
              <div>
                <small>
                  {new Intl.DateTimeFormat("ko-KR", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(record.completedAt))}
                </small>
                <strong>
                  {record.opponent}
                  {record.mode === "FRIENDLY" && <em className="af-friendly-badge">친선</em>}
                </strong>
                <span>
                  {outcomeLabel(record)} · {record.reachedZone}구역 도달
                </span>
              </div>
              <b>{record.mode === "FRIENDLY" ? "전적 기록" : `+${record.securedLoot} 보급`}</b>
              <ChevronRight />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
