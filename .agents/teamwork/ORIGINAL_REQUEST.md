# Original User Request

## 2026-10-15T03:46:23Z

Upgrade the Companion Hero Workout in Little Hero Adventures by integrating a true 3D character avatar (Spline / Three.js) animated via 3D skeletal bones to accurately demonstrate all 8 prehistoric gross-motor workouts, paired with a hybrid studio audio companion coaching engine.

Working directory: c:\APP\stitch_little_hero_adventures
Integrity mode: development
Requested team: Full team of autonomous agents working in parallel (3D graphics/skeletal animation specialist, audio/TTS pipeline engineer, and full-stack tester/reviewer).

## Requirements

### R1. 3D Character Avatar with Skeletal Bone Animation
The workout arena must render a 3D character avatar using Three.js or the Spline 3D runtime (@splinetool/runtime) side-by-side with the dinosaur coach. The avatar must execute 8 distinct, anatomically accurate skeletal bone animations matching each gross-motor workout:
1. Velociraptor Run: High-speed sprint on balls of feet with 90° arm pumps.
2. Stegosaurus Walks: Quadruped bear walk on hands and feet with hips elevated high, stepping 4 steps forward and 4 steps backward with ground stomps.
3. Pterodactyl Take Off: Wide arms wind-up in circular wing arcs, followed by crouch and vertical takeoff leap.
4. T-Rex Run: Short arms tucked in armpits, driving high knees up to hands.
5. Compsognathus Prances: Lateral skater jumps leaping side to side, crossing rear leg behind with balancing arm swing.
6. Brachiosaurus Stretch: Standing tall with feet together, rising high onto tiptoes, reaching arms straight overhead.
7. The Diplodocus: Tabletop quadruped bird-dog balance with neck reach and wagging tail leg, smoothly switching sides at 30 seconds.
8. Spinosaurus Stretch: Restorative Cat-Cow spine waves with rounded dorsal sail fin arching.
If 3D WebGL context is unavailable, gracefully fall back to the 2D procedural canvas without breaking the view.

### R2. Hybrid Studio Audio Companion Voice Coaching
Implement a hybrid audio engine for workout voice guidance:
- Natural high-fidelity AI voice audio via Gemini Flash TTS (/api/gemini/tts) or ElevenLabs (/api/elevenlabs/tts) with tailored kid-friendly coaching personas for the 8 dinosaur coaches.
- Caching layer for audio clips so voice lines play immediately with zero latency.
- Resilient browser speechSynthesis fallback with natural voice tuning whenever offline or network is constrained.
- Timed non-stop cadence coaching (0s, 10s, 20s, 30s, 40s, 50s, 58s) without overlapping audio.
- Diplodocus 30-second side switch announcement triggers synchronously with the 3D animation flip.

### R3. Safe Build & Design System Integrity
All additions must adhere to the Stitch design system (Electric Cyan, Emerald Green, Solar Amber, Midnight Slate — zero pink or purple) and preserve all existing store methods, 8-minute circuit mode, water break intermissions, and reward systems.

## Acceptance Criteria

### 3D Avatar Rendering & Skeletal Animation
- [ ] Workout stage mounts and renders a 3D character model via Three.js / Spline runtime without WebGL runtime errors.
- [ ] Skeletal bones transform accurately for each of the 8 workouts, visually matching the specific movement instructions.
- [ ] Clean fallback to procedural canvas if WebGL or asset loading fails.

### Voice Guidance & Cadence Timing
- [ ] Hybrid audio engine successfully triggers natural TTS audio or speech synthesis fallback.
- [ ] Spoken lines execute at designated cadence timestamps (0s, 10s, 20s, 30s, 40s, 50s, 58s) with no overlapping audio.
- [ ] At 30s in Diplodocus, the coach announces the side switch and the 3D avatar mirrors to the other side.

### System Verification & Build
- [ ] npm run build exits with code 0.
- [ ] Automated test suite (node scratch/run_all_tests.js) passes with 0 failures.


## 2026-10-15T15:15:03Z

Overhaul and rebuild the Little Hero Adventures Task & Habit Engine and Household Realtime Sync Infrastructure to guarantee 100% data consistency, instant multi-device synchronization, 1:1 unified Quests and World Map task triggers, and a robust reversible currency lifecycle (Tokens, Points, Hero XP, Pet Sparks) with parent approval/denial integrity.

Working directory: c:\APP\stitch_little_hero_adventures
Integrity mode: development
Requested team: Full team of autonomous agents working in parallel (Core Engine & Store Architect, Realtime Cloud Sync & Firestore Specialist, Map & Quest Integration Engineer, and QA & Sentinel Verification Auditor).

## Requirements

### R1. Unified Task & Habit Completion Engine (Quests & World Map 1:1 Parity)
- Completing a task or habit from either the Quests page or the World Adventure Map must execute the identical underlying store engine logic.
- Completing a waypoint chore on the World Map must immediately mark the corresponding task/habit completed in Quests, and vice-versa (strictly 1:1 synchronization; only one completion payout for each task or habit at a time — once a parent approves or denies the behavior, it resets and can be completed again).
- Map waypoints must dynamically inherit the exact parent-configured reward values (Tokens, Points, XP, Sparks) defined in the Parent Portal settings, eliminating all disconnected hardcoded values.
- Completion state, active cycle tracking, and progress tracking must be strictly isolated per child account (heroId).

