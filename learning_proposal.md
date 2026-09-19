# Learning Proposal: Multi-Device Real-Time Sync & Household Device Session Revocation (/learn /boost)

## Root Cause Analysis
1. **Quota Cutoff Collateral Damage**: When Firestore free-tier write quotas were exceeded, `firestoreSyncService.markQuotaExhausted` previously called `this.stopSync()`, which tore down the `onSnapshot` read listener and locked the device out of real-time sync for 24 hours. Because read listeners do not consume write quota, destroying read streams crippled multi-device synchronization unnecessarily.
2. **Uncoalesced Rapid Writes**: Dozens of state mutations across `store.js` called `saveState(true)` immediately, and even simple navigation view switches (`navigate()`) called `saveState()`. This burned through daily free write quotas in minutes during ordinary usage.
3. **Incomplete State Serialization**: Critical child and pet systems (`petSanctuary`, `heroHQ`, `heroForge`, `equippedPetGearSlots`, `equippedPetGearMap`, `customGearDyesMap`, `savedHeroCards`, `activeExpeditions`, `expeditionHistory`, `unlockedArtifacts`, `gameMasteryMap`, `petSparkMap`, and kid screen time settings) were stored only in localStorage or omitted from cloud push and hydration, causing data to desync or disappear when switching devices.
4. **Lack of Device Session Control**: Parents had no visibility into what phones or tablets were currently connected to the household, nor any mechanism to remotely revoke a compromised, lost, or decommissioned device.

---

## Proposed Rules & Best Practices to Persist

### 1. Multi-Device Live Sync Architecture (Instant 0ms BroadcastChannel + 800ms Coalesced Writes)
- Multi-tab and same-origin browser sessions communicate instantly with 0ms latency using a dedicated `BroadcastChannel('little_heroes_realtime_sync')`.
- Outbound cloud writes to Firestore are coalesced using an 800ms debounce timer rather than firing unthrottled on every granular state mutation or UI view navigation.
- 100% of household game systems must be serialized in cloud payloads: heroes, points, coins, tokens, pet sanctuary, hero HQ, hero forge, pet gear & dyes, expeditions, artifacts, game mastery, kid screen time limits, and device presence.

### 2. Decoupled Listener Resilience (Never Cancel Read Streams on Write Errors)
- A Firestore write error (such as `RESOURCE_EXHAUSTED` / quota exceeded) must NEVER invoke `stopSync()` or unsubscribe the live `onSnapshot` read listener.
- Outbound cloud writes back off gracefully with local-first persistence, but incoming real-time updates from other family members' devices continue to stream without interruption.

### 3. Household Device Session Revocation & Re-Authentication Lifecycle
- Parents have the authority in the Parent Portal under Household Management to review all logged-in devices and explicitly revoke/log out any device.
- Revocation updates `state.devices[deviceId].revoked = true` and records the ID in `state.revokedDeviceIds`.
- When a revoked device receives this update (or reloads):
  * It immediately unlinks its session, calls `authService.signOut()` to clear cached OAuth tokens, sets `isAuthenticated = false`, `isHouseholdConfigured = false`, `householdSetupStep = 'auth'`, `isDeviceRevoked = true`, and wipes the household syncCode.
  * The auto-healing barrier strictly prohibits revoked devices from re-entering the dashboard automatically.
  * The Landing Auth Modal suppresses 1-click household resumption and displays an explicit notice informing the user that the device was logged out by a parent and requires entering the sync code to rejoin.
  * Re-entering the sync code via `joinExistingHousehold` cleanly lifts the revocation and restores active session state.

### 4. Stale Snapshot Grace Window on Reconnection (Prevent Circular Re-Revocation)
- When a previously revoked device reconnects by entering the valid household sync code, the initial `onSnapshot` emission from Firestore may still contain the pre-rejoin document where `devices[myDeviceId].revoked = true` before the server has processed the un-revoke write.
- To prevent an immediate circular re-revocation loop where the device logs itself out right after the user types the code:
  * Maintain a `lastRejoinedTimestamp` grace window (15 seconds) during which stale cloud revocation flags are ignored and sanitized.
  * Proactively dispatch an `updateDoc` payload upon joining to clear `revoked = false` and remove the device ID from `revokedDeviceIds` in Firestore before the read listener triggers state hydration.

### 5. Cached Auth Provider Revocation Barrier (Google OAuth Session Lockout)
- Firebase Auth maintains indexedDB session tokens that trigger `onAuthStateChanged` asynchronously upon application boot.
- If an admin parent account was signed into a revoked device, `handleAuthUser` must evaluate `state.isDeviceRevoked` before auto-linking or configuring the household.
- If revoked, `handleAuthUser` must abort auto-healing and maintain the strict Auth Wall lock until the household sync code is explicitly supplied.

### 6. Device Presence Integrity & Tidy Decommissioning
- Revoked devices must never send heartbeat pings (`pingDevicePresence`) or push state to Firestore (`pushStateToCloud`).
- Presence updates must write to dotted field paths (`devices.${deviceId}.lastSeen`, `devices.${deviceId}.name`) rather than overwriting the entire device object, preventing accidental erasure of other status attributes.
- Meaningful client platform heuristics (`getDeviceFriendlyName` / `getDeviceIcon`) must be utilized so parents can identify specific hardware (e.g. iPad, iPhone, Chromebook) rather than seeing identical generic labels.
- Parents must be provided a removal action (`removeDevice`) to delete retired or permanently logged-out devices from the household roster.
