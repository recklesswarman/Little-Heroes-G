# Little Hero Adventures: Realtime Cloud Sync & Storage Engine Investigation Report

**Investigation Date**: 2026-10-15  
**Investigator**: Realtime Sync and Storage Explorer (`explorer_survey_2_gen2`)  
**Target Codebase**: `c:\APP\stitch_little_hero_adventures`  
**Primary Focus**: Firestore Realtime Sync, LocalStorage Persistence, 45-Second Stale Cutoff, Concurrent Snapshot Array Clobbering, Multi-Child Isolation, Reversible Currency Lifecycle, and Map/Quest Parity.

---

## Executive Summary

A comprehensive, read-only architectural investigation was conducted across the synchronization, persistence, state management, and view components of *Little Hero Adventures*. The authoritative sources of truth for cloud sync and state management are:
- `src/services/firestoreSyncService.js` (Firestore `onSnapshot` listener, push orchestration, presence, quota management, and BroadcastChannel)
- `src/state/store.js` (State tree, local persistence in `localStorage`, field-level conflict resolution, task/habit completion pipelines, parent approval/denial handlers, and cloud hydration in `hydrateFromCloud`)
- `src/views/DashboardView.js` & `src/views/WorldAdventureMapView.js` (Quests & World Map task completion trigger views)
- `src/views/ParentPortalView.js` (Parent Action Inbox & chore configuration)

### Key Findings:
1. **The 45-Second Stale Cutoff**: Located in `src/state/store.js` at line 7304. An explicit age check `ageMs >= 0 && ageMs < 45000` inside `hydrateFromCloud()` permanently discards unconfirmed local pending approvals older than 45 seconds during cloud hydration. This causes pending approvals to vanish if a child submits while offline, backgrounded, on a slow network, or when parent portal reconnects after 45 seconds.
2. **Concurrent Snapshot Array Clobbering**: In Firestore, `setDoc(docRef, data, { merge: true })` deep-merges nested map objects (such as `heroesMap`), but **replaces array fields wholesale**. When two siblings submit tasks concurrently from separate devices, the second device's push overwrites the cloud `pendingApprovals` array. While a recovery mechanism exists in `hydrateFromCloud()`, it is crippled by the 45-second stale cutoff and non-immediate debounced repair pushes (`pushStateToCloud()` instead of `pushStateToCloud(true)`).
3. **Multi-Child Isolation Leaks (Pet Sparks & Pet Spark Map)**: While `coins`, `points`, `tokens`, and `xp` are isolated per hero and stamped with monotonic timestamps, `sparks` (Pet XP) is completely omitted from `HERO_STAMPED_FIELDS`, omitted from `heroesMap` serialization in `firestoreSyncService.js`, and omitted from `syncSelectedHeroWithHeroes()`. Furthermore, `petSparkMap` is stored as a shared household-level map at the root of state, leaking companion pet progress between siblings.
4. **Permanent Task Lockout on Denial (`getTaskCompletions` Bug)**: In `src/state/store.js`, `getTaskCompletions(taskId, heroId)` does not filter out `l.status === 'rejected'`. When a parent denies a task, the completion log is marked `'rejected'`, but `getTaskCompletionsToday()` still returns the rejected log. Both the Dashboard and World Map treat this as "already done today", blocking the child from seeing a "Needs Redo" prompt or resubmitting the chore.
5. **Missing Reversible Currency Clawback**: In `src/state/store.js` line 5309 (`rejectParentRequest`), parent rejection sets `logEntry.status = 'rejected'` but **fails to deduct** the auto-issued Tokens, Hero XP, or Pet Sparks from the child's balance.
6. **Disallowed Point-to-Screentime Auto-Conversion**: In `src/state/store.js` line 5250 (`approveParentRequest`), approving a point request automatically converts Gold Points into screen time minutes (`hero.screenTimeMinutes += pointsToAward * rate`), violating requirement R3 (points must remain spendable currency in the shop).
7. **Map Waypoints Disconnected from Parent Portal Settings**: In `src/state/store.js` line 8857 (`completeWaypointChore`), waypoints use hardcoded reward values from `PATH_OF_VALOR_WAYPOINTS` (e.g. `pendingPoints = Math.round(waypoint.rewardCoins / 2)`) instead of dynamically reading parent-configured reward settings from `taskForest` / `habitIslands`.

