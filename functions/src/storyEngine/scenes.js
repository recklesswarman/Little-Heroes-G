// Illustration planning: turns a finished chapter plus the story bible into two scene prompts
// (scene_a = first half, scene_b = second half) that keep every character looking the same.
// Pure functions, so the server, the client and the tests share one implementation.
//
// The picture model only reads about 70 tokens, so each prompt is: what is happening, then a short
// fixed look for each character in the scene, then a fixed style. Names are replaced by plain nouns
// (a picture model would try to draw them as text). No pink or purple anywhere.

import { cleanField } from './safety.js';
import { hashString } from './seeds.js';
import { DEFAULT_HERO_LOOK } from './avatarLook.js';

export const MAX_PROMPT_TOKENS = 70;
export const MAX_FOCAL_WORDS = 22;
export const NEGATIVE_PROMPT = 'pink, purple, magenta, violet, neon pink, scary, dark, deformed, blurry, text, letters, words, watermark, logo';
export const STYLE_SUFFIX = 'soft 3D clay claymation storybook render, amber and cyan glow';
const MAX_SCENE_WORDS = 14;
const LOOK_WORDS = 9;

const CLOSING_LINE_PATTERN = /(close your eyes|your eyes|sweet dreams|sleep tight|good\s?night|drift(?:ing)? (?:off )?(?:in)?to (?:sleep|dreams)|^once upon a time|^chapter \d+)/i;
const INSTRUCTION_PATTERN = /\b(breath\w*|inhale|exhale|counts?)\b/i;
const DANGLING_END_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'with', 'in', 'on', 'as', 'by', 'at', 'for', 'into', 'over']);
const SPATIAL_WORDS = new Set([
  'under', 'beneath', 'beside', 'across', 'upon', 'among', 'atop', 'along', 'inside', 'behind',
  'above', 'through', 'around', 'toward', 'near', 'over', 'within', 'between', 'on', 'in'
]);
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
  let content = 0; let abstract = 0; let spatial = 0;
  for (const w of words) {
    if (SPATIAL_WORDS.has(w)) spatial++;
    else if (ABSTRACT_WORDS.has(w)) abstract++;
    else if (!STOP_WORDS.has(w) && w.length > 3) content++;
  }
  const names = Math.max(0, (sentence.match(/\b[A-Z][a-z]+/g) || []).length - 1);
  let score = content + 2 * spatial + Math.min(names, 4) - 2 * abstract;
  if (/\b(sense of|clear that|it felt|knowing|realm)\b/i.test(sentence)) score -= 3;
  if (INSTRUCTION_PATTERN.test(sentence)) score -= 4;
  return score / Math.sqrt(words.length);
}

