// School breakfast/lunch import (MealViewer), the family meal planner, its API for linked apps,
// the Fridge Display "School meals" card, the Parent Portal Meal Planner tab and the
// "Tomorrow's lunch" line in the 6:30 PM alert.
import './setup_mock_env.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseMealViewer, cleanFoodName, mealViewerUrl, schoolSlugFrom, sanitizeSchoolMenu, joinChoices, DEFAULT_SCHOOL
} from '../shared/schoolMenu.js';
import {
  normalizeMealPlan, mergeMealPlans, upsertMealEntry, removeMealEntry, updateMealSettings, buildMealDays, formatTomorrowLunch, listMealEntries
} from '../shared/mealPlan.js';
import { buildFridgeSnapshot } from '../shared/fridgeSnapshot.js';
import { createMealsHandlers, createSchoolMenuFetcher, buildHouseholdMealDays } from '../server/mealsService.js';
import { createFridgeHandler } from '../server/fridgeService.js';
import { encodeValue, decodeValue, updateHouseholdField } from '../server/householdReader.js';
import { createApiCors } from '../server/corsPolicy.js';
import { tomorrowLunchLine, runCalendarPrep } from './../scripts/pi/calendar-prep.mjs';
import { renderFridgeBody } from '../src/views/FridgeDisplayView.js';
import { store } from '../src/state/store.js';
import { renderMealPlannerTab, _setSchoolMenuForTest, _currentWeekForTest } from '../src/views/MealPlannerPanel.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failures++; console.error(`  ❌ ${name}\n     ${err.stack || err.message}`); }
}
const mockRes = () => {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = () => r;
  return r;
};

const RAW = JSON.parse(readFileSync(new URL('./fixtures/mealviewer_canterbury.json', import.meta.url), 'utf8'));
const MENU = parseMealViewer(RAW);
// Monday 2026-11-23, 7 PM Eastern
const NOW = Date.parse('2026-11-24T00:00:00Z');
const schoolMenuStub = async () => ({ ...MENU, slug: DEFAULT_SCHOOL.slug });

console.log('🧪 School menu import (MealViewer)');

await test('MealViewer URL uses MM-DD-YYYY and rejects bad input', () => {
  assert.equal(mealViewerUrl('CanterburyStreetMagnet', '2026-11-23', '2026-11-27'), 'https://api.mealviewer.com/api/v4/school/CanterburyStreetMagnet/11-23-2026/11-27-2026/0');
  assert.throws(() => mealViewerUrl('../evil', '2026-11-23', '2026-11-27'));
  assert.throws(() => mealViewerUrl('CanterburyStreetMagnet', 'nope', '2026-11-27'));
  assert.equal(schoolSlugFrom('https://schools.mealviewer.com/school/CanterburyStreetMagnet'), 'CanterburyStreetMagnet');
  assert.equal(schoolSlugFrom('<script>'), '');
});

await test('cafeteria codes are cleaned out of food names', () => {
  assert.equal(cleanFoodName('APPLES,RAW,WITH SKIN - WPS26'), 'Apples');
  assert.equal(cleanFoodName('Minh Vegetable Fried Rice WPS 27 Sec'), 'Minh Vegetable Fried Rice');
  assert.equal(cleanFoodName('Hummus USDA Bean (ED) WPS 27'), 'Hummus');
  assert.equal(cleanFoodName('WG Trix Cereal'), 'Trix Cereal');
  assert.equal(cleanFoodName('ZeeZee Blueberry Lemon IW WPS 27'), 'ZeeZee Blueberry Lemon');
  assert.equal(cleanFoodName('Rice & Beans Ele WPS 27'), 'Rice & Beans');
  assert.equal(cleanFoodName('Clementines, RAW WPS 26 SEC'), 'Clementines');
  assert.equal(cleanFoodName('Yoplait Yogurt Bulk WPS 27'), 'Yoplait Yogurt');
});

