import { describe, expect, it } from "vitest";
import { HERO_POOL, createInitialTerritory } from "./game-data";
import { recruitHeroes } from "./recruitment";

describe("잔광전선 지휘관 소환", () => {
  it("공개된 개별 확률의 합이 정확히 100%다", () => {
    const total = HERO_POOL.reduce((sum, hero) => sum + hero.probability, 0);
    expect(total).toBeCloseTo(100, 8);
  });

  it("0.0001% 최상단 구간에서 특이점 지휘관이 등장한다", () => {
    const territory = createInitialTerritory();
    const recruited = recruitHeroes(territory, 1, () => 0.9999995);
    expect(recruited?.results[0]?.heroKey).toBe("nameless_king");
    expect(recruited?.results[0]?.rarity).toBe("SINGULARITY");
  });

  it("10회째에는 희귀 이상, 80회째에는 전설을 보장한다", () => {
    const territory = createInitialTerritory();
    const rarePity = recruitHeroes(
      {
        ...territory,
        recruit: { ...territory.recruit, pullsSinceRare: 9 },
      },
      1,
      () => 0.2,
    );
    const legendaryPity = recruitHeroes(
      {
        ...territory,
        recruit: { ...territory.recruit, pullsSinceLegendary: 79 },
      },
      1,
      () => 0,
    );
    expect(rarePity?.results[0]?.rarity).toBe("RARE");
    expect(legendaryPity?.results[0]?.heroKey).toBe("astra");
  });

  it("중복 지휘관은 잔광 조각으로 전환한다", () => {
    const territory = createInitialTerritory();
    const recruited = recruitHeroes(territory, 1, () => 0);
    expect(recruited?.results[0]).toMatchObject({
      heroKey: "ruan",
      isNew: false,
      fragmentsGained: 5,
    });
    expect(recruited?.territory.heroFragments).toBe(5);
    expect(recruited?.territory.heroRoster.ruan).toBe(2);
  });
});
