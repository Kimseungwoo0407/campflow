export type GameView = "territory" | "defense" | "invasion" | "records" | "battle" | "result";

export type AttackUnitKey = "bulwark" | "lancer" | "marksman" | "sapper";
export type DefenseUnitKey = "warden" | "slinger" | "golem" | "mender";
export type DefenseFacilityKey = "gate" | "watchtower" | "foundry" | "core";
export type BattleOutcome = "IN_PROGRESS" | "ATTACKER_WIN" | "DEFENDER_WIN" | "RETREATED";
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

export interface DefenseConfig {
  unitCounts: Record<DefenseUnitKey, number>;
  waveOrder: DefenseUnitKey[];
  trapZone: 1 | 2 | 3;
  guardianDoctrine: "KNOCKBACK" | "SIEGE_HUNTER" | "CORE_SHIELD";
  skillPriority: "HEAL" | "SLOW" | "BARRAGE";
  updatedAt: string;
}

export interface TerritoryState {
  version: 1;
  generatorLevel: number;
  vaultLevel: number;
  protectedSupply: number;
  exposedSupply: number;
  battlePoints: number;
  rareMaterials: number;
  invasionEnergy: number;
  lastProductionAt: string;
  defense: DefenseConfig;
  records: BattleRecord[];
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
}

export interface Combatant {
  id: string;
  side: "ATTACKER" | "DEFENDER";
  kind: "HERO" | "UNIT" | "GUARDIAN";
  unitKey?: AttackUnitKey | DefenseUnitKey;
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
  leagueDelta: number;
}
