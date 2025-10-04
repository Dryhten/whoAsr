# whoAsr API 测试脚本

本文件夹包含用于测试 whoAsr 后端 API 的 curl 测试脚本。

## 使用方法

### 前置条件

1. 确保 whoAsr 后端服务正在运行：
   ```bash
   uv run python -m api.main
   ```

2. 服务默认运行在 `http://localhost:8000`

### 运行测试

#### 给所有脚本添加执行权限
```bash
chmod +x *.sh
```

#### 运行单个测试
```bash
# 健康检查
./test_health.sh

# 离线语音识别
./test_offline_asr.sh

# 文本标点恢复
./test_punctuation.sh

# 语音活动检测
./test_vad.sh

# 时间戳预测
./test_timestamp.sh

# 模型管理
./test_model_management.sh
```

#### 运行所有测试
```bash
# 按顺序执行所有测试
./test_health.sh
./test_model_management.sh
./test_punctuation.sh
# 需要准备音频文件
./test_offline_asr.sh
./test_vad.sh
./test_timestamp.sh
```

## 测试脚本说明

### 1. test_health.sh
- **端点**: `GET /health`
- **功能**: 测试健康检查接口
- **说明**: 返回服务状态、已加载模型信息和系统资源使用情况

### 2. test_model_management.sh
- **端点**:
  - `GET /model/info` - 查看模型状态
  - `POST /model/load` - 加载模型
  - `GET /model/config/{model_type}` - 获取模型配置
  - `POST /model/unload/{model_type}` - 卸载模型
- **功能**: 测试模型管理接口
- **说明**: 支持的模型类型：
  - `streaming_asr` - 实时语音识别
  - `offline_asr` - 离线语音识别
  - `vad` - 语音活动检测
  - `timestamp` - 时间戳预测
  - `punctuation` - 标点恢复

### 3. test_punctuation.sh
- **端点**: `POST /punctuation/add`
- **功能**: 测试文本标点恢复
- **说明**: 输入无标点中文文本，返回带标点的文本

### 4. test_offline_asr.sh
- **端点**: `POST /offline/recognize`
- **功能**: 测试离线语音识别
- **准备**: 需要准备音频文件（默认：`test_audio.wav`）
- **说明**: 支持格式：WAV, MP3, M4A, FLAC, OGG

### 5. test_vad.sh
- **端点**: `POST /vad/detect`
- **功能**: 测试语音活动检测
- **准备**: 需要准备音频文件（默认：`test_audio.wav`）
- **说明**: 返回检测到的语音片段时间戳

### 6. test_timestamp.sh
- **端点**: `POST /timestamp/predict`
- **功能**: 测试时间戳预测
- **准备**: 需要准备音频文件（默认：`test_audio.wav`）
- **说明**: 预测词语级别的时间戳信息

## 音频文件准备

对于需要音频文件的测试，请准备：
- 文件名：`asr_example.wav`（或修改脚本中的文件名）
- 格式：推荐 WAV，也支持 MP3、M4A、FLAC、OGG
- 采样率：推荐 16kHz
- 声道：单声道

## 常见问题

### 1. 模型未加载错误
如果收到模型未加载的错误，先运行 `test_model_management.sh` 加载相应模型：
```bash
# 加载标点模型
curl -X POST "http://localhost:8000/model/load" \
  -H "Content-Type: application/json" \
  -d '{"model_type": "punctuation"}'
```

### 2. 音频文件不存在
确保音频文件路径正确，或修改脚本中的文件名。

### 3. 端口冲突
如果服务运行在其他端口，修改脚本中的 URL 端口号。

## WebSocket 测试

WebSocket 端点需要专门的客户端工具测试：
- 实时语音识别：`ws://localhost:8000/ws/{client_id}`
- VAD 流式检测：`ws://localhost:8000/vad/ws/{client_id}`

可以使用以下工具测试：
- WebSocket King (浏览器扩展)
- wscat 命令行工具
- 自定义 WebSocket 客户端代码