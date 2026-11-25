// Pure, storage-agnostic double-entry ledger core.
// Zero Firebase imports; zero floats or division (progression & buff math live in curves.js).
// Shared by the client, backfill script, tests, and (via scripts/sync-ledger-core.mjs) functions-ledger/.

import {
  CURRENCIES,
  COUNTER_ACCOUNTS,
  TRANSACTION_TYPES,
  ONE_TIME_INVENTORY_KINDS,
  PARENT_GRANT_REASONS,
  MEMBER_GRANT_REASONS,
  SPEND_REASONS,
  assertSafeInt,
  assertNonNegInt,
  emptyDelta
} from "./currencies.js";
import {
  HERO_LEVEL_UP_BONUS_TOKENS,
  DEFAULT_HERO_CUM_XP_TABLE,
  heroLevelFromCum,
  heroCumFrom,
  petLevelFromCum,
  applyBuffPercent
} from "./curves.js";
import {
  canonicalTaskId,
  activityTxnId,
  approveTxnId,
  rejectTxnId,
  rewardHoldTxnId,
  rewardCaptureTxnId,
  rewardVoidTxnId,
  purchaseTxnId,
  grantTxnId,
  revokeTxnId,
  consumeTxnId,
  spendTxnId,
  adjustTxnId,
  openWalletTxnId,
  closeWalletTxnId,
  inventoryDocId,
  activityLockDocId
} from "./ids.js";

function cloneWallet(wallet) {
  const w = wallet || {};
  const balances = w.balances || {};
  const held = w.held || {};
  const petsIn = w.pets || {};
  const pets = {};
  for (const [pid, p] of Object.entries(petsIn)) {
    pets[pid] = {
      PET_XP: assertNonNegInt(p?.PET_XP ?? 0, `pets.${pid}.PET_XP`),
      PET_SPARKS: assertNonNegInt(p?.PET_SPARKS ?? 0, `pets.${pid}.PET_SPARKS`),
      level: assertNonNegInt(p?.level ?? 1, `pets.${pid}.level`)
    };
  }
  const countsIn = w.activityCounts || {};
  const activityCounts = {};
  for (const [k, v] of Object.entries(countsIn)) {
    if (v && typeof v === "object") {
      activityCounts[k] = { day: String(v.day || ""), count: assertNonNegInt(v.count ?? 0, `activityCounts.${k}`) };
    }
  }
  const needsRedoIn = w.needsRedo || {};
  const needsRedo = {};
  for (const [k, v] of Object.entries(needsRedoIn)) {
    if (v && typeof v === "object") {
      needsRedo[k] = { ...v };
    }
  }
  return {
    heroId: String(w.heroId || ""),
    version: assertNonNegInt(w.version ?? 0, "wallet.version"),
    lastTxnId: w.lastTxnId || null,
    updatedAt: w.updatedAt || null,
    archived: Boolean(w.archived),
    balances: {
      GOLD_POINTS: assertNonNegInt(balances.GOLD_POINTS ?? 0, "balances.GOLD_POINTS"),
      HABIT_TOKENS: assertNonNegInt(balances.HABIT_TOKENS ?? 0, "balances.HABIT_TOKENS"),
      HERO_XP: assertNonNegInt(balances.HERO_XP ?? 0, "balances.HERO_XP")
    },
    held: {
      GOLD_POINTS: assertNonNegInt(held.GOLD_POINTS ?? 0, "held.GOLD_POINTS")
    },
    heroLevel: assertNonNegInt(w.heroLevel ?? 1, "wallet.heroLevel"),
    pets,
    activityCounts,
    needsRedo
  };
}

function ensurePetEntry(wallet, petId) {
  const pid = String(petId);
  if (!wallet.pets[pid]) {
    wallet.pets[pid] = { PET_XP: 0, PET_SPARKS: 0, level: 1 };
  }
  return wallet.pets[pid];
}

function fail(error) {
  return { error };
}

function buildTxnDoc({
  txnId,
  type,
  heroId,
  petId = null,
  delta,
  heldDelta = null,
  counterAccount,
  levelBefore,
  levelAfter,
  petLevelBefore = null,
  petLevelAfter = null,
  refs = {},
  metadata = null,
  actor,
  walletVersionBefore,
  walletVersionAfter,
  now
}) {
  const cleanDelta = emptyDelta();
  for (const key of Object.keys(cleanDelta)) {
    cleanDelta[key] = assertSafeInt(delta?.[key] ?? 0, `delta.${key}`);
  }
  const doc = {
    txnId,
    type,
    heroId,
    delta: cleanDelta,
    counterAccount,
    levelBefore: assertNonNegInt(levelBefore, "levelBefore"),
    levelAfter: assertNonNegInt(levelAfter, "levelAfter"),
    refs: { ...refs },
    actor: {
      uid: String(actor?.uid || "system"),
      deviceId: String(actor?.deviceId || "server"),
      role: String(actor?.role || "device")
    },
    walletVersionBefore: assertNonNegInt(walletVersionBefore, "walletVersionBefore"),
    walletVersionAfter: assertNonNegInt(walletVersionAfter, "walletVersionAfter"),
    createdAt: now
  };
  if (petId !== null && petId !== undefined) {
    doc.petId = String(petId);
    if (petLevelBefore !== null) doc.petLevelBefore = assertNonNegInt(petLevelBefore, "petLevelBefore");
    if (petLevelAfter !== null) doc.petLevelAfter = assertNonNegInt(petLevelAfter, "petLevelAfter");
  }
  if (heldDelta) {
    doc.heldDelta = {
      GOLD_POINTS: assertSafeInt(heldDelta.GOLD_POINTS ?? 0, "heldDelta.GOLD_POINTS")
    };
  }
  if (metadata && Object.keys(metadata).length > 0) {
    doc.metadata = metadata;
  }
  return doc;
}

/**
 * Compute double-entry postings for audit/reconciliation verification.
 * Every nonzero kid-side delta is paired with the exact opposite amount on counterAccount,
 * so sum(kid) + sum(counterAccount) === 0 for every currency.
 */
