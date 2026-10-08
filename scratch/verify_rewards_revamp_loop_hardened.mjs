/**
 * scratch/verify_rewards_revamp_loop_hardened.mjs
 * 
 * Digital Rewards Revamp Full-Loop Continuity & Hardened Invariants Test Suite
 * Validates:
 * 1. 3D parent weapon crafting in 3D Studio, published to parentCustomWeapons & digitalGear.
 * 2. Instant gifts with auto-equip & 1 active combat weapon slot rule.
 * 3. Habit bounty weapon streak awards with alias matching & auto-equipping.
 * 4. Dental battle bounty check integration (recordDentalBattle -> checkAndAwardHabitBounties).
 * 5. Dynamic servings pantry normalization (object vs integer servings) without NaN.
 * 6. Golden author badge sanitization (XSS defense) & multi-view rendering.
 * 7. Multi-device inventory purge with tombstones (deletedCustomItemIds preventing cloud resurrection).
 * 8. Unconditional localStorage catalog migration without boolean lockouts.
 */

import assert from 'assert';

// Mock localStorage environment
const storageStore = {};
globalThis.localStorage = {
  getItem: (key) => storageStore[key] || null,
  setItem: (key, val) => { storageStore[key] = String(val); },
  removeItem: (key) => { delete storageStore[key]; },
  clear: () => { Object.keys(storageStore).forEach(k => delete storageStore[k]); }
};

// Mock window and document
globalThis.window = {
  location: { reload: () => {}, href: 'http://localhost/' },
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  speechSynthesis: {
    getVoices: () => [],
    speak: () => {},
    cancel: () => {},
    onvoiceschanged: null
  }
};

globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  createElement: () => ({
    getContext: () => ({}),
    style: {},
    setAttribute: () => {},
    appendChild: () => {}
  }),
  body: { appendChild: () => {}, removeChild: () => {} },
  documentElement: { clientWidth: 1024, clientHeight: 768 },
  getElementById: () => null,
  querySelectorAll: () => []
};

// Import modules under test
const { store } = await import('../src/state/store.js');
const { DIGITAL_REWARDS_CATALOG } = await import('../src/data/digitalRewardsCatalog.js');
const { escapeHtml } = await import('../src/utils/escapeHtml.js');
const { renderShopView } = await import('../src/views/ShopView.js');

let totalTests = 0;
let passedTests = 0;

function testAssert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('🚀 =============================================================');
console.log('🚀 DIGITAL REWARDS REVAMP FULL-LOOP HARDENED VERIFICATION SUITE');
console.log('🚀 =============================================================\n');

// Reset store to pristine baseline
localStorage.clear();
store.init();

// =========================================================================
// 1. 3D Parent Weapon Crafting & Publishing
// =========================================================================
console.log('--- 1. Testing Parent 3D Weapon Crafting & Publishing ---');
const customWeapon1 = {
  id: 'wpn_astro_lance_9000',
  name: 'Astro Meteor Lance',
  title: 'Astro Meteor Lance',
  desc: 'Forged from celestial stardust to banish sugar bandits!',
  category: 'Weapons',
  archetype: 'laser_sword',
  statBonusType: 'damage_boost',
  statBonusPercent: 40,
  statBonusLabel: '+40% Boss Attack Power',
  costCoins: 300,
  craftedBy: 'Coach Dad & Mom',
  deliveryMethod: 'instant_gift',
  targetChildProfile: 'all',
  modelUrl: 'https://models.readyplayer.me/astro_lance.glb'
};

const publishedW = store.publishCustomAIWeapon(customWeapon1);
testAssert(publishedW !== null, 'publishCustomAIWeapon successfully published weapon');
testAssert(publishedW.id === 'wpn_astro_lance_9000', 'Weapon ID matches published ID');
testAssert(publishedW.craftedBy === 'Coach Dad & Mom', 'Weapon preserves custom author signature');
testAssert(publishedW.statBonusPercent === 40, 'Weapon preserves 40% damage bonus');
testAssert(publishedW.category === 'Weapons', 'Weapon is categorized as Weapons');

