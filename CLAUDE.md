# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time Speech Recognition API built with FastAPI and FunASR. The project provides WebSocket-based streaming speech recognition using FunASR's paraformer-zh-streaming model for Chinese speech recognition, with comprehensive support for VAD, punctuation restoration, and timestamp prediction.

## Key Commands

### Development
```bash
# Install Python dependencies (uses uv package manager)
uv sync

# Run the main API server (recommended modular implementation)
uv run python api/main.py

# Alternative: Run legacy monolithic server
uv run python api_server.py

# Run FunASR standalone server
uv run python funasr_server.py

# Run example scripts
uv run python example/main.py
uv run python example/offline_main.py
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev      # Development server with hot reload
npm run build    # Production build (served by FastAPI)
```

### Testing
```bash
# Run API test suite (comprehensive endpoint testing)
./curl_test/run_all_tests.sh

# Run individual tests
./curl_test/test_offline_asr.sh
./curl_test/test_punctuation.sh
./curl_test/test_vad.sh

# Test timing performance
uv run python test_funasr_timing.py

# Access web interface for testing
# Open http://localhost:8000 in browser
```

## Architecture

### Core Components

1. **FastAPI Application** (`api/main.py`):
   - Main entry point with modular router registration
   - SPA routing support (serves frontend from /)
   - Startup event for model initialization
   - Health check endpoint with comprehensive service status

2. **Model Management** (`api/core/model.py`):
   - Global singleton instances for all model types
   - Dynamic model loading/unloading system
   - FunASR AutoModel integration for:
     - paraformer-zh-streaming (real-time ASR)
     - paraformer-zh (offline ASR)
     - ct-punc (punctuation restoration)
     - fsmn-vad (voice activity detection)
     - timestamp prediction models

3. **Connection Management** (`api/core/connection.py`):
   - WebSocket connection lifecycle management
   - Per-client audio buffering and state
   - Streaming inference with cache management
   - Separate connections for ASR and VAD

4. **Model Types** (`api/core/models.py`):
   - ModelType enumeration for all supported models
   - ModelConfig class for model metadata
   - Dependency management between models

5. **Router Architecture** (`api/routers/`):
   - **websocket.py**: Real-time ASR WebSocket endpoints
   - **offline.py**: Offline file recognition endpoints
   - **vad.py**: Voice Activity Detection (HTTP + WebSocket)
   - **punctuation.py**: Text punctuation restoration
   - **timestamp.py**: Timestamp prediction
   - **model.py**: Model management endpoints

### Audio Processing Pipeline

1. **Client sends** base64-encoded audio chunks via WebSocket
2. **Server decodes** audio (auto-detects float32, int16, int32)
3. **Audio buffering** accumulates to 600ms chunks
4. **FunASR processing** with streaming inference
5. **Real-time results** with partial and final recognition

### Key Parameters

- **chunk_size**: [0, 10, 5] = 600ms audio chunks
- **encoder_chunk_look_back**: 4 chunks (2.4s context)
- **decoder_chunk_look_back**: 1 chunk (600ms context)
- **Sample Rate**: 16kHz (auto-resampled)
- **Audio Format**: Normalized to [-1, 1]

## API Endpoints

### WebSocket Endpoints
- `ws://localhost:8000/ws/{client_id}` - Real-time speech recognition
- `ws://localhost:8000/vad/ws/{client_id}` - Real-time VAD detection

### HTTP Endpoints
- **Core**: `GET /`, `GET /health`, `GET /docs` (FastAPI docs)
- **Model Management**: `/model/info`, `/model/load`, `/model/unload/{type}`, `/model/config/{type}`
- **Offline ASR**: `POST /offline/recognize`
- **VAD**: `POST /vad/detect`
- **Punctuation**: `POST /punctuation/add`, `GET /punctuation/status`
- **Timestamp**: `POST /timestamp/predict`

## Project Structure

```
whoAsr/
├── api/                     # Modular FastAPI application
│   ├── main.py             # Entry point + SPA routing + model registry
│   ├── core/               # Core infrastructure
│   │   ├── model.py        # Model singleton management
│   │   ├── models.py       # Model type definitions
│   │   ├── config.py      # FunASR configuration
│   │   ├── connection.py  # WebSocket management
│   │   └── audio.py       # Audio utilities
│   └── routers/            # Feature-based routing
│       ├── websocket.py    # Real-time ASR
│       ├── offline.py      # File-based ASR
│       ├── vad.py          # Voice Activity Detection
│       ├── punctuation.py  # Text punctuation
│       ├── timestamp.py    # Timestamp prediction
│       └── model.py        # Model lifecycle
├── frontend/               # Preact + TypeScript SPA
│   ├── src/
│   │   ├── api.ts         # API client with type safety
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Feature pages
│   │   └── lib/           # Shared utilities
│   └── dist/              # Built assets (served by FastAPI)
├── curl_test/             # Comprehensive API test suite
│   ├── run_all_tests.sh   # Master test runner
│   ├── test_*.sh          # Individual endpoint tests
│   └── README.md          # Test documentation
├── docs/                  # Project documentation
│   ├── api-context-guide.md  # Context engineering guide
│   └── README.md          # Documentation index
├── example/               # Usage examples
└── pyproject.toml         # Python dependencies (uv)
```

## Frontend Architecture

- **Framework**: Preact (lightweight React alternative)
- **Type Safety**: Full TypeScript with proper type definitions
- **Styling**: Tailwind CSS 4 with component library
- **State Management**: Custom hooks for API interactions
- **Build System**: Vite with Preact preset

After `npm run build`, FastAPI serves the SPA from `/`, enabling single-server deployment.

## Context Engineering

The project includes comprehensive context engineering best practices in `docs/api-context-guide.md`:
- Audio context optimization for streaming
- Text context handling for punctuation
- Multi-modal context fusion techniques
- Performance optimization strategies

## Development Notes

- **Package Management**: Uses `uv` for Python, `npm` for frontend
- **Model Loading**: Lazy loading with optional auto-load on startup
- **Memory Management**: Models can be unloaded to free memory
- **Audio Format**: Robust auto-detection of common formats
- **Logging**: Warning level by default, debug logger available
- **Testing**: Complete curl test suite for all endpoints
- **Documentation**: Context engineering guide for optimal API usage