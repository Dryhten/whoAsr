"""生产环境配置管理"""

import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用配置"""

    # 服务器配置
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))

    # 前端配置
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    dev_frontend_url: str = os.getenv("DEV_FRONTEND_URL", "http://localhost:5173")

    # 模型配置
    model_cache_dir: str = os.getenv("MODEL_CACHE_DIR", "/app/models/cache")
    auto_load_models: bool = os.getenv("AUTO_LOAD_MODELS", "false").lower() == "true"
    preload_models: List[str] = os.getenv("PRELOAD_MODELS", "").split(",") if os.getenv("PRELOAD_MODELS") else []

    # 文件上传配置
    max_upload_size: int = int(os.getenv("MAX_UPLOAD_SIZE", "100"))  # MB
    temp_dir: str = os.getenv("TEMP_DIR", "/tmp/whoasr")
    file_retention_hours: int = int(os.getenv("FILE_RETENTION_HOURS", "24"))

    # 安全配置
    jwt_secret: Optional[str] = os.getenv("JWT_SECRET")
    api_key: Optional[str] = os.getenv("API_KEY")

    # 日志配置
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    log_file: Optional[str] = os.getenv("LOG_FILE")
    access_log: bool = os.getenv("ACCESS_LOG", "true").lower() == "true"

    # 性能配置
    websocket_timeout: int = int(os.getenv("WEBSOCKET_TIMEOUT", "300"))
    max_connections: int = int(os.getenv("MAX_CONNECTIONS", "1000"))
    request_timeout: int = int(os.getenv("REQUEST_TIMEOUT", "60"))

    # 监控配置
    enable_metrics: bool = os.getenv("ENABLE_METRICS", "true").lower() == "true"
    metrics_port: int = int(os.getenv("METRICS_PORT", "9090"))

    # Redis配置 (可选)
    redis_url: Optional[str] = os.getenv("REDIS_URL")
    redis_password: Optional[str] = os.getenv("REDIS_PASSWORD")

    # 环境标识
    environment: str = os.getenv("ENVIRONMENT", "production")
    debug: bool = environment == "development"

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