---

## Part 1: Cloud Sync & Storage Engine Architecture

### 1.1 Architecture Overview

```
                                  +-------------------------------------+
                                  |     Firestore Cloud Database        |
                                  |   households/{HOUSEHOLD_CODE}       |
                                  +-------------------------------------+
                                             ^               |
                     setDoc({merge: true})   |               | onSnapshot
                     pushStateToCloud()      |               | (real-time stream)
                                             |               v
+----------------------------------------------------------------------------------------------------+
|                                    FirestoreSyncService                                            |
|  - deviceId / sessionId tracking                     - 350ms coalesced write debouncer             |
|  - Multi-tab instant sync (BroadcastChannel)         - Presence heartbeat & revocation             |
+----------------------------------------------------------------------------------------------------+
                                             ^               |
                      saveState(true)        |               | hydrateFromCloud(cloudData)
                                             |               v
+----------------------------------------------------------------------------------------------------+
|                                         Store (store.js)                                           |
|  - localStorage: 'little_heroes_adventure_master_v8'                                               |
|  - Field-level timestamp merge: HERO_STAMPED_FIELDS + resolve()                                    |
|  - Completion & Ledger Logs merge: logMap (terminal resolved states)                               |
|  - Pending Approvals Queue: freshCloudPending + unconfirmedLocal                                   |
|  - Reactive UI subscribers: store.notify()                                                         |
+----------------------------------------------------------------------------------------------------+
```

### 1.2 Files Handling Sync and Storage

| File Path | Role | Key Functions / Symbols |
|---|---|---|
| `src/services/firestoreSyncService.js` | Firestore Realtime Driver | `startSync`, `stopSync`, `pushStateToCloud`, `_doPush`, `broadcastState`, `handleBroadcastMessage`, `revokeDevice`, `pingDevicePresence`, `markQuotaExhausted` |
| `src/state/store.js` | Authoritative State Tree & Local Storage | `saveState`, `loadState`, `hydrateFromCloud`, `stampHeroFieldChanges`, `resetHeroFieldBaseline`, `syncSelectedHeroWithHeroes`, `switchHero`, `approveParentRequest`, `rejectParentRequest`, `completeWaypointChore`, `toggleTaskForest`, `toggleHabitIsland` |
| `src/config/firebase.js` | Firebase SDK Initialization | `db`, `app`, `functions`, `isFirebaseAvailable` |
| `src/services/persistentLinkService.js` | Household Session Continuity | `slideWindow`, `clearSession`, `restoreSession` |

### 1.3 Firestore Document Structure (`households/{syncCode}`)
The cloud document contains:
- `syncCode`: String household code (e.g. `HERO-TEST`, `HERO-4921`).
- `householdName`: Family display name.
- `heroesMap`: Map of child profiles keyed by `heroId` (e.g. `heroesMap.hero_1`). Each entry contains all hero stats plus `fieldStamps` (timestamps per field).
- `heroes`: Array of hero objects (mirrors `heroesMap`).
- `pendingApprovals`: Array of approval requests waiting for parent action.
- `resolvedApprovals`: Array of `{ id, at }` records (capped at 300) tracking already resolved requests.
- `taskCompletionLogs`: Array of completion logs (capped at 300) with status `'pending'`, `'approved'`, or `'rejected'`.
- `taskLedgerLogs`: Array of historical audit ledger strings.
- `taskForest` & `habitIslands`: Catalog arrays containing chore definitions, icons, and parent-configured coin/point values.
- `devices`: Map of registered devices (`deviceId`, `name`, `lastSeen`, `revoked`).
- `revokedDeviceIds`: Array of revoked device strings.
- `stateSnapshot`: Generic snapshot of non-local state keys.

