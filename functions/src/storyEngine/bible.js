// Story Bible: the fixed cast, motivations and plot skeleton shared by every chapter of one story.
// The bible is planned once (chapter 1), returned to the client, and sent back with each later
// chapter request, so the server stays stateless. Anything arriving from a client or an LLM is
// re-normalized here -- never trusted.

import { cleanField } from './safety.js';
import { slug } from './json.js';

export const TONES = ['calm', 'cozy', 'silly', 'adventurous'];

const TONE_GUIDE = {
  calm: 'very calm, slow and soothing, with soft sensory detail',
  cozy: 'warm, snuggly and reassuring, full of comforting small details',
  silly: 'gently playful and giggly with harmless silliness, but always winding down toward sleep',
  adventurous: 'a gentle quest with wonder and mild excitement, never frightening, easing toward sleep'
};

export function toneGuide(tone) {
  return TONE_GUIDE[tone] || TONE_GUIDE.calm;
}

const BEAT_STAGES = [
  'Gentle departure and curiosity: the hero sets out and something intriguing appears.',
  'A whimsical encounter: the hero meets a friend or a gentle puzzle.',
  'A calm, cooperative resolution: kindness and teamwork solve it.',
  'Cozy slumber: everything settles, breathing slows, goodnight.'
];

export function beatStage(index) {
  return BEAT_STAGES[Math.max(0, Math.min(3, index))];
}

function field(value, max, fallback = '') {
  return cleanField(value, max) || fallback;
}

function cleanTraits(traits) {
  if (!Array.isArray(traits)) return [];
  return traits.map(t => field(t, 24)).filter(Boolean).slice(0, 4);
}

/**
 * Coerce untrusted bible-shaped input into a safe, complete bible.
 * The hero is always characters[0] with the exact requested name.
 */
export function normalizeBible(raw, request) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const heroName = request.heroName;
  const srcChars = Array.isArray(src.characters) ? src.characters : [];

  const heroSrc = srcChars.find(c => c && String(c.name || '').trim().toLowerCase() === heroName.toLowerCase())
    || srcChars.find(c => c && c.role === 'hero') || {};

  const characters = [{
    id: 'hero',
    name: heroName,
    role: 'hero',
    motivation: field(heroSrc.motivation, 100, `${heroName} wants to help a new friend and then settle down for a peaceful sleep.`),
    traits: cleanTraits(heroSrc.traits),
    visualSheet: field(heroSrc.visualSheet, 160)
  }];

  const seen = new Set([heroName.toLowerCase()]);
  for (const c of srcChars) {
    if (characters.length >= 5) break;
    if (!c || typeof c !== 'object') continue;
    const name = field(c.name, 30);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    characters.push({
      id: slug(name) || `char-${characters.length}`,
      name,
      role: field(c.role, 30, 'friend'),
      motivation: field(c.motivation, 100, `${name} wants everyone to feel safe and sleepy.`),
      traits: cleanTraits(c.traits),
      visualSheet: field(c.visualSheet, 160)
    });
  }

  const dna = src.plotDNA && typeof src.plotDNA === 'object' ? src.plotDNA : {};
  const plotDNA = {
    setting: field(dna.setting, 80, request.realm?.name || 'a quiet moonlit place'),
    conflict: field(dna.conflict, 80, 'a small gentle puzzle'),
    helper: field(dna.helper, 60, 'a kind new friend'),
    twist: field(dna.twist, 80, 'a surprising kindness'),
    resolution: field(dna.resolution, 80, 'teamwork and patience'),
    centralObject: field(dna.centralObject, 60, 'a glowing lantern'),
    arc: field(dna.arc, 80, 'from curiosity to cozy sleep')
  };

  const srcBeats = Array.isArray(src.beats) ? src.beats : [];
  const knownNames = new Set(characters.map(c => c.name.toLowerCase()));
  const beats = [0, 1, 2, 3].map(i => {
    const b = srcBeats[i] && typeof srcBeats[i] === 'object' ? srcBeats[i] : {};
    const names = (Array.isArray(b.characters) ? b.characters : [])
      .map(n => field(n, 30)).filter(n => n && knownNames.has(n.toLowerCase()));
    if (!names.some(n => n.toLowerCase() === heroName.toLowerCase())) names.unshift(heroName);
    return { summary: field(b.summary, 200, beatStage(i)), characters: names.slice(0, 4) };
  });

  const tone = TONES.includes(src.tone) ? src.tone : (TONES.includes(request.tone) ? request.tone : 'calm');

  return {
    title: field(src.title, 60, `${heroName}'s Sleepy Adventure`),
    tone,
    characters,
    plotDNA,
    beats,
    archetypeId: `bible:${slug(plotDNA.conflict, 18)}-${slug(plotDNA.twist, 18)}`
  };
}

