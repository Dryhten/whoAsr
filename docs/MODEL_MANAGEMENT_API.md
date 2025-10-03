# Model Management API Reference

## 🎯 INTEGRATION CONTEXT

**Purpose**: Control AI model lifecycle for AI agents requiring dynamic model management
**Protocol**: HTTP REST API with JSON responses
**Use Cases**: Production deployment automation, resource optimization, multi-tenant model management

## 📋 MODEL OVERVIEW

### Available Models

#### 1. Streaming ASR Model
- **Model ID**: `streaming_asr`
- **Name**: FunASR Paraformer-zh-streaming
- **Purpose**: Real-time Chinese speech recognition
- **Memory Usage**: ~1.2GB RAM
- **Load Time**: 30-60 seconds (first load)
- **Description**: Streaming automatic speech recognition model optimized for Chinese language with real-time incremental transcription capabilities

#### 2. Punctuation Model
- **Model ID**: `punctuation`
- **Name**: FunASR CT-Punc
- **Purpose**: Chinese text punctuation restoration
- **Memory Usage**: ~200MB RAM
- **Load Time**: 10-20 seconds (first load)
- **Description**: Context-aware punctuation restoration model for Chinese text that adds proper punctuation marks to unpunctuated transcripts

## 🌐 ENDPOINT SPECIFICATIONS

### 1. Get Model Information

#### GET|POST /model/info
**Purpose**: Retrieve current model status and system information
**Content-Type**: application/json

**Request Body (Optional for POST):**
```json
{
  "detailed": true,                    // Optional: Include detailed model information
  "include_metrics": true             // Optional: Include performance metrics
}
```

**Response Format:**
```json
{
  "success": true,
  "timestamp": "2024-01-01T12:00:00Z",
  "available_models": {
    "streaming_asr": {
      "model_id": "streaming_asr",
      "display_name": "FunASR Paraformer-zh-streaming",
      "description": "Real-time Chinese speech recognition model",
      "version": "1.2.7",
      "provider": "FunASR",
      "language": "Chinese (Mandarin)",
      "capabilities": ["streaming", "real-time", "incremental"],
      "loaded": true,
      "memory_usage_mb": 1256,
      "load_time_ms": 45230,
      "last_used": "2024-01-01T11:45:00Z",
      "total_requests": 1250,
      "success_rate": 0.987
    },
    "punctuation": {
      "model_id": "punctuation",
      "display_name": "FunASR CT-Punc",
      "description": "Chinese text punctuation restoration model",
      "version": "1.2.7",
      "provider": "FunASR",
      "language": "Chinese",
      "capabilities": ["punctuation", "text-processing"],
      "loaded": true,
      "memory_usage_mb": 198,
      "load_time_ms": 12450,
      "last_used": "2024-01-01T11:58:00Z",
      "total_requests": 856,
      "success_rate": 0.995
    }
  },
  "system_info": {
    "total_memory_gb": 16.0,
    "available_memory_gb": 8.5,
    "cpu_cores": 8,
    "python_version": "3.13.0",
    "framework": "FastAPI 0.104.1",
    "uptime_hours": 24.5
  },
  "model_cache": {
    "cache_enabled": true,
    "cache_directory": "/app/models/cache",
    "cache_size_mb": 1456,
    "cache_hit_rate": 0.85
  }
}
```

**Integration Example:**
```python
import requests
import json

class ModelManager:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url

    def get_model_status(self, detailed=False):
        """Get current model loading status"""
        url = f"{self.base_url}/model/info"

        try:
            if detailed:
                response = requests.post(url, json={"detailed": True, "include_metrics": True})
            else:
                response = requests.get(url)

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            print(f"Failed to get model status: {e}")
            return None

    def check_model_readiness(self, required_models=None):
        """Check if required models are loaded and ready"""
        if required_models is None:
            required_models = ["streaming_asr", "punctuation"]

        status = self.get_model_status()
        if not status or not status.get('success'):
            return False, "Failed to get model status"

        available_models = status.get('available_models', {})
        missing_models = []
        unloaded_models = []

        for model_id in required_models:
            if model_id not in available_models:
                missing_models.append(model_id)
            elif not available_models[model_id].get('loaded', False):
                unloaded_models.append(model_id)

        if missing_models:
            return False, f"Missing models: {', '.join(missing_models)}"

        if unloaded_models:
            return False, f"Unloaded models: {', '.join(unloaded_models)}"

        return True, "All required models are loaded and ready"

# Usage example
manager = ModelManager()

# Basic status check
status = manager.get_model_status()
if status:
    print(f"Models available: {list(status['available_models'].keys())}")

# Check readiness for ASR processing
ready, message = manager.check_model_readiness(["streaming_asr"])
if ready:
    print("✅ ASR model is ready for transcription")
else:
    print(f"❌ ASR model not ready: {message}")
```

