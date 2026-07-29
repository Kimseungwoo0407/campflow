# External Providers

## 장소 검색 · OpenStreetMap Nominatim

확인일: 2026-07-29

- 서버가 `PLACE_SEARCH_PROVIDER_URL`의 Nominatim Search API를 호출하고 한국 결과만 요청합니다.
- 검색은 사용자가 버튼을 누를 때만 실행합니다. 입력 중 자동완성 요청은 보내지 않습니다.
- 앱 전체 요청 시작 간격을 1.1초 이상으로 제한하고 동일 검색어 결과를 15분간 메모리 캐시에 보관합니다.
- 식별 가능한 `User-Agent`, 서비스 주소 `Referer`, 한국어 우선 헤더를 전송합니다.
- 결과 화면에 `© OpenStreetMap contributors (ODbL)` 출처와 저작권 안내 링크를 표시합니다.
- 장소명, 주소, 좌표, 분류, 공개 연락처·웹사이트, OpenStreetMap 원문 링크만 저장합니다.
- 검색 제공자 URL은 환경 변수로 교체할 수 있어 앱을 다시 배포하지 않고 다른 Nominatim 인스턴스로 전환할 수 있습니다.
- 외부 검색이 실패하면 이전에 저장된 실제 장소만 보여주고 재시도 안내를 표시합니다.

공개 Nominatim은 소규모 친구 여행용 수동 검색에만 사용합니다. 대량 요청, 주기적 수집,
자동완성, 전체 POI 다운로드에는 사용하지 않으며 트래픽이 커지면 자체 인스턴스 또는 계약된
지역 검색 API로 교체해야 합니다.

공식 문서:

- <https://operations.osmfoundation.org/policies/nominatim/>
- <https://nominatim.org/release-docs/latest/api/Search/>

“모든 글램핑”, “예약 가능”, “최저가”처럼 검색 데이터만으로 검증할 수 없는 표현은 사용하지
않습니다. 실제 영업, 가격, 예약 가능 여부는 후보 등록 전에 원문 링크나 업체 홈페이지에서
다시 확인해야 합니다.