---

## Part 2: The 45-Second Stale Cutoff in Cloud Hydration

### 2.1 Code Location & Verbatim Extract
In `src/state/store.js`, lines 7293 to 7305 inside `hydrateFromCloud(cloudData)`:

```javascript
7293:       const unconfirmedLocal = (this.state.pendingApprovals || []).filter((localReq) => {
7294:         if (!localReq || !localReq.id) return false;
7295:         if (resolvedIds.has(localReq.id)) return false;
7296:         const inCloud = cloudData.pendingApprovals.some((c) => c.id === localReq.id);
7297:         if (inCloud) return false;
7298:         // A request timestamped in the same millisecond as this check (age 0)
7299:         // is exactly as "unconfirmed and recent" as one a few ms old -- on a
7300:         // fast machine (e.g. CI) this is common, not an edge case, so the
7301:         // lower bound must be inclusive or a just-created request gets
7302:         // wrongly treated as stale and dropped.
7303:         const ageMs = localReq.timestamp ? (Date.now() - new Date(localReq.timestamp).getTime()) : 0;
7304:         return ageMs >= 0 && ageMs < 45000;
7305:       });
```

And lines 7324-7325:
```javascript
7324:       this.state.pendingApprovals = [...freshCloudPending, ...unconfirmedLocal];
7325:     }
```

### 2.2 Mechanism of Failure & Impact on `pendingApprovals`
1. **Calculation**: `ageMs` is computed as `Date.now() - new Date(localReq.timestamp).getTime()`.
2. **Filter Predicate**: If `ageMs >= 45000` (meaning 45 seconds have passed since the request was created locally), `return ageMs >= 0 && ageMs < 45000` evaluates to **`false`**.
3. **Permanent Deletion**:
   - `localReq` is filtered out of `unconfirmedLocal`.
   - Because `localReq` was not yet in `cloudData.pendingApprovals` (which is why `inCloud` was `false`), `localReq` is **not** in `freshCloudPending` either.
   - When `this.state.pendingApprovals = [...freshCloudPending, ...unconfirmedLocal]` is assigned, `localReq` is completely excised from state.
   - At line 7349, this truncated state is saved to `localStorage`.
   - `localReq` has vanished from the device without ever reaching the parent or being resolved.
4. **Real-World Scenarios Triggering This Drop**:
   - **Offline / Spotty Network**: A child finishes their bedtime teeth-brushing or tidying chores while Wi-Fi is temporarily disconnected. They leave the app open or lock the tablet. 50 seconds later, Wi-Fi reconnects and Firestore fires an `onSnapshot`. Because `ageMs > 45000`, the chore approval is dropped.
   - **Background Tab / Mobile Sleep**: The child completes a chore on an iPad or phone and switches apps. The browser suspends JavaScript. When the child or parent unlocks the device 2 minutes later, the snapshot arrives, `ageMs > 45000`, and the request is dropped.
   - **Concurrent Sibling Submissions**: Sibling A submits a chore. Sibling B submits a chore 50 seconds later. Sibling B's push overwrites Firestore's `pendingApprovals` array. Sibling A's tablet receives the snapshot. Sibling A sees that Sibling A's chore is missing from the cloud snapshot, checks `ageMs < 45000`, finds it is 51 seconds old, and drops it instead of pushing a repair.

### 2.3 Required Remediation
Remove `ageMs < 45000` unconditionally:
```javascript
const unconfirmedLocal = (this.state.pendingApprovals || []).filter((localReq) => {
  if (!localReq || !localReq.id) return false;
  if (resolvedIds.has(localReq.id)) return false;
  const inCloud = cloudData.pendingApprovals.some((c) => c.id === localReq.id);
  if (inCloud) return false;
  return true; // Zero-Drop: persist indefinitely until explicitly resolved!
});
```

---