### 2. Load Model

#### POST /model/load
**Purpose**: Load specified AI model into memory
**Content-Type**: application/json

**Request Body:**
```json
{
  "model_type": "streaming_asr",          // Required: Model ID to load
  "force_reload": false,                 // Optional: Force reload even if already loaded
  "async_load": true,                    // Optional: Load asynchronously (default: true)
  "timeout": 300                         // Optional: Timeout in seconds (default: 300)
}
```

**Available Model Types:**
- `streaming_asr`: Load FunASR paraformer-zh-streaming model
- `punctuation`: Load FunASR CT-Punc punctuation model
- `all`: Load all available models (batch operation)

**Response Format (Success):**
```json
{
  "success": true,
  "message": "Model loading initiated",
  "model_type": "streaming_asr",
  "load_id": "load_123456789",
  "async": true,
  "estimated_load_time": 45000,
  "current_status": "loading"
}
```

**Response Format (Complete):**
```json
{
  "success": true,
  "message": "Model loaded successfully",
  "model_type": "streaming_asr",
  "load_time_ms": 42310,
  "memory_usage_mb": 1256,
  "model_version": "1.2.7",
  "status": "loaded"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Model not found",
  "error_code": "MODEL_NOT_FOUND",
  "available_models": ["streaming_asr", "punctuation"],
  "details": "The requested model 'invalid_model' does not exist"
}
```

**Integration Example:**
```python
import time
from enum import Enum

class ModelLoadStatus(Enum):
    PENDING = "pending"
    LOADING = "loading"
    COMPLETED = "completed"
    FAILED = "failed"

class ModelManager:
    # ... (previous methods)

    def load_model(self, model_type, force_reload=False, async_load=True, timeout=300):
        """Load a specific model"""
        url = f"{self.base_url}/model/load"

        payload = {
            "model_type": model_type,
            "force_reload": force_reload,
            "async_load": async_load,
            "timeout": timeout
        }

        try:
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            result = response.json()

            if result['success']:
                if async_load:
                    print(f"Model loading initiated: {model_type}")
                    return result['load_id']
                else:
                    print(f"Model loaded successfully: {model_type}")
                    return True
            else:
                print(f"Load failed: {result['error']}")
                return False

        except requests.exceptions.RequestException as e:
            print(f"Failed to load model: {e}")
            return False

    def wait_for_model_load(self, load_id, check_interval=5, max_wait=300):
        """Wait for asynchronous model loading to complete"""
        start_time = time.time()

        while time.time() - start_time < max_wait:
            status = self.get_model_status()
            if status and status.get('success'):
                # Check if any model is currently loading
                for model_id, model_info in status.get('available_models', {}).items():
                    if model_info.get('loading', False):
                        print(f"Model {model_id} still loading...")
                        time.sleep(check_interval)
                        continue

                # All models loaded
                print("✅ All models loaded successfully")
                return True

            time.sleep(check_interval)

        print(f"❌ Model loading timeout after {max_wait}s")
        return False

    def ensure_model_loaded(self, model_type, force_reload=False):
        """Ensure a model is loaded, load if necessary"""
        # Check current status
        status = self.get_model_status()
        if not status:
            return False

        available_models = status.get('available_models', {})
        model_info = available_models.get(model_type)

        # Check if model needs loading
        if not model_info:
            print(f"❌ Model {model_type} not available")
            return False

        if model_info.get('loaded', False) and not force_reload:
            print(f"✅ Model {model_type} already loaded")
            return True

        # Load the model
        print(f"Loading model {model_type}...")
        load_id = self.load_model(model_type, force_reload=force_reload)

        if load_id:
            return self.wait_for_model_load(load_id)

        return False

# Usage example
manager = ModelManager()

# Ensure ASR model is loaded
if manager.ensure_model_loaded("streaming_asr"):
    print("ASR model is ready for use")
else:
    print("Failed to load ASR model")

# Load multiple models
models_to_load = ["streaming_asr", "punctuation"]
for model in models_to_load:
    if manager.ensure_model_loaded(model):
        print(f"✅ {model} loaded successfully")
    else:
        print(f"❌ Failed to load {model}")
```

