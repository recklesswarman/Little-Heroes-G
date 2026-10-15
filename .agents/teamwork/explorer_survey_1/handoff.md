# Handoff Report: Companion Hero Workout Arena & Store Architecture Survey

**Author**: Explorer 1 (Workout Arena & Store Specialist)  
**Date**: 2026-10-15  
**Working Directory**: `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1`  
**Reference Document**: `c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md`  

---

## 1. Observation

Direct code observations from the codebase investigation:

### 1.1 Workout Stage & View Hierarchy
- **File**: `c:\APP\stitch_little_hero_adventures\src\views\DinoWorkoutView.js` (947 lines)
  - **Module State** (lines 35-58):
    - `activeDuoCanvas` (instance of `WorkoutHeroDuoCanvas`)
    - `timerInterval`, `countdownInterval`, `restBreakInterval`
    - `sessionMode`: `'circuit'` | `'practice'`
    - `currentCircuitIndex`: `0` to `7`
    - `workoutPhase`: `'idle'` | `'ready'` | `'active'` | `'rest_break'` | `'finished'` | `'circuit_complete'`
    - `remainingTime`: seconds remaining in active move (default 60, tiers: toddler 30s, junior 45s, titan 60s)
    - `spokenTimelineSet`: `Set` tracking cadence timestamps spoken during the active move to prevent repeating or overlapping lines.
  - **Mount Point** (lines 292-297):
    - HTML container: `<div id="workout-stage-mount">` contains `<div id="workout-canvas-container" class="w-full h-full absolute inset-0 flex items-center justify-center">`
    - Attached via `new WorkoutHeroDuoCanvas(stageContainer, { workoutId, coachId, tempoBpm })` in `attachDinoWorkoutListeners()` (lines 446-459).
  - **Navigation Integration** in `src/main.js`:
    - Line 45: `import { renderDinoWorkoutView, attachDinoWorkoutListeners, abandonDinoWorkoutIfRunning } from './views/DinoWorkoutView.js';`
    - Lines 167-171: `isLeavingDinoWorkoutView` triggers `abandonDinoWorkoutIfRunning()` if navigating away during an active workout.
    - Lines 291-294: `case 'dino_workout': mainContent = renderDinoWorkoutView(); attachViewListeners = attachDinoWorkoutListeners; break;`
    - Lines 245-255: `isDirectPreview` gate controls bypass of Landing Auth Modal. Currently checks `activeView === 'dance_party' || activeView === 'battle' || activeView === 'boost' || activeView === '/boost' || activeView === 'adventures_map' || activeView === 'learn'`. Notice `'dino_workout'` and `'/workout'` are currently not in `isDirectPreview`.

