import { Firestore, Timestamp, Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  AuthContext,
  normalizeCode,
  householdRef,
  requireMember,
  requireParentSession,
  handleJoinHousehold,
  handleRevokeDevice,
  handleVerifyParentPin,
  handleSetParentPin
} from "./auth";
import {
  handlePasskeyRegisterBegin,
  handlePasskeyRegisterFinish,
  handlePasskeyAuthBegin,
  handlePasskeyAuthFinish,
  handleRemovePasskey
} from "./passkeys";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const core = require("./core/core.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ids = require("./core/ids.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const curvesMod = require("./core/curves.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const currenciesMod = require("./core/currencies.js");

const MAX_BOUND = 100_000;

export interface DispatchOptions {
  nowMs?: number;
  verifyPasskeyAuth?: Parameters<typeof handlePasskeyAuthFinish>[5];
}

function formatDayInTimeZone(nowMs: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(nowMs));
  } catch {
    return new Date(nowMs).toISOString().slice(0, 10);
  }
}

function assertBoundedInt(val: unknown, label: string, min = 0, max = MAX_BOUND): number {
  const num = Number(val);
  if (!Number.isSafeInteger(num) || num < min || num > max) {
    throw new HttpsError("invalid-argument", `${label} must be an integer in [${min}, ${max}]`);
  }
  return num;
}

async function applyExtraWrites(
  tx: Transaction,
  hRef: FirebaseFirestore.DocumentReference,
  extraWrites: Array<{ collection: string; docId: string; op: string; data?: Record<string, unknown> }>
) {
  for (const w of extraWrites) {
    const ref = hRef.collection(w.collection).doc(w.docId);
    if (w.op === "delete") {
      tx.delete(ref);
    } else {
      tx.set(ref, w.data || {}, { merge: false });
    }
  }
}

async function readCurves(tx: Transaction, hRef: FirebaseFirestore.DocumentReference): Promise<number[]> {
  const snap = await tx.get(hRef.collection("ledger_config").doc("curves"));
  const arr = snap.data()?.heroCumXp;
  return Array.isArray(arr) && arr.length >= 2 ? arr : curvesMod.DEFAULT_HERO_CUM_XP_TABLE;
}

async function readTimeZone(tx: Transaction, hRef: FirebaseFirestore.DocumentReference): Promise<string> {
  const snap = await tx.get(hRef.collection("ledger_config").doc("household"));
  return String(snap.data()?.timeZone || "UTC");
}

async function countOwnedPetsAndSlots(
  tx: Transaction,
  hRef: FirebaseFirestore.DocumentReference,
  heroId: string
): Promise<{ ownedPetCount: number; extraHabitatSlots: number }> {
  const invQuery = hRef.collection("inventory").where("ownerId", "==", heroId);
  const invSnap = await tx.get(invQuery);
  let ownedPetCount = 0;
  let extraHabitatSlots = 0;
  invSnap.forEach((d) => {
    const data = d.data();
    if (data.kind === "pet" && (data.qty ?? 0) > 0) {
      ownedPetCount += 1;
    } else if (data.kind === "habitat_slot") {
      extraHabitatSlots += Number(data.qty) || 0;
    }
  });
  return { ownedPetCount, extraHabitatSlots };
}

/**
 * Incremental wallet reconciliation helper (used by ledgerReconcileNightly and emulator tests).
 * Queries transactions by (heroId ASC, walletVersionAfter ASC) strictly above checkpointVersion.
 */
