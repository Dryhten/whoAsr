# whoAsr API 上下文工程最佳实践指南

## 概述

本文档基于上下文工程（Context Engineering）最佳实践，为开发者提供如何有效使用 whoAsR API 的详细指导。上下文工程是通过优化输入上下文来最大化AI/语言模型性能的方法论。

## 核心原则

### 1. 上下文完整性原则
- **提供完整的上下文信息**：确保每次请求都包含模型理解所需的全部信息
- **避免分片上下文**：不要将一个完整的会话或任务拆分成多个独立的请求
- **保持上下文连贯性**：在连续的请求中保持必要的上下文信息

### 2. 音频上下文优化
- **保持音频片段连续性**：实时语音识别时，确保音频片段的连续性和时序性
- **提供足够的音频上下文**：每个音频片段应包含足够的信息（建议600ms）
- **处理边界情况**：正确处理音频片段的开始和结束

### 3. 文本上下文工程
- **利用标点模型优化可读性**：使用 `/punctuation/add` 端点为识别结果添加标点
- **保持语义完整性**：确保文本断点不会破坏语义结构
- **上下文信息传递**：在需要时提供历史对话信息

## API 使用最佳实践

### 实时语音识别（WebSocket）

#### 建议的WebSocket连接模式

```python
import asyncio
import websockets
import json
import base64

async def streaming_asr_example():
    """
    实时语音识别的最佳实践示例
    """
    uri = "ws://localhost:8000/ws/your_client_id"

    async with websockets.connect(uri) as websocket:
        # 1. 初始化会话上下文
        session_context = {
            "session_id": "unique_session_id",
            "language": "zh-CN",
            "user_info": {
                "id": "user123",
                "preferences": {
                    "punctuation": True,
                    "timestamp": False
                }
            }
        }

        # 2. 发送初始上下文（如果支持）
        await websocket.send(json.dumps({
            "type": "init",
            "context": session_context
        }))

        # 3. 流式发送音频数据
        for audio_chunk in audio_stream:
            # 保持音频连续性
            audio_data = base64.b64encode(audio_chunk).decode()

            # 添加必要的元数据
            message = {
                "audio": audio_data,
                "timestamp": get_current_timestamp(),
                "sequence_id": get_sequence_id()
            }

            await websocket.send(json.dumps(message))

            # 接收识别结果
            result = await websocket.recv()
            process_recognition_result(result)
```

#### 关键优化点

1. **音频缓冲管理**
   ```bash
   # 测试实时语音识别
   curl -X GET "http://localhost:8000/model/info" \
     -H "Content-Type: application/json" \
     | jq '.services.streaming_asr'
   ```

2. **模型预热策略**
   ```bash
   # 预加载模型以获得最佳性能
   curl -X POST "http://localhost:8000/model/load" \
     -H "Content-Type: application/json" \
     -d '{"model_type": "streaming_asr"}'
   ```

### 离线语音识别

#### 批处理优化策略

```bash
# 最佳实践：使用适当的批次大小
curl -X POST "http://localhost:8000/offline/recognize" \
  -F "file=@audio.wav" \
  -F "batch_size_s=300" \
  -F "batch_size_threshold_s=60" \
  -F "hotword=关键词1,关键词2"
```

#### 上下文增强技巧

1. **提供热词列表**
   - 包含专业术语、人名、地名等
   - 提高特定领域识别准确率

2. **后处理流水线**
   ```python
   # 完整的后处理流水线
   def post_process_asr_result(raw_text):
       # 1. 添加标点
       punctuated = add_punctuation(raw_text)

       # 2. 语音活动检测（如需要）
       vad_segments = detect_voice_activity(audio)

       # 3. 时间戳对齐
       timestamped = align_timestamps(punctuated, vad_segments)

       return timestamped
   ```

### 语音活动检测（VAD）

#### 上下文感知的VAD使用

