# BRIEFING — 2026-10-15T04:06:00Z

## Mission
Implement high-fidelity hybrid audio coaching for all 8 dinosaur coaches with server personas, Vite ElevenLabs proxy middleware, zero-latency client audio caching, cadence pre-warming, and anti-collision safeguards.

## 🔒 My Identity
- Archetype: Hybrid Studio Audio & Cadence Specialist
- Roles: implementer, qa, specialist
- Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m2_1
- Original parent: 95945b0b-5f74-4471-935a-2738aaef81cc
- Milestone: M2 (Hybrid Audio Companion & Cadence)

## 🔒 Key Constraints
- Strict write boundaries: EXCLUSIVELY own `server/geminiService.js`, `vite.config.js`, `src/services/voiceService.js`, and `.agents/teamwork/worker_m2_1/`.
- MUST NOT write to `src/components/`, `src/services/avatarSkeletalRig.js`, or `scratch/`.
- No cheating: genuine implementations only, no hardcoded facades, real audio cache state and fallback logic.
- Follow `kid_voice_companion_guidelines.md` for anti-collision, non-overlapping audio safeguards.
- Preserve Stitch design system integrity (zero pink/purple).
- `npm run build` must exit 0.

## Current Parent
- Conversation ID: 95945b0b-5f74-4471-935a-2738aaef81cc
- Updated: 2026-10-15T04:06:00Z

## Task Summary
- **What to build**:
  1. `server/geminiService.js`: All 8 dinosaur coaches ('rex', 'raptor', 'stego', 'pterry', 'chomper', 'brachio', 'dippy', 'spino') in `PET_VOICE_MAP` with specified voices (rex: 'Puck', raptor: 'Zephyr', stego: 'Fenrir', pterry: 'Aoede', chomper: 'Puck', brachio: 'Charon', dippy: 'Charon', spino: 'Fenrir') and kid-friendly coaching personas in `PET_PERSONAS`.
  2. `vite.config.js`: Add `/api/elevenlabs/tts` to `setupGeminiMiddleware` to proxy or handle ElevenLabs TTS requests matching `server.js`.
  3. `src/services/voiceService.js`: Implement `workoutAudioClipCache` (Map), `prewarmWorkoutAudio(workoutId, coachId)`, update `speakCompanion` to check cache first with fallback chain (ElevenLabs -> Gemini Flash TTS -> browser SpeechSynthesis with natural 'Daniel' voice), and anti-collision/non-overlapping safeguards.
- **Success criteria**:
  - `server/geminiService.js` contains all 8 voices & personas.
  - `vite.config.js` handles `/api/elevenlabs/tts`.
  - `src/services/voiceService.js` provides `workoutAudioClipCache`, `prewarmWorkoutAudio(workoutId, coachId)`, instant cache playback, and safe fallback.
  - `npm run build` exits with code 0.
- **Interface contracts**: `.agents/teamwork/PROJECT.md`
- **Code layout**: `.agents/teamwork/PROJECT.md § Code Layout`

## Key Decisions Made
- Keyed `workoutAudioClipCache` by `${normKey}:${cleanSpoken}`, `${rawId}:${cleanSpoken}`, and `${cleanSpoken}` to ensure zero-latency cache hits regardless of whether caller passes numeric IDs ('2') or semantic keys ('raptor').
- Pre-decoded raw PCM base64 audio into immutable Web Audio `AudioBuffer` objects during prewarming to achieve true 0ms hardware playback latency.
- Enforced non-overlapping audio by cleanly stopping previous buffer sources and canceling SpeechSynthesis prior to any playback.

## Artifact Index
- `.agents/teamwork/worker_m2_1/DISPATCH.md` — Assigned task requirements
- `.agents/teamwork/worker_m2_1/BRIEFING.md` — Working memory and status
- `.agents/teamwork/worker_m2_1/progress.md` — Liveness heartbeat and progress tracker
- `.agents/teamwork/worker_m2_1/handoff.md` — Final 5-component handoff report

## Change Tracker
- **Files modified**:
  - `server/geminiService.js`: Added 8 dinosaur voices to `PET_VOICE_MAP` and personas to `PET_PERSONAS` with numeric aliases.
  - `vite.config.js`: Added `/api/elevenlabs/tts` route and dynamic service loading in `setupGeminiMiddleware`.
  - `src/services/voiceService.js`: Implemented `workoutAudioClipCache`, `prewarmWorkoutAudio`, instant cache-first playback, and anti-collision safeguards.
- **Build status**: `npm run build` passed (exit code 0, 12.66s)
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pass (55/55 test suites passed, build succeeded with code 0)
- **Lint status**: Clean
- **Tests added/modified**: Verified against full suite in `scratch/run_all_tests.js`

## Loaded Skills
- **Source**: none specified
- **Local copy**: N/A
- **Core methodology**: N/A
