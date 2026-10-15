# TEST_INFRA: Little Hero Adventures Dino Workout E2E Test Infrastructure

## Overview & Architecture
This document defines the automated end-to-end (E2E) testing methodology, coverage matrices, and verification harness for the **Companion Hero Dino Workout** system in Little Hero Adventures.

The test infrastructure validates:
1. **Gross-Motor Prehistoric Workouts**: All 8 distinct dinosaur routines.
2. **Articulated Skeletal Rig & Kinematics**: Bone transforms (pelvis, spine, head, shoulders, arms, legs, feet, cape).
3. **WebGL 3D Engine & 2D Canvas Fallback**: Runtime support detection, context loss handling, and seamless degradation.
4. **Hybrid Studio Audio Companion**: All 8 coach personas, zero-latency caching, non-overlapping cadence timing, and SpeechSynthesis fallback.
5. **Synchronous 30s Diplodocus Switch**: Split-second alignment of voice cue and pose mirroring.
6. **Circuit Mode, Water Breaks & Store Rewards**: Full 8-minute circuit loop, 10-second hydration breaks, and reward minting (+120 Sparks, +400 XP, +400 Coins, Joy 100%, 7-day streak).
7. **Design System & UX Integrity**: Stitch color palette compliance (zero pink/purple) and mascot audio safety guardrails.

---

## 1. Test Design Methodology

### 1.1 Category-Partition Method
The workout domain is decomposed into functional categories and equivalence partitions:

| Parameter Category | Partition Values | Test Strategy |
|--------------------|------------------|---------------|
| **Workout Routine** | 1. `velociraptor_run` (138 BPM, Speed)<br>2. `stegosaurus_walks` (92 BPM, Core/Bear-crawl)<br>3. `pterodactyl_takeoff` (112 BPM, Leap)<br>4. `trex_run` (122 BPM, High knees)<br>5. `compsognathus_prance` (126 BPM, Skater leaps)<br>6. `brachiosaurus_stretch` (78 BPM, Tiptoes/Spine)<br>7. `diplodocus` (74 BPM, Tabletop bird-dog)<br>8. `spinosaurus_stretch` (64 BPM, Cat-cow wave) | Exhaustive test of all 8 routines; verify distinct kinematic equations and bone orientations. |
| **Session Mode** | `circuit` (8-move progression) vs `practice` (single move) | Verify mode transitions, circuit index progression (0..7), and practice finish. |
| **Duration Tier** | `toddler` (30s) / `junior` (45s) / `titan` (60s) | Test timer initialization, progress bar scaling, and reward tier scaling. |
| **Rendering Engine** | 3D WebGL Stage (`WorkoutHero3DStage`) vs 2D Canvas Fallback (`WorkoutHeroDuoCanvas`) | Test API parity, context initialization, and automatic fallback on WebGL failure or context loss. |
| **Audio Voice Tier** | 1. ElevenLabs PCM TTS (`/api/elevenlabs/tts`)<br>2. Gemini Flash TTS (`/api/gemini/tts`)<br>3. Browser SpeechSynthesis (Daniel voice) | Test voice mapping for all 8 coaches, anti-overlap generation counter, and fallback chain. |
| **Audio Cache State** | Uncached (Cold) vs Pre-warmed / Cached (Hot) | Verify zero-latency playback on cached lines; cache hit prevents redundant network fetches. |

### 1.2 Boundary Value Analysis (BVA)
Critical boundaries tested for numerical and state transitions:

- **Workout Timer Boundaries**:
  - $t = 0\text{s}$ elapsed ($60\text{s}$ remaining): First cadence cue fires immediately; animation loop begins.
  - $t = 10\text{s}, 20\text{s}, 40\text{s}, 50\text{s}$: Intermediate cadence cues fire once without duplication.
  - $t = 30\text{s}$ ($30\text{s}$ remaining): Diplodocus halfway flip boundary — `isHalfwayFlipped` transitions from `false` to `true`, coach speaks switch prompt synchronously.
  - $t = 58\text{s}$ ($2\text{s}$ remaining): Final encouragement cadence cue.
  - $t = 60\text{s}$ ($0\text{s}$ remaining): Timer completion trigger; transitions to rest break or finish screen.
  - Degenerate inputs: `remainingTime = null`, `remainingTime = 0`, `remainingTime = -5`. Must be clamped safely without runtime exceptions.
- **BPM Tempo Boundaries**:
  - Lower boundary: $60\text{ BPM}$ (Spinosaurus restorative wave minimum).
  - Normal range: $74\text{ to }138\text{ BPM}$.
  - Upper boundary: $180\text{ BPM}$ (Max stress test tempo).
  - Verification: Joint angular velocity scales proportionally; no NaN or infinite rotation values.
- **Rest Break Boundaries**:
  - Countdown from $10\text{s}$ to $0\text{s}$; skip button click at any second immediately advances to next move.

