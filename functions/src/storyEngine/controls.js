// Parent story controls: the settings a parent can change for story generation, plus the safety
// log. Pure functions over plain objects (client store, cloud merge, server and tests share them).
// Everything coming from storage or the cloud is untrusted and is coerced into a valid, bounded shape.
//
// Per child (storyProfile): reading level, tone, the child's pronouns, the pet's pronouns.
// Household (storyControls): topics to avoid, research on/off, the parent's own story ideas.
// Household (safety log): what the story filters did, never the rejected text itself.

import { TONES } from './bible.js';
import { cleanSeed } from './seeds.js';

export const AGE_BANDS = ['3-4', '5-6', '7-8'];
export const PRONOUN_CHOICES = ['they', 'she', 'he'];
export const PET_PRONOUN_CHOICES = ['they', 'it', 'she', 'he'];
export const AVOID_MAX = 20;
export const IDEAS_MAX = 10;
export const SAFETY_LOG_MAX = 30;
export const SAFETY_KINDS = ['wish-blocked', 'chapter-fallback', 'plan-fallback'];

const pick = (value, list, fallback) => (list.includes(value) ? value : fallback);
const squash = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max).trim();

export function defaultStoryProfile() {
  return { ageBand: '5-6', tone: 'calm', pronouns: 'they', petPronouns: 'they' };
}

export function normalizeStoryProfile(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const d = defaultStoryProfile();
  return {
    ageBand: pick(src.ageBand, AGE_BANDS, d.ageBand),
    tone: pick(src.tone, TONES, d.tone),
    pronouns: pick(src.pronouns, PRONOUN_CHOICES, d.pronouns),
    petPronouns: pick(src.petPronouns, PET_PRONOUN_CHOICES, d.petPronouns)
  };
}

/** One avoid-topic: short letters/numbers/spaces, lowercase. '' when unusable. */
export function cleanTopic(raw) {
  if (typeof raw !== 'string') return '';
  const t = raw.replace(/[^\p{L}\p{N} '’-]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 30).trim();
  return t.length >= 2 ? t : '';
}

/**
 * Turn what a parent typed into a story spark: one gentle sentence, sentence case. Names and
 * brands cannot be told apart from other words, so everything after the first word is lowercased
 * (a parent can still describe "a dragon who collects lullabies"). Returns {ok, text, reason}.
 */
export function checkParentIdea(raw) {
  const typed = squash(typeof raw === 'string' ? raw : '', 200);
  if (!typed) return { ok: false, text: '', reason: 'Type an idea first.' };
  const base = typed.replace(/[.!?\s]+$/, '');
  const text = `${base.charAt(0).toUpperCase()}${base.slice(1).toLowerCase()}.`;
  const seed = cleanSeed({ id: 'p0', kind: 'shape', season: 'any', text, source: 'parent' });
  if (!seed) {
    return { ok: false, text, reason: 'Keep it to one short, gentle sentence (up to 120 characters) with no numbers, links, quotes or scary words.' };
  }
  return { ok: true, text: seed.text, reason: '' };
}

export function defaultStoryControls() {
  return { avoidTopics: [], researchEnabled: true, parentIdeas: [] };
}

export function normalizeStoryControls(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const topics = [];
  for (const t of Array.isArray(src.avoidTopics) ? src.avoidTopics : []) {
    const c = cleanTopic(t);
    if (c && !topics.includes(c)) topics.push(c);
    if (topics.length >= AVOID_MAX) break;
  }
  const ideas = [];
  for (const i of Array.isArray(src.parentIdeas) ? src.parentIdeas : []) {
    const r = checkParentIdea(typeof i === 'string' ? i : '');
    if (r.ok && !ideas.includes(r.text)) ideas.push(r.text);
    if (ideas.length >= IDEAS_MAX) break;
  }
  return { avoidTopics: topics, researchEnabled: src.researchEnabled !== false, parentIdeas: ideas };
}

/** The request fields a child's story needs from their profile and the household controls. */
export function requestFromControls(profile, controls) {
  const p = normalizeStoryProfile(profile);
  const c = normalizeStoryControls(controls);
  return {
    ageBand: p.ageBand,
    tone: p.tone,
    pronouns: p.pronouns,
    petPronouns: p.petPronouns,
    avoidTopics: c.avoidTopics,
    researchEnabled: c.researchEnabled,
    parentIdeas: c.parentIdeas
  };
}

/** Fixed reason codes only (never free text from a rejected story). */
export function cleanReason(raw) {
  const code = String(raw ?? '').split(':')[0].toLowerCase().replace(/[^a-z-]/g, '').slice(0, 40);
  return code || 'unspecified';
}

function cleanEvent(raw) {
  if (!raw || typeof raw !== 'object' || !SAFETY_KINDS.includes(raw.kind)) return null;
  return {
    t: Number(raw.t) || 0,
    kind: raw.kind,
    heroId: squash(raw.heroId, 60),
    reason: cleanReason(raw.reason)
  };
}

export function normalizeSafetyLog(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map(cleanEvent).filter(Boolean)
    .sort((a, b) => b.t - a.t)
    .slice(0, SAFETY_LOG_MAX);
}

/** Add an event (newest first, capped). The same event for the same child within a minute is dropped. */
export function appendSafetyEvent(log, event, { now = Date.now() } = {}) {
  const base = normalizeSafetyLog(log);
  const e = cleanEvent({ ...event, t: now });
  if (!e) return base;
  const dupe = base.find(x => x.kind === e.kind && x.heroId === e.heroId && x.reason === e.reason && e.t - x.t < 60_000);
  return dupe ? base : normalizeSafetyLog([e, ...base]);
}

/** Union of two logs (two devices), newest first, capped. */
export function mergeSafetyLogs(a, b) {
  const seen = new Set();
  const out = [];
  for (const e of normalizeSafetyLog([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])) {
    const key = `${e.t}|${e.kind}|${e.heroId}|${e.reason}`;
    if (!seen.has(key)) { seen.add(key); out.push(e); }
  }
  return out.slice(0, SAFETY_LOG_MAX);
}