### 3. Unload Model

#### DELETE /model/unload/{model_type}
**Purpose**: Unload specified model to free memory
**Path Parameters:**
- `model_type`: Model ID to unload (streaming_asr, punctuation, or all)

**Response Format:**
```json
{
  "success": true,
  "message": "Model unloaded successfully",
  "model_type": "streaming_asr",
  "memory_freed_mb": 1256,
  "unload_time_ms": 210,
  "models_remaining": ["punctuation"]
}
```

**Integration Example:**
```python
class ModelManager:
    # ... (previous methods)

    def unload_model(self, model_type):
        """Unload a specific model to free memory"""
        url = f"{self.base_url}/model/unload/{model_type}"

        try:
            response = requests.delete(url, timeout=30)
            response.raise_for_status()
            result = response.json()

            if result['success']:
                memory_freed = result.get('memory_freed_mb', 0)
                print(f"✅ Model {model_type} unloaded, freed {memory_freed}MB")
                return True
            else:
                print(f"❌ Unload failed: {result['error']}")
                return False

        except requests.exceptions.RequestException as e:
            print(f"Failed to unload model: {e}")
            return False

    def optimize_memory_usage(self, keep_models=None):
        """Optimize memory usage by unloading unused models"""
        if keep_models is None:
            keep_models = []

        status = self.get_model_status()
        if not status:
            return False

        available_models = status.get('available_models', {})
        unloaded_count = 0

        for model_id, model_info in available_models.items():
            if model_id not in keep_models and model_info.get('loaded', False):
                if self.unload_model(model_id):
                    unloaded_count += 1

        print(f"Memory optimization completed, unloaded {unloaded_count} models")
        return True

# Usage example
manager = ModelManager()

# Unload specific model
manager.unload_model("punctuation")

# Optimize memory usage (keep only ASR model)
manager.optimize_memory_usage(keep_models=["streaming_asr"])
```

## 🔄 ADVANCED MODEL MANAGEMENT WORKFLOWS

