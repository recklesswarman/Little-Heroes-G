# Survey Task: R2 - Rich, Extended Non-Repetitive Story Generation Engine
Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_2
Original request file: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md

You are an Explorer. Investigate the codebase to map all aspects of R2:
1. Identify all files involved in story generation (online Gemini/AGY, server routes `/api/gemini/bedtime-story`, `/api/rex/bedtime-story`, client Firebase AI Logic, and offline procedural weaver in `src/data/bedtimeStoryData.js` or `bedtimeStoryService.js`).
2. Analyze current chapter length and structure. Notice the shift from 3 chapters to 4 chapters (~180–220 words per chapter, ~750–850 words total, lasting 7–8 minutes) and the 4 progressive story arcs:
   - Ch 1: departure & gentle curiosity
   - Ch 2: whimsical encounter & gentle mystery
   - Ch 3: calming cooperative resolution
   - Ch 4: curling up in a cozy starlight nest, drifting off to sleep
3. Analyze current repetition issues: check for stock sentences, formulaic whisper lines, repetitive openings (e.g. "smiled happily beside", "looked up at the starry sky", "gazed with wonder").
4. Inspect anti-repetition registries, history persistence (`hero.bedtimeHistory`), seed rotation, and prompt negative constraints.
5. Document exact file paths, line numbers, current behavior, gaps relative to R2 requirements, and proposed architectural solutions.
6. Write your detailed analysis and report to `handoff.md` in your working directory.


## 2026-10-25T02:19:30Z
Sender: b9493cb1-e4ed-444a-a0d3-d8aedbf36adc
Priority: MESSAGE_PRIORITY_HIGH
Content:
You are an Explorer for Phase 0 Survey (R2: Rich, Extended Non-Repetitive Story Generation Engine).
Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_2
Read your task instructions at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_2\DISPATCH.md
Read the original request at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md

Investigate:
1. All files involved in story generation (online Gemini/AGY, server routes `/api/gemini/bedtime-story`, `/api/rex/bedtime-story`, client Firebase AI Logic, and offline procedural weaver in `src/data/bedtimeStoryData.js` or `bedtimeStoryService.js`).
2. Expansion from 3 chapters to 4 chapters (~180–220 words per chapter, ~750–850 words total, lasting 7–8 minutes) and the 4 progressive story arcs:
   - Ch 1: departure & gentle curiosity
   - Ch 2: whimsical encounter & gentle mystery
   - Ch 3: calming cooperative resolution
   - Ch 4: curling up in a cozy starlight nest, drifting off to sleep
3. Current repetition issues: check for stock sentences, formulaic whisper lines, repetitive openings (e.g. "smiled happily beside", "looked up at the starry sky", "gazed with wonder").
4. Anti-repetition registries, history persistence (`hero.bedtimeHistory`), seed rotation, and prompt negative constraints.
Document findings, file paths, line numbers, gaps, and proposed implementation plan in `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_2\handoff.md`.
Communicate back via send_message when done.

## 2026-10-27T03:32:26Z
Sender: f49987c3-1f6b-4dc9-991d-d2cb290c5641
Priority: MESSAGE_PRIORITY_HIGH
Content:
You are a teamwork_preview_explorer for Little Hero Adventures.
Your identity: explorer_survey_2
Your working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_2
Authoritative requirements: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (under section ## 2026-10-27T03:28:44Z).
Project root: c:\APP\stitch_little_hero_adventures

Mission:
Investigate Requirement 2: Zero-Cold-Start Warm Cloud Run Deployment & Low Latency Companion Voice.

Tasks:
1. Read ORIGINAL_REQUEST.md carefully.
2. Inspect `little-heroes-tts-service/` and the repo for deployment files:
   - Check Dockerfile, `cloudbuild.yaml`, deployment scripts, service configs, terraform or gcloud CLI commands used to deploy `little-heroes-tts-kokoro`.
   - Identify the exact Cloud Run deployment command/specification needed:
     `--min-instances 1`, 4 vCPU, 4GiB memory, `--cpu-boost`, keeping the warm PyTorch/Kokoro container in memory 24/7.
   - Check health check / readiness endpoints (`/health`, `/`) and how container startup initializes PyTorch/Kokoro models so requests don't hit uninitialized models.
3. Investigate companion voice guidance across the app:
   - Where is companion voice used? Check sanctuary (`SanctuaryView.js`), quests, workouts (`CompanionHeroWorkoutView.js`), gift unboxing (`GiftCratesView.js` / rewards), bedtime storybook (`BedtimeStoryView.js`).
   - How does `voiceService.js` handle latency, timeouts, and fallbacks?
   - How to ensure companion voice prompts respond in ~1.5–2 seconds without prematurely falling back to browser `speechSynthesis`?
   - How is client-side caching (`workoutAudioClipCache`) and the device-native Daniel fallback currently structured as offline safety nets?
4. Produce a comprehensive report in `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_2\handoff.md` with:
   - Cloud Run deployment analysis, existing scripts, and exact redeployment command/script.
   - App-wide voice prompt architecture and latency/timeout configs.
   - Client-side cache and fallback verification.
   - Verification commands and testing strategy.
5. Update `progress.md` in your working directory as you work.
6. Once finished, send a message to orchestrator_6 with a summary and the path to your handoff.md. Do not write implementation source code.
