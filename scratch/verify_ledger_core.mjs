import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import {
  CURRENCIES,
  ALL_CURRENCIES,
  assertSafeInt
} from '../shared/ledger/currencies.js';
import {
  HERO_LEVEL_UP_BONUS_TOKENS,
  PET_MAX_LEVEL,
  heroCumXpTable,
  heroLevelFromCum,
  heroCumFrom,
  petLevelFromCum,
  petCumFrom
} from '../shared/ledger/curves.js';
import {
  TASK_ALIAS_GROUPS,
  getTaskAliasGroup,
  canonicalTaskId,
  activityTxnId,
  inventoryDocId,
  catalogDocId,
  rewardRuleDocId
} from '../shared/ledger/ids.js';
import { plan, postingsForTxn } from '../shared/ledger/core.js';

const NOW = '2026-11-25T12:00:00.000Z';
const DEVICE_ACTOR = { uid: 'u_kid', deviceId: 'dev_1', role: 'device' };
const PARENT_ACTOR = { uid: 'u_parent', deviceId: 'dev_p', role: 'parent' };

function assertZeroSum(txnDoc) {
  const postings = postingsForTxn(txnDoc);
  const sums = {};
  for (const p of postings) {
    sums[p.currency] = (sums[p.currency] || 0) + p.amount;
  }
  for (const [c, total] of Object.entries(sums)) {
    assert.equal(total, 0, `Transaction ${txnDoc.txnId} not zero-sum for ${c}: ${total}`);
  }
}

function assertNonNegWallet(w) {
  assert.ok(w.balances.GOLD_POINTS >= 0, 'GOLD_POINTS < 0');
  assert.ok(w.balances.HABIT_TOKENS >= 0, 'HABIT_TOKENS < 0');
  assert.ok(w.balances.HERO_XP >= 0, 'HERO_XP < 0');
  assert.ok(w.held.GOLD_POINTS >= 0, 'held.GOLD_POINTS < 0');
  assert.ok(w.held.GOLD_POINTS <= w.balances.GOLD_POINTS, 'held > balance');
  for (const [pid, pet] of Object.entries(w.pets || {})) {
    assert.ok(pet.PET_XP >= 0, `pet ${pid} PET_XP < 0`);
    assert.ok(pet.PET_SPARKS >= 0, `pet ${pid} PET_SPARKS < 0`);
    assert.ok(pet.level >= 1 && pet.level <= PET_MAX_LEVEL, `pet ${pid} level out of range`);
  }
}

console.log('🧪 Running Phase 1: Shared Ledger Core Tests...');

