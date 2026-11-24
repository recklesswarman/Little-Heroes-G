// Fridge Display (#fridge), family calendar "get ready" chores, Rex's live voice (affective
// dialog + quiet quests) and consistent story pictures (Cloudflare reference images).
import './setup_mock_env.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseIcs, eventsBetween, buildCalendarPlan, kidsForEvent, prepRuleFor, formatTonightMessage, parseIcsDate } from '../shared/calendarPrep.js';
import { buildChoreSnapshot, isChoreForHeroToday } from '../shared/familyInsights.js';
import { buildFridgeSnapshot } from '../shared/fridgeSnapshot.js';
import { createCalendarService, isKnownHouseholdCode, sanitizeHeroes } from '../server/calendarService.js';
import { createFridgeHandler } from '../server/fridgeService.js';
import { buildRexLiveConfig, rexLiveModelOrder, connectRexLive, REX_LIVE_GUIDELINES } from '../server/geminiService.js';
import { parseReferenceImages, buildReferencePrompt } from '../cloudflare-worker/worker.js';
import worker from '../cloudflare-worker/worker.js';
import { store } from '../src/state/store.js';
import { renderFridgeBody, renderMonthGrid, isNightTime, FRIDGE_VIEW_NAMES } from '../src/views/FridgeDisplayView.js';
import { geminiLiveService } from '../src/services/geminiLiveService.js';
import { bedtimeStoryService } from '../src/services/bedtimeStoryService.js';
import { isReferenceCandidate } from '../src/services/bedtimeIllustrationService.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failures++; console.error(`  ❌ ${name}\n     ${err.stack || err.message}`); }
}
const mockRes = () => {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
};
const lanReq = (body = {}, headers = {}) => ({ body, headers, socket: { remoteAddress: '192.168.1.50' } });
const netReq = (body = {}, headers = {}) => ({ body, headers, socket: { remoteAddress: '34.1.2.3' } });

// Monday 2026-11-23, 7 PM Eastern
const NOW = Date.parse('2026-11-24T00:00:00Z');
const HEROES = [
  { id: 'kay', name: 'Nova', gameDifficulty: 'hard' },
  { id: 'kal', name: 'Milo', gameDifficulty: 'easy' }
];
const ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT', 'UID:lib@x', 'DTSTART;VALUE=DATE:20260901', 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH', 'EXDATE;VALUE=DATE:20261126', 'SUMMARY:Nova Library Day', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:lib@x', 'RECURRENCE-ID;VALUE=DATE:20261201', 'DTSTART;VALUE=DATE:20261202', 'SUMMARY:Nova Library Day (moved)', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:pic@x', 'DTSTART;TZID=America/New_York:20261124T083000', 'SUMMARY:Kindergarten Picture Day', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:soc@x', 'DTSTART:20261125T220000Z', 'SUMMARY:Nova soccer practice', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:dad@x', 'DTSTART;TZID=America/New_York:20261124T140000', 'SUMMARY:Dentist appointment', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:work@x', 'DTSTART;VALUE=DATE:20261125', 'SUMMARY:Work project due', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:ns@x', 'DTSTART;VALUE=DATE:20261127', 'SUMMARY:No School - Thanksgiving break', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:gone@x', 'DTSTART;VALUE=DATE:20261124', 'STATUS:CANCELLED', 'SUMMARY:Gym day', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:long@x', 'DTSTART;VALUE=DATE:20261124', 'SUMMARY:Show and', '  tell for Milo', 'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n');

console.log('🧪 Family calendar -> "get ready" chores');

await test('iCal dates: all-day, local time and UTC times land on the family day', () => {
  assert.deepEqual(parseIcsDate('20261124', ';VALUE=DATE'), { day: '2026-11-24', allDay: true, time: '' });
  assert.equal(parseIcsDate('20261124T083000', ';TZID=America/New_York').time, '8:30 AM');
  const utc = parseIcsDate('20261125T030000Z');
  assert.equal(utc.day, '2026-11-24', '3 AM UTC is the evening before in Eastern time');
});

