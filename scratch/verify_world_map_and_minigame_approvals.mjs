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
    stars: 0,
    streak: 5,
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
  store.state.worldAdventureMap = undefined;
  store.state.pets = [{ id: '1', name: 'Rex' }];
  store.state.activeExpeditions = [];
  store.state.gameMasteryMap = {};
}

function findApproval(taskId) {
  return store.state.pendingApprovals.find(a => a.taskId === taskId);
}

function findLog(taskId) {
  return store.state.taskCompletionLogs.find(l => l.taskId === taskId);
}

// --- 1. discoverWorldSecret() ---
console.log('\n--- 1. discoverWorldSecret() queues points for approval instead of self-granting ---');
resetState();
const beforeShrinePoints = store.state.selectedHero.points;
const shrineResult = store.discoverWorldSecret('shrine_orchard');
assert(shrineResult.success, 'discoverWorldSecret() reports success');
assert(store.state.selectedHero.points === beforeShrinePoints, 'hero.points is NOT incremented synchronously by the call');
assert(store.state.selectedHero.coins === 35, 'hero.coins IS auto-issued immediately (shrine_orchard rewardCoins)');
const shrineApproval = findApproval('shrine_orchard');
assert(Boolean(shrineApproval), 'A pendingApprovals entry was created for the shrine discovery');
assert(shrineApproval && shrineApproval.type === 'task_point_approval', 'Approval entry has type "task_point_approval"');
assert(shrineApproval && shrineApproval.pendingPoints === 18, `Approval entry has the correct pendingPoints (18, got ${shrineApproval && shrineApproval.pendingPoints})`);
assert(shrineApproval && shrineApproval.status === 'pending', 'Approval entry has status "pending"');
const shrineLog = findLog('shrine_orchard');
assert(Boolean(shrineLog) && shrineLog.status === 'pending', 'Matching taskCompletionLogs entry has status "pending"');

if (shrineApproval) {
  store.approveParentRequest(shrineApproval.id);
  assert(store.state.selectedHero.points === beforeShrinePoints + 18, 'approveParentRequest() credits hero.points by the full pendingPoints amount');
  assert(store.state.pendingApprovals.length === 0, 'Approved request is removed from pendingApprovals');
}

// --- 2. unlockParentWorldChest() ---
console.log('\n--- 2. unlockParentWorldChest() queues points for approval instead of self-granting ---');
resetState();
const beforeChestPoints = store.state.selectedHero.points;
const chestResult = store.unlockParentWorldChest('chest_streak_starter');
assert(chestResult.success, 'unlockParentWorldChest() reports success');
assert(store.state.selectedHero.points === beforeChestPoints, 'hero.points is NOT incremented synchronously by the call');
assert(store.state.selectedHero.coins === 100, 'hero.coins IS auto-issued immediately (default chest rewardCoins)');
const chestApproval = findApproval('chest_streak_starter');
assert(Boolean(chestApproval), 'A pendingApprovals entry was created for the chest unlock');
assert(chestApproval && chestApproval.pendingPoints === 50, `Approval entry has the correct pendingPoints (50, got ${chestApproval && chestApproval.pendingPoints})`);
const chestLog = findLog('chest_streak_starter');
assert(Boolean(chestLog) && chestLog.status === 'pending', 'Matching taskCompletionLogs entry has status "pending"');

if (chestApproval) {
  store.approveParentRequest(chestApproval.id);
  assert(store.state.selectedHero.points === beforeChestPoints + 50, 'approveParentRequest() credits hero.points correctly');
}

