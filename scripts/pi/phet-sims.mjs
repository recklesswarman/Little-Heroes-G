#!/usr/bin/env node
// Downloads the Math Lab's PhET sims (shared/phetSims.js) to PHET_DIR (default ~/apps/phet) so the
// Pi serves them at /phet/ without the internet (server/phetService.js). Run once by
// install-extras.sh; run again any time to update them. PhET sims are free under CC BY 4.0.
//
// Usage: node scripts/pi/phet-sims.mjs [--force]
import { mkdirSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import path from 'node:path';
import { PHET_SIMS, phetFileName, phetOnlineUrl } from '../../shared/phetSims.js';
import { phetDir } from '../../server/phetService.js';

const force = process.argv.includes('--force');
const dir = phetDir();
mkdirSync(dir, { recursive: true });
let failed = 0;
for (const sim of PHET_SIMS) {
  const file = path.join(dir, phetFileName(sim.id));
  if (existsSync(file) && !force) { console.log(`have ${sim.id}`); continue; }
  try {
    const res = await fetch(phetOnlineUrl(sim.id), { signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (html.length < 10000 || !/<html/i.test(html)) throw new Error('not a sim page');
    writeFileSync(`${file}.tmp`, html);
    renameSync(`${file}.tmp`, file);
    console.log(`saved ${sim.id} (${Math.round(html.length / 1024)} KB)`);
  } catch (err) {
    failed++;
    console.warn(`could not get ${sim.id}: ${err.message}`);
  }
}
process.exit(failed === PHET_SIMS.length ? 1 : 0);
