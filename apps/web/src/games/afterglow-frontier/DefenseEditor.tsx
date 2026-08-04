import {
  ArrowDown,
  ArrowUp,
  Castle,
  Crosshair,
  Database,
  HeartPulse,
  Minus,
  Plus,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@campflow/ui";
import { useEffect, useState } from "react";
import {
  DEFENSE_FACILITIES,
  DEFENSE_UNITS,
  defenseBudget,
  defenseCost,
  facilityUpgradeCost,
  wallIntegrity,
  wallUpgradeCost,
} from "./game-data";
import type { DefenseConfig, DefenseFacilityKey, DefenseUnitKey } from "./types";

const defenseIcons = {
  warden: Shield,
  slinger: Crosshair,
  golem: Sparkles,
  mender: HeartPulse,
} as const;

const facilityIcons = {
  gate: Castle,
  watchtower: Crosshair,
  foundry: Database,
  core: ShieldCheck,
} as const;

export function DefenseEditor({
  config,
  wallLevel,
  totalSupply,
  onUpgradeWall,
  onSave,
}: {
  config: DefenseConfig;
  wallLevel: number;
  totalSupply: number;
  onUpgradeWall: () => void;
  onSave: (config: DefenseConfig) => void;
}) {
  const [draft, setDraft] = useState<DefenseConfig>(config);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(config), [config]);
  const cost = defenseCost(draft);
  const budget = defenseBudget(wallLevel);
  const remaining = budget - cost;
  const nextWallCost = wallUpgradeCost(wallLevel);
  const unitKeys = Object.keys(DEFENSE_UNITS) as DefenseUnitKey[];

  const changeCount = (key: DefenseUnitKey, delta: number) => {
    setSaved(false);
    setDraft((current) => ({
      ...current,
      unitCounts: {
        ...current.unitCounts,
        [key]: Math.max(0, Math.min(4, current.unitCounts[key] + delta)),
      },
    }));
  };

  const changeFacilityLevel = (key: DefenseFacilityKey, delta: number) => {
    const maximumLevel = Math.min(5, wallLevel + 1);
    setSaved(false);
    setDraft((current) => ({
      ...current,
      facilityLevels: {
        ...current.facilityLevels,
        [key]: Math.max(1, Math.min(maximumLevel, current.facilityLevels[key] + delta)),
      },
    }));
  };

  const moveWave = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.waveOrder.length) return;
    const waveOrder = [...draft.waveOrder];
    const selected = waveOrder[index];
    const swapped = waveOrder[target];
    if (!selected || !swapped) return;
    waveOrder[index] = swapped;
    waveOrder[target] = selected;
    setSaved(false);
    setDraft((current) => ({ ...current, waveOrder }));
  };

  return (
    <div className="af-view af-defense-view">
      <section className="af-defense-header">
        <div>
          <span>방어 설계실</span>
          <h2>강한 요소를 고르는 만큼 다른 곳을 포기합니다</h2>
          <p>시설·웨이브·수호자 교리를 하나의 100 코스트 예산으로 구성하세요.</p>
        </div>
        <div className={`af-budget-orb ${remaining < 0 ? "is-over" : ""}`}>
          <span>남은 코스트</span>
          <strong>{remaining}</strong>
          <small>
            {cost} / {budget} 사용
          </small>
        </div>
      </section>

      <section className="af-wall-command">
        <div className="af-wall-command__icon">
          <Castle aria-hidden="true" />
          <span>Lv.{wallLevel}</span>
        </div>
        <div>
          <span>성벽 공방 강화</span>
          <strong>내구도 {wallIntegrity(wallLevel)}% · 방어 코스트 {budget}</strong>
          <small>
            다음 강화 시 내구도 +15%, 방어 코스트 +18, 시설 강화 상한이 증가합니다.
          </small>
        </div>
        <Button
          variant="secondary"
          disabled={totalSupply < nextWallCost || wallLevel >= 5}
          onClick={onUpgradeWall}
        >
          <Shield /> {wallLevel >= 5 ? "최대 강화" : `${nextWallCost.toLocaleString("ko-KR")} 보급 강화`}
        </Button>
      </section>

      <section className="af-section-block">
        <header className="af-section-heading">
          <div>
            <span>방어 덱</span>
            <h2>웨이브별 출현 병력</h2>
          </div>
          <small>각 병력은 0~4기 편성 가능</small>
        </header>
        <div className="af-defense-unit-grid">
          {unitKeys.map((key) => {
            const unit = DEFENSE_UNITS[key];
            const Icon = defenseIcons[key];
            return (
              <article key={key}>
                <Icon aria-hidden="true" />
                <div>
                  <span>{unit.role}</span>
                  <strong>{unit.name}</strong>
                  <small>{unit.description}</small>
                  <b>{unit.defenseCost} 코스트 / 기</b>
                </div>
                <div className="af-stepper" aria-label={`${unit.name} 편성 수`}>
                  <button
                    type="button"
                    aria-label={`${unit.name} 한 기 제외`}
                    onClick={() => changeCount(key, -1)}
                    disabled={draft.unitCounts[key] <= 0}
                  >
                    <Minus />
                  </button>
                  <strong>{draft.unitCounts[key]}</strong>
                  <button
                    type="button"
                    aria-label={`${unit.name} 한 기 추가`}
                    onClick={() => changeCount(key, 1)}
                    disabled={draft.unitCounts[key] >= 4}
                  >
                    <Plus />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="af-section-block">
        <header className="af-section-heading">
          <div>
            <span>방어 시설 배분</span>
            <h2>시설 강화도 방어 코스트를 사용합니다</h2>
          </div>
          <small>시설 최대 레벨 {Math.min(5, wallLevel + 1)} · 성벽 공방 강화로 상한 증가</small>
        </header>
        <div className="af-facility-upgrade-grid">
          {(Object.keys(DEFENSE_FACILITIES) as DefenseFacilityKey[]).map((key) => {
            const facility = DEFENSE_FACILITIES[key];
            const Icon = facilityIcons[key];
            const level = draft.facilityLevels[key];
            const maximumLevel = Math.min(5, wallLevel + 1);
            return (
              <article key={key}>
                <Icon aria-hidden="true" />
                <div>
                  <span>{facility.role}</span>
                  <strong>{facility.name} · Lv.{level}</strong>
                  <small>
                    체력 +{(level - 1) * 15}% · 강화 코스트 {facilityUpgradeCost(key)} / 단계
                  </small>
                </div>
                <div className="af-stepper" aria-label={`${facility.name} 강화 단계`}>
                  <button
                    type="button"
                    aria-label={`${facility.name} 강화 단계 감소`}
                    onClick={() => changeFacilityLevel(key, -1)}
                    disabled={level <= 1}
                  >
                    <Minus />
                  </button>
                  <strong>{level}</strong>
                  <button
                    type="button"
                    aria-label={`${facility.name} 강화 단계 증가`}
                    onClick={() => changeFacilityLevel(key, 1)}
                    disabled={level >= maximumLevel}
                  >
                    <Plus />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="af-defense-columns">
        <section className="af-section-block">
          <header className="af-section-heading">
            <div>
              <span>기본 웨이브</span>
              <h2>출현 우선순위</h2>
            </div>
          </header>
          <ol className="af-wave-order">
            {draft.waveOrder.map((key, index) => (
              <li key={key}>
                <i>{index + 1}</i>
                <div>
                  <strong>{DEFENSE_UNITS[key].name}</strong>
                  <small>{draft.unitCounts[key]}기 편성</small>
                </div>
                <button
                  type="button"
                  aria-label={`${DEFENSE_UNITS[key].name} 순서를 위로`}
                  onClick={() => moveWave(index, -1)}
                  disabled={index === 0}
                >
                  <ArrowUp />
                </button>
                <button
                  type="button"
                  aria-label={`${DEFENSE_UNITS[key].name} 순서를 아래로`}
                  onClick={() => moveWave(index, 1)}
                  disabled={index === draft.waveOrder.length - 1}
                >
                  <ArrowDown />
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="af-section-block af-doctrine-panel">
          <header className="af-section-heading">
            <div>
              <span>숨은 변수</span>
              <h2>함정·수호자·자동 스킬</h2>
            </div>
          </header>
          <fieldset>
            <legend>함정 구간</legend>
            <div className="af-choice-row">
              {([1, 2, 3] as const).map((zone) => (
                <button
                  type="button"
                  className={draft.trapZone === zone ? "is-active" : ""}
                  aria-pressed={draft.trapZone === zone}
                  key={zone}
                  onClick={() => setDraft((current) => ({ ...current, trapZone: zone }))}
                >
                  {zone}구역
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            <span>최종 수호자 교리</span>
            <select
              value={draft.guardianDoctrine}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  guardianDoctrine: event.target.value as DefenseConfig["guardianDoctrine"],
                }))
              }
            >
              <option value="KNOCKBACK">전선 밀쳐내기 · 10</option>
              <option value="SIEGE_HUNTER">공성병 우선 추적 · 10</option>
              <option value="CORE_SHIELD">중추 보호막 · 14</option>
            </select>
          </label>
          <label>
            <span>방어 스킬 우선순위</span>
            <select
              value={draft.skillPriority}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  skillPriority: event.target.value as DefenseConfig["skillPriority"],
                }))
              }
            >
              <option value="HEAL">병력 회복 · 10</option>
              <option value="SLOW">침략자 둔화 · 8</option>
              <option value="BARRAGE">후열 포격 · 8</option>
            </select>
          </label>
        </section>
      </div>

      <div className="af-sticky-save">
        <div>
          <strong>{remaining < 0 ? `${Math.abs(remaining)} 코스트 초과` : "배치 검증 완료"}</strong>
          <small>
            {remaining < 0
              ? "병력 수나 고비용 교리를 줄여 주세요."
              : "저장 이후 시작되는 침략부터 새 스냅샷이 적용됩니다."}
          </small>
        </div>
        <Button
          disabled={remaining < 0}
          onClick={() => {
            const next = { ...draft, updatedAt: new Date().toISOString() };
            onSave(next);
            setSaved(true);
          }}
        >
          <Save size={18} /> {saved ? "저장됨" : "방어 배치 저장"}
        </Button>
      </div>
    </div>
  );
}
