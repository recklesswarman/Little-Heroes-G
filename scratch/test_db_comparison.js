import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { firebaseConfig, firestoreDatabaseId } from "../src/config/firebase.js";

async function testDatabases() {
  const app = initializeApp(firebaseConfig);

  console.log("--- TEST 1: Read from named DB:", firestoreDatabaseId);
  try {
    const namedDb = getFirestore(app, firestoreDatabaseId);
    const snap = await getDoc(doc(namedDb, "households", "HERO-8842"));
    console.log("Named DB Read Success! Exists:", snap.exists(), snap.exists() ? snap.data()?.householdName : "");
  } catch (err) {
    console.log("Named DB Read Error:", err.code, err.message);
  }

  console.log("\n--- TEST 2: Try default DB (default)");
  try {
    const defaultDb = getFirestore(app);
    const snap = await getDoc(doc(defaultDb, "households", "HERO-8842"));
    console.log("Default DB Read Success! Exists:", snap.exists());
    
    // Try test write to default DB
    console.log("Trying write to default DB...");
    await setDoc(doc(defaultDb, "households", "TEST_PING"), { ping: Date.now() });
    console.log("Default DB Write Success!");
  } catch (err) {
    console.log("Default DB Error:", err.code, err.message);
  }

  process.exit(0);
}

testDatabases();
