import type {
  AttackUnitDefinition,
  AttackUnitKey,
  DefenseConfig,
  DefenseFacilityDefinition,
  DefenseFacilityKey,
  DefenseUnitDefinition,
  DefenseUnitKey,
  HeroDefinition,
  HeroKey,
  MatchCandidate,
  TerritoryState,
} from "./types";

export const BALANCE_VERSION = "mvp-2026.08.04.3";
export const BASE_DEFENSE_BUDGET = 100;
export const BATTLE_TIME_LIMIT = 120;
export const PROTECTED_RATIO = 0.75;
export const SINGLE_RECRUIT_COST = 1;
export const TEN_RECRUIT_COST = 10;

export const HERO_RARITY_LABELS = {
  COMMON: "일반",
  RARE: "희귀",
  EPIC: "영웅",
  LEGENDARY: "전설",
  SINGULARITY: "특이점",
} as const;

export const HEROES: Record<HeroKey, HeroDefinition> = {
  ruan: {
    key: "ruan",
    name: "길잡이 르완",
    epithet: "재의 선봉",
    role: "균형 지휘관",
    description: "튼튼한 전열과 안정적인 지휘 자원으로 첫 원정을 이끕니다.",
    rarity: "COMMON",
    probability: 42,
    hp: 560,
    attack: 58,
    armor: 7,
    range: 5.5,
    moveSpeed: 5,
    attackInterval: 0.7,
    commandBonus: 8,
    populationBonus: 0,
    passive: "전투 시작 및 최대 지휘 자원 +8",
    duplicateFragments: 5,
  },
  mira: {
    key: "mira",
    name: "등불지기 미라",
    epithet: "황혼의 약속",
    role: "회복 지원형",
    description: "높은 생존력으로 전선을 유지하고 치유 전술을 강화합니다.",
    rarity: "COMMON",
    probability: 33,
    hp: 620,
    attack: 45,
    armor: 8,
    range: 6.5,
    moveSpeed: 4.6,
    attackInterval: 0.8,
    commandBonus: 4,
    populationBonus: 0,
    passive: "기본 체력 620, 최대 지휘 자원 +4",
    duplicateFragments: 5,
  },
  kael: {
    key: "kael",
    name: "철벽 카엘",
    epithet: "무너진 문지기",
    role: "전열 돌파형",
    description: "중장 부대를 넓게 운용하며 성문 앞 교환비를 높입니다.",
    rarity: "RARE",
    probability: 12,
    hp: 720,
    attack: 54,
    armor: 12,
    range: 4.5,
    moveSpeed: 4.3,
    attackInterval: 0.78,
    commandBonus: 6,
    populationBonus: 2,
    passive: "소환 인구 한도 +2, 기본 방어력 12",
    duplicateFragments: 12,
  },
  sena: {
    key: "sena",
    name: "매눈 세나",
    epithet: "긴 밤의 관측자",
    role: "원거리 지휘형",
    description: "긴 사거리와 빠른 집중 명령으로 후방 시설을 압박합니다.",
    rarity: "RARE",
    probability: 8,
    hp: 480,
    attack: 70,
    armor: 5,
    range: 8.5,
    moveSpeed: 5.2,
    attackInterval: 0.65,
    commandBonus: 8,
    populationBonus: 0,
    passive: "영웅 사거리 8.5, 최대 지휘 자원 +8",
    duplicateFragments: 12,
  },
  orun: {
    key: "orun",
    name: "파성추 오룬",
    epithet: "검은 화약의 주인",
    role: "공성 특화형",
    description: "시설에 강한 일격을 가하고 공성병의 배치를 앞당깁니다.",
    rarity: "EPIC",
    probability: 2.5,
    hp: 590,
    attack: 88,
    armor: 7,
    range: 5,
    moveSpeed: 4.7,
    attackInterval: 0.82,
    commandBonus: 10,
    populationBonus: 1,
    passive: "영웅 공격력 88, 최대 지휘 +10, 인구 +1",
    duplicateFragments: 35,
  },
  veila: {
    key: "veila",
    name: "서리맥 베일라",
    epithet: "고요를 베는 자",
    role: "군중 제어형",
    description: "빠른 공격으로 웨이브를 묶고 지휘 자원 회복을 보조합니다.",
    rarity: "EPIC",
    probability: 2,
    hp: 530,
    attack: 76,
    armor: 6,
    range: 6,
    moveSpeed: 5.8,
    attackInterval: 0.52,
    commandBonus: 14,
    populationBonus: 0,
    passive: "공격 주기 0.52초, 최대 지휘 자원 +14",
    duplicateFragments: 35,
  },
  astra: {
    key: "astra",
    name: "성흔 아스트라",
    epithet: "새벽을 훔친 장군",
    role: "전군 강화형",
    description: "넓은 인구 한도와 강력한 지휘력으로 대규모 공세를 엽니다.",
    rarity: "LEGENDARY",
    probability: 0.4999,
    hp: 760,
    attack: 96,
    armor: 11,
    range: 7,
    moveSpeed: 5.4,
    attackInterval: 0.58,
    commandBonus: 24,
    populationBonus: 3,
    passive: "최대 지휘 자원 +24, 소환 인구 한도 +3",
    duplicateFragments: 100,
  },
  nameless_king: {
    key: "nameless_king",
    name: "무명의 왕",
    epithet: "백만 번째 잔광",
    role: "특이점 지휘관",
    description: "기록에서 지워진 왕. 전장 규칙의 틈을 이용해 최후의 돌파를 지휘합니다.",
    rarity: "SINGULARITY",
    probability: 0.0001,
    hp: 920,
    attack: 118,
    armor: 14,
    range: 7.5,
    moveSpeed: 5.7,
    attackInterval: 0.5,
    commandBonus: 30,
    populationBonus: 4,
    passive: "최대 지휘 +30, 인구 +4, 기본 체력 920",
    duplicateFragments: 500,
  },
};

