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




class OfflineRecognitionResponse(BaseModel):
    """Response model for offline recognition"""

    success: bool
    results: Optional[List[dict]] = None
    message: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None




@router.post("/recognize", response_model=OfflineRecognitionResponse)
async def recognize_audio_file(
    file: UploadFile = File(...),
    batch_size_s: Optional[int] = Form(300),
    batch_size_threshold_s: Optional[int] = Form(60),
    hotword: Optional[str] = Form(None),
):
    """Upload and perform offline recognition on audio file"""
    temp_file_path = None
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
        content = await file.read()
        with open(temp_file_path, "wb") as buffer:
            buffer.write(content)

        logger.info(f"File uploaded successfully: {file.filename} -> {temp_file_path}")

        # Perform recognition using the core function
        results = run_offline_recognition(
            file_path=temp_file_path,
            batch_size_s=batch_size_s,
            batch_size_threshold_s=batch_size_threshold_s,
            hotword=hotword,
        )

        return OfflineRecognitionResponse(
            success=True,
            results=results,
            file_name=file.filename,
            file_size=len(content),
            message="Recognition completed successfully",
        )

    except HTTPException:
        # Clean up temporary file if it exists
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                # Remove temp directory if empty
                temp_dir = os.path.dirname(temp_file_path)
                if os.path.exists(temp_dir) and not os.listdir(temp_dir):
                    os.rmdir(temp_dir)
            except Exception:
                pass
        raise
    except Exception as e:
        logger.error(f"Error during offline recognition: {e}")

        # Clean up temporary file if it exists
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                # Remove temp directory if empty
                temp_dir = os.path.dirname(temp_file_path)
                if os.path.exists(temp_dir) and not os.listdir(temp_dir):
                    os.rmdir(temp_dir)
            except Exception:
                pass

        raise HTTPException(
            status_code=500, detail=f"Failed to recognize audio: {str(e)}"
        )


