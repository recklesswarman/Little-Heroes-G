// Deterministic kid-safety layer for the story engine (pure ESM, no DOM).
// Layer 1 (lexicon/blocklist) and the hero-name consistency check live here;
// the LLM judge is added in a later phase.

const MAX_WISH_LENGTH = 90;

const INJECTION_PATTERNS = [
  /ignore (all |any |the )?(previous|prior|above) (instructions|rules|prompts?)/i,
  /disregard (all |any |the )?(previous|prior|above)/i,
  /system prompt/i,
  /you are now/i,
  /\bjailbreak\b/i,
  /<\s*\/?\s*(script|iframe|img|svg|style|link)/i,
  /\bjavascript\s*:/i,
  /[{}`]|\$\{/
];

// Words that must never appear in a story for ages 3-8. Whole-word, case-insensitive.
const BLOCKED_TERMS = [
  'kill', 'killed', 'killing', 'murder', 'dead', 'death', 'die', 'died', 'dying',
  'blood', 'bloody', 'gun', 'guns', 'knife', 'knives', 'stab', 'shoot', 'shot',
  'weapon', 'bomb', 'war', 'gore', 'corpse', 'ghost', 'zombie', 'demon', 'devil',
  'hell', 'damn', 'hate', 'stupid', 'idiot', 'shut up', 'drug', 'drugs', 'alcohol',
  'beer', 'wine', 'cigarette', 'suicide', 'abuse', 'kidnap', 'kidnapped', 'torture',
  'nightmare', 'monster', 'spooky', 'creepy', 'terrifying', 'horror'
];

const BLOCKED_RE = new RegExp(`\\b(${BLOCKED_TERMS.map(t => t.replace(/\s+/g, '\\s+')).join('|')})\\b`, 'i');

/**
 * Clean a parent/child supplied "wish" so it is safe to use as a soft story suggestion.
 * Returns '' when the text is unusable (the story simply proceeds without it).
 */
export function sanitizeWish(raw, { avoidTopics = [] } = {}) {
  if (typeof raw !== 'string') return '';
  let text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (INJECTION_PATTERNS.some(re => re.test(text))) return '';
  text = text.slice(0, MAX_WISH_LENGTH).trim();
  if (BLOCKED_RE.test(text)) return '';
  if (matchesAvoidTopic(text, avoidTopics)) return '';
  return text;
}

/**
 * Clean a person/pet name. Unlike cleanField this never applies the story blocklist: the hero's
 * name must always survive. It only strips characters that could break prompts or markup.
 */
export function cleanName(raw, fallback = 'Little Hero', max = 30) {
  if (typeof raw !== 'string') return fallback;
  const name = raw.replace(/[^\p{L}\p{N} '’.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return name || fallback;
}

/**
 * Clean one short free-text field (a bible/character/beat string that came from an LLM or a client).
 * Returns '' when unusable; callers substitute a safe default.
 */
export function cleanField(raw, max = 120, { avoidTopics = [] } = {}) {
  if (typeof raw !== 'string') return '';
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
  if (!text) return '';
  if (INJECTION_PATTERNS.some(re => re.test(text))) return '';
  if (BLOCKED_RE.test(text)) return '';
  if (matchesAvoidTopic(text, avoidTopics)) return '';
  return text;
}

export function matchesAvoidTopic(text, avoidTopics = []) {
  const haystack = String(text || '').toLowerCase();
  return avoidTopics.some(topic => {
    const t = String(topic || '').trim().toLowerCase();
    return t.length > 1 && haystack.includes(t);
  });
}

/** Layer 1: lexicon + parent avoid-topics + "no questions" bedtime rule. */
export function checkChapterSafety(text, { avoidTopics = [], allowQuestions = false } = {}) {
  const issues = [];
  const body = String(text || '');
  const hit = body.match(BLOCKED_RE);
  if (hit) issues.push(`blocked-term:${hit[1].toLowerCase()}`);
  if (matchesAvoidTopic(body, avoidTopics)) issues.push('avoid-topic');
  // A character may ask something inside quotes; the narration must not ask the child anything.
  const narration = body.replace(/["\u201c][^"\u201d]*["\u201d]/g, ' ');
  if (!allowQuestions && /\?/.test(narration)) issues.push('question-mark');
  return { ok: issues.length === 0, issues };
}

/** Hard requirement: the hero's name appears in the chapter (word-boundary, case-insensitive). */
export function chapterMentionsHero(text, heroNames) {
  const names = (Array.isArray(heroNames) ? heroNames : [heroNames]).filter(Boolean);
  if (!names.length) return true;
  return names.every(name => {
    const escaped = String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(String(text || ''));
  });
}

/** Combined check used by the engine before a chapter is accepted. */
export function validateChapter(text, { heroNames, avoidTopics = [] } = {}) {
  const safety = checkChapterSafety(text, { avoidTopics });
  const issues = [...safety.issues];
  if (!chapterMentionsHero(text, heroNames)) issues.push('missing-hero-name');
  return { ok: issues.length === 0, issues };
}
