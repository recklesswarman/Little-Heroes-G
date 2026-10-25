# Progress — Milestone 3 (Slumber Pacing, Turn Page & Unified Voice)

Last visited: 2026-10-25T03:09:00Z

## Status
- [x] Initialized BRIEFING.md and DISPATCH.md review
- [x] Updated `src/views/BedtimeStoryView.js`:
  - Removed mid-story prompt question banner (`❓ ${currentAct.promptQuestion}`)
  - Removed speech recognition mic button (`#story-mic-btn`) and listeners
  - Removed suggestion chips (`data-select-chip`) and click listener
  - Prominently maintained manual Turn Page button (`#story-manual-turn-page-btn`)
  - Updated auto-advance countdown indicator to 3s
  - Updated chapter indicators to "Chapter X of 4" and "Hands-Free Auto-Read All 4 Chapters"
  - Passed `{ voiceStyle: 'bedtime', timeoutMs: 25000 }` on Replay Voice and Bookshelf Read Aloud
- [x] Updated `src/services/bedtimeStoryService.js`:
  - Configured 3s auto-advance countdown with legacy test backwards-compatibility
  - Implemented 45-second audio watchdog timeout in `narrateAct()`
  - Disabled 3s auto-advance in Parent Mode (`narrationMode === 'parent'`) to allow parent-directed reading
  - Added race condition protection, concurrency locks (`isAdvancing`), and speech generation invalidation (`narrationGeneration`) to eliminate async timer interleaving
  - Updated `generateAct` and `prefetchNextChapterIllustration` to pass `sessionId`, `chapterIndex`, `seed`, and full `chapterText`
- [x] Updated `server/elevenLabsService.js`:
  - Strictly route bedtime voice requests (`voiceStyle === 'bedtime'`) to canonical voice ID `e9sQs6aLWU82SSolkPYZ`
  - Calibrated bedtime voice settings: `stability: 0.65`, `similarity_boost: 0.80`, `speed: 0.85`, `style: 0.35`, `use_speaker_boost: true`
- [x] Updated `src/audio/sfx.js`:
  - Implemented persistent `lullabyMasterGain` node
  - Configured `duckLullaby(true)` to ramp gain to 0.15 over 0.7s
  - Configured `duckLullaby(false)` to smoothly swell gain back to 1.0 over 1.3s
  - Set ducked note peak gains to 0.036 and 0.0105
- [x] Updated `src/components/BedtimeStoryStage3D.js`:
  - Set `this.isBreathingActive = (this.chapterIndex === 3)`
  - Rendered `nest_woven_bed` and breathing ring pacer on Chapter 4 (index 3)
  - Rendered `obstacle_arch` on chapters 1 and 2, but not chapter 3 (index 3)
  - Updated fallback 2D engine choreography to mirror 4-chapter progression
- [x] Updated `src/services/voiceService.js`:
  - Configured `timeoutMs: 25000` for bedtime voice requests
- [x] Added safety guards:
  - Null-safe `userChoices` in `src/data/bedtimeStoryData.js`
  - Null-safe `heroName` and `petName` in `server/imageGenService.js`
- [x] Verified `node scratch/test_bedtime_storybook.cjs` — 46/46 passed
- [x] Verified `node scratch/test_bedtime_overhaul_e2e.mjs` — 133/133 tests passed (100% success across all 4 tiers)
- [x] Verified `node scratch/run_all_tests.js` — All test suites passed with 0 failures
- [x] Verified `npm run build` — Exited 0 cleanly
- [x] Completed `handoff.md` and notified orchestrator
