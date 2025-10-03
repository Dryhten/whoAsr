"""Main application entry point for speech recognition API"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import UploadFile, File, HTTPException, Form
from typing import Optional
from contextlib import asynccontextmanager
import os
import tempfile
from .core.model import get_loaded_models_status
from .core.config import logger
from .routers.websocket import websocket_endpoint
from .routers.model import router as model_router
from .routers.offline import run_offline_recognition
from .routers.punctuation import add_punctuation
from .core.model import is_vad_model_loaded, get_vad_model
from .core.file_utils import generate_unique_id, save_upload_file, save_text_file, cleanup_temp_files
from .core.model_utils import process_model_request
from .core.schemas import ProcessingResponse

# VAD WebSocket imports
import uuid
import numpy as np
import soundfile as sf
import json
import asyncio
import base64
from fastapi import WebSocket, WebSocketDisconnect


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """Initialize the application on startup and cleanup on shutdown"""
    try:
        logger.info("Application startup completed successfully - no models loaded by default")
        logger.info("Use /model management endpoints to load specific models")
        yield
    except Exception as e:
        logger.error(f"Failed to initialize application: {e}")
        raise
    finally:
        # Cleanup code can be added here if needed
        logger.info("Application shutdown")


# Initialize FastAPI app with lifespan
app = FastAPI(
    title="Real-time Speech Recognition API", version="1.0.0", lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Frontend dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def read_root():
    """Serve the frontend application"""
    frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
    if os.path.exists(os.path.join(frontend_path, "index.html")):
        return FileResponse(os.path.join(frontend_path, "index.html"))
    return {
        "message": "FunASR Speech Recognition API",
        "docs": "/docs",
        "health": "/health",
        "note": "Frontend not found. Build the frontend with 'npm run build' in the frontend directory."
    }


@app.get("/health")
async def health_check():
    """Enhanced health check endpoint with detailed service information"""
    from datetime import datetime
    import psutil

    # Get model status
    models_status = get_loaded_models_status()
    total_loaded = sum(1 for status in models_status.values() if status["loaded"])

    # Get system resource information
    try:
        memory_info = psutil.virtual_memory()
        cpu_percent = psutil.cpu_percent(interval=1)
        system_info = {
            "memory_total_gb": round(memory_info.total / (1024**3), 2),
            "memory_available_gb": round(memory_info.available / (1024**3), 2),
            "memory_usage_percent": memory_info.percent,
            "cpu_usage_percent": cpu_percent,
        }
    except Exception:
        system_info = {
            "memory_total_gb": "unknown",
            "memory_available_gb": "unknown",
            "memory_usage_percent": "unknown",
            "cpu_usage_percent": "unknown",
        }

    # Service capabilities
    services = {}
    for model_type, status in models_status.items():
        config = None
        try:
            from .core.models import get_model_config, ModelType
            config = get_model_config(ModelType(model_type))
        except:
            pass

        services[model_type] = {
            "loaded": status["loaded"],
            "display_name": status["display_name"],
            "description": status["description"],
            "auto_load": status.get("auto_load", False),
            "supported_formats": _get_supported_formats(model_type),
            "api_endpoints": _get_api_endpoints(model_type),
        }

    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "services": services,
        "total_loaded": total_loaded,
        "system": system_info,
        "api_info": {
            "version": "1.0.0",
            "title": "Real-time Speech Recognition API",
            "docs": "/docs",
            "websocket": "/ws/{client_id}"
        }
    }


def _get_supported_formats(model_type: str) -> list:
    """Get supported audio formats for a model type"""
    format_map = {
        "streaming_asr": ["wav", "mp3", "flac", "ogg"],
        "offline_asr": ["wav", "mp3", "mpeg", "m4a", "flac", "ogg"],
        "punctuation": ["text/plain"],
        "vad": ["wav", "mp3", "m4a", "flac", "ogg"],
        "timestamp": ["wav", "mp3", "m4a", "flac", "ogg"]
    }
    return format_map.get(model_type, [])


def _get_api_endpoints(model_type: str) -> list:
    """Get available API endpoints for a model type"""
    endpoint_map = {
        "streaming_asr": ["GET /health", "POST /model/load", "WS /ws/{client_id}"],
        "offline_asr": ["GET /health", "POST /model/load", "POST /recognize"],
        "punctuation": ["GET /health", "POST /model/load", "POST /punctuate"],
        "vad": ["GET /health", "POST /model/load", "POST /vad", "WS /vad/ws/{client_id}"],
        "timestamp": ["GET /health", "POST /model/load", "POST /timestamp"]
    }
    return endpoint_map.get(model_type, [])


# Mount static files
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="assets")

# Register WebSocket routes
app.websocket("/ws/{client_id}")(websocket_endpoint)


# VAD WebSocket connection manager
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


@app.websocket("/vad/ws/{client_id}")
async def websocket_vad_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time VAD"""
    if not is_vad_model_loaded():
        await websocket.close(code=1013, reason="VAD model not loaded")
        return

    await vad_manager.connect(websocket, client_id)

    try:
        model = get_vad_model()
        from .core.models import get_model_config, ModelType
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

# Register model management routes (keep as it has multiple related endpoints)
app.include_router(model_router)


