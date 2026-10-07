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

import { store } from '../src/state/store.js';
import { renderShopView } from '../src/views/ShopView.js';
import { renderParentPortalView, setActiveAdminTab } from '../src/views/ParentPortalView.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Test failed: ${message}`);
  }
}

console.log('🚀 --- Starting Digital Rewards Complete Loop Verification Suite ---\n');

// 1. Studio Weapon Publishing & Customizable Author Badge
console.log('--- 1. Testing Parent Studio Weapon Publishing & Author Signature ---');
const customWeapon = {
  id: 'test_laser_katana_001',
  name: 'Starlight Laser Katana',
  title: 'Starlight Laser Katana',
  desc: 'Forged from starlight for bedtime bravery!',
  category: 'Weapons',
  archetype: 'laser_sword',
  statBonusType: 'damage_boost',
  statBonusPercent: 35,
  statBonusLabel: '+35% Boss Attack Power',
  costCoins: 250,
  craftedBy: 'Dad & Coach',
  deliveryMethod: 'instant_gift',
  targetChildProfile: 'all'
};

const publishedW = store.publishCustomAIWeapon(customWeapon);
assert(publishedW !== null, 'publishCustomAIWeapon returned published weapon object');
assert(publishedW.id === 'test_laser_katana_001', 'Weapon has correct ID');
assert(publishedW.craftedBy === 'Dad & Coach', 'Weapon retains custom "Crafted By" author');
assert(publishedW.category === 'Weapons', 'Weapon is categorized as Weapons');

const parentWeapons = store.getParentCustomWeapons();
assert(parentWeapons.some(w => w.id === 'test_laser_katana_001'), 'Weapon exists in getParentCustomWeapons()');

// 2. Instant Gift Delivery & 1 Active Combat Weapon Slot
console.log('\n--- 2. Testing Instant Gift Delivery & 1 Active Combat Weapon ---');
const activeHero = store.getState().selectedHero;
assert(activeHero.inventory.includes('test_laser_katana_001'), 'Weapon was auto-added to active child inventory via instant_gift');
assert(activeHero.equippedWeapon === 'test_laser_katana_001', 'Weapon was equipped as the active combat weapon');

const equippedWeaponObj = store.getEquippedHeroWeapon(true);
assert(equippedWeaponObj !== null, 'getEquippedHeroWeapon(true) returns weapon object');
assert(equippedWeaponObj.name === 'Starlight Laser Katana', 'Equipped weapon object matches published weapon');
assert(equippedWeaponObj.statBonusPercent === 35, 'Weapon stat bonus multiplier is preserved');

// 3. Shop View Display & Golden "Crafted by" Badge
console.log('\n--- 3. Testing Kid Shop View & Crafted By Badge ---');
const shopHtml = renderShopView();
assert(shopHtml.includes('Starlight Laser Katana'), 'Shop View displays parent-crafted weapon');
assert(shopHtml.includes('⭐ Crafted by Dad &amp; Coach') || shopHtml.includes('⭐ Crafted by Dad & Coach'), 'Shop View displays "⭐ Crafted by Dad & Coach" badge');
assert(shopHtml.includes('Equipped (1/1)'), 'Shop View indicates weapon is currently equipped (1/1)');

// 4. Parent Studio Custom Food & Dynamic Servings Counter
console.log('\n--- 4. Testing Pet Snack Publishing & Multi-Use Servings ---');
const customFood = {
  id: 'test_mega_berry_puff',
  name: 'Mega Berry Power Puff',
  title: 'Mega Berry Power Puff',
  category: 'Snacks',
  craftedBy: 'Mom',
  costCoins: 30,
  hungerFill: 40,
  quantityPerPurchase: 5,
  maxServings: 5,
  usageType: 'multi_use'
};

const publishedF = store.publishCustomAIFood(customFood);
assert(publishedF !== null, 'publishCustomAIFood returned food object');
assert(publishedF.craftedBy === 'Mom', 'Food retains custom author "Mom"');

