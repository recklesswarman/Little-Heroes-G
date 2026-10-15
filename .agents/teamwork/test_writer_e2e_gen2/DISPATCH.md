## 2026-10-15T15:32:11Z
You are the E2E Simulation Test Writer for Little Hero Adventures.
Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\test_writer_e2e_gen2
You MUST read: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (specifically section ## 2026-10-15T15:15:03Z).
Also inspect:
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_2\PROJECT.md
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_2\TEST_INFRA.md
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_3_gen2\ui_test_investigation.md
- Existing simulation scripts in scratch/ (e.g. scratch/verify_two_kids_same_task.mjs, scratch/verify_routine_approvals_pipeline.mjs) for store bundling and simulated Firestore patterns.

Exclusive File Ownership:
You own `scratch/verify_task_habit_engine_and_sync.mjs`. Do not edit other files.

Task:
Build the end-to-end multi-device simulation test in `scratch/verify_task_habit_engine_and_sync.mjs`.
The test must programmatically test and verify:
1. Submitting a task or habit auto-credits Tokens (coins), Hero XP, and Pet Sparks to the child's balance, and enqueues Gold Points in `pendingApprovals` with complete schema:
   `id, logId, kidId, kidName, type: 'task_point_approval', taskId, taskTitle, zone, tokensAwarded, xpAwarded, sparksAwarded, pendingPoints, timestamp, status: 'pending'`.
2. Parent Portal display verification: pending approval records contain exact tokens, XP, sparks, and pending points metadata.
3. Zero-Drop Persistence: pending approvals persist across restarts, reloads, and cloud hydration cycles even when unconfirmed local requests are older than 45 seconds (verifying removal of the 45s cutoff).
4. Approval flow: approving awards Gold Points to the kid's balance (asserting `screenTimeMinutes` is NOT increased / no auto-conversion) and resets the task/habit so it can be completed again.
5. Denial flow: denying claws back auto-issued Tokens, Hero XP, and Pet Sparks (asserting balances are clamped at floor 0), marks log as rejected, and resets task with 'Needs Redo' state (so `getTaskCompletionsToday` does not block it).
6. 1:1 Parity between World Map and Quests: completing on Map marks Quests complete and vice-versa; dynamic reward inheritance from parent portal settings; single completion payout per cycle.
7. Concurrent sibling submissions: two kids submitting tasks concurrently produce separate pending approvals with zero data bleed or array clobbering.

Run your test script (`node scratch/verify_task_habit_engine_and_sync.mjs`) to verify it runs smoothly.
Once complete, write `c:\APP\stitch_little_hero_adventures\TEST_READY.md` (and a copy in `c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_2\TEST_READY.md`) summarizing the test suite.
Write `handoff.md` in your working directory and notify the orchestrator.
