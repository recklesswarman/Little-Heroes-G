import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { firebaseConfig, firestoreDatabaseId } from "../src/config/firebase.js";

async function testLiveFirestore() {
  console.log("Connecting to Firebase...", firebaseConfig.projectId, "DB:", firestoreDatabaseId);
  const app = initializeApp(firebaseConfig);
  const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);

  const testDocId = "TEST_SYNC_" + Date.now();
  const docRef = doc(db, "households", testDocId);

  try {
    console.log("Writing test document:", testDocId);
    await setDoc(docRef, {
      test: true,
      timestamp: new Date().toISOString(),
      householdName: "Test Household Sync"
    });
    console.log("✅ SetDoc succeeded!");

    const snap = await getDoc(docRef);
    if (snap.exists()) {
      console.log("✅ GetDoc succeeded! Data:", snap.data());
    } else {
      console.log("❌ Doc does not exist!");
    }

    await deleteDoc(docRef);
    console.log("✅ DeleteDoc succeeded! Cleaned up test doc.");
  } catch (err) {
    console.error("❌ Firestore Live Error:", err.code, err.message);
  }
}

testLiveFirestore();
