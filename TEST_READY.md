# TEST_READY: Task & Habit Engine and Household Realtime Sync E2E Simulation Test Suite

**Test Writer:** E2E Simulation Test Writer (`test_writer_e2e_gen2`)  
**Test Suite File:** `scratch/verify_task_habit_engine_and_sync.mjs`  
**Execution Command:** `node scratch/verify_task_habit_engine_and_sync.mjs`  
**Date:** 2026-10-15  

---

## 1. Executive Summary
The end-to-end multi-device simulation test suite for the **Task & Habit Engine and Household Realtime Sync Infrastructure** has been fully authored, compiled, and verified in `scratch/verify_task_habit_engine_and_sync.mjs`. 

The test harness uses `esbuild` to bundle the application state engine (`src/state/store.js`), real-time sync service (`src/services/firestoreSyncService.js`), and UI view renderers (`ParentPortalView.js`, `DashboardView.js`, `WorldAdventureMapView.js`) into isolated `node:vm` contexts representing independent devices (Child 1 on Tablet A, Child 2 on Tablet B, and Parent on Mobile Portal) backed by an in-memory reactive Firestore simulator (`makeFS`).

The suite programmatically exercises and validates all 7 acceptance criteria categories from `ORIGINAL_REQUEST.md` (§2026-10-15T15:15:03Z) and invariants from `task_and_currency_lifecycle_rules.md`.

---

## 2. Test Architecture & Coverage Matrix

| Category | Description | Assertions | Target Components |
|---|---|:---:|---|
| **1. Auto-Reward & Schema** | Auto-credits Tokens, Hero XP, and Pet Sparks on completion; queues Gold Points; verifies complete schema: `id, logId, kidId, kidName, type: 'task_point_approval', taskId, taskTitle, zone, tokensAwarded, xpAwarded, sparksAwarded, pendingPoints, timestamp, status: 'pending'` in `pendingApprovals` and `taskCompletionLogs`. | 24 | `store.js:toggleTaskForest`, `toggleHabitIsland` |
| **2. Parent Portal Metadata** | Parent Action Inbox renders exact kidName, taskTitle, `+pendingPoints Gold Points`, `+tokensAwarded Tokens`, `+xpAwarded XP`, `+sparksAwarded Sparks`. Asserts removal of automatic screen time conversion (`⏱️ +Xm Screen Time`). | 9 | `ParentPortalView.js:renderParentPortalView` |
| **3. Zero-Drop Persistence** | Verifies pending approvals older than 45 seconds (`timestamp: Date.now() - 120000`) survive cloud hydration, device reboot/reload from persistent storage (`localStorage`), and non-destructive union reconcile with repair push (`pushStateToCloud(true)`). | 3 | `store.js:hydrateFromCloud`, `firestoreSyncService.js` |
| **4. Approval Flow** | Parent approval credits Gold Points to child balance on both Parent and Kid devices; verifies `hero.screenTimeMinutes` is strictly unchanged (NO auto-conversion); removes request from `pendingApprovals`; updates log to `status: 'approved'`; resets chore to `completed: false` allowing re-completion in subsequent cycles. | 8 | `store.js:approveParentRequest` |
| **5. Denial & Reversible Clawback** | Parent denial awards 0 Gold Points; claws back auto-issued Tokens, Hero XP, and Pet Sparks with strict clamping at floor 0 (handling cases where kid spent tokens prior to denial); marks log as `status: 'rejected'`; non-blocking 'Needs Redo' state allows child to re-attempt and submit the chore today. | 9 | `store.js:rejectParentRequest`, `getTaskCompletionsToday` |
| **6. 1:1 Map & Quests Parity** | 1:1 bidirectional completion between World Map (`completeWaypointChore`) and Quests (`toggleTaskForest`); chore aliasing (`clean_room`<->`clean_toys`, `brush_teeth_am`<->`morning_brush`, `sleep_on_time`<->`night_bedtime`); single completion payout per cycle (blocks duplicate submission while pending); dynamic reward inheritance from parent portal settings. | 9 | `store.js:completeWaypointChore`, `WorldAdventureMapView.js` |
| **7. Sibling Isolation & Sync** | Concurrent task submissions from two siblings (`hero_1` and `hero_2`) on separate devices create distinct pending approval items on the Parent device without array clobbering; approving Child 1 credits only Child 1; denying Child 2 claws back only Child 2; pet sparks remain strictly isolated. | 11 | `store.js:hydrateFromCloud`, multi-device Firestore sync |
| **Total** | | **73** | |

---

## 3. Current Test Execution Results

**Execution Command:** `node scratch/verify_task_habit_engine_and_sync.mjs`  
**Status:** 58 Passed, 15 Failed (Total: 73 Assertions)

The test suite executed with 0 runtime crashes, cleanly compiling and executing all 7 test categories. The 15 failures represent authentic, requirement-derived implementation defects in the current codebase that are actively assigned to Worker M1 (Core Engine & Store) and Worker M2 (UI & Views).

### Defect Escalation Breakdown for Implementing Workers:

#### A. Core Engine & State (`src/state/store.js` & `src/services/firestoreSyncService.js` - Owned by Worker M1):
1. **Approval Record Schema Incompleteness:** `pendingApprovals` records pushed in `toggleTaskForest`, `toggleHabitIsland`, and `completeWaypointChore` omit `xpAwarded` and `sparksAwarded`.
2. **Illegal Screen Time Auto-Conversion:** `approveParentRequest` illegitimately increments `hero.screenTimeMinutes` (`hero.screenTimeMinutes += pointsToAward * rate`), violating Rule 2 & Acceptance Criteria R3.
3. **Missing Reversible Clawback:** `rejectParentRequest` does not claw back auto-issued Tokens, Hero XP, or Pet Sparks (`Math.max(0, balance - awarded)`).
4. **Denial Lockout Bug:** `getTaskCompletionsToday` does not filter out rejected logs (`status: 'rejected'`), which permanently locks the child out from re-attempting a rejected task/waypoint.
5. **Denial Task Reset Bug:** On rejection, tasks are not reset on the child's device, leaving them marked complete instead of triggering "Needs Redo".
6. **45-Second Stale Drop Bug:** `hydrateFromCloud` (line 7304) filters out unconfirmed local pending approvals older than 45 seconds (`ageMs < 45000`), causing pending approvals to vanish after 45 seconds.
7. **Dynamic Reward Inheritance at Source:** `completeWaypointChore` reads hardcoded static rewards from `waypoint` instead of inheriting parent-configured rewards from `taskForest` / `habitIslands`.

#### B. UI & View Integration (`src/views/ParentPortalView.js` & `WorldAdventureMapView.js` - Owned by Worker M2):
8. **Parent Portal Metadata Omissions:** Approval cards in `ParentPortalView.js` omit `req.xpAwarded` and `req.sparksAwarded`.
9. **Parent Portal Screen Time Display:** Approval cards render `+Xm Screen Time` conversion text, which must be removed.
10. **"Needs Redo" Visual State:** "Needs Redo" badge/indicator is not yet rendered in Quests and World Map waypoints for rejected tasks.

---

## 4. Verification Instructions
To execute the suite:
```bash
node scratch/verify_task_habit_engine_and_sync.mjs
```
The test suite will exit with code `0` once Worker M1 and Worker M2 complete their assigned implementation fixes.
