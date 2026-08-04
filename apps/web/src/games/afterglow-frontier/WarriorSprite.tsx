import type { AttackUnitKey, Combatant, DefenseUnitKey } from "./types";

type WarriorKind = "hero" | "guardian" | AttackUnitKey | DefenseUnitKey;

function warriorKind(unit: Combatant): WarriorKind {
  if (unit.kind === "HERO") return "hero";
  if (unit.kind === "GUARDIAN") return "guardian";
  return unit.unitKey ?? "warden";
}

export function WarriorSprite({ unit }: { unit: Combatant }) {
  const kind = warriorKind(unit);
  const heroVariant = unit.kind === "HERO" && unit.heroKey ? ` af-warrior--hero-${unit.heroKey}` : "";
  const hasShield = kind === "bulwark" || kind === "warden";
  const hasCape = kind === "hero" || kind === "marksman" || kind === "slinger";
  const hasSignal = kind === "hero" || kind === "mender";

  return (
    <span
      className={`af-warrior af-warrior--${kind} af-warrior--${unit.side.toLowerCase()}${heroVariant}`}
      aria-hidden="true"
    >
      <span className="af-warrior__shadow" />
      <span className="af-warrior__rig">
        {hasCape && <span className="af-warrior__cape" />}
        <span className="af-warrior__leg af-warrior__leg--back">
          <i />
        </span>
        <span className="af-warrior__arm af-warrior__arm--back">
          <i />
        </span>
        <span className="af-warrior__body">
          <i />
        </span>
        <span className="af-warrior__belt" />
        <span className="af-warrior__head">
          <i />
        </span>
        <span className="af-warrior__leg af-warrior__leg--front">
          <i />
        </span>
        <span className="af-warrior__arm af-warrior__arm--front">
          <i />
        </span>
        {hasShield && (
          <span className="af-warrior__shield">
            <i />
          </span>
        )}
        <span className="af-warrior__weapon">
          <i />
        </span>
        {hasSignal && <span className="af-warrior__signal" />}
      </span>
    </span>
  );
}
