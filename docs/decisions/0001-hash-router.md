# ADR 0001: GitHub Pages에서 HashRouter 사용

상태: 채택

GitHub Pages는 임의 SPA deep link를 `index.html`로 rewrite하지 않습니다. 별도 404 redirect hack 대신 `HashRouter`를 사용해 새로고침 404를 방지합니다. URL의 hash 이후 경로는 서버에 전달되지 않지만 정적 호스팅의 단순성과 안정성을 우선합니다.
