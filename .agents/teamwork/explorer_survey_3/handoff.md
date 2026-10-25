# Phase 0 Survey & Architectural Analysis: R3 & R4
**Milestone**: Seamless Slumber Pacing & Unified ElevenLabs Bedtime Voice  
**Author**: Explorer Subagent (`explorer_survey_3`)  
**Target Directory**: `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_3`  
**Date**: 2026-10-25T02:27:00Z  

---

## 1. Observation

Direct code observations across the codebase relating to story pacing, decision chips, prompt questions, microphone listening, auto-advance, ElevenLabs voice routing, and background lullaby audio ducking:

### 1.1 Story UI Pacing, Questions, Decision Chips, and Microphone Interruptions
1. **Prompt Question UI Banner**:
   - **Path**: `src/views/BedtimeStoryView.js` (lines 550–555)
   - **Verbatim Code**:
     ```html
     ${currentAct.promptQuestion ? `
       <div class="bg-[#0c2233] p-3 rounded-2xl border border-[#00d2d3]/30 text-xs sm:text-sm text-[#ffb961] font-headline font-bold flex items-center gap-2">
         <span class="text-lg shrink-0">❓</span>
         <span>${currentAct.promptQuestion}</span>
       </div>
     ` : ''}
     ```
   - **Observation**: Renders a prompt box with `❓` and `currentAct.promptQuestion`, prompting toddlers mid-story.

2. **Microphone Listening Button ("SPEAK TO REX")**:
   - **Path**: `src/views/BedtimeStoryView.js` (lines 561–570)
   - **Verbatim Code**:
     ```html
     <button id="story-mic-btn" class="w-full sm:w-auto px-5 py-3 sm:px-6 sm:py-3.5 min-h-[48px] rounded-2xl font-headline font-black text-xs sm:text-sm tracking-wide shadow-[0_4px_0_0_#050f18] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer transition-all ${
       isMicListening
         ? 'bg-red-500 text-white animate-pulse border-2 border-white'
         : 'bg-linear-to-r from-[#00d2d3] to-[#0284c7] text-surface-container-lowest'
     }">
       <span class="material-symbols-outlined text-xl">${isMicListening ? 'mic' : 'mic_none'}</span>
       <span>${isMicListening ? 'LISTENING... SPEAK!' : 'SPEAK TO REX'}</span>
     </button>
     ```
   - **Event Listener**: `src/views/BedtimeStoryView.js` (lines 951–986)
     - Calls `bedtimeStoryService.startListening()` and attaches recognition handlers.
   - **Service Speech Recognition**: `src/services/bedtimeStoryService.js` (lines 145–231)
     - Implements `initSpeechRecognition`, `startListening`, `stopListening`, and dispatches `bedtime-story-listening-change`.

3. **Quick Suggestion Chips**:
   - **Path**: `src/views/BedtimeStoryView.js` (lines 572–578)
   - **Verbatim Code**:
     ```html
     <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-start">
       ${(currentAct.suggestionChips || []).map((chip) => `
         <button data-select-chip="${chip.text || chip}" class="px-3 py-2 min-h-lg rounded-xl bg-[#1b3d58] hover:bg-[#255073] text-white border border-surface-container-highest text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer">
           <span>${chip.text || chip}</span>
         </button>
       `).join('')}
     </div>
     ```
   - **Event Listener**: `src/views/BedtimeStoryView.js` (lines 989–1001)
     - Tapping a chip calls `await bedtimeStoryService.advanceStory(chipText)`.

