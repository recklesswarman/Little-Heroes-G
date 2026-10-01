import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { renderBedtimeStoryView, setupBedtimeStoryListeners } from '../src/views/BedtimeStoryView.js';
import { renderBattleView, attachBattleListeners, getBattleBoss, quitBattle, abandonBattleIfRunning } from '../src/views/BattleView.js';
import { PATH_OF_VALOR_WAYPOINTS } from '../src/data/worldMapData.js';

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

console.log('🧪 Starting Bedtime Hub Step 1 & Quest 7 Sugar Fortress Showdown Verification...\n');

// 1. Verify Quest 7 in World Adventure Map Data
console.log('--- 1. Testing Quest 7 in worldMapData.js ---');
const quest7 = PATH_OF_VALOR_WAYPOINTS.find(w => w.id === 'wp_night_teeth' || w.stepNumber === 7);
assert(quest7 !== undefined, 'Quest 7 (wp_night_teeth) exists in PATH_OF_VALOR_WAYPOINTS');
assert(quest7?.stepNumber === 7, 'Quest 7 stepNumber is 7');
assert(quest7?.title === 'Sugar Fortress Night Showdown', 'Quest 7 title is Sugar Fortress Night Showdown');
assert(quest7?.linkedBossId === 'sugar_boss', 'Quest 7 linkedBossId is sugar_boss');
assert(quest7?.choreKey === 'brush_teeth_pm', 'Quest 7 choreKey is brush_teeth_pm');

// 2. Testing getBattleBoss resolution for sugar_boss
console.log('\n--- 2. Testing getBattleBoss("sugar_boss") resolution ---');
const sugarBoss = getBattleBoss('sugar_boss');
assert(sugarBoss !== undefined, 'getBattleBoss("sugar_boss") resolves to boss definition');
assert(sugarBoss?.title === 'Sugar Fortress Night Showdown', 'Boss title is Sugar Fortress Night Showdown');
assert(sugarBoss?.name === 'The Sugar Bandit King', 'Boss character is The Sugar Bandit King');
assert(sugarBoss?.meshType === 'sugar_bandit', 'meshType is sugar_bandit for 3D assets');

// 3. Testing Bedtime Sanctuary Hub Step 1 Card
console.log('\n--- 3. Testing Bedtime Sanctuary Hub Step 1 rendering ---');
store.state.activeView = 'bedtime_story';
const html = renderBedtimeStoryView();
document.body.innerHTML = html;
setupBedtimeStoryListeners();

const stepLaunchBtn = document.getElementById('step-launch-toothbrush-btn');
assert(stepLaunchBtn !== null, 'Found #step-launch-toothbrush-btn in Bedtime Sanctuary Hub');
assert(html.includes('Evening Toothbrush'), 'HTML contains "Evening Toothbrush" title');
assert(html.includes('Sugar Fortress Night Showdown'), 'HTML contains "Sugar Fortress Night Showdown" subtitle');
assert(html.includes('Map Quest 7') || html.includes('Quest 7 • Step 1'), 'HTML contains Quest 7 connection badge');

// 4. Testing Clicking Start 2-Min Routine from Bedtime Hub
console.log('\n--- 4. Testing Start 2-Min Routine Click Handler ---');
stepLaunchBtn.click();
assert(store.state.activeView === 'ar_battle', 'Clicking button navigated to ar_battle');
assert(store.state.previousView === 'bedtime_story', 'previousView recorded as bedtime_story');
assert(store.getSelectedBossId() === 'sugar_boss', 'selectedBossId is sugar_boss');

// 5. Testing BattleView rendering with sugar_boss and quitBattle return
console.log('\n--- 5. Testing BattleView with sugar_boss and quit return ---');
const battleHtml = renderBattleView();
assert(battleHtml.includes('Sugar Fortress Night Showdown') || battleHtml.includes('Sugar Bandit King'), 'BattleView renders Sugar Fortress / Sugar Bandit King');

// Test quitBattle returns to bedtime_story
quitBattle();
assert(store.state.activeView === 'bedtime_story', 'Quitting battle returns directly to bedtime_story');

// 6. Testing Battle Completion Sync with Bedtime Step 1 & Map Quest 7
console.log('\n--- 6. Testing Battle Completion Sync ---');
const hero = store.getState().selectedHero;
const heroId = hero.id;

// Complete the battle
store.state.previousView = 'bedtime_story';
store.completeToothbrushBattle('sugar_boss', 120, 88);

// Verify store state
const todayStr = new Date().toDateString();
assert(store.state.lastBrushedEvening === todayStr, 'lastBrushedEvening set to today');
assert(hero.dentalHabits?.bedtimeBrushDate === todayStr, 'hero.dentalHabits.bedtimeBrushDate set to today');

// Check completion logs for brush_teeth_pm
const completionsPm = store.getTaskCompletionsToday('brush_teeth_pm', heroId);
assert(completionsPm.length > 0, 'getTaskCompletionsToday("brush_teeth_pm") has at least 1 entry');

const completionsWp = store.getTaskCompletionsToday('wp_night_teeth', heroId);
assert(completionsWp.length > 0, 'getTaskCompletionsToday("wp_night_teeth") has at least 1 entry via alias');

const completionsBedtime = store.getTaskCompletionsToday('bedtime_brush', heroId);
assert(completionsBedtime.length > 0, 'getTaskCompletionsToday("bedtime_brush") has at least 1 entry via alias');

// Re-render bedtime story hub to verify Step 1 shows completed
const updatedBedtimeHtml = renderBedtimeStoryView();
assert(updatedBedtimeHtml.includes('Completed ✨'), 'Step 1 shows Completed ✨ badge');
assert(updatedBedtimeHtml.includes('Brushed Clean'), 'Step 1 button shows Brushed Clean');

// 7. Testing Victory Modal Return to Bedtime Routine Button
console.log('\n--- 7. Testing Victory Modal Return Buttons ---');
store.state.previousView = 'bedtime_story';
const victoryHtml = renderBattleView();
document.body.innerHTML = victoryHtml;
attachBattleListeners();

const returnBedtimeBtn = document.getElementById('colosseum-return-bedtime-btn');
assert(returnBedtimeBtn !== null, 'Found #colosseum-return-bedtime-btn in victory modal');
returnBedtimeBtn.click();
assert(store.state.activeView === 'bedtime_story', 'Clicking Continue Bedtime Routine returns to bedtime_story');

abandonBattleIfRunning();

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