### 1.2 The 8 Prehistoric Gross-Motor Workouts Definition & Coaches
- **File**: `c:\APP\stitch_little_hero_adventures\src\data\petsData.js` (Lines 864-1137)
  - `export const DINO_WORKOUTS = [...]` defines 8 distinct workouts:
    1. **Velociraptor Run** (`id: 'velociraptor_run'`, coach: Raptor `coachId: '2'`, 138 BPM, Speed & Agility):
       - Movement: High-speed sprint in place on balls of feet with 90° arm pumps and speed lines.
       - Cadence cues defined at 60s, 50s, 40s, 30s, 20s, 10s, 3s.
    2. **Stegosaurus Walks** (`id: 'stegosaurus_walks'`, coach: Stego `coachId: '3'`, 92 BPM, Core & Stomp Power):
       - Movement: Bear walk on hands and feet with hips elevated high, 4 steps forward and 4 steps back with loud ground stomps.
       - Cadence cues defined at 60s, 50s, 40s, 30s, 20s, 10s, 3s.
    3. **Pterodactyl Take Off** (`id: 'pterodactyl_takeoff'`, coach: Pterry `coachId: '4'`, 112 BPM, Vertical Leap & Balance):
       - Movement: Wide arms in rapid circular wing arcs, followed by crouch and vertical takeoff leap.
       - Cadence cues defined at 60s, 50s, 40s, 30s, 20s, 10s, 3s.
    4. **T-Rex Run** (`id: 'trex_run'`, coach: Rex `coachId: '1'`, 122 BPM, Leg Power & High Knees):
       - Movement: Short arms tucked in armpits, driving high knees up to hands.
       - Cadence cues defined at 60s, 50s, 40s, 30s, 20s, 10s, 3s.
    5. **Compsognathus Prance** (`id: 'compsognathus_prance'`, coach: Chomper `coachId: '5'`, 126 BPM, Lateral Agility & Rhythm):
       - Movement: Skater jumps leaping side to side, crossing rear leg behind with balancing arm swing.
       - Cadence cues defined at 60s, 50s, 40s, 30s, 20s, 10s, 3s.
    6. **Brachiosaurus Stretch** (`id: 'brachiosaurus_stretch'`, coach: Brachio `coachId: '6'`, 78 BPM, Spine Elongation & Calves):
       - Movement: Standing tall with feet together, rising high onto tiptoes, reaching arms straight overhead to stars.
       - Cadence cues defined at 60s, 50s, 40s, 30s, 20s, 10s, 3s.
    7. **The Diplodocus** (`id: 'diplodocus'`, coach: Dippy `coachId: '7'`, 74 BPM, Core Stability & Balance, `hasHalfwaySideSwitch: true`):
       - Movement: Tabletop quadruped bird-dog balance with neck reach and wagging tail leg.
       - Halfway Switch: Synchronous announcement and limb mirror switch at 30 seconds (Side 1: right arm forward, left leg back; Side 2: left arm forward, right leg back).
       - Cadence cues at 60s, 50s, 40s, 30s ("HALFWAY! Switch sides now!"), 20s, 10s, 3s.
    8. **Spinosaurus Stretch** (`id: 'spinosaurus_stretch'`, coach: Spino `coachId: '8'`, 64 BPM, Breath & Spine Cool Down):
       - Movement: Cat-Cow restorative spine wave arching upward like a Spinosaurus dorsal sail fin.
       - Cadence cues defined at 60s, 50s, 40s, 30s, 20s, 10s, 3s.
  - Helper function: `getWorkoutById(workoutId)` in `src/data/petsData.js:1132-1137` normalizes ID strings and maps `diplodocus_balance` to `DINO_WORKOUTS[6]`.
  - Coach Roster: `PETS_DATABASE` (lines 32-273) defines all 8 dinosaur coaches with character key, name, avatar (`assets/pets/<key>.png`), and element attributes.

### 1.3 Canvas Rendering Architecture
- **File**: `c:\APP\stitch_little_hero_adventures\src\components\WorkoutHeroDuoCanvas.js` (1096 lines)
  - Renders a 2D HTML5 Canvas (`ctx = canvas.getContext('2d')`) at 60 FPS using `requestAnimationFrame`.
  - Dual Stage layout:
    - Floor elevation: `floorY = h * 0.78`
    - Left Pedestal (Coach Dino): `dinoCenterX = w * 0.28` (lines 295, 314-322, 385-500)
    - Right Pedestal (Hero Kiddo): `heroCenterX = w * 0.72` (lines 296, 323-331, 510-969)
  - Dino Coach Renderer (`renderDinoCoach`, lines 385-500):
    - Reads coach image from `getOrLoadPetImage(coach.avatar)`.
    - Implements kinematics per workout (speed bounce, stomp squash/stretch, vertical leap, skater sway, tiptoe stretch, tail wag, cat-cow arch).
  - Articulated Toddler Hero Renderer (`renderArticulatedToddler`, lines 510-969):
    - Full 2D hierarchical skeletal chain: Root -> Pelvis -> Torso -> Neck/Head -> Upper Arm -> Forearm -> Hand -> Thigh -> Calf -> Sneaker + Cape.
    - `isHalfwayFlipped` logic on line 512 mirrors limbs for Diplodocus at `workoutTimeRemaining <= 30`.
  - Lifecycle: `startLoop`, `update(dt)`, `render()`, `handleResize()`, `destroy()`, `setWorkout(workoutId, coachId, tempoBpm)`.

