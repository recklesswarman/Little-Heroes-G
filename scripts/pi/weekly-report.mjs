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
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildWeeklyReport, DEFAULT_TIME_ZONE } from '../../shared/familyInsights.js';
import { sendReportToNtfy } from '../../server/weeklyReportService.js';
import { getNtfyConfig } from '../../server/ntfyService.js';
import { fetchHousehold } from '../../server/householdReader.js';

// Kept here too so older imports keep working.
export { readFirebaseConfig, decodeValue, decodeFields, householdStateFromDoc, fetchHousehold } from '../../server/householdReader.js';

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
