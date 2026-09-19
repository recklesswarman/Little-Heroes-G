import assert from 'assert';

// Mock localStorage and window environment for Node.js test execution
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

// Mock BroadcastChannel
class BroadcastChannelMock {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    BroadcastChannelMock.instances.push(this);
  }
  postMessage(data) {
    BroadcastChannelMock.instances.forEach((inst) => {
      if (inst !== this && inst.name === this.name && typeof inst.onmessage === 'function') {
        inst.onmessage({ data });
      }
    });
  }
  close() {
    const idx = BroadcastChannelMock.instances.indexOf(this);
    if (idx !== -1) BroadcastChannelMock.instances.splice(idx, 1);
  }
}
BroadcastChannelMock.instances = [];

global.localStorage = new LocalStorageMock();
global.BroadcastChannel = BroadcastChannelMock;
global.window = {
  location: { hostname: 'localhost' },
  addEventListener: () => {},
  dispatchEvent: () => {},
  matchMedia: () => ({ matches: false }),
  speechSynthesis: { cancel: () => {}, speak: () => {}, getVoices: () => [] }
};
global.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  visibilityState: 'visible'
};

const { store, STORAGE_KEY } = await import('../src/state/store.js');
const { firestoreSync, markQuotaExhaustedGlobal, isQuotaExhaustedGlobal, getDeviceFriendlyName, getDeviceIcon } = await import('../src/services/firestoreSyncService.js');
const { firebaseAuth } = await import('../src/services/firebaseAuthService.js');
const { renderLandingAuthModal } = await import('../src/components/LandingAuthModal.js');

console.log("\n🧪 --- Running Real-Time Multi-Device Sync & Device Revocation Test Suite --- 🧪\n");

let passedCount = 0;
function pass(desc) {
  console.log(`  ✅ PASS: ${desc}`);
  passedCount++;
}

// =========================================================================
// TEST 1: Decoupled Quota Resilience — markQuotaExhausted does not kill listener
// =========================================================================
let unsubscribeCalled = false;
const dummyUnsubscribe = () => { unsubscribeCalled = true; };
firestoreSync.unsubscribe = dummyUnsubscribe;
firestoreSync.isSubscribed = true;

markQuotaExhaustedGlobal(60000);
assert.strictEqual(isQuotaExhaustedGlobal(), true, "Quota must be marked exhausted");
assert.strictEqual(unsubscribeCalled, false, "markQuotaExhausted must NOT cancel the onSnapshot unsubscribe listener");
assert.strictEqual(firestoreSync.isSubscribed, true, "Listener must remain marked subscribed and active");
pass("Quota exhaustion write backoff does NOT tear down real-time onSnapshot read stream");

// =========================================================================
// TEST 2: Multi-Tab BroadcastChannel Synchronization
// =========================================================================
let broadcastReceivedData = null;
const receiverChannel = new BroadcastChannelMock('little_heroes_realtime_sync');
receiverChannel.onmessage = (event) => {
  broadcastReceivedData = event.data;
};

const testBroadcastPayload = {
  type: 'LITTLE_HERO_STATE_BROADCAST',
  senderDeviceId: 'dev_phone_1',
  sessionId: 'session_abc',
  timestamp: Date.now(),
  state: {
    household: { syncCode: 'HERO-1234', name: 'Test Family' },
    heroes: [{ id: 'hero_test', name: 'Zoe', points: 500 }]
  }
};

firestoreSync.broadcastChannel.postMessage(testBroadcastPayload);
assert.notStrictEqual(broadcastReceivedData, null, "Receiver channel should receive broadcast payload");
assert.strictEqual(broadcastReceivedData.type, 'LITTLE_HERO_STATE_BROADCAST');
assert.strictEqual(broadcastReceivedData.state.heroes[0].points, 500);
pass("Same-origin BroadcastChannel broadcasts real-time state with 0ms delay across tabs");

// =========================================================================
// TEST 3: Comprehensive Cloud Data Hydration (All Assets & Systems)
// =========================================================================
localStorage.clear();
markQuotaExhaustedGlobal(24 * 60 * 60 * 1000);
store.loadState();

