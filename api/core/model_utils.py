"""
通用模型处理工具
遵循KISS原则：简化模型调用逻辑
"""

from typing import Any, List, Dict, Optional, Tuple
from fastapi import HTTPException
from .config import logger

def validate_model_loaded(model_checker, model_name: str) -> None:
    """验证模型是否已加载"""
    if not model_checker():
        raise HTTPException(
            status_code=503,
            detail=f"{model_name} model not loaded. Please load the model using POST /model/load with model_type='{model_name}'",
        )

def get_text_input(request: Any) -> str:
    """从请求中获取文本输入"""
    if request.text_content:
        return request.text_content
    elif request.text_file_path:
        from .file_utils import read_text_file
        return read_text_file(request.text_file_path)
    else:
        raise HTTPException(status_code=400, detail="Text content is required")

def extract_timestamp_results(model_output: List[Any]) -> List[Dict[str, Any]]:
    """从模型输出中提取时间戳结果"""
    results = []
    if not model_output:
        return results

    for item in model_output:
        if isinstance(item, dict):
            result_item = {
                "text": item.get("text", ""),
                "start": item.get("start", 0),
                "end": item.get("end", 0),
                "confidence": item.get("confidence", 0.0)
            }
            results.append(result_item)
        elif isinstance(item, list) and len(item) >= 3:
            result_item = {
                "text": str(item[0]),
                "start": float(item[1]) if item[1] is not None else 0,
                "end": float(item[2]) if item[2] is not None else 0,
                "confidence": float(item[3]) if len(item) > 3 and item[3] is not None else 0.0
            }
            results.append(result_item)

    return results

def cleanup_files_safely(*file_paths: Optional[str]) -> None:
    """安全清理文件"""
    from .file_utils import cleanup_temp_files

    valid_paths = [p for p in file_paths if p]
    if valid_paths:
        cleanup_temp_files(*[p for p in valid_paths if p])

def process_model_request(
    model_getter,
    model_checker,
    model_name: str,
    request: Any,
    text_getter = get_text_input,
    results_extractor = extract_timestamp_results,
    audio_param: str = "audio_file_path",
    text_param: Optional[str] = "text_content",
    extra_cleanup: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """通用的模型处理流程"""

    # 验证模型已加载
    validate_model_loaded(model_checker, model_name)

    # 获取模型实例
    model = model_getter()
    if model is None:
        raise HTTPException(status_code=503, detail=f"{model_name} model not available")

    # 获取文本输入
    try:
        text_input = text_getter(request)
        logger.info(f"Processing {model_name.lower()} for audio: {getattr(request, audio_param)}")
        logger.info(f"Text length: {len(text_input)} characters")

        # 调用模型
        if text_param:
            # 对于需要文本参数的模型
            model_output = model.generate(
                input=(getattr(request, audio_param), text_input),
                data_type=("sound", "text")
            )
        else:
            # 对于只需要音频的模型
            model_output = model.generate(input=getattr(request, audio_param))

        # 提取结果
        results = results_extractor(model_output)
        logger.info(f"{model_name} processing completed, found {len(results)} segments")

        return results

    except Exception as e:
        logger.error(f"Error in {model_name.lower()} processing: {e}")
        raise HTTPException(status_code=500, detail=f"{model_name} processing failed: {str(e)}")