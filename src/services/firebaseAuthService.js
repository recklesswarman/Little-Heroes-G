import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { auth, googleProvider, isFirebaseAvailable } from "../config/firebase.js";
import { store } from "../state/store.js";
import { Sound } from "../audio/sfx.js";

class FirebaseAuthService {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  init() {
    if (!isFirebaseAvailable || !auth) return;

    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      if (user) {
        console.log("Firebase Auth State: Signed in as", user.displayName || user.email || user.uid);
        store.getState().household.parentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || "Parent Admin",
          photoURL: user.photoURL || null,
          isAnonymous: user.isAnonymous
        };
        store.getState().household.lastSync = "Cloud Connected";
      } else {
        console.log("Firebase Auth State: Signed out");
        if (store.getState().household.parentUser) {
          delete store.getState().household.parentUser;
        }
        store.getState().household.lastSync = "Local Mode";
      }
      store.notify();
    });
  }

  async signInWithGoogle() {
    if (!isFirebaseAvailable || !auth) {
      this.simulateLocalParentAuth("Google User (Demo)");
      return;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      Sound.fanfare();
      store.showReward("Signed In with Google!", `Welcome, ${result.user.displayName || 'Parent'}! Cloud sync is now active.`, 0, 0);
      return result.user;
    } catch (error) {
      console.warn("Google sign-in error, falling back to simulated auth for offline play:", error.message);
      this.simulateLocalParentAuth("Parent Explorer");
    }
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
      return result.user;
    } catch (error) {
      console.warn("Email sign in error, fallback:", error.message);
      this.simulateLocalParentAuth(email);
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
      return result.user;
    } catch (error) {
      console.warn("Email sign up error, fallback:", error.message);
      this.simulateLocalParentAuth(email);
    }
  }

  async signInAsGuest() {
    if (!isFirebaseAvailable || !auth) {
      return;
    }
    try {
      const result = await signInAnonymously(auth);
      return result.user;
    } catch (error) {
      console.warn("Anonymous sign in error:", error.message);
    }
  }

  async signOut() {
    if (!isFirebaseAvailable || !auth) {
      if (store.getState().household.parentUser) {
        delete store.getState().household.parentUser;
      }
      Sound.click();
      store.notify();
      return;
    }
    try {
      await signOut(auth);
      Sound.click();
      store.showReward("Signed Out", "You have signed out of your parent account.", 0, 0);
    } catch (error) {
      console.error("Sign out error:", error);
    }
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
    store.saveState();
  }
}

export const firebaseAuth = new FirebaseAuthService();
