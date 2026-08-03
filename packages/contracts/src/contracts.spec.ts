import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  createInviteSchema,
  createManualCandidateSchema,
  loginSchema,
  managerPointGrantSchema,
  oddEvenGameSchema,
  signUpSchema,
} from "./index";

describe("공유 입력 계약", () => {
  it("이메일을 정규화하고 안전한 회원가입 입력을 허용한다", () => {
    const value = signUpSchema.parse({
      email: " OWNER@CampFlow.Local ",
      password: "campflow-demo-2026",
      nickname: "캠프장",
    });

    expect(value.email).toBe("owner@campflow.local");
  });

  it("초대의 과도한 사용 횟수를 거부한다", () => {
    expect(
      createInviteSchema.safeParse({
        role: "MEMBER",
        expiresInHours: 72,
        maxUses: 101,
        requireApproval: false,
      }).success,
    ).toBe(false);
  });

  it("한글 이름 아이디 로그인을 허용한다", () => {
    expect(loginSchema.parse({ identifier: " 테스트사용자 ", password: "1234" })).toEqual({
      identifier: "테스트사용자",
      password: "1234",
    });
  });

  it("장소명·위치와 선택적인 거리·가격으로 후보를 등록한다", () => {
    expect(
      createManualCandidateSchema.parse({
        canonicalName: " 포천 파인밸리글램핑 ",
        location: " 경기 포천시 화현면 ",
        distance: "서울에서 차로 1시간 20분",
        price: "4인 32만원",
      }),
    ).toEqual({
      canonicalName: "포천 파인밸리글램핑",
      location: "경기 포천시 화현면",
      distance: "서울에서 차로 1시간 20분",
      price: "4인 32만원",
    });
  });

  it("사다리 게임은 출발·줄 수·도착 중 하나 이상을 선택한다", () => {
    expect(
      oddEvenGameSchema.parse({
        startChoice: "LEFT",
        rungCountChoice: 3,
        wager: 50,
        clientRoundId: "ladder-round-1",
      }),
    ).toMatchObject({ startChoice: "LEFT", rungCountChoice: 3 });

    expect(
      oddEvenGameSchema.safeParse({
        wager: 50,
        clientRoundId: "ladder-round-2",
      }).success,
    ).toBe(false);

    expect(
      oddEvenGameSchema.safeParse({
        startChoice: "LEFT",
        rungCountChoice: 3,
        endChoice: "ODD",
        wager: 50,
        clientRoundId: "ladder-round-3",
      }).success,
    ).toBe(false);

    expect(
      oddEvenGameSchema.safeParse({
        startChoice: "LEFT",
        rungCountChoice: 3,
        endChoice: "EVEN",
        wager: 50,
        clientRoundId: "ladder-round-4",
      }).success,
    ).toBe(true);
  });

  it("본인 비밀번호 변경은 안전한 새 비밀번호와 기존 비밀번호 차이를 검사한다", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old-password-2026",
        newPassword: "new-password-2026",
      }).success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "same-password-2026",
        newPassword: "same-password-2026",
      }).success,
    ).toBe(false);
  });

  it("관리자 포인트 지급은 10P 단위와 공개 사유를 요구한다", () => {
    const base = {
      targetUserId: "01KYNMKJWRDZXX5C6E68TBNK1X",
      reason: "장보기 담당 보상",
      clientRequestId: "point-grant-request-1",
    };
    expect(managerPointGrantSchema.safeParse({ ...base, amount: 10 }).success).toBe(true);
    expect(managerPointGrantSchema.safeParse({ ...base, amount: 15 }).success).toBe(false);
    expect(managerPointGrantSchema.safeParse({ ...base, amount: 10, reason: "" }).success).toBe(
      false,
    );
  });
});
