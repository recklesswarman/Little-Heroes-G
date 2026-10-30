"""
main.py
───────
Little Heroes TTS Microservice — FastAPI entry point.

Self-hosted replacement for the app's former ElevenLabs + Gemini Flash TTS
tiers, built on the official `kokoro` PyPI package (Apache-2.0, open-weight
TTS). Centralizes pet->voice casting (see voices.py) in one place instead of
duplicating it across the Node server and Firebase Functions.

Endpoints:
  POST /tts         — synthesize speech for a pet/voiceStyle; returns base64 PCM16
                      @ 24kHz in the same JSON shape the client expects.
  POST /tts/stream  — real-time NDJSON chunked PCM16 streaming (Kokoro-FastAPI
                      pattern) yielding each sentence/clause audio segment as soon
                      as it finishes (~1.0-1.5s first-chunk latency on CPU).
  GET  /voices      — introspection: lists the pet -> voice casting table.
  GET  /health      — Cloud Run health check.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import math
import os
import queue
import re
import threading
import time
from collections import OrderedDict, defaultdict
from contextlib import asynccontextmanager
from typing import Iterator, Optional

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from voices import DEFAULT_VOICE, KNOWN_VOICES, LANG_CODE, PET_VOICE_MAP, resolve_voice

SAMPLE_RATE = 24000

logger = logging.getLogger("tts")
logging.basicConfig(level=logging.INFO)


# ── CPU / thread tuning (Kokoro-FastAPI CPU optimization pattern) ────────────
# PyTorch sizes its thread pool from the *host's* core count, while OpenMP/MKL
# can oversubscribe vCPUs unless pinned. Match intra-op threads to cgroup quota
# and pin inter-op threads to 1 so CPU inference runs without contention.

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
    os.environ.setdefault("OMP_NUM_THREADS", str(threads))
    os.environ.setdefault("MKL_NUM_THREADS", str(threads))
    try:
        import torch
        torch.set_num_threads(threads)
        try:
            torch.set_num_interop_threads(1)
        except Exception:
            pass
    except Exception as exc:  # pragma: no cover - torch always present in prod
        logger.warning("Could not set torch threads: %s", exc)
    logger.info("Torch intra-op threads set to %d (interop=1)", threads)
    return threads


# ── Kokoro pipeline (built once, all pet voices preloaded into RAM) ─────────

_pipeline = None
_pipeline_lock = threading.Lock()
_voices_preloaded = False
# Kokoro's pipeline is not safe to run concurrently and extra parallel
# inference only oversubscribes the CPU, so synthesis is serialized.
_synth_lock = threading.Lock()


def get_pipeline():
    global _pipeline, _voices_preloaded
    if _pipeline is None:
        with _pipeline_lock:
            if _pipeline is None:
                configure_threads()
                from kokoro import KPipeline
                started = time.time()
                _pipeline = KPipeline(lang_code=LANG_CODE)
                for voice_id in sorted(KNOWN_VOICES):
                    try:
                        _pipeline.load_voice(voice_id)
                    except Exception as v_exc:
                        logger.warning("Could not preload voice %s: %s", voice_id, v_exc)
                _voices_preloaded = True
                logger.info(
                    "Kokoro pipeline + %d voicepacks loaded in %.1fs",
                    len(KNOWN_VOICES),
                    time.time() - started,
                )
    return _pipeline


def warm_up() -> None:
    """Loads the model, preloads all 24-pet voice tensors into RAM, and runs one
    short inference synchronously so the very first real request has zero model,
    voicepack, or PyTorch JIT setup delay."""
    started = time.time()
    try:
        synthesize("Hello, little hero.", DEFAULT_VOICE, DEFAULT_COMPANION_SPEED)
        logger.info("Warm-up complete in %.1fs", time.time() - started)
    except Exception as exc:  # never block startup on a failed warm-up
        logger.warning("Warm-up failed: %s", exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Run warm_up synchronously before opening traffic so Cloud Run marks the
    # instance ready ONLY after model weights + all pet voicepacks are hot in RAM
    # (~3-4s from baked /app/.cache/huggingface during --cpu-boost startup).
    if os.environ.get("SKIP_WARMUP") != "1":
        await run_in_threadpool(warm_up)
    yield


app = FastAPI(
    title="Little Heroes TTS Microservice",
    description="Self-hosted text-to-speech for all companion/narration voice, powered by Kokoro.",
    version="1.2.0",
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


# ── In-memory response cache ────────────────────────────────────────────────

_CACHE_MAX_ENTRIES = 600
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


# ── Simple per-IP rate limiting ─────────────────────────────────────────────

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


# ── Text cleanup & Token-Safe Chunking (Kokoro-FastAPI pattern) ─────────────
# Kokoro-82M has a hard 510-token window per inference call. Splitting on
# sentence boundaries and breaking overly long clauses (>300 chars) keeps every
# chunk well inside the safe budget and ensures fast first-chunk synthesis.

def clean_dialogue_text(text: str) -> str:
    cleaned = re.sub(r"\*.*?\*", " ", text or "")
    cleaned = re.sub(r"\[.*?\]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


SENTENCE_SPLIT_PATTERN = r"(?<=[.!?])\s+|(?<=[.!?][\"'\u201d\u2019])\s+|\n+"
CLAUSE_SPLIT_PATTERN = r"(?<=[,;:\u2014])\s+"
PAUSE_SAMPLES = int(SAMPLE_RATE * 0.22)
PAUSE_CHUNK = np.zeros(PAUSE_SAMPLES, dtype=np.float32)


def split_into_safe_chunks(text: str, first_max_chars: int = 180, max_chars: int = 320) -> list[str]:
    """Splits clean dialogue text into natural sentence/clause segments so:
    1) Chunk 0 is concise (<= first_max_chars) for ~1.0-1.4s time-to-first-audio.
    2) Every chunk stays safely below Kokoro's 510-token ceiling."""
    raw_sentences = [s.strip() for s in re.split(SENTENCE_SPLIT_PATTERN, text) if s and s.strip()]
    if not raw_sentences:
        return [text] if text else []

    safe_chunks: list[str] = []
    for sent in raw_sentences:
        limit = first_max_chars if not safe_chunks else max_chars
        if len(sent) <= limit:
            safe_chunks.append(sent)
            continue
        clauses = [c.strip() for c in re.split(CLAUSE_SPLIT_PATTERN, sent) if c and c.strip()]
        buf = ""
        for clause in clauses:
            cur_limit = first_max_chars if not safe_chunks else max_chars
            candidate = f"{buf} {clause}".strip() if buf else clause
            if len(candidate) <= cur_limit:
                buf = candidate
            else:
                if buf:
                    safe_chunks.append(buf)
                if len(clause) <= max_chars:
                    buf = clause
                else:
                    # Hard word-wrap fallback for unpunctuated run-on strings
                    words = clause.split()
                    wbuf = ""
                    for w in words:
                        wcand = f"{wbuf} {w}".strip() if wbuf else w
                        if len(wcand) <= max_chars:
                            wbuf = wcand
                        else:
                            if wbuf:
                                safe_chunks.append(wbuf)
                            wbuf = w
                    buf = wbuf
        if buf:
            safe_chunks.append(buf)
    return safe_chunks


