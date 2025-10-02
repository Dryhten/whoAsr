"""Main application entry point for speech recognition API"""

from fastapi import FastAPI
from contextlib import asynccontextmanager
from .core.model import get_loaded_models_status
from .core.config import logger
from .routers.websocket import websocket_endpoint
from .routers.punctuation import router as punctuation_router
from .routers.offline import router as offline_router
from .routers.model import router as model_router


@asynccontextmanager
async def lifespan(app: FastAPI):
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


@app.get("/health")
async def health_check():
    """Health check endpoint with detailed model status"""
    return {
        "status": "healthy",
        "models": get_loaded_models_status(),
        "total_loaded": sum(1 for status in get_loaded_models_status().values() if status["loaded"]),
    }


# Register WebSocket route
app.websocket("/ws/{client_id}")(websocket_endpoint)

# Register punctuation routes
app.include_router(punctuation_router)

# Register offline routes
app.include_router(offline_router)

# Register model management routes
app.include_router(model_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
