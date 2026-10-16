# Little Hero Adventures — Test Ready Declaration

**Milestone:** `M-TEST` (E2E Test Suite Creation)  
**Author:** `test_writer_mtest_1`  
**Date:** 2026-10-16  
**Status:** **READY FOR IMPLEMENTATION MILESTONES (M1 - M4)**

---

## 1. Executive Summary

The comprehensive, requirement-driven, opaque-box E2E test suite for the Little Hero Adventures Bedtime AI Storybook upgrade is complete, verified, and integrated into the project's master regression runner.

The test infrastructure strictly adheres to the 4-Tier test methodology, providing authoritative, independent verification across all 20 features from `PROJECT.md` Feature Inventory, boundary edge cases, cross-feature combination matrices, and real-world child bedtime routines.

---

## 2. Test Artifacts Delivered

| File Path | Description | Status |
|---|---|---|
| `scratch/verify_bedtime_storybook.mjs` | Primary 4-Tier E2E automated test suite (100+ checks across Tiers 1-4) | **Created & Verified** |
| `scratch/run_all_tests.js` | Master regression runner with `scratch/verify_bedtime_storybook.mjs` registered | **Updated & Registered** |
| `TEST_INFRA.md` | Comprehensive test infrastructure documentation, contracts, and mocking guide | **Created** |
| `TEST_READY.md` | Formal milestone completion and test readiness declaration (this file) | **Published** |

---

## 3. Test Coverage Matrix

### Tier 1: Feature Coverage (20 Features, >=5 tests each = 100 tests)
- **F1: Generative Story Routes**: Validates `/api/rex/bedtime-story` and `/api/gemini/bedtime-story` across `server.js`, `geminiService.js`, `vite.config.js`, and `functions/src/voiceApi.ts`.
- **F2: Structured 3-Chapter Story Schema**: Validates 3 chapters with `title`, `chapterText`, `whisperLine`, `sleepyCue`, `moralReflection`, `choices`, `sceneMood`, and `sceneDescriptor`.
- **F3: Combinatorial Story Weaver**: Validates 12+ archetypes per realm, dynamic sentence builders, zero hardcoded "Rex" references for other pets, and preservation of 4 canonical realms + extended realms.
- **F4: Real-Time Per-Child Personalization**: Validates `buildChildStoryContext` integrating child profile, today's chores/habits, active pet metadata from `PETS_DATABASE`, equipped gear, and parent wish.
- **F5: Anti-Repetition Story Memory**: Validates `hero.bedtimeHistory` tracking last 25 story seeds/archetypes/titles as negative prompt constraints and deterministic seed rotation.
- **F6: Sibling Bookshelf Isolation**: Validates `bedtimeStoryLibrary` and `saveBedtimeStory` scoped per `heroId` with instant Firestore sync.
- **F7: Universal ElevenLabs Voice Fallback**: Validates all 24 pets and storytelling requests resolve to main voice (`e9sQs6aLWU82SSolkPYZ`) without HTTP 404s.
- **F8: Bedtime Voice Narration Tuning**: Validates bedtime voice parameters (`stability: 0.65`, `similarity_boost: 0.80`, `style: 0.35`, `use_speaker_boost: true`), speed <= 0.82, and cache key incorporating `voiceStyle`.
- **F9: Extended Timeouts & Playback Rate**: Validates 18,000ms timeout in `fetchPcmTts` and Web Audio `AudioBufferSourceNode.playbackRate` scaling.
- **F10: Background Audio Pre-Fetching**: Validates `prefetchCompanionAudio` pre-decoding Chapter N+1 into cache while Chapter N plays for 0ms transitions.
- **F11: Hands-Free Auto-Read Mode**: Validates `autoReadMode` in sanctuary state, toggle in `BedtimeStoryView.js`, 3s breathing countdown auto-advance, and quiet bedtime completion.
- **F12: Plot-Driven 3D Diorama Stage**: Validates `BedtimeStoryStage3D` dynamic scene construction from chapter `sceneDescriptor`.
- **F13: Articulated Toddler Hero & 24 Pet Rigs**: Validates toddler hero avatar with magic item hand socket + articulated pet companion rigs matching all 24 pet archetypes (dino, mystic, beast, aquatic, mech).
- **F14: 3-Chapter Diorama Choreography**: Validates Chapter 1 arrival/lantern/fireflies, Chapter 2 obstacle/helper gesture/particle burst, and Chapter 3 slumber nest/curled sleep/4s-4s breathing pacer.
- **F15: Interactive Raycast Constellations & Chimes**: Validates tapping 3D stars/fireflies triggers 3D ripple burst and pentatonic lullaby chimes (`playConstellationChime`).
- **F16: Graceful 2D Fallback & Explorer Palette**: Validates 2D Canvas/SVG fallback upon context loss or headless execution, and enforces strict Explorer Palette (`#09141e`, `#2ecc71`, `#00d2d3`, `#f39c12`, `#ffb961` — zero pink/purple).
- **F17: Dynamic Parent-Configured Bedtime Rewards**: Validates `store.completeBedtimeStory` dynamically reads `store.getWaypointRewards('wp_bedtime')` / `sleep_on_time`.
- **F18: One-Completion Payout Invariant**: Validates rejection of duplicate bedtime reward minting while `sleep_on_time` is pending parent approval.
- **F19: Reversible Currency Lifecycle**: Validates auto-issuing Tokens/XP/Sparks, queuing Gold Points in `pendingApprovals` with full delta metadata, and clean clawback clamped at floor 0 upon parent denial.
- **F20: Comprehensive Master Test Suite**: Validates test execution, documentation, and registration.

