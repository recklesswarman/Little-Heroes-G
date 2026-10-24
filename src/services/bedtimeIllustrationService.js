/**
 * Bedtime Storybook Illustration Service
 * Handles requesting and caching 3D Pixar / Claymation bedtime illustrations
 * from the Cloudflare Workers AI free image generation API.
 */

import { store } from '../state/store.js';

const clientIllustrationCache = new Map();
const inFlightRequests = new Map();

export class BedtimeIllustrationService {
  constructor() {
    this.illustrationCache = clientIllustrationCache;
  }

  getCacheKey(params = {}) {
    const { realmId = 'realm', chapterNumber = 1, heroName = '', petName = '', chapterTitle = '' } = params;
    return `${realmId}_ch${chapterNumber}_${heroName || ''}_${petName || ''}${chapterTitle ? '_' + chapterTitle.slice(0, 30) : ''}`;
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
      chapterNumber = 1,
      chapterTitle = '',
      chapterText = '',
      realmId = 'space',
      realmName = 'Fantasy Realm',
      heroName = 'Little Hero',
      petName = 'Rex',
      petArchetype = 'dino',
      magicItem = 'Starlight Lantern',
      prompt: customPrompt
    } = params;

    const cacheKey = `${realmId}_ch${chapterNumber}_${(chapterTitle || '').slice(0, 30)}`;

    if (clientIllustrationCache.has(cacheKey)) {
      return {
        imageUrl: clientIllustrationCache.get(cacheKey),
        cached: true
      };
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      try {
        const payload = {
          chapterNumber,
          chapterTitle,
          chapterText,
          realmId,
          realmName,
          heroName,
          petName,
          petArchetype,
          magicItem,
          prompt: customPrompt,
          format: 'base64'
        };

        let imageUrl = '';

        // Route illustration requests through the local server proxy only.
        // The Cloudflare Workers AI API key must never be shipped to the browser,
        // so there is no direct-to-Cloudflare fallback here.
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
            if (data && data.imageUrl) {
              imageUrl = data.imageUrl;
            }
          }
        } catch (proxyErr) {
          // Fall through to the procedural SVG fallback below
        }

        if (imageUrl) {
          clientIllustrationCache.set(cacheKey, imageUrl);

          // Preload into browser image cache
          if (typeof Image !== 'undefined') {
            const preloadImg = new Image();
            preloadImg.src = imageUrl;
          }

          return { imageUrl, success: true };
        }

        return { imageUrl: null, success: false };

      } catch (err) {
        console.warn('Illustration generation error:', err.message);
        return { imageUrl: null, success: false, error: err.message };
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  /**
   * Pre-fetches Chapter N+1 illustration in the background for zero-lag transitions
   */
  prefetchNextChapterIllustration(params = {}) {
    const nextChapterNumber = (params.chapterNumber || 1) + 1;
    if (nextChapterNumber > 4) return;

    this.generateChapterIllustration({
      ...params,
      chapterNumber: nextChapterNumber
    }).catch(() => {});
  }

}

export const bedtimeIllustrationService = new BedtimeIllustrationService();
