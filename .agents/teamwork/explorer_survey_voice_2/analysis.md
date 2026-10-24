# Voice Narration, ElevenLabs TTS Service & Audio Pre-Fetching Pipeline Architecture Survey

**Date**: 2026-10-16  
**Explorer**: Explorer 2 (Voice Narration & Audio Explorer)  
**Working Directory**: `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_voice_2`  
**Reference Rules**: `.agents/rules/kid_voice_companion_guidelines.md`, `.agents/rules/task_and_currency_lifecycle_rules.md`  

---

## 1. Executive Summary

This survey provides a comprehensive architectural analysis of the voice narration, ElevenLabs TTS service, Web Audio playback, and background audio pre-fetching pipeline across the Little Hero Adventures platform.

### Core Discoveries:
1. **HTTP 404 on Non-Rex Pets**: In both `server/elevenLabsService.js` and `functions/src/voiceApi.ts`, `/api/elevenlabs/tts` currently restricts voice resolution exclusively to `'rex'`. When any of the other 23 companion pets (Raptor, Stego, Pterry, Chomper, Brachio, Dippy, Spino, Aqua Drake, Bella, Barnaby, Pip, etc.) or a bedtime storyteller is active, the endpoints return `HTTP 404: "No ElevenLabs voice configured for pet..."`.
2. **Missing Main Voice Fallback**: The required universal ElevenLabs voice ID (`process.env.ELEVENLABS_REX_VOICE_ID || "e9sQs6aLWU82SSolkPYZ"`) is not set as a universal default across all companion pets and storytelling requests.
3. **Bedtime Voice Tuning Absent**: Neither backend endpoint supports bedtime voice tuning parameters (`stability: 0.65`, `similarity_boost: 0.80`, `style: 0.35`, `use_speaker_boost: true`), nor do their SHA-256 cache keys incorporate `voiceStyle`.
4. **Voice Service Limitations**: In `src/services/voiceService.js`, `fetchPcmTts` enforces a rigid `4500ms` timeout that aborts long bedtime chapters (120–150 words). Furthermore, `speakCompanion` ignores custom options (`timeoutMs`, `rate`, `pitch`, `voiceStyle`), and `playPcmTtsResponse` does not set `AudioBufferSourceNode.playbackRate.value`.
5. **No Background Chapter Pre-Fetching**: Currently, audio is only requested when a chapter is actively mounted, introducing 3–8 second dead air gaps between chapters.
6. **Auto-Read Hands-Free Mode Missing in UI**: `src/views/BedtimeStoryView.js` currently lacks a dedicated toggle for Hands-Free "Auto-Read All 3 Chapters" vs. "Interactive Story Choices".

---

## 2. In-Depth Analysis of ElevenLabs TTS Endpoints

### 2.1 Routing Architecture Across Environments

The `/api/elevenlabs/tts` route is accessed in three distinct deployment and development environments:

| Environment | Host / Runtime | Routing Mechanism | Handler / Controller |
|---|---|---|---|
| **Local Vite Dev Server** | Vite / Node.js | `vite.config.js:62-85` custom middleware intercepts `url === '/api/elevenlabs/tts'` | `server/elevenLabsService.js:handleElevenLabsTTSRequest` |
| **Production App Hosting** | Express.js / Node.js | `server.js:27` (`app.post('/api/elevenlabs/tts', handleElevenLabsTTSRequest)`) | `server/elevenLabsService.js:handleElevenLabsTTSRequest` |
| **Firebase Hosting / Serverless** | Cloud Functions v2 (us-central1) | `firebase.json:107-113` rewrites `/api/elevenlabs/**` to function `api` | `functions/src/voiceApi.ts:app.post('/api/elevenlabs/tts', ...)` |

### 2.2 Root Cause Analysis: Why Non-Rex Pets Fail with HTTP 404

#### In `server/elevenLabsService.js`:
- Lines 37–39 define:
  ```javascript
  const ELEVENLABS_VOICE_MAP = {
    rex: process.env.ELEVENLABS_REX_VOICE_ID || null
  };
  ```
