import { maximumConsecutiveWins, payoutWithProfitMultiplier } from "./points.service";

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

describe("업적 연승 계산", () => {
  it("패배 전후를 분리해 가장 긴 달팽이 연승만 계산한다", () => {
    expect(
      maximumConsecutiveWins([
        { won: true },
        { won: false },
        { won: true },
        { won: true },
        { won: true },
        { won: false },
      ]),
    ).toBe(3);
  });
});
