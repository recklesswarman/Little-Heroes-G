// Bedtime AI Storybook generation (text only -- voice narration is no
// longer handled here). The app has three live URLs, but only the App
// Hosting backend (server.js) runs a real Express server -- GitHub Pages
// and the plain Firebase Hosting site (.web.app/.firebaseapp.com) serve
// static files only, so a relative fetch('/api/gemini/bedtime-story') from
// those origins has nothing to answer it. firebase.json's hosting.rewrites
// routes "/api/rex/bedtime-story" and "/api/gemini/bedtime-story" here
// instead. Everything else -- /api/gemini/chat (already has its own
// client-side fallback to the chatWithPet callable below), the
// WebSocket-only /api/gemini/live Rex companion (can't be proxied through a
// Hosting rewrite at all), and voice narration (now served by the
// standalone little-heroes-tts-service, called directly by the client) --
// is intentionally left alone / out of scope for this file.
//
// This mirrors the bedtime-story half of server/geminiService.js as
// closely as possible, kept as a standalone copy rather than an import:
// `firebase deploy --only functions` only uploads this functions/
// directory, so a relative import reaching outside it would build fine
// locally and then fail at runtime once deployed.

import { onRequest } from "firebase-functions/v2/https";
import express, { Request, Response } from "express";
import { cleanName } from "./storyEngine/safety";
import { buildRequest, generateBedtimeChapter, generateBedtimeStory } from "./storyEngine/engine";
import { makeGeminiGenerate } from "./storyEngine/gemini";

const app = express();
app.use((req: Request, res: Response, next) => {
  const origin = req.headers.origin;
  res.header("Access-Control-Allow-Origin", (typeof origin === "string" ? origin : "*"));
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});
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

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ===========================================================================
// Bedtime AI Storybook Routes -- /api/rex/bedtime-story & /api/gemini/bedtime-story
// Uses the shared story engine (functions/src/storyEngine is a generated copy of
// shared/storyEngine -- edit there, then run scripts/sync-story-engine.mjs).
// ===========================================================================