export const HERO_POOL = Object.values(HEROES);

export const ATTACK_UNITS: Record<AttackUnitKey, AttackUnitDefinition> = {
  bulwark: {
    key: "bulwark",
    name: "철피 선봉대",
    role: "전선 탱커",
    description: "전방 피해를 받아내며 아군이 진입할 시간을 법니다.",
    commandCost: 28,
    cooldown: 8,
    population: 3,
    hp: 390,
    attack: 24,
    attackInterval: 1.2,
    moveSpeed: 2.6,
    range: 2.4,
    armor: 9,
    tags: ["중장", "전열"],
  },
  lancer: {
    key: "lancer",
    name: "사슬창 돌격대",
    role: "근접 돌파",
    description: "밀집한 방어병을 빠르게 정리하지만 포탑에 약합니다.",
    commandCost: 20,
    cooldown: 5,
    population: 2,
    hp: 220,
    attack: 44,
    attackInterval: 0.9,
    moveSpeed: 3.8,
    range: 2.8,
    armor: 3,
    tags: ["경장", "돌격"],
  },
  marksman: {
    key: "marksman",
    name: "태엽 석궁수",
    role: "원거리 화력",
    description: "안전한 거리에서 방어 유닛을 우선 사격합니다.",
    commandCost: 24,
    cooldown: 7,
    population: 2,
    hp: 155,
    attack: 49,
    attackInterval: 1.35,
    moveSpeed: 2.8,
    range: 11,
    armor: 1,
    tags: ["원거리", "대인"],
  },
  sapper: {
    key: "sapper",
    name: "균열 공병",
    role: "시설 해체",
    description: "시설에 큰 피해를 주지만 방어 유닛에게 쉽게 노출됩니다.",
    commandCost: 34,
    cooldown: 11,
    population: 3,
    hp: 180,
    attack: 92,
    attackInterval: 1.55,
    moveSpeed: 2.3,
    range: 3.5,
    armor: 1,
    tags: ["공성", "시설우선"],
  },
};