### 1.4 Circuit Mode, Water Break Intermission & Rewards
- **Circuit Mode** in `DinoWorkoutView.js`:
  - `sessionMode === 'circuit'` starts at `currentCircuitIndex = 0` (Move 1/8).
  - Circuit step indicators render at lines 162-190 with checkmark pills for completed steps and active indicator for the current step.
  - Duration per move is fixed at Titan Champion (60 seconds).
  - When move timer reaches 0 (`handleMoveCompletion`, lines 713-741):
    - If `currentCircuitIndex < DINO_WORKOUTS.length - 1` (moves 1 to 7): calls `startRestBreak()` (lines 744-771).
    - If `currentCircuitIndex === 7` (move 8 complete): transitions to `workoutPhase = 'circuit_complete'`, showing `#btn-finish-circuit`.
- **Water Break Intermission** (`startRestBreak`, lines 744-771):
  - Displays `#workout-rest-display` overlay with animated bouncing water drink icon (`local_drink`), 10-second countdown (`#rest-timer-display`), and "Skip Break & Continue" button (`#btn-skip-break`).
  - Automatically speaks hydration cheer: `"Great job! Grab a sip of water, shake out your arms and legs, and get ready for the next move!"`.
  - At timer expiry or on click of `#btn-skip-break`: advances `currentCircuitIndex++`, sets `store.setActiveWorkoutId(nextWorkout.id)`, resets workout state, and notifies store.
- **Store Methods & Rewards** in `src/state/store.js`:
  - `store.setActiveWorkoutId(id)` (line 1228) updates active workout in state.
  - `store.getWorkoutStreak()` (lines 8330-8341) manages 7-day stamp card (`stamps: [false x 7]`, `currentStreak`, `lastDate`).
  - `store.boostPetJoy(petId)` (lines 8343-8357) maxes pet Joy to 100% and sets energy.
  - `store.recordWorkoutCompletion(workoutId, xpAwarded, coinsAwarded, sparksAwarded)` (lines 8359-8390):
    - Calls `this.addPetSparks(petId, sparksAwarded)`
    - Calls `this.addPetTrainingXp(petId, xpAwarded)`
    - Calls `this.addCoins(coinsAwarded)`
    - Calls `this.boostPetJoy(petId)`
    - Updates 7-day streak stamps based on today's day of week (`getDay()`).
  - Single Move Practice Finish (`#btn-finish-workout`, lines 849-871):
    - Rewards: +10 to +20 Sparks, +45 to +80 XP (1.25x daily coach multiplier), +40 to +70 Coins, Joy 100%.
  - Grand 8-Minute Circuit Finish (`#btn-finish-circuit`, lines 874-895):
    - Rewards: +120 Evolution Sparks, +400 Training XP, +400 Hero Coins, Joy 100%, 7-Day Streak update, and confetti celebration.

### 1.5 Audio Pipeline, Voice Guidance & Cadence Timing
- **File**: `c:\APP\stitch_little_hero_adventures\src\services\voiceService.js` (728 lines)
  - `COMPANION_VOICE_PROFILES` (lines 14-204) maps all 8 dino coach keys and IDs ('1'-'8', 'rex', 'raptor', 'stego', 'pterry', 'chomper', 'brachio', 'dippy', 'spino') to Gemini voices:
    - Rex ('1'): Puck, pitch 1.25, rate 0.95
    - Raptor ('2'): Zephyr, pitch 1.35, rate 1.05
    - Stego ('3'): Fenrir, pitch 0.90, rate 0.88
    - Pterry ('4'): Aoede, pitch 1.40, rate 1.02
    - Chomper ('5'): Puck, pitch 1.45, rate 1.08
    - Brachio ('6'): Charon, pitch 0.85, rate 0.85
    - Dippy ('7'): Charon, pitch 1.05, rate 0.92
    - Spino ('8'): Fenrir, pitch 0.95, rate 0.88
  - `speakCompanion(text, petIdOrOptions, onEnded)` (lines 630-720):
    - Step 1: ElevenLabs PCM TTS via `/api/elevenlabs/tts`.
    - Step 2: Gemini 3.1 Flash TTS via `/api/gemini/tts`.
    - Step 3: Resilient client-side SpeechSynthesis fallback prioritizing 'Daniel' voice.
    - Anti-collision mechanism: `speechGeneration` counter increments on every call; in-flight promises verify `myGeneration === speechGeneration` before starting audio to prevent overlapping audio.
    - Module-level `stopRex()` immediately pauses active audio buffer and cancels `speechSynthesis`.
  - Cadence Runner in `DinoWorkoutView.js` (lines 688-699):
    - Iterates over `workout.cadenceTimeline`:
      ```javascript
      for (const cueItem of workout.cadenceTimeline) {
        if (remainingTime === cueItem.at && !spokenTimelineSet.has(cueItem.at)) {
          spokenTimelineSet.add(cueItem.at);
          speakCompanion(cueItem.cue, coachPet.id);
          break;
        }
      }
      ```
    - Timestamps: 60s (intro), 50s, 40s, 30s (halfway / side switch), 20s, 10s, 3s (countdown).
  - Server endpoints in `server/geminiService.js` and `server/elevenLabsService.js`:
    - `server/elevenLabsService.js` features an in-memory `ttsCache` with SHA-256 keys, capped at 200 entries.
    - `server/geminiService.js` lacks an in-memory TTS cache, and `PET_VOICE_MAP` currently lacks coaches 2-8 ('raptor', 'stego', 'pterry', 'chomper', 'brachio', 'dippy', 'spino'). Adding them to `PET_VOICE_MAP` and adding a client-side voice cache in `voiceService.js` will fulfill zero-latency R2 acceptance criteria.

