# whoAsr - 实时语音识别 API

基于 FastAPI 和 FunASR 的语音识别服务，支持多种识别模式：流式实时识别、离线文件识别、VAD 切分 + FunASR-Nano 准实时识别，以及标点恢复、时间戳预测、语音活动检测等功能。

## 🚀 快速开始

### PyTorch 版本选择

本项目支持 CPU 和 GPU 两种运行环境，使用 uv 的 `--extra` 选择：

| 环境 | 命令 | 说明 |
|------|------|------|
| **CPU** | `uv sync --extra cpu` | 无 NVIDIA GPU 时使用 |
| **GPU** | `uv sync --extra gpu` | 需已安装 CUDA 12.4 |

**注意**：必须指定 `--extra cpu` 或 `--extra gpu` 之一，两者互斥。

### 本地开发

1. **克隆项目**
```bash
git clone https://github.com/LinSoap/whoAsr.git
cd whoAsr
```

2. **Linux 系统依赖（仅 Linux 需先执行）**

在 Linux 环境下，需先安装 PortAudio 等系统依赖后再安装 Python 依赖：

```bash
sudo apt-get update
sudo apt-get install libportaudio2 libportaudiocpp0 portaudio19-dev
```

3. **配置环境变量（可选）**
```bash
cp .env.example .env   # 复制后按需修改
```

4. **安装依赖**
```bash
# 一键安装前后端依赖（按环境选择）
npm run install:cpu   # CPU 版本
npm run install:gpu   # GPU 版本 (需 CUDA 12.4)

# 或手动安装
uv sync --extra cpu   # 或 uv sync --extra gpu
cd frontend && npm install
```

5. **启动开发服务**
```bash
# 启动后端服务 (终端 1)
uv run python -m api.main

# 启动前端开发服务 (终端 2)
cd frontend
npm run dev
```

6. **访问应用**
- 前端开发界面: https://localhost:5173 （HTTPS 为麦克风录音提供安全上下文，首次访问需接受浏览器自签名证书提示）
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

1. 在「实时转换」页面点击"开始录音"
2. 对着麦克风说话
3. 实时查看识别结果（基于 paraformer-zh-streaming 流式模型）
4. 点击"停止录音"结束会话

### 实时识别 (FunASR-Nano)

1. 在「实时识别 (FunASR-Nano)」页面使用
2. 基于 VAD 切分 + FunASR-Nano 离线模型，按句推送识别结果
3. 适合对识别准确率要求高、可接受轻微延迟的场景
4. 需预加载 VAD 和离线 ASR 模型

### 离线文件识别

1. 在「离线转换」页面上传音频文件 (支持 WAV, MP3, M4A, FLAC, OGG 格式)
2. 可选输入热词提高识别准确率
3. 点击"开始识别"
4. 查看带标点的识别结果（基于 FunASR-Nano）

### 语音活动检测 (VAD)

1. **离线检测**：上传音频文件，查看语音片段时间轴
2. **实时检测**：WebSocket 流式检测，实时返回语音片段
3. 获取语音片段详细信息 (开始时间、结束时间、时长)

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

主要配置项通过环境变量控制，完整配置见 `.env.example`：

```bash
# 服务器配置
HOST=0.0.0.0
PORT=8000

# 模型配置
AUTO_LOAD_MODELS=true
PRELOAD_MODELS=streaming_asr,punctuation,offline_asr,vad,timestamp

# 文件上传
MAX_UPLOAD_SIZE=100
TEMP_DIR=/tmp/whoasr

# 日志
LOG_LEVEL=INFO
```

## 📁 项目结构

```
whoAsr/
├── api/                     # FastAPI 应用 (模块化架构)
│   ├── main.py             # 应用入口点 + SPA 路由
│   ├── core/               # 核心模块
│   │   ├── model.py        # 模型管理 (ASR/VAD/标点/时间戳)
│   │   ├── models.py       # 模型类型和配置定义
│   │   ├── config.py       # 配置常量
│   │   ├── connection.py  # WebSocket 连接管理
│   │   └── audio.py       # 音频处理工具
│   └── routers/            # 路由模块 (功能分离)
│       ├── websocket.py    # 流式实时识别 (/ws/*)
│       ├── realtime_nano.py # VAD + FunASR-Nano 准实时识别 (/realtime-nano/*)
│       ├── offline.py     # 离线文件识别 (/offline/*)
│       ├── punctuation.py # 标点恢复 (/punctuation/*)
│       ├── vad.py         # 语音活动检测 (/vad/*)
│       ├── timestamp.py   # 时间戳预测 (/timestamp/*)
│       └── model.py       # 模型管理 (/model/*)
├── frontend/               # 前端应用 (Preact + TypeScript)
│   ├── src/
│   │   ├── api.ts         # API 客户端和类型定义
│   │   ├── components/    # 可复用组件库
│   │   ├── pages/         # 页面 (Home/Asr/AsrOffline/Vad/Punctuation/Timestamp)
│   │   ├── lib/           # 工具函数库
│   │   └── hooks/         # 自定义 Hooks
│   ├── dist/              # 生产构建产物 (由 FastAPI 托管)
│   └── package.json       # 前端依赖
├── docker-compose.yml     # Docker 编排配置
├── Dockerfile             # Docker 镜像配置
├── pyproject.toml         # Python 项目配置 (uv 包管理)
└── README.md              # 项目文档
```



## 🔌 API 端点

### WebSocket
| 端点 | 说明 |
|------|------|
| `ws://localhost:8000/ws/{client_id}` | 流式实时识别 (paraformer-zh-streaming) |
| `ws://localhost:8000/realtime-nano/ws/{client_id}` | VAD 切分 + FunASR-Nano 准实时识别 |
| `ws://localhost:8000/vad/ws/{client_id}` | 实时 VAD 流式检测 |

### HTTP 核心
- `GET /` - Web 应用界面 (SPA)
- `GET /health` - 健康检查与系统状态
- `GET /docs` - API 文档 (Swagger UI)

### 语音识别
- `POST /offline/recognize` - 离线音频文件识别

### 文本处理
- `POST /punctuation/add` - 文本标点恢复

### 语音活动检测
- `POST /vad/detect` - 离线 VAD 检测

### 时间戳
- `POST /timestamp/predict` - 时间戳预测

### 模型管理
- `GET /model/info` - 模型状态查询
- `POST /model/load` - 加载指定模型
- `POST /model/unload/{model_type}` - 卸载指定模型
- `GET /model/config/{model_type}` - 获取模型配置信息

## 🧪 测试

```bash
# 运行 API 测试套件
./curl_test/run_all_tests.sh

# 单独测试
./curl_test/test_offline_asr.sh
./curl_test/test_punctuation.sh
./curl_test/test_vad.sh
```
