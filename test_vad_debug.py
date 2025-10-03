#!/usr/bin/env python3
"""Debug script to test VAD model output format"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.core.model import get_vad_model, load_model, is_vad_model_loaded
from api.core.models import ModelType

def test_vad_output():
    """Test VAD model to see actual output format"""

    # Load VAD model if not loaded
    if not is_vad_model_loaded():
        print("Loading VAD model...")
        load_model(ModelType.VAD)

    if not is_vad_model_loaded():
        print("Failed to load VAD model")
        return

    model = get_vad_model()
    if model is None:
        print("VAD model is None")
        return

    print("VAD model loaded successfully")

    # Create test audio data (2 seconds: 0.5s silence, 1s noise, 0.5s silence)
    import numpy as np
    sample_rate = 16000
    duration = 2.0
    samples = int(sample_rate * duration)

    audio = np.zeros(samples, dtype=np.float32)
    start_idx = int(0.5 * sample_rate)
    end_idx = int(1.5 * sample_rate)
    audio[start_idx:end_idx] = np.random.normal(0, 0.3, end_idx - start_idx)

    print(f"Test audio shape: {audio.shape}")
    print(f"Test audio dtype: {audio.dtype}")

    # Test VAD model
    try:
        result = model.generate(input=audio)
        print(f"\nVAD result type: {type(result)}")
        print(f"VAD result: {result}")

        if result and len(result) > 0:
            print(f"\nFirst result type: {type(result[0])}")
            print(f"First result: {result[0]}")

            if isinstance(result[0], dict):
                print(f"Dict keys: {result[0].keys()}")
                if "value" in result[0]:
                    print(f"Value type: {type(result[0]['value'])}")
                    print(f"Value content: {result[0]['value']}")
            elif isinstance(result[0], list):
                print(f"List content: {result[0]}")

    except Exception as e:
        print(f"Error testing VAD model: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_vad_output()