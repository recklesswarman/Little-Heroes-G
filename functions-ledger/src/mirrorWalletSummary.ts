import { Firestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

/**
 * Mirror a single hero's wallet balances into households/{code}/public/walletSummary
 * without ever touching the parent households/{code} document.
 */
export async function mirrorWalletSummaryForHero(
  db: Firestore,
  code: string,
  heroId: string,
  walletData: FirebaseFirestore.DocumentData | null | undefined
): Promise<void> {
  const summaryRef = db
    .collection("households")
    .doc(code)
    .collection("public")
    .doc("walletSummary");

  const nowTs = Timestamp.now();

  if (!walletData) {
    await summaryRef.set(
      {
        heroes: { [heroId]: FieldValue.delete() },
        updatedAt: nowTs
      },
      { merge: true }
    );
    return;
  }

  const balances = walletData.balances || {};
  const held = walletData.held || {};
  const petSparks = walletData.petSparks || {};
  const petXp = walletData.petXp || {};

  // Total sparks across pets (plus per-pet map for fridge display)
  let totalSparks = 0;
  for (const val of Object.values(petSparks)) {
    totalSparks += Number(val) || 0;
  }

  const heroEntry = {
    points: Math.max(0, Number(balances.GOLD_POINTS) || 0),
    heldPoints: Math.max(0, Number(held.GOLD_POINTS) || 0),
    coins: Math.max(0, Number(balances.HABIT_TOKENS) || 0),
    xp: Math.max(0, Number(balances.HERO_XP) || 0),
    level: Math.max(1, Number(walletData.heroLevel ?? walletData.level) || 1),
    sparks: totalSparks,
    petSparks,
    petXp,
    version: Number(walletData.version) || 0,
    updatedAt: nowTs
  };

  await summaryRef.set(
    {
      heroes: { [heroId]: heroEntry },
      updatedAt: nowTs
    },
    { merge: true }
  );
}

export function createMirrorWalletSummaryTrigger(getDb: () => Firestore) {
  return onDocumentWritten(
    {
      document: "households/{code}/wallets/{heroId}",
      region: "us-central1",
      minInstances: 0,
      memory: "256MiB"
    },
    async (event) => {
      const code = String(event.params.code || "").trim().toUpperCase();
      const heroId = String(event.params.heroId || "").trim();
      if (!code || !heroId) return;
      const afterData = event.data?.after?.exists ? event.data.after.data() : null;
      await mirrorWalletSummaryForHero(getDb(), code, heroId, afterData);
    }
  );
}
