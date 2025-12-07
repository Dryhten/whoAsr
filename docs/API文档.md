# whoAsr API 使用文档

## 简介

whoAsr 是一个基于 FastAPI 和 FunASR 的实时语音识别 API 服务。本项目提供了 WebSocket 实时流式语音识别和 HTTP 接口的离线语音处理功能，支持中文语音识别、语音活动检测、标点符号恢复和时间戳预测。

## 服务地址

- API 基础地址: `http://localhost:8000`
- WebSocket 地址: `ws://localhost:8000`
- API 文档: `http://localhost:8000/docs`

## 一、HTTP API 接口

### 1. 基础接口

#### 1.1 服务主页
```http
GET /
```
返回前端页面或 API 基本信息。

#### 1.2 健康检查
```http
GET /health
```
返回服务健康状态，包括系统信息和服务状态。

**响应示例：**
```json
{
  "status": "healthy",
  "models": {
    "streaming_asr": true,
    "offline_asr": false,
    "punctuation": true,
    "vad": false,
    "timestamp": false
  },
  "system_info": {
    "cpu_usage": 15.2,
    "memory_usage": 45.8,
    "gpu_usage": 0
  }
}
```

### 2. 模型管理接口

#### 2.1 加载模型
```http
POST /model/load
```

**请求体：**
```json
{
  "model_type": "streaming_asr"
}
```

**可选的 model_type 值：**
- `streaming_asr`: 实时语音识别
- `offline_asr`: 离线语音识别
- `punctuation`: 标点符号恢复
- `vad`: 语音活动检测
- `timestamp`: 时间戳预测

**响应示例：**
```json
{
  "success": true,
  "model_type": "streaming_asr",
  "message": "Model loaded successfully",
  "loaded": true
}
```

#### 2.2 卸载模型
```http
POST /model/unload/{model_type}
```

**路径参数：**
- `model_type`: 要卸载的模型类型

#### 2.3 获取模型信息
```http
GET /model/info
```

返回所有模型的详细信息，包括加载状态、配置等。

#### 2.4 获取指定模型配置
```http
GET /model/config/{model_type}
```

返回指定模型的配置信息。

### 3. 离线语音识别接口

#### 3.1 文件识别
```http
POST /offline/recognize
```

**请求格式：** multipart/form-data

**参数：**
- `file`（必需）: 音频文件
- `batch_size_s`（可选）: 批处理大小（秒），默认 300
- `batch_size_threshold_s`（可选）: 批处理阈值（秒），默认 60
- `hotword`（可选）: 热词

**支持格式：** WAV, MP3, MPEG, M4A, FLAC, OGG

**响应示例：**
```json
{
  "success": true,
  "results": [
    {
      "text": "你好，世界",
      "start": 0,
      "end": 2.5
    }
  ],
  "message": "Recognition completed",
  "file_name": "audio.wav",
  "file_size": 1024000
}
```

### 4. 语音活动检测（VAD）接口

#### 4.1 VAD 检测
```http
POST /vad/detect
```

**请求格式：** 文件上传

**参数：**
- `file`（必需）: 音频文件

**支持格式：** WAV, MP3, M4A, FLAC, OGG

**响应示例：**
```json
{
  "success": true,
  "message": "VAD detection completed",
  "segments": [
    [0, 2000],
    [5000, 8000]
  ],
  "file_name": "audio.wav",
  "file_size": 1024000
}
```

### 5. 标点符号恢复接口

#### 5.1 添加标点符号
```http
POST /punctuation/add
```

**请求体：**
```json
{
  "text": "你好世界今天天气不错"
}
```

**响应示例：**
```json
{
  "original_text": "你好世界今天天气不错",
  "punctuated_text": "你好，世界！今天天气不错。",
  "success": true,
  "message": "Punctuation added successfully"
}
```

### 6. 时间戳预测接口

#### 6.1 预测时间戳
```http
POST /timestamp/predict
```

**请求格式：** multipart/form-data

**参数（必需）：**
- `audio_file`: 音频文件

**参数（二选一）：**
- `text_file`: 文本文件
- `text_content`: 文本内容

**响应示例：**
```json
{
  "success": true,
  "message": "Timestamp prediction completed",
  "results": [
    {
      "word": "你好",
      "start": 0.5,
      "end": 1.0
    },
    {
      "word": "世界",
      "start": 1.2,
      "end": 1.8
    }
  ]
}
```

## 二、WebSocket 接口

### 1. 实时语音识别 WebSocket

#### 1.1 连接地址
```
ws://localhost:8000/ws/{client_id}
```

**路径参数：**
- `client_id`: 客户端唯一标识符

#### 1.2 消息格式

**客户端发送消息：**

1. **开始录音**
```json
{
  "type": "start_recording"
}
```

