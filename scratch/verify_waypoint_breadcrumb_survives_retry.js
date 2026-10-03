import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { renderBattleView, attachBattleListeners, startBattle, quitBattle } from '../src/views/BattleView.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

// A prior fix (commit 4def429) made quitBattle()/abandonBattleIfRunning()
// clear activeWaypointChoreKey so it doesn't leak into an unrelated later
// battle. But a code review found that fix was too eager: quitting MID-BATTLE
// opens a defeat modal with a "Try Again" option that re-launches the SAME
// waypoint battle via startBattle() -- if the breadcrumb was already wiped,
// the retried battle's eventual victory falls back to the wall-clock guess
// and mislabels it, reproducing the exact bug the breadcrumb exists to fix.

store.initColosseumBattle('sugar_bandit', 120);
store.state.activeWaypointChoreKey = 'brush_teeth_am';

console.log('\n--- 1. Quitting mid-battle opens the defeat modal WITHOUT clearing the breadcrumb ---');
startBattle();
quitBattle(); // mid-battle (secondsRemaining > 0) -> opens defeat modal, does not navigate
assert(store.state.activeWaypointChoreKey === 'brush_teeth_am', 'Breadcrumb survives the initial quit-into-defeat-modal step');
assert(store.getBossColosseumState().isDefeatModalOpen === true, 'Defeat modal is actually open (sanity check on test setup)');

console.log('\n--- 2. Tapping "Try Again" re-launches the battle with the breadcrumb intact ---');
document.body.innerHTML = renderBattleView();
attachBattleListeners();
const retryBtn = document.getElementById('colosseum-defeat-retry-btn');
assert(!!retryBtn, 'Defeat modal retry button is present in the rendered HTML');
retryBtn.click();
assert(store.state.activeWaypointChoreKey === 'brush_teeth_am', 'Breadcrumb still intact after Try Again re-launches the battle');

console.log('\n--- 3. Tapping "Give Up" instead DOES clear the breadcrumb ---');
quitBattle(); // mid-battle again -> defeat modal again
document.body.innerHTML = renderBattleView();
attachBattleListeners();
const giveUpBtn = document.getElementById('colosseum-defeat-return-btn');
assert(!!giveUpBtn, 'Defeat modal "Give Up" button is present in the rendered HTML');
giveUpBtn.click();
assert(store.state.activeWaypointChoreKey === null, 'Breadcrumb is cleared once the kid actually gives up (no more retry coming)');

console.log('\n--- 4. A genuine non-mid-battle quit (no defeat modal) still clears it ---');
// isBattleRunning is already false here (no startBattle() call since the
// Give Up step above), so quitBattle() takes the non-mid-battle branch.
store.state.activeWaypointChoreKey = 'brush_teeth_pm';
quitBattle();
assert(store.state.activeWaypointChoreKey === null, 'A quit with no mid-battle defeat modal still clears the breadcrumb');

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
