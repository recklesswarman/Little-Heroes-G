## 2026-10-15T03:56:36Z
From: 95945b0b-5f74-4471-935a-2738aaef81cc
Priority: MESSAGE_PRIORITY_HIGH
Content:
You are the E2E Test Track Specialist for Little Hero Adventures.
Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\test_writer_mtest_1
The authoritative requirements are located at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md
The project architecture is at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\PROJECT.md
Please read ORIGINAL_REQUEST.md and PROJECT.md immediately.

Write Ownership (Strict Boundary):
You EXCLUSIVELY own:
- `c:\APP\stitch_little_hero_adventures\TEST_INFRA.md` (create at project root)
- `c:\APP\stitch_little_hero_adventures\TEST_READY.md` (publish when tests are ready)
- `c:\APP\stitch_little_hero_adventures\scratch\verify_dino_workout_e2e.mjs`
- Adding the test script invocation to `c:\APP\stitch_little_hero_adventures\scratch\run_all_tests.js`
You MUST NOT write to any files in `src/` or `server/`.

Task Requirements:
1. Create `TEST_INFRA.md` at project root following the test methodology guidelines (Category-Partition, Boundary Value Analysis, Pairwise Combinations, Real-World Workloads).
2. Author an opaque-box comprehensive test suite in `scratch/verify_dino_workout_e2e.mjs` verifying:
   - Tier 1 (Feature Coverage, >=5 tests per feature): All 8 prehistoric gross-motor workouts (Velociraptor, Stegosaurus, Pterodactyl, T-Rex, Compsognathus, Brachiosaurus, Diplodocus, Spinosaurus); 3D skeletal bone transforms (pelvis, spine, head, shoulders, arms, legs, feet); WebGL support check and 2D canvas fallback; hybrid voice coaching personas for all 8 coaches; zero-latency cache retrieval; cadence timing (0s, 10s, 20s, 30s, 40s, 50s, 58s); 30s Diplodocus synchronous announcement and pose flip; Stitch color palette compliance (zero pink/purple).
   - Tier 2 (Boundary & Corner Cases): WebGL context loss handling (`webglcontextlost`); zero / null / negative timeRemaining; extreme BPM tempos (60 to 180); rapid pause/resume; speech cancellation on abrupt exit.
   - Tier 3 (Cross-Feature Combinations): Voice cadence and 3D animation synchronization across multiple moves; switching workouts mid-routine; side-by-side positioning coordinates.
   - Tier 4 (Real-World Application Scenarios): 8-minute circuit mode progression (moves 1-8); 10-second water break intermission handling; store reward minting (+120 Sparks, +400 XP, +400 Coins, Joy 100%, 7-day streak update).
3. Connect `scratch/verify_dino_workout_e2e.mjs` into `scratch/run_all_tests.js`.
4. Run `node scratch/verify_dino_workout_e2e.mjs` and `node scratch/run_all_tests.js` to ensure the test runner executes cleanly.
5. Create `TEST_READY.md` at project root detailing the test runner command, tier breakdown, and feature coverage matrix.
6. Write a comprehensive handoff report to `c:\APP\stitch_little_hero_adventures\.agents\teamwork\test_writer_mtest_1\handoff.md` and message the orchestrator when finished.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
