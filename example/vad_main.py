from funasr import AutoModel
import pyaudio
import numpy as np
import threading
import time
import sys
import os
from contextlib import redirect_stdout, redirect_stderr

# VAD parameters
chunk_size = 200  # ms
model = AutoModel(
    model="fsmn-vad", disable_log=True, disable_update=True, verbose=False
)

# Audio parameters
SAMPLE_RATE = 16000  # FunASR typically uses 16kHz
CHANNELS = 1
DTYPE = np.float32
chunk_stride = int(chunk_size * SAMPLE_RATE / 1000)
chunk_duration = chunk_stride / SAMPLE_RATE  # Duration in seconds

# Global variables for audio streaming
audio_buffer = np.array([], dtype=DTYPE)
recording = True
cache = {}


def audio_callback(in_data, frame_count, time_info, status):
    """Callback function for audio streaming"""
    global audio_buffer
    if status:
        print(f"Audio callback status: {status}")

    # Convert bytes to numpy array
    audio_data = np.frombuffer(in_data, dtype=np.float32)
    audio_buffer = np.append(audio_buffer, audio_data)
    return (in_data, pyaudio.paContinue)


def process_audio():
    """Process audio chunks in real-time with VAD"""
    global audio_buffer, cache, recording

    print("Starting real-time VAD detection...")
    print("Speak into your microphone. Press Ctrl+C to stop.")
    print("VAD will detect speech segments and print results.")

    try:
        while recording:
            if len(audio_buffer) >= chunk_stride:
                # Extract chunk
                speech_chunk = audio_buffer[:chunk_stride].copy()
                audio_buffer = audio_buffer[chunk_stride:]

                # Process with VAD (suppress progress bar output)
                with open(os.devnull, "w") as devnull:
                    with redirect_stdout(devnull), redirect_stderr(devnull):
                        res = model.generate(
                            input=speech_chunk,
                            cache=cache,
                            is_final=False,  # Always False for streaming
                            chunk_size=chunk_size,
                        )
                if len(res[0]["value"]):
                    print(res)

                if res and len(res) > 0 and "value" in res[0]:
                    vad_result = res[0]["value"]
                    if len(vad_result) > 0:
                        print(f"VAD Result: {vad_result} (Speech detected)")
                    else:
                        print(f"VAD Result: {vad_result} (Silence)")

            time.sleep(0.01)  # Small delay to prevent excessive CPU usage

    except KeyboardInterrupt:
        print("\nStopping recording...")
        recording = False

        # Process remaining audio
        if len(audio_buffer) > 0:
            with open(os.devnull, "w") as devnull:
                with redirect_stdout(devnull), redirect_stderr(devnull):
                    res = model.generate(
                        input=audio_buffer,
                        cache=cache,
                        is_final=True,  # Final chunk
                        chunk_size=chunk_size,
                    )
            if res and len(res) > 0 and "value" in res[0]:
                vad_result = res[0]["value"]
                if len(vad_result) > 0:
                    print(f"Final VAD Result: {vad_result} (Speech detected)")
                else:
                    print(f"Final VAD Result: {vad_result} (Silence)")


def main():
    """Main function to start microphone streaming for VAD"""
    global recording

    p = pyaudio.PyAudio()

    try:
        # Start audio stream
        stream = p.open(
            format=pyaudio.paFloat32,
            channels=CHANNELS,
            rate=SAMPLE_RATE,
            input=True,
            frames_per_buffer=1024,
            stream_callback=audio_callback,
        )

        stream.start_stream()

        # Start processing thread
        processing_thread = threading.Thread(target=process_audio)
        processing_thread.start()

        # Wait for processing to complete
        processing_thread.join()

        # Stop and close the stream
        stream.stop_stream()
        stream.close()

    except Exception as e:
        print(f"Error: {e}")
        recording = False
    finally:
        p.terminate()
        print("VAD detection stopped.")


if __name__ == "__main__":
    main()