### 1.6 3D Runtimes in the Codebase
- **Package Dependencies**:
  - `@splinetool/runtime: ^2.0.55` is installed in `package.json:20`.
  - `@google/genai: ^2.23.0` is installed in `package.json:19`.
  - Three.js (`three`) is not an explicit top-level dependency in `package.json`, but `@splinetool/runtime` includes its own WebGL runtime engine (`Application` class).
- **Existing Spline / WebGL Implementations**:
  - `src/services/hanaBattle3DService.js:22,310`:
    ```javascript
    import { Application } from '@splinetool/runtime';
    this.splineApp = new Application(this.canvas, { renderer: 'webgl' });
    await this.splineApp.load(url, variables);
    ```
    With `initProceduralFallback()` if WebGL or Spline loading fails.
  - `src/services/pet3DService.js:9-20`:
    Provides `isWebGLSupported()` feature check.
  - `src/data/threeDAssetCatalog.js`:
    Catalog of 3D assets with Spline scene URLs and GLB model URLs.

### 1.7 Design System & UX Guardrail Constraints
- **Color Palette**:
  - Confirmed from `src/styles/index.css` and `CLAUDE.md`:
    - Electric Cyan: `#00d2d3` / `#00e5ff` / `var(--color-tertiary)`
    - Emerald Green: `#2ecc71` / `#54e98a` / `var(--color-primary)`
    - Solar Amber: `#f1c40f` / `#ffb961` / `var(--color-secondary)`
    - Midnight Slate: `#09141e` / `#0f172a` / `var(--color-surface)`
  - STRICT PROHIBITION: Zero pink, purple, violet, magenta, fuchsia tokens or hex values.
- **Kid Voice Companion Guidelines** (`.agents/rules/kid_voice_companion_guidelines.md`):
  - Guideline 1: Non-blocking habit & reward minting — do not pop blocking reward modals from within floating widgets. Use `store.recordWorkoutCompletion()` cleanly.
  - Guideline 2: Mascot touch separation — mascot touch must trigger tactile responses, not toggle microphone. Dedicated oversized toggle buttons must control audio.
  - Guideline 3: Audio barge-in safeguards — tap-to-interrupt cleanly stops audio playback before opening inputs; anti-overlap via `stopRex()`.
  - Guideline 4: Event listener deduplication — cleanup previous custom event listeners on re-render to prevent memory leaks.

---

## 2. Logic Chain

