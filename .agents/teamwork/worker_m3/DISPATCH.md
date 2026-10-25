# Task: Milestone 3 - Slumber Pacing, Turn Page & Unified ElevenLabs Voice Implementation
Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m3
Original request file: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md
Project specification: c:\APP\stitch_little_hero_adventures\PROJECT.md
Survey analysis: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_3\handoff.md

You are the Implementation Worker for Milestone 3.

## Exclusive File Ownership:
You own and have exclusive write permission to:
- `src/views/BedtimeStoryView.js`
- `src/services/bedtimeStoryService.js`
- `src/services/voiceService.js`
- `src/audio/sfx.js`
- `server/elevenLabsService.js`
- `src/components/BedtimeStoryStage3D.js`
- Minor safety guard in `src/data/bedtimeStoryData.js` (null-safe `userChoices`) and `server/imageGenService.js` (null-safe `heroName`)
DO NOT edit files outside this list.

## Objective & Requirements (R3 & R4):
1. **Removal of Mid-Story Choices & Questions from UI**:
   - In `src/views/BedtimeStoryView.js`:
     - Remove the `❓ ${currentAct.promptQuestion}` banner (lines ~550–555).
     - Remove the microphone button (`#story-mic-btn`, lines ~561–570) and listener (`isMicListening`).
     - Remove the suggestion chips container (`data-select-chip`, lines ~572–578) and listener.
     - Display the manual "Turn Page ➡️" button (`#story-manual-turn-page-btn`) prominently at all times.
     - Display auto-advance countdown indicator showing the 3s gentle pause.
     - Update chapter indicators to "Chapter X of 4" and "Hands-Free Auto-Read All 4 Chapters".
     - Pass `{ voiceStyle: 'bedtime', timeoutMs: 25000 }` on Replay Voice and Bookshelf Read Aloud.
2. **Hands-Free Auto-Advance with 3-Second Gentle Lullaby Pause**:
   - In `src/services/bedtimeStoryService.js`:
     - Set `this.autoAdvanceSecondsRemaining = 3` in `startAutoAdvance()`.
     - In `narrateAct()`, add a 45-second audio watchdog timeout so auto-advance activates if speech stalls.
     - If `narrationMode === 'parent'`, do NOT auto-advance after 3s; leave the page on screen until the parent taps "Turn Page ➡️".
     - Update illustration calls to pass `sessionId: session.id`, `chapterIndex: actNumber - 1`, `seed: Math.floor(Math.random() * 2147483647)`, and full `chapterText`.
3. **Unified Canonical ElevenLabs Voice Routing & Parameters**:
   - In `server/elevenLabsService.js`:
     - When `voiceStyle === 'bedtime'`, strictly enforce canonical voice ID `e9sQs6aLWU82SSolkPYZ` across all children, pets, and stories.
     - Calibrate settings: `stability: 0.65`, `similarity_boost: 0.80`, `speed: 0.85`, `style: 0.35`, `use_speaker_boost: true`.
   - In `src/services/voiceService.js`:
     - Ensure `timeoutMs: 25000` for bedtime voice requests.
4. **Dynamic Lullaby Synthesizer Audio Ducking & Smooth Swelling**:
   - In `src/audio/sfx.js`:
     - Implement persistent `lullabyMasterGain` node.
     - `duckLullaby(true)` ramps gain to `0.15` (15% volume) over 0.6–0.8s during speech.
     - `duckLullaby(false)` smoothly swells gain from `0.15` back to `1.0` (100% volume) over 1.2–1.5s on chapter transitions.
     - Set note ducked gains to `0.036` and `0.0105`.
5. **3D Stage 4-Chapter Synchronization**:
   - In `src/components/BedtimeStoryStage3D.js`:
     - `this.isBreathingActive = (this.chapterIndex === 3)`.
     - Activate `nest_woven_bed` and harmonic breathing ring on Chapter 4 (index 3).
     - Render `obstacle_arch` in chapters 1 and 2, but not chapter 3.
6. **Verification**:
   - Run `node scratch/test_bedtime_overhaul_e2e.mjs` -> must pass 133/133 tests.
   - Run `node scratch/run_all_tests.js` -> must pass with 0 failures.
   - Run `npm run build` -> must compile cleanly with exit code 0.
   - Document in `handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
