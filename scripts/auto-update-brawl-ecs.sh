#!/usr/bin/env bash
# ==============================================================================
# Avalon Brawl - ECS GitHub 自动更新与热发布脚本
# 每 10 分钟由 systemd timer 或 cron 触发一次
# 若检测到 origin/main 有新提交，则拉取最新代码并热重载服务
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BRAWL_DIR="${BRAWL_DIR:-$REPO_DIR}"

if [ ! -d "$BRAWL_DIR" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误: 目标目录不存在: $BRAWL_DIR" >&2
  exit 1
fi

cd "$BRAWL_DIR"

# 1. 独占文件锁，避免构建耗时较长时并发触发
mkdir -p deploy/runtime
LOCK_FILE="deploy/runtime/brawl-auto-update.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 另一个自动发布任务正在运行中，本次检查跳过。"
  exit 0
fi

# 2. 分支与工作区安全检查
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 当前非 main 分支 ($CURRENT_BRANCH)，跳过自动更新。"
  exit 0
fi

WORKTREE_STATUS="$(git status --porcelain)"
if [ -n "$WORKTREE_STATUS" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 警告: 本地工作区存在未提交改动，为防止覆盖，跳过本次更新。"
  exit 0
fi

# 3. 检查 GitHub 远端是否有新提交
export GIT_TERMINAL_PROMPT=0
git fetch --no-tags --ipv4 origin main >/dev/null 2>&1 || {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 提示: 连接 GitHub 获取远端分支失败，网络可能波动，将在下次重试。"
  exit 0
}

LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/main)
STATE_FILE="deploy/runtime/last-deployed-brawl-commit"
LAST_DEPLOYED=""
if [ -f "$STATE_FILE" ]; then
  LAST_DEPLOYED=$(cat "$STATE_FILE" 2>/dev/null || true)
fi

# 如果本地已是最新且有发布记录，则无需更新
if [ "$LOCAL_HASH" = "$REMOTE_HASH" ] && [ -n "$LAST_DEPLOYED" ] && [ "$LOCAL_HASH" = "$LAST_DEPLOYED" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 检查完毕: GitHub 远端无新提交 (当前版本: ${LOCAL_HASH:0:7})，无需更新。"
  exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ========================================"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 检测到新版本！${LOCAL_HASH:0:7} -> ${REMOTE_HASH:0:7}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 正在拉取远端 main 分支代码..."

# 4. 快进合并最新代码
git merge --ff-only "$REMOTE_HASH"
NEW_HASH=$(git rev-parse HEAD)

# 5. 执行构建与热重载
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始执行构建与热重载..."

# 方案 A: 容器化环境 (标准生产配置)
if [ -f "deploy/update-brawl-ecs.sh" ] && command -v docker >/dev/null 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 启动容器组热更新 (deploy/update-brawl-ecs.sh)..."
  bash deploy/update-brawl-ecs.sh

  # 若部署了统一入口网关，检查是否需要同步更新入口大厅
  PORTAL_DIR="${PORTAL_DIR:-/opt/game-portal}"
  if [ -d "$PORTAL_DIR" ] && [ -f "deploy/update-portal-ecs.sh" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 同步检查并刷新统一网关入口大厅..."
    bash deploy/update-portal-ecs.sh || true
  fi

# 方案 B: 宿主机 Node.js + PM2 进程托管环境
elif command -v pm2 >/dev/null 2>&1 && pm2 list 2>/dev/null | grep -q 'avalon-server'; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 检测到 PM2 托管进程，执行前端编译与 PM2 重启..."
  if [ -f "package-lock.json" ]; then
    npm ci --no-audit --no-fund
  fi
  npm run build
  pm2 restart avalon-server
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误: 未找到可用的部署执行器 (docker 或 pm2)，请核查部署环境配置。" >&2
  exit 1
fi

# 6. 记录已发布的 Commit Hash 并执行健康状态检查
echo "$NEW_HASH" > "$STATE_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 容器更新完成，进行健康检查..."

if command -v curl >/dev/null 2>&1; then
  HEALTH_URL="http://127.0.0.1:8080/avalon_vs/api/health"
  if curl -fsS --max-time 10 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 健康检查成功: $HEALTH_URL 响应正常"
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 提示: 内部健康检查端点暂未响应或在外部域名，请通过外部入口验证。"
  fi
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🎉 自动更新发布完成！当前生效版本: ${NEW_HASH:0:7}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ========================================"
