import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db, isFirebaseAvailable } from "../config/firebase.js";
import { store } from "../state/store.js";

const LINK_SESSION_STORAGE_KEY = 'stitch_persistent_link_session';
// 30 days sliding window duration (in milliseconds)
const SLIDING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
// Check and slide interval: 15 minutes
const SLIDE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * PersistentLinkService implements Persistent Linking with a "sliding window" approach
 * referencing RFC 6749 Section 6.
 * 
 * Core Design Principle:
 * Extends the expiration of the existing Refresh Token / link credential instead of rotating it.
 * This prevents race conditions and unintended unlinking that can occur if a new Refresh Token
 * is issued but not successfully received or stored across concurrent devices or transient network drops.
 */
class PersistentLinkService {
  constructor() {
    this.session = this.loadLocalSession();
    this.heartbeatTimer = null;
    this.init();
  }

  init() {
    // 1. Check validity of current session upon startup
    this.validateAndSlide();

    // 2. Periodic sliding window check (heartbeat)
    if (typeof window !== 'undefined') {
      this.heartbeatTimer = setInterval(() => {
        this.validateAndSlide();
      }, SLIDE_CHECK_INTERVAL_MS);

      // 3. Network reconnect listener: slide window when returning online
      window.addEventListener('online', () => {
        console.log("🌐 Network reconnected: sliding persistent link window forward");
        this.validateAndSlide();
      });
    }
  }

