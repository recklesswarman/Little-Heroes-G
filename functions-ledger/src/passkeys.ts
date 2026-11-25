import { Firestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransport
} from "@simplewebauthn/server";
import {
  AuthContext,
  LOCKOUT_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
  householdRef,
  requireMember,
  requireParentSession,
  issueParentSession
} from "./auth";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

interface StoredCredential {
  id: string;
  publicKey: string; // base64url
  counter: number;
  transports?: AuthenticatorTransport[];
  label: string;
  rpId: string;
  createdAt: string;
}

function getRpParams(args: Record<string, unknown>): { rpId: string; expectedOrigin: string } {
  const rpId = String(args.rpId || "").trim();
  const expectedOrigin = String(args.origin || "").trim();
  if (!rpId || !expectedOrigin) {
    throw new HttpsError("invalid-argument", "rpId and origin are required for passkeys");
  }
  return { rpId, expectedOrigin };
}

export async function handlePasskeyRegisterBegin(
  db: Firestore,
  code: string,
  auth: AuthContext,
  args: Record<string, unknown>,
  nowMs: number = Date.now()
) {
  await requireParentSession(db, code, auth, nowMs);
  const { rpId } = getRpParams(args);

  const passkeysSnap = await householdRef(db, code).collection("private").doc("passkeys").get();
  const credentialsMap: Record<string, StoredCredential> = passkeysSnap.data()?.credentials || {};
  const excludeCredentials = Object.values(credentialsMap)
    .filter((c) => c.rpId === rpId)
    .map((c) => ({ id: c.id, transports: c.transports }));

  const options = await generateRegistrationOptions({
    rpName: "Little Hero Adventures",
    rpID: rpId,
    userName: `parent-${code}`,
    userID: new Uint8Array(Buffer.from(`${code}:${auth.uid}`)),
    attestationType: "none",
    authenticatorSelection: {
      userVerification: "required",
      residentKey: "preferred"
    },
    excludeCredentials
  });

  await householdRef(db, code).collection("passkey_challenges").doc(auth.uid).set({
    challenge: options.challenge,
    kind: "register",
    rpId,
    expiresAt: Timestamp.fromMillis(nowMs + CHALLENGE_TTL_MS)
  });

  return { options };
}

export async function handlePasskeyRegisterFinish(
  db: Firestore,
  code: string,
  auth: AuthContext,
  args: Record<string, unknown>,
  nowMs: number = Date.now()
) {
  await requireParentSession(db, code, auth, nowMs);
  const { rpId, expectedOrigin } = getRpParams(args);
  const response = args.response as RegistrationResponseJSON;
  const label = String(args.label || "Parent Device").trim().slice(0, 80);
  if (!response) {
    throw new HttpsError("invalid-argument", "WebAuthn registration response is required");
  }

  const chalRef = householdRef(db, code).collection("passkey_challenges").doc(auth.uid);
  const chalSnap = await chalRef.get();
  if (!chalSnap.exists) {
    throw new HttpsError("failed-precondition", "No pending registration challenge");
  }
  const chalData = chalSnap.data() || {};
  await chalRef.delete();

  const expMs = chalData.expiresAt instanceof Timestamp ? chalData.expiresAt.toMillis() : 0;
  if (chalData.kind !== "register" || chalData.rpId !== rpId || expMs <= nowMs) {
    throw new HttpsError("failed-precondition", "Registration challenge expired or invalid");
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: String(chalData.challenge),
    expectedOrigin,
    expectedRPID: rpId,
    requireUserVerification: true
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new HttpsError("permission-denied", "Passkey registration verification failed");
  }

  const { credential } = verification.registrationInfo;
  const credEntry: StoredCredential = {
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports as AuthenticatorTransport[] | undefined,
    label,
    rpId,
    createdAt: new Date(nowMs).toISOString()
  };

  const passkeysRef = householdRef(db, code).collection("private").doc("passkeys");
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(passkeysRef);
    const existing = snap.data()?.credentials || {};
    existing[credential.id] = credEntry;
    tx.set(passkeysRef, { credentials: existing }, { merge: true });
  });

  return { registered: true, credentialId: credential.id, label };
}

export async function handlePasskeyAuthBegin(
  db: Firestore,
  code: string,
  auth: AuthContext,
  args: Record<string, unknown>,
  nowMs: number = Date.now()
) {
  await requireMember(db, code, auth);
  const { rpId } = getRpParams(args);

  const passkeysSnap = await householdRef(db, code).collection("private").doc("passkeys").get();
  const passkeysData = passkeysSnap.data() || {};
  const lockedUntilMs = passkeysData.lockedUntil instanceof Timestamp
    ? passkeysData.lockedUntil.toMillis()
    : 0;
  if (lockedUntilMs > nowMs) {
    throw new HttpsError("resource-exhausted", "Passkey unlock is temporarily locked");
  }

  const credentialsMap: Record<string, StoredCredential> = passkeysData.credentials || {};
  const allowCredentials = Object.values(credentialsMap)
    .filter((c) => c.rpId === rpId)
    .map((c) => ({ id: c.id, transports: c.transports }));

  if (allowCredentials.length === 0) {
    throw new HttpsError("failed-precondition", "No passkeys registered for this address");
  }

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    userVerification: "required",
    allowCredentials
  });

  await householdRef(db, code).collection("passkey_challenges").doc(auth.uid).set({
    challenge: options.challenge,
    kind: "authenticate",
    rpId,
    expiresAt: Timestamp.fromMillis(nowMs + CHALLENGE_TTL_MS)
  });

  return { options };
}

