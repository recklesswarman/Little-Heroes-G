# Handoff Report: Bedtime Story Engine & Server Explorer

**Agent:** Explorer 1 (Story Engine & Server Explorer)  
**Working Directory:** `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_story_1`  
**Report Type:** Hard (Survey & Investigation Complete)  
**Target:** AI Story & Personalization Engine Architect, Full-Stack QA & Team  

---

## 1. Observation

Direct observations and evidence gathered during the codebase inspection:

1. **`src/data/bedtimeStoryData.js` Lines 463–517:**
   - `generateProceduralBedtimeStory` generates 4 chapters (`chapterIndex` 0, 1, 2, 3).
   - In lines 478, 490, 502, and 513:
     `Rex looked over with a warm smile...`
     `Rex stepped forward and gently knelt down beside them...`
     `Rex softly lowered the glowing bedtime lantern...`
     "Rex" is hardcoded into dialogue even when a non-Rex companion (e.g. Raptor, Stego, Bella) is passed as `activePetName`.
   - The generator returns only `{ chapterIndex, title, subtitle, text, prompt, defaultChips }` and completely lacks `whisperLine`, `sleepyCue`, `moralReflection`, `choices`, `sceneMood`, and the 3D `sceneDescriptor` object.
   - `BEDTIME_REALMS` defines only 4 realms: `space`, `dino_jungle`, `pirate_lagoon`, `enchanted_castle`.

2. **`scratch/test_bedtime_storybook.cjs` Lines 53 & 115–118:**
   - `assert(BEDTIME_REALMS.length === 4, 'Should define exactly 4 bedtime fantasy realms');`
   - `assert(completeRes.rewardCoins === 30, 'Awards exactly 30 tokens for bedtime story');`
   - Existing regression tests verify strict invariants: any extension of realms must ensure the original 4 realm IDs (`space`, `dino_jungle`, `pirate_lagoon`, `enchanted_castle`) remain intact and backward compatible.

3. **`server.js` Lines 22–27 & `vite.config.js` Lines 37–110:**
   - `server.js` only exposes `/api/gemini/tts`, `/api/gemini/chat`, and `/api/elevenlabs/tts`.
   - Neither `/api/rex/bedtime-story` nor `/api/gemini/bedtime-story` is mounted.
   - `vite.config.js` does not intercept bedtime story routes in its dev middleware.

4. **`functions/src/voiceApi.ts` Lines 147–154:**
   - Non-Rex voice requests return HTTP 404:
     ```typescript
     const voiceId = normalizedPetId === "rex"
       ? (process.env.ELEVENLABS_REX_VOICE_ID || DEFAULT_REX_VOICE_ID)
       : undefined;
     if (!voiceId) {
       res.status(404).json({ error: `No ElevenLabs voice configured for pet "${normalizedPetId}".` });
       return;
     }
     ```
   - Bedtime story routes `/api/gemini/bedtime-story` and `/api/rex/bedtime-story` are not mounted in Cloud Functions.

5. **`src/services/voiceService.js` Lines 606–670 & 754–855:**
   - `fetchPcmTts` hardcodes `timeoutMs = 4500` (insufficient for ~120-150 word chapters).
   - `playPcmTtsResponse` does not set `source.playbackRate.value = rate`.
   - `prefetchCompanionAudio` does not exist yet.

6. **`src/state/store.js` Lines 9373–9523:**
   - `getBedtimeStoryLibrary()` returns `this.state.bedtimeStoryLibrary` with no `heroId` scoping.
   - `completeBedtimeStory(storyData)` hardcodes `coinsAwarded = 30; sparksAwarded = 15; xpAwarded = 20;`.
   - Does not check `store.isTaskPendingApproval('sleep_on_time', hero.id)`.
   - `hero.bedtimeHistory` only logs `{ moralId, title, timestamp }` and lacks seeds, archetypes, and chapter openings.

---

## 2. Logic Chain

