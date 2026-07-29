# CampFlow

친구들이 각자 로그인해 글램핑 여행을 함께 준비하는 협업형 여행 플래너입니다. 이 저장소는 제품 명세 v1.0의 Phase 0(기반)과 Phase 1(인증·프로필·그룹·초대·RBAC)을 실행 가능한 상태로 구현합니다.

## 현재 구현 범위

- React 19, Vite, HashRouter, TanStack Query, Zustand, PWA app shell
- NestJS REST API, Swagger, request ID, 표준 응답/오류 envelope
- Argon2id 비밀번호, access JWT, HttpOnly refresh cookie 회전과 재사용 탐지
- CSRF 이중 제출, CORS allowlist, Helmet, rate limit, 세션/기기 로그아웃
- 이메일 확인과 단일 사용 비밀번호 재설정 토큰, 선택 SMTP/개발 preview
- 프로필, 그룹 생성/조회/수정/소프트 삭제, 멤버 권한, 해시 초대 링크/8자리 코드
- PostgreSQL/Prisma migration과 idempotent 개발 seed
- Docker Compose 개발/운영 구성, Redis/MinIO graceful 기반, Cloudflare Tunnel profile
- lint, strict typecheck, 단위/컴포넌트/E2E, CI, Pages/API image workflow

Phase 2 이후 여행·날짜·장소·투표·일정·협업·준비·비용 기능은 명세 순서대로 추가합니다. 아직 구현하지 않은 모듈은 가짜 동작 대신 UI에서 명확히 비활성 상태로 표시합니다.

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

개발 seed:

| 계정 | 역할 | 개발 전용 임시 비밀번호 |
| --- | --- | --- |
| `owner@campflow.local` | 그룹 소유자 | `CampFlow2026!` |
| `friend1@campflow.local` | 멤버 | `CampFlow2026!` |
| `friend2@campflow.local` | 멤버 | `CampFlow2026!` |

고정 데모 초대 코드는 `DEMO2026`입니다. Seed는 `NODE_ENV=production`에서 실행을 거부합니다.

## 품질 검증

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

`test:e2e` 전에는 개발 PostgreSQL을 실행하고 migration을 적용해야 합니다. E2E는 별도 계정 가입 → 그룹 생성 → 초대 생성/수락 → 비멤버 IDOR 차단까지 실제 API와 DB로 검증합니다.

## 저장소 구조

```text
apps/
  api/            NestJS, Prisma, Swagger, 인증/그룹 API
  web/            React/Vite/PWA GitHub Pages 앱
packages/
  contracts/      Zod 입력 스키마와 API 타입
  domain/         프레임워크 없는 ID/RBAC 도메인 정책
  ui/             접근 가능한 공통 UI 기본 컴포넌트
infra/
  docker-compose.dev.yml
  docker-compose.yml
  scripts/
docs/
  decisions/      ADR
```

## 주요 명령

| 명령 | 설명 |
| --- | --- |
| `pnpm dev` | web/API 동시 개발 실행 |
| `pnpm db:generate` | Prisma Client 생성 |
| `pnpm db:deploy` | 기록된 migration 적용 |
| `pnpm db:migrate` | 개발 migration 생성/적용 |
| `pnpm db:seed` | 개발 데모 계정과 그룹 upsert |
| `pnpm lint` | ESLint 경고 0 검증 |
| `pnpm typecheck` | 전체 strict TypeScript 검사 |
| `pnpm test` | 단위/컴포넌트 테스트 |
| `pnpm test:e2e` | PostgreSQL 기반 API E2E |
| `pnpm build` | API와 Pages 정적 번들 생성 |

## 운영 배포 요약

1. GitHub Pages repository variables에 `VITE_API_BASE_URL`, `VITE_GITHUB_PAGES_BASE`를 등록합니다.
2. `main` push 시 CI 성공 후 Pages workflow가 `apps/web/dist`를 배포합니다.
3. 홈 서버에 `.env`를 만들고 `docker compose -f infra/docker-compose.yml build`를 실행합니다.
4. 먼저 `docker compose -f infra/docker-compose.yml run --rm api pnpm --filter @campflow/api prisma:deploy`를 실행합니다.
5. `docker compose -f infra/docker-compose.yml --profile tunnel up -d`로 API와 Tunnel을 올립니다.
6. Cloudflare 공개 호스트는 `api.example.com`에서 Docker의 `http://api:4000`으로 연결합니다.

운영 DB·Redis·MinIO 포트는 외부에 publish하지 않습니다. API의 호스트 포트도 `127.0.0.1`에만 바인딩됩니다. 자세한 내용은 [배포 문서](docs/deployment.md), [운영 문서](OPERATIONS.md), [백업 문서](BACKUP.md)를 참고하세요.

## 문서

- [확정 여행 브리프](docs/trip-brief.md)
- [아키텍처](docs/architecture.md)
- [API 사용법](docs/api.md)
- [ERD](docs/erd.md)
- [보안 정책](SECURITY.md)
- [Provider 정책](PROVIDERS.md)
- [Phase 체크리스트](docs/phase-checklist.md)

## 알려진 제한

- Redis, MinIO, Socket.IO의 실제 기능 모듈은 후속 Phase에서 연결합니다. Phase 1 핵심 CRUD는 PostgreSQL만으로 동작합니다.
- PWA는 app shell을 오프라인으로 열 수 있지만 사용자 데이터 snapshot/outbox 동기화는 Phase 8 범위입니다.
- 개발 SMTP 미설정 시 토큰을 로그에 남기지 않고 API 응답의 `development*Token` 필드로만 보여 줍니다. 운영 응답에는 노출하지 않습니다.
- Git 저장소 루트가 이 폴더의 상위에 있다면 Turborepo가 Git 상태 경고를 표시할 수 있으나 빌드 결과에는 영향이 없습니다.
