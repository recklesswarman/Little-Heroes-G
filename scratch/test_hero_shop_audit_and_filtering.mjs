/**
 * test_hero_shop_audit_and_filtering.mjs
 * Rigorous Verification Suite for Task: Full Audit, Visual Overhaul & Bug Fix of the Hero Shop
 */

// Mock localStorage, window, and document for Node.js environment
if (typeof global.localStorage === 'undefined') {
  const storeMap = {};
  global.localStorage = {
    getItem: (key) => storeMap[key] || null,
    setItem: (key, val) => { storeMap[key] = String(val); },
    removeItem: (key) => { delete storeMap[key]; },
    clear: () => { Object.keys(storeMap).forEach(k => delete storeMap[k]); }
  };
}

if (typeof global.window === 'undefined') {
  global.window = {
    location: { reload: () => {} },
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    speechSynthesis: {
      getVoices: () => [],
      speak: () => {},
      cancel: () => {},
      onvoiceschanged: null
    }
  };
}

if (typeof global.document === 'undefined') {
  global.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({
      getContext: () => ({}),
      style: {},
      setAttribute: () => {},
      appendChild: () => {}
    }),
    body: {
      appendChild: () => {},
      removeChild: () => {}
    },
    documentElement: { clientWidth: 1024, clientHeight: 768 },
    getElementById: () => null,
    querySelectorAll: () => []
  };
}

import fs from 'fs';
import path from 'path';
import { store } from '../src/state/store.js';
import { renderShopView } from '../src/views/ShopView.js';
import { DIGITAL_REWARDS_CATALOG } from '../src/data/digitalRewardsCatalog.js';
import {
  getRewardAssetUrl,
  renderRewardImage,
  getRewardRarityBorderClass,
  getRewardRarityBadge
} from '../src/utils/rewardGraphics.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
    throw new Error(`Test assertion failed: ${message}`);
  }
}

console.log('🧪 ==============================================================');
console.log('🧪 STARTING COMPREHENSIVE HERO SHOP AUDIT & REWARD VERIFICATION');
console.log('🧪 ==============================================================\n');

// --------------------------------------------------------------------------
// SUITE 1: 100% Asset Existence & Boy-Friendly Color Verification
// --------------------------------------------------------------------------
console.log('--- Suite 1: Asset Audit & Zero Broken References ---');
const rewardsDir = path.resolve('public/assets/rewards');
assert(fs.existsSync(rewardsDir), 'public/assets/rewards directory exists');

const catalog = DIGITAL_REWARDS_CATALOG;
assert(catalog.length >= 25, `Catalog contains ${catalog.length} normalized items (expected >= 25)`);

