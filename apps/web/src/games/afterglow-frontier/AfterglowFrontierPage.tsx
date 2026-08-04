import { Castle, Coins, History, Map, Shield, Sparkles, Swords, Ticket, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { WorkspaceShell } from "../../pages/trip-workspace-pages";
import { useAuthStore } from "../../stores/auth";
import { BattleView } from "./BattleView";
import { DefenseEditor } from "./DefenseEditor";
import { FriendlyBattleView } from "./FriendlyBattleView";
import { InvasionView } from "./InvasionView";
import { RecruitView } from "./RecruitView";
import { RecordsView } from "./RecordsView";
import { ResultView } from "./ResultView";
import { TerritoryView } from "./TerritoryView";
import { HEROES, MATCH_CANDIDATES, wallUpgradeCost } from "./game-data";
import { createFriendlyCandidate } from "./friendly-battle";
import { recruitHeroes } from "./recruitment";
import { calculateBattleRewards } from "./settlement";
import {
  BATTLE_TICK_MS,
  battleRecordFromState,
  createBattle,
  heroAttack,
  moveHero,
  retreatBattle,
  summonUnit,
  tickBattle,
  useHeroSkill,
} from "./engine";
import {
  collectProduction,
  loadTerritory,
  saveTerritory,
  spendSupply,
  unclaimedProduction,
} from "./storage";
import type {
  AttackUnitKey,
  BattleRecord,
  BattleResultSummary,
  BattleState,
  DefenseConfig,
  GameView,
  HeroKey,
  MatchCandidate,
  RecruitResult,
  TripFriend,
} from "./types";
import "./afterglow-frontier.css";

const tabs = [
  { id: "territory", label: "영지", icon: Map },
  { id: "defense", label: "방어 편집", icon: Shield },
  { id: "recruit", label: "지휘관 소환", icon: Sparkles },
  { id: "invasion", label: "침략", icon: Swords },
  { id: "friendly", label: "친구전", icon: Users },
  { id: "records", label: "전투 기록", icon: History },
] as const;

interface FriendTripResponse {
  members: Array<{ user: TripFriend }>;
}

function resource(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.floor(value));
}

