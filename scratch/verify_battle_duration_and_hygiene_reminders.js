import './setup_mock_env.js';
import { startBattle, advanceToBrushPhase } from '../src/views/BattleView.js';
import { store } from '../src/state/store.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

// Drive the real 1Hz countdown callback synchronously instead of waiting
// in real time, same technique as verify_battle_timer_completes_on_screen.js.
function captureBattleTick() {
  const registered = [];
  const realSetInterval = global.setInterval;
  global.setInterval = (fn, delay) => {
    registered.push({ fn, delay });
    return realSetInterval(() => {}, 1 << 30);
  };
  startBattle();
  global.setInterval = realSetInterval;
  const oneSecondIntervals = registered.filter(r => r.delay === 1000);
  return oneSecondIntervals[oneSecondIntervals.length - 1].fn;
}

console.log('\n--- 1. Parent-selected duration is authoritative regardless of kid difficulty ---');

const kidEasy = { id: 'kid_easy', name: 'Tot', gameDifficulty: 'easy', coins: 0, equippedGear: {}, inventory: [] };
const kidHard = { id: 'kid_hard', name: 'Big Kid', gameDifficulty: 'hard', coins: 0, equippedGear: {}, inventory: [] };
store.state.heroes = [kidEasy, kidHard];
store.state.parentCustomBosses = [];
store.state.parentSettings.arBattleDuration = 60;

// Daytime test (no floss)
store.state.hygieneReminders = {};
store.state.activeHygieneReminder = null;
store.state.selectedHero = kidEasy;
store.setSelectedBossId('sugar_bandit');
store.initColosseumBattle('sugar_bandit', 60);
startBattle();
assert(store.getBossColosseumState().secondsRemaining === 60, `Easy-tier kid gets the full parent-selected 60s (got ${store.getBossColosseumState().secondsRemaining})`);

store.state.selectedHero = kidHard;
store.setSelectedBossId('sugar_bandit');
store.initColosseumBattle('sugar_bandit', 60);
startBattle();
assert(store.getBossColosseumState().secondsRemaining === 60, `Hard-tier kid also gets exactly 60s, not a scaled-up value (got ${store.getBossColosseumState().secondsRemaining})`);

console.log('\n--- 2. A custom Boss Studio villain does not override the parent duration slider ---');

store.state.parentCustomBosses = [{
  id: 'custom_villain_1',
  name: 'Cavity Goblin',
  battleDurationSec: 180 // parent picked 3 min in the Boss Studio when this was created
}];
store.setSelectedBossId('custom_villain_1');
store.initColosseumBattle('custom_villain_1', 60);
startBattle();
assert(store.getBossColosseumState().secondsRemaining === 60, `Custom boss's own battleDurationSec (180) no longer wins over the Parent Panel's 60s slider (got ${store.getBossColosseumState().secondsRemaining})`);

// Reset back to a preset boss for the rest of the tests below
store.state.parentCustomBosses = [];
store.setSelectedBossId('sugar_bandit');

console.log('\n--- 3. Nighttime 2-Minute Floss Battle phase & early advance to Toothbrush Battle ---');

store.state.hygieneReminders = {};
store.state.activeHygieneReminder = null;
store.state.activeView = 'bedtime_story'; // triggers nighttime battle condition
store.state.selectedHero = kidEasy;

assert(store.isNighttimeToothbrushBattle() === true, 'Bedtime story context registers as nighttime battle');
assert(store.shouldShowHygieneReminder('kid_easy', 'floss') === false, 'No floss reminder pending before the parent sets one');

store.setHygieneReminder('kid_easy', 'floss', true);
assert(store.isHygieneReminderActive('kid_easy', 'floss') === true, 'Parent turning on the floss reminder makes it active for today');
assert(store.shouldShowHygieneReminder('kid_easy', 'floss') === true, 'Floss reminder should show since kid has not acknowledged it yet today');

// Launch battle with floss active at night
startBattle();
assert(store.getBossColosseumState().secondsRemaining === 120, 'Starts with a 2-minute (120s) flossing battle timer');

// Kid / parent can tap "Done Flossing! 🪥" early, transitioning to parent-selected brush duration
advanceToBrushPhase();
assert(store.getBossColosseumState().secondsRemaining === 60, 'Advancing to brush phase loads parent-selected duration (60s)');
assert(store.hasAcknowledgedHygieneReminderToday('kid_easy', 'floss') === true, 'Floss is marked acknowledged for today');
assert(store.shouldShowHygieneReminder('kid_easy', 'floss') === false, 'Floss battle will not re-trigger again today');

console.log('\n--- 4. Toothbrush battle completion immediately submits task for points and shows Mouthwash in modal ---');

store.state.hygieneReminders = {};
store.state.selectedHero = kidHard;
store.state.pendingApprovals = [];
store.state.parentSettings.arBattleDuration = 60;
store.setHygieneReminder('kid_hard', 'mouthwash', true);

store.setSelectedBossId('sugar_bandit');
store.initColosseumBattle('sugar_bandit', 60);

const battleTick = captureBattleTick();
for (let i = 0; i < 60; i++) battleTick();

const colAfterTicks = store.getBossColosseumState();
assert(colAfterTicks.hasAwardedVictory === true, 'Victory is credited immediately upon countdown finish');
assert(colAfterTicks.isVictoryModalOpen === true, 'Victory modal is open');

// Verify task point submission to parent
const pendingTask = store.state.pendingApprovals.find(p => p.type === 'task_point_approval' && p.kidId === 'kid_hard');
assert(pendingTask !== undefined, 'Task point approval request created in pendingApprovals for parent issuance');
assert(pendingTask?.pendingPoints === 15, 'Points set to 15 pending parent approval');

// Verify mouthwash reminder in modal
assert(store.isHygieneReminderActive('kid_hard', 'mouthwash') === true, 'Mouthwash reminder is active for tonight');
assert(store.hasAcknowledgedHygieneReminderToday('kid_hard', 'mouthwash') === false, 'Mouthwash not yet acknowledged');

// Kid taps "I Rinsed! 💧✨"
store.acknowledgeHygieneReminder('kid_hard', 'mouthwash');
assert(store.hasAcknowledgedHygieneReminderToday('kid_hard', 'mouthwash') === true, 'Mouthwash marked acknowledged today after kid clicks rinsed');

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
