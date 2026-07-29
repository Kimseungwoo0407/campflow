import type { GroupRole, TripStatus } from "@campflow/contracts";
import { ulid } from "ulid";

export function newId(): string {
  return ulid();
}

export function canReadGroup(role: GroupRole | undefined): boolean {
  return role === "OWNER" || role === "MEMBER" || role === "GUEST";
}

export function canManageGroup(role: GroupRole | undefined): boolean {
  return role === "OWNER";
}

export function canWriteGroupContent(role: GroupRole | undefined): boolean {
  return role === "OWNER" || role === "MEMBER";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

const tripTransitions: Record<TripStatus, readonly TripStatus[]> = {
  DRAFT: ["SEARCHING"],
  SEARCHING: ["VOTING"],
  VOTING: ["CONFIRMED", "SEARCHING"],
  CONFIRMED: ["IN_PROGRESS", "SEARCHING"],
  IN_PROGRESS: ["SETTLING"],
  SETTLING: ["ARCHIVED", "IN_PROGRESS"],
  ARCHIVED: [],
};

export function canTransitionTrip(current: TripStatus, next: TripStatus): boolean {
  return tripTransitions[current].includes(next);
}

export function tripProgress(status: TripStatus): number {
  const progress: Record<TripStatus, number> = {
    DRAFT: 10,
    SEARCHING: 25,
    VOTING: 45,
    CONFIRMED: 65,
    IN_PROGRESS: 80,
    SETTLING: 92,
    ARCHIVED: 100,
  };
  return progress[status];
}

export interface ExpenseForSettlement {
  payerId: string;
  amount: number;
  shares: Array<{ userId: string; amount: number }>;
}

export interface SettlementTransfer {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export function splitAmountEvenly(amount: number, userIds: readonly string[]) {
  if (!Number.isInteger(amount) || amount < 0 || userIds.length === 0) {
    throw new Error("금액과 분담 인원을 확인해 주세요.");
  }
  const base = Math.floor(amount / userIds.length);
  let remainder = amount - base * userIds.length;
  return userIds.map((userId) => {
    const share = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return { userId, amount: share };
  });
}

export function calculateSettlements(
  memberIds: readonly string[],
  expenses: readonly ExpenseForSettlement[],
): { balances: Array<{ userId: string; amount: number }>; transfers: SettlementTransfer[] } {
  const balances = new Map(memberIds.map((userId) => [userId, 0]));
  for (const expense of expenses) {
    const shareTotal = expense.shares.reduce((sum, share) => sum + share.amount, 0);
    if (shareTotal !== expense.amount) {
      throw new Error("지출 금액과 분담 금액 합계가 일치하지 않습니다.");
    }
    balances.set(expense.payerId, (balances.get(expense.payerId) ?? 0) + expense.amount);
    for (const share of expense.shares) {
      balances.set(share.userId, (balances.get(share.userId) ?? 0) - share.amount);
    }
  }

  const creditors = [...balances.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([userId, amount]) => ({ userId, amount }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = [...balances.entries()]
    .filter(([, amount]) => amount < 0)
    .map(([userId, amount]) => ({ userId, amount: -amount }))
    .sort((a, b) => b.amount - a.amount);
  const transfers: SettlementTransfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    if (!creditor || !debtor) break;
    const amount = Math.min(creditor.amount, debtor.amount);
    if (amount > 0) {
      transfers.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount,
      });
    }
    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount === 0) creditorIndex += 1;
    if (debtor.amount === 0) debtorIndex += 1;
  }

  return {
    balances: [...balances.entries()].map(([userId, amount]) => ({ userId, amount })),
    transfers,
  };
}
