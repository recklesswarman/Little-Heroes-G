## 2026-10-25T02:29:38Z
# Task: Milestone 1 - Core Narrative & Anti-Repetition Engine Implementation
Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m1
Original request file: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md
Project specification: c:\APP\stitch_little_hero_adventures\PROJECT.md
Survey analysis: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_2\handoff.md

You are the Implementation Worker for Milestone 1.

## Exclusive File Ownership:
You own and have exclusive write permission to:
- `src/data/bedtimeStoryData.js`
- `server/geminiService.js`
- `functions/src/voiceApi.ts`
- `little-heroes-agy-service/agents/bedtime_narrator.py`
DO NOT edit files outside this list.

## Objective & Requirements (R2):
1. **Universal 4-Chapter Narrative Expansion**:
   - Expand online (Gemini `/api/gemini/bedtime-story`, `/api/rex/bedtime-story`, AGY `bedtime_narrator.py`) and offline procedural generators (`generateFullBedtimeStory` and `generateProceduralBedtimeStory` in `src/data/bedtimeStoryData.js`) to generate exactly 4 structured chapters.
   - Target length: ~180–220 words per chapter (~750–850 words total across 4 chapters, lasting 7–8 minutes of calm bedtime storytelling).
   - Progressive story arcs:
     - Chapter 1: Departure & gentle curiosity (~180–220 words, subBiome 0)
     - Chapter 2: Whimsical encounter & gentle mystery (~180–220 words, subBiome 1)
     - Chapter 3: Calming cooperative resolution (~180–220 words, subBiome 2)
     - Chapter 4: Curling up in cozy starlight nest, drifting off to sleep (~180–220 words, subBiome 3)
   - Ensure `generateFullBedtimeStory` includes all 4 chapters (do NOT drop Chapter index 2!).
2. **Comprehensive Anti-Repetition Registry & Dynamic Sentence Builders**:
   - Define `BANNED_BEDTIME_STOCK_PHRASES` in `src/data/bedtimeStoryData.js` containing: "smiled happily beside", "looked up at the starry sky", "gazed with wonder", "twinkled like cheerful fireflies", "golden sun had dipped peacefully", "all was quiet now", "gazed at the quiet, starry night", "flew across the starry sky".
   - Implement dynamic combinatorial sentence banks for all 4 chapters with 5+ opening structures and 12+ soothing whisper lines per chapter.
   - Eliminate hardcoded question prompts ("What should we do next?", "What special hero gadget should we pack into our backpack tonight?"). Replace with calm narrative prose.
3. **High-Entropy Seed Rotation & History Constraints**:
   - Incorporate random seed entropy (`Math.floor(Math.random() * 2147483647)`) and timestamp into combinatorial seed calculations so identical child/realm/moral selections on consecutive nights never produce identical plot archetypes.
   - In `server/geminiService.js`, `functions/src/voiceApi.ts`, and `bedtime_narrator.py`: inject strict negative constraints banning the stock clichés, recent titles, recent archetypes, and recent chapter openings.
4. **Verification**:
   - Run tests for story generation, e.g. `node scratch/test_bedtime_storybook.cjs` and verify word counts, chapter counts, and absence of banned phrases.
   - Document verification results in `handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
