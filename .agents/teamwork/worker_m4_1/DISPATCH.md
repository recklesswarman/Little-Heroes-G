## 2026-10-16T01:36:06Z
You are Worker 4 (worker_m4_1) for Milestone M4 (Store Task/Habit & Currency Lifecycle).
Working directory: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m4_1
Authoritative User Request: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (under ## 2026-10-16T01:20:55Z).
Project Specification: c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_3\PROJECT.md.
Survey Analysis: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_stage_3\analysis.md.
App Rules: `.agents/rules/task_and_currency_lifecycle_rules.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusive Write Ownership:
- `src/state/store.js`

Your Mission:
1. Implement `buildChildStoryContext(heroId)` on the store:
   - Queries child profile (`name`, `heroId`, age tier `'3-4'` / `'5-6'` / `'7+'`, level, title).
   - Queries today's completed chores/habits for `heroId` via `getTaskCompletionsToday(heroId)`.
   - Queries active pet companion details from `PETS_DATABASE` (`name`, `title`, `element`, `archetype`, `backstory`).
   - Queries equipped hero gear (`getEquippedHeroWeapon()`).
   - Includes parent bedtime wish and story preferences.
2. Refactor `store.completeBedtimeStory(storyData)`:
   - Dynamically calculate rewards from parent-configured settings using `getWaypointRewards('wp_bedtime')` (`sleep_on_time`), replacing hardcoded coins/sparks/xp.
   - Enforce the **one completion payout at a time** invariant: call `isTaskPendingApproval('sleep_on_time', hero.id)`. If true, return `{ success: false, message: 'Bedtime story completion is already pending parent approval.' }`.
   - Auto-issue Tokens (coins), Hero XP, and Pet Sparks immediately upon valid submission.
   - Gold Points are NEVER auto-issued. Queue Gold Points in `pendingApprovals` with full delta schema:
     `{ id, logId, kidId: hero.id, kidName: hero.name, type: 'task_point_approval', taskId: 'sleep_on_time', taskTitle: 'Sleep on Time', zone: "Today's Path", tokensAwarded, xpAwarded, sparksAwarded, pendingPoints, timestamp, status: 'pending' }`.
   - Ensure clean clawback on parent denial: verify that `rejectParentRequest` (lines 5478-5544) deducts the exact `tokensAwarded`, `xpAwarded`, and `sparksAwarded` clamped at floor 0.
3. Anti-Repetition Story Memory:
   - In `hero.bedtimeHistory`, track the last 25 story records containing `{ seed, archetype, title, chapterOpenings, timestamp }` per child (`heroId`).
4. Sibling Bookshelf Isolation:
   - Update `getBedtimeStoryLibrary(heroId)` and `saveBedtimeStory(story, heroId)` so saved bedtime stories are strictly scoped per child account (`heroId`) with instant Firestore sync.

Test and verify:
Run `node scratch/test_bedtime_storybook.cjs` and verify clean execution.
Write your detailed report and test results to `handoff.md` and notify parent when complete.
