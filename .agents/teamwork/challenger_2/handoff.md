# Handoff Report — Challenger 2 (Milestone 4 Gate Verification)

**Verdict**: **APPROVE**  
**Role**: Empirical Challenger (critic, specialist)  
**Agent Folder**: `c:\APP\stitch_little_hero_adventures\.agents\teamwork\challenger_2`  
**Date**: 2026-10-25T03:22:00Z  

---

## 1. Observation

Direct empirical observations collected via automated probing, test harness execution, and source code auditing:

### 1.1 Audio Ducking and Swelling (`src/audio/sfx.js`)
- In `src/audio/sfx.js` (lines 1795–1820), `Sound.duckLullaby(ducked = true)` inspects `lullabyMasterGain`:
  - When `duckLullaby(true)` is invoked, `master.gain.linearRampToValueAtTime(0.15, now + 0.7)` schedules gain to 0.15 (15% volume) over 0.7s.
  - When `duckLullaby(false)` is invoked, `master.gain.linearRampToValueAtTime(1.0, now + 1.3)` smoothly swells gain to 1.0 (100% volume) over 1.3s.
  - Individual synthesized notes in `playNextNote` (lines 1737–1746) scale peak gains by the ducked state:
    - Primary bell tone: `lullabyDucked ? 0.036 : 0.24` (ratio: `0.036 / 0.24 = 0.15`, exactly 15%).
    - Celesta overtone: `lullabyDucked ? 0.0105 : 0.07` (ratio: `0.0105 / 0.07 = 0.15`, exactly 15%).
    - Tactile bedtime constellation chime in `playBedtimeChime` (line 1843): `lullabyDucked ? 0.08 : 0.16` (scaled down by 50% during narration).
  - Stop safety: `Sound.stopLullaby()` (lines 1857–1859) explicitly resets `lullabyDucked = false`.

### 1.2 Auto-Advance Timing & Concurrency Resistance (`src/services/bedtimeStoryService.js`, `src/views/BedtimeStoryView.js`)
- In `src/services/bedtimeStoryService.js` (lines 256–278), `startAutoAdvance(onAdvance, seconds)`:
  - Default countdown parameter is exactly 3 seconds (`autoAdvanceSecondsRemaining = 3`).
  - Dispatches `bedtime-story-autoadvance-tick` with `{ secondsRemaining: 3, active: true }`.
  - Ticks down every 1000ms: 3s -> 2s -> 1s -> 0s -> triggers `onAdvance()`.
- Re-entrancy and Concurrency Guard in `advanceStory()` (lines 345–351):
  ```javascript
  this.cancelAutoAdvance();
  if (!this.activeSession) return null;
  if (this.isAdvancing) return null;
  this.isAdvancing = true;
  ```
  - Rapid bursts of 25 simultaneous manual calls in `scratch/test_adversarial_challenger_2.mjs` advanced `actNumber` from 1 to 2, never skipping to 3 or 4.
  - Successive bursts advanced cleanly to 3, then 4, and clamped permanently at 4 once completed.
- Stale Callback Invalidation: `cancelAutoAdvance()` (lines 234–254) increments `this.narrationGeneration = (this.narrationGeneration || 0) + 1`. Handlers from previous speech callbacks verify `currentGeneration === this.narrationGeneration` before triggering actions, discarding stale callbacks.

### 1.3 Parent Mode Guardrail (`src/services/bedtimeStoryService.js`)
- In `src/services/bedtimeStoryService.js` (lines 411–420):
  ```javascript
  const session = this.activeSession;
  if (session?.narrationMode === 'parent') {
    Sound.duckLullaby(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bedtime-story-speech-finished'));
    }
    return;
  }
  ```
  - Auto-advance countdown is completely bypassed in Parent Mode (`autoAdvanceInterval` and `autoAdvanceTimer` remain `null`).
  - `Sound.duckLullaby(false)` is immediately invoked so lullaby synthesizer stays at 100% volume for parents reading aloud.
  - Manual page turn buttons remain fully active and transition chapters cleanly.

### 1.4 ElevenLabs Voice Resolution across all 24 Pets and Heroes (`server/elevenLabsService.js`, `functions/src/voiceApi.ts`)
- In `server/elevenLabsService.js` (lines 34–37, 87–95, 103–108):
  - `DEFAULT_MAIN_VOICE_ID = 'e9sQs6aLWU82SSolkPYZ'`.
  - Bedtime requests (`voiceStyle === 'bedtime'`) strictly route to `process.env.ELEVENLABS_REX_VOICE_ID || DEFAULT_MAIN_VOICE_ID`.
  - Bedtime voice settings:
    ```javascript
    {
      stability: 0.65,
      similarity_boost: 0.80,
      style: 0.35,
      use_speaker_boost: true,
      speed: 0.85
    }
    ```
  - Tested across all 24 companion pets in `PETS_DATABASE` (IDs 1 through 24, and keys `rex`, `raptor`, `stego`, `pterry`, `chomper`, `brachio`, `dippy`, `spino`, `sparky`, `aero`, `blaze`, `hydra`, `luna`, `kira`, `boulder`, `cosmo`, `leo`, `stripe`, `fang`, `scout`, `gnasher`, `shadow`, `barnaby`, `ollie`). All 24 returned HTTP 200 and resolved to `e9sQs6aLWU82SSolkPYZ`.
  - Tested with custom hero IDs (`hero_1`, `hero_leo`, `hero_maya`, `custom_hero_99`, empty, null, undefined). All resolved to `e9sQs6aLWU82SSolkPYZ`.
  - In `functions/src/voiceApi.ts` (lines 147–167), identical canonical voice ID resolution and bedtime voice settings are enforced.
  - Rate Limiter Verification: `isRateLimited('elevenlabs-tts:' + ip, 30, 60_000)` enforces quota limits, correctly returning HTTP 429 when quota is exceeded.

