"""Model management for speech recognition API"""

from funasr import AutoModel
from .config import logger
from .models import ModelType, get_model_config

# Global model instances
model_instances = {
    ModelType.STREAMING_ASR: None,
    ModelType.OFFLINE_ASR: None,
    ModelType.PUNCTUATION: None,
}


def load_model_by_type(model_type: ModelType) -> bool:
    """Load model by type using configuration"""
    global model_instances

    if model_instances[model_type] is not None:
        logger.info(f"Model {model_type.value} already loaded")
        return True

    config = get_model_config(model_type)
    if not config:
        logger.error(f"No configuration found for model type: {model_type.value}")
        return False

    logger.info(f"Loading {config.display_name} ({config.model_name})...")

    try:
        if model_type == ModelType.STREAMING_ASR:
            model_instances[model_type] = AutoModel(model=config.model_name)

        elif model_type == ModelType.OFFLINE_ASR:
            model_instances[model_type] = AutoModel(
                model=config.model_name,
                vad_model=config.config.get("vad_model"),
                vad_kwargs=config.config.get("vad_kwargs"),
                punc_model=config.config.get("punc_model"),
                spk_model=config.config.get("spk_model"),
            )

        elif model_type == ModelType.PUNCTUATION:
            model_instances[model_type] = AutoModel(model=config.model_name)

        else:
            logger.error(f"Unsupported model type: {model_type.value}")
            return False

        logger.info(f"{config.display_name} loaded successfully")
        return True

    except Exception as e:
        logger.error(f"Failed to load {config.display_name}: {e}")
        return False


def get_model_by_type(model_type: ModelType):
    """Get model instance by type"""
    return model_instances.get(model_type)


def is_model_loaded_by_type(model_type: ModelType) -> bool:
    """Check if model is loaded by type"""
    return model_instances.get(model_type) is not None


def unload_model_by_type(model_type: ModelType) -> bool:
    """Unload model by type (set to None)"""
    if model_instances[model_type] is not None:
        config = get_model_config(model_type)
        logger.info(f"Unloading {config.display_name if config else model_type.value}...")
        model_instances[model_type] = None
        return True
    return False


def get_loaded_models_status() -> dict:
    """Get status of all models"""
    status = {}
    for model_type in ModelType:
        config = get_model_config(model_type)
        status[model_type.value] = {
            "loaded": is_model_loaded_by_type(model_type),
            "display_name": config.display_name if config else model_type.value,
            "description": config.description if config else "",
            "auto_load": config.auto_load if config else False,
        }
    return status


# Legacy functions for backward compatibility
def load_model(model_name: str = "paraformer-zh-streaming"):
    """Legacy function - use load_model_by_type instead"""
    return load_model_by_type(ModelType.STREAMING_ASR)


def load_punctuation_model():
    """Legacy function - use load_model_by_type instead"""
    return load_model_by_type(ModelType.PUNCTUATION)


def load_offline_model():
    """Legacy function - use load_model_by_type instead"""
    return load_model_by_type(ModelType.OFFLINE_ASR)


def get_model():
    """Legacy function - use get_model_by_type instead"""
    return get_model_by_type(ModelType.STREAMING_ASR)


def get_punctuation_model():
    """Legacy function - use get_model_by_type instead"""
    return get_model_by_type(ModelType.PUNCTUATION)


def get_offline_model():
    """Legacy function - use get_model_by_type instead"""
    return get_model_by_type(ModelType.OFFLINE_ASR)


def is_model_loaded():
    """Legacy function - use is_model_loaded_by_type instead"""
    return is_model_loaded_by_type(ModelType.STREAMING_ASR)


def is_punctuation_model_loaded():
    """Legacy function - use is_model_loaded_by_type instead"""
    return is_model_loaded_by_type(ModelType.PUNCTUATION)


def is_offline_model_loaded():
    """Legacy function - use is_model_loaded_by_type instead"""
    return is_model_loaded_by_type(ModelType.OFFLINE_ASR)


def add_punctuation(text: str) -> str:
    """Add punctuation to text using the punctuation model"""
    model = get_punctuation_model()
    if model is None:
        if not load_punctuation_model():
            logger.error("Failed to load punctuation model")
            return text
        model = get_punctuation_model()

    try:
        result = model.generate(input=text)
        if result and len(result) > 0:
            return result[0]["text"] if isinstance(result[0], dict) else str(result[0])
        return text
    except Exception as e:
        logger.error(f"Failed to add punctuation: {e}")
        return text


def run_offline_recognition(
    file_path: str,
    batch_size_s: int = 300,
    batch_size_threshold_s: int = 60,
    hotword: str = None
):
    """Run offline recognition on audio file"""
    model = get_offline_model()
    if model is None:
        if not load_offline_model():
            logger.error("Failed to load offline model")
            raise Exception("Failed to load offline model")
        model = get_offline_model()

    try:
        kwargs = {
            "input": file_path,
            "batch_size_s": batch_size_s,
            "batch_size_threshold_s": batch_size_threshold_s,
        }

        if hotword:
            kwargs["hotword"] = hotword

        result = model.generate(**kwargs)
        return result
    except Exception as e:
        logger.error(f"Failed to run offline recognition: {e}")
        raise