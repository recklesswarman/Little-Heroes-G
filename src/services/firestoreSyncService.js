import { doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { db, isFirebaseAvailable } from "../config/firebase.js";
import { store } from "../state/store.js";

class FirestoreSyncService {
  constructor() {
    this.unsubscribe = null;
    this.isSyncing = false;
  }

  startSync(householdCode = 'HERO-8842') {
    if (!isFirebaseAvailable || !db) {
      console.log("Firestore running in resilient offline/local mode");
      return;
    }

    const docRef = doc(db, "households", householdCode);

    // Set up real-time cloud listener across family devices
    try {
      this.unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists() && !this.isSyncing) {
          const cloudData = snapshot.data();
          const state = store.getState();
          console.log("⚡ Real-time Firestore cloud sync received for household:", householdCode);

          if (cloudData.heroes) state.heroes = cloudData.heroes;
          if (cloudData.pendingApprovals) state.pendingApprovals = cloudData.pendingApprovals;
          if (cloudData.petStatsMap) state.petStatsMap = cloudData.petStatsMap;
          if (cloudData.petStageMap) state.petStageMap = cloudData.petStageMap;
          if (cloudData.taskForest) state.taskForest = cloudData.taskForest;
          if (cloudData.habitIslands) state.habitIslands = cloudData.habitIslands;
          if (cloudData.realLifeRewards) state.realLifeRewards = cloudData.realLifeRewards;
          if (cloudData.digitalGear) state.digitalGear = cloudData.digitalGear;
          if (cloudData.inventory) state.inventory = cloudData.inventory;
          if (cloudData.equippedPetGear) state.equippedPetGear = cloudData.equippedPetGear;
          if (cloudData.parentSettings) state.parentSettings = cloudData.parentSettings;

          state.household.lastSync = "Synced Just Now";
          store.notify();
        }
      }, (error) => {
        console.warn("Firestore snapshot listener notification:", error.message);
      });
    } catch (e) {
      console.warn("Error starting Firestore sync:", e.message);
    }
  }

  async pushStateToCloud() {
    if (!isFirebaseAvailable || !db) return;

    const state = store.getState();
    const householdCode = state.household.syncCode || 'HERO-8842';
    const docRef = doc(db, "households", householdCode);

    try {
      this.isSyncing = true;
      await setDoc(docRef, {
        heroes: state.heroes,
        pendingApprovals: state.pendingApprovals,
        petStatsMap: state.petStatsMap,
        petStageMap: state.petStageMap,
        taskForest: state.taskForest,
        habitIslands: state.habitIslands,
        realLifeRewards: state.realLifeRewards,
        digitalGear: state.digitalGear,
        inventory: state.inventory,
        equippedPetGear: state.equippedPetGear,
        parentSettings: state.parentSettings,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      this.isSyncing = false;
    } catch (error) {
      this.isSyncing = false;
      console.warn("Firestore push warning:", error.message);
    }
  }

  stopSync() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

export const firestoreSync = new FirestoreSyncService();
