# HTTP REST API Reference

## 🎯 INTEGRATION CONTEXT

**Purpose**: Batch speech recognition and text processing for AI agents requiring file-based transcription
**Protocol**: HTTP/1.1 REST API with JSON responses and multipart file uploads
**Use Cases**: Document transcription, audio file processing, punctuation restoration, text analysis

## 🌐 BASE URL AND AUTHENTICATION

```
Base URL: http://localhost:8000
Authentication: None (local deployment)
Content-Type: application/json or multipart/form-data
```

## 📋 ENDPOINT SPECIFICATIONS

### 1. File-based Speech Recognition

#### POST /recognize
**Purpose**: Transcribe audio files (supports various formats)
**Content-Type**: multipart/form-data

**Request Parameters:**
```json
{
  "file": "audio_file.wav",           // Required: Audio file (max 100MB)
  "batch_size_s": 300,                // Optional: Batch size in seconds (default: 300)
  "batch_size_threshold_s": 60,       // Optional: Threshold for batching (default: 60)
  "hotword": "特定关键词"               // Optional: Custom hotword for better recognition
}
```

**Supported Audio Formats:**
- WAV, MP3, FLAC, M4A, OGG
- Auto-sample rate conversion to 16kHz
- Auto-channel conversion to mono
- Max file size: 100MB

**Response Format:**
```json
{
  "success": true,
  "text": "完整的中文转录文本，包含标点符号。",
  "duration": 125.5,
  "processing_time": 8.2,
  "segments": [
    {
      "start": 0.0,
      "end": 5.2,
      "text": "第一段识别结果",
      "confidence": 0.95
    },
    {
      "start": 5.2,
      "end": 10.8,
      "text": "第二段识别结果，",
      "confidence": 0.92
    }
  ],
  "metadata": {
    "sample_rate": 16000,
    "channels": 1,
    "format": "float32",
    "model_version": "paraformer-zh-streaming"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "File format not supported",
  "error_code": "UNSUPPORTED_FORMAT",
  "details": "The uploaded file format is not supported. Please use WAV, MP3, FLAC, M4A, or OGG."
}
```

**Integration Example:**
```python
import requests
import json

def transcribe_audio_file(file_path, hotword=None):
    """Transcribe audio file using whoAsr REST API"""
    url = "http://localhost:8000/recognize"

    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {
            'batch_size_s': 300,
            'batch_size_threshold_s': 60
        }

        if hotword:
            data['hotword'] = hotword

        try:
            response = requests.post(url, files=files, data=data, timeout=300)
            response.raise_for_status()

            result = response.json()
            if result['success']:
                print(f"Transcription: {result['text']}")
                print(f"Processing time: {result['processing_time']}s")
                return result['text']
            else:
                print(f"Error: {result['error']}")
                return None

        except requests.exceptions.RequestException as e:
            print(f"API request failed: {e}")
            return None

# Usage example
transcription = transcribe_audio_file("meeting_recording.wav", hotword="人工智能")
```

### 2. Text Punctuation Restoration

#### POST /punctuate
**Purpose**: Add punctuation to unpunctuated Chinese text
**Content-Type**: application/json

**Request Body:**
```json
{
  "text": "今天的天气很好我们一起去公园散步吧",
  "model": "ct-punc"                    // Optional: Punctuation model (default: "ct-punc")
}
```

**Response Format:**
```json
{
  "success": true,
  "text": "今天的天气很好，我们一起去公园散步吧。",
  "processing_time": 0.15,
  "model": "ct-punc",
  "statistics": {
    "characters_added": 3,
    "punctuation_marks": ["，", "。"],
    "original_length": 15,
    "processed_length": 18
  }
}
```

