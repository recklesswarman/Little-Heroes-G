/**
 * scratch/adversarial_rewards_stress_test.mjs
 * 
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE
 * Challenger 2: Digital Rewards State Machine Adversarial Testing
 * 
 * Tests 4 Key Adversarial Dimensions:
 * 1. Pantry Feedings & Dynamic Servings (Negative servings, nulls, missing IDs, unlisted consumables, zero-coin treats, UI non-leakage)
 * 2. Habit Bounty Streak Transitions (Streak reset on lapse, streak overflow, concurrent bounties, profile isolation, alias matching, corrupted bounties)
 * 3. Multi-Device Cloud Hydration (Zombie resurrection across parentCustomWeapons & digitalGear, corrupt payloads, prototype pollution)
 * 4. Golden Author Badge & XSS Vectors (Polyglots, script tags, event handlers, encoded tags across ShopView, PetSanctuaryView, ParentPortalView, RewardModal, GiftCrateModal)
 */

import assert from 'assert';

// ---------------------------------------------------------------------------
// Mock browser environment for Node.js
// ---------------------------------------------------------------------------
const storageStore = {};
globalThis.localStorage = {
  getItem: (key) => storageStore[key] || null,
  setItem: (key, val) => { storageStore[key] = String(val); },
  removeItem: (key) => { delete storageStore[key]; },
  clear: () => { Object.keys(storageStore).forEach(k => delete storageStore[k]); }
};

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
  createElement: (tag) => ({
    tagName: tag,
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

// Import modules
const { store } = await import('../src/state/store.js');
const { DIGITAL_REWARDS_CATALOG } = await import('../src/data/digitalRewardsCatalog.js');
const { SANCTUARY_TREATS } = await import('../src/data/petsData.js');
const { escapeHtml } = await import('../src/utils/escapeHtml.js');
const { renderShopView } = await import('../src/views/ShopView.js');
const { renderPetSanctuaryView } = await import('../src/views/PetSanctuaryView.js');
const { renderRewardModal } = await import('../src/components/RewardModal.js');
const { renderGiftCrateModal } = await import('../src/components/GiftCrateModal.js');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failures = [];

function check(desc, passed, detail = '') {
  totalChecks++;
  if (passed) {
    passedChecks++;
    console.log(`  ✅ [PASS] ${desc}`);
  } else {
    failedChecks++;
    console.error(`  ❌ [FAIL] ${desc}${detail ? ` -> ${detail}` : ''}`);
    failures.push({ desc, detail });
  }
}

console.log('======================================================================');
console.log('⚔️  CHALLENGER 2: ADVERSARIAL STRESS TEST HARNESS');
console.log('======================================================================\n');

// Reset store to clean baseline
localStorage.clear();
store.init();

// ===========================================================================
// SUITE 1: PANTRY FEEDINGS & DYNAMIC SERVINGS
// ===========================================================================
console.log('--- SUITE 1: Pantry Feedings & Dynamic Servings Stress Tests ---');

// 1.1 Negative servingsRemaining in Object
const hero = store.getSelectedHero();
hero.consumables = hero.consumables || {};
hero.consumables['test_neg_treat'] = {
  id: 'test_neg_treat',
  servingsRemaining: -5,
  maxServings: 5
};
store.publishCustomAIFood({
  id: 'test_neg_treat',
  name: 'Negative Treat',
  costCoins: 10,
  maxServings: 5
});
const stockNeg = store.getTreatStock('test_neg_treat');
check('1.1.1 Negative servings returns number', typeof stockNeg === 'number');
check('1.1.2 Negative servings does not return NaN', !isNaN(stockNeg));
const feedNegRes = store.feedPetTreat(hero.activePetId || '1', 'test_neg_treat');
check('1.1.3 feedPetTreat blocks feeding when stock <= 0', feedNegRes.success === false, `Result: ${JSON.stringify(feedNegRes)}`);

// 1.2 Null, undefined, and non-numeric corrupted fields
hero.consumables['test_null_treat'] = { id: 'test_null_treat', servingsRemaining: null };
hero.consumables['test_undef_treat'] = { id: 'test_undef_treat', servingsRemaining: undefined };
hero.consumables['test_nan_treat'] = { id: 'test_nan_treat', servingsRemaining: NaN };
hero.consumables['test_string_treat'] = { id: 'test_string_treat', servingsRemaining: 'invalid_str' };
hero.consumables['test_raw_nan'] = NaN;
hero.consumables['test_raw_null'] = null;
hero.consumables['test_raw_undef'] = undefined;

check('1.2.1 null servingsRemaining returns 0', store.getTreatStock('test_null_treat') === 0);
check('1.2.2 undefined servingsRemaining returns 0', store.getTreatStock('test_undef_treat') === 0);
check('1.2.3 NaN servingsRemaining returns 0', store.getTreatStock('test_nan_treat') === 0);
check('1.2.4 string servingsRemaining returns 0', store.getTreatStock('test_string_treat') === 0);
check('1.2.5 raw NaN entry returns 0', store.getTreatStock('test_raw_nan') === 0);
check('1.2.6 raw null entry returns 0', store.getTreatStock('test_raw_null') === 0);
check('1.2.7 raw undefined entry returns 0', store.getTreatStock('test_raw_undef') === 0);

// 1.3 Missing IDs and unlisted treats
check('1.3.1 Non-existent treat returns 0', store.getTreatStock('completely_unknown_snack_xyz') === 0);
check('1.3.2 null treat ID returns 0', store.getTreatStock(null) === 0);
check('1.3.3 undefined treat ID returns 0', store.getTreatStock(undefined) === 0);

let feedUnknownErr = null;
try {
  const res = store.feedPetTreat(hero.activePetId || '1', 'unknown_snack_id_999');
  check('1.3.4 feedPetTreat with unlisted treat does not throw', res !== undefined);
} catch (e) {
  feedUnknownErr = e;
  check('1.3.4 feedPetTreat with unlisted treat does not throw', false, e.message);
}

// 1.4 Zero-coin and sub-zero coin treats (Free fallback)
const stockApple = store.getTreatStock('crunchy_apple');
check('1.4.1 Zero-coin treat stock returns Infinity', stockApple === Infinity);

// Check if Infinity leaks into UI HTML
const petSanctuaryHtml = renderPetSanctuaryView();
check('1.4.2 Pet Sanctuary UI does not leak "Infinity/ Servings"', !petSanctuaryHtml.includes('Infinity/'));
check('1.4.3 Pet Sanctuary UI does not leak "Infinity left"', !petSanctuaryHtml.includes('Infinity left'));
check('1.4.4 Pet Sanctuary UI renders "Always Free" for zero-coin treats', petSanctuaryHtml.includes('Always Free'));
check('1.4.5 Pet Sanctuary UI contains no NaN', !petSanctuaryHtml.includes('NaN'));
check('1.4.6 Pet Sanctuary UI contains no [object Object]', !petSanctuaryHtml.includes('[object Object]'));

// 1.5 Sub-zero coin treat
store.publishCustomAIFood({
  id: 'test_subzero_snack',
  name: 'Glitch Subzero Snack',
  costCoins: -10,
  maxServings: 3
});
const subzeroStock = store.getTreatStock('test_subzero_snack');
check('1.5.1 Sub-zero cost treat treated as free (Infinity stock)', subzeroStock === Infinity);

// 1.6 Sequential feeding until exhaustion
hero.consumables['snack_rapid_test'] = { id: 'snack_rapid_test', servingsRemaining: 3, maxServings: 3 };
store.publishCustomAIFood({
  id: 'snack_rapid_test',
  name: 'Rapid Snack',
  costCoins: 15,
  maxServings: 3
});
const petId = hero.activePetId || '1';
const r1 = store.feedPetTreat(petId, 'snack_rapid_test');
const r2 = store.feedPetTreat(petId, 'snack_rapid_test');
const r3 = store.feedPetTreat(petId, 'snack_rapid_test');
check('1.6.1 First 3 feedings succeed', r1.success && r2.success && r3.success);
check('1.6.2 Stock after 3 feedings is 0', store.getTreatStock('snack_rapid_test') === 0);
const r4 = store.feedPetTreat(petId, 'snack_rapid_test');
check('1.6.3 4th feeding rejected as Out of Stock', r4.success === false);
check('1.6.4 Consumables entry safely deleted upon exhaustion', hero.consumables['snack_rapid_test'] === undefined);

// 1.7 Corrupted consumables structure resilience
const originalConsumables = hero.consumables;
hero.consumables = null;
check('1.7.1 getTreatStock survives null consumables', store.getTreatStock('snack_rapid_test') === 0);
hero.consumables = "invalid_string";
check('1.7.2 getTreatStock survives string consumables', store.getTreatStock('snack_rapid_test') === 0);
hero.consumables = [null, undefined, { id: 'arr_snack', servingsRemaining: 2 }];
check('1.7.3 getTreatStock survives sparse array with nulls', store.getTreatStock('arr_snack') === 2);
hero.consumables = originalConsumables;


// ===========================================================================
// SUITE 2: HABIT BOUNTY STREAK BOUNDARIES & TRANSITIONS
// ===========================================================================
console.log('\n--- SUITE 2: Habit Bounty Streak Boundaries & Transitions ---');

// 2.1 Standard streak completion
store.getState().pendingBounties = [
  {
    id: 'bounty_standard_3d',
    item: { id: 'wpn_bounty_std', name: 'Std Mace', category: 'Weapons' },
    category: 'weapon',
    targetStreakDays: 3,
    currentStreakProgress: 0,
    habitId: 'brush_teeth',
    targetChildProfile: 'all'
  }
];
store.checkAndAwardHabitBounties('brush_teeth', hero);
check('2.1.1 Progress 1 reached', store.getState().pendingBounties[0]?.currentStreakProgress === 1);
store.checkAndAwardHabitBounties('brush_teeth', hero);
check('2.1.2 Progress 2 reached', store.getState().pendingBounties[0]?.currentStreakProgress === 2);
store.checkAndAwardHabitBounties('brush_teeth', hero);
check('2.1.3 Bounty completed & removed at target 3', !store.getState().pendingBounties.some(b => b.id === 'bounty_standard_3d'));
check('2.1.4 Weapon awarded to hero inventory', hero.inventory.includes('wpn_bounty_std'));
check('2.1.5 Weapon auto-equipped', hero.equippedWeapon === 'wpn_bounty_std');

// 2.2 Streak Overflow (Completing further actions after award)
store.checkAndAwardHabitBounties('brush_teeth', hero);
store.checkAndAwardHabitBounties('brush_teeth', hero);
check('2.2.1 Post-award completions do not cause double crate awards or errors', 
  store.getState().pendingGiftCrates.filter(c => c.item?.id === 'wpn_bounty_std').length === 1
);

// 2.3 Zero or negative target streak
store.getState().pendingBounties = [
  {
    id: 'bounty_zero_target',
    item: { id: 'wpn_zero_target', name: 'Instant Zero Mace', category: 'Weapons' },
    category: 'weapon',
    targetStreakDays: 0,
    currentStreakProgress: 0,
    habitId: 'brush_teeth',
    targetChildProfile: 'all'
  },
  {
    id: 'bounty_neg_target',
    item: { id: 'wpn_neg_target', name: 'Instant Neg Mace', category: 'Weapons' },
    category: 'weapon',
    targetStreakDays: -2,
    currentStreakProgress: 0,
    habitId: 'brush_teeth',
    targetChildProfile: 'all'
  }
];
store.checkAndAwardHabitBounties('brush_teeth', hero);
check('2.3.1 Target 0 awarded on 1st completion', !store.getState().pendingBounties.some(b => b.id === 'bounty_zero_target'));
check('2.3.2 Negative target awarded on 1st completion', !store.getState().pendingBounties.some(b => b.id === 'bounty_neg_target'));

// 2.4 Concurrent Bounties on Same Habit
store.getState().pendingBounties = [
  {
    id: 'bounty_conc_1',
    item: { id: 'wpn_conc_1', name: 'Conc Sword 1', category: 'Weapons' },
    category: 'weapon',
    targetStreakDays: 1,
    currentStreakProgress: 0,
    habitId: 'brush_teeth',
    targetChildProfile: 'all'
  },
  {
    id: 'bounty_conc_2',
    item: { id: 'wpn_conc_2', name: 'Conc Sword 2', category: 'Weapons' },
    category: 'weapon',
    targetStreakDays: 1,
    currentStreakProgress: 0,
    habitId: 'brush_teeth',
    targetChildProfile: 'all'
  },
  {
    id: 'bounty_conc_3',
    item: { id: 'wpn_conc_3', name: 'Conc Sword 3', category: 'Weapons' },
    category: 'weapon',
    targetStreakDays: 2,
    currentStreakProgress: 0,
    habitId: 'brush_teeth',
    targetChildProfile: 'all'
  }
];
store.checkAndAwardHabitBounties('brush_teeth', hero);
check('2.4.1 Concurrent 1-day bounty 1 awarded', !store.getState().pendingBounties.some(b => b.id === 'bounty_conc_1'));
check('2.4.2 Concurrent 1-day bounty 2 awarded', !store.getState().pendingBounties.some(b => b.id === 'bounty_conc_2'));
check('2.4.3 Concurrent 2-day bounty 3 reached progress 1', store.getState().pendingBounties.find(b => b.id === 'bounty_conc_3')?.currentStreakProgress === 1);
store.checkAndAwardHabitBounties('brush_teeth', hero);
check('2.4.4 Concurrent 2-day bounty 3 awarded on day 2', !store.getState().pendingBounties.some(b => b.id === 'bounty_conc_3'));

// 2.5 Child Profile Isolation in Bounties
store.getState().pendingBounties = [
  {
    id: 'bounty_hero1_only',
    item: { id: 'wpn_hero1', name: 'Hero 1 Dagger', category: 'Weapons' },
    category: 'weapon',
    targetStreakDays: 1,
    currentStreakProgress: 0,
    habitId: 'brush_teeth',
    targetChildProfile: 'hero_1'
  },
  {
    id: 'bounty_hero2_only',
    item: { id: 'wpn_hero2', name: 'Hero 2 Dagger', category: 'Weapons' },
    category: 'weapon',
    targetStreakDays: 1,
    currentStreakProgress: 0,
    habitId: 'brush_teeth',
    targetChildProfile: 'hero_other_kid'
  }
];
store.checkAndAwardHabitBounties('brush_teeth', { id: 'hero_1', name: 'Hero One' });
check('2.5.1 Targeted bounty for active hero completed', !store.getState().pendingBounties.some(b => b.id === 'bounty_hero1_only'));
check('2.5.2 Targeted bounty for other child profile NOT completed', store.getState().pendingBounties.some(b => b.id === 'bounty_hero2_only'));
check('2.5.3 Other child bounty progress remains 0', store.getState().pendingBounties.find(b => b.id === 'bounty_hero2_only')?.currentStreakProgress === 0);

// 2.6 Habit Alias Boundaries
store.getState().pendingBounties = [
  {
    id: 'bounty_brush_alias',
    item: { id: 'wpn_alias', name: 'Alias Staff', category: 'Weapons' },
    category: 'weapon',
    targetStreakDays: 5,
    currentStreakProgress: 0,
    habitId: 'brush_teeth',
    targetChildProfile: 'all'
  }
];
store.checkAndAwardHabitBounties('morning_brush', hero); // +1
store.checkAndAwardHabitBounties('bedtime_brush', hero); // +1
store.checkAndAwardHabitBounties('toothbrush_adventure_battle', hero); // +1
store.checkAndAwardHabitBounties('clean_toys', hero); // unmatching habit!
check('2.6.1 3 valid brush aliases incremented progress to 3', store.getState().pendingBounties[0]?.currentStreakProgress === 3);
check('2.6.2 Unrelated habit clean_toys did not increment brush bounty', store.getState().pendingBounties[0]?.currentStreakProgress === 3);

// 2.7 Streak Reset on Lapse Check
// Observation: pendingBounties track currentStreakProgress as cumulative count without date expiration
const bountyLapseCheck = store.getState().pendingBounties[0];
check('2.7.1 Habit bounties use cumulative progress model (no date-based lapse reset)', bountyLapseCheck.currentStreakProgress === 3);

// 2.8 Corrupted Bounty Object Resilience (null item, missing id)
store.getState().pendingBounties.push({
  id: 'bounty_corrupt_null_item',
  item: null,
  category: 'weapon',
  targetStreakDays: 1,
  currentStreakProgress: 0,
  habitId: 'brush_teeth'
});
let corruptBountyErr = null;
try {
  store.checkAndAwardHabitBounties('brush_teeth', hero);
} catch (e) {
  corruptBountyErr = e;
}
check('2.8.1 checkAndAwardHabitBounties handles corrupt bounty safely without throwing', corruptBountyErr === null, corruptBountyErr ? corruptBountyErr.message : 'no error');


// ===========================================================================
// SUITE 3: MULTI-DEVICE CLOUD HYDRATION & ZOMBIE RESURRECTION
// ===========================================================================
console.log('\n--- SUITE 3: Cloud Hydration & Zombie Custom Items Stress Tests ---');

// 3.1 Standard Weapon Purge Tombstone Check
const purgeWpnId = 'wpn_zombie_test_blade_99';
store.publishCustomAIWeapon({
  id: purgeWpnId,
  name: 'Zombie Test Blade',
  category: 'Weapons',
  deliveryMethod: 'instant_gift'
});
check('3.1.1 Weapon created and equipped', hero.equippedWeapon === purgeWpnId);
store.deleteCustomAIWeapon(purgeWpnId);
check('3.1.2 Weapon tombstoned in deletedCustomItemIds', store.getState().deletedCustomItemIds.includes(purgeWpnId));
check('3.1.3 Equipped slot reset away from purged weapon', hero.equippedWeapon !== purgeWpnId);

// 3.2 Zombie Cloud Snapshot Testing (parentCustomWeapons, inventory, heroes)
const zombieCloud1 = {
  parentCustomWeapons: [{ id: purgeWpnId, name: 'Zombie Test Blade', category: 'Weapons' }],
  inventory: [purgeWpnId],
  heroes: [{ id: hero.id, name: hero.name, inventory: [purgeWpnId], equippedWeapon: purgeWpnId }]
};
store.hydrateFromCloud(zombieCloud1);
check('3.2.1 Tombstone prevents zombie in parentCustomWeapons', !store.getParentCustomWeapons().some(w => w.id === purgeWpnId));
check('3.2.2 Tombstone prevents zombie in hero.inventory', !hero.inventory.includes(purgeWpnId));
check('3.2.3 Tombstone redirects zombie equippedWeapon', hero.equippedWeapon !== purgeWpnId);

// 3.3 Zombie Weapon via digitalGear (CRITICAL CHALLENGE VECTOR)
console.log('  ▶️ Testing zombie resurrection via cloudData.digitalGear...');
const zombieCloudWithDigitalGear = {
  digitalGear: [
    { id: purgeWpnId, name: 'Zombie Test Blade', category: 'Weapons', costCoins: 100 }
  ]
};
store.hydrateFromCloud(zombieCloudWithDigitalGear);
const isResurrectedInDigitalGear = store.getState().digitalGear.some(w => w.id === purgeWpnId);
check('3.3.1 digitalGear in hydrateFromCloud is properly filtered against deletedCustomItemIds', 
  isResurrectedInDigitalGear === false, 
  `Purged item ${purgeWpnId} was restored into store.state.digitalGear!`
);

// 3.4 Corrupt Cloud Payloads
let hydErr1 = null, hydErr2 = null, hydErr3 = null, hydErr4 = null, hydErr5 = null;
try { store.hydrateFromCloud(null); } catch (e) { hydErr1 = e; }
check('3.4.1 hydrateFromCloud handles null safely', hydErr1 === null);

try { store.hydrateFromCloud('corrupt_string_payload'); } catch (e) { hydErr2 = e; }
check('3.4.2 hydrateFromCloud handles string payload safely', hydErr2 === null);

try {
  store.hydrateFromCloud({
    heroes: [null, undefined, { notAHero: true }, { id: 'valid_h2', name: 'Valid Two' }],
    parentCustomWeapons: [null, 'corrupt', { id: null }, { id: 'valid_wpn_2', name: 'Valid Weapon 2' }],
    deletedCustomItemIds: [null, undefined, 12345]
  });
} catch (e) { hydErr3 = e; }
check('3.4.3 hydrateFromCloud survives sparse arrays with nulls & corrupt objects', hydErr3 === null, hydErr3?.message);

// 3.5 Prototype Pollution Attempt
try {
  store.hydrateFromCloud({
    stateSnapshot: JSON.parse('{"__proto__":{"polluted":true}}')
  });
} catch (e) { hydErr4 = e; }
check('3.4.4 Object prototype not polluted', ({}).polluted === undefined);


// ===========================================================================
// SUITE 4: GOLDEN AUTHOR BADGE & ADVANCED XSS VECTORS
// ===========================================================================
console.log('\n--- SUITE 4: Golden Author Badge & Advanced XSS Vectors ---');

const xssPayloads = [
  { name: 'Standard Script Tag', payload: '<script>alert("XSS")</script>' },
  { name: 'Double Quote Script Breakout', payload: '"><script>alert(document.domain)</script>' },
  { name: 'Single Quote Attribute Event', payload: "' onmouseover='alert(1)'" },
  { name: 'Img Onerror', payload: '<img src="x" onerror="alert(1)">' },
  { name: 'Svg Onload', payload: '<svg/onload=alert("svg_xss")>' },
  { name: 'Details Ontoggle', payload: '<details open ontoggle=alert(1)>' },
  { name: 'Javascript URI', payload: 'javascript:alert(1)' },
  { name: 'Polyglot Payload', payload: 'jaVasCript:/*-/*`/*\\`/*\'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/<titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert()//>\\x3e' },
  { name: 'Encoded HTML Entities', payload: '&lt;script&gt;alert(1)&lt;/script&gt;' },
  { name: 'Newline SVG Tag', payload: '<svg\nonload=alert(1)>' }
];

let allEscapesSanitized = true;
for (const testItem of xssPayloads) {
  const escaped = escapeHtml(testItem.payload);
  const containsRawTag = escaped.includes('<script') || escaped.includes('<img') || escaped.includes('<svg') || escaped.includes('<details');
  const containsRawDoubleQuote = escaped.includes('"');
  const containsRawSingleQuote = escaped.includes("'");
  if (containsRawTag || containsRawDoubleQuote || containsRawSingleQuote) {
    allEscapesSanitized = false;
    console.error(`    Unsafe escape for payload: ${testItem.name} -> ${escaped}`);
  }
}
check('4.1 escapeHtml sterilizes all raw HTML tags and quotes across 10 payloads', allEscapesSanitized);

// 4.2 Test Full UI Rendering with Weapon Crafted by Malicious Author
const maliciousAuthorWeapon = {
  id: 'wpn_adv_xss_test',
  name: 'Doom Bow <img src=x onerror=alert(1)>',
  title: 'Doom Bow <img src=x onerror=alert(1)>',
  desc: 'Dangerous weapon <script>alert("desc")</script>',
  category: 'Weapons',
  costCoins: 50,
  craftedBy: 'Evil Hacker <script>alert("hacked")</script> "quote" \'single\' <svg/onload=alert(1)>',
  statBonusPercent: 20
};
store.publishCustomAIWeapon(maliciousAuthorWeapon);

const renderedShop = renderShopView();
check('4.2.1 ShopView contains no raw <script> in author badge', !renderedShop.includes('<script>alert("hacked")</script>'));
check('4.2.2 ShopView contains no raw <svg/onload in author badge', !renderedShop.includes('<svg/onload=alert(1)>'));
check('4.2.3 ShopView contains properly encoded author badge', renderedShop.includes('Evil Hacker &lt;script&gt;alert(&quot;hacked&quot;)&lt;/script&gt;'));

// 4.3 Test Pet Food Crafted by Malicious Author in PetSanctuaryView
const maliciousAuthorFood = {
  id: 'snack_xss_berry',
  name: 'XSS Berry',
  category: 'Snacks',
  costCoins: 25,
  craftedBy: 'Rogue Chef <img src=x onerror=alert("food")>'
};
store.publishCustomAIFood(maliciousAuthorFood);
const renderedSanctuary = renderPetSanctuaryView();
check('4.3.1 PetSanctuaryView contains no raw <img src=x in author badge', !renderedSanctuary.includes('<img src=x onerror=alert("food")>'));
check('4.3.2 PetSanctuaryView contains properly encoded author badge', renderedSanctuary.includes('Rogue Chef &lt;img src=x onerror=alert(&quot;food&quot;)&gt;'));

// 4.4 Test RewardModal with Author Badge in Message
const renderedRewardModal = renderRewardModal();
check('4.4.1 RewardModal sanitizes raw tags in message body', !renderedRewardModal.includes('<script>'));

// 4.5 Inspect Inline Event Handler Breakout Vector in GiftCrateModal.js
console.log('  ▶️ Testing GiftCrateModal inline event handler breakout...');
const maliciousVoiceWeapon = {
  id: 'crate_xss_voice_item',
  name: 'Talking Saber',
  category: 'gear',
  petVoiceLine: "\\');alert('VOICE_XSS');//"
};
store.getState().pendingGiftCrates = [
  {
    id: 'crate_voice_xss',
    item: maliciousVoiceWeapon,
    targetChildProfile: 'all',
    unboxed: true,
    isOpened: true
  }
];
store.state.activeUnboxingCrateId = 'crate_voice_xss';
const renderedCrate = renderGiftCrateModal();
// Check if the inline onclick contains the escaped breakout or safe state replay
const hasInlineBreakout = renderedCrate.includes("alert('VOICE_XSS')") || renderedCrate.includes("window.speakCompanionText(");
const usesSafeStateReplay = renderedCrate.includes("window.replayCrateCompanionVoice");
check('4.5.1 GiftCrateModal uses state-driven audio replay and eliminates inline onclick string injection',
  !hasInlineBreakout && usesSafeStateReplay,
  'Inline onclick uses safe state-driven replay handler by crateId without user string injection'
);


// ===========================================================================
// SUMMARY & VERDICT
// ===========================================================================
console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${failedChecks}`);
console.log('======================================================================');

if (failures.length > 0) {
  console.log('\nIdentified Failures / Challenge Findings:');
  failures.forEach((f, idx) => {
    console.log(`  ${idx + 1}. ${f.desc} ${f.detail ? `(${f.detail})` : ''}`);
  });
}
