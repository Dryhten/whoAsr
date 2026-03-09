"""WebSocket: 实时 VAD 切分 + FunASR-Nano 离线识别，实现基于 Nano 的准实时 ASR"""

import json
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool

from ..core.model import (
    get_vad_model,
    is_vad_model_loaded,
    is_offline_model_loaded,
    run_offline_recognition,
)
from ..core.models import ModelType, get_model_config
from ..core.config import logger
from ..core.audio import decode_audio_chunk
from ..core.file_utils import write_float32_to_temp_wav, cleanup_temp_file
from ..core.text_utils import chinese_numbers_to_arabic

# 最小句长（秒），短于此不送识别
MIN_UTTERANCE_DURATION_S = 0.3


def _parse_vad_segments(segments: list) -> tuple[bool, bool]:
    """解析 VAD 片段：[start,-1]=语音开始，[-1,end]=语音结束。返回 (has_speech_start, has_speech_end)"""
    has_start = False
    has_end = False
    for seg in segments or []:
        if not isinstance(seg, (list, tuple)) or len(seg) < 2:
            continue
        a, b = int(seg[0]) if seg[0] is not None else -1, int(seg[1]) if seg[1] is not None else -1
        if a >= 0 and b == -1:
            has_start = True
        elif a == -1 and b >= 0:
            has_end = True
    return has_start, has_end


def _extract_text_from_offline_result(result) -> str:
    """从 run_offline_recognition 返回值中提取文本，兼容 FunASR-Nano / paraformer 等多种格式"""
    if result is None:
        return ""

    if isinstance(result, str):
        return result.strip()

    def _from_obj(obj) -> str | None:
        if obj is None:
            return None
        if isinstance(obj, str):
            return obj.strip() or None
        if isinstance(obj, dict):
            t = obj.get("text") or obj.get("result")
            return _from_obj(t) if t is not None else None
        if isinstance(obj, (list, tuple)) and len(obj) > 0:
            return _from_obj(obj[0])
        return None

    if isinstance(result, dict):
        out = _from_obj(result)
        if out is not None:
            return out

    if isinstance(result, (list, tuple)) and len(result) > 0:
        out = _from_obj(result[0])
        if out is not None:
            return out

    logger.debug(
        f"RealtimeNano: no text in result type={type(result).__name__} len={len(result) if hasattr(result, '__len__') else 'n/a'}"
    )
    return ""


