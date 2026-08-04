import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MATCH_CANDIDATES } from "./game-data";
import { createBattle } from "./engine";
import { WarriorSprite } from "./WarriorSprite";
import type { AttackUnitKey, Combatant } from "./types";

function attackUnit(key: AttackUnitKey): Combatant {
  return {
    id: key,
    side: "ATTACKER",
    kind: "UNIT",
    unitKey: key,
    name: key,
    x: 10,
    hp: 100,
    maxHp: 100,
    attack: 10,
    armor: 1,
    range: 2,
    moveSpeed: 2,
    attackInterval: 1,
    attackCooldown: 0,
    population: 1,
    status: "MOVING",
  };
}

describe("WarriorSprite", () => {
  it("영웅·공격군·방어군·수호자에 고유 실루엣 클래스를 부여한다", () => {
    const candidate = MATCH_CANDIDATES[0];
    if (!candidate) throw new Error("테스트 상대가 필요합니다.");
    const battle = createBattle(candidate);
    const units = [
      battle.hero,
      attackUnit("bulwark"),
      attackUnit("lancer"),
      attackUnit("marksman"),
      attackUnit("sapper"),
      ...battle.defenders,
    ];
    const { container } = render(
      <>
        {units.map((unit) => (
          <WarriorSprite key={unit.id} unit={unit} />
        ))}
      </>,
    );
    expect(container.querySelectorAll(".af-warrior")).toHaveLength(10);
    expect(container.querySelector(".af-warrior--hero")).toBeInTheDocument();
    expect(container.querySelector(".af-warrior--sapper .af-warrior__weapon")).toBeInTheDocument();
    expect(container.querySelector(".af-warrior--golem")).toBeInTheDocument();
    expect(container.querySelector(".af-warrior--guardian")).toBeInTheDocument();
  });
});
