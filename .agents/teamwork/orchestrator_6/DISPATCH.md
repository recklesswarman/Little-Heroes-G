## 2026-10-27T03:30:44Z
You are the Project Orchestrator (orchestrator_6) for Little Hero Adventures.

Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_6
Authoritative user requirements: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (under section ## 2026-10-27T03:28:44Z).
Project root: c:\APP\stitch_little_hero_adventures

Mission:
Comprehensive fix and optimization of Little Hero Adventures Voice Guidance, Kokoro TTS pipeline, and Bedtime AI Storybook: ensuring the full ~180–220 word chapter text is read aloud without truncating after 1-2 sentences, eliminating scale-to-zero latency so companion guidance reliably uses Kokoro, and redesigning the Cloudflare SDXL illustration prompt with front-loaded lower-chapter focal extraction and dual-scene generation.

Key Requirements:
1. R1. Full-Chapter Kokoro Synthesis Without Truncation:
   - In `little-heroes-tts-service/main.py`: update `synthesize()` to segment incoming dialogue and bedtime chapter text on sentence boundaries (`split_pattern=r"(?<=[.!?])\s+"` or regex sentence tokenizer).
   - Iterate through all sentence chunks produced by `pipeline(...)`, ensuring every sentence in chapters up to 250 words is phonemized and synthesized.
   - Concatenate all synthesized sentence chunks into a single seamless PCM16 stream with a gentle 250ms silence pause between sentences, returning the complete, unabridged chapter audio in one payload.
   - Update `BedtimeStoryView.js` and `voiceService.js` to ensure the audio buffer plays to completion and the end-of-narration event and 3-second auto-advance trigger only after the entire chapter finishes.
2. R2. Zero-Cold-Start Warm Cloud Run Deployment:
   - Re-deploy `little-heroes-tts-kokoro` on Cloud Run with `--min-instances 1` (4 vCPU, 4GiB memory, `--cpu-boost`), keeping the warm PyTorch/Kokoro container alive in memory 24/7.
   - Ensure companion voice prompts in the sanctuary, quests, workouts, and gift unboxing respond in ~1.5–2 seconds without falling back to browser `speechSynthesis`.
   - Retain resilient client-side caching (`workoutAudioClipCache`) and the device-native Daniel fallback as offline safety nets.
3. R3. Dynamic Dual-Scene Illustration Generator (CLIP 77-Token Optimization):
   - In `src/services/bedtimeIllustrationService.js`: redesign `buildPrompt()` to place the chapter-specific narrative action, unique setting elements, and landmark/characters extracted from the chapter's climax and lower portion directly in the first 50 tokens, ensuring the Stable Diffusion XL 77-token CLIP window captures the distinct narrative setting instead of generic dinosaur night boilerplate.
   - Implement dual-scene generation: generate Scene A (establishing story setting) and Scene B (climax action / cozy resolution) for each chapter, caching both under deterministic keys and allowing children to toggle or view both scenes in `BedtimeStoryView.js`.
   - Guarantee strict Explorer Palette compliance (zero pink or purple colors).

Constraints:
- Strict Explorer Palette: #09141e, #2ecc71, #00d2d3, #f39c12, #ffb961 (zero pink or purple).
- Preserve existing store methods, audio playback flows, and test suites.
- If modifying firestore.rules, delegate to firestore-rules-author.
- Keep coordination files updated in your working directory (`plan.md`, `progress.md`, and write `handoff.md` upon completion).
- Verify all changes with automated tests and a production build before claiming completion.