await test('recurring events honour BYDAY, EXDATE, moved occurrences and cancellations; folded lines unfold', () => {
  const events = parseIcs(ICS);
  const occ = eventsBetween(events, '2026-11-23', '2026-12-04');
  const lib = occ.filter((o) => o.uid === 'lib@x').map((o) => o.day);
  assert.deepEqual(lib, ['2026-11-24', '2026-12-02', '2026-12-03'], 'Tue 11/24, moved 12/1 -> 12/2, Thu 12/3; Thu 11/26 excluded');
  assert.ok(!occ.some((o) => o.uid === 'gone@x'), 'cancelled event skipped');
  assert.ok(occ.some((o) => o.title === 'Show and tell for Milo'), 'folded SUMMARY line unfolded');
});

await test('kid matching: names first, then grade words, else everyone', () => {
  assert.deepEqual(kidsForEvent('Nova Library Day', HEROES), ['kay']);
  assert.deepEqual(kidsForEvent('Kindergarten Picture Day', HEROES), ['kal']);
  assert.deepEqual(kidsForEvent('2nd grade field trip', HEROES), ['kay']);
  assert.deepEqual(kidsForEvent('Soccer practice', HEROES), ['kay', 'kal']);
  // A parent's own calendar: grown-up-style events need a kid (or kids word) in the title.
  assert.deepEqual(kidsForEvent('Dentist appointment', HEROES, { requireMention: true }), []);
  assert.deepEqual(kidsForEvent('Kids dentist', HEROES, { requireMention: true }), ['kay', 'kal']);
  assert.deepEqual(kidsForEvent('Milo doctor check-up', HEROES, { requireMention: true }), ['kal']);
  assert.equal(prepRuleFor('No School - Thanksgiving break'), null, 'info-only events get no chore');
  assert.equal(prepRuleFor('Gym day').id, 'gym');
});