4. **Mid-Chapter Questions Embedded in Spoken Narrative Text**:
   - **Path**: `src/data/bedtimeStoryData.js` (line 877)
   - **Verbatim Code**:
     ```javascript
     const text = `The golden sun had dipped peacefully below the horizon... ${pName} looked over with a warm, comforting smile: "Every great bedtime explorer knows that sweet dreams begin with preparation! What special hero gadget should we pack into our backpack tonight?" ...`;
     ```
   - **Observation**: The question prompt `"What special hero gadget should we pack into our backpack tonight?"` is hardcoded directly into the chapter text spoken by the TTS voice.
   - **Realm Prompt Arrays**: `src/data/bedtimeStoryData.js` (lines 305–329, 348–373, 391–416, 434–455):
     - Every realm defines `act1Prompts`, `act1DefaultChips`, `act2Prompts`, `act2DefaultChips`, `act3Prompts`, `act3DefaultChips`.
   - **Procedural Act Mapping**: `src/data/bedtimeStoryData.js` (lines 900–906, 937–943, 974–980):
     - Maps `choices: realm.act1DefaultChips.map(c => c.text)`, `prompt: realm.act1Prompts[0]`, `promptQuestion: realm.act1Prompts[0]`, `suggestionChips: realm.act1DefaultChips`.

5. **Server & Cloud Story Prompt Generation**:
   - **`server/geminiService.js`** (lines 712–716, 795–798):
     - Prompt instructs Gemini to return `"choices": ["Choice 1", "Choice 2"]`.
     - Normalizes `prompt: ch.choices?.[0] ? 'What should we do next?' : 'Sleep tight, brave hero.'`.
     - Normalizes `promptQuestion: ch.choices?.[0] ? 'What should we do next?' : 'Sleep tight, brave hero.'`.
   - **`functions/src/voiceApi.ts`** (lines 420–435, 515–518, 632–635):
     - Same prompt and normalization logic returning `prompt: "What should we do next?"` and `promptQuestion`.
   - **`little-heroes-agy-service/agents/bedtime_narrator.py`** (lines 29–35):
     - Pydantic schema defines `prompt_question: str` and `suggestion_chips: list[str]`.

---

### 1.2 Chapter Transitions & Hands-Free Auto-Advance
1. **Auto-Advance Countdown Timing**:
   - **Path**: `src/services/bedtimeStoryService.js` (lines 149, 248–268)
   - **Verbatim Code**:
     ```javascript
     this.autoAdvanceSecondsRemaining = 15;
     ...
     this.autoAdvanceInterval = setInterval(() => {
       this.autoAdvanceSecondsRemaining--;
       if (typeof window !== 'undefined') {
         window.dispatchEvent(new CustomEvent('bedtime-story-autoadvance-tick', {
           detail: { secondsRemaining: Math.max(0, this.autoAdvanceSecondsRemaining), active: true }
         }));
       }
       if (this.autoAdvanceSecondsRemaining <= 0) {
         this.cancelAutoAdvance();
         if (typeof onAdvance === 'function') {
           onAdvance();
         }
       }
     }, 1000);
     ```
   - **View Local State**: `src/views/BedtimeStoryView.js` (line 23): `let autoAdvanceSeconds = 15;`.
   - **Observation**: Auto-advance currently pauses for **15 seconds** instead of the required **3 seconds**.

2. **Triggering Auto-Advance on Narration End**:
   - **Path**: `src/services/bedtimeStoryService.js` (lines 414–420)
   - **Verbatim Code**:
     ```javascript
     speakCompanion(text, petId, () => {
       Sound.duckLullaby(false);
       if (typeof window !== 'undefined') {
         window.dispatchEvent(new CustomEvent('bedtime-story-speech-finished'));
       }
       this.startAutoAdvance(() => this.advanceStory());
     }, {
       rate,
       pitch: chapterNumber >= 3 ? 0.95 : 1.05,
       voiceStyle: 'bedtime',
       timeoutMs: 18000,
       ...options
     });
     ```
   - **Observation**: `speakCompanion` triggers `onEnded` callback -> unducks lullaby -> begins auto-advance countdown.