### Production Model Lifecycle Management
```python
import time
import threading
from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass
class ModelConfig:
    model_id: str
    required: bool = False
    priority: int = 0  # Higher priority models are loaded first
    memory_mb: int = 0
    preload: bool = False

class ProductionModelManager:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.model_configs = {
            "streaming_asr": ModelConfig(
                model_id="streaming_asr",
                required=True,
                priority=10,
                memory_mb=1256,
                preload=True
            ),
            "punctuation": ModelConfig(
                model_id="punctuation",
                required=False,
                priority=5,
                memory_mb=198,
                preload=False
            )
        }
        self.monitoring_thread = None
        self.monitoring_active = False

    def startup_initialization(self):
        """Initialize models for production deployment"""
        print("🚀 Starting production model initialization...")

        # Load required models first
        required_models = [
            config for config in self.model_configs.values()
            if config.required and config.preload
        ]

        # Sort by priority
        required_models.sort(key=lambda x: x.priority, reverse=True)

        for config in required_models:
            print(f"Loading required model: {config.model_id}")
            if not self._ensure_model_loaded_with_retry(config.model_id):
                print(f"❌ CRITICAL: Failed to load required model {config.model_id}")
                return False

        # Load optional models if memory permits
        optional_models = [
            config for config in self.model_configs.values()
            if not config.required and config.preload
        ]

        if optional_models:
            status = self.get_model_status()
            if status:
                available_memory = status.get('system_info', {}).get('available_memory_gb', 0) * 1024
                used_memory = sum(
                    info.get('memory_usage_mb', 0)
                    for info in status.get('available_models', {}).values()
                    if info.get('loaded', False)
                )

                remaining_memory = available_memory - used_memory

                for config in optional_models:
                    if remaining_memory >= config.memory_mb * 1.2:  # 20% buffer
                        print(f"Loading optional model: {config.model_id}")
                        if self._ensure_model_loaded_with_retry(config.model_id):
                            remaining_memory -= config.memory_mb
                        else:
                            print(f"Warning: Failed to load optional model {config.model_id}")
                    else:
                        print(f"Skipping {config.model_id}: insufficient memory")

        print("✅ Model initialization completed")
        return True

    def _ensure_model_loaded_with_retry(self, model_type, max_retries=3):
        """Ensure model is loaded with retry logic"""
        for attempt in range(max_retries):
            if self.ensure_model_loaded(model_type):
                return True

            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                print(f"Retrying model load in {wait_time}s... (attempt {attempt + 1})")
                time.sleep(wait_time)

        return False

    def start_monitoring(self):
        """Start background model health monitoring"""
        if self.monitoring_thread and self.monitoring_thread.is_alive():
            print("Model monitoring already active")
            return

        self.monitoring_active = True
        self.monitoring_thread = threading.Thread(target=self._monitor_models)
        self.monitoring_thread.daemon = True
        self.monitoring_thread.start()
        print("Model health monitoring started")

    def stop_monitoring(self):
        """Stop background monitoring"""
        self.monitoring_active = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=5)
        print("Model health monitoring stopped")

    def _monitor_models(self):
        """Background model health monitoring"""
        while self.monitoring_active:
            try:
                status = self.get_model_status()
                if not status:
                    print("Warning: Could not get model status")
                    time.sleep(30)
                    continue

                # Check required models
                for model_id, config in self.model_configs.items():
                    if config.required:
                        model_info = status.get('available_models', {}).get(model_id)
                        if not model_info or not model_info.get('loaded', False):
                            print(f"⚠️ ALERT: Required model {model_id} not loaded")
                            # Attempt to reload
                            self._ensure_model_loaded_with_retry(model_id)

                # Memory usage optimization
                self._optimize_memory_usage(status)

                time.sleep(60)  # Check every minute

            except Exception as e:
                print(f"Model monitoring error: {e}")
                time.sleep(30)

    def _optimize_memory_usage(self, status):
        """Optimize memory usage based on current status"""
        available_memory = status.get('system_info', {}).get('available_memory_gb', 0) * 1024
        used_memory = sum(
            info.get('memory_usage_mb', 0)
            for info in status.get('available_models', {}).values()
            if info.get('loaded', False)
        )

        memory_usage_ratio = used_memory / available_memory if available_memory > 0 else 1.0

        # If memory usage is high, unload optional models
        if memory_usage_ratio > 0.8:  # 80% threshold
            print(f"High memory usage: {memory_usage_ratio:.1%}, optimizing...")

            for model_id, config in self.model_configs.items():
                if not config.required:
                    model_info = status.get('available_models', {}).get(model_id)
                    if model_info and model_info.get('loaded', False):
                        if self.unload_model(model_id):
                            print(f"Unloaded {model_id} to free memory")
                            break

    def graceful_shutdown(self):
        """Graceful shutdown procedure"""
        print("🔄 Starting graceful model shutdown...")

        # Stop monitoring
        self.stop_monitoring()

        # Unload all models
        for model_id in self.model_configs.keys():
            self.unload_model(model_id)

        print("✅ Model shutdown completed")

# Usage example
if __name__ == "__main__":
    # Initialize production model manager
    manager = ProductionModelManager()

    try:
        # Startup initialization
        if manager.startup_initialization():
            print("Production models initialized successfully")

            # Start monitoring
            manager.start_monitoring()

            # Keep running
            print("Model management system running...")
            while True:
                time.sleep(1)
        else:
            print("Failed to initialize production models")

    except KeyboardInterrupt:
        print("Received shutdown signal")
        manager.graceful_shutdown()
```

## 📊 MODEL PERFORMANCE MONITORING

