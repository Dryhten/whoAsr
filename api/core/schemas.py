"""
通用的API响应模型
遵循KISS原则：简化响应结构定义
"""

from typing import Optional, List, Dict, Any, TypeVar, Generic
from pydantic import BaseModel

T = TypeVar('T')

class BaseResponse(BaseModel, Generic[T]):
    """通用响应基类"""
    success: bool
    message: str
    data: Optional[T] = None

class UploadResponse(BaseModel):
    """文件上传响应"""
    success: bool
    message: str
    file_path: Optional[str] = None

class ProcessingResponse(BaseModel):
    """处理结果响应"""
    success: bool
    message: str
    results: Optional[List[Dict[str, Any]]] = None

class StatusResponse(BaseModel):
    """状态查询响应"""
    status: str
    models: Dict[str, Any]
    total_loaded: int

# 特定功能的响应类
class AudioProcessingResponse(ProcessingResponse):
    """音频处理响应基类"""
    segments: Optional[List[Dict[str, Any]]] = None

class ModelOperationResponse(BaseResponse[bool]):
    """模型操作响应"""
    model_type: str
    loaded: bool

class ErrorResponse(BaseModel):
    """错误响应"""
    success: bool = False
    error: str
    detail: Optional[str] = None