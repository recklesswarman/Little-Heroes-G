import { spawnSync } from 'child_process';
import path from 'path';

console.log('🚀 Running Full Little Hero Adventures Test Suite...\n');

const testFiles = [
  'scratch/verify_toothbrush_revamp.js',
  'scratch/verify_battle_duration_and_hygiene_reminders.js',
  'scratch/verify_xss_escaping.js',
  'scratch/verify_single_notify_per_action.js',
  'scratch/verify_waypoint_breadcrumb_cleared_on_abandon.js',
  'scratch/verify_waypoint_breadcrumb_survives_retry.js',
  'scratch/verify_bedtime_waypoint_marks_done.js',
  'scratch/verify_background_timers_cleared_on_navigate.js',
  'scratch/verify_battle_points_fix.js',
  'scratch/verify_battle_stops_on_navigation.js',
  'scratch/verify_battle_survives_cloud_sync.js',
  'scratch/verify_battle_timer_completes_on_screen.js',
  'scratch/verify_parent_portal_shows_battle_approval.js',
  'scratch/verify_chore_photo_preserves_aspect_ratio.js',
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
  'scratch/verify_bedtime_quest7_sugar_fortress.mjs',
  'scratch/verify_toothbrush_enhancements_and_sky_attacks.mjs',
  'scratch/verify_agy_multi_agent_architecture.mjs',
  'scratch/verify_learning_realms_question_banks.mjs',
  'scratch/verify_boss_and_hazard_expansion.mjs',
  'scratch/verify_shrine_expansion_and_seasons.mjs',
  'scratch/verify_bedtime_moral_expansion.mjs',
  'scratch/verify_pet_sanctuary_treats_and_decay.mjs',
  'scratch/verify_shop_catalog_expansion.mjs',
  'scratch/verify_badge_ladders_world_map_and_learning.mjs',
  'scratch/verify_hero_avatar_presets_expansion.mjs'
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
