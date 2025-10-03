# whoAsr 生产环境部署指南

## 📋 目录

- [快速开始](#快速开始)
- [部署架构](#部署架构)
- [环境准备](#环境准备)
- [配置说明](#配置说明)
- [部署方式](#部署方式)
- [监控和维护](#监控和维护)
- [故障排除](#故障排除)

## 🚀 快速开始

### 1. 系统要求

- **操作系统**: Linux (推荐 Ubuntu 20.04+)
- **内存**: 最低 4GB，推荐 8GB+
- **存储**: 最低 20GB 可用空间
- **网络**: 稳定的互联网连接

### 2. 依赖安装

```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 3. 一键部署

```bash
# 克隆项目
git clone <your-repo-url>
cd whoAsr

# 生产环境部署
./scripts/deploy.sh production --build --logs

# 访问应用
open http://localhost:8000
```

## 🏗️ 部署架构

### 组件架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │────│  whoAsr App     │────│    Models       │
│   (Optional)    │    │  (FastAPI)      │    │   (FunASR)      │
│   Port: 80/443  │    │  Port: 8000     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   Frontend      │
                       │   (Static)      │
                       │   Built Files   │
                       └─────────────────┘
```

### 服务组合

- **基础服务**: whoAsr 应用
- **生产环境**: + Nginx 反向代理
- **缓存服务**: + Redis 缓存
- **监控服务**: + Prometheus + Grafana

## ⚙️ 环境准备

### 1. 环境配置

```bash
# 复制配置文件
cp .env.example .env

# 编辑配置文件
nano .env
```

### 2. 关键配置项

```bash
# 生产环境必需配置
ENVIRONMENT=production
FRONTEND_URL=https://your-domain.com
LOG_LEVEL=WARNING

# 服务器配置
HOST=0.0.0.0
PORT=8000

# 模型配置
AUTO_LOAD_MODELS=true
PRELOAD_MODELS=streaming_asr,punctuation

# 性能配置
MAX_CONNECTIONS=1000
WEBSOCKET_TIMEOUT=300
```

### 3. SSL 证书配置 (HTTPS)

```bash
# 创建 SSL 目录
mkdir -p ssl

# 使用 Let's Encrypt (推荐)
sudo certbot certonly --standalone -d your-domain.com
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem

# 或使用自签名证书 (仅测试)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem
```

## 🛠️ 部署方式

### 方式 1: 自动化部署 (推荐)

```bash
# 开发环境
./scripts/deploy.sh dev

# 测试环境
./scripts/deploy.sh staging --build

# 生产环境
./scripts/deploy.sh production --build --logs
```

### 方式 2: Docker Compose

```bash
# 仅基础服务
docker-compose up -d

# 包含缓存服务
docker-compose --profile cache up -d

# 完整生产环境
docker-compose --profile production --profile cache up -d
```

### 方式 3: 手动部署

```bash
# 1. 构建前端
cd frontend
npm ci --only=production
npm run build
cd ..

# 2. 构建后端镜像
docker build -t whoasr-app .

# 3. 启动服务
docker run -d \
  --name whoasr-app \
  -p 8000:8000 \
  -v $(pwd)/.env:/app/.env:ro \
  whoasr-app
```

## 📊 监控和维护

### 1. 健康检查

```bash
# 应用健康状态
curl http://localhost:8000/health

# Docker 容器状态
docker-compose ps

# 实时日志
docker-compose logs -f whoasr-app
```

### 2. 性能监控

启用监控服务:

```bash
# 启动监控组件
docker-compose --profile monitoring up -d

# 访问 Prometheus
open http://localhost:9090

# 访问 Grafana (默认密码: admin)
open http://localhost:3000
```

### 3. 日志管理

```bash
# 查看应用日志
docker-compose logs whoasr-app

# 查看最近 100 行日志
docker-compose logs --tail=100 whoasr-app

# 实时跟踪日志
docker-compose logs -f --tail=100 whoasr-app
```

### 4. 模型管理

```bash
# 检查模型状态
curl http://localhost:8000/model/info

# 加载模型
curl -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "streaming_asr"}'

# 卸载模型
curl -X POST http://localhost:8000/model/unload/streaming_asr
```

## 🔧 故障排除

### 常见问题

#### 1. 服务无法启动

```bash
# 检查端口占用
sudo netstat -tulpn | grep :8000

# 检查 Docker 服务
sudo systemctl status docker

# 重启服务
docker-compose down
docker-compose up -d
```

#### 2. 前端无法访问

```bash
# 检查前端构建
ls -la frontend/dist/

# 重新构建前端
cd frontend && npm run build

# 检查静态文件挂载
docker exec whoasr-app ls -la /app/frontend/dist/
```

#### 3. 模型加载失败

```bash
# 检查模型缓存空间
df -h /app/models/cache

# 检查内存使用
docker stats whoasr-app

# 重启应用服务
docker-compose restart whoasr-app
```

#### 4. 性能问题

```bash
# 检查系统资源
htop
iotop
docker stats

# 调整配置
# 编辑 .env 文件，增加内存限制或调整并发数
```

### 紧急恢复

```bash
# 快速重启所有服务
./scripts/deploy.sh --restart

# 完全重建 (谨慎使用)
./scripts/deploy.sh production --build --no-cache --clean

# 数据备份 (如果有重要数据)
docker run --rm -v whoasr-models:/data -v $(pwd):/backup alpine tar czf /backup/models-backup-$(date +%Y%m%d).tar.gz -C /data .
```

## 📝 维护建议

### 定期维护任务

1. **每日检查**:
   - 服务健康状态
   - 错误日志监控
   - 磁盘空间使用

2. **每周维护**:
   - 清理临时文件
   - 更新安全补丁
   - 备份配置文件

3. **每月维护**:
   - 更新 Docker 镜像
   - 性能分析报告
   - 安全审计

### 性能优化

1. **模型优化**:
   - 根据使用情况选择合适的模型
   - 配置模型自动卸载策略
   - 监控内存使用情况

2. **网络优化**:
   - 启用 Gzip 压缩
   - 配置 CDN 加速静态资源
   - 优化 WebSocket 连接

3. **资源优化**:
   - 调整容器资源限制
   - 配置日志轮转策略
   - 优化数据库查询 (如果使用)

## 🆘 技术支持

如果遇到问题，请按以下步骤排查：

1. 检查 [故障排除](#故障排除) 部分
2. 查看应用日志: `docker-compose logs whoasr-app`
3. 检查系统状态: `docker-compose ps`
4. 提交 Issue 并包含以下信息:
   - 错误描述
   - 系统环境信息
   - 相关日志文件
   - 配置文件 (去除敏感信息)

---

**部署完成后，访问 http://localhost:8000 开始使用 whoAsr！**