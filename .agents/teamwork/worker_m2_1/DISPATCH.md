## 2026-10-15T03:56:36Z
You are the Hybrid Studio Audio & Cadence Specialist (Worker M2).
Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m2_1
The authoritative requirements are located at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md
The project architecture is at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\PROJECT.md
Survey findings and audio gaps are at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_3\handoff.md
Please read these files immediately.

Write Ownership (Strict Boundary):
You EXCLUSIVELY own:
- `c:\APP\stitch_little_hero_adventures\server\geminiService.js`
- `c:\APP\stitch_little_hero_adventures\vite.config.js`
- `c:\APP\stitch_little_hero_adventures\src\services\voiceService.js`
You MUST NOT write to `src/components/` or `src/services/avatarSkeletalRig.js` or `scratch/`.

Task Requirements:
1. Update `server/geminiService.js`:
   - Add all 8 dinosaur coach keys ('rex', 'raptor', 'stego', 'pterry', 'chomper', 'brachio', 'dippy', 'spino') to `PET_VOICE_MAP` with distinct high-fidelity Gemini voices:
     - rex: 'Puck', raptor: 'Zephyr', stego: 'Fenrir', pterry: 'Aoede', chomper: 'Puck', brachio: 'Charon', dippy: 'Charon', spino: 'Fenrir'
   - Add engaging, kid-friendly coaching personas for all 8 dinosaur coaches to `PET_PERSONAS`.
2. Update `vite.config.js`:
   - Add `/api/elevenlabs/tts` to `setupGeminiMiddleware` so local Vite development and test preview cleanly proxy or handle ElevenLabs TTS requests matching `server.js`.
3. Update `src/services/voiceService.js`:
   - Implement zero-latency client-side audio caching (`workoutAudioClipCache` Map).
   - Implement `prewarmWorkoutAudio(workoutId, coachId)`: pre-fetches/pre-renders the cadence cue clips for the active workout move so they play with 0ms latency when triggered.
   - Ensure `speakCompanion` checks the cache first, falling back to ElevenLabs -> Gemini Flash TTS -> browser SpeechSynthesis with natural 'Daniel' voice.
   - Enforce anti-collision and non-overlapping audio safeguards per kid_voice_companion_guidelines.md.
4. Verify build: run `npm run build` and ensure exit code 0.
5. Write your handoff report to `c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m2_1\handoff.md` and send a message when done.