3. **Manual "Turn Page ➡️" Button**:
   - **Path**: `src/views/BedtimeStoryView.js` (lines 581–583)
   - **Verbatim Code**:
     ```html
     <button id="story-manual-turn-page-btn" class="sm:ml-auto w-full sm:w-auto px-4 py-3 min-h-[48px] rounded-xl bg-[#0f2334] hover:bg-[#1a3850] text-[#00d2d3] border border-[#00d2d3]/40 font-headline font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer">
       <span>Turn Page ➡️</span>
     </button>
     ```
   - **Event Listener**: `src/views/BedtimeStoryView.js` (lines 1004–1013):
     ```javascript
     document.getElementById('story-manual-turn-page-btn')?.addEventListener('click', async () => {
       Sound.whoosh();
       bedtimeStoryService.cancelAutoAdvance();
       isGeneratingScene = true;
       store.notify();
       await bedtimeStoryService.advanceStory();
       isGeneratingScene = false;
       store.notify();
     });
     ```
   - **Observation**: Manual button already exists and functions, but was grouped alongside the mic button and suggestion chips.

---

### 1.3 ElevenLabs Voice Routing & Parameters
1. **Canonical Voice ID**: `e9sQs6aLWU82SSolkPYZ`
   - **`server/elevenLabsService.js`** (lines 34–37):
     ```javascript
     const DEFAULT_MAIN_VOICE_ID = 'e9sQs6aLWU82SSolkPYZ';
     const ELEVENLABS_VOICE_MAP = {
       rex: process.env.ELEVENLABS_REX_VOICE_ID || DEFAULT_MAIN_VOICE_ID
     };
     ```
     - Line 46: `const DEFAULT_SPEECH_SPEED = 0.85;`
     - Lines 88–90:
       ```javascript
       const normalizedPetId = (getPetById(petId)?.key || String(petId || 'rex')).toLowerCase();
       const mainVoiceId = process.env.ELEVENLABS_REX_VOICE_ID || DEFAULT_MAIN_VOICE_ID;
       const voiceId = ELEVENLABS_VOICE_MAP[normalizedPetId] || mainVoiceId;
       ```
     - Lines 100–106 (voice settings):
       ```javascript
       const isBedtime = voiceStyle === 'bedtime';
       const voiceSettings = isBedtime ? {
         stability: 0.65,
         similarity_boost: 0.80,
         style: 0.35,
         use_speaker_boost: true,
         speed: speechSpeed
       } : ...
       ```
   - **`functions/src/voiceApi.ts`** (lines 112–113, 149–150, 161–167):
     - `DEFAULT_REX_VOICE_ID = "e9sQs6aLWU82SSolkPYZ"`, `DEFAULT_SPEECH_SPEED = 0.85`, `stability: 0.65`, `similarity_boost: 0.80`.

2. **Replay Voice Button Parameter Gap**:
   - **Path**: `src/views/BedtimeStoryView.js` (lines 1016–1026, 1136–1145)
   - **Verbatim Code**:
     ```javascript
     // Line 1023: Active story voice replay
     speakCompanion(currentAct.text, session.petId);

     // Line 1142: Bookshelf saved story read aloud
     speakCompanion(act.text, readingSavedStory.petId || '1');
     ```
   - **Observation**: Both calls call `speakCompanion` without passing `{ voiceStyle: 'bedtime', timeoutMs: 18000 }`! This causes replay audio to fall back to `voiceStyle: 'default'` (and 4.5s timeout) instead of the calibrated bedtime ElevenLabs parameters.

---

### 1.4 Background Lullaby Synthesizer Ducking & Swelling
1. **Ducking Ratio in `src/audio/sfx.js`**:
   - **Path**: `src/audio/sfx.js` (lines 1721–1724, 1774–1780)
   - **Verbatim Code**:
     ```javascript
     // Clear, soothing volume designed for bedtime listening (scaled by ducking)
     const peakGain = lullabyDucked ? 0.07 : 0.24;
     const overtoneGain = lullabyDucked ? 0.02 : 0.07;
     ...
     duckLullaby(ducked = true) {
       lullabyDucked = Boolean(ducked);
     },
     ```
   - **Observation**:
     - `0.07 / 0.24 = 29.17%`. The volume currently ducks to ~29%, NOT 15%!
     - 15% of 0.24 is `0.036` (sine primary), and 15% of 0.07 is `0.0105` (triangle overtone).
     - Ducking is controlled by a discrete boolean variable (`lullabyDucked`) that changes instantaneously between notes; there is NO continuous `lullabyMasterGain` node or smooth swelling ramp between notes.

