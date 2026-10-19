// scratch/empirical_challenger2_simulation.mjs
// Empirical Multi-Device Simulation Harness for Challenger 2
// Stress-testing:
// 1. Multi-Child Sibling Isolation (concurrent completions, approval/denial isolation, Pet Sparks & Pet Level isolation)
// 2. 1:1 Map vs Quests Parity (Map -> Quest parity & double-submission block, Quest -> Map parity & double-submission block, cross-child isolation, Needs Redo reset)

import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger2-sim-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LAT = 35; // Simulated Firestore network latency (ms)

const stubs = {
  'firebase-config.js': `export const app = {}; export const auth = null; export const db = {}; export const functions = null; export const googleProvider = null; export const isFirebaseAvailable = true; export const firestoreDatabaseId = ''; export const firebaseConfig = {}; export const ensureAuthReady = async () => null;`,
  'firestore.js': `const D = { __op: 'delete' };
export const deleteField = () => D;
export const arrayRemove = (...vals) => ({ __op: 'arrayRemove', vals });
export const arrayUnion = (...vals) => ({ __op: 'arrayUnion', vals });
export const serverTimestamp = () => new Date().toISOString();
export const increment = (n) => ({ __op: 'increment', n });
export const doc = (db, ...p) => ({ path: p.join('/') });
export const collection = (db, ...p) => ({ path: p.join('/') });
export const getFirestore = () => ({});
export const setDoc = (ref, data, opts) => globalThis.__FS__.write(ref.path, data, !!(opts && opts.merge), false);
export const updateDoc = (ref, data) => globalThis.__FS__.write(ref.path, data, true, true);
export const getDoc = async (ref) => globalThis.__FS__.get(ref.path);
export const onSnapshot = (ref, cb) => globalThis.__FS__.listen(ref.path, cb);`,
  'firebase-storage.js': `export const getStorage = () => ({}); export const ref = () => ({}); export const uploadBytes = async () => ({}); export const getDownloadURL = async () => '';`,
  'sound.js': `export const Sound = new Proxy({}, { get: () => () => {} }); export function initTactileSoundEngine() {}`,
  'confetti.js': `export default function confetti() {}`,
  'voice.js': `export const COMPANION_VOICE_PROFILES = {}; export const cleanDialogueText = (t) => t; export const unlockVoiceAudio = () => {}; export const stopRex = () => {}; export const stopCompanionAudio = () => {}; export const isRexSpeaking = () => false; export const isCompanionSpeaking = () => false; export const selectPreferredVoice = () => null; export const getCompanionVoiceParams = () => ({}); export const speakCompanion = async () => {}; export const speakRex = async () => {};`,
  'celebration.js': `export function triggerInteractiveCelebration() {} export function closeInteractiveCelebration() {}`,
  'firebaseai.js': `export const SPLINE_3D_PRESETS = {}; export const firebaseAI = {}; export const THREE_D_ASSETS = []; export const getThreeDAssetsByCategory = () => []; export const matchBestThreeDAsset = () => null;`,
  'cloudfunctions.js': `export const cloudFunctionsService = {};`,
  'devreport.js': `export const aiDevelopmentalReportService = {};`,
  'petskeletal.js': `export class PetSkeletalBodyCanvas {} export const RUNWAY_POSES = {};`,
  'biometrics.js': `export const authenticateWithBiometrics = async () => true;`,
  'photouploader.js': `export const processProfilePhoto = async () => ''; export const processPhotoFitWithinBounds = async () => '';`,
  'questservice.js': `export const requestAutonomousMicroQuests = async () => []; export const submitDailyQuest = () => {};`,
  'heroagentservice.js': `export const checkProactiveTriggerAGY = async () => {};`,
  'photomodal.js': `export const chorePhotoProofModal = { open: () => {} };`,
  'geminilive.js': `export const geminiLiveService = {};`,
  'liverex.js': `export const renderRexAvatarSvg = () => '';`,
  'voiceprompts.js': `export const voicePrompts = {};`,
  'entry.js': `
import { store } from '${REPO}/src/state/store.js';
import { firestoreSync } from '${REPO}/src/services/firestoreSyncService.js';
import { renderParentPortalView, setActiveAdminTab } from '${REPO}/src/views/ParentPortalView.js';
import { renderDashboardView } from '${REPO}/src/views/DashboardView.js';
import { renderWorldAdventureMapView } from '${REPO}/src/views/WorldAdventureMapView.js';
import { PATH_OF_VALOR_WAYPOINTS } from '${REPO}/src/data/worldMapData.js';

store.setSyncService(firestoreSync);

export {
  store,
  firestoreSync,
  renderParentPortalView,
  setActiveAdminTab,
  renderDashboardView,
  renderWorldAdventureMapView,
  PATH_OF_VALOR_WAYPOINTS
};
`
};