**Integration Example:**
```python
def add_punctuation(text):
    """Add punctuation to Chinese text"""
    url = "http://localhost:8000/punctuate"

    payload = {"text": text}

    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()

        result = response.json()
        if result['success']:
            return result['text']
        else:
            print(f"Punctuation error: {result['error']}")
            return text

    except requests.exceptions.RequestException as e:
        print(f"Punctuation request failed: {e}")
        return text

# Usage example
raw_text = "今天上午我们开了一个重要的会议讨论了下季度的工作计划"
punctuated_text = add_punctuation(raw_text)
print(f"Original: {raw_text}")
print(f"Punctuated: {punctuated_text}")
# Output: 今天上午我们开了一个重要的会议，讨论了下季度的工作计划。
```

### 3. Voice Activity Detection

#### POST /vad
**Purpose**: Detect speech segments in audio files
**Content-Type**: multipart/form-data

**Request Parameters:**
```json
{
  "file": "audio_file.wav",           // Required: Audio file
  "threshold": 0.5,                   // Optional: VAD threshold (0.0-1.0, default: 0.5)
  "min_speech_duration": 0.3,         // Optional: Minimum speech duration in seconds
  "min_silence_duration": 0.5         // Optional: Minimum silence duration in seconds
}
```

**Response Format:**
```json
{
  "success": true,
  "speech_segments": [
    {
      "start": 2.1,
      "end": 5.8,
      "duration": 3.7,
      "confidence": 0.92
    },
    {
      "start": 8.2,
      "end": 12.4,
      "duration": 4.2,
      "confidence": 0.87
    }
  ],
  "total_speech_time": 7.9,
  "total_duration": 15.0,
  "speech_ratio": 0.53,
  "processing_time": 0.8
}
```

**Integration Example:**
```python
def detect_speech_segments(file_path, threshold=0.5):
    """Detect speech segments in audio file"""
    url = "http://localhost:8000/vad"

    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {
            'threshold': threshold,
            'min_speech_duration': 0.3,
            'min_silence_duration': 0.5
        }

        try:
            response = requests.post(url, files=files, data=data, timeout=60)
            response.raise_for_status()

            result = response.json()
            if result['success']:
                segments = result['speech_segments']
                print(f"Found {len(segments)} speech segments")
                print(f"Total speech time: {result['total_speech_time']}s")
                return segments
            else:
                print(f"VAD error: {result['error']}")
                return []

        except requests.exceptions.RequestException as e:
            print(f"VAD request failed: {e}")
            return []

# Usage example
segments = detect_speech_segments("interview.wav")
for i, segment in enumerate(segments):
    print(f"Segment {i+1}: {segment['start']:.1f}s - {segment['end']:.1f}s ({segment['duration']:.1f}s)")
```

### 4. System Information and Health Checks

#### GET /health
**Purpose**: Check system health and model status
**Content-Type**: application/json

**Response Format:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime": 3600,
  "models": {
    "streaming_asr": {
      "loaded": true,
      "memory_usage": "1.2GB",
      "last_used": "2024-01-01T11:45:00Z"
    },
    "punctuation": {
      "loaded": true,
      "memory_usage": "200MB",
      "last_used": "2024-01-01T11:58:00Z"
    }
  },
  "system": {
    "cpu_usage": 0.25,
    "memory_usage": 0.68,
    "disk_usage": 0.45,
    "active_connections": 3
  }
}
```

#### GET /
**Purpose**: Web interface access
**Returns**: HTML web application for testing and demonstration

#### GET /docs
**Purpose**: API documentation (FastAPI auto-generated)
**Returns**: Interactive API documentation with testing interface

## 🔄 BATCH PROCESSING WORKFLOWS

### Complete Audio Processing Pipeline
```python
import requests
import json
import time
from pathlib import Path

