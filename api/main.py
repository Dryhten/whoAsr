"""Main application entry point for speech recognition API"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import UploadFile, File, Form
from typing import Optional
from contextlib import asynccontextmanager
import os
from .core.model import get_loaded_models_status
from .core.config import logger
from .routers.websocket import websocket_endpoint
from .routers.model import router as model_router
from .routers.offline import router as offline_router
from .routers.punctuation import router as punctuation_router
from .routers.vad import router as vad_router
from .routers.timestamp import router as timestamp_router



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



# Register model management routes (keep as it has multiple related endpoints)
app.include_router(model_router)
# Register offline routes (includes /offline/recognize)
app.include_router(offline_router)
# Register timestamp routes (includes /timestamp/predict)
app.include_router(timestamp_router)
# Register punctuation routes (includes /punctuation/add)
app.include_router(punctuation_router)
# Register VAD routes
app.include_router(vad_router)


# Backward compatibility endpoint - redirects to /offline/recognize
@app.post("/recognize", include_in_schema=False)
async def recognize_speech_compatibility(
    file: UploadFile = File(...),
    batch_size_s: Optional[int] = Form(300),
    batch_size_threshold_s: Optional[int] = Form(60),
    hotword: Optional[str] = Form(None),
):
    """Backward compatibility endpoint for speech recognition (redirects to /offline/recognize)"""
    from .routers.offline import recognize_audio_file
    return await recognize_audio_file(file, batch_size_s, batch_size_threshold_s, hotword)








if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
