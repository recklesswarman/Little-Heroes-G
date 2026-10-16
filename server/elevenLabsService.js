import { createHash } from 'crypto';
import { isRateLimited, getRequestIp } from './geminiService.js';
import { getPetById } from '../src/data/petsData.js';

// In-memory cache of generated ElevenLabs audio, keyed by the exact cleaned
// text + voice + speed + voiceStyle that produced it. The toothbrush battle's coaching
// lines are a small, repeating set (5 quadrant cues, a handful of hazard
// warnings, the halfway Learn Challenge question, etc.) spoken over and over
// across every kid's every battle, so after the very first time each line is
// generated on a given server instance, every later request for the exact
// same line is served from memory instead of round-tripping to ElevenLabs --
// fast enough for the battle's real-time "instant" voice mode to use this
// tier instead of always skipping straight to browser speech synthesis.
// Capped and FIFO-evicted so a stream of unique text (e.g. free-form Rex
// chat) can't grow this unbounded; Map preserves insertion order.
const ttsCache = new Map();
const TTS_CACHE_MAX_ENTRIES = 200;

function getTtsCacheKey(cleanText, voiceId, speed, voiceStyle = 'companion') {
  return createHash('sha256').update(`${cleanText}|${voiceId}|${speed}|${voiceStyle}`).digest('hex');
}

function cacheTtsResponse(key, payload) {
  ttsCache.set(key, payload);
  if (ttsCache.size > TTS_CACHE_MAX_ENTRIES) {
    const oldestKey = ttsCache.keys().next().value;
    ttsCache.delete(oldestKey);
  }
}

// Maps a companion pet id to its ElevenLabs voice id.
// Universal voice resolution: All 24 pets and bedtime storytelling fall back to the main
// ElevenLabs voice (process.env.ELEVENLABS_REX_VOICE_ID || 'e9sQs6aLWU82SSolkPYZ'), eliminating HTTP 404s.
const DEFAULT_MAIN_VOICE_ID = 'e9sQs6aLWU82SSolkPYZ';
const ELEVENLABS_VOICE_MAP = {
  rex: process.env.ELEVENLABS_REX_VOICE_ID || DEFAULT_MAIN_VOICE_ID
};

const ELEVENLABS_TTS_URL = (voiceId) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=pcm_24000`;

// ElevenLabs' speed setting is valid from 0.7 (slowest) to 1.2 (fastest),
// default 1.0. Slower reads better for toddlers/young kids; configurable via
// env so it can be tuned without a code change or redeploy. Clamped so a bad
// env value can never send an out-of-range request upstream.
const DEFAULT_SPEECH_SPEED = 0.85;
function getSpeechSpeed() {
  const raw = Number(process.env.ELEVENLABS_SPEECH_SPEED);
  if (!Number.isFinite(raw)) return DEFAULT_SPEECH_SPEED;
  return Math.min(1.2, Math.max(0.7, raw));
}

/**
 * Handle HTTP POST /api/elevenlabs/tts
 * Generates companion speech audio via the ElevenLabs API, streamed back as
 * raw 24kHz PCM16 so the client can reuse the exact same playback pipeline
 * as the Gemini TTS response (see base64ToFloat32Array in voiceService.js).
 */
export async function handleElevenLabsTTSRequest(req, res) {
  try {
    if (isRateLimited(`elevenlabs-tts:${getRequestIp(req)}`, 30, 60_000)) {
      return res.status(429).json({ error: 'Too many requests, please slow down.' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      // Not configured -- this is an expected, silent "not available" state
      // (the client falls back to Gemini TTS), not a server error.
      return res.status(503).json({ error: 'ElevenLabs is not configured in server environment.' });
    }

    const { text, petId, voiceStyle = 'companion' } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text prompt is required.' });
    }

    const cleanText = text
      .replace(/\*.*?\*/g, ' ')
      .replace(/\[.*?\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) {
      return res.status(400).json({ error: 'No readable speech text found.' });
    }

    // Resolve pet and voice ID
    // Universal resolution: All 24 pets and bedtime narration default to the main ElevenLabs voice
    const normalizedPetId = (getPetById(petId)?.key || String(petId || 'rex')).toLowerCase();
    const mainVoiceId = process.env.ELEVENLABS_REX_VOICE_ID || DEFAULT_MAIN_VOICE_ID;
    const voiceId = ELEVENLABS_VOICE_MAP[normalizedPetId] || mainVoiceId;

    const speechSpeed = getSpeechSpeed();
    const cacheKey = getTtsCacheKey(cleanText, voiceId, speechSpeed, voiceStyle);
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Bedtime narration tuning vs companion/workout tuning
    const isBedtime = voiceStyle === 'bedtime';
    const voiceSettings = isBedtime ? {
      stability: 0.65,
      similarity_boost: 0.80,
      style: 0.35,
      use_speaker_boost: true,
      speed: speechSpeed
    } : {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.3,
      use_speaker_boost: true,
      speed: speechSpeed
    };

    const upstream = await fetch(ELEVENLABS_TTS_URL(voiceId), {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/pcm'
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: voiceSettings
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.warn('ElevenLabs TTS upstream error:', upstream.status, errText.slice(0, 300));
      return res.status(502).json({ error: 'ElevenLabs voice generation failed.' });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

    const responsePayload = {
      success: true,
      audio: audioBase64,
      mimeType: 'audio/pcm;rate=24000',
      voice: voiceId,
      sampleRate: 24000,
      petId: normalizedPetId,
      voiceStyle
    };
    cacheTtsResponse(cacheKey, responsePayload);

    return res.json(responsePayload);
  } catch (error) {
    console.error('Server ElevenLabs TTS generation error:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate ElevenLabs voice speech'
    });
  }
}
