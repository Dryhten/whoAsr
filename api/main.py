"""Main application entry point for speech recognition API"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from .core.model import load_model, is_model_loaded, load_punctuation_model
from .core.config import logger
from .routers.websocket import websocket_endpoint
from .routers.punctuation import router as punctuation_router

# Initialize FastAPI app
app = FastAPI(title="Real-time Speech Recognition API", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    """Initialize the model on startup"""
    try:
        load_model()
        load_punctuation_model()
        logger.info("Application startup completed successfully")
    except Exception as e:
        logger.error(f"Failed to initialize application: {e}")
        raise


@app.get("/")
async def get():
    """Serve a simple test page"""
    try:
        with open("test_simple.html", "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content)
    except FileNotFoundError:
        logger.error("test_simple.html not found")
        return HTMLResponse(
            content="<h1>Test page not found</h1><p>Please ensure test_simple.html exists in the root directory.</p>",
            status_code=404,
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
