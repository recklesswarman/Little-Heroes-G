/**
 * scratch/run_overhaul_e2e.mjs
 *
 * Unified runner for the Little Hero Adventures Overhaul E2E Suites.
 * Mirrors scratch/run_all_tests.js spawnSync execution & exit-code contract.
 *
 * Flags:
 *   --layer-a   Run Tier 1, Tier 2, and Tier 3 only (default when --cdp omitted)
 *   --cdp       Include Tier 4 Real-Browser CDP suite (or set RUN_CDP=true)
 *   --cdp-only  Run Tier 4 CDP suite only
 */

import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const layerAOnly = args.has('--layer-a');
const cdpOnly = args.has('--cdp-only');
const runCdp = args.has('--cdp') || cdpOnly || process.env.RUN_CDP === 'true';

if (layerAOnly && (args.has('--cdp') || cdpOnly)) {
  console.error('❌ Conflicting flags: --layer-a cannot be combined with --cdp or --cdp-only.');
  process.exit(1);
}

const suites = [];
if (!cdpOnly) {
  suites.push(
    'scratch/e2e_overhaul_tier1.mjs',
    'scratch/e2e_overhaul_tier2.mjs',
    'scratch/e2e_overhaul_tier3.mjs'
  );
}
if (runCdp && !layerAOnly) {
  suites.push('scratch/e2e_overhaul_tier4_cdp.mjs');
}

if (suites.length === 0) {
  console.error('❌ No E2E suites selected to run.');
  process.exit(1);
}

console.log('🚀 Running Little Hero Adventures Overhaul E2E Suite...\n');

const results = [];
let allPassed = true;

for (const file of suites) {
  console.log(`\n▶️  Executing: ${file}`);
  const suiteTimeoutMs = file.includes('tier4_cdp') ? 360000 : 180000;
  const result = spawnSync('node', [file], { stdio: 'inherit', timeout: suiteTimeoutMs });

  if (result.error && result.error.code === 'ETIMEDOUT') {
    console.error(`❌ Suite timed out after ${Math.round(suiteTimeoutMs / 1000)}s: ${file}`);
    results.push({ file, ok: false, status: 'TIMEOUT' });
    allPassed = false;
    continue;
  }

  const ok = result.status === 0;
  results.push({ file, ok, status: result.status });
  if (!ok) {
    console.error(`❌ Suite failed: ${file} (Exit code: ${result.status})`);
    allPassed = false;
  }
}

console.log('\n============================================================');
console.log('Overhaul E2E Suite Summary:');
for (const r of results) {
  console.log(`  ${r.ok ? '✅ PASS' : '❌ FAIL'}  ${r.file} (status=${r.status})`);
}
console.log('============================================================\n');

if (!allPassed) {
  console.log('❌ Overhaul E2E suite failed.');
  process.exit(1);
}

console.log('🎉 ALL OVERHAUL E2E SUITES PASSED SUCCESSFULLY!');
process.exit(0);
