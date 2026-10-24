## 2026-10-16T01:36:06Z
You are Worker 1 (worker_m1_1) for Milestone M1 (AI Story Engine, Combinatorial Weaver & Server Routes).
Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m1_1
Authoritative User Request: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (under ## 2026-10-16T01:20:55Z).
Project Specification: c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_3\PROJECT.md.
Survey Analysis: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_story_1\analysis.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusive Write Ownership:
- `src/data/bedtimeStoryData.js`
- `src/services/bedtimeStoryService.js`
- `server/geminiService.js`
- `server.js`
- `vite.config.js`
- `functions/src/voiceApi.ts`
- `server/elevenLabsService.js`

Your Mission:
1. `src/data/bedtimeStoryData.js`:
   - Upgrade `generateProceduralBedtimeStory` into a Combinatorial Dynamic Story Weaver with 12+ distinct plot archetypes per realm, dynamic sentence builders, rich structured `sceneDescriptor` payloads for all chapters, zero hardcoded "Rex" references when other pets are active.
   - Preserve the 4 canonical realms (`space`, `dino_jungle`, `pirate_lagoon`, `enchanted_castle`) and add new rich realms (`whispering_woods`, `starlight_cove`, `cloud_kingdom`, `crystal_caverns`, `coral_sanctuary`).
   - Retain backward compatibility with legacy 4-chapter indexing and 3-chapter narrative arcs.
   - Strictly Explorer Palette for all lighting and colors (#09141e, #2ecc71, #00d2d3, #f39c12, #ffb961 — zero pink/purple).
2. `server/geminiService.js`, `server.js`, `vite.config.js`, `functions/src/voiceApi.ts`:
   - Wire endpoints `/api/rex/bedtime-story` and `/api/gemini/bedtime-story` returning structured 3-chapter stories with `sceneDescriptor` adhering to the schema in PROJECT.md.
   - Connect client-side Firebase AI Logic (`gemini-2.5-flash`) fallback in `src/services/bedtimeStoryService.js`.
3. `server/elevenLabsService.js` & `functions/src/voiceApi.ts`:
   - Resolve main ElevenLabs voice (`process.env.ELEVENLABS_REX_VOICE_ID || "e9sQs6aLWU82SSolkPYZ"`) for all 24 pets and bedtime storytelling, eliminating HTTP 404s.
   - Support bedtime narration voice tuning (`stability: 0.65`, `similarity_boost: 0.80`, `style: 0.35`, `use_speaker_boost: true`).
4. `src/services/bedtimeStoryService.js`:
   - Integrate child context from `store.buildChildStoryContext(heroId)`, inject anti-repetition negative constraints from `hero.bedtimeHistory`, and return full 3-chapter payload with `sceneDescriptor`.

Test and verify:
Run `node scratch/test_bedtime_storybook.cjs` and verify clean execution.
Write your detailed report and test results to `handoff.md` and notify parent when complete.
