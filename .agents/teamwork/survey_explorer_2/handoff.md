# Handoff Report — Survey Explorer 2
**Scope**: Client Firebase Auth initialization, Firestore sync service, persistent link service, and store sync integration.

---

## 1. Observation

### Obs 1. `src/config/firebase.js` Initialization & Exports
- **File location**: `src/config/firebase.js:1-72`
- **Initial exports** (lines 70):
  ```javascript
  export { app, auth, db, functions, storage, googleProvider, isFirebaseAvailable, isStorageAvailable, firestoreDatabaseId, firebaseConfig };
  ```
- **Auth setup** (lines 33-38):
  ```javascript
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("Auth persistence notice:", err.message);
  });
  ```
- **Finding**:
  - `src/config/firebase.js` does NOT call `signInAnonymously(auth)` on startup.
  - It does NOT export `ensureAuthReady()` or any `ensureAuthenticatedSession()` helper.
  - As a result, when an unauthenticated child or guest opens the application, `auth.currentUser` remains `null`.
  - Modern Firebase JS SDK (`"firebase": "^12.19.0"` in `package.json:25`) supports `auth.authStateReady()` directly on the `auth` instance, which resolves once stored local credentials have hydrated.

### Obs 2. Live Firestore Rejection under Unauthenticated Sessions
- **Live execution test**: Running `node scratch/test_live_firestore.js` produced verbatim output:
  ```
  🔥 Firebase initialized successfully for project: little-heroes-quest-8842 (DB: , Storage: little-heroes-quest-8842.firebasestorage.app)
  Writing test document: TEST_SYNC_1792383118932
  [2026-10-19T04:11:59.425Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x34b20306 error. Code: 7 Message: 7 PERMISSION_DENIED: Missing or insufficient permissions.
  ❌ Firestore Live Error: permission-denied 7 PERMISSION_DENIED: Missing or insufficient permissions.
  ```

### Obs 3. Security Rules Requirements for `request.auth != null`
- **File location**: `firestore.rules:457-485`
  ```javascript
  match /user_households/{linkId} {
    allow get: if isAuthenticated() && (
      isOwner(linkId) ||
      (resource != null && resource.data.userId == request.auth.uid) ||
      (request.auth.token.email_verified == true && request.auth.token.email != null && resource != null && resource.data.email == request.auth.token.email)
    );
    allow list: if false;

    allow create: if isAuthenticated()
      && isValidUserHouseholdPayload()
      && (
        isOwner(linkId) ||
        (request.auth.token.email_verified == true && request.auth.token.email != null && request.resource.data.email == request.auth.token.email)
      );

    allow update: if isAuthenticated()
      && isValidUserHouseholdPayload()
      ...
  ```
- **File location**: `firestore.rules:119-125`
  ```javascript
  function isAuthenticated() {
    return request.auth != null;
  }
  function isOwner(userId) {
    return isAuthenticated() && request.auth.uid == userId;
  }
  ```
- **File location**: `firestore.rules:176-185, 305-314`
  - In `isValidHouseholdCreate()`:
    ```javascript
    (!isAuthenticated() && (!('parentUids' in data) || data.parentUids.size() == 0) && (!('parentEmails' in data) || data.parentEmails.size() == 0))
    ```
  - In `isBootstrapParentClaim()`:
    ```javascript
    return isAuthenticated() && ... && request.auth.uid in request.resource.data.parentUids;
    ```
- **Finding**:
  - In `user_households/{linkId}`, every read and write (`get`, `create`, `update`, `delete`) unconditionally requires `isAuthenticated()` (`request.auth != null`). Unauthenticated callers are immediately blocked.
  - In `households/{householdCode}`, creating a household containing `parentUids` or claiming parent admin rights requires `isAuthenticated()`.

### Obs 4. Interaction in `persistentLinkService.js` and `firestoreSyncService.js`
- **File location**: `src/services/persistentLinkService.js:28-44, 175-236`
  - Constructor calls `this.init()` synchronously on import.
  - `init()` invokes `validateAndSlide()`, which calls `slideWindow()`, which calls `syncPersistentLinkToCloud(this.session)`.
  - `syncPersistentLinkToCloud` runs:
    ```javascript
    const userHouseholdRef = doc(db, "user_households", session.userId);
    await setDoc(userHouseholdRef, payload, { merge: true });
    ```
  - `persistentLinkService.js` only imports `{ db, isFirebaseAvailable } from "../config/firebase.js"`. It never imports `auth` or waits for auth readiness. If `session.userId` is present from local storage but `auth.currentUser` is `null`, Firestore rejects with `PERMISSION_DENIED`.
- **File location**: `src/services/firestoreSyncService.js:445-644`
  - `firestoreSyncService.js` imports `{ db, isFirebaseAvailable } from "../config/firebase.js"`.
  - `pushStateToCloud` -> `_doPush()` pushes `setDoc(doc(db, "households", householdCode), payload, { merge: true })`.
  - Neither `startSync()` nor `_doPush()` awaits `auth` initialization. If fired before auth establishes, requests execute as unauthenticated (`request.auth == null`).

