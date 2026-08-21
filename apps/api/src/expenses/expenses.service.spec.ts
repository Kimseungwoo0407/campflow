import { PrismaService } from "../prisma/prisma.service";
import { PointsService } from "../points/points.service";
import { TripAccessService } from "../trips/trip-access.service";
import { ExpensesService } from "./expenses.service";

describe("ExpensesService", () => {
  it("지출을 수정하면 선택값과 무관하게 모든 멤버에게 균등 배분한다", async () => {
    const deleteShares = jest.fn().mockResolvedValue({ count: 2 });
    const updateExpense = jest.fn().mockResolvedValue({ id: "expense-1", amount: 120_000 });
    const deleteDraftSettlements = jest.fn().mockResolvedValue({ count: 1 });
    const transactionClient = {
      expenseShare: { deleteMany: deleteShares },
      expense: { update: updateExpense },
      settlementRevision: { deleteMany: deleteDraftSettlements },
    };
    const runTransaction = jest.fn(
      async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );
    const prisma = {
      expense: {
        findUnique: jest.fn().mockResolvedValue({
          id: "expense-1",
          tripId: "trip-1",
          payerId: "member-user-01",
        }),
      },
      settlementRevision: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: runTransaction,
    } as unknown as PrismaService;
    const access = {
      requireMembership: jest.fn().mockResolvedValue({ role: "MEMBER" }),
      members: jest
        .fn()
        .mockResolvedValue([{ userId: "member-user-01" }, { userId: "member-user-02" }]),
    } as unknown as TripAccessService;
    const service = new ExpensesService(prisma, access, {} as PointsService);

    await service.update("member-user-01", "expense-1", {
      payerId: "member-user-01",
      amount: 120_000,
      category: "ACCOMMODATION",
      spentAt: "2026-08-29T03:00:00.000Z",
      memo: "숙소 잔금",
      participantUserIds: ["member-user-01"],
    });

    expect(deleteShares).toHaveBeenCalledWith({ where: { expenseId: "expense-1" } });
    expect(updateExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "expense-1" },
        data: expect.objectContaining({
          amount: 120_000,
          memo: "숙소 잔금",
          shares: {
            create: [
              { userId: "member-user-01", amount: 60_000 },
              { userId: "member-user-02", amount: 60_000 },
            ],
          },
        }),
      }),
    );
    expect(deleteDraftSettlements).toHaveBeenCalledWith({
      where: { tripId: "trip-1", status: "DRAFT" },
    });
  });

  it("기존 개인 송금 방식 정산은 확정하지 못하게 한다", async () => {
    const prisma = {
      settlementRevision: {
        findUnique: jest.fn().mockResolvedValue({
          id: "settlement-1",
          tripId: "trip-1",
          result: { balances: [], transfers: [] },
        }),
      },
    } as unknown as PrismaService;
    const access = {
      requireManager: jest.fn(),
    } as unknown as TripAccessService;
    const service = new ExpensesService(prisma, access, {} as PointsService);

    await expect(service.lock("manager-user-01", "settlement-1")).rejects.toMatchObject({
      response: {
        code: "SETTLEMENT_RECALCULATION_REQUIRED",
      },
    });
    expect(access.requireManager).not.toHaveBeenCalled();
  });
});
