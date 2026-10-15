# Specification & Authoritative Codebase Survey Report: Task & Habit Engine, Currency Lifecycle, and Realtime Household Sync

**Date**: 2026-10-15  
**Investigator Archetype**: Specification Miner  
**Target System**: Little Hero Adventures (`c:\APP\stitch_little_hero_adventures`)  
**Working Directory**: `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1_gen2`  
**Authoritative Sources**:
1. `ORIGINAL_REQUEST.md` (Specifically Milestone Request `## 2026-10-15T15:15:03Z`)
2. `.agents/rules/task_and_currency_lifecycle_rules.md`
3. Codebase Core Store: `src/state/store.js`
4. Firestore Realtime Sync Service: `src/services/firestoreSyncService.js`
5. User Views: `src/views/DashboardView.js` (Quests), `src/views/WorldAdventureMapView.js` (World Map), `src/views/ParentPortalView.js` (Parent Portal), `src/views/ShopView.js` (Shop)
6. Catalogs & Constants: `src/constants/routines.js`, `src/data/worldMapData.js`, `src/data/petsData.js`
7. Test Suite: `scratch/run_all_tests.js`, `scratch/verify_two_kids_same_task.mjs`, `scratch/verify_routine_approvals_pipeline.mjs`, `scratch/verify_approval_sync_across_devices.js`

---

## 1. Executive Summary

A comprehensive, read-only investigation of the Little Hero Adventures codebase was conducted to evaluate the authoritative behavior of the Task & Habit Engine, Currency Lifecycle (Tokens, Gold Points, Hero XP, Pet Sparks), Parent Approval/Denial flow, Map-to-Quest parity, and Household Realtime Sync.

### Key Discoveries & Critical Architectural Deficiencies
1. **Critical Currency Defect — Improper Screen Time Conversion**:
   - In `store.approveParentRequest(reqId)` (`src/state/store.js:5250-5254`), approved Gold Points are **automatically converted into screen time minutes** (`hero.screenTimeMinutes += pointsToAward * rate`).
   - In `ParentPortalView.js:292, 344`, the Action Inbox displays `⏱️ +${earnedMinutes}m Screen Time` on the card and approval button.
   - **Spec Violation**: The authoritative specification (`ORIGINAL_REQUEST.md` R3 and `task_and_currency_lifecycle_rules.md` Invariant 2) strictly mandates that **Gold Points are NEVER auto-converted into screen time minutes**. Kids accumulate Gold Points and must actively spend them in the Shop (`ShopView.js`) to purchase screen time or real-world privileges.
2. **Critical Denial Lifecycle Defect — Missing Currency Clawback, Clamping & "Needs Redo"**:
   - In `store.rejectParentRequest(reqId)` (`src/state/store.js:5309-5350`), **ZERO currency clawback is executed**. Tokens (`hero.coins`), Hero XP (`hero.xp`), and Pet Sparks (`pet.sparks` / `petSparkMap`) awarded upon child submission are retained permanently.
   - Clamping at 0 (`Math.max(0, ...)`) is completely absent.
   - "Needs Redo" is completely unrepresented in both store state and UI. When a parent rejects a chore, the child receives no notification or "Needs Redo" state; the chore simply resets quietly.
   - Furthermore, because rejection logs `status: 'rejected'` into `taskCompletionLogs`, `getTaskCompletionsToday` continues returning a record for that chore, permanently locking the child out of re-attempting that waypoint on the World Map for the rest of the day.
3. **Data Structure Incompleteness in `pendingApprovals`**:
   - `pendingApprovals` objects pushed across all task completion methods (`toggleHabitIsland`, `toggleTaskForest`, `completeWaypointChore`, `completePajamasTidyStep`, etc.) omit **`xpAwarded`** and **`sparksAwarded`**, and use `title` instead of the mandated `taskTitle`. Because these fields are missing, the approval/denial engine has no record of how much XP or Sparks were granted to claw back upon rejection.
4. **World Map vs. Quests Architectural Disconnect (Lack of 1:1 Parity)**:
   - Completing a chore on the World Map (`completeWaypointChore`, `src/state/store.js:8857`) does **not** execute the underlying `toggleTaskForest` or `toggleHabitIsland` engine logic.
   - Map waypoints read hardcoded reward values from `PATH_OF_VALOR_WAYPOINTS` (`worldMapData.js`) and compute points with a hardcoded formula `Math.round(rewardCoins / 2)`, completely ignoring parent-configured reward settings in `habitIslands` and `taskForest`.
   - Alias mapping in `isTaskPendingApproval` only aliases toothbrushing tasks (`morning_brush`, `brush_teeth_am`, `wp_morning_teeth`). Chores like `make_bed`, `clean_room`/`clean_toys`, and `drink_water` are not aliased across zones, allowing children to double-claim rewards between Map and Quests.
5. **Realtime Sync Stale Cutoff Bug (45-second Drop)**:
   - In `store.hydrateFromCloud(cloudData)` (`src/state/store.js:7303-7304`), unconfirmed local pending approvals are filtered with: `const ageMs = Date.now() - new Date(localReq.timestamp).getTime(); return ageMs >= 0 && ageMs < 45000;`.
   - Any pending approval created more than 45 seconds prior that has not yet synced to the cloud is **permanently deleted**. This violates the Zero-Drop persistence invariant.
