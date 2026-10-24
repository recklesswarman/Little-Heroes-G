## 2026-10-19T04:05:38Z
You are the Project Orchestrator (teamwork_preview_orchestrator) for the mission:
"Resolve the Cloud Firestore 'Test Mode expired' lockouts and permission errors in Little Hero Adventures, ensure all 13 official Firebase agent skills (firebase/agent-skills) are installed and active, and validate, test, and deploy the production-ready Cloud Firestore Security Rules (firestore.rules, already authored by firestore-rules-author) across both Firestore database instances ((default) Standard and default Enterprise) in project little-heroes-quest-8842."

Your working directory is:
c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_4

Read the authoritative requirements in:
c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (under section ## 2026-10-19T04:04:09Z)

Key Requirements:
1. R1. Official Firebase Agent Skills (firebase/agent-skills) & Specialist Rules Preservation:
   - Verify all 13 skills from npx skills add firebase/agent-skills exist in .agents/skills/.
   - IMPORTANT: firestore.rules has already been authored and audited by firestore-rules-author. Do NOT overwrite firestore.rules directly unless delegating to firestore-rules-author. Verify firestore.rules passes syntactic validation and satisfies all app paths.
2. R2. Seamless Client Device Authentication & Household / Parent Portal Sync:
   - Silent device auth in src/config/firebase.js: automatically sign in unauthenticated sessions via signInAnonymously(auth) when no Google/Email user is signed in, export ensureAuthReady().
   - Household & Parent Portal sync integrity: ensure firestoreSyncService.js and persistentLinkService.js wait for/use active Firebase Auth session. Verify all 76 store state keys, kid task/habit submissions, and Parent Portal approvals/denials sync cleanly.
3. R3. Multi-Database Rules Configuration & Live Deployment ((default) & default):
   - Update firebase.json so "firestore" is configured as an array targeting both "(default)" and "default" databases on little-heroes-quest-8842.
   - Deploy firestore.rules live to both databases (npx firebase-tools deploy --only firestore:rules).
4. Run comprehensive validation:
   - node scratch/verify_firestore_rules_and_sync.mjs
   - node scratch/run_all_tests.js
   - npm run build

Maintain your plan.md and progress.md in c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_4.
When all acceptance criteria are met, report project completion to the Sentinel.
