"""HTTP routes for punctuation functionality"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..core.model import (
    add_punctuation,
    is_punctuation_model_loaded,
    load_punctuation_model,
)
from ..core.config import logger

# Create router instance
router = APIRouter(prefix="/punctuation", tags=["punctuation"])


class PunctuationRequest(BaseModel):
    """Request model for punctuation addition"""

    text: str
    force_load: Optional[bool] = False


class PunctuationResponse(BaseModel):
    """Response model for punctuation addition"""

    original_text: str
    punctuated_text: str
    success: bool
    message: Optional[str] = None


@router.post("/add", response_model=PunctuationResponse)
async def add_punctuation_endpoint(request: PunctuationRequest):
    """Add punctuation to text"""
    try:
        # Ensure punctuation model is loaded
        if not is_punctuation_model_loaded():
            if request.force_load:
                load_punctuation_model()
            else:
                raise HTTPException(
                    status_code=503,
                    detail="Punctuation model not loaded. Set force_load=true to load it.",
                )

        # Add punctuation
        punctuated_text = add_punctuation(request.text)

        return PunctuationResponse(
            original_text=request.text,
            punctuated_text=punctuated_text,
            success=True,
            message="Punctuation added successfully",
        )

    except Exception as e:
        logger.error(f"Error adding punctuation: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to add punctuation: {str(e)}"
        )


@router.get("/status")
async def get_punctuation_status():
    """Get punctuation model status"""
    return {"model_loaded": is_punctuation_model_loaded(), "model_name": "ct-punc"}


@router.post("/load")
async def load_punctuation_model_endpoint():
    """Load punctuation model"""
    try:
        success = load_punctuation_model()
        return {
            "success": success,
            "message": (
                "Punctuation model loaded successfully"
                if success
                else "Failed to load punctuation model"
            ),
        }
    except Exception as e:
        logger.error(f"Error loading punctuation model: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to load punctuation model: {str(e)}"
        )
