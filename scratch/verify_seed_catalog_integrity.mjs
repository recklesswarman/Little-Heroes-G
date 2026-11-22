// New seed items: unique ids, complete fields, kid-safe words, prices in range, art exists, they reach the catalog and Shop.
import './setup_mock_env.js';
import { SEED_2026_ITEMS } from '../src/data/seedItems2026.js';
import { DIGITAL_REWARDS_CATALOG, getAllRewardsByCategory } from '../src/data/digitalRewardsCatalog.js';
import { emojiArtUrl } from '../src/utils/emojiArt.js';
import { GAME_ICONS } from '../src/utils/gameIcons.js';
import { renderRewardImage } from '../src/utils/rewardGraphics.js';

let passed = 0, failed = 0;
const assert = (c, m) => { if (c) { passed++; } else { console.error(`  ❌ FAIL: ${m}`); failed++; } };

console.log('🌱 --- Seed catalog integrity --- 🌱');
const cats = ['Weapons', 'Avatar Gear', 'Pet Gear', 'Accessories', 'Badges', 'Trophies', 'Stickers', 'Loot', 'Snacks'];
const originals = DIGITAL_REWARDS_CATALOG.filter((i) => !i.isSeeded);
const ids = new Set();
for (const item of SEED_2026_ITEMS) {
  assert(/^seed26_[a-z_]+$/.test(item.id) && !ids.has(item.id), `${item.id} has a stable unique id`);
  ids.add(item.id);
  assert(item.name && item.desc && item.category && item.rarity && item.price > 0, `${item.id} has the required fields`);
  assert(item.price === item.costCoins, `${item.id} price matches costCoins`);
  assert(!/pink|purple|magenta|violet/i.test(`${item.name} ${item.desc}`), `${item.id} follows the palette rule`);
  assert(!/candy|soda|chips|cookie|sugar(?!\s*bug)/i.test(`${item.name} ${item.desc}`) || item.category !== 'Snacks', `${item.id} is a healthy snack`);
  assert(!!(item.emoji && emojiArtUrl(item.emoji)) || !!(item.iconId && GAME_ICONS[item.iconId]) || !!item.image, `${item.id} has art that ships with the app`);
  assert(!item.modelUrl, `${item.id} does not use a placeholder model`);
  assert(DIGITAL_REWARDS_CATALOG.filter((i) => i.id === item.id).length === 1, `${item.id} is in the catalog exactly once`);
  const same = originals.filter((i) => i.category === item.category).map((i) => i.price);
  assert(item.price >= Math.min(...same) * 0.5 && item.price <= Math.max(...same), `${item.id} price is inside the ${item.category} range`);
}
for (const c of cats) assert(SEED_2026_ITEMS.filter((i) => i.category === c).length === 3, `3 seeds in ${c}`);
for (const c of cats) assert(getAllRewardsByCategory(c).filter((i) => i.isSeeded).length === 3, `the ${c} tab lists its 3 seeds`);
const emojiCard = renderRewardImage(SEED_2026_ITEMS.find((i) => i.emoji === '🥕'), 'x');
assert(emojiCard.includes('openmoji/1F955.svg'), 'an emoji seed card shows OpenMoji art');
assert(SEED_2026_ITEMS.length === 27, '27 seeds in total');
console.log(failed ? `\nTEST RESULTS: ${passed} PASSED, ${failed} FAILED` : `\nTEST RESULTS: ${passed} PASSED, 0 FAILED`);
process.exit(failed ? 1 : 0);
