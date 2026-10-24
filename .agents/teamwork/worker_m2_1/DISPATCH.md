## 2026-10-16T01:36:06Z

You are Worker 2 (worker_m2_1) for Milestone M2 (Voice Narration & Audio Pre-Fetching).
Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m2_1
Authoritative User Request: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (under ## 2026-10-16T01:20:55Z).
Project Specification: c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_3\PROJECT.md.
Survey Analysis: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_voice_2\analysis.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusive Write Ownership:
- `src/services/voiceService.js`

Your Mission:
1. `src/services/voiceService.js`:
   - Update `fetchPcmTts` to accept `timeoutMs` (defaulting to 18000ms for bedtime chapters) and `voiceStyle: 'bedtime'`, preventing 4500ms aborts on full story chapters. Include `voiceStyle` in cache keys.
   - Update `speakCompanion` to support argument polymorphism: accept options object `{ timeoutMs, rate, pitch, voiceStyle, instant, onEnded }` or trailing options, and properly set `source.playbackRate.setValueAtTime(rate, sharedAudioContext.currentTime)` on Web Audio `AudioBufferSourceNode`s.
   - Implement `prefetchCompanionAudio(text, petId, options)` to background-fetch and decode Chapter N+1 audio buffer into `workoutAudioClipCache` while Chapter N plays, enabling 0ms latency transitions.
   - Ensure resilient fallback to Gemini Flash TTS (`/api/gemini/tts`) and local SpeechSynthesis (`selectPreferredVoice('daniel')`) when offline or on network failure.

Test and verify:
Run `node scratch/test_elevenlabs_tts_cache.cjs` and verify clean execution.
Write your detailed report and test results to `handoff.md` and notify parent when complete.
