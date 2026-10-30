/**
 * Bedtime Storybook Illustration Service
 * Handles requesting and caching 3D Pixar / Claymation bedtime illustrations
 * from the Cloudflare Workers AI free image generation API.
 */

import { store } from '../state/store.js';
import { computeMd5 } from '../utils/md5.js';

const clientIllustrationCache = new Map();
const inFlightRequests = new Map();

export class BedtimeIllustrationService {
  constructor() {
    this.apiUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_IMAGE_GEN_API_URL) ||
                  'https://little-heroes-free-image-api.recklesswarman.workers.dev';
    this.apiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_IMAGE_GEN_API_KEY) ||
                  'little-heroes-secret-key';
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
   * Extracts a concise, high-impact focal sentence from the chapter text.
   * For scene_a (Journey): selects from early-to-mid chapter (0% - 50%).
   * For scene_b (Climax): selects from the lower portion of chapter (55% - 100%).
   */
  extractSceneFocalNarrative(chapterText = '', sceneType = 'scene_a') {
    if (!chapterText || typeof chapterText !== 'string') return '';

    const rawSentences = chapterText
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim().replace(/^["'“‘]+|["'”’]+$/g, ''))
      .filter(s => s.length > 12 && !/^(once upon a time|goodnight|chapter \d+)/i.test(s));

    if (rawSentences.length === 0) return '';

    let chosenSentence = '';
    if (sceneType === 'scene_b') {
      const lowerHalfIndex = Math.max(0, Math.floor(rawSentences.length * 0.55));
      const lowerSentences = rawSentences.slice(lowerHalfIndex);
      chosenSentence = lowerSentences[lowerSentences.length - 1] || lowerSentences[0] || rawSentences[rawSentences.length - 1];
    } else {
      const midPoint = Math.max(1, Math.ceil(rawSentences.length * 0.5));
      const earlySentences = rawSentences.slice(0, midPoint);
      chosenSentence = earlySentences[0] || rawSentences[0];
    }

    if (!chosenSentence) return '';

    const words = chosenSentence.split(/\s+/);
    if (words.length > 26) {
      return words.slice(0, 26).join(' ') + '...';
    }
    return chosenSentence;
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
      seed: paramSeed
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
          : Math.floor(Math.random() * 2147483647);
        const negative_prompt = "pink, purple, magenta, violet, neon pink, scary, dark, deformed, blurry";

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
          prompt: customPrompt,
          seed,
          negative_prompt,
          format: 'base64'
        };

        let imageUrl = '';

        // 1. Client-Direct Cloudflare Workers AI call (Primary Path across all 3 hosts: GitHub Pages, Firebase Hosting, App Hosting)
        if (this.apiUrl) {
          try {
            const cleanUrl = this.apiUrl.endsWith('/') ? this.apiUrl : `${this.apiUrl}/`;
            const cfPrompt = customPrompt || this.buildPrompt({
              heroName,
              petName,
              petArchetype,
              realmName,
              chapterNumber,
              chapterText,
              magicItem,
              sceneType
            });

            const directRes = await fetch(cleanUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
              },
              body: JSON.stringify({
                prompt: cfPrompt,
                model: '@cf/bytedance/stable-diffusion-xl-lightning',
                seed,
                negative_prompt,
                format: 'base64'
              }),
              signal: AbortSignal.timeout(22000)
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
              signal: AbortSignal.timeout(18000)
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
   * Pre-fetches Chapter N+1 illustrations (both Scene A & Scene B) in the background for zero-lag transitions
   */
  prefetchNextChapterIllustration(params = {}) {
    const nextChapterNumber = (params.chapterNumber || 1) + 1;
    if (nextChapterNumber > 4) return;

    const nextChapterIndex = params.chapterIndex !== undefined && params.chapterIndex !== null
      ? params.chapterIndex + 1
      : nextChapterNumber - 1;

    this.generateChapterIllustration({
      ...params,
      chapterNumber: nextChapterNumber,
      chapterIndex: nextChapterIndex,
      sceneType: 'scene_a'
    }).catch(() => {});

    this.generateChapterIllustration({
      ...params,
      chapterNumber: nextChapterNumber,
      chapterIndex: nextChapterIndex,
      sceneType: 'scene_b'
    }).catch(() => {});
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

    return `${focalAction}. Cute 3D toddler ${heroName} and baby ${petArchetype} ${petName}, Pixar claymation style, cozy nighttime in ${realmName}, soft amber and starlight cyan glow, midnight slate shadows, storybook masterpiece.`;
  }
}

export const bedtimeIllustrationService = new BedtimeIllustrationService();