function humanize(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function safeId(value: unknown, fallback: string): string {
  return typeof value === "string" && /^[a-z0-9_]{1,40}$/.test(value) ? value : fallback;
}

// Offline chapters (always name the hero) used when the model is unavailable or fails validation.
function buildFallbackChapters(heroName: string, petName: string, realmId: string, customWish: string) {
  const ch1Text = `Deep dusk settled softly over the horizon as velvet midnight slate embraced the outer boundaries of ${realmId}. Tonight, ${heroName} and faithful companion ${petName} stood at the peaceful threshold of their quiet bedtime adventure. Together, they made sure their bedtime satchel was packed with care, placing their favorite hero gear securely alongside warm woolly socks and a glowing starlight lantern. ${petName} adjusted their soft explorer collar with quiet satisfaction, giving a cheerful tail swish to signal that everything was in its proper place. ${petName} nudged the satchel closed and murmured reassuringly: "Every brave explorer knows that true comfort begins with a calm mind, tidy preparations, and a peaceful heart." ${customWish ? `Tonight was extra comforting because ${heroName}'s family had shared a tender bedtime wish: "${customWish}". ` : `${heroName} paused to reflect on today's heroic accomplishments, from brushing teeth thoroughly to speaking kindly to family. `}The cool evening air brushed gently against their cheeks, carrying away the busy energy of the afternoon. Each slow, relaxed step along the trail felt lighter than the last, as the world prepared for peaceful slumber. With their shoulders loosening and minds settling into quiet comfort, they walked forward into the tranquil twilight.`;
  const ch2Text = `Moving deeper into ${realmId}, the winding pathway glowed with faint ribbons of bioluminescent emerald and starlight cyan. The soothing atmosphere surrounded them with a blanket of quiet, as dew drops sparkled peacefully along the sleepy fern leaves. Suddenly, ${petName}'s ears twitched with alertness, sniffing the gentle evening breeze before stepping softly toward a sheltered alcove. There, resting quietly under a canopy of velvety night leaves, was a sweet little woodland traveler nestled in a soft mossy hollow. The little friend blinked drowsy eyes, shivering just a tiny bit in the stillness of the unfamiliar evening. ${heroName} stepped forward with slow, gentle care, holding up the starlight lantern to cast a warm, comforting amber glow across the moss. ${petName} leaned down beside the small traveler, offering a gentle, warm nuzzle and a soft purr that washed away every trace of nervousness. "You are completely safe with us," ${petName} whispered softly, "because true friends always watch over each other in the quiet dark." The sweet creature snuggled closer against the moss, feeling the reassuring presence of two kind companions.`;
  const ch3Text = `In this tranquil setting, it became clear that their new companion was facing a gentle bedtime hurdle, feeling unsure of the quiet path home. ${petName} stepped forward with gentle understanding: "Remember, brave explorer, taking slow deep breaths and sharing kindness always guides our way." ${heroName} nodded with a peaceful smile, practicing patience and gentle sharing with heartfelt care. Working together with quiet teamwork, ${heroName} and ${petName} shared a warm velvet blanket and guided their friend across the gentle stepping stones. Loyal companion ${petName} nudged the friend gently onward, showing how simple and wonderfully rewarding it feels to do the right thing. The little friend let out a long, contented sigh of pure relief, nuzzling deep into the soft, warm blanket. A gentle amber glow illuminated the entire clearing, dissolving every lingering worry into nighttime stillness. ${heroName} felt every muscle soften, knowing kindness had made the world a safer, cozier place tonight. With peaceful harmony restored, the journey turned toward sweet slumber.`;
  const ch4Text = `Guided by the softest glow of twilight, ${heroName} and faithful ${petName} reached the secluded slumber sanctuary of ${realmId}. The little forest creature was already nestled in its hammock, breathing peacefully with soft, rhythmic murmurs of deep content. ${heroName} climbed into the cozy bed, feeling a wonderful, heavy warmth spreading from their toes all the way up to their eyelids. ${petName} curled into a soft, fluffy circle at ${heroName}'s side, resting their chin on paws and letting out an enormous, sleepy yawn. That gentle yawn was so wonderfully contagious that ${heroName} let out a slow, cozy yawn too, sinking deeper into the soft pillows. ${petName} whispered into the calm twilight: "You were magnificent today, brave hero; you helped others, showed courage, and brought warmth wherever you walked." Now breathe in the cool stillness for four slow, peaceful counts... hold the quiet comfort... and breathe out softly for four relaxing counts. The sky dimmed to midnight slate as glowing aurora ribbons faded into a gentle, sleepy lullaby. Close your eyes, brave champion, and drift into sweet dreams.`;

  const explorerPalette = { ambient: "#09141e", directional: "#00d2d3", accent: "#ffb961" };

  const chapters = [
    {
      chapterIndex: 0,
      chapterNumber: 1,
      title: "Chapter 1: The Evening Departure",
      chapterText: ch1Text,
      text: ch1Text,
      whisperLine: `The evening sky is calm and quiet, ${heroName}. Rest your shoulders and breathe softly.`,
      sleepyCue: "Take one slow, deep breath as the evening stars begin to glow.",
      moralReflection: "Every great journey begins with a brave little first step into the quiet evening.",
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
        heroAction: "discovering_landmark" as const,
        petAction: "sniffing_clue" as const,
        keyProps: ["Sleeping Star-Friend", "Amber Beacon"],
        lightingPalette: explorerPalette
      }
    },
    {
      chapterIndex: 2,
      chapterNumber: 3,
      title: "Chapter 3: The Calming Resolution",
      chapterText: ch3Text,
      text: ch3Text,
      whisperLine: "Kindness and gentle patience always light the quiet way home.",
      sleepyCue: "Breathe out slowly, letting all the day's busy thoughts melt away.",
      moralReflection: "Resting easy knowing that patience and goodness made someone safe tonight.",
      choices: ["Gentle Teamwork 🤝", "Cozy Lantern Beacon 🏮", "Soft Humming 🎵"],
      sceneMood: "gentle",
      sceneDescriptor: {
        environmentBiome: "The Cooperative Glade",
        timeOfNight: "starlit_journey" as const,
        weatherParticles: "fireflies" as const,
        cameraWork: "follow_walk" as const,
        heroAction: "helping_obstacle" as const,
        petAction: "glowing_magic" as const,
        keyProps: ["Amber Beacon", "Slumber Flowers"],
        lightingPalette: explorerPalette
      }
    },
    {
      chapterIndex: 3,
      chapterNumber: 4,
      title: "Chapter 4: The Slumber Sanctuary",
      chapterText: ch4Text,
      text: ch4Text,
      whisperLine: "Close your eyes, brave hero. Sleep is here, warm, safe, and sweet.",
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
  return chapters;
}

app.post(["/api/rex/bedtime-story", "/api/gemini/bedtime-story"], async (req: Request, res: Response) => {
  try {
    if (isRateLimited(`bedtime:${getRequestIp(req)}`, 20, 60_000)) {
      res.status(429).json({ error: "Too many requests, please slow down." });
      return;
    }

    const body = (req.body || {}) as any;
    const realmId = safeId(body.realmId, "space");
    const moralId = safeId(body.moralId, "brave_dark");
    const realm = { id: realmId, name: humanize(realmId), subtitle: "", subBiomes: [] as string[], accentColor: "#00d2d3" };
    const moral = { id: moralId, name: humanize(moralId), moralGuidance: "", slumberResolution: "" };
    const request = buildRequest(body, { realm, moral });
    const petName: string = cleanName(body.petName, "Rex");

    const apiKey = process.env.GEMINI_API_KEY;
    let generate: any = null;
    if (apiKey) {
      const { GoogleGenAI } = await import("@google/genai");
      generate = makeGeminiGenerate(new GoogleGenAI({ apiKey }), { model: process.env.GEMINI_STORY_MODEL || undefined });
    }

    const fallbackChapters = buildFallbackChapters(request.heroName, petName, realm.name, request.customWish);
    const common = {
      generate,
      request,
      recentTitles: Array.isArray(body.recentTitles) ? body.recentTitles : [],
      recentArchetypes: Array.isArray(body.recentArchetypes) ? body.recentArchetypes : [],
      proceduralChapter: (idx: number) => fallbackChapters[idx]
    };

    const envelope = {
      success: true,
      storyId: `story_${Date.now()}`,
      theme: moralId,
      realm: realmId,
      realmId,
      realmName: realm.name,
      moralId,
      heroName: request.heroName,
      petName,
      seed: Date.now()
    };

    const { actNumber, chapterIndex } = body;
    const reqIdx = actNumber !== undefined ? Number(actNumber) - 1 : (chapterIndex !== undefined ? Number(chapterIndex) : undefined);

    if (reqIdx !== undefined && Number.isInteger(reqIdx) && reqIdx >= 0 && reqIdx <= 3) {
      const out = await generateBedtimeChapter({
        ...common,
        chapterIndex: reqIdx,
        bible: body.storyBible || null,
        previousSummaries: body.previousChapters
      });
      if (generate && out.source === "procedural") {
        console.warn("Bedtime chapter used offline fallback:", out.issues);
      }
      res.json({ ...envelope, ...out.chapter, storyBible: out.bible, generationSource: out.source, generationIssues: out.issues });
      return;
    }

    const story = await generateBedtimeStory(common);
    res.json({
      ...envelope,
      title: story.bible.title,
      archetypeId: story.bible.archetypeId,
      storyBible: story.bible,
      generationSources: story.sources,
      chapters: story.chapters
    });
  } catch (err) {
    const message = errorMessage(err, "Failed to generate bedtime story");
    console.error("Bedtime story error:", message);
    res.status(500).json({ error: message });
  }
});

export const api = onRequest(
  { secrets: ["GEMINI_API_KEY"] },
  app
);
