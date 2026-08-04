import { HEROES, HERO_POOL, SINGLE_RECRUIT_COST, TEN_RECRUIT_COST } from "./game-data";
import type {
  HeroDefinition,
  HeroKey,
  HeroRarity,
  RecruitResult,
  TerritoryState,
} from "./types";

const RARITY_RANK: Record<HeroRarity, number> = {
  COMMON: 0,
  RARE: 1,
  EPIC: 2,
  LEGENDARY: 3,
  SINGULARITY: 4,
};

export type RecruitCount = 1 | 10;
export type RandomSource = () => number;

function secureRandom(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] ?? 0) / 4_294_967_296;
}

function normalizedRoll(random: RandomSource): number {
  return Math.min(0.999999999, Math.max(0, random()));
}

function rollBasePool(random: RandomSource): HeroDefinition {
  const roll = normalizedRoll(random) * 100;
  let cumulative = 0;
  for (const hero of HERO_POOL) {
    cumulative += hero.probability;
    if (roll < cumulative) return hero;
  }
  return HEROES.nameless_king;
}

function rollRareGuarantee(random: RandomSource): HeroDefinition {
  return normalizedRoll(random) < 0.6 ? HEROES.kael : HEROES.sena;
}

function rollHero(
  pullsSinceRare: number,
  pullsSinceLegendary: number,
  random: RandomSource,
): HeroDefinition {
  if (pullsSinceLegendary >= 79) return HEROES.astra;
  if (pullsSinceRare >= 9) return rollRareGuarantee(random);
  return rollBasePool(random);
}

export function recruitCost(count: RecruitCount): number {
  return count === 10 ? TEN_RECRUIT_COST : SINGLE_RECRUIT_COST;
}

export function recruitHeroes(
  territory: TerritoryState,
  count: RecruitCount,
  random: RandomSource = secureRandom,
): { territory: TerritoryState; results: RecruitResult[] } | null {
  const cost = recruitCost(count);
  if (territory.recruitSeals < cost) return null;

  let pullsSinceRare = territory.recruit.pullsSinceRare;
  let pullsSinceLegendary = territory.recruit.pullsSinceLegendary;
  let heroFragments = territory.heroFragments;
  const roster = { ...territory.heroRoster };
  const results: RecruitResult[] = [];
  const history = [...territory.recruit.history];

  for (let index = 0; index < count; index += 1) {
    const hero = rollHero(pullsSinceRare, pullsSinceLegendary, random);
    const rank = RARITY_RANK[hero.rarity];
    const isNew = !roster[hero.key];
    const fragmentsGained = isNew ? 0 : hero.duplicateFragments;
    roster[hero.key] = (roster[hero.key] ?? 0) + 1;
    heroFragments += fragmentsGained;
    pullsSinceRare = rank >= RARITY_RANK.RARE ? 0 : pullsSinceRare + 1;
    pullsSinceLegendary = rank >= RARITY_RANK.LEGENDARY ? 0 : pullsSinceLegendary + 1;
    results.push({
      heroKey: hero.key,
      rarity: hero.rarity,
      isNew,
      fragmentsGained,
    });
    history.unshift({
      id: crypto.randomUUID(),
      heroKey: hero.key,
      rarity: hero.rarity,
      acquiredAt: new Date().toISOString(),
    });
  }

  return {
    territory: {
      ...territory,
      recruitSeals: territory.recruitSeals - cost,
      heroFragments,
      heroRoster: roster,
      recruit: {
        totalPulls: territory.recruit.totalPulls + count,
        pullsSinceRare,
        pullsSinceLegendary,
        history: history.slice(0, 50),
      },
    },
    results,
  };
}

export function ownedHeroKeys(territory: TerritoryState): HeroKey[] {
  return (Object.keys(territory.heroRoster) as HeroKey[]).filter(
    (key) => (territory.heroRoster[key] ?? 0) > 0,
  );
}
