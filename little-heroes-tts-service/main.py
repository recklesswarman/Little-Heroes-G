"""
main.py
───────
Little Heroes TTS Microservice — FastAPI entry point.

Self-hosted replacement for the app's former ElevenLabs + Gemini Flash TTS
tiers, built on the official `kokoro` PyPI package (Apache-2.0, open-weight
TTS). Centralizes pet->voice casting (see voices.py) in one place instead of
duplicating it across the Node server and Firebase Functions.

Endpoints:
  POST /tts     — synthesize speech for a pet/voiceStyle; returns base64 PCM16
                  @ 24kHz in the same JSON shape the client already expects
                  from the old ElevenLabs/Gemini TTS routes.
  GET  /voices  — introspection: lists the pet -> voice casting table.
  GET  /health  — Cloud Run health check.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import math
import os
import re
import threading
import time
from collections import OrderedDict, defaultdict
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from voices import DEFAULT_VOICE, LANG_CODE, PET_VOICE_MAP, resolve_voice

SAMPLE_RATE = 24000

logger = logging.getLogger("tts")
logging.basicConfig(level=logging.INFO)


# ── CPU / thread tuning ──────────────────────────────────────────────────────
# PyTorch sizes its thread pool from the *host's* core count, but Cloud Run
# only grants the container a CPU quota (e.g. 2 vCPU). Running 8+ threads on a
# 2-vCPU quota thrashes and makes synthesis slower than real time, so size the
# pool from the cgroup quota instead.

def detect_cpu_quota() -> int:
    override = os.environ.get("TORCH_NUM_THREADS", "").strip()
    if override.isdigit() and int(override) > 0:
        return int(override)
    try:  # cgroup v2
        with open("/sys/fs/cgroup/cpu.max") as f:
            quota, period = f.read().split()
        if quota != "max":
            return max(1, math.ceil(int(quota) / int(period)))
    except Exception:
        pass
    try:  # cgroup v1
        with open("/sys/fs/cgroup/cpu/cpu.cfs_quota_us") as f:
            quota = int(f.read())
        with open("/sys/fs/cgroup/cpu/cpu.cfs_period_us") as f:
            period = int(f.read())
        if quota > 0:
            return max(1, math.ceil(quota / period))
    except Exception:
        pass
    try:
        return max(1, len(os.sched_getaffinity(0)))
    except Exception:
        return os.cpu_count() or 1


def configure_threads() -> int:
    threads = detect_cpu_quota()
    try:
        import torch
        torch.set_num_threads(threads)
    except Exception as exc:  # pragma: no cover - torch always present in prod
        logger.warning("Could not set torch threads: %s", exc)
    logger.info("Torch intra-op threads set to %d", threads)
    return threads


# ── Kokoro pipeline (built once, then reused for every request) ─────────────

_pipeline = None
_pipeline_lock = threading.Lock()
# Kokoro's pipeline is not safe to run concurrently and extra parallel
# inference only oversubscribes the CPU, so synthesis is serialized.
_synth_lock = threading.Lock()


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        with _pipeline_lock:
            if _pipeline is None:
                configure_threads()
                from kokoro import KPipeline
                started = time.time()
                _pipeline = KPipeline(lang_code=LANG_CODE)
                logger.info("Kokoro pipeline loaded in %.1fs", time.time() - started)
    return _pipeline


def warm_up() -> None:
    """Loads the model and runs one short synthesis so the first real request
    doesn't pay for model load, voicepack load, and first-inference setup."""
    started = time.time()
    try:
        synthesize("Hello, little hero.", DEFAULT_VOICE, DEFAULT_COMPANION_SPEED)
        logger.info("Warm-up complete in %.1fs", time.time() - started)
    except Exception as exc:  # never block startup on a failed warm-up
        logger.warning("Warm-up failed: %s", exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Warm up in a background thread so uvicorn opens its port immediately
    # (Cloud Run fails the deploy if the container doesn't listen on $PORT in
    # time). A request that arrives mid-warm-up simply waits on the pipeline
    # lock; /health reports modelLoaded=false until warm-up finishes.
    if os.environ.get("SKIP_WARMUP") != "1":
        threading.Thread(target=warm_up, name="tts-warmup", daemon=True).start()
    yield


app = FastAPI(
    title="Little Heroes TTS Microservice",
    description="Self-hosted text-to-speech for all companion/narration voice, powered by Kokoro.",
    version="1.1.0",
    lifespan=lifespan,
)

_DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://little-heroes-quest-8842.web.app",
    "https://little-heroes-quest-8842.firebaseapp.com",
    "https://recklesswarman.github.io",
    "https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app",
]
_EXTRA_CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_DEFAULT_CORS_ORIGINS + _EXTRA_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Synth-Ms", "X-Audio-Seconds"],
)


