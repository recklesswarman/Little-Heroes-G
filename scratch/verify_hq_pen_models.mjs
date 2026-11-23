// Hero HQ and Pet Pen show the real models: new HQ furniture, starter toy box, and the starter toys work in the store.
import './setup_mock_env.js';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

let failed = 0;
async function check(desc, fn) {
  try { await fn(); console.log(`  ok - ${desc}`); }
  catch (e) { failed++; console.error(`  FAIL - ${desc}: ${e.message}`); }
}
console.log('hero hq and pet pen models');
const local = (u) => path.join('public', String(u).replace(/^\/+/, '').split('?')[0]);

const { FURNITURE_ITEMS } = await import('../src/data/heroHQData.js');
const { STARTER_PEN_TOYS } = await import('../src/data/penToys.js');
const { store } = await import('../src/state/store.js');

await check('the original 25 furniture items keep their positions (screens fall back to index 15 and 20)', () => {
  assert.strictEqual(FURNITURE_ITEMS[15].slot, 'decor');
  assert.strictEqual(FURNITURE_ITEMS[20].slot, 'rug');
  assert.strictEqual(FURNITURE_ITEMS[15].id, 'starlight_projector_lamp');
  assert.strictEqual(FURNITURE_ITEMS[20].id, 'hero_road_rug');
});

await check('new HQ furniture covers every slot, has files, credits and unique ids', () => {
  const real = FURNITURE_ITEMS.filter((f) => f.modelUrl);
  assert.ok(real.length >= 8);
  assert.strictEqual(new Set(FURNITURE_ITEMS.map((f) => f.id)).size, FURNITURE_ITEMS.length);
  for (const slot of ['bed', 'petLounge', 'desk', 'decor', 'rug']) assert.ok(real.some((f) => f.slot === slot), `no real model for ${slot}`);
  for (const f of real) {
    assert.ok(fs.existsSync(local(f.modelUrl)) && fs.existsSync(local(f.thumbnail)), `${f.id} files`);
    assert.ok(f.credit && f.credit.license === 'CC0', `${f.id} credit`);
    assert.ok(f.costCoins > 0 && !f.unlockedByDefault, `${f.id} is bought, not free`);
  }
});

await check('starter pen toys: 4 real toys with files', () => {
  assert.strictEqual(STARTER_PEN_TOYS.length, 4);
  for (const t of STARTER_PEN_TOYS) {
    assert.ok(t.id.startsWith('starter_toy_') && fs.existsSync(local(t.modelUrl)) && t.isStarter);
  }
});

await check('playing with a starter toy raises Joy, gives no XP, and unknown toys still fail', () => {
  store.init();
  const pet = store.getActivePet();
  const stats = store.ensurePetStats(pet.id);
  stats.joy = 40;
  const xpBefore = store.getSelectedHero().xp;
  const res = store.playWithPenToy(STARTER_PEN_TOYS[0].id, pet.id);
  assert.ok(res && res.success, 'starter toy plays');
  assert.strictEqual(store.ensurePetStats(pet.id).joy, 60);
  assert.strictEqual(store.getSelectedHero().xp, xpBefore, 'no XP from starter toys');
  assert.strictEqual(store.playWithPenToy('nope', pet.id), null);
});

await check('the views import and render the new models without errors', async () => {
  const hq = await import('../src/views/HeroHQView.js');
  const pen = await import('../src/views/PetPenView.js');
  const render = hq.renderHeroHQView || hq.default;
  const penRender = pen.renderPetPenView || pen.default;
  for (const fn of [render, penRender].filter(Boolean)) {
    const html = fn(store.getState());
    assert.ok(typeof html === 'string' && html.length > 500);
    if (fn === penRender) assert.ok(html.includes('pen-starter-toy-box') && html.includes('starter_toy_racer'), 'toy box shows');
  }
});

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('hero hq and pet pen models: all passed');
process.exit(0);
