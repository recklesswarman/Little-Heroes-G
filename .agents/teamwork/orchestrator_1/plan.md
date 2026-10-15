# Orchestrator Execution Plan: Little Hero Adventures 3D Avatar & Audio Companion Upgrade

## Objective
Upgrade the Companion Hero Workout in Little Hero Adventures by integrating a true 3D character avatar (Spline / Three.js) animated via 3D skeletal bones to accurately demonstrate all 8 prehistoric gross-motor workouts, paired with a hybrid studio audio companion coaching engine.

## Phases

### Phase 0: Survey & Scope Mapping (Current)
- Dispatch 3 parallel Explorers:
  1. `explorer_survey_1`: Survey the existing workout arena, workout data models, 8 prehistoric workouts, canvas renderers, store integration, and UI components in the codebase.
  2. `explorer_survey_2`: Survey the 3D graphics stack (Three.js, Spline runtime, bone animation capabilities, WebGL support/fallback mechanisms, model loading/generation assets).
  3. `explorer_survey_3`: Survey the audio/TTS infrastructure (Gemini Flash TTS, ElevenLabs, speechSynthesis fallback, caching layer, audio cadence timer hooks, test runners `scratch/run_all_tests.js`).
- Synthesize findings into `PROJECT.md` at project root with full Feature Inventory, Architecture, Milestones, and Interface Contracts.

### Phase 1: Dual Track Decomposition & Dispatch
- **Track A: E2E Testing Track**
  - Spawn E2E Testing specialist to establish `TEST_INFRA.md` and construct 4-tier test suite covering all 8 prehistoric workouts, 3D bone animation state flags, audio cadence triggers, 30s Diplodocus switch, procedural fallback, and build verification.
  - Publish `TEST_READY.md`.
- **Track B: Implementation Track**
  - Milestone 1: 3D Character Avatar Engine & 8 Skeletal Bone Animations (Three.js/Spline with smooth bone rigging and procedural/clip skeletal animation for all 8 workouts + 2D canvas fallback).
  - Milestone 2: Hybrid Studio Audio Companion Engine (Gemini Flash TTS / ElevenLabs caching + speechSynthesis fallback + non-overlapping cadence timer at 0s, 10s, 20s, 30s, 40s, 50s, 58s).
  - Milestone 3: Workout Arena Integration (Mounting 3D avatar side-by-side with dinosaur coach, 30s Diplodocus side-switch synchronization, Stitch design system compliance, circuit mode preservation).

### Phase 2: Final Verification & Hardening
- Run full automated test suite (`node scratch/run_all_tests.js`) and ensure 100% pass across all tiers.
- Run build verification (`npm run build`).
- Dispatch 2 Challengers for adversarial stress testing (rapid workout switching, WebGL context loss, audio interruption, rapid pause/resume).
- Dispatch Forensic Auditor for integrity verification.
- Pass Gate verification and report results to parent.
