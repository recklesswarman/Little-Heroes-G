# Dispatch Log

## 2026-10-16T01:22:40Z
You are the Project Orchestrator (orchestrator_3) for the Bedtime AI Storybook revamp and optimization task in Little Hero Adventures.

Your working directory is:
c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_3

Authoritative User Request:
Read c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md under header `## 2026-10-16T01:20:55Z`.

Your Mission:
Completely revamp and optimize the Bedtime AI Storybook (`src/views/BedtimeStoryView.js`, `src/components/BedtimeStoryStage3D.js`, `src/services/bedtimeStoryService.js`, `src/data/bedtimeStoryData.js`, `src/services/voiceService.js`, `server/elevenLabsService.js`, `server/geminiService.js`, `server.js`, `vite.config.js`, `functions/src/voiceApi.ts`, and `src/state/store.js`).

Key Requirements to execute via your worker specialists:
1. R1: Deeply Personalized, Non-Repeating AI Story Engine:
   - End-to-end generative story routes (`/api/rex/bedtime-story` and `/api/gemini/bedtime-story`) in server/geminiService.js, server.js, vite.config.js, functions/src/voiceApi.ts, and client-side Firebase AI Logic (gemini-2.5-flash).
   - Structured 3-chapter stories with plot-coherent `sceneDescriptor` (environmentBiome, timeOfNight, weatherParticles, cameraWork, heroAction, petAction, keyProps, lightingPalette in Explorer Palette).
   - Combinatorial Dynamic Story Weaver in src/data/bedtimeStoryData.js with 12+ distinct plot archetypes per realm, rich sceneDescriptors, zero hardcoded "Rex" references.
   - Real-time per-child personalization (`buildChildStoryContext(heroId)`) using child profile (name, age tier, level, title), today's completed chores/habits (`store.getTaskCompletionsToday(heroId)`), active pet from `PETS_DATABASE`, equipped gear (`store.getEquippedHeroWeapon()`), and parent wish.
   - Anti-repetition story memory (`hero.bedtimeHistory` tracking last 25 story seeds/archetypes/titles) and sibling bookshelf isolation (`bedtimeStoryLibrary` scoped per heroId with instant Firestore sync).

2. R2: Unified ElevenLabs Voice Narration & Audio Pre-Fetching:
   - Resolve main ElevenLabs voice (`process.env.ELEVENLABS_REX_VOICE_ID || "e9sQs6aLWU82SSolkPYZ"`) for all 24 pets and bedtime storytelling in server/elevenLabsService.js and functions/src/voiceApi.ts, eliminating 404s.
   - Bedtime narration voice tuning (stability: 0.65, similarity_boost: 0.80, style: 0.35, use_speaker_boost: true).
   - Extend timeouts to 18000ms, support playback rate control on Web Audio AudioBufferSourceNode, and implement `prefetchCompanionAudio(text, petId, options)` in src/services/voiceService.js so Chapter N+1 pre-fetches while Chapter N plays.
   - Hands-Free "Auto-Read All 3 Chapters" mode toggle alongside interactive choice paths in BedtimeStoryView.js.

3. R3: Advanced 3D Plot-Coherent Story Stage (BedtimeStoryStage3D.js):
   - Three.js / WebGL / @splinetool/runtime stage with high-res 2D Canvas/SVG fallback.
   - Plot-driven automated scene synthesis driven by `sceneDescriptor`: articulated toddler hero avatar + articulated active pet companion (matching all 24 pet archetypes).
   - Chapter 1 (arrival/discovery with lantern & fireflies), Chapter 2 (gentle obstacle resolution with particle transformation), Chapter 3 (starlight slumber in cozy nest with 4s/4s harmonic breathing ring pacer).
   - Realm biomes, interactive 3D raycast constellations with lullaby chimes (`playConstellationChime`), and strict Explorer Palette (#09141e, #2ecc71, #00d2d3, #f39c12, #ffb961 — zero pink/purple).

4. R4: Unified Task/Habit & Currency Lifecycle Integration:
   - `store.completeBedtimeStory()` dynamically reads parent-configured rewards (`getWaypointRewards('wp_bedtime')` / `sleep_on_time`).
   - Strictly enforces one completion payout at a time across pending approval cycles.
   - Auto-issues Tokens, Hero XP, and Pet Sparks immediately; queues Gold Points in pendingApprovals with full delta metadata; supports clean clawback on parent denial per `.agents/rules/task_and_currency_lifecycle_rules.md`.

5. Verification:
   - Create comprehensive test harness `scratch/verify_bedtime_storybook.mjs`.
   - Ensure `scratch/verify_bedtime_storybook.mjs` and `scratch/run_all_tests.js` pass 100%.
   - Ensure `npm run build` exits 0.

Maintain `plan.md` and `progress.md` in `.agents/teamwork/orchestrator_3/`. Keep context clear, dispatch specialists for parallel milestones, and send a message back to the Sentinel when all acceptance criteria are met and victory is ready to be audited.
