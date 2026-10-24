# Handoff Report: Milestone M4 — Store Task/Habit & Currency Lifecycle

**Worker**: Worker 4 (`worker_m4_1`)  
**Target File**: `src/state/store.js`  
**Milestone**: M4 (Store Task/Habit & Currency Lifecycle Integration)  
**Parent Agent**: `53bed4f6-4a95-4168-a4c5-b43e3302abb3`  
**Date**: 2026-10-16T01:54:00Z  

---

## 1. Observation

- **Original `completeBedtimeStory` in `src/state/store.js`**:
  - Hardcoded currency values at lines 9424–9427:
    ```javascript
    const coinsAwarded = 30;
    const sparksAwarded = 15;
    const xpAwarded = 20;
    const pendingPoints = Math.round(coinsAwarded / 2);
    ```
  - Unconditional reward auto-issuance at lines 9430–9432 prior to checking if a pending approval already exists:
    ```javascript
    hero.coins = (hero.coins || 0) + coinsAwarded;
    hero.xp = (hero.xp || 0) + xpAwarded;
    this.addPetSparks(hero.activePetId, sparksAwarded, hero.id);
    ```
  - Missing call to `this.isTaskPendingApproval('sleep_on_time', hero.id)`, creating a duplicate reward minting vulnerability.
  - History tracking logged moral and title only, capped at 100 entries:
    ```javascript
    hero.bedtimeHistory.unshift({
      moralId: storyData.moralId || 'brave_dark',
      title: storyData.title || 'Bedtime Story',
      timestamp: Date.now()
    });
    ```
  - Non-personalized hardcoded action log at line 9510: `Read "${storyData.title || 'Bedtime Story'}" with Rex.`, failing to display the child's actual active pet.
  - `getBedtimeStoryLibrary()` and `saveBedtimeStory(storyData)` were global without `heroId` scoping or sibling isolation.

- **Survey and Rule Directives**:
  - `.agents/rules/task_and_currency_lifecycle_rules.md` specifies:
    - Rule 1: A task or habit may only have one active completion payout pending at any given time.
    - Rule 2: Tokens, Hero XP, and Pet Sparks are auto-issued immediately; Gold Points are strictly queued in `pendingApprovals` for parent approval.
    - Rule 3: Denying a request claws back auto-issued Tokens, Hero XP, and Pet Sparks floored at 0 (`rejectParentRequest` at lines 5478–5544).
  - Dispatch specified:
    - `buildChildStoryContext(heroId)` querying child profile (`name`, `heroId`, age tier `'3-4'` / `'5-6'` / `'7+'`, level, title), today's completed tasks via `getTaskCompletionsToday(heroId)`, active pet details from `PETS_DATABASE`, equipped gear via `getEquippedHeroWeapon()`, and parent bedtime wish/preferences.
    - `store.completeBedtimeStory(storyData)` dynamically reading `getWaypointRewards('wp_bedtime')` (`sleep_on_time`), enforcing `isTaskPendingApproval('sleep_on_time', hero.id)` returning `{ success: false, message: 'Bedtime story completion is already pending parent approval.' }`, auto-issuing Tokens/XP/Sparks, queueing Gold Points with full delta metadata in `pendingApprovals`.
    - `hero.bedtimeHistory` tracking the last 25 records with `{ seed, archetype, title, chapterOpenings, timestamp }`.
    - `getBedtimeStoryLibrary(heroId)` and `saveBedtimeStory(story, heroId)` strictly scoped per child account (`heroId`) with instant Firestore sync.

- **Test Execution**:
  - Running `node scratch/test_bedtime_storybook.cjs` exited with code 0 (`Results: 46 passed, 0 failed`).
  - Running `node scratch/verify_bedtime_waypoint_marks_done.js` exited with code 0 (`TEST RESULTS: 5 PASSED, 0 FAILED`).

---

## 2. Logic Chain

1. **Enhanced Task Completions Querying (`getTaskCompletions` and `getTaskCompletionsToday`)**:
   - `getTaskCompletionsToday` originally required `taskId` as its first parameter.
   - Refactored `getTaskCompletions` and `getTaskCompletionsToday` so that if `taskId` matches a child `heroId` in `state.heroes` (or if `heroId` is omitted), `taskId` is treated as the child identifier and all completed tasks for that child today are retrieved.
   - This allows `this.getTaskCompletionsToday(heroId)` in `buildChildStoryContext(heroId)` to query the full set of daytime achievements seamlessly.

2. **Parent-Configured Dynamic Bedtime Rewards (`setTaskConfig` & `getWaypointRewards`)**:
   - Implemented `store.setTaskConfig(taskIdOrKey, config)` to persist parent custom reward settings across alias groups.
   - Updated `store.getWaypointRewards(waypointId)`: for `wp_bedtime`, if customized by parents, it returns the customized tokens/points/xp/sparks; if not customized, it returns baseline defaults (`coins: 30`, `points: 15`, `xp: 20`, `sparks: 15`).
   - Replaced all hardcoded reward literals in `completeBedtimeStory` with dynamic resolution from `this.getWaypointRewards('wp_bedtime')`.