- Lines 95–100 execute:
  ```javascript
  const normalizedPetId = (getPetById(petId)?.key || 'rex').toLowerCase();
  const voiceId = ELEVENLABS_VOICE_MAP[normalizedPetId];
  if (!voiceId) {
    return res.status(404).json({ error: `No ElevenLabs voice configured for pet "${normalizedPetId}".` });
  }
  ```
- **Failure Chain**:
  1. For any child whose active pet is Raptor (`id: '2'`), Stego (`id: '3'`), or any other of the 24 pets, `getPetById(petId)` returns the pet object with `key: 'raptor'`, `'stego'`, etc.
  2. `ELEVENLABS_VOICE_MAP['raptor']` is `undefined`.
  3. `!voiceId` triggers, immediately returning `404 Not Found`.
  4. If `process.env.ELEVENLABS_REX_VOICE_ID` is empty in `.env`, `ELEVENLABS_VOICE_MAP.rex` evaluates to `null`, causing even Rex to return 404!

#### In `functions/src/voiceApi.ts`:
- Lines 147–154 execute:
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
- **Failure Chain**:
  `voiceId` is explicitly set to `undefined` for any pet whose id does not match `"rex"`, throwing HTTP 404.

### 2.3 Proposed Fix: Universal Voice Resolution

All 24 pets and bedtime storytelling requests must resolve to the main ElevenLabs voice ID:
```
const DEFAULT_MAIN_VOICE_ID = process.env.ELEVENLABS_REX_VOICE_ID || "e9sQs6aLWU82SSolkPYZ";
```

#### Resolution Logic for `server/elevenLabsService.js`:
```javascript
const DEFAULT_MAIN_VOICE_ID = process.env.ELEVENLABS_REX_VOICE_ID || 'e9sQs6aLWU82SSolkPYZ';
const ELEVENLABS_VOICE_MAP = {
  rex: DEFAULT_MAIN_VOICE_ID
};

// Inside handleElevenLabsTTSRequest:
const pet = getPetById(petId);
const normalizedPetId = (pet?.key || String(petId || 'rex')).toLowerCase();
// Universal fallback: any configured pet voice OR the main voice (never 404)
const voiceId = ELEVENLABS_VOICE_MAP[normalizedPetId] || DEFAULT_MAIN_VOICE_ID;
```

#### Resolution Logic for `functions/src/voiceApi.ts`:
```typescript
const DEFAULT_REX_VOICE_ID = "e9sQs6aLWU82SSolkPYZ";

// Inside app.post("/api/elevenlabs/tts"):
const normalizedPetId = normalizePetId(petId);
const voiceId = process.env.ELEVENLABS_REX_VOICE_ID || DEFAULT_REX_VOICE_ID;
```

### 2.4 Bedtime Narration Voice Tuning Parameters

When narrating bedtime story chapters, speech must be warmer, calmer, and more consistent than energetic daytime workout cheers.

#### Parameters:
- `stability`: `voiceStyle === 'bedtime' ? 0.65 : 0.5`
- `similarity_boost`: `voiceStyle === 'bedtime' ? 0.80 : 0.75`
- `style`: `voiceStyle === 'bedtime' ? 0.35 : 0.3`
- `use_speaker_boost`: `true`
- `speed`: `voiceStyle === 'bedtime' ? Math.min(speechSpeed, 0.82) : speechSpeed`

#### Cache Key Integration:
To prevent collisions between a line spoken in workout mode vs. bedtime whisper mode, `voiceStyle` must be added to the SHA-256 hash:
```javascript
function getTtsCacheKey(cleanText, voiceId, speed, voiceStyle = 'default') {
  return createHash('sha256').update(`${cleanText}|${voiceId}|${speed}|${voiceStyle}`).digest('hex');
}
```

---

## 3. Review of Client-Side Audio Pipeline (`src/services/voiceService.js`)

### 3.1 Limitations of `fetchPcmTts`

Current implementation (`voiceService.js:652-670`):
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
    if (!response.ok) return null;
    const data = await response.json();
    return data && data.audio ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
