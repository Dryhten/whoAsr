# Real-time Speech Recognition API

A FastAPI-based WebSocket API for real-time speech recognition using FunASR's streaming ASR model.

## Features

- Real-time speech recognition via WebSocket
- Web-based interface for testing
- Python client example
- Support for multiple concurrent connections
- Streaming ASR with FunASR paraformer-zh-streaming model
- Automatic audio resampling to 16kHz
- Base64 audio encoding for WebSocket transmission

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd whoAsr
```

2. Install dependencies using uv:
```bash
uv sync
```

## Usage

### Starting the Server

Run the FastAPI server:
```bash
uv run python api_server.py
```

The server will start on `http://localhost:8000`

### Web Interface

Open your browser and navigate to `http://localhost:8000` to access the web interface. Click "Start Recording" to begin real-time speech recognition.

### Python Client

Use the provided Python client example:

```bash
uv run python client_example.py
```

This will connect to the server and start recording from your microphone for real-time transcription.

## API Endpoints

### WebSocket Endpoint

- **URL**: `ws://localhost:8000/ws/{client_id}`
- **Method**: WebSocket connection
- **Description**: Real-time speech recognition endpoint

#### Message Types

**Client to Server:**

1. **Start Recording**:
```json
{
  "type": "start_recording"
}
```

2. **Audio Chunk**:
```json
{
  "type": "audio_chunk",
  "data": "base64_encoded_audio_data"
}
```

3. **Stop Recording**:
```json
{
  "type": "stop_recording"
}
```

**Server to Client:**

1. **Recognition Result**:
```json
{
  "type": "recognition_result",
  "text": "recognized text",
  "is_final": false
}
```

2. **Status Update**:
```json
{
  "type": "status",
  "message": "Recording started"
}
```

3. **Error**:
```json
{
  "type": "error",
  "message": "Error description"
}
```

### HTTP Endpoints

- **GET `/`**: Web interface for testing
- **GET `/health`**: Health check endpoint
- **GET `/docs`**: FastAPI auto-generated documentation

## Audio Format Requirements

- **Sample Rate**: 16kHz (automatically resampled if different)
- **Channels**: 1 (mono)
- **Format**: 32-bit float
- **Encoding**: Base64 encoded binary data

## Configuration

The server uses the following FunASR configuration:

```python
chunk_size = [0, 10, 5]  # 600ms chunks
encoder_chunk_look_back = 4
decoder_chunk_look_back = 1
SAMPLE_RATE = 16000
```

## Implementation Details

### Server Architecture

1. **Connection Manager**: Manages WebSocket connections and client states
2. **Audio Processing**: Handles base64 decoding and audio buffering
3. **FunASR Integration**: Processes audio chunks with streaming ASR
4. **Real-time Response**: Sends recognition results back to clients

### Client Implementation

The web interface uses:
- MediaRecorder API for audio capture
- WebSocket for real-time communication
- Web Audio API for audio resampling
- Base64 encoding for audio transmission

### Error Handling

- Connection errors are logged and reported to clients
- Audio decoding errors are handled gracefully
- Model loading errors are reported on startup

## Troubleshooting

### Common Issues

1. **Microphone Access Denied**: Ensure browser has microphone permissions
2. **Connection Failed**: Check if server is running on port 8000
3. **Audio Decoding Errors**: May occur with incompatible audio formats
4. **Model Loading Issues**: Check internet connection for model download

### Logs

Server logs include:
- Connection/disconnection events
- Recognition results
- Error messages
- Model loading status

## Development

### Project Structure

```
whoAsr/
├── api_server.py          # FastAPI WebSocket server
├── client_example.py      # Python client example
├── main.py               # Original microphone implementation
├── pyproject.toml        # Project dependencies
└── README.md             # This file
```

### Dependencies

- `funasr`: Speech recognition model
- `fastapi`: Web framework
- `uvicorn`: ASGI server
- `websockets`: WebSocket support
- `numpy`: Audio processing
- `pyaudio`: Microphone access (for client)

## License

[Add your license information here]
