import { Firestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { reconcileWalletIncremental } from "./handler";

export interface NightlyReconcileSummary {
  dateKey: string;
  householdsChecked: number;
  walletsChecked: number;
  driftsFound: number;
  details: Array<{ code: string; heroId: string; drifted: boolean; mismatches: string[] }>;
}

/**
 * Reconciles all wallets for every household in `authoritative` mode and writes
 * a per-household report doc at households/{code}/ledger_reports/{dateKey}.
 */
export async function runNightlyReconcile(
  db: Firestore,
  dateKey: string = new Date().toISOString().slice(0, 10)
): Promise<NightlyReconcileSummary> {
  const hhSnap = await db
    .collection("households")
    .where("ledgerMode", "==", "authoritative")
    .get();

  let householdsChecked = 0;
  let walletsChecked = 0;
  let driftsFound = 0;
  const details: Array<{ code: string; heroId: string; drifted: boolean; mismatches: string[] }> = [];

  for (const hhDoc of hhSnap.docs) {
    const code = hhDoc.id;
    householdsChecked++;
    const walletsSnap = await hhDoc.ref.collection("wallets").get();
    const hhResults: Array<{ heroId: string; drifted: boolean; mismatches: string[]; txnsReplayed: number }> = [];

    for (const wDoc of walletsSnap.docs) {
      const heroId = wDoc.id;
      walletsChecked++;
      const res = await reconcileWalletIncremental(db, code, heroId);
      const drifted = !res.ok;
      const mismatches = Object.entries(res.drift || {}).map(([k, v]) => `${k}:${v}`);
      if (drifted) {
        driftsFound++;
        console.error(`[reconcileNightly] DRIFT detected in ${code}/${heroId}:`, mismatches);
      }
      hhResults.push({
        heroId,
        drifted,
        mismatches,
        txnsReplayed: res.checkedCount
      });
      details.push({
        code,
        heroId,
        drifted,
        mismatches
      });
    }

    await hhDoc.ref.collection("ledger_reports").doc(dateKey).set({
      dateKey,
      checkedAt: Timestamp.now(),
      walletsChecked: hhResults.length,
      driftsFound: hhResults.filter((r) => r.drifted).length,
      results: hhResults
    });
  }

  return {
    dateKey,
    householdsChecked,
    walletsChecked,
    driftsFound,
    details
  };
}

export function createNightlyReconcileJob(getDb: () => Firestore) {
  return onSchedule(
    {
      schedule: "0 4 * * *",
      timeZone: "America/Los_Angeles",
      region: "us-central1",
      minInstances: 0,
      memory: "256MiB"
    },
    async () => {
      const summary = await runNightlyReconcile(getDb());
      console.log(
        `[reconcileNightly] ${summary.dateKey}: checked ${summary.householdsChecked} household(s), ${summary.walletsChecked} wallet(s), drifts=${summary.driftsFound}`
      );
    }
  );
}
