#!/usr/bin/env python3
"""Test script for real-time VAD WebSocket functionality with audio data"""

import asyncio
import websockets
import json
import numpy as np
import base64

async def test_vad_realtime():
    """Test VAD real-time WebSocket with simulated audio data"""
    uri = "ws://localhost:8000/vad/ws/test-realtime-client"

    try:
        print(f"Connecting to VAD WebSocket: {uri}")
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected successfully")

            # Test 1: Start VAD detection
            print("\n📢 Starting VAD detection...")
            await websocket.send(json.dumps({"type": "start_vad"}))

            response = await websocket.recv()
            data = json.loads(response)
            print(f"📩 Start response: {data}")

            # Test 2: Send multiple audio chunks (simulate real-time audio)
            print("\n🎤 Sending audio chunks...")
            sample_rate = 16000
            chunk_size = 3200  # 200ms at 16kHz

            results_received = 0

            # Send several chunks of audio data
            for i in range(10):
                # Generate test audio data with some pattern
                duration = 0.2  # 200ms
                samples = int(sample_rate * duration)

                # Create a more realistic signal with some voice-like characteristics
                t = np.linspace(0, duration, samples)
                # Mix of frequencies to simulate voice
                audio_data = (
                    0.1 * np.sin(2 * np.pi * 150 * t) +  # Low frequency
                    0.05 * np.sin(2 * np.pi * 400 * t) +  # Mid frequency
                    0.03 * np.sin(2 * np.pi * 800 * t)    # High frequency
                ).astype(np.float32)

                # Add some noise to make it more realistic
                noise = np.random.normal(0, 0.02, samples).astype(np.float32)
                audio_data += noise

                # Clip to valid range
                audio_data = np.clip(audio_data, -1.0, 1.0)

                # Convert to base64
                audio_bytes = audio_data.tobytes()
                audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')

                # Send audio chunk
                await websocket.send(json.dumps({
                    "type": "audio_chunk",
                    "data": audio_b64
                }))

                print(f"  Sent chunk {i+1}/10")

                # Wait for potential VAD results
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    data = json.loads(response)
                    print(f"  📩 VAD Result: {data}")
                    results_received += 1
                except asyncio.TimeoutError:
                    pass  # Normal, not every chunk produces results

                # Small delay between chunks
                await asyncio.sleep(0.1)

            # Test 3: Stop VAD detection and get final results
            print("\n🛑 Stopping VAD detection...")
            await websocket.send(json.dumps({"type": "stop_vad"}))

            # Wait for final response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(response)
                print(f"📩 Stop response: {data}")
                results_received += 1
            except asyncio.TimeoutError:
                print("⏰ No final response received within 5 seconds")

            print(f"\n📊 Summary:")
            print(f"  - Audio chunks sent: 10")
            print(f"  - VAD results received: {results_received}")
            print(f"  - Test completed: {'✅' if results_received > 0 else '⚠️'}")

            if results_received == 0:
                print("\n⚠️  No VAD results were received. This could indicate:")
                print("   - VAD model requires more audio data")
                print("   - Audio data format is not suitable")
                print("   - VAD model threshold settings need adjustment")
            else:
                print("\n✅ Real-time VAD detection is working!")

    except Exception as e:
        print(f"❌ VAD real-time test failed: {e}")
        return False

    return True

if __name__ == "__main__":
    print("🧪 Starting real-time VAD test...")
    asyncio.run(test_vad_realtime())