### 1.3 Pairwise Combinations
Key multi-dimensional combinations tested:
1. `(velociraptor_run, 138 BPM, WebGL)` × `(audio cached)`: High-frequency arm pumps, foot-strike dust particles, rapid audio cue.
2. `(diplodocus, 74 BPM, 2D Fallback)` × `(timeRemaining = 30s)`: Halfway limb flip synchronously verified on 2D procedural canvas.
3. `(stegosaurus_walks, 92 BPM, WebGL context lost)`: Bear-crawl quadruped hot-swaps to 2D canvas mid-animation without resetting workout timer.
4. `(brachiosaurus_stretch, 78 BPM, SpeechSynthesis fallback)`: Overhead arm reach and tiptoe ankle plantarflexion with Daniel voice synthesis.

### 1.4 Real-World Application Workloads
Full end-to-end realistic user journeys:
1. **Complete 8-Minute Dino Circuit**:
   - Move 1 (Velociraptor) -> 10s Water Break -> Move 2 (Stegosaurus) -> ... -> Move 8 (Spinosaurus) -> Grand Circuit Completion.
   - Verifies sequential index progression, state resetting, and zero memory accumulation.
2. **Store Reward Minting Pipeline**:
   - Verifies exact rewards credited to `store.state.selectedHero`:
     - Single Move Practice: $+10\text{ to }+20\text{ Sparks}$, $+45\text{ to }+80\text{ XP}$, $+40\text{ to }+70\text{ Coins}$, Joy $100\%$.
     - Grand 8-Minute Circuit: $+120\text{ Evolution Sparks}$, $+400\text{ Training XP}$, $+400\text{ Hero Coins}$, Joy $100\%$, 7-day streak stamp card marked.
3. **Emergency Navigation / Abrupt Exit**:
   - Calling `abandonDinoWorkoutIfRunning()` while audio and music beat are active.
   - Confirms `stopRex()` cancels speech synthesis, `Sound.stopWorkoutBeat()` clears intervals, and canvas is destroyed cleanly.

---

## 2. 4-Tier Test Matrix

| Tier | Focus Area | Minimum Tests | Test Suite Target |
|------|------------|---------------|-------------------|
| **Tier 1** | Feature Coverage (All 8 Workouts, 3D Skeletal Transforms, WebGL Fallback, 8 Coach Personas, Audio Caching, Cadence Timing, 30s Diplodocus Switch, Color Palette) | $\ge 5$ tests per feature (40+ total) | `scratch/verify_dino_workout_e2e.mjs` |
| **Tier 2** | Boundary & Corner Cases (`webglcontextlost`, zero/null/negative timer, extreme 60-180 BPM, rapid pause/resume, abrupt exit speech stop) | $\ge 10$ tests | `scratch/verify_dino_workout_e2e.mjs` |
| **Tier 3** | Cross-Feature Combinations (Voice-kinematic synchrony, mid-routine workout switching, side-by-side coordinates `w*0.28` vs `w*0.72`) | $\ge 8$ tests | `scratch/verify_dino_workout_e2e.mjs` |
| **Tier 4** | Real-World Workloads (8-Minute Circuit Progression 1-8, 10s Water Break Intermission, Store Reward Minting) | $\ge 8$ tests | `scratch/verify_dino_workout_e2e.mjs` |

---

## 3. Authoritative Source of Expected Outputs

| Test Domain | Authoritative Reference Source |
|-------------|--------------------------------|
| 8 Dinosaur Workouts & BPM | `src/data/petsData.js` (`DINO_WORKOUTS`, `PETS_DATABASE`) & `ORIGINAL_REQUEST.md §R1` |
| Skeletal Bone Hierarchy & Kinematics | `PROJECT.md §Avatar Skeletal Rig`, `explorer_survey_2/handoff.md §Step 3`, `src/components/WorkoutHeroDuoCanvas.js:510-832` |
| 3D / 2D Stage Parity Interface | `PROJECT.md §3D Stage / 2D Canvas Parity Contract` |
| Voice Personas & Coach Voices | `src/services/voiceService.js` (`COMPANION_VOICE_PROFILES`), `server/geminiService.js` (`PET_VOICE_MAP`), `ORIGINAL_REQUEST.md §R2` |
| Cadence Timestamps | `ORIGINAL_REQUEST.md §R2` & `PROJECT.md §Feature Inventory F6` ($0\text{s}, 10\text{s}, 20\text{s}, 30\text{s}, 40\text{s}, 50\text{s}, 58\text{s}$) |
| Diplodocus 30s Switch Contract | `ORIGINAL_REQUEST.md §Acceptance Criteria` & `petsData.js:1065-1096` |
| Circuit & Reward Quantities | `src/views/DinoWorkoutView.js:874-895` & `src/state/store.js:8359-8390` |
| Design System Palette | `PROJECT.md §16`, `CLAUDE.md`, `src/styles/index.css` (Strictly Electric Cyan `#00d2d3`, Emerald Green `#2ecc71`, Solar Amber `#f1c40f`, Midnight Slate `#09141e`; zero pink/purple) |

---

## 4. Test Execution Instructions

### Running the Dinosaur Workout E2E Suite Directly:
```powershell
node scratch/verify_dino_workout_e2e.mjs
```

### Running the Entire Project Regression Suite:
```powershell
node scratch/run_all_tests.js
```

### Build & Production Verification:
```powershell
npm run build
```
