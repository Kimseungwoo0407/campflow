#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.yml}"
"$(dirname "$0")/backup.sh"
docker compose -f "$COMPOSE_FILE" pull api
docker compose -f "$COMPOSE_FILE" run --rm api pnpm --filter @campflow/api prisma:deploy
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
"$(dirname "$0")/health.sh"
