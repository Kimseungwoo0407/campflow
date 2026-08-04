import { ATTACK_UNITS, BATTLE_TIME_LIMIT, DEFENSE_FACILITIES, DEFENSE_UNITS } from "./game-data";
import type {
  AttackUnitKey,
  BattleCommandLog,
  BattleOutcome,
  BattleRecord,
  BattleState,
  Combatant,
  CommandKind,
  DefenseUnitKey,
  MatchCandidate,
} from "./types";

const TICK_SECONDS = 0.25;
const ATTACKER_POWER = 2_080;

const ZONE_LOOT_SHARE = [0, 0.1, 0.25, 0.45, 0.65, 1] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createDefender(key: DefenseUnitKey, x: number, index: number): Combatant {
  const definition = DEFENSE_UNITS[key];
  return {
    id: nextId(`def-${index}`),
    side: "DEFENDER",
    kind: "UNIT",
    unitKey: key,
    name: definition.name,
    x,
    hp: definition.hp,
    maxHp: definition.hp,
    attack: definition.attack,
    armor: definition.armor,
    range: definition.range,
    moveSpeed: definition.moveSpeed,
    attackInterval: definition.attackInterval,
    attackCooldown: 0,
    population: 0,
    status: "MOVING",
  };
}

function createGuardian(): Combatant {
  return {
    id: "guardian",
    side: "DEFENDER",
    kind: "GUARDIAN",
    name: "마디뿔 수호자",
    x: 85,
    hp: 880,
    maxHp: 880,
    attack: 58,
    armor: 11,
    range: 4.5,
    moveSpeed: 1.4,
    attackInterval: 1.35,
    attackCooldown: 0,
    population: 0,
    status: "MOVING",
  };
}

export function calculateLoot(params: {
  exposedPoints: number;
  reachedZone: number;
  attackerPower: number;
  defenderPower: number;
  repeatCount: number;
  protectionFactor: number;
}): number {
  const reachedZone = clamp(Math.floor(params.reachedZone), 0, 5);
  const share = ZONE_LOOT_SHARE[reachedZone] ?? 0;
  const powerCorrection = clamp(
    1 + ((params.defenderPower - params.attackerPower) / Math.max(1, params.attackerPower)) * 0.35,
    0.75,
    1.2,
  );
  const repeatDecay = [1, 0.45, 0.18, 0.05][Math.min(3, Math.max(0, params.repeatCount))] ?? 0.05;
  const baseCap = Math.min(320, Math.floor(params.exposedPoints * 0.18));
  return Math.max(
    0,
    Math.floor(
      baseCap * share * powerCorrection * repeatDecay * clamp(params.protectionFactor, 0, 1),
    ),
  );
}

function lootAtZone(candidate: MatchCandidate, zone: number): number {
  return calculateLoot({
    exposedPoints: candidate.exposedPoints,
    reachedZone: zone,
    attackerPower: ATTACKER_POWER,
    defenderPower: candidate.power,
    repeatCount: 0,
    protectionFactor: 1,
  });
}

export function createBattle(candidate: MatchCandidate): BattleState {
  const structures: BattleState["structures"] = (
    [
      ["gate", 27],
      ["watchtower", 49],
      ["foundry", 69],
      ["core", 94],
    ] as const
  ).map(([key, x]) => {
    const definition = DEFENSE_FACILITIES[key];
    return {
      id: key,
      name: definition.name,
      x,
      hp: definition.maxHp,
      maxHp: definition.maxHp,
      attack: definition.attack,
      range: definition.range,
      attackInterval: definition.attackInterval,
      attackCooldown: 0,
      status: "ACTIVE",
    };
  });
  return {
    id: crypto.randomUUID(),
    seed: Math.floor(Math.random() * 2_147_483_647),
    candidate,
    elapsed: 0,
    timeLimit: BATTLE_TIME_LIMIT,
    command: 64,
    maxCommand: 100,
    hero: {
      id: "hero",
      side: "ATTACKER",
      kind: "HERO",
      name: "길잡이 류안",
      x: 8,
      hp: 560,
      maxHp: 560,
      attack: 58,
      armor: 7,
      range: 5.5,
      moveSpeed: 5,
      attackInterval: 0.7,
      attackCooldown: 0,
      population: 0,
      status: "MOVING",
    },
    attackers: [],
    defenders: [
      createDefender("warden", 31, 0),
      createDefender("slinger", 43, 1),
      createDefender("golem", 61, 2),
      createDefender("mender", 73, 3),
      createGuardian(),
    ],
    structures,
    unitCooldowns: { bulwark: 0, lancer: 0, marksman: 0, sapper: 0 },
    populationUsed: 0,
    populationCap: 10,
    defenderReserve: 22,
    waveClock: 0,
    waveIndex: 0,
    destroyedCount: 0,
    emergencyTriggered: false,
    securedLoot: 0,
    currentZone: 0,
    channelProgress: 0,
    rallyTime: 0,
    ultimateUsed: false,
    focusMode: false,
    outcome: "IN_PROGRESS",
    commands: [],
    message: "외곽 방어선에 진입했습니다.",
  };
}

