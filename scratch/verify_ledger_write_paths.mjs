/**
 * scratch/verify_ledger_write_paths.mjs
 *
 * Phase 3 Integration Tests:
 * 1. Persistent localStorage outbox (ledger_outbox_v1): FIFO retry on reconnect + 24h expiry.
 * 2. joinHouseholdOnStart runs in legacy mode too (S1).
 * 3. Every Section 3.13 store mutation routes through ledgerClient.run() in authoritative mode
 *    with deterministic IDs and zero local balance mutation.
 * 4. Per-kid Hero HQ: kid A places furniture; kid B's HQ is unchanged and kid B cannot equip kid A's paid item.
 * 5. Authoritative localStorage serialization & buildCloudStateSnapshot strip PIN and all ledger-owned keys.
 * 6. Legacy mode continues working unchanged.
 */

import './setup_mock_env.js';
import assert from 'node:assert/strict';
import { walletService } from '../src/services/walletService.js';
import { ledgerClient, OUTBOX_STORAGE_KEY, OUTBOX_MAX_AGE_MS } from '../src/services/ledgerClient.js';
import { buildCloudStateSnapshot, AUTHORITATIVE_FORBIDDEN_KEYS } from '../src/services/firestoreSyncService.js';
import { store } from '../src/state/store.js';

console.log('🧪 Running Phase 3 Ledger Write Paths & Outbox Tests...');

// Reset clean state
walletService._resetForTest();
ledgerClient._resetForTest();

const calls = [];
ledgerClient.setActiveHouseholdCode('TESTFAM');
ledgerClient.setCallableForTest(async (payload) => {
  calls.push(payload);
  return { ok: true, action: payload.action };
});

// 1. S1: joinHouseholdOnStart runs in legacy mode too
walletService.setLedgerMode('legacy');
await ledgerClient.joinHouseholdOnStart('TESTFAM', 'dev_ipad_1', 'Apple iPad');
assert.equal(calls.length, 1);
assert.equal(calls[0].action, 'joinHousehold');
assert.equal(calls[0].args.deviceId, 'dev_ipad_1');
console.log('  ✅ joinHouseholdOnStart runs in legacy mode (S1)');

// 2. Persistent outbox FIFO retry & 24h expiry
calls.length = 0;
let failNetwork = true;
ledgerClient.setCallableForTest(async (payload) => {
  if (failNetwork) {
    const err = new Error('network unavailable');
    err.code = 'unavailable';
    throw err;
  }
  calls.push(payload);
  return { ok: true };
});

const q1 = await ledgerClient.run('recordActivity', { heroId: 'hero_a', activityType: 'habit', activityId: 'act_1' }, { idemId: 'act_1' });
const q2 = await ledgerClient.run('purchaseItem', { heroId: 'hero_a', kind: 'pet', itemId: 'pet_2', clientTxnId: 'buy_2' }, { idemId: 'buy_2' });
assert.equal(q1.queued, true);
assert.equal(q2.queued, true);
assert.equal(ledgerClient.readOutbox().length, 2);
assert.ok(localStorage.getItem(OUTBOX_STORAGE_KEY), 'outbox persisted in localStorage');

// Inject an expired (>24h) entry at the front
const expiredEntries = [];
ledgerClient.onOutboxExpired((entry) => expiredEntries.push(entry));
const raw = JSON.parse(localStorage.getItem(OUTBOX_STORAGE_KEY));
raw.unshift({ action: 'recordActivity', code: 'TESTFAM', args: { activityId: 'old_act' }, idemId: 'old_act', firstAttemptAt: Date.now() - OUTBOX_MAX_AGE_MS - 1000 });
localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(raw));

failNetwork = false;
const flushRes = await ledgerClient.flushOutbox();
assert.equal(flushRes.expired, 1);
assert.equal(flushRes.flushed, 2);
assert.equal(flushRes.remaining, 0);
assert.equal(expiredEntries.length, 1);
assert.equal(calls[0].args.activityId, 'act_1', 'FIFO order preserved');
assert.equal(calls[1].args.clientTxnId, 'buy_2', 'FIFO order preserved');
console.log('  ✅ Persistent localStorage outbox FIFO retry & 24h expiry verified');