## Part 3: Synchronization Mechanism Across Devices via `onSnapshot`

### 3.1 Real-Time Snapshot Listener Lifecycle
In `src/services/firestoreSyncService.js`:
- `startSync(householdCode, onInitialSync)` (lines 251-361):
  - Resolves `doc(db, "households", code)`.
  - Attaches `onSnapshot(docRef, (snapshot) => { ... })`.
  - Dedupes session writes via `cloudData.lastWriterSessionId === this.sessionId` (line 302). If the writer was this exact tab session, re-hydration is bypassed to prevent redundant UI churn.
  - For all other sessions and remote devices, invokes `store.hydrateFromCloud(cloudData)` (line 322).
  - Keeps the listener permanently open even if quota warnings occur (`markQuotaExhausted` pauses write pushes but leaves snapshot reads active).

### 3.2 Balance Synchronization & Field-Level Timestamp Resolution
In `src/state/store.js`:
- `HERO_STAMPED_FIELDS` (line 63):
  `['points', 'coins', 'tokens', 'xp', 'level', 'xpNext', 'screenTimeMinutes', 'activePetId']`
- On every mutation or save:
  `stampHeroFieldChanges()` (lines 549-563) checks each hero's stamped fields against `_heroFieldBaseline`. If any field differs, `hero.fieldStamps[field] = Date.now()`.
- During cloud hydration (`hydrateFromCloud`, lines 6832-6852):
  ```javascript
  const resolve = (field, cloudValue, legacyValue) => {
    const ls = Number(localStamps[field]) || 0;
    const cs = Number(cloudStamps[field]) || 0;
    if (!ls && !cs) return legacyValue;
    fieldStamps[field] = Math.max(ls, cs);
    if (localH && ls > cs) {
      if (String(localH[field] ?? '') !== String(cloudValue ?? '')) repairPushNeeded = true;
      return localH[field];
    }
    return cloudValue !== undefined ? cloudValue : localH?.[field];
  };
  ```
  This guarantees that whichever device made the newer modification to `coins`, `points`, `tokens`, or `xp` wins, and if local is newer than cloud, a `repairPushNeeded` push updates the cloud.

### 3.3 Critical Omission: Pet Sparks
Notice that `sparks` (and `evolutionSparks`) is **absent** from `HERO_STAMPED_FIELDS`!
- When a child earns sparks from chores or pet care, `hero.sparks` is mutated without a timestamp stamp.
- In `hydrateFromCloud`, `sparks` is not resolved via `resolve()`.
- If Child A earns sparks and Child B's device pushes an older hero snapshot, Child A's sparks are silently clobbered.

---

## Part 4: Race Conditions and Array Clobbering

### 4.1 Firestore Document Merging Behavior: Map vs. Array
Firestore's `setDoc(docRef, data, { merge: true })` behaves fundamentally differently for nested Maps vs. Arrays:
- **Nested Maps (`heroesMap`, `devices`)**:
  Deep-merged key-by-key. If Device A writes `{ heroesMap: { hero_1: { points: 10 } } }` and Device B writes `{ heroesMap: { hero_2: { points: 20 } } }`, the resulting document in Firestore contains **both** `hero_1` and `hero_2`.
- **Arrays (`pendingApprovals`, `taskCompletionLogs`, `heroes`)**:
  **Replaced wholesale**. If Device A writes `{ pendingApprovals: [Req_A] }` and Device B writes `{ pendingApprovals: [Req_B] }`, Firestore overwrites the array with `[Req_B]`. `Req_A` is discarded on the server.

### 4.2 The Repair Push Mechanism and Its Vulnerabilities
To protect against array clobbering, `hydrateFromCloud()` implements a local reconciliation logic:
1. When Device A receives Device B's snapshot containing `[Req_B]`:
2. Device A inspects its local `pendingApprovals` (`[Req_A]`).
3. Device A identifies that `Req_A` is not in `cloudData.pendingApprovals` and not in `resolvedIds`.
4. Device A constructs the union: `[Req_B, Req_A]`.
5. Device A flags `repairPushNeeded = true` (line 7322).
6. At line 7358, Device A calls `this.syncService.pushStateToCloud()`.

