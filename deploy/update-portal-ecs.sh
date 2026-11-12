#!/usr/bin/env bash
set -euo pipefail

PORTAL_DIR="${PORTAL_DIR:-/opt/game-portal}"
BRAWL_DIR="${BRAWL_DIR:-/opt/avalon_brawl}"

echo "=== 更新游戏入口大厅 (game.ccnepower.com) ==="

if [ ! -d "$PORTAL_DIR" ]; then
  echo "错误: 未找到网关目录 $PORTAL_DIR" >&2
  exit 1
fi

TARGET_DIR=$(readlink -f "$PORTAL_DIR/public/current" 2>/dev/null || echo "$PORTAL_DIR/public/current")
echo "目标发布目录: $TARGET_DIR"

if command -v node >/dev/null 2>&1; then
  echo "使用宿主机 Node.js 重新生成入口资产与页面..."
  node "$BRAWL_DIR/deploy/portal/generate.mjs" "$TARGET_DIR"
else
  echo "使用 Docker node:24-alpine 重新生成入口资产与页面..."
  docker run --rm \
    -v "$BRAWL_DIR/deploy/portal:/source:ro" \
    -v "$PORTAL_DIR/public:$PORTAL_DIR/public" \
    -w /source \
    node:24-alpine \
    node generate.mjs "$TARGET_DIR"
fi

# 确保双重确认新 WebP 资源覆盖生效
if [ -d "$TARGET_DIR/www/portal-assets/art" ]; then
  cp -f "$BRAWL_DIR/deploy/portal/assets/art/avalon_vs-desktop.webp" "$TARGET_DIR/www/portal-assets/art/"
  cp -f "$BRAWL_DIR/deploy/portal/assets/art/avalon_vs-mobile.webp" "$TARGET_DIR/www/portal-assets/art/"
fi

echo "平滑重载统一网关 Caddy..."
docker exec game-portal-gateway-1 caddy reload --config "$PORTAL_DIR/public/current/Caddyfile" --adapter caddyfile

echo "=== 入口大厅更新完成！==="
