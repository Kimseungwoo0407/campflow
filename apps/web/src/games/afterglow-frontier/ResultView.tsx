import {
  Castle,
  ChevronRight,
  Coins,
  Gem,
  History,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@campflow/ui";
import type { BattleResultSummary } from "./types";

function label(result: BattleResultSummary): string {
  if (result.record.mode === "FRIENDLY") {
    if (result.record.outcome === "ATTACKER_WIN") return "친구의 방어선 돌파 완료";
    if (result.record.outcome === "RETREATED") return "친선 훈련을 마치고 철수했습니다";
    return result.record.reachedZone > 0
      ? "방어 약점을 확인한 모의전이었습니다"
      : "친구의 방어선이 이번 공세를 막았습니다";
  }
  if (result.record.outcome === "ATTACKER_WIN") return "성채 점령 완료";
  if (result.record.outcome === "RETREATED") return "전리품 확보 후 철수";
  if (result.record.reachedZone > 0) return "완전 승리는 놓쳤지만, 원정은 남았습니다";
  return "방어선에 저지되었습니다";
}

export function ResultView({
  result,
  onRetry,
  onRecords,
  onTerritory,
}: {
  result: BattleResultSummary;
  onRetry: () => void;
  onRecords: () => void;
  onTerritory: () => void;
}) {
  const successful = result.record.outcome === "ATTACKER_WIN";
  const isFriendly = result.record.mode === "FRIENDLY";
  return (
    <div className="af-view af-result-view">
      <section className={`af-result-hero ${successful ? "is-win" : ""}`}>
        <div className="af-result-mark">
          {successful ? (
            <Trophy />
          ) : result.record.outcome === "RETREATED" ? (
            <RotateCcw />
          ) : (
            <ShieldCheck />
          )}
        </div>
        <span>
          {isFriendly ? "친선전" : successful ? "완전 승리" : result.record.reachedZone > 0 ? "부분 성공" : "방어자 승리"}
        </span>
        <h2>{label(result)}</h2>
        <p>
          {result.record.opponent} · {result.record.duration}초 · 시드 {result.record.seed}
        </p>
      </section>
      <section className="af-result-stats">
        <article>
          <Castle />
          <span>돌파 구간</span>
          <strong>{result.record.reachedZone} / 5</strong>
        </article>
        <article>
          <Coins />
          <span>{isFriendly ? "약탈 규칙" : "약탈 보급"}</span>
          <strong>{isFriendly ? "없음" : `+${result.record.securedLoot}`}</strong>
        </article>
        <article>
          {isFriendly ? <Users /> : <Sparkles />}
          <span>{isFriendly ? "친선 전적" : "전술 인장"}</span>
          <strong>{isFriendly ? "기록 완료" : `+${result.rewardBattlePoints}`}</strong>
        </article>
        <article>
          <Gem />
          <span>성운 결정</span>
          <strong>+{result.rewardRareMaterials}</strong>
        </article>
        <article>
          <Ticket />
          <span>소환 인장</span>
          <strong>+{result.rewardRecruitSeals}</strong>
        </article>
      </section>
      <section className="af-result-breakdown">
        <header>
          <span>원정 분석</span>
          <strong>
            {isFriendly
              ? "리그 변동 없음"
              : `리그 점수 ${result.leagueDelta >= 0 ? "+" : ""}${result.leagueDelta}`}
          </strong>
        </header>
        <div>
          <span>파괴한 방어 시설</span>
          <strong>{result.record.destroyedFacilities}개</strong>
        </div>
        <div>
          <span>최종 도달 지점</span>
          <strong>
            {result.record.reachedZone === 5
              ? "잔광 중추"
              : `${result.record.reachedZone + 1}구역 입구`}
          </strong>
        </div>
        <div>
          <span>MVP 부대</span>
          <strong>{result.record.mvpUnit}</strong>
        </div>
        <div>
          <span>전리품 확정</span>
          <strong>{isFriendly ? "친선 규칙 · 지급 없음" : "체크포인트 보존 완료"}</strong>
        </div>
      </section>
      <div className="af-result-actions">
        <Button variant="secondary" onClick={onTerritory}>
          영지로
        </Button>
        <Button variant="secondary" onClick={onRecords}>
          <History size={17} /> 리플레이
        </Button>
        <Button onClick={onRetry}>
          {isFriendly ? "다른 친구 선택" : "다른 상대 찾기"} <ChevronRight size={18} />
        </Button>
      </div>
    </div>
  );
}
