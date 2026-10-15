## 2026-10-15T18:05:47Z
You are the Regression Hardening Fix Worker for Little Hero Adventures.
Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_fix_gen2
You MUST read: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md.
Also inspect:
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\victory_auditor_2\handoff.md
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_2\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive File Ownership:
You exclusively own:
- `scratch/verify_name_and_memory_retention.mjs`
Do NOT modify production source files in `src/`.

Goal:
1. Harden `scratch/verify_name_and_memory_retention.mjs`:
   - In Test 4 (`talkToRexAGY`), the test currently makes an unmocked live remote call to `/api/rex/chat` and falls back to live Firebase/Gemini remote AI which returns non-deterministic roleplay text (e.g. `*Gently...`), failing the rigid substring assertion `.includes('Tommy')`.
   - Update `scratch/verify_name_and_memory_retention.mjs` to hermetically stub or mock the underlying fetch / pet chat endpoint (or `globalThis.fetch`) so it returns a deterministic response addressing the child's name, or gracefully check the fallback prompt payload/response without failing on non-deterministic external LLM latency/output.
2. Verification commands:
   - Run `node scratch/verify_name_and_memory_retention.mjs` -> must PASS with exit code 0.
   - Run `node scratch/verify_task_habit_engine_and_sync.mjs` -> must PASS 76/76 with exit code 0.
   - Run `node scratch/run_all_tests.js` -> MUST PASS ALL TEST FILES WITH EXIT CODE 0!
   - Run `npm run build` -> MUST EXIT WITH CODE 0.
3. Write `handoff.md` in your working directory and notify the orchestrator.
