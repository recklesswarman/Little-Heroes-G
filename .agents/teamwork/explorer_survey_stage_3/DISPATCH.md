## 2026-10-16T01:24:10Z
You are Explorer 3 (3D Stage & Currency Explorer).
Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_stage_3
Read authoritative user request at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md under header `## 2026-10-16T01:20:55Z`.
Also read: `.agents/rules/task_and_currency_lifecycle_rules.md`.

Your Mission:
Conduct an in-depth survey of the 3D diorama stage and the store/currency lifecycle:
1. Review 3D Stage & Visuals:
   - Check `src/components/BedtimeStoryStage3D.js` (or current 3D stage implementation, and existing 3D components like `WorkoutHero3DStage.js` / Three.js / Spline runtime in the codebase).
   - How the 3D scene should be constructed dynamically from each chapter's `sceneDescriptor` (environmentBiome, timeOfNight, weatherParticles, cameraWork, heroAction, petAction, keyProps, lightingPalette).
   - How to render articulated toddler hero avatar + articulated active pet companion matching all 24 pet archetypes.
   - Specific chapter choreography:
     - Chapter 1: arrival/discovery with lantern & fireflies
     - Chapter 2: gentle obstacle resolution with particle transformation
     - Chapter 3: starlight slumber in cozy nest with 4s/4s harmonic breathing ring pacer
   - Interactive 3D raycast constellations with lullaby chimes (`playConstellationChime`).
   - Graceful 2D Canvas/SVG fallback when WebGL is unavailable.
   - Strict Explorer Palette enforcement (`#09141e`, `#2ecc71`, `#00d2d3`, `#f39c12`, `#ffb961` — zero pink/purple).
2. Review `src/state/store.js` and Bedtime Completion:
   - How `store.completeBedtimeStory` is currently implemented or should be implemented.
   - Dynamic parent-configured reward lookup (`getWaypointRewards('wp_bedtime')` / `sleep_on_time`).
   - Strict one-completion payout invariant across pending approval cycles.
   - Auto-issuance of Tokens, Hero XP, Pet Sparks immediately, queuing Gold Points in `pendingApprovals` with full delta metadata, and clean clawback on denial.
3. Review existing test infrastructure (`scratch/run_all_tests.js`) and plan for `scratch/verify_bedtime_storybook.mjs`.
Write your detailed report to `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_stage_3\analysis.md` and summarize in `handoff.md`. Send a message when complete.
