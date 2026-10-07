import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 Starting Verification of Fragmentation and Digital Rewards Fixes...\n');

// Mock localStorage
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

global.window = {
  location: { reload: () => {}, href: 'http://localhost/' },
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  speechSynthesis: {
    getVoices: () => [],
    speak: () => {},
    cancel: () => {},
    onvoiceschanged: null
  }
};

global.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  createElement: () => ({ getContext: () => ({}), style: {}, setAttribute: () => {}, appendChild: () => {} }),
  body: { appendChild: () => {}, removeChild: () => {} }
};

// Test 1: Returning browser with digitalRewardsOverhaulApplied: true and partial digitalGear
console.log('--- Test 1: LocalStorage Schema Lock in store.js ---');
const { DIGITAL_REWARDS_CATALOG } = await import('../src/data/digitalRewardsCatalog.js');

// Simulate returning user's locked localStorage state with only 2 items
const oldUserSave = {
  digitalRewardsOverhaulApplied: true,
  digitalGear: [
    { id: 'laser_toothbrush', name: 'Laser Toothbrush', category: 'Weapons' },
    { id: 'cowl_hero', name: 'Hero Cowl', category: 'Avatar Gear' }
  ],
  parentCustomWeapons: [{ id: 'custom_sword_1', name: 'Papa Dragon Blade', category: 'Weapons' }],
  parentCustomFood: [{ id: 'custom_apple_1', name: 'Super Apple', category: 'Snacks' }]
};
localStorage.setItem('little_heroes_adventure_master_v10', JSON.stringify(oldUserSave));

const { store } = await import('../src/state/store.js');
store.init();

const state = store.getState();
assert(Array.isArray(state.digitalGear), 'state.digitalGear must be an array');
assert(
  state.digitalGear.length >= DIGITAL_REWARDS_CATALOG.length,
  `state.digitalGear (${state.digitalGear.length}) must contain all DIGITAL_REWARDS_CATALOG items (${DIGITAL_REWARDS_CATALOG.length})`
);

// Verify all items from catalog are in state.digitalGear
for (const catItem of DIGITAL_REWARDS_CATALOG) {
  const found = state.digitalGear.some(d => d.id === catItem.id);
  assert(found, `Catalog item ${catItem.id} must be in state.digitalGear`);
}
console.log('  ✅ PASS: All DIGITAL_REWARDS_CATALOG items are merged into state.digitalGear even when digitalRewardsOverhaulApplied is already true');

// Verify custom items exist and are preserved
assert(Array.isArray(state.parentCustomWeapons), 'parentCustomWeapons must be an array');
assert(state.parentCustomWeapons.length >= 1, 'parentCustomWeapons must be preserved');
assert(Array.isArray(state.parentCustomFood), 'parentCustomFood must be an array');
assert(state.parentCustomFood.length >= 1, 'parentCustomFood must be preserved');
console.log('  ✅ PASS: parentCustomWeapons and parentCustomFood are preserved');

// Test 2: Version checks in index.html and sw.js
console.log('\n--- Test 2: PWA Version Bump and Cache Buster ---');
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert(
  indexHtml.includes("const APP_BUILD_VERSION = 'v3.3.0-digital-rewards-20261007'"),
  'index.html must have APP_BUILD_VERSION v3.3.0-digital-rewards-20261007'
);
assert(
  indexHtml.includes('handleChunkOrCacheError'),
  'index.html must have handleChunkOrCacheError'
);
assert(
  indexHtml.includes('unhandledrejection'),
  'index.html must have unhandledrejection listener for chunk loading error recovery'
);
console.log('  ✅ PASS: index.html has updated APP_BUILD_VERSION and chunk recovery logic');

const swJs = fs.readFileSync('public/sw.js', 'utf8');
assert(
  swJs.includes("const CACHE_NAME = 'little-heroes-v3.3.0-rewards-revamp-20261007'"),
  'public/sw.js must have CACHE_NAME little-heroes-v3.3.0-rewards-revamp-20261007'
);
assert(
  swJs.includes('self.clients.claim()'),
  'public/sw.js must call self.clients.claim()'
);
console.log('  ✅ PASS: public/sw.js has bumped CACHE_NAME and immediate cache purging');

// Test 3: Routing in main.js
console.log('\n--- Test 3: URL Routing & /teamwork-preview in main.js ---');
const mainJs = fs.readFileSync('src/main.js', 'utf8');
assert(mainJs.includes("'/teamwork-preview'"), 'src/main.js must handle /teamwork-preview');
assert(mainJs.includes("'teamwork-preview'"), 'src/main.js must handle teamwork-preview');
assert(mainJs.includes("'teamwork_preview'"), 'src/main.js must handle teamwork_preview');
assert(mainJs.includes("DANCE_PARTY_VIEW_NAMES"), 'src/main.js must define DANCE_PARTY_VIEW_NAMES');
console.log('  ✅ PASS: src/main.js has teamwork-preview routing and cleanup');

// Test 4: server.js static serving and nested asset redirection
console.log('\n--- Test 4: server.js Static Serving and Error Handling ---');
const serverJs = fs.readFileSync('server.js', 'utf8');
assert(
  serverJs.includes("req.path.indexOf('/assets/')"),
  'server.js must handle nested /assets/ paths'
);
assert(
  serverJs.includes("res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')"),
  'server.js must set immutable cache for assets'
);
assert(
  serverJs.includes("res.status(404).json({ error: 'Asset not found' })"),
  'server.js must return 404 json for missing assets'
);
console.log('  ✅ PASS: server.js handles nested asset requests and cache headers');

console.log('\n🎉 ALL VERIFICATION CHECKS PASSED!\n');
