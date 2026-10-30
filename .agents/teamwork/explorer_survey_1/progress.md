# Progress — explorer_survey_1

- **Last visited**: 2026-10-27T03:42:00Z
- **Current Task**: Completed codebase investigation and empirical testing of Kokoro TTS pipeline and client audio playback; drafting handoff.md.
- **Status**: Investigation Complete, Drafting Handoff Report
- **Completed Steps**:
  1. Inspected `little-heroes-tts-service/main.py`, `voices.py`, `requirements.txt`, and `Dockerfile`.
  2. Identified primary root cause of truncation in `main.py`: `clean_dialogue_text` strips all newlines, while `pipeline(..., split_pattern=r"\n+")` attempts to process 180-220 word chapters as a single chunk, hitting Kokoro's 510-phoneme transformer sequence limit (~50-70 words, 1-2 sentences).
  3. Empirically tested Python regex sentence splitting (`r"(?<=[.!?])\s+|(?<=[.!?][\"'])\s+|\n+"`) and confirmed compatibility with Python `re` fixed-width lookbehind requirements.
  4. Formulated exact 250ms silence pause insertion and multi-chunk PCM16 concatenation logic for `synthesize()`.
  5. Inspected `src/services/voiceService.js`, `src/services/bedtimeStoryService.js`, and `src/views/BedtimeStoryView.js`.
  6. Analyzed client-side completion detection (`source.onended`), Web Audio decoding, auto-advance countdown triggers, and potential premature timeout pitfalls (`18000ms` fetch timeout, `dynamicWatchdogMs`).
  7. Inspected test suites in `scratch/` (`test_voice_service_prefetch.mjs`, `verify_kokoro_warmup.mjs`, `test_bedtime_overhaul_e2e.mjs`, `run_all_tests.js`).
