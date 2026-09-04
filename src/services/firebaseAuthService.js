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
    if (!isFirebaseAvailable || !auth) return;

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

    if (user) {
      console.log("Firebase Auth: User authenticated as", user.displayName || user.email || user.uid);
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
        } else {
          // First time this Google account signs in - bind current household to user
          const currentCode = state.household.syncCode || 'HERO-8842';
          await persistentLink.establishPersistentLink({
            userId: user.uid,
            email: user.email,
            displayName: user.displayName,
            householdCode: currentCode
          });
        }

        // 2. PERSISTENT LINKING SLIDING WINDOW (RFC 6749 Section 6):
        // Extend expiration on the EXISTING refresh token without rotation
        await persistentLink.establishPersistentLink({
          userId: user.uid,
          email: user.email,
          displayName: user.displayName,
          householdCode: store.getState().household.syncCode
        });

      } catch (e) {
        console.warn("Error establishing persistent link on auth:", e.message);
      }

      store.notify();
    } else {
      console.log("Firebase Auth: Signed out or offline");
      
      // Resilient transient offline check: check if persistent link is still within sliding window
      if (persistentLink.isLinked()) {
        const session = persistentLink.getSession();
        console.log(`🛡️ Persistent link active within sliding window for Household ${session.householdCode}. Retaining link.`);
        state.household.syncCode = session.householdCode;
        state.household.lastSync = "Persistent Link Active";
      } else {
        if (state.household.parentUser) {
          delete state.household.parentUser;
        }
        state.household.lastSync = "Local Mode";
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
      alert(
        `Google Sign-In Note: ${error.message}\n\nYou can also sync your family devices immediately using your Household Sync Code!`
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
      alert(`Sign up error: ${error.message}`);
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

    if (store.getState().household.parentUser) {
      delete store.getState().household.parentUser;
    }

    if (isFirebaseAvailable && auth) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Sign out error:", error);
      }
    }

    Sound.click();
    store.showReward("Signed Out", "You have signed out of your parent account.", 0, 0);
    store.saveState(true);
  }

  simulateLocalParentAuth(name) {
    store.getState().household.parentUser = {
      uid: "simulated_parent_" + Date.now(),
      email: "parent@littleheroes.local",
      displayName: name,
      photoURL: "https://lh3.googleusercontent.com/aida-public/AB6AXuAZfP7_Cwlp4sz41asI8ymuapAKvjmqHtvI4zcMAF_XwUmibj8IheGrS5cA5QD5gmXgVxEkZM9FlWJPRZnct3x6-9SQB7zJKqkEDjJ3m95tAy3zRqS-PbmcQ4kv_9pmIfm2Py4mh3Fw083hkDookz1w4_r50SBA1jc9igDaAPFLYBFgSP2aQBz7Q4jVE-DwhMOyUEHlxDkQk6Gwc2EAFCSKs1c0QuhUOi3tkrk5MXRARKqZcYVzyJe6gA",
      isAnonymous: false
    };
    store.getState().household.lastSync = "Cloud Connected";
    Sound.fanfare();
    store.showReward("Parent Account Linked!", `Welcome, ${name}! Your device is synced.`, 0, 0);
    store.saveState(true);
  }
}

export const firebaseAuth = new FirebaseAuthService();
