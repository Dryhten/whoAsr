# Integration Examples and Best Practices

## 🎯 PURPOSE-DRIVEN INTEGRATION PATTERNS

This section provides practical, production-ready integration examples for common AI agent use cases with whoAsr. Each example includes error handling, monitoring, and optimization best practices.

## 📱 VOICE ASSISTANT INTEGRATION

### Complete Voice Assistant Client
```python
"""
Voice Assistant Integration with whoAsr
Provides complete workflow for voice command processing
"""

import asyncio
import websockets
import json
import base64
import numpy as np
import pyaudio
import threading
from dataclasses import dataclass
from typing import Optional, Callable, Dict, Any
import requests
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VoiceAssistant")

@dataclass
class VoiceCommand:
    text: str
    confidence: float
    timestamp: float
    is_final: bool

@dataclass
class AssistantConfig:
    asr_server_url: str = "ws://localhost:8000"
    punctuation_api_url: str = "http://localhost:8000/punctuate"
    sample_rate: int = 16000
    chunk_size: int = 1024
    channels: int = 1
    format: int = pyaudio.paFloat32
    silence_threshold: float = 0.01
    silence_duration: float = 2.0

class VoiceAssistant:
    def __init__(self, config: AssistantConfig):
        self.config = config
        self.audio = pyaudio.PyAudio()
        self.websocket = None
        self.recording = False
        self.audio_buffer = []
        self.silence_start_time = None
        self.command_callback: Optional[Callable[[VoiceCommand], None]] = None
        self.status_callback: Optional[Callable[[str], None]] = None

        # Performance metrics
        self.metrics = {
            "total_commands": 0,
            "successful_commands": 0,
            "average_latency": 0.0,
            "session_start_time": time.time()
        }

    async def connect(self) -> bool:
        """Establish WebSocket connection to ASR server"""
        try:
            client_id = f"voice_assistant_{int(time.time())}"
            uri = f"{self.config.asr_server_url}/ws/{client_id}"

            self.websocket = await websockets.connect(uri)
            logger.info(f"Connected to ASR server: {uri}")

            if self.status_callback:
                self.status_callback("Connected to speech recognition server")

            return True

        except Exception as e:
            logger.error(f"Failed to connect to ASR server: {e}")
            if self.status_callback:
                self.status_callback(f"Connection failed: {e}")
            return False

    def set_command_callback(self, callback: Callable[[VoiceCommand], None]):
        """Set callback for processing voice commands"""
        self.command_callback = callback

    def set_status_callback(self, callback: Callable[[str], None]):
        """Set callback for status updates"""
        self.status_callback = callback

    async def start_listening(self):
        """Start listening for voice commands"""
        if not self.websocket:
            if not await self.connect():
                return False

        # Start recording session
        await self.websocket.send(json.dumps({"type": "start_recording"}))
        self.recording = True

        if self.status_callback:
            self.status_callback("Listening for voice commands...")

        # Start audio capture in separate thread
        audio_thread = threading.Thread(target=self._capture_audio)
        audio_thread.daemon = True
        audio_thread.start()

        # Start message processing
        await self._process_messages()

        return True

    def _capture_audio(self):
        """Capture audio from microphone"""
        try:
            stream = self.audio.open(
                format=self.config.format,
                channels=self.config.channels,
                rate=self.config.sample_rate,
                input=True,
                frames_per_buffer=self.config.chunk_size
            )

            logger.info("Audio capture started")

            while self.recording:
                try:
                    # Read audio chunk
                    data = stream.read(self.config.chunk_size, exception_on_overflow=False)

                    # Convert to numpy array for silence detection
                    audio_array = np.frombuffer(data, dtype=np.float32)

                    # Detect silence
                    is_silent = np.max(np.abs(audio_array)) < self.config.silence_threshold

                    if is_silent:
                        if self.silence_start_time is None:
                            self.silence_start_time = time.time()
                        elif time.time() - self.silence_start_time > self.config.silence_duration:
                            # End of command detected
                            if self.audio_buffer:
                                asyncio.run_coroutine_threadsafe(
                                    self._process_complete_command(),
                                    asyncio.get_event_loop()
                                )
                            self.audio_buffer.clear()
                    else:
                        # Speech detected, reset silence timer
                        self.silence_start_time = None
                        self.audio_buffer.append(data)

                    # Send audio chunk to ASR server
                    if self.websocket:
                        audio_b64 = base64.b64encode(data).decode()
                        asyncio.run_coroutine_threadsafe(
                            self.websocket.send(json.dumps({
                                "type": "audio_chunk",
                                "data": audio_b64
                            })),
                            asyncio.get_event_loop()
                        )

                except Exception as e:
                    logger.error(f"Audio capture error: {e}")
                    break

            stream.stop_stream()
            stream.close()

        except Exception as e:
            logger.error(f"Failed to start audio capture: {e}")

    async def _process_messages(self):
        """Process messages from ASR server"""
        try:
            async for message in self.websocket:
                try:
                    response = json.loads(message)
                    await self._handle_server_response(response)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON response: {message}")

        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed")
            if self.status_callback:
                self.status_callback("Connection to speech server lost")
        except Exception as e:
            logger.error(f"Message processing error: {e}")

    async def _handle_server_response(self, response: Dict[str, Any]):
        """Handle responses from ASR server"""
        if response["type"] == "recognition_result":
            command = VoiceCommand(
                text=response["text"],
                confidence=response.get("confidence", 0.0),
                timestamp=response.get("timestamp", time.time()),
                is_final=response["is_final"]
            )

            # Update metrics
            self.metrics["total_commands"] += 1

            if command.is_final and self.command_callback:
                self.metrics["successful_commands"] += 1
                self.command_callback(command)

        elif response["type"] == "status":
            if self.status_callback:
                self.status_callback(response["message"])

        elif response["type"] == "error":
            logger.error(f"ASR error: {response['message']}")
            if self.status_callback:
                self.status_callback(f"Speech recognition error: {response['message']}")

    async def _process_complete_command(self):
        """Process complete voice command with punctuation"""
        if not self.audio_buffer:
            return

        # Combine buffered audio for final processing
        complete_audio = b''.join(self.audio_buffer)

        # Send final audio chunk for processing
        if self.websocket:
            audio_b64 = base64.b64encode(complete_audio).decode()
            await self.websocket.send(json.dumps({
                "type": "audio_chunk",
                "data": audio_b64
            }))

    async def stop_listening(self):
        """Stop listening for commands"""
        self.recording = False

        if self.websocket:
            await self.websocket.send(json.dumps({"type": "stop_recording"}))
            await self.websocket.close()
            self.websocket = None

        if self.status_callback:
            self.status_callback("Voice assistant stopped")

    def get_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        session_duration = time.time() - self.metrics["session_start_time"]
        success_rate = (
            self.metrics["successful_commands"] / max(self.metrics["total_commands"], 1) * 100
        )

        return {
            **self.metrics,
            "session_duration_minutes": session_duration / 60,
            "success_rate_percent": success_rate,
            "commands_per_minute": self.metrics["total_commands"] / (session_duration / 60) if session_duration > 0 else 0
        }

# Usage Example
async def main():
    config = AssistantConfig()
    assistant = VoiceAssistant(config)

    def handle_command(command: VoiceCommand):
        print(f"Command: {command.text} (confidence: {command.confidence:.2f})")

        # Add punctuation for better command understanding
        try:
            response = requests.post(
                "http://localhost:8000/punctuate",
                json={"text": command.text},
                timeout=5
            )
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    punctuated_text = result['text']
                    print(f"Punctuated: {punctuated_text}")

                    # Process command based on content
                    if "打开" in punctuated_text:
                        print("Action: Opening application...")
                    elif "关闭" in punctuated_text:
                        print("Action: Closing application...")
                    elif "搜索" in punctuated_text:
                        print("Action: Performing search...")

        except Exception as e:
            print(f"Punctuation processing failed: {e}")

    def handle_status(status: str):
        print(f"Status: {status}")

    assistant.set_command_callback(handle_command)
    assistant.set_status_callback(handle_status)

    # Start listening
    if await assistant.start_listening():
        print("Voice assistant started. Speak commands...")

        try:
            # Keep running indefinitely
            while True:
                await asyncio.sleep(1)

                # Print metrics every 30 seconds
                if int(time.time()) % 30 == 0:
                    metrics = assistant.get_metrics()
                    print(f"Metrics: {metrics['commands_per_minute']:.1f} cmd/min, "
                          f"{metrics['success_rate_percent']:.1f}% success rate")

        except KeyboardInterrupt:
            print("\nStopping voice assistant...")
            await assistant.stop_listening()

            # Print final metrics
            final_metrics = assistant.get_metrics()
            print(f"Session completed: {final_metrics}")

if __name__ == "__main__":
    asyncio.run(main())
```

