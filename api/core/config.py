"""Configuration and constants for speech recognition API"""

import logging

# FunASR configuration
CHUNK_SIZE = [0, 10, 5]  # [0, 10, 5] 600ms, [0, 8, 4] 480ms
ENCODER_CHUNK_LOOK_BACK = 4  # number of chunks to lookback for encoder self-attention
DECODER_CHUNK_LOOK_BACK = 1  # number of encoder chunks to lookback for decoder cross-attention

# Audio parameters
SAMPLE_RATE = 16000  # FunASR typically uses 16kHz
CHANNELS = 1
DTYPE = "float32"
CHUNK_STRIDE = CHUNK_SIZE[1] * 960 if isinstance(CHUNK_SIZE, list) else CHUNK_SIZE * 960  # 600ms, same as original


# Logging configuration
def setup_logging():
    """Setup logging configuration"""
    # Configure main logger
    logging.basicConfig(level=logging.WARNING)  # Only show warnings and errors in production
    logger = logging.getLogger(__name__)

    # Create a separate debug logger for detailed information
    debug_logger = logging.getLogger("debug")
    debug_logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    debug_logger.addHandler(handler)

    return logger, debug_logger


# Global logger instances
logger, debug_logger = setup_logging()


def detect_device_info() -> dict:
    """检测当前运行环境硬件信息"""
    device_info = {
        "device_type": "unknown",
        "device_name": "unknown",
        "cuda_available": False,
        "cuda_version": None,
        "gpu_count": 0,
        "gpu_names": [],
    }

    try:
        import torch

        # 检查CUDA是否可用
        cuda_available = torch.cuda.is_available()
        device_info["cuda_available"] = cuda_available

        if cuda_available:
            device_info["device_type"] = "GPU"
            device_info["cuda_version"] = torch.version.cuda
            device_info["gpu_count"] = torch.cuda.device_count()
            device_info["gpu_names"] = [
                torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())
            ]
            device_info["device_name"] = torch.cuda.get_device_name(0) if device_info["gpu_count"] > 0 else "unknown"
        else:
            device_info["device_type"] = "CPU"
            device_info["device_name"] = "CPU"
    except ImportError:
        # PyTorch未安装，使用CPU
        device_info["device_type"] = "CPU"
        device_info["device_name"] = "CPU (PyTorch not installed)"
    except Exception as e:
        # 其他错误
        logger.warning(f"Failed to detect device info: {e}")
        device_info["device_type"] = "CPU"
        device_info["device_name"] = "CPU (detection failed)"

    return device_info


def format_device_info(device_info: dict) -> str:
    """格式化设备信息为可读字符串"""
    device_type = device_info["device_type"]
    device_name = device_info["device_name"]

    if device_type == "GPU":
        info = f"GPU ({device_name})"
        if device_info["gpu_count"] > 1:
            info += f" [{device_info['gpu_count']} GPUs available]"
        if device_info["cuda_version"]:
            info += f" - CUDA {device_info['cuda_version']}"
        return info
    else:
        return f"CPU ({device_name})"