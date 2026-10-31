// Chapter writer: writes one chapter at a time from the story bible + a rolling summary of the
// chapters so far, then validates it (kid-safety, hero name, cast consistency) and repairs.

import { parseJsonLoose, countWords } from './json.js';
import { cleanField, validateChapter } from './safety.js';
import { toneGuide, beatStage, heroPronounRule, petRule } from './bible.js';

const PALETTE_RE = /\b(pink|purple|magenta|violet|lavender)\b/i;
const MIN_WORDS = 70;
const MAX_WORDS = 260;

// Problems that make a chapter unusable. Anything else ("soft") is accepted on the last attempt
// rather than discarding a good chapter for the repetitive offline text.
const isSoftIssue = (issue) => issue === 'too-long' || issue.startsWith('missing-character:');

const BANNED_PHRASES = [
  'smiled happily beside', 'looked up at the starry sky', 'gazed with wonder',
  'twinkled like cheerful fireflies', 'golden sun had dipped peacefully', 'all was quiet now',
  'gazed at the quiet, starry night', 'flew across the starry sky'
];

export function buildChapterPrompt({ request, bible, chapterIndex, previous = [], issues = [] }) {
  const beat = bible.beats[chapterIndex];
  const cast = bible.characters.map(c =>
    `- ${c.name} (${c.role}${c.pronouns ? `, ${c.pronouns}` : ''}): wants ${c.motivation}${c.traits.length ? `; traits: ${c.traits.join(', ')}` : ''}${c.visualSheet ? `; looks: ${c.visualSheet}` : ''}`
  ).join('\n');
  const biome = request.realm?.subBiomes?.[chapterIndex % (request.realm.subBiomes.length || 1)] || '';
  const lastChoice = request.userChoices?.[chapterIndex - 1];

  return `You are a gentle children's bedtime author writing chapter ${chapterIndex + 1} of 4 for a child aged ${request.ageBand}.

STORY: "${bible.title}". Tone: ${toneGuide(bible.tone)}.
THE HERO IS "${request.heroName}". Name ${request.heroName} in this chapter, spelled exactly like that. ${heroPronounRule(request)}${request.petName && request.petSpecies ? ` ${request.petName} is a ${request.petSpecies}; never describe ${request.petName} as another kind of animal.` : ''}${petRule(request) ? ` ${petRule(request)}` : ''}

CAST (keep names, looks and motivations exactly consistent; do not invent new named characters):
${cast}

PLOT: setting ${bible.plotDNA.setting}; problem ${bible.plotDNA.conflict}; key object ${bible.plotDNA.centralObject}; resolved through ${bible.plotDNA.resolution}.

STORY SO FAR:
${previous.length ? previous.map((p, i) => `Chapter ${i + 1}: ${p}`).join('\n') : '(this is the first chapter)'}

THIS CHAPTER: ${beat.summary}
Stage: ${beatStage(chapterIndex)}${biome ? ` Place: ${biome}.` : ''}
Characters present: ${beat.characters.join(', ')}.${lastChoice ? `\nThe child chose: "${lastChoice}". Honor it gently.` : ''}
${chapterIndex === 3 ? 'End with 4-second inhale / 4-second exhale breathing, sleepy yawns and a whispered goodnight to ' + request.heroName + '.' : 'Continue smoothly from the story so far.'}

RULES:
- About 120-170 words of calm, vivid, fresh prose (short enough for a sleepy child). Read-aloud rhythm.
- Always kid-appropriate and gentle. Nothing scary, dangerous or violent.
- Do NOT ask any questions. Tell the story as continuous narration.
- Never use pink or purple. Never use these stock phrases: ${BANNED_PHRASES.join('; ')}.
${issues.length ? `\nFIX THESE PROBLEMS FROM YOUR LAST ATTEMPT: ${issues.join(', ')}.\n` : ''}
Return ONLY raw JSON (no markdown):
{
  "title": "short chapter title",
  "chapterText": "the chapter",
  "summary": "one sentence recap with character names",
  "whisperLine": "a short comforting whisper",
  "sleepyCue": "a gentle relaxation cue",
  "moralReflection": "one sweet sentence",
  "sceneMood": "tranquil|mystical|gentle|deep_slumber",
  "weatherParticles": "fireflies|aurora_ribbons|starlight_snow",
  "keyProps": ["2-3 visible objects"]
}`;
}

export function validateWritten(text, { request, bible, chapterIndex }) {
  const issues = [...validateChapter(text, {
    heroNames: [request.heroName],
    avoidTopics: request.avoidTopics
  }).issues];
  if (PALETTE_RE.test(text)) issues.push('palette-pink-or-purple');
  const words = countWords(text);
  if (words < MIN_WORDS) issues.push('too-short');
  if (words > MAX_WORDS) issues.push('too-long');
  const lower = text.toLowerCase();
  for (const name of bible.beats[chapterIndex].characters) {
    if (name.toLowerCase() === request.heroName.toLowerCase()) continue;
    if (!lower.includes(name.toLowerCase())) issues.push(`missing-character:${name}`);
  }
  return issues;
}

function firstSentence(text, max = 200) {
  const s = String(text || '').split(/(?<=[.!])\s+/)[0] || '';
  return s.slice(0, max);
}

/**
 * Returns { ok: true, chapter, attempts } or { ok: false, issues, attempts }.
 * `generate(prompt, opts)` must resolve to model text.
 */
export async function writeChapter({ generate, request, bible, chapterIndex, previous = [], maxAttempts = 3 }) {
  let issues = [];
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    let parsed;
    try {
      const text = await generate(
        buildChapterPrompt({ request, bible, chapterIndex, previous, issues }),
        { json: true, temperature: 0.8, maxOutputTokens: 2500 }
      );
      parsed = parseJsonLoose(text);
    } catch (err) {
      console.warn(`Chapter ${chapterIndex + 1} generation error (attempt ${attempts}):`, err?.message || err);
      issues = ['generation-error'];
      continue;
    }
    const chapterText = parsed && typeof parsed.chapterText === 'string'
      ? parsed.chapterText.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim()
      : '';
    if (!chapterText) {
      issues = ['unparseable-output'];
      continue;
    }
    issues = validateWritten(chapterText, { request, bible, chapterIndex });
    const onlySoft = issues.length > 0 && issues.every(isSoftIssue);
    if (issues.length && !(onlySoft && attempts >= maxAttempts)) continue;
    issues = [];

    const noQ = (v, max, fallback) => (cleanField(v, max, { avoidTopics: request.avoidTopics }) || fallback).replace(/\?/g, '.');
    const props = (Array.isArray(parsed.keyProps) ? parsed.keyProps : [])
      .map(p => cleanField(p, 40)).filter(Boolean).slice(0, 3);
    return {
      ok: true,
      attempts,
      chapter: {
        title: noQ(parsed.title, 60, ''),
        chapterText,
        summary: noQ(parsed.summary, 220, firstSentence(chapterText)),
        whisperLine: noQ(parsed.whisperLine, 140, ''),
        sleepyCue: noQ(parsed.sleepyCue, 140, ''),
        moralReflection: noQ(parsed.moralReflection, 200, ''),
        sceneMood: ['tranquil', 'mystical', 'gentle', 'deep_slumber'].includes(parsed.sceneMood) ? parsed.sceneMood : '',
        weatherParticles: ['fireflies', 'aurora_ribbons', 'starlight_snow'].includes(parsed.weatherParticles) ? parsed.weatherParticles : '',
        keyProps: props
      }
    };
  }
  return { ok: false, issues, attempts };
}
