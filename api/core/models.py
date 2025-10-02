"""Model enumeration and types for speech recognition API"""

from enum import Enum
from typing import Optional, Dict, Any


class ModelType(str, Enum):
    """Enumeration of available model types"""

    STREAMING_ASR = "streaming_asr"
    OFFLINE_ASR = "offline_asr"
    PUNCTUATION = "punctuation"


class ModelConfig:
    """Model configuration data class"""

    def __init__(
        self,
        model_type: ModelType,
        model_name: str,
        display_name: str,
        description: str,
        auto_load: bool = False,
        dependencies: Optional[list] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        self.model_type = model_type
        self.model_name = model_name
        self.display_name = display_name
        self.description = description
        self.auto_load = auto_load
        self.dependencies = dependencies or []
        self.config = config or {}


# Model configurations registry
MODEL_CONFIGS = {
    ModelType.STREAMING_ASR: ModelConfig(
        model_type=ModelType.STREAMING_ASR,
        model_name="paraformer-zh-streaming",
        display_name="流式语音识别",
        description="基于FunASR的实时中文语音识别模型",
        auto_load=False,
        config={
            "chunk_size": [0, 10, 5],
            "encoder_chunk_look_back": 4,
            "decoder_chunk_look_back": 1,
        },
    ),
    ModelType.OFFLINE_ASR: ModelConfig(
        model_type=ModelType.OFFLINE_ASR,
        model_name="paraformer-zh",
        display_name="离线语音识别",
        description="基于FunASR的高精度离线中文语音识别模型",
        auto_load=False,
        dependencies=["fsmn-vad", "ct-punc", "cam++"],
        config={
            "batch_size_s": 300,
            "batch_size_threshold_s": 60,
            "vad_model": "fsmn-vad",
            "vad_kwargs": {"max_single_segment_time": 60000},
            "punc_model": "ct-punc",
            "spk_model": "cam++",
        },
    ),
    ModelType.PUNCTUATION: ModelConfig(
        model_type=ModelType.PUNCTUATION,
        model_name="ct-punc",
        display_name="标点符号添加",
        description="基于CT-Punc的中文标点符号自动添加模型",
        auto_load=False,
        config={},
    ),
}


def get_model_config(model_type: ModelType) -> Optional[ModelConfig]:
    """Get model configuration by type"""
    return MODEL_CONFIGS.get(model_type)


def get_all_model_configs() -> Dict[ModelType, ModelConfig]:
    """Get all model configurations"""
    return MODEL_CONFIGS.copy()


def get_model_status_display_name(model_type: ModelType) -> str:
    """Get display name for model type"""
    config = get_model_config(model_type)
    return config.display_name if config else model_type.value
