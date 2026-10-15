# Explorer 3 Survey Report: Hybrid Studio Audio Companion & Test/Build Infrastructure

## Executive Summary
This survey investigated the audio architecture, voice coaching pipeline, dinosaur coach personas, cadence timing logic, 30s Diplodocus side switch synchronization, and the existing test/build infrastructure.
Both `npm run build` and `node scratch/run_all_tests.js` (55 test suites) currently pass with 0 errors.
Key gaps identified include:
1. Vite dev server middleware in `vite.config.js` is missing `/api/elevenlabs/tts` route handling (only present in production `server.js`).
2. Server-side Gemini voice mapping and personas in `server/geminiService.js` only cover 5 pets; dinosaur coach keys (`raptor`, `stego`, `pterry`, `chomper`, `brachio`, `dippy`, `spino`) fall back to `rex` and `Puck`.
3. In `DinoWorkoutView.js`, the timer loop decrements `remainingTime` before checking `cadenceTimeline`, preventing the 60s (0s elapsed) cadence cue from ever firing.
4. Voice cues currently rely on real-time network calls without client-side audio pre-caching, introducing 800ms–2500ms latency that desynchronizes the Diplodocus 30s audio cue from the visual avatar mirror.

---

## 1. Observation

### 1.1 Audio Architecture & API Endpoints
- **Production Server (`server.js`)**:
  - Line 23: `app.post('/api/gemini/tts', handleTTSRequest);`
  - Line 24: `app.post('/api/gemini/chat', handleChatRequest);`
  - Line 27: `app.post('/api/elevenlabs/tts', handleElevenLabsTTSRequest);`
  - Line 72: `attachGeminiLiveWebSocket(server);`
- **Vite Dev Server Configuration (`vite.config.js`)**:
  - Lines 27-68 in `setupGeminiMiddleware`:
    ```javascript
    const url = req.url ? req.url.split('?')[0] : '';
    if (url === '/api/gemini/tts' && req.method === 'POST') { ... }
    if (url === '/api/gemini/chat' && req.method === 'POST') { ... }
    ```
    *Observation*: `/api/elevenlabs/tts` is completely omitted from `vite.config.js`. Under `npm run dev` or `vite preview`, requests to `/api/elevenlabs/tts` fall through to the SPA router, failing or returning HTML.
- **ElevenLabs Server Service (`server/elevenLabsService.js`)**:
  - Lines 16-29: In-memory cache `ttsCache = new Map()` capped at `TTS_CACHE_MAX_ENTRIES = 200`. Keyed via `getTtsCacheKey`: `createHash('sha256').update(`${cleanText}|${voiceId}|${speed}`).digest('hex')`.
  - Lines 37-39: `ELEVENLABS_VOICE_MAP = { rex: process.env.ELEVENLABS_REX_VOICE_ID || null };`.
  - Lines 95-100: If `voiceId` is not defined in `ELEVENLABS_VOICE_MAP` (which is true for all dinosaurs other than Rex), the server returns `404 { error: 'No ElevenLabs voice configured for pet...' }`.
- **Gemini TTS Server Service (`server/geminiService.js`)**:
  - Model: `gemini-3.1-flash-tts-preview` with `Modality.AUDIO`.
  - Lines 27-34: `PET_VOICE_MAP` defines:
    ```javascript
    export const PET_VOICE_MAP = {
      rex: 'Puck',
      bella: 'Aoede',
      barnaby: 'Fenrir',
      pip: 'Zephyr',
      aqua: 'Charon',
      aqua_drake: 'Charon'
    };
    ```
  - Lines 36-81: `PET_PERSONAS` defines personas only for `rex`, `bella`, `barnaby`, `pip`, and `aqua`.
  - Lines 164-167:
    ```javascript
    const normalizedPetId = String(petId || 'rex').toLowerCase();
    const selectedVoice = voice || PET_VOICE_MAP[normalizedPetId] || 'Puck';
    const persona = PET_PERSONAS[normalizedPetId] || PET_PERSONAS.rex;
    ```
    *Observation*: All dinosaur coach IDs (`raptor`, `stego`, `pterry`, `chomper`, `brachio`, `dippy`, `spino`) fall back to persona `rex` and voice `'Puck'`.