export function AfterglowFrontierPage() {
  const { tripId = "" } = useParams();
  const userId = useAuthStore((state) => state.user?.id ?? "local-commander");
  const [territory, setTerritory] = useState(() => loadTerritory(tripId, userId));
  const [view, setView] = useState<GameView>("territory");
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [candidates, setCandidates] = useState<MatchCandidate[]>(() =>
    MATCH_CANDIDATES.map((candidate) => ({
      ...candidate,
      visibleUnits: [...candidate.visibleUnits],
    })),
  );
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [result, setResult] = useState<BattleResultSummary | null>(null);
  const [replay, setReplay] = useState<BattleRecord | null>(null);
  const [recruitResults, setRecruitResults] = useState<RecruitResult[]>([]);
  const [friends, setFriends] = useState<TripFriend[]>([]);
  const [friendStatus, setFriendStatus] = useState<"LOADING" | "READY" | "ERROR">("LOADING");
  const [friendReload, setFriendReload] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState("서버 기준 생산 시각을 동기화했습니다.");
  const settledBattleId = useRef<string | null>(null);
  const candidate = candidates[candidateIndex] ?? candidates[0];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => saveTerritory(tripId, userId, territory), [territory, tripId, userId]);

  useEffect(() => {
    let active = true;
    setFriendStatus("LOADING");
    apiRequest<FriendTripResponse>(`trips/${tripId}`)
      .then((trip) => {
        if (!active) return;
        setFriends(
          trip.members
            .map((member) => member.user)
            .filter((member) => member.id !== userId),
        );
        setFriendStatus("READY");
      })
      .catch(() => {
        if (active) setFriendStatus("ERROR");
      });
    return () => {
      active = false;
    };
  }, [friendReload, tripId, userId]);

  useEffect(() => {
    if (!battle || battle.outcome !== "IN_PROGRESS") return;
    const timer = window.setInterval(
      () => setBattle((current) => (current ? tickBattle(current) : current)),
      BATTLE_TICK_MS,
    );
    return () => window.clearInterval(timer);
  }, [battle?.id, battle?.outcome]);

  useEffect(() => {
    if (!battle || battle.outcome === "IN_PROGRESS" || settledBattleId.current === battle.id)
      return;
    settledBattleId.current = battle.id;
    const record = battleRecordFromState(battle);
    const isFriendly = record.mode === "FRIENDLY";
    const { rewardBattlePoints, rewardRareMaterials, rewardRecruitSeals, leagueDelta } =
      calculateBattleRewards(record);
    setTerritory((current) => ({
      ...current,
      exposedSupply: current.exposedSupply + (isFriendly ? 0 : record.securedLoot),
      battlePoints: current.battlePoints + rewardBattlePoints,
      rareMaterials: current.rareMaterials + rewardRareMaterials,
      recruitSeals: current.recruitSeals + rewardRecruitSeals,
      friendlyStats: isFriendly
        ? {
            played: current.friendlyStats.played + 1,
            wins:
              current.friendlyStats.wins + (record.outcome === "ATTACKER_WIN" ? 1 : 0),
            lastOpponentId: record.opponentId,
          }
        : current.friendlyStats,
      records: [record, ...current.records.filter((entry) => entry.id !== record.id)].slice(0, 20),
    }));
    setResult({
      record,
      rewardBattlePoints,
      rewardRareMaterials,
      rewardRecruitSeals,
      leagueDelta,
    });
    setView("result");
  }, [battle]);

  const unclaimed = useMemo(() => unclaimedProduction(territory, now), [now, territory]);

  const collect = () => {
    const amount = unclaimedProduction(territory);
    setTerritory((current) => collectProduction(current));
    setNotice(
      amount > 0
        ? `${resource(amount)} 보급을 수령했습니다. 75%는 금고에 우선 배치됩니다.`
        : "아직 수령할 생산량이 없습니다.",
    );
  };

  const upgrade = (kind: "generator" | "vault") => {
    const level = kind === "generator" ? territory.generatorLevel : territory.vaultLevel;
    const cost = level * (kind === "generator" ? 620 : 760);
    setTerritory((current) => {
      const spent = spendSupply(current, cost);
      if (!spent) return current;
      return kind === "generator"
        ? { ...spent, generatorLevel: spent.generatorLevel + 1 }
        : { ...spent, vaultLevel: spent.vaultLevel + 1 };
    });
    setNotice(`${kind === "generator" ? "맥동 채집기" : "밀폐 금고"} 강화를 시작했습니다.`);
  };

  const upgradeWall = () => {
    const cost = wallUpgradeCost(territory.wallLevel);
    if (territory.wallLevel >= 5) return;
    setTerritory((current) => {
      const spent = spendSupply(current, cost);
      return spent ? { ...spent, wallLevel: spent.wallLevel + 1 } : current;
    });
    setNotice(`성벽 공방을 Lv.${territory.wallLevel + 1}로 강화했습니다. 방어 코스트가 18 증가합니다.`);
  };

  const recruit = (count: 1 | 10) => {
    const recruited = recruitHeroes(territory, count);
    if (!recruited) {
      setNotice(`소환 인장이 ${count}개 필요합니다.`);
      return;
    }
    setTerritory(recruited.territory);
    setRecruitResults(recruited.results);
    const newCount = recruited.results.filter((entry) => entry.isNew).length;
    setNotice(
      newCount > 0
        ? `지휘관 ${newCount}명이 새로 합류했습니다.`
        : `중복 지휘관이 잔광 조각으로 전환되었습니다.`,
    );
  };

  const selectHero = (heroKey: HeroKey) => {
    if ((territory.heroRoster[heroKey] ?? 0) <= 0) return;
    setTerritory((current) => ({ ...current, activeHeroKey: heroKey }));
    setNotice(`${HEROES[heroKey].name}을 다음 침략의 지휘관으로 지정했습니다.`);
  };

  const saveDefense = (defense: DefenseConfig) => {
    setTerritory((current) => ({ ...current, defense }));
    setNotice("방어 스냅샷을 저장했습니다. 진행 중 전투에는 영향을 주지 않습니다.");
  };

  const nextTarget = () => {
    if (territory.battlePoints < 8) {
      setNotice("대상 변경에는 전술 인장 8개가 필요합니다.");
      return;
    }
    setTerritory((current) => ({ ...current, battlePoints: current.battlePoints - 8 }));
    setCandidateIndex((current) => (current + 1) % candidates.length);
    setNotice("매칭 범위를 다시 계산해 새 상대를 찾았습니다.");
  };

  const scout = () => {
    if (!candidate || candidate.scouted || territory.battlePoints < 25) return;
    setTerritory((current) => ({ ...current, battlePoints: current.battlePoints - 25 }));
    setCandidates((current) =>
      current.map((entry) => (entry.id === candidate.id ? { ...entry, scouted: true } : entry)),
    );
    setNotice("정찰 완료. 함정과 후반 방어 정보가 공개되었습니다.");
  };

  const startInvasion = () => {
    if (!candidate || territory.invasionEnergy < 1 || territory.battlePoints < 30) {
      setNotice("침략 행동력 1과 전술 인장 30개가 필요합니다.");
      return;
    }
    setTerritory((current) => ({
      ...current,
      invasionEnergy: current.invasionEnergy - 1,
      battlePoints: current.battlePoints - 30,
    }));
    settledBattleId.current = null;
    setResult(null);
    setBattle(createBattle(candidate, territory.activeHeroKey));
    setView("battle");
  };

  const startFriendlyBattle = (friend: TripFriend) => {
    const friendlyCandidate = createFriendlyCandidate(friend);
    settledBattleId.current = null;
    setResult(null);
    setBattle(createBattle(friendlyCandidate, territory.activeHeroKey, "FRIENDLY"));
    setView("battle");
  };

  const handleMove = useCallback((direction: -1 | 1) => {
    setBattle((current) => (current ? moveHero(current, direction) : current));
  }, []);
  const handleAttack = useCallback(() => {
    setBattle((current) => (current ? heroAttack(current) : current));
  }, []);
  const handleSummon = useCallback((key: AttackUnitKey) => {
    setBattle((current) => (current ? summonUnit(current, key) : current));
  }, []);
  const handleSkill = useCallback((skill: "RALLY" | "MEND" | "ULTIMATE" | "FOCUS") => {
    setBattle((current) => (current ? useHeroSkill(current, skill) : current));
  }, []);
  const handleRetreat = useCallback(() => {
    setBattle((current) => (current ? retreatBattle(current) : current));
  }, []);

  const goTo = (next: GameView) => {
    if (view === "battle") return;
    setReplay(null);
    setView(next);
  };

  return (
    <WorkspaceShell
      eyebrow="게임장 · 전략"
      title="잔광전선"
      description="영지를 키우고, 상대의 다섯 방어 구역을 직접 돌파하는 비동기 공성 전략 게임"
      actions={
        <div className="af-shell-resources" aria-label="잔광전선 주요 자원">
          <span>
            <Coins /> {resource(territory.battlePoints)} 인장
          </span>
          <span>
            <Swords /> {territory.invasionEnergy}/5 행동력
          </span>
          <span>
            <Ticket /> {territory.recruitSeals} 소환 인장
          </span>
        </div>
      }
    >
      <main className={`afterglow-frontier ${view === "battle" ? "is-battle" : ""}`}>
        {view !== "battle" && view !== "result" && (
          <nav className="af-game-tabs" aria-label="잔광전선 메뉴">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                className={view === id ? "is-active" : ""}
                aria-current={view === id ? "page" : undefined}
                key={id}
                onClick={() => goTo(id)}
              >
                <Icon /> {label}
              </button>
            ))}
          </nav>
        )}

        {view === "territory" && (
          <TerritoryView
            state={territory}
            unclaimed={unclaimed}
            onCollect={collect}
            onUpgradeGenerator={() => upgrade("generator")}
            onUpgradeVault={() => upgrade("vault")}
            onUpgradeWall={upgradeWall}
            onGoDefense={() => goTo("defense")}
            onGoInvasion={() => goTo("invasion")}
            notice={notice}
          />
        )}
        {view === "defense" && (
          <DefenseEditor
            config={territory.defense}
            wallLevel={territory.wallLevel}
            totalSupply={territory.protectedSupply + territory.exposedSupply}
            onUpgradeWall={upgradeWall}
            onSave={saveDefense}
          />
        )}
        {view === "recruit" && (
          <RecruitView
            territory={territory}
            results={recruitResults}
            onRecruit={recruit}
            onSelectHero={selectHero}
          />
        )}
        {view === "invasion" && candidate && (
          <InvasionView
            territory={territory}
            candidate={candidate}
            onNextTarget={nextTarget}
            onScout={scout}
            onStart={startInvasion}
            notice={notice}
          />
        )}
        {view === "friendly" && (
          <FriendlyBattleView
            territory={territory}
            friends={friends}
            status={friendStatus}
            onRetryLoad={() => setFriendReload((current) => current + 1)}
            onChallenge={startFriendlyBattle}
          />
        )}
        {view === "records" && (
          <RecordsView
            records={territory.records}
            selected={replay}
            onSelect={setReplay}
            onFindTarget={() => goTo("invasion")}
          />
        )}
        {view === "battle" && battle && (
          <BattleView
            battle={battle}
            onMove={handleMove}
            onAttack={handleAttack}
            onSummon={handleSummon}
            onSkill={handleSkill}
            onRetreat={handleRetreat}
          />
        )}
        {view === "result" && result && (
          <ResultView
            result={result}
            onRetry={() => goTo(result.record.mode === "FRIENDLY" ? "friendly" : "invasion")}
            onRecords={() => goTo("records")}
            onTerritory={() => goTo("territory")}
          />
        )}
        <footer className="af-version">
          <Castle /> <span>밸런스 mvp-2026.08.04.3 · 브라우저 수직 슬라이스</span>
        </footer>
      </main>
    </WorkspaceShell>
  );
}

export default AfterglowFrontierPage;
