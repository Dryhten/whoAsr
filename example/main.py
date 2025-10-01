from funasr import AutoModel
import pyaudio
import numpy as np
import threading
import time
import sys

# Streaming recognition parameters
chunk_size = [0, 10, 5]  # [0, 10, 5] 600ms, [0, 8, 4] 480ms
encoder_chunk_look_back = 4  # number of chunks to lookback for encoder self-attention
decoder_chunk_look_back = (
    1  # number of encoder chunks to lookback for decoder cross-attention
)

model = AutoModel(model="paraformer-zh-streaming")

# Audio parameters
SAMPLE_RATE = 16000  # FunASR typically uses 16kHz
CHANNELS = 1
DTYPE = np.float32
chunk_stride = chunk_size[1] * 960  # 600ms, same as original
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
    """Process audio chunks in real-time"""
    global audio_buffer, cache, recording

    print("Starting real-time speech recognition...")
    print("Speak into your microphone. Press Ctrl+C to stop.")

    try:
        while recording:
            if len(audio_buffer) >= chunk_stride:
                # Extract chunk
                speech_chunk = audio_buffer[:chunk_stride].copy()
                audio_buffer = audio_buffer[chunk_stride:]

                # Process with FunASR
                res = model.generate(
                    input=speech_chunk,
                    cache=cache,
                    is_final=False,  # Always False for streaming
                    chunk_size=chunk_size,
                    encoder_chunk_look_back=encoder_chunk_look_back,
                    decoder_chunk_look_back=decoder_chunk_look_back,
                )

                if res and len(res) > 0 and "text" in res[0]:
                    text = res[0]["text"]
                    if text.strip():  # Only process non-empty text
                        try:
                            res_with_punc = model.generate(input=text)
                            if res_with_punc and len(res_with_punc) > 0:
                                punctuated_text = res_with_punc[0]["text"]
                                print(f"Recognized: {punctuated_text}")
                            else:
                                print(f"Recognized: {text}")
                        except Exception as e:
                            print(f"Punctuation error: {e}")
                            print(f"Recognized: {text}")

            time.sleep(0.01)  # Small delay to prevent excessive CPU usage

    except KeyboardInterrupt:
        print("\nStopping recording...")
        recording = False

        # Process remaining audio
        if len(audio_buffer) > 0:
            res = model.generate(
                input=audio_buffer,
                cache=cache,
                is_final=True,  # Final chunk
                chunk_size=chunk_size,
                encoder_chunk_look_back=encoder_chunk_look_back,
                decoder_chunk_look_back=decoder_chunk_look_back,
            )
            if res and len(res) > 0 and "text" in res[0]:
                final_text = res[0]["text"]
                print(f"Recognized: {final_text}")


def main():
    """Main function to start microphone streaming"""
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
        print("Speech recognition stopped.")


if __name__ == "__main__":
    main()
