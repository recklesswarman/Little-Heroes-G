/**
 * scratch/verify_ledger_backfill_rollback.mjs
 *
 * Phase 4 Emulator Rollback Rehearsal & Background Jobs Suite:
 * 1. Seeds a realistic legacy household (2 kids, furnitureOwners, pending task & reward approvals, plain-text PIN).
 * 2. Runs backfill --dry-run, --freeze, --cutover (and verifies idempotency).
 * 3. Runs post-cutover mutations: earn, purchase, avatar update on heroes/{heroId},
 *    and authoritative non-currency household push against firestore.rules.
 * 4. Runs mirrorWalletSummaryForHero + server/householdReader.js mergeWalletSummaryIntoState.
 * 5. Runs runNightlyReconcile and verifies ledger_reports/{dateKey} with 0 drifts.
 * 6. Runs rollbackHousehold and verifies legacy households/{CODE} has all post-cutover balances,
 *    purchases, avatar edits, and pending approvals.
 * 7. Runs cleanupPreCutoverSnapshot and verifies snapshot deletion.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

import { backfillHousehold } from '../scripts/ledger/backfill.mjs';
import { rollbackHousehold } from '../scripts/ledger/rollback.mjs';
import { cleanupPreCutoverSnapshot } from '../scripts/ledger/cleanup_snapshot.mjs';
import { mergeWalletSummaryIntoState } from '../server/householdReader.js';

const requireFromLedger = createRequire(new URL('../functions-ledger/package.json', import.meta.url));
const { initializeApp, getApps } = requireFromLedger('firebase-admin/app');
const { getFirestore } = requireFromLedger('firebase-admin/firestore');
const { dispatchLedgerAction } = requireFromLedger('./lib/handler.js');
const { mirrorWalletSummaryForHero } = requireFromLedger('./lib/mirrorWalletSummary.js');
const { runNightlyReconcile } = requireFromLedger('./lib/reconcileNightly.js');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_ID = 'little-heroes-quest-8842';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const [HOST, PORT_STR] = EMULATOR_HOST.split(':');
const PORT = Number(PORT_STR) || 8080;

const CODE = 'REHEARSE4';
const PARENT_AUTH = { uid: 'parent_p4', email: 'mom@example.com', emailVerified: true };
const KID_AUTH = { uid: 'kid_p4', email: null, emailVerified: false };

async function run() {
  console.log(`🧪 Running Phase 4 Backfill, Background Jobs & Rollback Rehearsal against ${HOST}:${PORT}...`);

  const rules = fs.readFileSync(path.join(REPO_ROOT, 'firestore.rules'), 'utf8');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: HOST, port: PORT, rules }
  });
  await testEnv.clearFirestore();

  process.env.FIRESTORE_EMULATOR_HOST = `${HOST}:${PORT}`;
  const adminApp = getApps().length > 0 ? getApps()[0] : initializeApp({ projectId: PROJECT_ID });
  const adminDb = getFirestore(adminApp);

  try {
    // 1. Seed a realistic legacy household
    const hRef = adminDb.collection('households').doc(CODE);
    await hRef.set({
      syncCode: CODE,
      householdName: 'Rehearsal Family',
      ledgerMode: 'legacy',
      parentUids: [PARENT_AUTH.uid],
      parentEmails: [PARENT_AUTH.email],
      parentSettings: { pin: '5678', pinLockEnabled: true, biometricsEnabled: true, timeZone: 'America/Los_Angeles' },
      stateSnapshot: {
        parentSettings: { pin: '5678', pinLockEnabled: true },
        household: { name: 'Rehearsal Family', syncCode: CODE }
      },
      heroes: [
        { id: 'hero_a', name: 'Leo', avatar: 'leo_v1', coins: 200, points: 50, xp: 120, sparks: 30, activePetId: '1', unlockedPetIds: ['1'] },
        { id: 'hero_b', name: 'Maya', avatar: 'maya_v1', coins: 80, points: 25, xp: 40, sparks: 10, activePetId: '2', unlockedPetIds: ['2'] }
      ],
      heroHQ: {
        themeId: 'dino_treehouse',
        equippedFurniture: { bed: 'galaxy_bed', desk: 'unowned_legacy_desk' },
        unlockedFurnitureIds: ['galaxy_bed', 'unowned_legacy_desk'],
        furnitureOwners: { galaxy_bed: 'hero_a' }
      },
      pendingApprovals: [
        {
          id: 'legacy_task_1',
          kidId: 'hero_a',
          type: 'task_point_approval',
          taskId: 'make_bed',
          taskTitle: 'Make Bed',
          pendingPoints: 10,
          tokensAwarded: 15,
          xpAwarded: 20,
          sparksAwarded: 5,
          status: 'pending'
        },
        {
          id: 'legacy_reward_1',
          kidId: 'hero_b',
          type: 'reward_redemption',
          rewardId: 'ice_cream',
          title: 'Ice Cream Trip',
          costPoints: 15,
          status: 'pending'
        }
      ]
    });

    // Join both parent and kid devices prior to cutover (S1)
    await dispatchLedgerAction(adminDb, PARENT_AUTH, { action: 'joinHousehold', code: CODE, args: { deviceId: 'dev_mom', deviceLabel: 'Mom Phone' } });
    await dispatchLedgerAction(adminDb, KID_AUTH, { action: 'joinHousehold', code: CODE, args: { deviceId: 'dev_ipad', deviceLabel: 'Kids iPad' } });

    // 2. Dry-run report
    const dryReport = await backfillHousehold(adminDb, CODE, { mode: 'dry-run' });
    assert.equal(dryReport.heroCount, 2);
    assert.equal(dryReport.joinedMembersCount, 2);
    assert.equal(dryReport.pendingApprovalsCount, 2);
    assert.equal(dryReport.hasPlainTextPin, true);
    assert.equal((await hRef.get()).data().ledgerMode, 'legacy', 'dry-run must not mutate ledgerMode');
    console.log('  ✅ backfill --dry-run report verified');

    // 3. Freeze
    const freezeRes = await backfillHousehold(adminDb, CODE, { mode: 'freeze' });
    assert.equal(freezeRes.newLedgerMode, 'migrating');
    assert.equal((await hRef.collection('private').doc('preCutoverSnapshot').get()).exists, true);
    console.log('  ✅ backfill --freeze sets ledgerMode="migrating" and saves preCutoverSnapshot');

    // 4. Cutover (and idempotent re-run)
    const cutoverRes = await backfillHousehold(adminDb, CODE, { mode: 'cutover' });
    assert.equal(cutoverRes.newLedgerMode, 'authoritative');
    await backfillHousehold(adminDb, CODE, { mode: 'cutover' }); // Idempotency check

    const hhAfterCutover = (await hRef.get()).data();
    assert.equal(hhAfterCutover.ledgerMode, 'authoritative');
    assert.equal('pin' in (hhAfterCutover.parentSettings || {}), false, 'plain-text PIN deleted from parentSettings');
    assert.equal('pin' in (hhAfterCutover.stateSnapshot?.parentSettings || {}), false, 'plain-text PIN deleted from stateSnapshot.parentSettings');

    // Verify per-kid HQ filtering: hero_a keeps galaxy_bed (buyer), hero_b has empty placedFurniture, unowned_legacy_desk dropped
    const profileA = (await hRef.collection('heroes').doc('hero_a').get()).data();
    const profileB = (await hRef.collection('heroes').doc('hero_b').get()).data();
    assert.equal(profileA.hq.placedFurniture.bed, 'galaxy_bed');
    assert.equal(profileA.hq.placedFurniture.desk, undefined);
    assert.equal(profileB.hq.placedFurniture.bed, undefined);

    // Verify migrated PIN works on server!
    const pinUnlock = await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'verifyParentPin',
      code: CODE,
      args: { pin: '5678' }
    });
    assert.equal(pinUnlock.unlocked, true);
    console.log('  ✅ backfill --cutover (idempotent, PIN hashed & deleted, per-kid HQ filtered) verified');

    // 5. Post-cutover mutations: earn, purchase, avatar change, authoritative household push
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'upsertCatalog',
      code: CODE,
      args: { itemId: 'space_lamp', kind: 'hq_furniture', title: 'Space Lamp', costCoins: 30, active: true }
    });
    await dispatchLedgerAction(adminDb, PARENT_AUTH, {
      action: 'upsertRewardRules',
      code: CODE,
      args: { activityType: 'habit', activityId: 'drink_water', tokens: 25, xp: 15, sparks: 5, points: 10, active: true }
    });

    // Kid earns drink_water (leaves new pending approval!)
    await dispatchLedgerAction(adminDb, KID_AUTH, {
      action: 'recordActivity',
      code: CODE,
      args: { heroId: 'hero_a', activityType: 'habit', activityId: 'drink_water', cycleId: '2026-11-25', petId: '1' }
    });
    // Kid buys space_lamp (30 tokens)
    await dispatchLedgerAction(adminDb, KID_AUTH, {
      action: 'purchase',
      code: CODE,
      args: { heroId: 'hero_a', kind: 'hq_furniture', itemId: 'space_lamp', clientUuid: 'buy_lamp_1' }
    });

    // Kid updates avatar on heroes/hero_a under real firestore.rules
    const kidDb = testEnv.authenticatedContext(KID_AUTH.uid).firestore();
    await assertSucceeds(updateDoc(doc(kidDb, `households/${CODE}/heroes/hero_a`), { avatar: 'leo_astronaut_v2' }));

    // Client pushes non-currency update to households/{CODE} under real firestore.rules (must succeed!)
    await assertSucceeds(setDoc(doc(kidDb, `households/${CODE}`), {
      householdName: 'Rehearsal Family Live',
      parentSettings: { pinLockEnabled: true, biometricsEnabled: true }
    }, { merge: true }));
    console.log('  ✅ Post-cutover earn, purchase, avatar update & non-currency household push succeeded under rules');

    // 6. Mirror walletSummary & verify server/householdReader.js merge
    const walletAData = (await hRef.collection('wallets').doc('hero_a').get()).data();
    await mirrorWalletSummaryForHero(adminDb, CODE, 'hero_a', walletAData);
    const summaryData = (await hRef.collection('public').doc('walletSummary').get()).data();
    assert.equal(summaryData.heroes.hero_a.coins, 195); // 200 + 25 - 30
    const mergedForPi = mergeWalletSummaryIntoState({ heroes: [{ id: 'hero_a', name: 'Leo', coins: 0, points: 0 }] }, summaryData);
    assert.equal(mergedForPi.heroes[0].coins, 195);
    console.log('  ✅ mirrorWalletSummaryForHero & server/householdReader.js merge verified');

    // 7. Nightly reconcile job finds 0 drifts and writes ledger_reports/2026-11-25
    const recSummary = await runNightlyReconcile(adminDb, '2026-11-25');
    assert.equal(recSummary.householdsChecked, 1);
    assert.equal(recSummary.walletsChecked, 2);
    assert.equal(recSummary.driftsFound, 0);
    const reportDoc = (await hRef.collection('ledger_reports').doc('2026-11-25').get()).data();
    assert.equal(reportDoc.driftsFound, 0);
    console.log('  ✅ runNightlyReconcile verified (0 drifts, ledger_reports written)');

    // 8. Rollback rehearsal: legacy household doc must show ALL post-cutover changes!
    const rbRes = await rollbackHousehold(adminDb, CODE);
    assert.equal(rbRes.rolledBack, true);
    assert.equal(rbRes.newLedgerMode, 'legacy');

    const hhRolledBack = (await hRef.get()).data();
    assert.equal(hhRolledBack.ledgerMode, 'legacy');
    const rbHeroA = hhRolledBack.heroes.find((h) => h.id === 'hero_a');
    assert.equal(rbHeroA.coins, 195, 'post-cutover earn + purchase preserved on rollback');
    assert.equal(rbHeroA.avatar, 'leo_astronaut_v2', 'post-cutover avatar edit preserved on rollback');
    assert.equal(hhRolledBack.heroHQ.furnitureOwners.space_lamp, 'hero_a', 'post-cutover furniture purchase preserved on rollback');
    assert.ok(hhRolledBack.pendingApprovals.some((r) => r.taskId === 'drink_water'), 'post-cutover pending approval preserved on rollback');
    console.log('  ✅ Rollback rehearsal preserved post-cutover balances, purchase, avatar & pending approval');

    // 9. Cleanup preCutoverSnapshot
    const cleanRes = await cleanupPreCutoverSnapshot(adminDb, CODE);
    assert.equal(cleanRes.deleted, true);
    assert.equal((await hRef.collection('private').doc('preCutoverSnapshot').get()).exists, false);
    console.log('  ✅ cleanupPreCutoverSnapshot verified');

    console.log('✅ All Phase 4 backfill, background jobs & rollback rehearsal tests passed!');
  } finally {
    await testEnv.cleanup();
  }
}

run().catch((err) => {
  console.error('❌ Phase 4 emulator test failed:', err);
  process.exit(1);
});
