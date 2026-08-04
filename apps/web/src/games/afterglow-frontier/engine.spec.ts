import { describe, expect, it } from "vitest";
import { MATCH_CANDIDATES, createInitialTerritory } from "./game-data";
import { calculateLoot, createBattle, summonUnit, tickBattle } from "./engine";
import { collectProduction, loadTerritory, unclaimedProduction } from "./storage";

describe("잔광전선 경제", () => {
  it("서버 시각에 해당하는 경과 시간만 생산하고 수령 시 75%를 우선 보호한다", () => {
    const now = new Date("2026-08-04T12:00:00.000Z");
    const state = createInitialTerritory(new Date("2026-08-04T11:00:00.000Z"));
    expect(unclaimedProduction(state, now.getTime())).toBe(72);
    const collected = collectProduction(state, now);
    expect(collected.protectedSupply - state.protectedSupply).toBe(54);
    expect(collected.exposedSupply - state.exposedSupply).toBe(18);
  });

  it("약탈량은 노출 포인트 18% 상한, 구간 성과, 반복 공격 감쇠를 적용한다", () => {
    const first = calculateLoot({
      exposedPoints: 2_000,
      reachedZone: 5,
      attackerPower: 2_000,
      defenderPower: 2_000,
      repeatCount: 0,
      protectionFactor: 1,
    });
    const repeated = calculateLoot({
      exposedPoints: 2_000,
      reachedZone: 5,
      attackerPower: 2_000,
      defenderPower: 2_000,
      repeatCount: 2,
      protectionFactor: 1,
    });
    expect(first).toBe(320);
    expect(repeated).toBe(57);
  });
});

describe("잔광전선 저장 데이터 호환", () => {
  it("기존 버전 세이브에도 성벽·소환·시설 기본값을 보완한다", () => {
    const legacy = { ...createInitialTerritory(), version: 1 } as Record<string, unknown>;
    delete legacy.wallLevel;
    delete legacy.recruitSeals;
    delete legacy.heroRoster;
    delete legacy.activeHeroKey;
    delete legacy.recruit;
    const defense = { ...(legacy.defense as Record<string, unknown>) };
    delete defense.facilityLevels;
    legacy.defense = defense;
    window.localStorage.setItem(
      "campflow:afterglow-frontier:v1:legacy-trip:legacy-user",
      JSON.stringify(legacy),
    );
    const migrated = loadTerritory("legacy-trip", "legacy-user");
    expect(migrated.version).toBe(2);
    expect(migrated.wallLevel).toBe(1);
    expect(migrated.recruitSeals).toBe(12);
    expect(migrated.heroRoster.ruan).toBe(1);
    expect(migrated.defense.facilityLevels.core).toBe(1);
  });
});

describe("잔광전선 전투", () => {
  it("소환 비용·쿨다운·점유 제한으로 같은 강한 유닛 연속 소환을 막는다", () => {
    const candidate = MATCH_CANDIDATES[0];
    if (!candidate) throw new Error("테스트 상대가 필요합니다.");
    const battle = { ...createBattle(candidate), command: 100 };
    const first = summonUnit(battle, "sapper");
    const repeated = summonUnit(first, "sapper");
    expect(first.attackers).toHaveLength(1);
    expect(first.command).toBe(66);
    expect(repeated.attackers).toHaveLength(1);
  });

  it("제한 시간이 끝나면 클라이언트 결과 입력 없이 방어자 승리로 판정한다", () => {
    const candidate = MATCH_CANDIDATES[0];
    if (!candidate) throw new Error("테스트 상대가 필요합니다.");
    const battle = createBattle(candidate);
    const finished = tickBattle({ ...battle, elapsed: battle.timeLimit - 0.1 });
    expect(finished.outcome).toBe("DEFENDER_WIN");
  });
});
