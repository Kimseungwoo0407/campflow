import type { AuthResult } from "@campflow/contracts";
import snapshot from "../api/demo-snapshot.json";

const DEMO_SESSION_KEY = "campflow_demo_session";

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "true";
}

export function createDemoSession(): AuthResult {
  return {
    accessToken: "",
    csrfToken: "",
    user: snapshot.sessionUser,
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
