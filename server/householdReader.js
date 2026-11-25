// Reads a household's synced document from Firestore over the public REST API, the same
// read any family device makes with the household code (no service account needed).
// Used by the Pi's weekly report, the fridge display and the calendar prep job.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export function readFirebaseConfig(env = process.env) {
  let file = {};
  try {
    file = JSON.parse(readFileSync(path.join(here, '../firebase-applet-config.json'), 'utf8'));
  } catch {}
  return {
    projectId: env.VITE_FIREBASE_PROJECT_ID || file.projectId || 'little-heroes-quest-8842',
    apiKey: env.VITE_FIREBASE_API_KEY || file.apiKey || '',
    databaseId: file.firestoreDatabaseId || '(default)'
  };
}

/** Firestore REST Value -> plain JSON. */
export function decodeValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  return null;
}

export function decodeFields(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

/** The household document's fields in store shape (top-level fields win over stateSnapshot). */
export function householdStateFromDoc(doc) {
  const data = decodeFields(doc?.fields || {});
  const snap = data.stateSnapshot && typeof data.stateSnapshot === 'object' ? data.stateSnapshot : {};
  const state = { ...snap };
  for (const [k, v] of Object.entries(data)) {
    if (k === 'stateSnapshot') continue;
    if (Array.isArray(v) && v.length === 0 && Array.isArray(snap[k]) && snap[k].length) continue;
    state[k] = v;
  }
  return state;
}

export function mergeWalletSummaryIntoState(state, summaryData) {
  if (!state || !summaryData || !summaryData.heroes || typeof summaryData.heroes !== 'object') {
    return state;
  }
  const summaryHeroes = summaryData.heroes;
  const existingHeroes = Array.isArray(state.heroes) ? state.heroes : [];
  const byId = new Map(existingHeroes.filter((h) => h && h.id).map((h) => [h.id, { ...h }]));

  for (const [heroId, w] of Object.entries(summaryHeroes)) {
    if (!w || typeof w !== 'object') continue;
    const prev = byId.get(heroId) || { id: heroId, name: heroId };
    byId.set(heroId, {
      ...prev,
      points: Number(w.points ?? prev.points ?? 0),
      coins: Number(w.coins ?? prev.coins ?? 0),
      tokens: Number(w.coins ?? prev.coins ?? 0),
      xp: Number(w.xp ?? prev.xp ?? 0),
      level: Number(w.level ?? prev.level ?? 1),
      sparks: Number(w.sparks ?? prev.sparks ?? 0),
      evolutionSparks: Number(w.sparks ?? prev.sparks ?? 0),
      petSparkMap: w.petSparks && typeof w.petSparks === 'object' ? { ...w.petSparks } : (prev.petSparkMap || {})
    });
  }

  const mergedHeroes = Array.from(byId.values());
  const heroesMap = { ...(state.heroesMap || {}) };
  for (const h of mergedHeroes) {
    heroesMap[h.id] = h;
  }
  return {
    ...state,
    heroes: mergedHeroes,
    heroesMap
  };
}

export async function fetchHousehold(code, { config = readFirebaseConfig(), fetchImpl = globalThis.fetch } = {}) {
  const clean = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(clean)) throw new Error(`Invalid household code "${code}"`);
  const base = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${encodeURIComponent(config.databaseId)}/documents/households/${clean}`;
  const keyQ = config.apiKey ? `?key=${config.apiKey}` : '';
  const res = await fetchImpl(`${base}${keyQ}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Firestore returned ${res.status} for household ${clean}`);
  const state = householdStateFromDoc(await res.json());

  // Phase 4: In authoritative mode, read balances from public/walletSummary (falls back to legacy fields if absent)
  if (state.ledgerMode === 'authoritative') {
    try {
      const sumRes = await fetchImpl(`${base}/public/walletSummary${keyQ}`, { signal: AbortSignal.timeout(10000) });
      if (sumRes.ok) {
        const summaryData = decodeFields((await sumRes.json())?.fields || {});
        return mergeWalletSummaryIntoState(state, summaryData);
      }
    } catch {
      // Non-fatal fallback to household doc fields
    }
  }
  return state;
}


/** Household codes from HOUSEHOLD_CODES (or HOUSEHOLD_CODE), upper-cased. */
export function householdCodesFromEnv(env = process.env) {
  return String(env.HOUSEHOLD_CODES || env.HOUSEHOLD_CODE || '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z0-9_-]{4,32}$/.test(c));
}

/** Plain JSON -> Firestore REST Value (the reverse of decodeValue). */
export function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v) } };
  return { nullValue: null };
}

export function encodeFields(obj = {}) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = encodeValue(v);
  return out;
}

function householdDocUrl(code, config) {
  const clean = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(clean)) throw new Error(`Invalid household code "${code}"`);
  return `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${encodeURIComponent(config.databaseId)}/documents/households/${clean}`;
}

/**
 * Read-modify-write one field path of the household document, safely against other writers:
 * the write only lands if the document hasn't changed since it was read (Firestore's
 * currentDocument.updateTime precondition), else it re-reads and tries again.
 *
 * @param fieldPath  e.g. 'stateSnapshot.mealPlan' (each segment a plain identifier)
 * @param update     (currentValue, state) => newValue
 * @param extra      other top-level fields to set in the same write (e.g. lastWriterSessionId)
 */
export async function updateHouseholdField(code, fieldPath, update, { extra = {}, config = readFirebaseConfig(), fetchImpl = globalThis.fetch, attempts = 4 } = {}) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(fieldPath)) throw new Error('Invalid field path');
  const base = householdDocUrl(code, config);
  const key = config.apiKey ? `key=${encodeURIComponent(config.apiKey)}` : '';
  for (let i = 0; i < attempts; i++) {
    const res = await fetchImpl(`${base}${key ? `?${key}` : ''}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Firestore returned ${res.status} reading the household`);
    const doc = await res.json();
    const state = householdStateFromDoc(doc);
    const raw = decodeFields(doc.fields || {});
    const current = fieldPath.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), raw);
    const next = await update(current, state);
    // Build the nested document for the field path.
    const segs = fieldPath.split('.');
    const nested = segs.reduceRight((inner, seg) => ({ [seg]: inner }), next);
    const body = { fields: encodeFields({ ...nested, ...extra }) };
    const mask = [fieldPath, ...Object.keys(extra)].map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&');
    const pre = doc.updateTime ? `&currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}` : '';
    const put = await fetchImpl(`${base}?${mask}${pre}${key ? `&${key}` : ''}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    if (put.ok) return next;
    // 400 FAILED_PRECONDITION / 409 ABORTED: someone else wrote first. Read again.
    if (put.status === 400 || put.status === 409) {
      const text = await put.text().catch(() => '');
      if (/FAILED_PRECONDITION|ABORTED|precondition/i.test(text) || put.status === 409) continue;
      throw new Error(`Firestore rejected the update (${put.status})`);
    }
    throw new Error(`Firestore returned ${put.status} writing the household`);
  }
  throw new Error('The household kept changing; try again');
}
