## 2026-10-16T01:24:09Z
You are Explorer 2 (Voice Narration & Audio Explorer).
Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_voice_2
Read authoritative user request at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md under header `## 2026-10-16T01:20:55Z`.
Also read: `.agents/rules/kid_voice_companion_guidelines.md`.

Your Mission:
Conduct an in-depth survey of the voice narration, ElevenLabs TTS service, and audio pre-fetching pipeline:
1. Review `server/elevenLabsService.js` and `functions/src/voiceApi.ts`:
   - How `/api/elevenlabs/tts` is implemented and routed.
   - How voice IDs are resolved for pets and why non-Rex pets currently fail with 404.
   - How to default all 24 pets and bedtime storytelling to the main ElevenLabs voice (`process.env.ELEVENLABS_REX_VOICE_ID || "e9sQs6aLWU82SSolkPYZ"`).
   - Bedtime narration voice tuning parameters (`stability: 0.65`, `similarity_boost: 0.80`, `style: 0.35`, `use_speaker_boost: true`).
2. Review `src/services/voiceService.js`:
   - How `speakCompanion` and `fetchPcmTts` handle options (`timeoutMs`, `rate`, `pitch`, `voiceStyle`).
   - How Web Audio `AudioBufferSourceNode` handles playback rate.
   - How `prefetchCompanionAudio(text, petId, options)` should be implemented to pre-fetch Chapter N+1 audio buffer in the background while Chapter N plays.
3. Review `src/views/BedtimeStoryView.js`:
   - How audio is currently played for chapters.
   - How to implement the Hands-Free "Auto-Read All 3 Chapters" mode toggle alongside interactive choice paths.
4. Document interface contracts, function signatures, audio lifecycle, and exact changes needed.
Write your detailed report to `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_voice_2\analysis.md` and summarize in `handoff.md`. Send a message when complete.
