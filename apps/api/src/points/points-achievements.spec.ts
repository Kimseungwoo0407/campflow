import { achievementDefinitions } from "./points.service";

describe("단계형 업적 구성", () => {
  it("16개 트랙에 총 84단계가 있고 키가 중복되지 않는다", () => {
    expect(achievementDefinitions).toHaveLength(84);
    expect(new Set(achievementDefinitions.map((achievement) => achievement.key)).size).toBe(84);
    expect(new Set(achievementDefinitions.map((achievement) => achievement.seriesKey)).size).toBe(
      16,
    );
  });

  it("모든 트랙은 단계가 오를수록 목표와 포인트 보상이 커진다", () => {
    const series = new Map<string, typeof achievementDefinitions>();
    for (const achievement of achievementDefinitions) {
      series.set(achievement.seriesKey, [
        ...(series.get(achievement.seriesKey) ?? []),
        achievement,
      ]);
    }

    for (const stages of series.values()) {
      for (let index = 1; index < stages.length; index += 1) {
        expect(stages[index]!.stage).toBe(stages[index - 1]!.stage + 1);
        expect(stages[index]!.target).toBeGreaterThan(stages[index - 1]!.target);
        expect(stages[index]!.reward).toBeGreaterThan(stages[index - 1]!.reward);
      }
    }
  });
});
