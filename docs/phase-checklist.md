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

## Phase 2 · 여행과 확정 날짜

- [x] 여행 생성·목록·대시보드·단계 진행
- [x] `2026-08-29`~`2026-08-30` 일정 고정과 날짜 편집 잠금
- [x] 그룹 멤버의 여행 멤버 자동 연결
- [x] migration, seed, API E2E

## Phase 3~7 · 장소, 투표, 일정, 협업, 준비, 비용

- [x] 직접 장소 등록, 후보 보드, 상태 관리
- [x] 이름·위치·거리·가격 직접 후보 등록과 선택적 네이버 지도 링크
- [x] 투표 생성·참여와 일정표
- [x] 게시글·댓글·채팅·알림
- [x] 할 일·식단·장보기·차량·파일
- [x] 지출 등록·정산 계산
- [x] 권한 범위와 활동 포인트 연결

## Phase 8 · 포인트, 캐릭터, 아케이드

- [x] 활동 및 출석 포인트와 중복 보상 방지
- [x] 보유 포인트·누적 획득 순위표
- [x] 여행용 권한·벌칙 상점과 대상 지정 아이템
- [x] 탭, 홀짝, 달팽이, 짱깸보 배수 룰렛
- [x] 드롭다운 게임장과 종목별 독립 화면·진행 애니메이션
- [x] 10억 분모 정수 가중치 기반 세부 확률 로또
- [x] 방향 비공개 예약형 1:1 승부차기와 결과 정산
- [x] 네 멤버의 인증된 캐릭터 프로필 제공
- [x] migration, seed, 단위·통합·E2E 검증
