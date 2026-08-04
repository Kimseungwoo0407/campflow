export type GameView =
  | "territory"
  | "defense"
  | "recruit"
  | "invasion"
  | "friendly"
  | "records"
  | "battle"
  | "result";

export type AttackUnitKey = "bulwark" | "lancer" | "marksman" | "sapper";
export type DefenseUnitKey = "warden" | "slinger" | "golem" | "mender";
export type DefenseFacilityKey = "gate" | "watchtower" | "foundry" | "core";
export type HeroKey =
  | "ruan"
  | "mira"
  | "kael"
  | "sena"
  | "orun"
  | "veila"
  | "astra"
  | "nameless_king";
export type HeroRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "SINGULARITY";
export type BattleOutcome = "IN_PROGRESS" | "ATTACKER_WIN" | "DEFENDER_WIN" | "RETREATED";
export type BattleMode = "RANKED" | "FRIENDLY";
export type CommandKind =
  | "MOVE_FORWARD"
  | "MOVE_BACK"
  | "BASIC_ATTACK"
  | "SKILL_RALLY"
  | "SKILL_MEND"
  | "ULTIMATE"
  | "SUMMON"
  | "FOCUS"
  | "RETREAT";

export interface UnitDefinition {
  key: AttackUnitKey | DefenseUnitKey;
  name: string;
  role: string;
  description: string;
  hp: number;
  attack: number;
  attackInterval: number;
  moveSpeed: number;
  range: number;
  armor: number;
  tags: string[];
}

export interface AttackUnitDefinition extends UnitDefinition {
  key: AttackUnitKey;
  commandCost: number;
  cooldown: number;
  population: number;
}

export interface DefenseUnitDefinition extends UnitDefinition {
  key: DefenseUnitKey;
  defenseCost: number;
}

export interface DefenseFacilityDefinition {
  key: DefenseFacilityKey;
  name: string;
  role: string;
  maxHp: number;
  range: number;
  attack: number;
  attackInterval: number;
  defenseCost: number;
  weakness: string;
  destroyEffect: string;
}

export interface HeroDefinition {
  key: HeroKey;
  name: string;
  epithet: string;
  role: string;
  description: string;
  rarity: HeroRarity;
  probability: number;
  hp: number;
  attack: number;
  armor: number;
  range: number;
  moveSpeed: number;
  attackInterval: number;
  commandBonus: number;
  populationBonus: number;
  passive: string;
  duplicateFragments: number;
}

export interface DefenseConfig {
  unitCounts: Record<DefenseUnitKey, number>;
  facilityLevels: Record<DefenseFacilityKey, number>;
  waveOrder: DefenseUnitKey[];
  trapZone: 1 | 2 | 3;
  guardianDoctrine: "KNOCKBACK" | "SIEGE_HUNTER" | "CORE_SHIELD";
  skillPriority: "HEAL" | "SLOW" | "BARRAGE";
  updatedAt: string;
}

export interface RecruitHistoryEntry {
  id: string;
  heroKey: HeroKey;
  rarity: HeroRarity;
  acquiredAt: string;
}

export interface RecruitState {
  totalPulls: number;
  pullsSinceRare: number;
  pullsSinceLegendary: number;
  history: RecruitHistoryEntry[];
}

export interface RecruitResult {
  heroKey: HeroKey;
  rarity: HeroRarity;
  isNew: boolean;
  fragmentsGained: number;
}

export interface TerritoryState {
  version: 2;
  generatorLevel: number;
  vaultLevel: number;
  wallLevel: number;
  protectedSupply: number;
  exposedSupply: number;
  battlePoints: number;
  rareMaterials: number;
  recruitSeals: number;
  heroFragments: number;
  heroRoster: Partial<Record<HeroKey, number>>;
  activeHeroKey: HeroKey;
  recruit: RecruitState;
  invasionEnergy: number;
  lastProductionAt: string;
  defense: DefenseConfig;
  friendlyStats: {
    played: number;
    wins: number;
    lastOpponentId: string | null;
  };
  records: BattleRecord[];
}

export interface TripFriend {
  id: string;
  nickname: string;
}

export interface MatchCandidate {
  id: string;
  callsign: string;
  league: string;
  defenseGrade: "C" | "B" | "A" | "S";
  power: number;
  exposedPoints: number;
  estimatedLoot: [number, number];
  battlefield: string;
  visibleUnits: DefenseUnitKey[];
  signatureFacility: DefenseFacilityKey;
  recentDefenseRate: number;
  attacksToday: number;
  scouted: boolean;
  hiddenIntel: string;
  defenseSnapshot?: {
    wallLevel: number;
    facilityLevels: Record<DefenseFacilityKey, number>;
    waveStyle: string;
  };
}

export interface Combatant {
  id: string;
  side: "ATTACKER" | "DEFENDER";
  kind: "HERO" | "UNIT" | "GUARDIAN";
  unitKey?: AttackUnitKey | DefenseUnitKey;
  heroKey?: HeroKey;
  name: string;
  x: number;
  hp: number;
  maxHp: number;
  attack: number;
  armor: number;
  range: number;
  moveSpeed: number;
  attackInterval: number;
  attackCooldown: number;
  population: number;
  status: "MOVING" | "ATTACKING" | "STUNNED" | "DEAD";
}

export interface BattleStructure {
  id: DefenseFacilityKey;
  name: string;
  x: number;
  hp: number;
  maxHp: number;
  attack: number;
  range: number;
  attackInterval: number;
  attackCooldown: number;
  status: "ACTIVE" | "DAMAGED" | "DESTROYED";
}

export interface BattleCommandLog {
  sequence: number;
  at: number;
  kind: CommandKind;
  payload?: string;
}

export interface BattleState {
  id: string;
  mode: BattleMode;
  seed: number;
  candidate: MatchCandidate;
  elapsed: number;
  timeLimit: number;
  command: number;
  maxCommand: number;
  hero: Combatant;
  attackers: Combatant[];
  defenders: Combatant[];
  structures: BattleStructure[];
  unitCooldowns: Record<AttackUnitKey, number>;
  populationUsed: number;
  populationCap: number;
  defenderReserve: number;
  waveClock: number;
  waveIndex: number;
  destroyedCount: number;
  emergencyTriggered: boolean;
  securedLoot: number;
  currentZone: number;
  channelProgress: number;
  rallyTime: number;
  ultimateUsed: boolean;
  focusMode: boolean;
  outcome: BattleOutcome;
  commands: BattleCommandLog[];
  message: string;
}

export interface BattleRecord {
  id: string;
  mode: BattleMode;
  opponentId: string;
  opponent: string;
  outcome: Exclude<BattleOutcome, "IN_PROGRESS">;
  completedAt: string;
  duration: number;
  reachedZone: number;
  destroyedFacilities: number;
  securedLoot: number;
  mvpUnit: string;
  commands: BattleCommandLog[];
  seed: number;
}

export interface BattleResultSummary {
  record: BattleRecord;
  rewardBattlePoints: number;
  rewardRareMaterials: number;
  rewardRecruitSeals: number;
  leagueDelta: number;
}
