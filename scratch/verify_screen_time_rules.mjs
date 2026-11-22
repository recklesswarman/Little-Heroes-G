// Regression test: Screen Time rules (daily cap, bank, curfew, day rollover, form validation).
import { makeFS, makeDevice, makeRunner } from './parent_panel_device_harness.mjs';

const { check, expect, finish } = makeRunner('⏳ --- Verifying Screen Time rules --- ⏳');
const D = makeDevice(makeFS(1), { sync: false });
const store = D.store;
const hero = () => store.getState().heroes[0];
const at = (hh, mm) => { const d = new Date(); d.setHours(hh, mm, 0, 0); return d; };
const noon = at(12, 0);
function reset(over = {}) {
  Object.assign(hero(), { isScreenTimePaused: false, screenTimeMinutes: 500, screenTimeUsedToday: 0, screenTimeUsageDate: new Date().toDateString(), dailyMaxScreenTime: 60, bedtimeCurfew: '', screenTimeRate: 2 }, over);
}

await check('new kids start the day with zero minutes used', async () => {
  const k = store.addHero({ name: 'Sam' });
  const h = store.getState().heroes.find((x) => x.id === k.id);
  expect((h.screenTimeUsedToday ?? 0) === 0, `new kid used=${h.screenTimeUsedToday}`);
});

await check('a cap of 0 locks right away (not treated as 60)', async () => {
  reset({ dailyMaxScreenTime: 0 });
  expect(store.getScreenTimeLockReason(hero(), noon) === 'daily_cap', `reason=${store.getScreenTimeLockReason(hero(), noon)}`);
});

await check('59 of 60 minutes is open; one more minute of play locks it', async () => {
  reset({ screenTimeUsedToday: 59 });
  expect(!store.isScreenTimeLocked(hero(), noon), 'locked at 59/60');
  const r = store.consumeScreenTime(hero().id, 1);
  expect(r.locked && r.reason === 'daily_cap' && hero().screenTimeUsedToday === 60, `consume -> ${JSON.stringify(r)} used=${hero().screenTimeUsedToday}`);
});

await check('play spends banked minutes and the bank never goes below 0', async () => {
  reset({ screenTimeMinutes: 1, dailyMaxScreenTime: 240 });
  store.consumeScreenTime(hero().id, 1);
  const r = store.consumeScreenTime(hero().id, 1);
  expect(hero().screenTimeMinutes === 0 && r.reason === 'bank_empty', `bank=${hero().screenTimeMinutes} reason=${r.reason}`);
});

await check('a new day resets minutes used', async () => {
  reset({ screenTimeUsedToday: 60, screenTimeUsageDate: 'Mon Jan 01 2001' });
  expect(!store.isScreenTimeLocked(hero(), noon) && hero().screenTimeUsedToday === 0, `used=${hero().screenTimeUsedToday}`);
});

await check('paused screen time locks', async () => {
  reset({ isScreenTimePaused: true });
  expect(store.getScreenTimeLockReason(hero(), noon) === 'paused', 'not paused');
});

await check('curfew 20:00 locks from 20:00 until 6:00 AM', async () => {
  reset({ bedtimeCurfew: '20:00' });
  const cases = [[19, 59, false], [20, 0, true], [23, 30, true], [5, 59, true], [6, 0, false], [12, 0, false]];
  for (const [h, m, want] of cases) expect(store.isScreenTimeLocked(hero(), at(h, m)) === want, `${h}:${m} locked=${!want}`);
});

await check('an after-midnight curfew (00:30) only locks 00:30 to 6:00', async () => {
  reset({ bedtimeCurfew: '00:30' });
  const cases = [[12, 0, false], [0, 29, false], [0, 31, true], [5, 0, true], [6, 0, false], [21, 0, false]];
  for (const [h, m, want] of cases) expect(store.isScreenTimeLocked(hero(), at(h, m)) === want, `${h}:${m} locked=${!want}`);
});

await check('no curfew never locks', async () => {
  reset({ bedtimeCurfew: '' });
  for (const [h, m] of [[0, 0], [3, 0], [22, 0]]) expect(!store.isScreenTimeLocked(hero(), at(h, m)), `${h}:${m} locked`);
});

await check('the Screen Time form saves cleaned values', async () => {
  reset();
  store.updateScreenTimeSettings(hero().id, { dailyMaxScreenTime: '90', bedtimeCurfew: '21:15', screenTimeRate: '3', screenTimeLockMessage: '  Go read a book!  ' });
  const h = hero();
  expect(h.dailyMaxScreenTime === 90 && h.bedtimeCurfew === '21:15' && h.screenTimeRate === 3 && h.screenTimeLockMessage === 'Go read a book!',
    JSON.stringify({ cap: h.dailyMaxScreenTime, curfew: h.bedtimeCurfew, rate: h.screenTimeRate, msg: h.screenTimeLockMessage }));
  store.updateScreenTimeSettings(hero().id, { dailyMaxScreenTime: '9999', bedtimeCurfew: '25:99', screenTimeRate: '7', screenTimeLockMessage: '   ' });
  expect(h.dailyMaxScreenTime === 60 && h.bedtimeCurfew === '20:00' && h.screenTimeRate === 2 && h.screenTimeLockMessage.length > 0,
    `invalid input not reset: ${JSON.stringify({ cap: h.dailyMaxScreenTime, curfew: h.bedtimeCurfew, rate: h.screenTimeRate })}`);
  store.updateScreenTimeSettings(hero().id, { dailyMaxScreenTime: 0, bedtimeCurfew: '' });
  expect(h.dailyMaxScreenTime === 0 && h.bedtimeCurfew === '', `cap 0 / no curfew not saved: ${h.dailyMaxScreenTime} "${h.bedtimeCurfew}"`);
});

await check('screen time usage is a stamped (synced) hero field', async () => {
  reset();
  store.consumeScreenTime(hero().id, 2);
  store.saveState(true);
  const stamps = hero().fieldStamps || {};
  expect(Number(stamps.screenTimeUsedToday) > 0, `stamps: ${JSON.stringify(stamps)}`);
});

finish('screen time');
