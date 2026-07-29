# CampFlow

친구들이 각자 로그인해 글램핑 여행을 함께 준비하고, 활동 포인트와 미니게임을 함께 즐기는 협업형 여행 플래너입니다.

공개 웹: <https://kimseungwoo0407.github.io/campflow/>

## 현재 구현 범위

- React 19, Vite, HashRouter, TanStack Query, Zustand, PWA app shell
- NestJS REST API, Swagger, request ID, 표준 응답/오류 envelope
- Argon2id 비밀번호, access JWT, HttpOnly refresh cookie 회전과 재사용 탐지
- CSRF 이중 제출, CORS allowlist, Helmet, rate limit, 세션/기기 로그아웃
- 이메일 확인과 단일 사용 비밀번호 재설정 토큰, 선택 SMTP/개발 preview
- 프로필, 그룹 생성/조회/수정/소프트 삭제, 멤버 권한, 해시 초대 링크/8자리 코드
- `2026-08-29`~`2026-08-30`로 잠긴 여행, 장소 후보, 투표, 일정표
- 게시글·댓글·채팅·알림, 할 일·식단·장보기·차량·파일, 비용·정산
- 활동 및 출석 포인트, 보유/누적 획득 순위표, 여행용 권한·벌칙 상점
- 네 멤버 모두 0P에서 시작하며 로그인 홈과 상시 메뉴에서 제공되는 사용 가이드
- 탭 점수, 홀짝, 달팽이 레이스, 짱깸보 배수 룰렛, 확률 공개형 로또
- 드롭다운 게임장과 종목별 독립 화면, 사다리·레이스·룰렛·추첨·승부차기 애니메이션
- 방향을 숨겨 예약하고 상대가 참가하는 1:1 승부차기 포인트 대결
- 실사진과 대화 분석을 반영한 멤버별 개인 캐릭터 프로필
- PostgreSQL/Prisma migration과 idempotent 개발 seed
- Docker Compose 개발/운영 구성, Redis/MinIO graceful 기반, Cloudflare Tunnel profile
- lint, strict typecheck, 단위/컴포넌트/E2E, CI, Pages/API image workflow

포인트는 여행 내부의 가상 점수이며 구매·현금화·환전·외부 양도가 불가능합니다. 음주 관련 권한은 참여자 동의하에서만 사용하고, 거부 또는 무알코올 대체를 항상 허용합니다.

## 10분 개발 실행

요구 사항: Node.js 24+, Docker Desktop, Git, Corepack.

PowerShell:

```powershell
corepack enable
pnpm install
powershell -ExecutionPolicy Bypass -File infra/scripts/init-dev-env.ps1
docker compose --env-file .env -f infra/docker-compose.dev.yml up -d
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
```

macOS/Linux에서는 `.env.example`을 `.env`로 복사한 뒤 다음 필수 값을 직접 생성합니다.

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `REFRESH_TOKEN_PEPPER`
- `INVITE_TOKEN_PEPPER`
- `POSTGRES_PASSWORD`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`

그다음 동일하게 Docker Compose와 `pnpm` 명령을 실행합니다. 비밀값은 32바이트 이상의 서로 다른 난수여야 하며 `.env`는 커밋하지 않습니다.

접속 주소:

- 웹: <http://localhost:5173>
- API live: <http://localhost:4000/v1/health/live>
- API ready: <http://localhost:4000/v1/health/ready>
- Swagger: <http://localhost:4000/docs>
- MinIO 콘솔: <http://localhost:9001>

기본 개발 seed:

| 계정                     | 역할        | 개발 전용 임시 비밀번호 |
| ------------------------ | ----------- | ----------------------- |
| `owner@campflow.local`   | 그룹 소유자 | `CampFlow2026!`         |
| `friend1@campflow.local` | 멤버        | `CampFlow2026!`         |
| `friend2@campflow.local` | 멤버        | `CampFlow2026!`         |

고정 데모 초대 코드는 `DEMO2026`입니다. Seed는 `NODE_ENV=production`에서 실행을 거부합니다.

로그인은 이메일 또는 `username`을 받습니다. 친구용 계정은 공개 저장소에 비밀번호를
남기지 않고 로컬 `.env`의 `SEED_FRIEND_ACCOUNTS_JSON`으로만 주입합니다. 운영 seed는
`ALLOW_PRODUCTION_SEED=true`를 함께 지정한 경우에만 허용됩니다.

```text
SEED_FRIEND_ACCOUNTS_JSON=[{"username":"이름","email":"name@campflow.local","nickname":"이름","password":"생일 4자리"}]
```

## 품질 검증

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

`test:e2e` 전에는 개발 PostgreSQL을 실행하고 migration을 적용해야 합니다. E2E는 가입·로그인·초대·고정 날짜·장소·투표·활동 포인트·순위표·미니게임·비공개 승부차기·로또 확률표·비멤버 IDOR 차단을 실제 API와 DB로 검증합니다.

## 저장소 구조

```text
apps/
  api/            NestJS, Prisma, Swagger, 여행·협업·포인트·게임 API
  web/            React/Vite/PWA GitHub Pages 앱
