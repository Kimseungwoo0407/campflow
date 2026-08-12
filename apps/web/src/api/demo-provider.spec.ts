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

  it("keeps the saved place comparison in the offline demo", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    sessionStorage.setItem("campflow_demo_session", "active");

    const candidates = await apiRequest<
      Array<{
        place: { canonicalName: string; address: string; sourceUrl: string | null };
        note: string | null;
        priceNote: string | null;
        addedBy: { nickname: string };
      }>
    >(`trips/${demoIds.tripId}/candidates`);

    expect(candidates).toHaveLength(8);
    expect(candidates.map((candidate) => candidate.place.canonicalName)).toEqual([
      "산마루글램핑카라반",
      "가평명지산카라반글램핑",
      "대부도 문글램핑",
      "더비치글램핑",
      "대부도 캠핑성",
      "가평 채움카라반글램핑",
      "가평원더풀카라반&글램핑",
      "사계돔글램핑",
    ]);
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          place: expect.objectContaining({
            canonicalName: "사계돔글램핑",
            address: "경기 양평군 서종면 황순원로 414-47",
            sourceUrl: expect.stringContaining("map.naver.com"),
          }),
          note: "신천역에서 1시간 20분",
          priceNote: "330,000 (인원추가 + 바베큐)",
          addedBy: expect.objectContaining({ nickname: "승우" }),
        }),
      ]),
    );
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