### 1.5 Test Suites Execution Output
1. **Adversarial Harness** (`node scratch/test_adversarial_challenger_2.mjs`):
   - **Total Probes Executed**: 74
   - **Passed**: 74
   - **Failed**: 0
   - **Exit Code**: 0
2. **Bedtime Overhaul 4-Tier E2E Suite** (`node scratch/test_bedtime_overhaul_e2e.mjs`):
   - **Total Tests Run**: 133
   - **Passed**: 133
   - **Failed**: 0
   - **Exit Code**: 0
3. **Full Project Test Suite** (`node scratch/run_all_tests.js`):
   - **Total Suites Run**: 72
   - **Passed**: 72
   - **Failed**: 0
   - **Exit Code**: 0
4. **Production Build** (`npm run build`):
   - **Modules Transformed**: 234
   - **Time**: 30.37s
   - **Exit Code**: 0

---

## 2. Logic Chain

1. **Audio Ducking Invariant**:
   - `Sound.duckLullaby(true)` schedules a linear ramp to `0.15` on `lullabyMasterGain` and sets `lullabyDucked = true`.
   - The primary oscillator peak gain scales from `0.24` to `0.036`, which is mathematically `0.036 / 0.24 = 0.15`.
   - The overtone oscillator peak gain scales from `0.07` to `0.0105`, which is mathematically `0.0105 / 0.07 = 0.15`.
   - `Sound.duckLullaby(false)` schedules a linear ramp back to `1.0` over 1.3s and sets `lullabyDucked = false`.
   - Probing with 100 rapid toggles and non-boolean arguments demonstrated zero AudioContext scheduling corruption and safe recovery.

2. **Auto-Advance & Concurrency Invariant**:
   - The auto-advance countdown is initialized to 3 seconds upon narration completion.
   - The `isAdvancing` boolean guard in `advanceStory` locks against concurrent executions.
   - When 25 concurrent manual click invocations were dispatched during story generation, 24 were rejected by `isAdvancing`, advancing the story by exactly 1 chapter.
   - Chapter progression across 4 chapters was strictly sequential (`1 -> 2 -> 3 -> 4`), never skipping chapters or exceeding the maximum 4-chapter ceiling.
   - Incrementing `narrationGeneration` on cancellation guarantees that delayed or asynchronous speech-ended events from preceding chapters cannot trigger an auto-advance on subsequent chapters.

3. **Parent Mode Invariant**:
   - When `narrationMode === 'parent'`, `narrateAct` immediately un-ducks the lullaby and exits before touching `startAutoAdvance`.
   - Empirical inspection confirmed `autoAdvanceInterval === null` and `autoAdvanceTimer === null`.
   - Parents retain full manual control via the "Turn Page ➡️" button, allowing unhurried bedtime reading.

4. **Universal Voice Resolution Invariant**:
   - For all 24 pets and heroes, both server routes (`server/elevenLabsService.js` and `functions/src/voiceApi.ts`) route bedtime audio requests to `e9sQs6aLWU82SSolkPYZ`.
   - Voice settings for stability, similarity boost, style, speed, and speaker boost match the bedtime audio specification.
   - No pet or hero ID produces an unmapped voice or HTTP 404 error.

---

## 3. Caveats

- **Upstream Network**: In offline and test environments without a live ElevenLabs billing credit, `handleElevenLabsTTSRequest` requires an API key in `process.env.ELEVENLABS_API_KEY`. The test harness safely mocked the upstream API response while validating the exact URL, payload parameters, voice settings, and rate-limiting behavior.
- **Web Audio in Headless Node**: Node.js does not provide a native Web Audio API. A specialized `TrackedAudioContext` was utilized to record and assert exact `setValueAtTime`, `linearRampToValueAtTime`, and gain values.
- No other caveats.

---

## 4. Conclusion

All audio ducking, auto-advance, Parent Mode, and ElevenLabs voice routing requirements have been rigorously and adversarially validated. The implementation contains solid re-entrancy locks, correct mathematical volume scaling, proper generation tracking, and complete 24-pet voice coverage.

**Verdict: APPROVE**

---

## 5. Verification Method

To independently reproduce and verify this assessment:

1. **Run the Adversarial Challenger 2 Test Harness**:
   ```bash
   node scratch/test_adversarial_challenger_2.mjs
   ```
   *Expected output*: 74/74 passed, exit code 0.

2. **Run the Bedtime Overhaul 4-Tier E2E Test Suite**:
   ```bash
   node scratch/test_bedtime_overhaul_e2e.mjs
   ```
   *Expected output*: 133/133 passed, exit code 0.

3. **Run the Complete Repository Test Suite**:
   ```bash
   node scratch/run_all_tests.js
   ```
   *Expected output*: 72/72 test suites passed, exit code 0.

4. **Run Production Build**:
   ```bash
   npm run build
   ```
   *Expected output*: Vite build completes with exit code 0.