export function postingsForTxn(txnDoc) {
  const postings = [];
  for (const [currency, amount] of Object.entries(txnDoc.delta || {})) {
    if (amount === 0) continue;
    postings.push({ account: `kid:${txnDoc.heroId}`, currency, amount });
    postings.push({ account: `sys:${txnDoc.counterAccount}`, currency, amount: -amount });
  }
  return postings;
}

function planOpenWallet(inputs) {
  const { heroId, starting = {}, curves = DEFAULT_HERO_CUM_XP_TABLE, now, actor } = inputs;
  if (!heroId) return fail("heroId is required");
  const points = assertNonNegInt(starting.points ?? 0, "starting.points");
  const tokens = assertNonNegInt(starting.coins ?? starting.tokens ?? 0, "starting.tokens");
  const startLevel = assertNonNegInt(starting.level ?? 1, "starting.level");
  const startXpIntoLevel = assertNonNegInt(starting.xp ?? 0, "starting.xp");
  const cumXp = starting.heroCumXp !== undefined
    ? assertNonNegInt(starting.heroCumXp, "starting.heroCumXp")
    : heroCumFrom(Math.max(1, startLevel), startXpIntoLevel, curves);
  const { level } = heroLevelFromCum(cumXp, curves);

  const txnId = inputs.txnId || openWalletTxnId(heroId);
  const delta = emptyDelta();
  delta.GOLD_POINTS = points;
  delta.HABIT_TOKENS = tokens;
  delta.HERO_XP = cumXp;

  const walletAfter = cloneWallet({
    heroId,
    version: 1,
    lastTxnId: txnId,
    updatedAt: now,
    balances: {
      GOLD_POINTS: points,
      HABIT_TOKENS: tokens,
      HERO_XP: cumXp
    },
    held: { GOLD_POINTS: 0 },
    heroLevel: level,
    pets: {},
    activityCounts: {},
    needsRedo: {}
  });

  const txnDoc = buildTxnDoc({
    txnId,
    type: TRANSACTION_TYPES.OPENING_BALANCE,
    heroId,
    delta,
    counterAccount: COUNTER_ACCOUNTS.OPENING_BALANCE,
    levelBefore: 1,
    levelAfter: level,
    actor,
    walletVersionBefore: 0,
    walletVersionAfter: 1,
    now
  });

  return { txnDoc, walletAfter, extraWrites: [] };
}

function planCloseWallet(inputs) {
  const { wallet, clientUuid, now, actor } = inputs;
  if (!wallet) return fail("wallet is required");
  if (wallet.archived) return fail("wallet is already archived");
  const w = cloneWallet(wallet);
  const txnId = inputs.txnId || closeWalletTxnId(w.heroId, clientUuid || "close");

  const delta = emptyDelta();
  delta.GOLD_POINTS = -w.balances.GOLD_POINTS;
  delta.HABIT_TOKENS = -w.balances.HABIT_TOKENS;
  delta.HERO_XP = -w.balances.HERO_XP;

  const heldDelta = w.held.GOLD_POINTS > 0 ? { GOLD_POINTS: -w.held.GOLD_POINTS } : null;
  const levelBefore = w.heroLevel;

  w.balances.GOLD_POINTS = 0;
  w.balances.HABIT_TOKENS = 0;
  w.balances.HERO_XP = 0;
  w.held.GOLD_POINTS = 0;
  w.heroLevel = 1;
  w.archived = true;
  w.version += 1;
  w.lastTxnId = txnId;
  w.updatedAt = now;

  const txnDoc = buildTxnDoc({
    txnId,
    type: TRANSACTION_TYPES.PARENT_ADJUSTMENT,
    heroId: w.heroId,
    delta,
    heldDelta,
    counterAccount: COUNTER_ACCOUNTS.ADJUSTMENT,
    levelBefore,
    levelAfter: 1,
    metadata: { memo: "closeWallet" },
    actor,
    walletVersionBefore: wallet.version ?? 0,
    walletVersionAfter: w.version,
    now
  });

  return { txnDoc, walletAfter: w, extraWrites: [] };
}

