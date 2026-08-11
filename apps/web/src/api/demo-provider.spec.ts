import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, clearApiSessionTokens } from "./client";
import { demoIds } from "./demo-provider";

describe("demo API provider", () => {
  afterEach(() => {
    clearApiSessionTokens();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("serves every primary read-only screen without contacting the server", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    sessionStorage.setItem("campflow_demo_session", "active");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { groupId, tripId } = demoIds;
    const paths = [
      "health/live",
      "me",
      "groups",
      `groups/${groupId}`,
      `groups/${groupId}/trips`,
      "trips",
      `trips/${tripId}`,
      `trips/${tripId}/characters`,
      `trips/${tripId}/candidates`,
      `trips/${tripId}/polls`,
      `trips/${tripId}/itinerary/days`,
      `trips/${tripId}/tasks`,
      `trips/${tripId}/meals`,
      `trips/${tripId}/shopping-list`,
      `trips/${tripId}/vehicles`,
      `trips/${tripId}/transport/validation`,
      `trips/${tripId}/expenses`,
      `trips/${tripId}/points`,
      `trips/${tripId}/achievements`,
      `trips/${tripId}/games/penalty-matches`,
      `trips/${tripId}/games/odd-even/rounds`,
      `trips/${tripId}/posts`,
      `trips/${tripId}/messages`,
      `trips/${tripId}/files`,
    ];

    for (const path of paths) {
      await expect(apiRequest(path)).resolves.not.toBeUndefined();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps demo mode read-only", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    sessionStorage.setItem("campflow_demo_session", "active");

    await expect(
      apiRequest(`trips/${demoIds.tripId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: "실제 데이터에는 저장하지 않음" }),
      }),
    ).rejects.toThrow("데모는 조회 전용입니다");
  });
});
