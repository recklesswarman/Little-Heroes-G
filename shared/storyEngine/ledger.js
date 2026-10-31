// Plot ledger: a compact "fingerprint" of every story a child has had, used to keep new plots from
// repeating old ones. Pure functions only (no DOM, no SDK), shared by the server, Cloud Functions
// and (in a later change) the client store that saves it.
//
// Everything that arrives from a client is untrusted: cleanLedgerDigest() / cleanRecurring() run
// every string through cleanField() before it can reach a prompt.

import { cleanField } from './safety.js';
import { slug } from './json.js';

/** Max fingerprints a child keeps (client store) and max the server accepts per request. */
export const LEDGER_MAX = 50;
export const DIGEST_MAX = 40;
export const FIELD_MAX = 40;

/** Fingerprint fields and how much each one says about "is this the same story". */
export const FP_FIELDS = ['setting', 'conflict', 'helper', 'twist', 'resolution', 'centralObject', 'arc'];
const WEIGHTS = {
  conflict: 0.45,
  twist: 0.20,
  resolution: 0.10,
  centralObject: 0.15,
  helper: 0.05,
  setting: 0.025,
  arc: 0.025
};

/** At or above this similarity a plot counts as a repeat. See verify_story_engine_ledger.mjs. */
export const REPEAT_THRESHOLD = 0.42;
/** Word overlap of the central problem at which two plots count as the same story. */
export const CONFLICT_REPEAT = 0.6;

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'that',
  'this', 'it', 'its', 'is', 'are', 'was', 'be', 'as', 'into', 'their', 'they', 'them', 'who', 'which',
  'one', 'all', 'up', 'out', 'over', 'very', 'little', 'small', 'big', 'new', 'old', 'kind', 'gentle',
  'soft', 'sleepy', 'warm', 'cozy', 'quiet'
]);

function stem(word) {
  let w = word;
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('es')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

export function tokenize(text) {
  const out = new Set();
  for (const raw of String(text || '').toLowerCase().split(/[^a-z]+/)) {
    if (raw.length < 3 || STOP_WORDS.has(raw)) continue;
    out.add(stem(raw));
  }
  return out;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/** 0..1, how much two fingerprints describe the same plot. Same archetypeId is always 1. */
export function plotSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a.archetypeId && a.archetypeId === b.archetypeId) return 1;
  let score = 0;
  for (const field of FP_FIELDS) {
    score += WEIGHTS[field] * jaccard(tokenize(a.fp?.[field]), tokenize(b.fp?.[field]));
  }
  // The central problem is the plot: if it is mostly the same words, it is the same story
  // even when the helper, object and ending were changed.
  if (jaccard(tokenize(a.fp?.conflict), tokenize(b.fp?.conflict)) >= CONFLICT_REPEAT) {
    score = Math.max(score, REPEAT_THRESHOLD);
  }
  return score;
}

/** Best (highest) similarity of `candidate` to anything in `ledger`, with the entry that caused it. */
export function closestMatch(candidate, ledger = []) {
  let best = { score: 0, entry: null };
  for (const entry of ledger) {
    const score = plotSimilarity(candidate, entry);
    if (score > best.score) best = { score, entry };
  }
  return best;
}

export function findNearDuplicate(candidate, ledger = [], threshold = REPEAT_THRESHOLD) {
  const best = closestMatch(candidate, ledger);
  return best.score >= threshold ? best : null;
}

const trim = (value, max = FIELD_MAX) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max).trim();

/**
 * Compact record of one story. `meta` supplies what the bible doesn't hold:
 * { id, title, moralId, realmId, t }.
 */
export function fingerprintFromBible(bible, meta = {}) {
  const dna = bible?.plotDNA || {};
  const fp = {};
  for (const field of FP_FIELDS) fp[field] = trim(dna[field]);
  const title = trim(meta.title || bible?.title, 60);
  return {
    id: trim(meta.id, 60) || `fp_${slug(`${title}-${fp.conflict}`, 40)}`,
    t: Number(meta.t) || 0,
    title,
    archetypeId: trim(bible?.archetypeId, 60),
    moralId: trim(meta.moralId, 40),
    realmId: trim(meta.realmId, 40),
    fp,
    characters: (Array.isArray(bible?.characters) ? bible.characters : [])
      .map(c => trim(c?.name, 24)).filter(Boolean).slice(0, 5)
  };
}

