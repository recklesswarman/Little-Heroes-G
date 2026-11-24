// Fridge "what to wear" weather card (Open-Meteo), weather get-ready chores, district
// no-school days (Worcester Public Schools calendar) and "school days only" chores.
import './setup_mock_env.js';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BUNDLED_SCHOOL_CALENDAR, parseDistrictCalendar, schoolDayInfo, schoolGroupFor, noSchoolEvents, schoolYearFor, districtCalendarUrl
} from '../shared/schoolCalendar.js';
import { parseOpenMeteo, whatToWear, weatherPrepTasks, fridgeWeather, openMeteoUrl, describeWeatherCode } from '../shared/weather.js';
import { buildCalendarPlan, formatTonightMessage } from '../shared/calendarPrep.js';
import { isChoreForHeroToday, buildChoreSnapshot } from '../shared/familyInsights.js';
import { buildFridgeSnapshot } from '../shared/fridgeSnapshot.js';
import { createWeatherService, weatherPlaceFromEnv } from '../server/weatherService.js';
import { createSchoolCalendarLoader, chooseSchoolCalendar } from '../server/schoolCalendarService.js';
import { createCalendarService, sanitizeHeroes } from '../server/calendarService.js';
import { renderFridgeBody, renderWeather, renderMonthGrid } from '../src/views/FridgeDisplayView.js';
import { store } from '../src/state/store.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failures++; console.error(`  ❌ ${name}\n     ${err.stack || err.message}`); }
}

const MILO = { id: 'h_milo', name: 'Milo', age: 4 };
const NOVA = { id: 'h_nova', name: 'Nova', age: 7 };
const HEROES = [MILO, NOVA];

// The district page's tables, as the page serves them (HTML) and as Markdown.
const PAGE_HTML = `<h2>November 2026</h2><table><tr><th>Sunday</th><th>Monday</th></tr>
<tr><td>1</td><td>2</td><td>3 - No School - Staff Development Day</td><td>4</td><td>5</td><td>6<br>End of Quarter 1</td><td>7</td></tr>
<tr><td>22</td><td>23</td><td>24</td><td>25 - No School - Thanksgiving</td><td>26 - No School - Thanksgiving</td><td>27 - No School - Thanksgiving</td><td>28</td></tr></table>
<h2>August 2027</h2><table><tr><td>30</td><td>31 -First Day of School</td></tr></table>
<h2>September 2027</h2><table><tr><td>3 - First Day for PreK &amp; K</td><td>6 - No School -Labor Day</td></tr></table>
<h2>June 2028</h2><table><tr><td>2 - Pre-K and Kindergarten Open House<br>No School for Pre-K and Kindergarten Only</td><td>16 - End of Quarter 4 / Last day of School</td><td>19 - No School - Juneteenth Day</td></tr></table>
<h2>May 2028</h2><table><tr><td>26 - Last day of School for Seniors</td></tr></table>`;
const PAGE_MD = `## October 2026\n\n| Sunday | Monday |\n| 11 | 12 - No School - Indigenous People’s Day / Columbus Day | 13 |\n\n## March 2027\n\n| 21 | 22 | 26 - No School Day | 27 |`;

const FORECAST = {
  current: { temperature_2m: 41.4, weather_code: 3 },
  daily: {
    time: ['2026-11-23', '2026-11-24', '2026-11-25'],
    weather_code: [3, 63, 0],
    temperature_2m_max: [47.2, 52.1, 30.4],
    temperature_2m_min: [33.9, 44.0, 18.0],
    precipitation_probability_max: [10, 85, 0],
    snowfall_sum: [0, 0, 0],
    uv_index_max: [2, 1, 2],
    wind_speed_10m_max: [8, 15, 5]
  }
};
// Monday 2026-11-23, 7 PM Eastern
const NOW = Date.parse('2026-11-24T00:00:00Z');

