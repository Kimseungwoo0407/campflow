# External Providers

현재 Phase 1은 외부 장소/날씨 API를 호출하지 않습니다. Phase 3에서 다음 adapter 계약으로 추가합니다.

- Mock Provider: CI/E2E 기본, 모든 결과에 `샘플` 표시
- Kakao Local: 서버 REST key, 표시/쿼터/저장 정책 준수
- TourAPI: 서버 service key, 콘텐츠 attribution과 갱신 시각 유지
- Naver API HUB: optional 교체 adapter

검색 원문 전체를 영구 복제하지 않고 사용자가 후보로 고른 최소 필드, source URL, fetchedAt만 저장합니다. provider마다 timeout, enable flag, health, attribution, cache TTL/terms class를 문서화합니다. “모든 글램핑”, “예약 가능”, “최저가” 같은 검증 불가능한 표현은 사용하지 않습니다.

구현 시 각 공급자의 공식 문서를 다시 확인하고 확인 날짜를 이 파일에 기록합니다. 무단 숙박 사이트 크롤러는 만들지 않습니다.