```python
async def vad_with_context():
    """
    带上下文信息的VAD检测
    """
    # 预加载VAD模型
    await load_vad_model()

    # 提供检测上下文
    vad_context = {
        "noise_threshold": 0.5,
        "speech_threshold": 0.6,
        "min_speech_duration_ms": 250,
        "min_silence_duration_ms": 100,
        "padding_duration_ms": 100
    }

    # 执行检测
    segments = await detect_voice_activity(
        audio_data,
        context=vad_context
    )

    return segments
```

#### VAD结果优化

```bash
# 测试VAD性能
curl -X POST "http://localhost:8000/vad/detect" \
  -F "file=@audio.wav" \
  | jq '.segments'
```

### 标点恢复

#### 上下文增强的标点恢复

```bash
# 使用完整的上下文进行标点恢复
curl -X POST "http://localhost:8000/punctuation/add" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "大家好我是张三今天很高兴能够在这里向大家介绍我们的新产品",
    "context": {
      "domain": "product_presentation",
      "style": "formal",
      "language": "zh-CN"
    }
  }'
```

#### 标点恢复最佳实践

1. **批量处理优化**
   ```python
   def batch_punctuation_recovery(texts):
       """批量标点恢复，提高效率"""
       results = []
       for text in texts:
           result = add_punctuation(text)
           results.append(result)
       return results
   ```

2. **领域自适应**
   - 根据不同领域调整标点策略
   - 考虑对话场景的特殊性

### 时间戳预测

#### 精确时间戳生成

```bash
# 生成精确的时间戳
curl -X POST "http://localhost:8000/timestamp/predict" \
  -F "audio_file=@audio.wav" \
  -F "text_content=识别后的文本内容" \
  | jq '.timestamps'
```

#### 时间戳优化策略

1. **对齐优化**
   - 确保时间戳与实际语音严格对齐
   - 处理静音段和过渡段

2. **精度控制**
   - 根据应用场景调整时间戳精度
   - 平衡精度和性能

## 高级上下文工程技巧

### 1. 多模态上下文融合

```python
class MultimodalContextManager:
    """多模态上下文管理器"""

    def __init__(self):
        self.audio_context = AudioContext()
        self.text_context = TextContext()
        self.speaker_context = SpeakerContext()

    def process_with_context(self, audio, text_history, speaker_info):
        # 融合多种上下文信息
        enriched_context = self.fuse_contexts(
            audio, text_history, speaker_info
        )
        return enriched_context
```

### 2. 动态上下文调整

```python
class DynamicContextOptimizer:
    """动态上下文优化器"""

    def __init__(self):
        self.performance_metrics = PerformanceMetrics()
        self.context_buffer = ContextBuffer()

    def optimize_context_size(self, current_performance):
        """根据性能动态调整上下文大小"""
        if current_performance.latency > threshold:
            self.reduce_context_size()
        elif current_performance.accuracy < target:
            self.increase_context_size()
```

### 3. 错误恢复策略

```python
class ContextRecoveryManager:
    """上下文恢复管理器"""

    def handle_context_loss(self, last_known_context):
        """处理上下文丢失"""
        # 1. 尝试从缓存恢复
        cached_context = self.get_cached_context()

        # 2. 使用最小上下文继续
        minimal_context = self.create_minimal_context()

        # 3. 请求用户澄清（如果必要）
        if not self.can_recover_automatically():
            self.request_clarification()
```

## 性能优化指南

### 1. 模型加载策略

```bash
# 并行加载多个模型
curl -X POST "http://localhost:8000/model/load" \
  -H "Content-Type: application/json" \
  -d '{"model_type": "streaming_asr"}' &

curl -X POST "http://localhost:8000/model/load" \
  -H "Content-Type: application/json" \
  -d '{"model_type": "punctuation"}' &

wait  # 等待所有模型加载完成
```

### 2. 内存优化

```python
# 监控内存使用
def monitor_memory_usage():
    status = get_model_status()
    memory_info = status['system']

    if memory_info['memory_usage_percent'] > 80:
        # 触发内存清理
        cleanup_unused_models()
```

### 3. 并发控制

