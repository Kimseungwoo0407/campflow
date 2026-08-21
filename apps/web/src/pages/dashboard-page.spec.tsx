import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { DashboardPage } from "./dashboard-page";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn(),
  clearApiSessionTokens: vi.fn(),
  setApiSessionTokens: vi.fn(),
}));

const activeTrip = {
  id: "trip-1",
  title: "8월 29~30일 가평 글램핑",
  purpose: "네 친구가 함께 준비하는 여행",
  status: "VOTING" as const,
  startDate: "2026-08-29T00:00:00.000Z",
  endDate: "2026-08-30T00:00:00.000Z",
  regionText: "가평",
  budgetPerPerson: 180_000,
  attendeeCount: 4,
  memberCount: 4,
  progress: 45,
  datesLocked: true,
  myRole: "OWNER" as const,
  group: { id: "group-1", name: "8월 29~30일 글램핑" },
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: "authenticated",
      user: {
        id: "user-1",
        username: "owner",
        email: "owner@example.com",
        nickname: "승우",
        locale: "ko-KR",
        timezone: "Asia/Seoul",
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useAuthStore.setState({ status: "anonymous", user: null });
  });

  it("현재 여행과 4인 균등 정산 진입점을 보여준다", async () => {
    vi.mocked(apiRequest).mockResolvedValue([activeTrip]);
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "승우님, 여행이 착착 준비되고 있어요." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: activeTrip.title })).toBeInTheDocument();
    expect(screen.getByText("모두 균등 분담")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /회비 정산.*4명이 함께 나눠요/ })).toHaveAttribute(
      "href",
      "/trips/trip-1/expenses",
    );
  });

  it("여행이 없으면 그룹 생성 행동을 안내한다", async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "승우님, 첫 여행을 시작해 볼까요?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /그룹 만들기/ })).toHaveAttribute("href", "/groups");
  });
});
