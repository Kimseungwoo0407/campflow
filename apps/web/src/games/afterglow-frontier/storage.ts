import {
  DEFAULT_DEFENSE,
  HEROES,
  PROTECTED_RATIO,
  createInitialTerritory,
  generatorCapacity,
  generatorRate,
  vaultCapacity,
} from "./game-data";
import type { HeroKey, TerritoryState } from "./types";

const STORAGE_PREFIX = "campflow:afterglow-frontier:v1";

function storageKey(tripId: string, userId: string): string {
  return `${STORAGE_PREFIX}:${tripId}:${userId}`;
}

export function loadTerritory(tripId: string, userId: string): TerritoryState {
  if (typeof window === "undefined") return createInitialTerritory();
  try {
    const raw = window.localStorage.getItem(storageKey(tripId, userId));
    if (!raw) return createInitialTerritory();
    const parsed = JSON.parse(raw) as Partial<Omit<TerritoryState, "version">> & {
      version?: number;
    };
    if ((parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.records)) {
      return createInitialTerritory();
    }
    const fallback = createInitialTerritory();
    const roster = { ...fallback.heroRoster, ...(parsed.heroRoster ?? {}) };
    const requestedHero = parsed.activeHeroKey;
    const activeHeroKey: HeroKey =
      requestedHero && HEROES[requestedHero] && (roster[requestedHero] ?? 0) > 0
        ? requestedHero
        : "ruan";
    return {
      ...fallback,
      ...parsed,
      version: 2,
      wallLevel: Math.max(1, parsed.wallLevel ?? fallback.wallLevel),
      recruitSeals: Math.max(0, parsed.recruitSeals ?? fallback.recruitSeals),
      heroFragments: Math.max(0, parsed.heroFragments ?? fallback.heroFragments),
      heroRoster: roster,
      activeHeroKey,
      recruit: {
        ...fallback.recruit,
        ...(parsed.recruit ?? {}),
        history: Array.isArray(parsed.recruit?.history) ? parsed.recruit.history.slice(0, 50) : [],
      },
      defense: {
        ...fallback.defense,
        ...(parsed.defense ?? {}),
        unitCounts: {
          ...DEFAULT_DEFENSE.unitCounts,
          ...(parsed.defense?.unitCounts ?? {}),
        },
        facilityLevels: {
          ...DEFAULT_DEFENSE.facilityLevels,
          ...(parsed.defense?.facilityLevels ?? {}),
        },
        waveOrder: Array.isArray(parsed.defense?.waveOrder)
          ? parsed.defense.waveOrder
          : [...DEFAULT_DEFENSE.waveOrder],
      },
      friendlyStats: {
        ...fallback.friendlyStats,
        ...(parsed.friendlyStats ?? {}),
      },
      records: parsed.records.map((record) => ({
        ...record,
        mode: record.mode ?? "RANKED",
        opponentId: record.opponentId ?? record.opponent,
      })),
    };
  } catch {
    return createInitialTerritory();
  }
}

export function saveTerritory(tripId: string, userId: string, state: TerritoryState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(tripId, userId), JSON.stringify(state));
  } catch {
    // Storage may be unavailable in private browsing. The live session remains playable.
  }
}

export function unclaimedProduction(state: TerritoryState, now = Date.now()): number {
  const elapsedHours = Math.max(0, now - new Date(state.lastProductionAt).getTime()) / 3_600_000;
  return Math.floor(
    Math.min(
      generatorCapacity(state.generatorLevel),
      elapsedHours * generatorRate(state.generatorLevel),
    ),
  );
}

export function collectProduction(state: TerritoryState, now = new Date()): TerritoryState {
  const produced = unclaimedProduction(state, now.getTime());
  if (produced <= 0) return { ...state, lastProductionAt: now.toISOString() };
  const desiredProtected = Math.floor(produced * PROTECTED_RATIO);
  const vaultRoom = Math.max(0, vaultCapacity(state.vaultLevel) - state.protectedSupply);
  const protectedGain = Math.min(desiredProtected, vaultRoom);
  return {
    ...state,
    protectedSupply: state.protectedSupply + protectedGain,
    exposedSupply: state.exposedSupply + produced - protectedGain,
    lastProductionAt: now.toISOString(),
  };
}

export function spendSupply(state: TerritoryState, amount: number): TerritoryState | null {
  if (amount < 0 || state.protectedSupply + state.exposedSupply < amount) return null;
  const exposedSpend = Math.min(state.exposedSupply, amount);
  return {
    ...state,
    exposedSupply: state.exposedSupply - exposedSpend,
    protectedSupply: state.protectedSupply - (amount - exposedSpend),
  };
}