export const DEFENSE_UNITS: Record<DefenseUnitKey, DefenseUnitDefinition> = {
  warden: {
    key: "warden",
    name: "잿빛 순찰병",
    role: "기본 전열",
    description: "값싼 전열 병력으로 공격자의 시간을 소모시킵니다.",
    defenseCost: 8,
    hp: 180,
    attack: 25,
    attackInterval: 1.1,
    moveSpeed: 2.8,
    range: 2.5,
    armor: 4,
    tags: ["기본", "전열"],
  },
  slinger: {
    key: "slinger",
    name: "침엽 투척병",
    role: "후열 견제",
    description: "공격 영웅과 경장 유닛을 원거리에서 압박합니다.",
    defenseCost: 12,
    hp: 125,
    attack: 38,
    attackInterval: 1.4,
    moveSpeed: 2.4,
    range: 10,
    armor: 1,
    tags: ["원거리", "영웅견제"],
  },
  golem: {
    key: "golem",
    name: "점토 장벽체",
    role: "지연 중장",
    description: "느리지만 단단하며 공성병을 몸으로 차단합니다.",
    defenseCost: 18,
    hp: 420,
    attack: 31,
    attackInterval: 1.6,
    moveSpeed: 1.7,
    range: 2.2,
    armor: 10,
    tags: ["중장", "공성차단"],
  },
  mender: {
    key: "mender",
    name: "맥동 봉합사",
    role: "회복 지원",
    description: "시설 뒤에서 방어 병력의 생존 시간을 늘립니다.",
    defenseCost: 16,
    hp: 140,
    attack: 18,
    attackInterval: 1.2,
    moveSpeed: 2.1,
    range: 8,
    armor: 1,
    tags: ["지원", "회복"],
  },
};

export const DEFENSE_FACILITIES: Record<DefenseFacilityKey, DefenseFacilityDefinition> = {
  gate: {
    key: "gate",
    name: "외곽 접철문",
    role: "첫 지연선",
    maxHp: 720,
    range: 0,
    attack: 0,
    attackInterval: 0,
    defenseCost: 12,
    weakness: "균열 공병",
    destroyEffect: "외곽 전리품 10% 확정",
  },
  watchtower: {
    key: "watchtower",
    name: "유리촉 감시탑",
    role: "원거리 압박",
    maxHp: 520,
    range: 18,
    attack: 34,
    attackInterval: 1.4,
    defenseCost: 16,
    weakness: "철피 선봉대 뒤의 원거리병",
    destroyEffect: "포탑 사격과 영웅 표식 제거",
  },
  foundry: {
    key: "foundry",
    name: "맥동 주조소",
    role: "방어 웨이브 생성",
    maxHp: 610,
    range: 12,
    attack: 20,
    attackInterval: 1.8,
    defenseCost: 18,
    weakness: "공성 집중 공격",
    destroyEffect: "웨이브 간격 +2초, 출현 수 -1",
  },
  core: {
    key: "core",
    name: "잔광 중추",
    role: "최종 핵심 시설",
    maxHp: 1_250,
    range: 13,
    attack: 30,
    attackInterval: 1.5,
    defenseCost: 22,
    weakness: "수호자 제거 후 집중 화력",
    destroyEffect: "5초 점령 채널 개방",
  },
};

export const DEFAULT_DEFENSE: DefenseConfig = {
  unitCounts: { warden: 2, slinger: 1, golem: 1, mender: 1 },
  facilityLevels: { gate: 1, watchtower: 1, foundry: 1, core: 1 },
  waveOrder: ["warden", "slinger", "golem", "mender"],
  trapZone: 2,
  guardianDoctrine: "SIEGE_HUNTER",
  skillPriority: "SLOW",
  updatedAt: new Date(0).toISOString(),
};