await test('plan: prep chores show the evening before, for the right kids, with a phone heads-up', () => {
  const plan = buildCalendarPlan(parseIcs(ICS), HEROES, { now: NOW, days: 7 });
  assert.equal(plan.today, '2026-11-23');
  const tonight = plan.prepTasks.filter((t) => t.showOn === '2026-11-23');
  const titles = tonight.map((t) => t.title).sort();
  assert.deepEqual(titles, ['Lay out your picture-day outfit', 'Pack your library book', 'Pick a show-and-tell treasure']);
  const lib = tonight.find((t) => t.ruleId === 'library');
  assert.deepEqual(lib.heroIds, ['kay']);
  assert.match(lib.id, /^cal_[a-z0-9]+_20261124_library$/);
  const soccer = plan.prepTasks.find((t) => t.ruleId === 'sports');
  assert.equal(soccer.title, 'Pack your soccer bag');
  assert.deepEqual(soccer.heroIds, ['kay']);
  assert.ok(!plan.prepTasks.some((t) => t.eventTitle === 'Dentist appointment' || t.eventTitle === 'Work project due'), "a parent's own appointments make no kid chores");
  const dentist = plan.events.find((e) => e.title === 'Dentist appointment');
  assert.ok(dentist, "the parent's appointments still show on the fridge calendar");
  assert.deepEqual(dentist.heroIds, []);
  assert.equal(soccer.showOn, '2026-11-24');
  const msg = formatTonightMessage(plan, HEROES);
  assert.match(msg, /Pack your library book" added for Nova/);
  assert.match(msg, /at 8:30 AM tomorrow/);
  assert.ok(plan.events.some((e) => e.title.startsWith('No School')), 'info events still listed for the fridge');
});

await test('calendar API: needs a household code and the family network (or relay token); relays when it has no calendar', async () => {
  const env = { GOOGLE_CALENDAR_ICS_URL: 'https://calendar.google.com/calendar/ical/x/private-abc/basic.ics', HOUSEHOLD_CODES: 'HERO-1334', LOCAL_AI_RELAY_TOKEN: 'r'.repeat(32) };
  let fetched = 0;
  const fetchImpl = async (url) => { fetched++; assert.equal(url, env.GOOGLE_CALENDAR_ICS_URL); return { ok: true, text: async () => ICS }; };
  const svc = createCalendarService({ env, fetchImpl, now: () => NOW });

  let res = mockRes();
  await svc.handlePlanRequest(lanReq({ householdCode: 'hero-1334', heroes: HEROES }), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.configured, true);
  assert.ok(res.body.prepTasks.length >= 3);

  res = mockRes();
  await svc.handlePlanRequest(lanReq({ householdCode: 'HERO-9999', heroes: HEROES }), res);
  assert.equal(res.code, 403, 'unknown household code refused');

  res = mockRes();
  await svc.handlePlanRequest(netReq({ householdCode: 'HERO-1334' }), res);
  assert.equal(res.code, 403, 'public internet refused without the relay token');

  res = mockRes();
  await svc.handlePlanRequest(netReq({ householdCode: 'HERO-1334', heroes: HEROES }, { authorization: `Bearer ${'r'.repeat(32)}` }), res);
  assert.equal(res.code, 200, 'App Hosting relay token accepted');
  assert.equal(fetched, 1, 'calendar cached between requests');

  // App Hosting: no calendar here, so it relays to the Pi with the token.
  let relayed = null;
  const hostEnv = { PI_RELAY_URL: 'https://meshlink.example.ts.net/pi-voice', PI_RELAY_TOKEN: 't'.repeat(30) };
  const host = createCalendarService({ env: hostEnv, fetchImpl: async (url, init) => { relayed = { url, init }; return { ok: true, json: async () => ({ configured: true, today: '2026-11-23', events: [], prepTasks: [] }) }; } });
  res = mockRes();
  await host.handlePlanRequest(netReq({ householdCode: 'HERO-1334', heroes: [{ id: 'kay', name: 'Nova<script>' }] }), res);
  assert.equal(res.code, 200);
  assert.equal(relayed.url, 'https://meshlink.example.ts.net/pi-voice/calendar');
  assert.equal(relayed.init.headers.Authorization, `Bearer ${'t'.repeat(30)}`);
  assert.equal(JSON.parse(relayed.init.body).heroes[0].name, 'Novascript', 'names are cleaned before relaying');

  res = mockRes();
  await createCalendarService({ env: {} }).handlePlanRequest(netReq({}), res);
  assert.equal(res.body.configured, false, 'nothing configured -> configured:false');
  assert.equal(isKnownHouseholdCode('bad code!', env), false);
  assert.equal(sanitizeHeroes([{ id: 'a', name: 'A', gameDifficulty: 'nope' }])[0].gameDifficulty, '');
});

await test('store.applyCalendarPlan adds, updates and removes only calendar chores; dashboard and Rex filter by kid and evening', () => {
  const st = store.getState();
  const parentChores = st.taskForest.filter((t) => !String(t.id).startsWith('cal_')).length;
  const plan = buildCalendarPlan(parseIcs(ICS), HEROES, { now: NOW, days: 7 });
  assert.equal(store.applyCalendarPlan(plan, { save: false }), true);
  const cal = st.taskForest.filter((t) => String(t.id).startsWith('cal_'));
  assert.equal(cal.length, plan.prepTasks.length);
  assert.equal(store.applyCalendarPlan(plan, { save: false }), false, 'same plan again changes nothing');
  const lib = cal.find((t) => t.title === 'Pack your library book');
  assert.deepEqual(lib.heroIds, ['kay']);
  assert.equal(lib.calendarShowOn, '2026-11-23');
  assert.ok(isChoreForHeroToday(lib, 'kay', '2026-11-23'));
  assert.ok(!isChoreForHeroToday(lib, 'kal', '2026-11-23'), 'not on the other kid\'s list');
  assert.ok(!isChoreForHeroToday(lib, 'kay', '2026-11-24'), 'gone after its evening');
  const snap = buildChoreSnapshot({ taskForest: st.taskForest, habitIslands: [] }, 'kal', { now: NOW });
  assert.ok(!snap.some((c) => c.title === 'Pack your library book'));
  assert.ok(snap.some((c) => c.title === 'Lay out your picture-day outfit' && c.fromCalendar));
  // Next day: the plan no longer has Monday's chores, so they are taken off.
  const later = buildCalendarPlan(parseIcs(ICS), HEROES, { now: NOW + 86400000, days: 7 });
  store.applyCalendarPlan(later, { save: false });
  assert.ok(!st.taskForest.some((t) => t.id === lib.id), 'expired calendar chore removed');
  assert.equal(st.taskForest.filter((t) => !String(t.id).startsWith('cal_')).length, parentChores, 'parent chores untouched');
  store.applyCalendarPlan({ today: '2099-01-01', prepTasks: [] }, { save: false });
  assert.equal(st.taskForest.filter((t) => String(t.id).startsWith('cal_')).length, 0);
});

console.log('🧪 Fridge Display');

const householdState = {
  householdName: 'Hero Family',
  heroes: [
    { id: 'kay', name: 'Nova', points: 40, coins: 90, streak: 4, gameDifficulty: 'hard', avatar: 'https://example.com/a.png' },
    { id: 'kal', name: 'Milo <b>', points: 12, coins: 30, streak: 2, gameDifficulty: 'easy', avatar: 'javascript:alert(1)' }
  ],
  taskForest: [
    { id: 'make_bed', title: 'Make Your Hero Bed', points: 10 },
    { id: 'cal_x_20261124_library', title: 'Pack your library book', heroIds: ['kay'], calendarShowOn: '2026-11-23' }
  ],
  habitIslands: [],
  taskCompletionLogs: [{ heroId: 'kay', taskId: 'make_bed', status: 'approved', completedAt: new Date(NOW - 3600000).toISOString() }],
  pendingApprovals: [{ kidId: 'kal', taskId: 'make_bed', status: 'pending' }]
};

await test('snapshot: chores per kid with done / waiting / to do, events and the weekly challenge', () => {
  const plan = buildCalendarPlan(parseIcs(ICS), HEROES, { now: NOW, days: 7 });
  const snap = buildFridgeSnapshot(householdState, { now: NOW, calendar: { configured: true, ...plan }, challenge: { title: 'Cinnamon Week', description: 'Beat 3 bosses' } });
  const kay = snap.heroes.find((h) => h.id === 'kay');
  const kal = snap.heroes.find((h) => h.id === 'kal');
  assert.equal(kay.done, 1);
  assert.equal(kay.total, 2, 'Nova sees the library chore');
  assert.equal(kal.total, 1, 'Milo does not');
  assert.equal(kal.waiting, 1);
  assert.equal(kal.avatar, '', 'unsafe avatar URL dropped');
  assert.equal(snap.familyDone, 1);
  assert.equal(snap.challenge.title, 'Cinnamon Week');
  assert.ok(snap.events.length > 0 && snap.calendarConfigured);
  assert.equal(snap.events.find((e) => e.title === 'Nova Library Day').who, 'Nova');
});

await test('view: escapes names, day mode lists heroes, night mode dims; #fridge routes here', () => {
  const snap = buildFridgeSnapshot(householdState, { now: NOW });
  const day = renderFridgeBody(snap, { now: new Date(2026, 10, 23, 16, 0) });
  assert.ok(day.includes('Milo &lt;b&gt;') && !day.includes('Milo <b>'), 'name escaped');
  assert.ok(day.includes('data-fridge-hero="kay"'));
  assert.ok(day.includes('Family chores today'));
  const night = renderFridgeBody(snap, { now: new Date(2026, 10, 23, 21, 0) });
  assert.ok(night.includes('Goodnight, heroes!') && !night.includes('data-fridge-hero'));
  assert.equal(isNightTime(new Date(2026, 10, 23, 5, 59)), true);
  assert.equal(isNightTime(new Date(2026, 10, 23, 6, 0)), false);
  assert.ok(renderFridgeBody(null).includes('HOUSEHOLD_CODES'));
  assert.ok(FRIDGE_VIEW_NAMES.includes('fridge'));
  const main = readFileSync('src/main.js', 'utf8');
  assert.ok(main.includes("hash === 'fridge'") && main.includes('renderFridgeDisplayView()') && main.includes('startFamilyCalendarSync()'));
  assert.ok(main.indexOf('FRIDGE_VIEW_NAMES.includes(activeView)') < main.indexOf('Strict Auth Wall Gate'), 'fridge renders before the auth wall (no sign-in on the Pi)');
});

await test('calendar card: Week / Month switch; month grid covers 6 weeks from the Sunday before the 1st', () => {
  const plan = buildCalendarPlan(parseIcs(ICS), HEROES, { now: NOW, days: 7, month: true });
  assert.equal(plan.month.month, '2026-11');
  assert.equal(plan.month.start, '2026-11-01', 'Nov 1 2026 is a Sunday');
  assert.equal(plan.month.end, '2026-12-13');
  assert.ok(plan.month.events.some((e) => e.day === '2026-11-03'), 'month includes earlier days this month');
  assert.ok(plan.month.events.some((e) => e.day === '2026-12-02'), 'and the start of next month');
  assert.ok(plan.events.every((e) => e.day >= plan.today && e.day < '2026-11-30'), 'week list stays the next 7 days');
  assert.ok(plan.prepTasks.every((t) => t.eventDay < '2026-11-30'), 'chores only for the coming week');
  const snap = buildFridgeSnapshot(householdState, { now: NOW, calendar: { configured: true, ...plan } });
  assert.equal(snap.month.events.length, plan.month.events.length);
  const week = renderFridgeBody(snap, { now: new Date(2026, 10, 23, 16, 0), calendarView: 'week' });
  assert.ok(week.includes('data-fridge-cal-view="month"') && week.includes('aria-pressed="true"') && !week.includes('data-fridge-month'));
  const month = renderFridgeBody(snap, { now: new Date(2026, 10, 23, 16, 0), calendarView: 'month' });
  assert.ok(month.includes('data-fridge-month') && month.includes('November 2026'));
  assert.equal((renderMonthGrid(snap).match(/min-h-\[4\.5rem\] rounded-lg p-1/g) || []).length, 42);
  const view = readFileSync('src/views/FridgeDisplayView.js', 'utf8');
  assert.match(view, /lh-fridge-calendar-view/, 'the choice is remembered on this screen');
  assert.match(readFileSync('server/fridgeService.js', 'utf8'), /month: true/);
});

await test('fridge API: family network only, reads HOUSEHOLD_CODES, caches, serves stale on errors', async () => {
  let reads = 0;
  let clock = NOW;
  const handler = createFridgeHandler({
    env: { HOUSEHOLD_CODES: 'HERO-1334' },
    fetchHouseholdImpl: async (code) => { reads++; assert.equal(code, 'HERO-1334'); if (reads > 1) throw new Error('offline'); return householdState; },
    calendar: { plan: async () => ({ configured: true, events: [] }) },
    now: () => clock
  });
  let res = mockRes();
  await handler(netReq(), res);
  assert.equal(res.code, 403);
  res = mockRes();
  await handler(lanReq(), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.heroes.length, 2);
  res = mockRes();
  await handler(lanReq(), res);
  assert.equal(reads, 1, 'cached for 30 s');
  clock += 60000;
  res = mockRes();
  await handler(lanReq(), res);
  assert.equal(res.body.stale, true);
  res = mockRes();
  await createFridgeHandler({ env: {} })(lanReq(), res);
  assert.equal(res.code, 404);
});

await test('Pi: desktop shortcut, launcher, calendar timer and env are installed by the deploy', () => {
  const extras = readFileSync('scripts/pi/install-extras.sh', 'utf8');
  assert.ok(extras.includes('$HOME/Desktop/little-heroes-fridge.desktop'));
  assert.ok(extras.includes('metadata::trusted true'));
  assert.ok(extras.includes('little-heroes-calendar-prep.timer'));
  const desktop = readFileSync('scripts/pi/little-heroes-fridge.desktop', 'utf8');
  assert.match(desktop, /Exec=@HOME@\/bin\/fridge-display\.sh/);
  const launcher = readFileSync('scripts/pi/fridge-display.sh', 'utf8');
  assert.ok(launcher.includes('--kiosk') && launcher.includes('#fridge'));
  assert.ok(readFileSync('.github/workflows/deploy-pi.yml', 'utf8').includes('scripts/pi/install-extras.sh'));
  assert.ok(readFileSync('scripts/pi/update-little-heroes.sh', 'utf8').includes('install-extras.sh'));
  assert.ok(readFileSync('scripts/pi/little-heroes.env.example', 'utf8').includes('GOOGLE_CALENDAR_ICS_URL='));
  assert.match(readFileSync('scripts/pi/little-heroes-calendar-prep.timer', 'utf8'), /OnCalendar=\*-\*-\* 18:30:00/);
  const server = readFileSync('server.js', 'utf8');
  for (const route of ["'/api/calendar/plan'", "'/api/local/calendar'", "'/api/fridge/snapshot'"]) assert.ok(server.includes(route), route);
  assert.ok(readFileSync('vite.config.js', 'utf8').includes("'/api/fridge/snapshot'"));
});

console.log('🧪 Rex live voice: feelings and quiet quests');

await test('Pi setup: set-calendar.sh saves the secret address privately; --check lists the week and the chores', async () => {
  const sh = readFileSync(new URL('../scripts/pi/set-calendar.sh', import.meta.url), 'utf8');
  assert.match(sh, /read -rsp/, 'the address is typed hidden');
  assert.match(sh, /chmod 600/);
  assert.match(sh, /BEGIN:VCALENDAR/, 'checks Google really returns a calendar before saving');
  assert.match(sh, /systemctl --user restart little-heroes\.service/);
  const { runCalendarCheck } = await import('../scripts/pi/calendar-prep.mjs');
  const lines = [];
  const fetchImpl = async () => new Response(ICS, { status: 200 });
  const r = await runCalendarCheck({ env: { GOOGLE_CALENDAR_ICS_URL: 'https://calendar.google.com/x/basic.ics' }, fetchImpl, now: () => NOW, heroes: HEROES, log: (l) => lines.push(l) });
  assert.ok(r.events > 0 && r.chores > 0);
  assert.ok(lines.some((l) => l.includes('Dentist appointment')), 'parent appointments listed for the fridge');
  assert.ok(!lines.some((l) => /Dentist appointment\)/.test(l)), 'but no chore for them');
});