class RealtimeNanoManager:
    def __init__(self):
        self.active_connections: dict = {}
        self.connection_states: dict = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.connection_states[client_id] = {
            "audio_buffer": np.array([], dtype=np.float32),
            "cache": {},
            "current_utterance_buffer": np.array([], dtype=np.float32),
            "in_speech": False,  # 是否处于活跃语音片段内（收到 [start,-1] 后、[-1,end] 前）
            "pending_flush": False,  # 收到 [-1,end] 后待 flush，若下一 chunk 有 [start,-1] 则视为连续不 flush
        }
        logger.info(f"RealtimeNano client {client_id} connected")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.connection_states:
            del self.connection_states[client_id]
        logger.info(f"RealtimeNano client {client_id} disconnected")

    async def send_message(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(json.dumps(message))

    def get_state(self, client_id: str):
        return self.connection_states.get(client_id)


realtime_nano_manager = RealtimeNanoManager()


async def _flush_utterance_to_asr(client_id: str, state: dict, sample_rate: int):
    """将 current_utterance_buffer 写入临时 WAV，调用离线识别，推送结果并清空缓冲"""
    buf = state.get("current_utterance_buffer")
    if buf is None or len(buf) == 0:
        return
    duration_s = len(buf) / sample_rate
    if duration_s < MIN_UTTERANCE_DURATION_S:
        state["current_utterance_buffer"] = np.array([], dtype=np.float32)
        return
    temp_path = None
    try:
        temp_path = write_float32_to_temp_wav(buf, sample_rate)
        result = await run_offline_recognition(file_path=str(temp_path))
        text = _extract_text_from_offline_result(result)
        text = chinese_numbers_to_arabic(text)
        await realtime_nano_manager.send_message(
            client_id,
            {"type": "recognition_result", "text": text or "", "is_final": False},
        )
        if text:
            logger.info(f"RealtimeNano client {client_id} recognized: {text[:80]}...")
        else:
            logger.debug(f"RealtimeNano client {client_id} flush returned empty text, raw result type={type(result)}")
    except Exception as e:
        logger.error(f"RealtimeNano flush ASR error for {client_id}: {e}")
        await realtime_nano_manager.send_message(
            client_id,
            {"type": "error", "message": f"识别失败: {str(e)}"},
        )
    finally:
        if temp_path is not None:
            cleanup_temp_file(temp_path)
    state["current_utterance_buffer"] = np.array([], dtype=np.float32)


router = APIRouter(prefix="/realtime-nano", tags=["realtime-nano"])


@router.websocket("/ws/{client_id}")
async def websocket_realtime_nano_endpoint(websocket: WebSocket, client_id: str):
    """实时 VAD 切分 + FunASR-Nano 离线识别，按句推送文本"""
    if not is_vad_model_loaded():
        await websocket.close(code=1013, reason="VAD model not loaded")
        return
    if not is_offline_model_loaded():
        await websocket.close(code=1013, reason="Offline ASR model not loaded")
        return

    await realtime_nano_manager.connect(websocket, client_id)
    vad_model = get_vad_model()
    config = get_model_config(ModelType.VAD)
    chunk_size_ms = config.config.get("chunk_size", 200)
    sample_rate = config.config.get("sample_rate", 16000)
    chunk_stride = int(chunk_size_ms * sample_rate / 1000)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            state = realtime_nano_manager.get_state(client_id)
            if not state:
                continue

            if message.get("type") == "start_vad" or message.get("type") == "start":
                state["audio_buffer"] = np.array([], dtype=np.float32)
                state["cache"] = {}
                state["current_utterance_buffer"] = np.array([], dtype=np.float32)
                state["in_speech"] = False
                state["pending_flush"] = False
                await realtime_nano_manager.send_message(
                    client_id, {"type": "status", "message": "VAD started"}
                )

            elif message.get("type") == "stop_vad" or message.get("type") == "stop":
                await _flush_utterance_to_asr(client_id, state, sample_rate)
                await realtime_nano_manager.send_message(
                    client_id, {"type": "status", "message": "VAD stopped"}
                )

            elif message.get("type") == "audio_chunk":
                audio_data = message.get("data", "")
                audio_chunk = decode_audio_chunk(audio_data)
                if len(audio_chunk) == 0:
                    continue
                state["audio_buffer"] = np.append(state["audio_buffer"], audio_chunk)

                while len(state["audio_buffer"]) >= chunk_stride:
                    speech_chunk = state["audio_buffer"][:chunk_stride].copy()
                    state["audio_buffer"] = state["audio_buffer"][chunk_stride:]
                    try:
                        model_output = await run_in_threadpool(
                            vad_model.generate,
                            input=speech_chunk,
                            cache=state["cache"],
                            is_final=False,
                            chunk_size=chunk_size_ms,
                        )
                        segments = []
                        if model_output and len(model_output) > 0:
                            first_result = model_output[0]
                            if isinstance(first_result, dict) and "value" in first_result:
                                val = first_result["value"]
                                if isinstance(val, list) and len(val) > 0:
                                    segments = val
                                    # 与 VAD 路由一致：推送 vad_result 供前端流式渲染
                                    await realtime_nano_manager.send_message(
                                        client_id,
                                        {"type": "vad_result", "raw": model_output, "is_final": False},
                                    )

                        has_speech_start, has_speech_end = _parse_vad_segments(segments)

                        # 结束后马上开始：若 pending_flush 且本 chunk 有 [start,-1]，视为连续语音不 flush
                        if state.get("pending_flush"):
                            if has_speech_start:
                                state["pending_flush"] = False
                                state["in_speech"] = True
                            else:
                                await _flush_utterance_to_asr(client_id, state, sample_rate)
                                state["pending_flush"] = False

                        if has_speech_start:
                            state["in_speech"] = True
                        if has_speech_end:
                            state["in_speech"] = False
                            state["pending_flush"] = True

                        # 处于活跃语音片段内则累积；收到 [-1,end] 表示片段结束，先累积（flush 延到下一 chunk 判断）
                        if state["in_speech"] or has_speech_end:
                            state["current_utterance_buffer"] = np.append(
                                state["current_utterance_buffer"], speech_chunk
                            )
                    except Exception as e:
                        logger.error(
                            f"RealtimeNano VAD error for client {client_id}: {e}"
                        )
                        await realtime_nano_manager.send_message(
                            client_id,
                            {"type": "error", "message": f"VAD 错误: {str(e)}"},
                        )

            elif message.get("type") == "ping":
                await realtime_nano_manager.send_message(
                    client_id, {"type": "pong"}
                )

    except WebSocketDisconnect:
        realtime_nano_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"RealtimeNano WebSocket error for client {client_id}: {e}")
        realtime_nano_manager.disconnect(client_id)
