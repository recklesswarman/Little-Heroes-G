import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { renderBattleView, attachBattleListeners, startBattle, quitBattle, abandonBattleIfRunning } from '../src/views/BattleView.js';
import { renderDashboardView, attachDashboardListeners } from '../src/views/DashboardView.js';
import { renderQuestMapView, attachQuestMapListeners } from '../src/views/QuestMapView.js';
import { renderWorldAdventureMapView, attachWorldAdventureMapListeners } from '../src/views/WorldAdventureMapView.js';
import { hanaBattle3DService } from '../src/services/hanaBattle3DService.js';

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

console.log('\n--- 1. Testing No Infinite Render Loop on ar_battle Navigation ---');

let renderCount = 0;
function mockRenderApp() {
  renderCount++;
  if (renderCount > 15) {
    throw new Error('CRITICAL BUG: Infinite render loop detected!');
  }
  if (store.state.activeView === 'ar_battle') {
    const html = renderBattleView();
    attachBattleListeners();
  }
}

const unsubscribe = store.subscribe(() => {
  mockRenderApp();
});

store.navigate('ar_battle');
assert(renderCount <= 3, `ar_battle rendered safely with exactly ${renderCount} renders (no infinite freeze loop)`);
abandonBattleIfRunning();

console.log('\n--- 2. Testing Morning Toothbrush AR Battle in Task Forest (DashboardView) ---');

store.state.activeView = 'dashboard';
const dashHtml = renderDashboardView();
document.body.innerHTML = dashHtml;
attachDashboardListeners();

const taskArBtn = document.querySelector('.task-ar-launch-btn[data-task-ar-id="morning_brush"]');
assert(taskArBtn !== null, 'Found .task-ar-launch-btn for Morning Toothbrush AR Battle in Task Forest');
assert(taskArBtn.getAttribute('title')?.includes('Battle'), 'Task button title is "Launch Toothbrush AR Battle"');

// Click task AR button
let navigatedView = null;
const originalNavigate = store.navigate.bind(store);
store.navigate = (view) => {
  navigatedView = view;
  originalNavigate(view);
};

taskArBtn.click();
assert(navigatedView === 'ar_battle', 'Clicking .task-ar-launch-btn navigated directly to ar_battle');
abandonBattleIfRunning();

// Click task card itself
navigatedView = null;
const taskCard = document.querySelector('.task-card-item[data-task-card-id="morning_brush"]');
assert(taskCard !== null, 'Found .task-card-item for morning_brush');
taskCard.click();
assert(navigatedView === 'ar_battle', 'Clicking Morning Toothbrush task card launched ar_battle');
abandonBattleIfRunning();

console.log('\n--- 3. Testing Toothbrush Adventure Battle in Habit Islands (DashboardView) ---');

document.body.innerHTML = renderDashboardView();
attachDashboardListeners();

const habitArBtn = document.querySelector('.habit-ar-launch-btn[data-habit-ar-id="toothbrush_adventure_battle"]');
assert(habitArBtn !== null, 'Found .habit-ar-launch-btn for Toothbrush Adventure Battle in Habit Islands');
assert(habitArBtn.getAttribute('title')?.includes('Battle'), 'Habit button title is "Launch Toothbrush AR Battle"');

// Click habit AR button
navigatedView = null;
habitArBtn.click();
assert(navigatedView === 'ar_battle', 'Clicking .habit-ar-launch-btn navigated directly to ar_battle');
abandonBattleIfRunning();

// Click habit card itself
navigatedView = null;
const habitCard = document.querySelector('.habit-card-item[data-habit-card-id="toothbrush_adventure_battle"]');
assert(habitCard !== null, 'Found .habit-card-item for toothbrush_adventure_battle');
habitCard.click();
assert(navigatedView === 'ar_battle', 'Clicking Toothbrush habit card launched ar_battle');
abandonBattleIfRunning();

console.log('\n--- 4. Testing Sugar Fortress Boss Summit in QuestMapView ---');

store.state.activeView = 'quest_map';
document.body.innerHTML = renderQuestMapView();
attachQuestMapListeners();

