import type { ApiError, ApiSuccess, AuthResult } from "@campflow/contracts";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/v1").replace(
  /\/$/,
  "",
);
let accessToken: string | null = null;
let refreshPromise: Promise<AuthResult> | null = null;

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function setApiAccessToken(token: string | null): void {
  accessToken = token;
}

export function readCsrfToken(): string | undefined {
  const entry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("campflow_csrf="));
  return entry ? decodeURIComponent(entry.slice(entry.indexOf("=") + 1)) : undefined;
}

export async function restoreSession(): Promise<AuthResult> {
  if (!refreshPromise) {
    refreshPromise = rawRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  const result = await refreshPromise;
  setApiAccessToken(result.accessToken);
  return result;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retryAuthentication = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }
  const csrfToken = readCsrfToken();
  if (csrfToken && init.method && init.method !== "GET") {
    headers.set("x-csrf-token", csrfToken);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/${path.replace(/^\//, "")}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiClientError(
      "SERVER_OFFLINE",
      "홈 서버에 연결할 수 없습니다. 네트워크 또는 서버 상태를 확인해 주세요.",
      0,
    );
  }

  if (response.status === 401 && retryAuthentication && path !== "auth/refresh") {
    try {
      await restoreSession();
      return apiRequest<T>(path, init, false);
    } catch {
      setApiAccessToken(null);
    }
  }

  const payload = (await response.json().catch(() => undefined)) as ApiSuccess<T> | ApiError | undefined;
  if (!response.ok) {
    if (payload && "error" in payload) {
      throw new ApiClientError(
        payload.error.code,
        payload.error.message,
        response.status,
        payload.error.details,
      );
    }
    throw new ApiClientError("HTTP_ERROR", "요청을 처리할 수 없습니다.", response.status);
  }
  if (!payload || !("data" in payload)) {
    throw new ApiClientError("INVALID_RESPONSE", "서버 응답 형식이 올바르지 않습니다.", response.status);
  }
  return payload.data;
}

async function rawRefresh(): Promise<AuthResult> {
  const csrfToken = readCsrfToken();
  if (!csrfToken) {
    throw new ApiClientError("NO_SESSION", "저장된 로그인 세션이 없습니다.", 401);
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "x-csrf-token": csrfToken },
    });
  } catch {
    throw new ApiClientError("SERVER_OFFLINE", "홈 서버에 연결할 수 없습니다.", 0);
  }
  const payload = (await response.json().catch(() => undefined)) as
    | ApiSuccess<AuthResult>
    | ApiError
    | undefined;
  if (!response.ok || !payload || !("data" in payload)) {
    if (payload && "error" in payload) {
      throw new ApiClientError(payload.error.code, payload.error.message, response.status);
    }
    throw new ApiClientError("SESSION_EXPIRED", "로그인 세션이 만료되었습니다.", response.status);
  }
  return payload.data;
}
