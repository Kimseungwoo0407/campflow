import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  CreateCandidateInput,
  CreateManualCandidateInput,
  CreatePlaceInput,
  UpdateCandidateInput,
} from "@campflow/contracts";
import { newId } from "@campflow/domain";
import { PrismaService } from "../prisma/prisma.service";
import { PointsService } from "../points/points.service";
import { TripAccessService } from "../trips/trip-access.service";

@Injectable()
export class PlacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
    private readonly points: PointsService,
  ) {}

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
        message: "이미 후보로 추가한 장소입니다.",
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

  async addManualCandidate(userId: string, tripId: string, input: CreateManualCandidateInput) {
    await this.access.requireWriter(userId, tripId);
    const duplicate = await this.prisma.tripCandidate.findFirst({
      where: {
        tripId,
        place: {
          canonicalName: { equals: input.canonicalName, mode: "insensitive" },
          address: { equals: input.location, mode: "insensitive" },
        },
      },
    });
    if (duplicate) {
      throw new ConflictException({
        code: "CANDIDATE_ALREADY_EXISTS",
        message: "같은 이름과 주소의 장소가 이미 후보에 있습니다.",
      });
    }

    const placeId = newId();
    const candidateId = newId();
    const candidate = await this.prisma.$transaction(async (transaction) => {
      await transaction.place.create({
        data: {
          id: placeId,
          canonicalName: input.canonicalName,
          address: input.location,
          roadAddress: input.location,
          lat: 0,
          lng: 0,
          category: "글램핑",
          amenities: [],
          sourceProvider: input.mapUrl ? "EXTERNAL_MAP" : "USER",
          isSample: false,
          createdByUserId: userId,
          ...(input.mapUrl === undefined ? {} : { sourceUrl: input.mapUrl }),
        },
      });
      return transaction.tripCandidate.create({
        data: {
          id: candidateId,
          tripId,
          placeId,
          addedById: userId,
          pros: [],
          cons: [],
          ...(input.price === undefined ? {} : { priceNote: input.price }),
          ...(input.distance === undefined ? {} : { note: input.distance }),
        },
        include: { place: true, addedBy: { select: { id: true, nickname: true } } },
      });
    });
    await this.points.awardActivity(tripId, userId, "MANUAL_PLACE", candidate.id);
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