6. **Shared Catalog Mutation Leaking Across Children**:
   - Task completion in `toggleHabitIsland` and `toggleTaskForest` mutates `habit.completed = true` on shared catalog objects in `this.state.habitIslands` and `this.state.taskForest`. If Child A completes a habit on a shared device, the habit is marked completed for Child B as well unless re-derived dynamically from per-child state.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | State Engine | `toggleHabitIsland(habitId)` | Handles kid habit submission in Quests. Auto-issues Tokens (coins) & Hero XP, awards pet training care sparks, logs to `taskCompletionLogs`, and enqueues Gold Points in `pendingApprovals`. | `habitId` (string) | Mutates store state; plays sound/confetti; returns void | If already pending, shows "Waiting for Parent Sign-Off" and blocks duplicate payout | `src/state/store.js:1811` |
| 2 | State Engine | `toggleTaskForest(taskId)` | Handles kid chore submission in Quests. Auto-issues Tokens & Hero XP, triggers pet care synergy, logs to `taskCompletionLogs`, and enqueues Gold Points in `pendingApprovals`. | `taskId` (string) | Mutates store state; plays fanfare/confetti; returns void | If already pending, shows "Waiting for Parent Sign-Off" and blocks duplicate payout | `src/state/store.js:1941` |
| 3 | State Engine | `completeWaypointChore(waypointId)` | Handles chore completion on World Adventure Map. Claims static waypoint rewards, pushes to `pendingApprovals` and `taskCompletionLogs`. | `waypointId` (string) | Returns `{ success: boolean, alreadyCompleted?: boolean, waypoint }` | If `getTaskCompletionsToday` > 0, returns `{ success: false, alreadyCompleted: true }` | `src/state/store.js:8857` |
| 4 | State Engine | `claimCompanionHabit(habitKey)` | Non-blocking voice-companion habit/chore claim for toddler voice mode. | `habitKey` (string) | Returns `{ title, coinsAwarded, pointsAwarded, xpAwarded }` | Matches keywords (teeth, brush, water, bed, toys); falls back to defaults | `src/state/store.js:2067` |
| 5 | State Engine | `completeChoreWithPhotoProof(taskId, photoUrl, aiConfidence, aiFeedback)` | Submits chore with uploaded image proof and Gemini AI vision confidence badge. | `taskId, photoUrl, aiConfidence, aiFeedback` | Mutates store; awards +5 bonus tokens | Enqueues to `pendingApprovals` with `hasPhotoProof: true` | `src/state/store.js:2200` |
| 6 | Approvals | `approveParentRequest(reqId)` | Approves pending approval item. Currently awards Gold Points AND auto-converts to screen time minutes (DEFECT); marks completion log as 'approved'; resets habit/task flags; removes from queue. | `reqId` (string) | Mutates store; logs action; saves state | If `reqId` not found, silent no-op return | `src/state/store.js:5239` |
| 7 | Approvals | `rejectParentRequest(reqId)` | Rejects pending approval item. Sets `logEntry.status = 'rejected'`; removes from `pendingApprovals`. DOES NOT claw back Tokens, XP, or Sparks (DEFECT); does NOT set "Needs Redo" (DEFECT). | `reqId` (string) | Mutates store; logs action; saves state | If `reqId` not found, silent no-op return | `src/state/store.js:5309` |
| 8 | Approvals | `approveAllPendingRequests()` | Batch approves all pending approvals currently in queue. | None | Iterates `pendingApprovals` calling `approveParentRequest` | Empty queue returns early without action | `src/state/store.js:5397` |
| 9 | Approvals | `clearAllPendingApprovals()` | Clears all pending approvals, marks logs as rejected, and resets completion flags. | None | Wipes `state.pendingApprovals = []` | Overwrites queue regardless of content | `src/state/store.js:5358` |
| 10 | Currency | `addXP(amount)` | Awards Hero XP to active child, checks for hero level-ups, unlocks milestone trophies. | `amount` (number) | Updates `hero.xp`, `hero.level` | Clamped to positive increments | `src/state/store.js:1250` |
| 11 | Currency | `addPetSparks(petId, amount)` | Awards Sparks to active companion pet, updates `petSparkMap` and `hero.sparks`. | `petId` (string), `amount` (number) | Updates `petSparkMap[id]`, calls `addPetCareXp` | Initializes map if undefined | `src/state/store.js:8295` |
| 12 | Currency | `deductPetSparks(petId, amount)` | Decrements pet sparks safely, clamped at 0. | `petId` (string), `amount` (number) | Updates `petSparkMap[id]`, clamped to `Math.max(0, current - amount)` | Does not drop below 0 | `src/state/store.js:8312` |
| 13 | Currency | `grantScreenTimeBonus(heroId, minutes)` | Parent grants bonus screen time minutes to child bank. | `heroId` (string), `minutes` (number) | Updates `hero.screenTimeMinutes` | Requires valid hero | `src/state/store.js:5407` |
| 14 | Currency | `deductScreenTime(heroId, minutes)` | Parent deducts screen time minutes from child bank. | `heroId` (string), `minutes` (number) | Updates `hero.screenTimeMinutes`, clamped at 0 | Does not drop below 0 | `src/state/store.js:5419` |
| 15 | Shop | `redeemReward(rewardId)` | Child requests a real-world reward in the Shop using accumulated Gold Points. Queues `type: 'reward'` in `pendingApprovals`. | `rewardId` (string) | Enqueues approval; points deducted only upon parent approval | Fails if `hero.points < reward.costPoints` | `src/state/store.js:4788` |
| 16 | Realtime Sync | `startSync(householdCode, callback)` | Starts Firestore `onSnapshot` real-time listener for household document. | `householdCode` (string) | Registers listener; hydrates store on snapshot | Gracefully falls back to offline mode if Firebase unavailable | `src/services/firestoreSyncService.js:251` |
| 17 | Realtime Sync | `pushStateToCloud()` | Debounced push of local state to Firestore document with `{ merge: true }`. | None | Writes Firestore document; updates `household.lastSync` | Handles quota exhaustion and concurrent push queuing | `src/services/firestoreSyncService.js:530` |
| 18 | Realtime Sync | `hydrateFromCloud(cloudData)` | Reconciles inbound Firestore document with local state: merges heroes, logs, and approvals queue. | `cloudData` (object) | Mutates store state; notifies listeners | Contains 45s stale cutoff bug dropping unconfirmed local approvals | `src/state/store.js:6674` |
| 19 | Invariants | `isTaskPendingApproval(taskId, heroId)` | Determines if a task/habit is currently awaiting parent review for a specific child. | `taskId` (string), `heroId` (string) | Returns boolean | Uses narrow `aliasGroup` (only covers dental tasks) | `src/state/store.js:1768` |
| 20 | Invariants | `getTaskCompletionsToday(taskId, heroId)` | Fetches task completion logs for today's date for a specific child. | `taskId` (string), `heroId` (string) | Returns array of log objects | Does NOT filter out `status === 'rejected'` | `src/state/store.js:1802` |