**The Three Failure Modes in the Repair Pipeline**:
1. **The 45-Second Timeout**: If `Req_A` was timestamped >= 45 seconds ago, step 3 fails, `Req_A` is discarded, and no repair push is made.
2. **Debounced Repair Race**: Line 7359 calls `pushStateToCloud()` without the `immediate=true` argument. This queues a 350ms setTimeout (`CLOUD_SYNC_DEBOUNCE_MS`). If Device B, Device C, or the Parent Portal pushes any state during that 350ms window, Device A's coalesced push can be delayed or superseded.
3. **Offline Inability to Repair**: If Device A is closed or disconnected immediately after submission, the server is left with only `[Req_B]`. If the Parent Portal connects before Device A comes back online, the Parent Portal sees only `Req_B`. When Device A finally reconnects, if more than 45 seconds have elapsed, Device A's cutoff deletes `Req_A`.

---

## Part 5: Multi-Child Data Isolation by `heroId`

### 5.1 Hero Architecture
The state model uses:
- `state.heroes`: Array of all children in the household.
- `state.selectedHero`: The child currently active on the local device.
- `state.selectedKidId`: ID of the active child.

When switching children on a shared device:
- `switchHero(heroId)` (lines 5797-5853):
  1. Calls `this.syncSelectedHeroWithHeroes()` to flush the current `selectedHero` back into `state.heroes[idx]`.
  2. Finds the target hero in `state.heroes`.
  3. Populates `state.selectedHero` with target hero's properties.
  4. Saves state to `localStorage` and pushes to cloud.

### 5.2 Identified Isolation Leaks & Collisions

#### Leak 1: Pet Sparks & `petSparkMap`
- In `store.js` line 8295 (`addPetSparks`):
  ```javascript
  const id = String(petId || this.state.selectedHero?.activePetId || '1');
  if (!this.state.petSparkMap) this.state.petSparkMap = {};
  const current = this.getPetSparks(id);
  const next = current + amount;
  this.state.petSparkMap[id] = next;
  if (this.state.selectedHero) {
    this.state.selectedHero.sparks = next;
    this.state.selectedHero.evolutionSparks = next;
  }
  ```
- **The Defect**:
  - `this.state.petSparkMap` is stored at the root of `state` keyed **only by `petId`**, NOT by `heroId`.
  - In `syncSelectedHeroWithHeroes()` (lines 1062-1117): `sHero.sparks` and `sHero.evolutionSparks` are **not saved** to `updatedHero`!
  - In `switchHero(heroId)` (lines 5797-5850): `selectedHero.sparks` is **not restored** from `hero.sparks`!
  - If Child A and Child B both adopt Pet 1, Child A earning sparks sets `petSparkMap['1'] = 45`. When switching to Child B, Child B sees `petSparkMap['1'] = 45` instead of their own separate pet progression.

#### Leak 2: `getTaskCompletions` Counting Rejected Tasks
- In `store.js` line 1785 (`getTaskCompletions`):
  ```javascript
  getTaskCompletions(taskId, heroId = null) {
    const kidId = heroId || this.state.selectedHero?.id;
    ...
    return (this.state.taskCompletionLogs || []).filter(
      (l) => targetIds.includes(l.taskId) && (!kidId || l.heroId === kidId)
    );
  }
  ```
- **The Defect**:
  - It filters only by `taskId` and `heroId`. It does **not** check `l.status`!
  - When a parent denies a chore, `rejectParentRequest` sets `logEntry.status = 'rejected'`.
  - In `DashboardView.js` line 322: `store.getTaskCompletionsToday(h.id, hero.id)` counts the rejected log.
  - In `WorldAdventureMapView.js` line 529: `isWaypointDone(wp, hero)` counts the rejected log.
  - The task is rendered as "Done 1x today" or "Completed Today" even though the parent denied it!
  - The child is prevented from re-attempting the chore today, and no "Needs Redo" prompt is ever displayed.