1. From **Observation 1 & 2**, existing procedural stories hardcode Rex and lack structured 3D choreography payloads, but existing tests require the 4 canonical realms to exist. Therefore, we must upgrade `generateProceduralBedtimeStory` to support 12+ combinatorial plot archetypes per realm, dynamic pet name insertion, and rich 3-chapter `sceneDescriptor` payloads, while retaining the 4 canonical realm IDs and supporting both legacy 4-chapter indexing and new 3-chapter generation.
2. From **Observation 3 & 4**, when the client app calls `/api/rex/bedtime-story` or `/api/gemini/bedtime-story`, requests fail in development (Vite), production (Express `server.js`), and cloud deployments (`functions/src/voiceApi.ts`). Therefore, identical route handlers (`handleBedtimeStoryRequest`) backed by Gemini with strict JSON schema must be mounted across all three files, and `firebase.json` rewrites must route these paths to the Cloud Function.
3. From **Observation 4 & 5**, non-Rex pets cause ElevenLabs TTS to 404, and bedtime story chapter speech times out at 4.5s. Therefore, `functions/src/voiceApi.ts` and `server/elevenLabsService.js` must fall back to the main voice (`e9sQs6aLWU82SSolkPYZ`) for all pets, and `voiceService.js` must accept `timeoutMs: 18000`, apply `source.playbackRate.value`, and provide `prefetchCompanionAudio` to eliminate audio latency between chapters.
4. From **Observation 6**, siblings share an unisolated story library and bedtime rewards bypass parent-configured settings. Therefore, `buildChildStoryContext(heroId)` must be introduced to supply child profile, today's tasks, active pet, and equipped gear; `getBedtimeStoryLibrary(heroId)` and `saveBedtimeStory()` must be scoped per child; `hero.bedtimeHistory` must store the last 25 seeds and archetypes for prompt negative constraints; and `completeBedtimeStory()` must enforce the one-payout-at-a-time invariant and dynamic parent reward configuration.

---

## 3. Caveats

- **No Caveats.** All files, schemas, endpoints, tests, and data models have been directly inspected on the local filesystem and cross-referenced with `ORIGINAL_REQUEST.md` and app rules.

---

## 4. Conclusion

The Bedtime Story engine requires a coordinated multi-file upgrade:
1. `src/data/bedtimeStoryData.js`: Expand realms, add 12+ plot archetypes, eliminate hardcoded Rex, and output rich 3-chapter `sceneDescriptor` payloads.
2. `src/state/store.js`: Add `buildChildStoryContext(heroId)`, scope `getBedtimeStoryLibrary` and `saveBedtimeStory` by `heroId`, upgrade `hero.bedtimeHistory` to 25 entries with seeds/archetypes, and enforce parent-configured rewards & approval lifecycle in `completeBedtimeStory`.
3. `server/geminiService.js`, `server.js`, `vite.config.js`, `functions/src/voiceApi.ts`: Wire `/api/rex/bedtime-story` and `/api/gemini/bedtime-story` with structured JSON schema.
4. `src/services/voiceService.js` & `server/elevenLabsService.js`: Universal ElevenLabs voice resolution, 18s chapter timeout, Web Audio playback rate tuning, and background audio pre-fetching.

All specifications and blueprints are fully documented in `analysis.md`.

---

## 5. Verification Method

To independently verify the survey and findings:

1. **Verify Baseline Tests:**
   ```powershell
   node scratch/test_bedtime_storybook.cjs
   node scratch/test_bedtime_sanctuary.cjs
   ```
2. **Inspect Detailed Analysis:**
   Examine `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_story_1\analysis.md` for complete schemas, contracts, and code diff blueprints.
3. **Invalidation Conditions:**
   - Any modification that breaks the 4 canonical realm IDs or changes `scratch/run_all_tests.js` passes without backward compatibility guards.
   - Any hardcoded color outside the Explorer Palette (`#09141e`, `#2ecc71`, `#00d2d3`, `#f39c12`, `#ffb961`).
