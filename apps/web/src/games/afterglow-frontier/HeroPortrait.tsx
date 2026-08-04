import { HEROES } from "./game-data";
import type { Combatant, HeroKey } from "./types";
import { WarriorSprite } from "./WarriorSprite";

export function HeroPortrait({ heroKey }: { heroKey: HeroKey }) {
  const hero = HEROES[heroKey];
  const combatant: Combatant = {
    id: `portrait-${heroKey}`,
    side: "ATTACKER",
    kind: "HERO",
    heroKey,
    name: hero.name,
    x: 0,
    hp: hero.hp,
    maxHp: hero.hp,
    attack: hero.attack,
    armor: hero.armor,
    range: hero.range,
    moveSpeed: hero.moveSpeed,
    attackInterval: hero.attackInterval,
    attackCooldown: 0,
    population: 0,
    status: "MOVING",
  };

  return (
    <span className={`af-hero-portrait af-rarity--${hero.rarity.toLowerCase()}`} aria-hidden="true">
      <i className="af-hero-portrait__halo" />
      <WarriorSprite unit={combatant} />
    </span>
  );
}