  /**
   * Load stored session from localStorage
   */
  loadLocalSession() {
    try {
      const raw = localStorage.getItem(LINK_SESSION_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn("Error reading persistent link session:", e);
    }
    return null;
  }

  /**
   * Save session to localStorage
   */
  saveLocalSession(session) {
    this.session = session;
    try {
      if (session) {
        localStorage.setItem(LINK_SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(LINK_SESSION_STORAGE_KEY);
      }
    } catch (e) {
      console.warn("Error saving persistent link session:", e);
    }
  }

  /**
   * Get the active persistent link session
   */
  getSession() {
    return this.session;
  }

  /**
   * Check if persistent link is currently active
   */
  isLinked() {
    if (!this.session) return false;
    return this.session.status === 'linked' && Date.now() < this.session.expiresAt;
  }

  /**
   * Establish or extend a persistent link session for an authenticated user.
   * Uses the sliding window approach (RFC 6749 Section 6):
   * PRESERVES the existing refreshToken / credential ID without rotating it!
   */
  async establishPersistentLink({ userId, email, displayName, householdCode, token }) {
    const now = Date.now();
    const existing = this.session;

    // Use existing refreshToken if available to prevent rotation race conditions
    const stableToken = (existing && existing.userId === userId && existing.refreshToken) 
      ? existing.refreshToken 
      : (token || `link_tok_${Math.random().toString(36).substring(2, 12)}_${now.toString(36)}`);

    const newSession = {
      userId,
      email: email || '',
      displayName: displayName || 'Parent Admin',
      householdCode: (householdCode || store.getState().household.syncCode || 'HERO-8842').trim().toUpperCase(),
      refreshToken: stableToken, // Stable identifier preserved across refreshes
      issuedAt: (existing && existing.issuedAt) ? existing.issuedAt : now,
      lastSlidAt: now,
      expiresAt: now + SLIDING_WINDOW_MS, // Sliding window extended forward
      status: 'linked',
      rfc6749Strategy: 'sliding_window_no_rotation'
    };

    this.saveLocalSession(newSession);

    // Sync to Firestore user_households registry
    await this.syncPersistentLinkToCloud(newSession);

    console.log(`🔗 Persistent Linking Active (Sliding Window): User ${email || userId} bound to Household ${newSession.householdCode}`);
    return newSession;
  }

  /**
   * Slide the window forward on the EXISTING token (RFC 6749 Section 6)
   * Does NOT issue or rotate a new refresh token.
   */
  async slideWindow() {
    if (!this.session || this.session.status !== 'linked') return;

    const now = Date.now();
    // Only slide if at least 10 minutes have elapsed since last slide, or if within 15 days of expiry
    if (now - this.session.lastSlidAt < 10 * 60 * 1000) {
      return;
    }

    // Extend the expiration of the EXISTING token
    this.session.lastSlidAt = now;
    this.session.expiresAt = now + SLIDING_WINDOW_MS;
    this.saveLocalSession(this.session);

    // Update cloud record
    await this.syncPersistentLinkToCloud(this.session).catch(() => {});
    console.log(`⏳ Persistent link sliding window extended for ${this.session.householdCode} (Expires: ${new Date(this.session.expiresAt).toLocaleDateString()})`);
  }

  /**
   * Validate current session and slide forward if valid.
   * Resilient to transient network failures: keeps link active if within window!
   */
  async validateAndSlide() {
    if (!this.session) return false;

    const now = Date.now();
    if (now > this.session.expiresAt) {
      console.warn("Persistent link window has expired.");
      this.session.status = 'expired';
      this.saveLocalSession(this.session);
      return false;
    }

    // Still within valid window: extend expiration forward
    await this.slideWindow();
    return true;
  }

  /**
   * Bind user account to household in Firestore
   */
  async syncPersistentLinkToCloud(session) {
    if (!isFirebaseAvailable || !db || !session.userId) return;

    try {
      const payload = {
        userId: session.userId,
        email: session.email,
        displayName: session.displayName,
        householdCode: session.householdCode,
        updatedAt: new Date().toISOString(),
        persistentLink: {
          refreshToken: session.refreshToken,
          issuedAt: new Date(session.issuedAt).toISOString(),
          lastSlidAt: new Date(session.lastSlidAt).toISOString(),
          expiresAt: new Date(session.expiresAt).toISOString(),
          strategy: 'rfc6749_sliding_window'
        }
      };

      // 1. Save under primary user key
      const userHouseholdRef = doc(db, "user_households", session.userId);
      await setDoc(userHouseholdRef, payload, { merge: true });

      // 2. Also index by email if available so multiple devices can link by email
      if (session.email) {
        const emailKey = 'email_' + session.email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
        const emailRef = doc(db, "user_households", emailKey);
        await setDoc(emailRef, payload, { merge: true });
      }

      // 3. Record linked account in the household document
      const householdRef = doc(db, "households", session.householdCode);
      await updateDoc(householdRef, {
        [`linkedAccounts.${session.userId}`]: {
          email: session.email,
          displayName: session.displayName,
          lastActive: new Date().toISOString()
        }
      }).catch(async () => {
        await setDoc(householdRef, {
          linkedAccounts: {
            [session.userId]: {
              email: session.email,
              displayName: session.displayName,
              lastActive: new Date().toISOString()
            }
          }
        }, { merge: true });
      });

    } catch (e) {
      // Network drop: this is expected during transient offline, local session remains valid
      console.warn("Persistent link cloud ping note (transient offline):", e.message);
    }
  }

  /**
   * Look up if a user or email already has a linked household in Firestore.
   * Enables Device 2 to automatically sync with Device 1!
   */
  async lookupHouseholdForUser(userIdOrEmail) {
    if (!isFirebaseAvailable || !db || !userIdOrEmail) return null;

    try {
      // 1. Direct lookup by ID
      const userHouseholdRef = doc(db, "user_households", userIdOrEmail);
      let snap = await getDoc(userHouseholdRef);

      // 2. If not found and it might be an email, check email key
      if (!snap.exists() && userIdOrEmail.includes('@')) {
        const emailKey = 'email_' + userIdOrEmail.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
        const emailRef = doc(db, "user_households", emailKey);
        snap = await getDoc(emailRef);
      }

      if (snap.exists()) {
        const data = snap.data();
        if (data.householdCode) {
          console.log(`🔍 Found existing linked household ${data.householdCode} for ${userIdOrEmail}`);
          return {
            householdCode: data.householdCode,
            data: data
          };
        }
      }
    } catch (e) {
      console.warn("Could not lookup user household:", e.message);
    }
    return null;
  }

  /**
   * Clear session on explicit sign out
   */
  clearSession() {
    this.session = null;
    this.saveLocalSession(null);
  }
}

export const persistentLink = new PersistentLinkService();
