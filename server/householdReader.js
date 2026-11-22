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

export async function fetchHousehold(code, { config = readFirebaseConfig(), fetchImpl = globalThis.fetch } = {}) {
  const clean = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(clean)) throw new Error(`Invalid household code "${code}"`);
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${encodeURIComponent(config.databaseId)}/documents/households/${clean}${config.apiKey ? `?key=${config.apiKey}` : ''}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Firestore returned ${res.status} for household ${clean}`);
  return householdStateFromDoc(await res.json());
}


/** Household codes from HOUSEHOLD_CODES (or HOUSEHOLD_CODE), upper-cased. */
export function householdCodesFromEnv(env = process.env) {
  return String(env.HOUSEHOLD_CODES || env.HOUSEHOLD_CODE || '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z0-9_-]{4,32}$/.test(c));
}
