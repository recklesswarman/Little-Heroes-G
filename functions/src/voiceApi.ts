// HTTPS proxy for the two companion-voice TTS endpoints (ElevenLabs,
// Gemini). The app has three live URLs, but only the App Hosting backend
// (server.js) runs a real Express server -- GitHub Pages and the plain
// Firebase Hosting site (.web.app/.firebaseapp.com) serve static files
// only, so a relative fetch('/api/elevenlabs/tts') from those origins has
// nothing to answer it and voiceService.js silently falls back to the
// browser's generic speechSynthesis voice. firebase.json's hosting.rewrites
// routes "/api/elevenlabs/**" and "/api/gemini/tts" here instead, so the
// companion voice works the same way everywhere. Everything else --
// /api/gemini/chat (already has its own client-side fallback to the
// chatWithPet callable below) and the WebSocket-only /api/gemini/live Rex
// companion (can't be proxied through a Hosting rewrite at all) -- is
// intentionally left alone.
//
// This mirrors server/elevenLabsService.js and the TTS half of
// server/geminiService.js as closely as possible, kept as a standalone copy
// rather than an import: `firebase deploy --only functions` only uploads
// this functions/ directory, so a relative import reaching outside it would
// build fine locally and then fail at runtime once deployed.

import { onRequest } from "firebase-functions/v2/https";
import { createHash } from "crypto";
import express, { Request, Response } from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

// --- Minimal in-memory per-IP rate limiter (same shape as server/geminiService.js) ---
const rateLimitHits = new Map<string, number[]>();

function isRateLimited(key: string, maxHits: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (rateLimitHits.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= maxHits) {
    rateLimitHits.set(key, hits);
    return true;
  }
  hits.push(now);
  rateLimitHits.set(key, hits);
  return false;
}

function getRequestIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "unknown";
}

