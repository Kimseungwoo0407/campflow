# ADR 0005: MinIO S3 adapter를 운영 기본값으로 선택

상태: 채택(기능 연결은 Phase 6)

홈 서버 파일 소유권과 향후 S3 이전 가능성을 위해 운영 기본값은 MinIO입니다. 개발/단일 장비 fallback을 위한 local adapter도 같은 `StorageProvider` 계약으로 유지합니다. 파일 접근은 bucket 공개가 아니라 API 권한 검사 후 opaque download endpoint로 제공합니다.