# ── Speed resolution ────────────────────────────────────────────────────────

DEFAULT_COMPANION_SPEED = 0.95
DEFAULT_BEDTIME_SPEED = 0.85


def resolve_speed(voice_style: str, requested_speed: Optional[float]) -> float:
    if isinstance(requested_speed, (int, float)) and requested_speed > 0:
        return max(0.5, min(1.5, float(requested_speed)))
    return DEFAULT_BEDTIME_SPEED if voice_style == "bedtime" else DEFAULT_COMPANION_SPEED


# ── Synthesis ───────────────────────────────────────────────────────────────

def _float32_to_b64_pcm16(audio_arr: np.ndarray) -> str:
    clamped = np.clip(audio_arr, -1.0, 1.0)
    pcm16 = (clamped * 32767.0).astype(np.int16)
    return base64.b64encode(pcm16.tobytes()).decode("ascii")


def iter_synthesized_chunks(text: str, voice: str, speed: float) -> Iterator[np.ndarray]:
    """Yields float32 @ 24kHz audio arrays segment-by-segment, releasing and
    re-acquiring _synth_lock per segment so concurrent short phrase requests
    are never starved behind a multi-sentence storybook chapter."""
    pipeline = get_pipeline()
    segments = split_into_safe_chunks(text)
    for seg in segments:
        seg_parts: list[np.ndarray] = []
        with _synth_lock:
            for _, _, audio in pipeline(seg, voice=voice, speed=speed, split_pattern=SENTENCE_SPLIT_PATTERN):
                if hasattr(audio, "detach"):
                    audio = audio.detach().cpu().numpy()
                arr = np.asarray(audio, dtype=np.float32)
                if arr.size > 0:
                    seg_parts.append(arr)
        if seg_parts:
            yield np.concatenate(seg_parts) if len(seg_parts) > 1 else seg_parts[0]