---

### 1.5 API Key Delivery & Fallback Handling
1. **API Key Delivery**:
   - Server checks `process.env.ELEVENLABS_API_KEY`. If undefined, returns HTTP 503 (`ElevenLabs is not configured in server environment`).
2. **Client Fallback Cascade**:
   - `fetchPcmTts` (Tier 1: `/api/elevenlabs/tts`, 18s timeout for bedtime) ->
   - If null/error: `fetchPcmTts` (Tier 2: `/api/gemini/tts`, 8s timeout) ->
   - If null/error: `speakWithSpeechSynthesis` (Tier 3: Browser Web Speech API, Daniel / natural English voice).
3. **Safety Watchdog**:
   - `fetchPcmTts` wraps requests in an `AbortController` timeout (`18000ms`), preventing indefinite network hangs.
   - If all tiers fail or callback is lost, `narrateAct` in `bedtimeStoryService.js` has a `try/catch` block, but does not currently feature an independent timeout watchdog to ensure auto-advance activates if browser `speechSynthesis` stalls silently.

---

## 2. Logic Chain

1. **Premise 1 (Bedtime Purpose)**: The core goal of the bedtime experience is sleep induction and relaxation. Toddlers cannot drift to sleep if bombarded with prompts like "What should we do next?", flashing red microphone buttons, and decision choice chips.
2. **From Observation 1.1**: The interactive question prompts (`currentAct.promptQuestion`), mic button (`#story-mic-btn`), and suggestion chips (`data-select-chip`) are concentrated exclusively in `src/views/BedtimeStoryView.js` (lines 550–579) and backed by `bedtimeStoryService.js` and `bedtimeStoryData.js`.
3. **Inference 1**: Removing these three blocks from `BedtimeStoryView.js` completely eliminates mid-story interruptions from the user interface without altering the underlying diorama stage or story progression logic.
4. **From Observation 1.1 (Item 4)**: In `src/data/bedtimeStoryData.js` line 877, the text spoken by the TTS narrator explicitly asks: `"What special hero gadget should we pack into our backpack tonight?"`.
5. **Inference 2**: In addition to removing UI chips, the narrative sentence builders in `bedtimeStoryData.js` (and the prompts for Gemini/AGY in `geminiService.js`, `voiceApi.ts`, and `bedtime_narrator.py`) must be revised so the spoken text does not contain interactive questions, ensuring continuous bedtime prose.
6. **From Observation 1.2**: Auto-advance is currently set to 15 seconds (`this.autoAdvanceSecondsRemaining = 15;`).
7. **Inference 3**: Changing `this.autoAdvanceSecondsRemaining = 3;` in `bedtimeStoryService.js` (and `let autoAdvanceSeconds = 3;` in `BedtimeStoryView.js`) precisely satisfies Requirement R3: pausing for 3 seconds of gentle lullaby music after ElevenLabs narration completes before automatically advancing to the next chapter.
8. **From Observation 1.2 (Item 3)**: The manual `#story-manual-turn-page-btn` is already fully wired to cancel auto-advance and call `advanceStory()`. Keeping this button prominently displayed ensures parents and kids have full manual control at any second.
9. **From Observation 1.3**: Canonical voice ID `e9sQs6aLWU82SSolkPYZ` is already defined in `server/elevenLabsService.js` and `functions/src/voiceApi.ts`. However, when `voiceStyle === 'bedtime'`, the route should explicitly enforce `DEFAULT_MAIN_VOICE_ID` regardless of the pet passed. Furthermore, `BedtimeStoryView.js` lines 1023 and 1142 omitted `{ voiceStyle: 'bedtime', timeoutMs: 18000 }` during voice replays; passing this option ensures consistent ElevenLabs voice delivery.
10. **From Observation 1.4**: The lullaby synthesizer in `src/audio/sfx.js` ducks to 0.07 / 0.24 (~29%) rather than 15% (`0.036 / 0.24`), and uses a discrete boolean without smooth swelling. Introducing a master lullaby gain node (`lullabyMasterGain`) with exponential/linear ramps (0.15 during narration, 1.2s swell to 1.0 on chapter transition) fulfills the exact audio engineering mandate of R4.
11. **From Observation 1.5**: All network TTS calls are guarded by `AbortController` timeouts (18s). Adding an audio watchdog timer (e.g. 45s) in `bedtimeStoryService.narrateAct` guarantees that even if a mobile browser silently stalls audio playback without firing `onended`, the auto-advance timer will still kick in and advance the story safely.

