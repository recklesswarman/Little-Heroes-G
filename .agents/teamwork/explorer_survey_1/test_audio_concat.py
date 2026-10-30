import numpy as np
import base64

SAMPLE_RATE = 24000
SILENCE_DURATION_SEC = 0.25
SILENCE_SAMPLES = int(SAMPLE_RATE * SILENCE_DURATION_SEC)

# Simulate 5 sentence chunks of various lengths (e.g., 2.5s to 4.5s each)
chunks = [
    np.sin(2 * np.pi * 220 * np.linspace(0, 3.0, int(SAMPLE_RATE * 3.0), dtype=np.float32)),
    np.sin(2 * np.pi * 330 * np.linspace(0, 4.0, int(SAMPLE_RATE * 4.0), dtype=np.float32)),
    np.sin(2 * np.pi * 440 * np.linspace(0, 2.5, int(SAMPLE_RATE * 2.5), dtype=np.float32)),
]

silence = np.zeros(SILENCE_SAMPLES, dtype=np.float32)
padded_chunks = []
for i, chunk in enumerate(chunks):
    if i > 0:
        padded_chunks.append(silence)
    padded_chunks.append(chunk)

full_audio = np.concatenate(padded_chunks) if len(padded_chunks) > 1 else chunks[0]
clamped = np.clip(full_audio, -1.0, 1.0)
pcm16 = (clamped * 32767.0).astype(np.int16)
audio_b64 = base64.b64encode(pcm16.tobytes()).decode("ascii")

total_seconds = len(full_audio) / SAMPLE_RATE
calc_seconds = (len(audio_b64) * 3 / 4) / 2 / SAMPLE_RATE

print(f"Num chunks: {len(chunks)}")
print(f"Total audio length: {len(full_audio)} samples = {total_seconds:.2f}s")
print(f"Calculated seconds from base64 length: {calc_seconds:.2f}s")
print(f"Base64 string length: {len(audio_b64)} chars")
assert abs(total_seconds - (3.0 + 4.0 + 2.5 + 2 * 0.25)) < 1e-4, "Silence padding matches exactly"
print("Assertion passed! Audio concatenation and 250ms silence padding verified.")
