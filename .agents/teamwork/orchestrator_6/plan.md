# Implementation & Verification Plan - orchestrator_6

## Objective
Comprehensive fix and optimization of Little Hero Adventures Voice Guidance, Kokoro TTS pipeline, and Bedtime AI Storybook:
1. Full-chapter Kokoro synthesis without truncation (sentence boundary chunking, 250ms silence, complete Web Audio buffer playback, 3s auto-advance).
2. Zero-cold-start warm Cloud Run deployment (--min-instances 1, 4 vCPU, 4GiB, --cpu-boost) and sub-2s companion speech latency.
3. Dynamic dual-scene illustration generator (Scene A & Scene B, front-loaded 50-token climax/setting extraction for CLIP 77-token window, strict Explorer Palette).

## Execution Steps

### Phase 0: Survey & Technical Reconnaissance (Current)
- Spawn 3 parallel `teamwork_preview_explorer` subagents:
  - Explorer 1 (TTS & Audio): Examine `little-heroes-tts-service/main.py`, `src/services/voiceService.js`, `src/views/BedtimeStoryView.js`, sentence chunking, audio concatenation, and completion listeners.
  - Explorer 2 (Cloud Run & Deployment): Examine Cloud Run deployment configs/scripts (e.g., `cloudbuild.yaml`, `deploy_kokoro.sh`, or gcloud commands), server configs, latency fallbacks, and health checks.
  - Explorer 3 (Illustration & UI): Examine `src/services/bedtimeIllustrationService.js`, prompt construction, token limits, dual-scene generation & caching, and `BedtimeStoryView.js` dual-scene viewing/toggle UI.

### Phase 1: Architecture & Project Decomposition
- Synthesize findings into `PROJECT.md`.
- Establish E2E Testing plan and requirements.

### Phase 2: Implementation & Iteration
- Milestone 1: Kokoro TTS service multi-sentence chunking & Web Audio playback flow.
- Milestone 2: Cloud Run deployment verification and sub-2s warm latency pipeline.
- Milestone 3: Dynamic dual-scene illustration generator with front-loaded CLIP prompt optimization.
- Milestone 4: Integration in `BedtimeStoryView.js` and full E2E test verification.

### Phase 3: Review, Challenger, and Forensic Audit
- Independent Reviewers verify correctness against requirements.
- Challengers empirically stress test sentence chunking, large chapters (250 words), and dual-scene rendering.
- Forensic Auditor validates code integrity and absence of mocks/hardcoded data.

### Phase 4: Final Verification & Handoff
- Full automated test suite and production build pass with 0 errors.
- Final report to parent via `send_message`.
