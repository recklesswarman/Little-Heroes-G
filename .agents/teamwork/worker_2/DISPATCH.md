## 2026-10-19T04:35:11Z
You are Worker 2 (Hardening & Verification Specialist) for Little Hero Adventures.
Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_2
Read ORIGINAL_REQUEST.md at c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (section ## 2026-10-19T04:04:09Z).
Read Worker 1 handoff at c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_1\handoff.md and Reviewer 1 handoff at c:\APP\stitch_little_hero_adventures\.agents\teamwork\reviewer_1\handoff.md.

Scope of Work:
1. `src/config/firebase.js`:
   Apply the recommended resilience hardening in `ensureAuthReady()`:
   Add a `finally` block to clear `authReadyPromise = null` if `!auth.currentUser`, so that if cold boot occurred while offline, future invocations when network is restored can retry `signInAnonymously(auth)` without requiring a full browser reload:
   ```javascript
   } finally {
     if (!auth.currentUser) {
       authReadyPromise = null;
     }
   }
   ```
2. `scratch/verify_firestore_rules_and_sync.mjs`:
   In Suite 6 (Security Attack Rejection Simulation), add an explicit assertion testing schema poisoning rejection: confirm that attempting to write an unauthorized injected key outside the 76 allowed keys is rejected by `hasOnlyAllowedFields`.
3. Verify `scratch/run_all_tests.js`:
   Ensure `scratch/verify_firestore_rules_and_sync.mjs` is registered as suite #71 and passes cleanly.
4. Execute validation & builds:
   Run:
   - `node scratch/verify_firestore_rules_and_sync.mjs`
   - `node scratch/run_all_tests.js`
   - `npm run build`
   - `npx firebase-tools deploy --only firestore:rules` (if permitted in your environment)
   Document full command outputs and results in your report.