---

## 3. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---|---|---|
| 1 | Parent Rejection (`rejectParentRequest`) | Child submits `morning_brush` (+30 coins, +50 XP, +15 sparks, 15 points pending). Parent taps "Reject". | `logEntry.status` is set to `'rejected'`. Zero points are issued. BUT `hero.coins`, `hero.xp`, and `pet.sparks` remain in the child's balance! Tokens and XP were NOT clawed back. No "Needs Redo" prompt appears. |
| 2 | Parent Approval (`approveParentRequest`) | Parent approves chore with 15 pending points for a child with `screenTimeRate: 2`. | `hero.points` increments by 15. BUT `hero.screenTimeMinutes` also increases by 30 minutes automatically! Direct violation of Gold Points economy rules. |
| 3 | World Map Re-attempt after Denial | Child marks `wp_wake_up` (`make_bed`) on Map. Parent rejects it. Child attempts to redo on Map. | Child taps "COMPLETE HABIT". `completeWaypointChore` checks `this.getTaskCompletionsToday('make_bed', heroId).length > 0`. Because the rejected log exists from today, it returns `{ alreadyCompleted: true }`. Child is permanently blocked from redoing the task today! |
| 4 | Map to Quest Cross-Completion | Child completes `wp_tidy_room` (`clean_room`) on Map. Child immediately opens Quests tab and taps `clean_toys`. | Because `clean_room` and `clean_toys` are not aliased in `isTaskPendingApproval`, Quests does not show it as pending. Child taps `clean_toys` and receives a SECOND auto-issuance of tokens, XP, and another pending approval. Breaks the "one completion payout at a time" invariant. |
| 5 | Multi-Child Shared Device State | Child A completes `make_bed` in Quests. Parent switches profile to Child B. | `toggleTaskForest` set `task.completed = true` on the shared `this.state.taskForest[1]` object. Child B's screen may show the task as completed or altered because catalog objects are shared rather than isolated per child. |
| 6 | Cloud Hydration under Poor Network (> 45s) | Child completes chore offline. Device reconnects after 50 seconds. Cloud snapshot arrives before local write lands. | `hydrateFromCloud` checks `ageMs < 45000`. Since `ageMs = 50000`, the local pending approval is deemed "stale" and dropped from `state.pendingApprovals`. The chore submission disappears completely from the Parent Portal. |
| 7 | Concurrent Sibling Submissions | Child A on Device 1 and Child B on Device 2 submit chores within 100ms. | Device 1 writes `pendingApprovals: [reqA]` to Firestore. Device 2 writes `pendingApprovals: [reqB]` to Firestore. Because Firestore replaces arrays wholesale with `{ merge: true }`, one write clobbers the other in the cloud. Unless repaired by `hydrateFromCloud` (which is fragile under the 45s cutoff), one child's submission is lost. |
| 8 | Rejection Clawback Clamping Floor | Child with 10 coins submits task awarding 30 coins (new balance: 40 coins). Child spends 35 coins in shop on an accessory (new balance: 5 coins). Parent denies task (-30 coins). | Without clamping, `5 - 30 = -25` coins. With proper clamping `Math.max(0, 5 - 30) = 0` coins. (Currently no clawback exists, so balance stays at 5 coins). |

