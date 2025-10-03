# WebSocket Real-time Speech Recognition API

## 🎯 INTEGRATION CONTEXT

**Purpose**: Real-time Chinese speech recognition for AI agents requiring live transcription capabilities
**Protocol**: WebSocket bidirectional communication with base64-encoded audio streaming
**Use Cases**: Voice assistants, live captioning, real-time conversation analysis, voice UI interfaces

## 🔌 ENDPOINT SPECIFICATION

### Connection URL
```
ws://localhost:8000/ws/{client_id}
```

**Parameters:**
- `client_id` (string, required): Unique identifier for the client session
- Must be URL-safe and unique per concurrent connection
- Recommended format: UUID or alphanumeric string (max 64 chars)

### Connection Example
```python
import asyncio
import websockets
import base64
import json

async def connect_to_asr():
    client_id = "voice_assistant_001"
    uri = f"ws://localhost:8000/ws/{client_id}"

    async with websockets.connect(uri) as websocket:
        # Connection established, ready for audio streaming
        pass
```

## 📤 MESSAGE PROTOCOLS

### Client-to-Server Messages

#### 1. Start Recording Session
```json
{
  "type": "start_recording"
}
```

**Purpose**: Initialize recognition session and prepare audio buffer
**Response**: Server acknowledges and starts processing incoming audio

#### 2. Stream Audio Chunk
```json
{
  "type": "audio_chunk",
  "data": "base64_encoded_audio_data"
}
```

**Purpose**: Send audio data for real-time processing
**Data Format**:
- Raw binary audio encoded in base64
- Auto-detection of formats: float32, int16, int32
- Auto-resampling to 16kHz mono if needed
- Recommended chunk size: 1024-4096 samples

**Audio Processing Pipeline**:
1. Base64 decode to binary
2. Audio format detection and conversion
3. Resample to 16kHz mono float32
4. Buffer to 600ms chunks with overlap
5. FunASR streaming inference
6. Return incremental results

#### 3. Stop Recording Session
```json
{
  "type": "stop_recording"
}
```

**Purpose**: End recognition session and receive final results
**Response**: Server sends final transcription and cleans up session

## 📥 Server-to-Client Messages

#### 1. Recognition Result (Streaming)
```json
{
  "type": "recognition_result",
  "text": "识别到的中文文本",
  "is_final": false,
  "timestamp": "2024-01-01T12:00:00Z",
  "confidence": 0.95
}
```

**Response Fields**:
- `text` (string): Recognized Chinese text (may be partial)
- `is_final` (boolean): false for intermediate results, true for final
- `timestamp` (string): ISO 8601 timestamp of result generation
- `confidence` (float): Confidence score 0.0-1.0

#### 2. Session Status Updates
```json
{
  "type": "status",
  "message": "Recording started",
  "code": "SESSION_STARTED"
}
```

**Status Codes**:
- `SESSION_STARTED`: Recording session initialized
- `SESSION_STOPPED`: Recording session ended
- `MODEL_LOADED`: ASR model ready for processing
- `PROCESSING_AUDIO`: Currently analyzing audio chunk

#### 3. Error Messages
```json
{
  "type": "error",
  "message": "Model not loaded",
  "code": "MODEL_UNAVAILABLE",
  "details": "Streaming ASR model is not loaded. Use POST /model/load to load model."
}
```

**Common Error Codes**:
- `MODEL_UNAVAILABLE`: ASR model not loaded
- `INVALID_AUDIO_FORMAT`: Unsupported audio format
- `CONNECTION_TIMEOUT`: No audio received within 30s
- `BUFFER_OVERFLOW`: Audio buffer exceeded capacity
- `SESSION_ERROR`: General session management error

## 🔄 COMPLETE INTERACTION FLOW

### Typical Voice Assistant Session
```python
import asyncio
import websockets
import base64
import json
import numpy as np

async def voice_assistant_session():
    client_id = "assistant_session_001"
    uri = f"ws://localhost:8000/ws/{client_id}"

    async with websockets.connect(uri) as websocket:
        # 1. Start recording
        await websocket.send(json.dumps({"type": "start_recording"}))

        # 2. Stream audio (simulated)
        for i in range(100):  # 100 audio chunks
            # Generate or capture audio chunk
            audio_data = capture_audio_chunk()  # Your audio capture logic

            # Convert to base64
            audio_b64 = base64.b64encode(audio_data).decode()

            # Send to server
            await websocket.send(json.dumps({
                "type": "audio_chunk",
                "data": audio_b64
            }))

            # Process server responses
            response = await websocket.recv()
            result = json.loads(response)

            if result["type"] == "recognition_result":
                print(f"Transcript: {result['text']} (Final: {result['is_final']})")

                # Process recognized text for voice commands
                if result["is_final"]:
                    command = process_voice_command(result["text"])
                    if command:
                        await execute_command(command)

            await asyncio.sleep(0.1)  # 10 chunks per second

        # 3. Stop recording
        await websocket.send(json.dumps({"type": "stop_recording"}))

        # 4. Get final results
        final_response = await websocket.recv()
        final_result = json.loads(final_response)
        print(f"Final transcription: {final_result}")

def capture_audio_chunk():
    """Replace with your actual audio capture implementation"""
    # Example: generate 1024 samples of silence
    return np.zeros(1024, dtype=np.float32).tobytes()
```

