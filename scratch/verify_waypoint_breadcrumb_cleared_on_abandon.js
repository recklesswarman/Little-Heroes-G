import './setup_mock_env.js';
import { startBattle, quitBattle, abandonBattleIfRunning } from '../src/views/BattleView.js';
import { store } from '../src/state/store.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

// Reproduces the bug a code review found in the "Today's Path getting stuck"
// fix: a waypoint-launched battle stamps store.state.activeWaypointChoreKey
// so completeToothbrushBattle() knows which chore it's for. If the kid
// quits or navigates away before finishing, nothing used to clear that
// breadcrumb, so it silently survived to mislabel the next, unrelated
// toothbrush battle's morning/evening classification.

console.log('\n--- 1. abandonBattleIfRunning() clears a stale waypoint breadcrumb ---');

store.state.activeWaypointChoreKey = 'brush_teeth_am';
store.initColosseumBattle('sugar_bandit', 120);
startBattle();
abandonBattleIfRunning();

assert(store.state.activeWaypointChoreKey === null, 'Navigating away mid-battle clears activeWaypointChoreKey');

console.log('\n--- 2. quitBattle() clears it on the mid-battle (defeat modal) path ---');

store.state.activeWaypointChoreKey = 'brush_teeth_pm';
store.initColosseumBattle('sugar_bandit', 120);
startBattle();
quitBattle();

assert(store.state.activeWaypointChoreKey === null, 'Tapping Quit mid-battle clears activeWaypointChoreKey');

console.log('\n--- 3. quitBattle() clears it even when not mid-battle ---');

store.state.activeWaypointChoreKey = 'brush_teeth_am';
// No startBattle() this time -- isBattleRunning is false, so quitBattle()
// takes the "not mid-battle" navigate-away branch instead of the defeat
// modal branch. The breadcrumb should still be cleared either way.
quitBattle();

assert(store.state.activeWaypointChoreKey === null, 'quitBattle() clears activeWaypointChoreKey on the non-mid-battle branch too');

console.log('\n--- 4. Idempotent: no breadcrumb set is a safe no-op ---');

store.state.activeWaypointChoreKey = null;
let threw = false;
try {
  abandonBattleIfRunning();
  quitBattle();
} catch (e) {
  threw = true;
}
assert(!threw, 'Calling both cleanup paths with no breadcrumb set does not throw');
assert(store.state.activeWaypointChoreKey === null, 'activeWaypointChoreKey stays null');

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
