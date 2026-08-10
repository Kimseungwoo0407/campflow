import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { restoreSession } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { LoginPage } from "./auth-pages";

describe("LoginPage", () => {
  afterEach(() => {
    useAuthStore.getState().setAnonymous();
    vi.unstubAllEnvs();
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

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().user?.nickname).toBe("데모 여행자");
    expect(sessionStorage.getItem("campflow_demo_session")).toBe("active");
    await expect(restoreSession()).resolves.toMatchObject({
      user: { id: "public-demo-user", nickname: "데모 여행자" },
    });
  });
});
