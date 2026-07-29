import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  CreateCandidateInput,
  CreatePlaceInput,
  UpdateCandidateInput,
} from "@campflow/contracts";
import { newId } from "@campflow/domain";
import { PrismaService } from "../prisma/prisma.service";
import { PointsService } from "../points/points.service";
import { TripAccessService } from "../trips/trip-access.service";

const samplePlaces: CreatePlaceInput[] = [
  {
    canonicalName: "북한강 별빛 글램핑",
    address: "경기도 가평군 청평면 북한강로 100",
    roadAddress: "경기도 가평군 청평면 북한강로 100",
    lat: 37.7256,
    lng: 127.4218,
    phone: "031-000-1000",
    websiteUrl: "https://example.com/sample-starlight",
    category: "글램핑",
    description: "강변 불멍 공간과 개별 바비큐가 있는 샘플 후보입니다.",
    amenities: ["개별 바비큐", "불멍", "주차", "침대", "개별 화장실"],
  },
  {
    canonicalName: "가평 숲속 캐빈 글램핑",
    address: "경기도 가평군 상면 수목원로 220",
    roadAddress: "경기도 가평군 상면 수목원로 220",
    lat: 37.7668,
    lng: 127.3532,
    phone: "031-000-2000",
    websiteUrl: "https://example.com/sample-forest",
    category: "글램핑",
    description: "숲속 독립형 객실과 넓은 공용 주방을 갖춘 샘플 후보입니다.",
    amenities: ["독립 객실", "공용 주방", "주차", "산책로", "빔프로젝터"],
  },
  {
    canonicalName: "자라섬 리버뷰 캠프",
    address: "경기도 가평군 가평읍 자라섬로 60",
    roadAddress: "경기도 가평군 가평읍 자라섬로 60",
    lat: 37.8184,
    lng: 127.5191,
    phone: "031-000-3000",
    websiteUrl: "https://example.com/sample-riverview",
    category: "글램핑",
    description: "역과 가까우며 강 전망을 볼 수 있는 샘플 후보입니다.",
    amenities: ["리버뷰", "대중교통", "바비큐", "주차", "매점"],
  },
];

