import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { restoreSession } from "../api/client";
import { createDemoSession } from "../lib/demo-session";
import { useAuthStore } from "../stores/auth";
import { LoginPage } from "./auth-pages";

describe("LoginPage", () => {
  afterEach(() => {
    cleanup();
    useAuthStore.getState().setAnonymous();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("변경한 비밀번호도 입력할 수 있다", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const password = screen.getByLabelText("비밀번호");

    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("maxlength", "128");
    expect(password).not.toHaveAttribute("inputmode", "numeric");
    expect(screen.getByText(/변경했다면 새 비밀번호를 입력하세요/)).toBeInTheDocument();
  });

  it("데모 모드에서는 홈 서버 없이 바로 입장하고 세션을 복원한다", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "데모로 바로 입장" }));

    const demoUser = createDemoSession().user;
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().user?.nickname).toBe(demoUser.nickname);
    expect(sessionStorage.getItem("campflow_demo_session")).toBe("active");
    await expect(restoreSession()).resolves.toMatchObject({
      user: { id: demoUser.id, nickname: demoUser.nickname },
    });
  });

  it("공개 페이지의 홈 서버가 끊기면 로그인 시도를 데모로 전환한다", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "owner" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "CampFlow2026!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await vi.waitFor(() => expect(useAuthStore.getState().status).toBe("authenticated"));
    expect(sessionStorage.getItem("campflow_demo_session")).toBe("active");
  });
});