#### Leak 3: Auto-Conversion of Points to Screen Time
- In `store.js` line 5250 (`approveParentRequest`):
  ```javascript
  // Screen Time & Privileges Bank conversion: points convert to screen time minutes!
  const rate = hero.screenTimeRate !== undefined ? hero.screenTimeRate : 2;
  const earnedMinutes = pointsToAward * rate;
  hero.screenTimeMinutes = (hero.screenTimeMinutes || 0) + earnedMinutes;
  ```
- **The Defect**:
  - Violates R3: "CRITICAL: Points are NOT automatically converted into screen time minutes; kids use their earned Gold Points in the shop to purchase screen time or other real-life rewards."
  - Points must accumulate in `hero.points` as currency.

#### Leak 4: Missing Clawback on Rejection
- In `store.js` lines 5309-5349 (`rejectParentRequest`):
  - When parent denies, `hero.coins`, `hero.xp`, and active pet `sparks` are left untouched.
  - The kid keeps the auto-issued tokens, XP, and sparks for a rejected task.
  - Violates R3: tokens, XP, and sparks must be clawed back (clamped at floor 0).

#### Leak 5: Disconnected Map Waypoint Rewards
- In `store.js` line 8857 (`completeWaypointChore`):
  - `const pendingPoints = Math.round(waypoint.rewardCoins / 2);`
  - Uses static `waypoint.rewardCoins` and `waypoint.rewardXp` from `PATH_OF_VALOR_WAYPOINTS`.
  - Ignores parent settings configured in `taskForest` / `habitIslands` via the Parent Portal.
  - Does not check `isTaskPendingApproval(waypoint.choreKey, heroId)`.

---

## Part 6: Concrete Changes & Architectural Recommendations

### 6.1 Changes Required in `src/state/store.js`

#### Change 1: Eliminate 45-Second Stale Cutoff in `hydrateFromCloud()`
```javascript
// In src/state/store.js, lines 7293-7305:
const unconfirmedLocal = (this.state.pendingApprovals || []).filter((localReq) => {
  if (!localReq || !localReq.id) return false;
  if (resolvedIds.has(localReq.id)) return false;
  const inCloud = cloudData.pendingApprovals.some((c) => c.id === localReq.id);
  if (inCloud) return false;
  // ZERO-DROP PERSISTENCE: Retain all unconfirmed local requests indefinitely until resolved
  return true;
});
```

#### Change 2: Immediate Repair Push
```javascript
// In src/state/store.js, line 7358:
if (repairPushNeeded && typeof this.syncService?.pushStateToCloud === 'function') {
  this.syncService.pushStateToCloud(true); // Immediate write, bypass 350ms debounce
}
```

#### Change 3: Include `sparks` in `HERO_STAMPED_FIELDS` & Isolation
```javascript
// In src/state/store.js:
export const HERO_STAMPED_FIELDS = ['points', 'coins', 'tokens', 'xp', 'sparks', 'level', 'xpNext', 'screenTimeMinutes', 'activePetId'];

// In syncSelectedHeroWithHeroes():
sparks: Math.max(0, Number(sHero.sparks) || 0),
petSparkMap: sHero.petSparkMap ? { ...sHero.petSparkMap } : (idx !== -1 ? this.state.heroes[idx].petSparkMap : undefined),

// In switchHero(heroId):
this.state.selectedHero.sparks = hero.sparks || 0;
this.state.selectedHero.petSparkMap = hero.petSparkMap ? { ...hero.petSparkMap } : undefined;
if (hero.petSparkMap) {
  this.state.petSparkMap = { ...hero.petSparkMap };
}

// In hydrateFromCloud():
sparks: resolve('sparks', num(cloudH.sparks), preferLocalRewards ? (localH.sparks ?? 0) : (cloudH.sparks !== undefined ? Number(cloudH.sparks) : (localH?.sparks ?? 0))),
```

