"""Main application entry point for speech recognition API"""

from fastapi import FastAPI
from contextlib import asynccontextmanager
from .core.model import load_model, is_model_loaded, load_punctuation_model
from .core.config import logger
from .routers.websocket import websocket_endpoint
from .routers.punctuation import router as punctuation_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the model on startup and cleanup on shutdown"""
    try:
        load_model()
        load_punctuation_model()
        logger.info("Application startup completed successfully")
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
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": is_model_loaded(),
    }


# Register WebSocket route
app.websocket("/ws/{client_id}")(websocket_endpoint)

# Register punctuation routes
app.include_router(punctuation_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