export async function handlePasskeyAuthFinish(
  db: Firestore,
  code: string,
  auth: AuthContext,
  args: Record<string, unknown>,
  nowMs: number = Date.now(),
  verifyImpl = verifyAuthenticationResponse
) {
  await requireMember(db, code, auth);
  const { rpId, expectedOrigin } = getRpParams(args);
  const response = args.response as AuthenticationResponseJSON;
  if (!response || !response.id) {
    throw new HttpsError("invalid-argument", "WebAuthn authentication response is required");
  }

  const passkeysRef = householdRef(db, code).collection("private").doc("passkeys");
  const chalRef = householdRef(db, code).collection("passkey_challenges").doc(auth.uid);

  const recordPasskeyFailure = async () => {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(passkeysRef);
      const data = snap.data() || {};
      const nextFails = (Number(data.failedAttempts) || 0) + 1;
      if (nextFails >= MAX_FAILED_ATTEMPTS) {
        tx.set(passkeysRef, {
          failedAttempts: 0,
          lockedUntil: Timestamp.fromMillis(nowMs + LOCKOUT_DURATION_MS)
        }, { merge: true });
      } else {
        tx.set(passkeysRef, { failedAttempts: nextFails }, { merge: true });
      }
    });
  };

  const passkeysSnap = await passkeysRef.get();
  const passkeysData = passkeysSnap.data() || {};
  const lockedUntilMs = passkeysData.lockedUntil instanceof Timestamp
    ? passkeysData.lockedUntil.toMillis()
    : 0;
  if (lockedUntilMs > nowMs) {
    throw new HttpsError("resource-exhausted", "Passkey unlock is temporarily locked");
  }

  const chalSnap = await chalRef.get();
  if (!chalSnap.exists) {
    await recordPasskeyFailure();
    throw new HttpsError("failed-precondition", "No pending authentication challenge");
  }
  const chalData = chalSnap.data() || {};
  // Single-use: always consume the challenge immediately
  await chalRef.delete();

  const expMs = chalData.expiresAt instanceof Timestamp ? chalData.expiresAt.toMillis() : 0;
  if (chalData.kind !== "authenticate" || chalData.rpId !== rpId || expMs <= nowMs) {
    await recordPasskeyFailure();
    throw new HttpsError("failed-precondition", "Authentication challenge expired or invalid");
  }

  const credentialsMap: Record<string, StoredCredential> = passkeysData.credentials || {};
  const stored = credentialsMap[response.id];
  if (!stored || stored.rpId !== rpId) {
    await recordPasskeyFailure();
    throw new HttpsError("permission-denied", "Unknown passkey credential");
  }

  let verification;
  try {
    verification = await verifyImpl({
      response,
      expectedChallenge: String(chalData.challenge),
      expectedOrigin,
      expectedRPID: rpId,
      requireUserVerification: true,
      credential: {
        id: stored.id,
        publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
        counter: stored.counter,
        transports: stored.transports
      }
    });
  } catch (err) {
    await recordPasskeyFailure();
    throw new HttpsError("permission-denied", `Passkey verification failed: ${(err as Error).message}`);
  }

  if (!verification.verified) {
    await recordPasskeyFailure();
    throw new HttpsError("permission-denied", "Passkey signature invalid");
  }

  const newCounter = verification.authenticationInfo?.newCounter ?? 0;
  // WebAuthn spec: enforce strictly increasing counter ONLY when newCounter > 0 || stored.counter > 0
  // Synced platform passkeys (Apple Touch ID/Face ID, Google Password Manager) return 0 on every sign-in.
  if ((newCounter > 0 || stored.counter > 0) && newCounter <= stored.counter) {
    await recordPasskeyFailure();
    throw new HttpsError("permission-denied", "Passkey counter did not increase (possible clone)");
  }

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(passkeysRef);
    const creds: Record<string, StoredCredential> = snap.data()?.credentials || {};
    if (creds[stored.id]) {
      creds[stored.id] = { ...creds[stored.id], counter: newCounter };
    }
    tx.set(passkeysRef, { credentials: creds, failedAttempts: 0, lockedUntil: null }, { merge: true });
  });

  const session = await issueParentSession(db, code, auth.uid, nowMs);
  return { unlocked: true, ...session };
}

export async function handleRemovePasskey(
  db: Firestore,
  code: string,
  auth: AuthContext,
  args: Record<string, unknown>,
  nowMs: number = Date.now()
) {
  await requireParentSession(db, code, auth, nowMs);
  const credentialId = String(args.credentialId || "").trim();
  if (!credentialId) {
    throw new HttpsError("invalid-argument", "credentialId is required");
  }

  const passkeysRef = householdRef(db, code).collection("private").doc("passkeys");
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(passkeysRef);
    const creds: Record<string, StoredCredential> = snap.data()?.credentials || {};
    delete creds[credentialId];
    tx.set(passkeysRef, { credentials: creds }, { merge: true });
  });

  return { removed: true };
}
