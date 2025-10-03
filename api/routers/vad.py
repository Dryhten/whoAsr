"""VAD (Voice Activity Detection) API routes"""

import os
import tempfile
import uuid
from typing import List, Optional
import numpy as np
import soundfile as sf
import json
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from ..core.model import get_vad_model, is_vad_model_loaded
from ..core.models import ModelType, get_model_config
from ..core.schemas import ProcessingResponse
from ..core.file_utils import (
    generate_unique_id, validate_audio_file, save_upload_file,
    cleanup_temp_files, validate_file_exists
)
from ..core.model_utils import process_model_request
from ..core.config import logger

# Temporary directory for file uploads
TEMP_DIR = tempfile.gettempdir()

router = APIRouter(prefix="/vad", tags=["VAD"])


class VADResponse(BaseModel):
    success: bool
    message: str
    segments: Optional[List[List[int]]] = None
    file_path: Optional[str] = None


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
        elif isinstance(item, dict) and 'start' in item and 'end' in item:
            results.append([int(item['start']), int(item['end'])])

    return results


@router.post("/upload", response_model=VADResponse)
async def upload_audio_file(file: UploadFile = File(...)):
    """Upload audio file for VAD processing"""
    validate_audio_file(file.filename)
    file_path = save_upload_file(file, generate_unique_id())
    logger.info(f"Audio file uploaded: {file.filename} -> {file_path}")

    return VADResponse(
        success=True,
        message="File uploaded successfully",
        file_path=str(file_path)
    )


@router.post("/detect", response_model=VADResponse)
async def detect_voice_activity(request: dict):
    """Detect voice activity in uploaded audio file (offline VAD)"""
    file_path = request.get("file_path")
    if not file_path:
        raise HTTPException(status_code=400, detail="file_path is required")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    # Check if VAD model is loaded
    if not is_vad_model_loaded():
        raise HTTPException(
            status_code=503,
            detail="VAD model not loaded. Please load the VAD model using POST /model/load with model_type='vad'",
        )

    try:
        model = get_vad_model()
        if model is None:
            raise HTTPException(status_code=503, detail="VAD model not available")

        # Process audio file
        logger.info(f"Processing VAD for file: {file_path}")
        model_output = model.generate(input=file_path)

        # Extract segments from FunASR VAD output format
        segments = []
        if model_output and len(model_output) > 0:
            # FunASR VAD returns dict with 'value' key containing the actual segments
            first_result = model_output[0]
            if isinstance(first_result, dict) and "value" in first_result:
                segments = first_result["value"]
            elif isinstance(first_result, list):
                segments = first_result
            else:
                logger.warning(f"Unexpected VAD output format: {type(first_result)}")

        logger.info(f"Raw VAD output type: {type(model_output)}")
        logger.info(f"Raw VAD output: {model_output}")
        logger.info(f"Extracted segments type: {type(segments)}")
        logger.info(f"Extracted segments: {segments}")

        # Clean up temporary file
        try:
            os.remove(file_path)
        except:
            pass

        logger.info(f"VAD detection completed, found {len(segments)} segments")

        return VADResponse(
            success=True,
            message="VAD detection completed successfully",
            segments=segments,
        )

    except Exception as e:
        logger.error(f"Error in VAD detection: {e}")
        # Clean up temporary file on error
        try:
            os.remove(file_path)
        except:
            pass
        raise HTTPException(status_code=500, detail=f"VAD detection failed: {str(e)}")


@router.post("/upload_and_detect", response_model=VADResponse)
async def upload_and_detect(file: UploadFile = File(...)):
    """Upload file and detect voice activity in one step"""
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

    try:
        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1]
        temp_filename = f"{file_id}{file_extension}"
        file_path = os.path.join(TEMP_DIR, temp_filename)

        # Save uploaded file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # Process VAD
        model = get_vad_model()
        if model is None:
            raise HTTPException(status_code=503, detail="VAD model not available")

        logger.info(f"Processing VAD for uploaded file: {file.filename}")
        model_output = model.generate(input=file_path)

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

        # Clean up temporary file
        try:
            os.remove(file_path)
        except:
            pass

        logger.info(f"VAD detection completed, found {len(segments)} segments")

        return VADResponse(
            success=True,
            message="VAD detection completed successfully",
            segments=segments,
        )

    except Exception as e:
        logger.error(f"Error in upload and detect: {e}")
        raise HTTPException(status_code=500, detail=f"VAD processing failed: {str(e)}")


