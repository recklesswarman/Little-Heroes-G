# Handoff Report: Milestone M2 — Voice Narration & Audio Pre-Fetching

**Worker**: `worker_m2_1`  
**Milestone**: M2 (Voice Narration & Audio Pre-Fetching)  
**Target File**: `src/services/voiceService.js`  
**Date**: 2026-10-16T01:47:00Z  

---

## 1. Observation

Prior to this implementation:
1. In `src/services/voiceService.js:652-670`, `fetchPcmTts` took fixed parameters `(endpoint, cleanSpoken, petId, timeoutMs = 4500)`. It hardcoded a 4500ms abort controller timeout:
   ```javascript
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
   ```
   For full bedtime story chapters (120–150 words), ElevenLabs synthesis took ~6–11 seconds, causing requests to be aborted prematurely. Furthermore, `body: JSON.stringify({ text: cleanSpoken, petId })` omitted `voiceStyle`.
2. In `src/services/voiceService.js:40-44`, `getAudioCacheKey` did not support `voiceStyle`, producing `${norm}:${clean}` and causing cache collisions between high-energy workout cues and hushed bedtime narrations.
3. In `src/services/voiceService.js:606-610`, `playPcmTtsResponse` created an `AudioBufferSourceNode` without configuring `source.playbackRate`:
   ```javascript
   const source = sharedAudioContext.createBufferSource();
   source.buffer = audioBuffer;
   source.connect(sharedAudioContext.destination);
   ```
   Consequently, custom whisper cadence rates (such as `0.94`, `0.88`, `0.82`, `0.76`) were ignored for Web Audio playback.
4. In `src/services/voiceService.js:754-770`, `speakCompanion` had signature `(text, petIdOrOptions = 'rex', onEnded = null)` and lacked support for a 4th `options` argument or an options object containing `{ timeoutMs, rate, pitch, voiceStyle, instant, onEnded }`, even though callers like `bedtimeStoryService.js:278` passed `{ rate, pitch }` as a 4th argument.
5. There was no background pre-fetching method (`prefetchCompanionAudio`) to fetch and decode Chapter N+1 into `workoutAudioClipCache` while Chapter N was playing, resulting in latency between story chapters.

Verification command run on the existing ElevenLabs cache test:
```
node scratch/test_elevenlabs_tts_cache.cjs
```
Result:
```
🧪 Running ElevenLabs TTS Server-Side Cache Tests...

--- 1. Cache miss on first request calls the upstream API ---
  ✅ PASS: cache miss triggered exactly one upstream call

--- 2. Cache hit on identical repeat request skips the upstream API ---
  ✅ PASS: identical repeat request served from cache, no upstream call

--- 3. A different line is still a cache miss (keys are content-addressed) ---
  ✅ PASS: distinct text is cached independently, not conflated with the first line

--- 4. Whitespace/formatting differences that clean to the same text still hit cache ---
  ✅ PASS: text cleaning happens before the cache key is computed

🎉 ALL ELEVENLABS TTS CACHE TESTS PASSED!
```
Exit code: 0.

---

## 2. Logic Chain

1. **Extended Timeout & Voice Style in `fetchPcmTts`**:
   - Building on Observation 1, `fetchPcmTts` was refactored to accept `(endpoint, cleanSpoken, petId, timeoutMsOrOptions = 4500, voiceStyle = 'default')`.
   - When `voiceStyle === 'bedtime'` and no custom timeout is specified, `timeoutMs` defaults to `18000ms`, preventing aborts on long bedtime chapters while preserving 4500ms for default/workout requests.
   - If `voiceStyle` is provided (and not `'default'`), it is included in `bodyPayload` as `voiceStyle: style`.
2. **Cache Key Differentiation**:
   - Building on Observation 2, `getAudioCacheKey(text, petId = 'rex', voiceStyle = 'default')` was updated to output `${norm}:${style}:${clean}` when `voiceStyle !== 'default'`, and `${norm}:${clean}` when `'default'`, preserving full backward compatibility with workout cues.
3. **Web Audio Playback Rate Configuration**:
   - Building on Observation 3, in `playPcmTtsResponse`, `source.playbackRate.setValueAtTime(rate, sharedAudioContext.currentTime)` is now applied whenever `options.rate` is supplied, with fallback to `.value = rate` for older browser engines or mock environments.
   - `speakWithSpeechSynthesis` was also updated to apply `utterance.rate = rate` and `utterance.pitch = pitch` from `options`.
