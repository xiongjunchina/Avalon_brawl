#!/usr/bin/env bash
# ==============================================================================
# Avalon Brawl - ECS 自动更新定时任务安装脚本
# 用法:
#   bash scripts/install-brawl-auto-update.sh        # 使用 Systemd Timer 安装（推荐）
#   bash scripts/install-brawl-auto-update.sh --cron # 使用 Linux Crontab 安装（备选）
# ==============================================================================
set -euo pipefail

fail() {
  printf '安装失败: %s\n' "$*" >&2
  exit 1
}

# 1. 检查执行身份
if [ "$(id -u)" -ne 0 ]; then
  fail '请在 ECS 终端以 root 用户权限执行该脚本。'
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BRAWL_DIR="${BRAWL_DIR:-$REPO_DIR}"

cd "$BRAWL_DIR"

# 2. 检查基础环境与依赖
for tool in git flock; do
  command -v "$tool" >/dev/null || fail "未找到必需命令 $tool，请先安装"
done

# 确保脚本有可执行权限
chmod +x scripts/auto-update-brawl-ecs.sh
mkdir -p deploy/runtime

MODE="systemd"
if [ "${1:-}" = "--cron" ]; then
  MODE="cron"
elif ! command -v systemctl >/dev/null 2>&1; then
  echo "提示: 未检测到 systemctl 命令，自动降级为 Crontab 安装模式..."
  MODE="cron"
fi

echo "=================================================="
echo "准备安装 Avalon Brawl 自动检测与热更新定时任务"
echo "仓库目录: $BRAWL_DIR"
echo "调度方式: $MODE (每 10 分钟检查一次 GitHub 远端)"
echo "=================================================="

if [ "$MODE" = "systemd" ]; then
  SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
  mkdir -p "$SYSTEMD_DIR"
  SERVICE_FILE="$SYSTEMD_DIR/avalon-brawl-auto-update.service"
  TIMER_FILE="$SYSTEMD_DIR/avalon-brawl-auto-update.timer"

  # 动态生成指向当前仓库真实路径的 Service 配置
  sed -e "s|WorkingDirectory=.*|WorkingDirectory=$BRAWL_DIR|g" \
      -e "s|ExecStart=.*|ExecStart=$BRAWL_DIR/scripts/auto-update-brawl-ecs.sh|g" \
      deploy/systemd/avalon-brawl-auto-update.service > "$SERVICE_FILE"
  chmod 644 "$SERVICE_FILE"

  cp -f deploy/systemd/avalon-brawl-auto-update.timer "$TIMER_FILE"
  chmod 644 "$TIMER_FILE"

  if command -v systemd-analyze >/dev/null 2>&1; then
    systemd-analyze verify "$SERVICE_FILE" "$TIMER_FILE" 2>/dev/null || true
  fi

  systemctl daemon-reload
  systemctl enable avalon-brawl-auto-update.timer
  systemctl restart avalon-brawl-auto-update.timer

  echo ""
  echo "✅ 安装成功！Systemd 定时器已启动并在后台常驻。"
  echo "--------------------------------------------------"
  systemctl list-timers --all avalon-brawl-auto-update.timer --no-pager 2>/dev/null || true
  echo "--------------------------------------------------"
  echo "常用运维命令:"
  echo "  1. 实时跟踪日志:   journalctl -u avalon-brawl-auto-update.service -f"
  echo "  2. 立即手动执行:   systemctl start avalon-brawl-auto-update.service"
  echo "  3. 查看定时器状态: systemctl status avalon-brawl-auto-update.timer"
  echo "  4. 暂停定时更新:   systemctl disable --now avalon-brawl-auto-update.timer"
  echo "  5. 恢复定时更新:   systemctl enable --now avalon-brawl-auto-update.timer"

else
  # Crontab 模式
  CRON_LOG="/var/log/avalon-brawl-auto-update.log"
  CRON_JOB="*/10 * * * * BRAWL_DIR=$BRAWL_DIR /bin/bash $BRAWL_DIR/scripts/auto-update-brawl-ecs.sh >> $CRON_LOG 2>&1"

  # 安全更新 crontab，避免重复行
  TMP_CRON="$(mktemp)"
  (crontab -l 2>/dev/null | grep -v 'auto-update-brawl-ecs.sh' || true) > "$TMP_CRON"
  echo "$CRON_JOB" >> "$TMP_CRON"
  crontab "$TMP_CRON"
  rm -f "$TMP_CRON"

  echo ""
  echo "✅ 安装成功！Crontab 定时任务已配置生效。"
  echo "--------------------------------------------------"
  echo "已配置计划任务: $CRON_JOB"
  echo "--------------------------------------------------"
  echo "常用运维命令:"
  echo "  1. 查看执行日志:   tail -f $CRON_LOG"
  echo "  2. 立即手动执行:   bash $BRAWL_DIR/scripts/auto-update-brawl-ecs.sh"
  echo "  3. 查看定时列表:   crontab -l"
fi

echo "=================================================="
