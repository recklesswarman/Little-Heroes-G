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