export async function reconcileWalletIncremental(
  db: Firestore,
  code: string,
  heroId: string
): Promise<{ ok: boolean; drift: Record<string, number>; checkedCount: number; newVersion: number }> {
  const hRef = householdRef(db, code);
  const walletSnap = await hRef.collection("wallets").doc(heroId).get();
  if (!walletSnap.exists) {
    throw new HttpsError("not-found", `Wallet ${heroId} not found`);
  }
  const wallet = walletSnap.data() || {};
  const ckRef = hRef.collection("ledger_config").doc("reconcile");
  const ckSnap = await ckRef.get();
  const ck = ckSnap.data()?.wallets?.[heroId] || {
    version: 0,
    balances: { GOLD_POINTS: 0, HABIT_TOKENS: 0, HERO_XP: 0 },
    held: { GOLD_POINTS: 0 }
  };

  const txnsSnap = await hRef
    .collection("ledger_transactions")
    .where("heroId", "==", heroId)
    .where("walletVersionAfter", ">", ck.version)
    .orderBy("walletVersionAfter", "asc")
    .get();

  const running = {
    GOLD_POINTS: Number(ck.balances?.GOLD_POINTS) || 0,
    HABIT_TOKENS: Number(ck.balances?.HABIT_TOKENS) || 0,
    HERO_XP: Number(ck.balances?.HERO_XP) || 0
  };
  let runningHeld = Number(ck.held?.GOLD_POINTS) || 0;
  let expectedPrevVersion = Number(ck.version) || 0;
  let versionGap = false;

  txnsSnap.forEach((docSnap) => {
    const t = docSnap.data();
    if (t.walletVersionBefore !== expectedPrevVersion || t.walletVersionAfter !== expectedPrevVersion + 1) {
      versionGap = true;
    }
    expectedPrevVersion = Number(t.walletVersionAfter) || expectedPrevVersion + 1;
    running.GOLD_POINTS += Number(t.delta?.GOLD_POINTS) || 0;
    running.HABIT_TOKENS += Number(t.delta?.HABIT_TOKENS) || 0;
    running.HERO_XP += Number(t.delta?.HERO_XP) || 0;
    runningHeld += Number(t.heldDelta?.GOLD_POINTS) || 0;
  });

  const drift: Record<string, number> = {};
  if (running.GOLD_POINTS !== (wallet.balances?.GOLD_POINTS ?? 0)) {
    drift.GOLD_POINTS = (wallet.balances?.GOLD_POINTS ?? 0) - running.GOLD_POINTS;
  }
  if (running.HABIT_TOKENS !== (wallet.balances?.HABIT_TOKENS ?? 0)) {
    drift.HABIT_TOKENS = (wallet.balances?.HABIT_TOKENS ?? 0) - running.HABIT_TOKENS;
  }
  if (running.HERO_XP !== (wallet.balances?.HERO_XP ?? 0)) {
    drift.HERO_XP = (wallet.balances?.HERO_XP ?? 0) - running.HERO_XP;
  }
  if (runningHeld !== (wallet.held?.GOLD_POINTS ?? 0)) {
    drift.HELD_GOLD_POINTS = (wallet.held?.GOLD_POINTS ?? 0) - runningHeld;
  }
  if (versionGap || expectedPrevVersion !== (wallet.version ?? 0)) {
    drift.VERSION = (wallet.version ?? 0) - expectedPrevVersion;
  }

  const ok = Object.keys(drift).length === 0;
  if (ok) {
    await ckRef.set(
      {
        wallets: {
          [heroId]: {
            version: expectedPrevVersion,
            balances: running,
            held: { GOLD_POINTS: runningHeld }
          }
        }
      },
      { merge: true }
    );
  }
  return { ok, drift, checkedCount: txnsSnap.size, newVersion: expectedPrevVersion };
}

