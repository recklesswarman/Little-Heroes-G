# Handoff Report: UI Integration and Test Suite Explorer

**Working Directory:** `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_3_gen2`  
**Target Report:** `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_3_gen2\ui_test_investigation.md`  
**Parent Conversation ID:** `af21d512-2803-4965-a215-ecdc337662af`  
**Timestamp:** 2026-10-15T15:28:30Z  

---

## 1. Observation

1. **Map Waypoints vs Quests Disconnect:**
   - In `src/data/worldMapData.js:PATH_OF_VALOR_WAYPOINTS` (lines 59–196), waypoints use keys:
     - `wp_morning_teeth` -> `choreKey: 'brush_teeth_am'`
     - `wp_tidy_room` -> `choreKey: 'clean_room'`
     - `wp_homework` -> `choreKey: 'homework'`
     - `wp_workout` -> `choreKey: 'exercise'`
     - `wp_night_teeth` -> `choreKey: 'brush_teeth_pm'`
     - `wp_bedtime` -> `choreKey: 'sleep_on_time'`
   - In `src/constants/routines.js:ROUTINES` (lines 5–76), task IDs are:
     - `'morning_brush'`, `'make_bed'`, `'clean_toys'`, `'homework_reading'`, `'night_bedtime'`.
   - In `src/state/store.js` (lines 1775–1796), `aliasGroup` only aliases dental tasks (`bedtime_brush`, `brush_teeth_pm`, `wp_night_teeth`, etc.). Tasks like `clean_room` vs `clean_toys` or `homework` vs `homework_reading` have no alias mapping.
   - In `src/views/WorldAdventureMapView.js:isWaypointDone` (line 529):
     `return store.getTaskCompletionsToday(wp.choreKey, heroId).length > 0;`
     Checking `wp.choreKey` never matches completions recorded under `clean_toys` or `homework_reading`.

2. **Hardcoded Waypoint Rewards Bypassing Parent Settings:**
   - In `src/views/WorldAdventureMapView.js`:
     - Line 249: `+${wp.rewardCoins} 🪙 +${wp.rewardSparks} ⚡`
     - Lines 480–490: Displays `+${wp.rewardCoins} 🪙`, `+${wp.rewardXp} ⭐`, `+${wp.rewardSparks} ⚡`.
   - In `src/state/store.js:completeWaypointChore` (lines 8883–8885, 8876):
     ```javascript
     hero.coins = (hero.coins || 0) + waypoint.rewardCoins;
     hero.xp = (hero.xp || 0) + waypoint.rewardXp;
     this.addPetSparks(pId, waypoint.rewardSparks);
     const pendingPoints = Math.round(waypoint.rewardCoins / 2);
     ```
     Rewards are read directly from static `PATH_OF_VALOR_WAYPOINTS` and `pendingPoints` is computed as `rewardCoins / 2`, ignoring `taskForest` / `habitIslands` settings.
   - In `src/views/ParentPortalView.js` (lines 4371–4400), parent updates to `.task-tokens-input` and `.task-points-input` only modify `taskForest` and `habitIslands`, leaving waypoints unaffected.

3. **Parent Portal Approval Metadata & Screen Time Conversion:**
   - In `src/views/ParentPortalView.js` (lines 260–295):
     - Displays `Points: +${pointsAmount}` and `Auto-issued +${tokensAmount} Tokens`.
     - Hero XP and Pet Sparks are completely missing from the approval card.
     - Line 292: Prints `<span class="text-sky-300 font-black">⏱️ +${earnedMinutes}m Screen Time</span>`.
     - Line 344: Button says `✓ Issue +${pointsAmount} ⭐ (+${earnedMinutes}m ⏱️)`.
   - In `src/state/store.js:approveParentRequest` (lines 5250–5253):
     ```javascript
     const rate = hero.screenTimeRate !== undefined ? hero.screenTimeRate : 2;
     const earnedMinutes = pointsToAward * rate;
     hero.screenTimeMinutes = (hero.screenTimeMinutes || 0) + earnedMinutes;
     ```
     Points are automatically converted to screen time minutes upon approval.

4. **Zero Clawback on Parent Denial & Missing "Needs Redo":**
   - In `src/state/store.js:rejectParentRequest` (lines 5309–5349):
     - Sets `logEntry.status = 'rejected'`.
     - Sets `habit.completed = false` and `task.completed = false`.
     - Removes request from `pendingApprovals`.
     - NO deduction of `tokensAwarded` from `hero.coins`.
     - NO deduction of `xpAwarded` from `hero.xp`.
     - NO deduction of `sparksAwarded` from `pet.sparks`.
   - In `src/views/DashboardView.js` (lines 322, 428) and `src/views/WorldAdventureMapView.js` (line 529):
     - Zero occurrences of "Needs Redo" or `redo` in the codebase.
     - `getTaskCompletionsToday` returns rejected logs, causing rejected chores to remain marked as done or locked.

5. **45-Second Stale Cutoff in Cloud Hydration:**
   - In `src/state/store.js:hydrateFromCloud` (lines 7303–7304):
     ```javascript
     const ageMs = localReq.timestamp ? (Date.now() - new Date(localReq.timestamp).getTime()) : 0;
     return ageMs >= 0 && ageMs < 45000;
     ```
     Any unconfirmed local approval older than 45 seconds is dropped.