- **Client Voice Service (`src/services/voiceService.js`)**:
  - Lines 14-204: `COMPANION_VOICE_PROFILES` defines all 8 dinosaur coach profiles with `pitch`, `rate`, and `geminiVoice`:
    - `rex` / `'1'`: 'Puck' (pitch: 1.25, rate: 0.95)
    - `raptor` / `'2'`: 'Zephyr' (pitch: 1.35, rate: 1.05)
    - `stego` / `'3'`: 'Fenrir' (pitch: 0.90, rate: 0.88)
    - `pterry` / `'4'`: 'Aoede' (pitch: 1.40, rate: 1.02)
    - `chomper` / `'5'`: 'Puck' (pitch: 1.45, rate: 1.08)
    - `brachio` / `'6'`: 'Charon' (pitch: 0.85, rate: 0.85)
    - `dippy` / `'7'`: 'Charon' (pitch: 1.05, rate: 0.92)
    - `spino` / `'8'`: 'Fenrir' (pitch: 0.95, rate: 0.88)
  - Lines 215-222: Concurrency protection via `speechGeneration` integer counter. Every call to `speakCompanion()` increments `speechGeneration` and checks `if (myGeneration !== speechGeneration) return;` after each await.
  - Lines 317-351: `stopRex()` aborts any active Web Audio buffer source (`currentAudioSource.stop()`), clears syllable ticker (`currentSyllableInterval`), pauses HTML5 audio, cancels `window.speechSynthesis.cancel()`, and dispatches `companion-speech-end`.
  - Lines 374-406: `selectPreferredVoice('daniel')` prioritizes native 'Daniel' voice, followed by natural English fallbacks.
  - Lines 630-720: Multi-tier fallback order:
    1. ElevenLabs (`/api/elevenlabs/tts`)
    2. Gemini Flash TTS (`/api/gemini/tts`)
    3. Browser SpeechSynthesis (`speakWithSpeechSynthesis`)
  - *Observation*: There is no client-side audio cache in `voiceService.js`. Every cue fetch performs a full network roundtrip unless falling back to SpeechSynthesis.

### 1.2 Dinosaur Coach Personas & Cadence Timing in `src/data/petsData.js`
- Lines 864-1130: `DINO_WORKOUTS` defines 8 workouts:
  1. `velociraptor_run` (Coach Raptor, ID 2, BPM 138)
  2. `stegosaurus_walks` (Coach Stego, ID 3, BPM 92)
  3. `pterodactyl_takeoff` (Coach Pterry, ID 4, BPM 112)
  4. `trex_run` (Coach Rex, ID 1, BPM 122)
  5. `compsognathus_prance` (Coach Chomper, ID 5, BPM 126)
  6. `brachiosaurus_stretch` (Coach Brachio, ID 6, BPM 78)
  7. `diplodocus` (Coach Dippy, ID 7, BPM 74, `hasHalfwaySideSwitch: true`)
  8. `spinosaurus_stretch` (Coach Spino, ID 8, BPM 64)
- Each workout has a `cadenceTimeline` array with 7 cues at: `{ at: 60 }`, `{ at: 50 }`, `{ at: 40 }`, `{ at: 30 }`, `{ at: 20 }`, `{ at: 10 }`, `{ at: 3 }`.
- In `DinoWorkoutView.js`:
  - Lines 644-651: `remainingTime` is initialized to 60s.
  - Lines 676-681:
    ```javascript
    timerInterval = setInterval(() => {
      if (isPaused) return;
      remainingTime--;
      if (timerDisplay) timerDisplay.textContent = `${remainingTime}s`;
      ...
      if (isVoiceEnabled && workout.cadenceTimeline) {
        for (const cueItem of workout.cadenceTimeline) {
          if (remainingTime === cueItem.at && !spokenTimelineSet.has(cueItem.at)) {
            spokenTimelineSet.add(cueItem.at);
            try {
              speakCompanion(cueItem.cue, coachPet.id);
            } catch (e) {}
            break;
          }
        }
      }
    ```
  - *Observation*: On tick 1 (at elapsed t = 1s), `remainingTime--;` executes first, immediately changing `remainingTime` to 59. Therefore `remainingTime === 60` is NEVER true, and the first cadence cue ({ at: 60 }) NEVER fires.
  - *Observation*: The cue at the end is placed at `{ at: 3 }` (57s elapsed), whereas requirement R2 specifies 58s (which would be remainingTime = 2).

### 1.3 Diplodocus 30s Side Switch Synchronization
- In `petsData.js` (lines 1065-1096):
  - `diplodocus` has `hasHalfwaySideSwitch: true`.
  - Cadence cue at 30s: `{ at: 30, cue: "HALFWAY! Switch sides now! Stretch your left arm forward, and your right leg straight back! Wag that tail!" }`.
- In `WorkoutHeroDuoCanvas.js`:
  - Line 512: `const isHalfwayFlipped = (this.workoutId === 'diplodocus' && this.workoutTimeRemaining <= 30);`.
  - When `isHalfwayFlipped` becomes true, the pose immediately mirrors:
    - Side 1: Right arm forward (neck), Left leg backward (tail wag).
    - Side 2: Left arm forward (neck), Right leg backward (tail wag).
  - *Observation*: While the 2D canvas mirrors instantly at `workoutTimeRemaining <= 30`, the voice announcement suffers an 800ms–2500ms network fetch delay before playing unless audio is pre-cached or instant fallback is active.