---

## 3. Caveats

1. **Legacy Test Dependency in `scratch/test_bedtime_storybook.cjs`**:
   - In `scratch/test_bedtime_storybook.cjs` (line 129), an assertion checks:
     `assert(act1.suggestionChips.length >= 3, 'Act 1 has quick suggestion chips');`
   - If `bedtimeStoryService.js` or `bedtimeStoryData.js` sets `act.suggestionChips = []`, this older test will fail unless updated.
   - *Recommendation*: Preserve `suggestionChips: realm.act1DefaultChips` on the returned act data object for backwards compatibility with legacy tests, while completely omitting the suggestion chip UI and prompt questions from `BedtimeStoryView.js`.
2. **Narration Mode: 'rex' vs 'parent'**:
   - When a parent selects "Parent Mode" (`session.narrationMode === 'parent'`), ElevenLabs audio is not played.
   - If auto-advance immediately starts a 3-second countdown in Parent Mode, the parent would only have 3 seconds to read the 200-word chapter!
   - *Recommendation*: In Parent Mode, auto-advance should be disabled (or set to a generous timer, e.g. 90 seconds), and the manual "Turn Page ➡️" button should be the primary progression control. In ElevenLabs mode (`'rex'`), auto-advance triggers the 3-second gentle lullaby pause upon narration completion.
3. **AudioContext Autoplay Restrictions**:
   - If a child enters the Bedtime Story view without having clicked the screen yet, Web Audio context may be suspended.
   - `voiceService.js` already includes `pendingUnlockSpeech` to play on the first touch gesture, and `startStory` is triggered by tapping a start button (which unlocks the AudioContext).

---

## 4. Conclusion & Actionable Implementation Blueprint

### 4.1 Component 1: `src/views/BedtimeStoryView.js`
- **Action 1.1**: Remove the `❓ ${currentAct.promptQuestion}` block (lines 550–555).
- **Action 1.2**: Remove the microphone button (`#story-mic-btn`, lines 561–570) and its event listener (lines 951–986). Remove `isMicListening` variable.
- **Action 1.3**: Remove the quick suggestion chips container (lines 572–578) and its click listener (lines 989–1001).
- **Action 1.4**: Update the controls card layout below the narrative text:
  - Display the manual **"Turn Page ➡️"** button (`#story-manual-turn-page-btn`) as a prominent, full-width or auto-width action with min 48px height.
  - Display the Replay Voice button (`#story-replay-voice-btn`).
  - Display the auto-advance countdown indicator (`#autoadvance-pill`), showing the 3s gentle lullaby pause.
- **Action 1.5**: Update Replay Voice (line 1023) and Saved Story Read Aloud (line 1142) to pass `{ voiceStyle: 'bedtime', timeoutMs: 18000 }`.
- **Action 1.6**: Set `autoAdvanceSeconds = 3` (line 23).

### 4.2 Component 2: `src/services/bedtimeStoryService.js`
- **Action 2.1**: Update `this.autoAdvanceSecondsRemaining = 3` in `startAutoAdvance()`.
- **Action 2.2**: In `narrateAct()`, add a 45-second watchdog timer: if `onEnded` has not fired after 45 seconds, automatically unduck the lullaby (`Sound.duckLullaby(false)`) and call `startAutoAdvance()`.
- **Action 2.3**: In `narrateAct()`, if `narrationMode === 'parent'`, do not start a 3-second auto-advance; keep the page on screen until the parent taps "Turn Page ➡️".
- **Action 2.4**: Remove active speech recognition listeners from `startListening`/`stopListening` (or stub them safely to prevent unused browser mic permissions).