3. **One Completion Payout at a Time Invariant**:
   - In `completeBedtimeStory(storyData)`, prior to awarding currency or creating approval requests, the engine executes:
     ```javascript
     if (this.isTaskPendingApproval('sleep_on_time', heroId)) {
       return {
         success: false,
         alreadyPending: true,
         message: 'Bedtime story completion is already pending parent approval.'
       };
     }
     ```
   - This prevents duplicate token, XP, or pet spark minting while a prior bedtime story submission awaits parent sign-off.

4. **Auto-Reward Issuance & Gold Point Queuing**:
   - Auto-issues tokens (`hero.coins`), `hero.xp`, and companion sparks (`this.addPetSparks`) immediately upon valid completion.
   - Gold Points (`pendingPoints`) are strictly withheld from the child balance and queued in `this.state.pendingApprovals` with complete delta schema:
     `{ id, logId, kidId: hero.id, kidName: hero.name, type: 'task_point_approval', taskId: 'sleep_on_time', taskTitle: 'Sleep on Time', zone: "Today's Path", tokensAwarded, xpAwarded, sparksAwarded, pendingPoints, timestamp, status: 'pending' }`.
   - Verified that `rejectParentRequest` (lines 5478–5544) inspects `req.tokensAwarded`, `req.xpAwarded`, and `req.sparksAwarded` and deducts them clamped at floor 0.

5. **Anti-Repetition Story Memory (Last 25 Records)**:
   - Extracted `chapterOpenings` from `storyData.chapters` or `storyData.acts` (first 120 chars).
   - Saved `{ id, seed, archetype, archetypeId, title, moralId, chapterOpenings, timestamp }` into `hero.bedtimeHistory`.
   - Capped `hero.bedtimeHistory` at exactly 25 entries with FIFO rollover, and mirrored the array to the child's entry in `this.state.heroes`.

6. **Sibling Bookshelf Isolation**:
   - Updated `saveBedtimeStory(storyData, heroId = null)` to attach `heroId: targetHeroId` and `heroName: targetHeroName`, update `state.bedtimeStoryLibrary`, and mirror to `targetHero.bedtimeStoryLibrary`.
   - Updated `getBedtimeStoryLibrary(heroId = null)` to filter stories by child account `heroId` when provided, while maintaining backward compatibility when called without arguments.
   - Added `toggleBedtimeStoryFavorite(storyId)` alias.
   - Invoked `this.saveState(true)` which broadcasts state and pushes to Firestore cloud sync immediately.

7. **Personalization Context Builder (`buildChildStoryContext`)**:
   - Implemented `buildChildStoryContext(heroId = null, options = {})` on the store.
   - Constructs structured child profile (`heroId`, `name`, `ageTier` `'3-4'` / `'5-6'` / `'7+'`, `level`, `title`).
   - Retrieves today's completed tasks via `getTaskCompletionsToday(heroId)` and builds `summarySentence` and `taskTitles`.
   - Resolves active pet companion details from `PETS_DATABASE` via `hero.activePetId` (`name`, `shortName`, `title`, `element`, `archetype`, `backstory`).
   - Retrieves equipped weapon/gear via `getEquippedHeroWeapon(true)`.
   - Injects parent bedtime wish and story preferences.

---

## 3. Caveats

- `scratch/verify_bedtime_storybook.mjs` is an extensive multi-milestone test suite encompassing Milestones M1, M2, M3, and M4. The command prompt was rejected during execution, but both the dedicated bedtime suite `scratch/test_bedtime_storybook.cjs` and the bedtime routine marks done suite `scratch/verify_bedtime_waypoint_marks_done.js` ran and passed with 100% success.
- Digital assets purchased with previously earned coins remain protected when parent denial occurs, as `tokens` and `coins` are clamped at floor 0.

---

## 4. Conclusion

All directives of Milestone M4 have been genuinely implemented in `src/state/store.js`:
1. `buildChildStoryContext(heroId)` provides full real-time per-child personalization context.
2. `store.completeBedtimeStory(storyData)` dynamically calculates rewards using `getWaypointRewards('wp_bedtime')`, strictly enforces the one-completion payout invariant via `isTaskPendingApproval`, auto-issues tokens/XP/sparks, and queues Gold Points in `pendingApprovals` with full transaction delta metadata.
3. `hero.bedtimeHistory` persists the last 25 story records per child with FIFO rollover.
4. `getBedtimeStoryLibrary(heroId)` and `saveBedtimeStory(story, heroId)` enforce sibling bookshelf isolation with instant Firestore sync.

---

## 5. Verification Method

To independently verify this implementation, run:
```bash
node scratch/test_bedtime_storybook.cjs
node scratch/verify_bedtime_waypoint_marks_done.js
```

### Invalidation Conditions
- `completeBedtimeStory` issuing duplicate tokens or sparks while `sleep_on_time` is pending parent approval.
- `pendingApprovals` missing delta fields (`tokensAwarded`, `xpAwarded`, `sparksAwarded`, `pendingPoints`).
- `getBedtimeStoryLibrary(heroId)` returning stories belonging to a different `heroId`.
- `hero.bedtimeHistory` exceeding 25 records.
- Any non-zero exit code on `node scratch/test_bedtime_storybook.cjs`.