await test('breakfast and lunch parse into main dishes + extras; after-school blocks are left out', () => {
  assert.equal(MENU.school, 'Canterbury Street Magnet');
  const mon = MENU.days.find((d) => d.date === '2026-11-23');
  assert.deepEqual(mon.lunch.main.map((m) => m.name), ['Mandarin Orange Chicken', 'Sunbutter & Jelly'], 'duplicate Sunbutter & Jelly collapsed');
  assert.ok(mon.lunch.extras.some((e) => e.group === 'fruit' && e.name === 'Apples'));
  assert.ok(mon.lunch.extras.some((e) => e.group === 'milk'));
  assert.ok(!JSON.stringify(MENU).includes('Turkey Wrap'), 'after-school supper excluded');
  assert.ok(!JSON.stringify(MENU).includes('Tiger Grahams'), 'after-school snack excluded');
  const wed = MENU.days.find((d) => d.date === '2026-12-02');
  assert.equal(wed.breakfast.main[0].name, 'Yoplait Yogurt', 'an ENTREES item at breakfast counts as a main dish');
  assert.ok(wed.lunch.main.some((m) => m.name === 'Pepperoni Pizza' && m.emoji === '🍕'));
});

await test('holidays come back as no-school days', () => {
  for (const d of ['2026-11-25', '2026-11-26', '2026-11-27']) assert.equal(MENU.days.find((x) => x.date === d).noSchool, true);
});

await test('wire payloads are re-validated', () => {
  const s = sanitizeSchoolMenu({ school: 'X', days: [{ date: '2026-11-23', lunch: { main: [{ name: '<img src=x onerror=1>' }], extras: [{ name: 'Milk', group: 'evil' }] } }, { date: 'bad' }] });
  assert.equal(s.days.length, 1);
  assert.equal(s.days[0].lunch.extras[0].group, 'side');
  assert.equal(joinChoices(['A', 'B', 'C']), 'A, B or C');
});

console.log('🧪 Meal plan model');

await test('entries upsert, delete (tombstone) and list', () => {
  let { plan, entry } = upsertMealEntry(null, { date: '2026-11-24', mealType: 'dinner', title: 'Tacos' }, { now: NOW });
  assert.ok(entry.id.startsWith('2026-11-24-dinner-'));
  ({ plan } = upsertMealEntry(plan, { id: entry.id, notes: 'extra cheese' }, { now: NOW + 1 }));
  assert.equal(plan.entries[entry.id].title, 'Tacos', 'a partial update keeps the other fields');
  assert.equal(plan.entries[entry.id].notes, 'extra cheese');
  assert.throws(() => upsertMealEntry(plan, { date: '2026-11-24', mealType: 'brunch', title: 'x' }), /mealType/);
  assert.throws(() => upsertMealEntry(plan, { date: '2026-11-24', mealType: 'dinner', title: '' }), /title/);
  const r = removeMealEntry(plan, entry.id, { now: NOW + 2 });
  assert.equal(r.removed, true);
  assert.equal(r.plan.entries[entry.id].deleted, true);
  assert.equal(listMealEntries(r.plan).length, 0);
});

await test('merge: newest version of each entry and of the settings wins; tombstones beat older copies', () => {
  const a = upsertMealEntry(null, { id: 'x', date: '2026-11-24', mealType: 'dinner', title: 'Pasta' }, { now: NOW }).plan;
  const b = upsertMealEntry(a, { id: 'x', title: 'Pizza night' }, { now: NOW + 10 }).plan;
  const c = upsertMealEntry(a, { id: 'y', date: '2026-11-25', mealType: 'dinner', title: 'Soup' }, { now: NOW + 5 }).plan;
  const m = mergeMealPlans(c, b, { now: NOW + 20 });
  assert.equal(m.entries.x.title, 'Pizza night');
  assert.equal(m.entries.y.title, 'Soup');
  const del = removeMealEntry(m, 'y', { now: NOW + 30 }).plan;
  assert.equal(mergeMealPlans(m, del, { now: NOW + 40 }).entries.y.deleted, true);
  assert.equal(mergeMealPlans(del, m, { now: NOW + 40 }).entries.y.deleted, true, 'an older copy cannot bring a deleted meal back');
  const s1 = updateMealSettings(a, { showAllSchoolItems: true }, { now: NOW + 50 }).plan;
  assert.equal(mergeMealPlans(s1, a, { now: NOW + 60 }).settings.showAllSchoolItems, true);
});

await test('normalize drops junk, old meals and unsafe links', () => {
  const p = normalizeMealPlan({ entries: {
    ok: { id: 'ok', date: '2026-11-24', mealType: 'dinner', title: 'Tacos', recipeUrl: 'javascript:alert(1)', updatedAt: NOW },
    old: { id: 'old', date: '2026-01-01', mealType: 'dinner', title: 'Old', updatedAt: NOW },
    bad: { id: 'bad', date: '2026-11-24', mealType: 'dinner' }
  }, settings: { schoolSlug: '../../x' } }, { now: NOW });
  assert.deepEqual(Object.keys(p.entries), ['ok']);
  assert.equal(p.entries.ok.recipeUrl, '');
  assert.equal(p.settings.schoolSlug, DEFAULT_SCHOOL.slug);
});

