# Test stub: writes a tiny RIFF header plus the sample count.
def write(buf, audio, rate, format="WAV", subtype="PCM_16"):
    buf.write(b"RIFF" + b"\0" * 4 + b"WAVE" + str(len(audio)).encode())
