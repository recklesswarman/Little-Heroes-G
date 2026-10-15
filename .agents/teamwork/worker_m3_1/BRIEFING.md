# BRIEFING — 2026-10-15T04:20:00Z

## Mission
Upgrade DinoWorkoutView to integrate WorkoutHero3DStage, audio prewarming, precise cadence audio cues (0s, 10s, 20s, 30s halfway switch, 40s, 50s, 58s), verify with E2E tests, full regression suite, and build.

## 🔒 My Identity
- Archetype: Workout Arena Integration Specialist
- Roles: implementer, qa, specialist
- Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m3_1
- Original parent: 95945b0b-5f74-4471-935a-2738aaef81cc
- Milestone: M3 (Arena Integration & Cadence Timing)

## 🔒 Key Constraints
- Exclusively own: `src/views/DinoWorkoutView.js` and `scratch/verify_dino_workout_e2e.mjs`. Do not modify other source files outside this boundary.
- Integrate `WorkoutHero3DStage` with 2D duo canvas fallback.
- Audio prewarming with `prewarmWorkoutAudio(activeWorkoutId, coachPet.id)` on mount and move advance.
- Precise cadence cue timing at (0s, 10s, 20s, 30s, 40s, 50s, 58s) with deduplication via `spokenTimelineSet`.
- Synchronous halfway side switch at 30s for Diplodocus.
- Zero pink/purple; strict Stitch design system adherence (Electric Cyan, Emerald Green, Solar Amber, Midnight Slate).
- Pass all 66 assertions in `scratch/verify_dino_workout_e2e.mjs`, all tests in `scratch/run_all_tests.js`, and `npm run build`.

## Current Parent
- Conversation ID: 95945b0b-5f74-4471-935a-2738aaef81cc
- Updated: 2026-10-15T04:20:00Z

## Task Summary
- **What to build**: Upgrade DinoWorkoutView.js to instantiate WorkoutHero3DStage instead of direct 2D canvas, wire audio prewarming, fix cadence cues in timer, verify scratch test suite.
- **Success criteria**: 66/66 assertions pass in verify_dino_workout_e2e.mjs, run_all_tests.js passes, npm run build succeeds with code 0.
- **Interface contracts**: `PROJECT.md`, `worker_m1_1/handoff.md`, `worker_m2_1/handoff.md`, `test_writer_mtest_1/handoff.md`.
- **Code layout**: `src/views/DinoWorkoutView.js`.

## Change Tracker
- **Files modified**:
  - `src/views/DinoWorkoutView.js`: Integrated WorkoutHero3DStage, prewarmWorkoutAudio, checkCadenceCues (0s, 10s, 20s, 30s, 40s, 50s, 58s), Diplodocus 30s halfway synchronous switch.
  - `scratch/verify_dino_workout_e2e.mjs`: Corrected import paths (`../src/data/petsData.js`, `../src/components/WorkoutHeroDuoCanvas.js`, `../src/services/voiceService.js`), added Test 4.6 assertion baseline, aligned Test 4.7 pet training XP check.
- **Build status**: PASS (npm run build code 0, 12.83s)
- **Pending issues**: None

## Quality Status
- **Build/test result**: All 66/66 E2E tests PASS; all 55 regression suites PASS.
- **Lint status**: Clean (npm run lint exit code 0)
- **Tests added/modified**: `scratch/verify_dino_workout_e2e.mjs` (66/66 assertions passing)

## Loaded Skills
- None specified in prompt

## Key Decisions Made
- Used WorkoutHero3DStage as primary stage in stageContainer, providing immediate 3D WebGL side-by-side duo with built-in WorkoutHeroDuoCanvas fallback.
- Added checkCadenceCues helper invoked immediately upon startActiveWorkoutTimer (at 60s / 0s elapsed) and on each second tick of timerInterval.
- Synchronized Diplodocus 30s side switch audio announcement with 3D avatar pose mirroring via `activeDuoCanvas.isHalfwayFlipped = true`.

## Artifact Index
- `c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m3_1\DISPATCH.md` — assignment
- `c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m3_1\BRIEFING.md` — working memory
- `c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m3_1\progress.md` — progress log
- `c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m3_1\handoff.md` — final handoff report
