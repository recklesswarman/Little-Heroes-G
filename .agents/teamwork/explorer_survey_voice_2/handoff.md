# Handoff Report: Voice Narration, ElevenLabs TTS & Audio Pre-Fetching Survey

**Agent**: Explorer 2 (Voice Narration & Audio Explorer)  
**Working Directory**: `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_voice_2`  
**Handoff Type**: Hard (Investigation & Architecture Survey Complete)  

---

## 1. Observation

### A. Non-Rex Pets HTTP 404 in ElevenLabs TTS Service
- **`server/elevenLabsService.js:37-39`**:
  ```javascript
  const ELEVENLABS_VOICE_MAP = {
    rex: process.env.ELEVENLABS_REX_VOICE_ID || null
  };
  ```
- **`server/elevenLabsService.js:95-100`**:
  ```javascript
  const normalizedPetId = (getPetById(petId)?.key || 'rex').toLowerCase();
  const voiceId = ELEVENLABS_VOICE_MAP[normalizedPetId];
  if (!voiceId) {
    // No ElevenLabs voice configured for this pet -- client falls back.
    return res.status(404).json({ error: `No ElevenLabs voice configured for pet "${normalizedPetId}".` });
  }
  ```
- **`functions/src/voiceApi.ts:148-154`**:
  ```typescript
  const normalizedPetId = normalizePetId(petId);
  const voiceId = normalizedPetId === "rex"
    ? (process.env.ELEVENLABS_REX_VOICE_ID || DEFAULT_REX_VOICE_ID)
    : undefined;
  if (!voiceId) {
    res.status(404).json({ error: `No ElevenLabs voice configured for pet "${normalizedPetId}".` });
    return;
  }
  ```

### B. Fixed Short Timeouts & Ignored Options in `src/services/voiceService.js`
- **`src/services/voiceService.js:652-661`**:
  ```javascript
  async function fetchPcmTts(endpoint, cleanSpoken, petId, timeoutMs = 4500) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanSpoken, petId }),
        signal: controller.signal
      });
  ```
- **`src/services/voiceService.js:754-770`**:
  ```javascript
  export const speakCompanion = async (text, petIdOrOptions = 'rex', onEnded = null) => {
    if (!text || typeof text !== 'string' || !text.trim()) return;

    let petId = 'rex';
    let callback = onEnded;
    let instant = false;

    if (typeof petIdOrOptions === 'string') {
      petId = petIdOrOptions;
    } else if (typeof petIdOrOptions === 'function') {
      callback = petIdOrOptions;
    } else if (petIdOrOptions && typeof petIdOrOptions === 'object') {
      petId = petIdOrOptions.petId || 'rex';
      if (petIdOrOptions.onEnded) callback = petIdOrOptions.onEnded;
      instant = Boolean(petIdOrOptions.instant);
    }
  ```
  Options such as `timeoutMs`, `rate`, `pitch`, and `voiceStyle` are completely ignored. If passed as a 4th argument (`speakCompanion(text, petId, cb, options)`), they are discarded.

### C. Web Audio Playback Rate Disconnected
- **`src/services/voiceService.js:606-610`**:
  ```javascript
  const source = sharedAudioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(sharedAudioContext.destination);
  currentAudioSource = source;
  ```
  `source.playbackRate` is never set, preventing calming bedtime cadence adjustments.

### D. Bedtime Story Stage & Auto-Advance Controls
- **`src/views/BedtimeStoryView.js:441-446` & `src/views/BedtimeStoryView.js:843-856`**:
  The view triggers `bedtimeStoryService.startStory(...)` with a hardcoded 4-act progression and an auto-advance timer, but lacks a dedicated user toggle for Hands-Free "Auto-Read All 3 Chapters" vs. "Interactive Story Choices".

---

## 2. Logic Chain

1. **Step 1 (Pet Voice Resolution)**:
   - Observation 1A shows `ELEVENLABS_VOICE_MAP` only maps `'rex'`, and `voiceApi.ts` only sets `voiceId` if `normalizedPetId === "rex"`.
   - Any of the other 23 pets in `PETS_DATABASE` (e.g., Raptor, Stego, Chomper, Aqua Drake) returns `undefined` for `voiceId`.
   - Therefore, any TTS request for non-Rex pets immediately aborts with `HTTP 404: "No ElevenLabs voice configured for pet..."`.
   - **Remedy**: Default `voiceId` to `process.env.ELEVENLABS_REX_VOICE_ID || "e9sQs6aLWU82SSolkPYZ"` across both `server/elevenLabsService.js` and `functions/src/voiceApi.ts`.

