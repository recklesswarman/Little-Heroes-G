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
import os
import re
import time
from collections import OrderedDict, defaultdict
from typing import Optional

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from voices import DEFAULT_VOICE, LANG_CODE, PET_VOICE_MAP, resolve_voice

SAMPLE_RATE = 24000

app = FastAPI(
    title="Little Heroes TTS Microservice",
    description="Self-hosted text-to-speech for all companion/narration voice, powered by Kokoro.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://little-heroes-quest-8842.web.app",
        "https://little-heroes-quest-8842.firebaseapp.com",
        "https://recklesswarman.github.io",
        "https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Kokoro pipeline (loaded once at process start, not per-request) ─────────

_pipeline = None


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        from kokoro import KPipeline
        _pipeline = KPipeline(lang_code=LANG_CODE)
    return _pipeline


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

def synthesize(text: str, voice: str, speed: float) -> bytes:
    """Runs Kokoro, concatenates all chunks, and returns base64-encoded PCM16
    mono audio at SAMPLE_RATE, matching the wire format the client's
    playPcmTtsResponse() already decodes."""
    pipeline = get_pipeline()
    chunks: list[np.ndarray] = []
    for _, _, audio in pipeline(text, voice=voice, speed=speed, split_pattern=r"\n+"):
        chunks.append(np.asarray(audio, dtype=np.float32))

    if not chunks:
        raise RuntimeError("Kokoro produced no audio for this text.")

    full_audio = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
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
async def health():
    return {"status": "ok", "service": "little-heroes-tts-kokoro", "version": "1.0.0"}


@app.get("/voices")
async def voices():
    return {"defaultVoice": DEFAULT_VOICE, "langCode": LANG_CODE, "petVoiceMap": PET_VOICE_MAP}


# /api/tts alias: the client calls {base}/api/tts, and the Firebase Hosting
# rewrite (firebase.json) forwards the original /api/tts path unchanged.
@app.post("/tts", response_model=TtsResponse)
@app.post("/api/tts", response_model=TtsResponse)
async def tts(req: TtsRequest, request: Request):
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

    try:
        audio_b64 = synthesize(clean_text, voice, speed)
    except Exception as exc:  # pragma: no cover - defensive, surfaced to client as 502
        raise HTTPException(status_code=502, detail=f"Voice generation failed: {exc}") from exc

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
