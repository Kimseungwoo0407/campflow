# 배포

## GitHub Pages

Repository Settings → Pages에서 GitHub Actions를 source로 선택합니다. Variables에는 다음 공개값만 등록합니다.

- `VITE_API_BASE_URL=https://api.example.com/v1`
- custom domain은 `VITE_GITHUB_PAGES_BASE=/`
- project Pages는 `VITE_GITHUB_PAGES_BASE=/repository-name/`

`main` push 시 CI가 성공해야 Pages build가 배포됩니다. 비밀 Provider key와 DB/JWT/SMTP 값은 Pages variable에 넣지 않습니다.

## 홈 서버

운영 `.env`를 서버에만 만들고 파일 권한을 제한합니다. PostgreSQL, Redis, MinIO는 Docker 내부 network에만 존재합니다. API의 host bind는 상태 점검을 위해 `127.0.0.1`로 제한합니다.

```sh
docker compose -f infra/docker-compose.yml build
docker compose -f infra/docker-compose.yml run --rm api pnpm --filter @campflow/api prisma:deploy
docker compose -f infra/docker-compose.yml --profile tunnel up -d
sh infra/scripts/health.sh
```

Cloudflare Tunnel 공개 hostname의 service는 `http://api:4000`입니다. 라우터 80/443/5432/6379/9000 포트를 열지 않습니다.

## 업데이트

`API_IMAGE`를 GHCR의 immutable SHA tag로 설정합니다. `sh infra/scripts/update.sh`는 backup → image pull → migration → compose up → health 순서로 실행합니다. 파괴적인 DB migration은 자동 업데이트에 포함하지 않습니다.
