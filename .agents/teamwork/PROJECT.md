# Project: Little Hero Adventures — 3D Avatar & Audio Companion Upgrade

## Architecture
- **3D Graphics & Skeletal Animation Module**:
  - `src/services/avatarSkeletalRig.js`: Builds procedural Three.js skeletal bone rig for Toddler Superhero Avatar and 3D Dinosaur Coach with 21 articulated bones.
  - `src/services/workoutKinematicsEngine.js`: Pure mathematical forward-kinematic engine driving bone rotations and translations for all 8 prehistoric gross-motor routines, locked to BPM tempo and cadence timestamps.
  - `src/components/WorkoutHero3DStage.js`: 3D WebGL stage mounting Three.js scene side-by-side (Coach left, Avatar right), lifecycle management, and graceful runtime fallback to 2D canvas on context loss or failure with idempotency protection.
  - `src/components/WorkoutHeroDuoCanvas.js`: Preserved 2D procedural canvas stage as robust fallback.
- **Hybrid Studio Audio Module**:
  - `server/geminiService.js`: Full voice mappings (`PET_VOICE_MAP`) and personas (`PET_PERSONAS`) for all 8 dinosaur coaches with numeric aliases.
  - `vite.config.js`: Proxies `/api/elevenlabs/tts` to match `server.js`.
  - `src/services/voiceService.js`: Multi-tier hybrid TTS (ElevenLabs -> Gemini Flash TTS -> SpeechSynthesis 'Daniel' fallback), client-side in-memory zero-latency audio cache (`workoutAudioClipCache`), and cadence pre-warming.
- **Workout Arena & View Integration**:
  - `src/views/DinoWorkoutView.js`: Mounts 3D stage in `#workout-canvas-container`, fixes cadence timing (0s, 10s, 20s, 30s, 40s, 50s, 58s), synchronizes Diplodocus 30s side switch audio announcement with 3D avatar pose mirror.
  - `src/state/store.js`: Preserves all store methods, 8-minute circuit mode, water break intermissions, and reward minting.
  - Design system compliance: Strict Stitch color palette (Electric Cyan `#00d2d3`, Emerald Green `#2ecc71`, Solar Amber `#f1c40f`, Midnight Slate `#09141e` — zero pink or purple).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | 3D Skeletal Avatar Rig | Procedural 3D character avatar with articulated skeletal bone hierarchy (pelvis, spine, chest, neck, head, shoulders, arms, hands, hips, knees, feet, cape) | M1 | ORIGINAL_REQUEST §R1 |
| F2 | 8 Prehistoric Skeletal Animations | Anatomically accurate gross-motor routines (Velociraptor, Stegosaurus, Pterodactyl, T-Rex, Compsognathus, Brachiosaurus, Diplodocus, Spinosaurus) | M1 | ORIGINAL_REQUEST §R1 |
| F3 | WebGL Context & 2D Canvas Fallback | Graceful fallback to WorkoutHeroDuoCanvas when WebGL is unavailable or context lost | M1 | ORIGINAL_REQUEST §R1 |
| F4 | Hybrid Studio TTS & Dino Coach Personas | Gemini Flash TTS / ElevenLabs with tailored personas for all 8 coaches in server & client | M2 | ORIGINAL_REQUEST §R2 |
| F5 | Zero-Latency Audio Cache & Pre-Warming | Client-side audio clip caching for instant playback of cadence cues | M2 | ORIGINAL_REQUEST §R2 |
| F6 | Timed Cadence Voice Coaching | Non-overlapping audio cadence cues at 0s, 10s, 20s, 30s, 40s, 50s, 58s with Daniel fallback | M2 | ORIGINAL_REQUEST §R2 |
| F7 | Synchronous 30s Diplodocus Switch | Coach announces side switch at 30s synchronously with 3D avatar mirroring pose | M3 | ORIGINAL_REQUEST §R2 |
| F8 | Workout Stage Mounting & Side-by-Side View | Mount 3D avatar alongside dinosaur coach in workout arena | M3 | ORIGINAL_REQUEST §R1, R3 |
| F9 | Circuit Mode, Water Breaks & Store Integrity | Preserve 8-min circuit, 10s water breaks, reward minting, and Stitch color compliance | M3 | ORIGINAL_REQUEST §R3 |
| F10 | Comprehensive 4-Tier E2E Test Suite | 4-tier test suite verifying features, boundaries, combinations, and real-world workflows | M-TEST | Project Architecture |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M-TEST | E2E Test Track | Design test infra (TEST_INFRA.md) & 4-tier test suite, publish TEST_READY.md | none | DONE |
| M1 | 3D Skeletal Avatar & 8 Animations | Skeletal rig, 8 gross-motor kinematics, 3D stage mounting, WebGL fallback | none | DONE |
| M2 | Hybrid Audio Companion & Cadence | Server coach personas, zero-latency audio cache, cadence timing fix, Daniel fallback | none | DONE |
| M3 | Workout Arena & Diplodocus Integration | Mount 3D stage in DinoWorkoutView, synchronous 30s switch, circuit & store integrity | M1, M2 | DONE |
| M-FINAL | Final Verification & Hardening | 100% E2E test pass, adversarial challenger stress tests, forensic audit, build pass | M-TEST, M3 | DONE |

## Interface Contracts

### Avatar Skeletal Rig ↔ Workout Kinematics Engine
- `createAvatarRig(options)`: returns `{ root, bones: { pelvis, spine, chest, neck, head, shoulderL, armL, forearmL, handL, shoulderR, armR, forearmR, handR, hipL, thighL, calfL, footL, hipR, thighR, calfR, footR, cape }, meshes, sceneGroup }`
- `applyWorkoutKinematics(rig, workoutId, clock, tempoBpm, remainingTime, isHalfwayFlipped)`: updates joint rotations and root translations.

### 3D Stage / 2D Canvas Parity Contract
- Public Methods:
  - `setWorkout(workoutId, coachId, tempoBpm)`: void
  - `setTimeRemaining(seconds)`: void
  - `triggerBeat()`: void
  - `startAnimation()`: void
  - `pauseAnimation()`: void
  - `resumeAnimation()`: void
  - `stopAnimation()`: void
  - `destroy()`: void

### Audio Voice Service ↔ Workout Cadence Runner
- `prewarmWorkoutAudio(workoutId, coachId)`: returns `Promise<void>` (fetches and caches all cadence audio clips for active move).
- `speakCompanion(text, coachId, options)`: plays audio immediately from cache if available, falling back to TTS API or SpeechSynthesis.
- `stopRex()`: stops active playback immediately.

## Code Layout
- `src/components/WorkoutHero3DStage.js`: 3D Stage component and fallback switcher.
- `src/services/avatarSkeletalRig.js`: Three.js procedural skeleton and meshes.
- `src/services/workoutKinematicsEngine.js`: 8 gross-motor kinematic formulas.
- `src/components/WorkoutHeroDuoCanvas.js`: Preserved 2D fallback.
- `src/services/voiceService.js`: Audio caching and voice profiles.
- `src/views/DinoWorkoutView.js`: Stage mounting, cadence timing, side-switch trigger.
- `server/geminiService.js`: Server-side coach voices and personas.
- `vite.config.js`: ElevenLabs proxy endpoint.
- `scratch/verify_dino_workout_e2e.mjs`: Comprehensive automated E2E test suite (66 tests).
- `scratch/adversarial_3d_kinematics_test.mjs`: Adversarial 3D kinematics and WebGL stress suite (34 tests).
- `scratch/adversarial_audio_cadence_stress_test.mjs`: Adversarial audio collision and cadence stress suite (29 tests).