/** Deterministic bible used when the planner LLM is unavailable or produces junk. */
export function fallbackBible(request) {
  const raw = {
    title: `${request.heroName} and the ${request.realm?.name || 'Moonlit'} Lullaby`,
    tone: request.tone,
    characters: request.petName ? [{
      name: request.petName,
      role: 'companion',
      motivation: `${request.petName} wants to keep ${request.heroName} company all the way to sleep.`,
      traits: ['loyal', 'gentle']
    }] : [],
    plotDNA: {
      setting: request.realm?.name,
      conflict: request.moral?.name ? `a small puzzle that needs ${request.moral.name}` : undefined
    }
  };
  return normalizeBible(raw, request);
}

export function buildBiblePrompt(request, { recentTitles = [], recentArchetypes = [], research = [] } = {}) {
  const suggestions = [];
  if (request.petName) suggestions.push(`Companion pet: ${request.petName}`);
  if (request.realm) suggestions.push(`Setting idea: ${request.realm.name} (${request.realm.subtitle || ''})`);
  if (request.moral) suggestions.push(`Gentle lesson idea: ${request.moral.name} - ${request.moral.moralGuidance || ''}`);
  if (request.customWish) suggestions.push(`Parent's wish: ${request.customWish}`);
  if (request.magicItem) suggestions.push(`Special item: ${request.magicItem}`);
  for (const r of research.slice(0, 3)) suggestions.push(`Fresh idea: ${r}`);

  return `You are planning a calming 4-chapter bedtime story for a child aged ${request.ageBand}. Plan only; do not write the story.

REQUIRED: The child's name is "${request.heroName}". ${request.heroName} is the main character of the story. Spell the name exactly like that.

SUGGESTIONS (optional context). Weave in whichever fit the plot naturally; adapt or skip any that do not fit:
${suggestions.map(s => `- ${s}`).join('\n') || '- (none)'}

TONE: ${toneGuide(request.tone)}.

FRESHNESS: Invent an original plot. Do not reuse any of these recent titles: ${JSON.stringify(recentTitles.slice(0, 15))}. Do not reuse these plot types: ${JSON.stringify(recentArchetypes.slice(0, 10))}.

RULES: Always kid-appropriate and gentle: no danger, no scary beings, no violence. Never use pink or purple. Give every recurring character a fixed name, a clear kind motivation, and a short fixed visual description.

Return ONLY raw JSON (no markdown):
{
  "title": "max 5 words",
  "tone": "calm|cozy|silly|adventurous",
  "characters": [
    { "name": "${request.heroName}", "role": "hero", "motivation": "...", "traits": ["..."], "visualSheet": "fixed look in one sentence" },
    { "name": "friend name", "role": "friend|companion|helper", "motivation": "...", "traits": ["..."], "visualSheet": "..." }
  ],
  "plotDNA": { "setting": "...", "conflict": "...", "helper": "...", "twist": "...", "resolution": "...", "centralObject": "...", "arc": "..." },
  "beats": [
    { "summary": "chapter 1 beat", "characters": ["names present"] },
    { "summary": "chapter 2 beat", "characters": ["..."] },
    { "summary": "chapter 3 beat", "characters": ["..."] },
    { "summary": "chapter 4 beat (cozy slumber)", "characters": ["..."] }
  ]
}`;
}