function appendCommand(
  state: BattleState,
  kind: CommandKind,
  payload?: string,
): BattleCommandLog[] {
  const base = {
    sequence: state.commands.length + 1,
    at: Number(state.elapsed.toFixed(2)),
    kind,
  };
  return [...state.commands, payload === undefined ? base : { ...base, payload }];
}

export function moveHero(state: BattleState, direction: -1 | 1): BattleState {
  if (state.outcome !== "IN_PROGRESS" || state.hero.hp <= 0) return state;
  const nearestLivingStructure = state.structures.find(
    (structure) => structure.status !== "DESTROYED",
  );
  const forwardLimit = nearestLivingStructure ? nearestLivingStructure.x - 1.4 : 97;
  const nextX =
    direction > 0 ? Math.min(forwardLimit, state.hero.x + 3.2) : Math.max(3, state.hero.x - 3.2);
  return {
    ...state,
    hero: { ...state.hero, x: nextX, status: "MOVING" },
    commands: appendCommand(state, direction > 0 ? "MOVE_FORWARD" : "MOVE_BACK"),
  };
}

export function heroAttack(state: BattleState): BattleState {
  if (state.outcome !== "IN_PROGRESS" || state.hero.hp <= 0 || state.hero.attackCooldown > 0) {
    return state;
  }
  const defenders = state.defenders.map((unit) => ({ ...unit }));
  const structures = state.structures.map((structure) => ({ ...structure }));
  const target = defenders
    .filter((unit) => unit.hp > 0 && Math.abs(unit.x - state.hero.x) <= state.hero.range)
    .sort((a, b) => Math.abs(a.x - state.hero.x) - Math.abs(b.x - state.hero.x))[0];
  let message = "공격 거리에 적이 없습니다.";
  if (target) {
    target.hp = Math.max(0, target.hp - Math.max(1, state.hero.attack - target.armor));
    target.status = target.hp <= 0 ? "DEAD" : "ATTACKING";
    message = `${target.name}에게 기본 공격 적중`;
  } else {
    const structure = structures.find(
      (entry) =>
        entry.status !== "DESTROYED" && Math.abs(entry.x - state.hero.x) <= state.hero.range,
    );
    if (structure) {
      structure.hp = Math.max(0, structure.hp - state.hero.attack);
      message = `${structure.name} 타격`;
    }
  }
  return {
    ...state,
    hero: { ...state.hero, attackCooldown: state.hero.attackInterval, status: "ATTACKING" },
    defenders,
    structures,
    commands: appendCommand(state, "BASIC_ATTACK"),
    message,
  };
}

export function summonUnit(state: BattleState, key: AttackUnitKey): BattleState {
  const definition = ATTACK_UNITS[key];
  if (
    state.outcome !== "IN_PROGRESS" ||
    state.command < definition.commandCost ||
    state.unitCooldowns[key] > 0 ||
    state.populationUsed + definition.population > state.populationCap
  ) {
    return state;
  }
  const unit: Combatant = {
    id: nextId(key),
    side: "ATTACKER",
    kind: "UNIT",
    unitKey: key,
    name: definition.name,
    x: Math.max(5, state.hero.x - 2),
    hp: definition.hp,
    maxHp: definition.hp,
    attack: definition.attack,
    armor: definition.armor,
    range: definition.range,
    moveSpeed: definition.moveSpeed,
    attackInterval: definition.attackInterval,
    attackCooldown: 0,
    population: definition.population,
    status: "MOVING",
  };
  return {
    ...state,
    command: state.command - definition.commandCost,
    attackers: [...state.attackers, unit],
    populationUsed: state.populationUsed + definition.population,
    unitCooldowns: { ...state.unitCooldowns, [key]: definition.cooldown },
    commands: appendCommand(state, "SUMMON", key),
    message: `${definition.name} 출전`,
  };
}

