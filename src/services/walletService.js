/**
 * src/services/walletService.js
 *
 * Phase 3: Real-time Firestore listener and optimistic overlay manager for the
 * authoritative double-entry ledger.
 *
 * - Keeps `ledgerMode` ('legacy' | 'migrating' | 'authoritative'); defaults to 'legacy'.
 * - In authoritative mode, attaches onSnapshot listeners to:
 *     households/{code}/wallets
 *     households/{code}/approval_requests (where status == 'pending')
 *     households/{code}/inventory
 *     households/{code}/heroes
 *     households/{code}/members
 * - Enforces version monotonicity on wallets (incoming.version >= current.version).
 * - Tracks connection freshness ('idle' | 'connecting' | 'live' | 'reconnecting' | 'stale').
 * - Applies non-persisted optimistic balance overlays that clear on server convergence or error.
 */

import * as firestoreMod from 'firebase/firestore';
import { db, isFirebaseAvailable } from '../config/firebase.js';
import { CURRENCIES } from '../../shared/ledger/currencies.js';

let _ledgerMode = 'legacy'; // 'legacy' | 'migrating' | 'authoritative'
let _householdCode = null;
let _status = 'idle'; // 'idle' | 'connecting' | 'live' | 'reconnecting' | 'stale'
let _hasServerWalletSnapshot = false;
let _hasServerApprovalSnapshot = false;
let _hasServerInventorySnapshot = false;

const _walletsById = new Map();       // heroId -> wallet doc
const _pendingApprovals = new Map();  // approvalId -> approval doc
const _inventoryByKey = new Map();    // `${heroId}__${itemId}` -> inventory doc
const _heroesById = new Map();        // heroId -> hero profile doc
const _membersByUid = new Map();      // uid -> member doc
const _overlaysByHero = new Map();    // heroId -> Array<{ txnId, deltas, createdAt }>
const _listeners = new Set();

let _unsubs = [];
let _onlineHandler = null;
let _visibilityHandler = null;
let _firestoreOverride = null;
let _beforeReconnectFn = null;
let _reconnectTimer = null;
let _reconnectAttempt = 0;
let _isReconnecting = false;
let _startToken = 0;

export function getLedgerMode() {
  return _ledgerMode;
}

export function isLegacyLedger() {
  return _ledgerMode === 'legacy';
}

export function isAuthoritativeLedger() {
  return _ledgerMode === 'authoritative';
}

export function setLedgerMode(mode) {
  const normalized = (mode === 'authoritative' || mode === 'migrating') ? mode : 'legacy';
  if (_ledgerMode !== normalized) {
    _ledgerMode = normalized;
    _notify();
  }
}

export function getStatus() {
  return _status;
}

export function hasServerSnapshot() {
  return _hasServerWalletSnapshot;
}

export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {};
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function _notify() {
  for (const fn of _listeners) {
    try {
      fn({
        ledgerMode: _ledgerMode,
        status: _status,
        hasServerSnapshot: _hasServerWalletSnapshot,
        householdCode: _householdCode
      });
    } catch (err) {
      console.warn('[walletService] subscriber error:', err?.message || err);
    }
  }
}

/**
 * Ingest a wallet document with strict version monotonicity.
 * Never overwrites a newer wallet version with an older one.
 */
export function ingestWalletDoc(heroId, incoming) {
  if (!heroId || !incoming) return false;
  const current = _walletsById.get(heroId);
  const incomingVer = Number(incoming.version) || 0;
  const currentVer = current ? (Number(current.version) || 0) : -1;
  if (incomingVer < currentVer) {
    return false;
  }
  _walletsById.set(heroId, { ...incoming });

  // Clear converged optimistic overlays
  const overlays = _overlaysByHero.get(heroId);
  if (overlays && overlays.length > 0) {
    const remaining = overlays.filter((ov) => {
      if (incoming.lastTxnId && ov.txnId && incoming.lastTxnId === ov.txnId) {
        return false;
      }
      if (ov.baseVersion !== undefined && incomingVer > ov.baseVersion) {
        return false;
      }
      return true;
    });
    if (remaining.length === 0) {
      _overlaysByHero.delete(heroId);
    } else {
      _overlaysByHero.set(heroId, remaining);
    }
  }
  return true;
}

export function getWallet(heroId) {
  if (!heroId) return null;
  return _walletsById.get(heroId) || null;
}

export function getAllWallets() {
  const out = {};
  for (const [k, v] of _walletsById.entries()) {
    out[k] = v;
  }
  return out;
}

