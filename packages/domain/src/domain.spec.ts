import { describe, expect, it } from "vitest";
import { canManageGroup, canWriteGroupContent, newId, normalizeEmail } from "./index";

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
});
