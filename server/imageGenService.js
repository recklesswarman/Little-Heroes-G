/**
 * Bedtime Storybook Image Generation Service
 * Proxies requests to Cloudflare Workers AI free image generator API
 * (saurav-z/free-image-generation-api) with in-memory caching and resilient fallbacks.
 */

import crypto from 'node:crypto';
import { computeMd5 } from '../src/utils/md5.js';
import { extractSceneMoment, buildDetailedPrompt, estimatePromptTokens } from '../shared/storyEngine/scenes.js';
import { DEFAULT_HERO_LOOK_DETAILED } from '../shared/storyEngine/avatarLook.js';
import { isRateLimited, getRequestIp } from './geminiService.js';

// Each picture spends the family's Cloudflare/Gemini allowance, so cap callers per IP
// (a story night is ~2 pictures per chapter plus a character sheet).
const ILLUSTRATION_LIMIT_PER_MIN = 30;

// FLUX.1 schnell reads long prompts. Cloudflare retired the SDXL models on 2026-11-20; the Worker keeps its own
// fallback chain, so this is just the model asked for first.
const DEFAULT_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

const imageCache = new Map();
const MAX_CACHE_SIZE = 50;

/**
 * Builds a prompt for 3D Pixar / Claymation bedtime story illustrations
 * adhering strictly to the Explorer Palette (zero pink/purple).
 */
export function buildBedtimeIllustrationPrompt(params = {}) {
  const {
    chapterText = '',
    chapterNumber = 1,
    sceneType = 'scene_a',
    realmName = 'Starlight Woods',
    petArchetype = 'dino',
    magicItem = 'Starlight Lantern'
  } = params;
  // Same builder as the planned pictures: detailed, name-free, on-palette (no colour is ever named to be avoided).
  const moment = extractSceneMoment(chapterText, sceneType)
    || (sceneType === 'scene_b'
      ? 'the hero and the companion share a quiet magical moment together'
      : 'the hero and the companion set out together on a cozy evening journey');
  return buildDetailedPrompt({
    moment,
    heroDesc: `a cheerful toddler with a big happy smile, ${DEFAULT_HERO_LOOK_DETAILED}`,
    petDesc: `a cute baby ${petArchetype}`,
    setting: `a magical bedtime realm of ${realmName}`,
    centralObject: `a softly glowing ${magicItem}`,
    chapterIndex: Math.max(0, Math.min(3, (Number(chapterNumber) || 1) - 1)),
    sceneType
  });
}

/** The compact prompt for models that only read the first ~77 tokens. */
export function buildCompactIllustrationPrompt(params = {}) {
  const { heroName = 'Little Hero', petName = 'Rex', petArchetype = 'dino', realmName = 'Starlight Woods' } = params;
  const text = `cute 3D toddler ${heroName} and baby ${petArchetype} ${petName}, cozy night in ${realmName}, soft 3D clay claymation storybook render, amber and cyan glow`;
  return estimatePromptTokens(text) > 70 ? text.split(' ').slice(0, 40).join(' ') : text;
}

/**
 * Handles POST /api/story/illustration
 */
