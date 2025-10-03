# 多阶段构建 - 生产环境优化
FROM node:18-alpine AS frontend-builder

# 设置工作目录
WORKDIR /app/frontend

# 复制前端文件
COPY frontend/package*.json ./
COPY frontend/ .

# 安装依赖并构建
RUN npm ci && \
    npm run build

# ================================
# Python 生产环境
# ================================
FROM python:3.13-slim as production

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ffmpeg \
    portaudio19-dev \
    python3-dev \
    pkg-config \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# 安装 uv
RUN pip install uv

# 复制 Python 依赖文件
COPY pyproject.toml uv.lock ./

# 安装 Python 依赖
RUN uv sync --frozen --no-dev

# 复制后端代码
COPY api/ ./api/

# 创建非 root 用户
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

# 复制前端构建文件
COPY --from=frontend-builder --chown=app:app /app/frontend/dist ./frontend/dist

# 创建必要的目录
RUN mkdir -p /app/models/cache /app/logs /tmp/whoasr

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动命令
CMD ["uv", "run", "python", "-m", "api.main"]