// Real 3D models: every model and thumbnail in the catalogs exists, is small, is a valid GLB, and nothing points at placeholder hosts.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

let failed = 0;
async function check(desc, fn) {
  try { await fn(); console.log(`  ok - ${desc}`); }
  catch (e) { failed++; console.error(`  FAIL - ${desc}: ${e.message}`); }
}
console.log('real models');

const { THREE_D_ASSETS } = await import('../src/data/threeDAssetCatalog.js');
const { DIGITAL_REWARDS_CATALOG } = await import('../src/data/digitalRewardsCatalog.js');
const local = (u) => path.join('public', String(u).replace(/^\/+/, '').split('?')[0]);

await check('every local model and thumbnail in the Studio catalog exists', () => {
  const real = THREE_D_ASSETS.filter((a) => a.thumbnail);
  assert.ok(real.length >= 40, `expected 40+ real assets, got ${real.length}`);
  for (const a of real) {
    assert.ok(fs.existsSync(local(a.modelUrl)), `${a.id}: missing ${a.modelUrl}`);
    assert.ok(fs.existsSync(local(a.thumbnail)), `${a.id}: missing ${a.thumbnail}`);
    assert.ok(a.credit && a.credit.author && a.credit.license, `${a.id}: needs a credit`);
  }
});

await check('catalog ids are unique and nothing points at a placeholder host or a Spline scene (except gear)', () => {
  assert.strictEqual(new Set(THREE_D_ASSETS.map((a) => a.id)).size, THREE_D_ASSETS.length);
  for (const a of THREE_D_ASSETS.filter((x) => x.category !== 'gear')) {
    assert.ok(!/modelviewer\.dev|githubusercontent/.test(a.modelUrl), `${a.id} still uses ${a.modelUrl}`);
    assert.ok(!a.splineUrl, `${a.id} still has a Spline URL`);
  }
});

await check('GLB files are valid, small, and the whole folder stays under 8 MB', () => {
  let total = 0;
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    if (!p.endsWith('.glb')) return;
    const buf = fs.readFileSync(p);
    assert.strictEqual(buf.toString('ascii', 0, 4), 'glTF', `${p} is not a GLB`);
    assert.ok(buf.length < 500 * 1024, `${p} is ${Math.round(buf.length / 1024)} KB`);
    total += buf.length;
  });
  walk('public/models');
  assert.ok(total < 8 * 1024 * 1024, `models total ${Math.round(total / 1024)} KB`);
});

await check('animated pets and bosses name animations that exist in the file', () => {
  for (const a of THREE_D_ASSETS.filter((x) => x.animations)) {
    const json = fs.readFileSync(local(a.modelUrl)).toString('latin1');
    for (const name of [a.animations.idle, a.animations.walk, a.animations.cheer].filter(Boolean)) {
      assert.ok(json.includes(`"${name}"`), `${a.id}: animation ${name} not in the model`);
    }
  }
});

await check('Shop seeds with models carry a picture, a credit and an existing model', () => {
  const withModel = DIGITAL_REWARDS_CATALOG.filter((i) => i.isSeeded && i.modelUrl);
  assert.ok(withModel.length >= 8, `expected 8+ seeded model items, got ${withModel.length}`);
  for (const i of withModel) {
    assert.ok(i.image && i.credit, `${i.id}: needs image and credit`);
    assert.ok(fs.existsSync(local(i.modelUrl)), `${i.id}: missing model`);
  }
});

await check('Shop weapons and snacks no longer use the astronaut placeholder where a real model fits', () => {
  for (const id of ['laser_toothbrush', 'sonic_foam_cannon', 'plasma_hydra_blade', 'weapon_plasma_saber', 'weapon_hydro_blaster', 'starlight_berry_pod', 'jungle_honey_comb', 'food_starberry_bites', 'glowing_moon_melon']) {
    const i = DIGITAL_REWARDS_CATALOG.find((x) => x.id === id);
    assert.ok(i && !/modelviewer\.dev/.test(i.modelUrl), `${id} still on a placeholder`);
  }
});

await check('HDRI lighting files exist and the presets use them', async () => {
  assert.ok(fs.existsSync('public/hdri/studio.hdr') && fs.existsSync('public/hdri/cozy.hdr'));
  const { LIGHTING_PRESETS } = await import('../src/utils/modelViewerTint.js');
  assert.ok(/hdri\/studio\.hdr$/.test(LIGHTING_PRESETS.studio.env));
  assert.ok(/hdri\/cozy\.hdr$/.test(LIGHTING_PRESETS.cozy.env));
  assert.ok(/hdri\/sunny\.hdr$/.test(LIGHTING_PRESETS.sunny.env));
  assert.ok(fs.existsSync('public/hdri/sunny.hdr'));
  assert.ok(/hdri\/forest\.hdr$/.test(LIGHTING_PRESETS.forest.env));
  assert.ok(fs.existsSync('public/hdri/forest.hdr'));
});

if (failed) { console.error(`${failed} real-model check(s) failed`); process.exit(1); }
console.log('real models: all passed');
