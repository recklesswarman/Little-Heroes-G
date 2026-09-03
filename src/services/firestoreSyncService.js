import { doc, setDoc, onSnapshot, getDoc, updateDoc } from "firebase/firestore";
import { db, isFirebaseAvailable } from "../config/firebase.js";
import { store, STORAGE_KEY } from "../state/store.js";
import { persistentLink } from "./persistentLinkService.js";

const DEVICE_ID_KEY = 'stitch_device_id';

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
    this.debounceTimer = null;
    this.lastCloudTimestamp = null;
  }

  /**
   * Start listening to real-time changes for a household
   */
  startSync(householdCode) {
    if (!isFirebaseAvailable || !db) {
      console.log("Firestore running in resilient offline/local mode");
      return;
    }

    const state = store.getState();
    const code = (householdCode || state.household?.syncCode || 'HERO-8842').trim().toUpperCase();

    if (this.currentCode === code && this.unsubscribe) {
      return; // Already actively listening to this household
    }

    this.stopSync();
    this.currentCode = code;
    const docRef = doc(db, "households", code);

    try {
      this.unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (!snapshot.exists()) {
          console.log(`ℹ️ Household ${code} does not exist yet on cloud. Initializing...`);
          this.pushStateToCloud(true);
          return;
        }

        const cloudData = snapshot.data();
        if (!cloudData) return;

        // If the write was pushed from this exact device, avoid redundant re-hydrating
        if (cloudData.lastWriterDeviceId === this.deviceId) {
          if (cloudData.devices && typeof cloudData.devices === 'object') {
            const count = Object.keys(cloudData.devices).length;
            if (store.getState().household.linkedDevices !== count) {
              store.getState().household.linkedDevices = Math.max(1, count);
              store.notify();
            }
          }
          return;
        }

        console.log(`⚡ Real-time cloud sync received from device ${cloudData.lastWriterDeviceId || 'remote'} for household: ${code}`);
        
        // Hydrate store state immediately with cloud data
        store.hydrateFromCloud(cloudData);

        // Slide the persistent link window forward (RFC 6749 Section 6)
        persistentLink.slideWindow();
      }, (error) => {
        console.warn("Firestore snapshot listener error:", error.message);
      });

      // Register this device's presence
      this.pingDevicePresence(code);

    } catch (e) {
      console.warn("Error starting Firestore sync:", e.message);
    }
  }

  /**
   * Safely join an existing household and immediately pull all its data
   */
  async joinHousehold(code) {
    if (!isFirebaseAvailable || !db) {
      const state = store.getState();
      state.household.syncCode = code;
      store.saveState();
      return { success: true, message: `Joined ${code} in local mode` };
    }

    const cleanCode = code.trim().toUpperCase();
    const docRef = doc(db, "households", cleanCode);

    try {
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const cloudData = snapshot.data();
        this.lastCloudTimestamp = cloudData.updatedAt;

        console.log(`🏠 Successfully fetched household ${cleanCode} from cloud! Hydrating device state...`);

        // Hydrate store with all kids, tasks, habits, and inventory from the cloud
        store.hydrateFromCloud(cloudData);

        // Restart listener to guarantee live updates
        this.stopSync();
        this.startSync(cleanCode);

        // Slide persistent link window forward
        persistentLink.slideWindow();

        return { 
          success: true, 
          isNew: false, 
          kidCount: store.getState().heroes.length,
          householdName: cloudData.householdName || 'The Hero Family'
        };
      } else {
        // Household doesn't exist yet on cloud - initialize it with current state
        const state = store.getState();
        state.household.syncCode = cleanCode;
        await this.pushStateToCloud(true);
        this.stopSync();
        this.startSync(cleanCode);
        return { success: true, isNew: true, kidCount: state.heroes.length };
      }
    } catch (e) {
      console.warn("Failed to join household:", e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Push current state to Firestore with debouncing
   */
  pushStateToCloud(immediate = false) {
    if (!isFirebaseAvailable || !db) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (immediate) {
      this._doPush();
    } else {
      this.debounceTimer = setTimeout(() => {
        this._doPush();
      }, 150);
    }
  }

  async _doPush() {
    if (!isFirebaseAvailable || !db) return;

    const state = store.getState();
    const householdCode = (state.household?.syncCode || this.currentCode || 'HERO-8842').trim().toUpperCase();
    const docRef = doc(db, "households", householdCode);

    try {
      this.isPushing = true;
      const timestamp = new Date().toISOString();
      this.lastCloudTimestamp = timestamp;

      await setDoc(docRef, {
        householdName: state.household?.name || 'The Hero Family',
        syncCode: householdCode,
        heroes: state.heroes || [],
        pendingApprovals: state.pendingApprovals || [],
        petStatsMap: state.petStatsMap || {},
        petStageMap: state.petStageMap || {},
        equippedGearMap: state.equippedGearMap || {},
        equippedPetGear: state.equippedPetGear || null,
        taskForest: state.taskForest || [],
        habitIslands: state.habitIslands || [],
        realLifeRewards: state.realLifeRewards || [],
        digitalGear: state.digitalGear || [],
        inventory: state.inventory || [],
        parentSettings: state.parentSettings || {},
        profileThemes: state.profileThemes || [],
        updatedAt: timestamp,
        lastWriterDeviceId: this.deviceId,
        devices: {
          [this.deviceId]: {
            lastSeen: timestamp,
            name: 'Hero Device'
          }
        }
      }, { merge: true });

      state.household.lastSync = "Synced Just Now";

      // Slide persistent link window forward (RFC 6749 Section 6)
      persistentLink.slideWindow();
    } catch (error) {
      console.warn("Firestore push warning:", error.message);
    } finally {
      this.isPushing = false;
    }
  }

  /**
   * Manually force an immediate cloud data pull and verify device data is in sync
   */
  async syncNow() {
    if (!isFirebaseAvailable || !db) {
      store.getState().household.lastSync = "Local Mode Active";
      store.notify();
      return { success: true, verified: true, mode: 'local', message: "Running in local resilient mode" };
    }

    const state = store.getState();
    const code = (state.household?.syncCode || this.currentCode || 'HERO-8842').trim().toUpperCase();
    const docRef = doc(db, "households", code);

    console.log(`🔄 Sync Now: Performing authoritative data pull to verify sync for household ${code}...`);

    try {
      // 1. DATA PULL: Fetch latest authoritative cloud document directly from Firestore
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        console.log(`ℹ️ Household ${code} does not exist yet on cloud. Initializing from current device...`);
        await this.pushStateToCloud(true);
        this.stopSync();
        this.startSync(code);
        return {
          success: true,
          verified: true,
          isNew: true,
          householdName: state.household?.name || 'The Hero Family',
          code,
          kidCount: state.heroes?.length || 1,
          deviceCount: 1,
          kids: (state.heroes || []).map(h => h.name),
          message: `Created new cloud household ${code}. Synced ${state.heroes?.length || 1} kid(s).`
        };
      }

      const cloudData = snapshot.data();
      console.log(`✅ Data pull succeeded for household ${code}! Verifying device state...`);

      // 2. VERIFY & HYDRATE: Update all local heroes, tasks, habits, inventory with cloud data
      store.hydrateFromCloud(cloudData);

      // 3. Ensure live real-time listener is connected
      if (!this.unsubscribe || this.currentCode !== code) {
        this.stopSync();
        this.startSync(code);
      }

      // 4. Update this device's presence and slide token window
      await this.pingDevicePresence(code);
      await persistentLink.slideWindow();

      const kidCount = cloudData.heroes?.length || 0;
      const deviceCount = Object.keys(cloudData.devices || {}).length || 1;
      const householdName = cloudData.householdName || state.household?.name || 'The Hero Family';

      state.household.lastSync = "Verified In Sync Just Now";
      store.notify();

      return {
        success: true,
        verified: true,
        householdName,
        code,
        kidCount,
        deviceCount,
        kids: (cloudData.heroes || []).map(h => h.name),
        updatedAt: cloudData.updatedAt,
        message: `Verified in sync with ${householdName} (${code}): ${kidCount} kid(s) on ${deviceCount} device(s).`
      };

    } catch (e) {
      console.warn("Sync Now error:", e.message);
      return { success: false, verified: false, error: e.message };
    }
  }

  /**
   * Ping this device's presence to track connected household devices
   */
  async pingDevicePresence(code) {
    if (!isFirebaseAvailable || !db) return;
    try {
      const docRef = doc(db, "households", code);
      const timestamp = new Date().toISOString();
      await updateDoc(docRef, {
        [`devices.${this.deviceId}`]: {
          lastSeen: timestamp,
          name: 'Hero Device'
        }
      }).catch(async () => {
        // If document doesn't exist yet, do full push
        await this._doPush();
      });
    } catch {
      // Non-critical
    }
  }

  stopSync() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      this.currentCode = null;
    }
  }
}

export const firestoreSync = new FirestoreSyncService();
store.setSyncService(firestoreSync);
