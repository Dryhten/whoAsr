"""Model management for speech recognition API"""

from funasr import AutoModel
from fastapi.concurrency import run_in_threadpool
from .config import logger
from .models import ModelType, get_model_config
from .text_utils import apply_chinese_numbers_to_result
from .settings import get_settings


def _resolve_device(device_str: str, backend: str | None = None) -> str:
    """将配置转为 PyTorch 设备：0/1/2 → cuda:0 或 musa:0，cpu 等保持原样"""
    s = str(device_str).strip()
    if s.isdigit():
        backend = (backend or get_settings().model_device_backend).strip().lower()
        return f"{backend}:{s}"
    return s


# 注册 Fun-ASR-Nano 模型 (FunASR 需显式 import 才能加载)
try:
    from funasr.models.fun_asr_nano.model import FunASRNano  # noqa: F401
except ImportError:
    pass  # 旧版 FunASR 无此模块，使用 paraformer 时无影响

# Global model instances
model_instances = {
    ModelType.STREAMING_ASR: None,
    ModelType.OFFLINE_ASR: None,
    ModelType.PUNCTUATION: None,
    ModelType.VAD: None,
    ModelType.TIMESTAMP: None,
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

    device = _resolve_device(get_settings().model_device)
    logger.info(f"Loading {config.display_name} ({config.model_name}) on {device}...")

    try:
        if model_type == ModelType.STREAMING_ASR:
            model_instances[model_type] = AutoModel(model=config.model_name, device=device)

        elif model_type == ModelType.OFFLINE_ASR:
            cfg = config.config
            if cfg.get("model_variant") == "fun_asr_nano":
                # Fun-ASR-Nano: 自动确保 Qwen3-0.6B 子模型已下载
                from .funasr_nano import ensure_fun_asr_nano_ready
                if not ensure_fun_asr_nano_ready(config.model_name):
                    logger.error("Fun-ASR-Nano 依赖未就绪，加载失败")
                    return False
                load_kwargs = {"model": config.model_name}
                if cfg.get("vad_model"):
                    load_kwargs["vad_model"] = cfg["vad_model"]
                if cfg.get("vad_kwargs"):
                    load_kwargs["vad_kwargs"] = cfg["vad_kwargs"]
                load_kwargs["device"] = device
                model_instances[model_type] = AutoModel(**load_kwargs)
            else:
                # paraformer-zh 等传统模型
                model_instances[model_type] = AutoModel(
                    model=config.model_name,
                    device=device,
                    vad_model=cfg.get("vad_model"),
                    vad_kwargs=cfg.get("vad_kwargs"),
                    punc_model=cfg.get("punc_model"),
                    spk_model=cfg.get("spk_model"),
                )

        elif model_type == ModelType.PUNCTUATION:
            model_instances[model_type] = AutoModel(model=config.model_name, device=device)

        elif model_type == ModelType.VAD:
            cfg = config.config
            load_kwargs = {"model": config.model_name, "device": device}
            for key in ("max_end_silence_time", "speech_to_sil_time_thres"):
                if key in cfg:
                    load_kwargs[key] = cfg[key]
            model_instances[model_type] = AutoModel(**load_kwargs)

        elif model_type == ModelType.TIMESTAMP:
            model_instances[model_type] = AutoModel(model=config.model_name, device=device)

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
        logger.info(
            f"Unloading {config.display_name if config else model_type.value}..."
        )
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


def _get_model_device(model) -> str | None:
    """从 FunASR/PyTorch 模型中提取实际推理设备"""
    if model is None:
        return None
    try:
        # 优先从 parameters 获取（nn.Module 标准方式）
        for obj in (model, getattr(model, "model", None)):
            if obj is None:
                continue
            params = list(obj.parameters()) if hasattr(obj, "parameters") else []
            if params:
                return str(params[0].device)
        # 尝试 model.device 属性
        if hasattr(model, "device"):
            return str(model.device)
        # 递归查找子模块中的第一个参数（兼容 FunASR 嵌套结构）
        if hasattr(model, "modules") and callable(getattr(model, "modules")):
            for m in model.modules():
                params = list(m.parameters()) if hasattr(m, "parameters") else []
                if params:
                    return str(params[0].device)
    except Exception:
        pass
    return None


def get_loaded_models_devices() -> dict:
    """获取已加载模型的实际推理设备"""
    result = {}
    for model_type in ModelType:
        model = get_model_by_type(model_type)
        dev = _get_model_device(model)
        if dev is not None:
            result[model_type.value] = dev
    return result


# Legacy functions for backward compatibility
def load_model(model_name: str = "paraformer-zh-streaming"):
    """Legacy function - use load_model_by_type instead"""
    _ = model_name  # Unused parameter, kept for backward compatibility
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


def get_vad_model():
    """Legacy function - use get_model_by_type instead"""
    return get_model_by_type(ModelType.VAD)


def is_model_loaded():
    """Legacy function - use is_model_loaded_by_type instead"""
    return is_model_loaded_by_type(ModelType.STREAMING_ASR)


def is_punctuation_model_loaded():
    """Legacy function - use is_model_loaded_by_type instead"""
    return is_model_loaded_by_type(ModelType.PUNCTUATION)


def is_offline_model_loaded():
    """Legacy function - use is_model_loaded_by_type instead"""
    return is_model_loaded_by_type(ModelType.OFFLINE_ASR)


def is_vad_model_loaded():
    """Legacy function - use is_model_loaded_by_type instead"""
    return is_model_loaded_by_type(ModelType.VAD)


def is_timestamp_model_loaded():
    """Legacy function - use is_model_loaded_by_type instead"""
    return is_model_loaded_by_type(ModelType.TIMESTAMP)


def get_timestamp_model():
    """Legacy function - use get_model_by_type instead"""
    return get_model_by_type(ModelType.TIMESTAMP)


def load_timestamp_model():
    """Legacy function - use load_model_by_type instead"""
    return load_model_by_type(ModelType.TIMESTAMP)


async def add_punctuation(text: str) -> str:
    """Add punctuation to text using the punctuation model"""
    model = get_punctuation_model()
    if model is None:
        if not load_punctuation_model():
            logger.error("Failed to load punctuation model")
            return text
        model = get_punctuation_model()

    try:
        result = await run_in_threadpool(model.generate, input=text)
        if result and len(result) > 0:
            return result[0]["text"] if isinstance(result[0], dict) else str(result[0])
        return text
    except Exception as e:
        logger.error(f"Failed to add punctuation: {e}")
        return text


async def run_offline_recognition(
    file_path: str,
    batch_size_s: int = 300,
    batch_size_threshold_s: int = 60,
    hotword: str = None,
    initial_prompt: str = None,
):
    """Run offline recognition on audio file"""
    model = get_offline_model()
    if model is None:
        if not load_offline_model():
            logger.error("Failed to load offline model")
            raise Exception("Failed to load offline model")
        model = get_offline_model()

    config = get_model_config(ModelType.OFFLINE_ASR)
    cfg = config.config if config else {}
    is_fun_asr_nano = cfg.get("model_variant") == "fun_asr_nano"

    try:
        if is_fun_asr_nano:
            # Fun-ASR-Nano API: input 为 list，支持 hotwords/language/itn/initial_prompt
            # itn=True 将「一三八零零」转为「13800」，对数字/身份证号识别至关重要
            kwargs = {
                "input": [file_path],
                "cache": {},
                "batch_size": cfg.get("batch_size", 1),
                "language": cfg.get("language", "中文"),
                "itn": cfg.get("itn", True),
            }
            if hotword:
                kwargs["hotwords"] = [w.strip() for w in hotword.split(",") if w.strip()]
            prompt = initial_prompt or cfg.get("initial_prompt") or ""
            if prompt:
                kwargs["initial_prompt"] = prompt
        else:
            # paraformer-zh 等传统 API
            kwargs = {
                "input": file_path,
                "batch_size_s": batch_size_s,
                "batch_size_threshold_s": batch_size_threshold_s,
            }
            if hotword:
                kwargs["hotword"] = hotword

        result = await run_in_threadpool(model.generate, **kwargs)
        if is_fun_asr_nano and result is not None:
            result = apply_chinese_numbers_to_result(result)
        return result
    except Exception as e:
        logger.error(f"Failed to run offline recognition: {e}")
        raise