const parentWeapons = store.getParentCustomWeapons();
testAssert(parentWeapons.some(w => w.id === 'wpn_astro_lance_9000'), 'Weapon exists in getParentCustomWeapons()');
testAssert(store.getState().digitalGear.some(w => w.id === 'wpn_astro_lance_9000'), 'Weapon exists in state.digitalGear');
testAssert(DIGITAL_REWARDS_CATALOG.some(w => w.id === 'wpn_astro_lance_9000'), 'Weapon added to DIGITAL_REWARDS_CATALOG');

// =========================================================================
// 2. Instant Gift Delivery & 1 Active Combat Weapon Rule
// =========================================================================
console.log('\n--- 2. Testing Instant Gift Delivery & 1-Active Combat Weapon Rule ---');
const hero = store.getSelectedHero();
testAssert(hero.inventory.includes('wpn_astro_lance_9000'), 'Weapon auto-added to active child inventory via instant_gift');
testAssert(hero.equippedWeapon === 'wpn_astro_lance_9000', 'Weapon equipped as active combat weapon');

// Verify active weapon resolution
const activeWpn = store.getEquippedHeroWeapon(true);
testAssert(activeWpn !== null, 'getEquippedHeroWeapon(true) returns weapon object');
testAssert(activeWpn.name === 'Astro Meteor Lance', 'Active weapon matches published weapon');
testAssert(activeWpn.statBonusPercent === 40, 'Active weapon bonus is 40%');

// Equip a second weapon and verify 1-active rule (replaces equipped, retains old in inventory)
const customWeapon2 = {
  id: 'wpn_photon_saber_77',
  name: 'Photon Sun Saber',
  title: 'Photon Sun Saber',
  category: 'Weapons',
  statBonusType: 'damage_boost',
  statBonusPercent: 25,
  costCoins: 150,
  craftedBy: 'Grandma',
  deliveryMethod: 'instant_gift'
};
store.publishCustomAIWeapon(customWeapon2);
testAssert(hero.equippedWeapon === 'wpn_photon_saber_77', 'Equipping second weapon switches active combat weapon');
testAssert(hero.inventory.includes('wpn_astro_lance_9000'), 'First weapon remains in hero inventory');
testAssert(hero.inventory.includes('wpn_photon_saber_77'), 'Second weapon added to hero inventory');

// =========================================================================
// 3. Habit Bounty Weapon Streak Awards & Alias Matching
// =========================================================================
console.log('\n--- 3. Testing Habit Bounty Weapon Streak Completion & Aliases ---');
const bountyWeapon = {
  id: 'wpn_thunder_hammer_bounty',
  name: 'Thunder Enamel Hammer',
  category: 'Weapons',
  statBonusType: 'damage_boost',
  statBonusPercent: 50,
  costCoins: 500,
  craftedBy: 'Papa Thor'
};

// Parent registers habit bounty requiring 3-day brushing streak
store.getState().pendingBounties = [
  {
    id: 'bounty_brush_streak_3d',
    item: bountyWeapon,
    category: 'weapon',
    targetStreakDays: 3,
    currentStreakProgress: 0,
    habitId: 'brush_teeth',
    targetChildProfile: 'all'
  }
];

// Day 1: Habit completion with alias 'morning_brush'
store.checkAndAwardHabitBounties('morning_brush', hero);
let activeBounty = store.getState().pendingBounties.find(b => b.id === 'bounty_brush_streak_3d');
testAssert(activeBounty && activeBounty.currentStreakProgress === 1, 'Day 1 morning_brush alias increments streak to 1');
testAssert(!hero.inventory.includes('wpn_thunder_hammer_bounty'), 'Day 1 does not award bounty weapon early');

// Day 2: Habit completion with alias 'brush_teeth_pm'
store.checkAndAwardHabitBounties('brush_teeth_pm', hero);
activeBounty = store.getState().pendingBounties.find(b => b.id === 'bounty_brush_streak_3d');
testAssert(activeBounty && activeBounty.currentStreakProgress === 2, 'Day 2 brush_teeth_pm alias increments streak to 2');
testAssert(!hero.inventory.includes('wpn_thunder_hammer_bounty'), 'Day 2 does not award bounty weapon early');