---

## 4. Deep-Dive Code Analysis by Architectural Component

### Component A: Core Store State Engine (`src/state/store.js`)

#### 1. Task & Habit Completion Handlers
There are four primary entry points where kids log or claim tasks and habits:
1. `toggleHabitIsland(habitId)` (`lines 1811–1938`):
   - Habit lookup: `this.state.habitIslands.find(h => h.id === habitId)`
   - Single-completion guard: `this.isTaskPendingApproval(habit.id, heroId)` (Line 1831). Returns early if true with an hourglass notification.
   - Log entry: Unshifts to `this.state.taskCompletionLogs` (`lines 1852–1878`) with `status: 'pending'`, `coinsAwarded`, `pointsAwarded`, `xpAwarded`.
   - Currency auto-issuance:
     - Tokens: `currentHero.coins += finalCoins` (Line 1892)
     - XP: `this.addXP(finalXP)` (Line 1893)
     - Sparks: `this.awardTaskCareSynergy(habit.id, 'habit')` (Line 1894)
   - Queue points: Pushes to `this.state.pendingApprovals` (`lines 1910–1924`).
2. `toggleTaskForest(taskId)` (`lines 1941–2063`):
   - Routine lookup: `this.state.taskForest.find(t => t.id === taskId)`
   - Single-completion guard: `this.isTaskPendingApproval(task.id, heroId)` (Line 1960).
   - Log entry: Unshifts to `this.state.taskCompletionLogs` (`lines 1979–2005`).
   - Currency auto-issuance:
     - Tokens: `currentHero.coins += finalCoins` (Line 2018)
     - XP: `this.addXP(finalXP)` (Line 2019)
     - Sparks: `this.awardTaskCareSynergy(task.id, 'task')` (Line 2020)
   - Queue points: Pushes to `this.state.pendingApprovals` (`lines 2035–2049`).
3. `completeWaypointChore(waypointId)` (`lines 8857–8945`):
   - Waypoint lookup: `PATH_OF_VALOR_WAYPOINTS.find(w => w.id === waypointId)` (Line 8858).
   - Guard: `this.getTaskCompletionsToday(waypoint.choreKey, heroId).length > 0` (Line 8871).
   - **Flaw**: Does NOT check whether previous completion is pending, approved, or rejected.
   - Rewards:
     - Tokens: `hero.coins = (hero.coins || 0) + waypoint.rewardCoins` (Line 8883)
     - XP: `hero.xp = (hero.xp || 0) + waypoint.rewardXp` (Line 8884)
     - Sparks: `this.addPetSparks(pId, waypoint.rewardSparks)` (Line 8885)
     - Points: `const pendingPoints = Math.round(waypoint.rewardCoins / 2)` (Line 8876) — **Hardcoded calculation!**
   - Log entry: Unshifts to `taskCompletionLogs` (`lines 8892–8911`).
   - Queue points: Pushes to `pendingApprovals` (`lines 8914–8928`).
4. Other Task Completion Methods:
   - `claimCompanionHabit(habitKey)` (`lines 2067–2190`): Toddler voice companion claim.
   - `completeChoreWithPhotoProof(taskId, ...)` (`lines 2200–2275`): Photo proof chore.
   - `completeToothbrushBattle(bossId, ...)` (`lines 2350–2530`): Hygiene AR battle.
   - `completePajamasTidyStep()` (`lines 8970–9033`): Bedtime routine step.
   - `completeBedtimeStory(storyData)` (`lines 9105–9234`): Bedtime storybook completion.
   - `completeMovementRoutine(routineId, ...)` (`lines 5621–5725`): Gross motor dino workout.

---

### Component B: Gold Points & Screen Time Disconnect

#### Current Erroneous Implementation in `src/state/store.js`:
In `store.approveParentRequest(reqId)` (`lines 5246–5259`):
```javascript
5246:    if (req.type === 'task_point_approval' || req.type === 'task') {
5247:      const pointsToAward = req.pendingPoints || req.rewardPoints || 10;
5248:      hero.points += pointsToAward;
5249:
5250:      // Screen Time & Privileges Bank conversion: points convert to screen time minutes!
5251:      const rate = hero.screenTimeRate !== undefined ? hero.screenTimeRate : 2;
5252:      const earnedMinutes = pointsToAward * rate;
5253:      hero.screenTimeMinutes = (hero.screenTimeMinutes || 0) + earnedMinutes;
5254:
5255:      if (this.state.selectedHero.id === hero.id) {
5256:        this.state.selectedHero.points = hero.points;
5257:        this.state.selectedHero.screenTimeMinutes = hero.screenTimeMinutes;
5258:      }
```
And log message (`lines 5291–5294`):
```javascript
5291:      this.logAction(
5292:        `Parent verified '${req.title}' for ${req.kidName}`,
5293:        `+${pointsToAward} Points ⭐ & +${earnedMinutes}m Screen Time Credited to Bank`
5294:      );
```

