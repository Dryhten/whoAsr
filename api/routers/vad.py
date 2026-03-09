"""VAD (Voice Activity Detection) API routes"""

import os
import tempfile
import uuid
import base64
from typing import List, Optional
import numpy as np
import soundfile as sf
import json
from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from ..core.model import get_vad_model, is_vad_model_loaded
from ..core.models import ModelType, get_model_config
from ..core.schemas import ProcessingResponse
from ..core.file_utils import cleanup_temp_files
from ..core.model_utils import process_model_request
from ..core.config import logger
from ..core.audio import decode_audio_chunk

# Temporary directory for file uploads
TEMP_DIR = tempfile.gettempdir()

router = APIRouter(prefix="/vad", tags=["VAD"])


class VADResponse(BaseModel):
    success: bool
    message: str
    segments: Optional[List[List[int]]] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None


class VADStreamSegment(BaseModel):
    """WebSocket message for VAD streaming segment"""

    type: str = "vad_segment"
    segments: List[List[int]]
    is_final: bool = False


def extract_vad_results(model_output: List) -> List[List[int]]:
    """Extract VAD segments from model output"""
    results = []
    if not model_output:
        return results

    for item in model_output:
        if isinstance(item, list) and len(item) >= 2:
            start_time = int(item[0]) if item[0] is not None else 0
            end_time = int(item[1]) if item[1] is not None else 0
            results.append([start_time, end_time])
        elif isinstance(item, dict) and "start" in item and "end" in item:
            results.append([int(item["start"]), int(item["end"])])

    return results


@router.post("/detect", response_model=VADResponse)
async def detect_voice_activity(file: UploadFile = File(...)):
    """Upload audio file and detect voice activity"""
    # Check file type
    if not file.filename.lower().endswith((".wav", ".mp3", ".m4a", ".flac", ".ogg")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload WAV, MP3, M4A, FLAC, or OGG files.",
        )

    # Check if VAD model is loaded
    if not is_vad_model_loaded():
        raise HTTPException(
            status_code=503,
            detail="VAD model not loaded. Please load the VAD model using POST /model/load with model_type='vad'",
        )

    temp_file_path = None
    try:
        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1]
        temp_filename = f"{file_id}{file_extension}"
        temp_file_path = os.path.join(TEMP_DIR, temp_filename)

        # Save uploaded file
        content = await file.read()
        with open(temp_file_path, "wb") as buffer:
            buffer.write(content)

        # Process VAD
        model = get_vad_model()
        if model is None:
            raise HTTPException(status_code=503, detail="VAD model not available")

        config = get_model_config(ModelType.VAD)
        vad_params = {
            k: config.config[k]
            for k in ("max_end_silence_time", "speech_to_sil_time_thres")
            if config and k in config.config
        }

        logger.info(f"Processing VAD for uploaded file: {file.filename}")
        model_output = await run_in_threadpool(
            model.generate,
            input=temp_file_path,
            disable_pbar=True,
            **vad_params,
        )

        # Extract segments from FunASR VAD output format
        segments = []
        if model_output and len(model_output) > 0:
            # FunASR VAD returns list of dicts, where each dict has 'key' and 'value'
            # We need to collect all the 'value' parts from all the dicts
            all_segments = []
            for result in model_output:
                if isinstance(result, dict) and "value" in result:
                    value = result["value"]
                    # The value itself should be a list of segments
                    if isinstance(value, list):
                        for segment in value:
                            if isinstance(segment, list) and len(segment) >= 2:
                                # Ensure segment contains valid integer timestamps
                                if all(isinstance(x, int) for x in segment):
                                    all_segments.append(segment)
                elif isinstance(result, list):
                    # If result is directly a list of segments
                    for segment in result:
                        if isinstance(segment, list) and len(segment) >= 2:
                            if all(isinstance(x, int) for x in segment):
                                all_segments.append(segment)

            segments = all_segments
            logger.info(f"VAD detected {len(segments)} segments")

        logger.info(f"VAD detection completed, found {len(segments)} segments")

        return VADResponse(
            success=True,
            message="VAD detection completed successfully",
            segments=segments,
            file_name=file.filename,
            file_size=len(content),
        )

    except Exception as e:
        logger.error(f"Error in VAD detection: {e}")
        raise HTTPException(status_code=500, detail=f"VAD processing failed: {str(e)}")

    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass


# WebSocket for real-time VAD
from fastapi import WebSocket, WebSocketDisconnect
import base64


