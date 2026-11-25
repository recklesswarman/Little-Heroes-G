/**
 * src/services/ledgerClient.js
 *
 * Phase 3: Client wrapper for the consolidated `ledger` Cloud Function v2.
 *
 * - Calls `httpsCallable(functions, 'ledger')` with `{ action, code, args }`.
 * - Persistent `localStorage` outbox (`ledger_outbox_v1`) for network-loss retries
 *   with deterministic `idemId`s; discards entries older than 24 hours.
 * - Joins household (`joinHousehold`) on every app start in both legacy and authoritative modes.
 * - Provides `updateHeroProfileFields()` for field-level `updateDoc` + `increment()` on `heroes/{heroId}`.
 */

import * as functionsMod from 'firebase/functions';
import * as firestoreMod from 'firebase/firestore';
import { db, functions, isFirebaseAvailable, ensureAuthReady } from '../config/firebase.js';
import { walletService } from './walletService.js';

export const OUTBOX_STORAGE_KEY = 'ledger_outbox_v1';
export const OUTBOX_MAX_AGE_MS = 24 * 60 * 60 * 1000;

let _activeHouseholdCode = null;
let _callableOverride = null;
let _flushing = false;
let _outboxExpiredHandler = null;
let _initializedListeners = false;

const NETWORK_ERROR_CODES = new Set([
  'unavailable',
  'functions/unavailable',
  'deadline-exceeded',
  'functions/deadline-exceeded',
  'internal',
  'functions/internal',
  'network-request-failed'
]);

export function setActiveHouseholdCode(code) {
  _activeHouseholdCode = code ? String(code).trim().toUpperCase() : null;
}

export function getActiveHouseholdCode() {
  return _activeHouseholdCode;
}

export function setCallableForTest(fn) {
  _callableOverride = fn;
}

export function onOutboxExpired(fn) {
  _outboxExpiredHandler = fn;
}

function _getStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* ignore */ }
  return null;
}

export function readOutbox() {
  const storage = _getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _writeOutbox(entries) {
  const storage = _getStorage();
  if (!storage) return;
  try {
    if (!entries || entries.length === 0) {
      storage.removeItem(OUTBOX_STORAGE_KEY);
    } else {
      storage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(entries));
    }
  } catch (err) {
    console.warn('[ledgerClient] failed to persist outbox:', err?.message || err);
  }
}

function _enqueueOutbox(entry) {
  const current = readOutbox();
  if (entry.idemId && current.some((e) => e.idemId === entry.idemId && e.action === entry.action)) {
    return;
  }
  current.push(entry);
  _writeOutbox(current);
}

function _isNetworkError(err) {
  if (!err) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const code = String(err.code || '').toLowerCase();
  if (NETWORK_ERROR_CODES.has(code)) return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('network') || msg.includes('offline') || msg.includes('failed to fetch') || msg.includes('unavailable');
}

async function _invokeCallable(payload) {
  if (_callableOverride) {
    return await _callableOverride(payload);
  }
  if (!isFirebaseAvailable || !functions || typeof functionsMod.httpsCallable !== 'function') {
    const err = new Error('Firebase Functions unavailable');
    err.code = 'unavailable';
    throw err;
  }
  await ensureAuthReady();
  const fn = functionsMod.httpsCallable(functions, 'ledger');
  const res = await fn(payload);
  return res?.data;
}

/**
 * Execute a ledger Cloud Function action.
 *
 * Options:
 * - code: override household code
 * - idemId: deterministic idempotency key (enables persistent outbox retry on network error)
 * - queueOnNetworkError: boolean (default true when idemId is provided)
 * - optimistic: { heroId, deltas, txnId } (auto-applied before call, cleared on non-network rejection)
 */
export async function run(action, args = {}, opts = {}) {
  const code = String(opts.code || args.code || _activeHouseholdCode || '').trim().toUpperCase();
  const idemId = opts.idemId || args.activityId || args.clientTxnId || null;
  const queueOnNetworkError = opts.queueOnNetworkError !== undefined ? Boolean(opts.queueOnNetworkError) : Boolean(idemId);

  if (opts.optimistic && opts.optimistic.heroId && opts.optimistic.deltas) {
    walletService.applyOptimistic(
      opts.optimistic.heroId,
      opts.optimistic.deltas,
      opts.optimistic.txnId || idemId
    );
  }

  const payload = { action, code, args };

  try {
    const data = await _invokeCallable(payload);
    return data;
  } catch (err) {
    if (queueOnNetworkError && idemId && _isNetworkError(err)) {
      _enqueueOutbox({
        action,
        code,
        args,
        idemId,
        firstAttemptAt: Date.now()
      });
      return { queued: true, idemId };
    }
    if (opts.optimistic && opts.optimistic.heroId) {
      walletService.clearOptimistic(opts.optimistic.heroId, opts.optimistic.txnId || idemId);
    }
    throw err;
  }
}

