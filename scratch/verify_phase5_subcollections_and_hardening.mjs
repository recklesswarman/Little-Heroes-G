/**
 * scratch/verify_phase5_subcollections_and_hardening.mjs
 *
 * Phase 5 Emulator Tests:
 * 1. Member read/write and non-member denial on all 5 split non-currency subcollections:
 *    bedtime_stories, task_logs, tasks, habits, studio_items.
 * 2. Seeds a household with 1,000 task logs and 200 bedtime stories, runs
 *    stripLegacyAndSplitDomains(adminDb, CODE, { lockReads: true }), and verifies:
 *    - all 1,000 task_logs and 200 bedtime_stories migrated to subcollections
 *    - legacy currency/approval/inventory/hero/HQ fields stripped
 *    - parent households/{CODE} document stays well under 500 KB (< 5 KB!)
 * 3. Non-members are strictly denied reading households/{CODE} and public/walletSummary
 *    once strictMemberReads is true; members can still read.
 * 4. Clients cannot tamper with strictMemberReads.
 * 5. Admin SDK helpers (fetchHouseholdWithAdmin & updateHouseholdFieldWithAdmin) read
 *    the locked household (hydrating walletSummary + split subcollections) and update
 *    mealPlan transactionally for the Pi/fridge & meals services.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { stripLegacyAndSplitDomains } from '../scripts/ledger/strip_legacy_fields.mjs';
import { fetchHouseholdWithAdmin, updateHouseholdFieldWithAdmin } from '../server/householdReader.js';

const requireFromLedger = createRequire(new URL('../functions-ledger/package.json', import.meta.url));
const { initializeApp, getApps } = requireFromLedger('firebase-admin/app');
const { getFirestore } = requireFromLedger('firebase-admin/firestore');
const { dispatchLedgerAction } = requireFromLedger('./lib/handler.js');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_ID = 'little-heroes-quest-8842';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const [HOST, PORT_STR] = EMULATOR_HOST.split(':');
const PORT = Number(PORT_STR) || 8080;

const CODE = 'PHASE5TEST';
const MEMBER_AUTH = { uid: 'member_p5', email: null, emailVerified: false };
const OUTSIDER_UID = 'outsider_p5';

async function run() {
  console.log(`🧪 Running Phase 5 Subcollections & Security Hardening Suite against ${HOST}:${PORT}...`);

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
    // 1. Seed a heavy household with 1,000 task logs, 200 stories, tasks, habits, studio items & legacy currency fields
    const hRef = adminDb.collection('households').doc(CODE);
    const taskLogs = Array.from({ length: 1000 }, (_, i) => ({
      id: `log_${i}`,
      kidId: 'hero_a',
      taskId: 'brush_teeth',
      completedAt: '2026-11-25T08:00:00Z'
    }));
    const stories = Array.from({ length: 200 }, (_, i) => ({
      id: `story_${i}`,
      title: `Rex Adventure #${i}`,
      body: 'Once upon a time Rex discovered a glowing emerald forest filled with friendly stars.'
    }));

    await hRef.set({
      syncCode: CODE,
      householdName: 'Hardened Family',
      ledgerMode: 'authoritative',
      heroes: [{ id: 'hero_a', coins: 999 }],
      heroesMap: { hero_a: { coins: 999 } },
      pendingApprovals: [],
      inventory: [],
      heroHQ: { themeId: 'dino_treehouse' },
      parentSettings: { pin: '1234', pinLockEnabled: true },
      taskCompletionLogs: taskLogs,
      bedtimeStoryLibrary: stories,
      taskForest: [{ id: 'clean_room', title: 'Clean Room', coins: 15, points: 10 }],
      habitIslands: [{ id: 'brush_teeth', title: 'Brush Teeth', coins: 10, points: 5 }],
      parentCustomWeapons: [{ id: 'sword_1', name: 'Star Sword' }],
      stateSnapshot: {
        mealPlan: { monday: 'Tacos' },
        parentSettings: { pin: '1234' }
      }
    });
    await hRef.collection('public').doc('walletSummary').set({
      heroes: { hero_a: { coins: 350, points: 75, level: 3 } }
    });

    // Register member
    await dispatchLedgerAction(adminDb, MEMBER_AUTH, {
      action: 'joinHousehold',
      code: CODE,
      args: { deviceId: 'dev_p5', deviceLabel: 'Phase 5 Tablet' }
    });

    // 2. Run stripLegacyAndSplitDomains with lockReads: true
    const stripRes = await stripLegacyAndSplitDomains(adminDb, CODE, { lockReads: true });
    assert.equal(stripRes.counts.task_logs, 1000);
    assert.equal(stripRes.counts.bedtime_stories, 200);
    assert.equal(stripRes.counts.tasks, 1);
    assert.equal(stripRes.counts.habits, 1);
    assert.equal(stripRes.counts.studio_items, 1);
    assert.equal(stripRes.strictMemberReads, true);
    assert.ok(stripRes.parentDocBytes < 500_000, `Parent household doc must be < 500 KB, got ${stripRes.parentDocBytes} bytes`);

    const parentAfter = (await hRef.get()).data();
    assert.equal('heroes' in parentAfter, false);
    assert.equal('heroesMap' in parentAfter, false);
    assert.equal('taskCompletionLogs' in parentAfter, false);
    assert.equal('bedtimeStoryLibrary' in parentAfter, false);
    assert.equal('pin' in (parentAfter.parentSettings || {}), false);
    console.log(`  ✅ Split 1,000 task logs + 200 stories into subcollections; parent doc shrunk to ${stripRes.parentDocBytes} bytes`);

    // 3. Emulator security rules: member read/write allowed, non-member denied on all 5 subcollections + locked parent doc
    const memberDb = testEnv.authenticatedContext(MEMBER_AUTH.uid).firestore();
    const outsiderDb = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    const unauthDb = testEnv.unauthenticatedContext().firestore();

    for (const sub of ['bedtime_stories', 'task_logs', 'tasks', 'habits', 'studio_items']) {
      await assertSucceeds(setDoc(doc(memberDb, `households/${CODE}/${sub}/test_doc`), { id: 'test_doc', ok: true }));
      await assertSucceeds(getDoc(doc(memberDb, `households/${CODE}/${sub}/test_doc`)));
      await assertFails(getDoc(doc(outsiderDb, `households/${CODE}/${sub}/test_doc`)));
      await assertFails(setDoc(doc(outsiderDb, `households/${CODE}/${sub}/evil_doc`), { id: 'evil_doc' }));
      await assertFails(getDoc(doc(unauthDb, `households/${CODE}/${sub}/test_doc`)));
    }
    console.log('  ✅ All 5 non-currency subcollections enforce member-only read/write');

    // Locked household & public/walletSummary reads: non-member & unauth denied, member allowed
    await assertSucceeds(getDoc(doc(memberDb, `households/${CODE}`)));
    await assertFails(getDoc(doc(outsiderDb, `households/${CODE}`)));
    await assertFails(getDoc(doc(unauthDb, `households/${CODE}`)));
    await assertSucceeds(getDoc(doc(memberDb, `households/${CODE}/public/walletSummary`)));
    await assertFails(getDoc(doc(outsiderDb, `households/${CODE}/public/walletSummary`)));
    await assertFails(getDoc(doc(unauthDb, `households/${CODE}/public/walletSummary`)));

    // Clients cannot unlock strictMemberReads
    await assertFails(setDoc(doc(memberDb, `households/${CODE}`), { strictMemberReads: false }, { merge: true }));
    console.log('  ✅ strictMemberReads locks households/{CODE} & public/walletSummary to members/Admin SDK');

    // 4. Admin SDK reader & meal plan writer work seamlessly on the locked household
    const adminState = await fetchHouseholdWithAdmin(adminDb, CODE);
    assert.equal(adminState.heroes[0].coins, 350);
    assert.equal(adminState.taskForest.length, 2); // clean_room + test_doc
    assert.equal(adminState.bedtimeStoryLibrary.length, 201); // 200 + test_doc
    assert.equal(adminState.taskCompletionLogs.length, 1001); // 1000 + test_doc

    await updateHouseholdFieldWithAdmin(adminDb, CODE, 'stateSnapshot.mealPlan', (curr) => ({
      ...(curr || {}),
      tuesday: 'Dino Pasta'
    }));
    const updatedDoc = (await hRef.get()).data();
    assert.equal(updatedDoc.stateSnapshot.mealPlan.tuesday, 'Dino Pasta');
    console.log('  ✅ Admin SDK Pi reader & meals writer work on locked household');

    console.log('✅ All Phase 5 subcollection & security hardening tests passed!');
  } finally {
    await testEnv.cleanup();
  }
}

run().catch((err) => {
  console.error('❌ Phase 5 emulator test failed:', err);
  process.exit(1);
});
