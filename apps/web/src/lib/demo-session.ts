import type { AuthResult } from "@campflow/contracts";

const DEMO_SESSION_KEY = "campflow_demo_session";

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "true";
}

export function createDemoSession(): AuthResult {
  return {
    accessToken: "",
    csrfToken: "",
    user: {
      id: "public-demo-user",
      username: "demo",
      email: "demo@campflow.local",
      nickname: "데모 여행자",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
    },
  };
}

export function saveDemoSession(): void {
  sessionStorage.setItem(DEMO_SESSION_KEY, "active");
}

export function hasDemoSession(): boolean {
  return sessionStorage.getItem(DEMO_SESSION_KEY) === "active";
}

export function clearDemoSession(): void {
  sessionStorage.removeItem(DEMO_SESSION_KEY);
}