export function getHeroProfile(heroId) {
  if (!heroId) return null;
  return _heroesById.get(heroId) || null;
}

export function getAllHeroProfiles() {
  return Array.from(_heroesById.values());
}

export function getPendingApprovals() {
  return Array.from(_pendingApprovals.values());
}

export function getMembers() {
  return Array.from(_membersByUid.values());
}

export function getInventoryForHero(heroId) {
  if (!heroId) return [];
  const prefix = `${heroId}__`;
  const items = [];
  for (const [docId, item] of _inventoryByKey.entries()) {
    if (docId.startsWith(prefix) || item.heroId === heroId) {
      items.push(item);
    }
  }
  return items;
}

export function heroOwnsItem(heroId, kind, itemId) {
  if (!heroId || !itemId) return false;
  const key = `${heroId}__${itemId}`;
  const doc = _inventoryByKey.get(key);
  if (!doc) return false;
  if (kind && doc.kind && doc.kind !== kind) return false;
  return (Number(doc.quantity) || 0) > 0;
}

export function hasPendingLock(heroId, lockKey) {
  if (!heroId || !lockKey) return false;
  for (const req of _pendingApprovals.values()) {
    if (req.heroId === heroId && req.status === 'pending') {
      if (req.lockKey === lockKey || req.taskId === lockKey || req.habitId === lockKey || req.activityId === lockKey) {
        return true;
      }
    }
  }
  return false;
}

export function needsRedo(heroId, lockKey) {
  const w = _walletsById.get(heroId);
  if (!w || !w.needsRedo || typeof w.needsRedo !== 'object') return false;
  return Boolean(w.needsRedo[lockKey]);
}

/**
 * Optimistic overlays:
 * deltas is an object mapping currency key (or `${currency}:${petId}`) -> integer delta.
 * Overlays are strictly in-memory and never persisted to localStorage.
 */
