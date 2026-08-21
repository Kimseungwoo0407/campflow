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

  it("공개 페이지의 홈 서버가 끊겨도 로그인 시도를 데모로 전환하지 않는다", async () => {
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

    expect(await screen.findByRole("alert")).toHaveTextContent("홈 서버에 연결할 수 없습니다");
    expect(useAuthStore.getState().status).not.toBe("authenticated");
    expect(sessionStorage.getItem("campflow_demo_session")).toBeNull();
  });

  it("데모 세션에서 실제 로그인을 시도하면 데모를 종료하고 API를 호출한다", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    sessionStorage.setItem("campflow_demo_session", "active");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            accessToken: "real-access-token",
            csrfToken: "real-csrf-token",
            user: {
              id: "real-user",
              username: "owner",
              email: "owner@example.com",
              nickname: "실제 사용자",
              locale: "ko-KR",
              timezone: "Asia/Seoul",
            },
          },
          meta: { requestId: "request-1", serverTime: new Date().toISOString() },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(container.querySelector("#login-identifier")!, {
      target: { value: "owner" },
    });
    fireEvent.change(container.querySelector("#login-password")!, {
      target: { value: "CampFlow2026!" },
    });
    fireEvent.submit(container.querySelector("form")!);

    await vi.waitFor(() => expect(useAuthStore.getState().user?.id).toBe("real-user"));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(sessionStorage.getItem("campflow_demo_session")).toBeNull();
  });
});