### 1.4 Procedural Workout Beat in `src/audio/sfx.js`
- Lines 995-1078: `Sound.startWorkoutBeat(bpm = 126, onBeat)` generates a procedural 8-step chiptune groove with kick, snare, bassline, and lead synth via Web Audio API.
- Lines 1080-1085: `Sound.stopWorkoutBeat()` cleanly clears `workoutBeatInterval`.

### 1.5 Testing and Build Infrastructure
- Tool execution: `npm run build`
  - Output: `✓ built in 19.49s`, exit code `0`.
- Tool execution: `node scratch/run_all_tests.js`
  - Output: `🎉 ALL TEST SUITES PASSED SUCCESSFULLY!`, exit code `0`.
  - 55 test files executed sequentially using `child_process.spawnSync('node', [file], { stdio: 'inherit' })`.
  - Test harness mocks: `scratch/setup_mock_env.js` provides headless polyfills for `document`, `window`, `localStorage`, `requestAnimationFrame`, `Image`, `CustomEvent`, and `PointerEvent`.
  - *Observation*: No test file currently tests `DinoWorkoutView` cadence cues, 8 dinosaur coach personas, or 30s side switch synchronization.

---

## 2. Logic Chain

1. **Cadence Timing Bug**:
   - `totalDuration` and `remainingTime` are set to 60.
   - In `setInterval(..., 1000)`, `remainingTime--;` executes before the `remainingTime === cueItem.at` check.
   - On the first tick (1000ms after start), `remainingTime` is 59.
   - `cueItem.at` in `petsData.js` is set to 60 for the first cue.
   - Because 59 != 60, the cue at 60s is completely bypassed and never spoken.
   - Fixing this requires either:
     - Checking `remainingTime === cueItem.at` before decrementing, OR
     - Triggering the initial (0s elapsed / 60s remaining) cue immediately when `startActiveWorkoutTimer()` begins, OR
     - Normalizing cadence cues to elapsed time `[0, 10, 20, 30, 40, 50, 58]`.

2. **Zero-Latency Audio Requirement**:
   - Requirement R2 mandates zero-latency instant playback for voice lines.
   - `server/elevenLabsService.js` has a 200-item in-memory cache, but only for `rex`.
   - `src/services/voiceService.js` has NO client-side audio cache.
   - Calling `speakCompanion` causes a network round-trip of 800ms–2500ms to `/api/gemini/tts` or `/api/elevenlabs/tts`.
   - To achieve zero latency during workouts:
     - Implement a client-side audio cache (in-memory Map or IndexedDB) in `voiceService.js` or `dinoWorkoutVoiceCache`.
     - When `renderDinoWorkoutView` or the workout mount loads, pre-fetch/pre-warm the 7 cadence lines + intro + cheer for the selected coach.
     - When `speakCompanion` is invoked during the workout, it immediately checks the pre-warmed audio cache and plays with 0ms latency.

3. **Dinosaur Coach Personas on Server**:
   - The client `voiceService.js` sends `{ text, petId: coachPet.id }`.
   - The server endpoint `handleTTSRequest` normalizes `petId` and looks up `PET_VOICE_MAP[normalizedPetId]` and `PET_PERSONAS[normalizedPetId]`.
   - Because only `rex`, `bella`, `barnaby`, `pip`, `aqua` are registered, any dinosaur coach (`raptor`, `stego`, `pterry`, `chomper`, `brachio`, `dippy`, `spino`) defaults to `rex` and `Puck`.
   - Updating `server/geminiService.js` with the 8 dinosaur personas and voice mappings ensures each dinosaur coach sounds distinct on the high-fidelity Gemini Flash TTS tier.

4. **Diplodocus Side Switch Synchronization**:
   - At `remainingTime === 30`, the 2D/3D avatar changes posture from Side 1 (Right arm / Left leg) to Side 2 (Left arm / Right leg).
   - If the audio is pre-cached, the speech playback ("HALFWAY! Switch sides now!") will start at the exact same millisecond that the avatar mirrors, fulfilling Acceptance Criterion R2.

5. **Audio Queue & Guardrails (`kid_voice_companion_guidelines.md`)**:
   - Rule 3 requires: Companion speech must not be abruptly interrupted by minor timing overlaps.
   - Cadence cues are spaced 10 seconds apart (0s, 10s, 20s, 30s, 40s, 50s, 58s).
   - Each script line is 1–2 short sentences (~3–4 seconds of spoken audio), leaving ~6 seconds of clear rhythmic beat between cues.
   - If previous audio is still playing when a cue arrives, a non-blocking queue should ensure the prior line finishes or is smoothly transitioned rather than throwing errors.

