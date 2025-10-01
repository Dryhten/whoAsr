# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time Speech Recognition API built with FastAPI and FunASR. The project provides WebSocket-based streaming speech recognition using FunASR's paraformer-zh-streaming model for Chinese speech recognition.

## Key Commands

### Development
```bash
# Install dependencies
uv sync

# Run the main API server (recommended)
uv run python api/main.py

# Alternative: Run legacy server
uv run python api_server.py

# Run FunASR standalone server
uv run python funasr_server.py

# Run example scripts
uv run python example/main.py
uv run python example/offline_main.py
```

### Testing
```bash
# Test timing performance
uv run python test_funasr_timing.py

# Access web interface for testing
# Open http://localhost:8000 in browser
```

## Architecture

### Core Components

1. **FastAPI Application** (`api/main.py`):
   - Main entry point for the modular API
   - Includes startup event for model loading
   - Serves test HTML page and health check endpoint
   - Registers WebSocket and punctuation routes

2. **Model Management** (`api/core/model.py`):
   - Global singleton instances for ASR and punctuation models
   - Lazy loading with `load_model()` and `load_punctuation_model()`
   - FunASR AutoModel integration for both paraformer-zh-streaming and ct-punc models

3. **Connection Management** (`api/core/connection.py`):
   - WebSocket connection lifecycle management
   - Per-client audio buffering and state management
   - Audio processing pipeline integration

4. **Configuration** (`api/core/config.py`):
   - FunASR streaming parameters (chunk_size, look_back settings)
   - Audio format specifications (16kHz, mono, float32)
   - Logging configuration

### Audio Processing Pipeline

1. **Client sends** base64-encoded audio chunks via WebSocket
2. **Server decodes** audio (supports float32, int16, int32 formats)
3. **Audio buffering** accumulates samples to chunk_stride (600ms chunks)
4. **FunASR processing** with streaming inference and cache management
5. **Real-time results** sent back to client as recognition results

### Key Parameters

- **chunk_size**: [0, 10, 5] = 600ms audio chunks
- **encoder_chunk_look_back**: 4 chunks for encoder self-attention
- **decoder_chunk_look_back**: 1 chunk for decoder cross-attention
- **Sample Rate**: 16kHz (auto-resampled if different)
- **Audio Format**: 32-bit float, normalized to [-1, 1]

## API Endpoints

### WebSocket
- `ws://localhost:8000/ws/{client_id}` - Real-time speech recognition

### HTTP
- `GET /` - Web test interface
- `GET /health` - Health check with model status
- `POST /punctuation/add` - Add punctuation to text
- `GET /punctuation/status` - Check punctuation model status
- `POST /punctuation/load` - Load punctuation model

## Project Structure

```
whoAsr/
├── api/                    # Modular FastAPI application
│   ├── main.py            # FastAPI app entry point
│   ├── core/
│   │   ├── model.py       # Model management (ASR + punctuation)
│   │   ├── config.py      # Configuration constants
│   │   ├── connection.py  # WebSocket connection management
│   │   └── audio.py       # Audio processing utilities
│   └── routers/
│       ├── websocket.py   # WebSocket routes
│       └── punctuation.py # HTTP punctuation routes
├── example/               # Example scripts
│   ├── main.py           # Basic usage example
│   ├── offline_main.py   # Offline recognition
│   └── vad_main.py       # Voice Activity Detection
├── api_server.py         # Legacy monolithic server
├── funasr_server.py      # Standalone FunASR server
├── test_simple.html      # Web test interface
└── pyproject.toml        # Dependencies and config
```

## Development Notes

- The project uses **uv** for dependency management
- Two server implementations exist: `api/main.py` (modular) and `api_server.py` (legacy)
- FunASR models are loaded once at startup and kept in memory
- WebSocket connections maintain per-client state including audio buffers and model cache
- Audio format detection is robust - tries float32, int16, and int32 formats
- Logging is configured to show warnings/errors only, with separate debug logger