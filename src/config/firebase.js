import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Official Real Firebase Applet Project Configuration for Little Heroes Adventures
const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || "AIzaSyA8bu_j-_7Wr1DW_dS3qHESuCFG08_i4Ic",
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || "ceremonial-bongo-p9brs.firebaseapp.com",
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || "ceremonial-bongo-p9brs",
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || "ceremonial-bongo-p9brs.firebasestorage.app",
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "449361020927",
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || "1:449361020927:web:04eb7a3f4d1934239a89ca"
};

const firestoreDatabaseId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_ID) || "ai-studio-littleheroesques-26318934-4fd1-408f-876b-52847e8f80ec";

let app = null;
let auth = null;
let db = null;
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

  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  isFirebaseAvailable = true;
  console.log(`🔥 Firebase initialized successfully for project: ${firebaseConfig.projectId} (DB: ${firestoreDatabaseId})`);
} catch (e) {
  console.warn("Firebase initialized with local fallback:", e.message);
}

export { app, auth, db, googleProvider, isFirebaseAvailable, firestoreDatabaseId, firebaseConfig };