export function useHeroSkill(
  state: BattleState,
  skill: "RALLY" | "MEND" | "ULTIMATE" | "FOCUS",
): BattleState {
  if (state.outcome !== "IN_PROGRESS" || state.hero.hp <= 0) return state;
  if (skill === "RALLY") {
    if (state.command < 18 || state.rallyTime > 0) return state;
    return {
      ...state,
      command: state.command - 18,
      rallyTime: 8,
      commands: appendCommand(state, "SKILL_RALLY"),
      message: "진군 신호: 8초간 공격 부대 강화",
    };
  }
  if (skill === "MEND") {
    if (state.command < 22 || state.hero.hp >= state.hero.maxHp * 0.95) return state;
    return {
      ...state,
      command: state.command - 22,
      hero: { ...state.hero, hp: Math.min(state.hero.maxHp, state.hero.hp + 160) },
      commands: appendCommand(state, "SKILL_MEND"),
      message: "응급 맥동: 영웅 체력 회복",
    };
  }
  if (skill === "FOCUS") {
    return {
      ...state,
      focusMode: !state.focusMode,
      commands: appendCommand(state, "FOCUS"),
      message: state.focusMode ? "집중 공격 해제" : "시설 집중 공격 명령",
    };
  }
  if (state.ultimateUsed) return state;
  return {
    ...state,
    ultimateUsed: true,
    defenders: state.defenders.map((unit) =>
      Math.abs(unit.x - state.hero.x) <= 14
        ? { ...unit, hp: Math.max(0, unit.hp - 210), status: unit.hp <= 210 ? "DEAD" : unit.status }
        : unit,
    ),
    structures: state.structures.map((structure) =>
      Math.abs(structure.x - state.hero.x) <= 12 && structure.status !== "DESTROYED"
        ? { ...structure, hp: Math.max(0, structure.hp - 150) }
        : structure,
    ),
    commands: appendCommand(state, "ULTIMATE"),
    message: "궁극기 · 새벽 균열 발동",
  };
}

export function retreatBattle(state: BattleState): BattleState {
  if (state.outcome !== "IN_PROGRESS") return state;
  return {
    ...state,
    outcome: "RETREATED",
    commands: appendCommand(state, "RETREAT"),
    message: "확보한 전리품을 들고 전략적으로 철수했습니다.",
  };
}

function applyDamage(target: Combatant, rawDamage: number): void {
  target.hp = Math.max(0, target.hp - Math.max(1, rawDamage - target.armor));
  target.status = target.hp <= 0 ? "DEAD" : "ATTACKING";
}

function nearestCombatant(sourceX: number, candidates: Combatant[]): Combatant | undefined {
  return candidates
    .filter((candidate) => candidate.hp > 0)
    .sort((a, b) => Math.abs(sourceX - a.x) - Math.abs(sourceX - b.x))[0];
}

function spawnWave(state: BattleState, defenders: Combatant[], foundryAlive: boolean): number {
  if (state.defenderReserve <= 0 || defenders.filter((unit) => unit.hp > 0).length >= 11) return 0;
  const sequence: DefenseUnitKey[] = ["warden", "slinger", "warden", "golem", "mender"];
  const requested = foundryAlive ? 2 : 1;
  const count = Math.min(requested, state.defenderReserve);
  for (let index = 0; index < count; index += 1) {
    const key = sequence[(state.waveIndex + index) % sequence.length] ?? "warden";
    defenders.push(
      createDefender(key, foundryAlive ? 72 + index : 88 + index, state.waveIndex + index),
    );
  }
  return count;
}

