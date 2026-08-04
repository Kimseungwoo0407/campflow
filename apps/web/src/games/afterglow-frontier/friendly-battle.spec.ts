import { describe, expect, it } from "vitest";
import { battleRecordFromState, createBattle } from "./engine";
import { createFriendlyCandidate } from "./friendly-battle";
import { DEFENSE_FACILITIES } from "./game-data";
import { calculateBattleRewards } from "./settlement";

describe("잔광전선 친구전", () => {
  it("같은 친구는 항상 같은 친선 방어 스냅샷을 사용한다", () => {
    const friend = { id: "friend-42", nickname: "새벽감시자" };
    expect(createFriendlyCandidate(friend)).toEqual(createFriendlyCandidate(friend));
  });

  it("친선 상대는 약탈 가능 포인트가 없고 전투 모드가 분리된다", () => {
    const candidate = createFriendlyCandidate({ id: "friend-7", nickname: "바람칼" });
    const battle = createBattle(candidate, "ruan", "FRIENDLY");
    expect(candidate.exposedPoints).toBe(0);
    expect(candidate.estimatedLoot).toEqual([0, 0]);
    expect(battle.mode).toBe("FRIENDLY");
    const snapshot = candidate.defenseSnapshot;
    const expectedGateHp = Math.round(
      DEFENSE_FACILITIES.gate.maxHp *
        (1 + ((snapshot?.wallLevel ?? 1) - 1) * 0.15) *
        (1 + ((snapshot?.facilityLevels.gate ?? 1) - 1) * 0.12),
    );
    expect(battle.structures[0]?.maxHp).toBe(expectedGateHp);
  });

  it("친선전은 승리해도 약탈·성장 재화·리그 점수를 지급하지 않는다", () => {
    const candidate = createFriendlyCandidate({ id: "friend-9", nickname: "성문지기" });
    const battle = createBattle(candidate, "ruan", "FRIENDLY");
    const record = battleRecordFromState({
      ...battle,
      outcome: "ATTACKER_WIN",
      currentZone: 5,
      destroyedCount: 4,
    });
    expect(calculateBattleRewards(record)).toEqual({
      rewardBattlePoints: 0,
      rewardRareMaterials: 0,
      rewardRecruitSeals: 0,
      leagueDelta: 0,
    });
    expect(record.securedLoot).toBe(0);
  });
});