function planRecordActivity(inputs) {
  const {
    wallet,
    rule,
    activityType,
    activityId,
    cycleId,
    petId = null,
    buffPercentTokens = 0,
    buffPercentXp = 0,
    day,
    title = "",
    existingLock = null,
    curves = DEFAULT_HERO_CUM_XP_TABLE,
    now,
    actor
  } = inputs;

  if (!wallet) return fail("wallet is required");
  if (wallet.archived) return fail("wallet is archived");
  if (!rule) return fail(`missing reward_rules for ${activityType}:${activityId || ""}`);
  if (!day) return fail("household local day (YYYY-MM-DD) is required");

  const w = cloneWallet(wallet);
  const maxBuff = assertNonNegInt(rule.maxBuffPercent ?? 50, "rule.maxBuffPercent");
  const dailyCap = assertNonNegInt(rule.dailyCap ?? 20, "rule.dailyCap");

  // Check daily cap in household timezone
  const prevCountEntry = w.activityCounts[activityType];
  const prevCount = prevCountEntry && prevCountEntry.day === day ? prevCountEntry.count : 0;
  if (dailyCap > 0 && prevCount >= dailyCap) {
    return fail(`daily cap reached for ${activityType} (${dailyCap}/day)`);
  }

  const baseTokens = assertNonNegInt(rule.tokens ?? 0, "rule.tokens");
  const baseXp = assertNonNegInt(rule.xp ?? 0, "rule.xp");
  const baseSparks = assertNonNegInt(rule.sparks ?? 0, "rule.sparks");
  const basePetXp = assertNonNegInt(rule.petXp ?? 0, "rule.petXp");
  const pendingPoints = assertNonNegInt(rule.points ?? 0, "rule.points");
  const approvalGated = Boolean(rule.approvalGated || pendingPoints > 0);

  const lockKey = approvalGated ? canonicalTaskId(activityId || activityType) : null;
  if (approvalGated && existingLock) {
    return fail(`activity already pending approval: ${lockKey}`);
  }

  let awardedTokens;
  let awardedXp;
  try {
    awardedTokens = applyBuffPercent(baseTokens, assertNonNegInt(buffPercentTokens, "buffPercentTokens"), maxBuff);
    awardedXp = applyBuffPercent(baseXp, assertNonNegInt(buffPercentXp, "buffPercentXp"), maxBuff);
  } catch (err) {
    return fail(err.message);
  }

  // Pet Sparks always pay 2x sparks as Pet XP in the same transaction (section 3.5)
  const totalPetXp = basePetXp + (baseSparks * 2);
  if ((baseSparks > 0 || totalPetXp > 0) && (petId === null || petId === undefined || String(petId) === "")) {
    return fail("petId is required when activity awards Pet Sparks or Pet XP");
  }

  const levelBefore = w.heroLevel;
  const newHeroXp = w.balances.HERO_XP + awardedXp;
  const heroAfter = heroLevelFromCum(newHeroXp, curves);
  const levelsCrossed = Math.max(0, heroAfter.level - levelBefore);
  const levelUpBonusTokens = levelsCrossed * HERO_LEVEL_UP_BONUS_TOKENS;

  const delta = emptyDelta();
  delta.HABIT_TOKENS = awardedTokens + levelUpBonusTokens;
  delta.HERO_XP = awardedXp;
  delta.PET_SPARKS = baseSparks;
  delta.PET_XP = totalPetXp;

  w.balances.HABIT_TOKENS += delta.HABIT_TOKENS;
  w.balances.HERO_XP = newHeroXp;
  w.heroLevel = heroAfter.level;

  let petLevelBefore = null;
  let petLevelAfter = null;
  if (petId !== null && petId !== undefined && String(petId) !== "") {
    const pet = ensurePetEntry(w, petId);
    petLevelBefore = pet.level;
    pet.PET_SPARKS += baseSparks;
    pet.PET_XP += totalPetXp;
    const petAfter = petLevelFromCum(pet.PET_XP);
    pet.level = petAfter.level;
    petLevelAfter = pet.level;
  }

  w.activityCounts[activityType] = { day, count: prevCount + 1 };
  if (lockKey && w.needsRedo[lockKey]) {
    delete w.needsRedo[lockKey];
  }

  const txnId = inputs.txnId || activityTxnId(w.heroId, activityType, activityId || activityType, cycleId);
  w.version += 1;
  w.lastTxnId = txnId;
  w.updatedAt = now;

  const extraWrites = [];
  let requestId = null;
  if (approvalGated) {
    requestId = inputs.requestId || `req_${txnId}`;
    extraWrites.push({
      collection: "approval_requests",
      docId: requestId,
      op: "set",
      data: {
        requestId,
        kind: "task_points",
        heroId: w.heroId,
        taskId: String(activityId || activityType),
        lockKey,
        title: title || String(activityId || activityType),
        amount: pendingPoints,
        earnTxnId: txnId,
        cycleId: String(cycleId),
        status: "pending",
        createdBy: String(actor?.uid || "device"),
        createdAt: now
      }
    });
    extraWrites.push({
      collection: "activity_locks",
      docId: activityLockDocId(w.heroId, lockKey),
      op: "set",
      data: {
        heroId: w.heroId,
        taskId: String(activityId || activityType),
        lockKey,
        cycleId: String(cycleId),
        requestId,
        earnTxnId: txnId,
        status: "pending",
        createdAt: now
      }
    });
  }

  const txnDoc = buildTxnDoc({
    txnId,
    type: TRANSACTION_TYPES.EARN_ACTIVITY,
    heroId: w.heroId,
    petId: petId !== null && petId !== undefined && String(petId) !== "" ? String(petId) : null,
    delta,
    counterAccount: COUNTER_ACCOUNTS.TREASURY_MINT,
    levelBefore,
    levelAfter: heroAfter.level,
    petLevelBefore,
    petLevelAfter,
    refs: {
      activityType,
      activityId: String(activityId || activityType),
      ...(requestId ? { requestId } : {})
    },
    metadata: levelUpBonusTokens > 0 ? { levelsCrossed, levelUpBonusTokens } : null,
    actor,
    walletVersionBefore: wallet.version ?? 0,
    walletVersionAfter: w.version,
    now
  });

  return { txnDoc, walletAfter: w, extraWrites };
}

function planApproveTaskPoints(inputs) {
  const { wallet, request, now, actor } = inputs;
  if (!wallet) return fail("wallet is required");
  if (!request) return fail("approval request is required");
  if (request.kind !== "task_points") return fail("request is not task_points");
  if (request.status !== "pending") return fail(`request is not pending (${request.status})`);
  if (request.heroId !== wallet.heroId) return fail("request heroId does not match wallet");

  const w = cloneWallet(wallet);
  const amount = assertNonNegInt(request.amount ?? 0, "request.amount");
  const txnId = inputs.txnId || approveTxnId(request.requestId);

  const delta = emptyDelta();
  delta.GOLD_POINTS = amount;

  w.balances.GOLD_POINTS += amount;
  w.version += 1;
  w.lastTxnId = txnId;
  w.updatedAt = now;

  const lockKey = request.lockKey || canonicalTaskId(request.taskId);
  const extraWrites = [
    {
      collection: "approval_requests",
      docId: request.requestId,
      op: "set",
      data: {
        ...request,
        status: "approved",
        resolvedBy: String(actor?.uid || "parent"),
        resolvedAt: now
      }
    }
  ];
  if (lockKey) {
    extraWrites.push({
      collection: "activity_locks",
      docId: activityLockDocId(w.heroId, lockKey),
      op: "delete"
    });
  }

  const txnDoc = buildTxnDoc({
    txnId,
    type: TRANSACTION_TYPES.APPROVE_TASK_POINTS,
    heroId: w.heroId,
    delta,
    counterAccount: COUNTER_ACCOUNTS.TREASURY_MINT,
    levelBefore: w.heroLevel,
    levelAfter: w.heroLevel,
    refs: { requestId: request.requestId, activityId: request.taskId },
    actor,
    walletVersionBefore: wallet.version ?? 0,
    walletVersionAfter: w.version,
    now
  });

  return { txnDoc, walletAfter: w, extraWrites };
}

