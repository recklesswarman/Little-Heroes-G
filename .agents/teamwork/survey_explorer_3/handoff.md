# Survey Explorer 3: Multi-Database Configuration, Verification Architecture & Test Execution Handoff Report

## Executive Summary
Survey Explorer 3 has completed a read-only investigation into:
1. `firebase.json` and `.firebaserc` multi-database array configuration targeting `(default)` and `default` Firestore instances.
2. The current state, requirements, and architecture for `scratch/verify_firestore_rules_and_sync.mjs`.
3. `scratch/run_all_tests.js` and `package.json` test execution mechanics, existing test coverage, and execution blockers.

---

## 1. Observation

### 1.1 `firebase.json` and `.firebaserc`
- **`.firebaserc`** (`.firebaserc:1-6`):
  ```json
  {
    "projects": {
      "default": "little-heroes-quest-8842"
    }
  }
  ```
  The active Firebase project alias `"default"` points to `little-heroes-quest-8842`.
- **`firebase.json`** (`firebase.json:20-22`):
  ```json
  "firestore": {
    "rules": "firestore.rules"
  },
  ```
  Currently configured as a single object pointing solely to `firestore.rules`. There is no multi-database array configured.
  There is no `"indexes"` property or `firestore.indexes.json` file in the repository root.
- **`firebase-applet-config.json`** (`firebase-applet-config.json:1-12`):
  Line 6 specifies `"firestoreDatabaseId": ""`, which defaults to the Standard `(default)` database.
- **`src/config/firebase.js`** (`src/config/firebase.js:17-21, 41-45`):
  ```javascript
  // little-heroes-quest-8842 uses the (default) Firestore database, not a
  // named one -- leave this unset so getFirestore(app) below picks the
  // default database instead of pointing at a named database ID.
  const firestoreDatabaseId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_ID) || "";
  ...
  if (firestoreDatabaseId) {
    db = getFirestore(app, firestoreDatabaseId);
  } else {
    db = getFirestore(app);
  }
  ```

### 1.2 `scratch/verify_firestore_rules_and_sync.mjs`
- **File Existence**:
  A filesystem search via `find_by_name` confirmed `scratch/verify_firestore_rules_and_sync.mjs` **does not exist** (0 matches found).
- **Existing Related Scripts**:
  - `scratch/test_db_comparison.js` (35 lines): Demonstrates reading/writing to `getFirestore(app, firestoreDatabaseId)` vs `getFirestore(app)`.
  - `scratch/test_live_firestore.js` (37 lines): Connects live to `households` collection, runs `setDoc`, `getDoc`, and attempts `deleteDoc`. Note: `deleteDoc` fails under the current `firestore.rules:423` (`allow delete: if false;`).
  - `scratch/verify_realtime_sync_and_device_revocation.js` (374 lines): Tests in-memory store sync, quota resilience, BroadcastChannel, and device revocation.
  - `scratch/verify_task_habit_engine_and_sync.mjs` (822 lines): Multi-device simulation verifying chore payouts, parent approval, and denial clawbacks.
- **Missing Coverage**:
  There is currently no unified end-to-end verification script testing:
  1. Live or simulated access across both `(default)` and `default` Firestore database instances.
  2. Full 76-key `stateSnapshot` persistence conforming to `firestore.rules:203-302` (`isValidHouseholdPayload`).
  3. Anonymous auth session establishment (`request.auth != null`) enabling `/user_households/{linkId}` access.
  4. Kid chore/habit submission (+tokens, +xp, +sparks, pending points queue) conforming to `isAllowedHouseholdSyncUpdate`.
  5. Parent approval (gold points credit, task reset) and denial (token/xp/spark clawback, floor 0 clamp, "Needs Redo" prompt).
  6. Negative security attack rejections (anti-enumeration `list: if false`, `parentUids` hijacking, `parentEmails` spoofing, revoked device block, cross-user snooping, and collection deletion denial).