#### Change 4: Reversible Denial in `rejectParentRequest()`
```javascript
// In src/state/store.js, rejectParentRequest(reqId):
if (req.type === 'task_point_approval' || req.type === 'task') {
  const hero = this.state.heroes.find(h => h.id === req.kidId) || this.state.selectedHero;
  
  // R3 Clawback: Tokens, XP, Pet Sparks (clamped at floor 0)
  const tokensToClawback = Number(req.tokensAwarded) || 0;
  const xpToClawback = Number(req.xpAwarded) || 0;
  const sparksToClawback = Number(req.sparksAwarded) || 0;
  
  hero.coins = Math.max(0, (hero.coins || 0) - tokensToClawback);
  hero.tokens = Math.max(0, (hero.tokens || hero.coins || 0) - tokensToClawback);
  hero.xp = Math.max(0, (hero.xp || 0) - xpToClawback);
  
  const petId = String(hero.activePetId || '1');
  if (sparksToClawback > 0 && typeof this.deductPetSparks === 'function') {
    this.deductPetSparks(petId, sparksToClawback);
  }
  
  if (this.state.selectedHero?.id === hero.id) {
    this.state.selectedHero.coins = hero.coins;
    this.state.selectedHero.tokens = hero.tokens;
    this.state.selectedHero.xp = hero.xp;
  }
  
  // Mark completion log as rejected
  ...
}
```

#### Change 5: Remove Screentime Auto-Conversion in `approveParentRequest()`
```javascript
// In src/state/store.js, approveParentRequest(reqId):
if (req.type === 'task_point_approval' || req.type === 'task') {
  const pointsToAward = req.pendingPoints || req.rewardPoints || 10;
  hero.points = (hero.points || 0) + pointsToAward;

  // REMOVED: Auto-conversion of points into screen time minutes.
  // Points remain in hero.points for the child to spend in the Digital & Real-Life Reward Shop!

  if (this.state.selectedHero.id === hero.id) {
    this.state.selectedHero.points = hero.points;
  }
  ...
}
```

#### Change 6: Filter `rejected` in `getTaskCompletions()` & Add `isTaskNeedsRedo()`
```javascript
// In src/state/store.js:
getTaskCompletions(taskId, heroId = null, includeRejected = false) {
  const kidId = heroId || this.state.selectedHero?.id;
  const targetIds = this.getTaskAliasGroup(taskId);
  return (this.state.taskCompletionLogs || []).filter(
    (l) => targetIds.includes(l.taskId) && 
           (!kidId || l.heroId === kidId) &&
           (includeRejected || l.status !== 'rejected')
  );
}

isTaskNeedsRedo(taskId, heroId = null) {
  const kidId = heroId || this.state.selectedHero?.id;
  const targetIds = this.getTaskAliasGroup(taskId);
  const todayStr = new Date().toISOString().split('T')[0];
  const logsToday = (this.state.taskCompletionLogs || []).filter(
    (l) => targetIds.includes(l.taskId) && 
           (!kidId || l.heroId === kidId) &&
           (l.completedAt || '').split('T')[0] === todayStr
  );
  if (logsToday.length === 0) return false;
  // If the latest log today was rejected, and it is not currently pending or approved:
  const latest = logsToday[0];
  return latest.status === 'rejected' && !this.isTaskPendingApproval(taskId, kidId);
}
```

#### Change 7: Full `pendingApprovals` Delta Schema
In all completion methods (`toggleTaskForest`, `toggleHabitIsland`, `completeWaypointChore`, `completeToothbrushBattle`, `completeAiQuest`):
Record the full delta:
```javascript
{
  id: approvalReqId,
  logId: logId,
  kidId: currentHero.id,
  kidName: currentHero.name,
  type: 'task_point_approval',
  taskId: canonicalTaskId,
  taskTitle: canonicalTaskTitle,
  title: canonicalTaskTitle,
  zone: zoneName, // 'Task Forest' | 'Habit Islands' | "Today's Path" | 'Hygiene AR Battle' | 'AI Spark Quests'
  tokensAwarded: finalCoins,
  xpAwarded: finalXP,
  sparksAwarded: sparksEarned,
  pendingPoints: configuredPoints,
  date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  timestamp: nowIso,
  status: 'pending'
}
```