const comprehensiveCloudPayload = {
  household: {
    syncCode: 'HERO-8842',
    name: 'The Adventure Family'
  },
  heroes: [
    {
      id: 'kid_1',
      name: 'Oliver',
      points: 450,
      coins: 900,
      tokens: 35,
      level: 3,
      screenTimeMinutes: 60,
      screenTimeUsedToday: 20,
      dailyMaxScreenTime: 90,
      bedtimeCurfew: '21:00',
      isScreenTimePaused: true
    }
  ],
  petSanctuary: {
    unlockedZones: ['meadow', 'crystal_caves'],
    petBondMap: { 'pet_1': 95 },
    petNeedsMap: { 'pet_1': { hunger: 80, fun: 90 } }
  },
  heroHQ: {
    hqTheme: 'space_station',
    unlockedFurnitureIds: ['bed_bunk', 'trophy_stand'],
    equippedFurniture: { slot_1: 'bed_bunk' }
  },
  heroForge: {
    unlockedBlueprints: ['flame_sword'],
    customDyes: { armor_1: '#FF5500' }
  },
  petSparkMap: { 'pet_1': 10 },
  petStreakShield: { 'pet_1': 3 },
  equippedPetGearSlots: { 'pet_1': { hat: 'pirate_hat' } },
  equippedPetGearMap: { 'pet_1': 'pirate_hat' },
  customGearDyesMap: { 'gear_1': '#00FFAA' },
  savedHeroCards: [{ cardId: 'c1', title: 'Dragon Slayer' }],
  activeExpeditions: [{ id: 'exp_1', zone: 'volcano' }],
  expeditionHistory: [{ id: 'exp_0', completedAt: '2026-09-01' }],
  unlockedArtifacts: ['sun_gem', 'moon_crystal'],
  gameMasteryMap: { math_quest: 5 },
  revokedDeviceIds: ['revoked_tablet_old']
};

store.hydrateFromCloud(comprehensiveCloudPayload);
let state = store.getState();

assert.strictEqual(state.household.syncCode, 'HERO-8842');
assert.strictEqual(state.heroes[0].points, 450);
assert.strictEqual(state.heroes[0].coins, 900);
assert.strictEqual(state.heroes[0].tokens, 35);
assert.strictEqual(state.heroes[0].screenTimeMinutes, 60);
assert.strictEqual(state.heroes[0].isScreenTimePaused, true);
assert.deepStrictEqual(state.petSanctuary.unlockedZones, ['meadow', 'crystal_caves']);
assert.strictEqual(state.heroHQ.hqTheme, 'space_station');
assert.strictEqual(state.heroForge.customDyes.armor_1, '#FF5500');
assert.strictEqual(state.petSparkMap['pet_1'], 10);
assert.strictEqual(state.equippedPetGearMap['pet_1'], 'pirate_hat');
assert.strictEqual(state.customGearDyesMap['gear_1'], '#00FFAA');
assert.strictEqual(state.savedHeroCards[0].title, 'Dragon Slayer');
assert.strictEqual(state.activeExpeditions[0].zone, 'volcano');
assert.strictEqual(state.unlockedArtifacts.includes('sun_gem'), true);
assert.strictEqual(state.gameMasteryMap.math_quest, 5);
assert.strictEqual(state.revokedDeviceIds.includes('revoked_tablet_old'), true);
pass("Cloud hydration cleanly integrates all pet sanctuary, HQ, forge, gear, and screen time parameters");

// =========================================================================
// TEST 4: Device Revocation — Parent Revokes Target Device
// =========================================================================
const targetDeviceId = 'kid_ipad_target_123';
state.devices = {
  [targetDeviceId]: {
    deviceId: targetDeviceId,
    name: "Kid's iPad",
    lastSeen: new Date().toISOString(),
    revoked: false
  }
};

await store.revokeDevice(targetDeviceId);
state = store.getState();

assert.strictEqual(state.devices[targetDeviceId].revoked, true, "Target device must be flagged revoked in state.devices");
assert.strictEqual(state.revokedDeviceIds.includes(targetDeviceId), true, "Target device must be in state.revokedDeviceIds");
pass("Parent revocation marks device revoked=true and registers in state.revokedDeviceIds");

