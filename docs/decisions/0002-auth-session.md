# ADR 0002: 메모리 access token + host-only refresh cookie

상태: 채택

access token은 XSS 노출면을 줄이기 위해 브라우저 메모리에만 둡니다. refresh token은 HttpOnly, Secure, SameSite=Lax, API host-only cookie로 전달하고 DB에는 HMAC hash만 저장합니다. Cookie endpoint는 별도 CSRF cookie/header를 요구합니다. 매 refresh마다 token을 회전하며 재사용 시 세션을 폐기합니다.
