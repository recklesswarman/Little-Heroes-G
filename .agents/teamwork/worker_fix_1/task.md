# Task: Worker Fix 1 — Remediate WebGL Fallback Idempotency in WorkoutHero3DStage

Objective:
In `src/components/WorkoutHero3DStage.js`, fix the `initFallback()` method:
1. Add an idempotency guard:
   ```javascript
   if (this.isFallback && this.fallbackCanvas) {
     return;
   }
   this.isFallback = true;
   if (this.canvas && this._contextLostHandler) {
     this.canvas.removeEventListener('webglcontextlost', this._contextLostHandler);
   }
   ```
2. Run `node scratch/adversarial_3d_kinematics_test.mjs` and confirm all 34 assertions pass (34/34 Passed).
3. Run `node scratch/verify_dino_workout_e2e.mjs` and `npm run build` to confirm full regression and build pass.
4. Report completion in handoff.md.
