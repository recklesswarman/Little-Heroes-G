# Handoff Report: Specification & Codebase Survey for Task & Habit Engine Overhaul

## 1. Observation

1. **Improper Screen Time Auto-Conversion**:
   - `src/state/store.js:5250-5254`: In `approveParentRequest(reqId)`, when approving a task point approval:
     ```javascript
     const rate = hero.screenTimeRate !== undefined ? hero.screenTimeRate : 2;
     const earnedMinutes = pointsToAward * rate;
     hero.screenTimeMinutes = (hero.screenTimeMinutes || 0) + earnedMinutes;
     ```
   - `src/views/ParentPortalView.js:292, 344`: The UI explicitly displays `⏱️ +${earnedMinutes}m Screen Time` and `✓ Issue +${pointsAmount} ⭐ (+${earnedMinutes}m ⏱️)`.
2. **Complete Absence of Denial Reversibility & Clawback**:
   - `src/state/store.js:5309-5350`: In `rejectParentRequest(reqId)`:
     - `hero.coins` is never retrieved or mutated.
     - `hero.xp` is never decremented.
     - `pet.sparks` (or `petSparkMap`) is never decremented.
     - Clamping at 0 (`Math.max(0, ...)`) is nonexistent.
     - No "Needs Redo" state is assigned to the task, child, or view.
3. **Incomplete `pendingApprovals` Schema**:
   - In `store.js:1910` (`toggleHabitIsland`), `store.js:2035` (`toggleTaskForest`), `store.js:2169` (`claimCompanionHabit`), `store.js:2254` (`completeChoreWithPhotoProof`), `store.js:2508` (`completeToothbrushBattle`), `store.js:5709` (`completeMovementRoutine`), `store.js:8914` (`completeWaypointChore`), `store.js:9011` (`completePajamasTidyStep`), `store.js:9171` (`completeBedtimeStory`):
     - `xpAwarded` is omitted.
     - `sparksAwarded` is omitted.
     - Field is keyed as `title` rather than `taskTitle`.
4. **45-Second Stale Cutoff Bug in Cloud Hydration**:
   - `src/state/store.js:7303-7304`: In `hydrateFromCloud(cloudData)`:
     ```javascript
     const ageMs = localReq.timestamp ? (Date.now() - new Date(localReq.timestamp).getTime()) : 0;
     return ageMs >= 0 && ageMs < 45000;
     ```
     Local unconfirmed pending approvals older than 45 seconds are purged when reconciling inbound cloud snapshots.
5. **Map to Quests Asymmetry & Hardcoded Disconnected Values**:
   - `src/state/store.js:8857-8886`: `completeWaypointChore(waypointId)` reads static `PATH_OF_VALOR_WAYPOINTS` rewards and calculates `pendingPoints = Math.round(waypoint.rewardCoins / 2)`. It never queries `habitIslands` or `taskForest` settings configured in the Parent Portal (`ParentPortalView.js:4371-4403`).
   - `src/state/store.js:1770-1783`: `isTaskPendingApproval` only has alias groups for morning and bedtime dental chores (`morning_brush` and `bedtime_brush`), leaving other chores un-aliased between Map and Quests.
   - `src/views/WorldAdventureMapView.js:522-530`: `isWaypointDone` checks `getTaskCompletionsToday` without checking `status !== 'rejected'`, locking out kids from redoing chores if rejected.
6. **Build & Existing Test Suite Status**:
   - `npm run build` exits 0 (verified in task-202).
   - Multi-device two-kid isolation test `scratch/verify_two_kids_same_task.mjs` exits 0.
   - Cross-device approval sync test `scratch/verify_approval_sync_across_devices.js` exits 0.

## 2. Logic Chain

1. Observations 1.1 and 1.2 demonstrate that approving a chore awards both Gold Points and screen time minutes. This directly contradicts `task_and_currency_lifecycle_rules.md` Invariant 2 and `ORIGINAL_REQUEST.md` R3, which specify that Gold Points are only used in the Shop (`ShopView.js:487-535`) to purchase screen time or privileges.
2. Observations 2.1 through 2.5 demonstrate that when a parent denies a chore in `rejectParentRequest`, the auto-issued Tokens, Hero XP, and Pet Sparks remain permanently in the child's balance. Because no clawback logic exists, the child retains unearned currency despite rejection.
3. Observation 3 demonstrates that `xpAwarded` and `sparksAwarded` are missing from the `pendingApprovals` items. Even if `rejectParentRequest` attempted clawback, it could not determine the exact amount of XP or Sparks without querying `taskCompletionLogs`.
4. Observation 4 demonstrates that any local submission made during an offline period or high-latency sync lasting longer than 45 seconds will be dropped by `hydrateFromCloud`, causing pending approvals to vanish from the Parent Portal.
5. Observations 5.1 through 5.3 demonstrate that completing chores on the World Map bypasses the Quests store logic, ignores parent-configured reward settings, and locks kids out of re-attempts when rejected.

## 3. Caveats

- No live production code was modified during this investigation (strictly read-only probe).
- Test file `scratch/verify_task_habit_engine_and_sync.mjs` does not exist yet; it is slated for creation in the implementation/QA phase to validate the full end-to-end multi-device lifecycle.

## 4. Conclusion

The Little Hero Adventures Task & Habit Engine has solid foundational multi-device sync scaffolding, but suffers from five critical architectural defects that must be resolved:
1. Remove automatic screen time conversion on point approval (`store.js:5250-5254`).
2. Implement reversible denial flow with Tokens, XP, and Pet Sparks clawback (clamped at 0), paired with a "Needs Redo" prompt.
3. Populate `taskTitle`, `xpAwarded`, and `sparksAwarded` across all `pendingApprovals` pushes.
4. Eliminate the 45-second stale cutoff in `hydrateFromCloud` (`store.js:7304`).
5. Unify World Map waypoint chores and Quests 1:1, dynamically inheriting Parent Portal reward configurations and enabling re-attempts after rejection.

The comprehensive survey and recommendations are documented in:
`c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1_gen2\spec_report.md`

## 5. Verification Method

To independently verify the observed findings:
1. **Screen time auto-conversion**:
   - Inspect `src/state/store.js:5250-5254` and `src/views/ParentPortalView.js:292`.
2. **Denial clawback absence**:
   - Inspect `src/state/store.js:5309-5350`.
3. **45-second cutoff**:
   - Inspect `src/state/store.js:7303-7305`.
4. **Run existing isolated test suites**:
   - `node scratch/verify_two_kids_same_task.mjs`
   - `node scratch/verify_approval_sync_across_devices.js`
   - `node scratch/verify_routine_approvals_pipeline.mjs`
5. **Verify production compilation**:
   - `npm run build`
