# BRIEFING — 2026-10-15T15:30:00Z

## Mission
Investigate the authoritative source of truth for Cloud Sync, local persistence, cloud hydration, 45-second stale cutoff, pendingApprovals lifecycle, concurrent snapshot race conditions, and multi-child isolation.

## 🔒 My Identity
- Archetype: explorer
- Roles: Realtime Sync and Storage Explorer
- Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_2_gen2
- Original parent: af21d512-2803-4965-a215-ecdc337662af
- Milestone: Investigation of Cloud Sync & Storage Engine

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Inspect files handling Firestore synchronization, local storage persistence, and cloud hydration
- Identify where the 45-second stale cutoff in cloud hydration is located and how it affects pendingApprovals
- Identify how pendingApprovals, tasks, habits, and balance updates sync across devices via onSnapshot listeners
- Investigate race conditions, array clobbering, or dropped approvals during concurrent device snapshots
- Check multi-child data isolation: how is data isolated by heroId? Are there leaks or collisions between siblings?
- Identify what changes are needed to guarantee zero-drop persistence and instant multi-device synchronization
- Output to sync_investigation.md and handoff.md

## Current Parent
- Conversation ID: af21d512-2803-4965-a215-ecdc337662af
- Updated: 2026-10-15T15:18:34Z

## Investigation State
- **Explored paths**: `src/services/firestoreSyncService.js`, `src/state/store.js`, `src/views/DashboardView.js`, `src/views/WorldAdventureMapView.js`, `src/views/ParentPortalView.js`, `src/data/worldMapData.js`, `scratch/verify_approval_sync_across_devices.js`, `scratch/verify_two_kids_same_task.mjs`, `scratch/verify_pending_approval_repair_push.mjs`, `scratch/verify_pet_stats_isolated_per_kid.mjs`.
- **Key findings**:
  1. 45-second stale cutoff located at `src/state/store.js:7304` (`ageMs >= 0 && ageMs < 45000`), which causes unconfirmed local pending approvals to be permanently dropped if hydration occurs > 45s after creation.
  2. Firestore `{ merge: true }` replaces arrays wholesale, causing concurrent submissions to overwrite `pendingApprovals`. The repair push in `hydrateFromCloud` is debounced by 350ms and vulnerable to the 45s cutoff.
  3. `sparks` and `petSparkMap` are not stamped or isolated per hero, leading to cross-sibling pet progress leaks.
  4. `getTaskCompletions` does not filter out `rejected` logs, locking out denied chores and preventing "Needs Redo".
  5. `rejectParentRequest` lacks currency clawback for tokens, XP, and sparks.
  6. `approveParentRequest` improperly auto-converts points to screentime minutes instead of preserving points.
  7. Map waypoints use hardcoded values rather than parent portal task settings.
- **Unexplored areas**: None within the sync & storage scope.

## Key Decisions Made
- Fully documented all 7 core defects and provided concrete transformation code for the implementation team in `sync_investigation.md` and `handoff.md`.
- Verified production build `npm run build` exits cleanly with code 0.

## Artifact Index
- `DISPATCH.md` — Incoming dispatch message
- `BRIEFING.md` — Persistent memory
- `progress.md` — Heartbeat and activity log
- `sync_investigation.md` — Comprehensive sync investigation report
- `handoff.md` — 5-component handoff report