6. **Test Suite Status:**
   - `scratch/verify_task_habit_engine_and_sync.mjs` does not exist in `scratch/`.
   - Existing multi-device tests (`verify_approval_sync_across_devices.js`, `verify_two_kids_same_task.mjs`) use `esbuild` + `vm` + in-memory Firestore stub (`makeFS`), but only test basic approval persistence and sibling isolation.

---

## 2. Logic Chain

1. **Premise:** Requirement R1 requires 1:1 parity between Quests and World Map chores.
   - *Evidence:* Observation 1 shows mismatched task IDs (`clean_room` vs `clean_toys`) and an incomplete `aliasGroup` in `store.js`.
   - *Inference:* Completing a waypoint on the World Map writes a completion log with an ID that Quests never inspects, leaving the Quest incomplete. Completing a Quest writes an ID that the World Map never inspects, leaving the Map waypoint incomplete.

2. **Premise:** Requirement R1 requires Map waypoints to dynamically inherit parent-configured rewards from Parent Portal settings.
   - *Evidence:* Observation 2 shows `completeWaypointChore` and `WorldAdventureMapView.js` read directly from static `PATH_OF_VALOR_WAYPOINTS`, computing pending points as `coins / 2`.
   - *Inference:* Parent adjustments to chore tokens and points in `ParentPortalView.js` have zero impact on Map waypoints.

3. **Premise:** Requirement R2 requires the Parent Portal to display full transaction deltas (Tokens, Points, XP, Sparks).
   - *Evidence:* Observation 3 shows `ParentPortalView.js` only renders tokens and points, omitting XP and Sparks. Furthermore, `store.js` omits `xpAwarded` and `sparksAwarded` from the `pendingApprovals` payload.
   - *Inference:* Parents cannot review XP or Pet Sparks rewards before approving or denying.

4. **Premise:** Requirement R3 and `task_and_currency_lifecycle_rules.md` state Gold Points are NEVER auto-converted to screen time minutes.
   - *Evidence:* Observation 3 shows `approveParentRequest` directly increments `hero.screenTimeMinutes` by `points * rate`.
   - *Inference:* This violates the core currency invariant where points must be manually redeemed in the shop.

5. **Premise:** Requirement R3 requires reversible denial clawing back tokens, XP, and sparks to floor 0 and resetting with "Needs Redo".
   - *Evidence:* Observation 4 shows `rejectParentRequest` does not touch `hero.coins`, `hero.xp`, or `pet.sparks`, and there is no "Needs Redo" rendering logic.
   - *Inference:* Denying a task leaves inflated currency in the child's balance and leaves the task broken or locked.

6. **Premise:** Requirement R2 requires Zero-Drop Persistence.
   - *Evidence:* Observation 5 shows `hydrateFromCloud` discards local pending approvals where `ageMs >= 45000`.
   - *Inference:* Any network delay or offline period exceeding 45 seconds causes pending approval items to vanish.

7. **Premise:** Acceptance criteria require `scratch/verify_task_habit_engine_and_sync.mjs` to pass with 0 failures.
   - *Evidence:* Observation 6 shows the file does not exist.
   - *Inference:* A dedicated multi-device simulation suite must be created and integrated into `scratch/run_all_tests.js`.

---

## 3. Caveats

- **Active Child State Scoping:** The app maintains both `state.selectedHero` and `state.heroes[]`. Some methods update only one; fixes must consistently synchronize `state.heroes.find(...)` and `state.selectedHero`.
- **Toothbrush AR Battle Flow:** Toothbrush battles have a hybrid pathway (`completeToothbrushBattle`) that handles boss HP and hygiene reminders in addition to task points. Fixes must maintain compatibility with `BattleView.js`.

---

## 4. Conclusion

The current codebase has significant architectural gaps preventing 1:1 parity, currency lifecycle integrity, and multi-device consistency:
1. **Quests & World Map Parity:** Broken due to ID mismatch (`clean_room` vs `clean_toys`, `homework` vs `homework_reading`, etc.) and separate completion methods.
2. **Reward Inheritance:** Non-existent; waypoints use hardcoded static values and arbitrary formulas (`coins / 2`).
3. **Currency Invariants:** Violated by `approveParentRequest` auto-granting screen time minutes.
4. **Denial Clawback:** Completely missing in `rejectParentRequest`.
5. **Needs Redo State:** Completely absent from UI views.
6. **Zero-Drop Approvals:** Undermined by the 45-second cutoff in `hydrateFromCloud`.
7. **Test Suite:** The required test script `scratch/verify_task_habit_engine_and_sync.mjs` is missing.

All findings are documented with file paths and line numbers in `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_3_gen2\ui_test_investigation.md`.

---

## 5. Verification Method

To verify these observations independently:
1. **Check Mismatched Task IDs:** Inspect `src/data/worldMapData.js` lines 72, 123, 140, 191 against `src/constants/routines.js` lines 22, 36, 49, 64.
2. **Check Hardcoded Waypoint Rewards:** Inspect `src/state/store.js` lines 8883–8885 and `src/views/WorldAdventureMapView.js` lines 249, 480–490.
3. **Check Auto-Screen Time Conversion:** Inspect `src/state/store.js` lines 5250–5253.
4. **Check Absence of Denial Clawback:** Inspect `src/state/store.js` lines 5309–5349.
5. **Check 45-Second Cutoff:** Inspect `src/state/store.js` lines 7303–7304.
6. **Check Absence of verify_task_habit_engine_and_sync.mjs:** Check existence of `scratch/verify_task_habit_engine_and_sync.mjs` (currently non-existent).
