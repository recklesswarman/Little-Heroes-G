# PROJECT PLAN: Cloud Firestore Permission Resolution & Live Multi-DB Deployment

## Project Information
- Project Name: Little Hero Adventures - Firestore Permission Resolution & Skills Setup
- Target Environment: Firebase project `little-heroes-quest-8842`
- Databases: `(default)` (Standard Edition) and `default` (Enterprise Edition)
- Working Directory: `c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_4`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | 13 Firebase Agent Skills | Verify all 13 official Firebase skills from `firebase/agent-skills` are installed in `.agents/skills/` | M1 | ORIGINAL_REQUEST R1 |
| 2 | firestore.rules Validation & Preservation | Verify `firestore.rules` (authored by `firestore-rules-author`) validates syntactically, protects against enumeration & revoked devices, supports 76 state keys | M1 | ORIGINAL_REQUEST R1 |
| 3 | Silent Anonymous Device Auth | Implement automatic `signInAnonymously(auth)` fallback and export `ensureAuthReady()` in `src/config/firebase.js` | M2 | ORIGINAL_REQUEST R2 |
| 4 | Auth-Aware Household & Portal Sync | Ensure `firestoreSyncService.js` and `persistentLinkService.js` await active auth session before syncing `/households/{code}` and `/user_households/{linkId}` | M2 | ORIGINAL_REQUEST R2 |
| 5 | Multi-Database firebase.json Config | Configure `firestore` in `firebase.json` as an array targeting both `(default)` and `default` databases | M3 | ORIGINAL_REQUEST R3 |
| 6 | Live Rules Deployment | Deploy `firestore.rules` to both database instances via `npx firebase-tools deploy --only firestore:rules` | M3 | ORIGINAL_REQUEST R3 |
| 7 | Full Validation & Regression Testing | Execute `verify_firestore_rules_and_sync.mjs`, `run_all_tests.js`, and `npm run build` | M4 | ORIGINAL_REQUEST R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 0 | Survey | Map `.agents/skills/`, `firestore.rules`, `firebase.js`, `firestoreSyncService.js`, `firebase.json`, test scripts | none | IN_PROGRESS |
| 1 | Skills & Rules Check | Confirm 13 Firebase skills in `.agents/skills/`, validate `firestore.rules` structure & syntax | M0 | PLANNED |
| 2 | Device Auth & Sync Integration | Silent auth fallback in `firebase.js`, export `ensureAuthReady()`, integrate in sync services | M0 | PLANNED |
| 3 | Multi-DB Config & Deploy | Array config in `firebase.json`, deploy live rules to `(default)` and `default` | M1, M2 | PLANNED |
| 4 | Verification & Test Suite | Run verification script, full test runner, and production build | M3 | PLANNED |

## Interface Contracts
### `src/config/firebase.js` ↔ `firestoreSyncService.js` & `persistentLinkService.js`
- Export: `ensureAuthReady(): Promise<User>`
- Behavior: Resolves when `auth.currentUser` is non-null (either existing user or newly signed-in anonymous user).
- Compatibility: Preserves Google/Email auth upgrades without overriding existing signed-in sessions.

### `firebase.json` Multi-Database Schema
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
