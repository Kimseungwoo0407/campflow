#!/usr/bin/env sh
set -eu

API_URL="${API_URL:-http://127.0.0.1:4000}"
curl --fail --silent --show-error "$API_URL/v1/health/ready"
echo
