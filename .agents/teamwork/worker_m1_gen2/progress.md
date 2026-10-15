# Progress - worker_m1_gen2

Last visited: 2026-10-15T17:15:00Z
Status: Completed - Milestone 1 Core State Engine & Household Realtime Sync Architecture fully implemented & verified

## Checklist
- [x] Read required context files (ORIGINAL_REQUEST, PROJECT, spec_report, sync_investigation, task_and_currency_lifecycle_rules)
- [x] Inspect existing `src/state/store.js` and `src/services/firestoreSyncService.js`
- [x] Run baseline tests & baseline E2E simulation (`verify_task_habit_engine_and_sync.mjs`)
- [x] Update `src/services/firestoreSyncService.js` (sparks, evolutionSparks, petSparkMap in heroesMap)
- [x] Update `src/state/store.js`: HERO_STAMPED_FIELDS (added sparks & evolutionSparks)
- [x] Update `src/state/store.js`: syncSelectedHeroWithHeroes (added sparks, evolutionSparks, petSparkMap)
- [x] Update `src/state/store.js`: getTaskAliasGroup, getChoreAliases, getTaskCompletions (filter rejected), getTaskCompletionsToday, isTaskNeedsRedo, getNeedsRedoTasks, getTaskConfig, getWaypointRewards
- [x] Update `src/state/store.js`: toggleHabitIsland, toggleTaskForest, claimCompanionHabit, completeChoreWithPhotoProof
- [x] Update `src/state/store.js`: completeToothbrushBattle, submitTaskForApproval, completeMovementRoutine, completePajamasTidyStep, completeBedtimeStory, completeWaypointChore
- [x] Update `src/state/store.js`: approveParentRequest (remove screen time conversion, reset aliases, credit Gold Points)
- [x] Update `src/state/store.js`: rejectParentRequest (reversible clawback floored at 0, reset aliases, mark rejected, set Needs Redo)
- [x] Update `src/state/store.js`: switchHero (sparks, evolutionSparks, petSparkMap multi-child isolation)
- [x] Update `src/state/store.js`: getPetSparks, addPetSparks, deductPetSparks, getActivePetSparks (hero isolation)
- [x] Update `src/state/store.js`: hydrateFromCloud (remove 45s cutoff, eliminate premature drop condition, immediate repair push, merge sparks)
- [x] Run `node scratch/verify_task_habit_engine_and_sync.mjs`: All 53 Milestone 1 core state & sync engine assertions PASS (2 remaining failures belong strictly to Milestone 2 ParentPortalView)
- [x] Run regression test suites:
  - `verify_two_kids_same_task.mjs`: PASSED
  - `verify_routine_approvals_pipeline.mjs`: 29/29 PASSED
  - `test_bedtime_storybook.cjs`: 46/46 PASSED
  - `verify_bedtime_waypoint_marks_done.js`: 5/5 PASSED
  - `verify_approval_sync_across_devices.js`: 7/7 PASSED
  - `verify_live_rex_companion.js`: 17/17 PASSED
  - `verify_pending_approval_repair_push.mjs`: PASSED
  - `verify_pet_stats_isolated_per_kid.mjs`: PASSED
  - `test_world_adventure_map.cjs`: 70/70 PASSED
  - `verify_rewards_revamp_loop_hardened.mjs`: 60/60 PASSED
  - `verify_direct_preview_routing.mjs`: 48/48 PASSED
  - `verify_world_map_and_minigame_approvals.mjs`: 38/38 PASSED
  - `verify_multi_host_parity.mjs`: 56/56 PASSED
- [x] Run build: `npm run build`: PASSED cleanly (`built in 14.75s`)
- [x] Write handoff report (`.agents/teamwork/worker_m1_gen2/handoff.md`)
