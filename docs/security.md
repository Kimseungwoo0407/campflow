# 보안 설계 요약

상세 신고/운영 정책은 루트 [SECURITY.md](../SECURITY.md)를 따릅니다.

- Argon2id: memory 19 MiB, iterations 2, parallelism 1
- access JWT 15분, refresh 기본 30일과 rotation/reuse detection
- refresh/email/reset/invite 원문은 DB에 저장하지 않고 HMAC hash 사용
- Cookie refresh에는 double-submit CSRF, 정확한 CORS origin 적용
- 모든 그룹 object query에 요청 사용자 `GroupMember ACTIVE` scope 적용
- 비멤버 리소스는 존재 여부를 숨기기 위해 404 반환
- 소프트 삭제와 역할/초대/로그인 보안 이벤트 AuditLog
- Helmet CSP/referrer/frame/content-type 정책
- pnpm dependency build script allowlist

향후 파일 업로드가 추가될 때 MIME/시그니처/크기/랜덤 경로/권한 검사와 EXIF 제거를 동시에 도입합니다.