class AudioProcessor:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url

    def check_system_health(self):
        """Check if system is ready for processing"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            health = response.json()

            if health['status'] != 'healthy':
                return False, "System not healthy"

            # Check if required models are loaded
            if not health['models']['streaming_asr']['loaded']:
                return False, "ASR model not loaded"

            return True, "System ready"

        except Exception as e:
            return False, f"Health check failed: {e}"

    def process_audio_file(self, file_path, add_punctuation=True, detect_segments=False):
        """Complete audio processing pipeline"""
        print(f"Processing audio file: {file_path}")

        # 1. Check system health
        healthy, message = self.check_system_health()
        if not healthy:
            return {"error": message}

        # 2. Transcribe audio
        print("Step 1: Transcribing audio...")
        transcription = self._transcribe_file(file_path)
        if not transcription:
            return {"error": "Transcription failed"}

        result = {
            "transcription": transcription['text'],
            "segments": transcription.get('segments', []),
            "metadata": transcription.get('metadata', {})
        }

        # 3. Add punctuation if requested
        if add_punctuation:
            print("Step 2: Adding punctuation...")
            punctuated = self._add_punctuation(transcription['text'])
            result["punctuated_text"] = punctuated

        # 4. Detect speech segments if requested
        if detect_segments:
            print("Step 3: Detecting speech segments...")
            segments = self._detect_speech_segments(file_path)
            result["speech_segments"] = segments

        return result

    def _transcribe_file(self, file_path):
        """Internal method for transcription"""
        url = f"{self.base_url}/recognize"

        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'batch_size_s': 300}

            response = requests.post(url, files=files, data=data, timeout=300)
            result = response.json()

            if result['success']:
                return result
            else:
                print(f"Transcription error: {result['error']}")
                return None

    def _add_punctuation(self, text):
        """Internal method for punctuation"""
        url = f"{self.base_url}/punctuate"
        payload = {"text": text}

        response = requests.post(url, json=payload, timeout=30)
        result = response.json()

        return result['text'] if result['success'] else text

    def _detect_speech_segments(self, file_path):
        """Internal method for VAD"""
        url = f"{self.base_url}/vad"

        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'threshold': 0.5}

            response = requests.post(url, files=files, data=data, timeout=60)
            result = response.json()

            return result['speech_segments'] if result['success'] else []

# Usage example
processor = AudioProcessor()

# Process single file
result = processor.process_audio_file(
    "meeting.wav",
    add_punctuation=True,
    detect_segments=True
)

if "error" not in result:
    print(f"Transcription: {result['transcription']}")
    print(f"Punctuated: {result['punctuated_text']}")
    print(f"Speech segments: {len(result['speech_segments'])}")
else:
    print(f"Processing failed: {result['error']}")
```

## ⚡ PERFORMANCE OPTIMIZATION

### Request Optimization
```python
# Batch processing for multiple files
def batch_process_files(file_paths, max_concurrent=3):
    """Process multiple audio files concurrently"""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    processor = AudioProcessor()

    with ThreadPoolExecutor(max_workers=max_concurrent) as executor:
        # Submit all tasks
        future_to_file = {
            executor.submit(processor.process_audio_file, file_path): file_path
            for file_path in file_paths
        }

        # Process results as they complete
        results = {}
        for future in as_completed(future_to_file):
            file_path = future_to_file[future]
            try:
                result = future.result()
                results[file_path] = result
                print(f"✅ Completed: {file_path}")
            except Exception as e:
                print(f"❌ Failed: {file_path} - {e}")
                results[file_path] = {"error": str(e)}

    return results

# Usage
files = ["audio1.wav", "audio2.mp3", "audio3.flac"]
results = batch_process_files(files)
```

### Caching Strategy
```python
import functools
import hashlib
import os

class CachedAudioProcessor(AudioProcessor):
    def __init__(self, base_url="http://localhost:8000", cache_dir="./cache"):
        super().__init__(base_url)
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)

    def _get_file_hash(self, file_path):
        """Generate hash for file caching"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()

    def process_audio_file(self, file_path, add_punctuation=True, detect_segments=False):
        """Process with caching"""
        file_hash = self._get_file_hash(file_path)
        cache_file = os.path.join(self.cache_dir, f"{file_hash}.json")

        # Check cache first
        if os.path.exists(cache_file):
            print(f"Loading from cache: {file_path}")
            with open(cache_file, 'r') as f:
                return json.load(f)

        # Process and cache result
        result = super().process_audio_file(file_path, add_punctuation, detect_segments)

        if "error" not in result:
            with open(cache_file, 'w') as f:
                json.dump(result, f, indent=2)
            print(f"Cached result: {file_path}")

        return result
