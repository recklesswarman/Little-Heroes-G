# BRIEFING — 2026-10-27T03:42:00Z

## Mission
Investigate Requirement 1: Full-Chapter Kokoro Synthesis Without Truncation across Python TTS service (`little-heroes-tts-service/main.py`) and client-side playback (`src/services/voiceService.js`, `src/views/BedtimeStoryView.js`).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis, handoff
- Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1
- Original parent: f49987c3-1f6b-4dc9-991d-d2cb290c5641
- Milestone: Requirement 1 Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / modify application source code
- Files for content delivery, Messages for coordination
- Strict 5-component handoff report (handoff.md)
- Provide exact file paths, line numbers, and concrete code recommendations

## Current Parent
- Conversation ID: f49987c3-1f6b-4dc9-991d-d2cb290c5641
- Updated: 2026-10-27T03:32:26Z

## Investigation State
- **Explored paths**:
  - `little-heroes-tts-service/main.py`
  - `little-heroes-tts-service/voices.py`
  - `little-heroes-tts-service/Dockerfile`
  - `src/services/voiceService.js`
  - `src/services/bedtimeStoryService.js`
  - `src/views/BedtimeStoryView.js`
  - `src/data/bedtimeStoryData.js`
  - `scratch/test_voice_service_prefetch.mjs`
  - `scratch/verify_kokoro_warmup.mjs`
  - `scratch/test_bedtime_overhaul_e2e.mjs`
  - `scratch/run_all_tests.js`
- **Key findings**:
  1. In `main.py`, `clean_dialogue_text` replaces all whitespace (including newlines) with single spaces, while `synthesize()` calls `pipeline(..., split_pattern=r"\n+")`. With 0 newlines, Kokoro receives the full 180-220 word chapter as one chunk, hitting the 510-phoneme transformer token limit (~50-70 words), truncating everything after 1-2 sentences.
  2. Kokoro yields multiple chunks when passed a sentence regex. Python `re` requires fixed-width lookbehind; alternation `r"(?<=[.!?])\s+|(?<=[.!?][\"'])\s+|\n+"` successfully splits sentences and quotes.
  3. Inserting `np.zeros(int(SAMPLE_RATE * 0.25), dtype=np.float32)` (6000 samples @ 24kHz) between consecutive sentence chunks gives the required 250ms gentle pause.
  4. In `voiceService.js`, default bedtime timeout was 18000ms, which risks aborting full-chapter synthesis on CPU; increasing to 30000-35000ms prevents premature fallback.
  5. In `bedtimeStoryService.js`, speech watchdog and `handleSpeechEnded` trigger auto-advance countdown; ensuring `dynamicWatchdogMs` has generous budget (120s+) prevents false triggers before playback completes.
- **Unexplored areas**: None for Requirement 1.

## Key Decisions Made
- Confirmed exact root causes and detailed solution architecture.
- Documented precise code replacements for implementer agent.

## Artifact Index
- `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1\DISPATCH.md` — Inbound dispatch instructions
- `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1\BRIEFING.md` — Situational awareness
- `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1\progress.md` — Heartbeat and activity log
- `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1\handoff.md` — Final 5-component handoff report
