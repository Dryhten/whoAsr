"""Configuration and constants for speech recognition API"""

import logging

# FunASR configuration
CHUNK_SIZE = [0, 10, 5]  # [0, 10, 5] 600ms, [0, 8, 4] 480ms
ENCODER_CHUNK_LOOK_BACK = 4  # number of chunks to lookback for encoder self-attention
DECODER_CHUNK_LOOK_BACK = 1  # number of encoder chunks to lookback for decoder cross-attention

# Audio parameters
SAMPLE_RATE = 16000  # FunASR typically uses 16kHz
CHANNELS = 1
DTYPE = "float32"
CHUNK_STRIDE = CHUNK_SIZE[1] * 960 if isinstance(CHUNK_SIZE, list) else CHUNK_SIZE * 960  # 600ms, same as original


# Logging configuration
def setup_logging():
    """Setup logging configuration"""
    # Configure main logger
    logging.basicConfig(level=logging.WARNING)  # Only show warnings and errors in production
    logger = logging.getLogger(__name__)

    # Create a separate debug logger for detailed information
    debug_logger = logging.getLogger("debug")
    debug_logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    debug_logger.addHandler(handler)

    return logger, debug_logger


# Global logger instances
logger, debug_logger = setup_logging()
