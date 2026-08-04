import {
  Castle,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Swords,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@campflow/ui";
import { DEFENSE_FACILITIES, HEROES } from "./game-data";
import { createFriendlyCandidate } from "./friendly-battle";
import type { TerritoryState, TripFriend } from "./types";

export function FriendlyBattleView({
  territory,
  friends,
  status,
  onRetryLoad,
  onChallenge,
}: {
  territory: TerritoryState;
  friends: TripFriend[];
  status: "LOADING" | "READY" | "ERROR";
  onRetryLoad: () => void;
  onChallenge: (friend: TripFriend) => void;
}) {
  const activeHero = HEROES[territory.activeHeroKey];
  const winRate = territory.friendlyStats.played
    ? Math.round((territory.friendlyStats.wins / territory.friendlyStats.played) * 100)
    : 0;

  return (
    <div className="af-view af-friendly-view">
      <section className="af-friendly-hero">
        <div>
          <span>동료 모의 공성전</span>
          <h2>여행 친구의 방어선을 직접 돌파하세요</h2>
          <p>
            행동력과 인장을 쓰지 않는 연습 전투입니다. 약탈·리그·성장 보상도 없어 친구끼리
            자원을 밀어줄 수 없습니다.
          </p>
        </div>
        <div className="af-friendly-score" aria-label="친선전 전적">
          <Users />
          <span>내 친선 전적</span>
          <strong>
            {territory.friendlyStats.wins}승 / {territory.friendlyStats.played}전
          </strong>
          <small>승률 {winRate}%</small>
        </div>
      </section>

      <section className="af-friendly-rules" aria-label="친선전 규칙">
        <article>
          <Swords />
          <div>
            <strong>출전 비용 0</strong>
            <span>횟수 제한 없이 전술을 시험합니다.</span>
          </div>
        </article>
        <article>
          <ShieldCheck />
          <div>
            <strong>경제 변동 0</strong>
            <span>서로의 보급과 리그 점수는 그대로입니다.</span>
          </div>
        </article>
        <article>
          <UserRound />
          <div>
            <strong>{activeHero.name} 출전</strong>
            <span>현재 지휘관과 내 공격 덱을 그대로 사용합니다.</span>
          </div>
        </article>
      </section>

      <section className="af-friendly-roster">
        <header>
          <div>
            <span>같은 여행 멤버</span>
            <h3>대전 상대 선택</h3>
          </div>
          <small>나를 제외한 멤버만 표시됩니다.</small>
        </header>

        {status === "LOADING" ? (
          <div className="af-friendly-state" role="status">
            <LoaderCircle className="is-spinning" />
            <strong>여행 멤버를 불러오는 중</strong>
            <span>친선전 상대 목록을 준비하고 있습니다.</span>
          </div>
        ) : status === "ERROR" ? (
          <div className="af-friendly-state" role="alert">
            <RefreshCw />
            <strong>멤버 목록을 불러오지 못했습니다</strong>
            <span>홈 서버 연결을 확인한 뒤 다시 시도해 주세요.</span>
            <Button variant="secondary" onClick={onRetryLoad}>
              다시 불러오기
            </Button>
          </div>
        ) : friends.length === 0 ? (
          <div className="af-friendly-state">
            <Users />
            <strong>함께 싸울 여행 동료가 없습니다</strong>
            <span>이 여행에 멤버를 초대하면 친선전 상대에 자동으로 나타납니다.</span>
          </div>
        ) : (
          <div className="af-friendly-grid">
            {friends.map((friend) => {
              const candidate = createFriendlyCandidate(friend);
              const snapshot = candidate.defenseSnapshot;
              const facility = DEFENSE_FACILITIES[candidate.signatureFacility];
              return (
                <article key={friend.id}>
                  <div className="af-friend-avatar" aria-hidden="true">
                    {friend.nickname.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="af-friend-copy">
                    <span>{candidate.defenseGrade}급 모의 방어선</span>
                    <h4>{friend.nickname}</h4>
                    <p>
                      성벽 Lv.{snapshot?.wallLevel ?? 1} · {snapshot?.waveStyle}
                    </p>
                  </div>
                  <dl>
                    <div>
                      <dt>방어 전투력</dt>
                      <dd>{candidate.power.toLocaleString("ko-KR")}</dd>
                    </div>
                    <div>
                      <dt>대표 시설</dt>
                      <dd>{facility.name}</dd>
                    </div>
                    <div>
                      <dt>획득 보급</dt>
                      <dd>0 · 친선 규칙</dd>
                    </div>
                  </dl>
                  <Button onClick={() => onChallenge(friend)}>
                    친선전 시작 <ChevronRight size={18} />
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <p className="af-friendly-footnote">
        <Castle /> 같은 상대와 반복해도 전적과 입력 리플레이만 저장됩니다.
      </p>
    </div>
  );
}
