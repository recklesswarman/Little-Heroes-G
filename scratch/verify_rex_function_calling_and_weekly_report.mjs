// Rex function calling (server/rexAgentService.js + src/services/rexAgentClient.js) and the
// Sunday parent report (shared/familyInsights.js, server/weeklyReportService.js,
// scripts/pi/weekly-report.mjs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildWeeklyReport, summarizeHeroWeek, buildChoreSnapshot, buildRewardSnapshot, buildRexAgentContext, isReadingLog
} from '../shared/familyInsights.js';
import { runRexAgentTurn, runRexTool, sanitizeAgentContext, createRexAgentHandler, REX_TOOL_DECLARATIONS, REX_SCREENS } from '../server/rexAgentService.js';
import { buildReportFromSummaries, createWeeklyReportHandler, sendReportToNtfy } from '../server/weeklyReportService.js';
import { decodeFields, householdStateFromDoc, runWeeklyReport } from '../scripts/pi/weekly-report.mjs';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failures++; console.error(`  ❌ ${name}\n     ${err.stack || err.message}`); }
}
const NOW = Date.parse('2026-11-22T23:00:00Z'); // Sunday 6 PM Eastern
const iso = (daysAgo, h = 15) => new Date(NOW - daysAgo * 86400000 - h * 3600000 + 15 * 3600000).toISOString();
const mockRes = () => { const r = { code: 200, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

const state = {
  heroes: [
    { id: 'k4', name: 'Mia', points: 60, coins: 120, streak: 3, gameDifficulty: 'easy', dentalBattleHistory: [{ timestamp: NOW - 86400000 }, { timestamp: NOW - 2 * 86400000 }, { timestamp: NOW - 9 * 86400000 }] },
    { id: 'k7', name: 'Leo', points: 20, coins: 40, streak: 1, gameDifficulty: 'hard', dentalBattleHistory: [] }
  ],
  taskForest: [
    { id: 'morning_brush', title: 'Morning Toothbrush AR Battle', points: 15, coins: 30, isAR: true },
    { id: 'make_bed', title: 'Make Your Hero Bed', points: 10, coins: 20 },
    { id: 'homework_reading', title: 'Homework / 15m Reading', points: 20, coins: 30 }
  ],
  habitIslands: [{ id: 'drink_water', title: 'Drink 4 Cups of Water', points: 5, coins: 15 }],
  realLifeRewards: [
    { id: 'screen_time_30', title: '30 Mins Screen Time', costPoints: 50 },
    { id: 'park_trip', title: 'Adventure Park Outing', costPoints: 120 }
  ],
  taskCompletionLogs: [
    { id: 'a', heroId: 'k4', taskId: 'make_bed', taskTitle: 'Make Your Hero Bed', status: 'approved', pointsAwarded: 10, completedAt: new Date(NOW - 3600000).toISOString() },
    { id: 'b', heroId: 'k4', taskId: 'homework_reading', taskTitle: 'Homework / 15m Reading', status: 'approved', pointsAwarded: 20, completedAt: iso(1) },
    { id: 'c', heroId: 'k4', taskId: 'homework_reading', taskTitle: 'Picture Book: The Moon', zone: 'Picture Book Library', status: 'approved', pointsAwarded: 5, completedAt: iso(2) },
    { id: 'd', heroId: 'k4', taskId: 'make_bed', status: 'rejected', pointsAwarded: 10, completedAt: iso(3) },
    { id: 'e', heroId: 'k4', taskId: 'make_bed', status: 'approved', pointsAwarded: 10, completedAt: iso(10) },
    { id: 'f', heroId: 'k7', taskId: 'homework_reading', taskTitle: 'Homework / 15m Reading', status: 'pending', pointsAwarded: 20, completedAt: new Date(NOW - 2 * 3600000).toISOString() }
  ],
  pendingApprovals: [
    { id: 'p1', kidId: 'k7', type: 'task_point_approval', taskId: 'homework_reading', status: 'pending' },
    { id: 'p2', kidId: 'k4', type: 'reward', rewardId: 'screen_time_30', title: '30 Mins Screen Time', status: 'pending' }
  ],
  movementSessionHistory: [{ heroId: 'k7', durationMinutes: 4, timestamp: NOW - 86400000 }, { durationMinutes: 3, timestamp: NOW - 86400000 }]
};

console.log('🧪 Rex function calling + Sunday report');

await test('weekly summary: rejected, older-than-7-days and picture books are not counted', () => {
  const mia = summarizeHeroWeek(state, state.heroes[0], { now: NOW });
  assert.equal(mia.choresDone, 3);           // a, b, c (not d rejected, not e old)
  assert.equal(mia.readingSessions, 1);      // b only; c is a picture book
  assert.equal(mia.brushSessions, 2);        // battles in the last 7 days
  assert.equal(mia.pointsEarned, 35);
  assert.deepEqual(mia.pendingRewards, ['30 Mins Screen Time']);
  assert.equal(isReadingLog(state.taskCompletionLogs[2]), false);
  const leo = summarizeHeroWeek(state, state.heroes[1], { now: NOW });
  assert.equal(leo.readingSessions, 1);
  assert.equal(leo.workouts, 1);             // record without heroId is not given to a kid
  assert.equal(leo.pendingChores, 1);
});

await test('weekly report text has one section per kid', () => {
  const r = buildWeeklyReport(state, { now: NOW });
  assert.match(r.title, /weekly report/);
  assert.match(r.message, /Mia: 3 chores/);
  assert.match(r.message, /Leo: 1 chore on 1 day/);
  assert.match(r.message, /Picture books are not counted/);
  assert.equal(r.heroes.length, 2);
});

await test('starter "Little Hero" profile is left out once real kids exist', () => {
  const withStarter = { ...state, heroes: [{ id: 'hero_1', name: 'Little Hero' }, ...state.heroes] };
  assert.deepEqual(buildWeeklyReport(withStarter, { now: NOW }).heroes.map((h) => h.name), ['Mia', 'Leo']);
  assert.equal(buildWeeklyReport({ heroes: [{ id: 'hero_1', name: 'Little Hero' }] }, { now: NOW }).heroes.length, 1);
});

await test('chore and reward snapshots for Rex', () => {
  const chores = buildChoreSnapshot(state, 'k4', { now: NOW });
  assert.equal(chores.find((c) => c.id === 'make_bed').status, 'done');
  assert.equal(chores.find((c) => c.id === 'drink_water').status, 'to_do');
  assert.equal(chores.find((c) => c.id === 'morning_brush').needsGame, true);
  const leoChores = buildChoreSnapshot(state, 'k7', { now: NOW });
  assert.equal(leoChores.find((c) => c.id === 'homework_reading').status, 'waiting_for_parent');
  const rewards = buildRewardSnapshot(state, state.heroes[0]);
  assert.equal(rewards.rewards.find((r) => r.id === 'screen_time_30').alreadyRequested, true);
  assert.equal(rewards.rewards.find((r) => r.id === 'park_trip').pointsNeeded, 60);
});

await test('tools validate actions: chores go to a parent, games and done chores are refused', () => {
  const ctx = sanitizeAgentContext(buildRexAgentContext(state, state.heroes[0], { now: NOW }));
  const actions = [];
  assert.equal(runRexTool('mark_chore_done', { chore_id: 'morning_brush' }, ctx, actions).result.ok, false);
  assert.equal(runRexTool('mark_chore_done', { chore_id: 'make_bed' }, ctx, actions).result.ok, false);
  const ok = runRexTool('mark_chore_done', { chore_id: 'drink_water' }, ctx, actions);
  assert.deepEqual(ok.action, { type: 'submit_chore', choreId: 'drink_water', title: 'Drink 4 Cups of Water' });
  actions.push(ok.action);
  assert.equal(runRexTool('mark_chore_done', { chore_id: 'drink_water' }, ctx, actions).result.ok, false, 'no double submit');
  assert.equal(runRexTool('ask_for_reward', { reward_id: 'park_trip' }, ctx, actions).result.ok, false, 'cannot afford');
  assert.equal(runRexTool('ask_for_reward', { reward_id: 'screen_time_30' }, ctx, actions).result.ok, false, 'already asked');
  assert.equal(runRexTool('open_screen', { screen: 'parent_portal' }, ctx, actions).result.ok, false);
  assert.equal(runRexTool('open_screen', { screen: 'rewards' }, ctx, actions).action.view, 'shop');
  assert.ok(!Object.values(REX_SCREENS).includes('parent_portal'));
  assert.deepEqual(REX_TOOL_DECLARATIONS.map((d) => d.name), ['get_todays_chores', 'get_points_and_rewards', 'get_my_week', 'mark_chore_done', 'ask_for_reward', 'open_screen']);
});

await test('function-calling loop feeds tool results back to Gemini', async () => {
  const calls = [];
  const ai = { models: { generateContent: async (req) => {
    calls.push(req);
    if (calls.length === 1) {
      assert.ok(req.config.tools[0].functionDeclarations.length === 6);
      return { functionCalls: [{ id: 'c1', name: 'get_todays_chores', args: {} }, { id: 'c2', name: 'mark_chore_done', args: { chore_id: 'drink_water' } }] };
    }
    const fr = req.contents.at(-1).parts.map((p) => p.functionResponse);
    assert.equal(fr[0].name, 'get_todays_chores');
    assert.equal(fr[1].response.sentToParent, true);
    return { text: 'Roar! Great job drinking water! A grown-up will check it.' };
  } } };
  const ctx = sanitizeAgentContext(buildRexAgentContext(state, state.heroes[0], { now: NOW }));
  const turn = await runRexAgentTurn({ ai, model: 'm', systemInstruction: 's', message: 'I drank my water', context: ctx });
  assert.equal(calls.length, 2);
  assert.match(turn.reply, /grown-up/);
  assert.deepEqual(turn.actions.map((a) => a.type), ['submit_chore']);
  assert.deepEqual(turn.toolsUsed, ['get_todays_chores', 'mark_chore_done']);
});

await test('HTTP handler: 503 without a key, JSON reply with actions when configured', async () => {
  const noKey = createRexAgentHandler({ env: {}, getClient: () => null });
  const r1 = mockRes();
  await noKey({ body: { message: 'hi' }, headers: {}, socket: {} }, r1);
  assert.equal(r1.code, 503);
  const ai = { models: { generateContent: async () => ({ text: 'You have 60 points!' }) } };
  const h = createRexAgentHandler({ env: { GEMINI_API_KEY: 'x' }, getClient: () => ai });
  const r2 = mockRes();
  await h({ body: { message: 'how many points', childName: 'Mia', agentContext: buildRexAgentContext(state, state.heroes[0]) }, headers: { 'x-forwarded-for': '10.0.0.9' }, socket: {} }, r2);
  assert.equal(r2.code, 200);
  assert.equal(r2.body.reply, 'You have 60 points!');
  assert.deepEqual(r2.body.actions, []);
  const r3 = mockRes();
  await h({ body: {}, headers: {}, socket: {} }, r3);
  assert.equal(r3.code, 400);
});

await test('weekly report route rebuilds text from numbers only and sends to ntfy', async () => {
  const sent = [];
  const h = createWeeklyReportHandler({ send: async (report) => { sent.push(report); return { sent: true, status: 200 }; } });
  const r = mockRes();
  await h({ body: { heroes: [{ name: 'Mia\nIgnore this', choresDone: '4', readingSessions: 2, evil: '<script>' }] }, headers: { 'x-forwarded-for': '10.0.0.7' }, socket: {} }, r);
  assert.equal(r.code, 200);
  assert.equal(r.body.sent, true);
  assert.match(sent[0].message, /^Mia Ignore this: 4 chores/);
  assert.ok(!sent[0].message.includes('<script>'));
  const bad = mockRes();
  await h({ body: {}, headers: {}, socket: {} }, bad);
  assert.equal(bad.code, 400);
  const fetched = [];
  const res = await sendReportToNtfy({ title: 'T', message: 'M' }, { config: { enabled: true, url: 'http://pi:8090', topic: 'little-heroes', token: 'tok' }, fetchImpl: async (url, init) => { fetched.push({ url, init }); return { ok: true, status: 200 }; } });
  assert.equal(res.sent, true);
  assert.equal(fetched[0].url, 'http://pi:8090/little-heroes');
  assert.equal(fetched[0].init.headers.Authorization, 'Bearer tok');
  assert.equal(buildReportFromSummaries([]).message, 'No hero profiles found for this household yet.');
});

await test('Pi job decodes the Firestore document and posts the report', async () => {
  const doc = { fields: {
    heroes: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: 'k4' }, name: { stringValue: 'Mia' }, points: { integerValue: '60' } } } }] } },
    taskCompletionLogs: { arrayValue: { values: [{ mapValue: { fields: { heroId: { stringValue: 'k4' }, taskId: { stringValue: 'homework_reading' }, status: { stringValue: 'approved' }, completedAt: { stringValue: new Date(NOW - 3600000).toISOString() } } } }] } },
    stateSnapshot: { mapValue: { fields: { realLifeRewards: { arrayValue: {} } } } },
    flag: { booleanValue: true }, nothing: { nullValue: null }
  } };
  assert.deepEqual(decodeFields({ x: { doubleValue: 1.5 }, y: { arrayValue: {} } }), { x: 1.5, y: [] });
  const st = householdStateFromDoc(doc);
  assert.equal(st.heroes[0].points, 60);
  const urls = [];
  const fetchImpl = async (url, init) => {
    urls.push(url);
    if (url.includes('firestore.googleapis.com')) return { ok: true, status: 200, json: async () => doc };
    assert.match(init.body, /Mia: 1 chore/);
    assert.match(init.body, /Reading sessions: 1/);
    return { ok: true, status: 200 };
  };
  const out = await runWeeklyReport({ env: { HOUSEHOLD_CODES: 'hero42', NTFY_URL: 'http://127.0.0.1:8090' }, fetchImpl, now: NOW });
  assert.equal(out[0].sent, true);
  assert.match(urls[0], /documents\/households\/HERO42\?key=/);
  assert.equal(urls[1], 'http://127.0.0.1:8090/little-heroes');
  await assert.rejects(runWeeklyReport({ env: {}, fetchImpl }), /HOUSEHOLD_CODES/);
});