export async function handleStoryIllustrationRequest(req, res) {
  if (isRateLimited(`illustration:${getRequestIp(req)}`, ILLUSTRATION_LIMIT_PER_MIN, 60_000)) {
    return res.status(429).json({ success: false, error: 'Too many pictures right now, try again in a minute.' });
  }
  try {
    const {
      sessionId = '',
      chapterIndex,
      chapterNumber = 1,
      chapterTitle = '',
      chapterText = '',
      realmName = 'Fantasy Realm',
      realmId = 'space',
      heroName = 'Little Hero',
      petName = 'Rex',
      petArchetype = 'dino',
      magicItem = 'Starlight Lantern',
      format = 'base64',
      seed: reqSeed,
      negative_prompt: reqNegPrompt,
      prompt: customPrompt,
      shortPrompt: customShortPrompt,
      sceneType: reqSceneType,
      referenceImages: reqReferences
    } = req.body || {};
    // The story's first picture(s), so later pages keep the same characters (the Worker uses FLUX.2 klein).
    const referenceImages = Array.isArray(reqReferences)
      ? reqReferences.filter((r) => typeof r === 'string' && /^data:image\/(jpeg|png|webp);base64,/i.test(r) && r.length < 600000).slice(0, 2)
      : [];

    const chIdx = chapterIndex ?? (chapterNumber - 1);
    const safeSessionId = typeof sessionId === 'string' && sessionId ? sessionId.slice(0, 128) : 'story';
    const safeChapterText = typeof chapterText === 'string' ? chapterText.slice(0, 20000) : '';
    const sceneType = reqSceneType === 'scene_b' ? 'scene_b' : 'scene_a';
    const safePrompt = typeof customPrompt === 'string' ? customPrompt.slice(0, 4000) : '';
    const safeShort = typeof customShortPrompt === 'string' ? customShortPrompt.slice(0, 1000) : '';
    // The two pictures of a chapter share a session and chapter text: the key must tell them apart (and follow the
    // prompt), or the second picture would come back as the first one's cached image.
    const cacheKey = `${safeSessionId}_ch${chIdx}_${sceneType}_${computeMd5(safeChapterText)}_${computeMd5(safePrompt)}`;

    const promptParams = { chapterTitle, chapterText: safeChapterText, chapterNumber, realmName, realmId, heroName, petName, petArchetype, magicItem, sceneType };
    const prompt = safePrompt || buildBedtimeIllustrationPrompt(promptParams);
    const shortPrompt = safeShort || buildCompactIllustrationPrompt(promptParams);

    const seed = reqSeed !== undefined && reqSeed !== null
      ? Number(reqSeed)
      : crypto.randomInt(1, 2147483647);
    const negative_prompt = reqNegPrompt || "pink, purple, magenta, violet, neon pink, scary, dark, deformed, blurry";

    // Check in-memory cache
    if (imageCache.has(cacheKey)) {
      return res.json({
        success: true,
        imageUrl: imageCache.get(cacheKey),
        cached: true,
        cacheKey,
        prompt,
        seed
      });
    }

    const workerUrl = process.env.CLOUDFLARE_IMAGE_API_URL ||
                      process.env.CLOUDFLARE_WORKER_URL ||
                      process.env.FREE_IMAGE_API_URL || 'https://little-heroes-free-image-api.recklesswarman.workers.dev';

    // The Worker has no shared key; it only accepts requests from allow-listed origins.
    const workerOrigin = process.env.CLOUDFLARE_IMAGE_ORIGIN || 'https://little-heroes-quest-8842.web.app';

    if (workerUrl) {
      try {
        const cleanWorkerUrl = workerUrl.endsWith('/') ? workerUrl : `${workerUrl}/`;
        const cfRes = await fetch(cleanWorkerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': workerOrigin
          },
          body: JSON.stringify({
            prompt,
            shortPrompt,
            model: process.env.CLOUDFLARE_AI_MODEL || DEFAULT_IMAGE_MODEL,
            seed,
            negative_prompt,
            ...(referenceImages.length ? { referenceImages } : {}),
            format: 'base64'
          }),
          signal: AbortSignal.timeout(referenceImages.length ? 36000 : 25000)
        });

        if (cfRes.ok) {
          const contentType = cfRes.headers.get('content-type') || '';
          let dataUri = '';

          if (contentType.includes('application/json')) {
            const json = await cfRes.json();
            dataUri = json.dataUri || json.imageUrl || json.url || '';
          } else {
            // Raw binary image
            const buffer = await cfRes.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            dataUri = `data:image/jpeg;base64,${base64}`;
          }

          if (dataUri) {
            // Store in cache
            if (imageCache.size >= MAX_CACHE_SIZE) {
              const oldestKey = imageCache.keys().next().value;
              imageCache.delete(oldestKey);
            }
            imageCache.set(cacheKey, dataUri);

            return res.json({
              success: true,
              imageUrl: dataUri,
              provider: 'cloudflare-workers-ai',
              prompt,
              seed,
              cacheKey
            });
          }
        }
      } catch (cfErr) {
        console.warn('Cloudflare Workers AI generation notice:', cfErr.message);
      }
    }

    // High quality SVG Storybook fallback if Cloudflare Worker is not configured or offline
    const fallbackDataUri = generateStorybookSvgDataUri({
      realmId,
      realmName,
      chapterNumber,
      heroName,
      petName,
      chapterTitle
    });

    return res.json({
      success: true,
      imageUrl: fallbackDataUri,
      isFallback: true,
      provider: 'storybook-procedural-fallback',
      prompt,
      seed,
      cacheKey,
      message: workerUrl ? 'Cloudflare Workers AI unavailable; used fallback' : 'Configure CLOUDFLARE_IMAGE_API_URL to enable live AI illustrations'
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * High-resolution Storybook fallback illustration in Explorer Palette
 */
function generateStorybookSvgDataUri({ realmId, realmName, chapterNumber, heroName, petName, chapterTitle }) {
  const bgColors = {
    space: ['#07131d', '#00253d', '#00d2d3'],
    woods: ['#09141e', '#0b2b1a', '#2ecc71'],
    cloud: ['#09141e', '#1c2838', '#ffb961'],
    dino:  ['#09141e', '#23180c', '#f39c12']
  };

  const colors = bgColors[realmId] || bgColors.space;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${colors[0]}" />
        <stop offset="70%" stop-color="${colors[1]}" />
        <stop offset="100%" stop-color="#09141e" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stop-color="${colors[2]}" stop-opacity="0.35" />
        <stop offset="100%" stop-color="${colors[2]}" stop-opacity="0" />
      </radialGradient>
      <filter id="softGlow">
        <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    <!-- Night Sky -->
    <rect width="100%" height="100%" fill="url(#bgGrad)" />
    <circle cx="400" cy="220" r="260" fill="url(#glow)" />
    
    <!-- Twinkling Constellations -->
    <g fill="#ffffff" opacity="0.8">
      <circle cx="120" cy="80" r="2" />
      <circle cx="240" cy="60" r="2.5" />
      <circle cx="360" cy="95" r="1.8" />
      <circle cx="520" cy="50" r="3" />
      <circle cx="680" cy="110" r="2" />
      <circle cx="720" cy="65" r="2.5" />
      <circle cx="180" cy="160" r="1.5" />
      <circle cx="620" cy="180" r="2.2" />
    </g>

    <!-- Gentle Moon / Horizon Glow -->
    <circle cx="400" cy="160" r="60" fill="${colors[2]}" opacity="0.2" filter="url(#softGlow)" />
    <circle cx="400" cy="160" r="45" fill="#ffb961" opacity="0.75" />
    <circle cx="385" cy="150" r="40" fill="${colors[0]}" />

    <!-- Cozy Storybook Nest Hills -->
    <path d="M 0 380 Q 200 320 400 360 T 800 380 L 800 500 L 0 500 Z" fill="#09141e" opacity="0.95" />
    <path d="M 0 420 Q 300 380 550 410 T 800 430 L 800 500 L 0 500 Z" fill="#050c13" />

    <!-- Chapter Header Plaque -->
    <rect x="250" y="420" width="300" height="48" rx="24" fill="#0f2334" stroke="${colors[2]}" stroke-width="2" opacity="0.9" />
    <text x="400" y="445" font-family="system-ui, sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">
      ${heroName} &amp; ${petName} • Chapter ${chapterNumber}
    </text>
    <text x="400" y="460" font-family="system-ui, sans-serif" font-weight="600" font-size="10" fill="${colors[2]}" text-anchor="middle">
      ${realmName}
    </text>
  </svg>`;

  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}
