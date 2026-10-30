# Original User Request

## 2026-10-15T03:46:23Z

Upgrade the Companion Hero Workout in Little Hero Adventures by integrating a true 3D character avatar (Spline / Three.js) animated via 3D skeletal bones to accurately demonstrate all 8 prehistoric gross-motor workouts, paired with a hybrid studio audio companion coaching engine.

Working directory: c:\APP\stitch_little_hero_adventures
Integrity mode: development
Requested team: Full team of autonomous agents working in parallel (3D graphics/skeletal animation specialist, audio/TTS pipeline engineer, and full-stack tester/reviewer).

## Requirements

### R1. 3D Character Avatar with Skeletal Bone Animation
The workout arena must render a 3D character avatar using Three.js or the Spline 3D runtime (@splinetool/runtime) side-by-side with the dinosaur coach. The avatar must execute 8 distinct, anatomically accurate skeletal bone animations matching each gross-motor workout:
1. Velociraptor Run: High-speed sprint on balls of feet with 90° arm pumps.
2. Stegosaurus Walks: Quadruped bear walk on hands and feet with hips elevated high, stepping 4 steps forward and 4 steps backward with ground stomps.
3. Pterodactyl Take Off: Wide arms wind-up in circular wing arcs, followed by crouch and vertical takeoff leap.
4. T-Rex Run: Short arms tucked in armpits, driving high knees up to hands.
5. Compsognathus Prances: Lateral skater jumps leaping side to side, crossing rear leg behind with balancing arm swing.
6. Brachiosaurus Stretch: Standing tall with feet together, rising high onto tiptoes, reaching arms straight overhead.
7. The Diplodocus: Tabletop quadruped bird-dog balance with neck reach and wagging tail leg, smoothly switching sides at 30 seconds.
8. Spinosaurus Stretch: Restorative Cat-Cow spine waves with rounded dorsal sail fin arching.
If 3D WebGL context is unavailable, gracefully fall back to the 2D procedural canvas without breaking the view.

### R2. Hybrid Studio Audio Companion Voice Coaching
Implement a hybrid audio engine for workout voice guidance:
- Natural high-fidelity AI voice audio via Gemini Flash TTS (/api/gemini/tts) or ElevenLabs (/api/elevenlabs/tts) with tailored kid-friendly coaching personas for the 8 dinosaur coaches.
- Caching layer for audio clips so voice lines play immediately with zero latency.
- Resilient browser speechSynthesis fallback with natural voice tuning whenever offline or network is constrained.
- Timed non-stop cadence coaching (0s, 10s, 20s, 30s, 40s, 50s, 58s) without overlapping audio.
- Diplodocus 30-second side switch announcement triggers synchronously with the 3D animation flip.

### R3. Safe Build & Design System Integrity
All additions must adhere to the Stitch design system (Electric Cyan, Emerald Green, Solar Amber, Midnight Slate — zero pink or purple) and preserve all existing store methods, 8-minute circuit mode, water break intermissions, and reward systems.

## Acceptance Criteria

### 3D Avatar Rendering & Skeletal Animation
- [ ] Workout stage mounts and renders a 3D character model via Three.js / Spline runtime without WebGL runtime errors.
- [ ] Skeletal bones transform accurately for each of the 8 workouts, visually matching the specific movement instructions.
- [ ] Clean fallback to procedural canvas if WebGL or asset loading fails.

### Voice Guidance & Cadence Timing
- [ ] Hybrid audio engine successfully triggers natural TTS audio or speech synthesis fallback.
- [ ] Spoken lines execute at designated cadence timestamps (0s, 10s, 20s, 30s, 40s, 50s, 58s) with no overlapping audio.
- [ ] At 30s in Diplodocus, the coach announces the side switch and the 3D avatar mirrors to the other side.

### System Verification & Build
- [ ] npm run build exits with code 0.
- [ ] Automated test suite (node scratch/run_all_tests.js) passes with 0 failures.


## 2026-10-27T03:28:44Z

Comprehensive fix and optimization of Little Hero Adventures Voice Guidance, Kokoro TTS pipeline, and Bedtime AI Storybook: ensuring the full ~180–220 word chapter text is read aloud without truncating after 1-2 sentences, eliminating scale-to-zero latency so companion guidance reliably uses Kokoro, and redesigning the Cloudflare SDXL illustration prompt with front-loaded lower-chapter focal extraction and dual-scene generation.

Working directory: c:\APP\stitch_little_hero_adventures
Integrity mode: development

## Requirements

### R1. Full-Chapter Kokoro Synthesis Without Truncation
- In `little-heroes-tts-service/main.py`: update `synthesize()` to segment incoming dialogue and bedtime chapter text on sentence boundaries (`split_pattern=r"(?<=[.!?])\s+"` or regex sentence tokenizer).
- Iterate through all sentence chunks produced by `pipeline(...)`, ensuring every sentence in chapters up to 250 words is phonemized and synthesized.
- Concatenate all synthesized sentence chunks into a single seamless PCM16 stream with a gentle 250ms silence pause between sentences, returning the complete, unabridged chapter audio in one payload.
- Update `BedtimeStoryView.js` and `voiceService.js` to ensure the audio buffer plays to completion and the end-of-narration event and 3-second auto-advance trigger only after the entire chapter finishes.

### R2. Zero-Cold-Start Warm Cloud Run Deployment
- Re-deploy `little-heroes-tts-kokoro` on Cloud Run with `--min-instances 1` (4 vCPU, 4GiB memory, `--cpu-boost`), keeping the warm PyTorch/Kokoro container alive in memory 24/7.
- Ensure companion voice prompts in the sanctuary, quests, workouts, and gift unboxing respond in ~1.5–2 seconds without falling back to browser `speechSynthesis`.
- Retain resilient client-side caching (`workoutAudioClipCache`) and the device-native Daniel fallback as offline safety nets.

### R3. Dynamic Dual-Scene Illustration Generator (CLIP 77-Token Optimization)
- In `src/services/bedtimeIllustrationService.js`: redesign `buildPrompt()` to place the chapter-specific narrative action, unique setting elements, and landmark/characters extracted from the chapter's climax and lower portion directly in the first 50 tokens, ensuring the Stable Diffusion XL 77-token CLIP window captures the distinct narrative setting instead of generic dinosaur night boilerplate.
- Implement dual-scene generation: generate Scene A (establishing story setting) and Scene B (climax action / cozy resolution) for each chapter, caching both under deterministic keys and allowing children to toggle or view both scenes in `BedtimeStoryView.js`.
- Guarantee strict Explorer Palette compliance (zero pink or purple colors).

## Acceptance Criteria

### Full Storybook Audio Continuity
- [ ] Generating or reading a full bedtime story chapter (~180–220 words) reads every sentence from start to finish without cutting off after 1–2 sentences.
- [ ] Audio playback cleanly triggers the end-of-speech event only after the final word has played, smoothly starting the 3-second auto-advance countdown.

### Reliable Sub-2-Second Kokoro Companion Speech
- [ ] Voice guidance throughout the app (sanctuary, workouts, quests, unboxing) and bedtime storybook reliably returns and plays Kokoro audio.
- [ ] Cloud Run `min-instances 1` guarantees zero cold-start timeouts for active sessions.

### Unique Chapter Illustrations & Dual Scenes
- [ ] Cloudflare SDXL prompts place the unique narrative scene description at the front of the prompt within the first 60 tokens.
- [ ] Each chapter supports 2 distinct visual scenes (Scene A and Scene B) matching the story progression.
- [ ] Consecutive chapters in the same bedtime book generate visibly distinct themes and settings rather than repeating the same scene.
