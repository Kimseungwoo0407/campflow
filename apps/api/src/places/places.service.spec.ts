import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Place } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PointsService } from "../points/points.service";
import { TripAccessService } from "../trips/trip-access.service";
import { PlacesService } from "./places.service";

describe("PlacesService", () => {
  const now = new Date("2026-07-29T00:00:00.000Z");
  const requireMembership = jest.fn<Promise<void>, [string, string]>();
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const originalFetch = globalThis.fetch;

  const prisma = {
    place: { findMany, findFirst, create, update },
  } as unknown as PrismaService;
  const access = { requireMembership } as unknown as TripAccessService;
  const points = {} as PointsService;
  const config = {
    get: jest.fn((_key: string, fallback: string) => fallback),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    requireMembership.mockResolvedValue();
    findMany.mockResolvedValue([]);
    findFirst.mockResolvedValue(null);
    create.mockImplementation(
      (request: { data: Omit<Place, "createdAt" | "updatedAt" | "createdByUserId"> }) =>
        Promise.resolve({
          ...request.data,
          createdByUserId: null,
          createdAt: now,
          updatedAt: now,
        }),
    );
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("실제 제공자 결과를 이름과 주소가 있는 후보용 장소로 저장한다", async () => {
    const fetchMock = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              place_id: 101,
              osm_type: "node",
              osm_id: 202,
              lat: "37.8184",
              lon: "127.5191",
              display_name: "자라섬 캠핑장, 자라섬로, 가평읍, 가평군, 경기도, 대한민국",
              class: "tourism",
              type: "camp_site",
              namedetails: { "name:ko": "자라섬 캠핑장" },
              extratags: {
                phone: "031-000-0000",
                website: "https://example.test/place",
                parking: "surface",
              },
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    globalThis.fetch = fetchMock;
    const service = new PlacesService(prisma, access, points, config);

    const first = await service.search("user-1", "trip-1", "가평 캠핑장");
    const second = await service.search("user-1", "trip-1", "가평   캠핑장");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.items[0]).toMatchObject({
      canonicalName: "자라섬 캠핑장",
      address: "자라섬로, 가평읍, 가평군, 경기도, 대한민국",
      category: "캠핑장",
      sourceProvider: "NOMINATIM",
      sourceUrl: "https://www.openstreetmap.org/node/202",
      isSample: false,
    });
    expect(second.items[0]?.canonicalName).toBe("자라섬 캠핑장");
    expect(first.attribution).toContain("OpenStreetMap contributors");
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.searchParams.get("countrycodes")).toBe("kr");
    expect(requestedUrl.searchParams.get("limit")).toBe("10");
  });

  it("두 글자 미만 검색어는 제공자를 호출하지 않는다", async () => {
    const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    globalThis.fetch = fetchMock;
    const service = new PlacesService(prisma, access, points, config);

    await expect(service.search("user-1", "trip-1", "가")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