def synthesize(text: str, voice: str, speed: float) -> str:
    """Runs Kokoro across token-safe chunks, concatenates with natural sentence
    pauses, and returns base64-encoded PCM16 mono audio at SAMPLE_RATE."""
    chunks = list(iter_synthesized_chunks(text, voice, speed))
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

    return _float32_to_b64_pcm16(full_audio)


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
    return {
        "status": "ok",
        "service": "little-heroes-tts-kokoro",
        "version": "1.2.0",
        "modelLoaded": _pipeline is not None,
        "voicesPreloaded": _voices_preloaded,
    }


@app.get("/voices")
async def voices():
    return {"defaultVoice": DEFAULT_VOICE, "langCode": LANG_CODE, "petVoiceMap": PET_VOICE_MAP}


@app.post("/tts", response_model=TtsResponse)
@app.post("/api/tts", response_model=TtsResponse)
async def tts(req: TtsRequest, request: Request, response: Response):
    clean_text = clean_dialogue_text(req.text)
    if not clean_text:
        raise HTTPException(status_code=400, detail="No readable speech text found.")

    pet_key, voice = resolve_voice(req.petId)
    speed = resolve_speed(req.voiceStyle, req.speed)

    # Serve cache hits immediately before rate-limiting so client pre-warm checks are free.
    cache_key = _cache_key(clean_text, voice, speed)
    cached = _cache_get(cache_key)
    if cached:
        return TtsResponse(**cached, cached=True)

    if is_rate_limited(f"tts:{get_request_ip(request)}", 300, 60_000):
        raise HTTPException(status_code=429, detail="Too many requests, please slow down.")

    started = time.time()
    try:
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


@app.post("/tts/stream")
@app.post("/api/tts/stream")
async def tts_stream(req: TtsRequest, request: Request):
    """Real-time NDJSON chunked PCM16 streaming endpoint (Kokoro-FastAPI pattern).
    Yields each synthesized sentence/clause as soon as Kokoro finishes generating it
    (~1.0-1.5s time-to-first-chunk on CPU), then caches the assembled full audio
    so subsequent replays return instantly in 0ms."""
    clean_text = clean_dialogue_text(req.text)
    if not clean_text:
        raise HTTPException(status_code=400, detail="No readable speech text found.")

    pet_key, voice = resolve_voice(req.petId)
    speed = resolve_speed(req.voiceStyle, req.speed)
    cache_key = _cache_key(clean_text, voice, speed)

    cached = _cache_get(cache_key)
    if cached:
        def _cached_gen():
            yield json.dumps({
                "chunkIndex": 0,
                "isFinal": True,
                "cached": True,
                **cached,
            }) + "\n"
        return StreamingResponse(_cached_gen(), media_type="application/x-ndjson")

    if is_rate_limited(f"tts:{get_request_ip(request)}", 300, 60_000):
        raise HTTPException(status_code=429, detail="Too many requests, please slow down.")

    def _stream_generator():
        q: "queue.Queue[Optional[tuple[int, np.ndarray]]]" = queue.Queue()
        collected: list[np.ndarray] = []

        def _producer():
            try:
                for idx, arr in enumerate(iter_synthesized_chunks(clean_text, voice, speed)):
                    collected.append(arr)
                    q.put((idx, arr))
            except Exception as exc:
                logger.exception("Streaming synthesis error: %s", exc)
            finally:
                q.put(None)

        threading.Thread(target=_producer, name="tts-stream-producer", daemon=True).start()

        while True:
            item = q.get()
            if item is None:
                break
            idx, arr = item
            # Append subtle sentence pause to streamed chunks so sequential playback sounds natural
            padded = np.concatenate([arr, PAUSE_CHUNK])
            b64 = _float32_to_b64_pcm16(padded)
            yield json.dumps({
                "success": True,
                "chunkIndex": idx,
                "isFinal": False,
                "audio": b64,
                "sampleRate": SAMPLE_RATE,
                "voice": voice,
                "petId": pet_key,
            }) + "\n"

        if collected:
            interleaved: list[np.ndarray] = []
            for i, c in enumerate(collected):
                interleaved.append(c)
                if i < len(collected) - 1:
                    interleaved.append(PAUSE_CHUNK)
            full_b64 = _float32_to_b64_pcm16(np.concatenate(interleaved) if len(interleaved) > 1 else interleaved[0])
            _cache_set(cache_key, {
                "success": True,
                "audio": full_b64,
                "mimeType": f"audio/pcm;rate={SAMPLE_RATE}",
                "sampleRate": SAMPLE_RATE,
                "voice": voice,
                "petId": pet_key,
            })
        yield json.dumps({"success": True, "isFinal": True}) + "\n"

    return StreamingResponse(_stream_generator(), media_type="application/x-ndjson")


# ── Dev server ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    is_dev = os.environ.get("ENVIRONMENT", "production") == "development"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=is_dev)
