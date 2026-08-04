import { Clock3, History, RefreshCw } from "lucide-react";
import type { GameRound, GameRoundHistory } from "./points-shared";

function ladderPattern(round: GameRound): string {
  const { startSide, rungCount, answer } = round.result;
  if (
    (startSide === "LEFT" || startSide === "RIGHT") &&
    (rungCount === 3 || rungCount === 4) &&
    (answer === "ODD" || answer === "EVEN")
  ) {
    return `${startSide === "LEFT" ? "좌" : "우"}${rungCount}${answer === "ODD" ? "홀" : "짝"}`;
  }
  return "패턴 확인 불가";
}

export function LadderHistoryPanel({
  history,
  loading,
  error,
  onRetry,
}: {
  history: GameRoundHistory | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <aside className="ladder-history-panel" aria-label="홀짝 사다리 누적 기록">
      <header>
        <div>
          <History aria-hidden="true" />
          <span>누적 기록</span>
        </div>
        <strong>{history ? `총 ${history.total.toLocaleString("ko-KR")}회` : "—"}</strong>
      </header>

      {loading ? (
        <div className="ladder-history-state" role="status">
          <RefreshCw className="is-spinning" />
          <strong>기록을 불러오는 중</strong>
        </div>
      ) : error ? (
        <div className="ladder-history-state" role="alert">
          <RefreshCw />
          <strong>기록을 불러오지 못했습니다</strong>
          <span>{error}</span>
          <button type="button" onClick={onRetry}>
            다시 시도
          </button>
        </div>
      ) : !history || history.items.length === 0 ? (
        <div className="ladder-history-state">
          <Clock3 />
          <strong>아직 사다리 기록이 없습니다</strong>
          <span>첫 판을 완료하면 이곳에 결과가 쌓입니다.</span>
        </div>
      ) : (
        <>
          <ol className="ladder-history-list">
            {history.items.map((round, index) => {
              const roundNumber = history.total - index;
              return (
                <li key={round.id}>
                  <span>{roundNumber.toLocaleString("ko-KR")}회차</span>
                  <strong>{ladderPattern(round)}</strong>
                </li>
              );
            })}
          </ol>
          {history.total > history.limit && (
            <p className="ladder-history-limit">
              최근 {history.limit}건 표시 · 전체 {history.total.toLocaleString("ko-KR")}회
            </p>
          )}
        </>
      )}
    </aside>
  );
}