await test('native-audio model first with affective dialog + proactive audio; standard Live model as fallback', () => {
  const order = rexLiveModelOrder({});
  assert.equal(order[0].model, 'gemini-2.5-flash-native-audio-preview-12-2025');
  assert.equal(order[1].model, 'gemini-3.1-flash-live-preview');
  const cfg = buildRexLiveConfig(order[0], { voiceName: 'Puck', systemText: 'hi' });
  assert.equal(cfg.enableAffectiveDialog, true);
  assert.deepEqual(cfg.proactivity, { proactiveAudio: true });
  const plain = buildRexLiveConfig(order[1], { voiceName: 'Puck', systemText: 'hi' });
  assert.ok(!('enableAffectiveDialog' in plain) && !('proactivity' in plain));
  assert.equal(rexLiveModelOrder({ REX_LIVE_MODEL: 'gemini-3.1-flash-live-preview' })[0].model, 'gemini-3.1-flash-live-preview');
  assert.ok(REX_LIVE_GUIDELINES.includes('[QUIET CONTEXT]') && REX_LIVE_GUIDELINES.includes('Dino Breath'));
});

await test('connectRexLive falls back when a model closes during setup', async () => {
  const tried = [];
  const ai = {
    live: {
      connect: async ({ model, config, callbacks }) => {
        tried.push({ model, affective: Boolean(config.enableAffectiveDialog) });
        if (model.includes('native-audio')) {
          setTimeout(() => callbacks.onclose({ reason: 'model not found' }), 5);
          return { close() {} };
        }
        const s = { close() {}, model };
        setTimeout(() => callbacks.onmessage({ setupComplete: {} }), 5);
        return s;
      }
    }
  };
  const seen = [];
  const live = await connectRexLive(ai, { voiceName: 'Puck', systemText: 'x', callbacks: { onmessage: (m) => seen.push(m) }, env: {} });
  assert.equal(live.model, 'gemini-3.1-flash-live-preview');
  assert.deepEqual(live.features, { affectiveDialog: false, proactiveAudio: false });
  assert.deepEqual(tried.map((t) => t.affective), [true, false]);
  assert.ok(seen.some((m) => m.setupComplete));
});