#### Current Erroneous UI in `src/views/ParentPortalView.js`:
In Action Inbox pending item card (`lines 266, 292`):
```javascript
266:      const earnedMinutes = pointsAmount * (kid?.screenTimeRate || 2);
...
292:      <span class="text-tertiary">⭐ Pending Approval: <strong>+${pointsAmount} Gold Points</strong></span> &nbsp;•&nbsp; <span class="text-sky-300 font-black">⏱️ +${earnedMinutes}m Screen Time</span> <span class="text-on-surface-variant font-medium">(Auto-issued +${tokensAmount} Tokens 🪙)</span>
```
And on the Approve button (`line 344`):
```javascript
344:      ${isTaskPointApproval ? `✓ Issue +${pointsAmount} ⭐ (+${earnedMinutes}m ⏱️)` : `✓ Fulfill & Deduct (-${req.costPoints} ⭐)`}
```

#### The Authoritative Specification Requirement:
1. `ORIGINAL_REQUEST.md` Requirement R3:
   > "The exact assigned Gold Points are credited to the child's balance. (CRITICAL: Points are NOT automatically converted into screen time minutes; kids use their earned Gold Points in the shop to purchase screen time or other real-life rewards)."
2. `task_and_currency_lifecycle_rules.md` Invariant 2:
   > "Gold Points: NEVER auto-issued. Only awarded upon explicit parent approval. Gold Points are NOT auto-converted to screen time minutes. Kids use their accumulated Gold Points in the shop to purchase screen time minutes or real-life rewards."
3. Proof from `ShopView.js` (`lines 487–535`) and `store.js` (`lines 302–343`):
   - The shop already contains real-life reward items like `screen_time_30` ("30 Mins Screen Time" for 50 Gold Points ⭐). Kids exchange their points for screen time deliberately in the shop, not automatically upon chore approval.

**Required Action**: Remove lines 5250–5254 and 5257 in `src/state/store.js`. Update `ParentPortalView.js` to remove `+${earnedMinutes}m Screen Time` from the approval card and button.

---

### Component C: `pendingApprovals` Schema Comparison

#### Specification Contract (Required by `ORIGINAL_REQUEST.md` R2):
```json
{
  "id": "task_chore_make_bed_1729000000000",
  "logId": "compl_abc1234",
  "kidId": "hero_1",
  "kidName": "Little Hero",
  "type": "task_point_approval",
  "taskId": "make_bed",
  "taskTitle": "Make Your Hero Bed",
  "zone": "Task Forest",
  "tokensAwarded": 20,
  "xpAwarded": 30,
  "sparksAwarded": 15,
  "pendingPoints": 10,
  "timestamp": "2026-10-15T15:00:00.000Z",
  "status": "pending"
}
```

#### Actual Code Implementation Across Push Sites:

| Push Location | `id` | `logId` | `kidId` | `kidName` | `type` | `taskId` | `taskTitle` | `zone` | `tokensAwarded` | `xpAwarded` | `sparksAwarded` | `pendingPoints` | `status` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `toggleHabitIsland` (`store.js:1910`) | ✅ | ✅ | ✅ | ✅ | `'task_point_approval'` | ✅ | ❌ (`title`) | `'Habit Islands'` | ✅ (`finalCoins`) | ❌ **Missing** | ❌ **Missing** | ✅ | `'pending'` |
| `toggleTaskForest` (`store.js:2035`) | ✅ | ✅ | ✅ | ✅ | `'task_point_approval'` | ✅ | ❌ (`title`) | `'Task Forest'` | ✅ (`finalCoins`) | ❌ **Missing** | ❌ **Missing** | ✅ | `'pending'` |
| `claimCompanionHabit` (`store.js:2169`) | ✅ | ✅ | ✅ | ✅ | `'task_point_approval'` | ✅ | ❌ (`title`) | `'Habit Islands'`/`'Task Forest'` | ✅ | ❌ **Missing** | ❌ **Missing** | ✅ | `'pending'` |
| `completeChoreWithPhotoProof` (`store.js:2254`) | ✅ | ✅ | ✅ | ✅ | `'task_point_approval'` | ✅ | ❌ (`title`) | ✅ | ✅ | ❌ **Missing** | ❌ **Missing** | ✅ | `'pending'` |
| `completeToothbrushBattle` (`store.js:2508`) | ✅ | ✅ | ✅ | ✅ | `'task_point_approval'` | ✅ | ❌ (`title`) | `'Hygiene AR Battle'` | ✅ | ❌ **Missing** | ❌ **Missing** | ✅ | `'pending'` |
| `completeMovementRoutine` (`store.js:5709`) | ✅ | ✅ | ✅ | ✅ | `'task_point_approval'` | ✅ | ❌ (`title`) | `'Gross Motor & Dance Party'` | ✅ | ❌ **Missing** | ❌ **Missing** | ✅ | `'pending'` |
| `completeWaypointChore` (`store.js:8914`) | ✅ | ✅ | ✅ | ✅ | `'task_point_approval'` | ✅ | ❌ (`title`) | `"Today's Path"` | ✅ | ❌ **Missing** | ❌ **Missing** | ✅ | `'pending'` |
| `completePajamasTidyStep` (`store.js:9011`) | ✅ | ✅ | ✅ | ✅ | `'task_point_approval'` | ✅ | ❌ (`title`) | `'Bedtime Sanctuary'` | ✅ | ❌ **Missing** | ❌ **Missing** | ✅ | `'pending'` |
| `completeBedtimeStory` (`store.js:9171`) | ✅ | ✅ | ✅ | ✅ | `'task_point_approval'` | ✅ | ❌ (`title`) | `'Bedtime Sanctuary'` | ✅ | ❌ **Missing** | ❌ **Missing** | ✅ | `'pending'` |

