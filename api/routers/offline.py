"""HTTP routes for offline speech recognition functionality"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
import tempfile
import os
from pathlib import Path
from ..core.model import get_offline_model, run_offline_recognition
from ..core.models import ModelType
from ..core.config import logger

# Create router instance
router = APIRouter(prefix="/offline", tags=["offline"])


class OfflineRecognitionRequest(BaseModel):
    """Request model for offline recognition"""

    file_path: str
    batch_size_s: Optional[int] = 300
    batch_size_threshold_s: Optional[int] = 60
    hotword: Optional[str] = None


class OfflineRecognitionResponse(BaseModel):
    """Response model for offline recognition"""

    success: bool
    results: Optional[List[dict]] = None
    message: Optional[str] = None
    file_name: Optional[str] = None


@router.post("/upload", response_model=dict)
async def upload_audio_file(file: UploadFile = File(...)):
    """Upload audio file for offline recognition"""
    try:
        # Check file type
        allowed_types = [
            "audio/wav",
            "audio/mp3",
            "audio/mpeg",
            "audio/m4a",
            "audio/flac",
            "audio/ogg",
        ]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Allowed types: {', '.join(allowed_types)}",
            )

        # Create temporary file
        temp_dir = tempfile.mkdtemp()
        temp_file_path = os.path.join(temp_dir, f"upload_{file.filename}")

        # Save uploaded file
        with open(temp_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        logger.info(f"File uploaded successfully: {file.filename} -> {temp_file_path}")

        return {
            "success": True,
            "file_path": temp_file_path,
            "file_name": file.filename,
            "file_size": len(content),
            "message": "File uploaded successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.post("/recognize", response_model=OfflineRecognitionResponse)
async def recognize_audio_file(
    file_path: str = Form(...),
    batch_size_s: Optional[int] = Form(300),
    batch_size_threshold_s: Optional[int] = Form(60),
    hotword: Optional[str] = Form(None),
):
    """Perform offline recognition on uploaded audio file"""
    try:
        # Check if file exists
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Audio file not found")

        # Perform recognition using the core function
        results = run_offline_recognition(
            file_path=file_path,
            batch_size_s=batch_size_s,
            batch_size_threshold_s=batch_size_threshold_s,
            hotword=hotword,
        )

        # Get file name from path
        file_name = os.path.basename(file_path)

        return OfflineRecognitionResponse(
            success=True,
            results=results,
            file_name=file_name,
            message="Recognition completed successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during offline recognition: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to recognize audio: {str(e)}"
        )


@router.get("/info")
async def get_offline_info():
    """Get offline model info"""
    return {
        "model_type": ModelType.OFFLINE_ASR.value,
        "display_name": "离线语音识别",
        "description": "基于FunASR的高精度离线中文语音识别模型",
        "supported_formats": ["wav", "mp3", "mpeg", "m4a", "flac", "ogg"],
        "features": ["VAD", "punctuation", "speaker diarization"],
        "default_params": {
            "batch_size_s": 300,
            "batch_size_threshold_s": 60,
            "vad_max_segment_time": 60000,
        },
        "note": "Use /model/status for current model status and /model/load to load the model"
    }