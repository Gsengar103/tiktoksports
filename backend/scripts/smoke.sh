#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:3000}"
curl -fsS "$BASE/health"
echo
echo "Health check passed against $BASE"
