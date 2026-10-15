# UI Integration and Test Suite Investigation Report
**Project:** Little Hero Adventures  
**Agent:** UI Integration and Test Suite Explorer (explorer_survey_3_gen2)  
**Date:** 2026-10-15  
**Working Directory:** `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_3_gen2`

---

## Executive Summary
This investigation conducted an exhaustive code audit of Little Hero Adventures covering three core architectural areas:
1. **World Map and Quests 1:1 Parity:** How chores on the World Map (`WorldAdventureMapView.js`) connect to Quests on the Kid Dashboard (`DashboardView.js`), reward inheritance, and cross-view sync.
2. **Parent Portal Approval UI:** Metadata display in `ParentPortalView.js`, store hookups in `store.js`, screen time conversion bugs, currency clawback omissions, and missing "Needs Redo" feedback.
3. **Test Suite & Verification Scripts:** Analysis of existing test infrastructure in `scratch/`, structure of multi-device simulation harnesses, and identification of missing test suites (specifically `scratch/verify_task_habit_engine_and_sync.mjs`).

---

## 1. World Map and Quests 1:1 Parity Analysis

### 1.1 Architecture & View Organization
- **Quests View:** Rendered within `src/views/DashboardView.js`. It contains three zones of actionable items:
  1. **Habit Islands** (lines 308–412): Configured via `state.habitIslands` (loaded from `src/constants/routines.js:HABIT_ISLANDS`).
  2. **Task Forest** (lines 414–521): Configured via `state.taskForest` (loaded from `src/constants/routines.js:ROUTINES`).
  3. **AI Spark Quests** (lines 523–624): Dynamic autonomous micro-quests.
- **World Adventure Map View:** Rendered within `src/views/WorldAdventureMapView.js`. It features a dual-tab switcher:
  1. **Tab 1 ("Today's Path")** (lines 190–290): Displays 8 sequential daily routine stops sourced from `PATH_OF_VALOR_WAYPOINTS` in `src/data/worldMapData.js`.
  2. **Tab 2 ("3D Adventure Island")** (lines 292–386): An interactive procedural 3D island canvas powered by `src/components/WorldAdventureMapCanvas.js`.
- **Legacy Quest Map:** `src/views/QuestMapView.js` is dedicated to mini-games (`ADVENTURE_GAMES`) and the Sugar Boss summit battle, distinct from the daily chore path in `WorldAdventureMapView.js`.

### 1.2 Disconnected Chore Keys & ID Mismatch
In `PATH_OF_VALOR_WAYPOINTS` (`src/data/worldMapData.js`), waypoints define a `choreKey`:
- `wp_wake_up`: `choreKey: 'make_bed'`
- `wp_morning_teeth`: `choreKey: 'brush_teeth_am'`
- `wp_hydration`: `choreKey: 'drink_water'`
- `wp_tidy_room`: `choreKey: 'clean_room'`
- `wp_homework`: `choreKey: 'homework'`
- `wp_workout`: `choreKey: 'exercise'`
- `wp_night_teeth`: `choreKey: 'brush_teeth_pm'`
- `wp_bedtime`: `choreKey: 'sleep_on_time'`

In contrast, `src/constants/routines.js` defines task IDs as:
- `ROUTINES` (Task Forest): `'morning_brush'`, `'make_bed'`, `'clean_toys'`, `'homework_reading'`, `'night_bedtime'`.
- `HABIT_ISLANDS`: `'drink_water'`, `'gentle_words'`, `'healthy_snack'`, `'hand_washing'`, `'toothbrush_adventure_battle'`.

**The Disconnect:**
- `clean_room` vs `clean_toys`
- `homework` vs `homework_reading`
- `sleep_on_time` vs `night_bedtime`
- `brush_teeth_am` vs `morning_brush`
- `exercise` is entirely absent from `ROUTINES` and `HABIT_ISLANDS`.

