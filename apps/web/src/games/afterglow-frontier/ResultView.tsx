import {
  Castle,
  ChevronRight,
  Coins,
  Gem,
  History,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Button } from "@campflow/ui";
import type { BattleResultSummary } from "./types";

function label(result: BattleResultSummary): string {
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
          {successful ? "완전 승리" : result.record.reachedZone > 0 ? "부분 성공" : "방어자 승리"}
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
          <span>약탈 보급</span>
          <strong>+{result.record.securedLoot}</strong>
        </article>
        <article>
          <Sparkles />
          <span>전술 인장</span>
          <strong>+{result.rewardBattlePoints}</strong>
        </article>
        <article>
          <Gem />
          <span>성운 결정</span>
          <strong>+{result.rewardRareMaterials}</strong>
        </article>
      </section>
      <section className="af-result-breakdown">
        <header>
          <span>원정 분석</span>
          <strong>
            리그 점수 {result.leagueDelta >= 0 ? "+" : ""}
            {result.leagueDelta}
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
          <strong>체크포인트 보존 완료</strong>
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
          다른 상대 찾기 <ChevronRight size={18} />
        </Button>
      </div>
    </div>
  );
}