```
**Defects**:
1. Default timeout of `4500ms` causes 100% failure on full bedtime story chapters (120–150 words), as ElevenLabs upstream synthesis takes ~6–11 seconds.
2. `body` omits `voiceStyle`.
3. Inability to pass custom headers or options.

**Required Redesign**:
```javascript
async function fetchPcmTts(endpoint, cleanSpoken, petId, timeoutMs = 4500, voiceStyle = 'default') {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanSpoken, petId, voiceStyle }),
      signal: controller.signal
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data && data.audio ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### 3.2 Web Audio API `AudioBufferSourceNode` Playback Rate

Current implementation (`voiceService.js:606-610`):
```javascript
const source = sharedAudioContext.createBufferSource();
source.buffer = audioBuffer;
source.connect(sharedAudioContext.destination);
currentAudioSource = source;
```
The playback rate is never configured!
In Web Audio API, `source.playbackRate` is an `AudioParam`.
To support custom rates (e.g. `rate: 0.88` for bedtime chapter 2, `rate: 0.78` for chapter 3):
```javascript
const playbackRate = typeof options?.rate === 'number' && Number.isFinite(options.rate) ? options.rate : 1.0;
source.playbackRate.setValueAtTime(playbackRate, sharedAudioContext.currentTime);
```
`source.onended` correctly fires when the audio buffer completes playback at the adjusted rate.

### 3.3 Argument Polymorphism in `speakCompanion`

`speakCompanion` must accept either positional arguments with options or an options object:
```javascript
export const speakCompanion = async (text, petIdOrOptions = 'rex', onEnded = null, options = {}) => {
  if (!text || typeof text !== 'string' || !text.trim()) return;

  let petId = 'rex';
  let callback = onEnded;
  let opts = { timeoutMs: 4500, rate: 1.0, pitch: 1.0, voiceStyle: 'default', instant: false };

  if (typeof petIdOrOptions === 'string') {
    petId = petIdOrOptions;
    if (typeof options === 'object') opts = { ...opts, ...options };
  } else if (typeof petIdOrOptions === 'function') {
    callback = petIdOrOptions;
    if (typeof options === 'object') opts = { ...opts, ...options };
  } else if (petIdOrOptions && typeof petIdOrOptions === 'object') {
    petId = petIdOrOptions.petId || 'rex';
    if (petIdOrOptions.onEnded) callback = petIdOrOptions.onEnded;
    opts = { ...opts, ...petIdOrOptions };
  }
  ...
```

### 3.4 Architecture & Implementation of `prefetchCompanionAudio`

To achieve zero-lag chapter transitions during bedtime stories:

```javascript
/**
 * Pre-fetches and pre-decodes audio for an upcoming dialogue or bedtime chapter
 * into `workoutAudioClipCache` so it triggers with 0ms latency when requested.
 *
 * @param {string} text - Raw text to clean and synthesize.
 * @param {string|number} petId - Active companion pet id.
 * @param {Object} options - { timeoutMs: 18000, voiceStyle: 'bedtime', rate: 0.88 }
 * @returns {Promise<Object|null>} Decoded audio payload or null on failure.
 */
export async function prefetchCompanionAudio(text, petId = 'rex', options = {}) {
  const cleanSpoken = cleanDialogueText(text);
  if (!cleanSpoken) return null;

  const normKey = normalizePetKey(petId);
  const voiceStyle = options.voiceStyle || 'default';
  const timeoutMs = options.timeoutMs || 18000;

  const cacheKey = `${normKey}:${voiceStyle}:${cleanSpoken}`;
  const genericKey = `${normKey}:${cleanSpoken}`;

  // 1. Check if already cached
  if (workoutAudioClipCache.has(cacheKey)) {
    return workoutAudioClipCache.get(cacheKey);
  }
  if (workoutAudioClipCache.has(genericKey)) {
    return workoutAudioClipCache.get(genericKey);
  }

  // 2. Background fetch via ElevenLabs first, then Gemini TTS fallback
  let data = await fetchPcmTts(ELEVENLABS_TTS_ENDPOINT, cleanSpoken, petId, timeoutMs, voiceStyle);
  if (!data) {
    data = await fetchPcmTts(TTS_ENDPOINT, cleanSpoken, petId, Math.min(timeoutMs, 8000), voiceStyle);
  }

  if (!data || !data.audio) return null;

  // 3. Pre-decode into Web Audio AudioBuffer if AudioContext is accessible
  const AudioCtx = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  if (AudioCtx) {
    try {
      if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
        sharedAudioContext = new AudioCtx({ sampleRate: 24000 });
      }
      if (sharedAudioContext) {
        const float32 = base64ToFloat32Array(data.audio);
        const sampleRate = data.sampleRate || 24000;
        const buffer = sharedAudioContext.createBuffer(1, float32.length, sampleRate);
        buffer.copyToChannel(float32, 0);
        data.audioBuffer = buffer;
      }
    } catch (e) {
      console.warn('Audio prefetch decode notice:', e);
    }
  }

  // 4. Save into client cache
  workoutAudioClipCache.set(cacheKey, data);
  workoutAudioClipCache.set(genericKey, data);
  workoutAudioClipCache.set(cleanSpoken, data);

  return data;
}
```