console.log('\n🏫 School calendar');
await test('bundled 2026-27 year: first/last day, Thanksgiving, holiday break, Pre-K/K-only June 2', () => {
  const c = BUNDLED_SCHOOL_CALENDAR;
  assert.equal(c.firstDay, '2026-08-31');
  assert.equal(c.firstDayPreK, '2026-09-03');
  assert.equal(c.lastDay, '2027-06-17');
  for (const d of ['2026-11-25', '2026-11-26', '2026-11-27', '2026-12-24', '2027-02-16', '2027-04-19']) assert.ok(c.days.some((x) => x.date === d), d);
  assert.deepEqual(c.days.find((x) => x.date === '2027-06-02').groups, ['prek_k']);
});
await test('parses the district page (HTML and Markdown)', () => {
  const p = parseDistrictCalendar(PAGE_HTML);
  assert.equal(p.firstDay, '2027-08-31');
  assert.equal(p.firstDayPreK, '2027-09-03');
  assert.equal(p.lastDay, '2028-06-16', 'seniors\' last day is not the last day');
  assert.deepEqual(p.days.map((d) => d.date), ['2026-11-03', '2026-11-25', '2026-11-26', '2026-11-27', '2027-09-06', '2028-06-02', '2028-06-19']);
  assert.equal(p.days.find((d) => d.date === '2026-11-03').label, 'Staff Development Day');
  assert.equal(p.days.find((d) => d.date === '2027-09-06').label, 'Labor Day');
  assert.deepEqual(p.days.find((d) => d.date === '2028-06-02').groups, ['prek_k']);
  assert.ok(!p.days.some((d) => d.date === '2026-11-06'), 'End of Quarter is not a day off');
  const m = parseDistrictCalendar(PAGE_MD);
  assert.deepEqual(m.days.map((d) => [d.date, d.label]), [['2026-10-12', 'Indigenous Peoples Day / Columbus Day'], ['2027-03-26', 'No School Day']]);
});
await test('kids are grouped by age (4 = Pre-K/K, 7 = elementary) unless a group is set', () => {
  assert.equal(schoolGroupFor(MILO), 'prek_k');
  assert.equal(schoolGroupFor(NOVA), 'elementary');
  assert.equal(schoolGroupFor({ age: 4, schoolGroup: 'elementary' }), 'elementary');
  assert.equal(schoolGroupFor({}), 'elementary');
});
await test('school day per kid: weekends, holidays, summer, Pre-K/K start and the Pre-K/K-only day', () => {
  assert.deepEqual(schoolDayInfo('2026-11-23', NOVA), { school: true, reason: '' });
  assert.equal(schoolDayInfo('2026-11-28', NOVA).reason, 'weekend');
  assert.equal(schoolDayInfo('2026-11-26', MILO).reason, 'Thanksgiving');
  assert.equal(schoolDayInfo('2026-09-01', NOVA).school, true);
  assert.equal(schoolDayInfo('2026-09-01', MILO).reason, 'summer', 'Pre-K starts Sept 3');
  assert.equal(schoolDayInfo('2027-06-02', MILO).school, false);
  assert.equal(schoolDayInfo('2027-06-02', NOVA).school, true);
  assert.equal(schoolDayInfo('2027-07-14', NOVA).reason, 'summer');
  assert.equal(schoolDayInfo('2028-01-12', NOVA).school, true, 'a year with no calendar: weekdays are school days');
});
await test('no-school events skip weekends and name only the kids a Pre-K/K-only day applies to', () => {
  const ev = noSchoolEvents('2026-11-23', '2026-11-30', HEROES);
  assert.deepEqual(ev.map((e) => e.day), ['2026-11-25', '2026-11-26', '2026-11-27']);
  assert.equal(ev[0].title, 'No school: Thanksgiving');
  assert.deepEqual(ev[0].heroIds, []);
  const june = noSchoolEvents('2027-06-01', '2027-06-03', HEROES);
  assert.deepEqual(june.map((e) => [e.day, e.heroIds]), [['2027-06-02', ['h_milo']]]);
  assert.equal(noSchoolEvents('2027-06-01', '2027-06-03', [NOVA]).length, 0);
  assert.equal(schoolYearFor('2027-03-01'), '2026-2027');
  assert.match(districtCalendarUrl('2027-2028'), /calendar-2027-2028$/);
});