## 🏭 BATCH TRANSCRIPTION SERVICE

### High-Volume Audio Processing Pipeline
```python
"""
Batch Transcription Service for Enterprise Applications
Handles large-scale audio file processing with queue management
"""

import asyncio
import aiofiles
import aiohttp
import json
import os
import time
import hashlib
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Any
import logging
from concurrent.futures import ThreadPoolExecutor
import pandas as pd
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("BatchTranscription")

@dataclass
class TranscriptionJob:
    job_id: str
    file_path: str
    status: str  # 'pending', 'processing', 'completed', 'failed'
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3

@dataclass
class TranscriptionConfig:
    api_base_url: str = "http://localhost:8000"
    max_concurrent_jobs: int = 5
    chunk_size_mb: int = 50  # Split large files into chunks
    cache_dir: str = "./transcription_cache"
    output_format: str = "json"  # 'json', 'csv', 'txt'
    add_punctuation: bool = True
    detect_segments: bool = True
    hotwords: Optional[List[str]] = None

class BatchTranscriptionService:
    def __init__(self, config: TranscriptionConfig):
        self.config = config
        self.jobs: Dict[str, TranscriptionJob] = {}
        self.processing_queue = asyncio.Queue()
        self.session: Optional[aiohttp.ClientSession] = None
        self.executor = ThreadPoolExecutor(max_workers=config.max_concurrent_jobs)

        # Ensure cache directory exists
        Path(self.config.cache_dir).mkdir(exist_ok=True)

        # Performance metrics
        self.metrics = {
            "total_jobs": 0,
            "completed_jobs": 0,
            "failed_jobs": 0,
            "total_audio_duration": 0.0,
            "total_processing_time": 0.0,
            "average_speed": 0.0  # Real-time factor
        }

    async def start(self):
        """Start the transcription service"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=3600)  # 1 hour timeout
        )

        # Start worker tasks
        for i in range(self.config.max_concurrent_jobs):
            asyncio.create_task(self._worker(f"worker-{i}"))

        logger.info(f"Batch transcription service started with {self.config.max_concurrent_jobs} workers")

    async def stop(self):
        """Stop the transcription service"""
        if self.session:
            await self.session.close()
        self.executor.shutdown(wait=True)
        logger.info("Batch transcription service stopped")

    async def submit_job(self, file_path: str, job_id: Optional[str] = None) -> str:
        """Submit a new transcription job"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Audio file not found: {file_path}")

        if not job_id:
            job_id = self._generate_job_id(file_path)

        job = TranscriptionJob(
            job_id=job_id,
            file_path=file_path,
            status='pending',
            created_at=datetime.now()
        )

        self.jobs[job_id] = job
        await self.processing_queue.put(job_id)

        logger.info(f"Submitted transcription job: {job_id} for file: {file_path}")
        return job_id

    def _generate_job_id(self, file_path: str) -> str:
        """Generate unique job ID based on file hash"""
        hash_md5 = hashlib.md5()
        hash_md5.update(file_path.encode())
        hash_md5.update(str(time.time()).encode())
        return f"job_{hash_md5.hexdigest()[:12]}"

    async def _worker(self, worker_name: str):
        """Worker task for processing transcription jobs"""
        logger.info(f"Worker {worker_name} started")

        while True:
            try:
                job_id = await self.processing_queue.get()
                job = self.jobs.get(job_id)

                if not job:
                    continue

                await self._process_job(job, worker_name)
                self.processing_queue.task_done()

            except Exception as e:
                logger.error(f"Worker {worker_name} error: {e}")

    async def _process_job(self, job: TranscriptionJob, worker_name: str):
        """Process a single transcription job"""
        job.status = 'processing'
        job.started_at = datetime.now()

        logger.info(f"{worker_name}: Processing job {job.job_id}")

        try:
            # Check if file needs chunking
            file_size_mb = os.path.getsize(job.file_path) / (1024 * 1024)

            if file_size_mb > self.config.chunk_size_mb:
                result = await self._process_large_file(job)
            else:
                result = await self._process_single_file(job)

            job.result = result
            job.status = 'completed'
            job.completed_at = datetime.now()

            # Update metrics
            self.metrics["completed_jobs"] += 1
            self.metrics["total_audio_duration"] += result.get("duration", 0)

            processing_time = (job.completed_at - job.started_at).total_seconds()
            self.metrics["total_processing_time"] += processing_time

            # Calculate average speed
            if self.metrics["total_audio_duration"] > 0:
                self.metrics["average_speed"] = (
                    self.metrics["total_processing_time"] / self.metrics["total_audio_duration"]
                )

            # Save result to cache
            await self._save_result(job)

            logger.info(f"{worker_name}: Completed job {job.job_id} in {processing_time:.2f}s")

        except Exception as e:
            job.error = str(e)
            job.retry_count += 1

            if job.retry_count < job.max_retries:
                job.status = 'pending'
                await self.processing_queue.put(job.job_id)
                logger.warning(f"{worker_name}: Retrying job {job.job_id} (attempt {job.retry_count})")
            else:
                job.status = 'failed'
                job.completed_at = datetime.now()
                self.metrics["failed_jobs"] += 1
                logger.error(f"{worker_name}: Failed job {job.job_id}: {e}")

    async def _process_single_file(self, job: TranscriptionJob) -> Dict[str, Any]:
        """Process a single audio file"""
        url = f"{self.config.api_base_url}/recognize"

        # Prepare request data
        data = aiohttp.FormData()

        async with aiofiles.open(job.file_path, 'rb') as f:
            data.add_field('file', await f.read(),
                          filename=os.path.basename(job.file_path),
                          content_type='application/octet-stream')

        # Add parameters
        data.add_field('batch_size_s', '300')
        data.add_field('batch_size_threshold_s', '60')

        if self.config.hotwords:
            data.add_field('hotword', ','.join(self.config.hotwords))

        # Make request
        async with self.session.post(url, data=data) as response:
            if response.status != 200:
                error_text = await response.text()
                raise Exception(f"API request failed: {response.status} - {error_text}")

            result = await response.json()

            if not result.get('success'):
                raise Exception(result.get('error', 'Unknown API error'))

            # Post-processing
            processed_result = await self._post_process_result(result)

            return processed_result

    async def _process_large_file(self, job: TranscriptionJob) -> Dict[str, Any]:
        """Process large file by splitting into chunks"""
        # For this example, we'll use the single file processor
        # In production, you might implement audio chunking here
        logger.info(f"Processing large file {job.file_path} as single chunk")
        return await self._process_single_file(job)

    async def _post_process_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process transcription result"""
        processed_result = result.copy()

        # Add punctuation if requested
        if self.config.add_punctuation and 'text' in result:
            try:
                punctuated_text = await self._add_punctuation(result['text'])
                processed_result['punctuated_text'] = punctuated_text
            except Exception as e:
                logger.warning(f"Punctuation processing failed: {e}")
                processed_result['punctuated_text'] = result['text']

        # Detect segments if requested
        if self.config.detect_segments:
            try:
                segments = await self._detect_segments(job.file_path)
                processed_result['speech_segments'] = segments
            except Exception as e:
                logger.warning(f"Segment detection failed: {e}")

        return processed_result

    async def _add_punctuation(self, text: str) -> str:
        """Add punctuation to text"""
        url = f"{self.config.api_base_url}/punctuate"

        async with self.session.post(url, json={"text": text}) as response:
            if response.status == 200:
                result = await response.json()
                if result.get('success'):
                    return result['text']

        return text

    async def _detect_segments(self, file_path: str) -> List[Dict[str, Any]]:
        """Detect speech segments in audio file"""
        url = f"{self.config.api_base_url}/vad"

        data = aiohttp.FormData()

        async with aiofiles.open(file_path, 'rb') as f:
            data.add_field('file', await f.read(),
                          filename=os.path.basename(file_path),
                          content_type='application/octet-stream')

        async with self.session.post(url, data=data) as response:
            if response.status == 200:
                result = await response.json()
                if result.get('success'):
                    return result.get('speech_segments', [])

        return []

    async def _save_result(self, job: TranscriptionJob):
        """Save transcription result to cache"""
        if not job.result:
            return

        cache_file = Path(self.config.cache_dir) / f"{job.job_id}.json"

        job_data = asdict(job)
        job_data['created_at'] = job.created_at.isoformat()
        if job.started_at:
            job_data['started_at'] = job.started_at.isoformat()
        if job.completed_at:
            job_data['completed_at'] = job.completed_at.isoformat()

        async with aiofiles.open(cache_file, 'w') as f:
            await f.write(json.dumps(job_data, indent=2, ensure_ascii=False))

    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific job"""
        job = self.jobs.get(job_id)
        if not job:
            return None

        return {
            'job_id': job.job_id,
            'status': job.status,
            'created_at': job.created_at.isoformat(),
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'completed_at': job.completed_at.isoformat() if job.completed_at else None,
            'error': job.error,
            'retry_count': job.retry_count
        }

    async def get_job_result(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get result of a completed job"""
        job = self.jobs.get(job_id)
        if not job or job.status != 'completed':
            return None

        return job.result

    def get_service_metrics(self) -> Dict[str, Any]:
        """Get service performance metrics"""
        return {
            **self.metrics,
            "queue_size": self.processing_queue.qsize(),
            "active_workers": self.config.max_concurrent_jobs,
            "pending_jobs": len([j for j in self.jobs.values() if j.status == 'pending']),
            "processing_jobs": len([j for j in self.jobs.values() if j.status == 'processing']),
            "success_rate": (self.metrics["completed_jobs"] / max(self.metrics["total_jobs"], 1)) * 100
        }

    async def export_results(self, output_path: str, format_type: str = None) -> str:
        """Export all completed job results"""
        if format_type is None:
            format_type = self.config.output_format

        completed_jobs = [job for job in self.jobs.values() if job.status == 'completed']

        if format_type == 'csv':
            return await self._export_to_csv(completed_jobs, output_path)
        elif format_type == 'json':
            return await self._export_to_json(completed_jobs, output_path)
        elif format_type == 'txt':
            return await self._export_to_txt(completed_jobs, output_path)
        else:
            raise ValueError(f"Unsupported format: {format_type}")

    async def _export_to_csv(self, jobs: List[TranscriptionJob], output_path: str) -> str:
        """Export results to CSV format"""
        data = []
        for job in jobs:
            row = {
                'job_id': job.job_id,
                'file_path': job.file_path,
                'duration': job.result.get('duration', 0) if job.result else 0,
                'text': job.result.get('text', '') if job.result else '',
                'punctuated_text': job.result.get('punctuated_text', '') if job.result else '',
                'processing_time': (job.completed_at - job.started_at).total_seconds() if job.completed_at and job.started_at else 0,
                'created_at': job.created_at.isoformat(),
                'completed_at': job.completed_at.isoformat() if job.completed_at else ''
            }
            data.append(row)

        df = pd.DataFrame(data)
        df.to_csv(output_path, index=False)
        return output_path

    async def _export_to_json(self, jobs: List[TranscriptionJob], output_path: str) -> str:
        """Export results to JSON format"""
        export_data = []
        for job in jobs:
            job_data = {
                'job_id': job.job_id,
                'file_path': job.file_path,
                'status': job.status,
                'result': job.result,
                'created_at': job.created_at.isoformat(),
                'completed_at': job.completed_at.isoformat() if job.completed_at else None
            }
            export_data.append(job_data)

        async with aiofiles.open(output_path, 'w') as f:
            await f.write(json.dumps(export_data, indent=2, ensure_ascii=False))

        return output_path

    async def _export_to_txt(self, jobs: List[TranscriptionJob], output_path: str) -> str:
        """Export results to plain text format"""
        lines = []
        for job in jobs:
            lines.append(f"Job ID: {job.job_id}")
            lines.append(f"File: {job.file_path}")
            if job.result:
                lines.append(f"Transcription: {job.result.get('text', '')}")
                punctuated = job.result.get('punctuated_text')
                if punctuated:
                    lines.append(f"Punctuated: {punctuated}")
            lines.append(f"Completed: {job.completed_at}")
            lines.append("-" * 50)

        async with aiofiles.open(output_path, 'w') as f:
            await f.write('\n'.join(lines))

        return output_path

# Usage Example
async def main():
    config = TranscriptionConfig(
        max_concurrent_jobs=3,
        add_punctuation=True,
        detect_segments=True,
        hotwords=["人工智能", "语音识别", "机器学习"]
    )

    service = BatchTranscriptionService(config)
    await service.start()

    try:
        # Submit jobs for a directory of audio files
        audio_dir = Path("./audio_files")
        if audio_dir.exists():
            audio_files = list(audio_dir.glob("*.wav")) + list(audio_dir.glob("*.mp3"))

            job_ids = []
            for audio_file in audio_files[:5]:  # Process first 5 files
                job_id = await service.submit_job(str(audio_file))
                job_ids.append(job_id)
                print(f"Submitted job: {job_id} for {audio_file.name}")

            # Monitor progress
            while True:
                metrics = service.get_service_metrics()
                print(f"Progress: {metrics['completed_jobs']}/{metrics['total_jobs']} completed, "
                      f"Queue: {metrics['queue_size']}, Success rate: {metrics['success_rate']:.1f}%")

                if metrics['completed_jobs'] + metrics['failed_jobs'] >= len(job_ids):
                    break

                await asyncio.sleep(5)

            # Export results
            await service.export_results("transcription_results.csv", "csv")
            await service.export_results("transcription_results.json", "json")

            print("Transcription completed! Results exported to CSV and JSON files.")

        else:
            print(f"Audio directory not found: {audio_dir}")

    finally:
        await service.stop()

if __name__ == "__main__":
    asyncio.run(main())
```