Furthermore, in `src/state/store.js` (lines 1775–1796):
```javascript
const aliasGroup = (id) => {
  if (id === 'bedtime_brush' || id === 'brush_teeth_pm' || id === 'wp_night_teeth' || id === 'sugar_fortress_night_showdown') {
    return ['bedtime_brush', 'brush_teeth_pm', 'wp_night_teeth', 'sugar_fortress_night_showdown'];
  }
  if (id === 'morning_brush' || id === 'brush_teeth_am' || id === 'wp_morning_teeth') {
    return ['morning_brush', 'brush_teeth_am', 'wp_morning_teeth'];
  }
  return [id];
};
```
Only dental task IDs are aliased. None of the room tidy, homework, bedtime, bed making, or hydration IDs are aliased across the two modules.

### 1.3 Reward Hardcoding vs Parent Portal Settings
Requirement R1 mandates: *"Map waypoints must dynamically inherit the exact parent-configured reward values (Tokens, Points, XP, Sparks) defined in the Parent Portal settings, eliminating all disconnected hardcoded values."*

**Direct Observations:**
1. In `src/views/WorldAdventureMapView.js`:
   - Line 249: `renderTodaysPathTab` renders `+${wp.rewardCoins} 🪙 +${wp.rewardSparks} ⚡` by reading hardcoded properties directly from the static `wp` object.
   - Lines 480–490: `renderWaypointModal` displays hardcoded `+${wp.rewardCoins}`, `+${wp.rewardXp}`, `+${wp.rewardSparks}`.
2. In `src/state/store.js:completeWaypointChore(waypointId)` (lines 8857–8945):
   ```javascript
   hero.coins = (hero.coins || 0) + waypoint.rewardCoins;
   hero.xp = (hero.xp || 0) + waypoint.rewardXp;
   this.addPetSparks(pId, waypoint.rewardSparks);
   const pendingPoints = Math.round(waypoint.rewardCoins / 2);
   ```
   - It reads directly from static `waypoint.rewardCoins`, `waypoint.rewardXp`, `waypoint.rewardSparks`.
   - `pendingPoints` is arbitrarily computed as `Math.round(waypoint.rewardCoins / 2)`.
   - It completely bypasses parent-configured reward settings in `state.taskForest` and `state.habitIslands`.
3. In `src/views/ParentPortalView.js` (lines 4371–4400):
   Parents can edit `.task-tokens-input` and `.task-points-input`, updating `habit.coins`, `chore.coins`, `habit.points`, `chore.points`. However, because Map waypoints read from `PATH_OF_VALOR_WAYPOINTS`, the child on the World Map never receives or sees the parent's custom values.

### 1.4 Broken Completion Synchronization
- **Completing on World Map:** Calls `store.completeWaypointChore(wpId)`. This logs a completion with `taskId: waypoint.choreKey` (e.g. `'clean_room'`). Quests in `DashboardView.js` checks `getTaskCompletionsToday('clean_toys', hero.id)`, finds 0 matching completions, and continues to show `'clean_toys'` as incomplete!
- **Completing in Quests:** Calls `store.toggleTaskForest('clean_toys')`. This logs `taskId: 'clean_toys'`. Map waypoint `wp_tidy_room` checks `getTaskCompletionsToday('clean_room', hero.id)`, finds 0 matches, and continues to show as incomplete!
- **Divergent Engine Logic:**
  - `toggleHabitIsland` / `toggleTaskForest` (lines 1810–2050): Auto-issues tokens and hero XP with pet gear buffs, does NOT award Pet Sparks, pushes an approval with `zone: 'Habit Islands'` or `'Task Forest'`, sets `task.completed = true` on the shared state object (violating child isolation).
  - `completeWaypointChore` (lines 8857–8945): Awards hardcoded tokens, XP, and Pet Sparks, computes points as `coins / 2`, pushes an approval with `zone: "Today's Path"`.
  - The two paths execute completely separate and inconsistent code.

---

## 2. Parent Portal Approval UI & Feedback Lifecycle

