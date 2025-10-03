# whoAsr API Reference for AI Agents

## 🤖 CONTEXT ENGINEERING GUIDE

This documentation is specifically designed for AI agents and LLMs to understand and integrate with the whoAsr real-time speech recognition system.

### PROMPT ENGINEERING SUMMARY

You are an AI agent tasked with integrating speech recognition capabilities. whoAsr provides:

**Core Function**: Real-time Chinese speech recognition using FunASR's paraformer-zh-streaming model
**Architecture**: FastAPI backend with WebSocket streaming + HTTP REST APIs
**Key Features**: Live transcription, file recognition, punctuation restoration, model management
**Target Use Cases**: Voice assistants, transcription services, real-time captioning, voice interfaces

## 🎯 QUICK INTEGRATION PATTERNS

### For Real-time Applications
```python
# Use WebSocket for live transcription
ws_url = "ws://localhost:8000/ws/{client_id}"
# Send base64 audio chunks, receive real-time text results
```

### For Batch Processing
```python
# Use HTTP for file-based recognition
POST /recognize with multipart file upload
# Returns complete transcription with punctuation
```

### For Model Control
```python
# Check model status: GET /model/info
# Load models: POST /model/load
# Unload: DELETE /model/unload/{model_type}
```

## 📊 API ARCHITECTURE OVERVIEW

### System Components
- **Streaming ASR Engine**: FunASR paraformer-zh-streaming for Chinese speech recognition
- **Punctuation Model**: FunASR ct-punc for text punctuation restoration
- **WebSocket Server**: Real-time bidirectional audio streaming
- **HTTP REST API**: File upload, model management, health checks
- **Connection Manager**: Multi-client session handling with per-client audio buffers

### Audio Processing Pipeline
1. **Input**: Raw audio (any format) → Base64 encoding
2. **Resampling**: Auto convert to 16kHz mono float32
3. **Chunking**: 600ms processing windows with overlap
4. **Inference**: FunASR streaming ASR with cache management
5. **Output**: Real-time text results with confidence scores

### Performance Characteristics
- **Latency**: ~600ms initial response, ~200ms incremental updates
- **Concurrency**: Supports multiple simultaneous WebSocket connections
- **Audio Formats**: Auto-detection (float32, int16, int32)
- **Sample Rate**: Auto-resampling to 16kHz
- **Model Memory**: ~1GB RAM for ASR model + ~200MB for punctuation

## 🔧 ESSENTIAL INTEGRATION CONCEPTS

### Model Lifecycle Management
- Models are loaded on-demand and kept in memory
- Check model status before making recognition requests
- Use `auto_load_models=true` for production deployments
- Graceful degradation when models are unavailable

### Connection State Management
- Each WebSocket connection maintains independent audio buffers
- Client IDs must be unique per session
- Connection timeout: 30 seconds without audio data
- Automatic cleanup on disconnect

### Error Handling Patterns
- Always handle WebSocket connection errors gracefully
- Check for model availability before processing
- Implement retry logic with exponential backoff
- Validate audio format and size constraints

### Audio Format Best Practices
- **Optimal**: 16kHz, mono, 32-bit float
- **Supported**: Any sample rate (auto-resampled), any bit depth (auto-converted)
- **Chunk Size**: 1024-4096 samples per WebSocket message
- **Encoding**: Base64 for WebSocket transmission

## 🚀 DEPLOYMENT CONSIDERATIONS

### Resource Requirements
- **CPU**: 4+ cores recommended for real-time processing
- **Memory**: 4GB+ RAM for model loading and concurrent sessions
- **Storage**: 10GB+ for model files and logs
- **Network**: Stable connection for model downloads on first startup

### Configuration Management
- Environment variables control all major settings
- Use `ENVIRONMENT=production` for production deployments
- Configure `HOST=0.0.0.0` and appropriate `PORT` for external access
- Set `AUTO_LOAD_MODELS=true` to preload models on startup

### Scaling Strategies
- Horizontal scaling: Deploy multiple instances behind load balancer
- Model sharing: Use shared volume for model cache
- Connection distribution: Implement sticky sessions for WebSocket continuity
- Monitoring: Track model memory usage and connection counts

## 📝 INTEGRATION CHECKLIST

Before deploying whoAsr integration:

- [ ] Verify target environment meets resource requirements
- [ ] Configure appropriate environment variables
- [ ] Test model loading and status endpoints
- [ ] Implement proper error handling and retry logic
- [ ] Validate audio format compatibility
- [ ] Test connection management under load
- [ ] Set up monitoring for model health and system metrics
- [ ] Plan for model update and versioning strategy

## 🔍 COMMON INTEGRATION PATTERNS

### Voice Assistant Integration
```python
# Typical workflow for voice commands
1. Connect WebSocket with unique client_id
2. Start recording session
3. Stream audio continuously
4. Process real-time transcription results
5. Execute commands based on recognized text
6. Handle punctuation for natural language understanding
```

### Transcription Service Integration
```python
# Batch processing workflow
1. Upload audio file via HTTP POST /recognize
2. Monitor processing status
3. Retrieve complete transcription with punctuation
4. Handle long-form audio (supports >10min files)
5. Format output for downstream applications
```

### Real-time Captioning Integration
```python
# Live captioning workflow
1. Establish WebSocket connection
2. Configure low-latency settings
3. Stream audio from live source
4. Format real-time results for display
5. Handle timing and synchronization
```

## 📊 REFERENCE IMPLEMENTATIONS

See `/docs/examples/` directory for:
- Python client integration examples
- JavaScript frontend implementations
- Docker deployment configurations
- Monitoring and logging setups

## ⚠️ CRITICAL CONSTRAINTS

### Audio Constraints
- **Max File Size**: 100MB for HTTP uploads
- **WebSocket Chunk Size**: Recommended 1024-4096 samples
- **Supported Languages**: Chinese (Mandarin) primary
- **Audio Quality**: Clear speech required, background noise affects accuracy

### Rate Limiting
- **WebSocket Messages**: 100 messages/second per connection
- **HTTP Requests**: 10 requests/second per IP
- **Concurrent Connections**: Default 50, configurable via environment

### Model Limitations
- **ASR Model**: Optimized for Chinese speech, limited English support
- **Punctuation**: Chinese punctuation rules only
- **Memory Usage**: Models loaded once, shared across sessions
- **Cold Start**: 30-60 seconds initial model loading time

---

**This documentation follows AI context engineering best practices with structured information, clear integration patterns, and comprehensive constraint specifications for successful agent-driven integration.**