# WebSocket for real-time VAD
from fastapi import WebSocket, WebSocketDisconnect
import asyncio
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


def decode_audio_chunk(audio_data: str) -> np.ndarray:
    """Decode base64 audio chunk to numpy array"""
    try:
        # Try to decode as float32 first
        audio_bytes = base64.b64decode(audio_data)
        audio_array = np.frombuffer(audio_bytes, dtype=np.float32)
        return audio_array
    except:
        try:
            # Try int16
            audio_bytes = base64.b64decode(audio_data)
            audio_array = (
                np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            )
            return audio_array
        except:
            try:
                # Try int32
                audio_bytes = base64.b64decode(audio_data)
                audio_array = (
                    np.frombuffer(audio_bytes, dtype=np.int32).astype(np.float32)
                    / 2147483648.0
                )
                return audio_array
            except:
                logger.error("Failed to decode audio chunk")
                return np.array([], dtype=np.float32)


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
        chunk_size_ms = config.config.get("chunk_size", 200)
        sample_rate = config.config.get("sample_rate", 16000)
        chunk_stride = int(
            chunk_size_ms * sample_rate / 1000
        )  # 3200 samples for 200ms at 16kHz

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

                await vad_manager.send_message(
                    client_id, {"type": "status", "message": "VAD started"}
                )

            elif message.get("type") == "stop_vad":
                # Process final audio
                state = vad_manager.get_state(client_id)
                if state and len(state["audio_buffer"]) > 0:
                    final_model_output = model.generate(
                        input=state["audio_buffer"],
                        cache=state["cache"],
                        is_final=True,
                        chunk_size=chunk_size_ms,
                    )

                    # Extract segments from FunASR VAD output format
                    final_segments = []
                    if final_model_output and len(final_model_output) > 0:
                        # FunASR VAD returns dict with 'value' key containing the actual segments
                        first_result = final_model_output[0]
                        if isinstance(first_result, dict) and "value" in first_result:
                            final_segments = first_result["value"]
                        elif isinstance(first_result, list):
                            final_segments = first_result
                        else:
                            logger.warning(
                                f"Unexpected VAD output format: {type(first_result)}"
                            )

                    if final_segments and len(final_segments) > 0:
                        await vad_manager.send_message(
                            client_id,
                            {
                                "type": "vad_result",
                                "segments": final_segments,
                                "is_final": True,
                            },
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

                # Process if we have enough data
                while len(state["audio_buffer"]) >= chunk_stride:
                    speech_chunk = state["audio_buffer"][:chunk_stride].copy()
                    state["audio_buffer"] = state["audio_buffer"][chunk_stride:]

                    try:
                        # Process VAD with simplified parameters for real-time detection
                        model_output = model.generate(
                            input=speech_chunk, is_final=False, chunk_size=chunk_size_ms
                        )

                        # Extract segments from FunASR VAD output format
                        segments = []
                        if len(model_output[0]["value"]):
                            segments = model_output[0]["value"]

                        # Check if segments contain valid VAD results
                        if segments and len(segments) > 0:
                            # Filter out empty segments and ensure valid data
                            valid_segments = [
                                seg for seg in segments if seg and len(seg) > 0
                            ]
                            if valid_segments:
                                await vad_manager.send_message(
                                    client_id,
                                    {
                                        "type": "vad_result",
                                        "segments": valid_segments,
                                        "is_final": False,
                                    },
                                )
                                logger.info(
                                    f"VAD client {client_id}: detected {len(valid_segments)} segments"
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
