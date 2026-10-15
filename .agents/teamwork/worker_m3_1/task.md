# Task: Workout Arena Integration Specialist (Worker M3)

Scope:
- Update `src/views/DinoWorkoutView.js`:
  1. Mount `WorkoutHero3DStage` (with its built-in WorkoutHeroDuoCanvas fallback) into `#workout-canvas-container`.
  2. Call `prewarmWorkoutAudio(activeWorkoutId, coachPet.id)` on view mount and workout change for zero-latency cadence cues.
  3. Fix the cadence countdown loop: ensure the initial cue at 0s elapsed (60s remaining) fires without being skipped by the decrement-before-check bug, and cues fire at 0s, 10s, 20s, 30s, 40s, 50s, 58s.
  4. Ensure Diplodocus 30s side-switch announcement triggers synchronously with the 3D avatar pose flip.
  5. Preserve all existing store methods, 8-minute circuit mode, 10-second water break intermissions, and reward systems.
- Verify `scratch/verify_dino_workout_e2e.mjs`:
  Ensure any relative imports (e.g. `src/data/petsData.js`) resolve correctly and run `node scratch/verify_dino_workout_e2e.mjs` and `node scratch/run_all_tests.js`.
- Verify `npm run build` exits with code 0.