for (const [f, c] of Object.entries(stubs)) {
  fs.writeFileSync(path.join(TMP, f), c);
}

const map = [
  [/config\/firebase\.js$/, 'firebase-config.js'],
  [/^firebase\/firestore$/, 'firestore.js'],
  [/^firebase\/storage$/, 'firebase-storage.js'],
  [/audio\/sfx\.js$/, 'sound.js'],
  [/^canvas-confetti$/, 'confetti.js'],
  [/services\/voiceService\.js$/, 'voice.js'],
  [/InteractiveCelebrationOverlay\.js$/, 'celebration.js'],
  [/firebaseAILogicService\.js$/, 'firebaseai.js'],
  [/cloudFunctionsService\.js$/, 'cloudfunctions.js'],
  [/aiDevelopmentalReportService\.js$/, 'devreport.js'],
  [/petSkeletalBodyService\.js$/, 'petskeletal.js'],
  [/utils\/biometrics\.js$/, 'biometrics.js'],
  [/utils\/photoUploader\.js$/, 'photouploader.js'],
  [/services\/questService\.js$/, 'questservice.js'],
  [/services\/heroAgentService\.js$/, 'heroagentservice.js'],
  [/ChorePhotoProofModal\.js$/, 'photomodal.js'],
  [/services\/geminiLiveService\.js$/, 'geminilive.js'],
  [/components\/LiveRexWidget\.js$/, 'liverex.js'],
  [/utils\/voicePrompts\.js$/, 'voiceprompts.js']
];

console.log('⚡ Bundling Challenger 2 test harness...');
await esbuild.build({
  entryPoints: [path.join(TMP, 'entry.js')],
  bundle: true,
  format: 'iife',
  globalName: 'Device',
  platform: 'browser',
  logLevel: 'error',
  outfile: path.join(TMP, 'device.js'),
  plugins: [
    {
      name: 'stubs',
      setup(b) {
        b.onResolve({ filter: /.*/ }, (a) => {
          for (const [re, f] of map) {
            if (re.test(a.path)) return { path: path.join(TMP, f) };
          }
          return null;
        });
      }
    }
  ]
});

const bundle = fs.readFileSync(path.join(TMP, 'device.js'), 'utf8');

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function setVal(t, k, v, deep) {
  if (v && v.__op === 'delete') {
    delete t[k];
    return;
  }
  if (v && v.__op === 'arrayRemove') {
    t[k] = (t[k] || []).filter((x) => !v.vals.some((val) => (val && val.id && x && x.id ? val.id === x.id : JSON.stringify(val) === JSON.stringify(x))));
    return;
  }
  if (v && v.__op === 'arrayUnion') {
    t[k] = [...(t[k] || [])];
    for (const val of v.vals) {
      const exists = t[k].some((x) => (val && val.id && x && x.id ? val.id === x.id : JSON.stringify(val) === JSON.stringify(x)));
      if (!exists) t[k].push(clone(val));
    }
    return;
  }
  if (v && v.__op === 'increment') {
    t[k] = (t[k] || 0) + v.n;
    return;
  }
  if (deep && v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) {
    for (const [kk, vv] of Object.entries(v)) setVal(t[k], kk, vv, true);
    return;
  }
  t[k] = clone(v);
}

