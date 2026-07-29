import { validateEnvironment } from "./environment";

const valid = {
  DATABASE_URL: "postgresql://campflow:test@localhost:5433/campflow",
  JWT_ACCESS_SECRET: "a".repeat(32),
  REFRESH_TOKEN_PEPPER: "b".repeat(32),
  INVITE_TOKEN_PEPPER: "c".repeat(32),
};

describe("환경 변수 검증", () => {
  it("필수 비밀값이 안전한 길이면 통과한다", () => {
    expect(validateEnvironment(valid).PORT).toBe(4000);
  });

  it("짧은 JWT 비밀값을 거부한다", () => {
    expect(() =>
      validateEnvironment({ ...valid, JWT_ACCESS_SECRET: "short" }),
    ).toThrow("JWT_ACCESS_SECRET");
  });
});