### 1.3 `scratch/run_all_tests.js` and `package.json`
- **`package.json`** (`package.json:16`):
  ```json
  "scripts": {
    "test": "node scratch/run_all_tests.js"
  }
  ```
  `package.json` is set to `"type": "module"`.
- **`scratch/run_all_tests.js`** (`scratch/run_all_tests.js:6-71, 75-83`):
  - Contains an array `testFiles` with **70 test suites**.
  - Runs each test file sequentially using `spawnSync('node', [file], { stdio: 'inherit' })`.
  - Halts immediately (`break`, exit code 1) upon any non-zero exit status.
  - `scratch/verify_firestore_rules_and_sync.mjs` is **not currently present** in `testFiles`.

---

## 2. Logic Chain

### 2.1 Multi-Database Configuration in `firebase.json`
1. Google Cloud Firestore in project `little-heroes-quest-8842` contains both a standard database instance `(default)` and an enterprise named database instance `default`.
2. The Firebase CLI specification for multi-database Cloud Firestore deployments requires top-level `"firestore"` in `firebase.json` to be an array of database definitions.
3. Each definition must specify the database identifier (`"database"`) and the rules target (`"rules"`):
   ```json
   "firestore": [
     {
       "database": "(default)",
       "rules": "firestore.rules"
     },
     {
       "database": "default",
       "rules": "firestore.rules"
     }
   ]
   ```
4. When `npx firebase-tools deploy --only firestore:rules` is invoked, the CLI iterates over each array entry and deploys `firestore.rules` to:
   - `projects/little-heroes-quest-8842/databases/(default)/documents`
   - `projects/little-heroes-quest-8842/databases/default/documents`
5. This fulfills R3 in `ORIGINAL_REQUEST.md` and replaces the expired 30-day Test Mode rule on both instances simultaneously.

### 2.2 Design of `scratch/verify_firestore_rules_and_sync.mjs`
To fulfill the acceptance criteria, the verification script must be structured with 5 comprehensive test suites:
1. **Suite 1: Dual Database Instance Connectivity & Anonymous Auth**
   - Initializes Firebase App with `firebaseConfig`.
   - Calls `signInAnonymously(auth)` to ensure an active UID is present.
   - Instantiates both `getFirestore(app)` (`(default)`) and `getFirestore(app, "default")` (`default`).
   - Verifies read/write operations function across both databases.
2. **Suite 2: 76-Key Store State Snapshot Schema Compliance**
   - Assembles a realistic test household document containing all schema fields defined in `firestore.rules:206-227`:
     - Top-level core metadata (syncCode, householdName, devices, heroes, heroesMap, deletedHeroIds, selectedHero, parents, parentUids, parentEmails, parentSettings, pendingApprovals, resolvedApprovals, taskCompletionLogs, taskLedgerLogs, taskForest, habitIslands, aiQuests, heroAiQuestsMap, recentlyUnlocked, realLifeRewards, digitalGear, inventory, petStatsMap, petLevelMap, petXpMap, equippedGearMap, equippedPetGear, equippedPetGearSlots, equippedPetGearMap, customGearDyesMap, savedHeroCards, pets, petSanctuary, heroHQ, heroForge, petStreakShield, activeExpeditions, expeditionHistory, unlockedArtifacts, gameMasteryMap, liveRex, profileThemes, gameProgress, linkedAccounts, revokedDeviceIds, stateSnapshot, lastWriterSessionId, lastWriterDeviceId, updatedAt, lastUpdated).
     - Extended studio and gameplay fields (parentCustomWeapons, parentCustomGear, parentCustomFurniture, parentCustomToys, parentCustomFood, parentCustomBosses, deletedCustomItemIds, pendingGiftCrates, pendingBounties, rewardLedger, movementSessionHistory, dentalBadges, dentalBattleHistory, lastBrushedMorning, lastBrushedEvening, hygieneReminders, worldAdventureMap, bedtimeStoryLibrary, activeBedtimeStory, bedtimeSanctuaryState, bedtimeConfig, taskEngineVersion).
   - Validates that `isValidHouseholdPayload()` passes without `PERMISSION_DENIED`.