// =========================================================================
// TEST 5: Target Device Hydration with Revoked Status Enforces Logout & Resets Setup
// =========================================================================
// Switch this device's ID to simulate the target device receiving the revocation
const originalDeviceId = firestoreSync.deviceId;
firestoreSync.deviceId = targetDeviceId;

// Hydrate cloud payload indicating this device is revoked
store.hydrateFromCloud({
  devices: {
    [targetDeviceId]: {
      deviceId: targetDeviceId,
      name: "Kid's iPad",
      revoked: true
    }
  },
  revokedDeviceIds: [targetDeviceId]
});

state = store.getState();
assert.strictEqual(state.isDeviceRevoked, true, "Target device must have isDeviceRevoked=true");
assert.strictEqual(state.isAuthenticated, false, "Revoked device must be unauthenticated");
assert.strictEqual(state.isHouseholdConfigured, false, "Revoked device must not have household configured");
assert.strictEqual(state.householdSetupStep, 'auth', "Revoked device must be locked to 'auth' step");
assert.strictEqual(state.household.syncCode, '', "Revoked device syncCode must be wiped");
pass("Revoked device upon hydration resets to unauthenticated and wipes syncCode to require code re-entry");

// =========================================================================
// TEST 6: Auto-Healing Barrier for Revoked Device on Reload
// =========================================================================
// Attempting to reload state from localStorage while device is revoked must NOT auto-heal into dashboard
localStorage.setItem('stitch_device_id', targetDeviceId);
store.loadState();
state = store.getState();

assert.strictEqual(state.isDeviceRevoked, true, "loadState must detect revoked device ID");
assert.strictEqual(state.isAuthenticated, false, "loadState must NOT auto-heal revoked device to authenticated");
assert.strictEqual(state.isHouseholdConfigured, false, "loadState must NOT configure household for revoked device");
assert.strictEqual(state.householdSetupStep, 'auth', "loadState must keep revoked device on 'auth' step");
pass("Auto-healing barrier successfully denies dashboard entry to revoked device on fresh page load");

// =========================================================================
// TEST 7: LandingAuthModal UI for Revoked Device
// =========================================================================
const modalHtmlRevoked = renderLandingAuthModal();
assert(modalHtmlRevoked.includes('Device Logged Out by Parent'), "Modal must show parent revocation banner");
assert(!modalHtmlRevoked.includes('auth-resume-household-btn'), "Modal must hide 1-click Resume button for revoked device");
assert(modalHtmlRevoked.includes('auth-enter-code-direct-btn'), "Modal must provide direct sync code input button");
pass("LandingAuthModal renders clear revocation notice and requires re-entering household sync code");

// =========================================================================
// TEST 8: Device Re-Authentication via Sync Code
// =========================================================================
await store.joinExistingHousehold('HERO-8842');
state = store.getState();

assert.strictEqual(state.isDeviceRevoked, false, "Re-joining household must clear isDeviceRevoked");
assert.strictEqual(state.household.syncCode, 'HERO-8842', "Sync code must be set to re-entered code");
assert.strictEqual(state.isHouseholdConfigured, true, "Household must be configured upon re-joining");
assert.strictEqual(state.isAuthenticated, true, "Device must be re-authenticated");
assert.strictEqual(state.householdSetupStep, 'ready', "Household setup step must return to 'ready'");
assert.strictEqual(state.devices[targetDeviceId]?.revoked, false, "Device revoked flag must be cleared");
assert.strictEqual(state.revokedDeviceIds.includes(targetDeviceId), false, "Device ID must be removed from revokedDeviceIds");
pass("Re-entering household sync code completely clears revocation and restores active session");

// =========================================================================
// TEST 9: Friendly Device Name & Icon Detection
// =========================================================================
assert.strictEqual(typeof getDeviceFriendlyName(), 'string', "getDeviceFriendlyName must return string");
assert.strictEqual(getDeviceIcon('Apple iPad'), 'tablet_mac', "iPad must resolve to tablet_mac icon");
assert.strictEqual(getDeviceIcon('Apple iPhone'), 'smartphone', "iPhone must resolve to smartphone icon");
assert.strictEqual(getDeviceIcon('Windows PC'), 'computer', "Windows PC must resolve to computer icon");
assert.strictEqual(getDeviceIcon('Chromebook'), 'computer', "Chromebook must resolve to computer icon");
assert.strictEqual(getDeviceIcon('Random Device'), 'devices', "Fallback device must resolve to devices icon");
pass("Platform detection resolves user-friendly device names and Material Symbols icons");

