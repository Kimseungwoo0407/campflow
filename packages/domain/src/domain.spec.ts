import { describe, expect, it } from "vitest";
import {
  canManageGroup,
  canTransitionTrip,
  canWriteGroupContent,
  calculateSettlements,
  newId,
  normalizeEmail,
  splitAmountEvenly,
  tripProgress,
} from "./index";

describe("Phase 1 도메인 정책", () => {
  it("그룹 소유자만 그룹을 관리한다", () => {
    expect(canManageGroup("OWNER")).toBe(true);
    expect(canManageGroup("MEMBER")).toBe(false);
    expect(canManageGroup("GUEST")).toBe(false);
  });

  it("게스트의 쓰기를 제한한다", () => {
    expect(canWriteGroupContent("MEMBER")).toBe(true);
    expect(canWriteGroupContent("GUEST")).toBe(false);
  });

  it("식별자와 이메일을 일관되게 만든다", () => {
    expect(newId()).toHaveLength(26);
    expect(normalizeEmail("  Friend@Example.COM ")).toBe("friend@example.com");
  });

  it("여행 단계는 정해진 선행 조건 순서로만 진행한다", () => {
    expect(canTransitionTrip("SEARCHING", "VOTING")).toBe(true);
    expect(canTransitionTrip("SEARCHING", "ARCHIVED")).toBe(false);
    expect(canTransitionTrip("VOTING", "SEARCHING")).toBe(true);
    expect(tripProgress("ARCHIVED")).toBe(100);
  });

  it("1원 오차를 보정하고 최소 송금 목록을 만든다", () => {
    const shares = splitAmountEvenly(10_001, ["a", "b", "c"]);
    expect(shares.map((share) => share.amount)).toEqual([3334, 3334, 3333]);
    const result = calculateSettlements(
      ["a", "b", "c"],
      [{ payerId: "a", amount: 10_001, shares }],
    );
    expect(result.transfers).toEqual([
      { fromUserId: "b", toUserId: "a", amount: 3334 },
      { fromUserId: "c", toUserId: "a", amount: 3333 },
    ]);
    expect(result.transfers.reduce((sum, transfer) => sum + transfer.amount, 0)).toBe(6667);
  });
});