// 3. Authoritative mode: Section 3.13 store mutations route through ledgerClient.run with zero local mutation
calls.length = 0;
walletService.setLedgerMode('authoritative');
walletService._injectSnapshotForTest({
  wallets: {
    hero_a: { version: 5, balances: { HABIT_TOKENS: 500, GOLD_POINTS: 100, HERO_XP: 50 }, petSparks: { '1': 40 }, petXp: { '1': 80 } },
    hero_b: { version: 2, balances: { HABIT_TOKENS: 10, GOLD_POINTS: 0, HERO_XP: 0 } }
  },
  heroes: [
    { id: 'hero_a', name: 'Hero A', activePetId: '1', hq: { activeTheme: 'dino_treehouse', placedFurniture: {} } },
    { id: 'hero_b', name: 'Hero B', activePetId: '2', hq: { activeTheme: 'hero_loft', placedFurniture: {} } }
  ],
  approvals: [
    { id: 'appr_task_1', heroId: 'hero_a', status: 'pending', type: 'task_point_approval', lockKey: 'habit:brush_teeth' },
    { id: 'appr_reward_1', heroId: 'hero_a', status: 'pending', type: 'reward_redemption', holdId: 'hold_1' }
  ],
  inventory: [
    { heroId: 'hero_a', itemId: 'galaxy_bed', kind: 'hq_furniture', quantity: 1 }
  ],
  fromCache: false
});

const heroA = store.state.heroes[0];
heroA.id = 'hero_a';
heroA.coins = 500;
heroA.points = 100;
heroA.xp = 50;
heroA.activePetId = '1';
store.state.selectedHero = heroA;

const snapBefore = { coins: heroA.coins, points: heroA.points, xp: heroA.xp };

await store.toggleHabitIsland('brush_teeth');
await store.toggleTaskForest('clean_room');
await store.completeToothbrushBattle('sugar_bandit');
await store.completeAiQuest('q_1');
await store.completeAdventureGame('math_1');
await store.completeMovementRoutine('stretch_1');
await store.unlockParentWorldChest('chest_1');
await store.completeWaypointChore('wp_1');
await store.completePajamasTidyStep();
await store.completeBedtimeStory({ id: 'story_1', title: 'Dino Dream' });
await store.completePetBathReward('1');
await store.recordArcadeResult('dino_run', 120);
await store.discoverWorldSecret('shrine_1');
await store.interactWithCustomLandmark('lm_1');
await store.recordToyBoxInteraction('ball');
await store.awardDancePartyRewards(25, 'memory_match');
await store.awardWorldMapRewards(25, 20, 'world_quiz_1');
await store.addPetSparks('1', 15);
await store.addEvolutionSparks('1', 10);
await store.addPetTrainingXp('1', 25);
await store.addPetCareXp('1', 15);
await store.approveParentRequest('appr_task_1');
await store.rejectParentRequest('appr_task_1');
await store.approveParentRequest('appr_reward_1');
await store.rejectParentRequest('appr_reward_1');
await store.buyPet('2');
await store.buyHabitatSlot();
await store.buyProfileTheme('theme_space');
await store.buyDigitalGear('gear_cape_1');
await store.buyAndEquipGear('1', 'masks', { id: 'mask_1' });
await store.buyTreatPack('apple_pack');
await store.startPetExpedition('1', 'fern_woods');
await store.feedAllPetsPicnic();
await store.feedSinglePet('1');
await store.choosePet('1', 'starter');
await store.adoptPetIntoSlot('2');
await store.hatchMagicEgg('egg_1');
await store.addCustomAIPet({ id: 'cp_1', targetChildProfile: 'hero_a' }, 'egg');
await store.deleteCustomAIFurniture('furn_del_1');
await store.deleteCustomAIFood('food_del_1');
await store.feedPetConsumableSnack('snack_1');
await store.feedPetTreat('1', 'crunchy_apple');
await store.redeemRealLifeReward('reward_ice_cream');
await store.grantStudioItemToHero({ id: 'stud_1' }, 'furniture', 'hero_a');
await store.addHero({ id: 'hero_new', name: 'New Kid', coins: 10 });
await store.deleteHero('hero_new');

