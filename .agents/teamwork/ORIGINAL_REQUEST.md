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


## 2026-10-16T01:20:55Z

Completely revamp and optimize the Bedtime AI Storybook (`src/views/BedtimeStoryView.js`, `src/components/BedtimeStoryStage3D.js`, `src/services/bedtimeStoryService.js`, `src/data/bedtimeStoryData.js`, `src/services/voiceService.js`, `server/elevenLabsService.js`, `server/geminiService.js`, `server.js`, `vite.config.js`, `functions/src/voiceApi.ts`, and `src/state/store.js`) in Little Hero Adventures (`c:\APP\stitch_little_hero_adventures`).

Working directory: c:\APP\stitch_little_hero_adventures
Integrity mode: development
Requested team: Full team of autonomous agents working in parallel (AI Story & Personalization Engine Architect, ElevenLabs Voice & Audio Pre-Fetching Specialist, 3D Automated Plot-Coherent Diorama Stage Engineer, and Full-Stack QA & Verification Auditor).

## Requirements

### R1. Deeply Personalized, Non-Repeating AI Story Engine
- **End-to-End Generative Story Routes with Plot-Coherent `sceneDescriptor`**:
  - Wire `/api/rex/bedtime-story` and `/api/gemini/bedtime-story` in `server/geminiService.js`, `server.js`, `vite.config.js`, and `functions/src/voiceApi.ts`, alongside client-side Firebase AI Logic (`gemini-2.5-flash`), so server and cloud deployments generate rich, structured 3-chapter stories (`title`, `chapterText`, `whisperLine`, `sleepyCue`, `moralReflection`, `choices`, `sceneMood`, and a detailed structured `sceneDescriptor` object for the 3D stage).
  - Each chapter's `sceneDescriptor` must specify plot-coherent 3D choreography: `environmentBiome`, `timeOfNight` (`twilight_arrival`, `starlit_journey`, `deep_slumber_sanctuary`), `weatherParticles` (`fireflies`, `aurora_ribbons`, `starlight_snow`, `bioluminescent_spores`, `gentle_bubbles`), `cameraWork` (`orbit_pan`, `follow_walk`, `crane_descend_nest`), `heroAction` (`walking_with_lantern`, `discovering_landmark`, `helping_obstacle`, `curled_asleep`), `petAction` (`trotting_beside`, `sniffing_clue`, `glowing_magic`, `sleeping_curled`), `keyProps` (3D landmarks, bridges, crystal trees, sleepy creatures, and the child's chosen magic item & gentle obstacle), and `lightingPalette` (strictly Explorer Palette hex values).
  - Upgrade the offline/fallback `generateProceduralBedtimeStory` in `src/data/bedtimeStoryData.js` into a **Combinatorial Dynamic Story Weaver** with 12+ distinct plot archetypes per realm, dynamic sentence builders, rich per-chapter `sceneDescriptor` payloads, and zero hardcoded `"Rex"` references when another pet is active.
- **Real-Time Per-Child Personalization (`buildChildStoryContext(heroId)`)**:
  - **Child Profile**: Active child's name, `heroId`, age tier (`3-4`, `5-6`, `7+`), Hero Level, and Hero Title.
  - **Today's Completed Tasks & Habits**: Query today's completed chores/habits for `heroId` (`store.getTaskCompletionsToday(heroId)`) and weave them naturally into the story as heroic daytime accomplishments celebrated by the realm.
  - **Active Pet Companion**: Inject the active pet's true `name`, `title`, `element`, `archetype`, and `backstory` from `PETS_DATABASE` (e.g., Raptor, Stego, Sparky, Luna, Leo, Rex) as a co-star alongside the chosen story companion.
  - **Equipped Hero Gear & Story Choices**: Include the child's equipped weapon/armor (`store.getEquippedHeroWeapon()`), selected realm, magic item, gentle obstacle, moral value, and parent's custom bedtime wish.
- **Anti-Repetition Story Memory & Sibling Bookshelf Isolation**:
  - Persist `hero.bedtimeHistory` per child (`heroId`) tracking the last 25 generated story seeds, plot archetypes, titles, and chapter openings.
  - Inject recent plot archetypes and titles as negative constraints in the AI prompt (`NEVER repeat these recent story plots or titles`) and rotate combinatorial seeds deterministically away from prior stories.
  - Scope `bedtimeStoryLibrary` and `saveBedtimeStory()` per `heroId` so each child sees their own personal saved bedtime stories synchronized across devices via Firestore.

