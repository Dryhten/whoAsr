import asyncio
import websockets
import json
import base64
import numpy as np
import pyaudio
import threading
import time


class WebSocketSpeechClient:
    def __init__(self, uri="ws://localhost:8000/ws/test_client"):
        self.uri = uri
        self.websocket = None
        self.is_recording = False
        self.audio_queue = asyncio.Queue()

        # Audio parameters
        self.FORMAT = pyaudio.paFloat32
        self.CHANNELS = 1
        self.RATE = 16000
        self.CHUNK = 1024
        self.RECORD_SECONDS = 10

        self.pyaudio = pyaudio.PyAudio()

    async def connect(self):
        """Connect to WebSocket server"""
        try:
            self.websocket = await websockets.connect(self.uri)
            print("Connected to speech recognition server")

            # Start listening for messages
            asyncio.create_task(self.listen_for_messages())

        except Exception as e:
            print(f"Failed to connect: {e}")
            return False
        return True

    async def listen_for_messages(self):
        """Listen for messages from the server"""
        try:
            async for message in self.websocket:
                data = json.loads(message)
                if data["type"] == "recognition_result":
                    status = "FINAL" if data["is_final"] else "INTERIM"
                    print(f"[{status}] {data['text']}")
                elif data["type"] == "status":
                    print(f"[STATUS] {data['message']}")
                elif data["type"] == "error":
                    print(f"[ERROR] {data['message']}")
        except websockets.exceptions.ConnectionClosed:
            print("Connection to server closed")
        except Exception as e:
            print(f"Error receiving messages: {e}")

    def audio_callback(self, in_data, frame_count, time_info, status):
        """Callback for audio recording"""
        if self.is_recording:
            # Put audio data in queue for processing
            asyncio.run_coroutine_threadsafe(self.audio_queue.put(in_data), self.loop)
        return (in_data, pyaudio.paContinue)

    async def start_recording(self):
        """Start recording and sending audio"""
        print("Starting recording... Press Ctrl+C to stop")

        # Send start message
        await self.websocket.send(json.dumps({"type": "start_recording"}))

        self.is_recording = True

        # Start audio stream
        stream = self.pyaudio.open(
            format=self.FORMAT,
            channels=self.CHANNELS,
            rate=self.RATE,
            input=True,
            frames_per_buffer=self.CHUNK,
            stream_callback=self.audio_callback,
        )

        stream.start_stream()

        try:
            # Process audio chunks
            while self.is_recording:
                try:
                    # Get audio data from queue (timeout to allow checking is_recording)
                    audio_data = await asyncio.wait_for(
                        self.audio_queue.get(), timeout=0.1
                    )

                    # Convert to base64 and send
                    base64_audio = base64.b64encode(audio_data).decode("utf-8")
                    await self.websocket.send(
                        json.dumps({"type": "audio_chunk", "data": base64_audio})
                    )

                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    print(f"Error processing audio: {e}")
                    break

        except KeyboardInterrupt:
            print("\nStopping recording...")
        finally:
            self.is_recording = False
            stream.stop_stream()
            stream.close()

            # Send stop message
            await self.websocket.send(json.dumps({"type": "stop_recording"}))
            print("Recording stopped")

    async def disconnect(self):
        """Disconnect from server"""
        if self.websocket:
            await self.websocket.close()
        self.pyaudio.terminate()
        print("Disconnected from server")

    async def run(self):
        """Main run method"""
        # Store event loop for callback access
        self.loop = asyncio.get_event_loop()

        if await self.connect():
            try:
                await self.start_recording()
            finally:
                await self.disconnect()


async def main():
    """Main function"""
    client = WebSocketSpeechClient()
    await client.run()


if __name__ == "__main__":
    print("WebSocket Speech Recognition Client")
    print("===================================")
    print("This client will connect to the speech recognition server")
    print("and record audio from your microphone for real-time transcription.")
    print()
    print("Make sure the server is running on ws://localhost:8000")
    print()

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nClient stopped by user")
