#!/usr/bin/env node
/**
 * scripts/ledger/cleanup_snapshot.mjs
 *
 * Phase 4: Deletes households/{code}/private/preCutoverSnapshot once cutover
 * has been verified stable in production.
 *
 * Usage:
 *   node scripts/ledger/cleanup_snapshot.mjs --code YOURCODE
 */

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const requireFromLedger = createRequire(new URL('../../functions-ledger/package.json', import.meta.url));

export async function cleanupPreCutoverSnapshot(db, rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
    throw new Error(`Invalid household code: ${rawCode}`);
  }
  const snapRef = db.collection('households').doc(code).collection('private').doc('preCutoverSnapshot');
  const existing = await snapRef.get();
  if (!existing.exists) {
    return { code, deleted: false, reason: 'snapshot_not_found' };
  }
  await snapRef.delete();
  return { code, deleted: true };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const codeIdx = args.indexOf('--code');
  const code = codeIdx >= 0 ? args[codeIdx + 1] : process.env.HOUSEHOLD_CODE;

  if (!code) {
    console.error('Usage: node scripts/ledger/cleanup_snapshot.mjs --code <HOUSEHOLD_CODE>');
    process.exit(1);
  }

  const { initializeApp, getApps } = requireFromLedger('firebase-admin/app');
  const { getFirestore } = requireFromLedger('firebase-admin/firestore');
  const app = getApps().length > 0 ? getApps()[0] : initializeApp();
  const db = getFirestore(app);

  const result = await cleanupPreCutoverSnapshot(db, code);
  console.log(JSON.stringify(result, null, 2));
}
