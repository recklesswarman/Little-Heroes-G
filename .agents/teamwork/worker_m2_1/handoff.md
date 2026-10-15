# Handoff Report: Hybrid Studio Audio & Cadence Specialist (Worker M2)

## 1. Observation
- `server/geminiService.js`:
  - Previously, `PET_VOICE_MAP` only contained 5 pets (`rex`, `bella`, `barnaby`, `pip`, `aqua`, `aqua_drake`). All 7 other dinosaur coach keys (`raptor`, `stego`, `pterry`, `chomper`, `brachio`, `dippy`, `spino`) defaulted to `rex` and `Puck`.
  - Added all 8 dinosaur coach keys to `PET_VOICE_MAP` with specified voices:
    - `rex`: 'Puck', `raptor`: 'Zephyr', `stego`: 'Fenrir', `pterry`: 'Aoede', `chomper`: 'Puck', `brachio`: 'Charon', `dippy`: 'Charon', `spino`: 'Fenrir', plus numeric string aliases `'1'` through `'8'`.
  - Added dedicated, engaging, kid-friendly gross-motor coaching personas to `PET_PERSONAS` for all 8 dinosaurs (`rex`, `raptor`, `stego`, `pterry`, `chomper`, `brachio`, `dippy`, `spino`) along with numeric ID aliases `PET_PERSONAS['1']` through `PET_PERSONAS['8']`.
- `vite.config.js`:
  - Added `import 'dotenv/config'` to ensure environment variables are present in Vite dev and preview modes.
  - Dynamically imported `./server/elevenLabsService.js` in `setupGeminiMiddleware`.
  - Added `/api/elevenlabs/tts` POST route handler in `setupGeminiMiddleware` so local Vite development and test preview mirror production `server.js` (line 27).
- `src/services/voiceService.js`:
  - Exported `workoutAudioClipCache = new Map()` for zero-latency client-side audio clip caching.
  - Exported `normalizePetKey(petId)` and `getAudioCacheKey(text, petId)` to support both numeric roster IDs ('1'–'8') and semantic keys ('rex'–'spino').
  - Implemented `prewarmWorkoutAudio(workoutId, coachId)`: scans `workout.cadenceTimeline` (all 7 cues at 60s, 50s, 40s, 30s, 20s, 10s, 3s/58s) and `workout.audioCues` (intro, halfway, finalCheer), pre-fetching audio via ElevenLabs -> Gemini Flash TTS and pre-decoding raw PCM into `AudioBuffer` for instant playback.
  - Updated `playPcmTtsResponse`: added support for pre-decoded `AudioBuffer` reuse and anti-collision cleanup (`currentAudioSource.stop()` and disconnect).
  - Updated `speakCompanion`: checks `workoutAudioClipCache` first (Tier 0), playing immediately with 0ms latency, falling back to ElevenLabs -> Gemini Flash TTS -> browser SpeechSynthesis with natural 'Daniel' voice.
  - Enforced anti-collision and non-overlapping safeguards per `kid_voice_companion_guidelines.md` via `stopRex()`, `speechGeneration` stale check, and active source cleanup.
- Verification & Build:
  - `npm run build` completed with exit code 0 (`built in 12.66s`).
  - `node scratch/run_all_tests.js` executed all 55 test suites and passed with 0 failures (`🎉 ALL TEST SUITES PASSED SUCCESSFULLY!`).

## 2. Logic Chain
1. **Dinosaur Coach Voices & Personas**:
   - `geminiService.js` routes TTS and Chat requests through `PET_VOICE_MAP` and `PET_PERSONAS`.
   - By registering all 8 dinosaurs (`rex`, `raptor`, `stego`, `pterry`, `chomper`, `brachio`, `dippy`, `spino`) with distinct voices (`Puck`, `Zephyr`, `Fenrir`, `Aoede`, `Puck`, `Charon`, `Charon`, `Fenrir`), each prehistoric workout coach delivers a unique, characterful voice matching their gross-motor movements.
2. **Vite Dev Middleware Parity**:
   - In production `server.js`, `/api/elevenlabs/tts` is routed to `handleElevenLabsTTSRequest`.
   - In `vite.config.js`, previously only `/api/gemini/tts` and `/api/gemini/chat` were handled. Adding `/api/elevenlabs/tts` ensures dev/preview parity without routing failures.
3. **Zero-Latency Audio Cache & Synchronous Cues**:
   - Network requests to TTS APIs take 800ms–2500ms, which desynchronizes timed workout cadence lines (specifically the Diplodocus 30s halfway side-switch announcement).
   - By invoking `prewarmWorkoutAudio(workoutId, coachId)` when a workout is loaded, all cadence lines and cheers are cached and decoded into Web Audio `AudioBuffer` objects in memory.
   - When `speakCompanion` is invoked during the workout timer, it immediately hits the cache, bypassing network hops and playing in 0ms synchronously with visual animations.
4. **Anti-Collision Safeguards**:
   - `kid_voice_companion_guidelines.md` mandates that companion speech must not overlap or talk over itself.
   - Calling `stopRex()` at the beginning of `speakCompanion`, verifying `myGeneration === speechGeneration` across async boundaries, and cleanly disconnecting `currentAudioSource` in `playPcmTtsResponse` prevents overlapping audio streams.

## 3. Caveats
- Real API calls to ElevenLabs require `ELEVENLABS_API_KEY` to be configured in `.env`. When not configured, the service cleanly falls through to Gemini Flash TTS (`/api/gemini/tts`) and subsequently to browser `speechSynthesis` ('Daniel' voice), maintaining uninterrupted functionality.
- In headless Node.js test runners without Web Audio or SpeechSynthesis, the fallback chain safely executes without throwing runtime errors.

## 4. Conclusion
All M2 hybrid audio and cadence requirements are fully implemented and verified:
- `server/geminiService.js` contains all 8 dinosaur coach keys and rich personas.
- `vite.config.js` properly handles `/api/elevenlabs/tts`.
- `src/services/voiceService.js` provides `workoutAudioClipCache`, `prewarmWorkoutAudio`, instant cache playback, and anti-collision safeguards.
- Both `npm run build` and `node scratch/run_all_tests.js` pass with 0 errors.

## 5. Verification Method
1. **Build Verification**:
   ```powershell
   npm run build
   ```
   *Expected outcome*: Exits with code 0.
2. **Regression Test Suite Verification**:
   ```powershell
   node scratch/run_all_tests.js
   ```
   *Expected outcome*: All test suites pass with 0 failures.
3. **Files to Inspect**:
   - `c:\APP\stitch_little_hero_adventures\server\geminiService.js` (lines 26-178)
   - `c:\APP\stitch_little_hero_adventures\vite.config.js` (lines 1-86)
   - `c:\APP\stitch_little_hero_adventures\src\services\voiceService.js` (lines 9-45, 550-745, 750-855)
