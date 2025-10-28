"""WebSocket connection management for speech recognition API"""

import numpy as np
import json
import asyncio
import time
from typing import Dict, List, Optional
from fastapi import WebSocket
from .config import DTYPE, logger, CHUNK_STRIDE, CHUNK_SIZE
from .audio import decode_audio_chunk, process_audio_chunk, process_final_audio
from .model import get_model
from .models import ModelType

# 缓冲区超时时间(秒) - 0.5秒内没有新数据则自动处理缓冲区
BUFFER_TIMEOUT = 0.5
# 最小处理阈值 (50ms = 800样本) - 缓冲区至少要有这么多数据才处理
MIN_BUFFER_SIZE = 800


class ConnectionManager:
    """Manages WebSocket connections"""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_states: Dict[str, dict] = {}
        self.timeout_tasks: Dict[str, Optional[asyncio.Task]] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.connection_states[client_id] = {
            "audio_buffer": np.array([], dtype=DTYPE),
            "cache": {},
            "is_recording": False,
            "last_audio_time": time.time(),
        }
        self.timeout_tasks[client_id] = None
        logger.info(f"Client {client_id} connected")

    def disconnect(self, client_id: str):
        # 取消超时任务
        if client_id in self.timeout_tasks and self.timeout_tasks[client_id]:
            self.timeout_tasks[client_id].cancel()
            del self.timeout_tasks[client_id]

        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.connection_states:
            del self.connection_states[client_id]
        logger.info(f"Client {client_id} disconnected")

    async def send_message(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(json.dumps(message))

    def get_state(self, client_id: str):
        return self.connection_states.get(client_id)

    async def handle_start_recording(self, client_id: str):
        """Handle start recording message"""
        state = self.get_state(client_id)
        if state:
            state["is_recording"] = True
            state["audio_buffer"] = np.array([], dtype=DTYPE)
            state["cache"] = {}
            state["last_audio_time"] = time.time()

        await self.send_message(client_id, {"type": "status", "message": "Recording started"})

    async def handle_stop_recording(self, client_id: str):
        """Handle stop recording message"""
        state = self.get_state(client_id)
        if state:
            state["is_recording"] = False

        # 取消超时任务
        if client_id in self.timeout_tasks and self.timeout_tasks[client_id]:
            self.timeout_tasks[client_id].cancel()
            self.timeout_tasks[client_id] = None

        # Process remaining audio
        await self._process_final_audio(client_id)

        await self.send_message(client_id, {"type": "status", "message": "Recording stopped"})

    async def handle_audio_chunk(self, client_id: str, audio_data: str):
        """Handle audio chunk message"""
        state = self.get_state(client_id)
        if not state or not state["is_recording"]:
            return

        # Decode and process audio chunk
        audio_chunk = decode_audio_chunk(audio_data)
        if len(audio_chunk) > 0:
            await self._process_audio_chunk(client_id, audio_chunk)

    async def _process_audio_chunk(self, client_id: str, audio_chunk: np.ndarray):
        """Process audio chunk and send recognition result"""
        state = self.get_state(client_id)
        if not state:
            logger.warning(f"No state found for client {client_id}")
            return

        # Add to buffer
        state["audio_buffer"] = np.append(state["audio_buffer"], audio_chunk)
        state["last_audio_time"] = time.time()

        # 取消之前的超时任务
        if client_id in self.timeout_tasks and self.timeout_tasks[client_id]:
            self.timeout_tasks[client_id].cancel()

        # Process if we have enough data
        if len(state["audio_buffer"]) >= CHUNK_STRIDE:
            # Extract chunk
            speech_chunk = state["audio_buffer"][:CHUNK_STRIDE].copy()
            state["audio_buffer"] = state["audio_buffer"][CHUNK_STRIDE:]

            logger.info(f"Client {client_id}: Processing audio chunk, length: {len(speech_chunk)}")

            try:
                model = get_model()
                if not model:
                    logger.error("Streaming ASR model not loaded")
                    await self.send_message(
                        client_id,
                        {
                            "type": "error",
                            "message": "Streaming ASR model not loaded. Please load the model using POST /model/load with model_type='streaming_asr'",
                        },
                    )
                    return

                result_text = process_audio_chunk(model, speech_chunk, state["cache"], CHUNK_SIZE)

                if result_text:
                    await self.send_message(
                        client_id,
                        {
                            "type": "recognition_result",
                            "text": result_text,
                            "is_final": False,
                        },
                    )
                    logger.info(f"Client {client_id} recognized: {result_text}")

            except Exception as e:
                logger.error(f"Error processing audio for client {client_id}: {e}")
                await self.send_message(
                    client_id,
                    {"type": "error", "message": f"Processing error: {str(e)}"},
                )

        # 启动新的超时任务 (如果缓冲区还有数据且正在录音)
        if state["is_recording"] and len(state["audio_buffer"]) > 0:
            self.timeout_tasks[client_id] = asyncio.create_task(self._buffer_timeout_handler(client_id))

    async def _buffer_timeout_handler(self, client_id: str):
        """处理缓冲区超时 - 0.5秒内没有新数据则自动处理缓冲区"""
        try:
            await asyncio.sleep(BUFFER_TIMEOUT)

            state = self.get_state(client_id)
            if not state or not state["is_recording"]:
                return

            # 检查是否真的超时了 (0.5秒内没有新数据)
            time_since_last_audio = time.time() - state["last_audio_time"]
            if time_since_last_audio >= BUFFER_TIMEOUT:
                buffer_len = len(state["audio_buffer"])
                # 如果缓冲区有任何数据就处理
                if buffer_len > 0:
                    logger.info(f"Client {client_id}: Buffer timeout triggered, processing {buffer_len} samples")

                    try:
                        model = get_model()
                        if not model:
                            logger.error("Streaming ASR model not loaded")
                            return

                        # 处理缓冲区中的所有数据
                        result_text = process_audio_chunk(model, state["audio_buffer"], state["cache"], CHUNK_SIZE)

                        # 清空缓冲区
                        state["audio_buffer"] = np.array([], dtype=DTYPE)

                        if result_text:
                            await self.send_message(
                                client_id,
                                {
                                    "type": "recognition_result",
                                    "text": result_text,
                                    "is_final": False,
                                },
                            )
                            logger.info(f"Client {client_id} timeout result: {result_text}")

                    except Exception as e:
                        logger.error(f"Error processing buffer timeout for client {client_id}: {e}")

        except asyncio.CancelledError:
            # 任务被取消是正常的,因为有新数据到来
            pass
        except Exception as e:
            logger.error(f"Error in buffer timeout handler for client {client_id}: {e}")

    async def _process_final_audio(self, client_id: str):
        """Process remaining audio buffer when recording stops"""
        state = self.get_state(client_id)
        if not state or len(state["audio_buffer"]) == 0:
            return

        try:
            model = get_model()
            if not model:
                logger.error("Streaming ASR model not loaded")
                await self.send_message(
                    client_id,
                    {
                        "type": "error",
                        "message": "Streaming ASR model not loaded. Please load the model using POST /model/load with model_type='streaming_asr'",
                    },
                )
                return

            result_text = process_final_audio(model, state["audio_buffer"], state["cache"], CHUNK_SIZE)

            if result_text:
                await self.send_message(
                    client_id,
                    {
                        "type": "recognition_result",
                        "text": result_text,
                        "is_final": True,
                    },
                )
                logger.info(f"Client {client_id} final result: {result_text}")

            # Clear buffer
            state["audio_buffer"] = np.array([], dtype=DTYPE)
            state["cache"] = {}

        except Exception as e:
            logger.error(f"Error processing final audio for client {client_id}: {e}")
            await self.send_message(
                client_id,
                {"type": "error", "message": f"Final processing error: {str(e)}"},
            )


# Global connection manager instance
manager = ConnectionManager()
