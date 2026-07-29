import { ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PointsService } from "../points/points.service";
import { TripAccessService } from "../trips/trip-access.service";
import { PlacesService } from "./places.service";

describe("PlacesService", () => {
  const requireWriter = jest.fn<Promise<void>, [string, string]>();
  const findFirst = jest.fn();
  const createPlace = jest.fn();
  const createCandidate = jest.fn();
  const awardActivity = jest.fn<Promise<void>, [string, string, "MANUAL_PLACE", string]>();
  const transactionClient = {
    place: { create: createPlace },
    tripCandidate: { create: createCandidate },
  };
  const runTransaction = jest.fn(
    async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
  );
  const prisma = {
    tripCandidate: { findFirst },
    $transaction: runTransaction,
  } as unknown as PrismaService;
  const access = { requireWriter } as unknown as TripAccessService;
  const points = { awardActivity } as unknown as PointsService;

  beforeEach(() => {
    jest.clearAllMocks();
    requireWriter.mockResolvedValue();
    findFirst.mockResolvedValue(null);
    createPlace.mockResolvedValue({ id: "place-1" });
    createCandidate.mockResolvedValue({
      id: "candidate-1",
      tripId: "trip-1",
      placeId: "place-1",
      addedById: "user-1",
      status: "ACTIVE",
      estimatedTotal: null,
      priceNote: "4인 48만원",
      note: "서울에서 차로 1시간 20분",
      pros: [],
      cons: [],
      place: {
        id: "place-1",
        canonicalName: "친구들이 찾은 글램핑장",
        address: "경기도 가평군 가평읍 테스트로 1",
        sourceUrl: "https://map.naver.com/p/entry/place/123",
      },
      addedBy: { id: "user-1", nickname: "승우" },
    });
    awardActivity.mockResolvedValue();
  });

  it("직접 입력한 이름·위치·거리·가격으로 후보를 한 번에 만든다", async () => {
    const service = new PlacesService(prisma, access, points);

    const result = await service.addManualCandidate("user-1", "trip-1", {
      canonicalName: "친구들이 찾은 글램핑장",
      location: "경기도 가평군 가평읍 테스트로 1",
      distance: "서울에서 차로 1시간 20분",
      price: "4인 48만원",
      mapUrl: "https://map.naver.com/p/entry/place/123",
    });

    expect(createPlace).toHaveBeenCalledWith({
      data: expect.objectContaining({
        canonicalName: "친구들이 찾은 글램핑장",
        address: "경기도 가평군 가평읍 테스트로 1",
        category: "글램핑",
        sourceProvider: "EXTERNAL_MAP",
        sourceUrl: "https://map.naver.com/p/entry/place/123",
        isSample: false,
      }),
    });
    expect(createCandidate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tripId: "trip-1",
        addedById: "user-1",
        note: "서울에서 차로 1시간 20분",
        priceNote: "4인 48만원",
      }),
      include: expect.any(Object),
    });
    expect(awardActivity).toHaveBeenCalledWith("trip-1", "user-1", "MANUAL_PLACE", "candidate-1");
    expect(result).toMatchObject({ id: "candidate-1" });
  });

  it("같은 이름과 주소의 중복 후보는 만들지 않는다", async () => {
    findFirst.mockResolvedValue({ id: "candidate-existing" });
    const service = new PlacesService(prisma, access, points);

    await expect(
      service.addManualCandidate("user-1", "trip-1", {
        canonicalName: "친구들이 찾은 글램핑장",
        location: "경기도 가평군 가평읍 테스트로 1",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(runTransaction).not.toHaveBeenCalled();
    expect(awardActivity).not.toHaveBeenCalled();
  });
});