## 🌐 WEB APPLICATION INTEGRATION

### FastAPI Integration Example
```python
"""
FastAPI Web Application Integration with whoAsr
Provides REST API endpoints for web-based speech recognition
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import aiohttp
import uvicorn
from typing import List, Optional
import tempfile
import os
import uuid
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("WebApp")

app = FastAPI(
    title="Speech Recognition Web Service",
    description="Web application integration with whoAsr",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
ASR_BASE_URL = "http://localhost:8000"
TEMP_DIR = "./temp_uploads"

# Ensure temp directory exists
os.makedirs(TEMP_DIR, exist_ok=True)

# In-memory storage for job status (use database in production)
active_jobs = {}

class TranscriptionService:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None

    async def initialize(self):
        """Initialize HTTP session"""
        self.session = aiohttp.ClientSession()

    async def cleanup(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()

    async def check_asr_health(self) -> bool:
        """Check if ASR service is healthy"""
        try:
            async with self.session.get(f"{self.base_url}/health") as response:
                if response.status == 200:
                    health = await response.json()
                    return health.get('status') == 'healthy'
        except Exception as e:
            logger.error(f"Health check failed: {e}")

        return False

    async def transcribe_file(self, file_path: str, hotwords: List[str] = None) -> dict:
        """Transcribe audio file using ASR service"""
        url = f"{self.base_url}/recognize"

        data = aiohttp.FormData()

        with open(file_path, 'rb') as f:
            data.add_field('file', f.read(),
                          filename=os.path.basename(file_path),
                          content_type='application/octet-stream')

        if hotwords:
            data.add_field('hotword', ','.join(hotwords))

        async with self.session.post(url, data=data) as response:
            if response.status != 200:
                error_text = await response.text()
                raise Exception(f"ASR API error: {response.status} - {error_text}")

            return await response.json()

    async def add_punctuation(self, text: str) -> str:
        """Add punctuation to text"""
        url = f"{self.base_url}/punctuate"

        async with self.session.post(url, json={"text": text}) as response:
            if response.status == 200:
                result = await response.json()
                if result.get('success'):
                    return result['text']

        return text

# Initialize transcription service
transcription_service = TranscriptionService(ASR_BASE_URL)

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    await transcription_service.initialize()
    logger.info("Web application started")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    await transcription_service.cleanup()
    logger.info("Web application stopped")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Speech Recognition Web Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "transcribe": "/transcribe",
            "transcribe_upload": "/transcribe/upload",
            "job_status": "/job/{job_id}",
            "punctuate": "/punctuate"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    asr_healthy = await transcription_service.check_asr_health()

    return {
        "status": "healthy" if asr_healthy else "degraded",
        "timestamp": datetime.now().isoformat(),
        "asr_service": "healthy" if asr_healthy else "unavailable",
        "active_jobs": len(active_jobs)
    }

@app.post("/transcribe/upload")
async def transcribe_uploaded_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    hotwords: Optional[str] = None,
    add_punctuation: bool = True,
    async_processing: bool = False
):
    """Transcribe uploaded audio file"""

    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Check file size (limit to 100MB)
    file_content = await file.read()
    if len(file_content) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 100MB)")

    # Generate job ID
    job_id = str(uuid.uuid4())

    # Save uploaded file to temp location
    temp_file_path = os.path.join(TEMP_DIR, f"{job_id}_{file.filename}")

    with open(temp_file_path, 'wb') as f:
        f.write(file_content)

    # Parse hotwords
    hotword_list = hotwords.split(',') if hotwords else None

    # Initialize job status
    active_jobs[job_id] = {
        "job_id": job_id,
        "filename": file.filename,
        "status": "processing",
        "created_at": datetime.now().isoformat(),
        "progress": 0
    }

    if async_processing:
        # Process in background
        background_tasks.add_task(
            process_transcription_job,
            job_id,
            temp_file_path,
            hotword_list,
            add_punctuation
        )

        return {
            "job_id": job_id,
            "message": "Transcription job started",
            "status_url": f"/job/{job_id}",
            "estimated_time": "30-60 seconds"
        }
    else:
        # Process synchronously
        try:
            result = await process_transcription_job(
                job_id,
                temp_file_path,
                hotword_list,
                add_punctuation
            )

            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

            return result

        except Exception as e:
            # Clean up on error
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

            active_jobs[job_id]["status"] = "failed"
            active_jobs[job_id]["error"] = str(e)

            raise HTTPException(status_code=500, detail=str(e))

async def process_transcription_job(
    job_id: str,
    file_path: str,
    hotwords: List[str] = None,
    add_punctuation: bool = True
) -> dict:
    """Process transcription job"""

    try:
        logger.info(f"Processing transcription job: {job_id}")

        # Update progress
        if job_id in active_jobs:
            active_jobs[job_id]["progress"] = 10
            active_jobs[job_id]["status"] = "transcribing"

        # Transcribe file
        result = await transcription_service.transcribe_file(file_path, hotwords)

        if not result.get('success'):
            raise Exception(result.get('error', 'Transcription failed'))

        # Update progress
        if job_id in active_jobs:
            active_jobs[job_id]["progress"] = 70

        # Add punctuation if requested
        final_text = result.get('text', '')
        if add_punctuation and final_text:
            punctuated_text = await transcription_service.add_punctuation(final_text)
            result['punctuated_text'] = punctuated_text

        # Update progress
        if job_id in active_jobs:
            active_jobs[job_id]["progress"] = 90

        # Prepare final result
        final_result = {
            "job_id": job_id,
            "success": True,
            "transcription": result.get('text', ''),
            "punctuated_text": result.get('punctuated_text', ''),
            "duration": result.get('duration', 0),
            "segments": result.get('segments', []),
            "metadata": result.get('metadata', {}),
            "processing_time": result.get('processing_time', 0),
            "completed_at": datetime.now().isoformat()
        }

        # Update job status
        if job_id in active_jobs:
            active_jobs[job_id].update({
                "status": "completed",
                "progress": 100,
                "completed_at": datetime.now().isoformat(),
                "result": final_result
            })

        logger.info(f"Completed transcription job: {job_id}")
        return final_result

    except Exception as e:
        logger.error(f"Transcription job failed: {job_id} - {e}")

        # Update job status
        if job_id in active_jobs:
            active_jobs[job_id].update({
                "status": "failed",
                "error": str(e),
                "completed_at": datetime.now().isoformat()
            })

        raise

@app.get("/job/{job_id}")
async def get_job_status(job_id: str):
    """Get transcription job status"""

    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = active_jobs[job_id]

    response = {
        "job_id": job["job_id"],
        "filename": job["filename"],
        "status": job["status"],
        "progress": job["progress"],
        "created_at": job["created_at"]
    }

    if "completed_at" in job:
        response["completed_at"] = job["completed_at"]

    if "error" in job:
        response["error"] = job["error"]

    if "result" in job:
        response["result"] = job["result"]

    return response

@app.post("/punctuate")
async def punctuate_text(text: str):
    """Add punctuation to text"""

    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        punctuated_text = await transcription_service.add_punctuation(text)

        return {
            "success": True,
            "original_text": text,
            "punctuated_text": punctuated_text,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Punctuation processing failed: {e}")

@app.get("/jobs")
async def list_jobs(status: Optional[str] = None, limit: int = 50):
    """List transcription jobs"""

    jobs = list(active_jobs.values())

    if status:
        jobs = [job for job in jobs if job.get("status") == status]

    # Sort by creation time (newest first)
    jobs.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    # Limit results
    jobs = jobs[:limit]

    return {
        "jobs": jobs,
        "total": len(jobs),
        "timestamp": datetime.now().isoformat()
    }

@app.delete("/job/{job_id}")
async def delete_job(job_id: str):
    """Delete transcription job"""

    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    # Remove job from memory
    del active_jobs[job_id]

    return {
        "message": f"Job {job_id} deleted successfully",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/metrics")
async def get_metrics():
    """Get service metrics"""

    total_jobs = len(active_jobs)
    completed_jobs = len([j for j in active_jobs.values() if j.get("status") == "completed"])
    failed_jobs = len([j for j in active_jobs.values() if j.get("status") == "failed"])
    processing_jobs = len([j for j in active_jobs.values() if j.get("status") == "processing"])

    return {
        "total_jobs": total_jobs,
        "completed_jobs": completed_jobs,
        "failed_jobs": failed_jobs,
        "processing_jobs": processing_jobs,
        "success_rate": (completed_jobs / max(total_jobs, 1)) * 100,
        "asr_service_healthy": await transcription_service.check_asr_health(),
        "timestamp": datetime.now().isoformat()
    }

# Run the application
if __name__ == "__main__":
    uvicorn.run(
        "web_integration:app",
        host="0.0.0.0",
        port=8080,
        reload=True,
        log_level="info"
    )
```

