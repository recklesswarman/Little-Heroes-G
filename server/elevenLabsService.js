import { isRateLimited, getRequestIp } from './geminiService.js';

// Maps a companion pet id to its ElevenLabs voice id. Only pets with an
// entry here get an ElevenLabs voice -- everyone else falls through to the
// Gemini TTS tier in voiceService.js. Voice ids are not secret (they're
// public identifiers within an ElevenLabs account), so they're fine to keep
// here, but they're still read from env so a voice can be swapped without a
// code change or redeploy.
const ELEVENLABS_VOICE_MAP = {
  rex: process.env.ELEVENLABS_REX_VOICE_ID || null
};

const ELEVENLABS_TTS_URL = (voiceId) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=pcm_24000`;

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

    const { text, petId } = req.body || {};
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

    const normalizedPetId = String(petId || 'rex').toLowerCase();
    const voiceId = ELEVENLABS_VOICE_MAP[normalizedPetId];
    if (!voiceId) {
      // No ElevenLabs voice configured for this pet -- client falls back.
      return res.status(404).json({ error: `No ElevenLabs voice configured for pet "${normalizedPetId}".` });
    }

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
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true
        }
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.warn('ElevenLabs TTS upstream error:', upstream.status, errText.slice(0, 300));
      return res.status(502).json({ error: 'ElevenLabs voice generation failed.' });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

    return res.json({
      success: true,
      audio: audioBase64,
      mimeType: 'audio/pcm;rate=24000',
      voice: voiceId,
      sampleRate: 24000,
      petId: normalizedPetId
    });
  } catch (error) {
    console.error('Server ElevenLabs TTS generation error:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate ElevenLabs voice speech'
    });
  }
}