### R2. Unified ElevenLabs Main Voice Narration & Background Pre-Fetching
- **Universal ElevenLabs Voice Resolution (`e9sQs6aLWU82SSolkPYZ`)**:
  - Update `server/elevenLabsService.js` and `functions/src/voiceApi.ts` so `/api/elevenlabs/tts` defaults all pets, companions, and the bedtime storyteller to the main ElevenLabs voice (`process.env.ELEVENLABS_REX_VOICE_ID || "e9sQs6aLWU82SSolkPYZ"`), eliminating HTTP 404 errors when non-Rex pets are active.
  - Support bedtime narration voice tuning (`stability: 0.65`, `similarity_boost: 0.80`, `style: 0.35`, `use_speaker_boost: true`) for warm, soothing storytelling.
- **Zero-Cutoff Audio Pipeline & Background Chapter Pre-Fetching**:
  - Update `speakCompanion` and `fetchPcmTts` in `src/services/voiceService.js` to accept custom options (`timeoutMs: 18000` for story chapters, `rate`, `pitch`, `voiceStyle: 'bedtime'`) and properly apply playback rate to decoded Web Audio `AudioBufferSourceNode`s.
  - Add `prefetchCompanionAudio(text, petId, options)` in `voiceService.js` so `bedtimeStoryService.js` pre-fetches Chapter N+1 (both AI text and ElevenLabs audio buffer) in the background while Chapter N is playing, ensuring instant, zero-lag transitions.
- **Hands-Free "Auto-Read All 3 Chapters" Mode + Interactive Branching**:
  - Provide a clear toggle in `BedtimeStoryView.js` (`Auto-Read All 3 Chapters` vs. `Interactive Story Choices`, defaulting to smooth auto-advance if no choice is tapped or when Hands-Free mode is active) so children can either tap an interactive path between Chapter 1 & 2 or drift off to sleep hands-free through all 3 chapters.

### R3. Advanced 3D / Spline / Three.js Automated Plot-Coherent Story Stage (`BedtimeStoryStage3D.js`)
- **Automated 3D Chapter Diorama Engine (`src/components/BedtimeStoryStage3D.js`)**:
  - Build a dedicated Three.js / WebGL / `@splinetool/runtime` 3D Storybook Stage component (`BedtimeStoryStage3D.js`) with graceful high-resolution 2D Canvas/SVG fallback if WebGL context is unavailable in headless/constrained environments.
  - **Plot-Driven Automated Scene Synthesis**: Each chapter automatically constructs and animates a unique 3D diorama driven by the chapter's AI/procedural `sceneDescriptor` and plot text:
    - **Articulated 3D Toddler Hero & Active Pet Companion**: Render an articulated 3D toddler hero avatar (with equipped hero gear/helmet/cape and chosen magic item) alongside a fully articulated 3D model of the child's active pet companion (matching all 24 pet archetypes: dino, dragon, beast, aquatic, robot, mystic) performing chapter-coherent actions:
      - *Chapter 1 (Arrival & Discovery)*: Hero and pet walking/gliding along a glowing 3D terrain path into the chosen realm, holding the 3D magic item (e.g. Starlight Lantern casting a real-time 3D point light, Whispering Compass, Feather Quilt, Moonstone Flute) under drifting volumetric fireflies and aurora ribbons.
      - *Chapter 2 (Gentle Plot Interaction)*: Camera smoothly pans to reveal the specific 3D obstacle/character from the plot (e.g. sleepy bridge troll on an arched stone bridge, lost baby star by a crystal pond, yawning owl in a hollow ancient tree, tangled cloud sheep), with the hero and pet gesturing, offering help, and triggering a golden-cyan particle transformation as the obstacle is gently resolved.
      - *Chapter 3 (Deep Starlight Slumber)*: Camera cranes down to a cozy illuminated 3D moss/cloud/starlight nest where the articulated hero and pet curl up together to sleep, breathing gently in sync with a glowing 3D harmonic breathing ring (`4s inhale / 4s exhale`) as the sky dims to deep midnight slate.
    - **Realm-Specific 3D Biomes & Volumetric Atmosphere**: Distinct 3D geometry, terrain shaders, water reflections, and particle systems for Whispering Woods, Starlight Cove, Cloud Kingdom, Dino Slumber Valley, Crystal Cavern, and Underwater Coral Sanctuary, plus procedural custom realms.
    - **Interactive 3D Raycast Constellations**: Tapping/clicking glowing stars or fireflies in the 3D viewport triggers a 3D ripple burst and plays pentatonic lullaby chimes (`playConstellationChime`).