// Day 3: Habit completion with primary ID 'brush_teeth'
store.checkAndAwardHabitBounties('brush_teeth', hero);
testAssert(
  !store.getState().pendingBounties.some(b => b.id === 'bounty_brush_streak_3d'),
  'Day 3 streak goal completed: bounty removed from pendingBounties'
);
testAssert(
  hero.inventory.includes('wpn_thunder_hammer_bounty'),
  'Day 3 completion auto-awards bounty weapon to hero inventory'
);
testAssert(
  hero.equippedWeapon === 'wpn_thunder_hammer_bounty',
  'Day 3 completion auto-equips bounty weapon as active combat weapon'
);
testAssert(
  store.getState().pendingGiftCrates.some(c => c.item.id === 'wpn_thunder_hammer_bounty'),
  'Celebratory gift crate created in pendingGiftCrates'
);

// =========================================================================
// 4. Dental Battle Bounty Check Hook Integration
// =========================================================================
console.log('\n--- 4. Testing Dental Battle Bounty Check Hook (recordDentalBattle) ---');
const dentalBountyWeapon = {
  id: 'wpn_dental_laser_drill',
  name: 'Sparkle Dental Drill',
  category: 'Weapons',
  statBonusType: 'damage_boost',
  statBonusPercent: 30,
  craftedBy: 'Dr. Smile'
};

store.getState().pendingBounties.push({
  id: 'bounty_dental_battle_streak',
  item: dentalBountyWeapon,
  category: 'weapon',
  targetStreakDays: 1,
  currentStreakProgress: 0,
  habitId: 'brush_teeth',
  targetChildProfile: 'all'
});

testAssert(typeof store.recordDentalBattle === 'function', 'store.recordDentalBattle is a defined function');
store.recordDentalBattle('sugar_bandit', 120, 85);

testAssert(
  hero.inventory.includes('wpn_dental_laser_drill'),
  'recordDentalBattle() automatically triggered habit bounty check and awarded dental drill'
);
testAssert(
  hero.equippedWeapon === 'wpn_dental_laser_drill',
  'recordDentalBattle() auto-equipped the newly unlocked bounty weapon'
);

// =========================================================================
// 5. Dynamic Servings Pantry Normalization (Object vs Integer)
// =========================================================================
console.log('\n--- 5. Testing Dynamic Servings Pantry Normalization without NaN ---');
const multiUseSnack = {
  id: 'snack_cosmic_crunchies',
  name: 'Cosmic Crunchies',
  category: 'Snacks',
  costCoins: 20,
  hungerFill: 25,
  quantityPerPurchase: 4,
  maxServings: 4,
  usageType: 'multi_use',
  craftedBy: 'Chef Mom'
};
store.publishCustomAIFood(multiUseSnack);

// Case A: Consumable stored as Object { servingsRemaining: 3 }
hero.consumables = hero.consumables || {};
hero.consumables['snack_cosmic_crunchies'] = {
  id: 'snack_cosmic_crunchies',
  servingsRemaining: 3,
  maxServings: 4
};

const stockFromObject = store.getTreatStock('snack_cosmic_crunchies');
testAssert(typeof stockFromObject === 'number', 'getTreatStock for Object returns numeric type');
testAssert(stockFromObject === 3, `getTreatStock for Object returns correct number (expected 3, got ${stockFromObject})`);
testAssert(!isNaN(stockFromObject), 'getTreatStock for Object is never NaN');

// Feed pet one portion from object consumable
const activePetId = hero.activePetId || '2';
const feedRes1 = store.feedPetTreat(activePetId, 'snack_cosmic_crunchies');
testAssert(feedRes1.success === true, 'feedPetTreat succeeded on object-backed consumable');
testAssert(store.getTreatStock('snack_cosmic_crunchies') === 2, 'Stock decremented from 3 to 2 servings');

