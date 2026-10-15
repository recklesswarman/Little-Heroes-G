# Project: Little Hero Adventures Task & Habit Engine and Household Realtime Sync Overhaul

## Architecture
- **State & Currency Engine**: `src/state/store.js` & `src/services/firestoreSyncService.js`
  - Unified completion handlers (`toggleTaskForest`, `toggleHabitIsland`, `completeWaypointChore`)
  - Full `pendingApprovals` schema with `tokensAwarded`, `xpAwarded`, `sparksAwarded`, `pendingPoints`
  - Reversible denial with clamped clawback (`Math.max(0, balance - awarded)`)
  - Approval crediting Gold Points without screen time conversion
  - Non-blocking "Needs Redo" state and exclusion of rejected logs in `getTaskCompletionsToday`
  - Zero-Drop persistence: unconditional removal of 45s cutoff (`ageMs < 45000`)
  - Non-destructive union array reconciliation with immediate repair push
  - Strict multi-child data isolation by `heroId` (including `sparks` and `petSparkMap`)
- **UI & View Integration**:
  - `src/views/WorldAdventureMapView.js` (Today's Path waypoints with dynamic reward inheritance & chore aliasing)
  - `src/views/DashboardView.js` (Quests zones with 1:1 bidirectional map parity & needs redo prompt)
  - `src/views/ParentPortalView.js` (Action Inbox with full tokens, XP, sparks, and points metadata; no screen time display)
- **E2E Test Infrastructure**: `scratch/verify_task_habit_engine_and_sync.mjs` & `scratch/run_all_tests.js`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Full Pending Approvals Schema | Store `id, logId, kidId, kidName, type: 'task_point_approval', taskId, taskTitle, zone, tokensAwarded, xpAwarded, sparksAwarded, pendingPoints, timestamp, status: 'pending'` | M1 | Survey |
| 2 | Auto-Reward Issuance | Auto-credit Tokens (coins), Hero XP, and Pet Sparks to child balance on task/habit completion; strictly queue Gold Points | M1 | Survey |
| 3 | Single Completion Payout Invariant | Block duplicate completion payouts for active pending chores across all entry points | M1 | Survey |
| 4 | Reversible Denial Clawback | On denial, deduct auto-issued Tokens, XP, and Sparks clamped at 0; record status: 'rejected' in `taskCompletionLogs` | M1 | Survey |
| 5 | Denial Reset & "Needs Redo" State | Filter out rejected logs in `getTaskCompletionsToday` so chore can be re-attempted; track "Needs Redo" | M1 | Survey |
| 6 | Approval Gold Points Crediting | On approval, credit Gold Points to `hero.points`; completely eliminate auto-conversion to screen time minutes | M1 | Survey |
| 7 | Zero-Drop Cloud Hydration | Remove 45-second cutoff (`ageMs < 45000`) in `hydrateFromCloud` so pending approvals persist indefinitely until resolved | M1 | Survey |
| 8 | Concurrent Array Clobbering Defense | Non-destructive union merge of `pendingApprovals` during cloud hydration with immediate repair push (`pushStateToCloud(true)`) | M1 | Survey |
| 9 | Multi-Child Isolation (Sparks & Pets) | Isolate `sparks`, `evolutionSparks`, and `petSparkMap` per `heroId`; add sparks to stamped fields and synchronization routines | M1 | Survey |
| 10 | 1:1 Map & Quests Parity | Comprehensive chore alias mapping (`clean_room`<->`clean_toys`, `homework`<->`homework_reading`, `sleep_on_time`<->`night_bedtime`, `brush_teeth_am`<->`morning_brush`); completing one marks other | M2 | Survey |
| 11 | Dynamic Waypoint Reward Inheritance | Map waypoints dynamically inherit parent-configured rewards from `taskForest` / `habitIslands` instead of hardcoded values | M2 | Survey |
| 12 | Parent Portal Action Inbox Metadata | Render tokens, XP, sparks, and pending points in Parent Portal cards; remove screen time minute display | M2 | Survey |
| 13 | "Needs Redo" UI Rendering | Render "Needs Redo" badge in Quests and World Map waypoints for rejected tasks | M2 | Survey |
| 14 | E2E Multi-Device Simulation Harness | Comprehensive automated simulation test in `scratch/verify_task_habit_engine_and_sync.mjs` testing all lifecycle invariants | E2E Track | Survey |
| 15 | 100% Regression Suite & Build Pass | All tests in `scratch/run_all_tests.js` pass with 0 failures and `npm run build` exits with code 0 | M-Final | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Implement `scratch/verify_task_habit_engine_and_sync.mjs` covering Tiers 1-4; publish `TEST_READY.md` | none | DONE |
| M1 | Core State Engine, Currency Lifecycle & Cloud Sync | `src/state/store.js` & `src/services/firestoreSyncService.js`: approval schema, auto-reward, reversible clawback, no screen time auto-conversion, 45s cutoff removal, zero-drop union merge, hero isolation | none | DONE |
| M2 | UI Parity, Parent Portal & Needs Redo | `src/views/WorldAdventureMapView.js`, `src/views/DashboardView.js`, `src/views/ParentPortalView.js`: 1:1 map/quest chore aliasing, dynamic reward inheritance, parent portal metadata, needs redo UI | M1 | DONE |
| M-Final | Verification, Regression & Audit | Run simulation suite `verify_task_habit_engine_and_sync.mjs`, full regression `run_all_tests.js`, production build `npm run build`, forensic integrity audit | M1, M2, E2E | DONE |

## Code Layout
- `src/state/store.js`: Core state engine, completion handlers, approval/denial, cloud hydration, hero isolation (Owned by M1 Worker)
- `src/services/firestoreSyncService.js`: Firestore real-time listener, push serialization, presence (Owned by M1 Worker)
- `src/views/WorldAdventureMapView.js`: World Map waypoints, dynamic chore settings (Owned by M2 Worker)
- `src/views/DashboardView.js`: Quests view, Habit Islands, Task Forest (Owned by M2 Worker)
- `src/views/ParentPortalView.js`: Parent Action Inbox, chore configuration (Owned by M2 Worker)
- `scratch/verify_task_habit_engine_and_sync.mjs`: Multi-device simulation test harness (Owned by E2E Test Writer)
- `scratch/run_all_tests.js`: Master regression test runner