function planRejectTask(inputs) {
  const { wallet, request, earnTxn, curves = DEFAULT_HERO_CUM_XP_TABLE, now, actor } = inputs;
  if (!wallet) return fail("wallet is required");
  if (!request) return fail("approval request is required");
  if (request.kind !== "task_points") return fail("request is not task_points");
  if (request.status !== "pending") return fail(`request is not pending (${request.status})`);
  if (request.heroId !== wallet.heroId) return fail("request heroId does not match wallet");

  const w = cloneWallet(wallet);
  const txnId = inputs.txnId || rejectTxnId(request.requestId);

  // Support both live earnTxn.delta and backfilled earnTxn.metadata.legacyAward
  const legacyAward = earnTxn?.metadata?.legacyAward;
  const origTokens = assertNonNegInt(legacyAward ? (legacyAward.HABIT_TOKENS ?? 0) : Math.max(0, earnTxn?.delta?.HABIT_TOKENS ?? 0), "origTokens");
  const origHeroXp = assertNonNegInt(legacyAward ? (legacyAward.HERO_XP ?? 0) : Math.max(0, earnTxn?.delta?.HERO_XP ?? 0), "origHeroXp");
  const origPetSparks = assertNonNegInt(legacyAward ? (legacyAward.PET_SPARKS ?? 0) : Math.max(0, earnTxn?.delta?.PET_SPARKS ?? 0), "origPetSparks");
  const origPetXp = assertNonNegInt(legacyAward ? (legacyAward.PET_XP ?? 0) : Math.max(0, earnTxn?.delta?.PET_XP ?? 0), "origPetXp");

  // Strict non-negative invariant (clamped at 0, never negative)
  const deductTokens = Math.min(w.balances.HABIT_TOKENS, origTokens);
  const deductHeroXp = Math.min(w.balances.HERO_XP, origHeroXp);

  const clampedShortfall = {};
  if (deductTokens < origTokens) clampedShortfall.HABIT_TOKENS = origTokens - deductTokens;
  if (deductHeroXp < origHeroXp) clampedShortfall.HERO_XP = origHeroXp - deductHeroXp;

  const levelBefore = w.heroLevel;
  w.balances.HABIT_TOKENS -= deductTokens;
  w.balances.HERO_XP -= deductHeroXp;
  const heroAfter = heroLevelFromCum(w.balances.HERO_XP, curves);
  w.heroLevel = heroAfter.level;

  let deductPetSparks = 0;
  let deductPetXp = 0;
  let petLevelBefore = null;
  let petLevelAfter = null;
  const petId = earnTxn?.petId ?? null;
  if (petId !== null && petId !== undefined && (origPetSparks > 0 || origPetXp > 0)) {
    const pet = ensurePetEntry(w, petId);
    petLevelBefore = pet.level;
    deductPetSparks = Math.min(pet.PET_SPARKS, origPetSparks);
    deductPetXp = Math.min(pet.PET_XP, origPetXp);
    if (deductPetSparks < origPetSparks) clampedShortfall.PET_SPARKS = origPetSparks - deductPetSparks;
    if (deductPetXp < origPetXp) clampedShortfall.PET_XP = origPetXp - deductPetXp;
    pet.PET_SPARKS -= deductPetSparks;
    pet.PET_XP -= deductPetXp;
    pet.level = petLevelFromCum(pet.PET_XP).level;
    petLevelAfter = pet.level;
  }

  const delta = emptyDelta();
  delta.HABIT_TOKENS = -deductTokens;
  delta.HERO_XP = -deductHeroXp;
  delta.PET_SPARKS = -deductPetSparks;
  delta.PET_XP = -deductPetXp;

  const lockKey = request.lockKey || canonicalTaskId(request.taskId);
  if (lockKey) {
    w.needsRedo[lockKey] = { requestId: request.requestId, rejectedAt: now };
  }

  w.version += 1;
  w.lastTxnId = txnId;
  w.updatedAt = now;

  const extraWrites = [
    {
      collection: "approval_requests",
      docId: request.requestId,
      op: "set",
      data: {
        ...request,
        status: "rejected",
        resolvedBy: String(actor?.uid || "parent"),
        resolvedAt: now
      }
    }
  ];
  if (lockKey) {
    extraWrites.push({
      collection: "activity_locks",
      docId: activityLockDocId(w.heroId, lockKey),
      op: "delete"
    });
  }

  const metadata = Object.keys(clampedShortfall).length > 0 ? { clampedShortfall } : null;
  const txnDoc = buildTxnDoc({
    txnId,
    type: TRANSACTION_TYPES.REJECT_TASK_CLAWBACK,
    heroId: w.heroId,
    petId,
    delta,
    counterAccount: COUNTER_ACCOUNTS.CLAWBACK,
    levelBefore,
    levelAfter: w.heroLevel,
    petLevelBefore,
    petLevelAfter,
    refs: {
      requestId: request.requestId,
      activityId: request.taskId,
      reversesTxnId: request.earnTxnId || earnTxn?.txnId || null
    },
    metadata,
    actor,
    walletVersionBefore: wallet.version ?? 0,
    walletVersionAfter: w.version,
    now
  });

  return { txnDoc, walletAfter: w, extraWrites };
}

function planRequestReward(inputs) {
  const { wallet, catalogItem, requestId, now, actor } = inputs;
  if (!wallet) return fail("wallet is required");
  if (wallet.archived) return fail("wallet is archived");
  if (!catalogItem || catalogItem.kind !== "reward" || catalogItem.active === false) {
    return fail("reward catalog item not found or inactive");
  }
  if (!requestId) return fail("requestId is required");

  const w = cloneWallet(wallet);
  const cost = assertNonNegInt(catalogItem.costPoints ?? 0, "catalogItem.costPoints");
  if (cost <= 0) return fail("reward costPoints must be > 0");

  const available = w.balances.GOLD_POINTS - w.held.GOLD_POINTS;
  if (available < cost) {
    return fail(`Not enough Gold Points (need ${cost}, available ${available})`);
  }

  const txnId = inputs.txnId || rewardHoldTxnId(requestId);
  w.held.GOLD_POINTS += cost;
  w.version += 1;
  w.lastTxnId = txnId;
  w.updatedAt = now;

  const extraWrites = [
    {
      collection: "holds",
      docId: requestId,
      op: "set",
      data: {
        requestId,
        heroId: w.heroId,
        amount: cost,
        status: "authorized",
        createdAt: now,
        updatedAt: now
      }
    },
    {
      collection: "approval_requests",
      docId: requestId,
      op: "set",
      data: {
        requestId,
        kind: "reward",
        heroId: w.heroId,
        rewardId: catalogItem.itemId,
        title: catalogItem.title || catalogItem.itemId,
        amount: cost,
        status: "pending",
        createdBy: String(actor?.uid || "device"),
        createdAt: now
      }
    }
  ];

  // Hold changes live in heldDelta so delta stays strictly zero-sum with counterAccount
  const txnDoc = buildTxnDoc({
    txnId,
    type: TRANSACTION_TYPES.REWARD_REQUEST_HOLD,
    heroId: w.heroId,
    delta: emptyDelta(),
    heldDelta: { GOLD_POINTS: cost },
    counterAccount: COUNTER_ACCOUNTS.REWARD_REDEMPTION_SINK,
    levelBefore: w.heroLevel,
    levelAfter: w.heroLevel,
    refs: { requestId, itemId: catalogItem.itemId },
    actor,
    walletVersionBefore: wallet.version ?? 0,
    walletVersionAfter: w.version,
    now
  });

  return { txnDoc, walletAfter: w, extraWrites };
}

