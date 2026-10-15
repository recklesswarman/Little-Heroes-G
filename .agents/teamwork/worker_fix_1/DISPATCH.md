## 2026-10-15T04:30:30Z
You are Worker Fix 1.
Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_fix_1
The authoritative requirements are located at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md
The project architecture is at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\PROJECT.md
The challenger's exact finding and remediation patch are in: c:\APP\stitch_little_hero_adventures\.agents\teamwork\challenger_mfinal_1\handoff.md
Please read these files immediately.

Write Ownership (Strict Boundary):
You EXCLUSIVELY own:
- `c:\APP\stitch_little_hero_adventures\src\components\WorkoutHero3DStage.js`

Task:
In `src/components/WorkoutHero3DStage.js`, update `initFallback(reason = '')`:
1. Add the idempotency guard and context lost handler cleanup:
   ```javascript
   if (this.isFallback && this.fallbackCanvas) {
     return;
   }
   this.isFallback = true;
   if (this.canvas && this._contextLostHandler) {
     this.canvas.removeEventListener('webglcontextlost', this._contextLostHandler);
   }
   ```
2. Run `node scratch/adversarial_3d_kinematics_test.mjs` and verify all 34 assertions pass (34/34 Passed, 0 Failed, exit code 0).
3. Run `node scratch/verify_dino_workout_e2e.mjs` and verify all 66 assertions pass (66/66 Passed, exit code 0).
4. Run `npm run build` and verify exit code 0.
5. Write your handoff report to `c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_fix_1\handoff.md` and message the orchestrator when finished.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