console.log('\n🌦️ Weather');
await test('Open-Meteo URL needs no key and asks for Fahrenheit', () => {
  const u = openMeteoUrl({ lat: 1, lon: 2 });
  assert.match(u, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
  assert.match(u, /temperature_unit=fahrenheit/);
  assert.doesNotMatch(u, /apikey/i);
  assert.equal(describeWeatherCode(63).label, 'Rain');
  assert.equal(describeWeatherCode(73).emoji, '❄️');
});
await test('parses the forecast and picks what to wear', () => {
  const w = parseOpenMeteo(FORECAST);
  assert.deepEqual(w.current, { temp: 41, code: 3, label: 'Cloudy', emoji: '☁️' });
  assert.equal(w.days.length, 3);
  assert.deepEqual([w.days[1].high, w.days[1].low, w.days[1].rainChance], [52, 44, 85]);
  assert.deepEqual(whatToWear(w.days[0]).map((t) => t.id), ['coat']);
  assert.deepEqual(whatToWear(w.days[1]).map((t) => t.id), ['coat', 'rain']);
  assert.deepEqual(whatToWear(w.days[2]).map((t) => t.id), ['winter']);
  assert.deepEqual(whatToWear({ high: 88, low: 70, rainChance: 0, code: 0, uv: 8, snow: 0 }).map((t) => t.id), ['shorts', 'sun']);
  assert.deepEqual(whatToWear({ high: 70, low: 62, rainChance: 0, code: 1, uv: 3, snow: 0 }).map((t) => t.id), ['comfy']);
  assert.deepEqual(whatToWear({ high: 28, low: 20, rainChance: 90, code: 73, uv: 1, snow: 3 }).map((t) => t.id), ['winter', 'snow']);
  const f = fridgeWeather(w, '2026-11-23');
  assert.equal(f.days.length, 2);
  assert.equal(f.days[1].wear[1].text, 'Raincoat and rain boots');
});
await test('weather chore tonight only for kids with school tomorrow', () => {
  const w = parseOpenMeteo(FORECAST);
  const tasks = weatherPrepTasks(w, '2026-11-23', HEROES);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, 'cal_wx_2026-11-24_umbrella');
  assert.equal(tasks[0].showOn, '2026-11-23');
  assert.equal(tasks[0].eventTitle, 'Rain tomorrow (85%)');
  assert.deepEqual(tasks[0].heroIds, ['h_milo', 'h_nova']);
  // Tuesday night: Wednesday is Thanksgiving break, so no mittens chore even though it is cold.
  const wed = weatherPrepTasks(w, '2026-11-24', HEROES, { schoolKidsFor: (d) => HEROES.filter((h) => schoolDayInfo(d, h).school) });
  assert.equal(wed.length, 0);
  assert.equal(weatherPrepTasks(null, '2026-11-23', HEROES).length, 0);
});

