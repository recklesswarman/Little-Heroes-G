# Task: Hybrid Studio Audio & Cadence Specialist (M2)

Scope:
- Update `server/geminiService.js`: Add voice mappings (`PET_VOICE_MAP`) and personas (`PET_PERSONAS`) for all 8 dinosaur coaches ('rex', 'raptor', 'stego', 'pterry', 'chomper', 'brachio', 'dippy', 'spino').
- Update `vite.config.js`: Add `/api/elevenlabs/tts` to `setupGeminiMiddleware` to mirror `server.js`.
- Update `src/services/voiceService.js`: Multi-tier hybrid TTS with client-side in-memory zero-latency audio cache and cadence pre-warming (`prewarmWorkoutAudio(workoutId, coachId)`), with Daniel SpeechSynthesis fallback.
- Verify npm run build passes with exit code 0.
