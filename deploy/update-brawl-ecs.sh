#!/usr/bin/env bash
set -euo pipefail

BRAWL_DIR="${BRAWL_DIR:-/opt/avalon_brawl}"
cd "$BRAWL_DIR"

ENV_FLAG=()
if [ -f "deploy/.env" ]; then
  ENV_FLAG=(--env-file "deploy/.env")
elif [ -f ".env" ]; then
  ENV_FLAG=(--env-file ".env")
elif [ -f "deploy/.env.local" ]; then
  ENV_FLAG=(--env-file "deploy/.env.local")
fi

echo "=== 重建并平滑更新大乱斗服务 (server & gateway) ==="

docker compose "${ENV_FLAG[@]}" \
  -f deploy/compose.yaml \
  -f deploy/compose.brawl.portal.yaml \
  build server gateway

docker compose "${ENV_FLAG[@]}" \
  -f deploy/compose.yaml \
  -f deploy/compose.brawl.portal.yaml \
  up -d server gateway

echo "=== 大乱斗服务更新完成！==="