@Injectable()
export class PlacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
    private readonly points: PointsService,
  ) {}

  async search(userId: string, tripId: string, query: string) {
    await this.access.requireMembership(userId, tripId);
    await this.ensureSamplePlaces();
    const normalized = query.trim();
    const places = await this.prisma.place.findMany({
      ...(normalized
        ? {
            where: {
              OR: [
                { canonicalName: { contains: normalized, mode: "insensitive" } },
                { address: { contains: normalized, mode: "insensitive" } },
                { category: { contains: normalized, mode: "insensitive" } },
              ],
            },
          }
        : {}),
      orderBy: [{ isSample: "desc" }, { canonicalName: "asc" }],
      take: 30,
    });
    return {
      items: places,
      providerWarnings: [
        {
          provider: "MOCK",
          message: "외부 API 키가 없어 샘플 데이터와 사용자 등록 장소를 표시합니다.",
        },
      ],
      attribution: "샘플 결과이며 실제 가격·예약 가능 여부는 외부 링크에서 직접 확인해야 합니다.",
    };
  }

  async createManual(userId: string, tripId: string, input: CreatePlaceInput) {
    await this.access.requireWriter(userId, tripId);
    const place = await this.prisma.place.create({
      data: this.placeData(input, "USER", false, userId),
    });
    await this.points.awardActivity(tripId, userId, "MANUAL_PLACE", place.id);
    return place;
  }

  async candidates(userId: string, tripId: string) {
    await this.access.requireMembership(userId, tripId);
    return this.prisma.tripCandidate.findMany({
      where: { tripId },
      include: {
        place: true,
        addedBy: { select: { id: true, nickname: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
  }

  async addCandidate(userId: string, tripId: string, input: CreateCandidateInput) {
    await this.access.requireWriter(userId, tripId);
    const place = await this.prisma.place.findUnique({ where: { id: input.placeId } });
    if (!place) {
      throw new NotFoundException({
        code: "PLACE_NOT_FOUND",
        message: "장소를 찾을 수 없습니다.",
      });
    }
    const existing = await this.prisma.tripCandidate.findUnique({
      where: { tripId_placeId: { tripId, placeId: input.placeId } },
    });
    if (existing) {
      throw new ConflictException({
        code: "CANDIDATE_ALREADY_EXISTS",
        message: "이미 후보에 추가된 장소입니다.",
      });
    }
    const candidate = await this.prisma.tripCandidate.create({
      data: {
        id: newId(),
        tripId,
        placeId: input.placeId,
        addedById: userId,
        ...(input.estimatedTotal === undefined ? {} : { estimatedTotal: input.estimatedTotal }),
        ...(input.priceNote === undefined ? {} : { priceNote: input.priceNote }),
        pros: input.pros,
        cons: input.cons,
        ...(input.note === undefined ? {} : { note: input.note }),
      },
      include: { place: true, addedBy: { select: { id: true, nickname: true } } },
    });
    await this.points.awardActivity(tripId, userId, "CANDIDATE", candidate.id);
    return candidate;
  }

  async updateCandidate(userId: string, candidateId: string, input: UpdateCandidateInput) {
    const candidate = await this.requireCandidate(candidateId);
    if (input.status === "SELECTED") {
      await this.access.requireManager(userId, candidate.tripId);
      await this.prisma.$transaction([
        this.prisma.tripCandidate.updateMany({
          where: { tripId: candidate.tripId, id: { not: candidateId } },
          data: { status: "REJECTED" },
        }),
        this.prisma.tripCandidate.update({
          where: { id: candidateId },
          data: { status: "SELECTED", version: { increment: 1 } },
        }),
        this.prisma.trip.update({
          where: { id: candidate.tripId },
          data: { status: "CONFIRMED", version: { increment: 1 } },
        }),
        this.prisma.decisionLog.create({
          data: {
            id: newId(),
            tripId: candidate.tripId,
            decisionType: "PLACE_SELECTED",
            entityId: candidateId,
            decidedById: userId,
            reason: "후보 비교와 투표 후 장소 확정",
            snapshot: {
              candidateId,
              placeId: candidate.placeId,
              placeName: candidate.place.canonicalName,
            },
          },
        }),
      ]);
      return this.requireCandidate(candidateId);
    }
    await this.access.requireWriter(userId, candidate.tripId);
    return this.prisma.tripCandidate.update({
      where: { id: candidateId },
      data: {
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.estimatedTotal === undefined ? {} : { estimatedTotal: input.estimatedTotal }),
        ...(input.priceNote === undefined ? {} : { priceNote: input.priceNote }),
        ...(input.pros === undefined ? {} : { pros: input.pros }),
        ...(input.cons === undefined ? {} : { cons: input.cons }),
        ...(input.note === undefined ? {} : { note: input.note }),
        version: { increment: 1 },
      },
      include: { place: true, addedBy: { select: { id: true, nickname: true } } },
    });
  }

  async removeCandidate(userId: string, candidateId: string) {
    const candidate = await this.requireCandidate(candidateId);
    await this.access.requireWriter(userId, candidate.tripId);
    await this.prisma.tripCandidate.delete({ where: { id: candidateId } });
    return { deleted: true };
  }

  private async requireCandidate(candidateId: string) {
    const candidate = await this.prisma.tripCandidate.findUnique({
      where: { id: candidateId },
      include: { place: true },
    });
    if (!candidate) {
      throw new NotFoundException({
        code: "CANDIDATE_NOT_FOUND",
        message: "장소 후보를 찾을 수 없습니다.",
      });
    }
    return candidate;
  }

  private async ensureSamplePlaces() {
    for (const sample of samplePlaces) {
      const existing = await this.prisma.place.findFirst({
        where: { canonicalName: sample.canonicalName, sourceProvider: "MOCK" },
      });
      if (!existing) {
        await this.prisma.place.create({
          data: this.placeData(sample, "MOCK", true),
        });
      }
    }
  }

  private placeData(
    input: CreatePlaceInput,
    sourceProvider: string,
    isSample: boolean,
    createdByUserId?: string,
  ): Prisma.PlaceUncheckedCreateInput {
    return {
      id: newId(),
      canonicalName: input.canonicalName,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      category: input.category,
      amenities: input.amenities,
      sourceProvider,
      isSample,
      ...(createdByUserId === undefined ? {} : { createdByUserId }),
      ...(input.roadAddress === undefined ? {} : { roadAddress: input.roadAddress }),
      ...(input.phone === undefined ? {} : { phone: input.phone }),
      ...(input.websiteUrl === undefined ? {} : { websiteUrl: input.websiteUrl }),
      ...(input.description === undefined ? {} : { description: input.description }),
    };
  }
}