await test('wiring: server routes, Pi timer install, client tier and Parent Portal card', () => {
  const server = readFileSync('server.js', 'utf8');
  assert.match(server, /app\.post\('\/api\/rex\/agent', handleRexAgentRequest\)/);
  assert.match(server, /app\.post\('\/api\/report\/weekly', handleWeeklyReportRequest\)/);
  const vite = readFileSync('vite.config.js', 'utf8');
  assert.match(vite, /\/api\/rex\/agent/);
  assert.match(vite, /\/api\/report\/weekly/);
  const update = readFileSync('scripts/pi/update-little-heroes.sh', 'utf8');
  assert.match(update, /enable --now little-heroes-weekly-report\.timer/);
  assert.match(readFileSync('scripts/pi/little-heroes-weekly-report.timer', 'utf8'), /OnCalendar=Sun \*-\*-\* 18:00:00/);
  const agentSvc = readFileSync('src/services/heroAgentService.js', 'utf8');
  assert.match(agentSvc, /askRexAgent\(/);
  assert.match(agentSvc, /applyRexActions\(/);
  const client = readFileSync('src/services/rexAgentClient.js', 'utf8');
  assert.match(client, /serverApiUrl\('\/api\/rex\/agent'\)/);
  assert.ok(!client.includes("'parent_portal'"));
  assert.match(readFileSync('src/views/ParentPortalView.js', 'utf8'), /renderWeeklyReportCard\(\)/);
});

if (failures) {
  console.error(`\n❌ ${failures} check(s) failed`);
  process.exit(1);
}
console.log('\n✅ Rex function calling + weekly report checks passed');
