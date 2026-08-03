import { payoutWithProfitMultiplier } from "./points.service";

describe("포인트 게임 순이익 배수", () => {
  it("짱깸보 10P의 5배 당첨은 판돈 반환과 별도로 50P 순이익을 준다", () => {
    const wager = 10;
    const credited = payoutWithProfitMultiplier(wager, 5);

    expect(credited).toBe(60);
    expect(credited - wager).toBe(50);
  });

  it("사다리 배당도 판돈과 순이익을 분리한다", () => {
    const wager = 50;
    const credited = payoutWithProfitMultiplier(wager, 1.9);

    expect(credited).toBe(145);
    expect(credited - wager).toBe(95);
  });
});
