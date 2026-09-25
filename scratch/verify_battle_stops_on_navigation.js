import './setup_mock_env.js';
import { startBattle, abandonBattleIfRunning, attachBattleListeners } from '../src/views/BattleView.js';
import { store } from '../src/state/store.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

// Track every setInterval this module creates so we can prove they're all
// cleared -- this is exactly the leak a player hits by navigating away from
// the Battle view mid-fight without tapping Quit: battleTimer/bombTimer/
// autoAssistInterval and the rhythm music are module-level state with no
// view lifecycle, so nothing stopped them.
const activeIntervals = new Set();
const realSetInterval = global.setInterval;
const realClearInterval = global.clearInterval;
global.setInterval = (...args) => {
  const id = realSetInterval(...args);
  activeIntervals.add(id);
  return id;
};
global.clearInterval = (id) => {
  activeIntervals.delete(id);
  return realClearInterval(id);
};

store.initColosseumBattle('sugar_bandit', 120);
startBattle();

assert(activeIntervals.size >= 3, `startBattle() created running intervals (battleTimer/bombTimer/autoAssistInterval) - got ${activeIntervals.size}`);

// Simulate what used to happen: the player taps the bottom nav / a quest map
// tile / anything other than the Quit button, navigating away while the
// battle is still running.
abandonBattleIfRunning();

assert(activeIntervals.size === 0, `abandonBattleIfRunning() cleared every running interval - got ${activeIntervals.size} still active`);

// Calling it again (e.g. the player bounces through two other screens) must
// be a safe no-op, not throw or double-clear.
let threw = false;
try { abandonBattleIfRunning(); } catch (e) { threw = true; }
assert(!threw, 'abandonBattleIfRunning() is idempotent when called again with no battle running');

// Re-entering the Battle view afterwards must start a *fresh* battle rather
// than sitting dead with no ticking timer.
activeIntervals.clear();
attachBattleListeners();
assert(activeIntervals.size >= 3, `Re-entering the Battle view after an abandoned fight auto-starts a new battle - got ${activeIntervals.size} intervals`);

abandonBattleIfRunning();
global.setInterval = realSetInterval;
global.clearInterval = realClearInterval;

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
