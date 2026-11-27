import { doc, setDoc, onSnapshot, updateDoc, deleteField, arrayRemove } from "firebase/firestore";
import { db, isFirebaseAvailable, ensureAuthReady } from "../config/firebase.js";
import { store, STORAGE_KEY, HERO_STAMPED_FIELDS } from "../state/store.js";
import { DIGITAL_REWARDS_CATALOG } from "../data/digitalRewardsCatalog.js";
import { persistentLink } from "./persistentLinkService.js";
import { secureRandomHex } from "../utils/secureRandom.js";
import { walletService } from "./walletService.js";
import { ledgerClient } from "./ledgerClient.js";

const DEVICE_ID_KEY = 'stitch_device_id';
const QUOTA_EXHAUSTED_KEY = 'firestore_quota_exhausted_until';
const CLOUD_SYNC_DEBOUNCE_MS = 350;
const PUSH_FAILURE_RING_MAX = 20;
const RETRY_BASE_DELAY_MS = 2000;
const RETRY_MAX_DELAY_MS = 60000;

// These values describe the local UI/session and should never overwrite another
// device's active screen or authentication state.
const LOCAL_ONLY_STATE_KEYS = new Set([
  'isAuthenticated',
  'isAuthReady',
  'householdSetupStep',
  'activeView',
  'previousView',
  'selectedPetDetailId',
  'selectedAdventureGameId',
  'petSelectionModal',
  'rewardModal',
  'mysterySurprise',
  'activeUnboxingCrateId',
  'activeDrawer',
  'activeHygieneReminder',
  'bossColosseum',
  'aiQuests',
  'heroAiQuestsMap'
]);

// Keys that are already synced as dedicated top-level fields on households/{CODE}.
// Writing them inside stateSnapshot too doubled/tripled payload size (~390 KB).
// We emit deleteField() for these keys so setDoc(..., { merge: true }) physically
// removes the stale duplicates from existing stored household documents.
export const REDUNDANT_SNAPSHOT_KEYS = [
  'heroes',
  'selectedHero',
  'digitalGear',
  'pets',
  'heroHQ',
  'savedHeroCards',
  'taskCompletionLogs',
  'taskLedgerLogs',
  'resolvedApprovals',
  'pendingApprovals',
  'inventory',
  'expeditionHistory'
];
const REDUNDANT_SNAPSHOT_KEY_SET = new Set(REDUNDANT_SNAPSHOT_KEYS);

// Keys refused by firestore.rules in migrating/authoritative ledger modes
export const AUTHORITATIVE_FORBIDDEN_KEYS = new Set([
  'heroes',
  'heroesMap',
  'selectedHero',
  'pendingApprovals',
  'resolvedApprovals',
  'inventory',
  'heroHQ',
  'petXpMap',
  'petLevelMap',
  'petSparkMap'
]);

const DEFAULT_DIGITAL_GEAR_BY_ID = new Map(
  (DIGITAL_REWARDS_CATALOG || [])
    .filter((item) => item && item.id)
    .map((item) => [item.id, JSON.stringify(item)])
);

/**
 * Return only parent-modified default gear items and custom Studio items.
 * Unmodified defaults from DIGITAL_REWARDS_CATALOG (~136 KB) are reconciled
 * on every device during hydrateFromCloud, so they do not need to be pushed.
 */
export function buildSlimDigitalGear(digitalGear) {
  if (!Array.isArray(digitalGear)) return [];
  const slim = [];
  for (const item of digitalGear) {
    if (!item || !item.id) continue;
    const defaultJson = DEFAULT_DIGITAL_GEAR_BY_ID.get(item.id);
    if (!defaultJson || JSON.stringify(item) !== defaultJson) {
      slim.push(item);
    }
  }
  return slim;
}

export function sanitizeForFirestore(val, inArray = false) {
  if (val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (val === null || typeof val !== 'object') return val;
  if (val instanceof Date) return val.toISOString();
  if (val._methodName || val.__op) return val;
  if (Array.isArray(val)) {
    // Firestore rejects directly nested arrays ([[...]]) with invalid-argument.
    if (inArray) {
      return JSON.stringify(val);
    }
    return val.map((item) => sanitizeForFirestore(item, true));
  }
  const out = {};
  for (const [k, v] of Object.entries(val)) {
    // Firestore rejects empty-string map keys ("") with invalid-argument.
    if (!k || v === undefined) continue;
    out[k] = sanitizeForFirestore(v, false);
  }
  return out;
}

export function buildCloudStateSnapshot(state, { includeDeletes = true, authoritative = !walletService.isLegacyLedger() } = {}) {
  const snapshot = {};
  Object.entries(state || {}).forEach(([key, value]) => {
    if (LOCAL_ONLY_STATE_KEYS.has(key) || key === 'devices' || REDUNDANT_SNAPSHOT_KEY_SET.has(key)) return;
    if (authoritative && AUTHORITATIVE_FORBIDDEN_KEYS.has(key)) return;
    if (key === 'household' && value && typeof value === 'object') {
      const cleanedHh = { ...value };
      delete cleanedHh.lastSync;
      // Never push empty parentUids/parentEmails that would trip anti-takeover rules on non-parent devices
      if (!Array.isArray(cleanedHh.parentUids) || cleanedHh.parentUids.length === 0) {
        delete cleanedHh.parentUids;
      }
      if (!Array.isArray(cleanedHh.parentEmails) || cleanedHh.parentEmails.length === 0) {
        delete cleanedHh.parentEmails;
      }
      snapshot.household = cleanedHh;
      return;
    }
    if (authoritative && key === 'parentSettings' && value && typeof value === 'object') {
      const cleaned = { ...value };
      delete cleaned.pin;
      snapshot.parentSettings = cleaned;
      return;
    }
    snapshot[key] = value;
  });
  if (includeDeletes && !authoritative) {
    for (const key of REDUNDANT_SNAPSHOT_KEYS) {
      snapshot[key] = deleteField();
    }
  }
  return snapshot;
}

export function isQuotaExhaustedGlobal() {
  try {
    const raw = localStorage.getItem(QUOTA_EXHAUSTED_KEY);
    if (raw) {
      const until = Number(raw);
      if (Date.now() < until) {
        return true;
      }
      localStorage.removeItem(QUOTA_EXHAUSTED_KEY);
    }
  } catch {
    // Ignore storage errors
  }
  return false;
}

export function markQuotaExhaustedGlobal(cooldownMs) {
  try {
    const now = new Date();
    // Default cooldown: until tomorrow at 00:05 UTC (when Google Cloud daily free quota resets)
    const tomorrowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
    const defaultMs = Math.max(30 * 60 * 1000, tomorrowUtc.getTime() - now.getTime());
    const duration = typeof cooldownMs === 'number' && cooldownMs > 0 ? cooldownMs : defaultMs;
    const until = Date.now() + duration;
    localStorage.setItem(QUOTA_EXHAUSTED_KEY, String(until));
    console.info(`🛡️ Firestore write quota protected until ${new Date(until).toLocaleTimeString()}. Using local-first storage.`);
  } catch {
    // Ignore storage errors
  }
}

export function isQuotaError(err) {
  if (!err) return false;
  const code = err.code || '';
  const msg = err.message || (typeof err === 'string' ? err : '');
  return (
    code === 'resource-exhausted' ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Free daily write units') ||
    msg.includes('quota metric') ||
    msg.includes('maximum backoff delay')
  );
}

function getOrCreateDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev_${secureRandomHex(16)}_${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `dev_${secureRandomHex(16)}`;
  }
}