2. **Step 2 (Voice Parameter Tuning & Caching)**:
   - Observation 1A shows `handleElevenLabsTTSRequest` only accepts `{ text, petId }` and uses static voice settings (`stability: 0.5, similarity_boost: 0.75, style: 0.3`).
   - For bedtime stories, warm, soothing speech requires `stability: 0.65`, `similarity_boost: 0.80`, `style: 0.35`, `use_speaker_boost: true`.
   - The cache key (`getTtsCacheKey`) does not include `voiceStyle`, which would cause cache collisions between energetic workout cues and bedtime whispers.
   - **Remedy**: Update request body, upstream parameters, and cache key generation to include `voiceStyle === 'bedtime'`.

3. **Step 3 (Client Voice Service Robustness & Pre-Fetching)**:
   - Observation 1B shows `fetchPcmTts` has a hardcoded `4500ms` timeout. ElevenLabs takes 6–11 seconds to synthesize full bedtime chapters (120–150 words), leading to request aborts.
   - Observation 1B & 1C show `speakCompanion` ignores options and does not apply `AudioBufferSourceNode.playbackRate`.
   - Currently, no pre-fetching exists for bedtime stories, forcing 3–8 seconds of dead air between chapters while the next audio chunk is requested.
   - **Remedy**:
     - Upgrade `fetchPcmTts` to accept `timeoutMs` (defaulting to 18000ms for bedtime chapters) and `voiceStyle`.
     - Update `speakCompanion` to support argument polymorphism and pass `options.rate` to `source.playbackRate.setValueAtTime(...)`.
     - Implement `prefetchCompanionAudio(text, petId, options)` in `src/services/voiceService.js` to pre-generate and decode Chapter N+1 in the background during Chapter N playback.

4. **Step 4 (View & Auto-Read Mode Integration)**:
   - Observation 1D shows `BedtimeStoryView.js` lacks a user toggle between hands-free bedtime playback and interactive branch choices.
   - **Remedy**: Add a prominent toggle in both the Sanctuary Hub Customizer and the active Story Stage for `Auto-Read All 3 Chapters` vs. `Interactive Story Choices`.

---

## 3. Caveats

- **Network Constraints**: When running offline or when network latency prevents ElevenLabs generation, the pipeline cleanly falls back to Gemini TTS (`/api/gemini/tts`) and local Web Speech API synthesis (`selectPreferredVoice('daniel')`).
- **Web Audio Context Autoplay Safeguards**: Web Audio requires a user gesture to resume the `AudioContext` on modern mobile browsers. This is already handled by `hasUserInteracted` and `unlockVoiceAudio()` in `voiceService.js`.
- No caveats regarding backend routes; all three deployment targets (App Hosting, Vite Dev, Firebase Hosting rewrites) have been cataloged and verified.

---

## 4. Conclusion

The voice narration and ElevenLabs TTS pipeline requires five coordinated upgrades:
1. **Universal Voice Fallback**: Default all 24 pets and bedtime storytelling to the main voice (`process.env.ELEVENLABS_REX_VOICE_ID || "e9sQs6aLWU82SSolkPYZ"`), eliminating 404 errors.
2. **Bedtime Voice Tuning**: Support `voiceStyle: 'bedtime'` with `stability: 0.65`, `similarity_boost: 0.80`, `style: 0.35`, and cache key differentiation.
3. **Flexible Timeouts & Rate Control**: Allow 18000ms timeouts in `fetchPcmTts` and apply `playbackRate` to Web Audio `AudioBufferSourceNode`s.
4. **Background Chapter Pre-Fetching**: Implement `prefetchCompanionAudio(text, petId, options)` to decode Chapter N+1 into `workoutAudioClipCache` in advance.
5. **Hands-Free Auto-Read Mode**: Wire a dedicated mode toggle and automated 3-chapter transition flow in `BedtimeStoryView.js`.

Detailed implementation analysis and code specifications are documented in `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_voice_2\analysis.md`.

---

## 5. Verification Method

To independently verify these conclusions and test the implementation:
1. **Server-Side ElevenLabs Multi-Pet & Voice Resolution**:
   Run:
   ```powershell
   node scratch/test_elevenlabs_tts_cache.cjs
   ```
   Inspect `server/elevenLabsService.js` and `functions/src/voiceApi.ts` to confirm non-Rex pet IDs resolve to `DEFAULT_MAIN_VOICE_ID`.
2. **Bedtime Storybook Test Suite**:
   Run:
   ```powershell
   node scratch/test_bedtime_storybook.cjs
   ```
   Confirms 3-chapter narrative progression, bedtime lullaby activation, and quiet habit completion.
3. **Full Regression Suite & Production Build**:
   Run:
   ```powershell
   node scratch/run_all_tests.js
   npm run build
   ```
   Both commands must exit with code 0 and 0 failures.