#### Impact of Missing Fields:
1. `xpAwarded` & `sparksAwarded` are completely absent in `pendingApprovals` items. When a parent rejects a request, `rejectParentRequest` cannot know how many XP or Sparks were granted without querying `taskCompletionLogs`. Storing them directly on the approval object is required.
2. The property was keyed as `title` rather than `taskTitle`. To ensure zero breakage across legacy components, both `taskTitle: title` and `title: title` should be provided.

---

### Component D: Parent Denial & Approval Flow

#### 1. Rejection / Denial Flow Analysis (`src/state/store.js:5309–5350`)
Let us inspect `rejectParentRequest(reqId)` verbatim:
```javascript
5309:  rejectParentRequest(reqId) {
5310:    const reqIndex = this.state.pendingApprovals.findIndex(r => r.id === reqId);
5311:    if (reqIndex === -1) return;
5312:    const req = this.state.pendingApprovals[reqIndex];
5313:
5314:    if (req.type === 'task_point_approval' || req.type === 'task') {
5315:      const nowIso = new Date().toISOString();
5316:      if (this.state.taskCompletionLogs) {
5317:        const logEntry = this.state.taskCompletionLogs.find(l => 
5318:          (req.logId && l.id === req.logId) || 
5319:          (l.approvalRequestId === req.id) ||
5320:          (l.taskId === req.taskId && l.heroId === req.kidId && l.status === 'pending')
5321:        );
5322:        if (logEntry) {
5323:          logEntry.status = 'rejected';
5324:          logEntry.rejectedAt = nowIso;
5325:        }
5326:      }
5327:
5328:      if (req.taskId) {
5329:        const habit = this.state.habitIslands.find(h => h.id === req.taskId);
5330:        if (habit) {
5331:          habit.completed = false;
5332:          habit.pointsApproved = false;
5333:        }
5334:        const task = this.state.taskForest.find(t => t.id === req.taskId);
5335:        if (task) {
5336:          task.completed = false;
5337:          task.pointsApproved = false;
5338:        }
5339:      }
5340:      this.logAction(`Parent rejected Point Approval for '${req.title}' (${req.kidName})`, `0 Points ⭐ Issued`);
5341:    } else if (req.type === 'reward') {
5342:      this.logAction(`Parent declined reward '${req.title}' for ${req.kidName}`, `0 Points Deducted`);
5343:    }
5344:
5345:    this.state.pendingApprovals.splice(reqIndex, 1);
5346:    this.markApprovalResolved(req.id);
5347:    Sound.click();
5348:    this.saveState(true);
5349:  }
```

#### Deficiencies Identified:
1. **No Hero Balance Deduction**: The function does not even look up `hero = this.state.heroes.find(h => h.id === req.kidId)`.
2. **Missing Tokens Clawback**:
   - Required: `hero.coins = Math.max(0, (hero.coins || 0) - (req.tokensAwarded || 0))`
3. **Missing Hero XP Clawback**:
   - Required: `hero.xp = Math.max(0, (hero.xp || 0) - (req.xpAwarded || 0))`
4. **Missing Pet Sparks Clawback**:
   - Required: Deduct sparks from active companion pet, clamped to 0:
     `this.deductPetSparks(hero.activePetId, req.sparksAwarded || 0)`