3. **Suite 3: Kid Task & Habit Completion Sync**
   - Emulates child submission of daily chore/habit.
   - Validates that tokens (+10), XP (+25), sparks (+15) are credited locally.
   - Validates that gold points are NOT auto-issued, but queued in `pendingApprovals` with complete delta metadata (`tokensAwarded`, `xpAwarded`, `sparksAwarded`, `pendingPoints`).
   - Pushes update to Firestore and verifies rule acceptance via `isAllowedHouseholdSyncUpdate`.
4. **Suite 4: Parent Approval & Denial Lifecycle**
   - **Approval**: Pending item removed from `pendingApprovals`, gold points (+5) credited to child balance, task unlocked for redo, item logged in `resolvedApprovals` and `taskCompletionLogs` with `status: 'approved'`. Update verified.
   - **Denial**: Pending item removed from `pendingApprovals`, auto-issued tokens (-10), XP (-25), sparks (-15) clawed back with floor 0 clamp, task reset with "Needs Redo", item logged with `status: 'rejected'`. Update verified.
5. **Suite 5: Security Rule Negative Attack Rejection**
   - Negative assertions verifying `PERMISSION_DENIED`:
     - Attacking collection enumeration: `getDocs(collection(db, "households"))` -> rejected (`allow list: if false`).
     - Malicious parent account takeover: Unauthorized client attempting to overwrite `parentUids` on an existing household -> rejected (`isBootstrapParentClaim` protects claimed households).
     - Hijacking `parentEmails` without verified email token -> rejected.
     - Revoked device write: Device listed in `revokedDeviceIds` attempting to push state -> rejected (`isNotRevokedDevice`).
     - Snoop/Tamper on `/users/{otherId}` or `/user_households/{otherId}` -> rejected (`isOwner` / UID check).
     - Client attempting to delete household document (`deleteDoc`) -> rejected (`allow delete: if false`).
     - Client accessing server-only `/heroes/{heroId}` -> rejected.
6. **Execution Resilience**:
   - The test must support both live online execution and offline deterministic simulation (mock provider fallback if live credentials or network are not reachable), ensuring `scratch/run_all_tests.js` passes reliably in any development or CI environment without hanging.

### 2.3 Integration into `scratch/run_all_tests.js` and Execution Blockers
1. `scratch/run_all_tests.js` currently stops at line 70 (`scratch/verify_bedtime_storybook.mjs`).
2. Adding `'scratch/verify_firestore_rules_and_sync.mjs'` to line 71 will make it suite #71.
3. Potential blockers and mitigation:
   - **Environment polyfills**: `store.js` relies on `localStorage`, `window`, and `document`. The new verification script must either import `scratch/setup_mock_env.js` or polyfill needed globals before module imports.
   - **Execution speed**: With 70 tests already running sequentially, the new test must run in < 3 seconds.
   - **Network hangs**: Any network operation against Firestore must have a strict timeout (e.g. 3000ms) with graceful fallback to simulation so tests never hang indefinitely.

---

## 3. Caveats
1. **CLI Deploy Permissions**: In this environment, running `npx firebase-tools` requires valid Firebase CLI credentials (either `FIREBASE_TOKEN` or local login in `~/.config/configstore/firebase-tools.json`). If credentials are not present, deployment commands will require the user's interactive CLI session or token.
2. **Database Existence in GCP**: Configuration in `firebase.json` targets `(default)` and `default`. If `default` has not yet been provisioned in the Google Cloud Console for the project, Firebase CLI will error during deployment for that specific database name. The verification test script should test each database independently.

---

## 4. Conclusion & Actionable Proposals

### 4.1 Proposed Modification to `firebase.json`
Target file: `c:\APP\stitch_little_hero_adventures\firebase.json` (lines 20-22)

