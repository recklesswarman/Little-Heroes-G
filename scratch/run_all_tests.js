import { spawnSync } from 'child_process';
import path from 'path';

console.log('🚀 Running Full Little Hero Adventures Test Suite...\n');

const testFiles = [
  'scratch/verify_static_path_containment.mjs',
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
  'scratch/verify_parent_settings_sync.mjs',
  'scratch/verify_parent_pin_validation.mjs',
  'scratch/verify_screen_time_rules.mjs',
  'scratch/verify_rex_voice_persona.mjs',
  'scratch/verify_companion_rules_gate.mjs',
  'scratch/verify_parent_panel_tabs_render.js',
  'scratch/verify_studio_delivery_targeting.mjs',
  'scratch/verify_studio_image_budget.mjs',
  'scratch/verify_studio_escaping_and_pets.mjs',
  'scratch/verify_studio_shop_parity.mjs',
  'scratch/verify_asset_credits.mjs',
  'scratch/verify_seed_catalog_integrity.mjs',
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
  'scratch/verify_digital_rewards_complete_loop.mjs',
  'scratch/test_trophy_showcase.cjs',
  'scratch/test_battle_visual_refresh.cjs',
  'scratch/test_warrior_teeth_army_and_parent_rewards.cjs',
  'scratch/verify_toothbrush_launch_and_no_freeze.mjs',
  'scratch/verify_bedtime_quest7_sugar_fortress.mjs',
  'scratch/verify_toothbrush_enhancements_and_sky_attacks.mjs',
  'scratch/verify_agy_multi_agent_architecture.mjs',
  'scratch/verify_learning_realms_question_banks.mjs',
  'scratch/verify_boss_and_hazard_expansion.mjs',
  'scratch/verify_shrine_expansion_and_seasons.mjs',
  'scratch/verify_bedtime_moral_expansion.mjs',
  'scratch/verify_bedtime_voice_picker.mjs',
  'scratch/test_voice_service_prefetch.mjs',
  'scratch/verify_free_voice_solution_e2e.mjs',
  'scratch/adversarial_voice_invariants_challenger_2.mjs',
  'scratch/adversarial_voice_stress_harness.mjs',
  'scratch/verify_bedtime_scene_prompts.mjs',
  'scratch/verify_pet_sanctuary_treats_and_decay.mjs',
  'scratch/verify_shop_catalog_expansion.mjs',
  'scratch/verify_badge_ladders_world_map_and_learning.mjs',
  'scratch/verify_grade_level_skills_reading_font_and_sfx.mjs',
  'scratch/verify_hero_avatar_presets_expansion.mjs',
  'scratch/verify_routine_approvals_pipeline.mjs',
  'scratch/verify_fragmentation_and_rewards_fixes.mjs',
  'scratch/verify_storyweaver_lottie_pwa_voicelab.mjs',
  // 3 Existing Offline Suites (49-51):
  'scratch/verify_agy_persistent_fixes.mjs',
  'scratch/verify_name_and_memory_retention.mjs',
  'scratch/verify_rex_voice_input_hold_to_talk.mjs',
  // 3 New Milestone E2E Suites (52-54):
  'scratch/verify_multi_host_parity.mjs',
  'scratch/verify_rewards_revamp_loop_hardened.mjs',
  'scratch/verify_direct_preview_routing.mjs',
  'scratch/verify_world_map_and_minigame_approvals.mjs',
  'scratch/verify_companion_workout_fixes.mjs',
  // Milestone Dino Hero Workout E2E Suite:
  'scratch/verify_dino_workout_e2e.mjs',
  // Milestone Task & Habit Engine and Realtime Sync Suite:
  'scratch/verify_task_habit_engine_and_sync.mjs',
  // Milestone Bedtime AI Storybook Overhaul E2E Suite:
  'scratch/test_bedtime_overhaul_e2e.mjs',
  // Milestone Cloud Firestore Multi-Database & Security Rules E2E Suite:
  'scratch/verify_firestore_rules_and_sync.mjs',
  // Story Engine Suite:
  'scratch/verify_story_engine_safety.mjs',
  'scratch/verify_story_engine_pipeline.mjs',
  'scratch/verify_story_engine_ledger.mjs',
  'scratch/verify_story_engine_handler.mjs',
  'scratch/verify_story_engine_sync.mjs',
  'scratch/verify_story_memory.mjs',
  'scratch/verify_story_memory_store.mjs',
  'scratch/verify_story_seeds.mjs',
  'scratch/verify_story_seed_refresh.mjs',
  'scratch/verify_story_scenes.mjs',
  'scratch/verify_image_worker.mjs',
  'scratch/verify_worker_contract.mjs',
  'scratch/verify_real_models.mjs',
  'scratch/verify_labeler_config.mjs',
  'scratch/verify_story_controls.mjs',
  'scratch/verify_story_hosts.mjs',
  'scratch/verify_companion_safety.mjs',
  // Cloudflare image Worker access control (origin allow-list, no shared key):
  'scratch/verify_cloudflare_worker_origin.mjs',
  // Starlight Arcade Classic Mini-Game Expansion Suite:
  'scratch/verify_arcade_classic_games_expansion.mjs',
  'scratch/verify_code_scanning_fixes.mjs',
  // Milestone Parent Analytics and ECharts Dashboard E2E Suite:
  'scratch/verify_parent_analytics_e2e.mjs',
  // AI Toothbrush Timer M1 Production Audit Suites (R1, R2, R3):
  'scratch/verify_ai_vision_and_fallback.mjs',
  'scratch/verify_combat_pacing_and_audio.mjs',
  // Batch 3 — Audio, Voice & Progression Hooks Suite:
  'scratch/verify_batch3_audio_voice_progression.mjs',
  // Family Raspberry Pi offline AI proxy (Piper TTS, whisper.cpp STT, ntfy alerts):
  'scratch/verify_local_pi_ai_routes.mjs',
  // Parent alerts from hosted sites (app server first, then publish-only direct to the Pi's ntfy):
  'scratch/verify_parent_alerts_hosted.mjs',
  // Static sites call App Hosting's API (CORS limited to the family's origins):
  'scratch/verify_static_sites_use_app_hosting_api.mjs',
  // App Hosting -> Pi voice relay over Funnel (token-gated) and Umami loader:
  'scratch/verify_pi_relay_and_analytics.mjs',
  // Reading help: Read-Along matching, Word Wall + Number Dash quests, tap-a-word meanings:
  'scratch/verify_reading_help.mjs',
  // Approval alerts open the parent Action Inbox (deep link behind the PIN):
  'scratch/verify_approval_alert_link.mjs',
  // Header build badge shows the real build and is visible on phones too:
  'scratch/verify_build_badge.mjs',
  // AI hero agent routes relayed from server.js to the AGY Cloud Run service:
  'scratch/verify_rex_agy_relay.mjs',
  // Rex function calling (/api/rex/agent) and the Sunday parent report (ntfy):
  'scratch/verify_rex_function_calling_and_weekly_report.mjs',
  'scratch/verify_fridge_calendar_rex_live_and_story_refs.mjs',
  'scratch/verify_hq_pen_models.mjs',
  // School breakfast/lunch (MealViewer), meal planner, its API, fridge card and lunch alert:
  'scratch/verify_school_meal_planner.mjs',
  // Fridge "what to wear" weather card, weather chores, district no-school days, school-days-only chores:
  'scratch/verify_weather_and_school_calendar.mjs',
  // Phonics pack: letter sounds, Dolch words, rhymes/syllables (CMU-checked), sound it out, Andika:
  'scratch/verify_phonics_pack.mjs',
  // "Design your hero" DiceBear avatars on the Profile screen:
  'scratch/verify_hero_avatar_maker.mjs',
  // Fridge extras: NASA space picture, On this day, sunset evening look, bedtime countdown:
  'scratch/verify_fridge_extras.mjs',
  // Story character sheets: one hero + companion picture per kid, used as the reference for every story picture:
  'scratch/verify_story_character_sheets.mjs',
  // Number Dash pictures (ten frames, number lines, base-ten blocks) and the PhET Math Lab:
  'scratch/verify_number_dash_pictures.mjs',
  // Pi voices: Kokoro bedtime story voice with words lighting up, Moonshine fast reading check:
  'scratch/verify_pi_voice_extras.mjs',
  // Screen checks on the Pi after each deploy (Fridge Display + kid screens, Playwright):
  'scratch/verify_pi_screen_checks.mjs',
  // Fridge mode toggle in the header (tablets become the Fridge Display, saved per device):
  'scratch/verify_fridge_mode_toggle.mjs',
  'scratch/verify_audit_hardening.mjs',
  // Story seeds must be real story starts, not mood lines (seedRefresh.js storySparkProblems):
  'scratch/verify_story_spark_quality.mjs'
];

let allPassed = true;

for (const file of testFiles) {
  console.log(`\n▶️  Executing: ${file}`);
  const result = spawnSync('node', [file], { stdio: 'inherit', timeout: 180000 });
  if (result.error?.code === 'ETIMEDOUT') {
    console.error(`❌ Test timed out after 180s: ${file}`);
    allPassed = false;
    break;
  }
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
