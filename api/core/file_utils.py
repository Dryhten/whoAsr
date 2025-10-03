"""
通用的文件处理工具
遵循KISS原则：简化文件操作逻辑
"""

import os
import tempfile
import uuid
from typing import Optional, Tuple, Any
from pathlib import Path
import soundfile as sf
import numpy as np
from fastapi import UploadFile, HTTPException
from .config import logger

# 临时目录配置
TEMP_DIR = Path(tempfile.gettempdir())
SUPPORTED_AUDIO_FORMATS = {".wav", ".mp3", ".m4a", ".flac", ".ogg"}

def generate_unique_id() -> str:
    """生成唯一ID"""
    return str(uuid.uuid4())

def get_temp_path(file_id: str, filename: str) -> Path:
    """获取临时文件路径"""
    extension = Path(filename).suffix
    return TEMP_DIR / f"{file_id}{extension}"

def validate_audio_file(filename: str) -> None:
    """验证音频文件格式"""
    if not Path(filename).suffix.lower() in SUPPORTED_AUDIO_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format. Supported formats: {', '.join(SUPPORTED_AUDIO_FORMATS)}",
        )

def save_upload_file(upload_file: UploadFile, file_id: str) -> Path:
    """保存上传的文件到临时目录"""
    try:
        file_path = get_temp_path(file_id, upload_file.filename)
        with open(file_path, "wb") as buffer:
            content = upload_file.file.read()
            buffer.write(content)
        return file_path
    except Exception as e:
        logger.error(f"Error saving file {upload_file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

def cleanup_temp_file(file_path: Path) -> None:
    """清理临时文件"""
    try:
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        logger.warning(f"Failed to cleanup temp file {file_path}: {e}")

def validate_file_exists(file_path: str) -> None:
    """验证文件是否存在"""
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

def read_text_file(file_path: str) -> str:
    """读取文本文件内容"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Error reading text file {file_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read text file: {str(e)}")

def save_text_file(content: str, file_id: str) -> Path:
    """保存文本内容到临时文件"""
    try:
        file_path = TEMP_DIR / f"{file_id}.txt"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        return file_path
    except Exception as e:
        logger.error(f"Error saving text file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save text file: {str(e)}")

def cleanup_temp_files(*file_paths: Path) -> None:
    """清理多个临时文件"""
    for file_path in file_paths:
        cleanup_temp_file(file_path)

class AudioFileValidator:
    """音频文件验证器"""

    @staticmethod
    def validate_audio_data(audio_path: str) -> Tuple[np.ndarray, int]:
        """验证音频文件并返回音频数据和采样率"""
        try:
            audio_data, sample_rate = sf.read(audio_path)
            if audio_data.ndim == 2:
                # 转换为单声道
                audio_data = np.mean(audio_data, axis=1)
            return audio_data, sample_rate
        except Exception as e:
            logger.error(f"Error validating audio file {audio_path}: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid audio file: {str(e)}")