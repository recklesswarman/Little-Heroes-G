// Regression test: Parent Panel settings (PIN, Rex voice, companion rules) must
// stick across devices and survive failed pushes. Uses two real store + sync
// instances against one shared fake Firestore doc.
import { sleep, makeFS, makeDevice, household, LAT, makeRunner } from './parent_panel_device_harness.mjs';

const { check, expect, finish } = makeRunner('🔐 --- Verifying Parent Panel settings sync across devices --- 🔐');
const ps = (d) => d.store.getState().parentSettings;

await check('new PIN beats a stale save from the kid device', async () => {
  const { K, P, cloud } = await household();
  const r = P.store.setParentPin('4821');
  expect(r.success, `setParentPin failed: ${r.error}`);
  await sleep(5); K.store.saveState(true); // kid pushes its old copy (PIN 1234) before it hears about 4821
  await sleep(LAT * 25);
  expect(ps(P).pin === '4821' && ps(K).pin === '4821' && cloud().parentSettings.pin === '4821',
    `parent=${ps(P).pin} kid=${ps(K).pin} cloud=${cloud().parentSettings.pin}`);
});

await check('a fresh device adopts the household PIN from a legacy doc without stamps', async () => {
  const FS = makeFS(LAT);
  FS.docs['households/HERO-TEST'] = { parentSettings: { pin: '5555', pinLockEnabled: true, bedtimeHour: 19 } };
  const D = makeDevice(FS); await sleep(LAT * 10);
  expect(ps(D).pin === '5555' && ps(D).bedtimeHour === 19, `device pin=${ps(D).pin} bedtimeHour=${ps(D).bedtimeHour} (default 1234 leaked?)`);
});

await check('PIN saved while sync fails survives a reload and repairs the cloud', async () => {
  const { FS, K, P, cloud } = await household();
  FS.failWrites = true;
  P.store.setParentPin('4821'); await sleep(LAT * 6);
  const health = P.sync.getSyncHealth();
  expect(health.mode === 'error', `sync health was ${JSON.stringify(health)}, expected mode "error"`);
  expect(cloud().parentSettings.pin !== '4821', 'cloud should not have the PIN yet');
  FS.failWrites = false;
  // "Reload" the parent device from the same localStorage; the first snapshot is the stale cloud copy.
  const P2 = makeDevice(FS, { storage: P.storage }); await sleep(LAT * 25);
  expect(ps(P2).pin === '4821', `reloaded parent PIN=${ps(P2).pin}`);
  expect(cloud().parentSettings.pin === '4821', `cloud PIN after repair=${cloud().parentSettings.pin}`);
  await sleep(LAT * 10);
  expect(ps(K).pin === '4821', `kid PIN=${ps(K).pin}`);
  expect(P2.sync.getSyncHealth().mode === 'ok', `health after repair ${JSON.stringify(P2.sync.getSyncHealth())}`);
});

await check('Rex voice and companion bedtime follow the same newest-change-wins rule', async () => {
  const { K, P, cloud } = await household();
  P.store.setRexVoicePersona('Kore');
  P.store.updateParentSettings({ bedtimeHour: 19 });
  await sleep(5); K.store.saveState(true); await sleep(LAT * 25);
  expect(ps(P).rexVoice === 'Kore' && ps(K).rexVoice === 'Kore' && cloud().parentSettings.rexVoice === 'Kore',
    `rexVoice parent=${ps(P).rexVoice} kid=${ps(K).rexVoice} cloud=${cloud().parentSettings.rexVoice}`);
  expect(ps(P).bedtimeHour === 19 && ps(K).bedtimeHour === 19, `bedtimeHour parent=${ps(P).bedtimeHour} kid=${ps(K).bedtimeHour}`);
});

await check('a later change on the kid device wins over an earlier parent change', async () => {
  const { K, P } = await household();
  P.store.updateParentSettings({ bedtimeHour: 19 }); await sleep(LAT * 12);
  K.store.updateParentSettings({ bedtimeHour: 21 }); await sleep(LAT * 25);
  expect(ps(P).bedtimeHour === 21 && ps(K).bedtimeHour === 21, `parent=${ps(P).bedtimeHour} kid=${ps(K).bedtimeHour}`);
});

await check('every pushed setting carries a stamp', async () => {
  const { P, cloud } = await household();
  P.store.setParentPin('2468'); await sleep(LAT * 12);
  const c = cloud().parentSettings;
  const missing = Object.keys(c).filter((k) => k !== 'fieldStamps' && k !== 'storySafetyLog' && !(k in (c.fieldStamps || {})));
  expect(missing.length === 0, `keys without a stamp: ${missing.join(', ')}`);
  expect(Number(c.fieldStamps.pin) > 0, 'pin stamp missing');
});

await check("a kid's screen time cap set on the parent device survives a stale kid save", async () => {
  const { K, P, cloud } = await household();
  P.store.updateScreenTimeSettings('hero_1', { dailyMaxScreenTime: 15, bedtimeCurfew: '', screenTimeRate: 5 });
  await sleep(5); K.store.saveState(true); await sleep(LAT * 25);
  const kh = K.store.getState().heroes.find((h) => h.id === 'hero_1');
  const ph = P.store.getState().heroes.find((h) => h.id === 'hero_1');
  const ch = cloud().heroesMap.hero_1;
  expect(ph.dailyMaxScreenTime === 15 && kh.dailyMaxScreenTime === 15 && ch.dailyMaxScreenTime === 15, `cap parent=${ph.dailyMaxScreenTime} kid=${kh.dailyMaxScreenTime} cloud=${ch.dailyMaxScreenTime}`);
  expect(kh.bedtimeCurfew === '' && ch.bedtimeCurfew === '', `curfew kid="${kh.bedtimeCurfew}" cloud="${ch.bedtimeCurfew}"`);
  expect(kh.screenTimeRate === 5, `rate kid=${kh.screenTimeRate}`);
});

await check('minutes played on the kid device reach the parent device', async () => {
  const { K, P } = await household();
  K.store.consumeScreenTime('hero_1', 3); K.store.saveState(true); await sleep(LAT * 20);
  const ph = P.store.getState().heroes.find((h) => h.id === 'hero_1');
  expect(ph.screenTimeUsedToday === 3, `parent sees used=${ph.screenTimeUsedToday}`);
});

finish('parent settings sync');
