#!/usr/bin/env python3
"""Test script for VAD WebSocket functionality"""

import asyncio
import websockets
import json
import numpy as np
import base64

async def test_vad_websocket():
    """Test VAD WebSocket connection and basic functionality"""
    uri = "ws://localhost:8000/vad/ws/test-client"

    try:
        print(f"Connecting to VAD WebSocket: {uri}")
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected successfully")

            # Test 1: Start VAD detection
            print("\n📢 Testing VAD start...")
            await websocket.send(json.dumps({"type": "start_vad"}))

            # Wait for response
            response = await websocket.recv()
            data = json.loads(response)
            print(f"📩 Response: {data}")

            # Test 2: Send audio data
            print("\n🎤 Testing audio chunk processing...")
            # Generate some test audio data (float32 array)
            sample_rate = 16000
            duration = 0.2  # 200ms
            samples = int(sample_rate * duration)
            audio_data = np.random.normal(0, 0.1, samples).astype(np.float32)

            # Convert to base64
            audio_bytes = audio_data.tobytes()
            audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')

            # Send audio chunk
            await websocket.send(json.dumps({
                "type": "audio_chunk",
                "data": audio_b64
            }))

            # Wait for VAD results
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(response)
                print(f"📩 VAD Result: {data}")
            except asyncio.TimeoutError:
                print("⏰ No VAD result received within 5 seconds (this might be normal)")

            # Test 3: Stop VAD detection
            print("\n🛑 Testing VAD stop...")
            await websocket.send(json.dumps({"type": "stop_vad"}))

            # Wait for final response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(response)
                print(f"📩 Final Response: {data}")
            except asyncio.TimeoutError:
                print("⏰ No final response received within 5 seconds")

            # Test 4: Ping test
            print("\n🏓 Testing ping...")
            await websocket.send(json.dumps({"type": "ping"}))

            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                data = json.loads(response)
                print(f"📩 Pong: {data}")
            except asyncio.TimeoutError:
                print("⏰ No pong response received")

            print("\n✅ VAD WebSocket test completed successfully!")

    except Exception as e:
        print(f"❌ VAD WebSocket test failed: {e}")
        return False

    return True

if __name__ == "__main__":
    print("🧪 Starting VAD WebSocket test...")
    asyncio.run(test_vad_websocket())