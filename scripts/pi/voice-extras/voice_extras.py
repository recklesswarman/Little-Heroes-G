#!/usr/bin/env python3
"""Little Heroes voice extras on the family Pi (127.0.0.1:5010 by default).

  POST /kokoro     {"text", "voice"?, "speed"?} -> {"wav": base64 WAV, "words": [[word, start, end], ...], "duration"}
                   Kokoro (kokoro-onnx, Apache 2.0) reads bedtime stories ahead of time. Word times are
                   estimated per sentence (each sentence is synthesised on its own, and its time is shared
                   out by word length), which is close enough to light up words as they are read.
  POST /moonshine  audio body (webm/ogg/mp4/wav) -> {"text"}
                   Moonshine (useful-moonshine-onnx, MIT) is a small, fast speech-to-text model for the
                   Read-Along reading check. ffmpeg turns the recording into 16 kHz mono first.
  GET  /health     {"kokoro": bool, "moonshine": bool}

Only the app server on the Pi calls this (server/storyAudioService.js, server/localAiService.js);
it listens on localhost. Installed by scripts/pi/setup-voice-extras.sh.
"""
import base64
import io
import json
import os
import re
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOME = os.path.expanduser("~")
MODEL_DIR = os.environ.get("VOICE_EXTRAS_MODELS", os.path.join(HOME, "apps", "voice-extras", "models"))
KOKORO_MODEL = os.path.join(MODEL_DIR, "kokoro-v1.0.onnx")
KOKORO_VOICES = os.path.join(MODEL_DIR, "voices-v1.0.bin")
DEFAULT_VOICE = os.environ.get("KOKORO_VOICE", "af_heart")
MOONSHINE_MODEL = os.environ.get("MOONSHINE_MODEL", "moonshine/base")
MAX_TEXT = 6000
MAX_AUDIO = 6 * 1024 * 1024
WORD_RE = re.compile(r"[A-Za-z][A-Za-z'’]*")
SENTENCE_RE = re.compile(r"[^.!?]+[.!?]*[\"'”]?\s*")
VOICE_RE = re.compile(r"^[a-z]{2}_[a-z]{1,20}$")

_lock = threading.Lock()
_kokoro = None
_moonshine = None


def kokoro():
    global _kokoro
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        _kokoro = Kokoro(KOKORO_MODEL, KOKORO_VOICES)
    return _kokoro


def moonshine():
    global _moonshine
    if _moonshine is None:
        import moonshine_onnx
        _moonshine = moonshine_onnx
    return _moonshine


def available():
    out = {"kokoro": os.path.exists(KOKORO_MODEL) and os.path.exists(KOKORO_VOICES), "moonshine": False}
    try:
        import importlib.util
        out["moonshine"] = importlib.util.find_spec("moonshine_onnx") is not None
    except Exception:
        pass
    return out


def split_sentences(text):
    parts = [p.strip() for p in SENTENCE_RE.findall(text) if p.strip()]
    return parts or [text.strip()]


def read_story(text, voice, speed):
    import numpy as np
    import soundfile as sf
    engine = kokoro()
    chunks, words, t, rate = [], [], 0.0, 24000
    for sentence in split_sentences(text):
        samples, rate = engine.create(sentence, voice=voice, speed=speed, lang="en-us")
        seconds = len(samples) / float(rate)
        found = WORD_RE.findall(sentence)
        weights = [len(w) + 2 for w in found]
        total = float(sum(weights)) or 1.0
        lead = min(0.15, seconds * 0.05)  # Kokoro starts each sentence with a short breath
        span = max(0.0, seconds - lead * 2)
        pos = t + lead
        for w, weight in zip(found, weights):
            dur = span * weight / total
            words.append([w, round(pos, 3), round(pos + dur, 3)])
            pos += dur
        chunks.append(samples)
        pause = np.zeros(int(rate * 0.25), dtype=samples.dtype)  # a calm gap between sentences
        chunks.append(pause)
        t += seconds + 0.25
    audio = np.concatenate(chunks) if chunks else np.zeros(1)
    buf = io.BytesIO()
    sf.write(buf, audio, rate, format="WAV", subtype="PCM_16")
    return {"wav": base64.b64encode(buf.getvalue()).decode("ascii"), "words": words, "duration": round(t, 3)}


def transcribe(audio_bytes):
    import numpy as np
    pcm = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"],
        input=audio_bytes, capture_output=True, timeout=30, check=True,
    ).stdout
    samples = np.frombuffer(pcm, dtype=np.float32)
    if samples.size < 1600:
        return ""
    result = moonshine().transcribe(samples[np.newaxis, :], MOONSHINE_MODEL)
    return " ".join(result).strip() if isinstance(result, list) else str(result).strip()


class Handler(BaseHTTPRequestHandler):
    server_version = "LittleHeroesVoiceExtras/1"

    def log_message(self, fmt, *args):  # keep the journal quiet
        pass

    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self, limit):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > limit:
            return None
        return self.rfile.read(length)

    def do_GET(self):
        if self.path == "/health":
            return self.send_json(200, available())
        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        try:
            if self.path == "/kokoro":
                raw = self.read_body(64 * 1024)
                data = json.loads(raw or b"{}")
                text = str(data.get("text") or "").strip()[:MAX_TEXT]
                if not text:
                    return self.send_json(400, {"error": "text is required"})
                voice = str(data.get("voice") or DEFAULT_VOICE)
                voice = voice if VOICE_RE.match(voice) else DEFAULT_VOICE
                speed = min(1.3, max(0.6, float(data.get("speed") or 0.9)))
                with _lock:  # one story at a time: the Pi has 4 cores and 4 GB
                    return self.send_json(200, read_story(text, voice, speed))
            if self.path == "/moonshine":
                raw = self.read_body(MAX_AUDIO)
                if not raw:
                    return self.send_json(400, {"error": "send the recording as the body"})
                with _lock:
                    return self.send_json(200, {"text": transcribe(raw)})
            self.send_json(404, {"error": "not found"})
        except Exception as err:  # never crash the service on one bad request
            self.send_json(500, {"error": str(err)[:200]})


if __name__ == "__main__":
    host = os.environ.get("VOICE_EXTRAS_HOST", "127.0.0.1")
    port = int(os.environ.get("VOICE_EXTRAS_PORT", "5010"))
    ThreadingHTTPServer((host, port), Handler).serve_forever()
