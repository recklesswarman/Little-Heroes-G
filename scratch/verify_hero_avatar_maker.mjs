// "Design your hero": DiceBear avatars on the Profile screen, saved on the hero and shown on
// the Fridge Display.
import './setup_mock_env.js';
import assert from 'node:assert/strict';
import { AVATAR_STYLES, avatarChoices, heroAvatarDataUrl, AVATAR_BACKGROUNDS } from '../src/services/heroAvatarMaker.js';
import { safeImageUrl } from '../src/utils/safeImageUrl.js';
import { buildFridgeSnapshot } from '../shared/fridgeSnapshot.js';
import { store } from '../src/state/store.js';
import { renderProfileView } from '../src/views/ProfileView.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failures++; console.error(`  ❌ ${name}\n     ${err.stack || err.message}`); }
}

await test('every style draws a small, safe SVG data URL, the same for the same seed', () => {
  for (const s of AVATAR_STYLES) {
    const url = heroAvatarDataUrl({ style: s.id, seed: 'Milo-0-0' });
    assert.match(url, /^data:image\/svg\+xml;base64,/);
    assert.equal(safeImageUrl(url), url, s.id);
    assert.ok(url.length < 60000, `${s.id} is ${url.length} chars`);
    assert.equal(heroAvatarDataUrl({ style: s.id, seed: 'Milo-0-0' }), url);
    assert.ok(s.credit.length > 5);
    const svg = Buffer.from(url.split(',')[1], 'base64').toString('utf8');
    assert.ok(svg.startsWith('<svg') && !/<script/i.test(svg));
  }
  assert.notEqual(heroAvatarDataUrl({ seed: 'a' }), heroAvatarDataUrl({ seed: 'b' }));
  assert.equal(heroAvatarDataUrl({ style: 'nope', seed: 'x' }), heroAvatarDataUrl({ style: 'adventurer', seed: 'x' }));
});
await test('six choices per roll, new ones on the next roll', () => {
  const a = avatarChoices('Nova', 'fun-emoji', 0);
  const b = avatarChoices('Nova', 'fun-emoji', 1);
  assert.equal(a.length, 6);
  assert.equal(new Set(a.map((c) => c.url)).size, 6);
  assert.ok(a.every((c) => AVATAR_BACKGROUNDS.includes(c.background)));
  assert.notEqual(a[0].url, b[0].url);
});
await test('picking a look saves it on the hero and the fridge keeps it', () => {
  const hero = store.getState().selectedHero;
  const design = { style: 'big-smile', seed: 'Milo-2-3', background: 'ffd5dc' };
  const url = heroAvatarDataUrl(design);
  store.editHero(hero.id, { avatar: url, avatarDesign: { ...design, extra: 'dropped' } });
  const saved = store.getState().heroes.find((h) => h.id === hero.id);
  assert.equal(saved.avatar, url);
  assert.deepEqual(saved.avatarDesign, design);
  assert.deepEqual(store.getState().selectedHero.avatarDesign, design);
  const snap = buildFridgeSnapshot({ heroes: [{ ...saved, role: 'kid' }] });
  assert.equal(snap.heroes[0].avatar, url);
});
await test('Profile shows the Design your hero button', () => {
  const html = renderProfileView();
  assert.ok(html.includes('profile-design-hero-btn'));
});

if (failures) {
  console.error(`\n❌ ${failures} avatar maker check(s) failed`);
  process.exit(1);
}
console.log('\n✅ Avatar maker checks passed');
process.exit(0);
