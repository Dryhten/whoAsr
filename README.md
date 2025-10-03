# whoAsr - 实时语音识别 API

基于 FastAPI 和 FunASR 的实时语音识别服务，支持 WebSocket 流式识别和离线文件识别。

## 🚀 快速开始

### 本地开发

1. **克隆项目**
```bash
git clone <repository-url>
cd whoAsr
```

2. **安装依赖**
```bash
# 安装 Python 依赖
uv sync

# 安装前端依赖
cd frontend
npm install
cd ..
```

3. **启动开发服务**
```bash
# 启动后端服务 (终端 1)
uv run python -m api.main

# 启动前端开发服务 (终端 2)
cd frontend
npm run dev
```

4. **访问应用**
- 前端开发界面: http://localhost:5173
- 后端 API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### Docker 部署

1. **构建并启动**
```bash
docker compose up -d --build
```

2. **访问应用**
- 应用地址: http://localhost:8000
- API 文档: http://localhost:8000/docs

## 📖 使用指南

### 实时语音识别

1. 在 Web 界面中点击"开始录音"
2. 对着麦克风说话
3. 实时查看识别结果
4. 点击"停止录音"结束会话

### 离线文件识别

1. 上传音频文件 (支持 wav, mp3, flac 等格式)
2. 点击"开始识别"
3. 查看识别结果

### 模型管理

- **查看模型状态**: 在模型管理卡片中查看已加载的模型
- **加载模型**: 点击相应模型的"加载"按钮
- **卸载模型**: 点击已加载模型的"卸载"按钮释放内存

## 🔧 配置

主要配置项通过环境变量控制：

```bash
# 服务器配置
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=production

# 模型配置
AUTO_LOAD_MODELS=false
PRELOAD_MODELS=streaming_asr,punctuation

# 日志级别
LOG_LEVEL=INFO
```

## 📁 项目结构

```
whoAsr/
├── api/                     # FastAPI 应用
│   ├── main.py             # 应用入口点
│   ├── core/               # 核心模块
│   │   ├── model.py        # 模型管理
│   │   ├── config.py       # 配置常量
│   │   └── connection.py   # 连接管理
│   └── routers/            # 路由模块
├── frontend/               # 前端应用
│   ├── src/                # 源代码
│   ├── dist/               # 构建产物
│   └── package.json        # 前端依赖
├── docker-compose.yml      # Docker 编排配置
├── Dockerfile             # Docker 镜像配置
├── pyproject.toml         # Python 项目配置
└── README.md              # 项目文档
```

## 🔌 主要 API

### WebSocket 端点
- `ws://localhost:8000/ws/{client_id}` - 实时语音识别
- `ws://localhost:8000/vad/ws/{client_id}` - 语音活动检测

### HTTP 端点
- `GET /` - Web 应用界面
- `GET /health` - 健康检查
- `GET /docs` - API 文档
- `POST /recognize` - 离线文件识别
- `POST /punctuate` - 文本标点恢复
- `POST /vad` - 语音活动检测
- `GET|POST /model/info` - 模型信息查询
- `POST /model/load` - 加载指定模型
- `DELETE /model/unload/{model_type}` - 卸载模型
