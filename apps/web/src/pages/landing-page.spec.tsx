import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LandingPage } from "./landing-page";

afterEach(cleanup);

describe("LandingPage", () => {
  it("여행 준비 흐름과 명확한 데모 진입 동선을 보여준다", () => {
    const scrollIntoView = vi.fn();
    const target = document.createElement("div");
    target.id = "landing-flow";
    target.scrollIntoView = scrollIntoView;
    document.body.append(target);

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: /단톡방에 흩어진 여행/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("4명 모두 · 1인 113,625원")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /데모/ }).length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole("button", { name: "어떻게 쓰나요?" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});
