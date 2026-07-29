import { describe, expect, it } from "vitest";
import { createInviteSchema, loginSchema, signUpSchema } from "./index";

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
});