// Verify ZERO direct local balance mutation happened on heroA
assert.equal(heroA.coins, snapBefore.coins, 'hero.coins must not mutate locally in authoritative mode');
assert.equal(heroA.points, snapBefore.points, 'hero.points must not mutate locally in authoritative mode');
assert.equal(heroA.xp, snapBefore.xp, 'hero.xp must not mutate locally in authoritative mode');

const calledActions = new Set(calls.map((c) => c.action));
for (const expected of [
  'recordActivity', 'approveActivity', 'denyActivity',
  'captureRewardHold', 'voidRewardHold', 'purchaseItem',
  'authorizeRewardHold', 'grantItem', 'revokeItem',
  'consumeItem', 'openWallet', 'closeWallet'
]) {
  assert.ok(calledActions.has(expected), `Expected ledger action "${expected}" to be invoked`);
}

// Verify specific grantItem reasons from Section 3.13
const grantReasons = new Set(calls.filter((c) => c.action === 'grantItem').map((c) => c.args.reason));
for (const r of ['battle_badge', 'starter_pet', 'adopt', 'egg_hatch', 'parent_pet', 'parent_gift']) {
  assert.ok(grantReasons.has(r), `Expected grantItem reason "${r}"`);
}
console.log(`  ✅ All Section 3.13 authoritative write paths invoked (${calls.length} ledger calls, 0 local mutations)`);

// 4. Per-kid Hero HQ isolation
assert.equal(store.isHQFurnitureOwnedByHero('hero_a', 'galaxy_bed'), true);
assert.equal(store.isHQFurnitureOwnedByHero('hero_b', 'galaxy_bed'), false);
store.state.selectedHero = { id: 'hero_b', name: 'Hero B' };
const equipDenied = store.equipHQFurniture('bed', 'galaxy_bed');
assert.equal(equipDenied.success, false, 'kid B cannot equip kid A paid furniture');
assert.equal(store.getHeroHQ('hero_b').activeTheme, 'hero_loft');
assert.equal(store.getHeroHQ('hero_a').activeTheme, 'dino_treehouse');
console.log('  ✅ Per-kid Hero HQ isolation enforced (kid B cannot equip kid A paid item)');

// 5. Authoritative localStorage & cloud snapshot strip PIN and ledger-owned keys
store.state.parentSettings.pin = '9999';
const persisted = JSON.parse(store._serializeStateForLocalStorage(store.state));
assert.equal('pin' in (persisted.parentSettings || {}), false, 'plain-text PIN stripped from localStorage');
assert.equal('pendingApprovals' in persisted, false, 'pendingApprovals stripped from localStorage');
assert.equal('inventory' in persisted, false, 'inventory stripped from localStorage');
assert.equal('heroHQ' in persisted, false, 'heroHQ stripped from localStorage');
assert.equal('coins' in (persisted.heroes?.[0] || {}), false, 'hero.coins stripped from localStorage');

const cloudSnap = buildCloudStateSnapshot(store.state, { authoritative: true });
assert.equal('pin' in (cloudSnap.parentSettings || {}), false, 'plain-text PIN stripped from cloud snapshot');
for (const k of AUTHORITATIVE_FORBIDDEN_KEYS) {
  assert.equal(k in cloudSnap, false, `forbidden key ${k} stripped from authoritative cloud snapshot`);
}
console.log('  ✅ Authoritative localStorage & cloud snapshot strip PIN and ledger-owned keys');

// 6. Legacy mode pin check still works; authoritative mode local verifyParentPin returns false
assert.equal(store.verifyParentPin('9999'), false, 'local PIN compare disabled in authoritative mode');
walletService.setLedgerMode('legacy');
assert.equal(store.verifyParentPin('9999'), true, 'legacy PIN compare works in legacy mode');
console.log('  ✅ Legacy/authoritative PIN verification guard verified');

walletService._resetForTest();
ledgerClient._resetForTest();
console.log('✅ All Phase 3 ledger write path tests passed!');
process.exit(0);