await test('quests: context goes as a quiet note, Rex is nudged after 2 misses (stuck) and 3 in a row (frustrated)', () => {
  const sent = [];
  const svc = geminiLiveService;
  const prevWs = svc.ws;
  const prevConnected = svc.isConnected;
  globalThis.WebSocket = globalThis.WebSocket || { OPEN: 1 };
  svc.ws = { readyState: globalThis.WebSocket.OPEN, send: (m) => sent.push(JSON.parse(m)) };
  svc.isConnected = true;
  svc.isSpeaking = false;
  const ctx = { gameTitle: 'Math Mountain', question: '2 + 3?', options: ['4', '5'], correctAnswerIndex: 1, currentStop: 1, skill: '2.OA.B.2', hint: 'count up' };
  svc.setQuestContext(ctx);
  svc.setQuestContext({ ...ctx }); // re-render: same question, nothing new
  assert.equal(sent.length, 1);
  assert.ok(sent[0].context && sent[0].context.includes('Math Mountain'), 'sent as {context}, not as speech');
  assert.equal(svc.reportQuestAnswer(false), null, 'one miss: Rex stays quiet');
  assert.equal(svc.reportQuestAnswer(false), 'stuck');
  assert.match(sent[1].text, /^\[CHILD IS STUCK\]/);
  assert.equal(svc.reportQuestAnswer(false), 'frustrated', 'third miss in a row');
  assert.match(sent[2].text, /^\[CHILD SEEMS FRUSTRATED\].*Dino Breath/);
  assert.equal(svc.reportQuestAnswer(true), null);
  svc.setQuestContext(null);
  svc.ws = prevWs;
  svc.isConnected = prevConnected;
  const server = readFileSync('server/geminiService.js', 'utf8');
  assert.ok(server.includes('[QUIET CONTEXT]') && server.includes('sendClientContent') && server.includes('proactive: liveFeatures.proactiveAudio'));
  assert.ok(readFileSync('src/views/QuestMapView.js', 'utf8').includes('reportQuestAnswer'));
});

