#!/usr/bin/env python3
"""Simple test to understand VAD model output"""

import requests
import tempfile
import numpy as np
import soundfile as sf

def test_vad_via_api():
    """Test VAD through the API to understand the structure"""

    # Create test audio file
    sample_rate = 16000
    duration = 2.0
    samples = int(sample_rate * duration)

    audio = np.zeros(samples, dtype=np.float32)
    start_idx = int(0.5 * sample_rate)
    end_idx = int(1.5 * sample_rate)
    audio[start_idx:end_idx] = np.random.normal(0, 0.3, end_idx - start_idx)

    # Save to temporary file
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        sf.write(f.name, audio, sample_rate)
        temp_file = f.name

    try:
        # Test the API endpoint
        with open(temp_file, 'rb') as f:
            files = {'file': f}
            response = requests.post('http://localhost:8000/vad/upload_and_detect', files=files)

        print(f"Status code: {response.status_code}")
        print(f"Response: {response.text}")

        if response.status_code != 200:
            # Try to get more info by testing a direct model call
            print("\nTrying direct model test...")
            test_direct_model_call()

    except Exception as e:
        print(f"Error: {e}")
    finally:
        import os
        os.unlink(temp_file)

def test_direct_model_call():
    """Try to test the model directly"""
    try:
        from api.core.model import get_vad_model

        model = get_vad_model()
        if model is None:
            print("VAD model is None")
            return

        # Create test audio
        audio = np.random.normal(0, 0.1, 16000).astype(np.float32)

        result = model.generate(input=audio)
        print(f"Direct model result type: {type(result)}")
        print(f"Direct model result: {result}")

        if result and len(result) > 0:
            print(f"First element type: {type(result[0])}")
            print(f"First element: {result[0]}")

            if isinstance(result[0], dict):
                print(f"Dict keys: {result[0].keys()}")
                if 'value' in result[0]:
                    print(f"Value: {result[0]['value']}")
                    print(f"Value type: {type(result[0]['value'])}")

    except Exception as e:
        print(f"Direct model test error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_vad_via_api()