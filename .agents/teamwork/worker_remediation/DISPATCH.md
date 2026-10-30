# Task: Remediation - Companion Pet Naming Invariant & Test Suite Parity
Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_remediation
Original request file: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md
Audit report: c:\APP\stitch_little_hero_adventures\.agents\teamwork\victory_auditor_6\handoff.md

You are the Remediation Worker.

## Problem Statement from Independent Victory Audit:
In `src/data/bedtimeStoryData.js`:
1. In `generateProceduralBedtimeStory`, companion pet name (`${pName}`, e.g., "Rex") was interpolated across all chapter openings and chapter text.
2. This violated the contract asserted in `scratch/test_bedtime_sanctuary.cjs:100-115`:
   - "The companion pet's actual name must never appear in generated text; it should be referred to generically (e.g. 'Faithful Companion'), and only occasionally, not in every chapter."
   - `assert(!generated.text.includes('Rex'), 'Text must never use the pet\'s actual name');`
   - `assert(chaptersMentioningCompanion > 0 && chaptersMentioningCompanion < 4, 'The companion should be mentioned occasionally, not in every chapter (mentioned in ${chaptersMentioningCompanion}/4)');`
3. As a result, `node scratch/test_bedtime_sanctuary.cjs` failed at line 103, causing `node scratch/run_all_tests.js` to fail at test 32!

## Exclusive File Ownership:
- `src/data/bedtimeStoryData.js`
- `scratch/test_bedtime_sanctuary.cjs` (if necessary to align, but prioritize satisfying the existing test contract in `src/data/bedtimeStoryData.js`)
DO NOT edit other files.

## Instructions:
1. In `src/data/bedtimeStoryData.js`:
   - In `generateProceduralBedtimeStory`:
     Do NOT interpolate `${pName}` (the pet's literal name like "Rex") into the story text.
     Instead, refer to the companion generically (e.g. "Faithful Companion" or "loyal companion" or "little companion"), and only mention the companion occasionally (e.g. in chapter 0 and chapter 2, so `chaptersMentioningCompanion > 0 && chaptersMentioningCompanion < 4`), NOT in every chapter!
   - Ensure the hero name (`${hName}`, e.g. "Tommy") is still present in every chapter.
   - Ensure custom bedtime wish (e.g. "dentist") is present in Chapter 1 (index 0).
   - Ensure chapter text remains ~180–220 words per chapter.
   - Ensure `BANNED_BEDTIME_STOCK_PHRASES` are strictly avoided (0 occurrences).
2. Run and verify all test suites:
   - `node scratch/test_bedtime_sanctuary.cjs` -> MUST pass 16/16 with exit code 0!
   - `node scratch/test_bedtime_storybook.cjs` -> MUST pass 46/46 with exit code 0!
   - `node scratch/test_bedtime_overhaul_e2e.mjs` -> MUST pass 133/133 with exit code 0!
   - `node scratch/test_adversarial_challenger_1.mjs` -> MUST pass 17/17 with exit code 0!
   - `node scratch/test_adversarial_challenger_2.mjs` -> MUST pass 74/74 with exit code 0!
   - `node scratch/run_all_tests.js` -> MUST pass 100% with exit code 0!
   - `npm run build` -> MUST compile cleanly with exit code 0!
3. Document full verbatim test results in `handoff.md` and notify orchestrator via `send_message`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
