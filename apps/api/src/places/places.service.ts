import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Place, Prisma } from "@prisma/client";
import type {
  CreateCandidateInput,
  CreatePlaceInput,
  UpdateCandidateInput,
} from "@campflow/contracts";
import { newId } from "@campflow/domain";
import { PrismaService } from "../prisma/prisma.service";
import { PointsService } from "../points/points.service";
import { TripAccessService } from "../trips/trip-access.service";

const NOMINATIM_PROVIDER = "NOMINATIM";
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1_000;
const PROVIDER_REQUEST_INTERVAL_MS = 1_100;
const PROVIDER_TIMEOUT_MS = 10_000;
const ATTRIBUTION =
  "검색 데이터 © OpenStreetMap contributors (ODbL) · 영업·가격·예약 가능 여부는 후보 등록 전에 확인하세요.";

interface NominatimResult {
  place_id: number;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  display_name: string;
  class?: string;
  type?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
  namedetails?: Record<string, string>;
}

interface NormalizedPlace {
  canonicalName: string;
  address: string;
  roadAddress?: string;
  lat: number;
  lng: number;
  phone?: string;
  websiteUrl?: string;
  category: string;
  description: string;
  amenities: string[];
  sourceUrl: string;
}

interface CachedSearch {
  expiresAt: number;
  items: NormalizedPlace[];
}

