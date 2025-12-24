# WhoAsr 并发与多租户能力分析报告

## 1. 现状分析

经过对代码库的深入分析，特别是 `api/routers/offline.py`, `api/routers/websocket.py`, `api/core/model.py` 和 `api/core/audio.py`，我们发现目前的实现存在严重的并发瓶颈，**不适合**直接作为高并发的多租户公共服务。

### 1.1 核心问题：同步阻塞调用

虽然 FastAPI 应用使用了 `async def` 定义路由处理函数，但在关键的模型推理环节，代码直接在主线程（事件循环线程）中调用了同步的阻塞函数。

*   **离线识别 (`/offline/recognize`)**:
    *   路由处理函数 `recognize_audio_file` 是 `async` 的。
    *   但在内部直接调用了 `run_offline_recognition`。
    *   `run_offline_recognition` 调用了 `model.generate(**kwargs)`。
    *   `model.generate` 是一个计算密集型的同步操作（CPU/GPU 密集）。
    *   **后果**: 当一个用户上传文件进行识别时，整个服务的事件循环会被阻塞。在此期间，服务无法响应任何其他请求（包括健康检查、其他用户的 WebSocket 连接等）。如果识别一个长音频需要 10 秒，服务就会“假死” 10 秒。

*   **流式识别 (WebSocket)**:
    *   WebSocket 处理流程中，`handle_audio_chunk` 最终调用了 `process_audio_chunk`。
    *   `process_audio_chunk` 同样直接调用了同步的 `model.generate`。
    *   **后果**: 虽然处理的是短音频块，但每次推理都会短暂阻塞事件循环。当并发用户增加时，这些微小的阻塞会累积，导致严重的延迟抖动（Jitter），影响实时性。

### 1.2 多租户与资源共享

*   **全局模型实例**:
    *   在 `api/core/model.py` 中，模型实例存储在全局变量 `model_instances` 中。
    *   所有请求共享同一个模型实例。
    *   如果底层推理引擎（FunASR）内部包含状态且非线程安全，并发请求可能会导致状态混乱或崩溃。
    *   即使是线程安全的，由于 Python GIL（全局解释器锁）和上述的同步调用问题，请求实际上是被串行处理的。

## 2. 改进建议

为了将 WhoAsr 打造为可靠的多租户公共服务，必须进行架构升级。

### 2.1 短期改进（解决阻塞）

1.  **使用线程池执行推理**:
    *   利用 FastAPI 的 `run_in_threadpool` 或 Python 的 `asyncio.get_event_loop().run_in_executor` 将阻塞的 `model.generate` 调用放入线程池中执行。
    *   这将释放主事件循环，使其能够继续处理其他 I/O 操作（如接收新的 HTTP 请求或 WebSocket 数据包）。

    ```python
    from fastapi.concurrency import run_in_threadpool

    # 修改前
    # result = model.generate(**kwargs)

    # 修改后
    # result = await run_in_threadpool(model.generate, **kwargs)
    ```

### 2.2 中期架构优化（提升吞吐量）

1.  **任务队列（针对离线识别）**:
    *   对于 `/offline/recognize`，不应在 HTTP 请求中同步等待结果。
    *   引入任务队列（如 Celery + Redis）。
    *   流程：用户上传 -> 服务端接收并存入队列 -> 立即返回 Task ID -> 后台 Worker 进程处理 -> 用户轮询或通过 Webhook 获取结果。

2.  **多进程 Worker**:
    *   Python 的多线程受限于 GIL，无法充分利用多核 CPU 进行计算密集型任务。
    *   生产环境部署应使用 Gunicorn 管理多个 Uvicorn Worker 进程，或者使用专门的模型推理服务（如 Triton Inference Server）将推理与业务逻辑分离。

### 2.3 长期规划（多租户隔离）

1.  **资源配额与限流**:
    *   实现基于 API Key 的速率限制（Rate Limiting）。
    *   限制每个租户的并发连接数和每日调用量。

2.  **动态模型加载/卸载**:
    *   如果支持多种模型，需要根据负载动态管理内存中的模型实例，避免内存溢出。

## 3. 结论

目前的实现是**同步阻塞**的，无法满足多租户高并发场景的需求。

**建议立即采取行动**:
首先实施“短期改进”，将所有 `model.generate` 调用包装在 `run_in_threadpool` 中。这将显著改善服务的响应能力，防止单个长任务卡死整个服务。
