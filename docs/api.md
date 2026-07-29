# API

Base URL은 `/v1`, JSON field는 camelCase입니다. 성공 응답과 오류 응답은 각각 다음 형태입니다.

```json
{
  "data": { "id": "01K..." },
  "meta": {
    "requestId": "a4d...",
    "serverTime": "2026-07-28T09:00:00.000Z"
  }
}
```

```json
{
  "error": {
    "code": "GROUP_NOT_FOUND",
    "message": "그룹을 찾을 수 없습니다.",
    "requestId": "a4d..."
  }
}
```

실행 중인 API의 OpenAPI 문서는 `/docs`에서 확인합니다.

## Phase 1 endpoint

- Auth: signup, login, refresh, logout, logout-all, sessions, verify-email, forgot/reset-password
- Users: `GET/PATCH /me`, `GET /users/:id/public`
- Groups: list/create/get/update/delete, members update/delete, invite create
- Invites: preview, accept
- Health: live, ready, dependencies, version

보호 endpoint는 `Authorization: Bearer <accessToken>`이 필요합니다. Cookie를 사용하는 refresh/logout은 `campflow_csrf` cookie와 같은 값을 `X-CSRF-Token` 헤더로 전송해야 합니다.

개발 모드에서 SMTP가 없으면 email/password reset token은 서버 로그가 아니라 응답의 `developmentVerificationToken` 또는 `developmentResetToken`으로만 반환됩니다. production 응답에는 포함되지 않습니다.
