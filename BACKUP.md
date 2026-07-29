# Backup and Restore

## 백업

환경 변수 `POSTGRES_USER`, `POSTGRES_DB`를 로드한 상태에서 실행합니다.

```sh
sh infra/scripts/backup.sh
```

custom-format dump가 `backups/campflow-<UTC>.dump`에 생성됩니다. 운영 backup 디렉터리는 디스크 암호화와 별도 장치 복제를 적용합니다.

권장 보존: 일간 7개, 주간 4개, 월간 3개. Phase 6부터 MinIO data를 restic/rclone 암호화 저장소에 같은 세대로 백업합니다.

## 복구

복구는 기존 데이터를 변경하는 작업입니다. 대상 DB와 파일을 다시 확인하고 새 임시 DB에서 먼저 검증합니다.

```sh
sh infra/scripts/restore.sh backups/campflow-YYYYMMDDTHHMMSSZ.dump
```

복구 후 migration 상태, `/v1/health/ready`, seed가 아닌 실제 사용자 수와 샘플 그룹 접근을 확인합니다. 빈 volume 생성이나 삭제로 DB 문제를 우회하지 않습니다.
