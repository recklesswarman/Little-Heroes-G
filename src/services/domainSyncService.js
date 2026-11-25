/**
 * src/services/domainSyncService.js
 *
 * Phase 5: Dedicated Firestore subcollection sync for large, frequently-mutated
 * non-currency domains under `households/{code}`:
 *   - bedtime_stories/{storyId}
 *   - task_logs/{logId}
 *   - tasks/{taskId}
 *   - habits/{habitId}
 *   - studio_items/{itemId}
 *
 * Eliminates the 1 MiB household document ceiling (R7) and session echo-suppression
 * drops (R6) for all non-currency app data.
 */

import * as firestoreMod from 'firebase/firestore';
import { db, isFirebaseAvailable } from '../config/firebase.js';

export const NON_CURRENCY_SUBCOLLECTIONS = Object.freeze([
  'bedtime_stories',
  'task_logs',
  'tasks',
  'habits',
  'studio_items'
]);

export const SUBCOLLECTION_STATE_KEYS = new Set([
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
]);

const STUDIO_CATEGORY_TO_KEY = {
  weapon: 'parentCustomWeapons',
  gear: 'parentCustomGear',
  furniture: 'parentCustomFurniture',
  toy: 'parentCustomToys',
  food: 'parentCustomFood',
  boss: 'parentCustomBosses'
};

let _code = null;
let _unsubs = [];
let _active = false;
const _data = {
  bedtime_stories: new Map(),
  task_logs: new Map(),
  tasks: new Map(),
  habits: new Map(),
  studio_items: new Map()
};
const _listeners = new Set();

export function isDomainSyncActive() {
  return _active;
}

export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {};
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function _notify(domain) {
  for (const fn of _listeners) {
    try {
      fn({ domain, code: _code, snapshot: getDomainState() });
    } catch (err) {
      console.warn('[domainSyncService] subscriber error:', err?.message || err);
    }
  }
}

export function getDomainState() {
  const studio = {
    parentCustomWeapons: [],
    parentCustomGear: [],
    parentCustomFurniture: [],
    parentCustomToys: [],
    parentCustomFood: [],
    parentCustomBosses: []
  };
  for (const item of _data.studio_items.values()) {
    const key = STUDIO_CATEGORY_TO_KEY[item.studioCategory] || 'parentCustomGear';
    studio[key].push(item);
  }
  return {
    bedtimeStoryLibrary: Array.from(_data.bedtime_stories.values()),
    taskCompletionLogs: Array.from(_data.task_logs.values()),
    taskForest: Array.from(_data.tasks.values()),
    habitIslands: Array.from(_data.habits.values()),
    ...studio
  };
}

export function start(code, firestoreOverride = null) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return;
  if (_code === normalized && _unsubs.length > 0) return;

  stop();
  _code = normalized;

  const activeDb = firestoreOverride || (isFirebaseAvailable ? db : null);
  if (
    !activeDb ||
    typeof firestoreMod.collection !== 'function' ||
    typeof firestoreMod.onSnapshot !== 'function' ||
    typeof firestoreMod.getDocsFromServer !== 'function'
  ) {
    return;
  }

  _active = true;
  for (const sub of NON_CURRENCY_SUBCOLLECTIONS) {
    const ref = firestoreMod.collection(activeDb, 'households', normalized, sub);
    _unsubs.push(
      firestoreMod.onSnapshot(ref, (snap) => {
        _data[sub].clear();
        snap.forEach((docSnap) => {
          _data[sub].set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });
        _notify(sub);
      }, (err) => {
        console.warn(`[domainSyncService] ${sub} listener error:`, err?.code || err?.message);
      })
    );
  }
}

export function stop() {
  for (const unsub of _unsubs) {
    try { unsub(); } catch { /* ignore */ }
  }
  _unsubs = [];
  _code = null;
  _active = false;
  for (const sub of NON_CURRENCY_SUBCOLLECTIONS) {
    _data[sub].clear();
  }
}

export async function upsertDomainDoc(subcollection, docId, payload, { code = _code, firestoreOverride = null } = {}) {
  if (!NON_CURRENCY_SUBCOLLECTIONS.includes(subcollection)) {
    throw new Error(`Invalid subcollection: ${subcollection}`);
  }
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized || !docId) return false;
  const activeDb = firestoreOverride || (isFirebaseAvailable ? db : null);
  if (!activeDb || typeof firestoreMod.doc !== 'function' || typeof firestoreMod.setDoc !== 'function') return false;

  const ref = firestoreMod.doc(activeDb, 'households', normalized, subcollection, String(docId));
  await firestoreMod.setDoc(ref, { ...payload, id: String(docId), updatedAt: new Date().toISOString() }, { merge: true });
  return true;
}

export async function deleteDomainDoc(subcollection, docId, { code = _code, firestoreOverride = null } = {}) {
  if (!NON_CURRENCY_SUBCOLLECTIONS.includes(subcollection)) {
    throw new Error(`Invalid subcollection: ${subcollection}`);
  }
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized || !docId) return false;
  const activeDb = firestoreOverride || (isFirebaseAvailable ? db : null);
  if (!activeDb || typeof firestoreMod.doc !== 'function' || typeof firestoreMod.deleteDoc !== 'function') return false;

  const ref = firestoreMod.doc(activeDb, 'households', normalized, subcollection, String(docId));
  await firestoreMod.deleteDoc(ref);
  return true;
}

export const domainSyncService = {
  NON_CURRENCY_SUBCOLLECTIONS,
  SUBCOLLECTION_STATE_KEYS,
  isDomainSyncActive,
  subscribe,
  getDomainState,
  start,
  stop,
  upsertDomainDoc,
  deleteDomainDoc
};