# ── In-memory response cache (mirrors the Node ttsCache pattern, now in one
#    place instead of duplicated across two backends) ───────────────────────

_CACHE_MAX_ENTRIES = 200
_tts_cache: "OrderedDict[str, dict]" = OrderedDict()


def _cache_key(clean_text: str, voice: str, speed: float) -> str:
    return hashlib.sha256(f"{clean_text}|{voice}|{speed}".encode("utf-8")).hexdigest()


def _cache_get(key: str) -> Optional[dict]:
    return _tts_cache.get(key)


def _cache_set(key: str, payload: dict) -> None:
    _tts_cache[key] = payload
    _tts_cache.move_to_end(key)
    if len(_tts_cache) > _CACHE_MAX_ENTRIES:
        _tts_cache.popitem(last=False)


# ── Simple per-IP rate limiting (mirrors server/geminiService.js's
#    isRateLimited token-bucket pattern) ────────────────────────────────────

_rate_limit_hits: dict[str, list[float]] = defaultdict(list)


def is_rate_limited(key: str, max_requests: int, window_ms: int) -> bool:
    now = time.time() * 1000
    window_start = now - window_ms
    hits = [t for t in _rate_limit_hits[key] if t > window_start]
    hits.append(now)
    _rate_limit_hits[key] = hits
    return len(hits) > max_requests