function makeFS(latency = LAT) {
  const docs = {};
  const listeners = [];
  const snap = (p) => ({
    exists: () => !!docs[p],
    data: () => clone(docs[p])
  });

  return {
    docs,
    async write(p, data, merge, dotted) {
      await sleep(latency);
      if (!merge || !docs[p]) docs[p] = merge && docs[p] ? docs[p] : {};
      for (const [k, v] of Object.entries(clone(data))) {
        if (dotted && k.includes('.')) {
          const parts = k.split('.');
          let t = docs[p];
          for (const x of parts.slice(0, -1)) {
            t[x] = t[x] && typeof t[x] === 'object' ? t[x] : {};
            t = t[x];
          }
          setVal(t, parts.at(-1), v, true);
        } else {
          setVal(docs[p], k, v, true);
        }
      }
      for (const l of listeners) {
        if (l.p === p) setTimeout(() => l.cb(snap(p)), latency);
      }
    },
    async get(p) {
      return snap(p);
    },
    listen(p, cb) {
      const l = { p, cb };
      listeners.push(l);
      setTimeout(() => cb(snap(p)), latency);
      return () => listeners.splice(listeners.indexOf(l), 1);
    }
  };
}

function makeDevice(FS, deviceName = 'Device') {
  const m = new Map();
  const noop = () => {};
  const ls = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    dump: () => Object.fromEntries(m.entries())
  };
  const el = new Proxy(function () {}, {
    get: (t, p) => (p === Symbol.toPrimitive ? () => '' : el),
    apply: () => el,
    set: () => true
  });
  const ctx = {
    console: { log: noop, info: noop, warn: noop, error: (...a) => console.error(`[${deviceName}]`, ...a) },
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval: noop,
    queueMicrotask,
    Promise,
    Date,
    Math,
    JSON,
    URL,
    localStorage: ls,
    sessionStorage: ls,
    __FS__: FS,
    navigator: { userAgent: 'node', onLine: true, vibrate: noop },
    document: el,
    requestAnimationFrame: noop,
    cancelAnimationFrame: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: noop,
    location: { href: 'http://localhost/', hostname: 'localhost', pathname: '/', search: '', hash: '' },
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    CustomEvent: class {
      constructor(t, o) {
        this.type = t;
        this.detail = o?.detail;
      }
    },
    fetch: async () => { throw new Error('offline'); }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;

  vm.createContext(ctx);
  vm.runInContext(bundle, ctx);

  const dev = {
    name: deviceName,
    ctx,
    store: ctx.Device.store,
    sync: ctx.Device.firestoreSync,
    renderParentPortalView: ctx.Device.renderParentPortalView,
    setActiveAdminTab: ctx.Device.setActiveAdminTab,
    renderDashboardView: ctx.Device.renderDashboardView,
    renderWorldAdventureMapView: ctx.Device.renderWorldAdventureMapView,
    PATH_OF_VALOR_WAYPOINTS: ctx.Device.PATH_OF_VALOR_WAYPOINTS,
    localStorage: ls,
    reload() {
      vm.runInContext(bundle, ctx);
      dev.store = ctx.Device.store;
      dev.sync = ctx.Device.firestoreSync;
      dev.renderParentPortalView = ctx.Device.renderParentPortalView;
      dev.setActiveAdminTab = ctx.Device.setActiveAdminTab;
      dev.renderDashboardView = ctx.Device.renderDashboardView;
      dev.renderWorldAdventureMapView = ctx.Device.renderWorldAdventureMapView;
      dev.store.setSyncService(dev.sync);
      dev.sync.startSync('CHALLENGER2-SIM');
    }
  };

  const s = dev.store.getState();
  s.isAuthenticated = true;
  s.isHouseholdConfigured = true;
  s.householdSetupStep = 'ready';
  s.household.syncCode = 'CHALLENGER2-SIM';
  dev.sync.startSync('CHALLENGER2-SIM');

  return dev;
}

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failures = [];