---

## 4. Bedtime Story Audio Lifecycle & Stage View Integration

### 4.1 Audio Lifecycle in `src/views/BedtimeStoryView.js` & `src/services/bedtimeStoryService.js`

```
[Start Story Button Clicked]
        │
        ▼
Generate Chapter 1 Text (AI or Procedural)
        │
        ├──► Start Chapter 1 Audio Playback (speakCompanion, rate: 0.94)
        │       │
        │       └──► Duck Ambient Lullaby (Sound.duckLullaby(true))
        │
        └──► [PARALLEL BACKGROUND TASK]:
                Generate Chapter 2 Text & Call prefetchCompanionAudio(Chapter 2)
                        │
                        └──► Decoded Chapter 2 Audio Buffer Ready in Memory
        │
Chapter 1 Audio Ends
        │
        ├──► Restore Ambient Lullaby (Sound.duckLullaby(false))
        │
        ▼
Mode Check:
  ├─ If Hands-Free Auto-Read Mode:
  │     Wait 3s gentle pause ──► Auto-Advance to Chapter 2
  │                                     │
  │                                     ▼
  │                             Play Chapter 2 Audio (INSTANT 0ms from Cache)
  │                                     │
  │                                     └──► Background Prefetch Chapter 3 Audio
  │
  └─ If Interactive Choices Mode:
        Show Choice Chips + Mic Button
        Start 15s gentle countdown timer
        (If child taps choice or timer expires ──► Advance to Chapter 2)
```

### 4.2 Implementation of Hands-Free "Auto-Read All 3 Chapters" Mode

#### Requirements:
1. **Sanctuary State**: Add `autoReadMode: boolean` (default `true` for sleep-focused bedtime convenience) to `store.getBedtimeSanctuaryState()`.
2. **Customizer UI (`renderSanctuaryHub`)**:
   Add a Story Flow Mode toggle alongside Narration Mode:
   - `[ 🌙 Auto-Read All 3 Chapters (Hands-Free) ]`
   - `[ 🎮 Interactive Story Choices ]`
3. **Stage UI (`renderStoryStage`)**:
   Add a quick-toggle pill button in the top progress bar:
   ```html
   <button id="toggle-autoread-stage-btn" class="px-2.5 py-1 rounded-xl border border-surface-container-highest text-xs font-black flex items-center gap-1.5 transition-all ${session.autoReadMode ? 'bg-[#00d2d3]/20 text-[#00d2d3] border-[#00d2d3]/40' : 'bg-[#0f2334] text-slate-400'}">
     <span class="material-symbols-outlined text-sm">${session.autoReadMode ? 'bedtime' : 'touch_app'}</span>
     <span>${session.autoReadMode ? 'Auto-Read (3 Chapters)' : 'Interactive Mode'}</span>
   </button>
   ```
