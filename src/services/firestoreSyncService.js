import { doc, setDoc, onSnapshot, updateDoc, deleteField } from "firebase/firestore";
import { db, isFirebaseAvailable } from "../config/firebase.js";
import { store, STORAGE_KEY } from "../state/store.js";
import { persistentLink } from "./persistentLinkService.js";

const DEVICE_ID_KEY = 'stitch_device_id';
const QUOTA_EXHAUSTED_KEY = 'firestore_quota_exhausted_until';
const CLOUD_SYNC_DEBOUNCE_MS = 350;

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
  'activeDrawer'
]);

function buildCloudStateSnapshot(state) {
  const snapshot = {};
  Object.entries(state || {}).forEach(([key, value]) => {
    if (LOCAL_ONLY_STATE_KEYS.has(key) || key === 'devices') return;
    if (key === 'household' && value && typeof value === 'object') {
      snapshot.household = { ...value, lastSync: undefined };
      delete snapshot.household.lastSync;
      return;
    }
    snapshot[key] = value;
  });
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
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev_' + Math.random().toString(36).substring(2, 9);
  }
}

class FirestoreSyncService {
  constructor() {
    this.unsubscribe = null;
    this.isPushing = false;
    this.currentCode = null;
    this.deviceId = getOrCreateDeviceId();
    this.sessionId = 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    this.debounceTimer = null;
    this.lastCloudTimestamp = null;
    this.lastKnownDevices = {};
    this.initialSyncCallbacks = [];
    this.presenceInterval = null;
    this.pushInFlight = false;
    this.pushPending = false;

    this.startPresenceHeartbeat();
  }

  isQuotaExhausted() {
    return isQuotaExhaustedGlobal();
  }

  markQuotaExhausted(error) {
    markQuotaExhaustedGlobal();
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }

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

    // Ping device presence at relaxed 5-minute intervals (not rapid 20s) to conserve write quota
    this.presenceInterval = setInterval(() => {
      if (this.currentCode && this.unsubscribe && isFirebaseAvailable && db && !this.isQuotaExhausted()) {
        this.pingDevicePresence(this.currentCode);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Start listening to real-time changes for a household using onSnapshot
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

        if (cloudData.devices && typeof cloudData.devices === 'object') {
          this.lastKnownDevices = { ...(this.lastKnownDevices || {}), ...cloudData.devices };
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
          this.markQuotaExhausted(error);
        } else {
          console.warn("Firestore snapshot listener error:", error.message);
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

    const state = store.getState();
    state.household.syncCode = cleanCode;

    if (!isFirebaseAvailable || !db) {
      store.saveState(false);
      return { success: true, message: `Joined ${cleanCode} in local mode` };
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
   * Push current state to Firestore with debouncing
   */
  pushStateToCloud(immediate = false) {
    if (!isFirebaseAvailable || !db || this.isQuotaExhausted()) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (immediate) {
      this._doPush();
    } else {
      // Coalesce render/action bursts without making cross-device updates feel delayed.
      this.debounceTimer = setTimeout(() => {
        this._doPush();
      }, CLOUD_SYNC_DEBOUNCE_MS);
    }
  }

  async _doPush() {
    if (!isFirebaseAvailable || !db || this.isQuotaExhausted()) return;
    if (this.pushInFlight) {
      this.pushPending = true;
      return;
    }

    // Ensure local hero state is thoroughly synchronized before pushing to cloud
    if (typeof store.syncSelectedHeroWithHeroes === 'function') {
      store.syncSelectedHeroWithHeroes();
    }

    const state = store.getState();
    const householdCode = (state.household?.syncCode || this.currentCode || '').trim().toUpperCase();
    if (!householdCode) return;

    const docRef = doc(db, "households", householdCode);

    try {
      this.isPushing = true;
      this.pushInFlight = true;
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
            streak: h.streak || 1,
            stars: h.stars || 0,
            role: h.role || h.title || 'Adventurer',
            title: h.title || h.role || 'Adventurer',
            avatar: h.avatar || '',
            activePetId: h.activePetId || null,
            unlockedPetIds: h.unlockedPetIds || [],
            hasChosenStarterPet: h.hasChosenStarterPet ?? ((h.unlockedPetIds || []).length > 0),
            petStageMap: h.petStageMap || {},
            habitatSlots: h.habitatSlots || 1,
            gameDifficulty: h.gameDifficulty || 'medium',
            equippedProfileTheme: h.equippedProfileTheme || 'theme_dragon_emerald',
            unlockedThemes: h.unlockedThemes || ['theme_dragon_emerald'],
            equippedGear: h.equippedGear || {},
            inventory: h.inventory || [],
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

      await setDoc(docRef, {
        // Generic snapshot keeps newly added mutable fields live across devices
        // without requiring a fragile allowlist update for every feature.
        stateSnapshot: buildCloudStateSnapshot(state),
        householdName: state.household?.name || 'The Hero Family',
        syncCode: householdCode,
        heroes: state.heroes || [],
        heroesMap: heroesMap,
        deletedHeroIds: state.deletedHeroIds || [],
        selectedHero: state.selectedHero || null,
        pendingApprovals: state.pendingApprovals || [],
        taskCompletionLogs: state.taskCompletionLogs || [],
        taskLedgerLogs: state.taskLedgerLogs || [],
        petStatsMap: state.petStatsMap || {},
        petStageMap: state.petStageMap || {},
        equippedGearMap: state.equippedGearMap || {},
        equippedPetGear: state.equippedPetGear || null,
        pets: state.pets || [],
        taskForest: state.taskForest || [],
        habitIslands: state.habitIslands || [],
        aiQuests: state.aiQuests || [],
        recentlyUnlocked: state.recentlyUnlocked || [],
        realLifeRewards: state.realLifeRewards || [],
        digitalGear: state.digitalGear || [],
        inventory: state.inventory || [],
        liveRex: state.liveRex || {},
        parents: state.household?.parents || [],
        parentUids: state.household?.parentUids || [],
        parentEmails: state.household?.parentEmails || [],
        parentSettings: state.parentSettings || {},
        profileThemes: state.profileThemes || [],
        gameProgress: state.gameProgress || {},
        updatedAt: timestamp,
        lastWriterSessionId: this.sessionId,
        lastWriterDeviceId: this.deviceId,
        devices: {
          ...(this.lastKnownDevices || {}),
          [this.deviceId]: {
            lastSeen: timestamp,
            name: 'Hero Device'
          }
        }
      }, { merge: true });

      state.household.lastSync = "Synced Just Now";

      // Slide persistent link window forward (RFC 6749 Section 6)
      persistentLink.slideWindow().catch(() => {});
    } catch (error) {
      if (isQuotaError(error)) {
        this.markQuotaExhausted(error);
        return;
      }
      console.warn("Firestore push warning:", error.message);
    } finally {
      this.isPushing = false;
      this.pushInFlight = false;
      if (this.pushPending) {
        this.pushPending = false;
        this.pushStateToCloud();
      }
    }
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
    try {
      const docRef = doc(db, "households", code);
      const timestamp = new Date().toISOString();
      await updateDoc(docRef, {
        [`devices.${this.deviceId}`]: {
          lastSeen: timestamp,
          name: 'Hero Device'
        }
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
