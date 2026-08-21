import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  UpdatePaymentInput,
} from "@campflow/contracts";
import { calculateSharedFundSettlement, newId, splitAmountEvenly } from "@campflow/domain";
import { PrismaService } from "../prisma/prisma.service";
import { PointsService } from "../points/points.service";
import { TripAccessService } from "../trips/trip-access.service";

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
    private readonly points: PointsService,
  ) {}

  async list(userId: string, tripId: string) {
    await this.access.requireMembership(userId, tripId);
    const [expenses, latestSettlement] = await Promise.all([
      this.prisma.expense.findMany({
        where: { tripId },
        include: {
          payer: { select: { id: true, nickname: true } },
          shares: {
            include: { user: { select: { id: true, nickname: true } } },
          },
        },
        orderBy: { spentAt: "desc" },
      }),
      this.prisma.settlementRevision.findFirst({
        where: { tripId },
        include: {
          payments: {
            include: {
              fromUser: { select: { id: true, nickname: true } },
              toUser: { select: { id: true, nickname: true } },
            },
          },
        },
        orderBy: { revisionNo: "desc" },
      }),
    ]);
    return {
      expenses,
      total: expenses.reduce((sum, expense) => sum + expense.amount, 0),
      latestSettlement,
    };
  }

  async create(userId: string, tripId: string, input: CreateExpenseInput) {
    await this.access.requireWriter(userId, tripId);
    const participantUserIds = await this.expenseParticipantIds(tripId, input);
    const shares = splitAmountEvenly(input.amount, participantUserIds);
    const expense = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.expense.create({
        data: {
          id: newId(),
          tripId,
          payerId: input.payerId,
          amount: input.amount,
          category: input.category,
          spentAt: new Date(input.spentAt),
          memo: input.memo,
          shares: { create: shares },
        },
        include: {
          payer: { select: { id: true, nickname: true } },
          shares: { include: { user: { select: { id: true, nickname: true } } } },
        },
      });
      await transaction.settlementRevision.deleteMany({
        where: { tripId, status: "DRAFT" },
      });
      return created;
    });
    await this.points.awardActivity(tripId, userId, "EXPENSE", expense.id);
    return expense;
  }

  async update(userId: string, expenseId: string, input: UpdateExpenseInput) {
    const expense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) throw this.expenseNotFound();
    const membership = await this.access.requireMembership(userId, expense.tripId);
    if (expense.payerId !== userId && membership.role !== "MANAGER") {
      throw new ForbiddenException({
        code: "EXPENSE_OWNER_REQUIRED",
        message: "결제자 또는 여행 관리자만 지출을 수정할 수 있습니다.",
      });
    }
    await this.assertSettlementUnlocked(expense.tripId);
    const participantUserIds = await this.expenseParticipantIds(expense.tripId, input);
    const shares = splitAmountEvenly(input.amount, participantUserIds);
    return this.prisma.$transaction(async (transaction) => {
      await transaction.expenseShare.deleteMany({ where: { expenseId } });
      const updated = await transaction.expense.update({
        where: { id: expenseId },
        data: {
          payerId: input.payerId,
          amount: input.amount,
          category: input.category,
          spentAt: new Date(input.spentAt),
          memo: input.memo,
          revision: { increment: 1 },
          shares: { create: shares },
        },
        include: {
          payer: { select: { id: true, nickname: true } },
          shares: { include: { user: { select: { id: true, nickname: true } } } },
        },
      });
      await transaction.settlementRevision.deleteMany({
        where: { tripId: expense.tripId, status: "DRAFT" },
      });
      return updated;
    });
  }

  async remove(userId: string, expenseId: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) throw this.expenseNotFound();
    const membership = await this.access.requireMembership(userId, expense.tripId);
    if (expense.payerId !== userId && membership.role !== "MANAGER") {
      throw new ForbiddenException({
        code: "EXPENSE_OWNER_REQUIRED",
        message: "결제자 또는 여행 관리자만 지출을 삭제할 수 있습니다.",
      });
    }
    await this.assertSettlementUnlocked(expense.tripId);
    await this.prisma.$transaction([
      this.prisma.expense.delete({ where: { id: expenseId } }),
      this.prisma.settlementRevision.deleteMany({
        where: { tripId: expense.tripId, status: "DRAFT" },
      }),
    ]);
    return { deleted: true };
  }

  async calculate(userId: string, tripId: string) {
    await this.access.requireMembership(userId, tripId);
    const [members, expenses, latest] = await Promise.all([
      this.access.members(tripId),
      this.prisma.expense.findMany({
        where: { tripId },
        include: { shares: true },
      }),
      this.prisma.settlementRevision.findFirst({
        where: { tripId },
        select: { revisionNo: true },
        orderBy: { revisionNo: "desc" },
      }),
    ]);
    const result = calculateSharedFundSettlement(
      members.map((member) => member.userId),
      expenses,
    );
    const revision = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.settlementRevision.create({
        data: {
          id: newId(),
          tripId,
          revisionNo: (latest?.revisionNo ?? 0) + 1,
          result: result as unknown as Prisma.InputJsonValue,
        },
      });
      if (result.transfers.length > 0) {
        await transaction.settlementPayment.createMany({
          data: result.transfers.map((transfer) => ({
            id: newId(),
            settlementId: created.id,
            ...transfer,
          })),
        });
      }
      return created;
    });
    return this.getSettlement(userId, revision.id);
  }

  async lock(userId: string, settlementId: string) {
    const settlement = await this.prisma.settlementRevision.findUnique({
      where: { id: settlementId },
    });
    if (!settlement) throw this.settlementNotFound();
    const result = settlement.result as { contributions?: unknown };
    if (!Array.isArray(result.contributions)) {
      throw new ForbiddenException({
        code: "SETTLEMENT_RECALCULATION_REQUIRED",
        message: "회비 균등 분할 방식으로 정산을 다시 계산해 주세요.",
      });
    }
    await this.access.requireManager(userId, settlement.tripId);
    await this.prisma.$transaction([
      this.prisma.settlementRevision.update({
        where: { id: settlementId },
        data: {
          status: "LOCKED",
          lockedById: userId,
          lockedAt: new Date(),
        },
      }),
      this.prisma.trip.update({
        where: { id: settlement.tripId },
        data: { status: "SETTLING", version: { increment: 1 } },
      }),
    ]);
    return this.getSettlement(userId, settlementId);
  }

  async updatePayment(userId: string, paymentId: string, input: UpdatePaymentInput) {
    const payment = await this.prisma.settlementPayment.findUnique({
      where: { id: paymentId },
      include: { settlement: true },
    });
    if (!payment) {
      throw new NotFoundException({
        code: "PAYMENT_NOT_FOUND",
        message: "송금 항목을 찾을 수 없습니다.",
      });
    }
    const membership = await this.access.requireMembership(userId, payment.settlement.tripId);
    if (
      payment.fromUserId !== userId &&
      payment.toUserId !== userId &&
      membership.role !== "MANAGER"
    ) {
      throw new ForbiddenException({
        code: "PAYMENT_PARTICIPANT_REQUIRED",
        message: "송금 당사자 또는 여행 관리자만 완료 상태를 바꿀 수 있습니다.",
      });
    }
    await this.prisma.settlementPayment.update({
      where: { id: paymentId },
      data: {
        status: input.paid ? "PAID" : "PENDING",
        paidAt: input.paid ? new Date() : null,
      },
    });
    return this.getSettlement(userId, payment.settlementId);
  }

  private async getSettlement(userId: string, settlementId: string) {
    const settlement = await this.prisma.settlementRevision.findUnique({
      where: { id: settlementId },
      include: {
        payments: {
          include: {
            fromUser: { select: { id: true, nickname: true } },
            toUser: { select: { id: true, nickname: true } },
          },
          orderBy: { amount: "desc" },
        },
      },
    });
    if (!settlement) throw this.settlementNotFound();
    await this.access.requireMembership(userId, settlement.tripId);
    return settlement;
  }

  private async expenseParticipantIds(
    tripId: string,
    input: CreateExpenseInput | UpdateExpenseInput,
  ) {
    const members = await this.access.members(tripId);
    const memberIds = new Set(members.map((member) => member.userId));
    if (!memberIds.has(input.payerId)) {
      throw new ForbiddenException({
        code: "EXPENSE_MEMBER_REQUIRED",
        message: "결제자는 여행 멤버여야 합니다.",
      });
    }
    return members.map((member) => member.userId);
  }

  private async assertSettlementUnlocked(tripId: string) {
    const locked = await this.prisma.settlementRevision.findFirst({
      where: { tripId, status: "LOCKED" },
    });
    if (locked) {
      throw new ForbiddenException({
        code: "SETTLEMENT_LOCKED",
        message: "정산이 확정된 뒤에는 지출을 수정하거나 삭제할 수 없습니다.",
      });
    }
  }

  private expenseNotFound() {
    return new NotFoundException({
      code: "EXPENSE_NOT_FOUND",
      message: "지출을 찾을 수 없습니다.",
    });
  }

  private settlementNotFound() {
    return new NotFoundException({
      code: "SETTLEMENT_NOT_FOUND",
      message: "정산 결과를 찾을 수 없습니다.",
    });
  }
}
