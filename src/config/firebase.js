import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Official Firebase Project Configuration for Little Heroes Adventures
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAb2UiONr8NUwM0loMFNvbAI9pgWXGvXfg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "little-heroes-quest-8842.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "little-heroes-quest-8842",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "little-heroes-quest-8842.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "592754457115",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:592754457115:web:ba8b65d9f22a6ab78e16be"
};

let app = null;
let auth = null;
let db = null;
let googleProvider = null;
let isFirebaseAvailable = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  isFirebaseAvailable = true;
  console.log("🔥 Firebase initialized successfully for project: little-heroes-quest-8842");
} catch (e) {
  console.warn("Firebase initialized with local fallback:", e.message);
}

export { app, auth, db, googleProvider, isFirebaseAvailable };