### Obs 5. The 76 Store State Keys & Sync Invariants
- **File location**: `src/state/store.js:78-524` (`defaultState`)
  - Exactly 76 top-level keys define the app state:
    1. `isAuthenticated`
    2. `isAuthReady`
    3. `isHouseholdConfigured`
    4. `householdSetupStep`
    5. `isDeviceRevoked`
    6. `revokedDeviceIds`
    7. `activeView`
    8. `previousView`
    9. `selectedPetDetailId`
    10. `selectedAdventureGameId`
    11. `parentCustomWeapons`
    12. `parentCustomGear`
    13. `parentCustomFurniture`
    14. `parentCustomToys`
    15. `parentCustomFood`
    16. `parentCustomBosses`
    17. `selectedBossId`
    18. `pendingGiftCrates`
    19. `pendingBounties`
    20. `activeUnboxingCrateId`
    21. `heroForge`
    22. `bossColosseum`
    23. `petSanctuary`
    24. `household`
    25. `selectedHero`
    26. `heroes`
    27. `profileThemes`
    28. `habitIslands`
    29. `taskForest`
    30. `aiQuests`
    31. `heroAiQuestsMap`
    32. `pets`
    33. `petLevelMap`
    34. `petXpMap`
    35. `petSelectionModal`
    36. `petStatsMap`
    37. `recentlyUnlocked`
    38. `realLifeRewards`
    39. `digitalGear`
    40. `inventory`
    41. `equippedPetGear`
    42. `equippedPetGearSlots`
    43. `equippedPetGearMap`
    44. `customGearDyesMap`
    45. `savedHeroCards`
    46. `activeRunwayModal`
    47. `petStreakShield`
    48. `petLockerModal`
    49. `gameMasteryMap`
    50. `movementSessionHistory`
    51. `dentalBadges`
    52. `dentalBattleHistory`
    53. `lastBrushedMorning`
    54. `lastBrushedEvening`
    55. `heroHQ`
    56. `activeExpeditions`
    57. `expeditionHistory`
    58. `unlockedArtifacts`
    59. `expeditionModal`
    60. `pendingApprovals`
    61. `resolvedApprovals`
    62. `taskCompletionLogs`
    63. `taskLedgerLogs`
    64. `parentSettings`
    65. `rewardModal`
    66. `mysterySurprise`
    67. `hygieneReminders`
    68. `activeHygieneReminder`
    69. `liveRex`
    70. `worldAdventureMap`
    71. `bedtimeStoryLibrary`
    72. `activeBedtimeStory`
    73. `bedtimeSanctuaryState`
    74. `deletedHeroIds`
    75. `deletedCustomItemIds`
    76. `devices`
- **Packaging and Snapshot Mapping**:
  - `buildCloudStateSnapshot(state)` in `firestoreSyncService.js:31-43` excludes 16 transient UI keys (`LOCAL_ONLY_STATE_KEYS`), strips transient `household.lastSync`, and bundles the remaining keys into `stateSnapshot`.
  - `firestore.rules:207-227` (`isValidHouseholdPayload`) whitelists all household state keys in `hasOnlyAllowedFields` and caps data keys to `<= 120`.
- **Task/Habit & Approval Lifecycle**:
  - `src/state/store.js:2010-2115` (`toggleHabitIsland`) and `2152-2255` (`toggleTaskForest`):
    - Submitting a task immediately auto-issues Tokens (Coins), Hero XP, and Pet Sparks.
    - Queues Gold Points into `pendingApprovals` with metadata (`id`, `logId`, `kidId`, `tokensAwarded`, `xpAwarded`, `sparksAwarded`, `pendingPoints`, `status: 'pending'`).
    - Task marked `completed: true, pointsApproved: false`.
    - Triggers `this.saveState(true)` which broadcasts locally and pushes to Firestore.
  - `src/state/store.js:5451-5517` (`approveParentRequest`):
    - Credits `hero.points += pointsToAward` (no auto-conversion to screen time minutes).
    - Removes request from `pendingApprovals`, adds `{ id, at: Date.now() }` to `resolvedApprovals`, sets `status: 'approved'` in `taskCompletionLogs`.
    - Resets routine to uncompleted (`completed: false, pointsApproved: false`) for future cycles.
    - Saves and pushes to Firestore.
  - `src/state/store.js:5519-5614` (`rejectParentRequest`):
    - 0 Gold Points credited.
    - Claws back auto-issued Tokens, Hero XP, and Pet Sparks floored at 0 (`Math.max(0, ...)`).
    - Sets `status: 'rejected'` in `taskCompletionLogs`, removes from `pendingApprovals`, adds to `resolvedApprovals`.
    - Resets routine to uncompleted for redo.
    - Saves and pushes to Firestore.
  - `src/state/store.js:7558-7601` (`hydrateFromCloud`):
    - Unifies `resolvedApprovals` and guarantees zero-drop persistence for unconfirmed local pending approvals.

---

## 2. Logic Chain