## ⚡ PERFORMANCE OPTIMIZATION

### Latency Optimization
- **Initial Response**: ~600ms (model warm-up + first chunk processing)
- **Incremental Updates**: ~200ms (subsequent chunks)
- **Network Latency**: Add ping time to above values

### Audio Chunk Best Practices
```python
# Optimal chunk size for real-time processing
CHUNK_SIZE = 2048  # samples
SAMPLE_RATE = 16000  # Hz
CHUNK_DURATION = CHUNK_SIZE / SAMPLE_RATE  # ~128ms

# Recommended sending frequency: 8-10 chunks per second
SEND_INTERVAL = 0.1  # seconds
```

### Connection Management
- **Timeout**: 30 seconds without audio data
- **Reconnection**: Implement exponential backoff (1s, 2s, 4s, 8s, 15s)
- **Session Persistence**: Use same client_id for reconnection within 5 minutes

## 🚨 ERROR HANDLING PATTERNS

### Robust Client Implementation
```python
import asyncio
import websockets
import json
from enum import Enum

class ASRState(Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    RECORDING = "recording"
    ERROR = "error"

class ASRClient:
    def __init__(self, client_id):
        self.client_id = client_id
        self.state = ASRState.DISCONNECTED
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5

    async def connect_and_record(self):
        while self.reconnect_attempts < self.max_reconnect_attempts:
            try:
                self.state = ASRState.CONNECTING
                uri = f"ws://localhost:8000/ws/{self.client_id}"

                async with websockets.connect(uri) as websocket:
                    self.state = ASRState.RECORDING
                    self.reconnect_attempts = 0  # Reset on successful connection

                    await self._handle_session(websocket)

            except websockets.exceptions.ConnectionClosed:
                await self._handle_reconnection()
            except Exception as e:
                print(f"ASR Error: {e}")
                await self._handle_reconnection()

    async def _handle_reconnection(self):
        self.reconnect_attempts += 1
        delay = min(2 ** self.reconnect_attempts, 15)  # Exponential backoff
        print(f"Reconnecting in {delay}s... (attempt {self.reconnect_attempts})")
        await asyncio.sleep(delay)

    async def _handle_session(self, websocket):
        # Start recording
        await websocket.send(json.dumps({"type": "start_recording"}))

        # Handle messages
        async for message in websocket:
            response = json.loads(message)
            await self._process_response(response)

    async def _process_response(self, response):
        if response["type"] == "error":
            print(f"ASR Error: {response['message']}")
            self.state = ASRState.ERROR
        elif response["type"] == "recognition_result":
            await self._handle_transcription(response)

    async def _handle_transcription(self, result):
        # Process recognized text
        if result["is_final"]:
            print(f"Final: {result['text']}")
            # Add your voice command processing logic here
```

## 🔍 TESTING AND VALIDATION

### Connection Health Check
```python
async def test_asr_connection():
    """Test basic WebSocket connectivity and model availability"""
    try:
        client_id = "test_connection"
        uri = f"ws://localhost:8000/ws/{client_id}"

        async with websockets.connect(uri, timeout=10) as websocket:
            # Test start recording
            await websocket.send(json.dumps({"type": "start_recording"}))

            # Wait for status response
            response = await asyncio.wait_for(websocket.recv(), timeout=5)
            status = json.loads(response)

            if status["type"] == "status" and "SESSION_STARTED" in status.get("code", ""):
                print("✅ ASR WebSocket connection successful")
                return True
            else:
                print(f"❌ Unexpected response: {status}")
                return False

    except Exception as e:
        print(f"❌ ASR connection failed: {e}")
        return False
```

### Audio Format Validation
```python
def validate_audio_format(audio_data, sample_rate=16000):
    """Validate audio data before sending to ASR"""
    try:
        # Check data type and size
        if not isinstance(audio_data, bytes):
            return False, "Audio data must be bytes"

        if len(audio_data) == 0:
            return False, "Audio data cannot be empty"

        # Validate chunk size (recommended 1024-4096 samples)
        if len(audio_data) < 1024 * 4:  # 4 bytes per sample for float32
            return False, "Audio chunk too small"

        if len(audio_data) > 4096 * 4:
            return False, "Audio chunk too large"

        return True, "Audio format valid"

    except Exception as e:
        return False, f"Audio validation error: {e}"
```

## 📊 MONITORING AND DEBUGGING

### Session Metrics to Track
- Connection establishment time
- First audio chunk to first result latency
- Average processing time per chunk
- Error rates and types
- Audio buffer utilization

### Debug Logging Pattern
```python
import logging

class ASRDebugger:
    def __init__(self, client_id):
        self.client_id = client_id
        self.logger = logging.getLogger(f"asr.{client_id}")

    def log_connection_event(self, event_type, details=None):
        self.logger.info(f"Connection {event_type}: {details or ''}")

    def log_audio_chunk(self, chunk_size, processing_time):
        self.logger.debug(f"Audio chunk: {chunk_size} bytes, {processing_time:.2f}ms")

    def log_transcription(self, text, is_final, confidence):
        self.logger.info(f"Transcription ({'final' if is_final else 'partial'}): {text} [{confidence:.2f}]")
```

---

**This WebSocket API specification provides AI agents with comprehensive integration patterns for real-time speech recognition capabilities, including error handling, performance optimization, and monitoring best practices.**