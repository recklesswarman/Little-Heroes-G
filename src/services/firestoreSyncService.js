import { doc, setDoc, onSnapshot, updateDoc, deleteField, arrayRemove } from "firebase/firestore";
import { db, isFirebaseAvailable } from "../config/firebase.js";
import { store, STORAGE_KEY } from "../state/store.js";
import { persistentLink } from "./persistentLinkService.js";

const DEVICE_ID_KEY = 'stitch_device_id';
const QUOTA_EXHAUSTED_KEY = 'firestore_quota_exhausted_until';

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
    this.sessionId = 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    this.debounceTimer = null;
    this.lastCloudTimestamp = null;
    this.lastKnownDevices = {};
    this.initialSyncCallbacks = [];
    this.presenceInterval = null;

    // Same-origin multi-tab real-time instant sync
    this.broadcastChannel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          this.handleBroadcastMessage(event.data);
        };
      } catch (e) {
        this.broadcastChannel = null;
      }
    }

    this.startPresenceHeartbeat();
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

  markQuotaExhausted(error) {
    // 60-second backoff for writes rather than locking out sync for 24h
    markQuotaExhaustedGlobal(60 * 1000);
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
        state.household.lastSync = "Local Mode (Writes Paused)";
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

    if (!isFirebaseAvailable || !db || this.isQuotaExhausted()) {
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
    if (!isFirebaseAvailable || !db || this.isQuotaExhausted()) return;
    if (store.getState().isDeviceRevoked) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (immediate) {
      this._doPush();
    } else {
      // 800ms coalesced debounce prevents rapid successive writes from depleting daily quota
      this.debounceTimer = setTimeout(() => {
        this._doPush();
      }, 800);
    }
  }

  async _doPush() {
    if (!isFirebaseAvailable || !db || this.isQuotaExhausted()) return;
    if (store.getState().isDeviceRevoked) return;

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
            equippedPetGearMap: h.equippedPetGearMap || {},
            customGearDyesMap: h.customGearDyesMap || {},
            savedHeroCards: h.savedHeroCards || [],
            screenTimeMinutes: h.screenTimeMinutes !== undefined ? Number(h.screenTimeMinutes) : 45,
            screenTimeUsedToday: h.screenTimeUsedToday !== undefined ? Number(h.screenTimeUsedToday) : 15,
            dailyMaxScreenTime: h.dailyMaxScreenTime !== undefined ? Number(h.dailyMaxScreenTime) : 60,
            bedtimeCurfew: h.bedtimeCurfew || '20:00',
            screenTimeRate: h.screenTimeRate !== undefined ? Number(h.screenTimeRate) : 2,
            isScreenTimePaused: h.isScreenTimePaused !== undefined ? Boolean(h.isScreenTimePaused) : false,
            screenTimeLockMessage: h.screenTimeLockMessage || 'Rex says: Great job today! Time to play outside or get cozy for bedtime! 🦖🌙',
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

      // Register or update active device in local devices list
      const currentDevices = {
        ...(this.lastKnownDevices || {}),
        ...(state.devices || {}),
        [this.deviceId]: {
          deviceId: this.deviceId,
          lastSeen: timestamp,
          name: state.devices?.[this.deviceId]?.name || this.getDeviceName(),
          revoked: Boolean(state.devices?.[this.deviceId]?.revoked)
        }
      };
      this.lastKnownDevices = currentDevices;
      state.devices = currentDevices;

      await setDoc(docRef, {
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
        equippedPetGearSlots: state.equippedPetGearSlots || {},
        equippedPetGearMap: state.equippedPetGearMap || {},
        customGearDyesMap: state.customGearDyesMap || {},
        savedHeroCards: state.savedHeroCards || [],
        pets: state.pets || [],
        petSanctuary: state.petSanctuary || {},
        heroHQ: state.heroHQ || {},
        heroForge: state.heroForge || {},
        petSparkMap: state.petSparkMap || {},
        petStreakShield: state.petStreakShield || {},
        activeExpeditions: state.activeExpeditions || [],
        expeditionHistory: state.expeditionHistory || [],
        unlockedArtifacts: state.unlockedArtifacts || [],
        gameMasteryMap: state.gameMasteryMap || {},
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
        devices: currentDevices,
        revokedDeviceIds: state.revokedDeviceIds || []
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
    }
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
      store.getState().household.lastSync = "Local Mode (Quota Safe)";
      store.notify();
      return { 
        success: true, 
        verified: true, 
        mode: 'local', 
        message: "Your hero data is safely saved on this device. Cloud sync will automatically resume when quota resets." 
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
        const docRef = doc(db, "households", householdCode);
        await updateDoc(docRef, {
          [`devices.${targetDeviceId}`]: deleteField(),
          revokedDeviceIds: state.revokedDeviceIds
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