2. **发送音频数据**
```json
{
  "type": "audio_chunk",
  "data": "base64编码的音频数据"
}
```

3. **停止录音**
```json
{
  "type": "stop_recording"
}
```

**服务端返回消息：**

1. **部分识别结果**
```json
{
  "type": "partial_result",
  "text": "你好",
  "is_final": false
}
```

2. **最终识别结果**
```json
{
  "type": "final_result",
  "text": "你好，世界",
  "is_final": true
}
```

3. **状态消息**
```json
{
  "type": "status",
  "message": "Recording started"
}
```

4. **错误消息**
```json
{
  "type": "error",
  "message": "Error description"
}
```

#### 1.3 使用流程

1. 建立 WebSocket 连接
2. 发送 `start_recording` 消息
3. 持续发送 `audio_chunk` 消息（音频数据需要 base64 编码）
4. 发送 `stop_recording` 消息结束录音
5. 接收识别结果

### 2. 实时语音活动检测 WebSocket

#### 2.1 连接地址
```
ws://localhost:8000/vad/ws/{client_id}
```

#### 2.2 消息格式

**客户端发送消息：**

1. **开始 VAD 检测**
```json
{
  "type": "start_vad"
}
```

2. **发送音频数据**
```json
{
  "type": "audio_chunk",
  "data": "base64编码的音频数据"
}
```

3. **停止 VAD 检测**
```json
{
  "type": "stop_vad"
}
```

**服务端返回消息：**

1. **VAD 检测结果**
```json
{
  "type": "vad_result",
  "segments": [
    [0, 2000],
    [5000, 8000]
  ],
  "is_final": false
}
```

## 三、音频格式要求

### 1. 流式识别
- **采样率**: 16kHz（会自动重采样）
- **格式**: WAV, MP3, FLAC, OGG
- **编码**: 支持 float32、int16、int32，自动归一化到 [-1, 1]

### 2. 文件识别
- **采样率**: 自动处理
- **格式**: WAV, MP3, MPEG, M4A, FLAC, OGG
- **大小**: 建议不超过 100MB

### 3. 音频块大小
- **推荐**: 600ms 音频块
- **上下文**: 使用 2.4秒 的历史上下文
- **缓冲**: 累积到 600ms 后进行处理

## 四、错误处理

所有 API 接口都遵循统一的错误响应格式：

```json
{
  "detail": "错误描述信息"
}
```

常见错误码：
- `400`: 请求参数错误
- `422`: 请求数据格式错误
- `503`: 服务不可用（通常是模型未加载）

## 五、使用示例

### 1. curl 调用示例

**健康检查：**
```bash
curl -X GET http://localhost:8000/health
```

**加载模型：**
```bash
curl -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "streaming_asr"}'
```

**离线识别：**
```bash
curl -X POST http://localhost:8000/offline/recognize \
  -F "file=@audio.wav"
```

**添加标点：**
```bash
curl -X POST http://localhost:8000/punctuation/add \
  -H "Content-Type: application/json" \
  -d '{"text": "你好世界今天天气不错"}'
```

### 2. JavaScript WebSocket 示例

```javascript
// 连接 WebSocket
const ws = new WebSocket('ws://localhost:8000/ws/test_client');

// 开始录音
ws.send(JSON.stringify({type: 'start_recording'}));

// 发送音频数据（假设 audioData 是录音获取的数据）
const base64Audio = btoa(String.fromCharCode(...audioData));
ws.send(JSON.stringify({
  type: 'audio_chunk',
  data: base64Audio
}));

// 接收结果
ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  if (message.type === 'final_result') {
    console.log('识别结果:', message.text);
  }
};

// 停止录音
ws.send(JSON.stringify({type: 'stop_recording'}));
```

## 六、性能建议

1. **模型预加载**: 启动时预加载需要的模型，避免首次请求延迟
2. **音频块大小**: 使用推荐的 600ms 音频块大小，平衡实时性和准确性
3. **批处理**: 离线识别时，合理设置 `batch_size_s` 参数
4. **并发控制**: WebSocket 连接数建议不超过系统 CPU 核心数的 2 倍

## 七、注意事项

1. 服务启动时默认不加载所有模型，需要手动加载
2. 实时识别需要持续的音频流，单次音频块不要过大
3. 模型加载需要一定时间，首次使用时请耐心等待
4. 建议在生产环境中使用专业的负载均衡器管理并发请求

## 八、测试工具

项目提供了完整的测试套件，位于 `curl_test/` 目录：

```bash
# 运行所有测试
./curl_test/run_all_tests.sh

# 运行单个测试
./curl_test/test_offline_asr.sh
./curl_test/test_punctuation.sh
./curl_test/test_vad.sh
```

这些测试脚本可以帮助你验证各个 API 接口是否正常工作。