#!/usr/bin/env node
/**
 * scripts/ledger/rollback.mjs
 *
 * Phase 4: Safe rollback script that projects the latest authoritative ledger
 * state (wallets, heroes profiles, pending approval_requests, inventory) back
 * onto households/{code} and flips ledgerMode back to 'legacy' so ZERO post-cutover
 * earns, purchases, avatar edits, or pending approvals are lost.
 *
 * Usage:
 *   node scripts/ledger/rollback.mjs --code YOURCODE
 */

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { CURRENCIES } from '../../shared/ledger/currencies.js';

const requireFromLedger = createRequire(new URL('../../functions-ledger/package.json', import.meta.url));
const { Timestamp } = requireFromLedger('firebase-admin/firestore');

export async function rollbackHousehold(db, rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
    throw new Error(`Invalid household code: ${rawCode}`);
  }

  const hRef = db.collection('households').doc(code);
  const hSnap = await hRef.get();
  if (!hSnap.exists) {
    throw new Error(`Household ${code} not found`);
  }

  const [walletsSnap, heroesSnap, approvalsSnap, inventorySnap] = await Promise.all([
    hRef.collection('wallets').get(),
    hRef.collection('heroes').get(),
    hRef.collection('approval_requests').where('status', '==', 'pending').get(),
    hRef.collection('inventory').get()
  ]);

  const walletsById = new Map(walletsSnap.docs.map((d) => [d.id, d.data() || {}]));
  const profilesById = new Map(heroesSnap.docs.map((d) => [d.id, d.data() || {}]));
  const inventoryDocs = inventorySnap.docs.map((d) => ({ docId: d.id, ...(d.data() || {}) }));

  const heroIds = Array.from(new Set([...walletsById.keys(), ...profilesById.keys()]));
  const heroes = [];
  const heroesMap = {};
  const mergedFurnitureOwners = {};
  const mergedUnlockedFurniture = new Set();

  for (const heroId of heroIds) {
    const w = walletsById.get(heroId) || {};
    const p = profilesById.get(heroId) || {};
    const balances = w.balances || {};
    const petSparks = w.petSparks || {};
    const petXp = w.petXp || {};

    const heroInv = inventoryDocs.filter(
      (i) => (i.ownerId || i.heroId) === heroId && (Number(i.qty ?? i.quantity ?? 0)) > 0
    );
    const unlockedPetIds = [];
    for (const item of heroInv) {
      if (item.kind === 'pet') unlockedPetIds.push(item.itemId);
      if (item.kind === 'hq_furniture') {
        mergedUnlockedFurniture.add(item.itemId);
        mergedFurnitureOwners[item.itemId] = heroId;
      }
    }

    const activePetId = p.activePetId != null ? String(p.activePetId) : null;
    const activeSparks = activePetId ? (Number(petSparks[activePetId]) || 0) : 0;

    const mergedHero = {
      ...p,
      id: heroId,
      name: p.name || heroId,
      points: Math.max(0, Number(balances[CURRENCIES.GOLD_POINTS]) || 0),
      coins: Math.max(0, Number(balances[CURRENCIES.HABIT_TOKENS]) || 0),
      tokens: Math.max(0, Number(balances[CURRENCIES.HABIT_TOKENS]) || 0),
      xp: Math.max(0, Number(balances[CURRENCIES.HERO_XP]) || 0),
      level: Math.max(1, Number(w.heroLevel ?? w.level) || 1),
      sparks: activeSparks,
      evolutionSparks: activeSparks,
      petSparkMap: { ...petSparks },
      petXpMap: { ...petXp },
      unlockedPetIds: unlockedPetIds.length > 0 ? unlockedPetIds : (p.unlockedPetIds || [])
    };
    heroes.push(mergedHero);
    heroesMap[heroId] = mergedHero;
  }

  const pendingApprovals = approvalsSnap.docs.map((d) => {
    const r = d.data() || {};
    if (r.type === 'reward_redemption') {
      return {
        id: d.id,
        kidId: r.heroId,
        type: 'reward_redemption',
        rewardId: r.rewardId || d.id,
        title: r.title || 'Reward',
        costPoints: Number(r.costPoints) || 0,
        status: 'pending'
      };
    }
    return {
      id: d.id,
      kidId: r.heroId,
      type: 'task_point_approval',
      taskId: r.taskId || r.lockKey || d.id,
      taskTitle: r.title || r.taskId || d.id,
      pendingPoints: Number(r.pendingPoints) || 0,
      tokensAwarded: Number(r.tokensAwarded ?? r.metadata?.legacyAward?.tokensAwarded ?? 0),
      xpAwarded: Number(r.xpAwarded ?? r.metadata?.legacyAward?.xpAwarded ?? 0),
      sparksAwarded: Number(r.sparksAwarded ?? r.metadata?.legacyAward?.sparksAwarded ?? 0),
      status: 'pending'
    };
  });

  const existingData = hSnap.data() || {};
  const existingHQ = existingData.heroHQ && typeof existingData.heroHQ === 'object' ? existingData.heroHQ : {};
  const updatedHQ = {
    ...existingHQ,
    unlockedFurnitureIds: Array.from(new Set([...(existingHQ.unlockedFurnitureIds || []), ...mergedUnlockedFurniture])),
    furnitureOwners: { ...(existingHQ.furnitureOwners || {}), ...mergedFurnitureOwners }
  };

  await hRef.update({
    ledgerMode: 'legacy',
    heroes,
    heroesMap,
    selectedHero: heroes[0] || null,
    pendingApprovals,
    heroHQ: updatedHQ,
    updatedAt: Timestamp.now().toDate().toISOString()
  });

  return {
    code,
    rolledBack: true,
    newLedgerMode: 'legacy',
    heroCount: heroes.length,
    pendingApprovalsCount: pendingApprovals.length
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const codeIdx = args.indexOf('--code');
  const code = codeIdx >= 0 ? args[codeIdx + 1] : process.env.HOUSEHOLD_CODE;

  if (!code) {
    console.error('Usage: node scripts/ledger/rollback.mjs --code <HOUSEHOLD_CODE>');
    process.exit(1);
  }

  const { initializeApp, getApps } = requireFromLedger('firebase-admin/app');
  const { getFirestore } = requireFromLedger('firebase-admin/firestore');
  const app = getApps().length > 0 ? getApps()[0] : initializeApp();
  const db = getFirestore(app);

  const result = await rollbackHousehold(db, code);
  console.log(JSON.stringify(result, null, 2));
}