function cleanSpeechText(text: string): string {
  return text
    .replace(/\*.*?\*/g, " ")
    .replace(/\[.*?\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// Only Rex has an ElevenLabs voice configured today; every other companion
// pet is meant to fall straight through to the Gemini tier. The roster's id
// "1" and any id/key containing "rex" both resolve to Rex here, matching
// getPetById's resolution in src/data/petsData.js (which defaults to Rex,
// PETS_DATABASE[0], for an unrecognized id) closely enough without needing
// to import that much larger, UI-focused pet roster into this bundle.
function normalizePetId(petId: unknown): string {
  if (petId === undefined || petId === null || petId === "") return "rex";
  const idStr = String(petId).toLowerCase().trim();
  if (idStr === "1" || idStr.includes("rex")) return "rex";
  return idStr;
}

// ===========================================================================
// ElevenLabs TTS (primary companion voice tier) -- /api/elevenlabs/tts
// ===========================================================================

interface TtsCachePayload {
  success: true;
  audio: string;
  mimeType: string;
  voice: string;
  sampleRate: number;
  petId: string;
}

const ttsCache = new Map<string, TtsCachePayload>();
const TTS_CACHE_MAX_ENTRIES = 200;

function getTtsCacheKey(cleanText: string, voiceId: string, speed: number): string {
  return createHash("sha256").update(`${cleanText}|${voiceId}|${speed}`).digest("hex");
}

function cacheTtsResponse(key: string, payload: TtsCachePayload): void {
  ttsCache.set(key, payload);
  if (ttsCache.size > TTS_CACHE_MAX_ENTRIES) {
    const oldestKey = ttsCache.keys().next().value;
    if (oldestKey !== undefined) ttsCache.delete(oldestKey);
  }
}

function elevenLabsTtsUrl(voiceId: string): string {
  return `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=pcm_24000`;
}

// ElevenLabs' speed setting is valid from 0.7 (slowest) to 1.2 (fastest),
// default 1.0. Slower reads better for toddlers/young kids; configurable via
// env so it can be tuned without a code change or redeploy. Clamped so a bad
// env value can never send an out-of-range request upstream.
const DEFAULT_SPEECH_SPEED = 0.85;
const DEFAULT_REX_VOICE_ID = "e9sQs6aLWU82SSolkPYZ";
function getSpeechSpeed(): number {
  const raw = Number(process.env.ELEVENLABS_SPEECH_SPEED);
  if (!Number.isFinite(raw)) return DEFAULT_SPEECH_SPEED;
  return Math.min(1.2, Math.max(0.7, raw));
}

app.post("/api/elevenlabs/tts", async (req: Request, res: Response) => {
  try {
    if (isRateLimited(`elevenlabs-tts:${getRequestIp(req)}`, 30, 60_000)) {
      res.status(429).json({ error: "Too many requests, please slow down." });
      return;
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      // Not configured -- this is an expected, silent "not available" state
      // (the client falls back to Gemini TTS), not a server error.
      res.status(503).json({ error: "ElevenLabs is not configured in server environment." });
      return;
    }

    const { text, petId } = (req.body || {}) as { text?: unknown; petId?: unknown };
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Text prompt is required." });
      return;
    }

    const cleanText = cleanSpeechText(text);
    if (!cleanText) {
      res.status(400).json({ error: "No readable speech text found." });
      return;
    }

    const normalizedPetId = normalizePetId(petId);
    const voiceId = normalizedPetId === "rex"
      ? (process.env.ELEVENLABS_REX_VOICE_ID || DEFAULT_REX_VOICE_ID)
      : undefined;
    if (!voiceId) {
      res.status(404).json({ error: `No ElevenLabs voice configured for pet "${normalizedPetId}".` });
      return;
    }

    const speechSpeed = getSpeechSpeed();
    const cacheKey = getTtsCacheKey(cleanText, voiceId, speechSpeed);
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      res.json({ ...cached, cached: true });
      return;
    }

    const upstream = await fetch(elevenLabsTtsUrl(voiceId), {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/pcm"
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
          speed: speechSpeed
        }
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      console.warn("ElevenLabs TTS upstream error:", upstream.status, errText.slice(0, 300));
      res.status(502).json({ error: "ElevenLabs voice generation failed." });
      return;
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");

    const responsePayload: TtsCachePayload = {
      success: true,
      audio: audioBase64,
      mimeType: "audio/pcm;rate=24000",
      voice: voiceId,
      sampleRate: 24000,
      petId: normalizedPetId
    };
    cacheTtsResponse(cacheKey, responsePayload);

    res.json(responsePayload);
  } catch (error) {
    const message = errorMessage(error, "Failed to generate ElevenLabs voice speech");
    console.error("ElevenLabs TTS proxy error:", message);
    res.status(500).json({ error: message });
  }
});

// ===========================================================================
// Gemini TTS (secondary companion voice tier) -- /api/gemini/tts
// ===========================================================================

const PET_VOICE_MAP: Record<string, string> = {
  rex: "Puck",
  bella: "Aoede",
  barnaby: "Fenrir",
  pip: "Zephyr",
  aqua: "Charon",
  aqua_drake: "Charon"
};

const PET_NAMES: Record<string, string> = {
  rex: "Rex the Dino",
  bella: "Bella the Bunny",
  barnaby: "Barnaby the Bear",
  pip: "Pip the Phoenix",
  aqua: "Aqua Drake",
  aqua_drake: "Aqua Drake"
};

app.post("/api/gemini/tts", async (req: Request, res: Response) => {
  try {
    if (isRateLimited(`gemini-tts:${getRequestIp(req)}`, 30, 60_000)) {
      res.status(429).json({ error: "Too many requests, please slow down." });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "Gemini service is not initialized in server environment." });
      return;
    }

    const { text, petId, voice } = (req.body || {}) as { text?: unknown; petId?: unknown; voice?: unknown };
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Text prompt is required." });
      return;
    }

    const cleanText = cleanSpeechText(text);
    if (!cleanText) {
      res.status(400).json({ error: "No readable speech text found." });
      return;
    }

    const normalizedPetId = String(petId || "rex").toLowerCase();
    const selectedVoice = (typeof voice === "string" && voice) || PET_VOICE_MAP[normalizedPetId] || "Puck";
    const personaName = PET_NAMES[normalizedPetId] || PET_NAMES.rex;

    const { GoogleGenAI, Modality } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{
        parts: [{
          text: `Read cheerfully and warmly in a kid-friendly companion tone for ${personaName}: "${cleanText}"`
        }]
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice }
          }
        }
      }
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const audioData = part?.inlineData?.data;
    const mimeType = part?.inlineData?.mimeType || "audio/pcm;rate=24000";

    if (!audioData) {
      res.status(502).json({ error: "No audio generated by Gemini TTS" });
      return;
    }

    res.json({
      success: true,
      audio: audioData,
      mimeType,
      voice: selectedVoice,
      sampleRate: 24000,
      petId: normalizedPetId
    });
  } catch (error) {
    const message = errorMessage(error, "Failed to generate voice speech");
    console.error("Gemini TTS proxy error:", message);
    res.status(500).json({ error: message });
  }
});

export const api = onRequest(
  { secrets: ["ELEVENLABS_API_KEY", "GEMINI_API_KEY"] },
  app
);