### 2.1 Metadata Display Deficiencies
In `src/views/ParentPortalView.js` (lines 260–296):
```javascript
const isTaskPointApproval = req.type === 'task_point_approval' || req.type === 'task';
const pointsAmount = req.pendingPoints || req.rewardPoints || 10;
const tokensAmount = req.tokensAwarded || req.rewardCoins || 20;
const kid = heroes.find(h => h.id === req.kidId) || heroes[0];
const earnedMinutes = pointsAmount * (kid?.screenTimeRate || 2);
```
- **Tokens & Points:** Rendered via `<span class="text-tertiary">⭐ Pending Approval: <strong>+${pointsAmount} Gold Points</strong></span>` and `(Auto-issued +${tokensAmount} Tokens 🪙)`.
- **Missing Hero XP:** `req.xpAwarded` is NOT rendered anywhere on the approval card.
- **Missing Pet Sparks:** `req.sparksAwarded` is NOT rendered anywhere on the approval card.
- **Data Omission at Source:** When pending approval items are pushed in `store.js` (`toggleHabitIsland` line 1910, `toggleTaskForest` line 2035, `completeWaypointChore` line 8914, `completeToothbrushBattle` line 2508):
  - They omit `xpAwarded` and `sparksAwarded`.
  - They use property name `title` instead of standard `taskTitle`.

### 2.2 Critical Currency Life-Cycle Bugs in Store

#### A. Illegitimate Auto-Conversion of Points to Screen Time
Requirement R3 & Rule 2 explicitly state: *"Gold Points are NOT auto-converted to screen time minutes. Kids use their accumulated Gold Points in the shop to purchase screen time minutes or real-life rewards."*
In `src/state/store.js:approveParentRequest(reqId)` (lines 5250–5253):
```javascript
// Screen Time & Privileges Bank conversion: points convert to screen time minutes!
const rate = hero.screenTimeRate !== undefined ? hero.screenTimeRate : 2;
const earnedMinutes = pointsToAward * rate;
hero.screenTimeMinutes = (hero.screenTimeMinutes || 0) + earnedMinutes;
```
When a parent clicks "Approve", the store **illegitimately adds screen time minutes** directly to the child's balance in addition to crediting points. In `ParentPortalView.js`, the UI even prints `✓ Issue +${pointsAmount} ⭐ (+${earnedMinutes}m ⏱️)`.

#### B. Complete Absence of Reversible Clawback on Denial
Requirement R3 demands:
```
Parent Denial:
- Zero Gold Points are awarded.
- Tokens, Hero XP, and Pet Sparks automatically granted upon submission are immediately clawed back:
  hero.coins = Math.max(0, (hero.coins || 0) - (req.tokensAwarded || 0))
  hero.xp = Math.max(0, (hero.xp || 0) - (req.xpAwarded || 0))
  pet.sparks = Math.max(0, (pet.sparks || 0) - (req.sparksAwarded || 0))
  Tokens clamped at floor of 0.
```
In `src/state/store.js:rejectParentRequest(reqId)` (lines 5309–5349):
```javascript
if (req.type === 'task_point_approval' || req.type === 'task') {
  const nowIso = new Date().toISOString();
  if (this.state.taskCompletionLogs) {
    const logEntry = this.state.taskCompletionLogs.find(...);
    if (logEntry) {
      logEntry.status = 'rejected';
      logEntry.rejectedAt = nowIso;
    }
  }
  if (req.taskId) {
    const habit = this.state.habitIslands.find(h => h.id === req.taskId);
    if (habit) { habit.completed = false; habit.pointsApproved = false; }
    const task = this.state.taskForest.find(t => t.id === req.taskId);
    if (task) { task.completed = false; task.pointsApproved = false; }
  }
  this.logAction(...);
}
```
**Zero clawback occurs.** `hero.coins`, `hero.xp`, and active pet sparks remain at their inflated values. The kid retains the auto-issued currencies despite parent rejection.

