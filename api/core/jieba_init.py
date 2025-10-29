"""jieba 分词库初始化配置"""

import os
import jieba
from .settings import get_settings


def initialize_jieba():
    """初始化 jieba 分词库，配置缓存目录"""
    settings = get_settings()

    # 确保缓存目录存在（处理相对路径）
    cache_dir = settings.jieba_cache_dir
    if not os.path.isabs(cache_dir):
        # 如果是相对路径，基于项目根目录
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        cache_dir = os.path.join(project_root, cache_dir)

    os.makedirs(cache_dir, exist_ok=True)

    # 设置 jieba 缓存目录
    cache_file = os.path.join(cache_dir, "jieba.cache")

    # 配置 jieba 使用自定义缓存目录
    jieba.dt.cache_file = cache_file

    # 设置环境变量，确保 jieba 使用我们的缓存目录
    os.environ["JIEBA_CACHE_FILE"] = cache_file

    # 如果缓存文件不存在，尝试创建
    if not os.path.exists(cache_file):
        try:
            # 强制初始化 jieba 以生成缓存
            jieba.initialize()
            print(f"Jieba cache initialized at: {cache_file}")
        except Exception as e:
            print(f"Warning: Failed to initialize jieba cache: {e}")
            # 继续运行，jieba 会在需要时重新初始化
    else:
        print(f"Using existing jieba cache: {cache_file}")


def get_jieba_cache_info():
    """获取 jieba 缓存信息"""
    settings = get_settings()

    # 处理相对路径
    cache_dir = settings.jieba_cache_dir
    if not os.path.isabs(cache_dir):
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        cache_dir = os.path.join(project_root, cache_dir)

    cache_file = os.path.join(cache_dir, "jieba.cache")

    return {
        "cache_dir": cache_dir,
        "cache_file": cache_file,
        "cache_exists": os.path.exists(cache_file),
        "cache_size": os.path.getsize(cache_file) if os.path.exists(cache_file) else 0,
    }
