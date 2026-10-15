# BRIEFING — 2026-10-15T03:49:00Z

## Mission
Investigate the Companion Hero Workout arena in Little Hero Adventures, focusing on workout view components, store methods, 8 prehistoric gross-motor workout definitions, dinosaur coaches, canvas animations, circuit mode, water breaks, rewards, 3D avatar integration points, Stitch design system constraints, and toddler voice companion guidelines.

## 🔒 My Identity
- Archetype: Explorer
- Roles: Workout Arena & Store Specialist
- Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1
- Original parent: 95945b0b-5f74-4471-935a-2738aaef81cc
- Milestone: Explorer Survey / Milestone 1

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code files
- Adhere strictly to Stitch design system: Electric Cyan (#00E5FF / cyan), Emerald Green (#00E676 / emerald), Solar Amber (#FFB300 / amber), Midnight Slate (#0F172A / slate) — NO pink/purple!
- Follow kid voice companion guidelines in .agents/rules/kid_voice_companion_guidelines.md
- Document exact file paths, component hierarchy, state models, and integration points for 3D character avatar side-by-side with dinosaur coach

## Current Parent
- Conversation ID: 95945b0b-5f74-4471-935a-2738aaef81cc
- Updated: 2026-10-15T03:53:20Z

## Investigation State
- **Explored paths**:
  - `src/views/DinoWorkoutView.js` (Workout stage, 8-minute circuit, water break, audio/voice toggles, cadence runner)
  - `src/components/WorkoutHeroDuoCanvas.js` (Canvas stage, dual pedestals, dinosaur coach on left, articulated toddler hero on right, particle FX)
  - `src/data/petsData.js` (DINO_WORKOUTS array with 8 workouts, PETS_DATABASE with 8 dino coaches)
  - `src/state/store.js` (setActiveWorkoutId, getWorkoutStreak, recordWorkoutCompletion, boostPetJoy, addPetSparks, addPetTrainingXp, addCoins)
  - `src/services/voiceService.js` (speakCompanion, stopRex, COMPANION_VOICE_PROFILES, speechGeneration anti-overlap, fetchPcmTts)
  - `src/services/dance3DService.js`, `pet3DService.js`, `hanaBattle3DService.js` (@splinetool/runtime and WebGL patterns)
  - `src/audio/sfx.js` (Sound.startWorkoutBeat, Sound.stopWorkoutBeat)
  - `server/geminiService.js` & `server/elevenLabsService.js` (TTS endpoints and caching)
  - `package.json` (@splinetool/runtime installed, @google/genai installed)
- **Key findings**:
  - 8 Gross-motor workouts are fully specified with BPM, form cues, cadence timelines (60s to 3s), and coach profiles.
  - Diplodocus has `hasHalfwaySideSwitch: true`, requiring synchronous 30s announcement and animation flip.
  - Circuit mode chains all 8 moves with 10s water breaks; grants +120 Sparks, +400 XP, +400 Coins, 100% Joy, and 7-day streak update.
  - WorkoutHeroDuoCanvas mounts in `#workout-canvas-container` inside `DinoWorkoutView.js`; ready to host Spline 3D Application or Three.js WebGL canvas side-by-side with coach, with 2D fallback.
  - Audio pipeline needs client-side audio cache layer and server-side persona additions for all 8 dino coaches.
  - Zero pink/purple palette enforced across tailwind theme and canvas strokes.
- **Unexplored areas**: None for survey scope.

## Key Decisions Made
- Confirmed `@splinetool/runtime` is installed and already used in `hanaBattle3DService.js`.
- Identified exact integration points for side-by-side 3D avatar and coach in `WorkoutHeroDuoCanvas.js` and `DinoWorkoutView.js`.
- Identified that speech generation counter and audio clip caching can guarantee non-overlapping zero-latency cadence cues.

## Artifact Index
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1\DISPATCH.md — Received dispatch message
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1\BRIEFING.md — Working memory index
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1\progress.md — Liveness heartbeat
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1\handoff.md — Final survey report [Complete]