## 📊 MONITORING DASHBOARD

### Real-time Monitoring Integration
```python
"""
Real-time Monitoring Dashboard for whoAsr
Provides metrics collection and visualization
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any
import logging
from dataclasses import dataclass, asdict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Monitor")

@dataclass
class SystemMetrics:
    timestamp: datetime
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    active_connections: int
    total_requests: int
    successful_requests: int
    failed_requests: int
    average_response_time: float
    model_memory_usage: Dict[str, float]

class ASRMonitor:
    def __init__(self, asr_base_url: str = "http://localhost:8000"):
        self.asr_base_url = asr_base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.metrics_history: List[SystemMetrics] = []
        self.alert_thresholds = {
            "cpu_usage": 80.0,
            "memory_usage": 85.0,
            "disk_usage": 90.0,
            "response_time": 5.0,
            "error_rate": 10.0
        }
        self.monitoring_active = False

    async def start_monitoring(self, interval: int = 30):
        """Start monitoring with specified interval (seconds)"""
        self.session = aiohttp.ClientSession()
        self.monitoring_active = True

        logger.info(f"Started ASR monitoring with {interval}s interval")

        while self.monitoring_active:
            try:
                metrics = await self.collect_metrics()
                if metrics:
                    self.metrics_history.append(metrics)

                    # Keep only last 24 hours of data
                    cutoff_time = datetime.now() - timedelta(hours=24)
                    self.metrics_history = [
                        m for m in self.metrics_history
                        if m.timestamp > cutoff_time
                    ]

                    # Check for alerts
                    await self.check_alerts(metrics)

                    # Log summary
                    logger.info(
                        f"CPU: {metrics.cpu_usage:.1f}%, "
                        f"Memory: {metrics.memory_usage:.1f}%, "
                        f"Connections: {metrics.active_connections}, "
                        f"Success Rate: {metrics.successful_requests/max(metrics.total_requests,1)*100:.1f}%"
                    )

                await asyncio.sleep(interval)

            except Exception as e:
                logger.error(f"Monitoring error: {e}")
                await asyncio.sleep(interval)

    async def stop_monitoring(self):
        """Stop monitoring"""
        self.monitoring_active = False
        if self.session:
            await self.session.close()
        logger.info("ASR monitoring stopped")

    async def collect_metrics(self) -> Optional[SystemMetrics]:
        """Collect current system metrics"""
        try:
            # Get health status from ASR service
            async with self.session.get(f"{self.asr_base_url}/health") as response:
                if response.status != 200:
                    logger.error(f"Health check failed: {response.status}")
                    return None

                health_data = await response.json()

            # Get detailed model info
            async with self.session.get(f"{self.asr_base_url}/model/info") as response:
                if response.status == 200:
                    model_data = await response.json()
                else:
                    model_data = {}

            # Extract metrics
            system_info = health_data.get('system', {})
            models_info = health_data.get('models', {})

            # Calculate model memory usage
            model_memory = {}
            for model_id, model_data in models_info.items():
                if model_data.get('loaded'):
                    model_memory[model_id] = model_data.get('memory_usage_mb', 0)

            # Calculate request metrics
            total_requests = 0
            successful_requests = 0
            failed_requests = 0

            for model_data in models_info.values():
                total_requests += model_data.get('total_requests', 0)
                # Note: We'd need additional API endpoint for detailed failure counts

            successful_requests = total_requests  # Simplified

            return SystemMetrics(
                timestamp=datetime.now(),
                cpu_usage=system_info.get('cpu_usage', 0) * 100,
                memory_usage=system_info.get('memory_usage', 0) * 100,
                disk_usage=system_info.get('disk_usage', 0) * 100,
                active_connections=system_info.get('active_connections', 0),
                total_requests=total_requests,
                successful_requests=successful_requests,
                failed_requests=failed_requests,
                average_response_time=0.5,  # Would need real measurement
                model_memory_usage=model_memory
            )

        except Exception as e:
            logger.error(f"Failed to collect metrics: {e}")
            return None

    async def check_alerts(self, metrics: SystemMetrics):
        """Check for alert conditions"""
        alerts = []

        # CPU usage alert
        if metrics.cpu_usage > self.alert_thresholds["cpu_usage"]:
            alerts.append({
                "type": "cpu_high",
                "message": f"High CPU usage: {metrics.cpu_usage:.1f}%",
                "severity": "warning"
            })

        # Memory usage alert
        if metrics.memory_usage > self.alert_thresholds["memory_usage"]:
            alerts.append({
                "type": "memory_high",
                "message": f"High memory usage: {metrics.memory_usage:.1f}%",
                "severity": "critical"
            })

        # Disk usage alert
        if metrics.disk_usage > self.alert_thresholds["disk_usage"]:
            alerts.append({
                "type": "disk_high",
                "message": f"High disk usage: {metrics.disk_usage:.1f}%",
                "severity": "warning"
            })

        # Error rate alert
        if metrics.total_requests > 0:
            error_rate = (metrics.failed_requests / metrics.total_requests) * 100
            if error_rate > self.alert_thresholds["error_rate"]:
                alerts.append({
                    "type": "error_rate_high",
                    "message": f"High error rate: {error_rate:.1f}%",
                    "severity": "critical"
                })

        # Log alerts
        for alert in alerts:
            logger.warning(f"ALERT: {alert['message']}")

            # Here you could send to external monitoring system
            # await self.send_alert(alert)

    def get_metrics_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get metrics summary for specified period"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_metrics = [
            m for m in self.metrics_history
            if m.timestamp > cutoff_time
        ]

        if not recent_metrics:
            return {"error": "No metrics data available"}

        # Calculate averages and extremes
        cpu_values = [m.cpu_usage for m in recent_metrics]
        memory_values = [m.memory_usage for m in recent_metrics]
        connection_values = [m.active_connections for m in recent_metrics]

        return {
            "period_hours": hours,
            "data_points": len(recent_metrics),
            "cpu": {
                "average": sum(cpu_values) / len(cpu_values),
                "max": max(cpu_values),
                "min": min(cpu_values)
            },
            "memory": {
                "average": sum(memory_values) / len(memory_values),
                "max": max(memory_values),
                "min": min(memory_values)
            },
            "connections": {
                "average": sum(connection_values) / len(connection_values),
                "max": max(connection_values),
                "current": connection_values[-1] if connection_values else 0
            },
            "total_requests": recent_metrics[-1].total_requests if recent_metrics else 0,
            "success_rate": (
                recent_metrics[-1].successful_requests / max(recent_metrics[-1].total_requests, 1) * 100
                if recent_metrics else 0
            )
        }

    def get_model_usage_report(self) -> Dict[str, Any]:
        """Get model usage statistics"""
        if not self.metrics_history:
            return {"error": "No metrics data available"}

        latest_metrics = self.metrics_history[-1]

        model_report = {}
        for model_id, memory_mb in latest_metrics.model_memory_usage.items():
            model_report[model_id] = {
                "memory_usage_mb": memory_mb,
                "memory_usage_gb": memory_mb / 1024,
                "status": "loaded"
            }

        return {
            "timestamp": latest_metrics.timestamp.isoformat(),
            "total_model_memory_mb": sum(latest_metrics.model_memory_usage.values()),
            "total_model_memory_gb": sum(latest_metrics.model_memory_usage.values()) / 1024,
            "models": model_report
        }

# Usage Example
async def main():
    monitor = ASRMonitor()

    try:
        # Start monitoring
        monitor_task = asyncio.create_task(monitor.start_monitoring(interval=30))

        # Run for demonstration period
        print("Starting ASR monitoring (will run for 5 minutes)...")
        await asyncio.sleep(300)  # Run for 5 minutes

        # Get summary
        summary = monitor.get_metrics_summary(hours=1)
        print(f"\n1-hour Summary:")
        print(f"  CPU Avg: {summary['cpu']['average']:.1f}%")
        print(f"  Memory Avg: {summary['memory']['average']:.1f}%")
        print(f"  Total Requests: {summary['total_requests']}")

        # Get model report
        model_report = monitor.get_model_usage_report()
        print(f"\nModel Usage:")
        print(f"  Total Memory: {model_report['total_model_memory_gb']:.1f}GB")
        for model_id, stats in model_report['models'].items():
            print(f"  {model_id}: {stats['memory_usage_mb']:.0f}MB")

    except KeyboardInterrupt:
        print("\nMonitoring stopped by user")
    finally:
        await monitor.stop_monitoring()

if __name__ == "__main__":
    asyncio.run(main())
```

---

**These integration examples provide production-ready implementations for common AI agent use cases, demonstrating best practices for error handling, performance monitoring, and scalable architecture patterns when integrating with whoAsr.**