function planApproveReward(inputs) {
  const { wallet, hold, request, now, actor } = inputs;
  if (!wallet) return fail("wallet is required");
  if (!hold) return fail("hold is required");
  if (!request) return fail("request is required");
  if (hold.status !== "authorized") return fail(`hold is not authorized (${hold.status})`);
  if (request.status !== "pending") return fail(`request is not pending (${request.status})`);
  if (hold.heroId !== wallet.heroId) return fail("hold heroId mismatch");

  const w = cloneWallet(wallet);
  const amount = assertNonNegInt(hold.amount, "hold.amount");
  if (w.balances.GOLD_POINTS < amount || w.held.GOLD_POINTS < amount) {
    return fail("insufficient balance or held amount to capture hold");
  }

  const txnId = inputs.txnId || rewardCaptureTxnId(hold.requestId);
  const delta = emptyDelta();
  delta.GOLD_POINTS = -amount;

  w.balances.GOLD_POINTS -= amount;
  w.held.GOLD_POINTS -= amount;
  w.version += 1;
  w.lastTxnId = txnId;
  w.updatedAt = now;

  const extraWrites = [
    {
      collection: "holds",
      docId: hold.requestId,
      op: "set",
      data: { ...hold, status: "captured", updatedAt: now }
    },
    {
      collection: "approval_requests",
      docId: request.requestId,
      op: "set",
      data: {
        ...request,
        status: "approved",
        resolvedBy: String(actor?.uid || "parent"),
        resolvedAt: now
      }
    }
  ];

  const txnDoc = buildTxnDoc({
    txnId,
    type: TRANSACTION_TYPES.REWARD_APPROVE_CAPTURE,
    heroId: w.heroId,
    delta,
    heldDelta: { GOLD_POINTS: -amount },
    counterAccount: COUNTER_ACCOUNTS.REWARD_REDEMPTION_SINK,
    levelBefore: w.heroLevel,
    levelAfter: w.heroLevel,
    refs: { requestId: request.requestId, itemId: request.rewardId },
    actor,
    walletVersionBefore: wallet.version ?? 0,
    walletVersionAfter: w.version,
    now
  });

  return { txnDoc, walletAfter: w, extraWrites };
}

function planRejectReward(inputs) {
  const { wallet, hold, request, now, actor } = inputs;
  if (!wallet) return fail("wallet is required");
  if (!hold) return fail("hold is required");
  if (!request) return fail("request is required");
  if (hold.status !== "authorized") return fail(`hold is not authorized (${hold.status})`);
  if (request.status !== "pending") return fail(`request is not pending (${request.status})`);
  if (hold.heroId !== wallet.heroId) return fail("hold heroId mismatch");

  const w = cloneWallet(wallet);
  const amount = assertNonNegInt(hold.amount, "hold.amount");
  if (w.held.GOLD_POINTS < amount) {
    return fail("held amount smaller than hold record");
  }

  const txnId = inputs.txnId || rewardVoidTxnId(hold.requestId);
  w.held.GOLD_POINTS -= amount;
  w.version += 1;
  w.lastTxnId = txnId;
  w.updatedAt = now;

  const extraWrites = [
    {
      collection: "holds",
      docId: hold.requestId,
      op: "set",
      data: { ...hold, status: "voided", updatedAt: now }
    },
    {
      collection: "approval_requests",
      docId: request.requestId,
      op: "set",
      data: {
        ...request,
        status: "rejected",
        resolvedBy: String(actor?.uid || "parent"),
        resolvedAt: now
      }
    }
  ];

  const txnDoc = buildTxnDoc({
    txnId,
    type: TRANSACTION_TYPES.REWARD_REJECT_VOID,
    heroId: w.heroId,
    delta: emptyDelta(),
    heldDelta: { GOLD_POINTS: -amount },
    counterAccount: COUNTER_ACCOUNTS.REWARD_REDEMPTION_SINK,
    levelBefore: w.heroLevel,
    levelAfter: w.heroLevel,
    refs: { requestId: request.requestId, itemId: request.rewardId },
    actor,
    walletVersionBefore: wallet.version ?? 0,
    walletVersionAfter: w.version,
    now
  });

  return { txnDoc, walletAfter: w, extraWrites };
}

