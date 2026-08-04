import type {
  DefenseFacilityKey,
  DefenseUnitKey,
  MatchCandidate,
  TripFriend,
} from "./types";

const UNIT_KEYS: DefenseUnitKey[] = ["warden", "slinger", "golem", "mender"];
const FACILITY_KEYS: DefenseFacilityKey[] = ["gate", "watchtower", "foundry", "core"];
const BATTLEFIELDS = [
  "잿빛 평원 · 표준 친선 규칙",
  "바람 회랑 · 이동 속도 변동 없음",
  "고요한 수로 · 회복 시설 경계",
  "붉은 단층 · 공성 부대 운용 권장",
] as const;
const WAVE_STYLES = ["다수 웨이브 압박형", "성문 지연형", "원거리 집중형", "수호자 집중형"];

export function stableFriendHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function createFriendlyCandidate(friend: TripFriend): MatchCandidate {
  const hash = stableFriendHash(friend.id);
  const wallLevel = 1 + (hash % 5);
  const gradeIndex = Math.min(3, Math.floor((wallLevel - 1) / 1.25));
  const grades = ["C", "B", "A", "S"] as const;
  const firstUnit = UNIT_KEYS[hash % UNIT_KEYS.length] ?? "warden";
  const secondUnit = UNIT_KEYS[(hash >>> 4) % UNIT_KEYS.length] ?? "slinger";
  const facilityLevels = Object.fromEntries(
    FACILITY_KEYS.map((key, index) => [key, 1 + ((hash >>> (index * 3)) % Math.min(5, wallLevel + 1))]),
  ) as Record<DefenseFacilityKey, number>;
  const waveStyle =
    WAVE_STYLES[(hash >>> 12) % WAVE_STYLES.length] ?? "다수 웨이브 압박형";

  return {
    id: `friendly:${friend.id}`,
    callsign: friend.nickname,
    league: "여행 동료 친선전",
    defenseGrade: grades[gradeIndex] ?? "C",
    power: 1_650 + (hash % 920) + wallLevel * 80,
    exposedPoints: 0,
    estimatedLoot: [0, 0],
    battlefield: BATTLEFIELDS[(hash >>> 8) % BATTLEFIELDS.length] ?? BATTLEFIELDS[0],
    visibleUnits: firstUnit === secondUnit ? [firstUnit] : [firstUnit, secondUnit],
    signatureFacility: FACILITY_KEYS[(hash >>> 16) % FACILITY_KEYS.length] ?? "gate",
    recentDefenseRate: 0.42 + ((hash % 31) / 100),
    attacksToday: 0,
    scouted: true,
    hiddenIntel: `${waveStyle} · 성벽 Lv.${wallLevel}`,
    defenseSnapshot: {
      wallLevel,
      facilityLevels,
      waveStyle,
    },
  };
}