### 2.3 "Needs Redo" State is Completely Unimplemented
- Grepping the entire repository for `redo` yields 0 occurrences in source code.
- When `rejectParentRequest` marks `logEntry.status = 'rejected'`:
  - `DashboardView.js` calls `getTaskCompletionsToday(t.id, hero.id)` (lines 322, 428). Because `getTaskCompletionsToday` does not filter by status, it treats the rejected log as a completion and continues to display `Done 1x today ⭐`!
  - `WorldAdventureMapView.js:isWaypointDone` (line 529) checks `getTaskCompletionsToday(wp.choreKey, hero.id).length > 0`, which also finds the rejected log and keeps the waypoint locked and struck through!
  - `completeWaypointChore` (line 8871) rejects attempts to complete the waypoint with `{ success: false, alreadyCompleted: true }`.
  - The child is completely blocked from re-attempting or correcting a denied task/waypoint!

### 2.4 The 45-Second Stale Drop Bug in Cloud Hydration
Requirement R2 demands: *"Pending approvals must remain in the Parent Portal indefinitely until a parent explicitly taps Approve or Deny. Remove all arbitrary time limits (including the 45-second stale cutoff in cloud hydration)..."*
In `src/state/store.js:hydrateFromCloud` (lines 7293–7305):
```javascript
const unconfirmedLocal = (this.state.pendingApprovals || []).filter((localReq) => {
  if (!localReq || !localReq.id) return false;
  if (resolvedIds.has(localReq.id)) return false;
  const inCloud = cloudData.pendingApprovals.some((c) => c.id === localReq.id);
  if (inCloud) return false;
  const ageMs = localReq.timestamp ? (Date.now() - new Date(localReq.timestamp).getTime()) : 0;
  return ageMs >= 0 && ageMs < 45000;
});
```
Any pending approval created locally more than 45 seconds ago that has not yet confirmed against the cloud snapshot is **permanently discarded** by `ageMs < 45000`.

---

## 3. Test Suite & Verification Scripts Analysis

### 3.1 Existing Test Suite Inventory
- `scratch/run_all_tests.js` coordinates the regression suite, executing 61 Node test scripts sequentially.
- Existing verification scripts in `scratch/` related to tasks, approvals, and sync:
  1. `scratch/verify_approval_sync_across_devices.js`: Tests parent approval propagation across 2 simulated devices (K and P) using an in-memory Firestore stub (`makeFS`).
  2. `scratch/verify_two_kids_same_task.mjs`: Tests concurrent submission of the same task by two kids on separate devices (K1 and K2), verifying separate pending approval items on Parent (P) and isolated crediting.
  3. `scratch/verify_routine_approvals_pipeline.mjs`: Unit test verifying `completeWaypointChore('wp_wake_up')`, `completePajamasTidyStep()`, and `completeBedtimeStory()` queue approvals instead of self-granting.
  4. `scratch/verify_world_map_and_minigame_approvals.mjs`: Unit test for secrets, chests, landmarks, games, and expeditions.
  5. `scratch/verify_pending_approval_repair_push.mjs`: Unit test verifying `hydrateFromCloud` pushes repaired pending approvals to the cloud.

### 3.2 Structure of Multi-Device Simulation Harness
The multi-device simulation in `verify_approval_sync_across_devices.js` and `verify_two_kids_same_task.mjs` is structured as follows:
1. **Isolated Runtimes via `vm` & `esbuild`:**
   - Bundles `src/state/store.js` and `src/services/firestoreSyncService.js` into an IIFE bundle via `esbuild`.
   - Replaces external dependencies (`firebase/firestore`, audio, confetti, voice) with lightweight in-memory stubs.
   - Evaluates the bundle inside isolated `node:vm` contexts, simulating independent browser environments with dedicated `localStorage`, `window`, and `document` mock objects.
