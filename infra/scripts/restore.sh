#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo "사용법: $0 <backup.dump>" >&2
  exit 2
fi

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.yml}"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$1"

echo "복구 완료: $1"