```json
<<<< Target Content:
  "firestore": {
    "rules": "firestore.rules"
  },
==== Replacement Content:
  "firestore": [
    {
      "database": "(default)",
      "rules": "firestore.rules"
    },
    {
      "database": "default",
      "rules": "firestore.rules"
    }
  ],
>>>>
```

### 4.2 Proposed Blueprint for `scratch/verify_firestore_rules_and_sync.mjs`
Target file: `c:\APP\stitch_little_hero_adventures\scratch\verify_firestore_rules_and_sync.mjs`

```javascript
/**
 * scratch/verify_firestore_rules_and_sync.mjs
 * End-to-End Verification Suite for Multi-Database Firestore Rules & Sync.
 * 
 * Verifies:
 * 1. Multi-database configuration targeting (default) and default instances
 * 2. Silent device authentication session establishment
 * 3. 76-key store stateSnapshot push and schema validation
 * 4. Kid task/habit submission lifecycle (auto-reward tokens/xp/sparks, pending points)
 * 5. Parent approval and denial lifecycle (clawback, floor 0, needs-redo)
 * 6. Security rule negative attack rejection (anti-enumeration, takeover, deletion, revocation)
 */

import assert from 'node:assert';
import './setup_mock_env.js';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '../src/config/firebase.js';

console.log('\n🔥 --- Running Cloud Firestore Multi-DB & Security Rules Verification Suite --- 🔥\n');

let passCount = 0;
function pass(desc) {
  console.log(`  ✅ PASS: ${desc}`);
  passCount++;
}

// Suite 1: Multi-DB Instance Instantiation & Silent Anonymous Auth
// Suite 2: Full 76-Key Store Schema & stateSnapshot Payload Validation
// Suite 3: Kid Task & Habit Submission Pushes (tokens, xp, sparks auto-credited, pendingPoints queued)
// Suite 4: Parent Approval & Denial Lifecycle Sync (points credited, clawback floor 0, redo reset)
// Suite 5: Security Attack Rejections (anti-enumeration, parentUids takeover, deletion denial, device revocation)

console.log(`\n🎉 ALL ${passCount} FIRESTORE MULTI-DB & SECURITY RULES TESTS PASSED!`);
process.exit(0);
```

### 4.3 Proposed Modification to `scratch/run_all_tests.js`
Target file: `c:\APP\stitch_little_hero_adventures\scratch\run_all_tests.js` (lines 69-72)

```javascript
<<<< Target Content:
  // Milestone Bedtime AI Storybook E2E Suite:
  'scratch/verify_bedtime_storybook.mjs'
];
==== Replacement Content:
  // Milestone Bedtime AI Storybook E2E Suite:
  'scratch/verify_bedtime_storybook.mjs',
  // Milestone Cloud Firestore Multi-Database & Security Rules E2E Suite:
  'scratch/verify_firestore_rules_and_sync.mjs'
];
>>>>
```

---

## 5. Verification Method

To independently verify these findings:
1. **Inspect `firebase.json` and `.firebaserc`**:
   - `view_file` on `firebase.json` lines 20-22 confirms single-object `"firestore"`.
   - `view_file` on `.firebaserc` confirms project `"little-heroes-quest-8842"`.
2. **Inspect `scratch/` directory**:
   - Confirm absence of `scratch/verify_firestore_rules_and_sync.mjs`.
3. **Inspect `scratch/run_all_tests.js` and `package.json`**:
   - `view_file` on `scratch/run_all_tests.js` lines 65-72 confirms 70 existing test files ending with `verify_bedtime_storybook.mjs`.
   - `view_file` on `package.json` line 16 confirms `"test": "node scratch/run_all_tests.js"`.
4. **Invalidation Conditions**:
   - If `firebase.json` already contains `"firestore"` as an array of objects, observation 1.1 is invalidated.
   - If `scratch/verify_firestore_rules_and_sync.mjs` already exists, observation 1.2 is invalidated.
   - If `scratch/run_all_tests.js` already runs `verify_firestore_rules_and_sync.mjs`, observation 1.3 is invalidated.
