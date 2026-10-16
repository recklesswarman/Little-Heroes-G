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

function getTtsCacheKey(cleanText: string, voiceId: string, speed: number, voiceStyle: string = "companion"): string {
  return createHash("sha256").update(`${cleanText}|${voiceId}|${speed}|${voiceStyle}`).digest("hex");
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

    const { text, petId, voiceStyle } = (req.body || {}) as { text?: unknown; petId?: unknown; voiceStyle?: string };
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
    // Universal resolution: All 24 pets and bedtime storytelling fall back to the main voice, eliminating 404s
    const voiceId = process.env.ELEVENLABS_REX_VOICE_ID || DEFAULT_REX_VOICE_ID;

    const speechSpeed = getSpeechSpeed();
    const styleKey = typeof voiceStyle === "string" ? voiceStyle : "companion";
    const cacheKey = getTtsCacheKey(cleanText, voiceId, speechSpeed, styleKey);
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      res.json({ ...cached, cached: true });
      return;
    }

    const isBedtime = styleKey === "bedtime";
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
        voice_settings: voiceSettings
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

// ===========================================================================
// Bedtime AI Storybook Routes -- /api/rex/bedtime-story & /api/gemini/bedtime-story
// ===========================================================================

app.post(["/api/rex/bedtime-story", "/api/gemini/bedtime-story"], async (req: Request, res: Response) => {
  try {
    if (isRateLimited(`bedtime:${getRequestIp(req)}`, 20, 60_000)) {
      res.status(429).json({ error: "Too many requests, please slow down." });
      return;
    }

    const {
      heroName = "Little Hero",
      petId = "rex",
      petName = "Rex",
      realmId = "space",
      moralId = "brave_dark",
      magicItem = "",
      gentleObstacle = "",
      customWish = "",
      chapterIndex,
      actNumber,
      userChoices = [],
      recentTitles = [],
      recentArchetypes = []
    } = (req.body || {}) as any;

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `You are an expert children's bedtime author and soothing cartoon companion creating a deeply personalized, 3-chapter bedtime story for a young child (ages 3-7).
Child's Name: "${heroName}"
Companion Pet: "${petName}" (Species/Archetype: ${petId})
Bedtime Realm: "${realmId}"
Moral Theme: "${moralId}"
${magicItem ? `Magic Item chosen by child: "${magicItem}". Include this special item in the story!` : ""}
${gentleObstacle ? `Gentle hurdle: "${gentleObstacle}". Resolve this hurdle through kindness!` : ""}
${customWish ? `Parent Bedtime Wish: "${customWish}". Weave this gently into Chapter 1!` : ""}
${userChoices.length > 0 ? `Child's choices: ${JSON.stringify(userChoices)}` : ""}

ANTI-REPETITION MANDATE:
Do NOT copy or repeat any of these recently generated titles: ${JSON.stringify(recentTitles.slice(0, 15))}.
Do NOT reuse these plot archetypes: ${JSON.stringify(recentArchetypes.slice(0, 10))}.
Create a completely fresh, enchanting tale!

COLOR & PALETTE RULE:
Strict Explorer Palette only: Midnight Slate (#09141e), Emerald Green (#2ecc71), Electric Cyan (#00d2d3), Solar Orange (#f39c12), and Warm Amber (#ffb961).
STRICTLY NEVER mention or use pink or purple!

STRUCTURE:
Generate exactly 3 chapters:
Chapter 1 (Twilight Arrival & Discovery): ~110-130 words. Packing hero gear/magic item, entering realm, celebrating daytime achievements.
Chapter 2 (Starlit Journey & Gentle Obstacle): ~120-140 words. Discovering a sleepy creature or gentle obstacle, resolving it with ${moralId} and ${petName}'s help.
Chapter 3 (Deep Slumber Sanctuary): ~110-130 words. Tucking in, cozy nest, synchronized 4s inhale / 4s exhale breathing, sleepy yawns, whispered goodnight.

Return ONLY a valid JSON object matching this schema (no markdown, no backticks, just raw JSON):
{
  "title": "A soothing creative title (max 5 words)",
  "theme": "${moralId}",
  "realm": "${realmId}",
  "chapters": [
    {
      "chapterIndex": 0,
      "chapterNumber": 1,
      "title": "Chapter 1: Short Chapter Title",
      "chapterText": "Soothing narrative text (~110-130 words)",
      "whisperLine": "A comforting whisper line for bedtime",
      "sleepyCue": "A physical relaxation prompt",
      "moralReflection": "A sweet sentence celebrating courage or kindness",
      "choices": ["Choice 1", "Choice 2", "Choice 3"],
      "sceneMood": "tranquil",
      "sceneDescriptor": {
        "environmentBiome": "Twilight Realm Entry",
        "timeOfNight": "twilight_arrival",
        "weatherParticles": "fireflies",
        "cameraWork": "orbit_pan",
        "heroAction": "walking_with_lantern",
        "petAction": "trotting_beside",
        "keyProps": ["Starlight Lantern"],
        "lightingPalette": {
          "ambient": "#09141e",
          "directional": "#00d2d3",
          "accent": "#ffb961"
        }
      }
    },
    {
      "chapterIndex": 1,
      "chapterNumber": 2,
      "title": "Chapter 2: Short Chapter Title",
      "chapterText": "Soothing narrative text (~120-140 words)",
      "whisperLine": "A comforting whisper line",
      "sleepyCue": "A slow deep breath prompt",
      "moralReflection": "A sweet reflection on moral virtue",
      "choices": ["Choice 1", "Choice 2", "Choice 3"],
      "sceneMood": "mystical",
      "sceneDescriptor": {
        "environmentBiome": "Starlit Path",
        "timeOfNight": "starlit_journey",
        "weatherParticles": "aurora_ribbons",
        "cameraWork": "follow_walk",
        "heroAction": "helping_obstacle",
        "petAction": "glowing_magic",
        "keyProps": ["Sleeping Friend", "Amber Beacon"],
        "lightingPalette": {
          "ambient": "#09141e",
          "directional": "#00d2d3",
          "accent": "#ffb961"
        }
      }
    },
    {
      "chapterIndex": 2,
      "chapterNumber": 3,
      "title": "Chapter 3: The Slumber Sanctuary",
      "chapterText": "Soothing narrative text (~110-130 words)",
      "whisperLine": "Goodnight little hero, sweet dreams",
      "sleepyCue": "4s inhale, 4s exhale breathing pacer",
      "moralReflection": "Resting easy knowing you did your best today",
      "choices": [],
      "sceneMood": "deep_slumber",
      "sceneDescriptor": {
        "environmentBiome": "Slumber Sanctuary Nest",
        "timeOfNight": "deep_slumber_sanctuary",
        "weatherParticles": "starlight_snow",
        "cameraWork": "crane_descend_nest",
        "heroAction": "curled_asleep",
        "petAction": "sleeping_curled",
        "keyProps": ["Cozy Slumber Nest", "Velvet Blankets"],
        "lightingPalette": {
          "ambient": "#09141e",
          "directional": "#09141e",
          "accent": "#ffb961"
        }
      }
    }
  ]
}`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        });

        const rawText = (response as any).text || "";
        const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed && Array.isArray(parsed.chapters) && parsed.chapters.length >= 3) {
          const normalizedChapters = parsed.chapters.slice(0, 3).map((ch: any, idx: number) => ({
            ...ch,
            chapterIndex: idx,
            chapterNumber: idx + 1,
            text: ch.chapterText || ch.text || "",
            chapterText: ch.chapterText || ch.text || "",
            choices: Array.isArray(ch.choices) ? ch.choices : [],
            sceneDescriptor: {
              environmentBiome: ch.sceneDescriptor?.environmentBiome || "Twilight Slumber Realm",
              timeOfNight: idx === 0 ? "twilight_arrival" : idx === 1 ? "starlit_journey" : "deep_slumber_sanctuary",
              weatherParticles: ch.sceneDescriptor?.weatherParticles || (idx === 1 ? "aurora_ribbons" : idx === 2 ? "starlight_snow" : "fireflies"),
              cameraWork: idx === 0 ? "orbit_pan" : idx === 1 ? "follow_walk" : "crane_descend_nest",
              heroAction: idx === 0 ? "walking_with_lantern" : idx === 1 ? "helping_obstacle" : "curled_asleep",
              petAction: idx === 0 ? "trotting_beside" : idx === 1 ? "glowing_magic" : "sleeping_curled",
              keyProps: Array.isArray(ch.sceneDescriptor?.keyProps) ? ch.sceneDescriptor.keyProps : ["Starlight Lantern", "Cozy Nest"],
              lightingPalette: {
                ambient: "#09141e",
                directional: "#00d2d3",
                accent: "#ffb961"
              }
            }
          }));

          const storyPayload = {
            success: true,
            storyId: `story_${Date.now()}`,
            title: parsed.title || `${heroName}'s Adventure in ${realmId}`,
            theme: moralId,
            realm: realmId,
            realmId: realmId,
            realmName: realmId,
            moralId: moralId,
            heroName,
            petName,
            seed: Date.now(),
            archetypeId: parsed.archetypeId || "gemini_cloud",
            chapters: normalizedChapters
          };

          const reqIdx = actNumber !== undefined ? Number(actNumber) - 1 : (chapterIndex !== undefined ? Number(chapterIndex) : undefined);
          if (reqIdx !== undefined && normalizedChapters[reqIdx]) {
            const ch = normalizedChapters[reqIdx];
            res.json({
              ...storyPayload,
              ...ch,
              text: ch.text,
              title: ch.title,
              prompt: ch.choices?.[0] ? "What should we do next?" : "Sleep tight, brave hero.",
              promptQuestion: ch.choices?.[0] ? "What should we do next?" : "Sleep tight, brave hero.",
              defaultChips: ch.choices.map((c: string) => ({ text: c, icon: "stars" })),
              suggestionChips: ch.choices.map((c: string) => ({ text: c, icon: "stars" })),
              isSleepingEnd: reqIdx >= 2
            });
            return;
          }

          res.json(storyPayload);
          return;
        }
      } catch (geminiErr) {
        console.warn("Cloud Functions Gemini story error, using procedural fallback:", geminiErr);
      }
    }

    // Standalone fallback generator
    const ch1Text = `The golden sun had dipped peacefully below the horizon, painting the sky in deep shades of midnight slate and starlight cyan. Tonight, ${heroName} and faithful companion ${petName} stood at the edge of the realm. Their cozy bedtime adventure was just beginning. ${petName} adjusted their soft explorer collar with quiet excitement. ${petName} looked over with a warm, comforting smile: "Every great bedtime explorer knows that sweet dreams begin with preparation! What special hero gadget should we pack into our backpack tonight?" ${customWish ? `Tonight was extra special because ${heroName} whispered a bedtime wish: "${customWish}". ` : ""}The cool evening air was quiet and peaceful.`;
    const ch2Text = `With their favorite hero gear snugly tucked into their pack, ${heroName} and ${petName} ventured deeper along the glowing pathway. Suddenly, ${petName}'s ears perked up! The loyal pet padded ahead toward a patch of shimmering moon-flowers. There, nestled beneath a canopy of gentle starlight, was a sweet little creature in need of a friend. It blinked its sleepy eyes, looking just a little bit nervous in the big, quiet night. ${petName} leaned in gently, giving a warm, reassuring nuzzle to let the creature know it was completely safe with friends nearby.`;
    const ch3Text = `All was quiet now across the vast expanse of the realm. The little creature was safely tucked into its cozy mossy hammock, purring softly in deep slumber. ${heroName} felt a wonderful, heavy warmth spreading from their toes all the way up to their eyelids. ${petName} curled up into a soft, fluffy ball at ${heroName}'s side, letting out a giant, sleepy yawn that made everyone yawn too. ${petName} softly snuggled down under the glowing bedtime lantern and whispered into the quiet twilight: "You did wonderful today, brave hero. You brushed your teeth, showed kindness, and conquered the day. Now, let the stars watch over your dreams."`;

    const explorerPalette = { ambient: "#09141e", directional: "#00d2d3", accent: "#ffb961" };

    const chapters = [
      {
        chapterIndex: 0,
        chapterNumber: 1,
        title: "Chapter 1: The Evening Departure",
        chapterText: ch1Text,
        text: ch1Text,
        whisperLine: `The evening sky is calm and quiet, ${heroName}. Rest your shoulders.`,
        sleepyCue: "Take one slow, deep breath as the stars begin to twinkle.",
        moralReflection: "Every great journey begins with a brave little first step.",
        choices: ["Starlight Compass 🧭", "Laser Toothbrush 🪥", "Cozy Pajamas 🧸"],
        sceneMood: "tranquil",
        sceneDescriptor: {
          environmentBiome: "The Moonlit Meadow",
          timeOfNight: "twilight_arrival" as const,
          weatherParticles: "fireflies" as const,
          cameraWork: "orbit_pan" as const,
          heroAction: "walking_with_lantern" as const,
          petAction: "trotting_beside" as const,
          keyProps: ["Starlight Lantern", "Glowing Path"],
          lightingPalette: explorerPalette
        }
      },
      {
        chapterIndex: 1,
        chapterNumber: 2,
        title: "Chapter 2: The Curious Discovery",
        chapterText: ch2Text,
        text: ch2Text,
        whisperLine: "You are safe with friends nearby. The night is gentle and kind.",
        sleepyCue: "Notice how soft the night sounds are, like a whispered lullaby.",
        moralReflection: "Helping a friend in need is a true hero superpower.",
        choices: ["Share Blanket 🤝", "Take 3 Deep Breaths 🧘", "Sing a Gentle Song 🎵"],
        sceneMood: "mystical",
        sceneDescriptor: {
          environmentBiome: "The Whispering Canopy",
          timeOfNight: "starlit_journey" as const,
          weatherParticles: "aurora_ribbons" as const,
          cameraWork: "follow_walk" as const,
          heroAction: "helping_obstacle" as const,
          petAction: "glowing_magic" as const,
          keyProps: ["Sleeping Star-Friend", "Amber Beacon"],
          lightingPalette: explorerPalette
        }
      },
      {
        chapterIndex: 2,
        chapterNumber: 3,
        title: "Chapter 3: The Slumber Sanctuary",
        chapterText: ch3Text,
        text: ch3Text,
        whisperLine: "Close your eyes, brave hero. Sleep is here, warm and sweet.",
        sleepyCue: "Inhale peace for 4 seconds... exhale dreams for 4 seconds...",
        moralReflection: "Resting easy in the gentle stillness of the quiet night.",
        choices: [],
        sceneMood: "deep_slumber",
        sceneDescriptor: {
          environmentBiome: "The Slumber Sanctuary",
          timeOfNight: "deep_slumber_sanctuary" as const,
          weatherParticles: "starlight_snow" as const,
          cameraWork: "crane_descend_nest" as const,
          heroAction: "curled_asleep" as const,
          petAction: "sleeping_curled" as const,
          keyProps: ["Cozy Slumber Nest", "Velvet Blankets"],
          lightingPalette: explorerPalette
        }
      }
    ];

    const fallbackPayload = {
      success: true,
      storyId: `story_${Date.now()}`,
      title: `${heroName} and ${petName}'s Bedtime Journey`,
      theme: moralId,
      realm: realmId,
      realmId: realmId,
      realmName: realmId,
      moralId: moralId,
      heroName,
      petName,
      seed: Date.now(),
      archetypeId: "procedural_cloud",
      chapters
    };

    const reqIdx = actNumber !== undefined ? Number(actNumber) - 1 : (chapterIndex !== undefined ? Number(chapterIndex) : undefined);
    if (reqIdx !== undefined && chapters[reqIdx]) {
      const ch = chapters[reqIdx];
      res.json({
        ...fallbackPayload,
        ...ch,
        text: ch.text,
        title: ch.title,
        prompt: ch.choices?.[0] ? "What should we do next?" : "Sleep tight, brave hero.",
        promptQuestion: ch.choices?.[0] ? "What should we do next?" : "Sleep tight, brave hero.",
        defaultChips: ch.choices.map((c: string) => ({ text: c, icon: "stars" })),
        suggestionChips: ch.choices.map((c: string) => ({ text: c, icon: "stars" })),
        isSleepingEnd: reqIdx >= 2
      });
      return;
    }

    res.json(fallbackPayload);
  } catch (err) {
    const message = errorMessage(err, "Failed to generate bedtime story");
    console.error("Bedtime story error:", message);
    res.status(500).json({ error: message });
  }
});

export const api = onRequest(
  { secrets: ["ELEVENLABS_API_KEY", "GEMINI_API_KEY"] },
  app
);
