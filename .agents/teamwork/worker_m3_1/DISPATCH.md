## 2026-10-15T04:08:57Z
You are the Workout Arena Integration Specialist (Worker M3).
Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m3_1
The authoritative requirements are located at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md
The master project architecture is at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\PROJECT.md
Explorer handoffs:
- Explorer 1: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1\handoff.md
- Worker M1: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m1_1\handoff.md
- Worker M2: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m2_1\handoff.md
- Test Writer: c:\APP\stitch_little_hero_adventures\.agents\teamwork\test_writer_mtest_1\handoff.md
Please read these files immediately.

Write Ownership (Strict Boundary):
You EXCLUSIVELY own:
- `c:\APP\stitch_little_hero_adventures\src\views\DinoWorkoutView.js`
- `c:\APP\stitch_little_hero_adventures\scratch\verify_dino_workout_e2e.mjs` (for fixing import resolution if needed)

Task Requirements:
1. Update `src/views/DinoWorkoutView.js`:
   - Import `WorkoutHero3DStage` from `../components/WorkoutHero3DStage.js`.
   - In `attachDinoWorkoutListeners()` where `activeDuoCanvas` is initialized, instantiate `activeDuoCanvas = new WorkoutHero3DStage(stageContainer, { workoutId, coachId, tempoBpm })`. Because `WorkoutHero3DStage` implements the full parity contract and has built-in `WorkoutHeroDuoCanvas` fallback on WebGL failure, this cleanly upgrades the arena to true 3D side-by-side with 2D fallback.
   - Import `prewarmWorkoutAudio` from `../services/voiceService.js`. Trigger `prewarmWorkoutAudio(activeWorkoutId, coachPet.id)` when the view mounts and when advancing to a new workout move.
   - Fix cadence timing in `startActiveWorkoutTimer()`:
     - Check and trigger the initial cadence cue at 0s elapsed / 60s remaining so it is not skipped.
     - Ensure cues fire at designated cadence timestamps (0s, 10s, 20s, 30s, 40s, 50s, 58s) with `spokenTimelineSet` to prevent duplicate or overlapping speech.
     - At 30s in Diplodocus (`hasHalfwaySideSwitch`), ensure the coach announces "HALFWAY! Switch sides now!..." synchronously with the 3D avatar pose mirror.
   - Preserve all existing store methods, 8-minute circuit mode progression, 10-second water break intermissions, and reward minting (+120 Sparks, +400 XP, +400 Coins, Joy 100%, 7-day streak update).
   - Ensure strict Stitch design system adherence (Electric Cyan, Emerald Green, Solar Amber, Midnight Slate — zero pink/purple).
2. Verify & run tests:
   - Check `scratch/verify_dino_workout_e2e.mjs` to ensure the import `../src/data/petsData.js` resolves correctly.
   - Run `node scratch/verify_dino_workout_e2e.mjs` and ensure all 66 test assertions pass with 0 failures.
   - Run `node scratch/run_all_tests.js` and verify full regression pass.
   - Run `npm run build` and verify exit code 0.
3. Write your handoff report to `c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m3_1\handoff.md` and send a message when done.


## 2026-10-16T01:55:05Z
You are Worker 3 (worker_m3_1) for Milestone M3 (3D Plot-Coherent Story Stage & View Integration).
Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m3_1
Authoritative User Request: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (under ## 2026-10-16T01:20:55Z).
Project Specification: c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_3\PROJECT.md.
Survey Analysis: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_stage_3\analysis.md.
Existing Reference 3D Stages: `src/components/WorkoutHero3DStage.js`, `src/services/avatarSkeletalRig.js`, `src/data/petsData.js`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusive Write Ownership:
- `src/components/BedtimeStoryStage3D.js`
- `src/views/BedtimeStoryView.js`

Your Mission:
1. Build `src/components/BedtimeStoryStage3D.js`:
   - Dedicated Three.js / WebGL 3D Storybook Stage with high-resolution 2D Canvas/SVG fallback upon context loss or headless environments.
   - Plot-driven automated scene synthesis driven by chapter `sceneDescriptor`:
     - `environmentBiome`, `timeOfNight` (`twilight_arrival`, `starlit_journey`, `deep_slumber_sanctuary`), `weatherParticles` (`fireflies`, `aurora_ribbons`, `starlight_snow`, `bioluminescent_spores`, `gentle_bubbles`), `cameraWork` (`orbit_pan`, `follow_walk`, `crane_descend_nest`), `heroAction` (`walking_with_lantern`, `discovering_landmark`, `helping_obstacle`, `curled_asleep`), `petAction` (`trotting_beside`, `sniffing_clue`, `glowing_magic`, `sleeping_curled`), `keyProps`, and `lightingPalette`.
     - Articulated toddler hero avatar (with equipped gear & magic item hand socket).
     - Articulated active pet companion matching all 24 pet archetypes in `petsData.js` across dino, mystic, beast, aquatic, mech.
     - Chapter 1: Arrival & discovery with glowing path, lantern, fireflies, and aurora ribbons.
     - Chapter 2: Gentle obstacle resolution with dual golden-cyan particle transformation.
     - Chapter 3: Deep starlight slumber in cozy nest with glowing 4s/4s harmonic breathing ring pacer (`4s inhale / 4s exhale`).
     - Interactive 3D raycast constellations: tapping/clicking stars or fireflies triggers 3D ripple burst and plays pentatonic lullaby chimes (`Sound.playBedtimeChime` or `playConstellationChime`).
     - Strict Explorer Palette: `#09141e`, `#2ecc71`, `#00d2d3`, `#f39c12`, `#ffb961` — zero pink or purple in any material, shader, or particle.
2. Upgrade `src/views/BedtimeStoryView.js`:
   - Mount `BedtimeStoryStage3D.js` in the story illustration container.
   - Provide a prominent toggle for Hands-Free "Auto-Read All 3 Chapters" mode alongside interactive choice paths.
   - Connect background audio pre-fetching: call `prefetchCompanionAudio` for Chapter N+1 while Chapter N is reading.
   - Connect bedtime completion to `store.completeBedtimeStory(storyData)` upon reaching the end of Chapter 3.
3. Test and verify:
   - Run `node scratch/verify_bedtime_storybook.mjs` and `node scratch/test_bedtime_storybook.cjs`.
   - Run `npm run build` to confirm clean compilation.
   - Write your detailed report and test results to `handoff.md` and notify parent when complete.
