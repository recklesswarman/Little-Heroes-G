# Test stub: a fake Kokoro that "reads" 0.1 s per character at 24 kHz.
import numpy as np


class Kokoro:
    def __init__(self, model, voices):
        self.model = model

    def create(self, text, voice="af_heart", speed=1.0, lang="en-us"):
        return np.zeros(int(len(text) * 0.1 * 24000), dtype=np.float32), 24000