```

## 🚨 ERROR HANDLING BEST PRACTICES

### Comprehensive Error Handling
```python
import time
from enum import Enum

class APIError(Enum):
    NETWORK_ERROR = "network_error"
    MODEL_UNAVAILABLE = "model_unavailable"
    INVALID_FILE = "invalid_file"
    PROCESSING_ERROR = "processing_error"
    RATE_LIMIT = "rate_limit"

class RobustAudioProcessor:
    def __init__(self, base_url="http://localhost:8000", max_retries=3):
        self.base_url = base_url
        self.max_retries = max_retries

    def _make_request_with_retry(self, method, url, **kwargs):
        """Make HTTP request with exponential backoff retry"""
        for attempt in range(self.max_retries):
            try:
                response = requests.request(method, url, timeout=kwargs.pop('timeout', 30), **kwargs)

                # Handle specific HTTP errors
                if response.status_code == 429:
                    if attempt < self.max_retries - 1:
                        wait_time = 2 ** attempt
                        print(f"Rate limited. Waiting {wait_time}s...")
                        time.sleep(wait_time)
                        continue

                response.raise_for_status()
                return response.json()

            except requests.exceptions.ConnectionError:
                if attempt < self.max_retries - 1:
                    wait_time = 2 ** attempt
                    print(f"Connection error. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                raise APIError.NETWORK_ERROR

            except requests.exceptions.Timeout:
                if attempt < self.max_retries - 1:
                    wait_time = 2 ** attempt
                    print(f"Request timeout. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                raise APIError.NETWORK_ERROR

            except requests.exceptions.RequestException as e:
                raise APIError.NETWORK_ERROR

        raise APIError.PROCESSING_ERROR

    def safe_transcribe(self, file_path):
        """Safe transcription with comprehensive error handling"""
        try:
            # Validate file
            if not os.path.exists(file_path):
                raise APIError.INVALID_FILE

            file_size = os.path.getsize(file_path)
            if file_size > 100 * 1024 * 1024:  # 100MB
                raise APIError.INVALID_FILE

            # Make request
            url = f"{self.base_url}/recognize"

            with open(file_path, 'rb') as f:
                files = {'file': f}
                data = {'batch_size_s': 300}

                result = self._make_request_with_retry('POST', url, files=files, data=data)

                if result.get('success'):
                    return result['text']
                else:
                    print(f"API Error: {result.get('error', 'Unknown error')}")
                    return None

        except APIError as e:
            print(f"Processing failed: {e.value}")
            return None
        except Exception as e:
            print(f"Unexpected error: {e}")
            return None
```

## 📊 MONITORING AND LOGGING

### Request Logging
```python
import logging
import time
from datetime import datetime

class MonitoredAudioProcessor:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.logger = logging.getLogger("asr_processor")

        # Configure logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

    def process_with_monitoring(self, file_path):
        """Process with detailed monitoring"""
        start_time = time.time()
        file_size = os.path.getsize(file_path)

        self.logger.info(f"Starting processing: {file_path} ({file_size/1024/1024:.1f}MB)")

        try:
            result = self.process_audio_file(file_path)

            processing_time = time.time() - start_time
            self.logger.info(f"Processing completed in {processing_time:.2f}s")

            # Log performance metrics
            if "metadata" in result:
                duration = result["metadata"].get("duration", 0)
                if duration > 0:
                    real_time_factor = processing_time / duration
                    self.logger.info(f"Real-time factor: {real_time_factor:.2f}")

            return result

        except Exception as e:
            processing_time = time.time() - start_time
            self.logger.error(f"Processing failed after {processing_time:.2f}s: {e}")
            raise
```

---

**This HTTP REST API specification provides AI agents with comprehensive integration patterns for batch speech recognition, text processing, and system monitoring capabilities, including robust error handling and performance optimization strategies.**