4. **Behavior Differences**:
   - In **Auto-Read Mode**:
     - Suggestion chips and mic button are displayed in a tranquil, non-distracting style (or minimized).
     - As each chapter finishes, a 3-second breathing countdown runs (`"Next chapter in 3... 2... 1..."`), then advances automatically.
     - Chapter 1 -> Chapter 2 -> Chapter 3 (Deep Slumber).
     - At Chapter 3, the story ends peacefully, the active 3D pet and hero curl up asleep in the starlight nest, the 4s/4s breathing pacer activates, and rewards are minted quietly without modal popups per `kid_voice_companion_guidelines.md`.
   - In **Interactive Mode**:
     - Large, vibrant choice chips and mic button encourage active toddler steering between Chapter 1 and Chapter 2.
     - Auto-advance acts as a safety net (15-20s timeout) so the child never gets stuck in silence if they drift off.

---

## 5. Summary of Exact Changes Required

| Component / File | Current Limitation | Exact Change Required |
|---|---|---|
| `server/elevenLabsService.js` | Only `rex` mapped; non-Rex returns 404; no `voiceStyle` support | Default `voiceId` to `process.env.ELEVENLABS_REX_VOICE_ID \|\| "e9sQs6aLWU82SSolkPYZ"`; support `voiceStyle: 'bedtime'` with `stability: 0.65`, `similarity_boost: 0.80`, `style: 0.35`, `use_speaker_boost: true`; add `voiceStyle` to cache key. |
| `functions/src/voiceApi.ts` | Only `rex` supported; non-Rex returns 404; no `voiceStyle` support | Resolve all 24 pets and storytelling requests to `DEFAULT_REX_VOICE_ID`; support `voiceStyle: 'bedtime'` with matching parameters; update cache key. |
| `src/services/voiceService.js` | 4500ms timeout aborts story chapters; ignores `options`; no `AudioBufferSourceNode.playbackRate` scaling; no pre-fetching | Update `fetchPcmTts` to accept `timeoutMs` (18000ms) and `voiceStyle`; update `speakCompanion` to support argument polymorphism and pass `rate`/`options`; apply `source.playbackRate.setValueAtTime(rate, ...)`; implement `prefetchCompanionAudio(text, petId, options)`. |
| `src/services/bedtimeStoryService.js` | Audio only requested on chapter mount; fixed 4-act structure without pre-fetch | Pre-fetch Chapter N+1 text and audio buffer while Chapter N plays; pass `voiceStyle: 'bedtime'` and extended `timeoutMs: 18000`; support hands-free auto-advance. |
| `src/views/BedtimeStoryView.js` | No hands-free auto-read toggle; rigid 15s timer | Add "Auto-Read All 3 Chapters" vs. "Interactive Story Choices" toggle in Customizer and on Stage; adapt UI controls for hands-free mode. |

---

## 6. Verification Plan & Test Commands

To verify these changes once implemented:
1. **ElevenLabs TTS Multi-Pet & Fallback Verification**:
   - `node scratch/test_elevenlabs_tts_cache.cjs`: Verify cache hits and misses with different `voiceStyle` keys.
   - Run verification test requesting all 24 pet IDs (`'1'` through `'24'`, plus keys like `'raptor'`, `'stego'`, `'aqua_drake'`) against `/api/elevenlabs/tts`, asserting `200 OK` (never `404`).
2. **Audio Buffer Playback & Pre-Fetching Verification**:
   - Verify `prefetchCompanionAudio` stores pre-decoded `AudioBuffer` in `workoutAudioClipCache`.
   - Verify `speakCompanion` plays from cache with 0ms latency and applies `playbackRate`.
3. **Bedtime Storybook Test Suite**:
   - `node scratch/test_bedtime_storybook.cjs`: Verify 3-chapter progression, non-blocking rewards, and auto-read mode.
4. **Full Regression & Build**:
   - `node scratch/run_all_tests.js`: 100% pass rate.
   - `npm run build`: Zero errors, exit code 0.
