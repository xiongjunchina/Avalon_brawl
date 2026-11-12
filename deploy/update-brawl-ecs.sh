#!/usr/bin/env bash
set -euo pipefail

BRAWL_DIR="${BRAWL_DIR:-/opt/avalon_brawl}"
cd "$BRAWL_DIR"

ENV_FILE=""
if [ -f "deploy/.env.ecs" ]; then
  ENV_FILE="deploy/.env.ecs"
elif [ -f "deploy/.env" ]; then
  ENV_FILE="deploy/.env"
elif [ -f ".env" ]; then
  ENV_FILE=".env"
elif [ -f "deploy/.env.local" ]; then
  ENV_FILE="deploy/.env.local"
else
  echo "未检测到环境配置文件，从 deploy/brawl.env.example 初始化 deploy/.env.ecs..."
  cp deploy/brawl.env.example deploy/.env.ecs
  DB_PASS=$(openssl rand -hex 16 2>/dev/null || date +%s%N | sha256sum | head -c 32)
  sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${DB_PASS}/" deploy/.env.ecs
  ENV_FILE="deploy/.env.ecs"
fi

echo "使用环境配置: $ENV_FILE"
echo "=== 重建并平滑更新大乱斗服务 (server & gateway) ==="

# 确保专属网络存在
docker network create game-avalon-brawl-ingress >/dev/null 2>&1 || true

# 重新构建并热启动 server 与 gateway 服务
docker compose --env-file "$ENV_FILE" \
  -f deploy/compose.yaml \
  -f deploy/compose.brawl.portal.yaml \
  up -d --build server gateway

echo "=== 大乱斗服务热更新完成！==="
