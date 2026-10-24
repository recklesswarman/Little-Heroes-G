# Handoff Report: 3D Stage & Currency Explorer (Explorer 3)

## 1. Observation
1. **3D Stage Presence**:
   - `src/components/BedtimeStoryStage3D.js` does not exist in the codebase (`find_by_name` on `*Bedtime*` returned only `src/views/BedtimeStoryView.js`).
   - `src/views/BedtimeStoryView.js` (lines 450–477) currently mounts `#interactive-illustration-container` with static/procedural SVG markup (`currentAct.svgArt`).
   - Existing 3D architectures in repo:
     - `src/components/WorkoutHero3DStage.js` (lines 1–670): Pure WebGL stage using custom shaders (`VS_SOURCE`, `FS_SOURCE`), matrices (`mat4Perspective`, `mat4LookAt`, `mat4Multiply`), and `avatarSkeletalRig.js` forward-kinematics `BoneNode` rig, with `webglcontextlost` hot-swap fallback to 2D canvas.
     - `src/services/avatarSkeletalRig.js` (lines 684–998): Articulated Toddler Avatar bone hierarchy (`root -> pelvis -> spine -> chest -> neck -> head -> shoulders -> arms -> forearms -> hands -> hips -> thighs -> calves -> sneakers -> cape`).
     - `src/data/petsData.js` (lines 24–30, 32–750): Defines 24 pets across 5 archetypes: `dino` (8), `mystic` (5), `beast` (6), `aquatic` (3), `mech` (2).
     - `src/audio/sfx.js` (lines 1782–1810): Contains `Sound.playBedtimeChime` playing pentatonic frequencies `[523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]`.
2. **Store & Currency Lifecycle**:
   - In `src/state/store.js` (lines 9420–9523), `completeBedtimeStory` hardcodes reward numbers:
     ```javascript
     const coinsAwarded = 30;
     const sparksAwarded = 15;
     const xpAwarded = 20;
     const pendingPoints = Math.round(coinsAwarded / 2);
     ```
   - In `src/state/store.js` (lines 9429–9432), tokens, XP, and sparks are incremented unconditionally before checking completion logs:
     ```javascript
     hero.coins = (hero.coins || 0) + coinsAwarded;
     hero.xp = (hero.xp || 0) + xpAwarded;
     this.addPetSparks(hero.activePetId, sparksAwarded, hero.id);
     ```
   - In `src/state/store.js`, `completeBedtimeStory` never checks `this.isTaskPendingApproval('sleep_on_time', hero.id)`.
   - In `src/state/store.js` (lines 1914–1929), `getWaypointRewards(waypointId)` dynamically calculates parent-configured rewards for waypoints (`wp_bedtime` maps to `sleep_on_time`).
   - In `src/state/store.js` (lines 5478–5544), `rejectParentRequest(reqId)` correctly claws back auto-issued rewards when `req.tokensAwarded`, `req.xpAwarded`, and `req.sparksAwarded` are present, clamping balances at floor 0.
   - In `src/state/store.js` (lines 9144–9220), `completeWaypointChore` demonstrates the gold standard pattern: checks `isTaskPendingApproval`, queries `getWaypointRewards`, issues immediate tokens/XP/sparks, queues Gold Points in `pendingApprovals` with full delta schema, and syncs 1:1 with quest aliases.
3. **Test Infrastructure**:
   - `scratch/run_all_tests.js` (lines 1–90) runs test scripts sequentially using `child_process.spawnSync('node', [file])`.
   - Existing test `scratch/test_bedtime_storybook.cjs` ran and passed with 46 passed assertions, 0 failed.

## 2. Logic Chain
1. From Observation 1, the app currently lacks the 3D diorama stage for bedtime stories, but has a proven WebGL/rig pattern in `WorkoutHero3DStage.js` and `avatarSkeletalRig.js`. Therefore, `src/components/BedtimeStoryStage3D.js` should be built following this established architectural pattern: custom WebGL shaders, perspective camera, Explorer lighting, forward-kinematics toddler avatar rig with magic item hand socket, procedural 3D pet models matching the 24 archetypes in `petsData.js`, dynamic scene synthesis driven by `sceneDescriptor`, interactive raycast constellation chimes, and automatic fallback to 2D Canvas/SVG if WebGL fails.
2. From Observation 2, `store.completeBedtimeStory` violates `.agents/rules/task_and_currency_lifecycle_rules.md` in three ways: it uses hardcoded rewards instead of parent-configured rewards from `getWaypointRewards('wp_bedtime')`, it does not check `isTaskPendingApproval`, allowing children to duplicate-mint tokens/sparks/XP while an approval is pending, and it assumes Rex in the action log.
3. Therefore, `store.completeBedtimeStory` must be updated to mirror `completeWaypointChore`: check `isTaskPendingApproval('sleep_on_time', heroId)`, read `getWaypointRewards('wp_bedtime')`, auto-issue tokens/XP/sparks, queue Gold Points in `pendingApprovals` with the full delta schema, and update 1:1 aliases in `habitIslands` and `taskForest`.
4. From Observation 3, adding `scratch/verify_bedtime_storybook.mjs` to `scratch/run_all_tests.js` will provide end-to-end regression testing for the 3D stage, scene descriptors, 24 pet archetypes, breathing pacer, chimes, dynamic rewards, one-completion invariant, and parent approval/denial clawback.

## 3. Caveats
- No WebGL hardware acceleration in CI / headless environments: WebGL context creation may fail in headless test environments, so `BedtimeStoryStage3D` must feature 100% testable mock/fallback compatibility (both WebGL rendering and procedural 2D canvas fallback must execute safely in headless Node test runs).
- Voice TTS network calls: During tests, ElevenLabs and Firebase AI Logic APIs must gracefully fall back to local mocks without hanging or failing tests.

## 4. Conclusion
The 3D Stage & Currency Explorer survey is complete. The target architecture is fully specified in `analysis.md`:
1. Build `src/components/BedtimeStoryStage3D.js` with dynamic `sceneDescriptor` scene synthesis, articulated toddler avatar + 24 pet archetypes, chapter choreography (Ch 1 lantern/fireflies, Ch 2 gentle obstacle/particle burst, Ch 3 starlight slumber/4s-4s harmonic breathing pacer), interactive raycast constellations with pentatonic chimes, 2D fallback, and strict Explorer Palette.
2. Refactor `store.completeBedtimeStory` in `src/state/store.js` to dynamically inherit `getWaypointRewards('wp_bedtime')`, enforce the one-completion pending approval invariant, auto-issue tokens/XP/sparks, queue Gold Points in `pendingApprovals` with full delta metadata, and cleanly support parent approval and denial clawback.
3. Author `scratch/verify_bedtime_storybook.mjs` with 12 validation sections and register it in `scratch/run_all_tests.js`.

## 5. Verification Method
1. Run existing test suite to ensure no regressions:
   `node scratch/test_bedtime_storybook.cjs`
2. Run full regression suite:
   `node scratch/run_all_tests.js`
3. Inspect `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_stage_3\analysis.md` for full implementation specifications.