console.log('🧪 Story pictures: same characters on every page (Cloudflare Workers AI)');

const jpeg = (n = 3000) => `data:image/jpeg;base64,${Buffer.alloc(n, 7).toString('base64')}`;

await test('worker: valid small references go to FLUX.2 klein as multipart input_image_0', async () => {
  assert.equal(parseReferenceImages([jpeg(), 'data:text/html;base64,AAAA', jpeg(10), jpeg(), jpeg()]).length, 2, 'bad and tiny ones dropped, max 2');
  assert.match(buildReferencePrompt('the hero flies', 1), /^Keep the exact same hero child and companion characters from image 0/);
  const calls = [];
  const env = {
    AI: { run: async (model, input) => { calls.push({ model, input }); return { image: Buffer.alloc(5000, 1).toString('base64') }; } }
  };
  const req = new Request('https://w.example/', {
    method: 'POST',
    headers: { Origin: 'https://little-heroes-quest-8842.web.app', 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'the hero flies over the moon', referenceImages: [jpeg()], seed: 42, format: 'base64' })
  });
  const res = await worker.fetch(req, env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.model, '@cf/black-forest-labs/flux-2-klein-4b');
  assert.equal(body.usedReferences, 1);
  assert.ok(calls[0].input.multipart && /multipart\/form-data; boundary=/.test(calls[0].input.multipart.contentType));
});

