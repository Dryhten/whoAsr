"""
Fun-ASR-Nano 依赖管理：确保主模型及 Qwen3-0.6B 子模型就绪。

Fun-ASR-Nano 需要 Qwen3-0.6B 位于主模型的 Qwen3-0.6B 子目录下，
ModelScope 默认下载不包含该子模型，需单独下载并配置。
"""

import os
import shutil

from .config import logger

FUNASR_MODEL_ID = "FunAudioLLM/Fun-ASR-Nano-2512"
QWEN_MODEL_ID = "Qwen/Qwen3-0.6B"


def ensure_fun_asr_nano_ready(model_id: str = FUNASR_MODEL_ID, verbose: bool = False) -> bool:
    """
    确保 Fun-ASR-Nano 主模型及 Qwen3-0.6B 子模型已下载并配置完成。
    加载 offline_asr 时会自动调用，无需单独运行下载脚本。

    Args:
        model_id: 主模型 ID，默认 Fun-ASR-Nano-2512
        verbose: 为 True 时同时 print 进度（供脚本单独运行时使用）

    Returns:
        True 成功，False 失败
    """
    def log(msg: str, level: str = "info"):
        if level == "info":
            logger.info(msg)
        else:
            logger.error(msg)
        if verbose:
            print(msg)

    try:
        from modelscope import snapshot_download
    except ImportError:
        log("modelscope 未安装，无法下载 Fun-ASR-Nano 依赖", "error")
        return False

    try:
        # 1. 下载主模型 (使用默认缓存)
        log(f"正在确保 Fun-ASR-Nano 依赖就绪: {model_id}")
        funasr_dir = snapshot_download(model_id)
        qwen_target = os.path.join(funasr_dir, "Qwen3-0.6B")

        # 2. 检查 Qwen3-0.6B 是否已存在且完整
        if os.path.exists(qwen_target) and os.path.isfile(
            os.path.join(qwen_target, "model.safetensors")
        ):
            log("Qwen3-0.6B 子模型已就绪，跳过下载")
            return True

        # 3. 下载 Qwen3-0.6B 并复制到子目录
        log("正在下载 Qwen3-0.6B 子模型...")
        qwen_temp = snapshot_download(QWEN_MODEL_ID)
        if os.path.exists(qwen_target):
            shutil.rmtree(qwen_target)
        shutil.copytree(qwen_temp, qwen_target)
        log(f"Qwen3-0.6B 已配置到: {qwen_target}")
        return True

    except Exception as e:
        log(f"Fun-ASR-Nano 依赖配置失败: {e}", "error")
        return False
