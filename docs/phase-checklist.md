# Phase별 체크리스트

## Phase 0 · 기반

- [x] pnpm workspace + Turborepo + lockfile
- [x] strict TypeScript, ESLint 경고 0, Prettier
- [x] React/Vite/HashRouter/PWA app shell
- [x] NestJS/Prisma/PostgreSQL API
- [x] `/v1/health/live`, `/ready`, `/dependencies`, `/version`
- [x] Swagger와 표준 request ID/envelope
- [x] Docker Compose dev/prod, Redis, MinIO, Tunnel profile
- [x] GitHub Actions CI, Pages, API image, dependency review
- [x] migration, idempotent seed, 백업/복구 스크립트
- [x] 환경 변수 시작 시 검증과 공개/비밀 변수 분리

## Phase 1 · 인증과 그룹

- [x] 회원가입, 로그인, refresh 회전, 로그아웃, 전체 로그아웃
- [x] Argon2id, refresh hash 저장, 재사용 탐지
- [x] 이메일 확인, 비밀번호 재설정 단일 사용 토큰
- [x] 세션 목록과 기기별 로그아웃
- [x] 프로필 및 선택 알레르기/운전 정보
- [x] 그룹 생성/조회/수정/소프트 삭제
- [x] 그룹 멤버 목록, 역할/상태 변경, 제거
- [x] 만료/사용 횟수/역할/승인 옵션이 있는 초대 링크와 8자리 코드
- [x] 객체 멤버십 scope와 비멤버 IDOR 차단
- [x] 보안 중요 작업 감사 로그
- [x] 한국어 모바일 UI의 loading/empty/error/offline/permission 상태

## 후속 순서

문서 계약에 따라 Phase 2 여행·날짜, Phase 3 장소 Provider, Phase 4 투표·일정 순서로 진행합니다. 각 Phase는 migration, seed, tests, docs와 재현 가능한 검증 결과를 포함해야 합니다.

Phase 2의 여행 일정은 [확정 여행 브리프](trip-brief.md)에 따라 `2026-08-29`~`2026-08-30`(1박 2일, Asia/Seoul)로 고정합니다. 날짜 선택·투표 단계는 생략하고 숙소, 일정, 준비물 기능이 확정 날짜를 참조하도록 합니다.
