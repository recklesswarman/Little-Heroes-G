/**
 * Bedtime Storybook Illustration Service
 * Handles requesting and caching 3D Pixar / Claymation bedtime illustrations
 * from the Cloudflare Workers AI free image generation API.
 */

import { store } from '../state/store.js';
import { computeMd5 } from '../utils/md5.js';
import {
  extractSceneFocalNarrative as sharedExtract,
  extractSceneMoment,
  buildDetailedPrompt,
  estimatePromptTokens
} from '../../shared/storyEngine/scenes.js';
import { DEFAULT_HERO_LOOK_DETAILED } from '../../shared/storyEngine/avatarLook.js';

const clientIllustrationCache = new Map();
const inFlightRequests = new Map();

// The SDXL family reads only the first ~77 tokens of a prompt; anything later is dropped. FLUX reads long text.
// `buildPrompt` makes the compact prompt (for the SDXL fallbacks), `buildDetailedPrompt` the long one.
const MAX_PROMPT_TOKENS = 70;

// Main model of the image Worker. Cloudflare retired the SDXL models on 2026-11-20 (the Worker still falls back
// through its own chain), and FLUX.1 schnell is the one that understands detailed, paragraph-length prompts.
/** A random picture seed (1..2^31-1). Uses crypto so code scanning doesn't flag it. */
export function randomPictureSeed() {
  const n = globalThis.crypto?.getRandomValues?.(new Uint32Array(1))[0] ?? Date.now();
  return (n & 0x7fffffff) || 1;
}

export const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

// Same characters on every page: from chapter 2 on, the story's first picture goes to the image
// Worker as a reference (FLUX.2 klein on Cloudflare Workers AI). The model needs references
// under 512 px, so the picture is shrunk in the browser first.
const REFERENCE_MAX_SIDE = 480;
const referenceCache = new Map();

/** Is this a real generated picture (not the SVG placeholder) that can be a reference? */
export function isReferenceCandidate(url) {
  return typeof url === 'string' && /^data:image\/(jpeg|png|webp);base64,/i.test(url) && url.length > 2000;
}

/** Shrinks a picture to a small JPEG data URI for the Worker; '' when that is not possible. */
export async function prepareReferenceImage(url) {
  if (!isReferenceCandidate(url)) return '';
  const key = computeMd5(url.slice(0, 4096) + url.length);
  if (referenceCache.has(key)) return referenceCache.get(key);
  if (typeof document === 'undefined' || typeof Image === 'undefined') return '';
  const small = await new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, REFERENCE_MAX_SIDE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
          canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve('');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
      img.src = url;
    } catch {
      resolve('');
    }
  });
  const value = isReferenceCandidate(small) ? small : '';
  if (referenceCache.size > 20) referenceCache.delete(referenceCache.keys().next().value);
  referenceCache.set(key, value);
  return value;
}

