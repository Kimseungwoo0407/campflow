import {
  BadgeInfo,
  Crown,
  History,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Users,
} from "lucide-react";
import { Button } from "@campflow/ui";
import { HEROES, HERO_POOL, HERO_RARITY_LABELS } from "./game-data";
import { HeroPortrait } from "./HeroPortrait";
import type { HeroKey, RecruitResult, TerritoryState } from "./types";

function probability(value: number): string {
  if (value < 0.001) return `${value.toFixed(4)}%`;
  if (value < 1) return `${value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`;
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}

export function RecruitView({
  territory,
  results,
  onRecruit,
  onSelectHero,
}: {
  territory: TerritoryState;
  results: RecruitResult[];
  onRecruit: (count: 1 | 10) => void;
  onSelectHero: (heroKey: HeroKey) => void;
}) {
  const ownedCount = HERO_POOL.filter((hero) => (territory.heroRoster[hero.key] ?? 0) > 0).length;
  const featured = HEROES.nameless_king;

  return (
    <div className="af-view af-recruit-view">
      <section className="af-recruit-banner" aria-labelledby="af-recruit-title">
        <div className="af-recruit-banner__copy">
          <span>
            <Crown /> 특이점 기록보관소
          </span>
          <h2 id="af-recruit-title">백만 번째 잔광을 지휘관으로</h2>
          <p>
            전투로 얻는 소환 인장만 사용합니다. 모든 개별 확률과 천장 진행도는 소환 전에
            공개됩니다.
          </p>
          <div className="af-featured-rate">
            <strong>{featured.name}</strong>
            <span>개별 확률 {probability(featured.probability)}</span>
            <small>특이점 등급은 전설 천장의 대상이 아니며 기본 확률로만 등장합니다.</small>
          </div>
        </div>
        <div className="af-recruit-banner__hero">
          <HeroPortrait heroKey="nameless_king" />
          <div>
            <span>{featured.epithet}</span>
            <strong>{featured.name}</strong>
            <small>{featured.passive}</small>
          </div>
        </div>
      </section>

      <section className="af-recruit-console">
        <div className="af-recruit-currency">
          <Ticket />
          <div>
            <span>보유 소환 인장</span>
            <strong>{territory.recruitSeals}</strong>
          </div>
          <small>침략 부분 성공 이상에서 추가 획득</small>
        </div>
        <div className="af-pity-grid" aria-label="소환 천장 진행도">
          <article>
            <span>희귀 이상 보장</span>
            <strong>{Math.max(1, 10 - territory.recruit.pullsSinceRare)}회 이내</strong>
            <div className="af-meter">
              <i style={{ width: `${territory.recruit.pullsSinceRare * 10}%` }} />
            </div>
            <small>희귀 이상 획득 시 초기화</small>
          </article>
          <article>
            <span>전설 보장</span>
            <strong>{Math.max(1, 80 - territory.recruit.pullsSinceLegendary)}회 이내</strong>
            <div className="af-meter af-meter--gold">
              <i style={{ width: `${(territory.recruit.pullsSinceLegendary / 80) * 100}%` }} />
            </div>
            <small>전설 이상 획득 시 초기화</small>
          </article>
        </div>
        <div className="af-recruit-actions">
          <Button
            variant="secondary"
            disabled={territory.recruitSeals < 1}
            onClick={() => onRecruit(1)}
          >
            <Sparkles /> 1회 소환 · 인장 1
          </Button>
          <Button disabled={territory.recruitSeals < 10} onClick={() => onRecruit(10)}>
            <Star /> 10회 소환 · 인장 10
          </Button>
        </div>
      </section>

      {results.length > 0 && (
        <section className="af-recruit-results" aria-live="polite" aria-label="최근 소환 결과">
          <header className="af-section-heading">
            <div>
              <span>소환 완료</span>
              <h2>새로 기록된 지휘관</h2>
            </div>
          </header>
          <div>
            {results.map((result, index) => {
              const hero = HEROES[result.heroKey];
              return (
                <article
                  className={`af-recruit-result af-rarity--${result.rarity.toLowerCase()}`}
                  key={`${result.heroKey}-${index}`}
                >
                  <HeroPortrait heroKey={result.heroKey} />
                  <span>{HERO_RARITY_LABELS[result.rarity]}</span>
                  <strong>{hero.name}</strong>
                  <small>
                    {result.isNew ? "신규 합류" : `중복 · 잔광 조각 +${result.fragmentsGained}`}
                  </small>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="af-section-block">
        <header className="af-section-heading">
          <div>
            <span>지휘관 도감</span>
            <h2>보유 {ownedCount} / {HERO_POOL.length}</h2>
          </div>
          <small>활성 지휘관의 능력치와 지휘 효과가 다음 침략에 적용됩니다.</small>
        </header>
        <div className="af-hero-roster">
          {HERO_POOL.map((hero) => {
            const copies = territory.heroRoster[hero.key] ?? 0;
            const owned = copies > 0;
            const active = territory.activeHeroKey === hero.key;
            return (
              <article
                className={`af-hero-card af-rarity--${hero.rarity.toLowerCase()} ${
                  owned ? "is-owned" : "is-locked"
                } ${active ? "is-active" : ""}`}
                key={hero.key}
              >
                <HeroPortrait heroKey={hero.key} />
                <div className="af-hero-card__copy">
                  <span>{HERO_RARITY_LABELS[hero.rarity]} · {probability(hero.probability)}</span>
                  <strong>{hero.name}</strong>
                  <small>{hero.role}</small>
                  <p>{hero.passive}</p>
                </div>
                <div className="af-hero-card__stats">
                  <span>체력 {hero.hp}</span>
                  <span>공격 {hero.attack}</span>
                  <span>지휘 +{hero.commandBonus}</span>
                  <span>인구 +{hero.populationBonus}</span>
                </div>
                <Button
                  variant={active ? "primary" : "secondary"}
                  disabled={!owned || active}
                  onClick={() => onSelectHero(hero.key)}
                >
                  {active ? <ShieldCheck /> : <Users />}
                  {active ? "출전 중" : owned ? "출전 지정" : "미보유"}
                </Button>
                {copies > 1 && <b>중복 {copies - 1}회</b>}
              </article>
            );
          })}
        </div>
      </section>

      <details className="af-rate-disclosure">
        <summary>
          <BadgeInfo /> 전체 개별 확률과 보장 규칙
        </summary>
        <div>
          <p>
            아래 확률의 합은 정확히 100%입니다. 10회 내 희귀 이상, 80회 내 전설을
            보장합니다. 보장 소환은 각 카운터를 초기화합니다.
          </p>
          <table>
            <thead>
              <tr>
                <th>등급</th>
                <th>지휘관</th>
                <th>개별 확률</th>
                <th>중복 보상</th>
              </tr>
            </thead>
            <tbody>
              {HERO_POOL.map((hero) => (
                <tr key={hero.key}>
                  <td>{HERO_RARITY_LABELS[hero.rarity]}</td>
                  <td>{hero.name}</td>
                  <td>{probability(hero.probability)}</td>
                  <td>잔광 조각 {hero.duplicateFragments}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <small>
            현재 웹 MVP는 로컬 프로토타입입니다. 정식 서비스에서는 소환 결과·천장·재화 차감을
            서버가 원자적으로 판정하고 감사 로그를 남겨야 합니다.
          </small>
        </div>
      </details>

      <section className="af-recruit-history">
        <header>
          <History />
          <div>
            <span>최근 기록</span>
            <strong>누적 {territory.recruit.totalPulls}회 · 잔광 조각 {territory.heroFragments}</strong>
          </div>
        </header>
        {territory.recruit.history.length === 0 ? (
          <p>아직 소환 기록이 없습니다.</p>
        ) : (
          <ol>
            {territory.recruit.history.slice(0, 10).map((entry) => (
              <li key={entry.id}>
                <span>{HERO_RARITY_LABELS[entry.rarity]}</span>
                <strong>{HEROES[entry.heroKey].name}</strong>
                <time>{new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(entry.acquiredAt))}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
