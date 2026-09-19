import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { auth, googleProvider, isFirebaseAvailable } from "../config/firebase.js";
import { store } from "../state/store.js";
import { Sound } from "../audio/sfx.js";
import { persistentLink } from "./persistentLinkService.js";
import { firestoreSync } from "./firestoreSyncService.js";

class FirebaseAuthService {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  init() {
    if (!isFirebaseAvailable || !auth) {
      store.getState().isAuthReady = true;
      return;
    }

    // Safety timeout: Ensure isAuthReady flips to true within 1200ms even if network hangs
    setTimeout(() => {
      const state = store.getState();
      if (!state.isAuthReady) {
        state.isAuthReady = true;
        store.notify();
      }
    }, 1200);

    // 1. Handle returning from redirect sign-in (mobile / popup-blocked fallback)
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          console.log("✅ Google redirect sign-in completed for:", result.user.email);
          Sound.fanfare();
          store.showReward("Google Account Linked!", `Welcome, ${result.user.displayName || 'Parent'}!`, 0, 0);
          this.handleAuthUser(result.user);
        }
      })
      .catch((err) => {
        console.warn("Redirect result notice:", err.message);
      });

    // 2. Listen to real-time auth state changes
    onAuthStateChanged(auth, (user) => {
      this.handleAuthUser(user);
    });
  }

  /**
   * Handle authenticated user and establish persistent cross-device linking
   */
  async handleAuthUser(user) {
    this.currentUser = user;
    const state = store.getState();
    state.isAuthReady = true;

    if (user) {
      console.log("Firebase Auth: User authenticated as", user.displayName || user.email || user.uid);

      // REVOCATION BARRIER: If device is revoked, prohibit auto-healing into active household
      const myDeviceId = firestoreSync.getDeviceId ? firestoreSync.getDeviceId() : (typeof localStorage !== 'undefined' ? localStorage.getItem('stitch_device_id') : null);
      const isRevoked = Boolean(
        state.isDeviceRevoked === true ||
        (myDeviceId && (
          state.devices?.[myDeviceId]?.revoked === true ||
          (Array.isArray(state.revokedDeviceIds) && state.revokedDeviceIds.includes(myDeviceId))
        ))
      );

      if (isRevoked) {
        console.warn("Firebase Auth: Device is revoked by household parent. Keeping locked to Auth Wall.");
        state.isAuthenticated = false;
        state.isHouseholdConfigured = false;
        state.householdSetupStep = 'auth';
        state.isDeviceRevoked = true;
        if (state.household) {
          state.household.syncCode = '';
        }
        store.saveState(false);
        store.notify();
        return;
      }

      state.household.parentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "Parent Admin",
        photoURL: user.photoURL || null,
        isAnonymous: user.isAnonymous
      };
      state.household.lastSync = "Cloud Connected";

      // 1. CROSS-DEVICE DISCOVERY:
      // Check if this Google account already owns an existing household in Firestore
      try {
        const existingLink = await persistentLink.lookupHouseholdForUser(user.uid) || (user.email ? await persistentLink.lookupHouseholdForUser(user.email) : null);
        if (existingLink && existingLink.householdCode) {
          const targetCode = existingLink.householdCode.trim().toUpperCase();
          console.log(`🏠 Multi-Device Sync: User ${user.email} belongs to Household ${targetCode}. Joining & hydrating all data...`);
          await firestoreSync.joinHousehold(targetCode);
          state.household.syncCode = targetCode;
          state.isAuthenticated = true;
          state.isHouseholdConfigured = true;
          state.householdSetupStep = 'ready';

          // Slide window
          await persistentLink.establishPersistentLink({
            userId: user.uid,
            email: user.email,
            displayName: user.displayName,
            householdCode: targetCode
          });
        } else {
          // Check if this device already has an active household locally
          const localCode = (state.household?.syncCode || (persistentLink.isLinked() ? persistentLink.getSession()?.householdCode : '')).trim().toUpperCase();
          const hasParent = Boolean(
            (state.household?.parents && state.household.parents.length > 0) ||
            (state.household?.parentEmails && state.household.parentEmails.length > 0)
          );
          const hasCustomHeroes = Array.isArray(state.heroes) && (
            state.heroes.length > 1 ||
            state.heroes.some(h => h.name !== 'Little Hero' || (h.points && Number(h.points) > 0))
          );
          const isExistingLocalHousehold = state.isHouseholdConfigured || (localCode && localCode.length >= 4) || hasParent || hasCustomHeroes;

          if (isExistingLocalHousehold) {
            const targetCode = (localCode && localCode.length >= 4) ? localCode : 'HERO-8842';
            state.household.syncCode = targetCode;
            state.isAuthenticated = true;
            state.isHouseholdConfigured = true;
            state.householdSetupStep = 'ready';

            await persistentLink.establishPersistentLink({
              userId: user.uid,
              email: user.email,
              displayName: user.displayName,
              householdCode: targetCode
            }).catch(() => {});

            firestoreSync.startSync(targetCode);
            firestoreSync.pushStateToCloud(true);
          } else {
            // Brand-new Google user: route to 2-Card Choice Screen (Create vs Join)!
            state.isAuthenticated = true;
            state.isHouseholdConfigured = false;
            state.householdSetupStep = 'choice';
          }
        }
      } catch (e) {
        console.warn("Error establishing persistent link on auth:", e.message);
      }

      store.saveState(false);
      store.notify();
    } else {
      console.log("Firebase Auth: No active Google session (offline or child/household device)");
      
      const activeHouseholdCode = (state.household?.syncCode || (persistentLink.isLinked() ? persistentLink.getSession()?.householdCode : '')).trim().toUpperCase();
      const hasParent = Boolean(
        state.household?.parentUser?.uid ||
        state.household?.parentUser?.email ||
        (state.household?.parents && state.household.parents.length > 0) ||
        (state.household?.parentEmails && state.household.parentEmails.length > 0)
      );
      const hasCustomHeroes = Array.isArray(state.heroes) && (
        state.heroes.length > 1 ||
        state.heroes.some(h => (
          (h.name && h.name !== 'Little Hero') ||
          (h.points && Number(h.points) > 0) ||
          (h.coins && Number(h.coins) > 0) ||
          (h.xp && Number(h.xp) > 0) ||
          (h.level && Number(h.level) > 1) ||
          (Array.isArray(h.unlockedPetIds) && h.unlockedPetIds.length > 0)
        ))
      );
      const hasConfiguredHousehold = state.isHouseholdConfigured || (activeHouseholdCode && activeHouseholdCode.length >= 4) || hasParent || hasCustomHeroes;

      if (hasConfiguredHousehold) {
        const resolvedCode = (activeHouseholdCode && activeHouseholdCode.length >= 4) ? activeHouseholdCode : 'HERO-8842';
        console.log(`🛡️ Active household device retained for Household ${resolvedCode || state.household?.name || 'Active'}`);
        state.household.syncCode = resolvedCode;
        state.isAuthenticated = true;
        state.isHouseholdConfigured = true;
        state.householdSetupStep = 'ready';
        if (!state.household.lastSync || state.household.lastSync === "Not connected") {
          state.household.lastSync = persistentLink.isLinked() ? "Persistent Link Active" : "Household Active";
        }
        if (!persistentLink.isLinked()) {
          persistentLink.establishPersistentLink({
            householdCode: resolvedCode,
            displayName: state.household?.name || 'Household Device'
          }).catch(() => {});
        }
        firestoreSync.startSync(resolvedCode);
      } else {
        if (state.household?.parentUser) {
          delete state.household.parentUser;
        }
        state.isAuthenticated = false;
        state.isHouseholdConfigured = false;
        state.householdSetupStep = 'auth';
        state.household.lastSync = "Not connected";
      }
      store.notify();
    }
  }

  /**
   * Google Sign-In with robust popup and redirect fallback
   */
  async signInWithGoogle() {
    if (!isFirebaseAvailable || !auth) {
      this.simulateLocalParentAuth("Parent Explorer");
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      Sound.fanfare();
      store.showReward(
        "Signed In with Google!",
        `Welcome, ${result.user.displayName || 'Parent'}! Multi-device cloud sync is now active.`,
        0,
        0
      );
      await this.handleAuthUser(result.user);
      return result.user;
    } catch (error) {
      console.warn("Google sign-in popup notice:", error.code, error.message);

      // Popup blocked by browser on mobile or tablet: switch to redirect
      if (
        error.code === 'auth/popup-blocked' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        console.log("Popup blocked by browser, switching to signInWithRedirect...");
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirErr) {
          console.warn("Redirect sign-in error:", redirErr.message);
        }
      }

      if (error.code === 'auth/popup-closed-by-user') {
        console.log("Sign-in popup closed by user.");
        return;
      }
      
      // If domain is unauthorized in Firebase console, offer immediate Parent Email Linking
      if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        console.warn(`Domain ${domain} not in Firebase Authorized Domains. Offering direct Email Persistent Link.`);
        const state = store.getState();
        const enteredEmail = prompt(
          `Google OAuth Domain Notice:\nDomain "${domain}" is not in Firebase Console -> Authorized Domains.\n\nTo link your household and sync across all devices right now, please enter your Parent Email:`,
          state.household.parentUser?.email || ''
        );
        if (enteredEmail && enteredEmail.trim()) {
          await this.linkParentAccountWithEmail(enteredEmail.trim());
        }
        return;
      }

      // Other Firebase errors
      store.showReward(
        "Sign-In Note",
        `${error.message || 'Authentication note'}. You can sync your devices using your Household Sync Code!`,
        0,
        0
      );
    }
  }

  /**
   * Link parent account directly via email (with persistent linking sliding window)
   * Ensures instant cross-device syncing even if Google OAuth domain restriction is encountered
   */
  async linkParentAccountWithEmail(email, displayName = 'Parent Admin') {
    const cleanEmail = email.trim().toLowerCase();
    const state = store.getState();
    const userId = 'user_' + cleanEmail.replace(/[^a-z0-9]/g, '_');

    state.household.parentUser = {
      uid: userId,
      email: cleanEmail,
      displayName: displayName,
      photoURL: null,
      isAnonymous: false
    };
    state.household.lastSync = "Cloud Connected";

    // 1. Cross-device lookup: has this email already registered a household in Firestore?
    const existing = await persistentLink.lookupHouseholdForUser(cleanEmail);
    if (existing && existing.householdCode) {
      const targetCode = existing.householdCode.trim().toUpperCase();
      console.log(`🏠 Multi-Device Sync: Discovered household ${targetCode} for email ${cleanEmail}. Joining...`);
      await firestoreSync.joinHousehold(targetCode);
    } else {
      // First device linking with this email: bind current household code
      const currentCode = state.household.syncCode || 'HERO-8842';
      await persistentLink.establishPersistentLink({
        userId: userId,
        email: cleanEmail,
        displayName: displayName,
        householdCode: currentCode
      });
      // Push state to cloud immediately to ensure document is created
      await firestoreSync.pushStateToCloud(true);
    }

    // 2. Slide persistent linking window (RFC 6749 Section 6)
    await persistentLink.establishPersistentLink({
      userId: userId,
      email: cleanEmail,
      displayName: displayName,
      householdCode: state.household.syncCode
    });

    Sound.fanfare();
    store.showReward(
      "Parent Account Linked!",
      `Family account linked to ${cleanEmail}! All devices using this email or code (${state.household.syncCode}) will now sync in real time.`,
      0,
      0
    );
    store.saveState(true);
    store.notify();
  }

  async signInWithEmail(email, password) {
    if (!isFirebaseAvailable || !auth) {
      this.simulateLocalParentAuth(email);
      return;
    }
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      Sound.fanfare();
      store.showReward("Welcome Back!", `Signed in as ${result.user.email}!`, 0, 0);
      await this.handleAuthUser(result.user);
      return result.user;
    } catch (error) {
      console.warn("Email sign in error:", error.message);
      alert(`Sign in error: ${error.message}`);
    }
  }

  async signUpWithEmail(email, password) {
    if (!isFirebaseAvailable || !auth) {
      this.simulateLocalParentAuth(email);
      return;
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      Sound.fanfare();
      store.showReward("Account Created!", `Parent account created for ${result.user.email}!`, 0, 0);
      await this.handleAuthUser(result.user);
      return result.user;
    } catch (error) {
      console.warn("Email sign up error:", error.message);
      store.showReward("Sign Up Note", error.message || 'Could not create account', 0, 0);
    }
  }

  async signInAsGuest() {
    if (!isFirebaseAvailable || !auth) return;
    try {
      const result = await signInAnonymously(auth);
      await this.handleAuthUser(result.user);
      return result.user;
    } catch (error) {
      console.warn("Anonymous sign in error:", error.message);
    }
  }

  async signOut() {
    // Explicit sign out cleans up the persistent link session
    persistentLink.clearSession();

    const state = store.getState();
    if (state.household) {
      delete state.household.parentUser;
      state.household.syncCode = '';
      state.household.name = '';
      state.household.parents = [];
      state.household.parentUids = [];
      state.household.parentEmails = [];
      state.household.lastSync = 'Not connected';
    }

    state.isAuthenticated = false;
    state.isHouseholdConfigured = false;
    state.householdSetupStep = 'auth';
    state.activeView = 'dashboard';

    firestoreSync.stopSync();

    if (isFirebaseAvailable && auth) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Sign out error:", error);
      }
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(store.STORAGE_KEY || 'little_heroes_adventure_master_v8');
      }
    } catch (e) {}

    Sound.click();
    store.showReward("Signed Out", "You have signed out. Safe family cloud link disconnected.", 0, 0);
    store.notify();
  }

  simulateLocalParentAuth(name) {
    const state = store.getState();
    state.household.parentUser = {
      uid: "simulated_parent_" + Date.now(),
      email: "parent@littleheroes.local",
      displayName: name,
      photoURL: "https://lh3.googleusercontent.com/aida-public/AB6AXuAZfP7_Cwlp4sz41asI8ymuapAKvjmqHtvI4zcMAF_XwUmibj8IheGrS5cA5QD5gmXgVxEkZM9FlWJPRZnct3x6-9SQB7zJKqkEDjJ3m95tAy3zRqS-PbmcQ4kv_9pmIfm2Py4mh3Fw083hkDookz1w4_r50SBA1jc9igDaAPFLYBFgSP2aQBz7Q4jVE-DwhMOyUEHlxDkQk6Gwc2EAFCSKs1c0QuhUOi3tkrk5MXRARKqZcYVzyJe6gA",
      isAnonymous: false
    };
    state.household.lastSync = "Cloud Connected";
    state.isAuthenticated = true;
    if (!state.isHouseholdConfigured) {
      state.householdSetupStep = 'choice';
    } else {
      state.householdSetupStep = 'ready';
    }
    Sound.fanfare();
    store.saveState(true);
    store.notify();
  }
}

export const firebaseAuth = new FirebaseAuthService();
store.setAuthService(firebaseAuth);
store.setPersistentLinkService(persistentLink);
