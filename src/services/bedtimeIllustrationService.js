/**
 * Bedtime Storybook Illustration Service
 * Handles requesting and caching 3D Pixar / Claymation bedtime illustrations
 * from the Cloudflare Workers AI free image generation API.
 */

import { store } from '../state/store.js';
import { computeMd5 } from '../utils/md5.js';

const clientIllustrationCache = new Map();
const inFlightRequests = new Map();

// Image models read only the first ~77 tokens of a prompt; anything later is dropped.
const MAX_PROMPT_TOKENS = 70;
const MAX_FOCAL_WORDS = 22;

const CLOSING_LINE_PATTERN = /(close your eyes|your eyes|sweet dreams|sleep tight|good\s?night|drift(?:ing)? (?:off )?(?:in)?to (?:sleep|dreams)|^once upon a time|^chapter \d+)/i;

// Breathing / counting exercises read aloud at bedtime are instructions, not scenery.
const INSTRUCTION_PATTERN = /\b(breath\w*|inhale|exhale|counts?)\b/i;

const DANGLING_END_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'with', 'in', 'on', 'as', 'by', 'at', 'for', 'into', 'over']);

const SPATIAL_WORDS = new Set([
  'under', 'beneath', 'beside', 'across', 'upon', 'among', 'atop', 'along', 'inside', 'behind',
  'above', 'through', 'around', 'toward', 'near', 'over', 'within', 'between', 'on', 'in'
]);

// Mood / feeling words: they describe how the scene feels, not what is in it.
const ABSTRACT_WORDS = new Set([
  'peaceful', 'peacefully', 'tranquil', 'soothing', 'quiet', 'quietly', 'gentle', 'gently', 'profound',
  'sense', 'harmony', 'comfort', 'comforting', 'reassuring', 'reassurance', 'kindness', 'warmth',
  'contentment', 'serenity', 'calm', 'calmly', 'stillness', 'slumber', 'dreams', 'journey', 'realm',
  'worry', 'worries', 'nervousness', 'heartfelt', 'heroic', 'character', 'friendship', 'patience',
  'relief', 'delicate', 'wonderfully', 'rewarding', 'simple', 'true', 'pure', 'sweet', 'cozy'
]);

const STOP_WORDS = new Set([
  'the', 'and', 'with', 'that', 'this', 'their', 'there', 'they', 'them', 'then', 'than', 'from', 'into',
  'was', 'were', 'had', 'has', 'have', 'for', 'her', 'his', 'its', 'she', 'him', 'every', 'each', 'very',
  'just', 'only', 'even', 'while', 'where', 'when', 'which', 'what', 'would', 'could', 'felt', 'feeling',
  'knowing', 'became', 'become', 'made', 'make', 'little', 'tiny', 'bit', 'tonight', 'evening', 'night',
  'nighttime', 'together', 'forward', 'toward', 'whispered', 'said', 'thought', 'remember'
]);

function scoreVisualSentence(sentence) {
  const words = sentence.toLowerCase().match(/[a-z][a-z'-]*/g) || [];
  if (words.length === 0) return -Infinity;

  let content = 0;
  let abstract = 0;
  let spatial = 0;
  for (const w of words) {
    if (SPATIAL_WORDS.has(w)) spatial++;
    else if (ABSTRACT_WORDS.has(w)) abstract++;
    else if (!STOP_WORDS.has(w) && w.length > 3) content++;
  }

  // Capitalized words after the first are names / places ("The Floating Starlight Station").
  const names = Math.max(0, (sentence.match(/\b[A-Z][a-z]+/g) || []).length - 1);

  let score = content + 2 * spatial + Math.min(names, 4) - 2 * abstract;
  if (/\b(sense of|clear that|it felt|knowing|realm)\b/i.test(sentence)) score -= 3;
  if (INSTRUCTION_PATTERN.test(sentence)) score -= 4;
  return score / Math.sqrt(words.length);
}

// Drops mood filler and caps length so the scene stays well inside the token budget.
function condenseSceneSentence(sentence) {
  const kept = sentence
    .split(/\s+/)
    .filter(w => !ABSTRACT_WORDS.has(w.toLowerCase().replace(/[^a-z'-]/g, '')));
  const words = kept.length >= 6 ? kept : sentence.split(/\s+/);
  const clipped = words.slice(0, MAX_FOCAL_WORDS);
  while (clipped.length > 6 && DANGLING_END_WORDS.has(clipped[clipped.length - 1].toLowerCase().replace(/[^a-z]/g, ''))) {
    clipped.pop();
  }
  return clipped.join(' ').replace(/,\s*,/g, ',').replace(/[\s,;:.!?-]+$/, '');
}

function estimatePromptTokens(text) {
  const words = (text.match(/[A-Za-z0-9'-]+/g) || []).length;
  const punctuation = (text.match(/[^\sA-Za-z0-9'-]/g) || []).length;
  return Math.ceil(words * 1.35 + punctuation);
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
    if (!chapterText || typeof chapterText !== 'string') return '';

    const cleaned = chapterText
      .replace(/["“][^"”]*["”]/g, '. ')
      .replace(/\[[^\]]*\]|\*[^*]*\*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const sentences = cleaned
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim().replace(/^[\s:,;'‘’]+|[\s:,;'‘’]+$/g, ''))
      .filter(s => s.length > 25 && /^[A-Z]/.test(s) && !CLOSING_LINE_PATTERN.test(s));

    if (sentences.length === 0) return '';
    if (sentences.length === 1) return sceneType === 'scene_b' ? '' : condenseSceneSentence(sentences[0]);

    const mid = Math.ceil(sentences.length / 2);
    const half = sceneType === 'scene_b' ? sentences.slice(mid) : sentences.slice(0, mid);

    let best = half[0];
    let bestScore = -Infinity;
    for (const sentence of half) {
      const score = scoreVisualSentence(sentence);
      if (score > bestScore) {
        best = sentence;
        bestScore = score;
      }
    }
    return condenseSceneSentence(best);
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

        // Built once so the direct call and the backup route send the same scene summary.
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
          seed,
          negative_prompt,
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