const parentFood = store.getParentCustomFood();
assert(parentFood.some(f => f.id === 'test_mega_berry_puff'), 'Food exists in getParentCustomFood()');

// Buy treat pack and feed
activeHero.coins = 100;
const buySuccess = store.buyTreatPack('test_mega_berry_puff');
assert(buySuccess === true, 'Successfully bought treat pack');
assert(store.getTreatStock('test_mega_berry_puff') === 5, 'Consumable stock is 5 servings');

// Feed one portion
const feedRes = store.feedPetTreat(activeHero.activePetId, 'test_mega_berry_puff');
assert(feedRes.success !== false, 'Pet feed succeeded');
assert(store.getTreatStock('test_mega_berry_puff') === 4, 'Stock decremented to 4 servings');

// 5. Parent Portal View Rendering
console.log('\n--- 5. Testing Parent Portal View UI & Studio Galleries ---');
setActiveAdminTab('studio');
const parentPortalHtml = renderParentPortalView();
assert(parentPortalHtml.includes('studio-crafted-by-input'), 'Parent Portal renders #studio-crafted-by-input');
assert(parentPortalHtml.includes('data-category="weapon"'), 'Parent Portal renders Combat Battle Weapons tab');
assert(parentPortalHtml.includes('Published Custom Battle Weapons'), 'Parent Portal renders Published Custom Battle Weapons gallery');
assert(parentPortalHtml.includes('delete-custom-weapon-btn'), 'Parent Portal includes delete-custom-weapon-btn');

// 6. Global Deletion Cascade
console.log('\n--- 6. Testing Global Deletion Cascade Across Child Inventories ---');
// Delete weapon
const deleteWeaponRes = store.deleteCustomAIWeapon('test_laser_katana_001');
assert(deleteWeaponRes === true, 'deleteCustomAIWeapon returned true');
assert(!store.getParentCustomWeapons().some(w => w.id === 'test_laser_katana_001'), 'Weapon removed from parentCustomWeapons');
assert(!store.getState().digitalGear.some(w => w.id === 'test_laser_katana_001'), 'Weapon removed from digitalGear');
assert(!store.getState().selectedHero.inventory.includes('test_laser_katana_001'), 'Weapon purged from selectedHero inventory');
assert(store.getState().selectedHero.equippedWeapon === 'laser_toothbrush', 'Equipped weapon safely reverted to default starter toothbrush saber');

// Delete food
const deleteFoodRes = store.deleteCustomAIFood('test_mega_berry_puff');
assert(deleteFoodRes === true, 'deleteCustomAIFood returned true');
assert(!store.getParentCustomFood().some(f => f.id === 'test_mega_berry_puff'), 'Food removed from parentCustomFood');
assert(!store.getState().selectedHero.consumables['test_mega_berry_puff'], 'Food purged from hero consumables');

// 7. Multi-Device Cloud Hydration Test
console.log('\n--- 7. Testing Cloud Snapshot & Hydration Preservation ---');
const mockCloudData = {
  parentCustomWeapons: [
    {
      id: 'cloud_sync_weapon_99',
      name: 'Cosmic Star Saber',
      category: 'Weapons',
      craftedBy: 'Grandma',
      statBonusPercent: 25,
      costCoins: 150
    }
  ],
  parentCustomFood: [
    {
      id: 'cloud_sync_snack_99',
      name: 'Moon Honey Drops',
      category: 'Snacks',
      craftedBy: 'Grandpa',
      quantityPerPurchase: 3,
      costCoins: 25
    }
  ]
};

store.hydrateFromCloud(mockCloudData);
assert(store.getParentCustomWeapons().some(w => w.id === 'cloud_sync_weapon_99'), 'Cloud weapon hydrated into store.parentCustomWeapons');
assert(store.getParentCustomFood().some(f => f.id === 'cloud_sync_snack_99'), 'Cloud food hydrated into store.parentCustomFood');

console.log(`\n=============================================================`);
console.log(`🎉 ALL ${passedTests}/${totalTests} DIGITAL REWARDS OVERHAUL CHECKS PASSED!`);
console.log(`=============================================================\n`);
process.exit(0);