export class BedtimeIllustrationService {
  constructor() {
    this.apiUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_IMAGE_GEN_API_URL) ||
                  'https://little-heroes-free-image-api.recklesswarman.workers.dev';
    // No API key: anything shipped to the browser is public. The Worker authorizes by Origin + rate limit.
    this.illustrationCache = clientIllustrationCache;
  }

  getCacheKey(params = {}) {
    const {
      sessionId = '',
      chapterIndex,
      chapterNumber = 1,
      chapterText = '',
      sceneType = 'scene_a'
    } = params;
    return `${sessionId || 'story'}_ch${chapterIndex ?? (chapterNumber - 1)}_${sceneType}_${computeMd5(chapterText || '')}`;
  }

  /**
   * Summarizes one half of the chapter into a short, visual scene description.
   * scene_a = the most visual sentence of the first half, scene_b = of the second half.
   *
   * Picking by position alone (first / last sentence) gave near-identical prompts for
   * every story: chapters open with a place-name intro and end with generic goodnight
   * filler, while the concrete imagery sits in the middle.
   */
  extractSceneFocalNarrative(chapterText = '', sceneType = 'scene_a') {
    return sharedExtract(chapterText, sceneType);
  }

  generateFallbackIllustration(params = {}) {
    const {
      chapterNumber = 1,
      chapterTitle = '',
      realmName = 'Starlight Realm',
      heroName = 'Hero',
      petName = 'Companion'
    } = params;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
      <defs>
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#050f18" />
          <stop offset="100%" stop-color="#0a2236" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#skyGrad)" />
      <circle cx="400" cy="180" r="45" fill="#ffb961" opacity="0.8" />
      <circle cx="385" cy="170" r="40" fill="#050f18" />
      <g fill="#00d2d3" opacity="0.8">
        <circle cx="150" cy="90" r="2.5" />
        <circle cx="280" cy="70" r="3" />
        <circle cx="520" cy="60" r="2.5" />
        <circle cx="680" cy="100" r="2" />
      </g>
      <path d="M 0 380 Q 200 320 400 360 T 800 380 L 800 500 L 0 500 Z" fill="#09141e" />
      <text x="400" y="440" font-family="system-ui, sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">
        ${heroName} &amp; ${petName} • Chapter ${chapterNumber}
      </text>
      <text x="400" y="460" font-family="system-ui, sans-serif" font-weight="700" font-size="11" fill="#00d2d3" text-anchor="middle">
        ${realmName}
      </text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  /**
   * Generates or retrieves a cached 3D Pixar / Claymation chapter illustration
   */
  async generateChapterIllustration(params = {}) {
    const {
      sessionId = '',
      chapterIndex,
      chapterNumber = 1,
      chapterTitle = '',
      chapterText = '',
      realmId = 'space',
      realmName = 'Fantasy Realm',
      heroName = 'Little Hero',
      petName = 'Rex',
      petArchetype = 'dino',
      magicItem = 'Starlight Lantern',
      sceneType = 'scene_a',
      prompt: customPrompt,
      shortPrompt: customShortPrompt,
      seed: paramSeed,
      referenceImageUrl = ''
    } = params;

    const cacheKey = this.getCacheKey(params);

    if (clientIllustrationCache.has(cacheKey)) {
      return {
        imageUrl: clientIllustrationCache.get(cacheKey),
        cached: true,
        cacheKey
      };
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      try {
        const chIdx = chapterIndex ?? (chapterNumber - 1);
        const seed = paramSeed !== undefined && paramSeed !== null
          ? Number(paramSeed)
          : randomPictureSeed();
        const negative_prompt = "pink, purple, magenta, violet, neon pink, scary, dark, deformed, blurry";

        // Built once so the direct call and the backup route send the same scene summary.
        const promptParams = {
          heroName,
          petName,
          petArchetype,
          realmName,
          chapterNumber,
          chapterText,
          magicItem,
          sceneType
        };
        // Detailed prompt for the long-prompt model; the compact one rides along for the SDXL fallbacks.
        const cfPrompt = customPrompt || this.buildDetailedPrompt(promptParams);
        const cfShortPrompt = customShortPrompt || this.buildPrompt(promptParams);
        // The story's first picture, so this page keeps the same hero and companion.
        const reference = referenceImageUrl ? await prepareReferenceImage(referenceImageUrl) : '';
        const referenceImages = reference ? [reference] : undefined;

        const payload = {
          sessionId,
          chapterIndex: chIdx,
          chapterNumber,
          chapterTitle,
          chapterText,
          realmId,
          realmName,
          heroName,
          petName,
          petArchetype,
          magicItem,
          sceneType,
          prompt: cfPrompt,
          shortPrompt: cfShortPrompt,
          seed,
          negative_prompt,
          referenceImages,
          format: 'base64'
        };

        let imageUrl = '';

        // 1. Client-Direct Cloudflare Workers AI call (Primary Path across all 3 hosts: GitHub Pages, Firebase Hosting, App Hosting)
        if (this.apiUrl) {
          try {
            const cleanUrl = this.apiUrl.endsWith('/') ? this.apiUrl : `${this.apiUrl}/`;

            const directRes = await fetch(cleanUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                prompt: cfPrompt,
                shortPrompt: cfShortPrompt,
                model: IMAGE_MODEL,
                seed,
                negative_prompt,
                referenceImages,
                format: 'base64'
              }),
              // Reference pictures take FLUX.2 klein a little longer.
              signal: AbortSignal.timeout(referenceImages ? 35000 : 22000)
            });

            if (directRes.ok) {
              const contentType = directRes.headers.get('content-type') || '';
              if (contentType.includes('application/json')) {
                const cfData = await directRes.json();
                imageUrl = cfData.dataUri || cfData.imageUrl || '';
              } else {
                // Raw binary image (JPEG/PNG) from Cloudflare Workers AI
                const arrayBuffer = await directRes.arrayBuffer();
                if (typeof btoa !== 'undefined') {
                  let binary = '';
                  const bytes = new Uint8Array(arrayBuffer);
                  const len = bytes.byteLength;
                  for (let i = 0; i < len; i += 8192) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
                  }
                  imageUrl = `data:${contentType || 'image/jpeg'};base64,${btoa(binary)}`;
                } else if (typeof Buffer !== 'undefined') {
                  imageUrl = `data:${contentType || 'image/jpeg'};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
                }
              }
            }
          } catch (cfErr) {
            console.warn('Direct Cloudflare Workers AI call note:', cfErr.message);
          }
        }

        // 2. Secondary fallback: backend proxy route if direct call failed
        if (!imageUrl) {
          try {
            const baseUrl = typeof window !== 'undefined' && window.location?.origin ? '' : '';
            const proxyRes = await fetch(`${baseUrl}/api/story/illustration`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(referenceImages ? 38000 : 18000)
            });

            if (proxyRes.ok) {
              const data = await proxyRes.json();
              if (data && data.imageUrl && !data.imageUrl.includes('<svg') && !data.imageUrl.includes('image/svg+xml')) {
                imageUrl = data.imageUrl;
              }
            }
          } catch (proxyErr) {
            // Ignored
          }
        }

        if (imageUrl) {
          clientIllustrationCache.set(cacheKey, imageUrl);

          // Preload into browser image cache
          if (typeof Image !== 'undefined') {
            const preloadImg = new Image();
            preloadImg.src = imageUrl;
          }

          return { imageUrl, success: true, cacheKey, seed, sceneType };
        }

        return { imageUrl: null, success: false, cacheKey, sceneType };

      } catch (err) {
        console.warn('Illustration generation error:', err.message);
        return { imageUrl: null, success: false, error: err.message, cacheKey, sceneType };
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  /**
   * The long prompt used when the server did not plan the pictures: what happens in this half of the chapter,
   * the hero and pet, the realm, the chapter's light and a camera shot that differs between the two pictures.
   */
  buildDetailedPrompt(params = {}) {
    const {
      petArchetype = 'dino',
      realmName = 'Starlight Woods',
      chapterNumber = 1,
      magicItem = 'Starlight Lantern',
      chapterText = '',
      sceneType = 'scene_a'
    } = params;
    const moment = extractSceneMoment(chapterText, sceneType)
      || (sceneType === 'scene_b'
        ? 'the hero and the companion share a quiet magical moment together'
        : 'the hero and the companion set out together on a cozy evening journey');
    return buildDetailedPrompt({
      moment,
      heroDesc: `a cheerful toddler with a big happy smile, ${DEFAULT_HERO_LOOK_DETAILED}`,
      petDesc: `a cute baby ${petArchetype}`,
      setting: `a magical bedtime realm called ${realmName}`.replace(/\s+called\s+/, ' of '),
      centralObject: `a softly glowing ${magicItem}`,
      chapterIndex: Math.max(0, Math.min(3, (Number(chapterNumber) || 1) - 1)),
      sceneType
    });
  }

  /**
   * Builds prompt for 3D Pixar / Claymation style with narrative front-loaded into first 45 tokens (SDXL 77-token CLIP compliant)
   */
  buildPrompt(params = {}) {
    const {
      heroName = 'Little Hero',
      petName = 'Rex',
      petArchetype = 'dino',
      realmName = 'Starlight Woods',
      chapterNumber = 1,
      magicItem = 'Starlight Lantern',
      chapterText = '',
      sceneType = 'scene_a'
    } = params;

    const focalNarrative = this.extractSceneFocalNarrative(chapterText, sceneType);

    let focalAction = focalNarrative;
    if (!focalAction) {
      if (sceneType === 'scene_b') {
        focalAction = `${heroName} and ${petName} sharing a quiet magical moment with glowing ${magicItem}`;
      } else {
        focalAction = chapterNumber === 1
          ? `${heroName} and ${petName} embarking on cozy journey holding ${magicItem}`
          : chapterNumber === 2
          ? `${heroName} and ${petName} gently exploring magical hidden path`
          : chapterNumber === 3
          ? `${heroName} and ${petName} working together under starlight canopy`
          : `${heroName} and ${petName} snuggled up asleep under twinkling constellation`;
      }
    }

    const styleSuffix = `Cute 3D toddler ${heroName} and baby ${petArchetype} ${petName}, Pixar claymation style, cozy night in ${realmName}, soft amber and starlight cyan glow, storybook masterpiece.`;

    // Keep the whole prompt inside the model's ~77-token window by trimming the scene, not the style.
    const focalWords = focalAction.split(/\s+/);
    while (focalWords.length > 8 && estimatePromptTokens(`${focalWords.join(' ')}. ${styleSuffix}`) > MAX_PROMPT_TOKENS) {
      focalWords.pop();
    }
    return `${focalWords.join(' ').replace(/[\s,;:.!?-]+$/, '')}. ${styleSuffix}`;
  }
}

export const bedtimeIllustrationService = new BedtimeIllustrationService();
