## 2026-10-16T02:23:07Z
You are Worker Fix (worker_fix_1) for Milestone M-FINAL Remediation.
Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_fix_1
Authoritative User Request: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (under ## 2026-10-16T01:20:55Z).
Project Specification: c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_3\PROJECT.md.
Reviewer 2 Feedback Report: c:\APP\stitch_little_hero_adventures\.agents\teamwork\reviewer_mfinal_2\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusive Write Ownership:
- `src/state/store.js`
- `src/components/BedtimeStoryStage3D.js`

Your Mission:
Remediate the two issues identified by Reviewer 2:
1. `src/state/store.js`:
   - In `completeBedtimeStory`, set `taskId: 'bedtime_story'` in `this.enqueuePendingApproval` and in the action log / completion log. Since `store.getTaskAliasGroup('sleep_on_time')` already returns `['sleep_on_time', 'night_bedtime', 'wp_bedtime', 'bedtime_story', 'sleep']`, checking `isTaskPendingApproval('sleep_on_time', heroId)` will continue to protect against duplicate completions, while `scratch/verify_routine_approvals_pipeline.mjs` test #47 (which explicitly looks for `taskId === 'bedtime_story'`) will pass 100%!
   - In `rejectParentRequest` in `src/state/store.js`, ensure that when clawing back tokens/xp/sparks on parent denial, if `this.state.selectedHero && this.state.selectedHero.id === req.kidId`, any mirrored entry in `this.state.heroes` is kept in sync natively, eliminating any need for external monkey patches.
2. `src/components/BedtimeStoryStage3D.js`:
   - Remove lines 56–83 where `store.rejectParentRequest` was monkey-patched upon import. The 3D presentation component must not mutate or monkey-patch store methods.
3. Test & Verification:
   - Run `node scratch/verify_routine_approvals_pipeline.mjs` and verify it passes 100% (28/28 passed).
   - Run `node scratch/verify_bedtime_storybook.mjs` and verify 100% pass (131/131 passed).
   - Run `node scratch/run_all_tests.js` and verify that ALL test suites pass (exit code 0).
   - Run `npm run build` and verify clean exit code 0.
Write your detailed report and test results to `handoff.md` and notify parent when complete.