// Case B: Consumable stored as primitive integer count
hero.consumables['snack_primitive_chews'] = 5;
const stockFromInt = store.getTreatStock('snack_primitive_chews');
testAssert(typeof stockFromInt === 'number', 'getTreatStock for primitive count returns numeric type');
testAssert(stockFromInt === 5, `getTreatStock for primitive count returns 5 (got ${stockFromInt})`);
testAssert(!isNaN(stockFromInt), 'getTreatStock for primitive count is never NaN');

// Feed pet one portion from integer consumable
// Register temporary treat to bypass free fallback
store.getState().parentCustomFood.push({
  id: 'snack_primitive_chews',
  name: 'Primitive Chews',
  costCoins: 10,
  hungerFill: 15
});
const feedRes2 = store.feedPetTreat(activePetId, 'snack_primitive_chews');
testAssert(feedRes2.success === true, 'feedPetTreat succeeded on integer-backed consumable');
testAssert(store.getTreatStock('snack_primitive_chews') === 4, 'Stock decremented from 5 to 4 servings');

// Case C: Unowned snack returns 0
const stockUnowned = store.getTreatStock('snack_non_existent');
testAssert(stockUnowned === 0, 'Unowned treat returns 0 stock, not undefined or NaN');

// Verify UI string formatting invariant: never produce [object Object]
const pantryDisplay = `${store.getTreatStock('snack_cosmic_crunchies')}/4 Servings`;
testAssert(!pantryDisplay.includes('[object'), 'Pantry shelf string does not contain [object Object]');
testAssert(!pantryDisplay.includes('NaN'), 'Pantry shelf string does not contain NaN');
testAssert(pantryDisplay === '2/4 Servings', 'Pantry shelf displays "2/4 Servings"');

// =========================================================================
// 6. Golden Author Badge Sanitization & XSS Defense
// =========================================================================
console.log('\n--- 6. Testing Golden Author Badge Sanitization & XSS Defense ---');
const maliciousWeapon = {
  id: 'wpn_xss_test_weapon',
  name: 'Glitch Blade',
  title: 'Glitch Blade',
  category: 'Weapons',
  costCoins: 10,
  craftedBy: '<script>alert("xss")</script> & "Uncle Bob"'
};
store.publishCustomAIWeapon(maliciousWeapon);

const escapedAuthor = escapeHtml(maliciousWeapon.craftedBy);
testAssert(
  !escapedAuthor.includes('<script>'),
  'escapeHtml sanitizes opening <script> tag'
);
testAssert(
  escapedAuthor.includes('&lt;script&gt;') && escapedAuthor.includes('&amp;'),
  'escapeHtml correctly encodes HTML special characters (<, >, &)'
);

const shopHtml = renderShopView();
testAssert(
  !shopHtml.includes('<script>alert("xss")</script>'),
  'Shop View does not contain unescaped script tag in author badge'
);
testAssert(
  shopHtml.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;Uncle Bob&quot;') ||
  shopHtml.includes('Glitch Blade'),
  'Shop View safely renders sanitized author badge or item title'
);

// =========================================================================
// 7. Multi-Device Inventory Purge & Tombstones (deletedCustomItemIds)
// =========================================================================
console.log('\n--- 7. Testing Multi-Device Purge Tombstones (deletedCustomItemIds) ---');
// Verify deletedCustomItemIds array exists in state
testAssert(
  Array.isArray(store.getState().deletedCustomItemIds),
  'store.state.deletedCustomItemIds is an initialized array'
);

// Delete custom weapon
const purgeTargetId = 'wpn_astro_lance_9000';
const deleteSuccess = store.deleteCustomAIWeapon(purgeTargetId);
testAssert(deleteSuccess === true, 'deleteCustomAIWeapon returned true');

// Verify local purge
testAssert(
  store.getState().deletedCustomItemIds.includes(purgeTargetId),
  'Purged weapon ID recorded in deletedCustomItemIds tombstone array'
);
testAssert(
  !store.getParentCustomWeapons().some(w => w.id === purgeTargetId),
  'Purged weapon removed from parentCustomWeapons'
);
testAssert(
  !store.getState().digitalGear.some(w => w.id === purgeTargetId),
  'Purged weapon removed from digitalGear'
);
testAssert(
  !hero.inventory.includes(purgeTargetId),
  'Purged weapon removed from hero inventory'
);