5. **No "Needs Redo" State**:
   - Neither `DashboardView.js` nor `WorldAdventureMapView.js` displays a "Needs Redo" badge or prompt when a chore was rejected.
   - The state must track rejected tasks/habits per child (e.g., in a `needsRedoMap` or by querying today's latest rejected log) so the UI can render:
     - In Quests: A gentle amber/coral "Needs Redo ⚠️" badge with an encouraging nudge.
     - On World Map: The waypoint stop reflects "Needs Redo" and allows immediate re-attempt.

---

### Component E: Single Completion Invariant & Map-to-Quest Parity

#### 1. Inconsistent Task Aliases
In `src/state/store.js:1770–1783`:
```javascript
1770:    const aliasGroup = (id) => {
1771:      if (id === 'bedtime_brush' || id === 'brush_teeth_pm' || id === 'wp_night_teeth' || id === 'sugar_fortress_night_showdown') {
1772:        return ['bedtime_brush', 'brush_teeth_pm', 'wp_night_teeth', 'sugar_fortress_night_showdown'];
1773:      }
1774:      if (id === 'morning_brush' || id === 'brush_teeth_am' || id === 'wp_morning_teeth') {
1775:        return ['morning_brush', 'brush_teeth_am', 'wp_morning_teeth'];
1776:      }
1777:      return [id];
1778:    };
```
Notice that ONLY morning and bedtime tooth brushing have alias groups!
Compare all 8 World Map waypoints with Quests:
1. `wp_wake_up`: `choreKey: 'make_bed'`. Quests has `make_bed`. Aliased? No.
2. `wp_morning_teeth`: `choreKey: 'brush_teeth_am'`. Quests has `morning_brush`. Aliased? Yes.
3. `wp_hydration`: `choreKey: 'drink_water'`. Quests has `drink_water`. Aliased? No.
4. `wp_tidy_room`: `choreKey: 'clean_room'`. Quests has `clean_toys`. Aliased? **NO! Mismatched ID (`clean_room` vs `clean_toys`)!**
5. `wp_homework`: `choreKey: 'homework'`. Quests has `homework_reading`. Aliased? **NO! Mismatched ID (`homework` vs `homework_reading`)!**
6. `wp_workout`: `choreKey: 'exercise'`. Quests has no routine with ID `exercise`. Aliased? No.
7. `wp_night_teeth`: `choreKey: 'brush_teeth_pm'`. Quests has `toothbrush_adventure_battle` or `bedtime_brush`. Aliased? Partially.
8. `wp_bedtime`: `choreKey: 'sleep_on_time'`. Quests has `night_bedtime`. Aliased? **NO! Mismatched ID (`sleep_on_time` vs `night_bedtime`)!**

#### 2. Disconnected Hardcoded Rewards on World Map
In `PATH_OF_VALOR_WAYPOINTS` (`src/data/worldMapData.js:59–196`):
- Each waypoint has static `rewardCoins`, `rewardXp`, `rewardSparks`.
- In `completeWaypointChore(waypointId)` (`store.js:8857`):
  - Tokens awarded: `waypoint.rewardCoins`
  - XP awarded: `waypoint.rewardXp`
  - Sparks awarded: `waypoint.rewardSparks`
  - Points awarded: `Math.round(waypoint.rewardCoins / 2)`
- If a parent opens the Parent Portal and adjusts `Make Bed` to 35 Tokens and 20 Points:
  - Quests reflects 35 Tokens and 20 Points.
  - The World Map STILL awards 15 Tokens, 10 XP, and 8 Points!
  - **Spec Requirement R1**: "Map waypoints must dynamically inherit the exact parent-configured reward values (Tokens, Points, XP, Sparks) defined in the Parent Portal settings, eliminating all disconnected hardcoded values."

#### 3. Waypoint Done Check Locks Out Re-dos
In `WorldAdventureMapView.js:522–530`:
```javascript
522: function isWaypointDone(wp, hero) {
528:   const heroId = hero?.id || store.getState().selectedHero?.id;
529:   return store.getTaskCompletionsToday(wp.choreKey, heroId).length > 0;
530: }
```
And in `store.completeWaypointChore` (`store.js:8871`):
```javascript
8871:  if (this.getTaskCompletionsToday(waypoint.choreKey, heroId).length > 0) {
8872:    return { success: false, alreadyCompleted: true, waypoint };
8873:  }
```
`getTaskCompletionsToday` checks all logs for today without checking `status !== 'rejected'`. When a chore is rejected by a parent, it remains in `taskCompletionLogs` with `status: 'rejected'`. Thus, `isWaypointDone` continues returning `true`, and `completeWaypointChore` refuses to run!

---

### Component F: Realtime Household Sync & Multi-Child Isolation

#### 1. The 45-Second Stale Cutoff Bug
In `src/state/store.js:7293–7305`:
```javascript
7293:      const unconfirmedLocal = (this.state.pendingApprovals || []).filter((localReq) => {
7294:        if (!localReq || !localReq.id) return false;
7295:        if (resolvedIds.has(localReq.id)) return false;
7296:        const inCloud = cloudData.pendingApprovals.some((c) => c.id === localReq.id);
7297:        if (inCloud) return false;
7298:        // A request timestamped in the same millisecond as this check (age 0)
7299:        // is exactly as "unconfirmed and recent" as one a few ms old -- on a
7300:        // fast machine (e.g. CI) this is common, not an edge case, so the
7301:        // lower bound must be inclusive or a just-created request gets
7302:        // wrongly treated as stale and dropped.
7303:        const ageMs = localReq.timestamp ? (Date.now() - new Date(localReq.timestamp).getTime()) : 0;
7304:        return ageMs >= 0 && ageMs < 45000;
7305:      });
```
- **Analysis**:
  - The comment claims this check prevents stale requests from returning.
  - BUT if a kid's tablet is offline for 60 seconds after completing a chore, or if network latency delays sync, `ageMs >= 45000`.
  - When the cloud snapshot arrives, this request is discarded!
  - `ORIGINAL_REQUEST.md` R2 explicitly requires:
    > "Zero-Drop Persistence: Pending approvals must remain in the Parent Portal indefinitely until a parent explicitly taps Approve or Deny. Remove all arbitrary time limits (including the 45-second stale cutoff in cloud hydration) and protect against array clobbering from concurrent device snapshots."
  - The correct resolution mechanism is already implemented via `resolvedApprovals` (`resolvedIds.has(localReq.id)`). If an item has NOT been resolved (neither approved nor rejected), it MUST NOT be dropped simply because 45 seconds have passed!

#### 2. Array Clobbering During Concurrent Submissions
- When two kids on separate tablets submit tasks at the same time:
  - Device A writes `{ pendingApprovals: [reqA] }`
  - Device B writes `{ pendingApprovals: [reqB] }`
  - Firestore `{ merge: true }` does NOT union arrays; it replaces the array with the payload of whichever write reaches Firestore second.
  - Device A receives snapshot with `[reqB]`.
  - Device A's `hydrateFromCloud` must preserve `reqA` (as an unconfirmed local request) AND immediately trigger `this.syncService.pushStateToCloud()` so the cloud doc becomes `[reqA, reqB]`.
  - Without the 45-second restriction, `unconfirmedLocal` correctly retains `reqA` and triggers the repair push.

---

## 5. Concrete Recommendations & Action Plan

### 1. Store State Engine Overhaul (`src/state/store.js`)
1. **Fix `approveParentRequest`**:
   - Delete automatic screen time conversion (`lines 5250–5254, 5257`).
   - Only increment `hero.points += pointsToAward`.
   - Update `logAction` to only report Points awarded.
2. **Implement Full `rejectParentRequest` Flow**:
   - Lookup `hero = this.state.heroes.find(h => h.id === req.kidId) || this.state.selectedHero`.
   - Claw back Tokens with 0 floor:
     `hero.coins = Math.max(0, (hero.coins || 0) - (req.tokensAwarded || 0))`
     `hero.tokens = hero.coins`
   - Claw back Hero XP with 0 floor:
     `hero.xp = Math.max(0, (hero.xp || 0) - (req.xpAwarded || 0))`
   - Claw back Pet Sparks with 0 floor:
     `if (req.sparksAwarded && hero.activePetId) this.deductPetSparks(hero.activePetId, req.sparksAwarded)`
   - Set "Needs Redo" flag/map on hero or state for this task.
   - Record `status = 'rejected'` in `taskCompletionLogs`.
   - Remove from `pendingApprovals` and call `markApprovalResolved(req.id)`.
3. **Standardize `pendingApprovals` Payload**:
   - In all task/chore/habit/waypoint methods, push:
     ```javascript
     {
       id: approvalReqId,
       logId: logId,
       kidId: hero.id,
       kidName: hero.name,
       type: 'task_point_approval',
       taskId: taskId,
       taskTitle: title,
       title: title,
       zone: zone,
       tokensAwarded: tokens,
       xpAwarded: xp,
       sparksAwarded: sparks,
       pendingPoints: points,
       date: formattedTime,
       timestamp: nowIso,
       status: 'pending'
     }
     ```
4. **Remove 45-Second Stale Cutoff in `hydrateFromCloud`**:
   - In `line 7304`, change:
     ```javascript
     // Remove arbitrary ageMs < 45000 limit
     return true;
     ```
     An unconfirmed local request should be preserved as long as it has not been marked resolved in `resolvedIds`.
5. **Harmonize Map Waypoint & Quests Chore IDs & Dynamic Rewards**:
   - Create comprehensive bidirectional alias mapping covering all 8 waypoints:
     - `make_bed` <-> `wp_wake_up`
     - `morning_brush` <-> `brush_teeth_am` <-> `wp_morning_teeth`
     - `drink_water` <-> `wp_hydration`
     - `clean_toys` <-> `clean_room` <-> `wp_tidy_room`
     - `homework_reading` <-> `homework` <-> `wp_homework`
     - `exercise` <-> `wp_workout`
     - `brush_teeth_pm` <-> `bedtime_brush` <-> `wp_night_teeth` <-> `sugar_fortress_night_showdown`
     - `night_bedtime` <-> `sleep_on_time` <-> `wp_bedtime`
   - In `completeWaypointChore` and Map UI, dynamically look up the reward tokens, points, XP, and sparks configured by the parent in `this.state.taskForest` or `this.state.habitIslands`.
   - Ensure completing on Map calls the unified routine logic or marks the corresponding Quest task/habit as pending/completed.
   - Ensure `isTaskPendingApproval` checks the unified aliases so double-claim is impossible.
6. **Support Active Cycle & "Needs Redo" State in Views**:
   - Update `DashboardView.js` to render a "Needs Redo" badge when a task was recently rejected.
   - Update `WorldAdventureMapView.js` to exclude rejected logs from `isWaypointDone` so the child can re-attempt the waypoint.
7. **Clean Parent Portal Action Inbox**:
   - In `ParentPortalView.js`, display exact Tokens, Hero XP, Pet Sparks, and Pending Gold Points.
   - Remove `+${earnedMinutes}m Screen Time` from the card and approval button.

---

## 6. Verification Status

- Build check (`npm run build`): **PASSED** (Exit code 0, 39s compile time).
- Multi-child isolation test (`node scratch/verify_two_kids_same_task.mjs`): **PASSED** (Exit code 0).
- Approvals sync test (`node scratch/verify_approval_sync_across_devices.js`): **PASSED** (Exit code 0).
- Routine pipeline test (`node scratch/verify_routine_approvals_pipeline.mjs`): **PASSED** (Exit code 0).
