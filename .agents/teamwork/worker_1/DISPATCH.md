## 2026-10-19T04:16:55Z
You are Worker 1 for Little Hero Adventures.
Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_1
Read the authoritative requirements in ORIGINAL_REQUEST.md:
c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (under section ## 2026-10-19T04:04:09Z)

Also read the Explorer handoff reports before implementing:
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\survey_explorer_1\handoff.md
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\survey_explorer_2\handoff.md
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\survey_explorer_3\handoff.md

Exclusive Write Ownership:
You own exclusively:
1. `src/config/firebase.js`
2. `src/services/firestoreSyncService.js`
3. `src/services/persistentLinkService.js`
4. `firebase.json`
5. `scratch/verify_firestore_rules_and_sync.mjs`
6. `scratch/run_all_tests.js`

CRITICAL PRESERVATION RULE:
`firestore.rules` has already been authored and audited (score 5/5) by `firestore-rules-author`. Do NOT overwrite or modify `firestore.rules` directly.

Implementation Instructions:
1. `src/config/firebase.js`:
   - Import `signInAnonymously` from `firebase/auth`.
   - Implement and export `ensureAuthReady()` which waits for `auth.authStateReady()` and if `!auth.currentUser`, calls `signInAnonymously(auth)`.
   - Automatically establish an anonymous auth session on startup if unauthenticated, while strictly preserving Google/Email authenticated users.
   - Export `ensureAuthReady` along with existing exports.

2. `src/services/firestoreSyncService.js` and `src/services/persistentLinkService.js`:
   - Import `ensureAuthReady` from `../config/firebase.js`.
   - Ensure `_doPush()`, `joinHousehold()`, `lookupHouseholdForUser()`, and `syncPersistentLinkToCloud()` await `ensureAuthReady()` before attempting operations that require authenticated context.

3. `firebase.json`:
   - Configure `"firestore"` as an array targeting both `(default)` (Standard Edition) and `default` (Enterprise Edition) databases on `little-heroes-quest-8842`:
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

4. Live Rules Deployment:
   - Deploy `firestore.rules` live to both databases:
     `npx firebase-tools deploy --only firestore:rules`
     Confirm exit code 0 and successful release to both `(default)` and `default`.

5. Verification Suite `scratch/verify_firestore_rules_and_sync.mjs`:
   - Create comprehensive verification script testing:
     - Multi-database array configuration in firebase.json
     - Auth initialization and `ensureAuthReady()`
     - 76-key store state snapshot schema validation
     - Kid task/habit submissions & pendingApprovals delta integrity
     - Parent approval/denial lifecycle & security attack rejections (unauthenticated writes, enumeration, device revocation, unauthorized role escalation)
     - Clean offline/simulation resilience so tests succeed deterministically in all environments.

6. Test Runner Integration:
   - Register `scratch/verify_firestore_rules_and_sync.mjs` in `scratch/run_all_tests.js`.

7. Verification Commands:
   - Run `node scratch/verify_firestore_rules_and_sync.mjs`
   - Run `node scratch/run_all_tests.js`
   - Run `npm run build`
   Document all command outputs and results in your handoff report.
