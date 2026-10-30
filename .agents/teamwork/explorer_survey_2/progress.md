# Progress — explorer_survey_2

Last visited: 2026-10-27T03:33:45Z
Status: In Progress — Survey R2 (Zero-Cold-Start Warm Cloud Run Deployment & Low Latency Companion Voice)

## Tasks
- [x] Received dispatch instructions and updated DISPATCH.md and BRIEFING.md
- [/] Task 1: Inspect `little-heroes-tts-service/` and deployment scripts (Dockerfile, cloudbuild, gcloud commands, `/health`, model warmup)
- [ ] Task 2: Analyze Cloud Run deployment specifications (`--min-instances 1`, 4 vCPU, 4GiB, `--cpu-boost`, health check / readiness)
- [ ] Task 3: Map companion voice usage across app (`SanctuaryView.js`, `QuestsView.js`, `CompanionHeroWorkoutView.js`, `GiftCratesView.js`, `BedtimeStoryView.js`)
- [ ] Task 4: Investigate `voiceService.js` latency handling, timeouts, fallback cascade (~1.5-2s response without premature speechSynthesis fallback)
- [ ] Task 5: Investigate client-side caching (`workoutAudioClipCache`) and device-native Daniel offline fallback
- [ ] Task 6: Synthesize findings, produce 5-component `handoff.md`, and report back via send_message