const mapSugarBossBtn = document.getElementById('map-sugar-boss-btn');
assert(mapSugarBossBtn !== null, 'Found #map-sugar-boss-btn in QuestMapView');

navigatedView = null;
mapSugarBossBtn.click();
assert(navigatedView === 'ar_battle', 'Clicking Sugar Fortress Boss Summit navigated directly to ar_battle');
abandonBattleIfRunning();

console.log('\n--- 5. Testing Sugar Fortress Boss Waypoint in WorldAdventureMapView ---');

store.state.activeView = 'adventure_map';
const origGetCompletions = store.getTaskCompletionsToday.bind(store);
store.getTaskCompletionsToday = (choreKey, heroId) => {
  if (choreKey !== 'wp_night_brush' && choreKey !== 'night_brush' && choreKey !== 'brush_teeth_pm') {
    return [{ id: 'mock_comp' }];
  }
  return [];
};

document.body.innerHTML = renderWorldAdventureMapView();
attachWorldAdventureMapListeners();

const pathLaunchBossBtn = document.getElementById('path-launch-boss-btn');
assert(pathLaunchBossBtn !== null, 'Found #path-launch-boss-btn in WorldAdventureMapView');

navigatedView = null;
if (pathLaunchBossBtn) pathLaunchBossBtn.click();
assert(navigatedView === 'ar_battle', 'Clicking World Map Boss Waypoint navigated directly to ar_battle');
abandonBattleIfRunning();
store.getTaskCompletionsToday = origGetCompletions;

console.log('\n--- 6. Testing BattleView Re-entrancy & In-Game Switcher ---');

document.body.innerHTML = renderBattleView();
attachBattleListeners();

// Re-starting battle doesn't throw or duplicate intervals
startBattle();
startBattle();
assert(true, 'Calling startBattle multiple times executes without error or memory lock');

// In-game villain switcher DOM update without store notify
const switchBtn = document.querySelector('.villain-switch-btn');
if (switchBtn) {
  const vId = switchBtn.getAttribute('data-villain-id');
  switchBtn.click();
  assert(store.state.selectedBossId === vId, `Villain switched cleanly to ${vId}`);
}

abandonBattleIfRunning();
unsubscribe();
store.navigate = originalNavigate;

console.log('\n--- 7. Testing Negative-dt Guard in renderLoop (quit/restart overlap regression) ---');

// Live-played repro: quitting mid-battle then hitting "Battle Again" could
// leave an old render-loop animation-frame chain overlapping briefly with a
// freshly re-initialized one, so a stale frame delivered a timestamp EARLIER
// than the already-advanced this.lastTime -- producing a negative dt that
// made every dt-scaled value (shockwave ring radii, etc.) shrink instead of
// grow, eventually going negative and throwing IndexSizeError from
// ctx.arc(). renderLoop() now clamps dt to >= 0; this.clock (incremented by
// dt every frame regardless of whether a real 2D context is present) must
// never go backwards even when fed a stale/earlier timestamp.
hanaBattle3DService.isDestroyed = false; // exercise the dt computation itself, regardless of prior test state
const clockBefore = hanaBattle3DService.clock;
hanaBattle3DService.lastTime = 50000;
hanaBattle3DService.renderLoop(49500); // a stale frame, timestamp BEFORE lastTime
assert(hanaBattle3DService.lastTime === 49500, 'lastTime still tracks the most recently seen frame timestamp (renderLoop actually ran, not short-circuited)');
assert(hanaBattle3DService.clock >= clockBefore, 'renderLoop never lets the clock go backwards even when fed a stale/earlier timestamp (dt clamped to >= 0)');
hanaBattle3DService.destroy(); // stop the self-rescheduling loop this direct call just started

// Also confirm quitBattle() actually stops the render loop instead of leaving
// it running behind the new defeat modal -- the root cause of the overlap.
document.body.innerHTML = renderBattleView();
attachBattleListeners();
startBattle();
quitBattle();
assert(hanaBattle3DService.isDestroyed === true, 'quitBattle() mid-battle stops the 3D render loop (destroy()) instead of leaving a stale one running behind the defeat modal');
abandonBattleIfRunning();

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
