#!/usr/bin/env node
// Sunday parent report, run on the Pi by little-heroes-weekly-report.timer (Sundays 6 PM).
//
// Reads each household's synced document from Firestore over the public REST API (the same
// read any family device does with the household code; no service account needed), builds
// the report with shared/familyInsights.js, and publishes it to the family ntfy topic.
//
//   HOUSEHOLD_CODES  comma-separated household sync codes (required; HOUSEHOLD_CODE also works)
//   NTFY_URL / NTFY_TOPIC / NTFY_TOKEN   same as server.js (defaults: local ntfy, little-heroes)
//   REPORT_TIME_ZONE default America/New_York
//
// Usage: node scripts/pi/weekly-report.mjs [--dry-run]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildWeeklyReport, DEFAULT_TIME_ZONE } from '../../shared/familyInsights.js';
import { sendReportToNtfy } from '../../server/weeklyReportService.js';
import { getNtfyConfig } from '../../server/ntfyService.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function readFirebaseConfig(env = process.env) {
  let file = {};
  try {
    file = JSON.parse(readFileSync(path.join(here, '../../firebase-applet-config.json'), 'utf8'));
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

export async function runWeeklyReport({ env = process.env, dryRun = false, fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  const codes = String(env.HOUSEHOLD_CODES || env.HOUSEHOLD_CODE || '').split(',').map((c) => c.trim()).filter(Boolean);
  if (!codes.length) throw new Error('Set HOUSEHOLD_CODES in ~/apps/little-heroes.env (the sync code shown in the Parent Portal).');
  const timeZone = env.REPORT_TIME_ZONE || DEFAULT_TIME_ZONE;
  const results = [];
  for (const code of codes) {
    const state = await fetchHousehold(code, { fetchImpl });
    const report = buildWeeklyReport(state, { now, timeZone });
    if (codes.length > 1 && state.householdName) report.title = `${report.title} - ${String(state.householdName).slice(0, 40)}`;
    if (dryRun) {
      console.log(`${report.title}\n\n${report.message}\n`);
      results.push({ code, sent: false, dryRun: true });
      continue;
    }
    const sent = await sendReportToNtfy(report, { config: getNtfyConfig(env), fetchImpl });
    results.push({ code, ...sent });
    console.log(`Weekly report for ${code}: ${sent.sent ? 'sent' : `not sent (${sent.reason || sent.status})`}`);
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runWeeklyReport({ dryRun: process.argv.includes('--dry-run') })
    .then((results) => process.exit(results.every((r) => r.sent || r.dryRun) ? 0 : 1))
    .catch((err) => {
      console.error(err.message || err);
      process.exit(1);
    });
}