export function applyOptimistic(heroId, deltas, txnId) {
  if (!heroId || !deltas || typeof deltas !== 'object') return;
  const current = _walletsById.get(heroId);
  const baseVersion = current ? (Number(current.version) || 0) : 0;
  const list = _overlaysByHero.get(heroId) || [];
  // Deduplicate by txnId
  const filtered = txnId ? list.filter((ov) => ov.txnId !== txnId) : list;
  filtered.push({
    txnId: txnId || `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    deltas: { ...deltas },
    baseVersion,
    createdAt: Date.now()
  });
  _overlaysByHero.set(heroId, filtered);
  _notify();
}

export function clearOptimistic(heroId, txnId) {
  if (!heroId) return;
  if (!txnId) {
    _overlaysByHero.delete(heroId);
    _notify();
    return;
  }
  const list = _overlaysByHero.get(heroId);
  if (!list) return;
  const remaining = list.filter((ov) => ov.txnId !== txnId);
  if (remaining.length === 0) {
    _overlaysByHero.delete(heroId);
  } else {
    _overlaysByHero.set(heroId, remaining);
  }
  _notify();
}

function _overlayDeltaFor(heroId, currency, petId) {
  const list = _overlaysByHero.get(heroId);
  if (!list || list.length === 0) return 0;
  const petKey = petId != null ? `${currency}:${petId}` : null;
  let sum = 0;
  for (const ov of list) {
    if (petKey && typeof ov.deltas[petKey] === 'number') {
      sum += ov.deltas[petKey];
    } else if (typeof ov.deltas[currency] === 'number') {
      sum += ov.deltas[currency];
    }
  }
  return sum;
}

/**
 * Authoritative balance reader.
 * - For EVOLUTION_SPARKS (display alias), reads active pet's PET_SPARKS.
 * - Returns null in authoritative mode before the first server snapshot arrives (so UI renders "…").
 */
export function balanceOf(heroId, currency, petId = null, fallbackHero = null) {
  if (isLegacyLedger()) {
    if (!fallbackHero) return 0;
    return _legacyBalanceOf(fallbackHero, currency, petId);
  }

  if (!_hasServerWalletSnapshot) {
    return null;
  }

  const w = _walletsById.get(heroId);
  if (!w) {
    return 0;
  }

  const resolvedCurrency = currency === 'EVOLUTION_SPARKS' ? CURRENCIES.PET_SPARKS : currency;
  let serverVal = 0;

  if (resolvedCurrency === CURRENCIES.GOLD_POINTS) {
    serverVal = Number(w.balances?.[CURRENCIES.GOLD_POINTS]) || 0;
  } else if (resolvedCurrency === CURRENCIES.HABIT_TOKENS) {
    serverVal = Number(w.balances?.[CURRENCIES.HABIT_TOKENS]) || 0;
  } else if (resolvedCurrency === CURRENCIES.HERO_XP) {
    serverVal = Number(w.balances?.[CURRENCIES.HERO_XP]) || 0;
  } else if (resolvedCurrency === CURRENCIES.PET_SPARKS) {
    const pid = petId != null ? String(petId) : String(fallbackHero?.activePetId || _heroesById.get(heroId)?.activePetId || '');
    serverVal = pid ? (Number(w.petSparks?.[pid]) || 0) : 0;
  } else if (resolvedCurrency === CURRENCIES.PET_XP) {
    const pid = petId != null ? String(petId) : String(fallbackHero?.activePetId || _heroesById.get(heroId)?.activePetId || '');
    serverVal = pid ? (Number(w.petXp?.[pid]) || 0) : 0;
  }

  const delta = _overlayDeltaFor(heroId, resolvedCurrency, petId);
  return Math.max(0, Math.trunc(serverVal + delta));
}

export function availableGoldPoints(heroId, fallbackHero = null) {
  const total = balanceOf(heroId, CURRENCIES.GOLD_POINTS, null, fallbackHero);
  if (total === null) return null;
  if (isLegacyLedger()) return total;
  const w = _walletsById.get(heroId);
  const held = Number(w?.held?.[CURRENCIES.GOLD_POINTS]) || 0;
  return Math.max(0, total - held);
}

export function formatBalance(heroId, currency, petId = null, fallbackHero = null) {
  const val = balanceOf(heroId, currency, petId, fallbackHero);
  return val === null ? '…' : String(val);
}

function _legacyBalanceOf(hero, currency, petId) {
  if (!hero) return 0;
  if (currency === CURRENCIES.GOLD_POINTS) return Number(hero.points) || 0;
  if (currency === CURRENCIES.HABIT_TOKENS) return Number(hero.coins) || 0;
  if (currency === CURRENCIES.HERO_XP) return Number(hero.xp) || 0;
  if (currency === CURRENCIES.PET_SPARKS || currency === 'EVOLUTION_SPARKS') {
    const pid = petId != null ? String(petId) : String(hero.activePetId || '');
    if (pid && hero.petSparkMap && typeof hero.petSparkMap[pid] === 'number') {
      return hero.petSparkMap[pid];
    }
    return Number(hero.sparks) || Number(hero.evolutionSparks) || 0;
  }
  if (currency === CURRENCIES.PET_XP) {
    const pid = petId != null ? String(petId) : String(hero.activePetId || '');
    if (pid && hero.petXpMap && typeof hero.petXpMap[pid] === 'number') {
      return hero.petXpMap[pid];
    }
    return 0;
  }
  return 0;
}

/**
 * Trigger a one-shot server fetch of wallets on reconnect / tab resume.
 */
export async function refreshFromServer() {
  const activeDb = _firestoreOverride || db;
  if (!_householdCode || !activeDb || typeof firestoreMod.getDocsFromServer !== 'function' || typeof firestoreMod.collection !== 'function') return;
  if (_status === 'reconnecting' || _unsubs.length === 0) {
    _reconnectNow().catch(() => {});
  }
  try {
    const snap = await firestoreMod.getDocsFromServer(firestoreMod.collection(activeDb, 'households', _householdCode, 'wallets'));
    snap.forEach((docSnap) => {
      ingestWalletDoc(docSnap.id, docSnap.data());
    });
    _hasServerWalletSnapshot = true;
    _status = 'live';
    _reconnectAttempt = 0;
    _notify();
  } catch (err) {
    console.warn('[walletService] refreshFromServer error:', err?.message || err);
  }
}

function _clearUnsubs() {
  for (const unsub of _unsubs) {
    try { unsub(); } catch { /* ignore */ }
  }
  _unsubs = [];
}

function _clearReconnectTimer() {
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
}

function _scheduleReconnect() {
  if (!_householdCode || _reconnectTimer || _isReconnecting) return;
  const delays = [1500, 3000, 6000, 12000, 20000];
  const delay = delays[Math.min(_reconnectAttempt, delays.length - 1)];
  _reconnectAttempt += 1;
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    _reconnectNow().catch(() => {});
  }, delay);
}

async function _reconnectNow() {
  const code = _householdCode;
  const token = _startToken;
  if (!code || _isReconnecting) return;
  _isReconnecting = true;
  _clearReconnectTimer();
  try {
    if (typeof _beforeReconnectFn === 'function') {
      await _beforeReconnectFn(code);
    }
  } catch (err) {
    console.warn('[walletService] beforeReconnect notice:', err?.code || err?.message || err);
  } finally {
    _isReconnecting = false;
  }
  if (_householdCode !== code || _startToken !== token) return;
  _clearUnsubs();
  _attachListeners(code, token);
}

function _attachListeners(normalized, token) {
  const activeDb = _firestoreOverride || (isFirebaseAvailable ? db : null);
  if (
    !activeDb ||
    typeof firestoreMod.collection !== 'function' ||
    typeof firestoreMod.onSnapshot !== 'function' ||
    typeof firestoreMod.getDocsFromServer !== 'function'
  ) {
    _notify();
    return;
  }

  // 1. Wallets listener
  const walletsRef = firestoreMod.collection(activeDb, 'households', normalized, 'wallets');
  _unsubs.push(
    firestoreMod.onSnapshot(walletsRef, { includeMetadataChanges: true }, (snap) => {
      if (_startToken !== token) return;
      const fromCache = Boolean(snap.metadata?.fromCache);
      snap.forEach((docSnap) => {
        ingestWalletDoc(docSnap.id, docSnap.data());
      });
      if (!fromCache) {
        _hasServerWalletSnapshot = true;
        _status = 'live';
        _reconnectAttempt = 0;
        _clearReconnectTimer();
      } else {
        _status = _hasServerWalletSnapshot ? 'stale' : 'connecting';
      }
      _notify();
    }, (err) => {
      if (_startToken !== token) return;
      console.warn('[walletService] wallets listener error:', err?.code || err?.message);
      _status = 'reconnecting';
      _notify();
      _scheduleReconnect();
    })
  );

  // 2. Pending approval_requests listener
  if (typeof firestoreMod.query === 'function' && typeof firestoreMod.where === 'function') {
    const approvalsQ = firestoreMod.query(
      firestoreMod.collection(activeDb, 'households', normalized, 'approval_requests'),
      firestoreMod.where('status', '==', 'pending')
    );
    _unsubs.push(
      firestoreMod.onSnapshot(approvalsQ, { includeMetadataChanges: true }, (snap) => {
        if (_startToken !== token) return;
        _pendingApprovals.clear();
        snap.forEach((docSnap) => {
          _pendingApprovals.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });
        if (!snap.metadata?.fromCache) {
          _hasServerApprovalSnapshot = true;
        }
        _notify();
      }, (err) => {
        if (_startToken !== token) return;
        console.warn('[walletService] approval_requests listener error:', err?.code || err?.message);
        _scheduleReconnect();
      })
    );
  }

  // 3. Inventory listener
  const invRef = firestoreMod.collection(activeDb, 'households', normalized, 'inventory');
  _unsubs.push(
    firestoreMod.onSnapshot(invRef, { includeMetadataChanges: true }, (snap) => {
      if (_startToken !== token) return;
      _inventoryByKey.clear();
      snap.forEach((docSnap) => {
        _inventoryByKey.set(docSnap.id, { docId: docSnap.id, ...docSnap.data() });
      });
      if (!snap.metadata?.fromCache) {
        _hasServerInventorySnapshot = true;
      }
      _notify();
    }, (err) => {
      if (_startToken !== token) return;
      console.warn('[walletService] inventory listener error:', err?.code || err?.message);
      _scheduleReconnect();
    })
  );

  // 4. Heroes profile listener (non-currency fields + per-kid HQ layout)
  const heroesRef = firestoreMod.collection(activeDb, 'households', normalized, 'heroes');
  _unsubs.push(
    firestoreMod.onSnapshot(heroesRef, { includeMetadataChanges: true }, (snap) => {
      if (_startToken !== token) return;
      _heroesById.clear();
      snap.forEach((docSnap) => {
        _heroesById.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      });
      _notify();
    }, (err) => {
      if (_startToken !== token) return;
      console.warn('[walletService] heroes listener error:', err?.code || err?.message);
      _scheduleReconnect();
    })
  );

  // 5. Members listener (Parent Portal "Devices" list)
  const membersRef = firestoreMod.collection(activeDb, 'households', normalized, 'members');
  _unsubs.push(
    firestoreMod.onSnapshot(membersRef, (snap) => {
      if (_startToken !== token) return;
      _membersByUid.clear();
      snap.forEach((docSnap) => {
        _membersByUid.set(docSnap.id, { uid: docSnap.id, ...docSnap.data() });
      });
      _notify();
    }, (err) => {
      if (_startToken !== token) return;
      console.warn('[walletService] members listener error:', err?.code || err?.message);
      _scheduleReconnect();
    })
  );

  _notify();
}

export function start(code, opts = {}) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return;
  if (typeof opts?.onBeforeReconnect === 'function') {
    _beforeReconnectFn = opts.onBeforeReconnect;
  }
  if (_householdCode === normalized && _unsubs.length > 0 && _status !== 'reconnecting') return;

  stop();
  _householdCode = normalized;
  _beforeReconnectFn = typeof opts?.onBeforeReconnect === 'function' ? opts.onBeforeReconnect : _beforeReconnectFn;
  _status = 'connecting';
  _hasServerWalletSnapshot = false;
  _hasServerApprovalSnapshot = false;
  _hasServerInventorySnapshot = false;
  _reconnectAttempt = 0;
  _startToken += 1;
  const token = _startToken;

  _attachListeners(normalized, token);

  if (typeof window !== 'undefined') {
    _onlineHandler = () => {
      refreshFromServer();
    };
    _visibilityHandler = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshFromServer();
      }
    };
    window.addEventListener('online', _onlineHandler);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', _visibilityHandler);
    }
  }
}

export function stop() {
  _startToken += 1;
  _clearReconnectTimer();
  _clearUnsubs();
  _isReconnecting = false;
  _reconnectAttempt = 0;
  if (typeof window !== 'undefined' && _onlineHandler) {
    window.removeEventListener('online', _onlineHandler);
    _onlineHandler = null;
  }
  if (typeof document !== 'undefined' && _visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
    _visibilityHandler = null;
  }
  _householdCode = null;
  _status = 'idle';
  _hasServerWalletSnapshot = false;
  _hasServerApprovalSnapshot = false;
  _hasServerInventorySnapshot = false;
  _walletsById.clear();
  _pendingApprovals.clear();
  _inventoryByKey.clear();
  _heroesById.clear();
  _membersByUid.clear();
  _overlaysByHero.clear();
}

/**
 * Test hooks (used by scratch/verify_wallet_service.mjs & verify_ledger_write_paths.mjs).
 */
export function _setTestHooks({ firestore = null } = {}) {
  _firestoreOverride = firestore;
}

export function _injectSnapshotForTest({
  wallets = null,
  approvals = null,
  inventory = null,
  heroes = null,
  members = null,
  fromCache = false
} = {}) {
  if (wallets) {
    for (const [heroId, data] of Object.entries(wallets)) {
      ingestWalletDoc(heroId, data);
    }
    if (!fromCache) {
      _hasServerWalletSnapshot = true;
      _status = 'live';
    } else {
      _status = _hasServerWalletSnapshot ? 'stale' : 'connecting';
    }
  }
  if (approvals) {
    _pendingApprovals.clear();
    for (const req of approvals) {
      _pendingApprovals.set(req.id, req);
    }
    if (!fromCache) _hasServerApprovalSnapshot = true;
  }
  if (inventory) {
    _inventoryByKey.clear();
    for (const item of inventory) {
      const key = item.docId || `${item.heroId}__${item.itemId}`;
      _inventoryByKey.set(key, { docId: key, ...item });
    }
    if (!fromCache) _hasServerInventorySnapshot = true;
  }
  if (heroes) {
    _heroesById.clear();
    for (const h of heroes) {
      _heroesById.set(h.id, h);
    }
  }
  if (members) {
    _membersByUid.clear();
    for (const m of members) {
      _membersByUid.set(m.uid, m);
    }
  }
  _notify();
}

export function _resetForTest() {
  stop();
  _ledgerMode = 'legacy';
  _firestoreOverride = null;
  _listeners.clear();
}

export const walletService = {
  getLedgerMode,
  isLegacyLedger,
  isAuthoritativeLedger,
  setLedgerMode,
  getStatus,
  hasServerSnapshot,
  subscribe,
  ingestWalletDoc,
  getWallet,
  getAllWallets,
  getHeroProfile,
  getAllHeroProfiles,
  getPendingApprovals,
  getMembers,
  getInventoryForHero,
  heroOwnsItem,
  hasPendingLock,
  needsRedo,
  applyOptimistic,
  clearOptimistic,
  balanceOf,
  availableGoldPoints,
  formatBalance,
  refreshFromServer,
  start,
  stop,
  _setTestHooks,
  _injectSnapshotForTest,
  _resetForTest
};