1. **Premise 1**: Requirement R1 dictates mounting a true 3D character avatar (Spline / Three.js) animated via 3D skeletal bones side-by-side with the dinosaur coach, with a clean procedural 2D canvas fallback if WebGL fails.
   - *Observation Support*: In `DinoWorkoutView.js`, the viewport container is `<div id="workout-canvas-container">` inside `#workout-stage-mount`. The current engine is `WorkoutHeroDuoCanvas.js`, which renders the coach on the left (`w * 0.28`) and toddler hero on the right (`w * 0.72`).
   - *Inference*: Replacing or upgrading `WorkoutHeroDuoCanvas` or creating a dedicated 3D controller (`Workout3DArenaCanvas` / `WorkoutHeroDuo3D`) that loads a 3D avatar on the right stage alongside the 3D coach on the left stage directly fulfills R1 without disrupting `DinoWorkoutView.js` lifecycle methods (`setWorkout`, `setTimeRemaining`, `triggerBeat`, `pauseAnimation`, `resumeAnimation`, `destroy`).
   - *Fallback Mechanism*: If `isWebGLSupported()` returns false or `@splinetool/runtime` / WebGL fails to initialize, the component must cleanly invoke the existing 2D procedural rendering logic in `WorkoutHeroDuoCanvas.js`.

2. **Premise 2**: The 8 gross-motor workouts require distinct skeletal bone transformations matching specific instructions:
   - Velociraptor Run (balls of feet, 90° arm pumps).
   - Stegosaurus Walks (bear walk on hands/feet, hips high, 4 steps forward/backward, stomps).
   - Pterodactyl Take Off (wide arm circular wind-up, crouch, vertical takeoff leap).
   - T-Rex Run (tucked armpit short arms, driving high knees).
   - Compsognathus Prances (lateral skater jumps, crossing rear leg behind).
   - Brachiosaurus Stretch (feet together, tiptoe rise, overhead arm reach).
   - The Diplodocus (quadruped bird-dog balance with neck reach and tail wag, 30s synchronous side switch).
   - Spinosaurus Stretch (Cat-Cow spine wave with sail fin arch).
   - *Observation Support*: `WorkoutHeroDuoCanvas.js` lines 550-832 already contains exact kinematic mathematical equations for joint angles (`rootY`, `rootRot`, `spineAngle`, `headAngle`, `armLAngle`, `elbowLAngle`, `wristLAngle`, `thighLAngle`, `kneeLAngle`, `ankleLAngle`, `capeFly`).
   - *Inference*: These joint kinematic angles translate directly to 3D skeletal bone quaternions/Euler rotations in Three.js / Spline bone hierarchies: `pelvis`, `spine_01`, `spine_02`, `neck`, `head`, `shoulder_L/R`, `upperarm_L/R`, `lowerarm_L/R`, `hand_L/R`, `thigh_L/R`, `calf_L/R`, `foot_L/R`.

3. **Premise 3**: Requirement R2 requires hybrid audio coaching with zero latency, cadence cues at 0s, 10s, 20s, 30s, 40s, 50s, 58s, synchronous 30s Diplodocus flip, and no overlapping audio.
   - *Observation Support*: `voiceService.js` already implements `speechGeneration` anti-collision logic, ElevenLabs + Gemini + Daniel SpeechSynthesis fallback tiers. However, voice audio fetches from the server can introduce network latency on cold starts.
   - *Inference*: Implementing a client-side in-memory audio clip cache (`Map<string, AudioBuffer>`) in `voiceService.js` or pre-fetching/pre-rendering workout cadence clips at workout initialization ensures 0ms latency audio triggers at exact cadence timestamps. Furthermore, adding the 7 missing dinosaur coaches to `PET_VOICE_MAP` in `server/geminiService.js` ensures high-fidelity AI voice personas across all 8 workouts.

4. **Premise 4**: Requirement R3 requires preserving all existing store methods, 8-minute circuit mode, water break intermissions, and reward systems while adhering to Stitch design system.
   - *Observation Support*: `store.recordWorkoutCompletion()`, `store.boostPetJoy()`, `store.getWorkoutStreak()`, `store.setActiveWorkoutId()` in `src/state/store.js` work seamlessly with `DinoWorkoutView.js`.
   - *Inference*: The 3D character integration must not alter store method signatures or reward values (+120 Sparks, +400 XP, +400 Coins for circuit; +10-20 Sparks, +45-80 XP, +40-70 Coins for practice). The color palette must remain strictly Electric Cyan, Emerald Green, Solar Amber, and Midnight Slate.

---

## 3. Caveats

