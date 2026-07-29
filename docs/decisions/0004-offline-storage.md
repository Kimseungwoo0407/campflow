# ADR 0004: 정적 app shell 우선 오프라인 전략

상태: 채택

Phase 0에서는 Workbox가 정적 자산만 precache합니다. API GET 응답과 프로필/정산을 무차별 Cache Storage에 넣지 않습니다. Phase 8에서 데이터 분류, 사용자별 IndexedDB snapshot, outbox, `clientMutationId`, `baseVersion`, 충돌 UI와 기기 데이터 삭제를 한 묶음으로 도입합니다.
