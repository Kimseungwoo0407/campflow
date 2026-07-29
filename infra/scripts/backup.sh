#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$BACKUP_DIR/campflow-$TIMESTAMP.dump"

echo "백업 생성: $BACKUP_DIR/campflow-$TIMESTAMP.dump"
