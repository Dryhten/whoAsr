"""HTTP routes for model management functionality"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from ..core.model import (
    load_model_by_type,
    is_model_loaded_by_type,
    unload_model_by_type,
    get_loaded_models_status,
)
from ..core.models import ModelType, get_model_config
from ..core.config import logger

# Create router instance
router = APIRouter(prefix="/asr/model", tags=["model"])


class ModelLoadRequest(BaseModel):
    """Request model for model loading"""

    model_type: ModelType


class ModelLoadResponse(BaseModel):
    """Response model for model loading"""

    success: bool
    model_type: str
    message: str
    loaded: bool


class ModelUnloadResponse(BaseModel):
    """Response model for model unloading"""

    success: bool
    model_type: str
    message: str
    loaded: bool


class ModelInfoResponse(BaseModel):
    """Response model for model information"""

    models: Dict[str, Dict[str, Any]]
    total_loaded: int
    available_models: Dict[str, Dict[str, Any]]


@router.post("/load", response_model=ModelLoadResponse)
async def load_model(request: ModelLoadRequest):
    """Load a specific model by type"""
    try:
        model_type = request.model_type
        config = get_model_config(model_type)

        if not config:
            raise HTTPException(status_code=400, detail=f"Invalid model type: {model_type.value}")

        # Check if already loaded
        if is_model_loaded_by_type(model_type):
            return ModelLoadResponse(
                success=True,
                model_type=model_type.value,
                message=f"{config.display_name} is already loaded",
                loaded=True,
            )

        # Load the model
        success = load_model_by_type(model_type)

        if success:
            return ModelLoadResponse(
                success=True,
                model_type=model_type.value,
                message=f"{config.display_name} loaded successfully",
                loaded=True,
            )
        else:
            return ModelLoadResponse(
                success=False,
                model_type=model_type.value,
                message=f"Failed to load {config.display_name}",
                loaded=False,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading model {request.model_type.value}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")


@router.post("/unload/{model_type}", response_model=ModelUnloadResponse)
async def unload_model(model_type: str):
    """Unload a specific model by type"""
    try:
        # Validate model type
        try:
            model_enum = ModelType(model_type)
        except ValueError:
            available_types = [t.value for t in ModelType]
            raise HTTPException(
                status_code=400, detail=f"Invalid model type: {model_type}. Available types: {available_types}"
            )

        config = get_model_config(model_enum)

        # Check if model is loaded
        if not is_model_loaded_by_type(model_enum):
            display_name = config.display_name if config else model_type
            return ModelUnloadResponse(
                success=True, model_type=model_type, message=f"{display_name} is not loaded", loaded=False
            )

        # Unload the model
        success = unload_model_by_type(model_enum)
        display_name = config.display_name if config else model_type

        if success:
            return ModelUnloadResponse(
                success=True, model_type=model_type, message=f"{display_name} unloaded successfully", loaded=False
            )
        else:
            return ModelUnloadResponse(
                success=False,
                model_type=model_type,
                message=f"Failed to unload {display_name}",
                loaded=is_model_loaded_by_type(model_enum),
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unloading model {model_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to unload model: {str(e)}")


@router.get("/info", response_model=ModelInfoResponse)
async def get_model_info():
    """Get comprehensive information about all models"""
    try:
        # Get loaded models status
        models_status = get_loaded_models_status()
        total_loaded = sum(1 for status in models_status.values() if status["loaded"])

        # Get available model types with full information
        available_models = {}
        for model_type in ModelType:
            config = get_model_config(model_type)
            loaded_status = models_status.get(model_type.value, {})

            available_models[model_type.value] = {
                "display_name": config.display_name if config else model_type.value,
                "description": config.description if config else "",
                "model_name": config.model_name if config else "",
                "auto_load": config.auto_load if config else False,
                "dependencies": config.dependencies if config else [],
                "loaded": loaded_status.get("loaded", False),
                "config": config.config if config else {},
            }

        return ModelInfoResponse(models=models_status, total_loaded=total_loaded, available_models=available_models)

    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get model info: {str(e)}")


@router.get("/config/{model_type}")
async def get_model_type_config(model_type: str):
    """Get configuration for a specific model type"""
    try:
        # Validate model type
        try:
            model_enum = ModelType(model_type)
        except ValueError:
            available_types = [t.value for t in ModelType]
            raise HTTPException(
                status_code=400, detail=f"Invalid model type: {model_type}. Available types: {available_types}"
            )

        config = get_model_config(model_enum)
        if not config:
            raise HTTPException(status_code=404, detail=f"Configuration not found for model type: {model_type}")

        return {
            "model_type": model_type,
            "display_name": config.display_name,
            "description": config.description,
            "model_name": config.model_name,
            "auto_load": config.auto_load,
            "dependencies": config.dependencies,
            "config": config.config,
            "loaded": is_model_loaded_by_type(model_enum),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting model config {model_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get model config: {str(e)}")