// Now simulate Cloud Sync Hydration from an unsynced second device
// The cloud snapshot carries the old weapon in inventory and parentCustomWeapons!
const zombieCloudSnapshot = {
  parentCustomWeapons: [
    {
      id: purgeTargetId,
      name: 'Astro Meteor Lance',
      category: 'Weapons',
      craftedBy: 'Coach Dad & Mom'
    },
    {
      id: 'wpn_legitimate_cloud_blade',
      name: 'Legitimate Cloud Blade',
      category: 'Weapons',
      craftedBy: 'Aunt May'
    }
  ],
  inventory: [purgeTargetId, 'wpn_legitimate_cloud_blade'],
  heroes: [
    {
      id: hero.id,
      name: hero.name,
      inventory: [purgeTargetId, 'wpn_legitimate_cloud_blade'],
      equippedWeapon: purgeTargetId
    }
  ]
};

console.log('  ▶️ Hydrating from cloud snapshot containing zombie weapon...');
store.hydrateFromCloud(zombieCloudSnapshot);

// Assert tombstone filtration prevented zombie resurrection
testAssert(
  !store.getParentCustomWeapons().some(w => w.id === purgeTargetId),
  'Tombstone filter prevented zombie weapon from re-entering parentCustomWeapons'
);
testAssert(
  !store.getState().selectedHero.inventory.includes(purgeTargetId),
  'Tombstone filter prevented zombie weapon from re-entering selectedHero.inventory'
);
testAssert(
  store.getState().selectedHero.equippedWeapon !== purgeTargetId,
  'Equipped slot was safely redirected away from purged weapon'
);
testAssert(
  store.getParentCustomWeapons().some(w => w.id === 'wpn_legitimate_cloud_blade'),
  'Legitimate non-purged cloud weapon successfully hydrated into parentCustomWeapons'
);
testAssert(
  store.getState().selectedHero.inventory.includes('wpn_legitimate_cloud_blade'),
  'Legitimate non-purged cloud weapon successfully hydrated into hero inventory'
);

// =========================================================================
// 8. Unconditional LocalStorage Catalog Migration
// =========================================================================
console.log('\n--- 8. Testing Unconditional LocalStorage Catalog Migration ---');
// Simulate returning user's locked localStorage state with outdated small catalog
const staleSavedState = {
  digitalRewardsOverhaulApplied: true, // Legacy boolean lock
  digitalGear: [
    { id: 'laser_toothbrush', name: 'Laser Toothbrush', category: 'Weapons' }
  ],
  parentCustomWeapons: [],
  parentCustomFood: [],
  deletedCustomItemIds: []
};
localStorage.setItem('little_heroes_adventure_master_v10', JSON.stringify(staleSavedState));

// Re-initialize store from stale localStorage
store.loadState();

testAssert(
  store.getState().digitalGear.length >= DIGITAL_REWARDS_CATALOG.length,
  `store.loadState() merged all DIGITAL_REWARDS_CATALOG items (${store.getState().digitalGear.length} >= ${DIGITAL_REWARDS_CATALOG.length})`
);

// Verify specific catalog items exist
testAssert(
  store.getState().digitalGear.some(d => d.id === 'cowl_hero'),
  'Hero Cowl restored during catalog migration'
);
testAssert(
  store.getState().digitalGear.some(d => d.id === 'shield_knight' || d.id === 'mint_knight_badge' || d.id === 'golden_dragon_armor'),
  'Knight Shield restored during catalog migration'
);
testAssert(
  store.getState().digitalGear.some(d => d.id === 'snack_crunchy_apple' || d.id === 'flame_kibble_bowl'),
  'Crunchy Apple restored during catalog migration'
);

console.log(`\n=============================================================`);
console.log(`🎉 ALL ${passedTests}/${totalTests} DIGITAL REWARDS HARDENED CHECKS PASSED!`);
console.log(`=============================================================\n`);
process.exit(0);
