import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const ledgerRequire = createRequire(new URL('../functions-ledger/package.json', import.meta.url));
const { initializeApp, deleteApp } = ledgerRequire('firebase-admin/app');
const { getFirestore } = ledgerRequire('firebase-admin/firestore');
const { dispatchLedgerAction, reconcileWalletIncremental } = ledgerRequire('./lib/handler.js');

const PROJECT_ID = 'little-heroes-quest-8842';
const HOST_PORT = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const EMULATOR_HOST = HOST_PORT[0];
const EMULATOR_PORT = Number(HOST_PORT[1] || 8080);

async function expectHttpsError(promise, label) {
  let threw = false;
  try {
    await promise;
  } catch (err) {
    threw = true;
  }
  assert.equal(threw, true, `Expected error for: ${label}`);
}

async function run() {
  console.log(`🧪 Running Phase 2 Ledger Emulator Suite against ${EMULATOR_HOST}:${EMULATOR_PORT}...`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
      rules: readFileSync('firestore.rules', 'utf8')
    }
  });
  await testEnv.clearFirestore();

  const adminApp = initializeApp({ projectId: PROJECT_ID }, 'ledger-emulator-admin');
  const adminDb = getFirestore(adminApp);

  const CODE = 'EMUTEST1';
  const PARENT_AUTH = { uid: 'uid_parent', email: 'parent@example.com', emailVerified: true };
  const KID_AUTH = { uid: 'uid_kid', email: null, emailVerified: false };
  const OUTSIDER_AUTH = { uid: 'uid_outsider', email: null, emailVerified: false };
  const BASE_NOW = Date.parse('2026-11-25T15:00:00.000Z');

  try {
    // 1. createHousehold + joinHousehold idempotency
    const created = await dispatchLedgerAction(
      adminDb,
      PARENT_AUTH,
      {
        action: 'createHousehold',
        code: CODE,
        args: {
          name: 'Emulator Family',
          timeZone: 'America/New_York',
          firstHero: { id: 'hero_a', name: 'Hero A', coins: 100, points: 50, level: 1 }
        }
      },
      { nowMs: BASE_NOW }
    );
    assert.equal(created.created, true);

    const j1 = await dispatchLedgerAction(adminDb, KID_AUTH, {
      action: 'joinHousehold',
      code: CODE,
      args: { deviceId: 'dev_kid_1', deviceLabel: 'Kid Tablet' }
    }, { nowMs: BASE_NOW });
    assert.equal(j1.joined, true);
    assert.equal(j1.alreadyMember, false);

    const j2 = await dispatchLedgerAction(adminDb, KID_AUTH, {
      action: 'joinHousehold',
      code: CODE,
      args: { deviceId: 'dev_kid_1', deviceLabel: 'Kid Tablet' }
    }, { nowMs: BASE_NOW + 1000 });
    assert.equal(j2.alreadyMember, true);
    console.log('  ✅ createHousehold & idempotent joinHousehold verified');

    // 2. Security rules: non-member denied, member read-only on ledger, heroes/{heroId}, authoritative & migrating guards, public/walletSummary
    const kidDb = testEnv.authenticatedContext(KID_AUTH.uid).firestore();
    const outsiderDb = testEnv.authenticatedContext(OUTSIDER_AUTH.uid).firestore();
    const unauthDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(outsiderDb, `households/${CODE}/wallets/hero_a`)));
    await assertSucceeds(getDoc(doc(kidDb, `households/${CODE}/wallets/hero_a`)));
    await assertFails(updateDoc(doc(kidDb, `households/${CODE}/wallets/hero_a`), { version: 999 }));
    await assertFails(setDoc(doc(kidDb, `households/${CODE}/ledger_transactions/fake_txn`), { txnId: 'fake_txn' }));
    await assertFails(getDoc(doc(kidDb, `households/${CODE}/private/parentAuth`)));

    // heroes/{heroId}: member can update profile fields, cannot create/delete, cannot write LEDGER_HERO_FIELDS
    await assertSucceeds(updateDoc(doc(kidDb, `households/${CODE}/heroes/hero_a`), { avatar: 'dino_green' }));
    await assertFails(updateDoc(doc(kidDb, `households/${CODE}/heroes/hero_a`), { coins: 99999 }));
    await assertFails(setDoc(doc(kidDb, `households/${CODE}/heroes/hero_orphan`), { id: 'hero_orphan', name: 'Orphan' }));
    await assertFails(deleteDoc(doc(kidDb, `households/${CODE}/heroes/hero_a`)));

    // Authoritative mode household guards (including regression test for clientSchemaVersion: 2 merge bypass)
    await adminDb.doc(`households/${CODE}`).update({ clientSchemaVersion: 2, stateSnapshot: { heroes: [], parentSettings: {} } });
    await assertSucceeds(setDoc(doc(kidDb, `households/${CODE}`), { householdName: 'Updated Name' }, { merge: true }));
    await assertFails(setDoc(doc(kidDb, `households/${CODE}`), { heroesMap: { hero_a: { coins: 999 } } }, { merge: true }));
    await assertFails(setDoc(doc(kidDb, `households/${CODE}`), { heroes: [{ id: 'hero_a', coins: 999 }] }, { merge: true }));
    await assertFails(setDoc(doc(kidDb, `households/${CODE}`), { stateSnapshot: { heroes: [{ id: 'hero_a', coins: 999 }] } }, { merge: true }));
    await assertFails(setDoc(doc(kidDb, `households/${CODE}`), { selectedHero: { id: 'hero_a' } }, { merge: true }));
    await assertFails(setDoc(doc(kidDb, `households/${CODE}`), { petXpMap: { 1: 500 } }, { merge: true }));
    await assertFails(setDoc(doc(kidDb, `households/${CODE}`), { heroHQ: { unlockedFurnitureIds: ['x'] } }, { merge: true }));
    await assertFails(setDoc(doc(kidDb, `households/${CODE}`), { parentSettings: { pin: '1234' } }, { merge: true }));
    await assertFails(setDoc(doc(kidDb, `households/${CODE}`), { stateSnapshot: { parentSettings: { pin: '1234' } } }, { merge: true }));
    await assertFails(setDoc(doc(kidDb, `households/${CODE}`), { ledgerMode: 'legacy' }, { merge: true }));

    // Migrating mode also denies ledger keys
    await adminDb.doc(`households/${CODE}`).update({ ledgerMode: 'migrating' });
    await assertFails(setDoc(doc(kidDb, `households/${CODE}`), { heroesMap: { hero_a: { coins: 1 } } }, { merge: true }));
    await adminDb.doc(`households/${CODE}`).update({ ledgerMode: 'authoritative' });

    // public/walletSummary readable with valid code, not listable or writable
    await adminDb.doc(`households/${CODE}/public/walletSummary`).set({ heroes: { hero_a: { points: 50 } } });
    await assertSucceeds(getDoc(doc(unauthDb, `households/${CODE}/public/walletSummary`)));
    await assertFails(getDocs(collection(unauthDb, `households/${CODE}/public`)));
    await assertFails(setDoc(doc(kidDb, `households/${CODE}/public/walletSummary`), { heroes: {} }));
    console.log('  ✅ Firestore security rules (member read, deny direct writes, heroes, migrating/authoritative, PIN, public/walletSummary) verified');

    // 3. PIN setup, 5-attempt lockout, Google parent bypass, 20-min session expiry
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'setParentPin',
      code: CODE,
      args: { newPin: '4321' }
    }, { nowMs: BASE_NOW });

    // Kid fails PIN 5 times -> locked for 15 minutes
    for (let i = 0; i < 5; i++) {
      await expectHttpsError(
        dispatchLedgerAction(adminDb, KID_AUTH, { action: 'verifyParentPin', code: CODE, args: { pin: '0000' } }, { nowMs: BASE_NOW + i * 1000 }),
        `wrong PIN attempt ${i + 1}`
      );
    }
    // 6th attempt even with right PIN is locked for kid
    await expectHttpsError(
      dispatchLedgerAction(adminDb, KID_AUTH, { action: 'verifyParentPin', code: CODE, args: { pin: '4321' } }, { nowMs: BASE_NOW + 10_000 }),
      'kid blocked during PIN lockout'
    );
    // Google-signed-in parent bypasses PIN lockout!
    const unlocked = await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'verifyParentPin',
      code: CODE,
      args: { pin: '4321' }
    }, { nowMs: BASE_NOW + 10_000 });
    assert.equal(unlocked.unlocked, true);

    // Parent action fails after 20-minute session expires
    await expectHttpsError(
      dispatchLedgerAction(adminDb, PARENT_AUTH, {
        action: 'openWallet',
        code: CODE,
        args: { heroId: 'hero_b', starting: { coins: 100 } }
      }, { nowMs: BASE_NOW + 21 * 60 * 1000 }),
      'expired parent session must be rejected'
    );
    // Re-unlock and open hero_b
    await dispatchLedgerAction(adminDb, PARENT_AUTH, { action: 'verifyParentPin', code: CODE, args: { pin: '4321' } }, { nowMs: BASE_NOW });
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'openWallet',
      code: CODE,
      args: { heroId: 'hero_b', starting: { coins: 200, points: 40, level: 1 } }
    }, { nowMs: BASE_NOW });
    console.log('  ✅ PIN 5-try lockout, Google parent bypass, and 20-min session expiry verified');

    // 4. Passkeys: synced counter=0 allowed on repeat, non-increasing non-zero counter rejected, PIN lockout does NOT block passkey
    await adminDb.doc(`households/${CODE}/private/passkeys`).set({
      credentials: {
        cred_synced: { id: 'cred_synced', publicKey: Buffer.from('k1').toString('base64url'), counter: 0, label: 'iPhone', rpId: 'app.example.com', createdAt: new Date(BASE_NOW).toISOString() },
        cred_hw: { id: 'cred_hw', publicKey: Buffer.from('k2').toString('base64url'), counter: 5, label: 'YubiKey', rpId: 'app.example.com', createdAt: new Date(BASE_NOW).toISOString() }
      }
    });
    // Re-trigger PIN lockout via kid
    for (let i = 0; i < 5; i++) {
      await expectHttpsError(
        dispatchLedgerAction(adminDb, KID_AUTH, { action: 'verifyParentPin', code: CODE, args: { pin: '9999' } }, { nowMs: BASE_NOW + i }),
        'trigger PIN lockout'
      );
    }
    // Passkey STILL works while PIN is locked, AND counter 0 -> 0 succeeds twice!
    for (let repeat = 0; repeat < 2; repeat++) {
      await dispatchLedgerAction(adminDb, KID_AUTH, {
        action: 'passkeyAuthBegin',
        code: CODE,
        args: { rpId: 'app.example.com', origin: 'https://app.example.com' }
      }, { nowMs: BASE_NOW + 100 });
      const res = await dispatchLedgerAction(
        adminDb,
        KID_AUTH,
        {
          action: 'passkeyAuthFinish',
          code: CODE,
          args: { rpId: 'app.example.com', origin: 'https://app.example.com', response: { id: 'cred_synced' } }
        },
        {
          nowMs: BASE_NOW + 100,
          verifyPasskeyAuth: async () => ({ verified: true, authenticationInfo: { newCounter: 0 } })
        }
      );
      assert.equal(res.unlocked, true, `Synced passkey counter=0 login #${repeat + 1} must succeed`);
    }
    // Replayed challenge rejected (challenge was consumed)
    await expectHttpsError(
      dispatchLedgerAction(adminDb, KID_AUTH, {
        action: 'passkeyAuthFinish',
        code: CODE,
        args: { rpId: 'app.example.com', origin: 'https://app.example.com', response: { id: 'cred_synced' } }
      }, { nowMs: BASE_NOW + 100, verifyPasskeyAuth: async () => ({ verified: true, authenticationInfo: { newCounter: 0 } }) }),
      'replayed challenge must be rejected'
    );
    // Non-increasing non-zero counter rejected (stored=5, new=5)
    await dispatchLedgerAction(adminDb, KID_AUTH, {
      action: 'passkeyAuthBegin',
      code: CODE,
      args: { rpId: 'app.example.com', origin: 'https://app.example.com' }
    }, { nowMs: BASE_NOW + 100 });
    await expectHttpsError(
      dispatchLedgerAction(adminDb, KID_AUTH, {
        action: 'passkeyAuthFinish',
        code: CODE,
        args: { rpId: 'app.example.com', origin: 'https://app.example.com', response: { id: 'cred_hw' } }
      }, { nowMs: BASE_NOW + 100, verifyPasskeyAuth: async () => ({ verified: true, authenticationInfo: { newCounter: 5 } }) }),
      'non-increasing non-zero counter must be rejected'
    );
    console.log('  ✅ Passkeys (counter 0->0 repeat, replay rejected, non-increasing non-zero rejected, independent of PIN lockout) verified');

    // 5. Seed reward_rules & catalog via parent session
    await dispatchLedgerAction(adminDb, PARENT_AUTH, { action: 'verifyParentPin', code: CODE, args: { pin: '4321' } }, { nowMs: BASE_NOW });
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'upsertRewardRules',
      code: CODE,
      args: { activityType: 'habit', activityId: 'morning_brush', tokens: 20, xp: 30, sparks: 5, points: 15, dailyCap: 2, maxBuffPercent: 50 }
    }, { nowMs: BASE_NOW });
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'upsertRewardRules',
      code: CODE,
      args: { activityType: 'bedtime_story', tokens: 10, xp: 10, points: 10, approvalGated: true }
    }, { nowMs: BASE_NOW });
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'upsertRewardRules',
      code: CODE,
      args: { activityType: 'habit', activityId: 'sleep_on_time', tokens: 10, xp: 10, points: 10 }
    }, { nowMs: BASE_NOW });
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'upsertRewardRules',
      code: CODE,
      args: { activityType: 'dance_party', tokens: 5, xp: 5, points: 0, dailyCap: 2 }
    }, { nowMs: BASE_NOW });
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'upsertCatalog',
      code: CODE,
      args: { kind: 'reward', itemId: 'ice_cream', title: 'Ice Cream', costPoints: 30 }
    }, { nowMs: BASE_NOW });
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'upsertCatalog',
      code: CODE,
      args: { kind: 'fee', itemId: 'expedition', title: 'Expedition Fuel', costCoins: 30 }
    }, { nowMs: BASE_NOW });
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'upsertCatalog',
      code: CODE,
      args: { kind: 'hq_furniture', itemId: 'dino_throne', title: 'Dino Throne', costCoins: 50 }
    }, { nowMs: BASE_NOW });
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'upsertCatalog',
      code: CODE,
      args: { kind: 'digital_gear', itemId: 'spark_helm', title: 'Spark Helm', costSparks: 10 }
    }, { nowMs: BASE_NOW });

    // 6. Concurrency: 20 parallel recordActivity calls with same cycleId produce exactly 1 transaction
    const parallelActs = await Promise.all(
      Array.from({ length: 20 }, () =>
        dispatchLedgerAction(adminDb, KID_AUTH, {
          action: 'recordActivity',
          code: CODE,
          args: { heroId: 'hero_a', activityType: 'habit', activityId: 'morning_brush', cycleId: 'cyc_par_1', petId: '1' }
        }, { nowMs: BASE_NOW })
      )
    );
    const createdCount = parallelActs.filter((r) => !r.alreadyDone).length;
    assert.equal(createdCount, 1, `Expected exactly 1 created txn out of 20 parallel calls, got ${createdCount}`);
    // Second completion while pending is refused (activity_locks)
    await expectHttpsError(
      dispatchLedgerAction(adminDb, KID_AUTH, {
        action: 'recordActivity',
        code: CODE,
        args: { heroId: 'hero_a', activityType: 'habit', activityId: 'morning_brush', cycleId: 'cyc_par_2', petId: '1' }
      }, { nowMs: BASE_NOW }),
      'second pending completion must be refused by activity_locks'
    );

    // Cross-activity alias lock: pending bedtime_story refuses sleep_on_time
    await dispatchLedgerAction(adminDb, KID_AUTH, {
      action: 'recordActivity',
      code: CODE,
      args: { heroId: 'hero_a', activityType: 'bedtime_story', activityId: 'bedtime_story', cycleId: 'cyc_bs_1' }
    }, { nowMs: BASE_NOW });
    await expectHttpsError(
      dispatchLedgerAction(adminDb, KID_AUTH, {
        action: 'recordActivity',
        code: CODE,
        args: { heroId: 'hero_a', activityType: 'habit', activityId: 'sleep_on_time', cycleId: 'cyc_sl_1' }
      }, { nowMs: BASE_NOW }),
      'cross-activity alias lock bedtime_story -> sleep_on_time must refuse'
    );
    console.log('  ✅ 20-way parallel recordActivity idempotency & cross-activity alias locks verified');

    // 7. 20 parallel purchases with funds for 3 produce exactly 3
    // hero_a has 100 + 20 + 10 = 130 tokens; fee:expedition costs 30 -> can buy 4? Let's use hero_b (200 tokens -> spend 100 first or check 3x30=90)
    // Adjust hero_b to exactly 90 tokens
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'adjust',
      code: CODE,
      args: { heroId: 'hero_b', currency: 'HABIT_TOKENS', amount: -110, memo: 'set to 90', clientUuid: 'adj_90' }
    }, { nowMs: BASE_NOW });
    const parallelBuys = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        dispatchLedgerAction(adminDb, KID_AUTH, {
          action: 'purchase',
          code: CODE,
          args: { heroId: 'hero_b', kind: 'fee', itemId: 'expedition', clientUuid: `par_buy_${i}` }
        }, { nowMs: BASE_NOW })
      )
    );
    const succeededBuys = parallelBuys.filter((r) => r.status === 'fulfilled').length;
    assert.equal(succeededBuys, 3, `Expected exactly 3 succeeded purchases with 90 tokens at 30 each, got ${succeededBuys}`);
    console.log('  ✅ 20-way parallel purchases with funds for 3 produced exactly 3');

    // 8. Reward hold -> approve captures; hold -> reject voids
    await dispatchLedgerAction(adminDb, KID_AUTH, {
      action: 'requestReward',
      code: CODE,
      args: { heroId: 'hero_a', rewardId: 'ice_cream', requestId: 'rew_cap_1' }
    }, { nowMs: BASE_NOW });
    const afterCap = await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'approveReward',
      code: CODE,
      args: { requestId: 'rew_cap_1' }
    }, { nowMs: BASE_NOW });
    assert.equal(afterCap.wallet.balances.GOLD_POINTS, 20);
    assert.equal(afterCap.wallet.held.GOLD_POINTS, 0);

    await dispatchLedgerAction(adminDb, KID_AUTH, {
      action: 'requestReward',
      code: CODE,
      args: { heroId: 'hero_b', rewardId: 'ice_cream', requestId: 'rew_void_1' }
    }, { nowMs: BASE_NOW });
    const afterVoid = await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'rejectReward',
      code: CODE,
      args: { requestId: 'rew_void_1' }
    }, { nowMs: BASE_NOW });
    assert.equal(afterVoid.wallet.balances.GOLD_POINTS, 40);
    assert.equal(afterVoid.wallet.held.GOLD_POINTS, 0);
    console.log('  ✅ Reward holds (capture & void) verified');

    // 9. Per-kid HQ furniture + Pet Sparks requires petId + clamped-at-0 denial + needsRedo cleared on next earn
    await dispatchLedgerAction(adminDb, KID_AUTH, {
      action: 'purchase',
      code: CODE,
      args: { heroId: 'hero_a', kind: 'hq_furniture', itemId: 'dino_throne', clientUuid: 'hq_a_1' }
    }, { nowMs: BASE_NOW });
    // Buying same one-time furniture twice refused
    await expectHttpsError(
      dispatchLedgerAction(adminDb, KID_AUTH, {
        action: 'purchase',
        code: CODE,
        args: { heroId: 'hero_a', kind: 'hq_furniture', itemId: 'dino_throne', clientUuid: 'hq_a_2' }
      }, { nowMs: BASE_NOW }),
      'buying one-time HQ furniture twice must be refused'
    );
    // Kid-called grantItem for paid item refused
    await expectHttpsError(
      dispatchLedgerAction(adminDb, KID_AUTH, {
        action: 'grantItem',
        code: CODE,
        args: { heroId: 'hero_b', kind: 'hq_furniture', itemId: 'dino_throne', reason: 'hq_milestone' }
      }, { nowMs: BASE_NOW }),
      'kid grantItem for paid item must be refused'
    );
    // Pet Sparks purchase without petId refused
    await expectHttpsError(
      dispatchLedgerAction(adminDb, KID_AUTH, {
        action: 'purchase',
        code: CODE,
        args: { heroId: 'hero_a', kind: 'digital_gear', itemId: 'spark_helm', clientUuid: 'sp_no_pet' }
      }, { nowMs: BASE_NOW }),
      'Pet Sparks purchase without petId must be refused'
    );

    // Spend remaining tokens on hero_a so denial clamps at 0
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'adjust',
      code: CODE,
      args: { heroId: 'hero_a', currency: 'HABIT_TOKENS', amount: -75, memo: 'drain to 5', clientUuid: 'drain_a' }
    }, { nowMs: BASE_NOW });
    const pendingReqs = await adminDb.collection(`households/${CODE}/approval_requests`)
      .where('heroId', '==', 'hero_a')
      .where('taskId', '==', 'morning_brush')
      .where('status', '==', 'pending')
      .get();
    assert.equal(pendingReqs.size, 1);
    const rejRes = await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'rejectTask',
      code: CODE,
      args: { requestId: pendingReqs.docs[0].id }
    }, { nowMs: BASE_NOW });
    assert.equal(rejRes.wallet.balances.HABIT_TOKENS, 0, 'Clamped at 0');
    assert.ok(rejRes.txnDoc.metadata.clampedShortfall.HABIT_TOKENS > 0, 'Shortfall recorded');
    assert.ok(rejRes.wallet.needsRedo.morning_brush, 'needsRedo set');
    // Next completion on next day clears needsRedo and succeeds
    const nextDayEarn = await dispatchLedgerAction(adminDb, KID_AUTH, {
      action: 'recordActivity',
      code: CODE,
      args: { heroId: 'hero_a', activityType: 'habit', activityId: 'morning_brush', cycleId: 'cyc_next_day', petId: '1' }
    }, { nowMs: BASE_NOW + 24 * 60 * 60 * 1000 });
    assert.equal(nextDayEarn.wallet.needsRedo.morning_brush, undefined, 'Next completion clears needsRedo');
    console.log('  ✅ Per-kid HQ furniture, Pet Sparks petId guard, clamped-at-0 denial, and needsRedo lifecycle verified');

    // 10. Timezone daily cap: 11:30 pm vs 12:30 am America/New_York are different days!
    // 2026-11-26 04:30 UTC = 2026-11-25 23:30 EST; 2026-11-26 05:30 UTC = 2026-11-26 00:30 EST
    const lateNight = Date.parse('2026-11-26T04:30:00.000Z');
    const afterMidnight = Date.parse('2026-11-26T05:30:00.000Z');
    await dispatchLedgerAction(adminDb, KID_AUTH, {
      action: 'recordActivity', code: CODE, args: { heroId: 'hero_b', activityType: 'dance_party', activityId: 'dp1', cycleId: 'c1' }
    }, { nowMs: lateNight });
    await dispatchLedgerAction(adminDb, KID_AUTH, {
      action: 'recordActivity', code: CODE, args: { heroId: 'hero_b', activityType: 'dance_party', activityId: 'dp2', cycleId: 'c2' }
    }, { nowMs: lateNight + 1000 });
    // 3rd on same local day hits dailyCap=2
    await expectHttpsError(
      dispatchLedgerAction(adminDb, KID_AUTH, {
        action: 'recordActivity', code: CODE, args: { heroId: 'hero_b', activityType: 'dance_party', activityId: 'dp3', cycleId: 'c3' }
      }, { nowMs: lateNight + 2000 }),
      '3rd dance_party on same local day must hit dailyCap=2'
    );
    // 12:30 am local is a new day -> succeeds!
    const newLocalDay = await dispatchLedgerAction(adminDb, KID_AUTH, {
      action: 'recordActivity', code: CODE, args: { heroId: 'hero_b', activityType: 'dance_party', activityId: 'dp4', cycleId: 'c4' }
    }, { nowMs: afterMidnight });
    assert.equal(newLocalDay.alreadyDone, false);
    console.log('  ✅ Household-timezone daily cap (11:30 pm vs 12:30 am local) verified');

    // 11. Incremental reconciliation catches out-of-order createdAt via walletVersionAfter
    const recOk = await reconcileWalletIncremental(adminDb, CODE, 'hero_a');
    assert.equal(recOk.ok, true, `Expected clean reconciliation, got drift: ${JSON.stringify(recOk.drift)}`);
    // Inject a txn with an OLDER createdAt but NEWER walletVersionAfter -> reconcile still finds it!
    const wBefore = (await adminDb.doc(`households/${CODE}/wallets/hero_a`).get()).data();
    await adminDb.doc(`households/${CODE}/ledger_transactions/out_of_order_txn`).set({
      txnId: 'out_of_order_txn',
      type: 'PARENT_ADJUSTMENT',
      heroId: 'hero_a',
      delta: { GOLD_POINTS: 5, HABIT_TOKENS: 0, HERO_XP: 0, PET_XP: 0, PET_SPARKS: 0 },
      counterAccount: 'adjustment',
      walletVersionBefore: wBefore.version,
      walletVersionAfter: wBefore.version + 1,
      createdAt: '2020-01-01T00:00:00.000Z'
    });
    const recDrift = await reconcileWalletIncremental(adminDb, CODE, 'hero_a');
    assert.equal(recDrift.ok, false, 'Reconcile must detect out-of-order createdAt txn with newer walletVersionAfter');
    assert.equal(recDrift.checkedCount, 1);
    console.log('  ✅ Incremental walletVersionAfter reconciliation catches out-of-order createdAt');

    // 12. revokeDevice removes read access immediately
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'revokeDevice',
      code: CODE,
      args: { targetUid: KID_AUTH.uid, deviceId: 'dev_kid_1' }
    }, { nowMs: BASE_NOW });
    await assertFails(getDoc(doc(kidDb, `households/${CODE}/wallets/hero_a`)));
    console.log('  ✅ revokeDevice removes member read access immediately');

    console.log('✅ All Phase 2 emulator rules and handler tests passed!');
  } finally {
    await deleteApp(adminApp);
    await testEnv.cleanup();
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Phase 2 emulator test failed:', err);
  process.exit(1);
});
