/**
 * scratch/verify_wallet_service.mjs
 *
 * Phase 3 Unit Tests for src/services/walletService.js:
 * - Version monotonicity (older wallet version ignored, newer accepted)
 * - Optimistic overlay add, clamp-at-0, clear on server convergence, clear on rejection
 * - fromCache stale status & "…" placeholder before first server snapshot
 * - EVOLUTION_SPARKS mirrors active pet's PET_SPARKS
 * - availableGoldPoints deducts held Gold Points
 * - hasPendingLock, needsRedo, and per-kid heroOwnsItem
 */

import './setup_mock_env.js';
import assert from 'node:assert/strict';
import { walletService } from '../src/services/walletService.js';
import { CURRENCIES } from '../shared/ledger/currencies.js';

console.log('🧪 Running Phase 3 Wallet Service Tests...');

walletService._resetForTest();
walletService.setLedgerMode('authoritative');

// 1. Before first server snapshot: balanceOf returns null, formatBalance returns "…"
assert.equal(walletService.hasServerSnapshot(), false);
assert.equal(walletService.balanceOf('hero_a', CURRENCIES.HABIT_TOKENS), null);
assert.equal(walletService.formatBalance('hero_a', CURRENCIES.HABIT_TOKENS), '…');
console.log('  ✅ Returns null / "…" before first server snapshot');

// 2. Cached snapshot marks status connecting/stale and does not satisfy hasServerSnapshot
walletService._injectSnapshotForTest({
  wallets: { hero_a: { version: 1, balances: { HABIT_TOKENS: 50, GOLD_POINTS: 20, HERO_XP: 10 }, held: { GOLD_POINTS: 5 } } },
  fromCache: true
});
assert.equal(walletService.hasServerSnapshot(), false);
assert.equal(walletService.formatBalance('hero_a', CURRENCIES.HABIT_TOKENS), '…');

// 3. First server snapshot flips status to live
walletService._injectSnapshotForTest({
  wallets: {
    hero_a: {
      version: 2,
      lastTxnId: 'txn_2',
      balances: { HABIT_TOKENS: 100, GOLD_POINTS: 40, HERO_XP: 25 },
      held: { GOLD_POINTS: 15 },
      petSparks: { '1': 35 },
      petXp: { '1': 70 },
      needsRedo: { 'habit:brush_teeth': true }
    }
  },
  heroes: [{ id: 'hero_a', activePetId: '1', hq: { activeTheme: 'space_pod', placedFurniture: { bed: 'rocket_bed' } } }],
  approvals: [{ id: 'appr_1', heroId: 'hero_a', status: 'pending', lockKey: 'task:clean_room' }],
  inventory: [{ heroId: 'hero_a', itemId: 'rocket_bed', kind: 'hq_furniture', quantity: 1 }],
  fromCache: false
});

assert.equal(walletService.getStatus(), 'live');
assert.equal(walletService.hasServerSnapshot(), true);
assert.equal(walletService.balanceOf('hero_a', CURRENCIES.HABIT_TOKENS), 100);
assert.equal(walletService.balanceOf('hero_a', CURRENCIES.GOLD_POINTS), 40);
assert.equal(walletService.availableGoldPoints('hero_a'), 25);
assert.equal(walletService.balanceOf('hero_a', CURRENCIES.PET_SPARKS, '1'), 35);
assert.equal(walletService.balanceOf('hero_a', 'EVOLUTION_SPARKS'), 35, 'EVOLUTION_SPARKS must equal active pet PET_SPARKS');
assert.equal(walletService.hasPendingLock('hero_a', 'task:clean_room'), true);
assert.equal(walletService.hasPendingLock('hero_a', 'task:other'), false);
assert.equal(walletService.needsRedo('hero_a', 'habit:brush_teeth'), true);
assert.equal(walletService.heroOwnsItem('hero_a', 'hq_furniture', 'rocket_bed'), true);
assert.equal(walletService.heroOwnsItem('hero_b', 'hq_furniture', 'rocket_bed'), false);
console.log('  ✅ Server snapshot, held points, EVOLUTION_SPARKS mirror, locks, needsRedo & inventory verified');

// 4. Subsequent fromCache snapshot marks status 'stale'
walletService._injectSnapshotForTest({
  wallets: { hero_a: { version: 2, balances: { HABIT_TOKENS: 100 } } },
  fromCache: true
});
assert.equal(walletService.getStatus(), 'stale');
console.log('  ✅ fromCache after live snapshot marks status "stale"');

// 5. Version monotonicity: stale version 1 is rejected; version 3 is accepted
const acceptedOld = walletService.ingestWalletDoc('hero_a', { version: 1, balances: { HABIT_TOKENS: 9999 } });
assert.equal(acceptedOld, false);
assert.equal(walletService.balanceOf('hero_a', CURRENCIES.HABIT_TOKENS), 100);
console.log('  ✅ Version monotonicity rejects older wallet version');

// 6. Optimistic overlay: adds delta, clamps at 0, clears on server convergence, clears on rejection
walletService.applyOptimistic('hero_a', { [CURRENCIES.HABIT_TOKENS]: -150 }, 'txn_fail');
assert.equal(walletService.balanceOf('hero_a', CURRENCIES.HABIT_TOKENS), 0, 'optimistic balance clamped at 0');
walletService.clearOptimistic('hero_a', 'txn_fail');
assert.equal(walletService.balanceOf('hero_a', CURRENCIES.HABIT_TOKENS), 100);

walletService.applyOptimistic('hero_a', { [CURRENCIES.HABIT_TOKENS]: 25 }, 'txn_3');
assert.equal(walletService.balanceOf('hero_a', CURRENCIES.HABIT_TOKENS), 125);
walletService.ingestWalletDoc('hero_a', { version: 3, lastTxnId: 'txn_3', balances: { HABIT_TOKENS: 125, GOLD_POINTS: 40, HERO_XP: 25 } });
assert.equal(walletService.balanceOf('hero_a', CURRENCIES.HABIT_TOKENS), 125, 'overlay cleared cleanly on convergence');
console.log('  ✅ Optimistic overlay add, clamp-at-0, rejection clear, and convergence clear verified');

walletService._resetForTest();
console.log('✅ All Phase 3 wallet service tests passed!');
process.exit(0);