// 1. Static no-float / no-division check across shared/ledger/ (except curves.js)
{
  const files = readdirSync('shared/ledger').filter((f) => f.endsWith('.js'));
  for (const f of files) {
    const src = readFileSync(`shared/ledger/${f}`, 'utf8');
    // Strip comments before checking for division operator
    const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.equal(/\bparseFloat\b/.test(noComments), false, `${f} must not use parseFloat`);
    assert.equal(/\.toFixed\b/.test(noComments), false, `${f} must not use toFixed`);
    if (f !== 'curves.js') {
      // Strip regex literals before checking for arithmetic division
      const noRegex = noComments.replace(/\/(?![/*])(?:\\.|[^/\\\n])+\/[gimsuy]*/g, '');
      assert.equal(/[^*]\s\/\s/.test(noRegex), false, `${f} must not use division outside curves.js`);
    }
  }
  console.log('  ✅ Static no-float / no-division check passed');
}

// 2. No EVOLUTION_SPARKS currency
{
  assert.equal('EVOLUTION_SPARKS' in CURRENCIES, false, 'EVOLUTION_SPARKS must not exist as a ledger currency');
  assert.deepEqual(ALL_CURRENCIES, ['GOLD_POINTS', 'HABIT_TOKENS', 'HERO_XP', 'PET_XP', 'PET_SPARKS']);
  console.log('  ✅ Five ledger currencies verified (no EVOLUTION_SPARKS)');
}

// 3. Integer guards reject NaN, Infinity, floats, and unsafe integers
{
  for (const bad of [NaN, Infinity, -Infinity, 1.5, '10', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => assertSafeInt(bad, 'test'), `Expected assertSafeInt to reject ${String(bad)}`);
  }
  console.log('  ✅ Integer guards reject NaN, Infinity, floats, and unsafe values');
}

// 4. Hero XP curve round-trip (levels 1..60) & Pet XP curve round-trip (levels 1..25)
{
  const table = heroCumXpTable(80);
  // Verify against store.js addXP exact curve: 100, round(100*1.35)=135, round(135*1.35)=182, ...
  let expectedNext = 100;
  for (let lvl = 1; lvl <= 60; lvl++) {
    const cum = heroCumFrom(lvl, 0, table);
    const back = heroLevelFromCum(cum, table);
    assert.equal(back.level, lvl, `Hero level round-trip failed at level ${lvl}`);
    assert.equal(back.xpIntoLevel, 0);
    assert.equal(back.xpNext, expectedNext, `Hero xpNext mismatch at level ${lvl}`);

    const midXp = Math.min(17, expectedNext - 1);
    const mid = heroLevelFromCum(heroCumFrom(lvl, midXp, table), table);
    assert.equal(mid.level, lvl);
    assert.equal(mid.xpIntoLevel, midXp);

    expectedNext = Math.round(expectedNext * 1.35);
  }

  for (let lvl = 1; lvl <= PET_MAX_LEVEL; lvl++) {
    const cum = petCumFrom(lvl, 0);
    const back = petLevelFromCum(cum);
    assert.equal(back.level, lvl, `Pet level round-trip failed at level ${lvl}`);
    assert.equal(back.xpIntoLevel, 0);
    if (lvl < PET_MAX_LEVEL) {
      const mid = petLevelFromCum(petCumFrom(lvl, 42));
      assert.equal(mid.level, lvl);
      assert.equal(mid.xpIntoLevel, 42);
    }
  }
  // Cap at level 25
  const overCap = petLevelFromCum(petCumFrom(25, 0) + 99999);
  assert.equal(overCap.level, 25);
  console.log('  ✅ Hero (1..60) and Pet (1..25) XP curve round-trips match store.js');
}

// 5. Task alias table parity with src/state/store.js getTaskAliasGroup
{
  for (const group of TASK_ALIAS_GROUPS) {
    for (const alias of group) {
      assert.deepEqual(
        getTaskAliasGroup(alias),
        store.getTaskAliasGroup(alias),
        `Alias group mismatch with store.js for ${alias}`
      );
    }
  }
  assert.equal(canonicalTaskId('bedtime_story'), canonicalTaskId('sleep_on_time'));
  assert.equal(canonicalTaskId('pajamas_tidy'), canonicalTaskId('clean_room'));
  assert.equal(canonicalTaskId('toothbrush_adventure_battle'), canonicalTaskId('bedtime_brush'));
  assert.equal(catalogDocId('reward', 'r1'), 'reward:r1');
  assert.equal(rewardRuleDocId('habit', 'brush_teeth_am'), 'habit:morning_brush');
  assert.equal(inventoryDocId('hero_1', 'sword_1'), 'hero_1__sword_1');
  assert.ok(activityTxnId('hero_1', 'habit', 'morning_brush', 'cyc_1').startsWith('act_'));
  console.log('  ✅ Task alias table matches store.js getTaskAliasGroup');
}

// 6. Multi-level-up crossing 3 levels gives exact 150 bonus tokens + 2x sparks Pet XP coupling
{
  const opened = plan('openWallet', { heroId: 'h1', starting: { points: 50, coins: 0, level: 1 }, now: NOW, actor: PARENT_ACTOR });
  assert.equal(opened.error, undefined);
  assertZeroSum(opened.txnDoc);
  let w = opened.walletAfter;

  // Level 1->2 needs 100, 2->3 needs 135 (cum 235), 3->4 needs 182 (cum 417)
  // Awarding 450 XP crosses 3 levels -> +150 bonus tokens
  const earn = plan('recordActivity', {
    wallet: w,
    rule: { tokens: 10, xp: 450, sparks: 5, petXp: 7, points: 20, dailyCap: 20, maxBuffPercent: 50 },
    activityType: 'habit',
    activityId: 'morning_brush',
    cycleId: 'c1',
    petId: '1',
    day: '2026-11-25',
    now: NOW,
    actor: DEVICE_ACTOR
  });
  assert.equal(earn.error, undefined);
  assertZeroSum(earn.txnDoc);
  assertNonNegWallet(earn.walletAfter);
  assert.equal(earn.walletAfter.heroLevel, 4, 'Expected level 4 after 450 XP');
  assert.equal(earn.txnDoc.delta.HABIT_TOKENS, 10 + 3 * HERO_LEVEL_UP_BONUS_TOKENS, 'Expected +150 bonus tokens for 3 levels');
  assert.equal(earn.txnDoc.delta.PET_SPARKS, 5);
  assert.equal(earn.txnDoc.delta.PET_XP, 7 + 5 * 2, 'Expected 2x sparks Pet XP plus rule.petXp');
  assert.equal(earn.extraWrites.length, 2, 'Expected approval_requests + activity_locks');
  console.log('  ✅ Multi-level-up (+150 tokens) and 2x sparks Pet XP coupling verified');

  // 7. Denial reversal clamps at 0 and records clampedShortfall when kid spent tokens
  w = earn.walletAfter;
  // Kid spends 150 of their 160 tokens before parent rejects
  const buy = plan('purchase', {
    wallet: w,
    catalogItem: { itemId: 'dragon_cape', kind: 'digital_gear', costCoins: 150, costSparks: 0, active: true },
    clientUuid: 'buy1',
    now: NOW,
    actor: DEVICE_ACTOR
  });
  assert.equal(buy.error, undefined);
  assertZeroSum(buy.txnDoc);
  w = buy.walletAfter;
  assert.equal(w.balances.HABIT_TOKENS, 10);

  const reqDoc = earn.extraWrites.find((x) => x.collection === 'approval_requests').data;
  const rej = plan('rejectTask', {
    wallet: w,
    request: reqDoc,
    earnTxn: earn.txnDoc,
    now: NOW,
    actor: PARENT_ACTOR
  });
  assert.equal(rej.error, undefined);
  assertZeroSum(rej.txnDoc);
  assertNonNegWallet(rej.walletAfter);
  assert.equal(rej.walletAfter.balances.HABIT_TOKENS, 0, 'Clamped at 0, never negative');
  assert.equal(rej.txnDoc.delta.HABIT_TOKENS, -10, 'Deducted only available 10 tokens');
  assert.equal(rej.txnDoc.metadata.clampedShortfall.HABIT_TOKENS, 150, 'Recorded 150 token shortfall');
  assert.ok(rej.walletAfter.needsRedo.morning_brush, 'Set wallet.needsRedo[lockKey]');
  assert.ok(rej.extraWrites.some((x) => x.collection === 'activity_locks' && x.op === 'delete'), 'Deleted activity lock');
  console.log('  ✅ Clamped-at-0 denial reversal, clampedShortfall, and needsRedo verified');

  // 8. Holds: authorize -> capture, authorize -> void, captured cannot be voided
  w = rej.walletAfter;
  const holdReq = plan('requestReward', {
    wallet: w,
    catalogItem: { itemId: 'ice_cream', kind: 'reward', title: 'Ice Cream', costPoints: 30, active: true },
    requestId: 'r_hold_1',
    now: NOW,
    actor: DEVICE_ACTOR
  });
  assert.equal(holdReq.error, undefined);
  assertZeroSum(holdReq.txnDoc);
  assert.equal(holdReq.walletAfter.balances.GOLD_POINTS, 50);
  assert.equal(holdReq.walletAfter.held.GOLD_POINTS, 30);
  assert.equal(holdReq.txnDoc.heldDelta.GOLD_POINTS, 30);

  // Over-redemption refused (only 20 available)
  const overHold = plan('requestReward', {
    wallet: holdReq.walletAfter,
    catalogItem: { itemId: 'movie', kind: 'reward', title: 'Movie', costPoints: 25, active: true },
    requestId: 'r_hold_2',
    now: NOW,
    actor: DEVICE_ACTOR
  });
  assert.ok(overHold.error, 'Expected hold exceeding available Gold Points to be refused');

  const holdDoc = holdReq.extraWrites.find((x) => x.collection === 'holds').data;
  const rewardReqDoc = holdReq.extraWrites.find((x) => x.collection === 'approval_requests').data;
  const captured = plan('approveReward', {
    wallet: holdReq.walletAfter,
    hold: holdDoc,
    request: rewardReqDoc,
    now: NOW,
    actor: PARENT_ACTOR
  });
  assert.equal(captured.error, undefined);
  assertZeroSum(captured.txnDoc);
  assert.equal(captured.walletAfter.balances.GOLD_POINTS, 20);
  assert.equal(captured.walletAfter.held.GOLD_POINTS, 0);

  // Captured hold cannot be voided
  const capturedHoldDoc = captured.extraWrites.find((x) => x.collection === 'holds').data;
  const capturedReqDoc = captured.extraWrites.find((x) => x.collection === 'approval_requests').data;
  const voidAfterCapture = plan('rejectReward', {
    wallet: captured.walletAfter,
    hold: capturedHoldDoc,
    request: capturedReqDoc,
    now: NOW,
    actor: PARENT_ACTOR
  });
  assert.ok(voidAfterCapture.error, 'Captured hold must not be voidable');

  // Authorize -> void
  const holdReq2 = plan('requestReward', {
    wallet: captured.walletAfter,
    catalogItem: { itemId: 'extra_story', kind: 'reward', title: 'Extra Story', costPoints: 20, active: true },
    requestId: 'r_hold_3',
    now: NOW,
    actor: DEVICE_ACTOR
  });
  assert.equal(holdReq2.error, undefined);
  const voided = plan('rejectReward', {
    wallet: holdReq2.walletAfter,
    hold: holdReq2.extraWrites.find((x) => x.collection === 'holds').data,
    request: holdReq2.extraWrites.find((x) => x.collection === 'approval_requests').data,
    now: NOW,
    actor: PARENT_ACTOR
  });
  assert.equal(voided.error, undefined);
  assertZeroSum(voided.txnDoc);
  assert.equal(voided.walletAfter.balances.GOLD_POINTS, 20);
  assert.equal(voided.walletAfter.held.GOLD_POINTS, 0);
  console.log('  ✅ Holds (authorize, capture, void, over-hold refused, captured not voidable) verified');
}

// 9. 1,000 random operation sequences keep sum(kid) + sum(system) === 0 and all balances >= 0
{
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed;
  };
  const randInt = (max) => nextRand() % max;

  const init = plan('openWallet', { heroId: 'fuzz_hero', starting: { points: 100, coins: 100, level: 1 }, now: NOW, actor: PARENT_ACTOR });
  let wallet = init.walletAfter;
  const systemTotals = { GOLD_POINTS: 0, HABIT_TOKENS: 0, HERO_XP: 0, PET_XP: 0, PET_SPARKS: 0 };
  const recordTxn = (txnDoc) => {
    assertZeroSum(txnDoc);
    for (const c of ALL_CURRENCIES) {
      systemTotals[c] -= txnDoc.delta[c];
    }
  };
  recordTxn(init.txnDoc);

  const pendingTaskReqs = [];
  const pendingHolds = [];

  for (let step = 0; step < 1000; step++) {
    const choice = randInt(8);
    let res = null;

    if (choice === 0 || choice === 1) {
      const hasPoints = randInt(2) === 1;
      res = plan('recordActivity', {
        wallet,
        rule: {
          tokens: 5 + randInt(20),
          xp: 10 + randInt(40),
          sparks: randInt(5),
          petXp: randInt(10),
          points: hasPoints ? 5 + randInt(15) : 0,
          dailyCap: 2000,
          maxBuffPercent: 50
        },
        activityType: hasPoints ? 'task' : 'dance_party',
        activityId: `act_${step}`,
        cycleId: `cyc_${step}`,
        petId: '1',
        day: '2026-11-25',
        now: NOW,
        actor: DEVICE_ACTOR
      });
      if (!res.error && hasPoints) {
        const req = res.extraWrites.find((x) => x.collection === 'approval_requests').data;
        pendingTaskReqs.push({ req, earnTxn: res.txnDoc });
      }
    } else if (choice === 2 && pendingTaskReqs.length > 0) {
      const entry = pendingTaskReqs.shift();
      res = plan('approveTaskPoints', { wallet, request: entry.req, now: NOW, actor: PARENT_ACTOR });
    } else if (choice === 3 && pendingTaskReqs.length > 0) {
      const entry = pendingTaskReqs.shift();
      res = plan('rejectTask', { wallet, request: entry.req, earnTxn: entry.earnTxn, now: NOW, actor: PARENT_ACTOR });
    } else if (choice === 4) {
      res = plan('requestReward', {
        wallet,
        catalogItem: { itemId: `rew_${step}`, kind: 'reward', title: 'Reward', costPoints: 10 + randInt(30), active: true },
        requestId: `req_h_${step}`,
        now: NOW,
        actor: DEVICE_ACTOR
      });
      if (!res.error) {
        pendingHolds.push({
          hold: res.extraWrites.find((x) => x.collection === 'holds').data,
          req: res.extraWrites.find((x) => x.collection === 'approval_requests').data
        });
      }
    } else if (choice === 5 && pendingHolds.length > 0) {
      const entry = pendingHolds.shift();
      res = plan(randInt(2) === 0 ? 'approveReward' : 'rejectReward', {
        wallet,
        hold: entry.hold,
        request: entry.req,
        now: NOW,
        actor: PARENT_ACTOR
      });
    } else if (choice === 6) {
      res = plan('purchase', {
        wallet,
        catalogItem: { itemId: `fee_${step}`, kind: 'fee', costCoins: 5 + randInt(40), costSparks: 0, active: true },
        clientUuid: `u_${step}`,
        now: NOW,
        actor: DEVICE_ACTOR
      });
    } else if (choice === 7) {
      res = plan('spend', {
        wallet,
        currency: CURRENCIES.PET_SPARKS,
        amount: 1 + randInt(5),
        reason: 'shop_spark_spend',
        petId: '1',
        clientUuid: `sp_${step}`,
        now: NOW,
        actor: DEVICE_ACTOR
      });
    }

    if (res && !res.error) {
      wallet = res.walletAfter;
      assertNonNegWallet(wallet);
      recordTxn(res.txnDoc);
    }
  }

  const pet1 = wallet.pets['1'] || { PET_XP: 0, PET_SPARKS: 0 };
  assert.equal(wallet.balances.GOLD_POINTS + systemTotals.GOLD_POINTS, 0, 'GOLD_POINTS ledger imbalance');
  assert.equal(wallet.balances.HABIT_TOKENS + systemTotals.HABIT_TOKENS, 0, 'HABIT_TOKENS ledger imbalance');
  assert.equal(wallet.balances.HERO_XP + systemTotals.HERO_XP, 0, 'HERO_XP ledger imbalance');
  assert.equal(pet1.PET_XP + systemTotals.PET_XP, 0, 'PET_XP ledger imbalance');
  assert.equal(pet1.PET_SPARKS + systemTotals.PET_SPARKS, 0, 'PET_SPARKS ledger imbalance');
  console.log(`  ✅ 1,000 random operation sequences preserved zero-sum & >= 0 invariants (final wallet v${wallet.version})`);
}

console.log('✅ All Phase 1 ledger core tests passed!');
process.exit(0);
