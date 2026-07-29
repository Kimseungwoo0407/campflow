# Security Policy

## 지원 범위

현재 `0.1.x` Phase 0·1 코드만 보안 수정을 받습니다. 공개 issue에 취약점, token, 계정 정보 또는 운영 URL을 올리지 마세요.

## 신고

저장소 소유자에게 비공개 채널로 영향, 재현 단계, 영향 endpoint, 가능한 완화책을 전달합니다. 운영자는 신고 접수 후 노출된 Tunnel/JWT/SMTP/Provider key를 먼저 회전하고 관련 session을 revoke합니다.

## 운영 필수 사항

- `.env`, DB dump, MinIO data를 Git에 커밋하지 않습니다.
- 모든 운영 비밀값은 서로 다른 32바이트 이상 난수로 생성합니다.
- `COOKIE_SECURE=true`, 정확한 `APP_ORIGIN`, HTTPS를 사용합니다.
- PostgreSQL/Redis/MinIO와 라우터 포트를 인터넷에 publish하지 않습니다.
- backup은 암호화된 별도 장치에 복제하고 월 1회 복구 검증합니다.
- audit/log에 password, cookie, access/refresh/email/reset/invite token 원문을 남기지 않습니다.

## 구현된 방어

Argon2id, session rotation/reuse detection, CSRF, CORS allowlist, rate limit, Helmet, input schema validation, membership-scoped object access, soft delete/audit, hashed token storage가 적용되어 있습니다.

## 후속 보안 게이트

파일 업로드, Markdown, WebSocket, OAuth, 관리자 기능은 각각 전용 위협 모델과 테스트 없이는 Feature Flag를 켜지 않습니다.