- **Strict Explorer Palette Compliance**:
  - Enforce `#09141e` (midnight slate), `#2ecc71` (emerald green), `#00d2d3` (electric cyan), `#f39c12` (solar orange), and `#ffb961` (warm amber) with **zero pink or purple** across all 3D materials, lights, UI cards, and data files.

### R4. Unified Task/Habit & Currency Lifecycle Integration
- **Evening Routine & Bedtime Completion (`store.completeBedtimeStory`)**:
  - Dynamically read reward amounts from parent-configured settings (`store.getWaypointRewards('wp_bedtime')` / `sleep_on_time`).
  - Enforce the **one completion payout at a time** invariant: if `sleep_on_time` (or `brush_teeth_night` / `tidy_up`) already has an active `pending` submission in `pendingApprovals` for the current `heroId`, do not mint duplicate Tokens/XP/Sparks; once approved or denied by the parent, it can be completed again.
  - Auto-issue Tokens, Hero XP, and Pet Sparks immediately upon valid completion, and queue Gold Points in `pendingApprovals` with full delta metadata (`tokensAwarded`, `xpAwarded`, `sparksAwarded`, `pendingPoints`) so parent approval awards Gold Points (never auto-converted to screen time) and parent denial claws back the auto-issued Tokens/XP/Sparks cleanly.

## Acceptance Criteria
- [ ] `/api/elevenlabs/tts` in both `server/elevenLabsService.js` and `functions/src/voiceApi.ts` resolves the main ElevenLabs voice (`e9sQs6aLWU82SSolkPYZ`) for all 24 pets and bedtime storytelling without returning HTTP 404.
- [ ] `voiceService.js` supports extended timeouts (`18000ms`), playback rate control on Web Audio buffers, and background audio pre-fetching (`prefetchCompanionAudio`) so full bedtime story chapters play through ElevenLabs without timing out.
- [ ] Every generated story weaves in the active child's name, age tier, today's completed tasks/habits, active pet companion (true name & species, never hardcoded to Rex), equipped hero gear, chosen realm/magic item/challenge, and parent bedtime wish, and produces a structured per-chapter `sceneDescriptor`.
- [ ] `hero.bedtimeHistory` prevents repeated plots per child, and `bedtimeStoryLibrary` isolates saved stories per child (`heroId`) with instant Firestore sync.
- [ ] `BedtimeStoryStage3D.js` renders an advanced, articulated 3D Three.js/Spline diorama for each chapter that dynamically adapts its biome, 3D props, camera movement, and articulated hero + pet animations to match each chapter's exact plot line (`sceneDescriptor`), with interactive tap-to-chime constellations, Chapter 3 breathing pacer, and zero pink/purple colors.
- [ ] `BedtimeStoryView.js` supports both interactive mid-story path choices and Hands-Free Auto-Read mode across all 3 chapters.
- [ ] `store.completeBedtimeStory()` obeys all rules in `.agents/rules/task_and_currency_lifecycle_rules.md` (dynamic parent-configured rewards, one payout per pending approval cycle, Gold Points queued for parent approval, full clawback on denial).
- [ ] Automated verification suite (`node scratch/verify_bedtime_storybook.mjs` and `node scratch/run_all_tests.js`) passes 100%, and `npm run build` exits 0.


## 2026-10-19T04:04:09Z

Resolve the Cloud Firestore "Test Mode expired" lockouts and permission errors in Little Hero Adventures (`c:\APP\stitch_little_hero_adventures`), ensure all 13 official **Firebase agent skills** (`firebase/agent-skills`) are installed and active, and validate, test, and deploy the production-ready Cloud Firestore Security Rules (`firestore.rules`, already authored by `firestore-rules-author`) across **both** Firestore database instances (`(default)` Standard and `default` Enterprise) in project `little-heroes-quest-8842`.