/** Untrusted client ledger -> safe, bounded list of fingerprints. */
export function cleanLedgerDigest(untrusted) {
  if (!Array.isArray(untrusted)) return [];
  const out = [];
  for (const raw of untrusted.slice(0, DIGEST_MAX)) {
    if (!raw || typeof raw !== 'object') continue;
    const fp = {};
    let anyField = false;
    for (const field of FP_FIELDS) {
      fp[field] = cleanField(raw.fp?.[field], FIELD_MAX);
      if (fp[field]) anyField = true;
    }
    const title = cleanField(raw.title, 60);
    const archetypeId = cleanField(raw.archetypeId, 60);
    if (!anyField && !title) continue;
    out.push({
      id: cleanField(raw.id, 60) || `d${out.length}`,
      t: Number(raw.t) || 0,
      title,
      archetypeId,
      moralId: cleanField(raw.moralId, 40),
      realmId: cleanField(raw.realmId, 40),
      fp,
      characters: (Array.isArray(raw.characters) ? raw.characters : [])
        .map(n => cleanField(n, 24)).filter(Boolean).slice(0, 5)
    });
  }
  return out;
}

/** Untrusted "friends the child has met" -> at most 3 safe {name, role, trait} entries. */
export function cleanRecurring(untrusted) {
  if (!Array.isArray(untrusted)) return [];
  const out = [];
  for (const raw of untrusted) {
    if (out.length >= 3) break;
    if (!raw || typeof raw !== 'object') continue;
    const name = cleanField(raw.name, 24);
    if (!name || out.some(c => c.name.toLowerCase() === name.toLowerCase())) continue;
    out.push({ name, role: cleanField(raw.role, 24), trait: cleanField(raw.trait, 24) });
  }
  return out;
}

/** Newest-first list of "problem / twist / object" lines the planner must not reuse. */
export function buildAvoidList(ledger = [], limit = 8) {
  const seen = new Set();
  const lines = [];
  const newestFirst = [...ledger].sort((a, b) => (b.t || 0) - (a.t || 0));
  for (const entry of newestFirst) {
    const line = [entry.fp?.conflict, entry.fp?.twist, entry.fp?.centralObject].filter(Boolean).join(' / ');
    if (!line || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
    if (lines.length >= limit) break;
  }
  return lines;
}

// Small kid-safe banks for the offline planner. 8 x 8 x 8 x 8 distinct plots.
const BANKS = {
  conflict: [
    'a sleepy star that cannot find its glow',
    'a lost lullaby that drifted away',
    'a bridge that is too shy to appear',
    'a tiny cloud that wants to learn to float',
    'a garden of flowers that will not close for the night',
    'a music box that forgot its last note',
    'a friendly echo that keeps getting lost',
    'a moonbeam stuck behind a pile of cushions'
  ],
  helper: [
    'a patient old tortoise', 'a chatty firefly', 'a gentle breeze', 'a drowsy owl',
    'a snow hare', 'a humming moth', 'a tidy beetle', 'a wise little comet'
  ],
  twist: [
    'the problem solves itself when everyone yawns',
    'the lost thing was hiding in plain sight',
    'sharing a song fixes everything',
    'the shy helper becomes the hero',
    'a small kindness grows big',
    'slowing down reveals the answer',
    'the noise was a lullaby all along',
    'a nap is the missing piece'
  ],
  centralObject: [
    'a silver thimble lantern', 'a patchwork blanket', 'a glass music box', 'a feather pillow',
    'a brass key', 'a woven basket', 'a paper boat', 'a tiny bell'
  ]
};

/**
 * Offline plot: from the banks, the combination least like anything in `ledger`.
 * `seed` makes the choice deterministic for tests; `setting` is the realm name.
 */
export function pickUnusedCombo(ledger = [], seed = 0, setting = 'a moonlit place') {
  let best = null;
  const n = BANKS.conflict.length;
  const tries = 24;
  for (let i = 0; i < tries; i++) {
    const k = Math.abs((Number(seed) || 0) + i * 7) % (n * n * n * n);
    const pick = (bankName, shift) => BANKS[bankName][Math.floor(k / shift) % n];
    const fp = {
      setting: trim(setting),
      conflict: pick('conflict', 1),
      helper: pick('helper', n),
      twist: pick('twist', n * n),
      resolution: 'teamwork and patience',
      centralObject: pick('centralObject', n * n * n),
      arc: 'from worry to sleep'
    };
    const score = closestMatch({ fp }, ledger).score;
    if (!best || score < best.score) best = { fp, score };
    if (score === 0) break;
  }
  return best.fp;
}
