// Plot ledger: a compact "fingerprint" of every story a child has had, used to keep new plots from
// repeating old ones. Pure functions only (no DOM, no SDK), shared by the server, Cloud Functions
// and (in a later change) the client store that saves it.
//
// Everything that arrives from a client is untrusted: cleanLedgerDigest() / cleanRecurring() run
// every string through cleanField() before it can reach a prompt.

import { cleanField } from './safety.js';
import { slug } from './json.js';

/**
 * Max fingerprints a child keeps (client store) and max the server accepts per request. 30 is all a
 * request ever carries; more would only cost space in the single 1 MiB Firestore household document
 * (each child is stored about 5 times in it).
 */
export const LEDGER_MAX = 30;
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
/**
 * Controlled vocabulary: the planner labels each story's central problem and twist with one value
 * from these lists. Word overlap cannot see that "a porch lamp stuck on" and "a comet nursery that
 * is too bright" are the same story; two matching labels can.
 */
export const PROBLEM_TYPES = [
  'too-bright-or-loud', 'lost-thing', 'shy-or-lonely-friend', 'cannot-sleep-creature',
  'broken-or-stuck-thing', 'weather-or-sky-puzzle', 'journey-or-way-home', 'missing-sound-or-song',
  'garden-or-growing-thing', 'big-feeling-to-share', 'tidy-up-or-prepare', 'wonder-question'
];
export const TWIST_TYPES = [
  'fear-was-friend', 'solves-itself-by-resting', 'small-kindness-grows', 'shy-one-becomes-hero',
  'hidden-in-plain-sight', 'sharing-fixes-it', 'slowing-down-reveals', 'swap-roles',
  'pattern-repeats', 'helper-was-the-solution'
];
export const cleanProblemType = (v) => (PROBLEM_TYPES.includes(v) ? v : '');
export const cleanTwistType = (v) => (TWIST_TYPES.includes(v) ? v : '');

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
  // Same kind of problem solved by the same kind of twist is the same story, whatever the nouns.
  if (a.pt && a.pt === b.pt && a.tt && a.tt === b.tt) {
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
    pt: cleanProblemType(bible?.plotDNA?.problemType),
    tt: cleanTwistType(bible?.plotDNA?.twistType),
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
      pt: cleanProblemType(raw.pt),
      tt: cleanTwistType(raw.tt),
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

/** Newest-first distinct problem/twist labels the child has recently had. */
export function buildRecentTypes(ledger = [], limit = 6) {
  const newestFirst = [...ledger].sort((a, b) => (b.t || 0) - (a.t || 0));
  const uniq = (key) => [...new Set(newestFirst.map(e => e[key]).filter(Boolean))].slice(0, limit);
  return { problemTypes: uniq('pt'), twistTypes: uniq('tt') };
}

// Small kid-safe banks for the offline planner. 8 x 8 x 8 x 8 distinct plots, with theme labels.
const BANKS = {
  conflict: [
    ['a sleepy star that cannot find its glow', 'lost-thing'],
    ['a lost lullaby that drifted away', 'missing-sound-or-song'],
    ['a bridge that is too shy to appear', 'shy-or-lonely-friend'],
    ['a tiny cloud that wants to learn to float', 'weather-or-sky-puzzle'],
    ['a garden of flowers that will not close for the night', 'garden-or-growing-thing'],
    ['a music box that forgot its last note', 'broken-or-stuck-thing'],
    ['a friendly echo that keeps getting lost', 'journey-or-way-home'],
    ['a moonbeam stuck behind a pile of cushions', 'tidy-up-or-prepare']
  ],
  helper: [
    'a patient old tortoise', 'a chatty firefly', 'a gentle breeze', 'a drowsy owl',
    'a snow hare', 'a humming moth', 'a tidy beetle', 'a wise little comet'
  ],
  twist: [
    ['the problem solves itself when everyone yawns', 'solves-itself-by-resting'],
    ['the lost thing was hiding in plain sight', 'hidden-in-plain-sight'],
    ['sharing a song fixes everything', 'sharing-fixes-it'],
    ['the shy helper becomes the hero', 'shy-one-becomes-hero'],
    ['a small kindness grows big', 'small-kindness-grows'],
    ['slowing down reveals the answer', 'slowing-down-reveals'],
    ['the noise was a lullaby all along', 'fear-was-friend'],
    ['a nap is the missing piece', 'helper-was-the-solution']
  ],
  centralObject: [
    'a silver thimble lantern', 'a patchwork blanket', 'a glass music box', 'a feather pillow',
    'a brass key', 'a woven basket', 'a paper boat', 'a tiny bell'
  ]
};

/**
 * Offline plot: from the banks, the combination least like anything in `ledger`.
 * `seed` makes the choice deterministic for tests; `setting` is the realm name.
 * Returns the plotDNA fields plus problemType/twistType labels.
 */
export function pickUnusedCombo(ledger = [], seed = 0, setting = 'a moonlit place') {
  const n = BANKS.conflict.length;
  const base = Math.abs(Number(seed) || 0);
  // The seed picks where the scan starts (its first candidate is the same one a given seed always chose).
  const c0 = base % n;
  const h0 = Math.floor(base / n) % n;
  const t0 = Math.floor(base / (n * n)) % n;
  const o0 = Math.floor(base / (n * n * n)) % n;
  let best = null;
  // Look at every conflict x twist pair (64), not a handful of probes: a few random probes can all land on
  // plots already told, even when an unused one exists. The scan is exhaustive, so while any plot is
  // unused the least similar one is found; it stops early on a perfect (zero) match.
  for (let c = 0; c < n; c++) {
    for (let w = 0; w < n; w++) {
      const [conflict, problemType] = BANKS.conflict[(c0 + c) % n];
      const [twist, twistType] = BANKS.twist[(t0 + w) % n];
      const combo = {
        setting: trim(setting),
        conflict,
        helper: BANKS.helper[(h0 + c + w) % n],
        twist,
        resolution: 'teamwork and patience',
        centralObject: BANKS.centralObject[(o0 + c + 2 * w) % n],
        arc: 'from worry to sleep',
        problemType,
        twistType
      };
      const score = closestMatch({ fp: combo, pt: problemType, tt: twistType }, ledger).score;
      if (!best || score < best.score) best = { combo, score };
      if (score === 0) return best.combo;
    }
  }
  return best.combo;
}