### R2. Auto-Reward Issuance & Persistent Parent Point Approval
- When a child completes and submits a task or habit:
  - Tokens (Habit Coins), Hero XP, and Pet Sparks (Pet XP) are auto-issued immediately to the active child's balance.
  - Gold Points are NEVER auto-issued; they are strictly queued for parent verification.
  - The pendingApprovals queue must record full transaction deltas:
    - id, logId, kidId, kidName, type: 'task_point_approval'
    - taskId, taskTitle, zone ('Task Forest', 'Habit Islands', "Today's Path")
    - tokensAwarded, xpAwarded, sparksAwarded, pendingPoints
    - timestamp, status: 'pending'
  - Zero-Drop Persistence: Pending approvals must remain in the Parent Portal indefinitely until a parent explicitly taps Approve or Deny. Remove all arbitrary time limits (including the 45-second stale cutoff in cloud hydration) and protect against array clobbering from concurrent device snapshots.

### R3. Reversible Denial & Approval Lifecycle
- Parent Approval:
  - The exact assigned Gold Points are credited to the child's balance. (CRITICAL: Points are NOT automatically converted into screen time minutes; kids use their earned Gold Points in the shop to purchase screen time or other real-life rewards).
  - The task/habit resets and is unlocked so it can be completed again for future cycles.
  - The pending approval item is resolved, removed from pendingApprovals, and recorded as status: 'approved' in taskCompletionLogs.
- Parent Denial:
  - Zero Gold Points are awarded.
  - The Tokens, Hero XP, and Pet Sparks automatically granted upon submission are immediately clawed back from the child's balance:
    - hero.coins = Math.max(0, (hero.coins || 0) - (req.tokensAwarded || 0))
    - hero.xp = Math.max(0, (hero.xp || 0) - (req.xpAwarded || 0))
    - Active pet's Sparks are decremented safely: pet.sparks = Math.max(0, (pet.sparks || 0) - (req.sparksAwarded || 0))
    - Tokens are clamped at a floor of 0 (never negative; digital gear already purchased in the shop is preserved).
  - The task or habit resets to uncompleted on the child's screen (in Quests and on the Map) with a gentle "Needs Redo" prompt so the child can correct and resubmit it today.
  - The pending approval is resolved, removed from pendingApprovals, and recorded as status: 'rejected' in taskCompletionLogs.

### R4. Instant Household Multi-Device Realtime Sync & Strict Isolation
- Every balance change, task submission, habit submission, and parent approval/denial must synchronize immediately across all household devices via Firestore realtime listeners (onSnapshot) with instantaneous local optimistic UI updates.
- Strict multi-child data isolation: Child A's tokens, points, XP, sparks, active pet, and task completions must never alter or bleed into Child B's data, even when using shared devices or submitting identical tasks concurrently.
- Cloud hydration and merge algorithms must be non-destructive and race-condition resilient.

### R5. Currency System Coherence
- Strictly adhere to established app currency roles:
  - Tokens (Habit Coins): Earned from tasks/habits, spent in the Digital Rewards Shop for 3D hero gear, weapons, and accessories.
  - Gold Points: Parent-approved currency used by kids to purchase screen time or other real-life rewards in the shop.
  - Hero XP: Advances Hero Level and unlocks heroic badges and title milestones.
  - Pet Sparks (Pet XP): Fuels active 3D companion pet evolution and growth.

## Acceptance Criteria

### Task Completion & Reversible Currency Flow
- [ ] Submitting a task or habit on a kid's device immediately credits Tokens, XP, and Sparks, and queues Gold Points in pendingApprovals.
- [ ] Parent Portal displays the pending approval item with exact tokens, XP, sparks, and pending points metadata.
- [ ] Pending approvals persist across app restarts, reloads, and cloud hydration cycles without disappearing.
- [ ] Approving a request awards the Gold Points to the kid's balance (no auto-conversion to screen time minutes) and allows the task/habit to be completed again.
- [ ] Denying a request deducts the auto-issued Tokens, XP, and Sparks from the child's balance (clamped to 0).
- [ ] Denying a request resets the task/habit to uncompleted on the child's device with a "Needs Redo" prompt so it can be re-attempted.

### Map & Quests 1:1 Synchronization
- [ ] Completing a chore or habit on the World Map marks the corresponding Quest task/habit complete and vice versa.
- [ ] Values displayed on Map waypoints dynamically reflect parent-configured settings from the Parent Portal.
- [ ] Only one completion payout is allowed at a time across Map and Quests; once approved or denied, the behavior can be completed again.

### Household Multi-Device Sync & Isolation
- [ ] Concurrent task or habit submissions from two siblings on separate devices create distinct pending approval items with zero data collision.
- [ ] Balance updates, task submissions, habit submissions, and parent approvals/denials sync instantaneously across all devices.
- [ ] Multi-device simulation test (scratch/verify_task_habit_engine_and_sync.mjs) passes with 0 failures.
- [ ] Full regression suite (scratch/run_all_tests.js) passes 100%.
- [ ] Production build (npm run build) compiles cleanly with exit code 0.
