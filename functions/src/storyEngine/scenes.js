// Illustration planning: turns a finished chapter plus the story bible into two scene prompts
// (scene_a = first half, scene_b = second half) that keep every character looking the same.
// Pure functions, so the server, the client and the tests share one implementation.
//
// The picture model only reads about 70 tokens, so each prompt is: what is happening, then a short
// fixed look for each character in the scene, then a fixed style. Names are replaced by plain nouns
// (a picture model would try to draw them as text). No pink or purple anywhere.

import { cleanField } from './safety.js';
import { hashString } from './seeds.js';
import { HAIR_LOOKS, PET_SKINS, pickHair, pickSkin } from './characterSheet.js';
import { DEFAULT_HERO_LOOK, DEFAULT_HERO_LOOK_DETAILED, detailedLook } from './avatarLook.js';

export const MAX_PROMPT_TOKENS = 70;
// The detailed prompt is for models that read long text (FLUX). Size window in words.
export const DETAILED_MIN_WORDS = 110;
export const DETAILED_MAX_WORDS = 185;
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
function visualSentences(chapterText) {
  if (!chapterText || typeof chapterText !== 'string') return [];
  const cleaned = chapterText
    .replace(/["“][^"”]*["”]/g, '. ')
    .replace(/\[[^\]]*\]|\*[^*]*\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim().replace(/^[\s:,;'‘’]+|[\s:,;'‘’]+$/g, ''))
    .filter(s => s.length > 25 && /^[A-Z]/.test(s) && !CLOSING_LINE_PATTERN.test(s));
  return sentences;
}

export function extractSceneFocalNarrative(chapterText = '', sceneType = 'scene_a') {
  const sentences = visualSentences(chapterText);
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

/**
 * The moment a picture shows, for the detailed prompt: the most visual sentence of that half of the chapter
 * plus the sentence that follows it when there is room, with abstract feelings left out. Longer than the
 * focal narrative, because the long-prompt model can use it.
 */
export function extractSceneMoment(chapterText = '', sceneType = 'scene_a', maxWords = 46) {
  const sentences = visualSentences(chapterText);
  if (sentences.length === 0) return '';
  const mid = sentences.length === 1 ? 1 : Math.ceil(sentences.length / 2);
  const half = sentences.length === 1 ? (sceneType === 'scene_b' ? [] : sentences) : (sceneType === 'scene_b' ? sentences.slice(mid) : sentences.slice(0, mid));
  if (!half.length) return '';
  let bestIndex = 0; let bestScore = -Infinity;
  half.forEach((sentence, i) => { const score = scoreVisualSentence(sentence); if (score > bestScore) { bestIndex = i; bestScore = score; } });
  const pick = [half[bestIndex]];
  if (half[bestIndex + 1]) pick.push(half[bestIndex + 1]);
  const words = pick.join(' ').split(/\s+/).filter(w => !ABSTRACT_WORDS.has(w.toLowerCase().replace(/[^a-z'-]/g, '')));
  const clipped = words.slice(0, maxWords);
  while (clipped.length > 6 && DANGLING_END_WORDS.has(clipped[clipped.length - 1].toLowerCase().replace(/[^a-z]/g, ''))) clipped.pop();
  return clipped.join(' ').replace(/[\s,;:.!?-]+$/, '');
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

/** A whole look sheet (not cut to a few words), cleaned and on-palette. */
function fullLook(raw, max = 170) {
  const text = cleanField(typeof raw === 'string' ? raw : '', max);
  return text ? scrubColors(text.replace(/^(a|an|the)\s+/i, '')).replace(/[\s,;:.!?-]+$/, '') : '';
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
    // "an owl named Pip" -> "an owl": the introduction goes with the name instead of becoming "named a friend".
    out = out.replace(new RegExp(`\\s+(?:named|called)\\s+${escapeRe(n)}(?![\\w-])`, 'gi'), '');
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

// ---- Detailed prompts (long-prompt models) -------------------------------------------------------------
// One picture = one paragraph: the camera, the moment, who is in it (fixed look sheets, so the child, pet and
// friends look the same in every picture), the place, the light and the mood of that chapter. Names become plain
// nouns, there are no negatives (FLUX has no negative prompt, and naming a colour to avoid can bring it in), and
// the palette is stated positively so pink and purple never appear.

const DETAILED_STYLE = "A soft 3D clay claymation children's storybook illustration with rounded friendly shapes, fuzzy felt and clay textures, shallow depth of field and soft volumetric light";
const DETAILED_FINISH = 'Everything has gentle rounded edges, tiny hand-made details, soft shadows and a cozy, safe, dreamy feeling.';
const DETAILED_PALETTE = 'Color palette: deep midnight teal, glowing starlight cyan, warm amber orange and fresh emerald green; every glow, spark and symbol is cyan, amber or green.';

// Time, light and mood by chapter (the story has four).
const CHAPTER_ATMOSPHERE = [
  { time: 'dusk with the very first stars appearing', light: 'warm golden afterglow low on the horizon under a cool teal sky', air: 'a few drifting fireflies', mood: 'curious and welcoming, with bright wide-open eyes' },
  { time: 'a calm starlit night', light: 'bright silver-cyan starlight with a soft amber lantern glow on the characters', air: 'glowing fireflies and ribbons of soft aurora', mood: 'full of wonder, with gentle excited smiles' },
  { time: 'a deep starry night with a bright round moon', light: 'cool moonbeams with warm amber highlights and tiny glowing magic motes', air: 'slowly drifting aurora ribbons', mood: 'kind and cooperative, with warm proud smiles' },
  { time: 'the sleepiest hour of the night', light: 'a very soft, dim amber glow with a gentle halo of starlight and low contrast', air: 'slowly falling starlight snow', mood: 'peaceful and drowsy, with eyes half closed and tiny content smiles' }
];

// Two different camera positions per chapter so the two pictures of a chapter never look alike.
const SHOTS = {
  scene_a: [
    'a wide establishing shot at eye level, the characters small in the lower third and the place filling the frame',
    'a wide three-quarter view from slightly above, a winding path leading the eye into the scene',
    'a wide low-angle shot looking up at the setting, with the characters in the foreground',
    'a wide, calm, symmetrical shot of the sleepy place, the characters centered and small'
  ],
  scene_b: [
    'a close medium shot at the characters\' eye level, focused on their happy faces and what they hold',
    'an over-the-shoulder medium shot looking toward what they have just discovered',
    'a close, slightly low-angle shot of the characters working together, hands and faces large in the frame',
    'a very close, soft-focus shot of the characters curled up together and nearly asleep'
  ]
};

// A picture model repaints anything the prompt leaves open, so the child's hair and the pet's colour would change from
// picture to picture. When no look sheet fixes them, one of each is picked from the story's seed and used in all eight.

const wordCount = (t) => (String(t).match(/\S+/g) || []).length;

/**
 * The long prompt for one picture. `parts`: { moment, heroDesc, petDesc, friendDesc, setting, centralObject,
 * chapterIndex, sceneType }. Always on-palette, name-free, between DETAILED_MIN_WORDS and DETAILED_MAX_WORDS words.
 */
export function buildDetailedPrompt(parts = {}) {
  const idx = Math.max(0, Math.min(3, Number.isInteger(parts.chapterIndex) ? parts.chapterIndex : 0));
  const sceneType = parts.sceneType === 'scene_b' ? 'scene_b' : 'scene_a';
  const atmo = CHAPTER_ATMOSPHERE[idx];
  // Every field is cleaned and capped on its own, so no single long input can push the prompt out of its window.
  const clean = (t, max) => scrubColors(String(t || '').replace(/[\u0000-\u001f\u007f<>{}`"]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, max).join(' ')).replace(/[.\s]+$/, '');

  const assemble = (caps, { finish, place }) => {
    const moment = clean(parts.moment, caps.moment);
    const setting = clean(parts.setting, 20);
    const centralObject = clean(parts.centralObject, 10);
    const cast = [`The hero is ${clean(parts.heroDesc, caps.hero) || 'a cheerful toddler with a big happy smile'}.`];
    if (parts.petDesc) cast.push(`Beside the hero is ${clean(parts.petDesc, caps.pet)}.`);
    if (parts.friendDesc) cast.push(`Also in the scene is ${clean(parts.friendDesc, caps.friend)}.`);
    return [
      `${DETAILED_STYLE}, shown as ${SHOTS[sceneType][idx]}.`,
      moment ? `What is happening: ${moment}.` : '',
      cast.join(' '),
      place && setting ? `The setting is ${setting}${centralObject ? `, with ${centralObject} as a glowing focal detail` : ''}.` : '',
      `It is ${atmo.time}. Lighting: ${atmo.light}. In the air: ${atmo.air}. The mood is ${atmo.mood}.`,
      finish ? DETAILED_FINISH : '',
      DETAILED_PALETTE
    ].filter(Boolean).join(' ').replace(/\s{2,}/g, ' ').trim();
  };

  // Over budget: give up the least important things first, one step at a time, and stop as soon as it fits.
  // The moment and the cast are cut last and never removed.
  const steps = [
    { finish: false },
    { place: false },
    { moment: 30 }, { friend: 14 }, { moment: 20 }, { pet: 16 }, { hero: 28 }, { moment: 12 }, { friend: 9 }, { hero: 20 }, { pet: 10 }
  ];
  const caps = { moment: 46, hero: 38, pet: 24, friend: 20 };
  const keep = { finish: true, place: true };
  let text = assemble(caps, keep);
  for (const step of steps) {
    if (wordCount(text) <= DETAILED_MAX_WORDS) break;
    for (const [k, v] of Object.entries(step)) { if (k in keep) keep[k] = v; else caps[k] = Math.min(caps[k], v); }
    text = assemble(caps, keep);
  }
  return text;
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
    const seed = hashString(`${bible.archetypeId || bible.title || ''}|${hero?.name || ''}`) % 2147483647;
    // Long versions of the same sheets for the detailed prompt: the avatar's full outfit when the child's avatar is a
    // built-in one, else the planner's whole look sheet, else the default.
    // The kid's character sheet fixes hair and pet colour across stories; without one they follow the story seed.
    const hair = pickHair(request.heroHair) || HAIR_LOOKS[seed % HAIR_LOOKS.length];
    const heroDetailed = `a cheerful toddler with ${hair} and a big happy smile, ${detailedLook(request.heroLook) || fullLook(hero?.visualSheet) || (request.heroLook ? request.heroLook : DEFAULT_HERO_LOOK_DETAILED)}`;
    const petSpeciesWords = species || 'pet';
    const petSheetFull = fullLook(pet?.visualSheet);
    const hasColour = /\b(green|orange|blue|teal|yellow|golden|gold|amber|brown|red|cream|white|gr[ae]y|silver|black|emerald|tan)\b/i.test(petSheetFull);
    const seededSkin = `${pickSkin(request.petSkin) || PET_SKINS[(seed >> 3) % PET_SKINS.length]} skin and a soft cream belly`;
    const petDetailed = petSheetFull && species && petSheetFull.toLowerCase().includes(species)
      ? `a cute ${petSheetFull}${hasColour ? '' : ` with ${seededSkin}`}`
      : `a cute baby ${petSpeciesWords}${petSheetFull ? `, ${petSheetFull}` : ''}${hasColour ? '' : ` with ${seededSkin}`}`;
    const heroDesc = `a cheerful toddler ${heroLook}`;
    const petDesc = `a cute baby ${species || 'pet'}${petLookRaw && !petLookRaw.toLowerCase().includes(species) ? `, ${petLookRaw}` : (petLookRaw && !species ? petLookRaw : '')}`.replace(/,\s*$/, '');

    const names = { heroName: hero?.name, petName: pet?.name || request.petName, petNoun, friendNames: friends.map(f => f.name) };
    const beat = bible.beats?.[Math.max(0, Math.min(3, chapterIndex))]?.summary || '';
    const setting = compressLook(bible.plotDNA?.setting, 5);

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
      const momentRaw = extractSceneMoment(chapterText, id) || cleanField(beat, 160) || focusRaw;
      const moment = scrubColors(genericizeNames(momentRaw, names));
      const friendsInMoment = friends.filter(f => f.name && new RegExp(`\\b${escapeRe(f.name)}\\b`, 'i').test(momentRaw));
      const friendLook = friendsInMoment.length ? fullLook(friendsInMoment[0].visualSheet) : '';
      const petInMoment = !!pet && (new RegExp(`\\b${escapeRe(pet.name)}\\b`, 'i').test(momentRaw) || !friendsInMoment.length);
      const detailedPrompt = buildDetailedPrompt({
        moment,
        heroDesc: heroDetailed,
        petDesc: petInMoment ? petDetailed : '',
        friendDesc: friendsInMoment.length ? `a friendly ${friendLook || 'gentle friend'}` : '',
        setting: cleanField(bible.plotDNA?.setting, 140),
        centralObject: cleanField(bible.plotDNA?.centralObject, 80),
        chapterIndex,
        sceneType: id
      });
      return { id, focus, prompt: composePrompt(focus, descriptors, setting), detailedPrompt };
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
  const detailed = typeof scene.detailedPrompt === 'string'
    ? scrubColors(scene.detailedPrompt.replace(/[\u0000-\u001f\u007f<>{}`]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 1900)
    : '';
  return {
    prompt,
    ...(detailed ? { detailedPrompt: detailed } : {}),
    seed: Number.isFinite(plan.seed) ? Math.abs(Math.floor(plan.seed)) % 2147483647 : undefined
  };
}