1. **Hardware / Device WebGL Constraints**: Low-end Android tablets or restricted school Chromebooks may lack WebGL 2.0 or hardware acceleration. The 2D procedural canvas fallback is mandatory and must be battle-tested against null WebGL context.
2. **Spline Remote Assets vs Local Procedural 3D**: Remote `.splinecode` scenes depend on CDN network connectivity. If external Spline URLs are blocked or offline, local procedural 3D (via WebGL shaders or Three.js procedural primitives) or procedural 2D canvas must initialize instantly without throwing uncaught promise rejections.
3. **SpeechSynthesis Voice Availability**: While `Daniel` is the designated preferred voice on Apple devices, Windows/Android devices might not have a voice named `Daniel`. The fallback chain in `selectPreferredVoice` properly resolves to other natural English voices (`Natural`, `Google US`, `Junior`, `Samantha`), but tests must mock SpeechSynthesis safely in headless environments (`scratch/setup_mock_env.js`).

---

## 4. Conclusion

1. **Arena Mounting Point**: `c:\APP\stitch_little_hero_adventures\src\components\WorkoutHeroDuoCanvas.js` mounted by `c:\APP\stitch_little_hero_adventures\src\views\DinoWorkoutView.js` into `#workout-canvas-container` is the exact, canonical integration point.
2. **Kinematic Choreography Ready**: All 8 gross-motor choreographies are completely mathematically defined in `WorkoutHeroDuoCanvas.js` (lines 550-832) and can be mapped directly to 3D skeletal bones (`root`, `pelvis`, `spine`, `neck`, `head`, `shoulders`, `elbows`, `hands`, `hips`, `knees`, `feet`, `cape`).
3. **Synchronous 30s Diplodocus Switch**: In `DINO_WORKOUTS[6]`, `hasHalfwaySideSwitch: true` triggers at `remainingTime === 30`. At 30s, the coach announces the switch ("HALFWAY! Switch sides now!"), the timer subtitle updates to "Switched Sides • Push to Finish!", and the avatar mirrors its pose from Right-Arm/Left-Leg to Left-Arm/Right-Leg.
4. **Hybrid Audio Enhancement**: The voice pipeline in `voiceService.js` is structurally sound. To achieve zero latency (R2), a client-side audio cache (`workoutAudioClipCache`) and pre-caching mechanism during the 3-2-1 countdown should be added, along with updating `PET_VOICE_MAP` in `server/geminiService.js`.
5. **Design & Guardrail Integrity**: All existing store methods (`setActiveWorkoutId`, `getWorkoutStreak`, `recordWorkoutCompletion`), circuit mode steps (1-8 with 10s water breaks), and Electric Cyan/Emerald/Amber/Slate palette are fully documented and ready for 3D specialist implementation.

---

## 5. Verification Method

### 5.1 Automated Test Execution
Run the complete Little Hero Adventures regression test suite:
```powershell
node scratch/run_all_tests.js
```
Expected result: `🎉 ALL TEST SUITES PASSED SUCCESSFULLY!` with 0 failures.

### 5.2 Build Verification
Run Vite production build:
```powershell
npm run build
```
Expected result: Vite builds `dist/` with exit code 0 and zero bundling or syntax errors.

### 5.3 Targeted Workout & Store Verification
Inspect key files:
- `src/views/DinoWorkoutView.js`: Check mount of duo stage, 8-minute circuit loop, water break timer, and reward minting.
- `src/components/WorkoutHeroDuoCanvas.js`: Check side-by-side positioning, 8 workout kinematic switches, and 30s Diplodocus mirror flip.
- `src/data/petsData.js`: Verify DINO_WORKOUTS definitions (tempo, form cues, cadenceTimeline).
- `src/services/voiceService.js`: Verify anti-overlapping `speechGeneration` and Daniel voice selection.

### 5.4 Invalidation Conditions
- Any introduction of pink or purple colors (`#ff00ff`, `purple-500`, `pink-500`, etc.) in views or styles.
- Modifying `recordWorkoutCompletion` arguments or breaking 7-day streak stamp array in `store.js`.
- Breaking the 10-second water break intermission in circuit mode.
- WebGL initialization throwing unhandled errors when `canvas.getContext('webgl')` returns null.