### 4.3 Component 3: `src/audio/sfx.js` (Lullaby Synthesizer)
- **Action 3.1**: Create a persistent `lullabyMasterGain` node connected to `context.destination`.
- **Action 3.2**: Connect note filters to `lullabyMasterGain` instead of directly to `context.destination`.
- **Action 3.3**: Update `duckLullaby(ducked = true)`:
  - When `true` (narration starting): Ramp `lullabyMasterGain.gain` to `0.15` (15% volume) over 0.6–0.8s.
  - When `false` (narration finished / chapter transition): Smoothly swell `lullabyMasterGain.gain` from `0.15` back to `1.0` (100% volume) over 1.2–1.5s.
  - Set peak note gain values when ducked to `0.036` (15% of 0.24) and `0.0105` (15% of 0.07).

### 4.4 Component 4: `server/elevenLabsService.js` & `functions/src/voiceApi.ts`
- **Action 4.1**: Standardize voice routing:
  - If `voiceStyle === 'bedtime'` or `isBedtime`: Force voice ID to `process.env.ELEVENLABS_REX_VOICE_ID || 'e9sQs6aLWU82SSolkPYZ'` across all children and pets.
  - Verify settings: `stability: 0.65`, `similarity_boost: 0.80`, `speed: 0.85`, `style: 0.35`, `use_speaker_boost: true`.

### 4.5 Component 5: Narrative Prose & Question Removal in Data Files
- **Action 5.1**: In `src/data/bedtimeStoryData.js` (line 877): Replace `"What special hero gadget should we pack into our backpack tonight?"` with a calm declarative sentence: `"${pName} smiled softly, ready for a peaceful evening of cozy starlight exploration."`.
- **Action 5.2**: In `server/geminiService.js` and `functions/src/voiceApi.ts`: Adjust prompt instructions to omit mid-story decision questions.

---

## 5. Verification Method

To independently verify these findings and the subsequent implementation:

1. **Verify UI Cleanup**:
   - Inspect `src/views/BedtimeStoryView.js` to ensure zero occurrences of `story-mic-btn`, `data-select-chip`, `❓`, or `promptQuestion` in the rendered stage HTML.
   - Inspect `BedtimeStoryView.js` to confirm `#story-manual-turn-page-btn` is rendered and accessible.
2. **Verify Auto-Advance Timing**:
   - Inspect `src/services/bedtimeStoryService.js`: Verify `this.autoAdvanceSecondsRemaining = 3`.
   - In browser / test simulation: Verify custom event `bedtime-story-autoadvance-tick` emits countdown with 3s initial duration.
3. **Verify Audio Ducking & Swelling**:
   - Inspect `src/audio/sfx.js`: Verify `duckLullaby(true)` ducks volume to 15% (gain `0.15`), and `duckLullaby(false)` smoothly swells gain back to `1.0`.
   - Run `node scratch/test_bedtime_sanctuary.cjs` to confirm `Sound.duckLullaby` and `Sound.isLullabyDucked` pass.
4. **Verify Voice Routing**:
   - Execute request to `/api/elevenlabs/tts` with `{ petId: 'raptor', voiceStyle: 'bedtime', text: 'Goodnight little hero' }`. Verify it returns `voice: 'e9sQs6aLWU82SSolkPYZ'`.
   - Execute request with `{ petId: 'stego', voiceStyle: 'bedtime', text: 'Sweet dreams' }`. Verify it returns `voice: 'e9sQs6aLWU82SSolkPYZ'`.
5. **Full Regression Suite**:
   - Run: `node scratch/verify_bedtime_storybook.mjs`
   - Run: `node scratch/run_all_tests.js`
   - Run: `npm run build`
