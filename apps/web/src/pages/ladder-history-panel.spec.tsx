import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LadderHistoryPanel } from "./ladder-history-panel";

describe("사다리 누적 기록", () => {
  afterEach(() => cleanup());

  it("기존 라운드를 최신순 패널로 표시한다", () => {
    render(
      <LadderHistoryPanel
        loading={false}
        error={null}
        onRetry={() => undefined}
        history={{
          total: 2,
          limit: 50,
          items: [
            {
              id: "round-2",
              gameType: "ODD_EVEN",
              wager: 20,
              score: null,
              pointDelta: 38,
              result: { won: true, startSide: "LEFT", rungCount: 4, answer: "ODD" },
              createdAt: "2026-08-04T06:00:00.000Z",
              user: { id: "user-1", nickname: "불멍이" },
            },
            {
              id: "round-1",
              gameType: "ODD_EVEN",
              wager: 10,
              score: null,
              pointDelta: -10,
              result: { won: false, startSide: "RIGHT", rungCount: 3, answer: "ODD" },
              createdAt: "2026-08-04T05:00:00.000Z",
              user: { id: "user-2", nickname: "별보러가자" },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("총 2회")).toBeInTheDocument();
    expect(screen.getByText("2회차")).toBeInTheDocument();
    expect(screen.getByText("좌4홀")).toBeInTheDocument();
    expect(screen.getByText("1회차")).toBeInTheDocument();
    expect(screen.getByText("우3홀")).toBeInTheDocument();
    expect(screen.queryByText("불멍이")).not.toBeInTheDocument();
    expect(screen.queryByText("+38P")).not.toBeInTheDocument();
  });

  it("조회 실패 시 재시도 동작을 제공한다", () => {
    const retry = vi.fn();
    render(
      <LadderHistoryPanel history={undefined} loading={false} error="연결 실패" onRetry={retry} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