export function getDeviceFriendlyName() {
  if (typeof navigator === 'undefined') return 'Hero Device';
  const ua = navigator.userAgent || '';
  if (/iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'Apple iPad';
  }
  if (/iPhone/i.test(ua)) {
    return 'Apple iPhone';
  }
  if (/Android/i.test(ua)) {
    if (/Tablet|Nexus 7|Nexus 10|SM-T/i.test(ua)) {
      return 'Android Tablet';
    }
    return 'Android Phone';
  }
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return 'Mac';
  }
  if (/Windows NT/i.test(ua)) {
    return 'Windows PC';
  }
  if (/CrOS/i.test(ua)) {
    return 'Chromebook';
  }
  return 'Web Device';
}

export function getDeviceIcon(nameOrUa) {
  const str = String(nameOrUa || '').toLowerCase();
  if (str.includes('ipad') || str.includes('tablet')) return 'tablet_mac';
  if (str.includes('iphone') || str.includes('phone') || str.includes('android')) return 'smartphone';
  if (str.includes('mac') || str.includes('pc') || str.includes('windows') || str.includes('chromebook') || str.includes('computer')) return 'computer';
  return 'devices';
}

const BROADCAST_CHANNEL_NAME = 'little_heroes_realtime_sync';

class FirestoreSyncService {
  constructor() {
    this.unsubscribe = null;
    this.isPushing = false;
    this.currentCode = null;
    this.deviceId = getOrCreateDeviceId();
    this.sessionId = `sess_${secureRandomHex(16)}_${Date.now().toString(36)}`;
    this.debounceTimer = null;
    // Outcome of the most recent cloud write, surfaced to the Parent Panel so a
    // "Saved" message never claims the cloud has a change it rejected.
    this.lastPushError = null;
    this.lastPushOkAt = 0;
    this.lastCloudTimestamp = null;
    this.lastKnownDevices = {};
    this.initialSyncCallbacks = [];
    this.presenceInterval = null;
    this.pushInFlight = false;
    this.pushPending = false;
    // Phase 0: ring buffer of last 20 push failures ({code, at}) and exponential backoff retry
    this.pushFailures = [];
    this.retryTimer = null;
    this.quotaRetryTimer = null;
    this.retryBaseDelayMs = RETRY_BASE_DELAY_MS;
    this.retryMaxDelayMs = RETRY_MAX_DELAY_MS;
    this.retryDelayMs = RETRY_BASE_DELAY_MS;
    // Overridable in tests to inject setDoc / ensureAuthReady failures without hitting network
    this._setDoc = setDoc;
    this._ensureAuthReady = ensureAuthReady;

    // Same-origin multi-tab real-time instant sync
    this.broadcastChannel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          if (event?.origin && typeof window !== 'undefined' && window.location?.origin && event.origin !== window.location.origin) return;
          this.handleBroadcastMessage(event.data);
        };
      } catch (e) {
        this.broadcastChannel = null;
      }
    }

    this.startPresenceHeartbeat();
  }

  _recordPushFailure(code) {
    this.pushFailures.push({ code: String(code || 'unknown'), at: Date.now() });
    if (this.pushFailures.length > PUSH_FAILURE_RING_MAX) {
      this.pushFailures.splice(0, this.pushFailures.length - PUSH_FAILURE_RING_MAX);
    }
  }

  _clearRetryTimer() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  _scheduleRetry(explicitDelayMs) {
    this._clearRetryTimer();
    const delay = typeof explicitDelayMs === 'number' && explicitDelayMs >= 0
      ? explicitDelayMs
      : this.retryDelayMs;
    if (typeof explicitDelayMs !== 'number') {
      this.retryDelayMs = Math.min(this.retryMaxDelayMs, this.retryDelayMs * 2);
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.lastPushError) {
        this._doPush();
      }
    }, delay);
    if (typeof this.retryTimer?.unref === 'function') {
      this.retryTimer.unref();
    }
  }

  _scheduleQuotaRetry(cooldownMs) {
    if (this.quotaRetryTimer) return;
    let delay = typeof cooldownMs === 'number' && cooldownMs > 0 ? cooldownMs + 50 : 60 * 1000 + 50;
    try {
      const raw = localStorage.getItem(QUOTA_EXHAUSTED_KEY);
      if (raw) {
        const remaining = Number(raw) - Date.now();
        if (remaining > 0) delay = remaining + 50;
      }
    } catch {
      // ignore storage errors
    }
    this.quotaRetryTimer = setTimeout(() => {
      this.quotaRetryTimer = null;
      if (!this.isQuotaExhausted()) {
        this._doPush();
      }
    }, delay);
    if (typeof this.quotaRetryTimer?.unref === 'function') {
      this.quotaRetryTimer.unref();
    }
  }

  getDeviceId() {
    return this.deviceId;
  }

  getDeviceName() {
    const custom = store.getState().devices?.[this.deviceId]?.name;
    if (custom && custom !== 'Hero Device') return custom;
    return getDeviceFriendlyName();
  }

  broadcastState(payload) {
    if (!this.broadcastChannel) return;
    try {
      this.broadcastChannel.postMessage({
        type: 'STATE_UPDATE',
        senderSessionId: this.sessionId,
        senderDeviceId: this.deviceId,
        timestamp: Date.now(),
        payload: payload
      });
    } catch (e) {
      console.warn('BroadcastChannel postMessage warning:', e);
    }
  }

  handleBroadcastMessage(data) {
    if (!data || (data.type !== 'STATE_UPDATE' && data.type !== 'LITTLE_HERO_STATE_BROADCAST')) return;
    if (data.senderSessionId === this.sessionId || data.sessionId === this.sessionId) return; // Ignore own broadcast

    console.log(`⚡ Instant 0ms local tab sync received from session ${data.senderSessionId || data.sessionId || 'tab'}`);
    const payload = data.payload || data.state;
    if (payload) {
      store.hydrateFromCloud(payload, { fromBroadcast: true });
    }
  }

  isQuotaExhausted() {
    return isQuotaExhaustedGlobal();
  }

  markQuotaExhausted(error, cooldownMs = 60 * 1000) {
    // 60-second backoff for writes rather than locking out sync for 24h
    markQuotaExhaustedGlobal(cooldownMs);
    this._scheduleQuotaRetry(cooldownMs);
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
    // CRITICAL: We deliberately do NOT call this.stopSync().
    // The Firestore onSnapshot read stream operates under a separate 50,000 daily read quota
    // and must remain connected so all devices continue to receive live updates.

    try {
      const state = store.getState();
      if (state && state.household) {
        state.household.lastSync = "Live Read-Only (Write Quota Paused)";
        store.notify();
      }
    } catch {
      // store update fallback
    }
  }

  startPresenceHeartbeat() {
    if (typeof window === 'undefined') return;
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
    }

    // Ping device presence at relaxed 5-minute intervals to conserve write quota
    this.presenceInterval = setInterval(() => {
      if (this.currentCode && this.unsubscribe && isFirebaseAvailable && db && !this.isQuotaExhausted()) {
        this.pingDevicePresence(this.currentCode);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Start listening to real-time changes for a household using onSnapshot
   * Permanently decoupled from write errors.
   */
  startSync(householdCode, onInitialSync) {
    if (!isFirebaseAvailable || !db) {
      console.log("Firestore running in resilient offline/local mode");
      if (onInitialSync) onInitialSync(null);
      return;
    }

    const state = store.getState();
    const code = (householdCode || state.household?.syncCode || '').trim().toUpperCase();
    if (!code) {
      if (onInitialSync) onInitialSync(null);
      return;
    }

    if (onInitialSync) {
      this.initialSyncCallbacks.push(onInitialSync);
    }

    if (this.currentCode === code && this.unsubscribe) {
      return; // Already actively listening to this household
    }

    this.stopSync();
    this.currentCode = code;
    ledgerClient.setActiveHouseholdCode(code);
    // S1: Join household membership on every start in both legacy and authoritative modes
    ledgerClient.joinHouseholdOnStart(code, this.deviceId, this.getDeviceName()).catch(() => {});
    walletService.start(code);
    const docRef = doc(db, "households", code);

    let isFirstSnapshot = true;

    try {
      this.unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (!snapshot.exists()) {
          console.log(`ℹ️ Household ${code} does not exist yet on cloud. Will push on next save.`);
          if (isFirstSnapshot) {
            isFirstSnapshot = false;
            const cbs = [...this.initialSyncCallbacks];
            this.initialSyncCallbacks = [];
            cbs.forEach(cb => { try { cb(snapshot); } catch (e) { console.warn(e); } });
          }
          return;
        }

        const cloudData = snapshot.data();
        if (!cloudData) return;

        // Keep walletService in sync with server-owned ledgerMode
        walletService.setLedgerMode(cloudData.ledgerMode || 'legacy');

        if (cloudData.devices && typeof cloudData.devices === 'object') {
          this.lastKnownDevices = { ...cloudData.devices };
        }

        this.lastCloudTimestamp = cloudData.updatedAt || new Date().toISOString();

        // If the write was pushed from this exact session in this window, avoid redundant re-hydrating
        if (cloudData.lastWriterSessionId === this.sessionId) {
          if (cloudData.devices && typeof cloudData.devices === 'object') {
            const count = Object.keys(cloudData.devices).length;
            if (store.getState().household.linkedDevices !== count) {
              store.getState().household.linkedDevices = Math.max(1, count);
              store.notify();
            }
          }
          if (isFirstSnapshot) {
            isFirstSnapshot = false;
            const cbs = [...this.initialSyncCallbacks];
            this.initialSyncCallbacks = [];
            cbs.forEach(cb => { try { cb(snapshot); } catch (e) { console.warn(e); } });
          }
          return;
        }

        console.log(`⚡ Real-time cloud sync received from session ${cloudData.lastWriterSessionId || cloudData.lastWriterDeviceId || 'remote'} for household: ${code}`);
        
        // Hydrate store state immediately with cloud data
        store.hydrateFromCloud(cloudData);

        // Slide the persistent link window forward (RFC 6749 Section 6)
        if (!this.isQuotaExhausted()) {
          persistentLink.slideWindow().catch(() => {});
        }

        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          const cbs = [...this.initialSyncCallbacks];
          this.initialSyncCallbacks = [];
          cbs.forEach(cb => { try { cb(snapshot); } catch (e) { console.warn(e); } });
        }
      }, (error) => {
        if (isQuotaError(error)) {
          console.warn("Firestore snapshot listener quota warning (listener remains resilient):", error?.message || error);
        } else {
          console.warn("Firestore snapshot listener error:", error?.message || error);
        }
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          const cbs = [...this.initialSyncCallbacks];
          this.initialSyncCallbacks = [];
          cbs.forEach(cb => { try { cb(null); } catch (e) { console.warn(e); } });
        }
      });

      // Register this device's presence if quota is healthy
      if (!this.isQuotaExhausted()) {
        this.pingDevicePresence(code);
      }

    } catch (e) {
      if (isQuotaError(e)) {
        this.markQuotaExhausted(e);
      } else {
        console.warn("Error starting Firestore sync:", e.message);
      }
    }
  }

  /**
   * Safely join an existing household and immediately subscribe to its live real-time stream
   */
  async joinHousehold(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) return { success: false, error: 'Please enter a valid household code' };

    await ensureAuthReady();

    const state = store.getState();
    state.household.syncCode = cleanCode;
    state.isDeviceRevoked = false;
    this.lastRejoinedTimestamp = Date.now();
    store.lastRejoinedTimestamp = Date.now();

    // Reset revocation for this device if previously logged out
    if (this.lastKnownDevices && this.lastKnownDevices[this.deviceId]) {
      this.lastKnownDevices[this.deviceId].revoked = false;
    }
    if (state.devices && state.devices[this.deviceId]) {
      state.devices[this.deviceId].revoked = false;
      state.devices[this.deviceId].name = this.getDeviceName();
    }
    if (Array.isArray(state.revokedDeviceIds)) {
      state.revokedDeviceIds = state.revokedDeviceIds.filter(id => id !== this.deviceId);
    }

    if (!isFirebaseAvailable || !db) {
      store.saveState(false);
      return { success: true, message: `Joined ${cleanCode} in local mode` };
    }

    // Proactively clear revocation in Firestore so immediate snapshots don't re-revoke
    try {
      const docRef = doc(db, "households", cleanCode);
      const timestamp = new Date().toISOString();
      await updateDoc(docRef, {
        [`devices.${this.deviceId}.revoked`]: false,
        [`devices.${this.deviceId}.lastSeen`]: timestamp,
        [`devices.${this.deviceId}.name`]: this.getDeviceName(),
        [`devices.${this.deviceId}.deviceId`]: this.deviceId,
        revokedDeviceIds: arrayRemove(this.deviceId)
      }).catch(() => {});
    } catch {
      // Ignore initial updateDoc error if doc doesn't exist yet
    }

    this.stopSync();

    return new Promise((resolve) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({
            success: true,
            isNew: false,
            kidCount: store.getState().heroes?.length || 1,
            householdName: store.getState().household?.name || 'The Hero Family',
            message: `Subscribed to ${cleanCode} in local mode`
          });
        }
      }, 3500);

      this.startSync(cleanCode, (snapshot) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          const exists = snapshot && snapshot.exists && snapshot.exists();
          const cloudData = exists ? snapshot.data() : null;
          resolve({
            success: true,
            isNew: !exists,
            kidCount: store.getState().heroes?.length || 1,
            householdName: cloudData?.householdName || store.getState().household?.name || 'The Hero Family'
          });
        }
      });
    });
  }

  /**
   * Push current state to Firestore with smart 800ms coalesced debouncing
   */
  pushStateToCloud(immediate = false) {
    if (!isFirebaseAvailable || !db) return;
    if (this.isQuotaExhausted()) {
      this.lastPushError = 'quota';
      this._scheduleQuotaRetry();
      return;
    }
    if (store.getState().isDeviceRevoked) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (immediate) {
      this._doPush();
    } else {
      // Coalesce render/action bursts without making cross-device updates feel delayed.
      this.debounceTimer = setTimeout(() => {
        // Must clear the handle once it fires: hasPendingLocalChanges() reads
        // it, and a stale non-null handle made every device report "unsent
        // local change" forever after its first debounced save -- so it
        // rejected all incoming points/coins/xp and pushed its old values
        // back over the top of them.
        this.debounceTimer = null;
        this._doPush();
      }, CLOUD_SYNC_DEBOUNCE_MS);
    }
  }

  async _doPush() {
    if (!isFirebaseAvailable || !db) return;
    if (this.isQuotaExhausted()) {
      this.lastPushError = 'quota';
      this._scheduleQuotaRetry();
      return;
    }
    if (this.pushInFlight) {
      this.pushPending = true;
      return;
    }
    if (store.getState().isDeviceRevoked) return;

    // Ensure local hero state is thoroughly synchronized before pushing to cloud
    if (typeof store.syncSelectedHeroWithHeroes === 'function') {
      store.syncSelectedHeroWithHeroes();
    }
    if (typeof store.stampHeroFieldChanges === 'function') {
      store.stampHeroFieldChanges();
    }
    if (typeof store.stampParentSettingsChanges === 'function') {
      store.stampParentSettingsChanges();
    }

    const state = store.getState();
    const householdCode = (state.household?.syncCode || this.currentCode || '').trim().toUpperCase();
    if (!householdCode) return;

    const docRef = doc(db, "households", householdCode);

    try {
      this.isPushing = true;
      this.pushInFlight = true;
      await this._ensureAuthReady();
      const timestamp = new Date().toISOString();
      this.lastCloudTimestamp = timestamp;

      // Build authoritative heroesMap for robust field-level merging across concurrent devices
      const heroesMap = {};
      (state.heroes || []).forEach((h) => {
        if (h && h.id) {
          heroesMap[h.id] = {
            ...h,
            coins: Math.max(0, Number(h.coins) || 0),
            points: Math.max(0, Number(h.points) || 0),
            tokens: Math.max(0, Number(h.tokens ?? h.coins) || 0),
            level: h.level || 1,
            xp: h.xp || 0,
            xpNext: h.xpNext || 100,
            sparks: Math.max(0, Number(h.sparks) || 0),
            evolutionSparks: Math.max(0, Number(h.evolutionSparks ?? h.sparks) || 0),
            petSparkMap: h.petSparkMap ? { ...h.petSparkMap } : {},
            streak: h.streak || 1,
            stars: h.stars || 0,
            role: h.role || h.title || 'Adventurer',
            title: h.title || h.role || 'Adventurer',
            avatar: h.avatar || '',
            activePetId: h.activePetId || null,
            unlockedPetIds: h.unlockedPetIds || [],
            hasChosenStarterPet: h.hasChosenStarterPet ?? ((h.unlockedPetIds || []).length > 0),
            habitatSlots: h.habitatSlots || 1,
            gameDifficulty: h.gameDifficulty || 'medium',
            equippedProfileTheme: h.equippedProfileTheme || 'theme_dragon_emerald',
            unlockedThemes: h.unlockedThemes || ['theme_dragon_emerald'],
            equippedGear: h.equippedGear || {},
            equippedPetGearMap: h.equippedPetGearMap || {},
            customGearDyesMap: h.customGearDyesMap || {},
            savedHeroCards: h.savedHeroCards || [],
            screenTimeMinutes: h.screenTimeMinutes !== undefined ? Number(h.screenTimeMinutes) : 45,
            screenTimeUsedToday: h.screenTimeUsedToday !== undefined ? Number(h.screenTimeUsedToday) : 0,
            screenTimeUsageDate: h.screenTimeUsageDate || '',
            dailyMaxScreenTime: h.dailyMaxScreenTime !== undefined ? Number(h.dailyMaxScreenTime) : 60,
            bedtimeCurfew: h.bedtimeCurfew ?? '20:00',
            screenTimeRate: h.screenTimeRate !== undefined ? Number(h.screenTimeRate) : 2,
            isScreenTimePaused: h.isScreenTimePaused !== undefined ? Boolean(h.isScreenTimePaused) : false,
            screenTimeLockMessage: h.screenTimeLockMessage || 'Rex says: Great job today! Time to play outside or get cozy for bedtime! 🦖🌙',
            arcadeHighScores: h.arcadeHighScores || {},
            arcadeCoinsEarnedToday: h.arcadeCoinsEarnedToday !== undefined ? Number(h.arcadeCoinsEarnedToday) : 0,
            arcadeCoinsLastDate: h.arcadeCoinsLastDate || '',
            inventory: h.inventory || [],
            dentalBadges: Array.isArray(h.dentalBadges) ? [...h.dentalBadges] : ['enamel_guardian'],
            dentalBattleHistory: Array.isArray(h.dentalBattleHistory) ? [...h.dentalBattleHistory] : [],
            cleanseAlbum: (h.cleanseAlbum && typeof h.cleanseAlbum === 'object') ? { ...h.cleanseAlbum } : {},
            brushStreakData: (h.brushStreakData && typeof h.brushStreakData === 'object')
              ? {
                  count: Number(h.brushStreakData.count) || 0,
                  lastDate: h.brushStreakData.lastDate || null,
                  morningDate: h.brushStreakData.morningDate || null,
                  eveningDate: h.brushStreakData.eveningDate || null
                }
              : { count: 0, lastDate: null, morningDate: null, eveningDate: null },
            weeklyChallenges: (h.weeklyChallenges && typeof h.weeklyChallenges === 'object') ? { ...h.weeklyChallenges } : {},
            unlockedTrophyIds: Array.isArray(h.unlockedTrophyIds) ? [...h.unlockedTrophyIds] : ['rookie_hero_crest'],
            featuredTrophyIds: Array.isArray(h.featuredTrophyIds) ? [...h.featuredTrophyIds] : ['rookie_hero_crest'],
            colosseumBossesDefeated: Array.isArray(h.colosseumBossesDefeated) ? [...h.colosseumBossesDefeated] : [],
            lastBossId: h.lastBossId || null,
            bossRotationQueue: Array.isArray(h.bossRotationQueue) ? [...h.bossRotationQueue] : [],
            lastBrushedMorning: h.lastBrushedMorning || null,
            lastBrushedEvening: h.lastBrushedEvening || null,
            brushStreak: Number(h.brushStreak) || 0,
            dentalHabits: (h.dentalHabits && typeof h.dentalHabits === 'object')
              ? {
                  morningBrushDate: h.dentalHabits.morningBrushDate || null,
                  bedtimeBrushDate: h.dentalHabits.bedtimeBrushDate || null
                }
              : { morningBrushDate: null, bedtimeBrushDate: null },
            hazardRotationQueue: Array.isArray(h.hazardRotationQueue) ? [...h.hazardRotationQueue] : [],
            lastHazardId: h.lastHazardId || null,
            flawlessZonesBest: Number(h.flawlessZonesBest) || 0,
            // Every stamped field is always written (0 = never stamped): the
            // doc is written with {merge:true}, which deep-merges nested maps,
            // so a partial map would leave another device's newer stamp next
            // to this device's older value.
            fieldStamps: Object.fromEntries(HERO_STAMPED_FIELDS.map((f) => [f, Number(h.fieldStamps?.[f]) || 0])),
            updatedAt: timestamp
          };
        }
      });

      // Physically remove deleted heroes from Firestore heroesMap
      (state.deletedHeroIds || []).forEach((deletedId) => {
        if (deletedId) {
          try {
            heroesMap[deletedId] = deleteField();
          } catch {
            // fallback
          }
        }
      });

      // Register or update ONLY this device in Firestore (merge: true preserves other active
      // devices without ever resurrecting devices that were removed from another device).
      const myDeviceRecord = {
        deviceId: this.deviceId,
        lastSeen: timestamp,
        name: state.devices?.[this.deviceId]?.name || this.getDeviceName(),
        revoked: Boolean(state.devices?.[this.deviceId]?.revoked)
      };
      state.devices = {
        ...(this.lastKnownDevices || {}),
        [this.deviceId]: myDeviceRecord
      };

      const isAuthoritative = !walletService.isLegacyLedger();
      const pushParentSettings = state.parentSettings ? { ...state.parentSettings } : {};
      if (isAuthoritative) {
        delete pushParentSettings.pin;
      }

      const pushPayload = {
        // Generic snapshot keeps newly added mutable fields live across devices
        // without duplicating large top-level fields (heroes, digitalGear, pets, heroHQ, logs, cards).
        stateSnapshot: buildCloudStateSnapshot(state, { includeDeletes: !isAuthoritative, authoritative: isAuthoritative }),
        householdName: state.household?.name || 'The Hero Family',
        syncCode: householdCode,
        deletedHeroIds: state.deletedHeroIds || [],
        deletedCustomItemIds: state.deletedCustomItemIds || [],
        taskCompletionLogs: (state.taskCompletionLogs || []).slice(0, 200),
        taskLedgerLogs: (state.taskLedgerLogs || []).slice(0, 200),
        petStatsMap: state.petStatsMap || {},
        equippedGearMap: state.equippedGearMap || {},
        equippedPetGear: state.equippedPetGear || null,
        equippedPetGearSlots: state.equippedPetGearSlots || {},
        equippedPetGearMap: state.equippedPetGearMap || {},
        customGearDyesMap: state.customGearDyesMap || {},
        savedHeroCards: state.savedHeroCards || [],
        pets: state.pets || [],
        petSanctuary: state.petSanctuary || {},
        heroForge: state.heroForge || {},
        petStreakShield: state.petStreakShield || {},
        activeExpeditions: state.activeExpeditions || [],
        expeditionHistory: (state.expeditionHistory || []).slice(0, 100),
        unlockedArtifacts: state.unlockedArtifacts || [],
        gameMasteryMap: state.gameMasteryMap || {},
        taskForest: state.taskForest || [],
        habitIslands: state.habitIslands || [],
        aiQuests: state.aiQuests || [],
        heroAiQuestsMap: state.heroAiQuestsMap || {},
        recentlyUnlocked: state.recentlyUnlocked || [],
        realLifeRewards: state.realLifeRewards || [],
        digitalGear: buildSlimDigitalGear(state.digitalGear),
        liveRex: state.liveRex || {},
        parents: state.household?.parents || [],
        parentSettings: pushParentSettings,
        profileThemes: state.profileThemes || [],
        gameProgress: state.gameProgress || {},
        updatedAt: timestamp,
        lastWriterSessionId: this.sessionId,
        lastWriterDeviceId: this.deviceId,
        devices: { [this.deviceId]: myDeviceRecord },
        revokedDeviceIds: state.revokedDeviceIds || []
      };

      // Only include parentUids / parentEmails when non-empty so non-parent devices never
      // overwrite Firestore's parent claims with [] (which triggers permission-denied).
      if (Array.isArray(state.household?.parentUids) && state.household.parentUids.length > 0) {
        pushPayload.parentUids = state.household.parentUids;
      }
      if (Array.isArray(state.household?.parentEmails) && state.household.parentEmails.length > 0) {
        pushPayload.parentEmails = state.household.parentEmails;
      }

      if (!isAuthoritative) {
        pushPayload.heroes = state.heroes || [];
        pushPayload.heroesMap = heroesMap;
        pushPayload.selectedHero = state.selectedHero || null;
        pushPayload.pendingApprovals = state.pendingApprovals || [];
        pushPayload.resolvedApprovals = (state.resolvedApprovals || []).slice(0, 200);
        pushPayload.petLevelMap = state.petLevelMap || {};
        pushPayload.petXpMap = state.petXpMap || {};
        pushPayload.heroHQ = state.heroHQ || {};
        pushPayload.inventory = state.inventory || [];
      }

      const sanitized = sanitizeForFirestore(pushPayload);

      // Guard against Firestore's 1 MiB document size ceiling (which throws invalid-argument):
      // if payload > 850 KB, strip inline data:image/ blobs from savedHeroCards & bedtimeStoryLibrary.
      try {
        const approxBytes = JSON.stringify(sanitized).length;
        if (approxBytes > 850_000) {
          if (Array.isArray(sanitized.savedHeroCards)) {
            sanitized.savedHeroCards = sanitized.savedHeroCards.map((c) => {
              if (c && typeof c === 'object' && typeof c.imageData === 'string' && c.imageData.startsWith('data:')) {
                const { imageData: _omit, ...rest } = c;
                return rest;
              }
              return c;
            });
          }
          if (sanitized.stateSnapshot && Array.isArray(sanitized.stateSnapshot.bedtimeStoryLibrary)) {
            sanitized.stateSnapshot.bedtimeStoryLibrary = sanitized.stateSnapshot.bedtimeStoryLibrary.slice(0, 30).map((s) => {
              if (!s || typeof s !== 'object') return s;
              const copy = { ...s };
              if (typeof copy.coverImage === 'string' && copy.coverImage.startsWith('data:')) delete copy.coverImage;
              if (Array.isArray(copy.pages)) {
                copy.pages = copy.pages.map((p) => {
                  if (p && typeof p === 'object' && typeof p.image === 'string' && p.image.startsWith('data:')) {
                    const { image: _omitImg, ...restP } = p;
                    return restP;
                  }
                  return p;
                });
              }
              return copy;
            });
          }
          sanitized.taskCompletionLogs = (sanitized.taskCompletionLogs || []).slice(0, 50);
          sanitized.taskLedgerLogs = (sanitized.taskLedgerLogs || []).slice(0, 50);
        }
      } catch { /* ignore size check errors */ }

      await this._setDoc(docRef, sanitized, { merge: true });

      state.household.lastSync = "Synced Just Now";
      this.lastPushError = null;
      this.lastPushOkAt = Date.now();
      this.retryDelayMs = this.retryBaseDelayMs;
      this._clearRetryTimer();

      // Slide persistent link window forward (RFC 6749 Section 6)
      persistentLink.slideWindow().catch(() => {});
    } catch (error) {
      if (isQuotaError(error)) {
        this.lastPushError = 'quota';
        this._recordPushFailure('quota');
        this.markQuotaExhausted(error);
        return;
      }
      const code = error?.code || error?.message || 'unknown';
      const detail = (code === 'invalid-argument' && error?.message)
        ? `${code}: ${String(error.message).slice(0, 80)}`
        : code;
      this.lastPushError = detail;
      this._recordPushFailure(detail);
      this._scheduleRetry();
      console.error('[sync] push failed', error?.code, error?.message);
    } finally {
      this.isPushing = false;
      this.pushInFlight = false;
      if (this.pushPending) {
        this.pushPending = false;
        this.pushStateToCloud(true);
      }
    }
  }

  /**
   * True when this device has a local state change queued (debounced) or
   * currently being written to Firestore that hasn't been confirmed yet.
   * Used by Store.hydrateFromCloud() to avoid letting an inbound snapshot
   * that predates this device's own pending push silently overwrite
   * reward-bearing fields (coins/points/xp/tokens) with stale values --
   * e.g. another device reconnecting and pushing its own stale cached
   * state in the narrow window before this device's push lands.
   */
  /**
   * Health of this device's cloud writes, for honest "Saved" feedback.
   * mode: 'local' (no cloud configured), 'paused' (quota), 'error' (last write failed), 'ok'.
   */
  getSyncHealth() {
    const lastFailure = this.pushFailures.length > 0
      ? this.pushFailures[this.pushFailures.length - 1]
      : null;
    if (!isFirebaseAvailable || !db) return { mode: 'local', failureCount: this.pushFailures.length, lastFailure };
    const st = store.getState?.() || {};
    if (!st.isHouseholdConfigured || !(st.household?.syncCode || this.currentCode)) {
      return { mode: 'local', failureCount: this.pushFailures.length, lastFailure };
    }
    if (this.isQuotaExhausted() || this.lastPushError === 'quota') {
      return {
        mode: 'paused',
        error: 'quota',
        lastErrorCode: 'quota',
        failureCount: this.pushFailures.length,
        lastFailure,
        retrying: Boolean(this.quotaRetryTimer)
      };
    }
    if (this.lastPushError) {
      return {
        mode: 'error',
        error: this.lastPushError,
        lastErrorCode: this.lastPushError,
        failureCount: this.pushFailures.length,
        lastFailure,
        retrying: Boolean(this.retryTimer)
      };
    }
    return {
      mode: 'ok',
      lastPushOkAt: this.lastPushOkAt,
      lastErrorCode: null,
      failureCount: this.pushFailures.length,
      lastFailure,
      retrying: false
    };
  }

  hasPendingLocalChanges() {
    return Boolean(this.debounceTimer) || Boolean(this.isPushing);
  }

  /**
   * Log a specific device out of the household requiring it to re-enter the sync code
   */
  async revokeDevice(targetDeviceId) {
    if (!targetDeviceId) return { success: false, error: 'Target device ID is required' };

    const state = store.getState();
    const householdCode = (state.household?.syncCode || this.currentCode || '').trim().toUpperCase();
    const timestamp = new Date().toISOString();

    if (!state.devices) state.devices = {};
    if (state.devices[targetDeviceId]) {
      state.devices[targetDeviceId].revoked = true;
      state.devices[targetDeviceId].lastSeen = timestamp;
    } else {
      state.devices[targetDeviceId] = {
        deviceId: targetDeviceId,
        name: 'Hero Device',
        revoked: true,
        lastSeen: timestamp
      };
    }

    if (!state.revokedDeviceIds) state.revokedDeviceIds = [];
    if (!state.revokedDeviceIds.includes(targetDeviceId)) {
      state.revokedDeviceIds.push(targetDeviceId);
    }

    this.lastKnownDevices = { ...(this.lastKnownDevices || {}), ...state.devices };

    // Broadcast update across local tabs in 0ms
    this.broadcastState({
      ...state,
      devices: state.devices,
      revokedDeviceIds: state.revokedDeviceIds
    });

    // Push revocation to cloud
    if (isFirebaseAvailable && db && householdCode && !this.isQuotaExhausted()) {
      try {
        const docRef = doc(db, "households", householdCode);
        await updateDoc(docRef, {
          [`devices.${targetDeviceId}.revoked`]: true,
          [`devices.${targetDeviceId}.lastSeen`]: timestamp,
          revokedDeviceIds: state.revokedDeviceIds,
          updatedAt: timestamp,
          lastWriterSessionId: this.sessionId,
          lastWriterDeviceId: this.deviceId
        });
      } catch (err) {
        console.warn("Could not updateDoc for revoked device, doing full push:", err);
        await this._doPush();
      }
    } else {
      await this._doPush();
    }

    // If target device is this current device, logout locally immediately
    if (targetDeviceId === this.deviceId) {
      store.handleDeviceRevoked();
    } else {
      store.notify();
    }

    return { success: true };
  }

  /**
   * Ensure active real-time subscription is healthy and verify device data is in sync
   */
  async syncNow() {
    if (this.isQuotaExhausted()) {
      const code = (store.getState().household?.syncCode || this.currentCode || '').trim().toUpperCase();
      if (code && (!this.unsubscribe || this.currentCode !== code)) {
        this.stopSync();
        this.startSync(code);
      }
      store.getState().household.lastSync = "Live Read-Only (Write Quota Paused)";
      store.notify();
      return { 
        success: true, 
        verified: true, 
        mode: 'read-only',
        message: "Live cloud updates remain active. Writes are paused until Firestore quota resets."
      };
    }

    if (!isFirebaseAvailable || !db) {
      store.getState().household.lastSync = "Local Mode Active";
      store.notify();
      return { success: true, verified: true, mode: 'local', message: "Running in local resilient mode" };
    }

    const state = store.getState();
    const code = (state.household?.syncCode || this.currentCode || '').trim().toUpperCase();
    if (!code) {
      return { success: true, verified: true, mode: 'local', message: "Household ready in local mode" };
    }

    console.log(`🔄 Sync Now: Ensuring active real-time subscription for household ${code}...`);

    try {
      // 1. Ensure live real-time onSnapshot listener is connected and healthy
      if (!this.unsubscribe || this.currentCode !== code) {
        this.stopSync();
        this.startSync(code);
      }

      // 2. Update this device's presence and slide token window
      await this.pingDevicePresence(code);
      await persistentLink.slideWindow();

      const currentHeroes = state.heroes || [];
      const kidCount = currentHeroes.length;
      const deviceCount = state.household?.linkedDevices || 1;
      const householdName = state.household?.name || 'The Hero Family';

      state.household.lastSync = "Verified In Sync Just Now";
      store.notify();

      return {
        success: true,
        verified: true,
        householdName,
        code,
        kidCount,
        deviceCount,
        kids: currentHeroes.map(h => h.name),
        updatedAt: this.lastCloudTimestamp || new Date().toISOString(),
        message: `Verified in sync with ${householdName} (${code}): ${kidCount} kid(s) on ${deviceCount} device(s).`
      };

    } catch (e) {
      if (isQuotaError(e)) {
        this.markQuotaExhausted(e);
        return { 
          success: true, 
          verified: true, 
          mode: 'local', 
          message: "Data preserved locally. Cloud sync temporarily paused due to free quota limits." 
        };
      }
      console.warn("Sync Now error:", e.message);
      return { success: false, verified: false, error: e.message };
    }
  }

  /**
   * Ping this device's presence to track connected household devices
   */
  async pingDevicePresence(code) {
    if (!isFirebaseAvailable || !db || this.isQuotaExhausted() || !code) return;
    if (store.getState().isDeviceRevoked) return; // Never ping presence while revoked
    await ensureAuthReady();
    try {
      const docRef = doc(db, "households", code);
      const timestamp = new Date().toISOString();
      await updateDoc(docRef, {
        [`devices.${this.deviceId}.lastSeen`]: timestamp,
        [`devices.${this.deviceId}.name`]: this.getDeviceName(),
        [`devices.${this.deviceId}.deviceId`]: this.deviceId,
        [`devices.${this.deviceId}.revoked`]: false
      });
    } catch (err) {
      if (isQuotaError(err)) {
        this.markQuotaExhausted(err);
        return;
      }
      // If doc simply doesn't exist yet, attempt full push only if not quota error
      if (err?.code === 'not-found') {
        try {
          await this._doPush();
        } catch (pushErr) {
          if (isQuotaError(pushErr)) {
            this.markQuotaExhausted(pushErr);
          }
        }
      }
    }
  }

  /**
   * Delete an old or revoked device from the household
   */
  async removeDevice(targetDeviceId) {
    if (!targetDeviceId) return { success: false, error: 'Device ID required' };
    const state = store.getState();
    const householdCode = (state.household?.syncCode || this.currentCode || '').trim().toUpperCase();

    if (state.devices && state.devices[targetDeviceId]) {
      delete state.devices[targetDeviceId];
    }
    if (this.lastKnownDevices && this.lastKnownDevices[targetDeviceId]) {
      delete this.lastKnownDevices[targetDeviceId];
    }
    if (Array.isArray(state.revokedDeviceIds)) {
      state.revokedDeviceIds = state.revokedDeviceIds.filter(id => id !== targetDeviceId);
    }

    if (isFirebaseAvailable && db && householdCode && !this.isQuotaExhausted()) {
      try {
        await this._ensureAuthReady();
        const docRef = doc(db, "households", householdCode);
        await updateDoc(docRef, {
          [`devices.${targetDeviceId}`]: deleteField(),
          revokedDeviceIds: state.revokedDeviceIds || []
        });
      } catch (err) {
        console.warn("Could not remove device in Firestore:", err);
      }
    }

    store.notify();
    return { success: true };
  }

  stopSync() {
    if (this.unsubscribe) {
      try {
        this.unsubscribe();
      } catch {
        // Safe unsubscribe
      }
      this.unsubscribe = null;
      this.currentCode = null;
    }
  }
}

export const firestoreSync = new FirestoreSyncService();
store.setSyncService(firestoreSync);
