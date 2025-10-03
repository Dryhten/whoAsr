"""Timestamp (时间戳预测) API routes"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from pydantic import BaseModel

from ..core.model import get_timestamp_model, is_timestamp_model_loaded
from ..core.schemas import UploadResponse, ProcessingResponse
from ..core.file_utils import (
    generate_unique_id, validate_audio_file, save_upload_file,
    save_text_file, cleanup_temp_files, validate_file_exists
)
from ..core.model_utils import process_model_request
from ..core.config import logger

router = APIRouter(prefix="/timestamp", tags=["Timestamp"])




@router.post("/upload", response_model=UploadResponse)
async def upload_files(
    audio_file: UploadFile = File(...),
    text_file: Optional[UploadFile] = File(None),
    text_content: Optional[str] = Form(None)
):
    """Upload audio and text files for timestamp prediction"""
    validate_audio_file(audio_file.filename)

    file_id = generate_unique_id()
    audio_file_path = save_upload_file(audio_file, file_id)

    text_file_path = None
    if text_file:
        text_file_path = save_upload_file(text_file, file_id)
    elif text_content:
        text_file_path = save_text_file(text_content, file_id)

    logger.info(f"Files uploaded - Audio: {audio_file.filename}, Text: {text_file.filename if text_file else 'Direct input'}")

    return UploadResponse(
        success=True,
        message="Files uploaded successfully",
        file_path=str(audio_file_path)
    )




@router.post("/upload_and_predict", response_model=ProcessingResponse)
async def upload_and_predict(
    audio_file: UploadFile = File(...),
    text_file: Optional[UploadFile] = File(None),
    text_content: Optional[str] = Form(None)
):
    """Upload files and predict timestamps in one step"""
    validate_audio_file(audio_file.filename)
    if not text_file and not text_content:
        raise HTTPException(status_code=400, detail="Either text_file or text_content is required")

    file_id = generate_unique_id()
    audio_file_path = save_upload_file(audio_file, file_id)

    text_file_path = None
    if text_file:
        text_file_path = save_upload_file(text_file, file_id)

    # Create request object for unified processing
    class TempRequest:
        def __init__(self, audio_path: str, text_path: Optional[str], text: Optional[str]):
            self.audio_file_path = audio_path
            self.text_file_path = text_path
            self.text_content = text

    temp_request = TempRequest(str(audio_file_path), str(text_file_path) if text_file_path else None, text_content)

    try:
        results = process_model_request(
            model_getter=get_timestamp_model,
            model_checker=is_timestamp_model_loaded,
            model_name="Timestamp",
            request=temp_request
        )

        cleanup_temp_files(str(audio_file_path), str(text_file_path) if text_file_path else None)

        return ProcessingResponse(
            success=True,
            message="Timestamp prediction completed successfully",
            results=results
        )
    except Exception as e:
        cleanup_temp_files(str(audio_file_path), str(text_file_path) if text_file_path else None)
        raise