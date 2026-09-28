import './setup_mock_env.js';
import { startBattle } from '../src/views/BattleView.js';
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

console.log('\n--- 3. Floss reminder gates entering the battle, once per day ---');

store.state.hygieneReminders = {};
store.state.activeHygieneReminder = null;
store.state.activeView = 'dashboard';

assert(store.shouldShowHygieneReminder('kid_easy', 'floss') === false, 'No floss reminder pending before the parent sets one');

store.setHygieneReminder('kid_easy', 'floss', true);
assert(store.isHygieneReminderActive('kid_easy', 'floss') === true, 'Parent turning on the floss reminder makes it active for today');
assert(store.shouldShowHygieneReminder('kid_easy', 'floss') === true, 'It should be shown since the kid has not acknowledged it yet today');

store.state.selectedHero = kidEasy;
store.openHygieneReminder('floss', { navTo: 'ar_battle' });
assert(store.getState().activeHygieneReminder?.type === 'floss', 'openHygieneReminder puts a floss prompt on screen');
assert(store.getState().activeView === 'dashboard', 'Navigation to the battle is held back while the floss prompt is showing');

store.acknowledgeActiveHygieneReminder();
assert(store.getState().activeHygieneReminder === null, 'Acknowledging clears the on-screen prompt');
assert(store.getState().activeView === 'ar_battle', 'Acknowledging the floss reminder then continues into the AR battle');
assert(store.shouldShowHygieneReminder('kid_easy', 'floss') === false, 'The same kid is not nagged again later the same day');
assert(store.isHygieneReminderActive('kid_easy', 'floss') === true, "The parent's toggle itself stays on (still reflects as active in the Parent Panel)");

console.log('\n--- 4. Mouthwash reminder fires after victory and defers the reward credit ---');

store.state.hygieneReminders = {};
store.state.activeHygieneReminder = null;
store.state.selectedHero = kidHard;
store.setHygieneReminder('kid_hard', 'mouthwash', true);

store.setSelectedBossId('sugar_bandit');
store.initColosseumBattle('sugar_bandit', 60);
const battleTick = captureBattleTick();
for (let i = 0; i < 60; i++) battleTick();

const colAfterTicks = store.getBossColosseumState();
assert(store.getState().activeHygieneReminder?.type === 'mouthwash', 'Battle completion opens the mouthwash reminder instead of crediting the win immediately');
assert(colAfterTicks.hasAwardedVictory !== true, 'Coins/XP/badges are NOT awarded yet while the mouthwash reminder is on screen');

store.acknowledgeActiveHygieneReminder();
assert(store.getState().activeHygieneReminder === null, 'Acknowledging the mouthwash reminder clears the prompt');
assert(store.getBossColosseumState().hasAwardedVictory === true, 'Victory is credited immediately after the mouthwash reminder is dismissed');
assert(store.shouldShowHygieneReminder('kid_hard', 'mouthwash') === false, 'The mouthwash reminder will not re-fire again for this kid later today');

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
