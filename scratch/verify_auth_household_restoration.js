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

global.localStorage = new LocalStorageMock();
global.window = {
  location: { hostname: 'localhost' },
  addEventListener: () => {},
  dispatchEvent: () => {},
  matchMedia: () => ({ matches: false }),
  speechSynthesis: { cancel: () => {}, speak: () => {}, getVoices: () => [] }
};
global.document = {
  getElementById: () => null,
  addEventListener: () => {},
  visibilityState: 'visible'
};

const { store, STORAGE_KEY } = await import('../src/state/store.js');
const { firebaseAuth } = await import('../src/services/firebaseAuthService.js');
const { persistentLink } = await import('../src/services/persistentLinkService.js');
const { renderLandingAuthModal } = await import('../src/components/LandingAuthModal.js');
const { markQuotaExhaustedGlobal } = await import('../src/services/firestoreSyncService.js');

// Fast, non-network unit testing: simulate offline/quota-exhausted cloud mode
markQuotaExhaustedGlobal(24 * 60 * 60 * 1000);
persistentLink.lookupHouseholdForUser = async () => null;
persistentLink.syncPersistentLinkToCloud = async () => {};

console.log("\n🧪 --- Running Active Household Device & Auth Restoration Tests --- 🧪\n");

let passedCount = 0;
function pass(desc) {
  console.log(`  ✅ PASS: ${desc}`);
  passedCount++;
}

// TEST 1: Stranger / Brand-New Device is Protected
localStorage.clear();
store.loadState();
let state = store.getState();
assert.strictEqual(state.isAuthenticated, false, "Stranger must not be authenticated");
assert.strictEqual(state.isHouseholdConfigured, false, "Stranger household must not be configured");
assert.strictEqual(state.householdSetupStep, 'auth', "Stranger step must be 'auth'");
pass("Brand-new stranger device is strictly gated with isAuthenticated=false and householdSetupStep='auth'");

// TEST 2: Active Household Device with syncCode in localStorage is restored on reload
localStorage.clear();
const activeHouseholdMock = {
  household: {
    syncCode: 'HERO-8842',
    name: 'The Smith Family',
    linkedDevices: 2,
    parents: [{ uid: 'p1', displayName: 'Parent Alice' }]
  },
  heroes: [{ id: 'hero_1', name: 'Leo', unlockedPetIds: ['1'] }]
};
localStorage.setItem(STORAGE_KEY, JSON.stringify(activeHouseholdMock));
store.loadState();
state = store.getState();
assert.strictEqual(state.isAuthenticated, true, "Active household device must be authenticated");
assert.strictEqual(state.isHouseholdConfigured, true, "Active household device must have configured household");
assert.strictEqual(state.householdSetupStep, 'ready', "Active household device step must be 'ready'");
assert.strictEqual(state.household.syncCode, 'HERO-8842', "Sync code must not be wiped");
assert.strictEqual(state.household.name, 'The Smith Family', "Household name must be preserved");
pass("Active household device with HERO-8842 restores isAuthenticated=true and keeps syncCode without wiping");

// TEST 3: Active Household Device with persistent link session is restored on reload
localStorage.clear();
const linkSession = {
  userId: 'user_123',
  householdCode: 'HERO-4567',
  status: 'linked',
  expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
};
localStorage.setItem('stitch_persistent_link_session', JSON.stringify(linkSession));
localStorage.setItem(STORAGE_KEY, JSON.stringify({ heroes: [{ id: 'hero_1', name: 'Mia' }] }));
store.loadState();
state = store.getState();
assert.strictEqual(state.isAuthenticated, true, "Persistent link device must be authenticated");
assert.strictEqual(state.isHouseholdConfigured, true, "Persistent link device must have configured household");
assert.strictEqual(state.household.syncCode, 'HERO-4567', "Persistent link sync code must be restored");
pass("Device with persistent link session restores householdCode and sets isAuthenticated=true");

// TEST 4: Firebase Auth handleAuthUser(null) preserves active household
state.isAuthenticated = true;
state.isHouseholdConfigured = true;
state.household.syncCode = 'HERO-9912';
await firebaseAuth.handleAuthUser(null);
state = store.getState();
assert.strictEqual(state.isAuthenticated, true, "handleAuthUser(null) must not log out active household device");
assert.strictEqual(state.isHouseholdConfigured, true, "handleAuthUser(null) must keep household configured");
assert.strictEqual(state.household.syncCode, 'HERO-9912', "handleAuthUser(null) must preserve syncCode");
pass("Firebase Auth handleAuthUser(null) keeps active household device in dashboard without locking");

// TEST 5: Firebase Auth handleAuthUser(null) protects stranger without household
state.isAuthenticated = false;
state.isHouseholdConfigured = false;
state.household.syncCode = '';
localStorage.removeItem('stitch_persistent_link_session');
persistentLink.clearSession();
await firebaseAuth.handleAuthUser(null);
state = store.getState();
assert.strictEqual(state.isAuthenticated, false, "handleAuthUser(null) must keep stranger unauthenticated");
assert.strictEqual(state.isHouseholdConfigured, false, "handleAuthUser(null) must keep stranger household unconfigured");
assert.strictEqual(state.householdSetupStep, 'auth', "handleAuthUser(null) must keep stranger on 'auth' step");
pass("Firebase Auth handleAuthUser(null) keeps unconfigured strangers strictly on the Auth Wall");

// TEST 6: Google Sign-in binds to local household if not found in cloud
state.household.syncCode = 'HERO-7777';
state.isHouseholdConfigured = true;
const googleUser = {
  uid: 'google_user_999',
  email: 'parent@example.com',
  displayName: 'Super Mom',
  isAnonymous: false
};
await firebaseAuth.handleAuthUser(googleUser);
state = store.getState();
assert.strictEqual(state.isAuthenticated, true, "Signed in user must be authenticated");
assert.strictEqual(state.isHouseholdConfigured, true, "Signed in user must have household configured");
assert.strictEqual(state.household.syncCode, 'HERO-7777', "Sync code must be preserved and bound");
assert.strictEqual(state.householdSetupStep, 'ready', "Household step must be 'ready'");
pass("Google Sign-In correctly binds Google user to active local household syncCode");

// TEST 7: LandingAuthModal renders Resume button if syncCode exists
state.isAuthenticated = false;
state.isHouseholdConfigured = false;
state.household.syncCode = 'HERO-8842';
state.household.name = 'The Hero Family';
const htmlWithCode = renderLandingAuthModal();
assert(htmlWithCode.includes('auth-resume-household-btn'), "Modal must contain resume button when code is present");
assert(htmlWithCode.includes('HERO-8842'), "Modal must display detected sync code");
assert(htmlWithCode.includes('auth-enter-code-direct-btn'), "Modal must contain direct sync code link");
pass("LandingAuthModal renders Resume button for detected sync code and direct sync code entry");

console.log(`\n=============================================`);
console.log(`ALL ${passedCount} AUTH & HOUSEHOLD RESTORATION TESTS PASSED!`);
console.log(`=============================================\n`);

process.exit(0);
