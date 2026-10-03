import './setup_mock_env.js';
import { store } from '../src/state/store.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

// Every mutator that calls saveState(true) used to also call this.notify()
// again immediately after -- but saveState() itself already calls notify()
// at its own end, so every single user action was triggering TWO full
// innerHTML re-renders (main.js's renderApp()) instead of one, doubling
// render cost, state serialization, and cloud-push work app-wide.
let notifyCount = 0;
const unsubscribe = store.subscribe(() => { notifyCount++; });

console.log('\n--- 1. A representative mutator notifies exactly once ---');
notifyCount = 0;
store.setActiveWorkoutId('workout_1');
assert(notifyCount === 1, `setActiveWorkoutId() triggers exactly 1 notify (got ${notifyCount})`);

console.log('\n--- 2. Another mutator from a different part of the file ---');
store.state.heroes = [{ id: 'h1', name: 'Test Hero', coins: 0 }];
store.state.selectedHero = store.state.heroes[0];
notifyCount = 0;
store.setHygieneReminder('h1', 'floss', true);
assert(notifyCount === 1, `setHygieneReminder() triggers exactly 1 notify (got ${notifyCount})`);

unsubscribe();

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