console.log('\n📅 Calendar plan, fridge and chores');
const weather = parseOpenMeteo(FORECAST);
const plan = { configured: true, ...buildCalendarPlan([], HEROES, { now: NOW, days: 7, month: true, weather }) };
await test('calendar plan carries no-school days, the forecast, the weather chore and the school calendar', () => {
  assert.deepEqual(plan.events.map((e) => e.day), ['2026-11-25', '2026-11-26', '2026-11-27']);
  assert.ok(plan.events.every((e) => e.school && e.emoji === '🏠'));
  assert.ok(plan.month.events.some((e) => e.day === '2026-11-11' && e.title === 'No school: Veterans Day'));
  assert.ok(plan.prepTasks.some((t) => t.id === 'cal_wx_2026-11-24_umbrella'));
  assert.equal(plan.weather, weather);
  assert.equal(plan.noSchool[0].day, '2026-11-25');
  assert.equal(plan.schoolCalendar.lastDay, '2027-06-17');
  const msg = formatTonightMessage(plan, HEROES);
  assert.match(msg, /☔ Rain tomorrow \(85%\): "Pack your umbrella and raincoat" added for Milo & Nova\./);
});
await test('server: weather cached for an hour and kept on a failed fetch', async () => {
  let calls = 0;
  let t = 0;
  let fail = false;
  const svc = createWeatherService({ env: {}, now: () => t, fetchImpl: async (url) => { calls++; assert.match(url, /latitude=42\.2459/); if (fail) throw new Error('down'); return { ok: true, json: async () => FORECAST }; } });
  assert.equal((await svc.get()).days.length, 3);
  await svc.get();
  assert.equal(calls, 1);
  t = 61 * 60 * 1000;
  fail = true;
  assert.equal((await svc.get()).days.length, 3, 'stale copy kept');
  assert.equal(await createWeatherService({ env: { WEATHER_DISABLED: 'true' } }).get(), null);
  assert.deepEqual(weatherPlaceFromEnv({ WEATHER_LAT: '40.5', WEATHER_LON: '-70.1' }), { lat: 40.5, lon: -70.1 });
  assert.deepEqual(weatherPlaceFromEnv({ WEATHER_LAT: 'x' }), { lat: 42.2459, lon: -71.8059 });
});
await test('server: the Pi\'s saved school calendar wins when it is the same year or newer', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'lh-school-'));
  try {
    const file = path.join(dir, 'cal.json');
    const load = createSchoolCalendarLoader({ env: { SCHOOL_CALENDAR_FILE: file } });
    assert.equal(load(), BUNDLED_SCHOOL_CALENDAR, 'no file yet');
    writeFileSync(file, JSON.stringify({ year: '2027-2028', firstDay: '2027-08-30', lastDay: '2028-06-16', days: [{ date: '2027-09-06', label: 'Labor Day' }] }));
    assert.equal(load().year, '2027-2028');
    assert.equal(chooseSchoolCalendar({ firstDay: '2025-08-27', lastDay: '2026-06-17', days: [] }), BUNDLED_SCHOOL_CALENDAR, 'older year ignored');
    writeFileSync(file, 'not json');
    assert.equal(createSchoolCalendarLoader({ env: { SCHOOL_CALENDAR_FILE: file } })(), BUNDLED_SCHOOL_CALENDAR);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
await test('server: calendar service adds the forecast and keeps kids\' ages for grade groups', async () => {
  assert.deepEqual(sanitizeHeroes([{ id: 'a', name: 'Milo', age: 4, schoolGroup: 'prek_k' }, { id: 'b', age: 'x', schoolGroup: 'nope' }]).map((h) => [h.age, h.schoolGroup]), [[4, 'prek_k'], [null, '']]);
  const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nDTSTART;VALUE=DATE:20261124\nSUMMARY:Nova library day\nEND:VEVENT\nEND:VCALENDAR';
  const svc = createCalendarService({
    env: { GOOGLE_CALENDAR_ICS_URL: 'https://example.com/cal.ics' },
    now: () => NOW,
    fetchImpl: async () => ({ ok: true, text: async () => ics }),
    weather: { get: async () => weather },
    schoolCalendar: () => BUNDLED_SCHOOL_CALENDAR
  });
  const p = await svc.plan(HEROES, { days: 7 });
  assert.equal(p.weather.days.length, 3);
  assert.ok(p.prepTasks.some((t) => t.weather));
  assert.ok(p.prepTasks.some((t) => /library/i.test(t.title)));
  assert.deepEqual(p.events.map((e) => e.day), ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']);
});
await test('"school days only" chores rest on holidays and weekends, per kid', () => {
  const c = { id: 'pack', title: 'Pack your backpack', schoolDaysOnly: true };
  assert.equal(isChoreForHeroToday(c, 'h_nova', '2026-11-23', { hero: NOVA }), true);
  assert.equal(isChoreForHeroToday(c, 'h_nova', '2026-11-26', { hero: NOVA }), false);
  assert.equal(isChoreForHeroToday(c, 'h_nova', '2026-11-28', { hero: NOVA }), false);
  assert.equal(isChoreForHeroToday(c, 'h_milo', '2027-06-02', { hero: MILO }), false);
  assert.equal(isChoreForHeroToday(c, 'h_nova', '2027-06-02', { hero: NOVA }), true);
  assert.equal(isChoreForHeroToday({ id: 'x' }, 'h_nova', '2026-11-26', { hero: NOVA }), true, 'other chores unchanged');
  const state = { heroes: HEROES, taskForest: [c, { id: 'bed', title: 'Make bed' }] };
  const thanksgiving = Date.parse('2026-11-26T15:00:00Z');
  assert.deepEqual(buildChoreSnapshot(state, 'h_nova', { now: thanksgiving }).map((x) => x.id), ['bed']);
  assert.deepEqual(buildChoreSnapshot(state, 'h_nova', { now: NOW }).map((x) => x.id), ['pack', 'bed']);
});
await test('store: Parent Portal toggles and new chores keep the school-days flag', () => {
  const s = store.getState();
  const task = s.taskForest[0];
  assert.equal(store.setTaskSchoolDaysOnly(task.id, 'Task Forest', true), true);
  assert.equal(task.schoolDaysOnly, true);
  store.setTaskSchoolDaysOnly(task.id, 'Task Forest', false);
  assert.equal('schoolDaysOnly' in task, false);
  store.addNewTask({ title: 'Pack backpack', zone: 'Task Forest', schoolDaysOnly: true });
  assert.equal(store.getState().taskForest.at(-1).schoolDaysOnly, true);
  assert.equal(store.setTaskSchoolDaysOnly('nope', 'Task Forest', true), false);
  // Weather chores read naturally.
  store.applyCalendarPlan({ today: '2026-11-23', prepTasks: plan.prepTasks.filter((t) => t.weather) });
  const wx = store.getState().taskForest.find((t) => t.id === 'cal_wx_2026-11-24_umbrella');
  assert.equal(wx.desc, 'Rain tomorrow (85%). Get ready tonight!');
});
await test('fridge: weather card, no-school days on the calendar and meals card', () => {
  const meals = { plan: { settings: {} }, school: null, days: [{ date: '2026-11-25', noSchool: false, meals: {} }, { date: '2026-11-24', meals: {} }] };
  const snap = buildFridgeSnapshot({ heroes: HEROES }, { now: NOW, calendar: plan, meals });
  assert.equal(snap.weather.days[0].date, '2026-11-23');
  assert.equal(snap.events[0].school, true);
  assert.equal(snap.meals.days.find((d) => d.date === '2026-11-25').noSchool, true);
  assert.equal(snap.meals.days.find((d) => d.date === '2026-11-24').noSchool, false);
  const evening = new Date('2026-11-23T19:00:00');
  const morning = new Date('2026-11-23T08:00:00');
  assert.match(renderWeather(snap, { now: morning }), /What to wear today[\s\S]*Warm coat/);
  assert.match(renderWeather(snap, { now: new Date('2026-11-23T16:00:00') }), /What to wear tomorrow[\s\S]*Raincoat and rain boots/);
  const day = renderFridgeBody(snap, { now: morning, calendarView: 'week' });
  assert.match(day, /data-fridge-weather/);
  assert.match(day, /data-fridge-no-school[\s\S]*No school: Thanksgiving/);
  assert.match(renderFridgeBody(snap, { now: evening }), /data-fridge-weather/, 'night screen shows tomorrow\'s clothes');
  assert.match(renderMonthGrid(snap), /amber/);
  assert.equal(renderWeather({ ...snap, weather: null }), '');
  // Without a calendar plan the forecast passed in directly is used.
  assert.equal(buildFridgeSnapshot({ heroes: HEROES }, { now: NOW, weather }).weather.days.length, 2);
});

if (failures) {
  console.error(`\n❌ ${failures} weather / school calendar check(s) failed`);
  process.exit(1);
}
console.log('\n✅ Weather and school calendar checks passed');
process.exit(0);