class VADConnectionManager:
    """Manages WebSocket connections for real-time VAD"""

    def __init__(self):
        self.active_connections: dict = {}
        self.connection_states: dict = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.connection_states[client_id] = {
            "cache": {},
            "segment_buffer": [],
            "audio_buffer": np.array([], dtype=np.float32),
            "stream_offset_ms": 0,
        }
        logger.info(f"VAD client {client_id} connected")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.connection_states:
            del self.connection_states[client_id]
        logger.info(f"VAD client {client_id} disconnected")

    async def send_message(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(json.dumps(message))

    def get_state(self, client_id: str):
        return self.connection_states.get(client_id)


vad_manager = VADConnectionManager()


@router.websocket("/ws/{client_id}")
async def websocket_vad_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time VAD"""
    if not is_vad_model_loaded():
        await websocket.close(code=1013, reason="VAD model not loaded")
        return

    await vad_manager.connect(websocket, client_id)

    try:
        model = get_vad_model()
        config = get_model_config(ModelType.VAD)
        chunk_size_ms = config.config.get("chunk_size", 200) if config else 200
        sample_rate = config.config.get("sample_rate", 16000) if config else 16000
        chunk_stride = int(
            chunk_size_ms * sample_rate / 1000
        )  # 3200 samples for 200ms at 16kHz
        vad_params = (
            {
                k: config.config[k]
                for k in ("max_end_silence_time", "speech_to_sil_time_thres")
                if k in config.config
            }
            if config
            else {}
        )

        while True:
            # Receive message
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "start_vad":
                # Reset connection state
                state = vad_manager.get_state(client_id)
                if state:
                    state["cache"] = {}
                    state["segment_buffer"] = []
                    state["audio_buffer"] = np.array([], dtype=np.float32)
                    state["stream_offset_ms"] = 0

                await vad_manager.send_message(
                    client_id, {"type": "status", "message": "VAD started"}
                )

            elif message.get("type") == "stop_vad":
                # 处理剩余 buffer，使用 is_final=True 并复用 cache（真正流式）
                state = vad_manager.get_state(client_id)
                if state and len(state["audio_buffer"]) > 0:
                    remaining = state["audio_buffer"]
                    offset_ms = state.get("stream_offset_ms", 0)
                    final_model_output = await run_in_threadpool(
                        model.generate,
                        input=remaining,
                        cache=state["cache"],
                        is_final=True,
                        chunk_size=chunk_size_ms,
                        disable_pbar=True,
                        **vad_params,
                    )

                    # 仅在有 value 内容时发送
                    if (
                        final_model_output
                        and len(final_model_output) > 0
                        and isinstance(final_model_output[0], dict)
                        and "value" in final_model_output[0]
                        and len(final_model_output[0].get("value") or []) > 0
                    ):
                        await vad_manager.send_message(
                            client_id,
                            {"type": "vad_result", "raw": final_model_output, "is_final": True},
                        )

                await vad_manager.send_message(
                    client_id, {"type": "status", "message": "VAD stopped"}
                )

            elif message.get("type") == "audio_chunk":
                # Process audio chunk
                audio_data = message.get("data", "")
                state = vad_manager.get_state(client_id)

                if not state:
                    continue

                # Decode audio
                audio_chunk = decode_audio_chunk(audio_data)
                if len(audio_chunk) == 0:
                    continue

                # Add to buffer
                state["audio_buffer"] = np.append(state["audio_buffer"], audio_chunk)

                # 按 chunk 流式处理，维护 cache
                while len(state["audio_buffer"]) >= chunk_stride:
                    speech_chunk = state["audio_buffer"][:chunk_stride].copy()
                    state["audio_buffer"] = state["audio_buffer"][chunk_stride:]
                    state["stream_offset_ms"] = state.get("stream_offset_ms", 0) + chunk_size_ms
                    try:
                        model_output = await run_in_threadpool(
                            model.generate,
                            input=speech_chunk,
                            cache=state["cache"],
                            is_final=False,
                            chunk_size=chunk_size_ms,
                            disable_pbar=True,
                            **vad_params,
                        )

                        # 仅在有 value 内容时发送，与 demo 一致
                        if (
                            model_output
                            and len(model_output) > 0
                            and isinstance(model_output[0], dict)
                            and "value" in model_output[0]
                            and len(model_output[0].get("value") or []) > 0
                        ):
                            await vad_manager.send_message(
                                client_id,
                                {"type": "vad_result", "raw": model_output, "is_final": False},
                            )

                    except Exception as e:
                        logger.error(
                            f"Error processing VAD for client {client_id}: {e}"
                        )
                        await vad_manager.send_message(
                            client_id,
                            {
                                "type": "error",
                                "message": f"VAD processing error: {str(e)}",
                            },
                        )

            elif message.get("type") == "ping":
                await vad_manager.send_message(client_id, {"type": "pong"})

    except WebSocketDisconnect:
        vad_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        vad_manager.disconnect(client_id)