export function tickBattle(state: BattleState): BattleState {
  if (state.outcome !== "IN_PROGRESS") return state;
  const guardianWasAlive = state.defenders.some((unit) => unit.kind === "GUARDIAN" && unit.hp > 0);
  const elapsed = state.elapsed + TICK_SECONDS;
  const hero = {
    ...state.hero,
    attackCooldown: Math.max(0, state.hero.attackCooldown - TICK_SECONDS),
  };
  const attackers = state.attackers.map((unit) => ({
    ...unit,
    attackCooldown: Math.max(0, unit.attackCooldown - TICK_SECONDS),
  }));
  const defenders = state.defenders.map((unit) => ({
    ...unit,
    attackCooldown: Math.max(0, unit.attackCooldown - TICK_SECONDS),
  }));
  const structures = state.structures.map((structure) => ({
    ...structure,
    attackCooldown: Math.max(0, structure.attackCooldown - TICK_SECONDS),
  }));

  const liveAttackers = () => [hero, ...attackers].filter((unit) => unit.hp > 0);
  const liveDefenders = () => defenders.filter((unit) => unit.hp > 0);
  const guardianUnlocked = structures
    .filter((structure) => structure.id !== "core")
    .every((structure) => structure.hp <= 0 || structure.status === "DESTROYED");

  for (const unit of attackers) {
    if (unit.hp <= 0) continue;
    const targetUnit = nearestCombatant(unit.x, liveDefenders());
    const targetStructure = structures.find(
      (structure) =>
        structure.status !== "DESTROYED" && structure.hp > 0 && structure.x >= unit.x - 1,
    );
    const prioritizeStructure = unit.unitKey === "sapper" || state.focusMode;
    const unitDistance = targetUnit ? Math.abs(targetUnit.x - unit.x) : Number.POSITIVE_INFINITY;
    const structureDistance = targetStructure
      ? Math.abs(targetStructure.x - unit.x)
      : Number.POSITIVE_INFINITY;
    if (targetStructure && prioritizeStructure && structureDistance <= unit.range) {
      if (unit.attackCooldown <= 0) {
        targetStructure.hp = Math.max(
          0,
          targetStructure.hp - Math.floor(unit.attack * (state.rallyTime > 0 ? 1.18 : 1)),
        );
        unit.attackCooldown = unit.attackInterval;
      }
      unit.status = "ATTACKING";
    } else if (targetUnit && unitDistance <= unit.range) {
      if (unit.attackCooldown <= 0) {
        applyDamage(targetUnit, Math.floor(unit.attack * (state.rallyTime > 0 ? 1.18 : 1)));
        unit.attackCooldown = unit.attackInterval;
      }
      unit.status = "ATTACKING";
    } else if (targetStructure && structureDistance <= unit.range) {
      if (unit.attackCooldown <= 0) {
        targetStructure.hp = Math.max(
          0,
          targetStructure.hp - Math.floor(unit.attack * (state.rallyTime > 0 ? 1.18 : 1)),
        );
        unit.attackCooldown = unit.attackInterval;
      }
      unit.status = "ATTACKING";
    } else {
      unit.x = Math.min(97, unit.x + unit.moveSpeed * TICK_SECONDS);
      unit.status = "MOVING";
    }
  }

  for (const unit of defenders) {
    if (unit.hp <= 0) continue;
    if (unit.kind === "GUARDIAN" && !guardianUnlocked) {
      unit.x = 85;
      unit.status = "MOVING";
      continue;
    }
    if (unit.unitKey === "mender") {
      const healTarget = defenders
        .filter((candidate) => candidate.hp > 0 && candidate.hp < candidate.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (healTarget && Math.abs(healTarget.x - unit.x) <= unit.range && unit.attackCooldown <= 0) {
        healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + 34);
        unit.attackCooldown = unit.attackInterval;
        unit.status = "ATTACKING";
        continue;
      }
    }
    const target = nearestCombatant(unit.x, liveAttackers());
    if (!target) continue;
    const distance = Math.abs(target.x - unit.x);
    if (distance <= unit.range) {
      if (unit.attackCooldown <= 0) {
        applyDamage(target, unit.attack);
        unit.attackCooldown = unit.attackInterval;
      }
      unit.status = "ATTACKING";
    } else {
      unit.x = Math.max(4, unit.x - unit.moveSpeed * TICK_SECONDS);
      unit.status = "MOVING";
    }
  }

  for (const structure of structures) {
    if (structure.status === "DESTROYED" || structure.hp <= 0 || structure.attack <= 0) continue;
    const target = nearestCombatant(structure.x, liveAttackers());
    if (
      target &&
      Math.abs(target.x - structure.x) <= structure.range &&
      structure.attackCooldown <= 0
    ) {
      const escalation = 1 + Math.max(0, elapsed - 60) / 240;
      applyDamage(target, Math.floor(structure.attack * escalation));
      structure.attackCooldown = structure.attackInterval;
    }
  }

  let newlyDestroyed = 0;
  for (const structure of structures) {
    if (structure.hp <= 0 && structure.status !== "DESTROYED") {
      structure.status = "DESTROYED";
      newlyDestroyed += 1;
    } else if (structure.hp < structure.maxHp * 0.5 && structure.status === "ACTIVE") {
      structure.status = "DAMAGED";
    }
  }

  const guardian = defenders.find((unit) => unit.kind === "GUARDIAN");
  const guardianAlive = Boolean(guardian && guardian.hp > 0);
  const facilityDestroyedCount = structures.filter(
    (structure) => structure.status === "DESTROYED",
  ).length;
  const guardianMilestone = guardianAlive ? 0 : 1;
  const reachedZone = Math.min(5, facilityDestroyedCount + guardianMilestone);
  const securedLoot = Math.max(state.securedLoot, lootAtZone(state.candidate, reachedZone));

  let emergencyTriggered = state.emergencyTriggered;
  let defenderReserve = state.defenderReserve;
  if (!emergencyTriggered && facilityDestroyedCount >= 2 && elapsed <= 48) {
    defenders.push(createDefender("golem", 78, 90), createDefender("golem", 81, 91));
    defenderReserve = Math.max(0, defenderReserve - 2);
    emergencyTriggered = true;
  }

  const foundryAlive = structures.some(
    (structure) => structure.id === "foundry" && structure.status !== "DESTROYED",
  );
  let waveClock = state.waveClock + TICK_SECONDS;
  let waveIndex = state.waveIndex;
  const waveInterval = Math.max(5.5, 9 - elapsed / 45) + (foundryAlive ? 0 : 2);
  if (waveClock >= waveInterval) {
    const spawned = spawnWave({ ...state, defenderReserve, waveIndex }, defenders, foundryAlive);
    defenderReserve = Math.max(0, defenderReserve - spawned);
    waveIndex += spawned;
    waveClock = 0;
  }

  const core = structures.find((structure) => structure.id === "core");
  const channelOpen = core?.status === "DESTROYED";
  const channelContested = defenders.some(
    (unit) => unit.hp > 0 && unit.kind !== "GUARDIAN" && Math.abs(unit.x - hero.x) < 7,
  );
  const channelProgress =
    channelOpen && !guardianAlive && !channelContested && hero.x >= 88 && hero.hp > 0
      ? Math.min(5, state.channelProgress + TICK_SECONDS)
      : Math.max(0, state.channelProgress - TICK_SECONDS * 1.5);

  const populationUsed = attackers
    .filter((unit) => unit.hp > 0)
    .reduce((total, unit) => total + unit.population, 0);
  const latePenalty = elapsed > 85 ? 0.65 : 1;
  const command = Math.min(state.maxCommand, state.command + 2.15 * TICK_SECONDS * latePenalty);
  const unitCooldowns = Object.fromEntries(
    (Object.keys(state.unitCooldowns) as AttackUnitKey[]).map((key) => [
      key,
      Math.max(0, state.unitCooldowns[key] - TICK_SECONDS),
    ]),
  ) as Record<AttackUnitKey, number>;
  const rallyTime = Math.max(0, state.rallyTime - TICK_SECONDS);

  let outcome: BattleOutcome = state.outcome;
  let message = state.message;
  if (channelProgress >= 5) {
    outcome = "ATTACKER_WIN";
    message = "잔광 중추 점령 완료. 완전 승리!";
  } else if (hero.hp <= 0 || elapsed >= state.timeLimit) {
    outcome = "DEFENDER_WIN";
    message = hero.hp <= 0 ? "영웅이 쓰러져 원정이 종료되었습니다." : "제한 시간이 끝났습니다.";
  } else if (newlyDestroyed > 0) {
    message = `방어 시설 ${facilityDestroyedCount}개 파괴 · 전리품 확정`;
  } else if (guardianWasAlive && !guardianAlive) {
    message = "최종 수호자 격파";
  }

  return {
    ...state,
    elapsed,
    command,
    hero,
    attackers: attackers.filter((unit) => unit.hp > 0),
    defenders: defenders.filter((unit) => unit.hp > 0),
    structures,
    unitCooldowns,
    populationUsed,
    defenderReserve,
    waveClock,
    waveIndex,
    destroyedCount: facilityDestroyedCount,
    emergencyTriggered,
    securedLoot,
    currentZone: reachedZone,
    channelProgress,
    rallyTime,
    outcome,
    message,
  };
}

export function battleRecordFromState(state: BattleState): BattleRecord {
  const outcome = state.outcome === "IN_PROGRESS" ? "DEFENDER_WIN" : state.outcome;
  const unitCounts = state.commands
    .filter((command) => command.kind === "SUMMON" && command.payload)
    .reduce<Record<string, number>>((counts, command) => {
      const key = command.payload ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  const mvpKey = Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as
    AttackUnitKey | undefined;
  return {
    id: state.id,
    opponent: state.candidate.callsign,
    outcome,
    completedAt: new Date().toISOString(),
    duration: Math.round(state.elapsed),
    reachedZone: state.currentZone,
    destroyedFacilities: state.destroyedCount,
    securedLoot: state.securedLoot,
    mvpUnit: mvpKey ? ATTACK_UNITS[mvpKey].name : "길잡이 류안",
    commands: state.commands,
    seed: state.seed,
  };
}

export const BATTLE_TICK_MS = TICK_SECONDS * 1_000;