@Injectable()
export class PlacesService {
  private readonly searchCache = new Map<string, CachedSearch>();
  private providerQueue: Promise<void> = Promise.resolve();
  private lastProviderRequestAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
    private readonly points: PointsService,
    private readonly config: ConfigService,
  ) {}

  async search(userId: string, tripId: string, query: string) {
    await this.access.requireMembership(userId, tripId);
    const normalized = query.trim().replace(/\s+/gu, " ");
    if (normalized.length < 2) {
      throw new BadRequestException({
        code: "PLACE_QUERY_TOO_SHORT",
        message: "지역이나 장소 이름을 두 글자 이상 입력해 주세요.",
      });
    }

    const localPlaces = await this.findLocalPlaces(normalized);
    try {
      const providerPlaces = await this.searchProvider(normalized);
      const savedPlaces = await Promise.all(
        providerPlaces.map((place) => this.saveProviderPlace(place)),
      );
      return {
        items: this.uniquePlaces([...savedPlaces, ...localPlaces]).slice(0, 20),
        providerWarnings: [],
        attribution: ATTRIBUTION,
      };
    } catch {
      return {
        items: localPlaces,
        providerWarnings: [
          {
            provider: NOMINATIM_PROVIDER,
            message:
              "외부 장소 검색이 잠시 지연되고 있어요. 잠시 후 다시 검색하거나 이미 저장된 결과를 이용해 주세요.",
          },
        ],
        attribution: ATTRIBUTION,
      };
    }
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

  private async findLocalPlaces(query: string): Promise<Place[]> {
    return this.prisma.place.findMany({
      where: {
        isSample: false,
        sourceProvider: { not: "MOCK" },
        OR: [
          { canonicalName: { contains: query, mode: "insensitive" } },
          { address: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
  }

  private async searchProvider(query: string): Promise<NormalizedPlace[]> {
    const cacheKey = query.toLocaleLowerCase("ko-KR");
    const cached = this.searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.items;
    if (cached) this.searchCache.delete(cacheKey);

    let resolveQueue: (() => void) | undefined;
    const previousRequest = this.providerQueue;
    this.providerQueue = new Promise<void>((resolve) => {
      resolveQueue = resolve;
    });
    await previousRequest;

    try {
      const waitMs = Math.max(
        0,
        PROVIDER_REQUEST_INTERVAL_MS - (Date.now() - this.lastProviderRequestAt),
      );
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.lastProviderRequestAt = Date.now();

      const providerUrl = new URL(
        this.config.get<string>(
          "PLACE_SEARCH_PROVIDER_URL",
          "https://nominatim.openstreetmap.org/search",
        ),
      );
      providerUrl.searchParams.set("q", query);
      providerUrl.searchParams.set("format", "jsonv2");
      providerUrl.searchParams.set("addressdetails", "1");
      providerUrl.searchParams.set("extratags", "1");
      providerUrl.searchParams.set("namedetails", "1");
      providerUrl.searchParams.set("countrycodes", "kr");
      providerUrl.searchParams.set("accept-language", "ko");
      providerUrl.searchParams.set("limit", "10");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
      try {
        const response = await fetch(providerUrl, {
          headers: {
            Accept: "application/json",
            "Accept-Language": "ko,en;q=0.7",
            Referer: "https://kimseungwoo0407.github.io/campflow/",
            "User-Agent":
              "CampFlow/1.0 (+https://github.com/Kimseungwoo0407/campflow; private-trip-planner)",
          },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Nominatim responded with ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!Array.isArray(payload)) throw new Error("Nominatim response is not an array");
        const items = payload
          .filter(this.isNominatimResult)
          .map((item) => this.normalizeProviderPlace(item))
          .filter((item): item is NormalizedPlace => item !== undefined);
        this.searchCache.set(cacheKey, {
          expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
          items,
        });
        return items;
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      resolveQueue?.();
    }
  }

  private readonly isNominatimResult = (value: unknown): value is NominatimResult => {
    if (typeof value !== "object" || value === null) return false;
    const result = value as Partial<NominatimResult>;
    return (
      typeof result.place_id === "number" &&
      typeof result.lat === "string" &&
      typeof result.lon === "string" &&
      typeof result.display_name === "string"
    );
  };

  private normalizeProviderPlace(result: NominatimResult): NormalizedPlace | undefined {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    const canonicalName = this.providerPlaceName(result);
    const displayParts = result.display_name
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const address =
      displayParts[0] === canonicalName && displayParts.length > 1
        ? displayParts.slice(1).join(", ")
        : result.display_name;
    const category = this.providerCategory(result.type, result.class);
    const extra = result.extratags ?? {};
    const phone = extra["contact:phone"] ?? extra.phone;
    const websiteUrl = this.httpUrl(extra["contact:website"] ?? extra.website ?? extra.url);
    const osmType =
      result.osm_type === "N"
        ? "node"
        : result.osm_type === "W"
          ? "way"
          : result.osm_type === "R"
            ? "relation"
            : result.osm_type;
    const sourceUrl =
      osmType && result.osm_id
        ? `https://www.openstreetmap.org/${osmType}/${result.osm_id}`
        : `https://www.openstreetmap.org/search?query=${encodeURIComponent(result.display_name)}`;

    return {
      canonicalName,
      address,
      roadAddress: address,
      lat,
      lng,
      ...(phone ? { phone } : {}),
      ...(websiteUrl ? { websiteUrl } : {}),
      category,
      description: `OpenStreetMap에서 확인한 ${category} 장소입니다.`,
      amenities: this.providerAmenities(extra),
      sourceUrl,
    };
  }

  private providerPlaceName(result: NominatimResult): string {
    const names = result.namedetails ?? {};
    const address = result.address ?? {};
    return (
      names["name:ko"] ??
      names.name ??
      address.tourism ??
      address.amenity ??
      address.leisure ??
      address.shop ??
      address.hotel ??
      address.camp_site ??
      result.display_name.split(",")[0]?.trim() ??
      "이름 없는 장소"
    );
  }

  private providerCategory(type?: string, placeClass?: string): string {
    const categories: Record<string, string> = {
      camp_site: "캠핑장",
      caravan_site: "캠핑장",
      chalet: "펜션·숙박",
      guest_house: "펜션·숙박",
      hotel: "호텔",
      motel: "모텔",
      hostel: "호스텔",
      resort: "리조트",
      restaurant: "음식점",
      cafe: "카페",
      supermarket: "마트",
      convenience: "편의점",
      attraction: "관광지",
      viewpoint: "전망대",
      theme_park: "테마파크",
    };
    return (type && categories[type]) || (placeClass && categories[placeClass]) || "장소";
  }

  private providerAmenities(extra: Record<string, string>): string[] {
    const amenities = [
      extra.parking && extra.parking !== "no" ? "주차" : undefined,
      extra.internet_access && extra.internet_access !== "no" ? "인터넷" : undefined,
      extra.wheelchair === "yes" ? "휠체어 접근" : undefined,
      extra.reservation && extra.reservation !== "no" ? "예약 가능" : undefined,
      extra.smoking === "no" ? "금연" : undefined,
    ];
    return amenities.filter((item): item is string => item !== undefined);
  }

  private httpUrl(value?: string): string | undefined {
    if (!value) return undefined;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  private async saveProviderPlace(input: NormalizedPlace): Promise<Place> {
    const existing = await this.prisma.place.findFirst({
      where: {
        sourceProvider: NOMINATIM_PROVIDER,
        sourceUrl: input.sourceUrl,
      },
    });
    const data = {
      canonicalName: input.canonicalName,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      category: input.category,
      description: input.description,
      amenities: input.amenities,
      sourceProvider: NOMINATIM_PROVIDER,
      sourceUrl: input.sourceUrl,
      isSample: false,
      ...(input.roadAddress === undefined ? {} : { roadAddress: input.roadAddress }),
      ...(input.phone === undefined ? {} : { phone: input.phone }),
      ...(input.websiteUrl === undefined ? {} : { websiteUrl: input.websiteUrl }),
    };
    if (existing) {
      return this.prisma.place.update({ where: { id: existing.id }, data });
    }
    return this.prisma.place.create({ data: { id: newId(), ...data } });
  }

  private uniquePlaces(places: Place[]): Place[] {
    const unique = new Map<string, Place>();
    for (const place of places) {
      const key =
        place.sourceUrl ??
        `${place.canonicalName.toLocaleLowerCase("ko-KR")}|${place.address.toLocaleLowerCase(
          "ko-KR",
        )}`;
      if (!unique.has(key)) unique.set(key, place);
    }
    return [...unique.values()];
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