function planPurchase(inputs) {
  const {
    wallet,
    catalogItem,
    existingInventory = null,
    petId = null,
    ownedPetCount = 0,
    extraHabitatSlots = 0,
    clientUuid,
    now,
    actor
  } = inputs;

  if (!wallet) return fail("wallet is required");
  if (wallet.archived) return fail("wallet is archived");
  if (!catalogItem || catalogItem.active === false) return fail("catalog item not found or inactive");
  if (catalogItem.kind === "reward") return fail("use requestReward for Gold Point rewards");
  if (!clientUuid) return fail("clientUuid is required");

  const w = cloneWallet(wallet);
  const costCoins = assertNonNegInt(catalogItem.costCoins ?? 0, "catalogItem.costCoins");
  const costSparks = assertNonNegInt(catalogItem.costSparks ?? 0, "catalogItem.costSparks");
  if (costCoins === 0 && costSparks === 0) {
    return fail("purchase requires positive costCoins or costSparks (use grantItem for free items)");
  }

  if (ONE_TIME_INVENTORY_KINDS.has(catalogItem.kind) && existingInventory && (existingInventory.qty ?? 0) > 0) {
    return fail(`already owns one-time item: ${catalogItem.itemId}`);
  }
  if (catalogItem.kind === "pet") {
    const maxPets = 1 + assertNonNegInt(extraHabitatSlots, "extraHabitatSlots");
    if (assertNonNegInt(ownedPetCount, "ownedPetCount") >= maxPets) {
      return fail(`habitat slot limit reached (${ownedPetCount}/${maxPets})`);
    }
  }

  if (w.balances.HABIT_TOKENS < costCoins) {
    return fail(`Not enough Habit Tokens (need ${costCoins}, have ${w.balances.HABIT_TOKENS})`);
  }

  let petLevelBefore = null;
  let petLevelAfter = null;
  if (costSparks > 0) {
    if (petId === null || petId === undefined || String(petId) === "") {
      return fail("petId is required for Pet Sparks purchase");
    }
    const pet = ensurePetEntry(w, petId);
    if (pet.PET_SPARKS < costSparks) {
      return fail(`Not enough Pet Sparks (need ${costSparks}, have ${pet.PET_SPARKS})`);
    }
    petLevelBefore = pet.level;
    pet.PET_SPARKS -= costSparks;
    petLevelAfter = pet.level;
  }

  w.balances.HABIT_TOKENS -= costCoins;

  const txnId = inputs.txnId || purchaseTxnId(w.heroId, catalogItem.itemId, clientUuid);
  w.version += 1;
  w.lastTxnId = txnId;
  w.updatedAt = now;

  const delta = emptyDelta();
  delta.HABIT_TOKENS = -costCoins;
  delta.PET_SPARKS = -costSparks;

  const extraWrites = [];
  if (catalogItem.kind !== "fee") {
    const prevQty = assertNonNegInt(existingInventory?.qty ?? 0, "existingInventory.qty");
    const servingsPerPurchase = assertNonNegInt(catalogItem.servingsPerPurchase ?? 0, "servingsPerPurchase");
    const invData = {
      ownerId: w.heroId,
      itemId: catalogItem.itemId,
      kind: catalogItem.kind,
      qty: prevQty + 1,
      lastTxnId: txnId,
      updatedAt: now
    };
    if (servingsPerPurchase > 0 || existingInventory?.servingsRemaining !== undefined) {
      const prevServings = assertNonNegInt(existingInventory?.servingsRemaining ?? 0, "servingsRemaining");
      invData.servingsRemaining = prevServings + (servingsPerPurchase || 1);
    }
    extraWrites.push({
      collection: "inventory",
      docId: inventoryDocId(w.heroId, catalogItem.itemId),
      op: "set",
      data: invData
    });
  }

  const txnDoc = buildTxnDoc({
    txnId,
    type: TRANSACTION_TYPES.SHOP_PURCHASE,
    heroId: w.heroId,
    petId: costSparks > 0 ? String(petId) : null,
    delta,
    counterAccount: costSparks > 0 && costCoins === 0 ? COUNTER_ACCOUNTS.SPARK_SINK : COUNTER_ACCOUNTS.SHOP_SINK,
    levelBefore: w.heroLevel,
    levelAfter: w.heroLevel,
    petLevelBefore,
    petLevelAfter,
    refs: { itemId: catalogItem.itemId },
    actor,
    walletVersionBefore: wallet.version ?? 0,
    walletVersionAfter: w.version,
    now
  });

  return { txnDoc, walletAfter: w, extraWrites };
}

function planGrantItem(inputs) {
  const {
    wallet,
    itemId,
    kind,
    reason,
    catalogItem = null,
    existingInventory = null,
    eggInventory = null,
    ownedPetCount = 0,
    extraHabitatSlots = 0,
    isParentSession = false,
    uniqueSuffix = "",
    now,
    actor
  } = inputs;

  if (!wallet) return fail("wallet is required");
  if (!itemId || !kind) return fail("itemId and kind are required");

  const isParentReason = PARENT_GRANT_REASONS.has(reason);
  const isMemberReason = MEMBER_GRANT_REASONS.has(reason);
  if (!isParentReason && !isMemberReason) {
    return fail(`invalid grantItem reason: ${reason}`);
  }
  if (isParentReason && !isParentSession) {
    return fail(`parent session required for grantItem reason: ${reason}`);
  }
  if (isMemberReason && catalogItem && ((catalogItem.costCoins ?? 0) > 0 || (catalogItem.costSparks ?? 0) > 0 || (catalogItem.costPoints ?? 0) > 0)) {
    return fail("member grantItem cannot grant paid catalog items");
  }
  if (ONE_TIME_INVENTORY_KINDS.has(kind) && existingInventory && (existingInventory.qty ?? 0) > 0) {
    return fail(`already owns one-time item: ${itemId}`);
  }
  if (kind === "pet" && !isParentReason && reason !== "starter_pet") {
    const maxPets = 1 + assertNonNegInt(extraHabitatSlots, "extraHabitatSlots");
    if (assertNonNegInt(ownedPetCount, "ownedPetCount") >= maxPets) {
      return fail(`habitat slot limit reached (${ownedPetCount}/${maxPets})`);
    }
  }
  if (reason === "starter_pet" && ownedPetCount > 0 && !inputs.allowAdditionalStarterSlot) {
    return fail("starter_pet already claimed");
  }
  if (reason === "egg_hatch") {
    if (!eggInventory || (eggInventory.qty ?? 0) <= 0) {
      return fail("no unhatched egg available to hatch");
    }
  }

  const w = cloneWallet(wallet);
  const txnId = inputs.txnId || grantTxnId(w.heroId, itemId, uniqueSuffix);
  w.version += 1;
  w.lastTxnId = txnId;
  w.updatedAt = now;

  const prevQty = assertNonNegInt(existingInventory?.qty ?? 0, "existingInventory.qty");
  const invData = {
    ownerId: w.heroId,
    itemId,
    kind,
    qty: prevQty + 1,
    lastTxnId: txnId,
    updatedAt: now
  };
  if (catalogItem?.servingsPerPurchase) {
    const prevServings = assertNonNegInt(existingInventory?.servingsRemaining ?? 0, "servingsRemaining");
    invData.servingsRemaining = prevServings + assertNonNegInt(catalogItem.servingsPerPurchase, "servingsPerPurchase");
  }

  const extraWrites = [
    {
      collection: "inventory",
      docId: inventoryDocId(w.heroId, itemId),
      op: "set",
      data: invData
    }
  ];

  if (reason === "egg_hatch" && eggInventory) {
    const nextEggQty = eggInventory.qty - 1;
    if (nextEggQty <= 0) {
      extraWrites.push({
        collection: "inventory",
        docId: inventoryDocId(w.heroId, eggInventory.itemId),
        op: "delete"
      });
    } else {
      extraWrites.push({
        collection: "inventory",
        docId: inventoryDocId(w.heroId, eggInventory.itemId),
        op: "set",
        data: { ...eggInventory, qty: nextEggQty, lastTxnId: txnId, updatedAt: now }
      });
    }
  }

  const txnDoc = buildTxnDoc({
    txnId,
    type: TRANSACTION_TYPES.GIFT_GRANT,
    heroId: w.heroId,
    delta: emptyDelta(),
    counterAccount: COUNTER_ACCOUNTS.TREASURY_MINT,
    levelBefore: w.heroLevel,
    levelAfter: w.heroLevel,
    refs: { itemId },
    metadata: { reason },
    actor,
    walletVersionBefore: wallet.version ?? 0,
    walletVersionAfter: w.version,
    now
  });

  return { txnDoc, walletAfter: w, extraWrites };
}

