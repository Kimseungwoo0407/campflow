import {
  ArrowUpRight,
  Castle,
  Coins,
  Database,
  Gem,
  LockKeyhole,
  ShieldAlert,
  Sparkles,
  Warehouse,
} from "lucide-react";
import { Button } from "@campflow/ui";
import { generatorCapacity, generatorRate, vaultCapacity } from "./game-data";
import type { TerritoryState } from "./types";

function number(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.floor(value));
}

export function TerritoryView({
  state,
  unclaimed,
  onCollect,
  onUpgradeGenerator,
  onUpgradeVault,
  onGoDefense,
  onGoInvasion,
  notice,
}: {
  state: TerritoryState;
  unclaimed: number;
  onCollect: () => void;
  onUpgradeGenerator: () => void;
  onUpgradeVault: () => void;
  onGoDefense: () => void;
  onGoInvasion: () => void;
  notice: string;
}) {
  const generatorUpgradeCost = state.generatorLevel * 620;
  const vaultUpgradeCost = state.vaultLevel * 760;
  const totalSupply = state.protectedSupply + state.exposedSupply;
  const protectedPercent = totalSupply > 0 ? (state.protectedSupply / totalSupply) * 100 : 100;
  const productionCapacity = generatorCapacity(state.generatorLevel);
  return (
    <div className="af-view af-territory-view">
      <section className="af-territory-map" aria-labelledby="af-territory-title">
        <div className="af-sky-copy">
          <span>나의 원정 영지</span>
          <h2 id="af-territory-title">이음분지 제7성채</h2>
          <p>잔광을 모아 방어선을 세우고, 노출된 보급품을 지키세요.</p>
        </div>
        <div className="af-landscape" aria-hidden="true">
          <i className="af-moon" />
          <i className="af-ridge af-ridge--back" />
          <i className="af-ridge af-ridge--front" />
          <div className="af-map-building af-map-building--generator">
            <Database />
            <b>맥동 채집기</b>
            <small>Lv.{state.generatorLevel}</small>
          </div>
          <div className="af-map-building af-map-building--vault">
            <LockKeyhole />
            <b>밀폐 금고</b>
            <small>Lv.{state.vaultLevel}</small>
          </div>
          <div className="af-map-building af-map-building--keep">
            <Castle />
            <b>잔광 중추</b>
            <small>방어 정상</small>
          </div>
        </div>
        <div className="af-collection-dock">
          <div>
            <span>미수령 생산량</span>
            <strong>{number(unclaimed)} 보급</strong>
            <small>
              시간당 {number(generatorRate(state.generatorLevel))} · 저장 한도{" "}
              {number(productionCapacity)}
            </small>
          </div>
          <Button onClick={onCollect} disabled={unclaimed <= 0}>
            <Sparkles size={18} /> 생산 자원 수령
          </Button>
        </div>
      </section>

      <p className="af-live-notice" role="status" aria-live="polite">
        {notice}
      </p>

      <section className="af-resource-grid" aria-label="자원 보관 현황">
        <article className="af-resource-card af-resource-card--safe">
          <LockKeyhole aria-hidden="true" />
          <span>보호 금고</span>
          <strong>{number(state.protectedSupply)}</strong>
          <small>약탈 불가 · 보호 비중 {protectedPercent.toFixed(0)}%</small>
          <div className="af-meter" aria-label={`금고 용량 ${protectedPercent.toFixed(0)}%`}>
            <i
              style={{
                width: `${Math.min(100, (state.protectedSupply / vaultCapacity(state.vaultLevel)) * 100)}%`,
              }}
            />
          </div>
        </article>
        <article className="af-resource-card af-resource-card--exposed">
          <ShieldAlert aria-hidden="true" />
          <span>노출 창고</span>
          <strong>{number(state.exposedSupply)}</strong>
          <small>1회 최대 18%만 약탈 가능</small>
        </article>
        <article className="af-resource-card">
          <Coins aria-hidden="true" />
          <span>전술 인장</span>
          <strong>{number(state.battlePoints)}</strong>
          <small>정찰·침략 준비·영웅 성장</small>
        </article>
        <article className="af-resource-card">
          <Gem aria-hidden="true" />
          <span>성운 결정</span>
          <strong>{number(state.rareMaterials)}</strong>
          <small>완전 승리와 시즌 보상</small>
        </article>
      </section>

      <section className="af-section-block">
        <header className="af-section-heading">
          <div>
            <span>성장 선택</span>
            <h2>지금 가장 필요한 곳에 투자</h2>
          </div>
          <small>노출 창고 자원부터 먼저 사용됩니다.</small>
        </header>
        <div className="af-upgrade-grid">
          <article className="af-upgrade-card">
            <Database />
            <div>
              <span>맥동 채집기 · Lv.{state.generatorLevel}</span>
              <strong>생산 +24/시간</strong>
              <small>다음 강화 비용 {number(generatorUpgradeCost)} 보급</small>
            </div>
            <Button
              variant="secondary"
              onClick={onUpgradeGenerator}
              disabled={totalSupply < generatorUpgradeCost}
            >
              강화 <ArrowUpRight size={17} />
            </Button>
          </article>
          <article className="af-upgrade-card">
            <Warehouse />
            <div>
              <span>밀폐 금고 · Lv.{state.vaultLevel}</span>
              <strong>보호 용량 +900</strong>
              <small>다음 강화 비용 {number(vaultUpgradeCost)} 보급</small>
            </div>
            <Button
              variant="secondary"
              onClick={onUpgradeVault}
              disabled={totalSupply < vaultUpgradeCost}
            >
              강화 <ArrowUpRight size={17} />
            </Button>
          </article>
        </div>
      </section>

      <section className="af-command-grid">
        <button type="button" onClick={onGoDefense}>
          <Warehouse aria-hidden="true" />
          <span>방어 설계</span>
          <strong>100 코스트 안에서 웨이브 재구성</strong>
          <ArrowUpRight aria-hidden="true" />
        </button>
        <button type="button" onClick={onGoInvasion}>
          <Coins aria-hidden="true" />
          <span>침략 원정</span>
          <strong>행동력 {state.invasionEnergy}/5 · 부분 약탈 보장</strong>
          <ArrowUpRight aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