await test('week view: main dishes by default, all items with the toggle, packed lunch replaces school lunch, weekends skipped', () => {
  let plan = upsertMealEntry(null, { id: 'p', date: '2026-11-24', mealType: 'lunch', title: 'Turkey roll-ups', replacesSchool: true }, { now: NOW }).plan;
  plan = upsertMealEntry(plan, { id: 'd', date: '2026-11-23', mealType: 'dinner', title: 'Tacos' }, { now: NOW }).plan;
  const days = buildMealDays({ plan, school: MENU, from: '2026-11-23', days: 7 });
  assert.deepEqual(days.map((d) => d.date), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']);
  const mon = days[0];
  assert.deepEqual(mon.meals.lunch.school.names, ['Mandarin Orange Chicken', 'Sunbutter & Jelly']);
  assert.equal(mon.meals.lunch.school.extras.length, 0, 'extras hidden by default');
  assert.equal(mon.meals.dinner.family[0].title, 'Tacos');
  assert.equal(days[1].meals.lunch.school, null, 'packed lunch hides the school lunch');
  assert.ok(days[1].meals.breakfast.school, 'breakfast still from school');
  assert.equal(days[2].noSchool, true);
  const all = buildMealDays({ plan: updateMealSettings(plan, { showAllSchoolItems: true }, { now: NOW }).plan, school: MENU, from: '2026-11-23', days: 1 });
  assert.ok(all[0].meals.lunch.school.names.includes('Carrot Sticks'));
});

await test('tomorrow lunch line: school choices, packed lunch, no school', () => {
  const plan = normalizeMealPlan(null);
  const [tue] = buildMealDays({ plan, school: MENU, from: '2026-11-24', days: 1 });
  assert.equal(formatTomorrowLunch(tue), "🍱 Tomorrow's school lunch: Glazed Chicken Drumstick, Sunbutter & Jelly, Pizza Lunchable or Turkey Sandwich.");
  const packed = upsertMealEntry(plan, { date: '2026-11-24', mealType: 'lunch', title: 'PB sandwich', replacesSchool: true }, { now: NOW }).plan;
  assert.match(formatTomorrowLunch(buildMealDays({ plan: packed, school: MENU, from: '2026-11-24', days: 1 })[0]), /PB sandwich \(packed/);
  assert.match(formatTomorrowLunch(buildMealDays({ plan, school: MENU, from: '2026-11-25', days: 1 })[0]), /No school/);
  assert.equal(formatTomorrowLunch(buildMealDays({ plan, school: MENU, from: '2026-11-28', days: 1, skipWeekends: false })[0]), '', 'Saturday: nothing');
});

console.log('🧪 Server: school menu, Meal Planner API, fridge, alert');

await test('school menu fetcher caches and serves stale copies when MealViewer is down', async () => {
  let calls = 0;
  let up = true;
  let t = NOW;
  const fetcher = createSchoolMenuFetcher({ now: () => t, fetchImpl: async (url) => { calls++; assert.match(url, /api\.mealviewer\.com/); if (!up) throw new Error('down'); return { ok: true, json: async () => RAW }; } });
  const a = await fetcher('CanterburyStreetMagnet', '2026-11-23', 5);
  await fetcher('CanterburyStreetMagnet', '2026-11-23', 5);
  assert.equal(calls, 1);
  assert.equal(a.days.length, 6);
  up = false;
  t += 4 * 3600 * 1000;
  const b = await fetcher('CanterburyStreetMagnet', '2026-11-23', 5);
  assert.equal(b.stale, true);
});

await test('Firestore value encoding round-trips', () => {
  const v = { a: 1, b: 1.5, c: 'x', d: [true, null], e: { f: 'g' } };
  assert.deepEqual(decodeValue(encodeValue(v)), v);
});

await test('household field update: precondition write with retry on conflict', async () => {
  const reqs = [];
  let conflicts = 1;
  const doc = { fields: { stateSnapshot: { mapValue: { fields: { mealPlan: encodeValue({ version: 1, entries: {} }) } } } }, updateTime: '2026-11-24T00:00:00Z' };
  const fetchImpl = async (url, opts = {}) => {
    reqs.push({ url, opts });
    if (!opts.method) return { ok: true, json: async () => doc };
    if (conflicts-- > 0) return { ok: false, status: 400, text: async () => 'FAILED_PRECONDITION' };
    return { ok: true, json: async () => ({}) };
  };
  const out = await updateHouseholdField('ABCD1234', 'stateSnapshot.mealPlan', (cur) => ({ ...cur, touched: true }), { extra: { lastWriterSessionId: 'meals-api' }, config: { projectId: 'p', apiKey: 'k', databaseId: '(default)' }, fetchImpl });
  assert.equal(out.touched, true);
  const patches = reqs.filter((r) => r.opts.method === 'PATCH');
  assert.equal(patches.length, 2, 'retried once after the conflict');
  assert.match(patches[1].url, /updateMask\.fieldPaths=stateSnapshot\.mealPlan/);
  assert.match(patches[1].url, /currentDocument\.updateTime=/);
  const body = JSON.parse(patches[1].opts.body);
  assert.ok(body.fields.stateSnapshot.mapValue.fields.mealPlan);
  assert.equal(body.fields.lastWriterSessionId.stringValue, 'meals-api');
});

function apiHarness(env = { MEALS_API_TOKEN: 't'.repeat(32), HOUSEHOLD_CODES: 'ABCD1234' }) {
  const store = { state: { heroes: [], mealPlan: null } };
  const h = createMealsHandlers({
    env,
    now: () => NOW,
    schoolMenu: schoolMenuStub,
    fetchHouseholdImpl: async () => store.state,
    updateField: async (code, field, fn, { extra }) => {
      assert.equal(field, 'stateSnapshot.mealPlan');
      assert.equal(extra.lastWriterSessionId, 'meals-api');
      store.state.mealPlan = await fn(store.state.mealPlan);
      return store.state.mealPlan;
    }
  });
  const auth = { authorization: `Bearer ${'t'.repeat(32)}` };
  const call = async (handler, { params = {}, query = {}, body = {}, headers = auth } = {}) => {
    const res = mockRes();
    let passed = false;
    h.requireToken({ headers }, res, () => { passed = true; });
    if (!passed) return res;
    await handler({ params, query, body, headers }, res);
    return res;
  };
  return { h, call, store };
}

await test('API is off without a token and rejects a wrong one', async () => {
  const off = apiHarness({ HOUSEHOLD_CODES: 'ABCD1234' });
  assert.equal((await off.call(off.h.getSettings)).code, 503);
  const on = apiHarness();
  assert.equal((await on.call(on.h.getSettings, { headers: { authorization: 'Bearer nope' } })).code, 401);
  assert.equal((await on.call(on.h.getSettings, { headers: {} })).code, 401);
});

await test('API: add, change, list, delete meals and change settings', async () => {
  const { h, call, store: s } = apiHarness();
  let r = await call(h.putEntry, { params: { id: 'vault-1' }, body: { date: '2026-11-24', mealType: 'dinner', title: 'Chicken tacos', recipeUrl: 'https://recipes.example/42', source: 'Recipe Vault' } });
  assert.equal(r.code, 200);
  assert.equal(r.body.entry.source, 'Recipe Vault');
  r = await call(h.postEntry, { body: { date: '2026-11-25', mealType: 'lunch', title: 'Roll-ups', replacesSchool: true } });
  assert.equal(r.code, 201);
  assert.equal(r.body.entry.source, 'api');
  r = await call(h.putEntry, { params: { id: 'vault-1' }, body: { title: 'Fish tacos' } });
  assert.equal(r.body.entry.date, '2026-11-24');
  r = await call(h.listEntries, { query: { from: '2026-11-23', to: '2026-11-30' } });
  assert.deepEqual(r.body.entries.map((e) => e.title), ['Fish tacos', 'Roll-ups']);
  r = await call(h.putEntry, { params: { id: 'bad id!' }, body: {} });
  assert.equal(r.code, 400);
  r = await call(h.putEntry, { params: { id: 'x' }, body: { date: 'tomorrow', mealType: 'dinner', title: 'x' } });
  assert.equal(r.code, 400);
  r = await call(h.deleteEntry, { params: { id: 'vault-1' } });
  assert.equal(r.code, 200);
  r = await call(h.deleteEntry, { params: { id: 'vault-1' } });
  assert.equal(r.code, 404);
  r = await call(h.patchSettings, { body: { showAllSchoolItems: true, evil: 1 } });
  assert.equal(r.body.settings.showAllSchoolItems, true);
  assert.equal('evil' in s.state.mealPlan.settings, false);
  r = await call(h.patchSettings, { body: { schoolSlug: '../x' } });
  assert.equal(r.code, 400);
});

await test('API plan: school + family meals together', async () => {
  const { h, call } = apiHarness();
  await call(h.putEntry, { params: { id: 'd1' }, body: { date: '2026-11-23', mealType: 'dinner', title: 'Tacos' } });
  const r = await call(h.getPlan, { query: { from: '2026-11-23', days: '5' } });
  assert.equal(r.code, 200);
  assert.equal(r.body.days[0].meals.lunch.school.main[0].name, 'Mandarin Orange Chicken');
  assert.equal(r.body.days[0].meals.dinner.family[0].title, 'Tacos');
  assert.equal(r.body.school.name, 'Canterbury Street Magnet');
});

await test('public school route validates the school name', async () => {
  const h = createMealsHandlers({ env: {}, schoolMenu: schoolMenuStub, now: () => NOW });
  const bad = mockRes();
  await h.handleSchool({ query: { school: '../../etc' } }, bad);
  assert.equal(bad.code, 400);
  const ok = mockRes();
  await h.handleSchool({ query: { from: '2026-11-23', days: '5' } }, ok);
  assert.equal(ok.body.school, 'Canterbury Street Magnet');
});

await test('CORS: Meal Planner API allows listed recipe-app origins with Authorization, nothing else widens', () => {
  const cors = createApiCors({ env: { MEALS_API_ORIGINS: 'https://recipes.example' } });
  const pre = (path, origin) => { const res = mockRes(); cors({ method: 'OPTIONS', path, headers: { origin } }, res, () => {}); return res; };
  const ok = pre('/meals/v1/entries', 'https://recipes.example');
  assert.equal(ok.code, 204);
  assert.match(ok.headers['Access-Control-Allow-Headers'], /Authorization/);
  assert.match(ok.headers['Access-Control-Allow-Methods'], /DELETE/);
  assert.equal(pre('/gemini/chat', 'https://recipes.example').code, 403, 'other routes still closed to that origin');
});

await test('fridge snapshot from the Pi carries the meals card data', async () => {
  const state = { heroes: [{ id: 'kay', name: 'Nova' }], mealPlan: upsertMealEntry(null, { id: 'd', date: '2026-11-23', mealType: 'dinner', title: 'Tacos' }, { now: NOW }).plan };
  const handler = createFridgeHandler({
    env: { HOUSEHOLD_CODES: 'ABCD1234', FRIDGE_ALLOW_ANY_NETWORK: 'true' },
    fetchHouseholdImpl: async () => state,
    calendar: { plan: async () => ({ events: [], configured: false }) },
    schoolMenu: schoolMenuStub,
    now: () => Date.parse('2026-11-23T15:00:00Z')
  });
  const res = mockRes();
  await handler({ headers: {}, socket: { remoteAddress: '192.168.1.50' } }, res);
  const meals = res.body.meals;
  assert.ok(meals, 'meals in snapshot');
  assert.equal(meals.days[0].date, '2026-11-23');
  assert.equal(meals.days[0].meals.lunch.school.main[0].name, 'Mandarin Orange Chicken');
  assert.equal(meals.days[0].meals.dinner.family[0].title, 'Tacos');
});

await test('fridge card renders today + next lunch, a week view, and escapes text', () => {
  const plan = upsertMealEntry(null, { id: 'd', date: '2026-11-23', mealType: 'dinner', title: '<b>Tacos</b>' }, { now: NOW }).plan;
  const meals = { plan, school: MENU, days: buildMealDays({ plan, school: MENU, from: '2026-11-23', days: 8 }) };
  const snap = buildFridgeSnapshot({ heroes: [{ id: 'k', name: 'K' }] }, { now: Date.parse('2026-11-23T15:00:00Z'), meals });
  const noon = new Date(2026, 10, 23, 12, 0);
  const today = renderFridgeBody(snap, { now: noon });
  assert.match(today, /School meals/);
  assert.match(today, /Mandarin Orange Chicken/);
  assert.match(today, /Tomorrow's lunch/);
  assert.match(today, /Glazed Chicken Drumstick/);
  assert.ok(!today.includes('<b>Tacos</b>') && today.includes('&lt;b&gt;Tacos&lt;/b&gt;'));
  assert.ok(!today.includes('Carrot Sticks'), 'extras hidden by default');
  localStorage.setItem('lh-fridge-meal-view', 'week');
  const week = renderFridgeBody(snap, { now: noon });
  assert.match(week, /No school/);
  assert.match(week, /data-fridge-meal-day="2026-11-24"/);
  localStorage.removeItem('lh-fridge-meal-view');
  const showAll = buildFridgeSnapshot({ heroes: [] }, { now: Date.parse('2026-11-23T15:00:00Z'), meals: { ...meals, days: buildMealDays({ plan, school: MENU, from: '2026-11-23', days: 8, showAll: true }) } });
  assert.match(renderFridgeBody(showAll, { now: noon }), /Carrot Sticks/);
  const night = renderFridgeBody(snap, { now: new Date(2026, 10, 23, 21, 0) });
  assert.match(night, /Glazed Chicken Drumstick/, "tomorrow's lunch on the night screen");
});

await test("6:30 PM alert adds tomorrow's lunch, and still works without a calendar", async () => {
  const state = { heroes: [{ id: 'kay', name: 'Nova' }], mealPlan: null };
  const line = await tomorrowLunchLine(state, { env: {}, now: () => NOW, schoolMenu: schoolMenuStub });
  assert.match(line, /Glazed Chicken Drumstick/);
  const off = await tomorrowLunchLine({ mealPlan: updateMealSettings(null, { tomorrowLunchAlert: false }).plan }, { env: {}, now: () => NOW, schoolMenu: schoolMenuStub });
  assert.equal(off, '');
  const sent = [];
  const fetchImpl = async (url, opts = {}) => {
    if (String(url).includes('firestore')) return { ok: true, json: async () => ({ fields: { heroes: encodeValue(state.heroes) } }) };
    sent.push({ url, opts });
    return { ok: true, status: 200 };
  };
  const r = await runCalendarPrep({ env: { HOUSEHOLD_CODES: 'ABCD1234', NTFY_URL: 'http://127.0.0.1:8090', NTFY_TOPIC: 'little-heroes' }, fetchImpl, now: () => NOW, schoolMenu: schoolMenuStub });
  assert.equal(r.sent, true);
  assert.match(sent[0].opts.body, /Tomorrow's school lunch/);
});

console.log('🧪 Store + Parent Portal');

await test('store saves meals and merges cloud copies per entry', () => {
  const e = store.saveMealEntry({ date: '2026-11-24', mealType: 'dinner', title: 'Spaghetti' });
  assert.equal(store.getMealPlan().entries[e.id].title, 'Spaghetti');
  const remote = upsertMealEntry(null, { id: 'remote-1', date: '2026-11-25', mealType: 'dinner', title: 'Chili', source: 'Recipe Vault' }, { now: Date.now() }).plan;
  store.hydrateFromCloud({ syncCode: store.getState().household?.syncCode || 'TEST1234', stateSnapshot: { mealPlan: remote } });
  const plan = store.getMealPlan();
  assert.equal(plan.entries[e.id].title, 'Spaghetti', 'local meal kept');
  assert.equal(plan.entries['remote-1'].title, 'Chili', 'remote meal added');
  assert.equal(store.deleteMealEntry(e.id), true);
  store.updateMealSettings({ showAllSchoolItems: true });
  assert.equal(store.getMealPlan().settings.showAllSchoolItems, true);
  store.updateMealSettings({ showAllSchoolItems: false });
});

await test('Parent Portal Meal Planner tab renders school + family meals and settings', () => {
  const from = _currentWeekForTest();
  // Re-date the fixture's Monday lunch into the current week so the tab shows it.
  const menu = { school: MENU.school, days: [{ ...MENU.days[0], date: from }] };
  _setSchoolMenuForTest(store.getMealPlan().settings.schoolSlug, from, menu);
  store.saveMealEntry({ id: 'tab-test', date: from, mealType: 'dinner', title: 'Taco <night>' });
  const html = renderMealPlannerTab();
  assert.match(html, /Meal Planner/);
  assert.match(html, /Mandarin Orange Chicken/);
  assert.match(html, /Taco &lt;night&gt;/);
  assert.match(html, /Show all school items/);
  assert.match(html, /meal-lunch-alert/);
  assert.match(html, /\/api\/meals\/v1/);
  store.deleteMealEntry('tab-test');
});

if (failures) {
  console.error(`\n❌ ${failures} meal planner check(s) failed`);
  process.exit(1);
}
console.log('\n✅ School meal planner checks passed');
process.exit(0);
