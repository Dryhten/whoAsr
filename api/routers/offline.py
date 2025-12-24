"""HTTP routes for offline speech recognition functionality"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from ..core.model import get_offline_model, run_offline_recognition
from ..core.models import ModelType
from ..core.config import logger
from ..core.file_utils import (
    generate_unique_id,
    save_upload_file,
    cleanup_temp_file,
    validate_audio_file,
)

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
        # Validate file format
        validate_audio_file(file.filename)

        # Read file content first to get size
        content = await file.read()
        file_size = len(content)

        # Generate unique ID and save file
        file_id = generate_unique_id()
        temp_file_path = save_upload_file(file, file_id, content)

        logger.info(f"File uploaded: {file.filename} -> {temp_file_path}")

        # Perform recognition
        results = await run_offline_recognition(
            file_path=str(temp_file_path),
            batch_size_s=batch_size_s,
            batch_size_threshold_s=batch_size_threshold_s,
            hotword=hotword,
        )

        return OfflineRecognitionResponse(
            success=True,
            results=results,
            file_name=file.filename,
            file_size=file_size,
            message="Recognition completed successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during offline recognition: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to recognize audio: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if temp_file_path:
            cleanup_temp_file(temp_file_path)
