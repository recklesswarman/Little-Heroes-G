/**
 * test_digital_rewards_revamp.cjs
 * Comprehensive Verification Test for Digital Rewards Overhaul & 3D Asset System Revamp
 */

const assert = require('assert');

// Mock localStorage for Node.js environment
const storageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
global.localStorage = storageMock;

// Mock window and document minimal elements for store audio / analytics
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
  }
};

async function runTests() {
  console.log('🧪 Starting Digital Rewards Overhaul Verification Tests...\n');

  // 1. Verify digitalRewardsCatalog.js
  console.log('--- Test 1: digitalRewardsCatalog Integrity & 3D Assets ---');
  const catalogModule = await import('../src/data/digitalRewardsCatalog.js');
  const catalog = catalogModule.DIGITAL_REWARDS_CATALOG;
  assert(Array.isArray(catalog), 'DIGITAL_REWARDS_CATALOG must be an array');
  assert(catalog.length >= 10, 'Catalog must contain multiple digital rewards');

  const categories = new Set(catalog.map(item => item.category));
  assert(categories.has('Weapons'), 'Catalog must include Weapons category');
  assert(categories.has('Avatar Gear'), 'Catalog must include Avatar Gear');
  assert(categories.has('Badges'), 'Catalog must include Badges');
  assert(categories.has('Snacks'), 'Catalog must include Snacks');

  // Verify voiceLine on every item and zero pink/purple in assets
  catalog.forEach(item => {
    assert(item.id, `Item ${item.name} must have an id`);
    assert(item.name, `Item ${item.id} must have a name`);
    assert(typeof item.costCoins === 'number', `Item ${item.id} must have costCoins`);
    assert(item.voiceLine, `Item ${item.id} must have Rex voice assistance line`);
    assert(item.splineUrl || item.modelUrl, `Item ${item.id} must have 3D spline or model URL`);

    // Verify boy-friendly design rule (zero purple/pink in hex codes)
    const colorStr = JSON.stringify(item).toLowerCase();
    assert(!colorStr.includes('#ec4899'), `Item ${item.id} must not use pink #ec4899`);
    assert(!colorStr.includes('#a855f7'), `Item ${item.id} must not use purple #a855f7`);

    if (item.category === 'Snacks') {
      assert(item.usageType === 'single_use' || item.usageType === 'multi_use', `Food ${item.id} must define usageType`);
      assert(item.maxServings >= 1, `Food ${item.id} must define maxServings >= 1`);
    }

    if (item.category === 'Weapons') {
      assert(item.statBonusType === 'damage_boost', `Weapon ${item.id} must boost damage`);
      assert(item.statBonusPercent >= 10, `Weapon ${item.id} must have statBonusPercent >= 10`);
    }
  });
  console.log(`✅ Test 1 Passed: Verified ${catalog.length} catalog items with 3D models, Rex voice lines & boy-friendly palettes.\n`);

  // 2. Verify Store Initialization & Weapons Arsenal Single-Equip Rule
  console.log('--- Test 2: Store Weapons Arsenal & 1-Equipped Rule ---');
  const storeModule = await import('../src/state/store.js');
  const store = storeModule.store;

  // Reset store to known state
  storageMock.clear();
  store.init();

  const hero = store.getSelectedHero();
  const hero1Id = hero.id;
  assert(hero, 'Store must have an active selectedHero');
  assert(Array.isArray(hero.inventory), 'Hero must have an inventory array');

  // Give hero coins to purchase weapons
  store.addCoins(500);

  // Buy 2 weapons
  const buyRes1 = store.buyDigitalGear('weapon_plasma_saber');
  assert(buyRes1.success, 'Buying Star-Plasma Saber should succeed');
  assert(hero.inventory.includes('weapon_plasma_saber'), 'Plasma saber must be in inventory');
  assert(store.getEquippedHeroWeapon() === 'weapon_plasma_saber', 'First weapon should auto-equip');

  const buyRes2 = store.buyDigitalGear('weapon_hydro_blaster');
  assert(buyRes2.success, 'Buying Hydro Blaster should succeed');
  assert(hero.inventory.includes('weapon_hydro_blaster'), 'Hydro blaster must be in inventory');
  // Equipping second weapon overrides active slot so ONLY 1 weapon is equipped
  assert(store.getEquippedHeroWeapon() === 'weapon_hydro_blaster', 'Newly equipped weapon must be active');

  // Switch back to weapon 1
  const equipRes = store.equipHeroWeapon('weapon_plasma_saber');
  assert(equipRes.success, 'Equipping owned plasma saber should succeed');
  assert(store.getEquippedHeroWeapon() === 'weapon_plasma_saber', 'Plasma saber should be equipped');

  // Try equipping unowned weapon
  const unownedRes = store.equipHeroWeapon('unowned_fake_sword');
  assert(!unownedRes.success, 'Equipping unowned weapon must fail');
  assert(store.getEquippedHeroWeapon() === 'weapon_plasma_saber', 'Equipped weapon should remain plasma saber');
  console.log('✅ Test 2 Passed: Weapons can be purchased in multiples, but strictly 1 equipped at a time per battle.\n');

  // 3. Verify Pet Food Servings & Feed Snack Engine
  console.log('--- Test 3: Pet Food Consumables & Servings Engine ---');
  // Purchase multi-use snack (e.g. Starberry Bites: 3 servings)
  const buyFoodRes = store.buyDigitalGear('food_starberry_bites');
  assert(buyFoodRes.success, 'Buying starberry bites should succeed');

  const consumables = hero.consumables || [];
  const foodItem = consumables.find(c => c.id === 'food_starberry_bites');
  assert(foodItem, 'Food item must be present in hero consumables');
  assert.strictEqual(foodItem.servingsRemaining, 3, 'Initial servings should be 3');

  // Feed pet serving 1
  const initialHunger = store.getState().petSanctuary.hunger;
  const feedRes1 = store.feedPetConsumableSnack('food_starberry_bites');
  assert(feedRes1.success, 'Feeding serving 1 should succeed');
  assert.strictEqual(feedRes1.servingsRemaining, 2, 'Servings remaining should be 2');
  assert(store.getState().petSanctuary.hunger >= initialHunger, 'Pet hunger must increase after eating');

  // Feed serving 2
  const feedRes2 = store.feedPetConsumableSnack('food_starberry_bites');
  assert(feedRes2.success, 'Feeding serving 2 should succeed');
  assert.strictEqual(feedRes2.servingsRemaining, 1, 'Servings remaining should be 1');

  // Feed serving 3 (final serving)
  const feedRes3 = store.feedPetConsumableSnack('food_starberry_bites');
  assert(feedRes3.success, 'Feeding serving 3 should succeed');
  assert.strictEqual(feedRes3.servingsRemaining, 0, 'Servings remaining should be 0');

  // Check that consumed item is removed from consumables list
  const emptyCheck = (hero.consumables || []).find(c => c.id === 'food_starberry_bites');
  assert(!emptyCheck, 'Food item should be removed from consumables when 0 servings remain');

  // Feeding non-existent snack should fail gracefully
  const failFeed = store.feedPetConsumableSnack('food_starberry_bites');
  assert(!failFeed.success, 'Feeding empty snack should fail');
  console.log('✅ Test 3 Passed: Multi-use pet food servings accurately decrement and remove upon exhaustion.\n');

  // 4. Verify Per-Hero Isolation
  console.log('--- Test 4: Strict Per-Hero Profile Inventory Isolation ---');
  // Add Hero 2
  store.addHero({ name: 'Hero Leo', avatar: '🦁' });
  const heroes = store.getState().heroes;
  const hero2 = heroes.find(h => h.name === 'Hero Leo');
  assert(hero2, 'Hero Leo must exist in heroes list');

  // Switch to Hero 2
  store.switchHero(hero2.id);
  const activeHero2 = store.getSelectedHero();
  assert.strictEqual(activeHero2.id, hero2.id, 'Active hero must be Hero Leo');
  assert(!activeHero2.inventory.includes('weapon_plasma_saber'), 'Hero Leo must NOT inherit Hero 1 inventory');
  assert.strictEqual(store.getEquippedHeroWeapon(), null, 'Hero Leo must have no equipped weapon initially');

  // Switch back to Hero 1
  store.switchHero(hero1Id);
  assert(store.getSelectedHero().inventory.includes('weapon_plasma_saber'), 'Hero 1 must retain own inventory');
  assert.strictEqual(store.getEquippedHeroWeapon(), 'weapon_plasma_saber', 'Hero 1 must retain equipped weapon');
  console.log('✅ Test 4 Passed: Strict profile isolation maintained across heroes.\n');

  // 5. Verify Parent Portal Pricing & Food Settings Update
  console.log('--- Test 5: updateAllPricing with foodSettingsMap ---');
  const realLifeMap = {};
  const digitalMap = { 'weapon_plasma_saber': 90, 'food_starberry_bites': 35 };
  const themesMap = {};
  const statBonusMap = { 'weapon_plasma_saber': 30 };
  const foodSettingsMap = {
    'food_starberry_bites': { usageType: 'multi_use', maxServings: 5 }
  };

  store.updateAllPricing(realLifeMap, digitalMap, themesMap, statBonusMap, foodSettingsMap);

  const updatedWeapon = store.getState().digitalGear.find(g => g.id === 'weapon_plasma_saber');
  assert.strictEqual(updatedWeapon.costCoins, 90, 'Weapon price should be updated to 90');
  assert.strictEqual(updatedWeapon.statBonusPercent, 30, 'Weapon stat bonus should be updated to 30%');

  const updatedFood = store.getState().digitalGear.find(g => g.id === 'food_starberry_bites');
  assert.strictEqual(updatedFood.costCoins, 35, 'Food price should be updated to 35');
  assert.strictEqual(updatedFood.maxServings, 5, 'Food max servings should be updated to 5');
  console.log('✅ Test 5 Passed: Parent Portal pricing and food settings map successfully applied.\n');

  console.log('🎉 ALL 5 VERIFICATION SUITES PASSED FLAWLESSLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