---

## 3. Caveats

1. **3D Avatar Implementation**:
   - `WorkoutHeroDuoCanvas.js` is currently a 2D canvas with procedural skeletal bone kinematics.
   - Explorer 1 & 2 are analyzing the 3D model / Three.js / Spline runtime integration. This report focuses on the audio, cadence timing, and verification harness.
2. **ElevenLabs API Keys**:
   - `ELEVENLABS_API_KEY` may not be present in all development/local test environments. The hybrid engine correctly falls back to Gemini Flash TTS (`/api/gemini/tts`) and then to browser SpeechSynthesis ('Daniel' voice).
3. **SpeechSynthesis Headless Mocking**:
   - In headless Node.js test environments (`scratch/run_all_tests.js`), `window.speechSynthesis` and `AudioContext` are mocked or stubbed. Real audio playback requires interactive browser verification.

---

## 4. Conclusion

The application has a robust multi-tier voice architecture (`voiceService.js`) and audio synthesizer (`sfx.js`), but four specific improvements are required to fulfill Requirement R2 and R3:

1. **Add Dinosaur Coach Personas to Server (`server/geminiService.js`)**:
   - Add voice mappings for all 8 dinosaur coaches to `PET_VOICE_MAP`:
     - `rex`: 'Puck', `raptor`: 'Zephyr', `stego`: 'Fenrir', `pterry`: 'Aoede', `chomper`: 'Puck', `brachio`: 'Charon', `dippy`: 'Charon', `spino`: 'Fenrir'.
   - Add persona prompt definitions for all 8 dinosaur coaches to `PET_PERSONAS`.
2. **Add Missing Route in `vite.config.js`**:
   - Add `/api/elevenlabs/tts` to `setupGeminiMiddleware` so local Vite development matches production `server.js`.
3. **Fix Cadence Cue Timing in `DinoWorkoutView.js` & `petsData.js`**:
   - Support exact cadence timestamps: 0s, 10s, 20s, 30s, 40s, 50s, 58s.
   - Fix the decrement-before-check bug so the 0s (60s remaining) cue fires immediately upon timer start.
4. **Implement Client-Side Zero-Latency Audio Cache**:
   - Add a workout audio pre-warmer that pre-fetches and caches the 7 cadence clips + intro + cheer for the active workout coach upon screen mount.
   - At t = 30s, trigger the pre-cached Diplodocus side switch audio clip synchronously with the avatar mirror.
5. **Add Automated Verification Test Suite**:
   - Create `scratch/verify_dino_workout_audio_and_cadence.mjs` to test:
     - All 8 dinosaur coaches have voice profiles and cadence timelines.
     - Cadence cues fire at 0s, 10s, 20s, 30s, 40s, 50s, 58s without missing cues.
     - Diplodocus 30s side switch cue triggers correctly.
     - Audio caching mechanisms return cached audio for repeat cues.
   - Register the test suite in `scratch/run_all_tests.js`.

---

## 5. Verification Method

### 5.1 Build & Test Commands
- Build verification:
  ```powershell
  npm run build
  ```
  *Expected result*: Vite build completes with exit code 0.
- Full test suite verification:
  ```powershell
  node scratch/run_all_tests.js
  ```
  *Expected result*: All 55+ suites pass with 0 failures.

### 5.2 Verification Script Proposal
A new test script `scratch/verify_dino_workout_audio_and_cadence.mjs` should verify:
1. `DINO_WORKOUTS` has 8 distinct gross-motor workouts with valid `coachId`, `tempoBpm`, and `cadenceTimeline`.
2. `cadenceTimeline` for each workout contains cues matching 0s, 10s, 20s, 30s, 40s, 50s, 58s cadence.
3. `COMPANION_VOICE_PROFILES` in `src/services/voiceService.js` contains profiles for all 8 dinosaurs with valid `pitch`, `rate`, and `geminiVoice`.
4. `server/geminiService.js` contains valid entries for all 8 dinosaurs in `PET_VOICE_MAP` and `PET_PERSONAS`.
5. `timerInterval` in `DinoWorkoutView.js` triggers the 0s cue without skipping.
6. Diplodocus workout has `hasHalfwaySideSwitch: true` and fires at 30s.

### 5.3 Invalidation Conditions
- Any code edit that breaks existing test suites in `scratch/run_all_tests.js`.
- Introducing pink or purple hex codes (`#ff00ff`, `#9333ea`, etc.) violating Stitch design system rules.
- Any regression in `npm run build`.