# Simplified direct routes (following KISS principle)
@app.post("/recognize")
async def recognize_speech(
    file: UploadFile = File(...),
    batch_size_s: Optional[int] = Form(300),
    batch_size_threshold_s: Optional[int] = Form(60),
    hotword: Optional[str] = Form(None),
):
    """Upload and perform offline speech recognition"""
    temp_file_path = None
    try:
        # Check file type
        allowed_types = [
            "audio/wav", "audio/mp3", "audio/mpeg",
            "audio/m4a", "audio/flac", "audio/ogg"
        ]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Allowed types: {', '.join(allowed_types)}"
            )

        # Create temporary file
        temp_dir = tempfile.mkdtemp()
        temp_file_path = os.path.join(temp_dir, f"upload_{file.filename}")

        # Save uploaded file
        content = await file.read()
        with open(temp_file_path, "wb") as buffer:
            buffer.write(content)

        logger.info(f"File uploaded: {file.filename} -> {temp_file_path}")

        # Perform recognition
        results = run_offline_recognition(
            file_path=temp_file_path,
            batch_size_s=batch_size_s,
            batch_size_threshold_s=batch_size_threshold_s,
            hotword=hotword,
        )

        return {
            "success": True,
            "results": results,
            "file_name": file.filename,
            "file_size": len(content),
            "message": "Recognition completed successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during speech recognition: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to recognize speech: {str(e)}")
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                temp_dir = os.path.dirname(temp_file_path)
                if os.path.exists(temp_dir) and not os.listdir(temp_dir):
                    os.rmdir(temp_dir)
            except Exception:
                pass


@app.post("/punctuate")
async def punctuate_text(request: dict):
    """Add punctuation to text"""
    try:
        text = request.get("text")
        if not text:
            raise HTTPException(status_code=400, detail="text is required")

        punctuated_text = add_punctuation(text)

        return {
            "original_text": text,
            "punctuated_text": punctuated_text,
            "success": True,
            "message": "Punctuation added successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding punctuation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add punctuation: {str(e)}")


@app.post("/vad")
async def detect_voice_activity_simple(file: UploadFile = File(...)):
    """Upload audio file and detect voice activity"""
    if not file.filename.lower().endswith((".wav", ".mp3", ".m4a", ".flac", ".ogg")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload WAV, MP3, M4A, FLAC, or OGG files."
        )

    if not is_vad_model_loaded():
        raise HTTPException(
            status_code=503,
            detail="VAD model not loaded. Please load the VAD model using POST /model/load with model_type='vad'"
        )

    temp_file_path = None
    try:
        import uuid
        TEMP_DIR = tempfile.gettempdir()
        file_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1]
        temp_filename = f"{file_id}{file_extension}"
        temp_file_path = os.path.join(TEMP_DIR, temp_filename)

        content = await file.read()
        with open(temp_file_path, "wb") as buffer:
            buffer.write(content)

        model = get_vad_model()
        if model is None:
            raise HTTPException(status_code=503, detail="VAD model not available")

        logger.info(f"Processing VAD for: {file.filename}")
        model_output = model.generate(input=temp_file_path)

        # Extract segments
        segments = []
        if model_output and len(model_output) > 0:
            for result in model_output:
                if isinstance(result, dict) and "value" in result:
                    value = result["value"]
                    if isinstance(value, list):
                        for segment in value:
                            if isinstance(segment, list) and len(segment) >= 2:
                                if all(isinstance(x, int) for x in segment):
                                    segments.append(segment)
                elif isinstance(result, list):
                    for segment in result:
                        if isinstance(segment, list) and len(segment) >= 2:
                            if all(isinstance(x, int) for x in segment):
                                segments.append(segment)

        return {
            "success": True,
            "segments": segments,
            "file_name": file.filename,
            "file_size": len(content),
            "message": "VAD detection completed successfully"
        }

    except Exception as e:
        logger.error(f"Error in VAD detection: {e}")
        raise HTTPException(status_code=500, detail=f"VAD processing failed: {str(e)}")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass


@app.post("/timestamp")
async def predict_timestamps_simple(
    audio_file: UploadFile = File(...),
    text_file: Optional[UploadFile] = File(None),
    text_content: Optional[str] = Form(None)
):
    """Upload audio and text files to predict timestamps"""
    if not text_file and not text_content:
        raise HTTPException(status_code=400, detail="Either text_file or text_content is required")

    temp_audio_path = None
    temp_text_path = None
    try:
        file_id = generate_unique_id()
        temp_audio_path = save_upload_file(audio_file, file_id)

        if text_file:
            temp_text_path = save_upload_file(text_file, file_id)

        # Create request object for processing
        class TempRequest:
            def __init__(self, audio_path: str, text_path: Optional[str], text: Optional[str]):
                self.audio_file_path = audio_path
                self.text_file_path = text_path
                self.text_content = text

        temp_request = TempRequest(str(temp_audio_path), str(temp_text_path) if temp_text_path else None, text_content)

        from .core.models import get_timestamp_model, is_timestamp_model_loaded
        results = process_model_request(
            model_getter=get_timestamp_model,
            model_checker=is_timestamp_model_loaded,
            model_name="Timestamp",
            request=temp_request
        )

        cleanup_temp_files(str(temp_audio_path), str(temp_text_path) if temp_text_path else None)

        return {
            "success": True,
            "results": results,
            "message": "Timestamp prediction completed successfully"
        }

    except Exception as e:
        logger.error(f"Error in timestamp prediction: {e}")
        if temp_audio_path or temp_text_path:
            cleanup_temp_files(str(temp_audio_path) if temp_audio_path else None, str(temp_text_path) if temp_text_path else None)
        raise HTTPException(status_code=500, detail=f"Timestamp processing failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