export function condenseSceneSentence(sentence) {
  const kept = sentence.split(/\s+/).filter(w => !ABSTRACT_WORDS.has(w.toLowerCase().replace(/[^a-z'-]/g, '')));
  const words = kept.length >= 6 ? kept : sentence.split(/\s+/);
  const clipped = words.slice(0, MAX_FOCAL_WORDS);
  while (clipped.length > 6 && DANGLING_END_WORDS.has(clipped[clipped.length - 1].toLowerCase().replace(/[^a-z]/g, ''))) clipped.pop();
  return clipped.join(' ').replace(/,\s*,/g, ',').replace(/[\s,;:.!?-]+$/, '');
}

export function estimatePromptTokens(text) {
  const words = (text.match(/[A-Za-z0-9'-]+/g) || []).length;
  const punctuation = (text.match(/[^\sA-Za-z0-9'-]/g) || []).length;
  return Math.ceil(words * 1.35 + punctuation);
}

/**
 * The most visual sentence of one half of the chapter. scene_a = first half, scene_b = second half.
 * (Picking by position alone gave near-identical prompts for every story.)
 */
export function extractSceneFocalNarrative(chapterText = '', sceneType = 'scene_a') {
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
    if (score > bestScore) { best = sentence; bestScore = score; }
  }
  return condenseSceneSentence(best);
}

/** Remove palette-breaking colour words. */
export function scrubColors(text) {
  return String(text || '').replace(/\b(neon\s+)?(pink|purple|magenta|violet|lavender|lilac|fuchsia|mauve|indigo|plum|amethyst)(ish)?\b/gi, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
}

/** A fixed look shortened to a handful of words (model- or client-supplied text is untrusted). */
export function compressLook(raw, maxWords = LOOK_WORDS) {
  let text = cleanField(typeof raw === 'string' ? raw : '', 160);
  if (!text) return '';
  text = scrubColors(text.split(/[.;]/)[0]).replace(/^(a|an|the)\s+/i, '');
  const words = text.split(/\s+/).filter(Boolean).slice(0, maxWords);
  while (words.length > 2 && DANGLING_END_WORDS.has(words[words.length - 1].toLowerCase().replace(/[^a-z]/g, ''))) words.pop();
  return words.join(' ').replace(/[\s,;:.!?-]+$/, '');
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Swap character names for plain nouns so the picture model does not try to paint the names.
 * Whole names only: "Rex" inside "T-Rex" is left alone, and a possessive stays one ("Rex's tail").
 */
export function genericizeNames(text, { heroName = '', petName = '', petNoun = 'pet', friendNames = [] } = {}) {
  let out = String(text || '');
  const swap = (name, noun) => {
    const n = String(name || '').trim();
    if (n.length < 2) return;
    out = out.replace(new RegExp(`(?<![\\w-])${escapeRe(n)}(?![\\w-])(['’]s)?`, 'gi'), (_m, poss) => (poss ? `${noun}'s` : noun));
  };
  swap(heroName, 'the toddler');
  swap(petName, `the ${petNoun}`);
  for (const f of friendNames) swap(f, 'a friend');
  return out.replace(/\b(the|a)\s+(the|a)\b/gi, '$2').replace(/\s{2,}/g, ' ').trim();
}

function composePrompt(focus, descriptors, setting) {
  // Characters lead (the model weighs the start of the prompt most), then what is happening.
  const build = (f, ds, s) => [ds.join(' and '), f, s, STYLE_SUFFIX].filter(Boolean).join(', ');
  const words = focus.split(/\s+/).filter(Boolean).slice(0, MAX_SCENE_WORDS);
  const parts = [...descriptors];
  let place = setting;
  const text = () => build(words.join(' ').replace(/[\s,;:.!?-]+$/, ''), parts, place);
  // Trim in order of importance: setting first, then extra characters, then the scene sentence.
  if (estimatePromptTokens(text()) > MAX_PROMPT_TOKENS) place = '';
  while (estimatePromptTokens(text()) > MAX_PROMPT_TOKENS && parts.length > 2) parts.pop();
  while (estimatePromptTokens(text()) > MAX_PROMPT_TOKENS && words.length > 6) words.pop();
  return text();
}

/**
 * Plan the two pictures of one chapter. Never throws: on any problem it returns null and the
 * client falls back to its own prompt builder.
 */
export function buildScenePlan(args) {
  try {
    const { chapterText = '', bible, request = {}, chapterIndex = 0 } = args || {};
    if (!bible || !Array.isArray(bible.characters)) return null;
    const hero = bible.characters[0];
    const pet = bible.characters.find(c => c.role === 'companion') || null;
    const friends = bible.characters.filter(c => c !== hero && c !== pet);

    const heroLook = compressLook(request.heroLook) || compressLook(hero?.visualSheet) || DEFAULT_HERO_LOOK;
    const species = String(request.petSpecies || '').toLowerCase();
    const petNoun = species || 'pet';
    const petLookRaw = compressLook(pet?.visualSheet);
    const heroDesc = `a cheerful toddler ${heroLook}`;
    const petDesc = `a cute baby ${species || 'pet'}${petLookRaw && !petLookRaw.toLowerCase().includes(species) ? `, ${petLookRaw}` : (petLookRaw && !species ? petLookRaw : '')}`.replace(/,\s*$/, '');

    const names = { heroName: hero?.name, petName: pet?.name || request.petName, petNoun, friendNames: friends.map(f => f.name) };
    const beat = bible.beats?.[Math.max(0, Math.min(3, chapterIndex))]?.summary || '';
    const setting = compressLook(bible.plotDNA?.setting, 5);
    const seed = hashString(`${bible.archetypeId || bible.title || ''}|${hero?.name || ''}`) % 2147483647;

    const scenes = ['scene_a', 'scene_b'].map(id => {
      const raw = extractSceneFocalNarrative(chapterText, id) || cleanField(beat, 120);
      const focusRaw = raw || `${hero?.name || 'a child'} resting in ${bible.plotDNA?.setting || 'a quiet place'}`;
      const focus = scrubColors(genericizeNames(focusRaw, names));
      const mentioned = friends.filter(f => f.name && new RegExp(`\\b${escapeRe(f.name)}\\b`, 'i').test(focusRaw));
      const descriptors = [heroDesc];
      if (pet && (new RegExp(`\\b${escapeRe(pet.name)}\\b`, 'i').test(focusRaw) || !mentioned.length)) descriptors.push(petDesc);
      for (const f of mentioned.slice(0, 1)) {
        const look = compressLook(f.visualSheet);
        descriptors.push(look ? `a friendly ${look}` : 'a gentle friend');
      }
      return { id, focus, prompt: composePrompt(focus, descriptors, setting) };
    });

    return { version: 1, seed, negativePrompt: NEGATIVE_PROMPT, scenes };
  } catch {
    return null;
  }
}

/** The prompt and seed for one scene of a chapter that carries a plan; null when there is none. */
export function scenePromptFromPlan(plan, sceneType = 'scene_a') {
  const scene = plan && Array.isArray(plan.scenes) ? plan.scenes.find(s => s?.id === sceneType) : null;
  if (!scene || typeof scene.prompt !== 'string' || !scene.prompt.trim()) return null;
  // The plan arrives over the network: keep it short and on-palette before it reaches the image model.
  const prompt = scrubColors(scene.prompt.replace(/[\u0000-\u001f\u007f<>{}`]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 400);
  if (!prompt) return null;
  return { prompt, seed: Number.isFinite(plan.seed) ? Math.abs(Math.floor(plan.seed)) % 2147483647 : undefined };
}
