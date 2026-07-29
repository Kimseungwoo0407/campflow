# ADR 0003: 외부 검색 Provider adapter

상태: 채택(인터페이스는 Phase 3)

Kakao Local, TourAPI, Mock Provider의 응답을 도메인에 직접 노출하지 않습니다. `PlaceSearchProvider`가 timeout, attribution, cache terms, health를 소유하고 표준 `PlaceProviderResult`로 변환합니다. 네이버는 현재성 때문에 핵심 공급자로 하드코딩하지 않습니다. 무단 크롤링은 구현하지 않습니다.
