import type { BattleRecord } from "./types";

export interface BattleRewards {
  rewardBattlePoints: number;
  rewardRareMaterials: number;
  rewardRecruitSeals: number;
  leagueDelta: number;
}

export function calculateBattleRewards(record: BattleRecord): BattleRewards {
  if (record.mode === "FRIENDLY") {
    return {
      rewardBattlePoints: 0,
      rewardRareMaterials: 0,
      rewardRecruitSeals: 0,
      leagueDelta: 0,
    };
  }

  return {
    rewardBattlePoints: Math.max(
      4,
      record.reachedZone * 5 + (record.outcome === "ATTACKER_WIN" ? 12 : 0),
    ),
    rewardRareMaterials: record.outcome === "ATTACKER_WIN" ? 1 : 0,
    rewardRecruitSeals:
      record.outcome === "ATTACKER_WIN" ? 2 : record.reachedZone >= 3 ? 1 : 0,
    leagueDelta: record.outcome === "ATTACKER_WIN" ? 18 : record.reachedZone >= 3 ? 2 : -6,
  };
}
