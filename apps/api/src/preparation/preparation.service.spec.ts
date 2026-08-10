import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { PointsService } from "../points/points.service";
import { TripAccessService } from "../trips/trip-access.service";
import { PreparationService } from "./preparation.service";

describe("PreparationService", () => {
  it("등록자가 차량 정보와 탑승자를 수정한다", async () => {
    const updateVehicle = jest.fn().mockResolvedValue({ id: "vehicle-1" });
    const deleteAssignments = jest.fn().mockResolvedValue({ count: 1 });
    const createAssignments = jest.fn().mockResolvedValue({ count: 1 });
    const transactionClient = {
      vehicle: { update: updateVehicle },
      rideAssignment: { deleteMany: deleteAssignments, createMany: createAssignments },
    };
    const runTransaction = jest.fn(
      async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );
    const prisma = {
      vehicle: {
        findUnique: jest.fn().mockResolvedValue({
          id: "vehicle-1",
          tripId: "trip-1",
          ownerId: "member-user-01",
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "vehicle-1", seats: 5 }),
      },
      tripMember: { findFirst: jest.fn().mockResolvedValue({ tripId: "trip-1" }) },
      $transaction: runTransaction,
    } as unknown as PrismaService;
    const access = {
      requireMembership: jest.fn().mockResolvedValue({ role: "MEMBER" }),
    } as unknown as TripAccessService;
    const service = new PreparationService(
      prisma,
      access,
      {} as ConfigService,
      {} as PointsService,
    );

    await service.updateVehicle("member-user-01", "vehicle-1", {
      name: "수정 차량",
      driverId: "member-user-01",
      seats: 5,
      departureLocation: "잠실역",
      departureAt: "2026-08-29T00:30:00.000Z",
      note: "정시 출발",
      passengerIds: ["member-user-02"],
    });

    expect(updateVehicle).toHaveBeenCalledWith({
      where: { id: "vehicle-1" },
      data: expect.objectContaining({
        name: "수정 차량",
        driverId: "member-user-01",
        seats: 5,
        departureLocation: "잠실역",
      }),
    });
    expect(deleteAssignments).toHaveBeenCalledWith({ where: { vehicleId: "vehicle-1" } });
    expect(createAssignments).toHaveBeenCalledWith({
      data: [{ vehicleId: "vehicle-1", userId: "member-user-02" }],
    });
  });
});