await test('worker: klein failure falls back to the normal text-only chain; no references = unchanged', async () => {
  const models = [];
  const env = {
    AI: { run: async (model) => { models.push(model); if (model.includes('klein')) throw new Error('capacity'); return { image: Buffer.alloc(5000, 1).toString('base64') }; } }
  };
  const mk = (extra) => new Request('https://w.example/', { method: 'POST', headers: { Origin: 'https://little-heroes-quest-8842.web.app' }, body: JSON.stringify({ prompt: 'p', format: 'base64', ...extra }) });
  let body = await (await worker.fetch(mk({ referenceImages: [jpeg()] }), env)).json();
  assert.equal(body.model, '@cf/black-forest-labs/flux-1-schnell');
  assert.equal(body.fallbackFrom[0].model, '@cf/black-forest-labs/flux-2-klein-4b');
  models.length = 0;
  body = await (await worker.fetch(mk({}), env)).json();
  assert.deepEqual(models, ['@cf/black-forest-labs/flux-1-schnell'], 'no references: FLUX.1 schnell only');
});

await test('app: chapter 2+ sends the story\'s first real picture; the proxy forwards it; no other image service', () => {
  const session = { acts: [{ imageUrl: 'data:image/svg+xml;utf8,<svg/>', imageUrlB: jpeg() }, { imageUrl: jpeg(4000) }] };
  assert.equal(bedtimeStoryService.storyReferenceImage(session, 1), '', 'chapter 1 sets the look');
  assert.equal(bedtimeStoryService.storyReferenceImage(session, 2), session.acts[0].imageUrlB, 'SVG placeholder skipped');
  assert.equal(isReferenceCandidate('https://x/y.png'), false);
  const client = readFileSync('src/services/bedtimeIllustrationService.js', 'utf8');
  assert.ok(client.includes('referenceImages,') && client.includes('this.apiUrl'));
  assert.ok(client.includes('little-heroes-free-image-api'), 'still the Cloudflare Worker');
  const proxy = readFileSync('server/imageGenService.js', 'utf8');
  assert.ok(proxy.includes('referenceImages.length ? { referenceImages }'));
  const story = readFileSync('src/services/bedtimeStoryService.js', 'utf8');
  assert.equal((story.match(/referenceImageUrls: this\.storyReferenceImages\(session, actNumber\)/g) || []).length, 2, 'both pictures send the sheet + first picture');
});

if (failures) {
  console.error(`\n❌ ${failures} fridge / calendar / Rex live / story picture check(s) failed`);
  process.exit(1);
}
console.log('\n✅ Fridge, calendar, Rex live voice and story picture checks passed');
process.exit(0);
