#!/usr/bin/env node
/**
 * scripts/ledger/strip_legacy_fields.mjs
 *
 * Phase 5: Splits large non-currency arrays out of `households/{CODE}` into
 * dedicated subcollections (`bedtime_stories`, `task_logs`, `tasks`, `habits`,
 * `studio_items`) and strips legacy currency/approval/inventory/hero/HQ fields
 * from the parent household document so it stays well under 500 KB (typically <50 KB).
 *
 * Optionally passes `--lock-reads` to set `strictMemberReads: true` on `households/{CODE}`
 * once the Pi/fridge reader & meals writer have moved to Admin SDK.
 *
 * Usage:
 *   node scripts/ledger/strip_legacy_fields.mjs --code YOURCODE [--lock-reads]
 */

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { sanitizeIdSegment } from '../../shared/ledger/ids.js';

const requireFromLedger = createRequire(new URL('../../functions-ledger/package.json', import.meta.url));
const { FieldValue, Timestamp } = requireFromLedger('firebase-admin/firestore');

const STUDIO_ARRAYS = [
  ['parentCustomWeapons', 'weapon'],
  ['parentCustomGear', 'gear'],
  ['parentCustomFurniture', 'furniture'],
  ['parentCustomToys', 'toy'],
  ['parentCustomFood', 'food'],
  ['parentCustomBosses', 'boss']
];

const LEGACY_TOP_LEVEL_KEYS_TO_DELETE = [
  'heroes',
  'heroesMap',
  'selectedHero',
  'pendingApprovals',
  'resolvedApprovals',
  'inventory',
  'heroHQ',
  'petXpMap',
  'petLevelMap',
  'bedtimeStoryLibrary',
  'taskCompletionLogs',
  'taskForest',
  'habitIslands',
  'parentCustomWeapons',
  'parentCustomGear',
  'parentCustomFurniture',
  'parentCustomToys',
  'parentCustomFood',
  'parentCustomBosses'
];

async function commitInChunks(db, ops, chunkSize = 400) {
  let committed = 0;
  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + chunkSize)) {
      batch.set(op.ref, op.data, { merge: true });
    }
    await batch.commit();
    committed += Math.min(chunkSize, ops.length - i);
  }
  return committed;
}

export async function stripLegacyAndSplitDomains(db, rawCode, { lockReads = false } = {}) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
    throw new Error(`Invalid household code: ${rawCode}`);
  }

  const hRef = db.collection('households').doc(code);
  const hSnap = await hRef.get();
  if (!hSnap.exists) {
    throw new Error(`Household ${code} not found`);
  }
  const data = hSnap.data() || {};
  const snap = (data.stateSnapshot && typeof data.stateSnapshot === 'object') ? data.stateSnapshot : {};
  const nowTs = Timestamp.now();

  const pickArray = (key) => {
    if (Array.isArray(data[key]) && data[key].length > 0) return data[key];
    if (Array.isArray(snap[key]) && snap[key].length > 0) return snap[key];
    return [];
  };

  const ops = [];
  const counts = {
    bedtime_stories: 0,
    task_logs: 0,
    tasks: 0,
    habits: 0,
    studio_items: 0
  };

  // 1. bedtimeStoryLibrary -> bedtime_stories/{id}
  const stories = pickArray('bedtimeStoryLibrary');
  stories.forEach((s, idx) => {
    if (!s || typeof s !== 'object') return;
    const id = sanitizeIdSegment(s.id || `story_${idx}`, 'storyId');
    ops.push({ ref: hRef.collection('bedtime_stories').doc(id), data: { ...s, id, migratedAt: nowTs } });
    counts.bedtime_stories++;
  });

  // 2. taskCompletionLogs -> task_logs/{id}
  const logs = pickArray('taskCompletionLogs');
  logs.forEach((l, idx) => {
    if (!l || typeof l !== 'object') return;
    const id = sanitizeIdSegment(l.id || l.logId || `log_${idx}`, 'logId');
    ops.push({ ref: hRef.collection('task_logs').doc(id), data: { ...l, id, migratedAt: nowTs } });
    counts.task_logs++;
  });

  // 3. taskForest -> tasks/{id}
  const tasks = pickArray('taskForest');
  tasks.forEach((t, idx) => {
    if (!t || typeof t !== 'object') return;
    const id = sanitizeIdSegment(t.id || `task_${idx}`, 'taskId');
    ops.push({ ref: hRef.collection('tasks').doc(id), data: { ...t, id, migratedAt: nowTs } });
    counts.tasks++;
  });

  // 4. habitIslands -> habits/{id}
  const habits = pickArray('habitIslands');
  habits.forEach((h, idx) => {
    if (!h || typeof h !== 'object') return;
    const id = sanitizeIdSegment(h.id || `habit_${idx}`, 'habitId');
    ops.push({ ref: hRef.collection('habits').doc(id), data: { ...h, id, migratedAt: nowTs } });
    counts.habits++;
  });

  // 5. Parent Studio custom items -> studio_items/{id}
  for (const [key, category] of STUDIO_ARRAYS) {
    const items = pickArray(key);
    items.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const id = sanitizeIdSegment(item.id || `${category}_${idx}`, 'itemId');
      ops.push({
        ref: hRef.collection('studio_items').doc(id),
        data: { ...item, id, studioCategory: category, migratedAt: nowTs }
      });
      counts.studio_items++;
    });
  }

  await commitInChunks(db, ops);

  // 6. Delete legacy currency, approval, inventory, hero, HQ, and split-domain fields from households/{CODE}
  const patch = {
    updatedAt: nowTs.toDate().toISOString()
  };
  for (const key of LEGACY_TOP_LEVEL_KEYS_TO_DELETE) {
    patch[key] = FieldValue.delete();
  }
  if (data.stateSnapshot && typeof data.stateSnapshot === 'object') {
    for (const key of [...LEGACY_TOP_LEVEL_KEYS_TO_DELETE, 'petSparkMap']) {
      patch[`stateSnapshot.${key}`] = FieldValue.delete();
    }
    patch['stateSnapshot.parentSettings.pin'] = FieldValue.delete();
  }
  patch['parentSettings.pin'] = FieldValue.delete();

  if (lockReads) {
    patch.strictMemberReads = true;
  }

  await hRef.update(patch);

  const afterData = (await hRef.get()).data() || {};
  const parentDocBytes = Buffer.byteLength(JSON.stringify(afterData), 'utf8');

  return {
    code,
    counts,
    totalDocsMigrated: ops.length,
    strictMemberReads: Boolean(afterData.strictMemberReads),
    parentDocBytes
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const codeIdx = args.indexOf('--code');
  const code = codeIdx >= 0 ? args[codeIdx + 1] : process.env.HOUSEHOLD_CODE;
  const lockReads = args.includes('--lock-reads');

  if (!code) {
    console.error('Usage: node scripts/ledger/strip_legacy_fields.mjs --code <HOUSEHOLD_CODE> [--lock-reads]');
    process.exit(1);
  }

  const { initializeApp, getApps } = requireFromLedger('firebase-admin/app');
  const { getFirestore } = requireFromLedger('firebase-admin/firestore');
  const app = getApps().length > 0 ? getApps()[0] : initializeApp();
  const db = getFirestore(app);

  const result = await stripLegacyAndSplitDomains(db, code, { lockReads });
  console.log(JSON.stringify(result, null, 2));
}