### Tier 2: Boundary & Corner Cases (7 Suites)
- **T2.1**: Empty bedtime history initialization (safe fallback without crash).
- **T2.2**: 25+ story history rollover (FIFO eviction capped at 25 entries).
- **T2.3**: Non-Rex companion pets (all 24 pets pass without 404 or missing rigs).
- **T2.4**: Missing or empty daytime tasks today (graceful default summary).
- **T2.5**: Headless WebGL fallback (null context and context loss recovery).
- **T2.6**: Denial clawback clamping at floor 0 (never negative balance).
- **T2.7**: Exhaustive Color Scan (deep scan confirms ZERO pink/purple across all assets).

### Tier 3: Cross-Feature Combinations (Pairwise Matrix)
- Matrix testing across Realm (Whispering Woods, Starlight Cove, Cloud Kingdom, Dino Slumber, Space, Crystal Cavern) x Pet Archetype (Dino, Mystic, Beast, Aquatic, Mech) x Mode (Auto-Read vs. Interactive) x Parent Bedtime Wish.

### Tier 4: Realistic Real-World Workflows
- **Workflow 1**: End-to-end child bedtime routine (sanctuary hub -> Ch 1 -> Ch 2 prefetch -> Ch 3 breathing nest).
- **Workflow 2**: Bedtime story completion and currency issuance.
- **Workflow 3**: Parent review in Parent Portal (approval awards points; denial claws back tokens/sparks).
- **Workflow 4**: Sibling bedtime isolation workflow (Child A and Child B concurrent submissions).

---

## 4. How Downstream Agents Run the Tests

To verify individual feature progress or full milestone readiness:

```bash
# Run the bedtime storybook verification suite
node scratch/verify_bedtime_storybook.mjs

# Run the master regression suite
node scratch/run_all_tests.js
```

---

## 5. Milestone Handoff to Implementing Agents

The test harness is armed. Implementers for Milestones M1, M2, M3, and M4 can now develop against these concrete assertions:
- **M1 (AI Story Engine & Routes)**: Implement generative routes in `server.js`, `geminiService.js`, `vite.config.js`, `functions/src/voiceApi.ts`, Combinatorial Story Weaver in `bedtimeStoryData.js`, and `buildChildStoryContext` in `bedtimeStoryService.js`.
- **M2 (ElevenLabs Voice & Audio Pre-Fetching)**: Implement universal voice resolution in `elevenLabsService.js` and `voiceApi.ts`, bedtime voice tuning, 18s timeouts & playback rate in `voiceService.js`, `prefetchCompanionAudio`, and Auto-Read toggle in `BedtimeStoryView.js`.
- **M3 (3D Diorama Stage & View Integration)**: Implement `BedtimeStoryStage3D.js` with Three.js/Spline diorama, 24 pet rigs, 3-chapter choreography, 4s/4s breathing pacer, raycast chimes, and 2D fallback.
- **M4 (Store Task/Habit & Currency Lifecycle)**: Implement dynamic rewards, one-completion invariant, sibling bookshelf isolation, and clean clawback in `store.js`.
