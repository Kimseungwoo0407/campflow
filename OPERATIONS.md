# Operations

## 상태 확인

- `/v1/health/live`: 프로세스
- `/v1/health/ready`: PostgreSQL
- `/v1/health/dependencies`: DB/Redis/storage/provider 단계 상태
- `/v1/version`: 배포 버전

## 장애 순서

API 502는 PC 전원/인터넷 → cloudflared → API health → PostgreSQL 순서로 확인합니다. DB 오류 때 volume을 삭제하지 않습니다. 외부 Provider 장애는 provider를 끄고 수동 장소 등록을 안내합니다.

## 비밀 유출

Tunnel token, JWT access secret, refresh/invite pepper, SMTP/API key를 회전하고 모든 session을 revoke한 뒤 AuditLog를 확인합니다. refresh pepper 회전은 기존 모든 refresh/email/reset token을 무효화합니다.

## 디스크

PostgreSQL, MinIO, backup 크기를 관찰하고 80% 전에 알림을 설정합니다. backup 확인 없이 volume 또는 파일을 정리하지 않습니다.
