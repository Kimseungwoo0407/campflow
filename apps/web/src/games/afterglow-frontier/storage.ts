import {
  PROTECTED_RATIO,
  createInitialTerritory,
  generatorCapacity,
  generatorRate,
  vaultCapacity,
} from "./game-data";
import type { TerritoryState } from "./types";

const STORAGE_PREFIX = "campflow:afterglow-frontier:v1";

function storageKey(tripId: string, userId: string): string {
  return `${STORAGE_PREFIX}:${tripId}:${userId}`;
}

export function loadTerritory(tripId: string, userId: string): TerritoryState {
  if (typeof window === "undefined") return createInitialTerritory();
  const raw = window.localStorage.getItem(storageKey(tripId, userId));
  if (!raw) return createInitialTerritory();
  try {
    const parsed = JSON.parse(raw) as TerritoryState;
    if (parsed.version !== 1 || !Array.isArray(parsed.records)) return createInitialTerritory();
    return parsed;
  } catch {
    return createInitialTerritory();
  }
}

export function saveTerritory(tripId: string, userId: string, state: TerritoryState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(tripId, userId), JSON.stringify(state));
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