export async function dispatchLedgerAction(
  db: Firestore,
  auth: AuthContext | null,
  rawData: Record<string, unknown>,
  opts: DispatchOptions = {}
): Promise<Record<string, unknown>> {
  if (!auth || !auth.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  const action = String(rawData?.action || "").trim();
  const code = normalizeCode(rawData?.code);
  const args = (rawData?.args && typeof rawData.args === "object")
    ? (rawData.args as Record<string, unknown>)
    : {};
  const nowMs = opts.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const deviceId = String(args.deviceId || rawData?.deviceId || "client");
  const hRef = householdRef(db, code);

  // --- Auth & membership actions ---
  if (action === "joinHousehold") {
    return handleJoinHousehold(db, code, auth, args);
  }
  if (action === "revokeDevice") {
    return handleRevokeDevice(db, code, auth, args, nowMs);
  }
  if (action === "verifyParentPin") {
    return handleVerifyParentPin(db, code, auth, args, nowMs);
  }
  if (action === "setParentPin") {
    return handleSetParentPin(db, code, auth, args, nowMs);
  }
  if (action === "passkeyRegisterBegin") {
    return handlePasskeyRegisterBegin(db, code, auth, args, nowMs);
  }
  if (action === "passkeyRegisterFinish") {
    return handlePasskeyRegisterFinish(db, code, auth, args, nowMs);
  }
  if (action === "passkeyAuthBegin") {
    return handlePasskeyAuthBegin(db, code, auth, args, nowMs);
  }
  if (action === "passkeyAuthFinish") {
    return handlePasskeyAuthFinish(db, code, auth, args, nowMs, opts.verifyPasskeyAuth);
  }
  if (action === "removePasskey") {
    return handleRemovePasskey(db, code, auth, args, nowMs);
  }

  // --- Household creation ---
  if (action === "createHousehold") {
    const name = String(args.name || "The Hero Family").trim().slice(0, 100);
    const timeZone = String(args.timeZone || "America/New_York").trim();
    const firstHero = args.firstHero as Record<string, unknown> | undefined;
    const nowTs = Timestamp.fromMillis(nowMs);

    return db.runTransaction(async (tx) => {
      const hSnap = await tx.get(hRef);
      if (hSnap.exists) {
        throw new HttpsError("already-exists", "Household code already exists");
      }
      tx.set(hRef, {
        syncCode: code,
        householdName: name,
        ledgerMode: "authoritative",
        parentUids: [auth.uid],
        revokedDeviceIds: [],
        createdAt: nowTs,
        updatedAt: nowIso
      });
      tx.set(hRef.collection("members").doc(auth.uid), {
        uid: auth.uid,
        role: "parent",
        deviceId,
        deviceLabel: String(args.deviceLabel || "Parent Device"),
        joinedAt: nowTs,
        lastSeenAt: nowTs
      });
      tx.set(hRef.collection("ledger_config").doc("curves"), {
        heroCumXp: [...curvesMod.DEFAULT_HERO_CUM_XP_TABLE],
        petMaxLevel: curvesMod.PET_MAX_LEVEL,
        levelUpBonusTokens: curvesMod.HERO_LEVEL_UP_BONUS_TOKENS
      });
      tx.set(hRef.collection("ledger_config").doc("household"), { timeZone });

      if (firstHero && firstHero.id) {
        const heroId = String(firstHero.id);
        const planRes = core.plan("openWallet", {
          heroId,
          starting: {
            points: Number(firstHero.points) || 0,
            coins: Number(firstHero.coins) || 0,
            level: Number(firstHero.level) || 1
          },
          curves: curvesMod.DEFAULT_HERO_CUM_XP_TABLE,
          now: nowIso,
          actor: { uid: auth.uid, deviceId, role: "parent" }
        });
        if (planRes.error) throw new HttpsError("failed-precondition", planRes.error);
        tx.create(hRef.collection("ledger_transactions").doc(planRes.txnDoc.txnId), planRes.txnDoc);
        tx.set(hRef.collection("wallets").doc(heroId), planRes.walletAfter);
        tx.set(hRef.collection("heroes").doc(heroId), {
          id: heroId,
          name: String(firstHero.name || "Little Hero"),
          role: String(firstHero.role || "Adventurer"),
          avatar: String(firstHero.avatar || ""),
          updatedAt: nowIso
        });
      }
      return { created: true, code };
    });
  }

  // --- Parent-only catalog & reward_rules upserts ---
  if (action === "upsertCatalog") {
    await requireParentSession(db, code, auth, nowMs);
    const kind = String(args.kind || "").trim();
    const itemId = String(args.itemId || "").trim();
    if (!kind || !itemId) throw new HttpsError("invalid-argument", "kind and itemId required");
    const docId = ids.catalogDocId(kind, itemId);
    const entry = {
      itemId,
      kind,
      title: String(args.title || itemId).trim().slice(0, 120),
      costCoins: assertBoundedInt(args.costCoins ?? 0, "costCoins"),
      costSparks: assertBoundedInt(args.costSparks ?? 0, "costSparks"),
      costPoints: assertBoundedInt(args.costPoints ?? 0, "costPoints"),
      ...(args.servingsPerPurchase !== undefined
        ? { servingsPerPurchase: assertBoundedInt(args.servingsPerPurchase, "servingsPerPurchase") }
        : {}),
      ...(args.milestoneRequirement ? { milestoneRequirement: String(args.milestoneRequirement) } : {}),
      active: args.active !== false,
      updatedAt: nowIso
    };
    await hRef.collection("catalog").doc(docId).set(entry, { merge: true });
    return { saved: true, docId, entry };
  }

  if (action === "upsertRewardRules") {
    await requireParentSession(db, code, auth, nowMs);
    const activityType = String(args.activityType || "").trim();
    const activityId = String(args.activityId || "").trim();
    if (!activityType) throw new HttpsError("invalid-argument", "activityType required");
    const ruleId = String(args.ruleId || ids.rewardRuleDocId(activityType, activityId));
    const entry = {
      ruleId,
      activityType,
      tokens: assertBoundedInt(args.tokens ?? 0, "tokens"),
      xp: assertBoundedInt(args.xp ?? 0, "xp"),
      sparks: assertBoundedInt(args.sparks ?? 0, "sparks"),
      petXp: assertBoundedInt(args.petXp ?? 0, "petXp"),
      points: assertBoundedInt(args.points ?? 0, "points"),
      dailyCap: assertBoundedInt(args.dailyCap ?? 20, "dailyCap"),
      maxBuffPercent: assertBoundedInt(args.maxBuffPercent ?? 50, "maxBuffPercent", 0, 200),
      approvalGated: Boolean(args.approvalGated || (Number(args.points) || 0) > 0),
      active: args.active !== false,
      updatedAt: nowIso
    };
    await hRef.collection("reward_rules").doc(ruleId).set(entry, { merge: true });
    return { saved: true, ruleId, entry };
  }

  // --- Wallet lifecycle (parent session required) ---
  if (action === "openWallet") {
    await requireParentSession(db, code, auth, nowMs);
    const heroId = String(args.heroId || "").trim();
    if (!heroId) throw new HttpsError("invalid-argument", "heroId is required");
    const txnId = ids.openWalletTxnId(heroId);
    const txnRef = hRef.collection("ledger_transactions").doc(txnId);
    const walletRef = hRef.collection("wallets").doc(heroId);

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      if (existing.exists) {
        const wSnap = await tx.get(walletRef);
        return { alreadyDone: true, wallet: wSnap.data() };
      }
      const curves = await readCurves(tx, hRef);
      const res = core.plan("openWallet", {
        heroId,
        starting: (args.starting as Record<string, unknown>) || {},
        curves,
        txnId,
        now: nowIso,
        actor: { uid: auth.uid, deviceId, role: "parent" }
      });
      if (res.error) throw new HttpsError("failed-precondition", res.error);
      tx.create(txnRef, res.txnDoc);
      tx.set(walletRef, res.walletAfter);
      const profile = (args.profile as Record<string, unknown>) || {};
      tx.set(hRef.collection("heroes").doc(heroId), {
        id: heroId,
        name: String(profile.name || "Little Hero"),
        role: String(profile.role || "Adventurer"),
        avatar: String(profile.avatar || ""),
        hq: profile.hq || { themeId: "dino_fortress", isNightMode: false, equippedFurniture: {} },
        updatedAt: nowIso
      });
      return { alreadyDone: false, wallet: res.walletAfter, txnId };
    });
  }

  if (action === "closeWallet") {
    await requireParentSession(db, code, auth, nowMs);
    const heroId = String(args.heroId || "").trim();
    const clientUuid = String(args.clientUuid || "close");
    if (!heroId) throw new HttpsError("invalid-argument", "heroId is required");
    const txnId = ids.closeWalletTxnId(heroId, clientUuid);
    const txnRef = hRef.collection("ledger_transactions").doc(txnId);
    const walletRef = hRef.collection("wallets").doc(heroId);

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      if (existing.exists) {
        const wSnap = await tx.get(walletRef);
        return { alreadyDone: true, wallet: wSnap.data() };
      }
      const wSnap = await tx.get(walletRef);
      if (!wSnap.exists) throw new HttpsError("not-found", "Wallet not found");
      const res = core.plan("closeWallet", {
        wallet: wSnap.data(),
        clientUuid,
        txnId,
        now: nowIso,
        actor: { uid: auth.uid, deviceId, role: "parent" }
      });
      if (res.error) throw new HttpsError("failed-precondition", res.error);
      tx.create(txnRef, res.txnDoc);
      tx.set(walletRef, res.walletAfter);
      return { alreadyDone: false, wallet: res.walletAfter, txnId };
    });
  }

  // --- Member earn/spend/hold/grant/consume actions ---
  if (action === "recordActivity") {
    await requireMember(db, code, auth);
    const heroId = String(args.heroId || "").trim();
    const activityType = String(args.activityType || "").trim();
    const activityId = String(args.activityId || activityType).trim();
    const cycleId = String(args.cycleId || "").trim();
    if (!heroId || !activityType || !cycleId) {
      throw new HttpsError("invalid-argument", "heroId, activityType, and cycleId are required");
    }

    const txnId = ids.activityTxnId(heroId, activityType, activityId, cycleId);
    const txnRef = hRef.collection("ledger_transactions").doc(txnId);
    const walletRef = hRef.collection("wallets").doc(heroId);
    const lockKey = ids.canonicalTaskId(activityId);
    const lockRef = hRef.collection("activity_locks").doc(ids.activityLockDocId(heroId, lockKey));

    const isHabitOrTask = activityType === "habit" || activityType === "task";
    const specificRuleId = isHabitOrTask ? ids.rewardRuleDocId(activityType, activityId) : null;
    const genericRuleRef = hRef.collection("reward_rules").doc(ids.sanitizeIdSegment(activityType, "activityType"));
    const specificRuleRef = specificRuleId ? hRef.collection("reward_rules").doc(specificRuleId) : null;

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      if (existing.exists) {
        const wSnap = await tx.get(walletRef);
        return { alreadyDone: true, wallet: wSnap.data(), txnId };
      }

      const wSnap = await tx.get(walletRef);
      if (!wSnap.exists) throw new HttpsError("not-found", "Wallet not found");
      const curves = await readCurves(tx, hRef);
      const timeZone = await readTimeZone(tx, hRef);
      const lockSnap = await tx.get(lockRef);

      let ruleSnap = specificRuleRef ? await tx.get(specificRuleRef) : null;
      if (!ruleSnap || !ruleSnap.exists) {
        if (isHabitOrTask) {
          throw new HttpsError("failed-precondition", `Missing reward rule for ${specificRuleId}`);
        }
        ruleSnap = await tx.get(genericRuleRef);
      }
      if (!ruleSnap.exists || ruleSnap.data()?.active === false) {
        throw new HttpsError("failed-precondition", `Missing or inactive reward rule for ${activityType}`);
      }

      const day = formatDayInTimeZone(nowMs, timeZone);
      const res = core.plan("recordActivity", {
        wallet: wSnap.data(),
        rule: ruleSnap.data(),
        activityType,
        activityId,
        cycleId,
        petId: args.petId ?? null,
        buffPercentTokens: Number(args.buffPercentTokens) || 0,
        buffPercentXp: Number(args.buffPercentXp) || 0,
        day,
        title: String(args.title || activityId),
        existingLock: lockSnap.exists ? lockSnap.data() : null,
        curves,
        txnId,
        now: nowIso,
        actor: { uid: auth.uid, deviceId, role: "device" }
      });
      if (res.error) throw new HttpsError("failed-precondition", res.error);

      tx.create(txnRef, res.txnDoc);
      tx.set(walletRef, res.walletAfter);
      await applyExtraWrites(tx, hRef, res.extraWrites);
      return { alreadyDone: false, wallet: res.walletAfter, txnId, txnDoc: res.txnDoc };
    });
  }

  if (action === "approveTaskPoints" || action === "rejectTask") {
    await requireParentSession(db, code, auth, nowMs);
    const requestId = String(args.requestId || "").trim();
    if (!requestId) throw new HttpsError("invalid-argument", "requestId is required");

    const txnId = action === "approveTaskPoints" ? ids.approveTxnId(requestId) : ids.rejectTxnId(requestId);
    const txnRef = hRef.collection("ledger_transactions").doc(txnId);
    const reqRef = hRef.collection("approval_requests").doc(requestId);

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      const reqSnap = await tx.get(reqRef);
      if (existing.exists) {
        const heroId = String(reqSnap.data()?.heroId || existing.data()?.heroId || "");
        const wSnap = heroId ? await tx.get(hRef.collection("wallets").doc(heroId)) : null;
        return { alreadyDone: true, wallet: wSnap?.data(), txnId };
      }
      if (!reqSnap.exists) throw new HttpsError("not-found", "Approval request not found");
      const reqData = reqSnap.data() || {};
      const heroId = String(reqData.heroId || "");
      const walletRef = hRef.collection("wallets").doc(heroId);
      const wSnap = await tx.get(walletRef);
      if (!wSnap.exists) throw new HttpsError("not-found", "Wallet not found");

      let earnTxn = null;
      let curves = curvesMod.DEFAULT_HERO_CUM_XP_TABLE;
      if (action === "rejectTask") {
        curves = await readCurves(tx, hRef);
        if (reqData.earnTxnId) {
          const earnSnap = await tx.get(hRef.collection("ledger_transactions").doc(String(reqData.earnTxnId)));
          earnTxn = earnSnap.exists ? earnSnap.data() : null;
        }
      }

      const res = core.plan(action, {
        wallet: wSnap.data(),
        request: reqData,
        earnTxn,
        curves,
        txnId,
        now: nowIso,
        actor: { uid: auth.uid, deviceId, role: "parent" }
      });
      if (res.error) throw new HttpsError("failed-precondition", res.error);

      tx.create(txnRef, res.txnDoc);
      tx.set(walletRef, res.walletAfter);
      await applyExtraWrites(tx, hRef, res.extraWrites);
      return { alreadyDone: false, wallet: res.walletAfter, txnId, txnDoc: res.txnDoc };
    });
  }

  if (action === "requestReward") {
    await requireMember(db, code, auth);
    const heroId = String(args.heroId || "").trim();
    const rewardId = String(args.rewardId || "").trim();
    const requestId = String(args.requestId || "").trim();
    if (!heroId || !rewardId || !requestId) {
      throw new HttpsError("invalid-argument", "heroId, rewardId, and requestId are required");
    }

    const txnId = ids.rewardHoldTxnId(requestId);
    const txnRef = hRef.collection("ledger_transactions").doc(txnId);
    const walletRef = hRef.collection("wallets").doc(heroId);
    const catRef = hRef.collection("catalog").doc(ids.catalogDocId("reward", rewardId));

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      if (existing.exists) {
        const wSnap = await tx.get(walletRef);
        return { alreadyDone: true, wallet: wSnap.data(), txnId };
      }
      const wSnap = await tx.get(walletRef);
      const catSnap = await tx.get(catRef);
      if (!wSnap.exists) throw new HttpsError("not-found", "Wallet not found");
      if (!catSnap.exists) throw new HttpsError("not-found", "Reward not found in catalog");

      const res = core.plan("requestReward", {
        wallet: wSnap.data(),
        catalogItem: catSnap.data(),
        requestId,
        txnId,
        now: nowIso,
        actor: { uid: auth.uid, deviceId, role: "device" }
      });
      if (res.error) throw new HttpsError("failed-precondition", res.error);

      tx.create(txnRef, res.txnDoc);
      tx.set(walletRef, res.walletAfter);
      await applyExtraWrites(tx, hRef, res.extraWrites);
      return { alreadyDone: false, wallet: res.walletAfter, txnId };
    });
  }

  if (action === "approveReward" || action === "rejectReward") {
    await requireParentSession(db, code, auth, nowMs);
    const requestId = String(args.requestId || "").trim();
    if (!requestId) throw new HttpsError("invalid-argument", "requestId is required");

    const txnId = action === "approveReward" ? ids.rewardCaptureTxnId(requestId) : ids.rewardVoidTxnId(requestId);
    const txnRef = hRef.collection("ledger_transactions").doc(txnId);
    const holdRef = hRef.collection("holds").doc(requestId);
    const reqRef = hRef.collection("approval_requests").doc(requestId);

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      const holdSnap = await tx.get(holdRef);
      if (existing.exists) {
        const heroId = String(holdSnap.data()?.heroId || existing.data()?.heroId || "");
        const wSnap = heroId ? await tx.get(hRef.collection("wallets").doc(heroId)) : null;
        return { alreadyDone: true, wallet: wSnap?.data(), txnId };
      }
      const reqSnap = await tx.get(reqRef);
      if (!holdSnap.exists || !reqSnap.exists) {
        throw new HttpsError("not-found", "Reward hold or request not found");
      }
      const heroId = String(holdSnap.data()?.heroId || "");
      const walletRef = hRef.collection("wallets").doc(heroId);
      const wSnap = await tx.get(walletRef);
      if (!wSnap.exists) throw new HttpsError("not-found", "Wallet not found");

      const res = core.plan(action, {
        wallet: wSnap.data(),
        hold: holdSnap.data(),
        request: reqSnap.data(),
        txnId,
        now: nowIso,
        actor: { uid: auth.uid, deviceId, role: "parent" }
      });
      if (res.error) throw new HttpsError("failed-precondition", res.error);

      tx.create(txnRef, res.txnDoc);
      tx.set(walletRef, res.walletAfter);
      await applyExtraWrites(tx, hRef, res.extraWrites);
      return { alreadyDone: false, wallet: res.walletAfter, txnId };
    });
  }

  if (action === "purchase") {
    await requireMember(db, code, auth);
    const heroId = String(args.heroId || "").trim();
    const kind = String(args.kind || "").trim();
    const itemId = String(args.itemId || "").trim();
    const clientUuid = String(args.clientUuid || "").trim();
    if (!heroId || !kind || !itemId || !clientUuid) {
      throw new HttpsError("invalid-argument", "heroId, kind, itemId, and clientUuid are required");
    }

    const txnId = ids.purchaseTxnId(heroId, itemId, clientUuid);
    const txnRef = hRef.collection("ledger_transactions").doc(txnId);
    const walletRef = hRef.collection("wallets").doc(heroId);
    const catRef = hRef.collection("catalog").doc(ids.catalogDocId(kind, itemId));
    const invRef = hRef.collection("inventory").doc(ids.inventoryDocId(heroId, itemId));

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      if (existing.exists) {
        const wSnap = await tx.get(walletRef);
        return { alreadyDone: true, wallet: wSnap.data(), txnId };
      }
      const wSnap = await tx.get(walletRef);
      const catSnap = await tx.get(catRef);
      const invSnap = kind === "fee" ? null : await tx.get(invRef);
      if (!wSnap.exists) throw new HttpsError("not-found", "Wallet not found");
      if (!catSnap.exists) throw new HttpsError("not-found", "Catalog item not found");

      let petSlotInfo = { ownedPetCount: 0, extraHabitatSlots: 0 };
      if (kind === "pet") {
        petSlotInfo = await countOwnedPetsAndSlots(tx, hRef, heroId);
      }

      const res = core.plan("purchase", {
        wallet: wSnap.data(),
        catalogItem: catSnap.data(),
        existingInventory: invSnap?.exists ? invSnap.data() : null,
        petId: args.petId ?? null,
        ...petSlotInfo,
        clientUuid,
        txnId,
        now: nowIso,
        actor: { uid: auth.uid, deviceId, role: "device" }
      });
      if (res.error) throw new HttpsError("failed-precondition", res.error);

      tx.create(txnRef, res.txnDoc);
      tx.set(walletRef, res.walletAfter);
      await applyExtraWrites(tx, hRef, res.extraWrites);
      return { alreadyDone: false, wallet: res.walletAfter, txnId };
    });
  }

  if (action === "grantItem") {
    const reason = String(args.reason || "").trim();
    const isParentReason = currenciesMod.PARENT_GRANT_REASONS.has(reason);
    if (isParentReason) {
      await requireParentSession(db, code, auth, nowMs);
    } else {
      await requireMember(db, code, auth);
    }

    const heroId = String(args.heroId || "").trim();
    const itemId = String(args.itemId || "").trim();
    const kind = String(args.kind || "").trim();
    const uniqueSuffix = String(args.uniqueSuffix || "");
    if (!heroId || !itemId || !kind) {
      throw new HttpsError("invalid-argument", "heroId, itemId, and kind are required");
    }

    const txnId = ids.grantTxnId(heroId, itemId, uniqueSuffix);
    const txnRef = hRef.collection("ledger_transactions").doc(txnId);
    const walletRef = hRef.collection("wallets").doc(heroId);
    const invRef = hRef.collection("inventory").doc(ids.inventoryDocId(heroId, itemId));
    const catRef = hRef.collection("catalog").doc(ids.catalogDocId(kind, itemId));
    const eggItemId = String(args.eggItemId || "");
    const eggRef = reason === "egg_hatch" && eggItemId
      ? hRef.collection("inventory").doc(ids.inventoryDocId(heroId, eggItemId))
      : null;

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      if (existing.exists) {
        const wSnap = await tx.get(walletRef);
        return { alreadyDone: true, wallet: wSnap.data(), txnId };
      }
      const wSnap = await tx.get(walletRef);
      if (!wSnap.exists) throw new HttpsError("not-found", "Wallet not found");
      const invSnap = await tx.get(invRef);
      const catSnap = await tx.get(catRef);
      const eggSnap = eggRef ? await tx.get(eggRef) : null;

      let petSlotInfo = { ownedPetCount: 0, extraHabitatSlots: 0 };
      if (kind === "pet" || reason === "starter_pet") {
        petSlotInfo = await countOwnedPetsAndSlots(tx, hRef, heroId);
      }

      const res = core.plan("grantItem", {
        wallet: wSnap.data(),
        itemId,
        kind,
        reason,
        catalogItem: catSnap.exists ? catSnap.data() : null,
        existingInventory: invSnap.exists ? invSnap.data() : null,
        eggInventory: eggSnap?.exists ? eggSnap.data() : null,
        ...petSlotInfo,
        isParentSession: isParentReason,
        allowAdditionalStarterSlot: Boolean(args.allowAdditionalStarterSlot),
        uniqueSuffix,
        txnId,
        now: nowIso,
        actor: { uid: auth.uid, deviceId, role: isParentReason ? "parent" : "device" }
      });
      if (res.error) throw new HttpsError("failed-precondition", res.error);

      tx.create(txnRef, res.txnDoc);
      tx.set(walletRef, res.walletAfter);
      await applyExtraWrites(tx, hRef, res.extraWrites);
      return { alreadyDone: false, wallet: res.walletAfter, txnId };
    });
  }

  if (action === "revokeItem") {
    await requireParentSession(db, code, auth, nowMs);
    const heroId = String(args.heroId || "").trim();
    const itemId = String(args.itemId || "").trim();
    const clientUuid = String(args.clientUuid || "revoke");
    if (!heroId || !itemId) throw new HttpsError("invalid-argument", "heroId and itemId required");

    const txnId = ids.revokeTxnId(heroId, itemId, clientUuid);
    const txnRef = hRef.collection("ledger_transactions").doc(txnId);
    const walletRef = hRef.collection("wallets").doc(heroId);
    const invRef = hRef.collection("inventory").doc(ids.inventoryDocId(heroId, itemId));

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      if (existing.exists) {
        const wSnap = await tx.get(walletRef);
        return { alreadyDone: true, wallet: wSnap.data(), txnId };
      }
      const wSnap = await tx.get(walletRef);
      const invSnap = await tx.get(invRef);
      if (!wSnap.exists) throw new HttpsError("not-found", "Wallet not found");
      if (!invSnap.exists) throw new HttpsError("not-found", "Inventory item not found");

      const res = core.plan("revokeItem", {
        wallet: wSnap.data(),
        existingInventory: invSnap.data(),
        qty: Number(args.qty) || 1,
        clientUuid,
        txnId,
        now: nowIso,
        actor: { uid: auth.uid, deviceId, role: "parent" }
      });
      if (res.error) throw new HttpsError("failed-precondition", res.error);

      tx.create(txnRef, res.txnDoc);
      tx.set(walletRef, res.walletAfter);
      await applyExtraWrites(tx, hRef, res.extraWrites);
      return { alreadyDone: false, wallet: res.walletAfter, txnId };
    });
  }

  if (action === "consume") {
    await requireMember(db, code, auth);
    const heroId = String(args.heroId || "").trim();
    const itemId = String(args.itemId || "").trim();
    const clientUuid = String(args.clientUuid || "").trim();
    if (!heroId || !itemId || !clientUuid) {
      throw new HttpsError("invalid-argument", "heroId, itemId, and clientUuid required");
    }

    const txnId = ids.consumeTxnId(heroId, itemId, clientUuid);
    const txnRef = hRef.collection("ledger_transactions").doc(txnId);
    const walletRef = hRef.collection("wallets").doc(heroId);
    const invRef = hRef.collection("inventory").doc(ids.inventoryDocId(heroId, itemId));

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      if (existing.exists) {
        const wSnap = await tx.get(walletRef);
        return { alreadyDone: true, wallet: wSnap.data(), txnId };
      }
      const wSnap = await tx.get(walletRef);
      const invSnap = await tx.get(invRef);
      if (!wSnap.exists) throw new HttpsError("not-found", "Wallet not found");
      if (!invSnap.exists) throw new HttpsError("not-found", "Consumable not found");

      const res = core.plan("consume", {
        wallet: wSnap.data(),
        existingInventory: invSnap.data(),
        clientUuid,
        txnId,
        now: nowIso,
        actor: { uid: auth.uid, deviceId, role: "device" }
      });
      if (res.error) throw new HttpsError("failed-precondition", res.error);

      tx.create(txnRef, res.txnDoc);
      tx.set(walletRef, res.walletAfter);
      await applyExtraWrites(tx, hRef, res.extraWrites);
      return { alreadyDone: false, wallet: res.walletAfter, txnId };
    });
  }

  if (action === "spend") {
    await requireMember(db, code, auth);
    const heroId = String(args.heroId || "").trim();
    const reason = String(args.reason || "").trim();
    const clientUuid = String(args.clientUuid || "").trim();
    if (!heroId || !reason || !clientUuid) {
      throw new HttpsError("invalid-argument", "heroId, reason, and clientUuid required");
    }

    const txnId = ids.spendTxnId(heroId, reason, clientUuid);
    const txnRef = hRef.collection("ledger_transactions").doc(txnId);
    const walletRef = hRef.collection("wallets").doc(heroId);

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      if (existing.exists) {
        const wSnap = await tx.get(walletRef);
        return { alreadyDone: true, wallet: wSnap.data(), txnId };
      }
      const wSnap = await tx.get(walletRef);
      if (!wSnap.exists) throw new HttpsError("not-found", "Wallet not found");

      const res = core.plan("spend", {
        wallet: wSnap.data(),
        currency: args.currency,
        amount: Number(args.amount),
        reason,
        petId: args.petId ?? null,
        clientUuid,
        txnId,
        now: nowIso,
        actor: { uid: auth.uid, deviceId, role: "device" }
      });
      if (res.error) throw new HttpsError("failed-precondition", res.error);

      tx.create(txnRef, res.txnDoc);
      tx.set(walletRef, res.walletAfter);
      return { alreadyDone: false, wallet: res.walletAfter, txnId };
    });
  }

  if (action === "adjust") {
    await requireParentSession(db, code, auth, nowMs);
    const heroId = String(args.heroId || "").trim();
    const clientUuid = String(args.clientUuid || "").trim();
    if (!heroId || !clientUuid) throw new HttpsError("invalid-argument", "heroId and clientUuid required");

    const txnId = ids.adjustTxnId(heroId, clientUuid);
    const txnRef = hRef.collection("ledger_transactions").doc(txnId);
    const walletRef = hRef.collection("wallets").doc(heroId);

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(txnRef);
      if (existing.exists) {
        const wSnap = await tx.get(walletRef);
        return { alreadyDone: true, wallet: wSnap.data(), txnId };
      }
      const wSnap = await tx.get(walletRef);
      if (!wSnap.exists) throw new HttpsError("not-found", "Wallet not found");
      const curves = await readCurves(tx, hRef);

      const res = core.plan("adjust", {
        wallet: wSnap.data(),
        currency: args.currency,
        amount: args.amount !== undefined ? Number(args.amount) : undefined,
        targetLevel: args.targetLevel !== undefined ? Number(args.targetLevel) : null,
        petId: args.petId ?? null,
        memo: String(args.memo || ""),
        clientUuid,
        curves,
        txnId,
        now: nowIso,
        actor: { uid: auth.uid, deviceId, role: "parent" }
      });
      if (res.error) throw new HttpsError("failed-precondition", res.error);

      tx.create(txnRef, res.txnDoc);
      tx.set(walletRef, res.walletAfter);
      return { alreadyDone: false, wallet: res.walletAfter, txnId };
    });
  }

  throw new HttpsError("invalid-argument", `Unsupported ledger action: ${action}`);
}
