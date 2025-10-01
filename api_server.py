from funasr import AutoModel
import numpy as np
import asyncio
import json
import base64
import struct
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from typing import Dict, List
import logging

# Configure logging
logging.basicConfig(
    level=logging.WARNING
)  # Only show warnings and errors in production
logger = logging.getLogger(__name__)

# Create a separate debug logger for detailed information
debug_logger = logging.getLogger("debug")
debug_logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
handler.setFormatter(
    logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
)
debug_logger.addHandler(handler)

# FunASR configuration
chunk_size = [0, 10, 5]  # [0, 10, 5] 600ms, [0, 8, 4] 480ms
encoder_chunk_look_back = 4  # number of chunks to lookback for encoder self-attention
decoder_chunk_look_back = (
    1  # number of encoder chunks to lookback for decoder cross-attention
)

# Audio parameters
SAMPLE_RATE = 16000  # FunASR typically uses 16kHz
CHANNELS = 1
DTYPE = np.float32
chunk_stride = chunk_size[1] * 960  # 600ms, same as original

# Initialize FastAPI app
app = FastAPI(title="Real-time Speech Recognition API", version="1.0.0")

# Global model instance
model = None


class ConnectionManager:
    """Manages WebSocket connections"""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_states: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.connection_states[client_id] = {
            "audio_buffer": np.array([], dtype=DTYPE),
            "cache": {},
            "is_recording": False,
        }
        logger.info(f"Client {client_id} connected")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.connection_states:
            del self.connection_states[client_id]
        logger.info(f"Client {client_id} disconnected")

    async def send_message(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(json.dumps(message))

    def get_state(self, client_id: str):
        return self.connection_states.get(client_id)


manager = ConnectionManager()


def load_model():
    """Load the FunASR model"""
    global model
    if model is None:
        logger.info("Loading FunASR model...")
        model = AutoModel(model="paraformer-zh-streaming")
        logger.info("Model loaded successfully")


def decode_audio_chunk(audio_data: str) -> np.ndarray:
    """Decode base64 encoded audio data to numpy array"""
    try:
        # Decode base64
        audio_bytes = base64.b64decode(audio_data)
        debug_logger.debug(f"Decoded audio bytes: {len(audio_bytes)}")

        # Ensure we have the right number of bytes for float32
        if len(audio_bytes) % 4 != 0:
            # Pad or trim to make it divisible by 4
            padding = 4 - (len(audio_bytes) % 4)
            if padding < 4:
                audio_bytes += b"\x00" * padding
            else:
                audio_bytes = audio_bytes[: len(audio_bytes) - (len(audio_bytes) % 4)]
            debug_logger.debug(f"Adjusted audio bytes to: {len(audio_bytes)}")

        # Try float32 first (most likely after our client fixes)
        try:
            audio_array = np.frombuffer(audio_bytes, dtype=np.float32)
            debug_logger.debug(
                f"Successfully decoded as float32, length: {len(audio_array)}"
            )

            # Check if the data looks reasonable
            if np.any(np.abs(audio_array) > 10):
                logger.warning(
                    "Audio data has very large values, might be incorrectly decoded"
                )

            return audio_array
        except Exception as e:
            debug_logger.debug(f"Float32 decode failed: {e}")

        # Try int16 and convert to float32
        try:
            audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
            audio_array = (
                audio_array.astype(np.float32) / 32768.0
            )  # Normalize to [-1, 1]
            debug_logger.debug(
                f"Successfully decoded as int16 and converted, length: {len(audio_array)}"
            )
            return audio_array
        except Exception as e:
            debug_logger.debug(f"Int16 decode failed: {e}")

        # Try int32 and convert to float32
        try:
            audio_array = np.frombuffer(audio_bytes, dtype=np.int32)
            audio_array = (
                audio_array.astype(np.float32) / 2147483648.0
            )  # Normalize to [-1, 1]
            debug_logger.debug(
                f"Successfully decoded as int32 and converted, length: {len(audio_array)}"
            )
            return audio_array
        except Exception as e:
            debug_logger.debug(f"Int32 decode failed: {e}")

        logger.error(
            f"Failed to decode audio chunk with all formats, data length: {len(audio_bytes)}"
        )
        return np.array([], dtype=DTYPE)

    except Exception as e:
        logger.error(f"Error decoding audio chunk: {e}")
        return np.array([], dtype=DTYPE)


async def process_audio_chunk(client_id: str, audio_chunk: np.ndarray):
    """Process audio chunk and send recognition result"""
    state = manager.get_state(client_id)
    if not state:
        logger.warning(f"No state found for client {client_id}")
        return

    # Add to buffer
    state["audio_buffer"] = np.append(state["audio_buffer"], audio_chunk)

    debug_logger.debug(
        f"Client {client_id}: buffer size {len(state['audio_buffer'])}, chunk size {chunk_stride}"
    )

    # Process if we have enough data
    if len(state["audio_buffer"]) >= chunk_stride:
        # Extract chunk
        speech_chunk = state["audio_buffer"][:chunk_stride].copy()
        state["audio_buffer"] = state["audio_buffer"][chunk_stride:]

        logger.info(
            f"Client {client_id}: Processing audio chunk, length: {len(speech_chunk)}"
        )

        try:
            # Process with FunASR
            res = model.generate(
                input=speech_chunk,
                cache=state["cache"],
                is_final=False,  # Always False for streaming
                chunk_size=chunk_size,
                encoder_chunk_look_back=encoder_chunk_look_back,
                decoder_chunk_look_back=decoder_chunk_look_back,
            )

            debug_logger.debug(f"Client {client_id}: FunASR result: {res}")

            if res and len(res) > 0 and "text" in res[0]:
                result_text = res[0]["text"]
                if result_text.strip():  # Only send non-empty results
                    await manager.send_message(
                        client_id,
                        {
                            "type": "recognition_result",
                            "text": result_text,
                            "is_final": False,
                        },
                    )
                    logger.info(f"Client {client_id} recognized: {result_text}")
                else:
                    debug_logger.debug(f"Client {client_id}: Empty result, not sending")
            else:
                debug_logger.debug(f"Client {client_id}: No valid result from FunASR")

        except Exception as e:
            logger.error(f"Error processing audio for client {client_id}: {e}")
            await manager.send_message(
                client_id, {"type": "error", "message": f"Processing error: {str(e)}"}
            )


async def process_final_audio(client_id: str):
    """Process remaining audio buffer when recording stops"""
    state = manager.get_state(client_id)
    if not state or len(state["audio_buffer"]) == 0:
        return

    try:
        # Process remaining audio
        res = model.generate(
            input=state["audio_buffer"],
            cache=state["cache"],
            is_final=True,  # Final chunk
            chunk_size=chunk_size,
            encoder_chunk_look_back=encoder_chunk_look_back,
            decoder_chunk_look_back=decoder_chunk_look_back,
        )

        if res and len(res) > 0 and "text" in res[0]:
            result_text = res[0]["text"]
            if result_text.strip():
                await manager.send_message(
                    client_id,
                    {
                        "type": "recognition_result",
                        "text": result_text,
                        "is_final": True,
                    },
                )
                logger.info(f"Client {client_id} final result: {result_text}")

        # Clear buffer
        state["audio_buffer"] = np.array([], dtype=DTYPE)
        state["cache"] = {}

    except Exception as e:
        logger.error(f"Error processing final audio for client {client_id}: {e}")


@app.on_event("startup")
async def startup_event():
    """Initialize the model on startup"""
    load_model()


@app.get("/")
async def get():
    """Serve a simple test page"""
    return HTMLResponse(content=open("test_simple.html", "r", encoding="utf-8").read())


@app.get("/original")
async def get_original():
    """Serve the original test page"""
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Real-time Speech Recognition</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .controls { margin: 20px 0; }
            button { padding: 10px 20px; margin: 5px; font-size: 16px; }
            .status { margin: 10px 0; padding: 10px; background: #f0f0f0; }
            .results { margin: 20px 0; padding: 10px; background: #f9f9f9; min-height: 100px; }
            .result-item { margin: 5px 0; padding: 5px; border-left: 3px solid #007bff; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Real-time Speech Recognition</h1>
            <div class="status" id="status">Status: Disconnected</div>
            <div class="controls">
                <button id="startBtn" onclick="startRecording()">Start Recording</button>
                <button id="stopBtn" onclick="stopRecording()" disabled>Stop Recording</button>
            </div>
            <div class="results" id="results">
                <h3>Recognition Results:</h3>
                <div id="resultsList"></div>
            </div>
        </div>

        <script>
            let ws = null;
            let mediaRecorder = null;
            let audioChunks = [];
            let isRecording = false;

            function updateStatus(message) {
                document.getElementById('status').textContent = 'Status: ' + message;
            }

            function addResult(text, isFinal) {
                const resultsList = document.getElementById('resultsList');
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                resultItem.style.borderLeftColor = isFinal ? '#28a745' : '#007bff';
                resultItem.textContent = text + (isFinal ? ' ✓' : '...');
                resultsList.appendChild(resultItem);
                resultsList.scrollTop = resultsList.scrollHeight;
            }

            function connectWebSocket() {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/ws/${Date.now()}`;
                
                ws = new WebSocket(wsUrl);
                
                ws.onopen = function() {
                    updateStatus('Connected');
                    console.log('WebSocket connected');
                };
                
                ws.onmessage = function(event) {
                    const data = JSON.parse(event.data);
                    console.log('Received:', data);
                    
                    if (data.type === 'recognition_result') {
                        addResult(data.text, data.is_final);
                    } else if (data.type === 'error') {
                        updateStatus('Error: ' + data.message);
                    } else if (data.type === 'status') {
                        updateStatus(data.message);
                    }
                };
                
                ws.onclose = function() {
                    updateStatus('Disconnected');
                    console.log('WebSocket disconnected');
                };
                
                ws.onerror = function(error) {
                    updateStatus('Connection error');
                    console.error('WebSocket error:', error);
                };
            }

            async function startRecording() {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = function(event) {
                        if (event.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
                            const reader = new FileReader();
                            reader.onload = function() {
                                const arrayBuffer = reader.result;
                                
                                // Convert audio data to Float32Array at 16kHz
                                arrayBufferToFloat32(arrayBuffer).then(float32Array => {
                                    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(float32Array.buffer)));
                                    
                                    ws.send(JSON.stringify({
                                        type: 'audio_chunk',
                                        data: base64Audio
                                    }));
                                });
                            };
                            reader.readAsArrayBuffer(event.data);
                        }
                    };

                    // Function to convert audio buffer to Float32 at 16kHz
                    async function arrayBufferToFloat32(arrayBuffer) {
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
                        
                        // Resample to 16kHz if needed
                        const targetSampleRate = 16000;
                        if (audioBuffer.sampleRate !== targetSampleRate) {
                            const length = Math.floor(audioBuffer.length * targetSampleRate / audioBuffer.sampleRate);
                            const offlineContext = new OfflineAudioContext(1, length, targetSampleRate);
                            const source = offlineContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(offlineContext.destination);
                            source.start();
                            const resampledBuffer = await offlineContext.startRendering();
                            return new Float32Array(resampledBuffer.getChannelData(0));
                        }
                        
                        return new Float32Array(audioBuffer.getChannelData(0));
                    }

                    mediaRecorder.start(100); // Collect data every 100ms
                    isRecording = true;
                    
                    document.getElementById('startBtn').disabled = true;
                    document.getElementById('stopBtn').disabled = false;
                    updateStatus('Recording...');
                    
                    // Send start message
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'start_recording' }));
                    }
                    
                } catch (error) {
                    console.error('Error accessing microphone:', error);
                    updateStatus('Microphone access denied');
                }
            }

            function stopRecording() {
                if (mediaRecorder && isRecording) {
                    mediaRecorder.stop();
                    mediaRecorder.stream.getTracks().forEach(track => track.stop());
                    isRecording = false;
                    
                    document.getElementById('startBtn').disabled = false;
                    document.getElementById('stopBtn').disabled = true;
                    updateStatus('Processing final audio...');
                    
                    // Send stop message
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'stop_recording' }));
                    }
                }
            }

            // Connect WebSocket on page load
            window.onload = function() {
                connectWebSocket();
            };
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time speech recognition"""
    await manager.connect(websocket, client_id)

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)

            if message["type"] == "start_recording":
                state = manager.get_state(client_id)
                if state:
                    state["is_recording"] = True
                    state["audio_buffer"] = np.array([], dtype=DTYPE)
                    state["cache"] = {}

                await manager.send_message(
                    client_id, {"type": "status", "message": "Recording started"}
                )

            elif message["type"] == "stop_recording":
                state = manager.get_state(client_id)
                if state:
                    state["is_recording"] = False

                # Process remaining audio
                await process_final_audio(client_id)

                await manager.send_message(
                    client_id, {"type": "status", "message": "Recording stopped"}
                )

            elif message["type"] == "audio_chunk":
                state = manager.get_state(client_id)
                if state and state["is_recording"]:
                    # Decode and process audio chunk
                    audio_chunk = decode_audio_chunk(message["data"])
                    if len(audio_chunk) > 0:
                        await process_audio_chunk(client_id, audio_chunk)

    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        await manager.send_message(
            client_id, {"type": "error", "message": f"Connection error: {str(e)}"}
        )
        manager.disconnect(client_id)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "model_loaded": model is not None}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
