import crypto from "node:crypto";
import { Firestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

export const PIN_SESSION_TTL_MS = 20 * 60 * 1000;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
export const MAX_FAILED_ATTEMPTS = 5;

export interface AuthContext {
  uid: string;
  email?: string | null;
  emailVerified?: boolean;
}

export function normalizeCode(raw: unknown): string {
  const code = String(raw || "").trim().toUpperCase();
  if (!/^[A-Za-z0-9_-]{4,32}$/.test(code)) {
    throw new HttpsError("invalid-argument", "Invalid household code");
  }
  return code;
}

export function hashPin(pin: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex || crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(pin, salt, 64);
  return { hash: derived.toString("hex"), salt };
}

export function verifyPinHash(pin: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPin(pin, storedSalt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function householdRef(db: Firestore, code: string) {
  return db.collection("households").doc(code);
}

export async function isGoogleParent(
  db: Firestore,
  code: string,
  auth: AuthContext
): Promise<boolean> {
  const snap = await householdRef(db, code).get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  const parentUids: string[] = Array.isArray(data.parentUids) ? data.parentUids : [];
  if (parentUids.includes(auth.uid)) return true;
  if (auth.emailVerified && auth.email && Array.isArray(data.parentEmails)) {
    return data.parentEmails.includes(auth.email);
  }
  return false;
}

export async function requireMember(
  db: Firestore,
  code: string,
  auth: AuthContext
): Promise<FirebaseFirestore.DocumentData> {
  const memSnap = await householdRef(db, code).collection("members").doc(auth.uid).get();
  if (!memSnap.exists) {
    throw new HttpsError("permission-denied", "Caller is not a household member");
  }
  return memSnap.data() || {};
}

export async function requireParentSession(
  db: Firestore,
  code: string,
  auth: AuthContext,
  nowMs: number = Date.now()
): Promise<void> {
  await requireMember(db, code, auth);
  const sessSnap = await householdRef(db, code).collection("parent_sessions").doc(auth.uid).get();
  if (!sessSnap.exists) {
    throw new HttpsError("permission-denied", "Parent session required");
  }
  const expiresAt = sessSnap.data()?.expiresAt;
  const expMs = expiresAt instanceof Timestamp
    ? expiresAt.toMillis()
    : (typeof expiresAt === "number" ? expiresAt : Date.parse(String(expiresAt || "")));
  if (!Number.isFinite(expMs) || expMs <= nowMs) {
    throw new HttpsError("permission-denied", "Parent session expired");
  }
}

export async function issueParentSession(
  db: Firestore,
  code: string,
  uid: string,
  nowMs: number = Date.now()
): Promise<{ expiresAt: string; expiresAtMs: number }> {
  const expiresAtMs = nowMs + PIN_SESSION_TTL_MS;
  await householdRef(db, code).collection("parent_sessions").doc(uid).set({
    uid,
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    issuedAt: Timestamp.fromMillis(nowMs)
  });
  return { expiresAt: new Date(expiresAtMs).toISOString(), expiresAtMs };
}

export async function handleJoinHousehold(
  db: Firestore,
  code: string,
  auth: AuthContext,
  args: Record<string, unknown>
) {
  const deviceId = String(args.deviceId || "").trim();
  const deviceLabel = String(args.deviceLabel || "Hero Device").trim().slice(0, 80);
  const hRef = householdRef(db, code);
  const hSnap = await hRef.get();
  if (!hSnap.exists) {
    throw new HttpsError("not-found", "Household not found");
  }
  const hData = hSnap.data() || {};
  const revoked: string[] = Array.isArray(hData.revokedDeviceIds) ? hData.revokedDeviceIds : [];
  if (deviceId && revoked.includes(deviceId)) {
    throw new HttpsError("permission-denied", "Device has been revoked");
  }

  const parentUids: string[] = Array.isArray(hData.parentUids) ? hData.parentUids : [];
  const role = parentUids.includes(auth.uid) ? "parent" : "device";
  const nowTs = Timestamp.now();
  const memRef = hRef.collection("members").doc(auth.uid);
  const existing = await memRef.get();

  if (existing.exists) {
    await memRef.update({
      deviceId: deviceId || existing.data()?.deviceId || "",
      deviceLabel,
      role,
      lastSeenAt: nowTs
    });
    return { joined: true, alreadyMember: true, role };
  }

  await memRef.set({
    uid: auth.uid,
    role,
    deviceId,
    deviceLabel,
    joinedAt: nowTs,
    lastSeenAt: nowTs
  });
  return { joined: true, alreadyMember: false, role };
}

export async function handleRevokeDevice(
  db: Firestore,
  code: string,
  auth: AuthContext,
  args: Record<string, unknown>,
  nowMs: number = Date.now()
) {
  await requireParentSession(db, code, auth, nowMs);
  const targetUid = String(args.targetUid || "").trim();
  const targetDeviceId = String(args.deviceId || "").trim();
  if (!targetUid && !targetDeviceId) {
    throw new HttpsError("invalid-argument", "targetUid or deviceId is required");
  }

  const hRef = householdRef(db, code);
  const batch = db.batch();

  if (targetUid) {
    batch.delete(hRef.collection("members").doc(targetUid));
    batch.delete(hRef.collection("parent_sessions").doc(targetUid));
  } else if (targetDeviceId) {
    const membersSnap = await hRef.collection("members").where("deviceId", "==", targetDeviceId).get();
    membersSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      batch.delete(hRef.collection("parent_sessions").doc(docSnap.id));
    });
  }

  if (targetDeviceId) {
    const hSnap = await hRef.get();
    const prev: string[] = Array.isArray(hSnap.data()?.revokedDeviceIds) ? hSnap.data()?.revokedDeviceIds : [];
    const next = Array.from(new Set([...prev, targetDeviceId]));
    batch.update(hRef, { revokedDeviceIds: next });
  }

  await batch.commit();
  return { revoked: true };
}

export async function handleVerifyParentPin(
  db: Firestore,
  code: string,
  auth: AuthContext,
  args: Record<string, unknown>,
  nowMs: number = Date.now()
) {
  await requireMember(db, code, auth);
  const pin = String(args.pin || "").trim();
  if (!/^\d{4,8}$/.test(pin)) {
    throw new HttpsError("invalid-argument", "PIN must be 4 to 8 digits");
  }

  const bypassLockout = await isGoogleParent(db, code, auth);
  const authRef = householdRef(db, code).collection("private").doc("parentAuth");

  const result = await db.runTransaction(async (tx) => {
    const authSnap = await tx.get(authRef);
    if (!authSnap.exists) {
      return { status: "not_configured" as const };
    }
    const data = authSnap.data() || {};
    const lockedUntilMs = data.lockedUntil instanceof Timestamp
      ? data.lockedUntil.toMillis()
      : (typeof data.lockedUntil === "number" ? data.lockedUntil : 0);

    if (!bypassLockout && lockedUntilMs > nowMs) {
      return { status: "locked" as const };
    }

    const ok = verifyPinHash(pin, String(data.pinHash || ""), String(data.pinSalt || ""));
    if (!ok) {
      const nextFails = (Number(data.failedAttempts) || 0) + 1;
      if (nextFails >= MAX_FAILED_ATTEMPTS) {
        tx.update(authRef, {
          failedAttempts: 0,
          lockedUntil: Timestamp.fromMillis(nowMs + LOCKOUT_DURATION_MS)
        });
        return { status: "just_locked" as const };
      }
      tx.update(authRef, { failedAttempts: nextFails });
      return { status: "wrong" as const };
    }

    tx.update(authRef, { failedAttempts: 0, lockedUntil: null });
    return { status: "ok" as const };
  });

  if (result.status === "not_configured") {
    throw new HttpsError("failed-precondition", "Parent PIN is not configured");
  }
  if (result.status === "locked") {
    throw new HttpsError("resource-exhausted", "PIN entry is temporarily locked");
  }
  if (result.status === "just_locked") {
    throw new HttpsError("resource-exhausted", "Too many wrong PIN attempts; locked for 15 minutes");
  }
  if (result.status === "ok") {
    const session = await issueParentSession(db, code, auth.uid, nowMs);
    return { unlocked: true, ...session };
  }
  throw new HttpsError("permission-denied", "Incorrect PIN");
}

export async function handleSetParentPin(
  db: Firestore,
  code: string,
  auth: AuthContext,
  args: Record<string, unknown>,
  nowMs: number = Date.now()
) {
  const newPin = String(args.newPin || "").trim();
  if (!/^\d{4,8}$/.test(newPin)) {
    throw new HttpsError("invalid-argument", "PIN must be 4 to 8 digits");
  }

  const googleParent = await isGoogleParent(db, code, auth);
  if (!googleParent) {
    await requireParentSession(db, code, auth, nowMs);
  } else {
    await requireMember(db, code, auth);
  }

  const { hash, salt } = hashPin(newPin);
  await householdRef(db, code).collection("private").doc("parentAuth").set({
    pinHash: hash,
    pinSalt: salt,
    algo: "scrypt",
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: Timestamp.fromMillis(nowMs)
  });

  return { updated: true };
}