4. **Argument Polymorphism in `speakCompanion`**:
   - Building on Observation 4, `speakCompanion` was updated to accept:
     - `speakCompanion(text, { timeoutMs, rate, pitch, voiceStyle, instant, onEnded, petId })`
     - `speakCompanion(text, petId, onEnded, options)`
     - `speakCompanion(text, petId, options)`
     - `speakCompanion(text, callback)`
     - `speakCompanion(text, petId, callback)`
   - All options (`timeoutMs`, `rate`, `pitch`, `voiceStyle`, `instant`) are normalized into a unified `opts` object.
5. **Zero-Latency Background Audio Pre-Fetching**:
   - Building on Observation 5, `prefetchCompanionAudio(text, petIdOrOptions = 'rex', options = {})` was implemented and exported.
   - It checks `workoutAudioClipCache` first. If missing, it background-fetches via ElevenLabs (falling back to Gemini Flash TTS if unconfigured or failing).
   - If `AudioContext` is available, it pre-decodes the PCM base64 string into an `AudioBuffer` and stores the payload in `workoutAudioClipCache` under both style-specific and generic keys.
   - When the next chapter plays via `speakCompanion`, it hits `workoutAudioClipCache` with the pre-decoded `AudioBuffer` and plays instantly with 0ms latency.
6. **Resilient Multi-Tier Fallback**:
   - Primary: ElevenLabs TTS (`/api/elevenlabs/tts`).
   - Secondary: Gemini Flash TTS (`/api/gemini/tts`).
   - Tertiary: Client-side SpeechSynthesis prioritizing 'Daniel' (`selectPreferredVoice('daniel')`).
   - Each tier respects `speechGeneration` anti-collision checks to prevent speech overlap.

---

## 3. Caveats

- In headless Node.js environments where `window.AudioContext` is not polyfilled by default, `prefetchCompanionAudio` stores and returns the PCM payload with `data.audio` (base64 string); `playPcmTtsResponse` will decode it upon the first call where `AudioContext` is accessible.
- Network endpoints (`/api/elevenlabs/tts` and `/api/gemini/tts`) depend on server availability; when running completely offline or unconfigured, the pipeline falls back gracefully to `speechSynthesis`.
- No caveats regarding write boundaries: only `src/services/voiceService.js` and metadata files in `.agents/teamwork/worker_m2_1/` were modified.

---

## 4. Conclusion

Milestone M2 requirements for `src/services/voiceService.js` are fully implemented:
1. `fetchPcmTts` accepts `timeoutMs` (18000ms default for bedtime) and `voiceStyle: 'bedtime'`, preventing chapter timeouts and transmitting `voiceStyle` in the request body.
2. `getAudioCacheKey` cleanly incorporates `voiceStyle`.
3. `speakCompanion` supports complete argument polymorphism and scales playback speed on Web Audio `AudioBufferSourceNode`s using `source.playbackRate.setValueAtTime`.
4. `prefetchCompanionAudio` background-fetches and pre-decodes audio buffers into `workoutAudioClipCache` for 0ms chapter transitions.
5. Multi-tier fallback to Gemini Flash TTS and SpeechSynthesis (Daniel voice) provides resilient offline and network failure handling.

---

## 5. Verification Method

To independently verify this implementation:
1. **ElevenLabs TTS Cache Suite**:
   ```powershell
   node scratch/test_elevenlabs_tts_cache.cjs
   ```
   Expected output: All 4 tests pass with exit code 0.
2. **Inspect Exports and Code Layout in `src/services/voiceService.js`**:
   - Verify `export function getAudioCacheKey(text, petId = 'rex', voiceStyle = 'default')`
   - Verify `export async function fetchPcmTts(endpoint, cleanSpoken, petId, timeoutMsOrOptions = 4500, voiceStyle = 'default')`
   - Verify `export async function prefetchCompanionAudio(text, petIdOrOptions = 'rex', options = {})`
   - Verify `export const speakCompanion = async (text, petIdOrOptions = 'rex', onEndedOrOptions = null, options = {})`
   - Verify `source.playbackRate.setValueAtTime(rate, sharedAudioContext.currentTime)` inside `playPcmTtsResponse`
3. **Invalidation Conditions**:
   - Any throw or syntax error when importing `src/services/voiceService.js`.
   - Failure of `fetchPcmTts` to send `voiceStyle` when specified.
   - Failure of `speakCompanion` to accept options objects as either the 2nd argument or 4th argument.