Working directory: c:\APP\stitch_little_hero_adventures
Integrity mode: development
Requested team: Full team

## Requirements

### R1. Official Firebase Agent Skills (`firebase/agent-skills`) & Specialist Rules Preservation
- Verify that all 13 skills from `npx skills add firebase/agent-skills` are installed and updated in `.agents/skills/` (`firebase-firestore`, `firestore-rules-creation`, `firebase-security-rules-auditor`, `firebase-auth-basics`, `firebase-hosting-basics`, `firebase-app-hosting-basics`, `firebase-basics`, etc.).
- Note: `firestore.rules` has already been authored and audited (score 5/5) by the mandatory `firestore-rules-author` specialist subagent. Do NOT overwrite `firestore.rules` directly unless delegating to `firestore-rules-author`. Verify that `firestore.rules` passes syntactic validation and satisfies all app data paths.

### R2. Seamless Client Device Authentication & Household / Parent Portal Sync
- **Silent Device Authentication (`src/config/firebase.js` & `src/services/firestoreSyncService.js`)**:
  - Automatically sign in unauthenticated client sessions via Firebase Anonymous Auth (`signInAnonymously(auth)`) when no Google/Email user is signed in (using `onAuthStateChanged(auth, ...)` or an `ensureAuthenticatedSession()` helper in `src/config/firebase.js`), ensuring `request.auth != null` on all household devices while preserving Google/Email sign-in upgrades.
- **Household & Parent Portal Sync Integrity**:
  - Ensure `firestoreSyncService.js` and `persistentLinkService.js` wait for or gracefully use the active Firebase Auth session when syncing `/households/{householdCode}` and `/user_households/{linkId}`.
  - Verify that all 76 store state keys (`bedtimeStoryLibrary`, `bedtimeSanctuaryState`, `activeBedtimeStory`, `worldAdventureMap`, `parentCustomGear`, `parentCustomFurniture`, `parentCustomToys`, `parentCustomBosses`, `pendingGiftCrates`, `pendingBounties`, `rewardLedger`, `movementSessionHistory`, `dentalBadges`, `dentalBattleHistory`, `lastBrushedMorning`, `lastBrushedEvening`, `hygieneReminders`, etc.), kid task/habit submissions (`pendingApprovals` additions), and Parent Portal PIN/Auth approvals and denials (`pendingApprovals` shrinking / `resolvedApprovals` updating) pass `firestore.rules` validation and sync cleanly without `PERMISSION_DENIED`.

### R3. Multi-Database Rules Configuration & Live Deployment (`(default)` & `default`)
- Update `firebase.json` so `"firestore"` is configured as an array targeting **both** `(default)` (Standard Edition) and `default` (Enterprise Edition) databases on `little-heroes-quest-8842`:
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
- Deploy `firestore.rules` live to both databases (`npx firebase-tools deploy --only firestore:rules`) so the expired 30-day Test Mode rule is completely replaced on both instances and all client requests are immediately restored.

## Acceptance Criteria
- [ ] All 13 Firebase agent skills from `firebase/agent-skills` exist and are verified in `.agents/skills/`.
- [ ] `firestore.rules` (authored by `firestore-rules-author`) passes syntactic validation and enforces anti-enumeration (`allow list: if false;`), revoked-device blocking, owner-only `/users/{userId}` and `/user_households/{linkId}`, anti-takeover protection on `parentUids`/`parentEmails`, and full 76-key store schema support.
- [ ] `src/config/firebase.js` automatically establishes a Firebase Auth session (`signInAnonymously` fallback when unauthenticated) and exports `ensureAuthReady()`.
- [ ] `firebase.json` targets both `(default)` and `default` Firestore databases, and `npx firebase-tools deploy --only firestore:rules` deploys cleanly to both databases with exit code 0.
- [ ] End-to-end verification script (`node scratch/verify_firestore_rules_and_sync.mjs`) and full repository test suite (`node scratch/run_all_tests.js`) pass 100%, confirming live Firestore reads/writes, 76-key `stateSnapshot` pushes, kid task submissions, Parent Portal approvals/denials, and security rule attack rejections work without `PERMISSION_DENIED` on legitimate operations.
- [ ] Production build (`npm run build`) exits 0.