packages/
  contracts/      Zod 입력 스키마와 API 타입
  domain/         프레임워크 없는 ID/RBAC 도메인 정책
  ui/             접근 가능한 공통 UI 기본 컴포넌트
infra/
  docker-compose.dev.yml
  docker-compose.public-demo.yml
  docker-compose.yml
  scripts/
docs/
  decisions/      ADR
```

## 주요 명령

| 명령               | 설명                         |
| ------------------ | ---------------------------- |
| `pnpm dev`         | web/API 동시 개발 실행       |
| `pnpm db:generate` | Prisma Client 생성           |
| `pnpm db:deploy`   | 기록된 migration 적용        |
| `pnpm db:migrate`  | 개발 migration 생성/적용     |
| `pnpm db:seed`     | 개발 데모 계정과 그룹 upsert |
| `pnpm lint`        | ESLint 경고 0 검증           |
| `pnpm typecheck`   | 전체 strict TypeScript 검사  |
| `pnpm test`        | 단위/컴포넌트 테스트         |
| `pnpm test:e2e`    | PostgreSQL 기반 API E2E      |
| `pnpm build`       | API와 Pages 정적 번들 생성   |

## 운영 배포 요약

1. GitHub Pages repository variables에 `VITE_API_BASE_URL`, `VITE_GITHUB_PAGES_BASE`를 등록합니다.
2. `main` push 시 CI 성공 후 Pages workflow가 `apps/web/dist`를 배포합니다.
3. 홈 서버에 `.env`를 만들고 `docker compose -f infra/docker-compose.yml build`를 실행합니다.
4. 먼저 `docker compose -f infra/docker-compose.yml run --rm api pnpm --filter @campflow/api prisma:deploy`를 실행합니다.
5. `docker compose -f infra/docker-compose.yml --profile tunnel up -d`로 API와 Tunnel을 올립니다.
6. Cloudflare 공개 호스트는 `api.example.com`에서 Docker의 `http://api:4000`으로 연결합니다.

운영 DB·Redis·MinIO 포트는 외부에 publish하지 않습니다. API의 호스트 포트도 `127.0.0.1`에만 바인딩됩니다. 자세한 내용은 [배포 문서](docs/deployment.md), [운영 문서](OPERATIONS.md), [백업 문서](BACKUP.md)를 참고하세요.

Cloudflare Quick Tunnel을 사용하는 공개 데모는 다음처럼 실행합니다.

```powershell
docker compose --env-file .env `
  -f infra/docker-compose.dev.yml `
  -f infra/docker-compose.public-demo.yml `
  up -d --build api quick-tunnel
```

Quick Tunnel 주소는 재시작 시 바뀔 수 있고 PC와 Docker가 켜져 있을 때만 유지됩니다.
고정 운영에는 `infra/docker-compose.yml`의 named tunnel 구성을 사용합니다.

## 문서

- [확정 여행 브리프](docs/trip-brief.md)
- [아키텍처](docs/architecture.md)
- [API 사용법](docs/api.md)
- [ERD](docs/erd.md)
- [보안 정책](SECURITY.md)
- [Provider 정책](PROVIDERS.md)
- [Phase 체크리스트](docs/phase-checklist.md)

## 알려진 제한

- Quick Tunnel 기반 공개 API는 이 PC와 Docker가 켜져 있을 때만 접속할 수 있고, 컨테이너를 다시 만들면 주소가 바뀔 수 있습니다.
- PWA는 app shell을 오프라인으로 열 수 있지만 서버 데이터와 게임 결과는 온라인 연결이 필요합니다.
- 개발 SMTP 미설정 시 확인·재설정 토큰은 운영 로그가 아니라 개발 응답에서만 제공합니다.
