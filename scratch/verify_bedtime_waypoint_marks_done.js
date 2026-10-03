import './setup_mock_env.js';
import { store } from '../src/state/store.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

// The final Today's Path waypoint (wp_bedtime, choreKey 'sleep_on_time')
// only offers a "READ BEDTIME STORY" button, which calls
// completeBedtimeStory(). That function awards its own coins/xp but used to
// never record a taskCompletionLogs entry, so isWaypointDone() (which checks
// getTaskCompletionsToday('sleep_on_time', heroId)) could never see it as
// done -- the Next Hero Stop banner kept showing it as the unfinished stop
// forever, even right after a real completion.

store.state.heroes = [{ id: 'hero_1', name: 'Test Hero', coins: 0, points: 0, xp: 0, activePetId: '2' }];
store.state.selectedHero = store.state.heroes[0];

console.log('\n--- 1. Before completing the story, the waypoint is not marked done ---');
assert(store.getTaskCompletionsToday('sleep_on_time', 'hero_1').length === 0, 'No sleep_on_time completion exists yet today');

console.log('\n--- 2. Completing the bedtime story records a sleep_on_time completion ---');
store.completeBedtimeStory({ title: 'The Brave Little Dragon', moralId: 'brave_dark' });
const completions = store.getTaskCompletionsToday('sleep_on_time', 'hero_1');
assert(completions.length === 1, `Exactly one sleep_on_time completion now exists today (got ${completions.length})`);
assert(completions[0].coinsAwarded === 0, 'The tracking-only log entry does not award a second payout of coins (completeBedtimeStory already paid out separately)');
assert(store.state.heroes[0].coins === 30, 'The hero still received the real bedtime-story coin reward exactly once (30, from completeBedtimeStory itself)');

console.log('\n--- 3. Completing it again the same day does not create a duplicate log entry ---');
store.completeBedtimeStory({ title: 'Another Story', moralId: 'brave_dark' });
assert(store.getTaskCompletionsToday('sleep_on_time', 'hero_1').length === 1, 'Still exactly one completion logged today, not two');

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
