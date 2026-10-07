import './setup_mock_env.js';
import { store } from '../src/state/store.js';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

function freshHero() {
  return {
    id: 'hero_1',
    name: 'Test Hero',
    coins: 0,
    points: 0,
    xp: 0,
    activePetId: '1',
    bedtimeHistory: [],
    unlockedThemes: ['theme_dragon_emerald']
  };
}

function resetState() {
  store.state.heroes = [freshHero()];
  store.state.selectedHero = store.state.heroes[0];
  store.state.pendingApprovals = [];
  store.state.taskCompletionLogs = [];
  store.state.worldAdventureMap = store.state.worldAdventureMap || {};
  store.state.worldAdventureMap.discoveredSecrets = store.state.worldAdventureMap.discoveredSecrets || [];
}

function findApproval(taskId) {
  return store.state.pendingApprovals.find(a => a.taskId === taskId);
}

function findLog(taskId) {
  return store.state.taskCompletionLogs.find(l => l.taskId === taskId);
}

// --- 1. completeWaypointChore() ---
console.log('\n--- 1. completeWaypointChore() queues points for approval instead of self-granting ---');
resetState();
const beforeWaypointPoints = store.state.selectedHero.points;
const waypointResult = store.completeWaypointChore('wp_wake_up');
assert(waypointResult.success, 'completeWaypointChore() reports success');
assert(store.state.selectedHero.points === beforeWaypointPoints, 'hero.points is NOT incremented synchronously by the call');
assert(store.state.selectedHero.coins === 15, 'hero.coins IS auto-issued immediately (tokens auto-issue)');
const waypointApproval = findApproval('make_bed');
assert(Boolean(waypointApproval), 'A pendingApprovals entry was created for the waypoint chore');
assert(waypointApproval && waypointApproval.type === 'task_point_approval', 'Approval entry has type "task_point_approval"');
assert(waypointApproval && waypointApproval.pendingPoints === 8, `Approval entry has the correct pendingPoints (8, got ${waypointApproval && waypointApproval.pendingPoints})`);
assert(waypointApproval && waypointApproval.status === 'pending', 'Approval entry has status "pending"');
const waypointLog = findLog('make_bed');
assert(Boolean(waypointLog) && waypointLog.status === 'pending', 'Matching taskCompletionLogs entry has status "pending" (not auto_approved)');

if (waypointApproval) {
  store.approveParentRequest(waypointApproval.id);
  assert(store.state.selectedHero.points === beforeWaypointPoints + 8, 'approveParentRequest() credits hero.points by the full pendingPoints amount');
  assert(store.state.pendingApprovals.length === 0, 'Approved request is removed from pendingApprovals');
}

// --- 2. completePajamasTidyStep() ---
console.log('\n--- 2. completePajamasTidyStep() queues points for approval instead of self-granting ---');
resetState();
const beforePajamasPoints = store.state.selectedHero.points;
store.completePajamasTidyStep();
assert(store.state.selectedHero.points === beforePajamasPoints, 'hero.points is NOT incremented synchronously by the call');
assert(store.state.selectedHero.coins === 15, 'hero.coins IS auto-issued immediately');
const pajamasApproval = findApproval('pajamas_tidy');
assert(Boolean(pajamasApproval), 'A pendingApprovals entry was created for the pajamas/tidy step');
assert(pajamasApproval && pajamasApproval.pendingPoints === 8, `Approval entry has the correct pendingPoints (8, got ${pajamasApproval && pajamasApproval.pendingPoints})`);
const pajamasLog = findLog('pajamas_tidy');
assert(Boolean(pajamasLog) && pajamasLog.status === 'pending', 'Matching taskCompletionLogs entry has status "pending"');

if (pajamasApproval) {
  store.approveParentRequest(pajamasApproval.id);
  assert(store.state.selectedHero.points === beforePajamasPoints + 8, 'approveParentRequest() credits hero.points correctly');
}

// --- 3. completeBedtimeStory() ---
console.log('\n--- 3. completeBedtimeStory() queues points for approval instead of self-granting ---');
resetState();
const beforeStoryPoints = store.state.selectedHero.points;
store.completeBedtimeStory({ id: 'story_1', title: 'The Brave Little Dino', moralId: 'brave_dark' });
assert(store.state.selectedHero.points === beforeStoryPoints, 'hero.points is NOT incremented synchronously by the call');
assert(store.state.selectedHero.coins === 30, 'hero.coins IS auto-issued immediately');
const storyApproval = findApproval('bedtime_story');
assert(Boolean(storyApproval), 'A pendingApprovals entry was created for the bedtime story');
assert(storyApproval && storyApproval.pendingPoints === 15, `Approval entry has the correct pendingPoints (15, got ${storyApproval && storyApproval.pendingPoints})`);
const heroesMirror = store.state.heroes.find(h => h.id === store.state.selectedHero.id);
assert(heroesMirror.points === beforeStoryPoints, 'heroes[] mirror does NOT prematurely carry the un-awarded points either');

if (storyApproval) {
  store.approveParentRequest(storyApproval.id);
  assert(store.state.selectedHero.points === beforeStoryPoints + 15, 'approveParentRequest() credits hero.points correctly');
}

// --- 4. completeMovementRoutine() ---
console.log('\n--- 4. completeMovementRoutine() queues points for approval instead of (fake-)self-granting ---');
resetState();
const beforeMovementPoints = store.state.selectedHero.points;
const movementResult = store.completeMovementRoutine('morning_wake_up', 2, 4, 1);
assert(Boolean(movementResult), 'completeMovementRoutine() returns a result');
assert(store.state.selectedHero.points === beforeMovementPoints, 'hero.points is NOT incremented synchronously by the call');
assert(store.state.selectedHero.coins === 40, 'hero.coins IS auto-issued immediately');
const movementApproval = findApproval('morning_wake_up');
assert(Boolean(movementApproval), 'A pendingApprovals entry was created for the movement routine');
assert(movementApproval && movementApproval.pendingPoints === 10, `Approval entry has the correct pendingPoints (10, got ${movementApproval && movementApproval.pendingPoints})`);
const movementLog = findLog('morning_wake_up');
assert(Boolean(movementLog) && movementLog.status === 'pending', 'Matching taskCompletionLogs entry has status "pending" (was falsely "approved" before the fix)');

if (movementApproval) {
  store.approveParentRequest(movementApproval.id);
  assert(store.state.selectedHero.points === beforeMovementPoints + 10, 'approveParentRequest() credits hero.points correctly (previously these points were never credited at all)');
}

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);

process.exit(failed > 0 ? 1 : 0);