// --- 3. interactWithCustomLandmark() ---
console.log('\n--- 3. interactWithCustomLandmark() queues points for approval instead of self-granting ---');
resetState();
const beforeLandmarkPoints = store.state.selectedHero.points;
const landmark = store.addCustomWorldLandmark({ name: 'Test Starlight Fort', rewardCoins: 40, rewardSparks: 15 });
const landmarkResult = store.interactWithCustomLandmark(landmark.id);
assert(landmarkResult.success && !landmarkResult.alreadyClaimed, 'interactWithCustomLandmark() reports a fresh claim');
assert(store.state.selectedHero.points === beforeLandmarkPoints, 'hero.points is NOT incremented synchronously by the call');
assert(store.state.selectedHero.coins === 40, 'hero.coins IS auto-issued immediately');
const landmarkApproval = findApproval(landmark.id);
assert(Boolean(landmarkApproval), 'A pendingApprovals entry was created for the landmark interaction');
assert(landmarkApproval && landmarkApproval.pendingPoints === 20, `Approval entry has the correct pendingPoints (20, got ${landmarkApproval && landmarkApproval.pendingPoints})`);
const landmarkLog = findLog(landmark.id);
assert(Boolean(landmarkLog) && landmarkLog.status === 'pending', 'Matching taskCompletionLogs entry has status "pending"');

if (landmarkApproval) {
  store.approveParentRequest(landmarkApproval.id);
  assert(store.state.selectedHero.points === beforeLandmarkPoints + 20, 'approveParentRequest() credits hero.points correctly');
}

// --- 4. completeAdventureGame() ---
console.log('\n--- 4. completeAdventureGame() queues points for approval instead of fabricating an "approved" log ---');
resetState();
const beforeGamePoints = store.state.selectedHero.points;
const gameResult = store.completeAdventureGame('phonics_forest', 3, 3);
assert(gameResult.stars === 3, 'completeAdventureGame() reports a 3-star win');
assert(store.state.selectedHero.points === beforeGamePoints, 'hero.points is NOT incremented synchronously by the call');
assert(store.state.selectedHero.coins === 40, 'hero.coins IS auto-issued immediately (25 base + 15 three-star bonus)');
const gameApproval = findApproval('phonics_forest');
assert(Boolean(gameApproval), 'A pendingApprovals entry was created for the Adventure Game');
assert(gameApproval && gameApproval.pendingPoints === 15, `Approval entry has the correct pendingPoints (15, got ${gameApproval && gameApproval.pendingPoints})`);
const gameLog = findLog('phonics_forest');
assert(Boolean(gameLog) && gameLog.status === 'pending', 'Matching taskCompletionLogs entry has status "pending" (was falsely "approved" before the fix)');

if (gameApproval) {
  store.approveParentRequest(gameApproval.id);
  assert(store.state.selectedHero.points === beforeGamePoints + 15, 'approveParentRequest() credits hero.points correctly (previously these points were never credited at all)');
}

// --- 5. claimExpeditionRewards() ---
console.log('\n--- 5. claimExpeditionRewards() queues points for approval instead of fabricating an "approved" log ---');
resetState();
store.state.activeExpeditions = [{
  id: 'exp_test_1',
  petId: '1',
  biomeId: 'whispering_meadows',
  biomeName: 'Whispering Meadows',
  durationMinutes: 30,
  startTime: Date.now() - 1000000,
  endTime: Date.now() - 1,
  snackPacked: false
}];
const beforeExpPoints = store.state.selectedHero.points;
const beforeExpCoins = store.state.selectedHero.coins;
const expResult = store.claimExpeditionRewards('exp_test_1');
assert(Boolean(expResult && expResult.rewards), 'claimExpeditionRewards() returns a rewards payload');
assert(store.state.selectedHero.points === beforeExpPoints, 'hero.points is NOT incremented synchronously by the call');
assert(store.state.selectedHero.coins > beforeExpCoins, 'hero.coins IS auto-issued immediately');
const expApproval = findApproval('expedition_whispering_meadows');
assert(Boolean(expApproval), 'A pendingApprovals entry was created for the expedition claim');
assert(expApproval && expApproval.pendingPoints === 10, `Approval entry has the correct pendingPoints (10, got ${expApproval && expApproval.pendingPoints})`);
const expLog = findLog('expedition_whispering_meadows');
assert(Boolean(expLog) && expLog.status === 'pending', 'Matching taskCompletionLogs entry has status "pending" (was falsely "approved" before the fix)');

if (expApproval) {
  store.approveParentRequest(expApproval.id);
  assert(store.state.selectedHero.points === beforeExpPoints + 10, 'approveParentRequest() credits hero.points correctly (previously these points were never credited at all)');
}

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);

process.exit(failed > 0 ? 1 : 0);
