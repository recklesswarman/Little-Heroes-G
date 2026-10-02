import { spawnSync } from 'child_process';
import path from 'path';

console.log('🚀 Running Full Little Hero Adventures Test Suite...\n');

const testFiles = [
  'scratch/verify_toothbrush_revamp.js',
  'scratch/verify_battle_duration_and_hygiene_reminders.js',
  'scratch/verify_waypoint_breadcrumb_cleared_on_abandon.js',
  'scratch/verify_multi_kid_hygiene_isolation.js',
  'scratch/verify_auth_household_restoration.js',
  'scratch/verify_realtime_sync_and_device_revocation.js',
  'scratch/verify_live_rex_companion.js',
  'scratch/verify_approval_sync_across_devices.js',
  'scratch/verify_two_kids_same_task.mjs',
  'scratch/verify_pending_approval_repair_push.mjs',
  'scratch/verify_pet_stats_isolated_per_kid.mjs',
  'scratch/test_world_adventure_map.cjs',
  'scratch/test_bedtime_storybook.cjs',
  'scratch/test_user_reported_fixes.cjs',
  'scratch/test_bedtime_sanctuary.cjs',
  'scratch/test_mobile_and_avatar_fix.cjs',
  'scratch/test_firebase_storage.cjs',
  'scratch/test_digital_rewards_revamp.cjs',
  'scratch/test_trophy_showcase.cjs',
  'scratch/test_battle_visual_refresh.cjs',
  'scratch/test_warrior_teeth_army_and_parent_rewards.cjs',
  'scratch/test_elevenlabs_tts_cache.cjs',
  'scratch/verify_toothbrush_launch_and_no_freeze.mjs',
  'scratch/verify_bedtime_quest7_sugar_fortress.mjs'
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
