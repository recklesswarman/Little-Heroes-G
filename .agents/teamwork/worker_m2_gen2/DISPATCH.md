## 2026-10-15T17:12:57Z
You are the UI Parity and Parent Portal Architect Worker (Milestone 2) for Little Hero Adventures.
Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m2_gen2
You MUST read: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (specifically section ## 2026-10-15T15:15:03Z).
Also inspect:
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_2\PROJECT.md
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_2\TEST_READY.md
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m1_gen2\handoff.md
- c:\APP\stitch_little_hero_adventures\.agents\rules\task_and_currency_lifecycle_rules.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive File Ownership:
You exclusively own:
- `src/views/ParentPortalView.js`
- `src/views/WorldAdventureMapView.js`
- `src/views/DashboardView.js`
Do NOT modify `src/state/store.js` or `src/services/firestoreSyncService.js` (completed in Milestone 1).

Implementation Tasks (Milestone 2):
1. **Parent Portal Action Inbox Approval Cards (`src/views/ParentPortalView.js`)**:
   - Inspect where `pendingApprovals` items are rendered in `ParentPortalView.js` (around lines 260-350 and throughout).
   - Display complete reward metadata:
     - Tokens: `+${req.tokensAwarded ?? req.coinsAwarded ?? req.tokens ?? 0} Tokens` (or Coins icon)
     - Hero XP: `+${req.xpAwarded ?? req.xp ?? 0} XP`
     - Pet Sparks: `+${req.sparksAwarded ?? req.sparks ?? 0} Sparks`
     - Gold Points: `+${req.pendingPoints ?? req.points ?? 0} Gold Points`
   - **CRITICAL REQUIREMENT R3**:
     - Remove any automatic screen time conversion display (`⏱️ +${earnedMinutes}m Screen Time`, `⏱️ +Xm`, etc.) from the card and approval button!
     - The approval button and metadata must indicate awarding Gold Points (`+${req.pendingPoints} Gold Points`), NOT screen time minutes.
2. **Dynamic Reward Inheritance & "Needs Redo" in World Adventure Map (`src/views/WorldAdventureMapView.js`)**:
   - In waypoint displays (`renderTodaysPathTab`, `renderWaypointModal`, etc.):
     - Use `store.getWaypointRewards(wp.id)` (or read dynamic rewards from store helper) instead of hardcoded static values on `wp`.
     - Display dynamic `rewardCoins`, `rewardPoints`, `rewardXp`, `rewardSparks`.
     - Check if task needs redo using `store.isTaskNeedsRedo(wp.choreKey)`: if true, render a prominent kid-friendly `"Needs Redo"` indicator/badge and prompt so the child knows they can re-attempt it.
3. **Quests "Needs Redo" UI in Kid Dashboard (`src/views/DashboardView.js`)**:
   - In Task Forest and Habit Islands chore cards:
     - Check `store.isTaskNeedsRedo(task.id)`: if true, display a gentle `"Needs Redo"` badge and encouraging retry prompt.
4. **Verification**:
   - Run `node scratch/verify_task_habit_engine_and_sync.mjs`: ALL 76 assertions must PASS (100%)!
   - Run `node scratch/run_all_tests.js`: verify 0 regressions.
   - Run `npm run build`: compile clean with exit code 0.
   - Write `handoff.md` in your working directory and notify the orchestrator.
