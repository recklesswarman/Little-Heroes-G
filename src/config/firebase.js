import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Official Real Firebase Applet Project Configuration for Little Heroes Adventures
const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || "AIzaSyAb2UiONr8NUwM0loMFNvbAI9pgWXGvXfg",
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || "little-heroes-quest-8842.firebaseapp.com",
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || "little-heroes-quest-8842",
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || "little-heroes-quest-8842.firebasestorage.app",
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "592754457115",
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || "1:592754457115:web:ba8b65d9f22a6ab78e16be"
};

// little-heroes-quest-8842 uses the (default) Firestore database, not a
// named one -- leave this unset so getFirestore(app) below picks the
// default database instead of pointing at a named database ID.
const firestoreDatabaseId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_ID) || "";

let app = null;
let auth = null;
let db = null;
let functions = null;
let googleProvider = null;
let isFirebaseAvailable = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  // Ensure Firebase Auth session survives tab closing and reloads
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("Auth persistence notice:", err.message);
  });

  // Connect to the specific Cloud Firestore database instance
  if (firestoreDatabaseId) {
    db = getFirestore(app, firestoreDatabaseId);
  } else {
    db = getFirestore(app);
  }

  const functionsRegion = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_FUNCTIONS_REGION) || "us-central1";
  try {
    functions = getFunctions(app, functionsRegion);
  } catch (fnErr) {
    console.warn("Firebase Functions initialization notice:", fnErr.message);
  }

  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  isFirebaseAvailable = true;
  console.log(`🔥 Firebase initialized successfully for project: ${firebaseConfig.projectId} (DB: ${firestoreDatabaseId})`);
} catch (e) {
  console.warn("Firebase initialized with local fallback:", e.message);
}

export { app, auth, db, functions, googleProvider, isFirebaseAvailable, firestoreDatabaseId, firebaseConfig };

