# Progress — Milestone 1: Core Narrative & Anti-Repetition Engine
Last visited: 2026-10-25T02:44:30Z

## Status: COMPLETE ✅

### Completed Milestones & Deliverables
1. **Universal 4-Chapter Narrative Expansion**:
   - `src/data/bedtimeStoryData.js`: calibrated 4-chapter narrative generator (~180–220 words per chapter, ~780–820 words total).
   - Fixed `generateFullBedtimeStory` to return all 4 chapters (no dropping chapter index 2).
   - Progressive story arcs:
     - Chapter 1: Departure & gentle curiosity (~185–190 words, subBiome 0)
     - Chapter 2: Whimsical encounter & gentle mystery (~200–215 words, subBiome 1)
     - Chapter 3: Calming cooperative resolution (~200–225 words, subBiome 2)
     - Chapter 4: Cozy starlight nest & drifting off to sleep (~185–190 words, subBiome 3)
2. **Comprehensive Anti-Repetition Registry**:
   - `BANNED_BEDTIME_STOCK_PHRASES` defined and exported in `src/data/bedtimeStoryData.js`.
   - Dynamic combinatorial sentence banks: 4 chapters x 6 opening structures (`BEDTIME_OPENING_BANKS`), 4 chapters x 12 soothing whisper lines (`BEDTIME_WHISPER_BANKS`).
   - Hardcoded mid-story question prompts completely removed and replaced with calm narrative prose.
3. **High-Entropy Seed Rotation & History Memory**:
   - Combinatorial seed generation with `Date.now()` and random seed mixing.
   - Negative constraints and history injection (`recentOpenings`, `recentArchetypes`, `recentTitles`, banned clichés) wired into `server/geminiService.js`, `functions/src/voiceApi.ts`, and `little-heroes-agy-service/agents/bedtime_narrator.py`.
4. **Verification & Testing**:
   - `test_m1_verification.js` passing with 100% assertions satisfied.
   - `test_bedtime_storybook.cjs` passing (46/46).
   - `test_bedtime_sanctuary.cjs` passing (16/16).
   - `npm run build` passing cleanly.
   - Python syntax compile passing.
