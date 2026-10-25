/**
 * Bedtime Storybook Image Generation Service
 * Proxies requests to Cloudflare Workers AI free image generator API
 * (saurav-z/free-image-generation-api) with in-memory caching and resilient fallbacks.
 */

import { computeMd5 } from '../src/utils/md5.js';

const imageCache = new Map();
const MAX_CACHE_SIZE = 50;

/**
 * Builds a prompt for 3D Pixar / Claymation bedtime story illustrations
 * adhering strictly to the Explorer Palette (zero pink/purple).
 */
export function buildBedtimeIllustrationPrompt(params = {}) {
  const {
    chapterTitle = '',
    chapterText = '',
    chapterNumber = 1,
    realmName = 'Starlight Woods',
    realmId = 'woods',
    heroName = 'Little Hero',
    petName = 'Rex',
    petArchetype = 'dino',
    magicItem = 'Starlight Lantern'
  } = params;

  // Unabridged chapter narrative without truncation
  const fullNarrativeText = (chapterText || '').trim();

  // Core character depiction (null-safe guard)
  const safeHeroName = (params.heroName || heroName || 'Little Hero').trim() || 'Little Hero';
  const safePetName = (params.petName || petName || 'Rex').trim() || 'Rex';
  const heroDescription = `a cute cheerful toddler adventurer named ${safeHeroName} wearing cozy pajamas and a soft heroic cape`;
  const petDescription = `a friendly lovable companion pet named ${safePetName} (${petArchetype})`;

  // Realm atmosphere
  const realmAtmosphere = `peaceful nighttime atmosphere in the magical realm of ${realmName}, gentle glowing fireflies, soft twilight sky with twinkling stars, cozy storybook diorama`;

  // Chapter-specific focus
  let chapterAction = '';
  if (chapterNumber === 1) {
    chapterAction = `${safeHeroName} and ${safePetName} embarking on their evening bedtime journey holding a glowing ${magicItem}`;
  } else if (chapterNumber === 2) {
    chapterAction = `${safeHeroName} and ${safePetName} discovering a sleepy gentle bedtime friend under moonbeams`;
  } else if (chapterNumber === 3) {
    chapterAction = `${safeHeroName} and ${safePetName} solving a gentle puzzle with kindness and friendship`;
  } else {
    chapterAction = `${safeHeroName} and ${safePetName} curled up cozily asleep in a warm starlight nest drifting to peaceful dreams`;
  }

  // 3D Pixar / Claymation style guidelines with strict Explorer Palette enforcement
  const stylePrompt = [
    `3D Pixar style digital art, soft rounded claymation character textures, stop-motion charm`,
    `adorable cartoon proportions, warm cinematic volumetric bedtime lighting`,
    `Explorer Palette: deep midnight slate, luminous starlight cyan, solar orange warmth, and emerald green accents (no pink, no purple, cozy bedtime atmosphere)`,
    `award-winning children's storybook illustration, cozy, peaceful, 8k render, masterpiece`
  ].join(', ');

  const contextPart = fullNarrativeText ? ` Context: ${fullNarrativeText}.` : '';
  return `${chapterAction}, ${heroDescription}, ${petDescription}. Setting: ${realmAtmosphere}.${contextPart} Style: ${stylePrompt}.`;
}

/**
 * Handles POST /api/story/illustration
 */
export async function handleStoryIllustrationRequest(req, res) {
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
      prompt: customPrompt
    } = req.body || {};

    const chIdx = chapterIndex ?? (chapterNumber - 1);
    const cacheKey = `${sessionId || 'story'}_ch${chIdx}_${computeMd5(chapterText || '')}`;

    const prompt = customPrompt || buildBedtimeIllustrationPrompt({
      chapterTitle,
      chapterText,
      chapterNumber,
      realmName,
      realmId,
      heroName,
      petName,
      petArchetype,
      magicItem
    });

    const seed = reqSeed !== undefined && reqSeed !== null
      ? Number(reqSeed)
      : Math.floor(Math.random() * 2147483647);
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
                      process.env.FREE_IMAGE_API_URL || '';

    const apiKey = process.env.CLOUDFLARE_IMAGE_API_KEY ||
                   process.env.FREE_IMAGE_API_KEY || '';

    if (workerUrl && apiKey) {
      try {
        const cleanWorkerUrl = workerUrl.endsWith('/') ? workerUrl : `${workerUrl}/`;
        const cfRes = await fetch(cleanWorkerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            prompt,
            model: process.env.CLOUDFLARE_AI_MODEL || '@cf/bytedance/stable-diffusion-xl-lightning',
            seed,
            negative_prompt,
            format: 'base64'
          }),
          signal: AbortSignal.timeout(25000)
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
