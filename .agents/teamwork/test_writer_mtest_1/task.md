# Task: E2E Test Track Specialist (TEST_INFRA & 4-Tier Test Suite)

Scope:
- Derive opaque-box test suite from ORIGINAL_REQUEST.md.
- Write TEST_INFRA.md at project root.
- Implement comprehensive 4-tier test suite in scratch/verify_dino_workout_e2e.mjs:
  - Tier 1: Feature Coverage (all 8 prehistoric workouts, 3D skeletal bone transforms, WebGL/2D fallback, audio cadence cues, 30s Diplodocus switch, Stitch design colors).
  - Tier 2: Boundary & Corner Cases (WebGL context loss, extreme tempos, remainingTime bounds, rapid audio interruption).
  - Tier 3: Cross-Feature Interactions (audio cadence + 3D animation synchronization, pause/resume during workouts, mode switching).
  - Tier 4: Real-World Scenarios (Full 8-minute circuit completion, 10s water breaks, store reward minting).
- Register test in scratch/run_all_tests.js.
- Publish TEST_READY.md.
