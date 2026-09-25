import './setup_mock_env.js';
import { startBattle } from '../src/views/BattleView.js';
import { store } from '../src/state/store.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

// Capture every setInterval BattleView.js registers so we can drive the real
// 1Hz countdown callback synchronously instead of waiting 120 real seconds --
// this checks whether the timer completes correctly while the player stays
// on the Battle screen the whole time (a different question from whether
// navigating away leaves it orphaned, which verify_battle_stops_on_navigation.js
// covers).
const registered = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, delay) => {
  registered.push({ fn, delay });
  return realSetInterval(() => {}, 1 << 30); // inert real handle so nothing double-fires
};

store.initColosseumBattle('sugar_bandit', 120);
startBattle();
global.setInterval = realSetInterval;

const oneSecondIntervals = registered.filter(r => r.delay === 1000);
assert(oneSecondIntervals.length === 2, `Captured both 1Hz intervals (autoAssist + battle countdown) - got ${oneSecondIntervals.length}`);
const battleTick = oneSecondIntervals[oneSecondIntervals.length - 1].fn;

let threw = null;
try {
  for (let i = 0; i < 120; i++) {
    battleTick();
  }
} catch (e) {
  threw = e;
}

assert(!threw, `120 ticks of the real countdown callback ran with no exception${threw ? ' - threw: ' + (threw.stack || threw) : ''}`);

const col = store.getBossColosseumState();
assert(col.isVictoryModalOpen === true, 'Victory modal opens once the on-screen countdown reaches 0');
assert(col.hasAwardedVictory === true, 'Victory is awarded once the on-screen countdown reaches 0');

const req = store.state.pendingApprovals.find(r => r.taskId === 'morning_brush' || r.taskId === 'bedtime_brush');
assert(!!req, 'Completing the battle on-screen still queues the parent-approval Gold Points request');

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
