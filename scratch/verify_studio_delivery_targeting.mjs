// Studio gifts reach the chosen kid only: opening a crate for kid B never changes kid A,
// and publishing never grants the item to whoever happens to be selected.
import './setup_mock_env.js';
import { store } from '../src/state/store.js';

let passed = 0, failed = 0;
const assert = (c, m) => { if (c) { console.log(`  ✅ PASS: ${m}`); passed++; } else { console.error(`  ❌ FAIL: ${m}`); failed++; } };

console.log('🎁 --- Studio delivery targeting --- 🎁');
const heroes = store.getState().heroes;
assert(heroes.length >= 1, 'there is at least one hero');
const a = heroes[0];
const b = { ...JSON.parse(JSON.stringify(a)), id: 'hero_b_test', name: 'Kid B', inventory: ['laser_toothbrush'], equippedWeapon: 'laser_toothbrush' };
store.getState().heroes.push(b);

store.publishCustomAIWeapon({
  id: 'parent_weapon_target_test', name: 'Target Saber', desc: 'test', category: 'Weapons',
  archetype: 'laser_sword', costCoins: 50, deliveryMethod: 'instant_gift', targetChildProfile: b.id, image: ''
});
const crate = (store.getState().pendingGiftCrates || []).find((c) => c.item && c.item.id === 'parent_weapon_target_test');
assert(!!crate, 'a gift crate was created');
assert(crate && crate.targetChildProfile === b.id, 'the crate is addressed to kid B');
assert(!(a.inventory || []).includes('parent_weapon_target_test'), 'kid A did not get the weapon at publish time');
assert(!(b.inventory || []).includes('parent_weapon_target_test'), 'kid B does not have it before opening the crate');
assert(store.getGiftCratesForHero(a.id).every((c) => c.id !== crate.id), 'kid A does not see kid B\'s crate');
assert(store.getGiftCratesForHero(b.id).some((c) => c.id === crate.id), 'kid B sees the crate');

store.openGiftCrate(crate.id, b.id);
assert((b.inventory || []).includes('parent_weapon_target_test'), 'kid B has the weapon after opening');
assert(b.equippedWeapon === 'parent_weapon_target_test', 'kid B equips it');
assert(!(a.inventory || []).includes('parent_weapon_target_test'), 'kid A still does not have it');
assert(store.getGiftCratesForHero(b.id).every((c) => c.id !== crate.id), 'the crate is gone for kid B once opened');

// A crate for everyone is opened once per kid.
store.publishCustomAIWeapon({
  id: 'parent_weapon_all_test', name: 'Everyone Saber', desc: 'test', category: 'Weapons',
  archetype: 'laser_sword', costCoins: 50, deliveryMethod: 'instant_gift', targetChildProfile: 'all', image: ''
});
const all = (store.getState().pendingGiftCrates || []).find((c) => c.item && c.item.id === 'parent_weapon_all_test');
store.openGiftCrate(all.id, a.id);
assert(store.getGiftCratesForHero(b.id).some((c) => c.id === all.id), 'after kid A opens an all-kids crate, kid B can still open it');

console.log(`\nTEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
process.exit(failed ? 1 : 0);
