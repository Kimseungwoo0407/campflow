# Phase 0·1 ERD

```text
User 1 ─── 1 UserProfile
User 1 ─── N Session
User 1 ─── N AuthToken
User 1 ─── N Group (owner)
User N ─── N Group (GroupMember)
Group 1 ─── N Invite
User 1 ─── N AuditLog (optional actor)
```

핵심 제약:

- 모든 식별자는 애플리케이션이 만드는 ULID입니다.
- 이메일은 저장 전 소문자로 정규화하고 DB에 원문 unique와 `LOWER(email)` unique index를 둡니다.
- 로그인용 `username`은 선택값이지만 값이 있으면 unique이며 NFKC 정규화 후 소문자로 저장합니다.
- `GroupMember(groupId, userId)`는 복합 PK입니다.
- 초대 token/code는 HMAC hash만 저장하고 둘 다 unique입니다.
- 인증 token은 목적, 만료, `usedAt`을 가지며 이전 미사용 token을 새 발급 시 소진 처리합니다.
- 그룹 삭제는 `deletedAt` soft delete이며 활성 초대를 동시에 revoke합니다.
- 시각은 PostgreSQL `TIMESTAMPTZ` UTC로 저장하고 UI에서 `Asia/Seoul`로 표시합니다.

전체 제품 엔티티는 명세서 9장을 따르며 각 기능 Phase에서 migration과 함께 추가합니다.
