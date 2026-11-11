# Avalon 大乱斗版 · ECS 部署与多路径发布指南

本文档指导在 ECS 生产服务器上部署《Avalon 乱斗版》，实现通过 `https://game.ccnepower.com` 同一入口与证书分流两个版本：
- **常规原版**：`https://game.ccnepower.com/avalon/`
- **乱斗新版**：`https://game.ccnepower.com/avalon_vs/`
- **公共大厅**：`https://game.ccnepower.com/`

---

## 一、架构与隔离说明

1. **容器与数据卷隔离**：
   - 常规版位于 `/opt/avalon`，数据库卷为 `avalon_pgdata`，内部网络为 `game-avalon-ingress`；
   - 乱斗版位于 `/opt/avalon_brawl`，数据库卷为 `avalon-brawl_pgdata`，内部网络为 `game-avalon-brawl-ingress`；
   - 两套应用与数据库物理隔离，互不干扰，互不串号。
2. **统一网关零停机路由**：
   - 统一网关位于 `/opt/game-portal`，通过 Caddy 反向代理根据路径前缀分发至对应容器；
   - 访问 `/avalon_vs` 自动 308 重定向至 `/avalon_vs/` 并保持 URL 查询参数。

---

## 二、ECS 部署执行步骤

### 步骤 1：部署并启动大乱斗专属实例

在 ECS 终端以 root 身份执行：

```bash
# 1. 进入 /opt 目录，克隆大乱斗独立仓库
cd /opt
if [ ! -d "/opt/avalon_brawl" ]; then
  git clone https://github.com/xiongjunchina/Avalon_brawl.git avalon_brawl
fi
cd /opt/avalon_brawl
git pull --ff-only origin main

# 2. 准备大乱斗独立环境变量文件
if [ ! -f "deploy/.env.ecs" ]; then
  cp deploy/brawl.env.example deploy/.env.ecs
  # 生成专属随机数据库密码
  DB_PASS=$(openssl rand -hex 16)
  sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${DB_PASS}/" deploy/.env.ecs
fi

# 3. 创建专属内部网络（已存在则忽略）
docker network create game-avalon-brawl-ingress || true

# 4. 构建并启动大乱斗容器组（仅首次构建需消耗 1~2 分钟）
docker compose -f deploy/compose.yaml -f deploy/compose.brawl.portal.yaml --env-file deploy/.env.ecs up -d --build

# 5. 检查大乱斗容器健康状态
docker compose -f deploy/compose.yaml -f deploy/compose.brawl.portal.yaml --env-file deploy/.env.ecs ps
```

---

### 步骤 2：更新统一网关并平滑热重载

```bash
# 1. 切换到统一网关目录
cd /opt/game-portal

# 2. 同步最新的 games.json 与生成器代码
cp /opt/avalon_brawl/deploy/portal/games.json ./
cp /opt/avalon_brawl/deploy/portal/generate.mjs ./
mkdir -p ./assets/art/
cp /opt/avalon_brawl/deploy/portal/assets/art/avalon_vs-*.webp ./assets/art/ || true

# 3. 重新生成网关路由与大厅静态页面
node generate.mjs

# 4. 将网关容器接入大乱斗专属网络（仅需一次）
docker network connect game-avalon-brawl-ingress game-portal-gateway-1 || true

# 5. 平滑重载网关（零停机，不影响常规版与暗局）
docker exec game-portal-gateway-1 caddy reload --config /opt/game-portal/public/current/Caddyfile --adapter caddyfile
```

---

### 三、线上验证与验收

在 ECS 本机或外部终端执行下列验证命令：

```bash
# 1. 验证常规原版（必须不受任何影响，返回 200）
curl -I https://game.ccnepower.com/avalon/

# 2. 验证大乱斗 308 重定向（返回 Location: /avalon_vs/）
curl -I https://game.ccnepower.com/avalon_vs

# 3. 验证大乱斗前端页面（返回 200，且包含 /avalon_vs/ 资源路径）
curl -s https://game.ccnepower.com/avalon_vs/ | grep "avalon_vs"

# 4. 验证大乱斗后端 API 健康检查（返回 200）
curl -i https://game.ccnepower.com/avalon_vs/api/health
```

浏览器打开：
- `https://game.ccnepower.com/avalon` → 直接进入常规原版（真假猴王）
- `https://game.ccnepower.com/avalon_vs` → 直接进入乱斗版本（嘻游 · 大乱斗）
- `https://game.ccnepower.com/` → 大厅首页卡片并列展示两款西游版本
