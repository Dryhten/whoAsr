"""生产环境配置管理"""

import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用配置"""

    # 服务器配置
    host: str = "0.0.0.0"
    port: int = 8000

    # 前端配置
    frontend_url: str = "http://localhost:3000"
    dev_frontend_url: str = "http://localhost:5173"

    # 模型配置
    model_cache_dir: str = "/app/models/cache"
    auto_load_models: bool = False
    preload_models: str = ""  # 逗号分隔的模型列表
    # GPU配置: "cpu" 或 "cuda" 或 "cuda:0" (指定GPU编号)
    device: str = "cpu"

    @property
    def preload_models_list(self) -> List[str]:
        """将逗号分隔的字符串转换为列表"""
        if not self.preload_models:
            return []
        return [m.strip() for m in self.preload_models.split(",") if m.strip()]

    # 文件上传配置
    max_upload_size: int = 100  # MB
    temp_dir: str = "./tmp/whoasr"
    file_retention_hours: int = 24

    # jieba 缓存配置
    jieba_cache_dir: str = "./tmp/jieba_cache"

    # 安全配置
    jwt_secret: Optional[str] = None
    api_key: Optional[str] = None

    # 日志配置
    log_level: str = "INFO"
    log_file: Optional[str] = None
    access_log: bool = True

    # 性能配置
    websocket_timeout: int = 300
    max_connections: int = 1000
    request_timeout: int = 60

    # 监控配置
    enable_metrics: bool = True
    metrics_port: int = 9090

    # Redis配置 (可选)
    redis_url: Optional[str] = None
    redis_password: Optional[str] = None

    # 环境标识
    environment: str = "production"

    @property
    def debug(self) -> bool:
        """是否为调试模式"""
        return self.environment == "development"

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def cors_origins(self) -> List[str]:
        """获取CORS允许的源"""
        origins = [self.frontend_url]
        if self.debug:
            origins.append(self.dev_frontend_url)
        return origins

    @property
    def is_production(self) -> bool:
        """是否为生产环境"""
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        """是否为开发环境"""
        return self.environment == "development"


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


# 全局配置实例
settings = get_settings()