/**
 * Flush queued outbox mutations in FIFO order.
 * Discards entries older than 24 hours and notifies via onOutboxExpired.
 */
export async function flushOutbox(nowMs = Date.now()) {
  if (_flushing) return { flushed: 0, remaining: readOutbox().length, expired: 0 };
  const entries = readOutbox();
  if (entries.length === 0) return { flushed: 0, remaining: 0, expired: 0 };

  _flushing = true;
  let flushed = 0;
  let expired = 0;
  const remaining = [];

  try {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (nowMs - (Number(entry.firstAttemptAt) || 0) > OUTBOX_MAX_AGE_MS) {
        expired++;
        if (typeof _outboxExpiredHandler === 'function') {
          try { _outboxExpiredHandler(entry); } catch { /* ignore */ }
        }
        continue;
      }

      try {
        await _invokeCallable({
          action: entry.action,
          code: entry.code,
          args: entry.args
        });
        flushed++;
      } catch (err) {
        if (_isNetworkError(err)) {
          // Preserve FIFO order: keep this entry and all subsequent ones
          remaining.push(entry, ...entries.slice(i + 1));
          break;
        }
        // Deterministic server rejection (e.g., already processed / invalid) — drop entry
        console.warn('[ledgerClient] dropping rejected outbox entry:', entry.action, err?.code || err?.message);
      }
    }
    _writeOutbox(remaining);
  } finally {
    _flushing = false;
  }

  return { flushed, remaining: remaining.length, expired };
}

/**
 * S1: Join household membership on every app start (both legacy and authoritative modes).
 */
export async function joinHouseholdOnStart(code, deviceId = '', deviceLabel = 'Hero Device') {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  setActiveHouseholdCode(normalized);
  _ensureAutoFlushListeners();
  try {
    return await run('joinHousehold', { deviceId, deviceLabel }, { code: normalized, queueOnNetworkError: false });
  } catch (err) {
    // Non-fatal in legacy mode or offline start; will retry next open
    console.warn('[ledgerClient] joinHouseholdOnStart notice:', err?.code || err?.message);
    return null;
  }
}

/**
 * Field-level hero profile update on households/{code}/heroes/{heroId}.
 * Writes ONLY changed fields and uses Firestore increment() for counters so
 * concurrent edits on two devices never overwrite each other.
 */
export async function updateHeroProfileFields(code, heroId, fields = {}, counters = {}, firestoreOverride = null) {
  const normalized = String(code || _activeHouseholdCode || '').trim().toUpperCase();
  if (!normalized || !heroId) return false;
  const activeDb = firestoreOverride || (isFirebaseAvailable ? db : null);
  if (!activeDb || typeof firestoreMod.doc !== 'function' || typeof firestoreMod.updateDoc !== 'function') return false;

  const patch = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (v !== undefined) patch[k] = v;
  }
  for (const [k, delta] of Object.entries(counters || {})) {
    const n = Number(delta);
    if (Number.isFinite(n) && n !== 0) {
      patch[k] = typeof firestoreMod.increment === 'function' ? firestoreMod.increment(n) : n;
    }
  }
  if (Object.keys(patch).length === 0) return false;
  // Security rule requires `request.resource.data.id == heroId` (already on doc, safe to preserve)
  await firestoreMod.updateDoc(firestoreMod.doc(activeDb, 'households', normalized, 'heroes', heroId), patch);
  return true;
}

function _ensureAutoFlushListeners() {
  if (_initializedListeners) return;
  _initializedListeners = true;
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      flushOutbox().catch(() => {});
    });
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        flushOutbox().catch(() => {});
      }
    });
  }
  walletService.subscribe((evt) => {
    if (evt.status === 'live') {
      flushOutbox().catch(() => {});
    }
  });
}

export function _resetForTest() {
  _activeHouseholdCode = null;
  _callableOverride = null;
  _flushing = false;
  _outboxExpiredHandler = null;
  const storage = _getStorage();
  if (storage) storage.removeItem(OUTBOX_STORAGE_KEY);
}

export const ledgerClient = {
  OUTBOX_STORAGE_KEY,
  OUTBOX_MAX_AGE_MS,
  setActiveHouseholdCode,
  getActiveHouseholdCode,
  setCallableForTest,
  onOutboxExpired,
  readOutbox,
  run,
  flushOutbox,
  joinHouseholdOnStart,
  updateHeroProfileFields,
  _resetForTest
};
