# whoAsr - 实时语音识别 API

基于 FastAPI 和 FunASR 的实时语音识别服务，支持 WebSocket 流式识别和离线文件识别。

## 🚀 快速开始

### 本地开发

1. **克隆项目**
```bash
git clone https://github.com/LinSoap/whoAsr.git
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

### 实时语音识别 (WebSocket)

1. 在 Web 界面中点击"开始录音"
2. 对着麦克风说话
3. 实时查看识别结果
4. 点击"停止录音"结束会话

### 离线文件识别

1. 上传音频文件 (支持 WAV, MP3, M4A, FLAC, OGG 格式)
2. 可选输入热词提高识别准确率
3. 点击"开始识别"
4. 查看带标点的识别结果

### 语音活动检测 (VAD)

1. 上传音频文件进行语音端点检测
2. 查看检测到的语音片段时间轴
3. 获取语音片段详细信息 (开始时间、结束时间、时长)
4. 支持实时流式检测 (WebSocket)

### 时间戳预测

1. 上传音频文件或输入文本
2. 获取词语级别的时间戳信息
3. 支持精确到毫秒的时间定位

### 文本标点恢复

1. 输入无标点的中文文本
2. 自动添加标点符号
3. 保持语义连贯性

### 模型管理

- **查看模型状态**: 在模型管理卡片中查看已加载的模型
- **加载模型**: 点击相应模型的"加载"按钮
- **卸载模型**: 点击已加载模型的"卸载"按钮释放内存
- **批量管理**: 支持按需加载特定功能模块

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
├── api/                     # FastAPI 应用 (模块化架构)
│   ├── main.py             # 应用入口点 + SPA 路由 + 向后兼容端点
│   ├── core/               # 核心模块
│   │   ├── model.py        # 模型管理 (ASR + 标点)
│   │   ├── models.py       # 模型类型和配置定义
│   │   ├── config.py       # 配置常量
│   │   ├── connection.py   # WebSocket 连接管理
│   │   └── audio.py        # 音频处理工具
│   └── routers/            # 路由模块 (功能分离)
│       ├── websocket.py    # WebSocket 实时识别
│       ├── offline.py      # 离线文件识别 (/offline/*)
│       ├── punctuation.py  # 标点恢复 (/punctuation/*)
│       ├── vad.py          # 语音活动检测 (/vad/*)
│       ├── timestamp.py    # 时间戳预测 (/timestamp/*)
│       └── model.py        # 模型管理 (/model/*)
├── frontend/               # 前端应用 (Preact + TypeScript)
│   ├── src/
│   │   ├── api.ts          # API 客户端和类型定义
│   │   ├── components/     # 可复用组件库
│   │   ├── pages/          # 页面组件
│   │   ├── lib/            # 工具函数库
│   │   └── hooks/          # 自定义 Hooks
│   ├── dist/               # 生产构建产物 (由 FastAPI 托管)
│   └── package.json        # 前端依赖
├── docker-compose.yml      # Docker 编排配置
├── Dockerfile             # Docker 镜像配置
├── pyproject.toml         # Python 项目配置 (uv 包管理)
└── README.md              # 项目文档
```



## 🔌 API 端点

### WebSocket 实时识别
- `ws://localhost:8000/ws/{client_id}` - 实时语音识别 (返回识别文本)
- `ws://localhost:8000/vad/ws/{client_id}` - 专用VAD流式检测 (返回语音片段时间戳)

### HTTP 核心端点
- `GET /` - Web 应用界面 (SPA)
- `GET /health` - 健康检查与系统状态
- `GET /docs` - API 文档 (Swagger UI)

### 语音识别功能
- `POST /offline/recognize` - 离线音频文件识别
- `POST /timestamp/predict` - 时间戳预测

### 文本处理功能
- `POST /punctuation/add` - 文本标点恢复

### 语音活动检测
- `POST /vad/detect` - 语音活动检测

### 模型管理
- `GET /model/info` - 模型状态查询
- `POST /model/load` - 加载指定模型
- `POST /model/unload/{model_type}` - 卸载指定模型
- `GET /model/config/{model_type}` - 获取模型配置信息

### 路由说明
- 所有主要功能模块使用独立的路由前缀 (`/offline`, `/punctuation`, `/vad`, `/timestamp`, `/model`)
- SPA 路由支持: 所有非 API 路径返回前端应用界面
