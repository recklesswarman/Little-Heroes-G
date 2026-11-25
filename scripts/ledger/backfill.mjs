#!/usr/bin/env node
/**
 * scripts/ledger/backfill.mjs
 *
 * Phase 4: Idempotent backfill & cutover script migrating a legacy household
 * document into the authoritative double-entry Firestore ledger.
 *
 * Modes:
 *   --dry-run   Inspect household state, balances, furnitureOwners & joined devices (no writes)
 *   --freeze    Set ledgerMode='migrating' and snapshot pre-cutover state to private/preCutoverSnapshot
 *   --cutover   Idempotently create wallets, BACKFILL txns, heroes, inventory, approvals, holds,
 *               scrypt-hashed private/parentAuth (deleting plain-text PIN), public/walletSummary,
 *               and flip ledgerMode='authoritative'
 *
 * Usage:
 *   node scripts/ledger/backfill.mjs --code YOURCODE --dry-run
 *   node scripts/ledger/backfill.mjs --code YOURCODE --freeze
 *   node scripts/ledger/backfill.mjs --code YOURCODE --cutover
 */

import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { CURRENCIES } from '../../shared/ledger/currencies.js';
import {
  backfillTxnId,
  rewardHoldTxnId,
  inventoryDocId,
  activityLockDocId,
  canonicalTaskId,
  sanitizeIdSegment
} from '../../shared/ledger/ids.js';
import { heroLevelFromCum } from '../../shared/ledger/curves.js';
import { plan } from '../../shared/ledger/core.js';

const requireFromLedger = createRequire(new URL('../../functions-ledger/package.json', import.meta.url));
const { FieldValue, Timestamp } = requireFromLedger('firebase-admin/firestore');

const LEDGER_HERO_FIELDS = new Set([
  'points', 'coins', 'tokens', 'xp', 'level', 'xpNext', 'sparks', 'evolutionSparks',
  'petSparkMap', 'petXpMap', 'petLevelMap', 'inventory', 'consumables',
  'unlockedPetIds', 'habitatSlots', 'unlockedThemes', 'fieldStamps'
]);

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pin, salt, 64).toString('hex');
  return { hash, salt };
}

function nonNegInt(v) {
  const n = Math.trunc(Number(v) || 0);
  return n < 0 ? 0 : n;
}

function extractHeroes(data) {
  const byId = new Map();
  if (Array.isArray(data.heroes)) {
    for (const h of data.heroes) {
      if (h && h.id) byId.set(String(h.id), { ...h });
    }
  }
  if (data.heroesMap && typeof data.heroesMap === 'object') {
    for (const [id, h] of Object.entries(data.heroesMap)) {
      if (h && typeof h === 'object') {
        byId.set(String(id), { ...(byId.get(String(id)) || {}), ...h, id: String(h.id || id) });
      }
    }
  }
  return Array.from(byId.values());
}

/**
 * Core backfill/cutover function (reused by both CLI and emulator rehearsal tests).
 */
