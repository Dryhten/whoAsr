"""Main application entry point for speech recognition API"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from .core.model import get_loaded_models_status
from .core.config import logger
from .routers.websocket import websocket_endpoint
from .routers.punctuation import router as punctuation_router
from .routers.offline import router as offline_router
from .routers.model import router as model_router
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
    """Health check endpoint with detailed model status"""
    return {
        "status": "healthy",
        "models": get_loaded_models_status(),
        "total_loaded": sum(1 for status in get_loaded_models_status().values() if status["loaded"]),
    }


# Mount static files
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="static")

# Register WebSocket route
app.websocket("/ws/{client_id}")(websocket_endpoint)

# Register punctuation routes
app.include_router(punctuation_router)

# Register offline routes
app.include_router(offline_router)

# Register model management routes
app.include_router(model_router)

# Register VAD routes
app.include_router(vad_router)

# Register timestamp routes
app.include_router(timestamp_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
