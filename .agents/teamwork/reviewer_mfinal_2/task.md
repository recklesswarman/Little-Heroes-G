# Reviewer 2 Task: Hybrid Audio, Cadence Timing & Arena Integration Review

Examine:
1. `server/geminiService.js` & `vite.config.js`: All 8 dinosaur coach keys and personas, ElevenLabs proxy parity.
2. `src/services/voiceService.js`: Zero-latency client-side cache (`workoutAudioClipCache`), prewarmWorkoutAudio, anti-collision safeguards, Daniel SpeechSynthesis fallback.
3. `src/views/DinoWorkoutView.js`: 3D stage mounting, cadence cues (0s, 10s, 20s, 30s, 40s, 50s, 58s), Diplodocus 30s synchronous flip, 8-minute circuit mode, water breaks, store rewards.
4. Adherence to Stitch design system (Electric Cyan, Emerald Green, Solar Amber, Midnight Slate — zero pink/purple) and kid_voice_companion_guidelines.md.
5. Run `node scratch/run_all_tests.js` and `npm run build`.
6. Provide verdict: APPROVE or REQUEST_CHANGES in handoff.md.
