"""HTTP routes for punctuation functionality"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..core.model import add_punctuation
from ..core.models import ModelType
from ..core.config import logger

# Create router instance
router = APIRouter(prefix="/punctuation", tags=["punctuation"])


class PunctuationRequest(BaseModel):
    """Request model for punctuation addition"""

    text: str


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
        # Add punctuation - the add_punctuation function will handle model loading
        punctuated_text = await add_punctuation(request.text)

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
