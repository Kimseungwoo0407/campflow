import {
  ArrowLeft,
  ArrowRight,
  Castle,
  Crosshair,
  DoorClosed,
  Factory,
  Gem,
  Hammer,
  HeartPulse,
  LogOut,
  RadioTower,
  Shield,
  Sparkles,
  Swords,
  Target,
  Zap,
} from "lucide-react";
import { useEffect } from "react";
import { ATTACK_UNITS } from "./game-data";
import { WarriorSprite } from "./WarriorSprite";
import type { AttackUnitKey, BattleState, DefenseFacilityKey } from "./types";

const attackIcons = {
  bulwark: Shield,
  lancer: Swords,
  marksman: Crosshair,
  sapper: Hammer,
} as const;

function timeLabel(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function StructureGlyph({ id }: { id: DefenseFacilityKey }) {
  if (id === "gate") return <DoorClosed />;
  if (id === "watchtower") return <RadioTower />;
  if (id === "foundry") return <Factory />;
  return <Gem />;
}

export function BattleView({
  battle,
  onMove,
  onAttack,
  onSummon,
  onSkill,
  onRetreat,
}: {
  battle: BattleState;
  onMove: (direction: -1 | 1) => void;
  onAttack: () => void;
  onSummon: (key: AttackUnitKey) => void;
  onSkill: (skill: "RALLY" | "MEND" | "ULTIMATE" | "FOCUS") => void;
  onRetreat: () => void;
}) {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === "ArrowLeft") onMove(-1);
      if (event.key === "ArrowRight") onMove(1);
      if (event.key === " " || event.key.toLowerCase() === "a") {
        event.preventDefault();
        onAttack();
      }
      const summonKeys: Record<string, AttackUnitKey> = {
        "1": "bulwark",
        "2": "lancer",
        "3": "marksman",
        "4": "sapper",
      };
      const summon = summonKeys[event.key];
      if (summon) onSummon(summon);
      if (event.key.toLowerCase() === "q") onSkill("RALLY");
      if (event.key.toLowerCase() === "e") onSkill("MEND");
      if (event.key.toLowerCase() === "r") onSkill("ULTIMATE");
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onAttack, onMove, onSkill, onSummon]);

  const remaining = battle.timeLimit - battle.elapsed;
  const unitKeys = Object.keys(ATTACK_UNITS) as AttackUnitKey[];
  return (
    <div className="af-battle-view">
      <header className="af-battle-hud">
        <div className="af-hud-opponent">
          <Castle />
          <span>{battle.candidate.callsign}</span>
          <strong>구역 {Math.min(5, battle.currentZone + 1)} / 5</strong>
        </div>
        <div className={`af-hud-timer ${remaining <= 25 ? "is-danger" : ""}`}>
          <span>남은 시간</span>
          <strong>{timeLabel(remaining)}</strong>
        </div>
        <button className="af-retreat-button" type="button" onClick={onRetreat}>
          <LogOut /> 철수
        </button>
      </header>

      <section className="af-battlefield" aria-label="왼쪽에서 오른쪽으로 진행하는 공성 전장">
        <div className="af-zone-strip" aria-hidden="true">
          {["외곽", "전초", "생산", "중앙", "중추"].map((zone, index) => (
            <span className={battle.currentZone >= index ? "is-reached" : ""} key={zone}>
              {zone}
            </span>
          ))}
        </div>
        <div className="af-battle-sky" aria-hidden="true">
          <i />
          <b />
        </div>
        <div className="af-ground" aria-hidden="true" />
        <div className="af-loot-float">
          <span>확보 전리품</span>
          <strong>{battle.securedLoot}</strong>
        </div>

        {battle.structures.map((structure) => (
          <div
            className={`af-structure af-structure--${structure.id} is-${structure.status.toLowerCase()}`}
            key={structure.id}
            style={{ left: `${structure.x}%` }}
            aria-label={`${structure.name}, 체력 ${Math.ceil(structure.hp)} / ${structure.maxHp}`}
          >
            <div className="af-world-health">
              <i style={{ width: `${(structure.hp / structure.maxHp) * 100}%` }} />
            </div>
            <StructureGlyph id={structure.id} />
            <span>{structure.name}</span>
          </div>
        ))}

        {[battle.hero, ...battle.attackers, ...battle.defenders].map((unit) => (
          <div
            className={`af-combatant af-combatant--${unit.side.toLowerCase()} af-combatant--${unit.kind.toLowerCase()} is-${unit.status.toLowerCase()}`}
            key={unit.id}
            style={{ left: `${unit.x}%` }}
            aria-label={`${unit.name}, 체력 ${Math.ceil(unit.hp)} / ${unit.maxHp}`}
          >
            <div className="af-world-health">
              <i style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }} />
            </div>
            <WarriorSprite unit={unit} />
            {unit.kind !== "UNIT" && <b>{unit.name}</b>}
          </div>
        ))}

        {battle.channelProgress > 0 && (
          <div className="af-channel-progress" role="status">
            <span>중추 점령 유지</span>
            <div>
              <i style={{ width: `${(battle.channelProgress / 5) * 100}%` }} />
            </div>
            <strong>{battle.channelProgress.toFixed(1)} / 5.0초</strong>
          </div>
        )}
      </section>

      <p className="af-battle-message" aria-live="polite">
        {battle.message}
      </p>

      <section className="af-command-console">
        <div className="af-hero-console">
          <div className="af-hero-vitals">
            <span>길잡이 류안</span>
            <strong>
              {Math.ceil(battle.hero.hp)} / {battle.hero.maxHp}
            </strong>
            <div>
              <i style={{ width: `${(battle.hero.hp / battle.hero.maxHp) * 100}%` }} />
            </div>
          </div>
          <div className="af-movement-pad">
            <button type="button" onClick={() => onMove(-1)} aria-label="영웅 후퇴">
              <ArrowLeft /> 후퇴
            </button>
            <button
              type="button"
              className="af-attack-button"
              onClick={onAttack}
              aria-label="영웅 기본 공격"
            >
              <Target /> 공격 <kbd>A</kbd>
            </button>
            <button type="button" onClick={() => onMove(1)} aria-label="영웅 전진">
              전진 <ArrowRight />
            </button>
          </div>
          <div className="af-skill-row">
            <button
              type="button"
              onClick={() => onSkill("RALLY")}
              disabled={battle.command < 18 || battle.rallyTime > 0}
            >
              <Zap /> 진군 신호 <small>18 · Q</small>
            </button>
            <button
              type="button"
              onClick={() => onSkill("MEND")}
              disabled={battle.command < 22 || battle.hero.hp >= battle.hero.maxHp * 0.95}
            >
              <HeartPulse /> 응급 맥동 <small>22 · E</small>
            </button>
            <button
              type="button"
              className="af-ultimate"
              onClick={() => onSkill("ULTIMATE")}
              disabled={battle.ultimateUsed}
            >
              <Sparkles /> 새벽 균열 <small>1회 · R</small>
            </button>
            <button
              type="button"
              className={battle.focusMode ? "is-active" : ""}
              onClick={() => onSkill("FOCUS")}
            >
              <Crosshair /> 시설 집중
            </button>
          </div>
        </div>

        <div className="af-summon-console">
          <header>
            <div>
              <span>지휘 자원</span>
              <strong>
                {Math.floor(battle.command)} / {battle.maxCommand}
              </strong>
            </div>
            <div>
              <span>부대 점유</span>
              <strong>
                {battle.populationUsed} / {battle.populationCap}
              </strong>
            </div>
          </header>
          <div className="af-command-meter">
            <i style={{ width: `${battle.command}%` }} />
          </div>
          <div className="af-summon-grid">
            {unitKeys.map((key, index) => {
              const unit = ATTACK_UNITS[key];
              const Icon = attackIcons[key];
              const cooldown = battle.unitCooldowns[key];
              const disabled =
                battle.command < unit.commandCost ||
                cooldown > 0 ||
                battle.populationUsed + unit.population > battle.populationCap;
              return (
                <button type="button" key={key} disabled={disabled} onClick={() => onSummon(key)}>
                  <Icon />
                  <span>{unit.name}</span>
                  <strong>
                    {cooldown > 0 ? `${cooldown.toFixed(1)}초` : `${unit.commandCost} 지휘`}
                  </strong>
                  <small>
                    점유 {unit.population} · {index + 1}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
