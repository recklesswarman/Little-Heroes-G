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
      recentArchetypes = [],
      recentOpenings = []
    } = (req.body || {}) as any;

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `You are an expert children's bedtime author and soothing cartoon companion creating a deeply personalized, 4-chapter bedtime story for a young child (ages 3-7).
Child's Name: "${heroName}"
Companion Pet: "${petName}" (Species/Archetype: ${petId})
Bedtime Realm: "${realmId}"
Moral Theme: "${moralId}"
${magicItem ? `Magic Item chosen by child: "${magicItem}". Include this special item in the story!` : ""}
${gentleObstacle ? `Gentle hurdle: "${gentleObstacle}". Resolve this hurdle through kindness!` : ""}
${customWish ? `Parent Bedtime Wish: "${customWish}". Weave this gently into Chapter 1!` : ""}
${userChoices.length > 0 ? `Child's choices: ${JSON.stringify(userChoices)}` : ""}

ANTI-REPETITION MANDATE:
1. NEVER copy or repeat any of these recently generated titles: ${JSON.stringify(recentTitles.slice(0, 15))}.
2. NEVER reuse these plot archetypes: ${JSON.stringify(recentArchetypes.slice(0, 10))}.
3. NEVER repeat any of these recent chapter openings: ${JSON.stringify(recentOpenings.slice(0, 15))}.
4. BANNED CLICHÉS: Strictly NEVER use stock phrases such as "smiled happily beside", "looked up at the starry sky", "gazed with wonder", "twinkled like cheerful fireflies", "golden sun had dipped peacefully", "all was quiet now", "gazed at the quiet, starry night", or "flew across the starry sky". Craft fresh, vivid, soothing prose!

COLOR & PALETTE RULE:
Strict Explorer Palette only: Midnight Slate (#09141e), Emerald Green (#2ecc71), Electric Cyan (#00d2d3), Solar Orange (#f39c12), and Warm Amber (#ffb961).
STRICTLY NEVER mention or use pink or purple!

STRUCTURE:
Generate exactly 4 chapters (~180-220 words per chapter, ~750-850 words total across 4 chapters, lasting 7-8 minutes of calm bedtime storytelling):
- Chapter 1 (Departure & Gentle Curiosity): ~180-220 words. Packing hero gear/magic item, entering realm, celebrating daytime achievements.
- Chapter 2 (Whimsical Encounter & Gentle Mystery): ~180-220 words. Discovering a sleepy creature or gentle obstacle with ${petName}'s help.
- Chapter 3 (Calming Cooperative Resolution): ~180-220 words. Resolving the hurdle with ${moralId} and calm teamwork.
- Chapter 4 (Cozy Starlight Slumber Sanctuary): ~180-220 words. Tucking into the cozy nest, 4s inhale / 4s exhale breathing, sleepy yawns, whispered goodnight.

NO QUESTIONS: Do NOT ask questions like "What should we do next?". Tell a calm, continuous, soothing narrative.

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
      "chapterText": "Soothing narrative text (~180-220 words)",
      "whisperLine": "A comforting whisper line for bedtime",
      "sleepyCue": "A physical relaxation prompt",
      "moralReflection": "A sweet sentence celebrating courage or kindness",
      "choices": [],
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
      "chapterText": "Soothing narrative text (~180-220 words)",
      "whisperLine": "A comforting whisper line",
      "sleepyCue": "A slow deep breath prompt",
      "moralReflection": "A sweet reflection on moral virtue",
      "choices": [],
      "sceneMood": "mystical",
      "sceneDescriptor": {
        "environmentBiome": "Starlit Path",
        "timeOfNight": "starlit_journey",
        "weatherParticles": "aurora_ribbons",
        "cameraWork": "follow_walk",
        "heroAction": "discovering_landmark",
        "petAction": "sniffing_clue",
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
      "title": "Chapter 3: Short Chapter Title",
      "chapterText": "Soothing narrative text (~180-220 words)",
      "whisperLine": "Kindness and patience always light the way home",
      "sleepyCue": "A muscle relaxation cue",
      "moralReflection": "A sweet reflection on peaceful cooperation",
      "choices": [],
      "sceneMood": "gentle",
      "sceneDescriptor": {
        "environmentBiome": "Cooperative Meadow",
        "timeOfNight": "starlit_journey",
        "weatherParticles": "fireflies",
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
      "chapterIndex": 3,
      "chapterNumber": 4,
      "title": "Chapter 4: The Slumber Sanctuary",
      "chapterText": "Soothing narrative text (~180-220 words)",
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
};
`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        });

        const rawText = (response as any).text || "";
        const cleanJson = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed && Array.isArray(parsed.chapters) && parsed.chapters.length >= 4) {
          const normalizedChapters = parsed.chapters.slice(0, 4).map((ch: any, idx: number) => ({
            ...ch,
            chapterIndex: idx,
            chapterNumber: idx + 1,
            text: ch.chapterText || ch.text || "",
            chapterText: ch.chapterText || ch.text || "",
            choices: Array.isArray(ch.choices) ? ch.choices : [],
            sceneDescriptor: {
              environmentBiome: ch.sceneDescriptor?.environmentBiome || "Twilight Slumber Realm",
              timeOfNight: idx === 0 ? "twilight_arrival" : (idx === 1 || idx === 2) ? "starlit_journey" : "deep_slumber_sanctuary",
              weatherParticles: ch.sceneDescriptor?.weatherParticles || (idx === 1 ? "aurora_ribbons" : idx === 3 ? "starlight_snow" : "fireflies"),
              cameraWork: idx === 0 ? "orbit_pan" : (idx === 1 || idx === 2) ? "follow_walk" : "crane_descend_nest",
              heroAction: idx === 0 ? "walking_with_lantern" : idx === 1 ? "discovering_landmark" : idx === 2 ? "helping_obstacle" : "curled_asleep",
              petAction: idx === 0 ? "trotting_beside" : idx === 1 ? "sniffing_clue" : idx === 2 ? "glowing_magic" : "sleeping_curled",
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
              prompt: reqIdx >= 3 ? "Sleep tight, brave hero. Sweet dreams." : "The evening trail is quiet and welcoming.",
              promptQuestion: reqIdx >= 3 ? "Sleep tight, brave hero. Sweet dreams." : "The evening trail is quiet and welcoming.",
              defaultChips: ch.choices.map((c: string) => ({ text: c, icon: "stars" })),
              suggestionChips: ch.choices.map((c: string) => ({ text: c, icon: "stars" })),
              isSleepingEnd: reqIdx >= 3
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

    // Standalone 4-chapter narrative expansion fallback generator (~180-220 words per chapter)
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
        prompt: reqIdx >= 3 ? "Sleep tight, brave hero. Sweet dreams." : "The evening trail is quiet and welcoming.",
        promptQuestion: reqIdx >= 3 ? "Sleep tight, brave hero. Sweet dreams." : "The evening trail is quiet and welcoming.",
        defaultChips: ch.choices.map((c: string) => ({ text: c, icon: "stars" })),
        suggestionChips: ch.choices.map((c: string) => ({ text: c, icon: "stars" })),
        isSleepingEnd: reqIdx >= 3
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
  { secrets: ["GEMINI_API_KEY"] },
  app
);
