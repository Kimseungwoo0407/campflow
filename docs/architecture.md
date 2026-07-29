# 시스템 아키텍처

```text
브라우저
  ├─ GitHub Pages: React/Vite/PWA/HashRouter
  └─ api.example.com
        └─ Cloudflare Tunnel (outbound-only)
              └─ 홈 서버 Docker network
                    ├─ NestJS API
                    ├─ PostgreSQL (source of truth)
                    ├─ Redis (후속 realtime/cache/queue)
                    └─ MinIO (후속 파일 storage adapter)
```

## 모듈 경계

- `packages/contracts`: 네트워크 경계의 Zod schema와 직렬화 타입
- `packages/domain`: ULID와 RBAC처럼 프레임워크에 의존하지 않는 정책
- `apps/api`: controller → service → Prisma 순서. controller에 도메인 결정을 넣지 않음
- `apps/web`: API cache는 TanStack Query, access token/사용자 UI 상태는 Zustand

API는 PostgreSQL을 권위 데이터로 사용합니다. Redis 장애가 Phase 1 CRUD를 막지 않습니다. 외부 Provider DTO는 향후 adapter 내부에서 표준 도메인 결과로 변환합니다.

## 인증 요청 흐름

1. 로그인 성공 시 access JWT를 JSON으로, refresh JWT를 HttpOnly·Secure·host-only cookie로 전달합니다.
2. 웹은 access token을 메모리에만 저장합니다.
3. 새로고침 시 비 HttpOnly CSRF cookie와 `X-CSRF-Token` 헤더를 일치시켜 `/auth/refresh`를 호출합니다.
4. refresh token은 매 사용마다 회전하고 DB에는 HMAC hash만 저장합니다.
5. 이전 토큰 재사용 또는 동시 회전 충돌이 감지되면 해당 세션을 폐기합니다.
6. bearer 요청도 DB의 session revoke/expiry와 사용자 상태를 확인합니다.

## 오프라인 경계

Workbox는 정적 app shell만 precache합니다. 민감 API 응답을 Cache Storage에 장기 저장하지 않습니다. Phase 8에서 사용자별 IndexedDB snapshot과 mutation outbox를 추가하며 로그아웃 시 기기 데이터 삭제 기능을 함께 구현합니다.