#### Change 8: Unified Waypoint Chore Execution & Dynamic Reward Inheritance
Create a unified task lookup helper:
```javascript
getTaskConfig(taskIdOrKey) {
  const habit = (this.state.habitIslands || []).find(h => h.id === taskIdOrKey);
  const chore = (this.state.taskForest || []).find(t => t.id === taskIdOrKey);
  return habit || chore || null;
}
```
In `completeWaypointChore(waypointId)`:
- Look up parent-configured reward settings:
  ```javascript
  const taskDef = this.getTaskConfig(waypoint.choreKey);
  const rewardCoins = taskDef?.coins ?? waypoint.rewardCoins ?? 15;
  const rewardPoints = taskDef?.points ?? Math.round(rewardCoins / 2);
  const rewardXp = taskDef?.xp ?? waypoint.rewardXp ?? 10;
  const rewardSparks = taskDef?.sparks ?? waypoint.rewardSparks ?? 5;
  ```
- Check `isTaskPendingApproval(waypoint.choreKey, heroId)`: if pending, block duplicate payout.
- Check `isWaypointDone`: if already completed in Quests, block duplicate payout.

### 6.2 Changes Required in `src/services/firestoreSyncService.js`
In `_doPush()` (lines 500-542):
Add `sparks: Math.max(0, Number(h.sparks) || 0)` and `fieldStamps` including `sparks`:
```javascript
heroesMap[h.id] = {
  ...h,
  coins: Math.max(0, Number(h.coins) || 0),
  points: Math.max(0, Number(h.points) || 0),
  tokens: Math.max(0, Number(h.tokens ?? h.coins) || 0),
  xp: h.xp || 0,
  sparks: Math.max(0, Number(h.sparks) || 0),
  fieldStamps: Object.fromEntries(HERO_STAMPED_FIELDS.map((f) => [f, Number(h.fieldStamps?.[f]) || 0])),
  ...
};
```

### 6.3 Changes Required in `src/views/ParentPortalView.js`
Update the pending request card in `renderParentPortalView()` (lines 287-295):
- Display exact `tokensAwarded`, `xpAwarded`, `sparksAwarded`, and `pendingPoints`.
- Remove the text displaying auto-converted screen time minutes.

---

## Part 7: Verification Strategy

To verify zero-drop persistence and multi-device synchronization:
1. **Multi-Device Simulation Test**:
   Extend `scratch/verify_approval_sync_across_devices.js` or create `scratch/verify_task_habit_engine_and_sync.mjs`:
   - Simulate Child A submitting a task while offline.
   - Advance clock by 60 seconds (`ageMs = 60000`).
   - Trigger cloud hydration with an empty cloud pending approvals array.
   - Assert `Child A`'s pending approval item survives and triggers a repair push.
   - Simulate Child B submitting another task concurrently on Device B.
   - Assert Parent Device receives both items without collision.
   - Parent denies Child A's submission: assert tokens, XP, and sparks are clawed back, and task displays "Needs Redo".
   - Parent approves Child B's submission: assert Gold Points are credited to Child B's balance without altering screen time bank.
2. **Regression Test Suite**:
   Run `node scratch/run_all_tests.js` to ensure all 67 test suites pass.
3. **Build Integrity**:
   Run `npm run build` to confirm exit code 0.

---

## Conclusion
The investigation has uncovered the precise mechanisms responsible for dropped approvals, multi-child spark bleeding, denied task lockout, and unsynced map waypoints. The exact line numbers and concrete code transformations outlined above provide an actionable, evidence-based blueprint for the implementation team.
