// Fridge extras: NASA space picture, Wikipedia "On this day" (kid-filtered), sunset-based
// evening look and the bedtime countdown.
import './setup_mock_env.js';
import assert from 'node:assert/strict';
import {
  apodUrl, parseApod, firstSentence, onThisDayUrl, pickOnThisDay, cleanKidFact, plainKidFact, sunUrl, parseSun, eveningState, formatCountdown
} from '../shared/fridgeExtras.js';
import { buildFridgeSnapshot, fridgeExtras } from '../shared/fridgeSnapshot.js';
import { createFridgeExtrasService } from '../server/fridgeExtrasService.js';
import { renderFridgeBody, renderSpaceCard, renderHistoryCard, renderBedtimeCountdown, isNightTime } from '../src/views/FridgeDisplayView.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failures++; console.error(`  ❌ ${name}\n     ${err.stack || err.message}`); }
}

const APOD = { date: '2026-11-23', title: 'Saturn\'s Rings', media_type: 'image', url: 'https://apod.nasa.gov/apod/image/2611/saturn.jpg', copyright: 'Jane Star', explanation: 'Saturn has beautiful rings made of ice and rock. They are very wide but very thin. Scientists study them a lot.' };
const OTD = { selected: [
  { year: 1863, text: 'Thousands of soldiers were killed in a battle near the river.', pages: [{ title: 'Battle' }] },
  { year: 1876, text: 'A new city library building was finished in town.', pages: [{ title: 'Park', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Park' } } }] },
  { year: 1969, text: 'Apollo 12 astronauts landed on the Moon.', pages: [{ titles: { normalized: 'Apollo 12' }, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Apollo_12' } } }] },
  { year: 1990, text: 'A president was elected after a close election.', pages: [] }
] };
const SUN = { status: 'OK', results: { sunrise: '2026-11-23T11:44:00+00:00', sunset: '2026-11-23T21:13:00+00:00' } };

await test('NASA APOD: demo key by default, image or video thumbnail, one-line fact', () => {
  assert.match(apodUrl(), /api_key=DEMO_KEY/);
  assert.match(apodUrl('abc', '2026-11-23'), /api_key=abc.*date=2026-11-23/);
  const a = parseApod(APOD);
  assert.equal(a.title, 'Saturn\'s Rings');
  assert.equal(a.fact, 'Saturn has beautiful rings made of ice and rock.');
  assert.equal(a.credit, 'Jane Star');
  assert.equal(parseApod({ ...APOD, media_type: 'video', url: 'https://youtube.com/x' }), null);
  assert.equal(parseApod({ ...APOD, media_type: 'video', thumbnail_url: 'https://img.youtube.com/t.jpg' }).image, 'https://img.youtube.com/t.jpg');
  assert.equal(parseApod({ ...APOD, url: 'javascript:alert(1)' }), null);
  assert.equal(parseApod({ ...APOD, copyright: '' }).credit, 'NASA');
  assert.ok(firstSentence('x'.repeat(300), 50).length <= 51);
});
await test('On this day: grown-up events dropped, kid topics first, AI answer checked', () => {
  assert.equal(onThisDayUrl(3, 7), 'https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/03/07');
  const picks = pickOnThisDay(OTD);
  assert.deepEqual(picks.map((p) => p.year), [1969, 1876]);
  assert.equal(picks[0].title, 'Apollo 12');
  assert.equal(plainKidFact(picks[0]), 'On this day in 1969, Apollo 12 astronauts landed on the Moon!');
  assert.equal(cleanKidFact('On this day in 1969, astronauts walked on the Moon!'), 'On this day in 1969, astronauts walked on the Moon!');
  assert.equal(cleanKidFact('SKIP'), null);
  assert.equal(cleanKidFact('Here is a fact: the Moon!'), null);
  assert.equal(cleanKidFact('On this day in 1863, a battle happened!'), null);
  assert.equal(cleanKidFact(`On this day in 1900, ${'word '.repeat(40)}!`), null);
});
await test('sunset and the evening / bedtime states', () => {
  assert.match(sunUrl(42.2, -71.8, '2026-11-23'), /formatted=0.*date=2026-11-23/);
  const sun = parseSun(SUN);
  assert.equal(sun.sunset, '2026-11-23T21:13:00.000Z');
  assert.equal(parseSun({ status: 'INVALID_REQUEST' }), null);
  const sunset = new Date(2026, 10, 23, 16, 13).toISOString();
  assert.deepEqual(eveningState(new Date(2026, 10, 23, 15, 0), { bedtimeHour: 20, sunset }), { night: false, evening: false, bedtimeIn: null, bedtimeHour: 20 });
  assert.equal(eveningState(new Date(2026, 10, 23, 16, 30), { bedtimeHour: 20, sunset }).evening, true);
  assert.equal(eveningState(new Date(2026, 10, 23, 18, 15), { bedtimeHour: 20, sunset }).bedtimeIn, 105);
  assert.equal(eveningState(new Date(2026, 10, 23, 20, 0), { bedtimeHour: 20 }).night, true);
  assert.equal(eveningState(new Date(2026, 10, 23, 19, 30), { bedtimeHour: 19 }).night, true, 'parent bedtime 7 PM');
  assert.equal(eveningState(new Date(2026, 10, 23, 18, 30), { bedtimeHour: 3 }).bedtimeIn, 90, 'odd values fall back to 8 PM');
  assert.equal(isNightTime(new Date(2026, 10, 23, 5, 59)), true);
  assert.equal(formatCountdown(105), '1 hour 45 minutes');
  assert.equal(formatCountdown(60), '1 hour');
  assert.equal(formatCountdown(1), '1 minute');
});
await test('server: one fetch a day per extra, AI fact used when valid, stale copy on failure', async () => {
  const calls = [];
  let t = Date.parse('2026-11-23T15:00:00Z');
  let fail = false;
  const fetchImpl = async (url) => {
    calls.push(new URL(url).hostname);
    if (fail) throw new Error('offline');
    const body = url.includes('nasa') ? APOD : url.includes('wikipedia') ? OTD : SUN;
    return { ok: true, json: async () => body };
  };
  const svc = createFridgeExtrasService({ env: {}, fetchImpl, now: () => t, kidFact: async () => 'On this day in 1969, astronauts visited the Moon!' });
  const a = await svc.get();
  assert.equal(a.space.title, 'Saturn\'s Rings');
  assert.equal(a.history.text, 'On this day in 1969, astronauts visited the Moon!');
  assert.equal(a.history.link, 'https://en.wikipedia.org/wiki/Apollo_12');
  assert.ok(a.sun.sunset);
  await svc.get();
  assert.equal(calls.length, 3, 'cached for the day');
  t += 24 * 3600 * 1000;
  fail = true;
  const b = await svc.get();
  assert.equal(b.space.title, 'Saturn\'s Rings', 'yesterday\'s copy while offline');
  const noAi = createFridgeExtrasService({ env: {}, fetchImpl: async (url) => ({ ok: true, json: async () => (url.includes('nasa') ? APOD : url.includes('wikipedia') ? OTD : SUN) }), kidFact: async () => 'Something unsafe' });
  assert.equal((await noAi.get()).history.text, 'On this day in 1969, Apollo 12 astronauts landed on the Moon!');
  assert.deepEqual(await createFridgeExtrasService({ env: { FRIDGE_EXTRAS_DISABLED: 'true' } }).get(), { space: null, history: null, sun: null });
});
await test('fridge: cards, countdown, evening look; bedtime from the parent settings', () => {
  const extras = { space: parseApod(APOD), history: { text: 'On this day in 1969, astronauts visited the Moon!', source: 'Wikipedia' }, sun: { sunrise: '', sunset: new Date(2026, 10, 23, 16, 13).toISOString() } };
  const snap = buildFridgeSnapshot({ heroes: [{ id: 'k', name: 'Kaleb', role: 'kid' }], parentSettings: { bedtimeHour: 19 } }, { extras });
  assert.equal(snap.bedtimeHour, 19);
  assert.equal(snap.extras.space.image, APOD.url);
  assert.match(renderSpaceCard(snap), /data-fridge-space[\s\S]*Saturn&#39;s Rings|data-fridge-space[\s\S]*Saturn/);
  assert.match(renderHistoryCard(snap), /data-fridge-history[\s\S]*visited the Moon/);
  assert.match(renderBedtimeCountdown(snap, new Date(2026, 10, 23, 18, 0)), /Bedtime in 1 hour/);
  assert.equal(renderBedtimeCountdown(snap, new Date(2026, 10, 23, 12, 0)), '');
  const body = renderFridgeBody(snap, { now: new Date(2026, 10, 23, 17, 30) });
  assert.ok(body.includes('data-fridge-evening') && body.includes('data-fridge-bedtime') && body.includes('data-fridge-say'));
  assert.ok(!renderFridgeBody(snap, { now: new Date(2026, 10, 23, 11, 0) }).includes('data-fridge-evening'));
  assert.ok(renderFridgeBody(snap, { now: new Date(2026, 10, 23, 19, 5) }).includes('Goodnight, heroes!'));
  assert.equal(fridgeExtras({ space: { image: 'http://x', title: 'a' } }), null, 'only https pictures');
  assert.equal(fridgeExtras(null), null);
});

if (failures) {
  console.error(`\n❌ ${failures} fridge extras check(s) failed`);
  process.exit(1);
}
console.log('\n✅ Fridge extras checks passed');
process.exit(0);