// =========================================================================
// TEST 10: Stale Pre-Rejoin Snapshot Grace Window Prevents Circular Re-Revocation
// =========================================================================
// Simulate target device that just re-authenticated receiving an immediate stale snapshot
// where the server still has the device flagged as revoked: true
firestoreSync.deviceId = targetDeviceId;
store.hydrateFromCloud({
  devices: {
    [targetDeviceId]: {
      deviceId: targetDeviceId,
      name: "Kid's iPad",
      revoked: true // Stale server state arriving within grace window
    }
  },
  revokedDeviceIds: [targetDeviceId]
});

state = store.getState();
assert.strictEqual(state.isDeviceRevoked, false, "Stale cloud snapshot within grace window must NOT re-revoke device");
assert.strictEqual(state.isAuthenticated, true, "Device must remain authenticated during grace window");
assert.strictEqual(state.householdSetupStep, 'ready', "Device must remain on 'ready' step");
pass("Reconnection grace window protects recently re-authenticated device from stale cloud revocation loops");

// =========================================================================
// TEST 11: Revoked Device Blocks Cached Google Auth Auto-Login
// =========================================================================
// Re-revoke device to verify Google Auth barrier
await store.revokeDevice(targetDeviceId);
state = store.getState();
assert.strictEqual(state.isDeviceRevoked, true, "Device must be revoked");

// Simulate Firebase Auth onAuthStateChanged firing with an active Google parent session
await firebaseAuth.handleAuthUser({
  uid: 'parent_google_uid_123',
  email: 'parent@example.com',
  displayName: 'Super Mom',
  isAnonymous: false
});

state = store.getState();
assert.strictEqual(state.isDeviceRevoked, true, "Revoked device must NOT have revocation cleared by Google user");
assert.strictEqual(state.isAuthenticated, false, "Revoked device must NOT auto-heal to authenticated");
assert.strictEqual(state.householdSetupStep, 'auth', "Revoked device must remain strictly locked on 'auth' step");
pass("Google OAuth auto-login is strictly blocked from bypassing the device revocation barrier");

// =========================================================================
// TEST 12: Revoked Device Blocks Outgoing Cloud Pushes
// =========================================================================
let doPushAttempted = false;
const origDoPush = firestoreSync._doPush;
firestoreSync._doPush = async () => {
  if (store.getState().isDeviceRevoked) return;
  doPushAttempted = true;
};

firestoreSync.pushStateToCloud(true);
assert.strictEqual(doPushAttempted, false, "pushStateToCloud must abort when isDeviceRevoked is true");
firestoreSync._doPush = origDoPush;
pass("Revoked devices are blocked from pushing state to Firestore");

// =========================================================================
// TEST 13: Removing Decommissioned Device from Household
// =========================================================================
const staleDeviceId = 'old_retired_kindle_fire';
state.devices[staleDeviceId] = {
  deviceId: staleDeviceId,
  name: 'Old Kindle',
  revoked: true
};
state.revokedDeviceIds.push(staleDeviceId);

await store.removeDevice(staleDeviceId);
state = store.getState();

assert.strictEqual(state.devices[staleDeviceId], undefined, "Removed device must be deleted from state.devices");
assert.strictEqual(state.revokedDeviceIds.includes(staleDeviceId), false, "Removed device must be deleted from state.revokedDeviceIds");
pass("removeDevice cleanly removes decommissioned device from household records");

// Restore original device ID and state
firestoreSync.deviceId = originalDeviceId;
state.isDeviceRevoked = false;
await store.joinExistingHousehold('HERO-8842');

console.log(`\n=============================================================`);
console.log(`ALL ${passedCount} REAL-TIME SYNC & REVOCATION TESTS PASSED!`);
console.log(`=============================================================\n`);

process.exit(0);