### Model Metrics Collection
```python
import psutil
import time
from collections import defaultdict
from datetime import datetime, timedelta

class ModelPerformanceMonitor:
    def __init__(self, model_manager):
        self.model_manager = model_manager
        self.metrics_history = defaultdict(list)
        self.collection_active = False

    def start_metrics_collection(self, interval=60):
        """Start collecting model performance metrics"""
        self.collection_active = True

        while self.collection_active:
            try:
                # Collect system metrics
                metrics = {
                    'timestamp': datetime.now().isoformat(),
                    'system': {
                        'cpu_percent': psutil.cpu_percent(),
                        'memory_percent': psutil.virtual_memory().percent,
                        'available_memory_gb': psutil.virtual_memory().available / (1024**3),
                        'disk_usage_percent': psutil.disk_usage('/').percent
                    },
                    'models': {}
                }

                # Collect model-specific metrics
                status = self.model_manager.get_model_status(detailed=True)
                if status:
                    for model_id, model_info in status.get('available_models', {}).items():
                        if model_info.get('loaded', False):
                            metrics['models'][model_id] = {
                                'memory_usage_mb': model_info.get('memory_usage_mb', 0),
                                'total_requests': model_info.get('total_requests', 0),
                                'success_rate': model_info.get('success_rate', 0.0),
                                'uptime_hours': model_info.get('uptime_hours', 0)
                            }

                # Store metrics
                self.metrics_history['metrics'].append(metrics)

                # Keep only last 24 hours of data
                cutoff_time = datetime.now() - timedelta(hours=24)
                self.metrics_history['metrics'] = [
                    m for m in self.metrics_history['metrics']
                    if datetime.fromisoformat(m['timestamp']) > cutoff_time
                ]

                time.sleep(interval)

            except Exception as e:
                print(f"Metrics collection error: {e}")
                time.sleep(interval)

    def get_performance_report(self, hours=24):
        """Generate performance report for specified period"""
        cutoff_time = datetime.now() - timedelta(hours=hours)

        relevant_metrics = [
            m for m in self.metrics_history.get('metrics', [])
            if datetime.fromisoformat(m['timestamp']) > cutoff_time
        ]

        if not relevant_metrics:
            return "No metrics data available for specified period"

        report = f"📊 Model Performance Report (Last {hours} hours)\n"
        report += "=" * 50 + "\n\n"

        # System performance summary
        cpu_usage = [m['system']['cpu_percent'] for m in relevant_metrics]
        memory_usage = [m['system']['memory_percent'] for m in relevant_metrics]

        report += f"System Performance:\n"
        report += f"  Average CPU Usage: {sum(cpu_usage)/len(cpu_usage):.1f}%\n"
        report += f"  Peak CPU Usage: {max(cpu_usage):.1f}%\n"
        report += f"  Average Memory Usage: {sum(memory_usage)/len(memory_usage):.1f}%\n"
        report += f"  Peak Memory Usage: {max(memory_usage):.1f}%\n\n"

        # Model performance summary
        model_ids = set()
        for metrics in relevant_metrics:
            model_ids.update(metrics['models'].keys())

        for model_id in model_ids:
            model_metrics = [
                m['models'][model_id] for m in relevant_metrics
                if model_id in m['models']
            ]

            if model_metrics:
                report += f"Model {model_id}:\n"

                memory_usage = [m['memory_usage_mb'] for m in model_metrics]
                report += f"  Memory Usage: {sum(memory_usage)/len(memory_usage):.0f}MB (avg)\n"

                success_rates = [m['success_rate'] for m in model_metrics]
                report += f"  Success Rate: {sum(success_rates)/len(success_rates)*100:.1f}% (avg)\n"

                total_requests = [m['total_requests'] for m in model_metrics]
                requests_growth = total_requests[-1] - total_requests[0] if len(total_requests) > 1 else 0
                report += f"  Request Growth: {requests_growth}\n\n"

        return report

# Usage example
monitor = ModelPerformanceMonitor(model_manager)
monitor.start_metrics_collection()

# Get performance report
print(monitor.get_performance_report(hours=24))
```

---

**This Model Management API specification provides AI agents with comprehensive control over model lifecycle, production deployment patterns, and performance monitoring capabilities for optimal resource management.**