## 2026-10-15T15:32:11Z
You are the Core State Engine & Sync Architect Worker for Little Hero Adventures.
Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m1_gen2
You MUST read: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (specifically section ## 2026-10-15T15:15:03Z).
Also inspect:
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_2\PROJECT.md
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1_gen2\spec_report.md
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_2_gen2\sync_investigation.md
- c:\APP\stitch_little_hero_adventures\.agents\rules\task_and_currency_lifecycle_rules.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive File Ownership:
You exclusively own:
- `src/state/store.js`
- `src/services/firestoreSyncService.js`
Do NOT modify any files in `src/views/` (owned by Milestone 2).

Implementation Objective (Milestone 1):
1. **Full Pending Approvals Schema**:
   Ensure every task/habit completion (`toggleHabitIsland`, `toggleTaskForest`, `completeWaypointChore`, etc.) pushes a complete pending approval record:
   `id, logId, kidId, kidName, type: 'task_point_approval', taskId, taskTitle, zone, tokensAwarded, xpAwarded, sparksAwarded, pendingPoints, timestamp, status: 'pending'`.
2. **Auto-Reward Issuance**:
   Tokens (coins), Hero XP, and Pet Sparks are auto-awarded upon submission. Gold Points are NEVER auto-awarded; they are strictly queued in `pendingApprovals`.
3. **Approval Lifecycle (No Screen Time Auto-Conversion)**:
   In `approveParentRequest(reqId)`:
   - Credit `hero.points += pendingPoints`.
   - **CRITICAL REQUIREMENT R3**: REMOVE the auto-conversion of Gold Points to screen time minutes (`hero.screenTimeMinutes += pointsToAward * rate` MUST BE REMOVED). Points are spent by kids in the Shop.
   - Mark completion log as `'approved'`.
   - Unlock / reset completion state so chore can be completed again in future cycles.
4. **Reversible Denial Flow (Clawed Back at Floor 0)**:
   In `rejectParentRequest(reqId)`:
   - Zero Gold Points awarded.
   - Claw back auto-issued Tokens, Hero XP, and Pet Sparks:
     `hero.coins = Math.max(0, (hero.coins || 0) - (req.tokensAwarded || 0))`
     `hero.xp = Math.max(0, (hero.xp || 0) - (req.xpAwarded || 0))`
     `hero.sparks = Math.max(0, (hero.sparks || 0) - (req.sparksAwarded || 0))`
     Safely decrement `petSparkMap` via `deductPetSparks` or clamped per-hero pet spark map.
   - Mark completion log as `'rejected'`.
   - Set "Needs Redo" prompt / status for the denied task.
5. **Denial Lockout Fix**:
   In `getTaskCompletions` / `getTaskCompletionsToday`:
   Filter out logs where `status === 'rejected'`, so a denied chore is NOT treated as completed today and can be re-attempted.
6. **Zero-Drop Persistence (Remove 45s Cutoff)**:
   In `hydrateFromCloud()` in `src/state/store.js`:
   At line 7304, REMOVE `ageMs >= 0 && ageMs < 45000`. Unconfirmed local approvals must persist indefinitely until explicitly resolved in `resolvedApprovals` or matched in cloud.
   When `repairPushNeeded` is true, invoke `this.syncService.pushStateToCloud(true)` immediately.
7. **Multi-Child Data Isolation**:
   - Add `sparks` and `evolutionSparks` to `HERO_STAMPED_FIELDS` in `src/state/store.js`.
   - Include `sparks` and `evolutionSparks` in `syncSelectedHeroWithHeroes()`, `switchHero()`, and `heroesMap` serialization in `src/services/firestoreSyncService.js`.
   - Isolate `petSparkMap` per child (e.g. partition keys as `${heroId}_${petId}` or hero-level property) so siblings do not leak pet progress.

Verification:
Run tests: `node scratch/run_all_tests.js` and build: `npm run build`.
Write `handoff.md` detailing your changes, verification commands, and results.
Send completion message to orchestrator.


## 2026-10-15T15:45:22Z
**Context**: Milestone 1 Implementation for Task & Habit Engine Overhaul
**Content**: The E2E Simulation Test Suite is now ready. TEST_READY.md has been published and you can run `node scratch/verify_task_habit_engine_and_sync.mjs` at any time to verify your changes against the multi-device simulation.
**Action**: Continue your step-by-step implementation of Milestone 1 in `src/state/store.js` and `src/services/firestoreSyncService.js`.

## 2026-10-15T16:20:15Z
**Context**: Milestone 1 Implementation
**Content**: Checking in on your status for the remaining store methods (approve/reject, switchHero, petSparks, hydrateFromCloud).
**Action**: Please let me know your current progress and ETA.