export const MATCH_CANDIDATES: MatchCandidate[] = [
  {
    id: "amber-cairn",
    callsign: "호박 봉화대",
    league: "청동 파수단 II",
    defenseGrade: "B",
    power: 1_940,
    exposedPoints: 1_180,
    estimatedLoot: [150, 228],
    battlefield: "마른 바람 · 원거리 명중 -5%",
    visibleUnits: ["warden", "slinger"],
    signatureFacility: "watchtower",
    recentDefenseRate: 0.54,
    attacksToday: 1,
    scouted: false,
    hiddenIntel: "중앙 2구역에 구속 함정, 긴급 웨이브는 점토 장벽체 2기",
  },
  {
    id: "moss-sluice",
    callsign: "이끼 수문령",
    league: "청동 파수단 I",
    defenseGrade: "A",
    power: 2_120,
    exposedPoints: 1_460,
    estimatedLoot: [170, 265],
    battlefield: "습윤 지대 · 치료 효과 +8%",
    visibleUnits: ["golem", "mender"],
    signatureFacility: "foundry",
    recentDefenseRate: 0.63,
    attacksToday: 0,
    scouted: false,
    hiddenIntel: "주조소 파괴 전까지 기본 웨이브마다 봉합사 1기 추가",
  },
  {
    id: "glass-ridge",
    callsign: "유리등성이",
    league: "은빛 파수단 III",
    defenseGrade: "S",
    power: 2_340,
    exposedPoints: 1_920,
    estimatedLoot: [205, 318],
    battlefield: "결정 분진 · 공성 피해 +6%, 영웅 방어 -4%",
    visibleUnits: ["slinger", "golem"],
    signatureFacility: "core",
    recentDefenseRate: 0.71,
    attacksToday: 2,
    scouted: false,
    hiddenIntel: "수호자 교리: 핵심 보호막. 궁극기는 최종 구역까지 보존 권장",
  },
];

export function createInitialTerritory(now = new Date()): TerritoryState {
  return {
    version: 2,
    generatorLevel: 1,
    vaultLevel: 1,
    wallLevel: 1,
    protectedSupply: 1_350,
    exposedSupply: 310,
    battlePoints: 180,
    rareMaterials: 0,
    recruitSeals: 12,
    heroFragments: 0,
    heroRoster: { ruan: 1 },
    activeHeroKey: "ruan",
    recruit: {
      totalPulls: 0,
      pullsSinceRare: 0,
      pullsSinceLegendary: 0,
      history: [],
    },
    invasionEnergy: 4,
    lastProductionAt: now.toISOString(),
    defense: { ...DEFAULT_DEFENSE, unitCounts: { ...DEFAULT_DEFENSE.unitCounts } },
    friendlyStats: {
      played: 0,
      wins: 0,
      lastOpponentId: null,
    },
    records: [],
  };
}

export function generatorRate(level: number): number {
  return 72 + (level - 1) * 24;
}

export function generatorCapacity(level: number): number {
  return generatorRate(level) * (6 + Math.min(4, level - 1));
}

export function vaultCapacity(level: number): number {
  return 2_000 + (level - 1) * 900;
}

export function defenseBudget(wallLevel: number): number {
  return BASE_DEFENSE_BUDGET + Math.max(0, wallLevel - 1) * 18;
}

export function wallUpgradeCost(level: number): number {
  return 650 + Math.max(1, level) * 350;
}

export function wallIntegrity(level: number): number {
  return Math.round(100 * (1 + Math.max(0, level - 1) * 0.15));
}

export function facilityUpgradeCost(key: DefenseFacilityKey): number {
  return { gate: 6, watchtower: 8, foundry: 9, core: 12 }[key];
}

export function defenseCost(config: DefenseConfig): number {
  const unitCost = (Object.keys(config.unitCounts) as DefenseUnitKey[]).reduce(
    (total, key) => total + DEFENSE_UNITS[key].defenseCost * config.unitCounts[key],
    0,
  );
  const doctrineCost = config.guardianDoctrine === "CORE_SHIELD" ? 14 : 10;
  const skillCost = config.skillPriority === "HEAL" ? 10 : 8;
  const facilityCost = (Object.keys(config.facilityLevels) as DefenseFacilityKey[]).reduce(
    (total, key) =>
      total + Math.max(0, config.facilityLevels[key] - 1) * facilityUpgradeCost(key),
    0,
  );
  return unitCost + doctrineCost + skillCost + facilityCost + 6;
}