catalog.forEach((item) => {
  assert(item.id, `Item has id: ${item.id}`);
  assert(item.name, `Item ${item.id} has name: ${item.name}`);
  assert(item.title === item.name, `Item ${item.id} has title alias synchronized with name`);
  assert(item.category, `Item ${item.id} has category: ${item.category}`);
  assert(typeof item.costCoins === 'number' && item.costCoins > 0, `Item ${item.id} has valid costCoins: ${item.costCoins}`);
  assert(item.price === item.costCoins, `Item ${item.id} has price alias synchronized with costCoins`);
  assert(item.assetUrl && item.assetUrl.startsWith('/assets/rewards/'), `Item ${item.id} has local assetUrl: ${item.assetUrl}`);
  assert(item.image === item.assetUrl, `Item ${item.id} has image alias synchronized with assetUrl`);

  // Verify physical file exists in public/
  const relativeFile = item.assetUrl.replace(/^\//, '');
  const physicalPath = path.resolve('public', relativeFile);
  assert(fs.existsSync(physicalPath), `Physical SVG asset exists on disk: ${item.assetUrl}`);

  // Verify boy-friendly colors (zero pink/purple hex codes)
  const svgContent = fs.readFileSync(physicalPath, 'utf8').toLowerCase();
  assert(!svgContent.includes('#ec4899'), `SVG ${item.assetUrl} contains 0 pink #ec4899`);
  assert(!svgContent.includes('#a855f7'), `SVG ${item.assetUrl} contains 0 purple #a855f7`);

  // Verify rarity
  assert(['common', 'rare', 'epic', 'legendary'].includes(item.rarity), `Item ${item.id} has valid rarity: ${item.rarity}`);
});

// --------------------------------------------------------------------------
// SUITE 2: Zero "undefined" in Rendered Shop View & Safe Fallback Component
// --------------------------------------------------------------------------
console.log('\n--- Suite 2: Rendered Shop View Output Audit ---');
store.init();
const shopHtml = renderShopView();

assert(!shopHtml.includes('src="undefined"'), 'Zero src="undefined" in rendered Shop View HTML');
assert(!shopHtml.includes('alt="undefined"'), 'Zero alt="undefined" in rendered Shop View HTML');
assert(!shopHtml.includes('src="null"'), 'Zero src="null" in rendered Shop View HTML');
assert(!shopHtml.includes('alt="null"'), 'Zero alt="null" in rendered Shop View HTML');
assert(!shopHtml.includes('[object Object]'), 'Zero [object Object] in rendered Shop View HTML');
assert(shopHtml.includes('The Hero Shop'), 'Shop View renders header title "The Hero Shop"');
assert(shopHtml.includes('Habit Tokens'), 'Shop View displays Habit Tokens counter');
assert(shopHtml.includes('Gold Points'), 'Shop View displays Gold Points counter');

// Test renderRewardImage fallback behavior with empty/null/undefined item
const fallbackImgHtml = renderRewardImage({ id: 'non_existent_fake_item', title: 'Mystery Relic' });
assert(fallbackImgHtml.includes('Mystery Relic'), 'Fallback image preserves alt text');
assert(!fallbackImgHtml.includes('undefined'), 'Fallback image contains zero "undefined" strings');
assert(fallbackImgHtml.includes('onerror="if(this.src'), 'Fallback image contains safe onerror handler');

// --------------------------------------------------------------------------
// SUITE 3: Granular Category Filtering Verification (12 Tabs)
// --------------------------------------------------------------------------
console.log('\n--- Suite 3: Granular Category Filtering Verification (12 Tabs) ---');
const expectedTabs = [
  'all',
  'weapons',
  'avatar_gear',
  'pet_gear',
  'accessories',
  'badges',
  'trophies',
  'stickers',
  'loot',
  'snacks',
  'themes',
  'real_life'
];

expectedTabs.forEach((tabId) => {
  assert(shopHtml.includes(`data-cat="${tabId}"`), `Shop View renders category filter pill button for "${tabId}"`);
});

// Check that every catalog category is represented
const categoriesInCatalog = new Set(catalog.map((i) => i.category));
assert(categoriesInCatalog.has('Weapons'), 'Catalog contains Weapons category');
assert(categoriesInCatalog.has('Avatar Gear'), 'Catalog contains Avatar Gear category');
assert(categoriesInCatalog.has('Pet Gear'), 'Catalog contains Pet Gear category');
assert(categoriesInCatalog.has('Accessories'), 'Catalog contains Accessories category');
assert(categoriesInCatalog.has('Badges'), 'Catalog contains Badges category');
assert(categoriesInCatalog.has('Trophies'), 'Catalog contains Trophies category');
assert(categoriesInCatalog.has('Stickers'), 'Catalog contains Stickers category');
assert(categoriesInCatalog.has('Loot'), 'Catalog contains Loot category');
assert(categoriesInCatalog.has('Snacks'), 'Catalog contains Snacks category');

// --------------------------------------------------------------------------
// SUITE 4: Rarity Border & Badge Styling
// --------------------------------------------------------------------------
console.log('\n--- Suite 4: Rarity Border & Badge Styling ---');
['common', 'rare', 'epic', 'legendary'].forEach((rarity) => {
  const borderClass = getRewardRarityBorderClass(rarity, false);
  const badgeHtml = getRewardRarityBadge(rarity);
  assert(borderClass && borderClass.length > 5, `Rarity border class defined for ${rarity}: ${borderClass}`);
  assert(badgeHtml && badgeHtml.includes('<span'), `Rarity badge HTML defined for ${rarity}`);
});

const equippedBorder = getRewardRarityBorderClass('legendary', true);
assert(equippedBorder.includes('border-primary'), 'Equipped item takes priority border styling');

// --------------------------------------------------------------------------
// SUITE 5: End-to-End Reward Purchase, Equip & Consumption Flow
// --------------------------------------------------------------------------
console.log('\n--- Suite 5: End-to-End Reward Mechanics ---');
const hero = store.getSelectedHero();
assert(hero !== null, 'Active hero exists');

// Give coins
store.addCoins(1000);
const startCoins = hero.coins;

// 1. Buy Weapon
const buyWeaponRes = store.buyDigitalGear('weapon_plasma_saber');
assert(buyWeaponRes.success, 'buyDigitalGear for weapon_plasma_saber succeeded');
assert(hero.inventory.includes('weapon_plasma_saber'), 'Plasma saber added to hero inventory');
assert(store.getEquippedHeroWeapon() === 'weapon_plasma_saber', 'Plasma saber auto-equipped');

// 2. Buy Avatar Gear
const buyGearRes = store.buyDigitalGear('golden_dragon_armor');
assert(buyGearRes.success, 'buyDigitalGear for golden_dragon_armor succeeded');
assert(hero.inventory.includes('golden_dragon_armor'), 'Dragon armor added to hero inventory');

// 3. Buy Pet Snack & Feed
const buySnackRes = store.buyDigitalGear('food_starberry_bites');
assert(buySnackRes.success, 'buyDigitalGear for food_starberry_bites succeeded');
assert(hero.consumables['food_starberry_bites'] !== undefined, 'Snack added to hero consumables');

const feedRes = store.feedPetConsumableSnack('food_starberry_bites');
assert(feedRes.success, 'feedPetConsumableSnack succeeded');

console.log('\n==============================================================');
console.log(`🎉 ALL ${passed}/${passed + failed} AUDIT & VERIFICATION CHECKS PASSED!`);
console.log('==============================================================\n');
process.exit(0);