function planRevokeItem(inputs) {
  const { wallet, existingInventory, qty = 1, clientUuid, now, actor } = inputs;
  if (!wallet) return fail("wallet is required");
  if (!existingInventory || (existingInventory.qty ?? 0) <= 0) return fail("inventory item not owned");
  const removeQty = assertNonNegInt(qty, "qty");
  if (removeQty <= 0) return fail("qty must be > 0");

  const w = cloneWallet(wallet);
  const txnId = inputs.txnId || revokeTxnId(w.heroId, existingInventory.itemId, clientUuid || "revoke");
  w.version += 1;
  w.lastTxnId = txnId;
  w.updatedAt = now;

  const nextQty = Math.max(0, existingInventory.qty - removeQty);
  const extraWrites = [
    nextQty === 0
      ? { collection: "inventory", docId: inventoryDocId(w.heroId, existingInventory.itemId), op: "delete" }
      : {
          collection: "inventory",
          docId: inventoryDocId(w.heroId, existingInventory.itemId),
          op: "set",
          data: { ...existingInventory, qty: nextQty, lastTxnId: txnId, updatedAt: now }
        }
  ];

  const txnDoc = buildTxnDoc({
    txnId,
    type: TRANSACTION_TYPES.ITEM_REVOKE,
    heroId: w.heroId,
    delta: emptyDelta(),
    counterAccount: COUNTER_ACCOUNTS.ADJUSTMENT,
    levelBefore: w.heroLevel,
    levelAfter: w.heroLevel,
    refs: { itemId: existingInventory.itemId },
    actor,
    walletVersionBefore: wallet.version ?? 0,
    walletVersionAfter: w.version,
    now
  });

  return { txnDoc, walletAfter: w, extraWrites };
}

function planConsume(inputs) {
  const { wallet, existingInventory, clientUuid, now, actor } = inputs;
  if (!wallet) return fail("wallet is required");
  if (!existingInventory) return fail("consumable inventory item not found");
  const prevServings = assertNonNegInt(existingInventory.servingsRemaining ?? existingInventory.qty ?? 0, "servingsRemaining");
  if (prevServings < 1) return fail("no servings remaining");

  const w = cloneWallet(wallet);
  const txnId = inputs.txnId || consumeTxnId(w.heroId, existingInventory.itemId, clientUuid || "consume");
  w.version += 1;
  w.lastTxnId = txnId;
  w.updatedAt = now;

  const nextServings = prevServings - 1;
  const extraWrites = [
    {
      collection: "inventory",
      docId: inventoryDocId(w.heroId, existingInventory.itemId),
      op: "set",
      data: {
        ...existingInventory,
        servingsRemaining: nextServings,
        lastTxnId: txnId,
        updatedAt: now
      }
    }
  ];

  const txnDoc = buildTxnDoc({
    txnId,
    type: TRANSACTION_TYPES.CONSUME,
    heroId: w.heroId,
    delta: emptyDelta(),
    counterAccount: COUNTER_ACCOUNTS.SHOP_SINK,
    levelBefore: w.heroLevel,
    levelAfter: w.heroLevel,
    refs: { itemId: existingInventory.itemId },
    actor,
    walletVersionBefore: wallet.version ?? 0,
    walletVersionAfter: w.version,
    now
  });

  return { txnDoc, walletAfter: w, extraWrites };
}