function assert(condition, message, context = {}) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedAssertions++;
    const errMsg = `❌ FAIL: ${message}`;
    console.error(`  ${errMsg}`, Object.keys(context).length ? context : '');
    failures.push({ message, context });
  }
}

async function runChallengerSimulation() {
  console.log('\n======================================================================');
  console.log('⚔️  CHALLENGER 2 EMPIRICAL SIMULATION: Multi-Child & Map/Quest Parity');
  console.log('======================================================================\n');

  const FS = makeFS(LAT);

  // Setup Household with Parent (P), Sibling A (Leo), and Sibling B (Maya)
  const P = makeDevice(FS, 'Parent_Device');
  P.store.saveState(true);
  await sleep(LAT * 4);

  // Kid A (Leo) device
  const DevA = makeDevice(FS, 'Sibling_A_Device');
  await sleep(LAT * 4);

  // Kid B (Maya) profile created on Parent device
  const maya = P.store.addHero({ name: 'Maya' });
  await sleep(LAT * 6);

  // Kid B (Maya) device starts up and switches to Maya
  const DevB = makeDevice(FS, 'Sibling_B_Device');
  await sleep(LAT * 6);
  DevB.store.switchHero(maya.id);
  await sleep(LAT * 4);

  const heroA = DevA.store.getState().selectedHero;
  const heroB = DevB.store.getState().selectedHero;

  console.log(`Setup complete: Sibling A = ${heroA.name} (${heroA.id}), Sibling B = ${heroB.name} (${heroB.id})`);
  assert(heroA.id !== heroB.id, `Sibling A and Sibling B have distinct hero IDs (${heroA.id} vs ${heroB.id})`);

  // ==========================================================================
  // SECTION 1: Multi-Child Sibling Isolation
  // ==========================================================================
  console.log('\n--- SECTION 1: Multi-Child Sibling Isolation ---');

  // Subtest 1.1: Sibling A and Sibling B complete the same task simultaneously on separate devices
  console.log('\n[Subtest 1.1] Concurrent task submission on separate devices');
  const sharedTaskId = 'make_bed';

  // Both complete simultaneously
  DevA.store.toggleTaskForest(sharedTaskId);
  DevB.store.toggleTaskForest(sharedTaskId);

  // Allow Firestore sync propagation
  await sleep(LAT * 15);

  const parentPending = P.store.getState().pendingApprovals.filter(r => r.taskId === sharedTaskId);
  assert(
    parentPending.length === 2,
    `Parent receives two distinct pending approval items for simultaneous completion (found ${parentPending.length})`
  );

  const itemA = parentPending.find(r => r.kidId === heroA.id);
  const itemB = parentPending.find(r => r.kidId === heroB.id);

  assert(Boolean(itemA), `Pending item A exists for Sibling A (${heroA.name}, kidId: ${heroA.id})`);
  assert(Boolean(itemB), `Pending item B exists for Sibling B (${heroB.name}, kidId: ${heroB.id})`);
  assert(itemA && itemB && itemA.id !== itemB.id, `Pending items have unique IDs (${itemA?.id} !== ${itemB?.id})`);

  // Subtest 1.2: Approving Child A does NOT credit Child B
  console.log('\n[Subtest 1.2] Parent approval isolation');
  const preApprovalPointsA = DevA.store.getState().selectedHero.points || 0;
  const preApprovalPointsB = DevB.store.getState().selectedHero.points || 0;

  P.store.approveParentRequest(itemA.id);
  await sleep(LAT * 15);

  const postApprovalA = DevA.store.getState().selectedHero;
  const postApprovalB = DevB.store.getState().selectedHero;
  const postApprovalP_A = P.store.getState().heroes.find(h => h.id === heroA.id);
  const postApprovalP_B = P.store.getState().heroes.find(h => h.id === heroB.id);

  assert(
    postApprovalA.points === preApprovalPointsA + (itemA.pendingPoints || 10),
    `Sibling A credited Gold Points (+${itemA.pendingPoints || 10}) on Device A`
  );
  assert(
    postApprovalP_A.points === preApprovalPointsA + (itemA.pendingPoints || 10),
    `Sibling A credited Gold Points on Parent Device`
  );
  assert(
    postApprovalB.points === preApprovalPointsB,
    `Sibling B points UNCHANGED on Device B (was ${preApprovalPointsB}, now ${postApprovalB.points})`
  );
  assert(
    postApprovalP_B.points === preApprovalPointsB,
    `Sibling B points UNCHANGED on Parent Device (was ${preApprovalPointsB}, now ${postApprovalP_B.points})`
  );

  // Subtest 1.3: Denying Child B does NOT claw back Child A
  console.log('\n[Subtest 1.3] Parent denial & clawback isolation');
  const preDenialCoinsA = DevA.store.getState().selectedHero.coins;
  const preDenialXpA = DevA.store.getState().selectedHero.xp;
  const preDenialSparksA = DevA.store.getActivePetSparks ? DevA.store.getActivePetSparks(heroA.id) : (DevA.store.getState().selectedHero.sparks || 0);

  const preDenialCoinsB = DevB.store.getState().selectedHero.coins;
  const preDenialXpB = DevB.store.getState().selectedHero.xp;
  const preDenialSparksB = DevB.store.getActivePetSparks ? DevB.store.getActivePetSparks(heroB.id) : (DevB.store.getState().selectedHero.sparks || 0);

  P.store.rejectParentRequest(itemB.id);
  await sleep(LAT * 15);

  const postDenialA = DevA.store.getState().selectedHero;
  const postDenialB = DevB.store.getState().selectedHero;
  const postDenialSparksA = DevA.store.getActivePetSparks ? DevA.store.getActivePetSparks(heroA.id) : (postDenialA.sparks || 0);
  const postDenialSparksB = DevB.store.getActivePetSparks ? DevB.store.getActivePetSparks(heroB.id) : (postDenialB.sparks || 0);

  // Sibling B clawed back
  assert(
    postDenialB.coins === Math.max(0, preDenialCoinsB - (itemB.tokensAwarded || 0)),
    `Sibling B tokens clawed back to floor 0 (was ${preDenialCoinsB}, now ${postDenialB.coins})`
  );
  assert(
    postDenialB.xp === Math.max(0, preDenialXpB - (itemB.xpAwarded || 0)),
    `Sibling B XP clawed back (was ${preDenialXpB}, now ${postDenialB.xp})`
  );
  assert(
    postDenialSparksB === Math.max(0, preDenialSparksB - (itemB.sparksAwarded || 0)),
    `Sibling B Pet Sparks clawed back (was ${preDenialSparksB}, now ${postDenialSparksB})`
  );

  // Sibling A completely unaffected
  assert(postDenialA.coins === preDenialCoinsA, `Sibling A tokens untouched by Sibling B denial (${postDenialA.coins})`);
  assert(postDenialA.xp === preDenialXpA, `Sibling A XP untouched by Sibling B denial (${postDenialA.xp})`);
  assert(postDenialSparksA === preDenialSparksA, `Sibling A Pet Sparks untouched by Sibling B denial (${postDenialSparksA})`);
  assert(postDenialA.points === postApprovalA.points, `Sibling A Gold Points untouched by Sibling B denial (${postDenialA.points})`);

  // Subtest 1.4: Pet Sparks and Pet Levels remain strictly isolated per child
  console.log('\n[Subtest 1.4] Pet Sparks and Pet Level strict isolation per child');
  {
    // Both siblings have companion pet '1' (Rex)
    // Sibling A earns 100 sparks on pet '1'
    const sparksToAddA = 100;
    const initialSparksA = DevA.store.getPetSparks('1', heroA.id);
    const initialSparksB = DevB.store.getPetSparks('1', heroB.id);

    DevA.store.addPetSparks('1', sparksToAddA, heroA.id);
    DevA.store.saveState(true);
    await sleep(LAT * 12);

    const sparksAfterA = DevA.store.getPetSparks('1', heroA.id);
    const sparksAfterB = DevB.store.getPetSparks('1', heroB.id);
    const sparksAfterB_onParent = P.store.getPetSparks('1', heroB.id);

    assert(
      sparksAfterA === initialSparksA + sparksToAddA,
      `Sibling A pet sparks increased by ${sparksToAddA} (was ${initialSparksA}, now ${sparksAfterA})`
    );
    assert(
      sparksAfterB === initialSparksB,
      `Sibling B pet sparks strictly isolated: earned 0 sparks, remains ${initialSparksB} (got ${sparksAfterB})`
    );
    assert(
      sparksAfterB_onParent === initialSparksB,
      `Sibling B pet sparks on Parent device strictly isolated (remains ${initialSparksB}, got ${sparksAfterB_onParent})`
    );

    // Sibling B trains pet '1' to Level 2 by earning training XP
    // Pet Level 1 -> 2 requires 100 XP (level * 100)
    const initialLevelA = DevA.store.getPetLevel('1', heroA.id);
    const initialLevelB = DevB.store.getPetLevel('1', heroB.id);

    // Sibling B adds 150 training XP to pet '1'
    DevB.store.addPetTrainingXp('1', 150);
    DevB.store.saveState(true);
    await sleep(LAT * 12);

    const levelAfterA = DevA.store.getPetLevel('1', heroA.id);
    const levelAfterB = DevB.store.getPetLevel('1', heroB.id);

    assert(
      levelAfterB >= 2,
      `Sibling B pet leveled up to Level ${levelAfterB} after training`
    );
    assert(
      levelAfterA === initialLevelA,
      `Sibling A pet level strictly isolated: remains Level ${initialLevelA} (does not inherit Sibling B level, got ${levelAfterA})`
    );
  }

  // ==========================================================================
  // SECTION 2: 1:1 Map vs Quests Parity
  // ==========================================================================
  console.log('\n--- SECTION 2: 1:1 Map vs Quests Parity ---');

  // Subtest 2.1: Complete waypoint on Map -> verify Quest shows completed and blocks double submission
  console.log('\n[Subtest 2.1] Complete waypoint on Map -> Quest parity & double submission block');
  {
    // Waypoint: 'wp_morning_teeth' -> choreKey: 'brush_teeth_am', aliased to 'morning_brush'
    // Clear any previous completions for this task
    DevA.store.getState().taskCompletionLogs = (DevA.store.getState().taskCompletionLogs || []).filter(l => !DevA.store.getTaskAliasGroup('morning_brush').includes(l.taskId));
    DevA.store.getState().pendingApprovals = (DevA.store.getState().pendingApprovals || []).filter(r => !DevA.store.getTaskAliasGroup('morning_brush').includes(r.taskId));
    DevA.store.saveState(false);

    // Sibling A completes waypoint on World Map
    const mapRes = DevA.store.completeWaypointChore('wp_morning_teeth');
    assert(mapRes && mapRes.success, `World Map waypoint 'wp_morning_teeth' completed successfully`);

    // Verify Quest (morning_brush in Task Forest) shows completed/pending
    const taskInForest = DevA.store.getState().taskForest.find(t => t.id === 'morning_brush');
    assert(
      taskInForest && taskInForest.completed === true,
      `Quest 'morning_brush' in Task Forest marked completed: true after World Map completion`
    );

    const isPendingInQuests = DevA.store.isTaskPendingApproval('morning_brush', heroA.id);
    assert(
      isPendingInQuests,
      `Quest 'morning_brush' isTaskPendingApproval returns true after World Map completion`
    );

    // Verify double submission from Quests is BLOCKED
    const coinsBeforeQuestsAttempt = DevA.store.getState().selectedHero.coins;
    const approvalsBeforeQuestsAttempt = DevA.store.getState().pendingApprovals.length;

    DevA.store.toggleTaskForest('morning_brush');

    const coinsAfterQuestsAttempt = DevA.store.getState().selectedHero.coins;
    const approvalsAfterQuestsAttempt = DevA.store.getState().pendingApprovals.length;

    assert(
      coinsAfterQuestsAttempt === coinsBeforeQuestsAttempt,
      `Submitting from Quests while pending from Map is BLOCKED: no duplicate tokens awarded (was ${coinsBeforeQuestsAttempt}, now ${coinsAfterQuestsAttempt})`
    );
    assert(
      approvalsAfterQuestsAttempt === approvalsBeforeQuestsAttempt,
      `Submitting from Quests while pending from Map is BLOCKED: no duplicate pending approval created`
    );

    // Verify double submission from World Map is also BLOCKED
    const duplicateMapRes = DevA.store.completeWaypointChore('wp_morning_teeth');
    assert(
      !duplicateMapRes.success && (duplicateMapRes.alreadyPending || duplicateMapRes.alreadyCompleted),
      `Submitting from World Map while pending is BLOCKED: returns success: false with alreadyPending/alreadyCompleted`
    );
  }

  // Subtest 2.2: Complete Quest in Dashboard -> verify Map waypoint shows completed and blocks double submission
  console.log('\n[Subtest 2.2] Complete Quest in Dashboard -> Map waypoint parity & double submission block');
  {
    // Task: 'clean_toys' in Task Forest -> aliased to 'clean_room' and 'wp_tidy_room' on Map
    // Clear any previous logs for clean_toys
    DevA.store.getState().taskCompletionLogs = (DevA.store.getState().taskCompletionLogs || []).filter(l => !DevA.store.getTaskAliasGroup('clean_toys').includes(l.taskId));
    DevA.store.getState().pendingApprovals = (DevA.store.getState().pendingApprovals || []).filter(r => !DevA.store.getTaskAliasGroup('clean_toys').includes(r.taskId));
    const cleanToysTask = DevA.store.getState().taskForest.find(t => t.id === 'clean_toys');
    if (cleanToysTask) cleanToysTask.completed = false;
    DevA.store.saveState(false);

    // Sibling A completes 'clean_toys' in Quests / Dashboard
    DevA.store.toggleTaskForest('clean_toys');

    // Verify Map waypoint 'wp_tidy_room' (choreKey: 'clean_room') shows pending / completed
    const wp = DevA.PATH_OF_VALOR_WAYPOINTS.find(w => w.id === 'wp_tidy_room');
    assert(Boolean(wp), `Found World Map waypoint 'wp_tidy_room' (choreKey: '${wp?.choreKey}')`);

    const isMapChorePending = DevA.store.isTaskPendingApproval(wp.choreKey, heroA.id);
    assert(
      isMapChorePending,
      `Map chore '${wp.choreKey}' isTaskPendingApproval returns true after Quest completion in Dashboard`
    );

    // Verify completing waypoint on Map is BLOCKED
    const coinsBeforeMapAttempt = DevA.store.getState().selectedHero.coins;
    const approvalsBeforeMapAttempt = DevA.store.getState().pendingApprovals.length;

    const mapAttempt = DevA.store.completeWaypointChore('wp_tidy_room');

    const coinsAfterMapAttempt = DevA.store.getState().selectedHero.coins;
    const approvalsAfterMapAttempt = DevA.store.getState().pendingApprovals.length;

    assert(
      !mapAttempt.success && (mapAttempt.alreadyPending || mapAttempt.alreadyCompleted),
      `Completing waypoint on Map while pending from Quest is BLOCKED: returns success: false`
    );
    assert(
      coinsAfterMapAttempt === coinsBeforeMapAttempt,
      `Completing waypoint on Map while pending from Quest is BLOCKED: no duplicate tokens awarded`
    );
    assert(
      approvalsAfterMapAttempt === approvalsBeforeMapAttempt,
      `Completing waypoint on Map while pending from Quest is BLOCKED: no duplicate pending approval created`
    );
  }

  // Subtest 2.3: Cross-Child Map & Quest Independence
  console.log('\n[Subtest 2.3] Sibling B is NOT blocked when Sibling A has completed a Map chore');
  {
    // Sibling A currently has 'wp_morning_teeth' pending
    // Verify Sibling B is NOT blocked from completing 'wp_morning_teeth' on Sibling B's device
    const siblingBPendingBefore = DevB.store.isTaskPendingApproval('brush_teeth_am', heroB.id);
    assert(
      !siblingBPendingBefore,
      `Sibling B does NOT have 'brush_teeth_am' pending just because Sibling A completed it`
    );

    const bMapRes = DevB.store.completeWaypointChore('wp_morning_teeth');
    assert(
      bMapRes && bMapRes.success,
      `Sibling B completes 'wp_morning_teeth' on Map successfully with zero interference from Sibling A`
    );
  }

  // Subtest 2.4: Denial resets Map & Quest state with "Needs Redo" allowing re-attempt
  console.log('\n[Subtest 2.4] Denial resets Map & Quest state with "Needs Redo"');
  {
    await sleep(LAT * 10);
    // Parent rejects Sibling B's 'brush_teeth_am' submission
    const reqB = P.store.getState().pendingApprovals.find(r => r.kidId === heroB.id && DevB.store.getTaskAliasGroup('brush_teeth_am').includes(r.taskId));
    assert(Boolean(reqB), `Parent located Sibling B's pending approval item to deny`);

    if (reqB) {
      P.store.rejectParentRequest(reqB.id);
      await sleep(LAT * 15);

      // Verify on DevB:
      // 1. isTaskPendingApproval is false
      const isPendingAfterDenial = DevB.store.isTaskPendingApproval('brush_teeth_am', heroB.id);
      assert(!isPendingAfterDenial, `Sibling B 'brush_teeth_am' is no longer pending approval after denial`);

      // 2. isTaskNeedsRedo is true
      const isNeedsRedo = DevB.store.isTaskNeedsRedo ? DevB.store.isTaskNeedsRedo('brush_teeth_am', heroB.id) : false;
      assert(isNeedsRedo, `Sibling B 'brush_teeth_am' is in 'Needs Redo' state after denial`);

      // 3. getTaskCompletionsToday does NOT block the task
      const completionsToday = DevB.store.getTaskCompletionsToday('brush_teeth_am', heroB.id);
      assert(completionsToday.length === 0, `getTaskCompletionsToday returns 0 completions so task is unblocked`);

      // 4. Sibling B can re-attempt on Map
      const reattemptRes = DevB.store.completeWaypointChore('wp_morning_teeth');
      assert(
        reattemptRes && reattemptRes.success,
        `Sibling B successfully re-submits 'wp_morning_teeth' on Map today after denial`
      );
    }
  }

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n======================================================================');
  console.log(`CHALLENGER 2 SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED (Total: ${totalAssertions})`);
  console.log('======================================================================\n');

  if (failures.length > 0) {
    console.error('❌ CHALLENGER 2 DEFECTS DETECTED:');
    failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f.message}`));
  }

  fs.rmSync(TMP, { recursive: true, force: true });

  if (failedAssertions > 0) {
    process.exit(1);
  } else {
    console.log('🏆 CHALLENGER 2 EMPIRICAL VERIFICATION COMPLETE: ALL INVARIANTS VERIFIED!');
    process.exit(0);
  }
}

runChallengerSimulation().catch((err) => {
  console.error('💥 Uncaught exception in Challenger 2 test runner:', err);
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(1);
});
