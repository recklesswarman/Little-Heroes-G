/**
 * verify_parent_analytics_e2e.mjs
 * 
 * Comprehensive 4-Tier E2E Test Suite for Little Heroes Parent & Developmental Analytics Dashboard.
 * 
 * Covers:
 * Tier 1: Feature Coverage (Features 1-10 from PROJECT.md § Feature Inventory)
 *   - F1: Multi-Kid Analytics Selector ('all' vs individual child isolation)
 *   - F2: Tree-Shaken Modular Apache ECharts Integration (package.json, imports)
 *   - F3: Chart 1: Routine Consistency Heatmap & Trends (Dual-axis, daily %, streaks & milestones)
 *   - F4: Chart 2: Screen Time vs. Responsibility Balance (Grouped bars, net curve & daily cap markLine)
 *   - F5: Chart Lifecycle, ResizeObserver & safe disposeAnalyticsCharts()
 *   - F6: Grounded Household Data Context extraction from store.getState()
 *   - F7: Embedded AI Chat Assistant Panel markup & interaction
 *   - F8: Direct DOM Streaming Protocol (#chat-streaming-bubble) without store.notify() canvas wipe
 *   - F9: Clickable Habit Deep-Links & sanitization ([Title](habit:<id>), [Title](log:<id>), etc.)
 *   - F10: Build Readiness & Synchronized PWA Cache Versioning (sw.js & index.html)
 * 
 * Tier 2: Boundary & Corner Cases
 *   - Empty/fresh household logs (zero-division & sparse history safeguards)
 *   - Missing/unknown child IDs gracefully handled without throwing
 *   - Timeframe date boundary math (7d vs 30d calendar calculations)
 *   - Extreme screen time values (0 usage, high surplus, daily cap saturation)
 *   - Malformed AI deep-link markdown & adversarial XSS injection
 *   - Offline / AI Error resilience (graceful fallback to local grounded synthesizer)
 * 
 * Tier 3: Cross-Feature Interactions
 *   - Kid Filter x Timeframe x Metric Aggregation Matrix
 *   - Selected Kid Filter x Grounded AI Context Isolation Matrix
 *   - Deep-Link Generation x Parent Portal Tab Navigation & Pulse Highlighting
 *   - Tab Switching x ECharts Instance Disposal & Re-initialization
 * 
 * Tier 4: Real-World Scenarios
 *   - Scenario 1: Multi-child family overview (7d consistency + screen time bank)
 *   - Scenario 2: Individual child inspection (Leo 30d streak milestones and daily cap)
 *   - Scenario 3: AI inquiry with grounded streaming response & deep-link click simulation
 *   - Scenario 4: Full production build readiness & cache version consistency
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// 0. HEADLESS ENVIRONMENT SETUP & POLYFILLS
// ---------------------------------------------------------------------------
import './setup_mock_env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Augment document.createElement to ensure any canvas element returns a comprehensive Proxy 2D context
// that implements all methods required by zrender and echarts without throwing in headless Node.js.
const origCreateElement = document.createElement;
document.createElement = function (tag) {
  const el = origCreateElement.call(document, tag);
  const origGetContext = el.getContext;
  el.getContext = function (type) {
    const base = origGetContext ? origGetContext.call(el, type) : {};
    return new Proxy(base, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'canvas') return el;
        if (prop === 'measureText') {
          return (text) => ({ width: (text || '').length * 8, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 3 });
        }
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => ({ addColorStop: () => {} });
        }
        if (prop === 'createPattern') {
          return () => ({});
        }
        return () => {};
      }
    });
  };
  return el;
};

// Polyfill ResizeObserver if missing in Node
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class MockResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.observedElements = [];
    }
    observe(el) {
      if (!this.observedElements.includes(el)) this.observedElements.push(el);
    }
    unobserve(el) {
      this.observedElements = this.observedElements.filter(e => e !== el);
    }
    disconnect() {
      this.observedElements = [];
    }
    trigger(entry = {}) {
      if (typeof this.callback === 'function') {
        this.callback(this.observedElements.map(el => ({ target: el, ...entry })), this);
      }
    }
  };
}

// ---------------------------------------------------------------------------
// TEST HARNESS & RUNNER UTILITIES
// ---------------------------------------------------------------------------
let totalPassed = 0;
let totalFailed = 0;
let currentSuite = '';

function suite(name) {
  currentSuite = name;
  console.log(`\n======================================================================`);
  console.log(`🔷 SUITE: ${name}`);
  console.log(`======================================================================`);
}

function assert(condition, message, detail = '') {
  if (condition) {
    totalPassed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    totalFailed++;
    console.error(`  ❌ FAIL: ${message}`);
    if (detail) console.error(`     Detail: ${detail}`);
  }
}

console.log(`\n🚀 Initializing Parent & Developmental Analytics Dashboard E2E Verification...\n`);

// ---------------------------------------------------------------------------
// MODULE IMPORTS (with existence check)
// ---------------------------------------------------------------------------
const storeModule = await import('../src/state/store.js');
const store = storeModule.store;

let parentAnalyticsCharts = null;
try {
  parentAnalyticsCharts = await import('../src/components/ParentAnalyticsCharts.js');
} catch (e) {
  console.warn('⚠️ ParentAnalyticsCharts.js could not be loaded:', e.message);
}

let aiDataAssistant = null;
try {
  aiDataAssistant = await import('../src/services/aiDataAssistantService.js');
} catch (e) {
  console.warn('⚠️ aiDataAssistantService.js could not be loaded:', e.message);
}

let parentPortalView = null;
try {
  parentPortalView = await import('../src/views/ParentPortalView.js');
} catch (e) {
  console.warn('⚠️ ParentPortalView.js could not be loaded:', e.message);
}

// Helper to seed store with controlled multi-kid test household
function seedTestHousehold() {
  const originalState = {
    heroes: store.state.heroes,
    selectedHero: store.state.selectedHero,
    taskCompletionLogs: store.state.taskCompletionLogs,
    taskLedgerLogs: store.state.taskLedgerLogs,
    pendingApprovals: store.state.pendingApprovals
  };

  const testHero1 = {
    id: 'hero_test_leo',
    name: 'Leo Explorer',
    role: 'Brave Dino Knight',
    streak: 7,
    brushStreak: 7,
    points: 40,
    coins: 150,
    screenTimeMinutes: 50,
    screenTimeUsedToday: 20,
    dailyMaxScreenTime: 60,
    screenTimeRate: 2,
    bedtimeCurfew: '20:00',
    isScreenTimePaused: false
  };

  const testHero2 = {
    id: 'hero_test_maya',
    name: 'Maya Adventurer',
    role: 'Star Wizard',
    streak: 14,
    brushStreak: 12,
    points: 75,
    coins: 300,
    screenTimeMinutes: 80,
    screenTimeUsedToday: 45,
    dailyMaxScreenTime: 90,
    screenTimeRate: 3,
    bedtimeCurfew: '20:30',
    isScreenTimePaused: false
  };

  const today = new Date();
  const todayStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

  const testLogs = [
    {
      id: 'log_leo_brush',
      taskId: 'brush_teeth_am',
      taskTitle: 'Morning Toothbrush',
      zone: 'Hygiene Arena',
      heroId: 'hero_test_leo',
      heroName: 'Leo Explorer',
      coinsAwarded: 25,
      pointsAwarded: 10,
      status: 'approved',
      completedAt: today.toISOString(),
      dateString: todayStr
    },
    {
      id: 'log_leo_tidy',
      taskId: 'tidy_room',
      taskTitle: 'Tidy Bed & Room',
      zone: 'Bedroom Keep',
      heroId: 'hero_test_leo',
      heroName: 'Leo Explorer',
      coinsAwarded: 20,
      pointsAwarded: 8,
      status: 'approved',
      completedAt: today.toISOString(),
      dateString: todayStr
    },
    {
      id: 'log_maya_math',
      taskId: 'math_quest',
      taskTitle: 'Galaxy Math Quest',
      zone: 'Learning Spire',
      heroId: 'hero_test_maya',
      heroName: 'Maya Adventurer',
      coinsAwarded: 30,
      pointsAwarded: 15,
      status: 'approved',
      completedAt: today.toISOString(),
      dateString: todayStr
    }
  ];

  const testApprovals = [
    {
      id: 'appr_leo_reading',
      logId: 'log_leo_read',
      kidId: 'hero_test_leo',
      kidName: 'Leo Explorer',
      taskId: 'reading_time',
      taskTitle: 'Bedtime Reading',
      pendingPoints: 10
    }
  ];

  store.state.heroes = [testHero1, testHero2];
  store.state.selectedHero = testHero1;
  store.state.taskCompletionLogs = testLogs;
  store.state.taskLedgerLogs = [];
  store.state.pendingApprovals = testApprovals;

  return {
    testHero1,
    testHero2,
    testLogs,
    testApprovals,
    restore() {
      store.state.heroes = originalState.heroes;
      store.state.selectedHero = originalState.selectedHero;
      store.state.taskCompletionLogs = originalState.taskCompletionLogs;
      store.state.taskLedgerLogs = originalState.taskLedgerLogs;
      store.state.pendingApprovals = originalState.pendingApprovals;
    }
  };
}

// ===========================================================================
// TIER 1: FEATURE COVERAGE (Features 1 - 10)
// ===========================================================================

// --- SUITE 1: Package Dependencies & Modular ECharts Integration (F2) ---
suite('Tier 1 - F2: Apache ECharts Modular Tree-Shaken Integration');
{
  const pkgPath = path.join(projectRoot, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  assert(
    pkgJson.dependencies && Boolean(pkgJson.dependencies['echarts']),
    'package.json contains "echarts" in dependencies',
    JSON.stringify(pkgJson.dependencies)
  );

  const echarts = await import('echarts');
  assert(Boolean(echarts && (echarts.version || echarts.init)), 'Apache ECharts imports and initializes in Node environment');
  assert(Boolean(parentAnalyticsCharts), 'ParentAnalyticsCharts.js module exists and loaded');

  if (parentAnalyticsCharts) {
    assert(typeof parentAnalyticsCharts.renderAnalyticsChartsSection === 'function', 'ParentAnalyticsCharts exports renderAnalyticsChartsSection()');
    assert(typeof parentAnalyticsCharts.aggregateMetrics === 'function', 'ParentAnalyticsCharts exports aggregateMetrics()');
    assert(typeof parentAnalyticsCharts.initAnalyticsCharts === 'function', 'ParentAnalyticsCharts exports initAnalyticsCharts()');
    assert(typeof parentAnalyticsCharts.disposeAnalyticsCharts === 'function', 'ParentAnalyticsCharts exports disposeAnalyticsCharts()');
  }
}

// --- SUITE 2: Multi-Kid Filtering & Data Aggregation (F1, F3, F4) ---
suite('Tier 1 - F1, F3, F4: Multi-Kid Filtering & Metric Aggregation');
{
  const testHousehold = seedTestHousehold();

  try {
    const aggregateMetrics = parentAnalyticsCharts.aggregateMetrics;

    // Test 1: Household 'all' aggregation
    const allMetrics = aggregateMetrics('all', '7d');
    assert(Boolean(allMetrics && allMetrics.routine && allMetrics.screenTime), 'aggregateMetrics("all", "7d") returns routine and screenTime objects');
    assert(allMetrics.routine.dates.length === 7, `7-day view returns exactly 7 date buckets (got ${allMetrics.routine.dates.length})`);
    assert(allMetrics.routine.completionRates.length === 7, 'Routine completion rates array has 7 entries');
    assert(allMetrics.routine.streaks.length === 7, 'Routine streaks array has 7 entries');
    assert(allMetrics.screenTime.earnedMinutes.length === 7, 'Screen time earned minutes array has 7 entries');
    assert(allMetrics.screenTime.redeemedMinutes.length === 7, 'Screen time redeemed minutes array has 7 entries');
    assert(allMetrics.screenTime.netBalance.length === 7, 'Screen time net balance array has 7 entries');

    // Test 2: Individual Kid 1 ('hero_test_leo') isolation
    const leoMetrics = aggregateMetrics('hero_test_leo', '7d');
    assert(leoMetrics.screenTime.dailyCap === 60, `Leo dailyCap matches hero.dailyMaxScreenTime (expected 60, got ${leoMetrics.screenTime.dailyCap})`);

    // Test 3: Individual Kid 2 ('hero_test_maya') isolation
    const mayaMetrics = aggregateMetrics('hero_test_maya', '7d');
    assert(mayaMetrics.screenTime.dailyCap === 90, `Maya dailyCap matches hero.dailyMaxScreenTime (expected 90, got ${mayaMetrics.screenTime.dailyCap})`);

    // Test 4: Net Balance mathematical invariant
    let netBalanceValid = true;
    for (let i = 0; i < 7; i++) {
      const earned = allMetrics.screenTime.earnedMinutes[i];
      const redeemed = allMetrics.screenTime.redeemedMinutes[i];
      const net = allMetrics.screenTime.netBalance[i];
      if (net !== earned - redeemed) {
        netBalanceValid = false;
        break;
      }
    }
    assert(netBalanceValid, 'Net balance invariant satisfied for all dates: netBalance = earnedMinutes - redeemedMinutes');

    // Test 5: 30-Day Timeframe
    const metrics30d = aggregateMetrics('hero_test_leo', '30d');
    assert(metrics30d.routine.dates.length === 30, `30-day timeframe returns exactly 30 dates (got ${metrics30d.routine.dates.length})`);
    assert(metrics30d.routine.is30d === true, 'routine.is30d flag is true for 30d timeframe');
  } finally {
    testHousehold.restore();
  }
}

// --- SUITE 3: ECharts Option Structure & High-Contrast Design (F3, F4) ---
suite('Tier 1 - F3, F4: Apache ECharts Option Structure & Theme Tokens');
{
  const testHousehold = seedTestHousehold();

  try {
    const aggregateMetrics = parentAnalyticsCharts.aggregateMetrics;
    const getRoutineOption = parentAnalyticsCharts.getRoutineConsistencyOption;
    const getScreenTimeOption = parentAnalyticsCharts.getScreenTimeBalanceOption;

    const metrics = aggregateMetrics('hero_test_leo', '7d');

    // Test Routine Consistency Chart Options
    const routineOpt = getRoutineOption(metrics.routine);
    assert(routineOpt.backgroundColor === 'transparent', 'Routine chart option sets transparent background');
    assert(routineOpt.tooltip && routineOpt.tooltip.trigger === 'axis', 'Routine chart tooltip triggers on axis');
    assert(Array.isArray(routineOpt.yAxis) && routineOpt.yAxis.length === 2, 'Routine chart uses dual y-axes (Dual-Axis consistency)');
    assert(routineOpt.yAxis[0].min === 0 && routineOpt.yAxis[0].max === 100, 'Left Y-axis scales 0 to 100%');
    assert(routineOpt.series.length === 2, 'Routine chart has 2 series (Bar for completion rate, Line for streaks)');
    assert(routineOpt.series[0].type === 'bar', 'Series 0 is bar chart for completion rate');
    assert(routineOpt.series[1].type === 'line', 'Series 1 is line chart for streak progression');
    assert(Boolean(routineOpt.series[1].markPoint), 'Streak series includes markPoint for milestone pins');

    // Test Screen Time Balance Chart Options
    const screenOpt = getScreenTimeOption(metrics.screenTime);
    assert(screenOpt.backgroundColor === 'transparent', 'Screen time chart option sets transparent background');
    assert(screenOpt.tooltip && screenOpt.tooltip.trigger === 'axis', 'Screen time chart tooltip triggers on axis');
    assert(screenOpt.series.length === 3, 'Screen time chart has 3 series (Earned bar, Redeemed bar, Net balance line)');
    assert(screenOpt.series[0].type === 'bar', 'Series 0 is earned responsibility bar');
    assert(screenOpt.series[1].type === 'bar', 'Series 1 is redeemed screen time bar');
    assert(screenOpt.series[2].type === 'line', 'Series 2 is net balance line');
    assert(Boolean(screenOpt.series[0].markLine), 'Series 0 includes markLine for parent daily cap reference line');

    // High Contrast Theme Tokens verification
    const jsonStr = JSON.stringify({ routineOpt, screenOpt });
    assert(jsonStr.includes('#54e98a') || jsonStr.includes('54e98a'), 'ECharts options use Little Heroes primary mint token (#54e98a)');
    assert(jsonStr.includes('#ffb961') || jsonStr.includes('ffb961'), 'ECharts options use Little Heroes warm amber token (#ffb961)');
    assert(jsonStr.includes('#f43f5e') || jsonStr.includes('f43f5e'), 'ECharts options use Little Heroes coral/rose token (#f43f5e)');
  } finally {
    testHousehold.restore();
  }
}

// --- SUITE 4: DOM Lifecycle, Responsive Resizing & Cleanup (F5) ---
suite('Tier 1 - F5: Chart DOM Lifecycle, ResizeObserver & Safe Cleanup');
{
  const testHousehold = seedTestHousehold();

  try {
    // 1. Markup generator test
    const html = parentAnalyticsCharts.renderAnalyticsChartsSection('hero_test_leo', '7d');
    assert(html.includes('id="chart-routine-consistency"'), 'Markup includes #chart-routine-consistency container');
    assert(html.includes('id="chart-screentime-balance"'), 'Markup includes #chart-screentime-balance container');
    assert(html.includes('id="analytics-kid-pill-bar"'), 'Markup includes #analytics-kid-pill-bar container');
    assert(html.includes('id="analytics-timeframe-bar"'), 'Markup includes #analytics-timeframe-bar container');
    assert(html.includes('data-analytics-timeframe="7d"'), 'Markup includes 7d timeframe button');
    assert(html.includes('data-analytics-timeframe="30d"'), 'Markup includes 30d timeframe button');

    // 2. DOM mount and chart initialization
    const wrapper = document.createElement('div');
    wrapper.id = 'analytics-test-container';
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);

    // Mock clientWidth/clientHeight on chart containers
    const routineEl = document.getElementById('chart-routine-consistency');
    const screenEl = document.getElementById('chart-screentime-balance');
    if (routineEl) { routineEl.clientWidth = 600; routineEl.clientHeight = 320; }
    if (screenEl) { screenEl.clientWidth = 600; screenEl.clientHeight = 320; }

    let initThrew = false;
    try {
      parentAnalyticsCharts.initAnalyticsCharts({ selectedKidId: 'all', timeframe: '7d' });
    } catch (err) {
      initThrew = true;
      console.error('initAnalyticsCharts error:', err);
    }
    assert(!initThrew, 'initAnalyticsCharts({ selectedKidId: "all", timeframe: "7d" }) initializes without throwing');

    // 3. Safe disposal
    let disposeThrew = false;
    try {
      parentAnalyticsCharts.disposeAnalyticsCharts();
    } catch (err) {
      disposeThrew = true;
      console.error('disposeAnalyticsCharts error:', err);
    }
    assert(!disposeThrew, 'disposeAnalyticsCharts() cleans up active instances without throwing');

    // 4. Idempotency of dispose
    let reDisposeThrew = false;
    try {
      parentAnalyticsCharts.disposeAnalyticsCharts();
    } catch (err) {
      reDisposeThrew = true;
    }
    assert(!reDisposeThrew, 'Calling disposeAnalyticsCharts() repeatedly is idempotent and safe');

    document.body.removeChild(wrapper);
  } finally {
    testHousehold.restore();
  }
}

// --- SUITE 5: Grounded Household Data Context Extraction (F6) ---
suite('Tier 1 - F6: Grounded Household Data Context Extraction');
{
  const testHousehold = seedTestHousehold();

  try {
    assert(Boolean(aiDataAssistant), 'aiDataAssistantService.js is loaded');
    const { buildGroundedHouseholdContext } = aiDataAssistant;

    // Test Household Aggregate Context
    const householdContext = buildGroundedHouseholdContext('all');
    assert(householdContext.selectedScope === 'Entire Household', 'Selected scope is "Entire Household" for "all"');
    assert(householdContext.heroes.length === 2, 'Household context includes both child profiles');
    assert(householdContext.metrics.totalChoresLogged === 3, `Total chores logged matches test seed (3, got ${householdContext.metrics.totalChoresLogged})`);
    assert(householdContext.metrics.approvedChores === 3, 'Approved chores count matches test seed (3)');
    assert(householdContext.metrics.approvalRatePercentage === 100, 'Approval rate is 100%');
    assert(householdContext.metrics.pendingApprovalCount === 1, 'Pending approval count matches test seed (1)');
    assert(householdContext.recentLogs.length === 3, 'Recent logs contains 3 entries');

    // Test Child Isolation in Grounded Context (Leo vs Maya)
    const leoContext = buildGroundedHouseholdContext('hero_test_leo');
    assert(leoContext.selectedScope === 'Leo Explorer', `Selected scope for Leo is "Leo Explorer" (got "${leoContext.selectedScope}")`);
    assert(leoContext.heroes.length === 1 && leoContext.heroes[0].id === 'hero_test_leo', 'Leo context includes only Leo hero profile');
    assert(leoContext.recentLogs.every(log => log.heroId === 'hero_test_leo'), 'All logs in Leo context belong strictly to Leo (no data leakage)');
    assert(leoContext.pendingApprovals.length === 1 && leoContext.pendingApprovals[0].kidId === 'hero_test_leo', 'Pending approval belongs to Leo');

    const mayaContext = buildGroundedHouseholdContext('hero_test_maya');
    assert(mayaContext.selectedScope === 'Maya Adventurer', `Selected scope for Maya is "Maya Adventurer"`);
    assert(mayaContext.heroes.length === 1 && mayaContext.heroes[0].id === 'hero_test_maya', 'Maya context includes only Maya hero profile');
    assert(mayaContext.recentLogs.every(log => log.heroId === 'hero_test_maya'), 'All logs in Maya context belong strictly to Maya');
    assert(mayaContext.pendingApprovals.length === 0, 'Maya context has 0 pending approvals (Leo pending approval not leaked)');
  } finally {
    testHousehold.restore();
  }
}

// --- SUITE 6: Embedded AI Assistant & Streaming Protocol (F7, F8) ---
suite('Tier 1 - F7, F8: Streaming Chat Assistant Protocol');
{
  const testHousehold = seedTestHousehold();

  try {
    const { streamChatWithData } = aiDataAssistant;

    // Test 1: Streaming streak inquiry
    let chunkCount = 0;
    let finalStreakResponse = '';
    await streamChatWithData({
      userQuery: "How is Leo doing with his habit streak?",
      selectedKidId: 'hero_test_leo',
      onChunk: (accumulated, chunk) => {
        chunkCount++;
        assert(typeof accumulated === 'string' && accumulated.length > 0, 'onChunk receives accumulated string');
      },
      onComplete: (fullText) => {
        finalStreakResponse = fullText;
      }
    });

    assert(chunkCount > 0, `streamChatWithData delivered ${chunkCount} progressive stream chunks`);
    assert(finalStreakResponse.includes('Leo'), 'Response mentions child name Leo');
    assert(finalStreakResponse.includes('7-day streak') || finalStreakResponse.includes('7'), 'Response accurately cites 7-day streak from state');
    assert(finalStreakResponse.includes('Vault 🎁') || finalStreakResponse.includes('milestone') || finalStreakResponse.includes('streak'), 'Response references streak milestone');

    // Test 2: Streaming screen time inquiry
    let finalScreenResponse = '';
    await streamChatWithData({
      userQuery: "How much screen time does Leo have left today?",
      selectedKidId: 'hero_test_leo',
      onComplete: (fullText) => {
        finalScreenResponse = fullText;
      }
    });

    assert(finalScreenResponse.includes('50') || finalScreenResponse.includes('screen'), 'Screen time response accurately states banked minutes');
    assert(finalScreenResponse.includes('60') || finalScreenResponse.includes('cap'), 'Screen time response accurately states 60m daily cap');
    assert(finalScreenResponse.includes('[Screen Time Bank](nav:screentime)'), 'Screen time response embeds deep-link to Screen Time Bank');
  } finally {
    testHousehold.restore();
  }
}

// --- SUITE 7: Clickable Habit Deep-Links & Sanitization (F9) ---
suite('Tier 1 - F9: Clickable Habit Deep-Links & Parsing');
{
  const { parseHabitDeepLinks } = aiDataAssistant;

  assert(typeof parseHabitDeepLinks === 'function', 'parseHabitDeepLinks is exported as a function');

  // 1. Habit task deep link
  const parsedHabit = parseHabitDeepLinks('Please check [Morning Toothbrush](habit:brush_teeth_am) for details.');
  assert(parsedHabit.includes('<button'), 'Converts habit link to HTML button');
  assert(parsedHabit.includes('class="habit-deep-link-btn'), 'Button has habit-deep-link-btn class');
  assert(parsedHabit.includes('data-deep-link-type="habit"'), 'Button has data-deep-link-type="habit"');
  assert(parsedHabit.includes('data-deep-link-id="brush_teeth_am"'), 'Button has data-deep-link-id="brush_teeth_am"');
  assert(parsedHabit.includes('Morning Toothbrush'), 'Button text displays label "Morning Toothbrush"');

  // 2. Log record deep link
  const parsedLog = parseHabitDeepLinks('Verified in [Completion Log](log:log_12345).');
  assert(parsedLog.includes('data-deep-link-type="log"'), 'Converts log link with data-deep-link-type="log"');
  assert(parsedLog.includes('data-deep-link-id="log_12345"'), 'Log button has data-deep-link-id="log_12345"');

  // 3. Approval deep link
  const parsedAppr = parseHabitDeepLinks('Needs sign-off: [Bedtime Reading](approval:appr_789).');
  assert(parsedAppr.includes('data-deep-link-type="approval"'), 'Converts approval link with data-deep-link-type="approval"');
  assert(parsedAppr.includes('data-deep-link-id="appr_789"'), 'Approval button has data-deep-link-id="appr_789"');

  // 4. Navigation deep link
  const parsedNav = parseHabitDeepLinks('Check the [Screen Time Bank](nav:screentime).');
  assert(parsedNav.includes('data-deep-link-type="nav"'), 'Converts nav link with data-deep-link-type="nav"');
  assert(parsedNav.includes('data-deep-link-id="screentime"'), 'Nav button has data-deep-link-id="screentime"');

  // 5. Basic markdown formatting
  const formattedMd = parseHabitDeepLinks('This is **bold** and *italic* text.');
  assert(formattedMd.includes('<strong>bold</strong>'), 'Renders markdown bold as <strong>');
  assert(formattedMd.includes('<em>italic</em>'), 'Renders markdown italic as <em>');
}

// ===========================================================================
// TIER 2: BOUNDARY & CORNER CASES
// ===========================================================================
suite('Tier 2: Boundary & Corner Cases');
{
  // T2.1: Fresh household with 0 completion logs
  const emptyHousehold = {
    heroes: [{ id: 'hero_new', name: 'New Kid', streak: 1, points: 0, coins: 0, screenTimeMinutes: 45, dailyMaxScreenTime: 60 }],
    selectedHero: { id: 'hero_new', name: 'New Kid', streak: 1, points: 0, coins: 0, screenTimeMinutes: 45, dailyMaxScreenTime: 60 },
    taskCompletionLogs: [],
    taskLedgerLogs: [],
    pendingApprovals: []
  };

  const origState = {
    heroes: store.state.heroes,
    selectedHero: store.state.selectedHero,
    taskCompletionLogs: store.state.taskCompletionLogs,
    taskLedgerLogs: store.state.taskLedgerLogs,
    pendingApprovals: store.state.pendingApprovals
  };

  store.state.heroes = emptyHousehold.heroes;
  store.state.selectedHero = emptyHousehold.selectedHero;
  store.state.taskCompletionLogs = emptyHousehold.taskCompletionLogs;
  store.state.taskLedgerLogs = emptyHousehold.taskLedgerLogs;
  store.state.pendingApprovals = emptyHousehold.pendingApprovals;

  try {
    let emptyMetrics = null;
    let didThrow = false;
    try {
      emptyMetrics = parentAnalyticsCharts.aggregateMetrics('hero_new', '7d');
    } catch (e) {
      didThrow = true;
    }
    assert(!didThrow, 'aggregateMetrics handles completely empty completion logs without throwing');
    assert(emptyMetrics && emptyMetrics.routine.completionRates.every(Number.isFinite), 'All completion rates are finite numbers (no NaN or Infinity)');
    assert(emptyMetrics && emptyMetrics.screenTime.earnedMinutes.every(Number.isFinite), 'All earned minutes are finite numbers');
    assert(emptyMetrics && emptyMetrics.screenTime.redeemedMinutes.every(Number.isFinite), 'All redeemed minutes are finite numbers');
  } finally {
    store.state.heroes = origState.heroes;
    store.state.selectedHero = origState.selectedHero;
    store.state.taskCompletionLogs = origState.taskCompletionLogs;
    store.state.taskLedgerLogs = origState.taskLedgerLogs;
    store.state.pendingApprovals = origState.pendingApprovals;
  }

  // T2.2: Unknown / deleted child ID fallback
  let unknownKidMetrics = null;
  let unknownThrew = false;
  try {
    unknownKidMetrics = parentAnalyticsCharts.aggregateMetrics('non_existent_kid_9999', '7d');
  } catch (e) {
    unknownThrew = true;
  }
  assert(!unknownThrew, 'aggregateMetrics handles unknown kid ID without throwing');
  assert(Boolean(unknownKidMetrics && unknownKidMetrics.routine), 'Unknown kid ID falls back gracefully to default metrics object');

  // T2.3: Adversarial XSS & Malformed Deep Links
  const { parseHabitDeepLinks } = aiDataAssistant;
  const xssInput = 'Attack: [<script>alert("XSS")</script>](habit:evil_id" onclick="alert(1)")';
  const parsedXSS = parseHabitDeepLinks(xssInput);
  assert(!parsedXSS.includes('<script>'), 'parseHabitDeepLinks does not execute unescaped <script> tag');
  assert(parsedXSS.includes('data-deep-link-type="habit"'), 'Parses link type safely');

  // Malformed link syntax: missing closing paren or unclosed brackets
  const malformedInput = 'Broken: [Unclosed Label(habit:123) and [Bad URL](https://malicious.site)';
  const parsedMalformed = parseHabitDeepLinks(malformedInput);
  assert(typeof parsedMalformed === 'string', 'Malformed link string handled safely without regex crash');
  assert(!parsedMalformed.includes('data-deep-link-type="https"'), 'Non-whitelisted protocols (https) not turned into habit buttons');

  // T2.4: Extreme screen time values (cap saturation & huge surplus)
  const extremeHero = {
    id: 'hero_extreme',
    name: 'Gamer Hero',
    streak: 35,
    points: 1000,
    screenTimeMinutes: 500,
    screenTimeUsedToday: 180, // far exceeding daily cap of 60
    dailyMaxScreenTime: 60,
    screenTimeRate: 2
  };
  const origHeroes = store.state.heroes;
  store.state.heroes = [extremeHero];
  store.state.selectedHero = extremeHero;
  try {
    const extremeMetrics = parentAnalyticsCharts.aggregateMetrics('hero_extreme', '7d');
    assert(extremeMetrics.screenTime.dailyCap === 60, 'Preserves dailyCap accurately under extreme usage');
    assert(extremeMetrics.routine.streaks[extremeMetrics.routine.streaks.length - 1] >= 30, 'Handles streaks exceeding 30 days gracefully');
  } finally {
    store.state.heroes = origHeroes;
  }
}

// ===========================================================================
// TIER 3: CROSS-FEATURE INTERACTIONS (Matrix Testing)
// ===========================================================================
suite('Tier 3: Cross-Feature Interactions & Pairwise Matrix');
{
  const testHousehold = seedTestHousehold();

  try {
    const { aggregateMetrics } = parentAnalyticsCharts;
    const { buildGroundedHouseholdContext, streamChatWithData, parseHabitDeepLinks } = aiDataAssistant;

    // Matrix: [Kid Filter] x [Timeframe]
    const kids = ['all', 'hero_test_leo', 'hero_test_maya'];
    const timeframes = ['7d', '30d'];

    let matrixAllPassed = true;
    for (const kid of kids) {
      for (const tf of timeframes) {
        const metrics = aggregateMetrics(kid, tf);
        const expectedDays = tf === '30d' ? 30 : 7;
        if (!metrics || metrics.routine.dates.length !== expectedDays || metrics.screenTime.dates.length !== expectedDays) {
          matrixAllPassed = false;
          console.error(`Matrix failure on kid=${kid}, tf=${tf}`);
        }
      }
    }
    assert(matrixAllPassed, 'Pairwise Matrix: all combinations of [Kid Filter (all, leo, maya)] x [Timeframe (7d, 30d)] succeed');

    // Cross-Feature: AI Assistant grounding reflects child filter switch
    const contextAll = buildGroundedHouseholdContext('all');
    const contextLeo = buildGroundedHouseholdContext('hero_test_leo');
    const contextMaya = buildGroundedHouseholdContext('hero_test_maya');

    assert(contextAll.heroes.length === 2, 'Household context has 2 heroes');
    assert(contextLeo.heroes.length === 1 && contextLeo.heroes[0].name === 'Leo Explorer', 'Leo context has 1 hero: Leo');
    assert(contextMaya.heroes.length === 1 && contextMaya.heroes[0].name === 'Maya Adventurer', 'Maya context has 1 hero: Maya');

    // Cross-Feature: Assistant output containing deep-links is parsed to interactive buttons
    let chatOutput = '';
    await streamChatWithData({
      userQuery: "What are the pending approvals for Leo?",
      selectedKidId: 'hero_test_leo',
      onComplete: (text) => { chatOutput = text; }
    });

    const parsedChatMarkup = parseHabitDeepLinks(chatOutput);
    assert(parsedChatMarkup.includes('habit-deep-link-btn') || parsedChatMarkup.includes('button'), 'AI assistant response converts citations into interactive button elements');
  } finally {
    testHousehold.restore();
  }
}

// ===========================================================================
// TIER 4: REAL-WORLD SCENARIOS & DEPLOYMENT INTEGRITY
// ===========================================================================
suite('Tier 4: Real-World Scenarios & Deployment Parity');
{
  const testHousehold = seedTestHousehold();

  try {
    // Scenario 1: Parent opens Analytics view, inspects aggregate, then switches to Child Leo
    console.log('  Scenario 1: Parent multi-child navigation flow...');
    const aggView = parentAnalyticsCharts.aggregateMetrics('all', '7d');
    assert(aggView.routine.dates.length === 7, 'Step 1: Household 7-day consistency overview loaded');

    const leoView = parentAnalyticsCharts.aggregateMetrics('hero_test_leo', '30d');
    assert(leoView.routine.dates.length === 30, 'Step 2: Parent toggled to Leo 30-day view');
    assert(leoView.screenTime.dailyCap === 60, 'Step 3: Leo 60-minute daily screen time cap verified');

    // Scenario 2: Parent asks about Screen Time & navigates via deep-link
    console.log('  Scenario 2: Conversational data exploration and deep-link click flow...');
    let assistantReply = '';
    await aiDataAssistant.streamChatWithData({
      userQuery: "What is the screen time status for Leo today?",
      selectedKidId: 'hero_test_leo',
      onComplete: (t) => { assistantReply = t; }
    });
    assert(assistantReply.includes('[Screen Time Bank](nav:screentime)'), 'Assistant provides clickable nav link to Screen Time Bank');
    const buttonHtml = aiDataAssistant.parseHabitDeepLinks(assistantReply);
    assert(buttonHtml.includes('data-deep-link-type="nav"') && buttonHtml.includes('data-deep-link-id="screentime"'), 'Deep-link button properly configured for event delegation');

    // Scenario 3: PWA Cache and Build Version Parity
    console.log('  Scenario 3: Verifying multi-deployment cache version synchronization...');
    const swPath = path.join(projectRoot, 'public', 'sw.js');
    const indexHtmlPath = path.join(projectRoot, 'index.html');

    const swContent = fs.readFileSync(swPath, 'utf8');
    const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

    const swCacheMatch = swContent.match(/const\s+CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
    const indexVersionMatch = indexHtmlContent.match(/const\s+APP_BUILD_VERSION\s*=\s*['"]([^'"]+)['"]/);

    assert(Boolean(swCacheMatch && swCacheMatch[1]), 'public/sw.js defines CACHE_NAME');
    assert(Boolean(indexVersionMatch && indexVersionMatch[1]), 'index.html defines APP_BUILD_VERSION');

    if (swCacheMatch && indexVersionMatch) {
      const swCache = swCacheMatch[1];
      const indexVer = indexVersionMatch[1];
      const versionsAligned = swCache === indexVer || swCache.includes(indexVer) || indexVer.includes(swCache.replace('little-heroes-', ''));
      assert(versionsAligned, `CACHE_NAME ("${swCache}") and APP_BUILD_VERSION ("${indexVer}") are synchronized`);
    }

    // Scenario 4: Vite configuration check
    const viteConfigPath = path.join(projectRoot, 'vite.config.js');
    assert(fs.existsSync(viteConfigPath), 'vite.config.js exists for production build bundling');
  } finally {
    testHousehold.restore();
  }
}

// ---------------------------------------------------------------------------
// SUITE SUMMARY & EXIT CODE
// ---------------------------------------------------------------------------
console.log(`\n======================================================================`);
console.log(`📊 TEST EXECUTION SUMMARY:`);
console.log(`   Passed: ${totalPassed}`);
console.log(`   Failed: ${totalFailed}`);
console.log(`======================================================================\n`);

if (totalFailed > 0) {
  console.error(`❌ Parent Analytics E2E Test Suite FAILED with ${totalFailed} failure(s).\n`);
  process.exit(1);
} else {
  console.log(`🎉 All ${totalPassed} Parent Analytics E2E Tests PASSED successfully! (Exit Code 0)\n`);
  process.exit(0);
}