def get_request_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Text cleanup (mirrors the existing cleanDialogueText/cleanSpeechText
#    pattern already used server-side: strip stage directions/brackets) ────

def clean_dialogue_text(text: str) -> str:
    cleaned = re.sub(r"\*.*?\*", " ", text or "")
    cleaned = re.sub(r"\[.*?\]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


# ── Speed resolution: bedtime narration reads slower than companion chat,
#    matching the app's existing bedtime-vs-companion tuning convention ────

DEFAULT_COMPANION_SPEED = 0.95
DEFAULT_BEDTIME_SPEED = 0.85


def resolve_speed(voice_style: str, requested_speed: Optional[float]) -> float:
    if isinstance(requested_speed, (int, float)) and requested_speed > 0:
        return max(0.5, min(1.5, float(requested_speed)))
    return DEFAULT_BEDTIME_SPEED if voice_style == "bedtime" else DEFAULT_COMPANION_SPEED


# ── Synthesis ────────────────────────────────────────────────────────────────

SENTENCE_SPLIT_PATTERN = r"(?<=[.!?])\s+|(?<=[.!?][\"'])\s+|\n+"
PAUSE_SAMPLES = int(SAMPLE_RATE * 0.25)
PAUSE_CHUNK = np.zeros(PAUSE_SAMPLES, dtype=np.float32)


def synthesize(text: str, voice: str, speed: float) -> bytes:
    """Runs Kokoro, concatenates all chunks, and returns base64-encoded PCM16
    mono audio at SAMPLE_RATE, matching the wire format the client's
    playPcmTtsResponse() already decodes."""
    pipeline = get_pipeline()
    chunks: list[np.ndarray] = []
    with _synth_lock:
        for _, _, audio in pipeline(text, voice=voice, speed=speed, split_pattern=SENTENCE_SPLIT_PATTERN):
            if hasattr(audio, "detach"):
                audio = audio.detach().cpu().numpy()
            arr = np.asarray(audio, dtype=np.float32)
            if arr.size > 0:
                chunks.append(arr)

    if not chunks:
        raise RuntimeError("Kokoro produced no audio for this text.")

    if len(chunks) > 1:
        interleaved: list[np.ndarray] = []
        for i, c in enumerate(chunks):
            interleaved.append(c)
            if i < len(chunks) - 1:
                interleaved.append(PAUSE_CHUNK)
        full_audio = np.concatenate(interleaved)
    else:
        full_audio = chunks[0]

    clamped = np.clip(full_audio, -1.0, 1.0)
    pcm16 = (clamped * 32767.0).astype(np.int16)
    return base64.b64encode(pcm16.tobytes()).decode("ascii")


# ── Request / response models ───────────────────────────────────────────────

class TtsRequest(BaseModel):
    text: str = Field(..., description="The text to speak.")
    petId: Optional[str] = Field("rex", description="Companion pet id or key, resolves to a Kokoro voice.")
    voiceStyle: str = Field("default", description="'default' (companion/workout) or 'bedtime' (slower, softer).")
    speed: Optional[float] = Field(None, description="Optional explicit speed override (0.5-1.5).")


class TtsResponse(BaseModel):
    success: bool
    audio: str
    mimeType: str
    sampleRate: int
    voice: str
    petId: str
    cached: bool = False


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
@app.get("/api/tts/health")
async def health():
    # /api/tts/health is reachable through the Firebase Hosting rewrite
    # (/api/tts/**), so the client can ping it on app load to wake a
    # scaled-to-zero instance before the first spoken line.
    return {
        "status": "ok",
        "service": "little-heroes-tts-kokoro",
        "version": "1.1.0",
        "modelLoaded": _pipeline is not None,
    }


@app.get("/voices")
async def voices():
    return {"defaultVoice": DEFAULT_VOICE, "langCode": LANG_CODE, "petVoiceMap": PET_VOICE_MAP}


# /api/tts alias: the client calls {base}/api/tts, and the Firebase Hosting
# rewrite (firebase.json) forwards the original /api/tts path unchanged.
@app.post("/tts", response_model=TtsResponse)
@app.post("/api/tts", response_model=TtsResponse)
async def tts(req: TtsRequest, request: Request, response: Response):
    if is_rate_limited(f"tts:{get_request_ip(request)}", 60, 60_000):
        raise HTTPException(status_code=429, detail="Too many requests, please slow down.")

    clean_text = clean_dialogue_text(req.text)
    if not clean_text:
        raise HTTPException(status_code=400, detail="No readable speech text found.")

    pet_key, voice = resolve_voice(req.petId)
    speed = resolve_speed(req.voiceStyle, req.speed)

    cache_key = _cache_key(clean_text, voice, speed)
    cached = _cache_get(cache_key)
    if cached:
        return TtsResponse(**cached, cached=True)

    started = time.time()
    try:
        # Off the event loop so /health and queued requests stay responsive.
        audio_b64 = await run_in_threadpool(synthesize, clean_text, voice, speed)
    except Exception as exc:  # pragma: no cover - defensive, surfaced to client as 502
        logger.exception("Synthesis failed")
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {exc}") from exc

    synth_ms = (time.time() - started) * 1000
    audio_seconds = (len(audio_b64) * 3 / 4) / 2 / SAMPLE_RATE
    logger.info(
        "tts voice=%s chars=%d audio=%.1fs synth=%.0fms rtf=%.2f",
        voice, len(clean_text), audio_seconds, synth_ms,
        (synth_ms / 1000) / audio_seconds if audio_seconds else 0.0,
    )
    response.headers["X-Synth-Ms"] = f"{synth_ms:.0f}"
    response.headers["X-Audio-Seconds"] = f"{audio_seconds:.2f}"

    payload = {
        "success": True,
        "audio": audio_b64,
        "mimeType": f"audio/pcm;rate={SAMPLE_RATE}",
        "sampleRate": SAMPLE_RATE,
        "voice": voice,
        "petId": pet_key,
    }
    _cache_set(cache_key, payload)
    return TtsResponse(**payload, cached=False)


# ── Dev server ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    is_dev = os.environ.get("ENVIRONMENT", "production") == "development"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=is_dev)
