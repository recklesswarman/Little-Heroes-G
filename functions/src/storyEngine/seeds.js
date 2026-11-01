// Research seeds: short, abstract story sparks the planner may use or skip. Pure functions.
//
// A seed is {id, kind, season, text, source, inspiredBy?}. Only `text` ever reaches the model.
// `inspiredBy` (for example a show a pattern echoes) is audit metadata and is never sent anywhere.
// Seeds come from a reviewed pool (seedPool.js); cleanSeed() re-checks every one on load, because
// the pool is data that a refresh job edits.

import { cleanField } from './safety.js';
import { tokenize } from './ledger.js';
import { SEED_POOL } from './seedPool.js';

export const SEED_KINDS = ['nature', 'folk', 'seasonal', 'shape'];
export const SEASONS = ['winter', 'spring', 'summer', 'autumn', 'any'];
export const SEED_TEXT_MAX = 120;
export const SEEDS_PER_STORY = 3;
const SIMILAR = 0.5;

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Validate one seed. Returns a normalized seed or null. A seed must be one plain sentence with no
 * links, quotes, digits or proper nouns (names and brands), and must pass the story blocklist.
 */
export function cleanSeed(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = clean(raw.id, 20).replace(/[^a-z0-9_-]/gi, '');
  const kind = SEED_KINDS.includes(raw.kind) ? raw.kind : '';
  if (!id || !kind) return null;
  if (typeof raw.text !== 'string' || raw.text.length > SEED_TEXT_MAX) return null;
  const text = cleanField(raw.text, SEED_TEXT_MAX);
  if (!text || text !== clean(raw.text, SEED_TEXT_MAX)) return null;
  if (/https?:|www\.|@|["“”]|\d/i.test(text)) return null;
  // Everything after the first word must be lowercase: this keeps names, places and brands out.
  const words = text.split(/\s+/);
  if (words.slice(1).some(w => /^[A-Z]/.test(w.replace(/^[^A-Za-z]+/, '')))) return null;
  if ((text.match(/[.!?]/g) || []).length > 1) return null;
  return {
    id,
    kind,
    season: SEASONS.includes(raw.season) ? raw.season : 'any',
    text,
    source: clean(raw.source, 30) || 'unknown',
    ...(raw.inspiredBy ? { inspiredBy: clean(raw.inspiredBy, 40) } : {})
  };
}

/** Validate a whole pool; invalid or duplicate-id seeds are dropped. */
export function cleanPool(pool) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(pool) ? pool : []) {
    const seed = cleanSeed(raw);
    if (!seed || seen.has(seed.id)) continue;
    seen.add(seed.id);
    out.push(seed);
  }
  return out;
}

export const CLEAN_SEED_POOL = cleanPool(SEED_POOL);

export function seasonOf(date = new Date()) {
  const m = (date instanceof Date ? date : new Date(date)).getUTCMonth();
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

// Small deterministic generator, so one request always gets the same picks.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Pick up to `n` seeds. In-season seeds are preferred, kinds are mixed (at most one per kind
 * first), and seeds that resemble a plot this child already had are skipped.
 * `key` makes the choice deterministic per request (different children / nights differ).
 */
export function pickSeeds(pool = CLEAN_SEED_POOL, { ledger = [], date = new Date(), key = '', n = SEEDS_PER_STORY, kinds = SEED_KINDS } = {}) {
  const want = Math.max(0, Math.min(SEEDS_PER_STORY, Math.floor(n) || 0));
  if (!want) return [];
  const season = seasonOf(date);
  const used = (Array.isArray(ledger) ? ledger : []).map(e =>
    tokenize([e?.fp?.conflict, e?.fp?.twist, e?.fp?.centralObject, e?.title].filter(Boolean).join(' ')));
  const usable = cleanPool(pool).filter(seed =>
    kinds.includes(seed.kind) && (seed.season === 'any' || seed.season === season) &&
    !used.some(u => jaccard(tokenize(seed.text), u) >= SIMILAR));

  const rand = mulberry(hashString(`${key}|${date instanceof Date ? date.toISOString().slice(0, 10) : date}`));
  const shuffled = [...usable].sort(() => rand() - 0.5);
  // In-season seeds first, then the rest; one per kind before repeating a kind.
  shuffled.sort((a, b) => (b.season === season) - (a.season === season));
  const picked = [];
  const kindsSeen = new Set();
  for (const seed of shuffled) {
    if (picked.length >= want) break;
    if (kindsSeen.has(seed.kind)) continue;
    kindsSeen.add(seed.kind);
    picked.push(seed);
  }
  for (const seed of shuffled) {
    if (picked.length >= want) break;
    if (!picked.includes(seed)) picked.push(seed);
  }
  return picked;
}