2. **In-Memory Firestore Simulation (`makeFS`):**
   - Stores documents in an in-memory dictionary (`docs['households/HERO-TEST']`).
   - Simulates realistic network latency (e.g. `LAT = 60ms`).
   - Implements atomic Firestore operations: `setDoc` with deep merge, `updateDoc` with dotted field keys, `getDoc`, and reactive `onSnapshot` listener notifications.
   - Emulates Firestore field transforms: `deleteField()`, `arrayUnion()`, `arrayRemove()`, `increment()`, `serverTimestamp()`.
3. **Multi-Device Actor Orchestration:**
   - Spawns distinct device instances: Kid 1 (`K1`), Kid 2 (`K2`), Parent (`P`).
   - Executes actions asynchronously with simulated network delays (`await sleep(LAT * N)`).
   - Asserts strict multi-device invariants: balance parity, non-interference between sibling balances, and correct persistence in the cloud document.

### 3.3 Test Deficits & Missing Test Files
1. **Missing Suite `scratch/verify_task_habit_engine_and_sync.mjs`:**
   - **Does not exist in the codebase.**
   - Explicitly mandated in ORIGINAL_REQUEST.md line 125: *"Multi-device simulation test (scratch/verify_task_habit_engine_and_sync.mjs) passes with 0 failures."*
2. **Missing Parity Tests:**
   - No test verifies that completing a waypoint on the World Map marks the corresponding task/habit completed in Quests (`DashboardView.js`).
   - No test verifies that completing a task/habit in Quests marks the corresponding waypoint completed on the World Map.
   - No test verifies that Map waypoints dynamically inherit reward values (Tokens, Points, XP, Sparks) customized by a parent in the Parent Portal.
   - No test verifies that only ONE completion payout is permitted across Map and Quests at a time (locked while pending, unlocked after approval/denial).
3. **Missing Reversible Denial Tests:**
   - No test verifies that when a parent denies a task/habit, auto-issued Tokens, XP, and Pet Sparks are clawed back with a floor of 0.
   - No test verifies that a gentle "Needs Redo" prompt is rendered on the kid's device allowing resubmission.
4. **Missing Point Currency Integrity Tests:**
   - No test verifies that parent approval credits Gold Points WITHOUT incrementing `hero.screenTimeMinutes`.
5. **Missing Zero-Drop Offline Tests:**
   - No test verifies that pending approvals older than 45 seconds remain persistent during cloud hydration.

---

## 4. Synthesis & Recommendations for Downstream Implementation

| Requirement Area | Current Codebase State | Required Target State |
|---|---|---|
| **Map & Quest Parity** | Disconnected IDs (`clean_room` vs `clean_toys`); hardcoded waypoint rewards; divergent completion methods. | Unified Task Engine: Shared alias/lookup mapping between waypoints and tasks; dynamic inheritance of parent-configured rewards; 1:1 bidirectional completion tracking. |
| **Point Approval** | Auto-converts Gold Points to screen time minutes (`hero.screenTimeMinutes += points * rate`). | Gold Points credited strictly as points; 0 auto-conversion to screen time minutes. |
| **Parent Denial** | No clawback of tokens, XP, or sparks; task remains stuck or incorrectly marked done. | Reversible Clawback: Deduct auto-issued tokens, XP, and sparks (floor 0); clear completion state; activate "Needs Redo" badge on kid views. |
| **Pending Metadata** | Approval UI omits XP and sparks; misleadingly displays `+Xm Screen Time`. | Approval card renders exact tokens, XP, sparks, and pending points; removes screen time conversion text. |
| **Zero-Drop Persistence** | Line 7304 drops unconfirmed local approvals older than 45s (`ageMs < 45000`). | Remove 45s cutoff; retain unconfirmed local approvals indefinitely until cloud confirmation or explicit resolution. |
| **Test Verification** | `scratch/verify_task_habit_engine_and_sync.mjs` is missing. | Implement comprehensive multi-device simulation test in `scratch/verify_task_habit_engine_and_sync.mjs` and wire into `scratch/run_all_tests.js`. |

