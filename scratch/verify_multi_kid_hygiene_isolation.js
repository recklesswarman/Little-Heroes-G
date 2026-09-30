import './setup_mock_env.js';
import { startBattle, advanceToBrushPhase, renderBattleView, quitBattle } from '../src/views/BattleView.js';
import { store } from '../src/state/store.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

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

console.log('\n--- 1. Set Up Multi-Kid Household: Kid A (Kalep) vs Kid B (Leo) ---');

const kidA = { id: 'kid_kalep', name: 'Kalep', gameDifficulty: 'medium', coins: 100, equippedGear: {}, inventory: [] };
const kidB = { id: 'kid_leo', name: 'Leo', gameDifficulty: 'easy', coins: 50, equippedGear: {}, inventory: [] };

store.state.heroes = [kidA, kidB];
store.state.parentSettings.arBattleDuration = 60; // 1-minute parent duration
store.state.activeView = 'bedtime_story'; // Nighttime trigger
store.state.hygieneReminders = {};
store.state.pendingApprovals = [];

// Parent configures: Kid A needs floss & mouthwash; Kid B has BOTH turned OFF
store.setHygieneReminder('kid_kalep', 'floss', true);
store.setHygieneReminder('kid_kalep', 'mouthwash', true);

store.setHygieneReminder('kid_leo', 'floss', false);
store.setHygieneReminder('kid_leo', 'mouthwash', false);

assert(store.isHygieneReminderActive('kid_kalep', 'floss') === true, 'Kid A has Floss reminder active');
assert(store.isHygieneReminderActive('kid_kalep', 'mouthwash') === true, 'Kid A has Mouthwash reminder active');
assert(store.isHygieneReminderActive('kid_leo', 'floss') === false, 'Kid B has Floss reminder inactive');
assert(store.isHygieneReminderActive('kid_leo', 'mouthwash') === false, 'Kid B has Mouthwash reminder inactive');

console.log('\n--- 2. Kid A (Kalep) Launches Nighttime Battle: Gets Floss Battle & Mouthwash ---');

store.state.selectedHero = kidA;
store.setSelectedBossId('sugar_bandit');
store.initColosseumBattle('sugar_bandit', 60);

// Start battle for Kid A
startBattle();
let colStateA = store.getBossColosseumState();
assert(colStateA.secondsRemaining === 120, 'Kid A starts in 2-minute (120s) Floss Battle');

let htmlA = renderBattleView();
assert(htmlA.includes('floss-banner-container'), 'Kid A battle HUD renders Phase 1 Floss Battle banner');
assert(htmlA.includes('battle-done-floss-btn'), 'Kid A battle HUD renders "Done Flossing!" button');

// Kid A advances to Brush Phase
advanceToBrushPhase();
colStateA = store.getBossColosseumState();
assert(colStateA.secondsRemaining === 60, 'Kid A transitions to 60s Toothbrush battle countdown');
assert(store.hasAcknowledgedHygieneReminderToday('kid_kalep', 'floss') === true, 'Kid A floss marked acknowledged for today');

// Fast-forward Kid A toothbrush countdown to victory
const tickA = captureBattleTick();
for (let i = 0; i < 60; i++) tickA();

colStateA = store.getBossColosseumState();
assert(colStateA.hasAwardedVictory === true, 'Kid A battle is marked victory');
assert(colStateA.isVictoryModalOpen === true, 'Kid A victory modal is open');

htmlA = renderBattleView();
assert(htmlA.includes('mouthwash-victory-card'), 'Kid A victory modal displays Mouthwash reminder card');
assert(htmlA.includes('mouthwash-modal-ack-btn'), 'Kid A victory modal displays "I Rinsed! 💧✨" button');

// Kid A acknowledges mouthwash
store.acknowledgeHygieneReminder('kid_kalep', 'mouthwash');
assert(store.hasAcknowledgedHygieneReminderToday('kid_kalep', 'mouthwash') === true, 'Kid A mouthwash acknowledged for today');

// Check Kid A pending approval task
const pendingKalep = store.state.pendingApprovals.find(p => p.kidId === 'kid_kalep');
assert(pendingKalep !== undefined, 'Parent task point approval queued for Kid A (Kalep)');
assert(pendingKalep?.pendingPoints === 15, 'Points queued correctly (15 points)');

quitBattle();

console.log('\n--- 3. Switch to Kid B (Leo): Floss is BYPASSED & No Mouthwash in Modal ---');

store.state.selectedHero = kidB;
store.setSelectedBossId('sugar_bandit');
store.initColosseumBattle('sugar_bandit', 60);

// Start battle for Kid B
startBattle();
let colStateB = store.getBossColosseumState();
assert(colStateB.secondsRemaining === 60, 'Kid B bypasses Floss Battle and starts immediately with 60s Toothbrush countdown');

let htmlB = renderBattleView();
assert(!htmlB.includes('floss-banner-container'), 'Kid B battle HUD does NOT render Floss banner');
assert(!htmlB.includes('battle-done-floss-btn'), 'Kid B battle HUD does NOT render Done Flossing button');

// Fast-forward Kid B toothbrush countdown to victory
const tickB = captureBattleTick();
for (let i = 0; i < 60; i++) tickB();

colStateB = store.getBossColosseumState();
assert(colStateB.hasAwardedVictory === true, 'Kid B battle is marked victory');
assert(colStateB.isVictoryModalOpen === true, 'Kid B victory modal is open');

htmlB = renderBattleView();
assert(!htmlB.includes('mouthwash-victory-card'), 'Kid B victory modal does NOT display Mouthwash card');
assert(!htmlB.includes('mouthwash-modal-ack-btn'), 'Kid B victory modal does NOT display Mouthwash button');

// Check Kid B pending approval task
const pendingLeo = store.state.pendingApprovals.find(p => p.kidId === 'kid_leo');
assert(pendingLeo !== undefined, 'Parent task point approval queued for Kid B (Leo)');
assert(pendingLeo?.kidName === 'Leo', 'Task attributed to Leo');

quitBattle();

console.log('\n--- 4. Kid A (Kalep) Plays a Second Time Tonight: Floss Battle Not Repeated ---');

// Kid A already flossed and rinsed earlier tonight
store.state.selectedHero = kidA;
store.setSelectedBossId('sugar_bandit');
store.initColosseumBattle('sugar_bandit', 60);

startBattle();
colStateA = store.getBossColosseumState();
assert(colStateA.secondsRemaining === 60, 'Kid A second battle starts directly in Brush mode (60s), without re-nagging for floss');

htmlA = renderBattleView();
assert(!htmlA.includes('floss-banner-container'), 'Floss banner not shown on retry');

quitBattle();

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
