import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, initializeFirestore, Firestore } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { dispatchLedgerAction } from "./handler";
import { createMirrorWalletSummaryTrigger } from "./mirrorWalletSummary";
import { createNightlyReconcileJob } from "./reconcileNightly";

let dbInstance: Firestore | null = null;

function getDb(): Firestore {
  if (dbInstance) return dbInstance;
  const app = getApps().length > 0 ? getApps()[0] : initializeApp();
  // Use preferRest: true in production to cut Cloud Run v2 cold-start gRPC overhead;
  // fall back to standard getFirestore() when running against the local emulator.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    dbInstance = getFirestore(app);
  } else {
    dbInstance = initializeFirestore(app, { preferRest: true });
  }
  return dbInstance;
}

export const ledger = onCall(
  {
    region: "us-central1",
    minInstances: 0,
    maxInstances: 10,
    memory: "256MiB"
  },
  async (request) => {
    const auth = request.auth
      ? {
          uid: request.auth.uid,
          email: request.auth.token?.email ?? null,
          emailVerified: Boolean(request.auth.token?.email_verified)
        }
      : null;
    const data = (request.data && typeof request.data === "object")
      ? (request.data as Record<string, unknown>)
      : {};
    return dispatchLedgerAction(getDb(), auth, data);
  }
);

export const ledgerMirrorWalletSummary = createMirrorWalletSummaryTrigger(getDb);
export const ledgerReconcileNightly = createNightlyReconcileJob(getDb);
