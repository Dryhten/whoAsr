"""Model management for speech recognition API"""

from funasr import AutoModel
from .config import logger

# Global model instances
model = None
punctuation_model = None


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


def load_punctuation_model():
    """Load the punctuation model"""
    global punctuation_model
    if punctuation_model is None:
        logger.info("Loading punctuation model: ct-punc...")
        try:
            punctuation_model = AutoModel(model="ct-punc")
            logger.info("Punctuation model loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load punctuation model: {e}")
            raise
    return True


def get_model():
    """Get the global model instance"""
    return model


def get_punctuation_model():
    """Get the global punctuation model instance"""
    return punctuation_model


def is_model_loaded():
    """Check if model is loaded"""
    return model is not None


def is_punctuation_model_loaded():
    """Check if punctuation model is loaded"""
    return punctuation_model is not None


def add_punctuation(text: str) -> str:
    """Add punctuation to text using the punctuation model"""
    global punctuation_model
    if punctuation_model is None:
        load_punctuation_model()

    try:
        result = punctuation_model.generate(input=text)
        if result and len(result) > 0:
            return result[0]["text"] if isinstance(result[0], dict) else str(result[0])
        return text
    except Exception as e:
        logger.error(f"Failed to add punctuation: {e}")
        return text
