import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AfterglowFrontierPage } from "./AfterglowFrontierPage";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("../../api/client", () => ({
  apiRequest: apiRequestMock,
  clearApiSessionTokens: vi.fn(),
  setApiSessionTokens: vi.fn(),
}));

vi.mock("../../pages/trip-workspace-pages", () => ({
  WorkspaceShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("잔광전선 진입", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    window.localStorage.clear();
    apiRequestMock.mockResolvedValue({
      members: [
        { user: { id: "local-commander", nickname: "나" } },
        { user: { id: "friend-1", nickname: "해질녘" } },
      ],
    });
  });

  it("여행 게임 경로에서 영지와 지휘관 소환 화면을 렌더링한다", () => {
    render(
      <MemoryRouter initialEntries={["/trips/test-trip/games/afterglow-frontier"]}>
        <Routes>
          <Route
            path="/trips/:tripId/games/afterglow-frontier"
            element={<AfterglowFrontierPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "영지" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "지휘관 소환" }));
    expect(screen.getByRole("heading", { name: "백만 번째 잔광을 지휘관으로" })).toBeInTheDocument();
    expect(screen.getAllByText("0.0001%", { exact: false }).length).toBeGreaterThan(0);
  });

  it("같은 여행의 친구를 선택해 무료 친선전을 준비한다", async () => {
    render(
      <MemoryRouter initialEntries={["/trips/test-trip/games/afterglow-frontier"]}>
        <Routes>
          <Route
            path="/trips/:tripId/games/afterglow-frontier"
            element={<AfterglowFrontierPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "친구전" }));
    expect(await screen.findByRole("heading", { name: "대전 상대 선택" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "해질녘" })).toBeInTheDocument();
    expect(screen.getByText("출전 비용 0")).toBeInTheDocument();
    expect(screen.getByText("경제 변동 0")).toBeInTheDocument();
  });
});