export async function backfillHousehold(db, rawCode, { mode = 'dry-run' } = {}) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
    throw new Error(`Invalid household code: ${rawCode}`);
  }
  if (!['dry-run', 'freeze', 'cutover'].includes(mode)) {
    throw new Error(`Invalid mode: ${mode}. Expected dry-run | freeze | cutover`);
  }

  const hRef = db.collection('households').doc(code);
  const hSnap = await hRef.get();
  if (!hSnap.exists) {
    throw new Error(`Household ${code} not found`);
  }
  const data = hSnap.data() || {};
  const heroes = extractHeroes(data);
  const membersSnap = await hRef.collection('members').get();
  const members = membersSnap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  const pendingApprovals = Array.isArray(data.pendingApprovals) ? data.pendingApprovals.filter((r) => r && r.status === 'pending') : [];
  const heroHQ = data.heroHQ && typeof data.heroHQ === 'object' ? data.heroHQ : {};
  const furnitureOwners = heroHQ.furnitureOwners && typeof heroHQ.furnitureOwners === 'object' ? heroHQ.furnitureOwners : {};

  const report = {
    code,
    mode,
    currentLedgerMode: data.ledgerMode || 'legacy',
    heroCount: heroes.length,
    heroes: heroes.map((h) => ({
      id: h.id,
      name: h.name || h.id,
      coins: nonNegInt(h.coins),
      points: nonNegInt(h.points),
      xp: nonNegInt(h.xp),
      sparks: nonNegInt(h.sparks)
    })),
    pendingApprovalsCount: pendingApprovals.length,
    furnitureOwnersCount: Object.keys(furnitureOwners).length,
    joinedMembersCount: members.length,
    joinedMembers: members.map((m) => ({ uid: m.uid, deviceLabel: m.deviceLabel || 'Hero Device', role: m.role || 'device' })),
    hasPlainTextPin: Boolean(data.parentSettings?.pin || data.stateSnapshot?.parentSettings?.pin)
  };

  if (mode === 'dry-run') {
    return report;
  }

  const nowTs = Timestamp.now();

  if (mode === 'freeze') {
    await hRef.collection('private').doc('preCutoverSnapshot').set({
      capturedAt: nowTs,
      ledgerModeBefore: data.ledgerMode || 'legacy',
      data
    });
    await hRef.update({ ledgerMode: 'migrating' });
    return { ...report, frozen: true, newLedgerMode: 'migrating' };
  }

  // mode === 'cutover'
  // 1. Ensure pre-cutover snapshot exists
  const snapRef = hRef.collection('private').doc('preCutoverSnapshot');
  if (!(await snapRef.get()).exists) {
    await snapRef.set({
      capturedAt: nowTs,
      ledgerModeBefore: data.ledgerMode || 'legacy',
      data
    });
  }

  const summaryHeroes = {};

  // 2. Backfill each hero's wallet, BACKFILL txn, profile doc (heroes/{heroId}), and inventory
  for (const h of heroes) {
    const heroId = sanitizeIdSegment(h.id, 'heroId');
    const coins = nonNegInt(h.coins);
    const points = nonNegInt(h.points);
    const xp = nonNegInt(h.xp);
    const activePetId = h.activePetId != null ? String(h.activePetId) : null;

    const petSparks = {};
    if (h.petSparkMap && typeof h.petSparkMap === 'object') {
      for (const [pid, val] of Object.entries(h.petSparkMap)) {
        const n = nonNegInt(val);
        if (n > 0) petSparks[String(pid)] = n;
      }
    }
    if (activePetId && !petSparks[activePetId] && nonNegInt(h.sparks) > 0) {
      petSparks[activePetId] = nonNegInt(h.sparks);
    }

    const petXp = {};
    const legacyPetXp = (h.petXpMap && typeof h.petXpMap === 'object') ? h.petXpMap : (data.petXpMap || {});
    for (const [pid, val] of Object.entries(legacyPetXp)) {
      const n = nonNegInt(val);
      if (n > 0) petXp[String(pid)] = n;
    }

    const level = Math.max(1, heroLevelFromCum(xp).level);
    const txnId = backfillTxnId(heroId);
    const walletRef = hRef.collection('wallets').doc(heroId);
    const txnRef = hRef.collection('ledger_transactions').doc(txnId);

    const existingWallet = await walletRef.get();
    if (!existingWallet.exists) {
      const planned = plan('openWallet', {
        heroId,
        starting: {
          points,
          coins,
          xp,
          petSparks,
          petXp
        },
        txnId,
        now: nowTs.toDate().toISOString(),
        actor: { uid: 'backfill', deviceId: 'backfill', role: 'system' }
      });
      if (planned.error) {
        throw new Error(`Backfill openWallet plan failed for ${heroId}: ${planned.error}`);
      }
      const batch = db.batch();
      batch.set(walletRef, planned.walletAfter);
      batch.set(txnRef, { ...planned.txnDoc, type: 'BACKFILL' });
      await batch.commit();
    }

    // Per-kid HQ ownership from Phase 0 furnitureOwners (items without recorded buyer are NOT granted)
    const ownedFurniture = new Set();
    for (const [itemId, ownerHeroId] of Object.entries(furnitureOwners)) {
      if (String(ownerHeroId) === heroId) {
        ownedFurniture.add(itemId);
        const invId = inventoryDocId(heroId, itemId);
        await hRef.collection('inventory').doc(invId).set({
          heroId,
          itemId,
          kind: 'hq_furniture',
          quantity: 1,
          acquiredVia: 'backfill',
          updatedAt: nowTs
        }, { merge: true });
      }
    }

    // Backfill unlocked pets & themes into inventory
    const unlockedPets = Array.isArray(h.unlockedPetIds) ? h.unlockedPetIds : [];
    for (const pid of unlockedPets) {
      const invId = inventoryDocId(heroId, `pet_${pid}`);
      await hRef.collection('inventory').doc(invId).set({
        heroId,
        itemId: String(pid),
        kind: 'pet',
        quantity: 1,
        acquiredVia: 'backfill',
        updatedAt: nowTs
      }, { merge: true });
    }

    // Build non-currency hero profile doc at households/{code}/heroes/{heroId}
    const profileDoc = { id: heroId };
    for (const [k, v] of Object.entries(h)) {
      if (!LEDGER_HERO_FIELDS.has(k) && v !== undefined) {
        profileDoc[k] = v;
      }
    }
    // Filter HQ placedFurniture to items this kid actually owns (or starter free items)
    const rawEquipped = heroHQ.equippedFurniture && typeof heroHQ.equippedFurniture === 'object' ? heroHQ.equippedFurniture : {};
    const filteredPlaced = {};
    for (const [slot, itemId] of Object.entries(rawEquipped)) {
      if (itemId && ownedFurniture.has(itemId)) {
        filteredPlaced[slot] = itemId;
      }
    }
    profileDoc.hq = {
      activeTheme: heroHQ.themeId || 'dino_treehouse',
      isNightMode: Boolean(heroHQ.isNightMode),
      placedFurniture: filteredPlaced
    };
    profileDoc.updatedAt = nowTs;
    await hRef.collection('heroes').doc(heroId).set(profileDoc, { merge: true });

    let totalSparks = 0;
    for (const val of Object.values(petSparks)) totalSparks += val;
    summaryHeroes[heroId] = {
      points,
      heldPoints: 0,
      coins,
      xp,
      level,
      sparks: totalSparks,
      petSparks,
      petXp,
      version: 1,
      updatedAt: nowTs
    };
  }

  // 3. Backfill pending approval requests (task approvals + reward holds)
  for (const req of pendingApprovals) {
    const reqId = sanitizeIdSegment(req.id || `appr_${Date.now()}`, 'reqId');
    const heroId = sanitizeIdSegment(req.kidId || req.heroId || heroes[0]?.id || 'hero_1', 'heroId');
    if (req.type === 'reward_redemption') {
      const cost = nonNegInt(req.costPoints || req.points || 0);
      const holdTxnId = rewardHoldTxnId(reqId);
      const holdTxnRef = hRef.collection('ledger_transactions').doc(holdTxnId);
      if (!(await holdTxnRef.get()).exists && cost > 0) {
        const wRef = hRef.collection('wallets').doc(heroId);
        const wSnap = await wRef.get();
        if (wSnap.exists) {
          const plannedHold = plan('requestReward', {
            wallet: wSnap.data(),
            requestId: reqId,
            rewardId: String(req.rewardId || reqId),
            rewardTitle: String(req.title || req.rewardTitle || 'Reward'),
            costPoints: cost,
            txnId: holdTxnId,
            now: nowTs.toDate().toISOString(),
            actor: { uid: 'backfill', deviceId: 'backfill', role: 'system' }
          });
          if (!plannedHold.error) {
            const batch = db.batch();
            batch.set(holdTxnRef, plannedHold.txnDoc);
            batch.set(wRef, plannedHold.walletAfter);
            batch.set(hRef.collection('holds').doc(reqId), {
              holdId: reqId,
              heroId,
              rewardId: String(req.rewardId || reqId),
              title: String(req.title || req.rewardTitle || 'Reward'),
              currency: CURRENCIES.GOLD_POINTS,
              amount: cost,
              status: 'active',
              createdAt: nowTs
            });
            batch.set(hRef.collection('approval_requests').doc(reqId), {
              id: reqId,
              heroId,
              type: 'reward_redemption',
              holdId: reqId,
              rewardId: String(req.rewardId || reqId),
              title: String(req.title || req.rewardTitle || 'Reward'),
              costPoints: cost,
              status: 'pending',
              createdAt: nowTs
            });
            await batch.commit();
          }
        }
      }
    } else {
      const taskId = String(req.taskId || req.habitId || reqId);
      const lockKey = canonicalTaskId(taskId);
      await hRef.collection('approval_requests').doc(reqId).set({
        id: reqId,
        heroId,
        type: 'task_point_approval',
        taskId,
        lockKey,
        title: String(req.taskTitle || req.title || taskId),
        pendingPoints: nonNegInt(req.pendingPoints || 0),
        status: 'pending',
        metadata: {
          legacyAward: {
            tokensAwarded: nonNegInt(req.tokensAwarded || 0),
            xpAwarded: nonNegInt(req.xpAwarded || 0),
            sparksAwarded: nonNegInt(req.sparksAwarded || 0),
            petId: req.petId ? String(req.petId) : null
          }
        },
        createdAt: nowTs
      }, { merge: true });
      await hRef.collection('activity_locks').doc(activityLockDocId(heroId, lockKey)).set({
        heroId,
        lockKey,
        approvalId: reqId,
        createdAt: nowTs
      }, { merge: true });
    }
  }

  // 4. Hash parent PIN into private/parentAuth and delete plain-text PIN from both copies
  const plainPin = String(data.parentSettings?.pin || data.stateSnapshot?.parentSettings?.pin || '1234').trim();
  const authRef = hRef.collection('private').doc('parentAuth');
  if (!(await authRef.get()).exists) {
    const { hash, salt } = hashPin(/^\d{4,8}$/.test(plainPin) ? plainPin : '1234');
    await authRef.set({
      pinHash: hash,
      pinSalt: salt,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: nowTs
    });
  }

  // 5. Write public/walletSummary
  await hRef.collection('public').doc('walletSummary').set({
    heroes: summaryHeroes,
    updatedAt: nowTs
  }, { merge: true });

  // 6. Flip ledgerMode -> 'authoritative' and strip plain-text PIN from both places
  const hhPatch = {
    ledgerMode: 'authoritative',
    'parentSettings.pin': FieldValue.delete()
  };
  if (data.stateSnapshot && typeof data.stateSnapshot === 'object') {
    hhPatch['stateSnapshot.parentSettings.pin'] = FieldValue.delete();
  }
  await hRef.update(hhPatch);

  return {
    ...report,
    cutover: true,
    newLedgerMode: 'authoritative'
  };
}

// CLI execution
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const codeIdx = args.indexOf('--code');
  const code = codeIdx >= 0 ? args[codeIdx + 1] : process.env.HOUSEHOLD_CODE;
  const mode = args.includes('--cutover') ? 'cutover' : (args.includes('--freeze') ? 'freeze' : 'dry-run');

  if (!code) {
    console.error('Usage: node scripts/ledger/backfill.mjs --code <HOUSEHOLD_CODE> [--dry-run|--freeze|--cutover]');
    process.exit(1);
  }

  const { initializeApp, getApps } = requireFromLedger('firebase-admin/app');
  const { getFirestore } = requireFromLedger('firebase-admin/firestore');
  const app = getApps().length > 0 ? getApps()[0] : initializeApp();
  const db = getFirestore(app);

  const result = await backfillHousehold(db, code, { mode });
  console.log(JSON.stringify(result, null, 2));
}