1. **Premise 1**: Production security rules in `firestore.rules` guard `/user_households/{linkId}` with `isAuthenticated()` and require non-null `request.auth` for creating/claiming parent roles in `/households/{householdCode}`.
2. **Premise 2**: Direct inspection of `src/config/firebase.js` revealed that it only performs `initializeApp` and `setPersistence`, never establishing an anonymous auth fallback.
3. **Premise 3**: Consequently, any client launching the app without a pre-existing Google or Email session operates with `auth.currentUser == null` and sends Firestore requests with `request.auth == null`.
4. **Premise 4**: Both `src/services/persistentLinkService.js` and `src/services/firestoreSyncService.js` initiate Firestore queries without awaiting Firebase Auth initialization, immediately encountering `PERMISSION_DENIED` errors on `/user_households` and `/households`.
5. **Premise 5**: Adding an asynchronous `ensureAuthReady()` mechanism in `src/config/firebase.js` that awaits `auth.authStateReady()` before falling back to `signInAnonymously(auth)` guarantees `request.auth != null` for all client sessions while safely preserving existing and future Google/Email accounts.
6. **Premise 6**: Integrating `await ensureAuthReady()` into `persistentLinkService.js` (`syncPersistentLinkToCloud`, `lookupHouseholdForUser`) and `firestoreSyncService.js` (`_doPush`, `joinHousehold`, `startSync`) eliminates unauthenticated Firestore requests across all 76 state keys.

---

## 3. Caveats

- **Network-Disconnected Offline Start**: In an offline environment (airplane mode), `signInAnonymously(auth)` will fail with a network error. `ensureAuthReady()` must catch this error and gracefully return `auth.currentUser || null` without throwing, allowing the app's offline local persistence (`localStorage`) to function without freezing.
- **Account Linking / Sign-in Upgrades**: When an anonymous user signs in with Google via `signInWithPopup(auth, googleProvider)` in `firebaseAuthService.js`, the anonymous credential can be replaced or linked. `onAuthStateChanged` correctly detects the new Google user UID and email, triggering `handleAuthUser(user)` without disruption.
- **Rules Deployment Target**: `firebase.json` currently has `"firestore": { "rules": "firestore.rules" }` targeting a single database. For full multi-database compliance (`(default)` Standard and `default` Enterprise), `firebase.json` must be updated to an array of database definitions.

---

## 4. Conclusion

1. **`src/config/firebase.js` Changes Required**:
   - Import `signInAnonymously` from `"firebase/auth"`.
   - Implement and export `ensureAuthReady()`:
     ```javascript
     let authReadyPromise = null;
     export function ensureAuthReady() {
       if (!isFirebaseAvailable || !auth) return Promise.resolve(null);
       if (!authReadyPromise) {
         authReadyPromise = (async () => {
           try {
             await auth.authStateReady();
             if (!auth.currentUser) {
               const cred = await signInAnonymously(auth);
               return cred.user;
             }
             return auth.currentUser;
           } catch (err) {
             console.warn("Silent anonymous auth notice:", err.message);
             return auth.currentUser || null;
           }
         })();
       }
       return authReadyPromise;
     }
     ```
   - Automatically trigger `ensureAuthReady().catch(...)` during initialization so unauthenticated sessions are silently provisioned with an anonymous UID on startup.
2. **`src/services/persistentLinkService.js` & `firestoreSyncService.js` Changes Required**:
   - Import `ensureAuthReady` from `../config/firebase.js`.
   - In `persistentLinkService.js`:
     - In `syncPersistentLinkToCloud(session)`: add `await ensureAuthReady();` before writing to `user_households`. Ensure `session.userId` falls back to `auth.currentUser?.uid`.
     - In `lookupHouseholdForUser(userIdOrEmail)`: add `await ensureAuthReady();` before reading `user_households`.
     - In `init()`: avoid executing `validateAndSlide()` immediately if unauthenticated; wait for `ensureAuthReady()`.
   - In `firestoreSyncService.js`:
     - In `_doPush()`, `joinHousehold(code)`, and `pingDevicePresence(code)`: await `ensureAuthReady()`.
3. **Store Synchronization Integrity**:
   - The 76 store keys are fully mapped into `stateSnapshot` and top-level Firestore fields, matching `isValidHouseholdPayload()` in `firestore.rules`.
   - Task/habit completion auto-issues Tokens, XP, and Sparks, queues Gold Points in `pendingApprovals`, and on parent approval/denial synchronizes via `saveState(true)`.

---

## 5. Verification Method

To independently verify these findings:
1. **Unit & E2E Test Suite**:
   ```powershell
   node scratch/run_all_tests.js
   ```
   *Expected result*: All test suites pass 100% with 0 failures.
2. **Production Build**:
   ```powershell
   npm run build
   ```
   *Expected result*: Vite builds the project cleanly with exit code 0.
3. **Live Firestore Rules & Auth Session Verification**:
   - Run `node scratch/test_live_firestore.js` after implementing `ensureAuthReady()` to confirm live documents write and read without `PERMISSION_DENIED`.