function planSpend(inputs) {
  const { wallet, currency, amount, reason, petId = null, clientUuid, now, actor } = inputs;
  if (!wallet) return fail("wallet is required");
  if (wallet.archived) return fail("wallet is archived");
  if (!SPEND_REASONS.has(reason)) return fail(`invalid spend reason: ${reason}`);
  const spendAmount = assertNonNegInt(amount, "amount");
  if (spendAmount <= 0) return fail("spend amount must be > 0");
  if (currency !== CURRENCIES.PET_XP && currency !== CURRENCIES.PET_SPARKS) {
    return fail(`spend supports only PET_XP or PET_SPARKS, got ${currency}`);
  }
  if (petId === null || petId === undefined || String(petId) === "") {
    return fail("petId is required for pet currency spend");
  }

  const w = cloneWallet(wallet);
  const pet = ensurePetEntry(w, petId);
  const petLevelBefore = pet.level;

  const delta = emptyDelta();
  let txnType;
  let counterAccount;

  if (currency === CURRENCIES.PET_XP) {
    if (pet.PET_XP < spendAmount) return fail(`Not enough Pet XP (need ${spendAmount}, have ${pet.PET_XP})`);
    pet.PET_XP -= spendAmount;
    pet.level = petLevelFromCum(pet.PET_XP).level;
    delta.PET_XP = -spendAmount;
    txnType = TRANSACTION_TYPES.PET_XP_SPEND;
    counterAccount = COUNTER_ACCOUNTS.PET_TRAINING_SINK;
  } else {
    if (pet.PET_SPARKS < spendAmount) return fail(`Not enough Pet Sparks (need ${spendAmount}, have ${pet.PET_SPARKS})`);
    pet.PET_SPARKS -= spendAmount;
    delta.PET_SPARKS = -spendAmount;
    txnType = TRANSACTION_TYPES.SPARK_SPEND;
    counterAccount = COUNTER_ACCOUNTS.SPARK_SINK;
  }

  const txnId = inputs.txnId || spendTxnId(w.heroId, reason, clientUuid || "spend");
  w.version += 1;
  w.lastTxnId = txnId;
  w.updatedAt = now;

  const txnDoc = buildTxnDoc({
    txnId,
    type: txnType,
    heroId: w.heroId,
    petId: String(petId),
    delta,
    counterAccount,
    levelBefore: w.heroLevel,
    levelAfter: w.heroLevel,
    petLevelBefore,
    petLevelAfter: pet.level,
    metadata: { reason },
    actor,
    walletVersionBefore: wallet.version ?? 0,
    walletVersionAfter: w.version,
    now
  });

  return { txnDoc, walletAfter: w, extraWrites: [] };
}

function planAdjust(inputs) {
  const {
    wallet,
    currency,
    amount,
    targetLevel = null,
    petId = null,
    memo = "",
    clientUuid,
    curves = DEFAULT_HERO_CUM_XP_TABLE,
    now,
    actor
  } = inputs;

  if (!wallet) return fail("wallet is required");
  const w = cloneWallet(wallet);
  const levelBefore = w.heroLevel;
  const delta = emptyDelta();
  let petLevelBefore = null;
  let petLevelAfter = null;

  if (targetLevel !== null && targetLevel !== undefined) {
    const lvl = assertNonNegInt(targetLevel, "targetLevel");
    if (lvl < 1) return fail("targetLevel must be >= 1");
    const targetCum = heroCumFrom(lvl, 0, curves);
    const xpDelta = targetCum - w.balances.HERO_XP;
    w.balances.HERO_XP = targetCum;
    w.heroLevel = heroLevelFromCum(targetCum, curves).level;
    delta.HERO_XP = xpDelta;
  } else {
    const adj = assertSafeInt(amount, "amount");
    if (currency === CURRENCIES.GOLD_POINTS) {
      const next = w.balances.GOLD_POINTS + adj;
      if (next < w.held.GOLD_POINTS || next < 0) return fail("adjustment would violate held or >= 0 invariant");
      w.balances.GOLD_POINTS = next;
      delta.GOLD_POINTS = adj;
    } else if (currency === CURRENCIES.HABIT_TOKENS) {
      const next = w.balances.HABIT_TOKENS + adj;
      if (next < 0) return fail("adjustment cannot take HABIT_TOKENS below 0");
      w.balances.HABIT_TOKENS = next;
      delta.HABIT_TOKENS = adj;
    } else if (currency === CURRENCIES.HERO_XP) {
      const next = w.balances.HERO_XP + adj;
      if (next < 0) return fail("adjustment cannot take HERO_XP below 0");
      w.balances.HERO_XP = next;
      w.heroLevel = heroLevelFromCum(next, curves).level;
      delta.HERO_XP = adj;
    } else if (currency === CURRENCIES.PET_XP || currency === CURRENCIES.PET_SPARKS) {
      if (petId === null || petId === undefined || String(petId) === "") return fail("petId required");
      const pet = ensurePetEntry(w, petId);
      petLevelBefore = pet.level;
      const next = pet[currency] + adj;
      if (next < 0) return fail(`adjustment cannot take ${currency} below 0`);
      pet[currency] = next;
      if (currency === CURRENCIES.PET_XP) {
        pet.level = petLevelFromCum(next).level;
      }
      petLevelAfter = pet.level;
      delta[currency] = adj;
    } else {
      return fail(`unknown currency: ${currency}`);
    }
  }

  const txnId = inputs.txnId || adjustTxnId(w.heroId, clientUuid || "adj");
  w.version += 1;
  w.lastTxnId = txnId;
  w.updatedAt = now;

  const txnDoc = buildTxnDoc({
    txnId,
    type: TRANSACTION_TYPES.PARENT_ADJUSTMENT,
    heroId: w.heroId,
    petId: petId !== null && petId !== undefined ? String(petId) : null,
    delta,
    counterAccount: COUNTER_ACCOUNTS.ADJUSTMENT,
    levelBefore,
    levelAfter: w.heroLevel,
    petLevelBefore,
    petLevelAfter,
    metadata: memo ? { memo: String(memo) } : null,
    actor,
    walletVersionBefore: wallet.version ?? 0,
    walletVersionAfter: w.version,
    now
  });

  return { txnDoc, walletAfter: w, extraWrites: [] };
}

/**
 * Pure transaction planner for every ledger operation in MIGRATION_PLAN.md Section 3.8.
 */
export function plan(op, inputs) {
  switch (op) {
    case "openWallet":
      return planOpenWallet(inputs);
    case "closeWallet":
      return planCloseWallet(inputs);
    case "recordActivity":
      return planRecordActivity(inputs);
    case "approveTaskPoints":
      return planApproveTaskPoints(inputs);
    case "rejectTask":
      return planRejectTask(inputs);
    case "requestReward":
      return planRequestReward(inputs);
    case "approveReward":
      return planApproveReward(inputs);
    case "rejectReward":
      return planRejectReward(inputs);
    case "purchase":
      return planPurchase(inputs);
    case "grantItem":
      return planGrantItem(inputs);
    case "revokeItem":
      return planRevokeItem(inputs);
    case "consume":
      return planConsume(inputs);
    case "spend":
      return planSpend(inputs);
    case "adjust":
      return planAdjust(inputs);
    default:
      return fail(`unsupported ledger op: ${String(op)}`);
  }
}
