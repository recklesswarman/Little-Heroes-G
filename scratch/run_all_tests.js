import { spawnSync } from 'child_process';
import path from 'path';

console.log('🚀 Running Full Little Hero Adventures Test Suite...\n');

const testFiles = [
  'scratch/verify_toothbrush_revamp.js',
  'scratch/verify_auth_household_restoration.js',
  'scratch/verify_realtime_sync_and_device_revocation.js',
  'scratch/verify_live_rex_companion.js',
  'scratch/verify_approval_sync_across_devices.js'
];

let allPassed = true;

for (const file of testFiles) {
  console.log(`\n▶️  Executing: ${file}`);
  const result = spawnSync('node', [file], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`❌ Test failed: ${file} (Exit code: ${result.status})`);
    allPassed = false;
    break;
  }
}

if (!allPassed) {
  console.error('\n❌ Test suite failed.');
  process.exit(1);
} else {
  console.log('\n🎉 ALL TEST SUITES PASSED SUCCESSFULLY!');
  process.exit(0);
}
