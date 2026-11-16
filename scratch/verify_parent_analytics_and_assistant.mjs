/**
 * verify_parent_analytics_and_assistant.mjs
 * End-to-end verification suite for Parent & Developmental Analytics Dashboard,
 * Apache ECharts visualization options, and embedded AI Data Assistant.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Running Parent Analytics & AI Assistant Verification Suite...\n');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function runAsyncTests() {
  // Test 1: Package.json and ECharts dependency
  test('ECharts dependency is installed in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert(pkg.dependencies.echarts, 'echarts must be in package.json dependencies');
  });

  // Test 2: PWA Cache and Build Version synchronization
  test('CACHE_NAME in public/sw.js matches APP_BUILD_VERSION in index.html', () => {
    const swContent = fs.readFileSync(path.join(rootDir, 'public/sw.js'), 'utf8');
    const indexContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

    const swMatch = swContent.match(/const CACHE_NAME = '([^']+)';/);
    const indexMatch = indexContent.match(/const APP_BUILD_VERSION = '([^']+)';/);

    assert(swMatch && swMatch[1], 'CACHE_NAME must be found in public/sw.js');
    assert(indexMatch && indexMatch[1], 'APP_BUILD_VERSION must be found in index.html');
    const swVersion = swMatch[1].replace(/^little-heroes-/, '');
    const htmlVersion = indexMatch[1].replace(/^little-heroes-/, '');
    assert.strictEqual(swVersion, htmlVersion, `Version tags must match: sw=${swVersion} vs html=${htmlVersion}`);
    assert(swMatch[1].includes('parent-analytics-echarts'), 'Version string must reflect analytics release');
  });

  // Test 3: ParentAnalyticsCharts modular imports & options
  const {
    aggregateMetrics,
    getRoutineConsistencyOption,
    getScreenTimeBalanceOption,
    renderAnalyticsChartsSection
  } = await import('../src/components/ParentAnalyticsCharts.js');

  const { store } = await import('../src/state/store.js');

  test('renderAnalyticsChartsSection returns structured DOM with kid pills, timeframe toggle, and chart containers', () => {
    const html = renderAnalyticsChartsSection('all', '7d');
    assert(html.includes('id="chart-routine-consistency"'), 'Must contain routine consistency chart container');
    assert(html.includes('id="chart-screentime-balance"'), 'Must contain screen time balance chart container');
    assert(html.includes('data-analytics-timeframe="7d"'), 'Must contain 7d timeframe button');
    assert(html.includes('data-analytics-timeframe="30d"'), 'Must contain 30d timeframe button');
    assert(html.includes('data-analytics-kid="all"'), 'Must contain All Kids selector pill');
  });

  test('aggregateMetrics generates correct 7-day metrics for household aggregate', () => {
    const metrics = aggregateMetrics('all', '7d');
    assert(metrics.routine, 'Must return routine metrics');
    assert(metrics.screenTime, 'Must return screenTime metrics');
    assert.strictEqual(metrics.routine.dates.length, 7, '7-day timeframe must yield exactly 7 dates');
    assert.strictEqual(metrics.routine.completionRates.length, 7, 'Must have 7 completion rate data points');
    assert.strictEqual(metrics.routine.streaks.length, 7, 'Must have 7 streak data points');
    assert.strictEqual(metrics.screenTime.earnedMinutes.length, 7, 'Must have 7 earned minutes data points');
    assert.strictEqual(metrics.screenTime.redeemedMinutes.length, 7, 'Must have 7 redeemed minutes data points');
    assert.strictEqual(metrics.screenTime.netBalance.length, 7, 'Must have 7 net balance data points');
    assert(typeof metrics.screenTime.dailyCap === 'number', 'Daily cap must be a number');
  });

  test('aggregateMetrics generates correct 30-day metrics with dataZoom enabled', () => {
    const metrics = aggregateMetrics('all', '30d');
    assert.strictEqual(metrics.routine.dates.length, 30, '30-day timeframe must yield exactly 30 dates');
    assert.strictEqual(metrics.routine.is30d, true, 'is30d flag must be true');

    const routineOption = getRoutineConsistencyOption(metrics.routine);
    assert(Array.isArray(routineOption.dataZoom), '30-day routine option must include dataZoom components');

    const screenTimeOption = getScreenTimeBalanceOption(metrics.screenTime);
    assert(Array.isArray(screenTimeOption.dataZoom), '30-day screen time option must include dataZoom components');
  });

  test('getRoutineConsistencyOption configures dual Y-axis, milestone pins, and high-contrast dark theme', () => {
    const metrics = aggregateMetrics('all', '7d');
    const option = getRoutineConsistencyOption(metrics.routine);

    assert.strictEqual(option.yAxis.length, 2, 'Must have dual Y-axis');
    assert.strictEqual(option.yAxis[0].max, 100, 'Left Y-axis max must be 100%');
    assert.strictEqual(option.series.length, 2, 'Must have 2 series (Bar completion + Line streak)');
    assert.strictEqual(option.series[0].type, 'bar', 'Series 0 must be bar chart');
    assert.strictEqual(option.series[1].type, 'line', 'Series 1 must be line chart');
    assert(option.series[1].markPoint, 'Streak series must include markPoint for milestones');
    assert(typeof option.tooltip.formatter === 'function', 'Tooltip must define custom formatter function');
  });

  test('getScreenTimeBalanceOption configures grouped bars, net balance curve, and daily cap markLine', () => {
    const metrics = aggregateMetrics('all', '7d');
    const option = getScreenTimeBalanceOption(metrics.screenTime);

    assert.strictEqual(option.series.length, 3, 'Must have 3 series (Earned, Redeemed, Net Curve)');
    assert.strictEqual(option.series[0].name, 'Earned Responsibility (min)');
    assert.strictEqual(option.series[1].name, 'Screen Time Redeemed (min)');
    assert.strictEqual(option.series[2].name, 'Net Balance (min)');
    assert(option.series[0].markLine, 'Earned bar must have markLine for daily screen limit cap');
  });

  // Test 4: AI Data Assistant grounded context & streaming
  const {
    buildGroundedHouseholdContext,
    parseHabitDeepLinks,
    streamChatWithData
  } = await import('../src/services/aiDataAssistantService.js');

  test('buildGroundedHouseholdContext extracts grounded metrics, streaks, and isolated kid profiles', () => {
    const context = buildGroundedHouseholdContext('all');
    assert(context.selectedScope, 'Must contain selectedScope');
    assert(Array.isArray(context.heroes), 'heroes must be an array');
    assert(context.heroes.length > 0, 'Must have at least one hero profile');
    assert(typeof context.metrics.approvalRatePercentage === 'number', 'Must compute approvalRatePercentage');
    assert(Array.isArray(context.recentLogs), 'recentLogs must be an array');
    assert(Array.isArray(context.pendingApprovals), 'pendingApprovals must be an array');

    // Test specific kid isolation
    const firstHeroId = context.heroes[0].id;
    const singleKidContext = buildGroundedHouseholdContext(firstHeroId);
    assert.strictEqual(singleKidContext.heroes.length, 1, 'Single kid scope must isolate to exactly one hero');
    assert.strictEqual(singleKidContext.heroes[0].id, firstHeroId, 'Hero ID must match');
  });

  test('parseHabitDeepLinks converts [Label](type:id) tokens into interactive button elements', () => {
    const input = 'Great work on [Morning Toothbrush](habit:brush_teeth_am) and [Toy Cleanup](log:compl_123)! Check [Pending Chore](approval:app_456) or go to [Screen Bank](nav:screentime).';
    const parsed = parseHabitDeepLinks(input);

    assert(parsed.includes('class="habit-deep-link-btn'), 'Must generate habit-deep-link-btn class');
    assert(parsed.includes('data-deep-link-type="habit"'), 'Must encode habit deep-link type');
    assert(parsed.includes('data-deep-link-id="brush_teeth_am"'), 'Must encode habit ID');
    assert(parsed.includes('data-deep-link-type="log"'), 'Must encode log deep-link type');
    assert(parsed.includes('data-deep-link-id="compl_123"'), 'Must encode log ID');
    assert(parsed.includes('data-deep-link-type="approval"'), 'Must encode approval deep-link type');
    assert(parsed.includes('data-deep-link-id="app_456"'), 'Must encode approval ID');
    assert(parsed.includes('data-deep-link-type="nav"'), 'Must encode nav deep-link type');
    assert(parsed.includes('data-deep-link-id="screentime"'), 'Must encode nav target');
  });

  test('streamChatWithData produces streaming chunks grounded in household state', async () => {
    let chunkCount = 0;
    let accumulated = '';
    let completedText = '';

    await streamChatWithData({
      userQuery: 'How is the routine streak and screen time balance looking?',
      selectedKidId: 'all',
      onChunk: (acc, chunk) => {
        chunkCount++;
        accumulated = acc;
      },
      onComplete: (fullText) => {
        completedText = fullText;
      }
    });

    assert(chunkCount > 1, `Must stream multiple progressive chunks (got ${chunkCount})`);
    assert(completedText.length > 20, 'Completed response must be substantive');
    assert.strictEqual(accumulated, completedText, 'Final accumulated text must match completedText');
    assert(completedText.includes('streak') || completedText.includes('Screen') || completedText.includes('habit'),
      'Response must be grounded in habits/streaks/screen time');
  });

  // Test 5: ParentPortalView integration verification
  test('ParentPortalView exports renderParentPortalView and includes analytics overhaul markup', async () => {
    const { renderParentPortalView, setActiveAdminTab } = await import('../src/views/ParentPortalView.js');
    setActiveAdminTab('analytics');
    const html = renderParentPortalView();

    assert(html.includes('Parent & Developmental Analytics Dashboard'), 'Must contain Analytics Dashboard header');
    assert(html.includes('id="chart-routine-consistency"'), 'Must contain Chart 1 container');
    assert(html.includes('id="chart-screentime-balance"'), 'Must contain Chart 2 container');
    assert(html.includes('id="parent-data-chat-panel"'), 'Must contain Embedded AI Data Assistant panel');
    assert(html.includes('id="chat-streaming-bubble"'), 'Must contain active streaming container');
    assert(html.includes('id="analytics-chat-form"'), 'Must contain chat input form');
    assert(html.includes('analytics-query-chip'), 'Must contain quick query suggestion chips');
  });

  console.log('\n=============================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAsyncTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
