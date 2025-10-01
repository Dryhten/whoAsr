"""Model management for speech recognition API"""

from funasr import AutoModel
from .config import logger

# Global model instance
model = None


def load_model(model_name: str = "paraformer-zh-streaming"):
    """Load the FunASR model"""
    global model
    if model is None:
        logger.info(f"Loading FunASR model: {model_name}...")
        try:
            model = AutoModel(model=model_name)
            logger.info("Model loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    return True


def get_model():
    """Get the global model instance"""
    return model


def is_model_loaded():
    """Check if model is loaded"""
    return model is not None
