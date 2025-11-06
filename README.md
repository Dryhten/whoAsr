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
# 注意: 服务启动时会自动加载实时语音识别模型
uv run python -m api.main

# 启动前端开发服务 (终端 2)
cd frontend
npm run dev
```

4. **访问应用**
- 前端开发界面: http://localhost:5173
- 后端 API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

> 💡 **新特性**: 服务启动后会自动加载实时语音识别模型，无需手动加载即可使用！  
> 详见: [模型自动加载快速指南](docs/QUICK_START_AUTO_LOAD.md)

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
# AUTO_LOAD_MODELS: 是否启用自动加载模型功能 (默认: false)
# PRELOAD_MODELS: 启动时预加载的模型列表，逗号分隔 (默认: 无)
# 可用模型: streaming_asr, offline_asr, punctuation, vad, timestamp
# 
# 注意: 如果 AUTO_LOAD_MODELS=false 或未设置 PRELOAD_MODELS，
# 系统会默认自动加载 streaming_asr (实时语音识别模型)
AUTO_LOAD_MODELS=false
PRELOAD_MODELS=streaming_asr,punctuation

# GPU配置
# DEVICE: 运行设备，可选值: "cpu", "cuda", "cuda:0" (指定GPU编号)
# 使用GPU可以显著提升识别速度，但需要安装CUDA和GPU版本的PyTorch
# 如果系统没有GPU或未安装CUDA，请设置为 "cpu"
DEVICE=cpu

# 日志级别
LOG_LEVEL=INFO
```

## 🚀 GPU 加速配置

### 启用 GPU 支持

项目支持使用 GPU 加速语音识别，可以显著提升识别速度。

#### 1. 配置设备

在 `.env` 文件中设置 `DEVICE` 参数：

```bash
# 使用 GPU (默认使用第一个GPU)
DEVICE=cuda

# 或指定特定GPU编号
DEVICE=cuda:0

# 使用 CPU (默认)
DEVICE=cpu
```

#### 2. 安装 GPU 依赖

**本地开发环境：**

```bash
# 首先安装CUDA版本的PyTorch (根据你的CUDA版本选择)
# CUDA 11.8
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# CUDA 12.1
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# 然后安装项目依赖
uv sync
```

**Docker 环境：**

如果使用 Docker，需要：
1. 使用支持 GPU 的基础镜像（如 `nvidia/cuda`）
2. 安装 `nvidia-docker` 运行时
3. 在 `docker-compose.yml` 中配置 GPU 支持

#### 3. 验证 GPU 可用性

启动服务后，检查日志中是否显示模型加载在 GPU 上：

```
Loading Streaming ASR (paraformer-zh-streaming) on device: cuda...
```

#### 4. 性能对比

- **CPU**: 适合开发和小规模使用，识别速度较慢
- **GPU**: 适合生产环境，识别速度可提升 3-10 倍（取决于GPU型号）

> 💡 **提示**: 如果系统没有 GPU 或 CUDA 未正确安装，系统会自动回退到 CPU 模式，不会报错。

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
