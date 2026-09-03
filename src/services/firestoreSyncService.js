import { doc, setDoc, onSnapshot, getDoc, updateDoc } from "firebase/firestore";
import { db, isFirebaseAvailable } from "../config/firebase.js";
import { store } from "../state/store.js";
import { persistentLink } from "./persistentLinkService.js";

const DEVICE_ID_KEY = 'stitch_device_id';
const STORAGE_KEY = 'stitch_little_hero_state_v1';

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
      return; // Already listening to this household
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

        if (this.isPushing) {
          return; // Ignore updates caused by our own active write
        }

        const cloudData = snapshot.data();
        if (!cloudData) return;

        // Verify if cloud data is newer or different
        if (cloudData.updatedAt && cloudData.updatedAt === this.lastCloudTimestamp) {
          return;
        }
        this.lastCloudTimestamp = cloudData.updatedAt;

        console.log(`⚡ Real-time cloud sync received for household: ${code} across family devices`);
        const currentState = store.getState();

        // 1. Sync Heroes and Active Hero
        if (cloudData.heroes && Array.isArray(cloudData.heroes) && cloudData.heroes.length > 0) {
          currentState.heroes = cloudData.heroes;
          
          // Re-sync selectedHero with the updated hero from the heroes list
          if (currentState.selectedHero) {
            const freshHero = currentState.heroes.find(h => h.id === currentState.selectedHero.id);
            if (freshHero) {
              currentState.selectedHero = freshHero;
            } else {
              currentState.selectedHero = currentState.heroes[0];
            }
          } else {
            currentState.selectedHero = currentState.heroes[0];
          }
        }

        // 2. Sync Approvals & Parent Requests
        if (cloudData.pendingApprovals !== undefined) {
          currentState.pendingApprovals = cloudData.pendingApprovals;
        }

        // 3. Sync Pet States & Stages & Equipped Gear
        if (cloudData.petStatsMap) currentState.petStatsMap = cloudData.petStatsMap;
        if (cloudData.petStageMap) currentState.petStageMap = cloudData.petStageMap;
        if (cloudData.equippedGearMap) currentState.equippedGearMap = cloudData.equippedGearMap;
        if (cloudData.equippedPetGear !== undefined) currentState.equippedPetGear = cloudData.equippedPetGear;

        // 4. Sync Quests, Habits, and Rewards
        if (cloudData.taskForest) currentState.taskForest = cloudData.taskForest;
        if (cloudData.habitIslands) currentState.habitIslands = cloudData.habitIslands;
        if (cloudData.realLifeRewards) currentState.realLifeRewards = cloudData.realLifeRewards;
        if (cloudData.digitalGear) currentState.digitalGear = cloudData.digitalGear;
        if (cloudData.inventory) currentState.inventory = cloudData.inventory;
        if (cloudData.parentSettings) currentState.parentSettings = cloudData.parentSettings;
        if (cloudData.profileThemes) currentState.profileThemes = cloudData.profileThemes;

        // 5. Track Linked Family Devices
        if (cloudData.devices && typeof cloudData.devices === 'object') {
          const now = Date.now();
          const activeDevices = Object.entries(cloudData.devices).filter(([, dev]) => {
            if (!dev || !dev.lastSeen) return true;
            return now - new Date(dev.lastSeen).getTime() < 86400000 * 3; // within 3 days
          });
          currentState.household.linkedDevices = Math.max(1, activeDevices.length);
        }

        currentState.household.syncCode = code;
        currentState.household.lastSync = "Synced Just Now";

        // Persist hydrated state to local storage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
        } catch (e) {
          console.warn("Could not save cloud state to local storage", e);
        }

        // Slide the persistent link window forward (RFC 6749 Section 6)
        persistentLink.slideWindow();

        // Re-render views in real time
        store.notify();
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
   * Safely join an existing household without overwriting remote data
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
        const state = store.getState();

        // Hydrate from existing cloud household
        if (cloudData.heroes && Array.isArray(cloudData.heroes) && cloudData.heroes.length > 0) {
          state.heroes = cloudData.heroes;
          state.selectedHero = cloudData.heroes[0];
        }
        if (cloudData.pendingApprovals) state.pendingApprovals = cloudData.pendingApprovals;
        if (cloudData.petStatsMap) state.petStatsMap = cloudData.petStatsMap;
        if (cloudData.petStageMap) state.petStageMap = cloudData.petStageMap;
        if (cloudData.equippedGearMap) state.equippedGearMap = cloudData.equippedGearMap;
        if (cloudData.equippedPetGear) state.equippedPetGear = cloudData.equippedPetGear;
        if (cloudData.taskForest) state.taskForest = cloudData.taskForest;
        if (cloudData.habitIslands) state.habitIslands = cloudData.habitIslands;
        if (cloudData.realLifeRewards) state.realLifeRewards = cloudData.realLifeRewards;
        if (cloudData.digitalGear) state.digitalGear = cloudData.digitalGear;
        if (cloudData.inventory) state.inventory = cloudData.inventory;
        if (cloudData.parentSettings) state.parentSettings = cloudData.parentSettings;
        if (cloudData.profileThemes) state.profileThemes = cloudData.profileThemes;

        state.household.syncCode = cleanCode;
        if (cloudData.householdName) {
          state.household.name = cloudData.householdName;
        }
        state.household.lastSync = "Synced Just Now";

        // Save hydrated state to local storage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

        // Start listening to live updates
        this.startSync(cleanCode);
        return { success: true, isNew: false, kidCount: state.heroes.length };
      } else {
        // Household doesn't exist yet on cloud - initialize it with current state
        const state = store.getState();
        state.household.syncCode = cleanCode;
        await this.pushStateToCloud(true);
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
      }, 300);
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
        heroes: state.heroes || [],
        pendingApprovals: state.pendingApprovals || [],
        petStatsMap: state.petStatsMap || {},
        petStageMap: state.petStageMap || {},
        equippedGearMap: state.equippedGearMap || {},
        equippedPetGear: state.equippedPetGear || null,
        taskForest: state.taskForest || {},
        habitIslands: state.habitIslands || {},
        realLifeRewards: state.realLifeRewards || [],
        digitalGear: state.digitalGear || [],
        inventory: state.inventory || [],
        parentSettings: state.parentSettings || {},
        profileThemes: state.profileThemes || [],
        updatedAt: timestamp,
        [`devices.${this.deviceId}`]: {
          lastSeen: timestamp,
          name: 'Hero Device'
        }
      }, { merge: true });

      this.isPushing = false;
      state.household.lastSync = "Synced Just Now";

      // Slide persistent link window forward (RFC 6749 Section 6)
      persistentLink.slideWindow();
    } catch (error) {
      this.isPushing = false;
      console.warn("Firestore push warning:", error.message);
    }
  }

  /**
   * Manually force an immediate cloud push and sync across devices
   */
  async syncNow() {
    if (!isFirebaseAvailable || !db) {
      store.getState().household.lastSync = "Local Mode Active";
      store.notify();
      return true;
    }
    const state = store.getState();
    const code = (state.household?.syncCode || this.currentCode || 'HERO-8842').trim().toUpperCase();
    await this.pushStateToCloud(true);
    await persistentLink.slideWindow();
    state.household.lastSync = "Synced Just Now";
    store.notify();
    return true;
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