```python
import asyncio
from asyncio import Semaphore

class ConcurrentRequestManager:
    def __init__(self, max_concurrent=10):
        self.semaphore = Semaphore(max_concurrent)

    async def process_request(self, request):
        async with self.semaphore:
            return await self.handle_request(request)
```

## 监控和调试

### 1. 健康检查

```bash
# 定期检查服务状态
curl -X GET "http://localhost:8000/health" | jq '{
  status: .status,
  loaded_models: [.services[] | select(.loaded == true) | .display_name],
  memory_usage: .system.memory_usage_percent,
  timestamp: .timestamp
}'
```

### 2. 性能监控

```python
class PerformanceMonitor:
    def __init__(self):
        self.metrics = {
            'latency': [],
            'accuracy': [],
            'throughput': []
        }

    def record_metrics(self, latency, accuracy, throughput):
        self.metrics['latency'].append(latency)
        self.metrics['accuracy'].append(accuracy)
        self.metrics['throughput'].append(throughput)

        # 计算平均值
        avg_latency = sum(self.metrics['latency']) / len(self.metrics['latency'])
        return avg_latency
```

### 3. 错误追踪

```python
import logging

logger = logging.getLogger(__name__)

class ErrorHandler:
    @staticmethod
    def handle_api_error(error):
        logger.error(f"API Error: {error}", exc_info=True)

        # 根据错误类型提供恢复建议
        if error.status_code == 503:
            return "Service unavailable, retry after delay"
        elif error.status_code == 429:
            return "Rate limit exceeded, implement backoff"
        else:
            return "Unknown error, check logs"
```

## 测试和验证

### 1. 使用提供的测试脚本

```bash
# 运行完整的测试套件
./curl_test/run_all_tests.sh

# 测试特定功能
./curl_test/test_offline_asr.sh
./curl_test/test_punctuation.sh
./curl_test/test_vad.sh
```

### 2. 自定义测试场景

```python
def test_context_quality():
    """测试上下文质量"""
    test_cases = [
        {
            "input": "无标点的中文文本",
            "expected_output": "添加标点后的文本",
            "context": {"domain": "general"}
        }
    ]

    for case in test_cases:
        result = process_with_context(case["input"], case["context"])
        assert result["accuracy"] > 0.95
```

## 常见问题和解决方案

### Q1: 如何处理长音频文件的上下文？

**A**: 使用分块处理策略：
```python
def process_long_audio(audio_file, chunk_duration=30):
    """处理长音频文件"""
    chunks = split_audio(audio_file, chunk_duration)
    results = []

    for i, chunk in enumerate(chunks):
        # 保持上下文连续性
        if i > 0:
            context = {"previous_chunk": results[-1]}
        else:
            context = {"initial": True}

        result = process_audio_chunk(chunk, context)
        results.append(result)

    return merge_results(results)
```

### Q2: 如何优化多语言场景？

**A**: 实现语言检测和切换：
```python
def multilingual_processing(audio):
    # 1. 语言检测
    language = detect_language(audio)

    # 2. 加载对应模型
    model = load_language_model(language)

    # 3. 处理音频
    result = model.process(audio)

    return result
```

### Q3: 如何处理网络中断？

**A**: 实现重试和恢复机制：
```python
import tenacity

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=4, max=10)
)
async def robust_api_call(endpoint, data):
    """带重试的API调用"""
    return await call_api(endpoint, data)
```

## 总结

上下文工程是优化AI系统性能的关键。通过遵循本指南的最佳实践，您可以：

1. **最大化识别准确率**：通过提供完整和相关的上下文
2. **优化系统性能**：通过动态调整上下文大小和并发控制
3. **提高用户体验**：通过快速错误恢复和智能重试
4. **降低运营成本**：通过高效的资源利用和批处理优化

记住，上下文工程是一个持续优化的过程。定期审查和调整您的策略以适应不断变化的需求。

## 参考资料

- [FunASR官方文档](https://github.com/modelscope/FunASR)
- [WebSocket实时通信最佳实践](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [API测试脚本](../curl_test/README.md)

---

*最后更新：2025-10-04*
*版本：1.0.0*