// scratch/verify_challenger_edge_cases.mjs
// Empirical Stress Test Harness by Challenger 1
// Verifies:
// 1. Reversible Denial Edge Cases (clamping, pet sparks floor, immediate re-attempt / Needs Redo)
// 2. Approval Integrity (Gold Points awarded without mutating screenTimeMinutes)
// 3. Zero-Drop Simulation (5-minute-old 300,000ms approval survives hydration & triggers repair push)

import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger-test-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LAT = 30; // Simulated network latency (ms)

const stubs = {
  'firebase-config.js': `export const app = {}; export const auth = null; export const db = {}; export const functions = null; export const googleProvider = null; export const isFirebaseAvailable = true; export const firestoreDatabaseId = ''; export const firebaseConfig = {};`,
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

console.log('📦 Bundling app code for Challenger 1 Stress Testing...');
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
    localStorage: ls,
    reload() {
      vm.runInContext(bundle, ctx);
      dev.store = ctx.Device.store;
      dev.sync = ctx.Device.firestoreSync;
      dev.store.setSyncService(dev.sync);
      dev.sync.startSync('CHALLENGER-SYNC-CODE');
    }
  };

  const s = dev.store.getState();
  s.isAuthenticated = true;
  s.isHouseholdConfigured = true;
  s.householdSetupStep = 'ready';
  s.household.syncCode = 'CHALLENGER-SYNC-CODE';
  dev.sync.startSync('CHALLENGER-SYNC-CODE');

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

async function runChallengerStressTests() {
  console.log('\n======================================================================');
  console.log('⚔️  CHALLENGER 1 EMPIRICAL STRESS TEST HARNESS');
  console.log('======================================================================\n');

  const FS = makeFS(LAT);
  const Kid = makeDevice(FS, 'Kid_Tablet');
  const Parent = makeDevice(FS, 'Parent_Mobile');

  await sleep(LAT * 5);

  // ==========================================================================
  // SECTION 1: Reversible Denial Edge Cases
  // ==========================================================================
  console.log('--- 1. Reversible Denial Edge Cases ---');

  // Baseline Hero Setup
  const kidState = Kid.store.getState();
  const hero = kidState.selectedHero;
  hero.coins = 0;
  hero.tokens = 0;
  hero.xp = 0;
  hero.points = 0;
  hero.screenTimeMinutes = 30;

  // Set active pet sparks to 10 (less than the 15 sparks awarded, to rigorously challenge clamp to 0)
  const activePetId = hero.activePetId || '1';
  Kid.store.setPetSparks(activePetId, 10, hero.id);
  hero.sparks = 10;
  hero.evolutionSparks = 10;
  Kid.store.saveState(true);
  await sleep(LAT * 5);

  assert(Kid.store.getPetSparks(activePetId, hero.id) === 10, 'Initial active pet sparks set to 10 (less than 15 sparks)');

  // Configure a specific chore with exactly +30 coins, +50 XP, +15 sparks, 15 pending points
  let targetTask = kidState.taskForest.find(t => t.id === 'clean_room' || t.id === 'clean_toys');
  if (!targetTask) {
    targetTask = { id: 'clean_toys', title: 'Clean Up Toys', completed: false };
    kidState.taskForest.push(targetTask);
  }
  targetTask.coins = 30;
  targetTask.tokens = 30;
  targetTask.xp = 50;
  targetTask.sparks = 15;
  targetTask.points = 15;
  targetTask.completed = false;
  Kid.store.saveState(true);
  await sleep(LAT * 5);

  // 1.1 Kid submits chore
  console.log('\n[Scenario 1.1] Kid submits chore (+30 coins, +50 XP, +15 sparks, 15 points pending)');
  Kid.store.toggleTaskForest(targetTask.id);
  await sleep(LAT * 10);

  const heroAfterSubmit = Kid.store.getState().selectedHero;
  const sparksAfterSubmit = Kid.store.getPetSparks(activePetId, hero.id);

  assert(heroAfterSubmit.coins === 30, `Auto-issuance: Hero coins incremented by +30 (now ${heroAfterSubmit.coins})`);
  assert(heroAfterSubmit.xp === 50, `Auto-issuance: Hero XP incremented by +50 (now ${heroAfterSubmit.xp})`);
  assert(sparksAfterSubmit === 25, `Auto-issuance: Pet sparks incremented by +15 (10 + 15 = ${sparksAfterSubmit})`);
  assert(heroAfterSubmit.points === 0, `Auto-issuance: Gold Points strictly 0 (not auto-issued)`);

  const pendingList = Kid.store.getState().pendingApprovals || [];
  const choreApproval = pendingList.find(p => p.taskId === targetTask.id && p.kidId === hero.id);
  assert(Boolean(choreApproval), 'Pending approval record exists for chore submission');
  assert(choreApproval?.tokensAwarded === 30, 'Pending approval tokensAwarded recorded as 30');
  assert(choreApproval?.xpAwarded === 50, 'Pending approval xpAwarded recorded as 50');
  assert(choreApproval?.sparksAwarded === 15, 'Pending approval sparksAwarded recorded as 15');
  assert(choreApproval?.pendingPoints === 15, 'Pending approval pendingPoints recorded as 15');

  // 1.2 Kid spends coins down to 5 in the shop
  console.log('\n[Scenario 1.2] Kid spends coins down to 5 in the shop');
  heroAfterSubmit.coins = 5;
  heroAfterSubmit.tokens = 5;
  // Also reduce pet sparks to 5 (e.g. kid used/spent sparks or pet care action took sparks)
  Kid.store.setPetSparks(activePetId, 5, hero.id);
  heroAfterSubmit.sparks = 5;
  heroAfterSubmit.evolutionSparks = 5;
  Kid.store.saveState(true);
  await sleep(LAT * 10);

  assert(Kid.store.getState().selectedHero.coins === 5, 'Hero coins successfully spent down to 5');
  assert(Kid.store.getPetSparks(activePetId, hero.id) === 5, 'Active pet sparks reduced to 5 before parent denial');

  // 1.3 Parent denies chore: verify coins clamp at 0 (not negative), pet sparks clamp at 0, task is Needs Redo
  console.log('\n[Scenario 1.3] Parent denies chore: verify clamping and Needs Redo');
  // Wait for Parent device to have the approval
  const parentApproval = Parent.store.getState().pendingApprovals.find(p => p.id === choreApproval.id);
  assert(Boolean(parentApproval), 'Parent device synchronized pending approval');

  Parent.store.rejectParentRequest(choreApproval.id);
  await sleep(LAT * 15);

  const heroAfterDenial = Kid.store.getState().selectedHero;
  const petSparksAfterDenial = Kid.store.getPetSparks(activePetId, hero.id);

  // Coins clamp verification
  assert(heroAfterDenial.coins === 0, `CLAWBACK CLAMP: Coins clamped at 0 (was 5, claws back 30 -> 0, not -25)`);
  assert(heroAfterDenial.tokens === 0, `CLAWBACK CLAMP: Tokens clamped at 0`);
  assert(heroAfterDenial.xp === 0, `CLAWBACK CLAMP: XP clamped at 0 (was 50, claws back 50 -> 0)`);

  // Active pet sparks clamp verification
  assert(petSparksAfterDenial === 0, `CLAWBACK CLAMP: Active pet sparks clamped at 0 (was 5, claws back 15 -> 0, not -10)`);
  assert(heroAfterDenial.sparks === 0, `CLAWBACK CLAMP: Hero sparks property clamped at 0`);

  // Check task completion logs
  const deniedLog = Kid.store.getState().taskCompletionLogs.find(l => l.approvalRequestId === choreApproval.id || (l.taskId === targetTask.id && l.status === 'rejected'));
  assert(Boolean(deniedLog && deniedLog.status === 'rejected'), `taskCompletionLogs contains entry marked status: 'rejected'`);

  // Verify task can be immediately re-attempted and submitted today (Needs Redo)
  const completionsToday = Kid.store.getTaskCompletionsToday(targetTask.id, hero.id);
  assert(completionsToday.length === 0, `Needs Redo: getTaskCompletionsToday excludes rejected logs (length = 0)`);

  const taskInForest = Kid.store.getState().taskForest.find(t => t.id === targetTask.id);
  assert(taskInForest && taskInForest.completed === false, `Needs Redo: Task is uncompleted in taskForest (completed: false)`);

  // Immediate re-attempt by child
  console.log('\n[Scenario 1.4] Kid immediately re-attempts and submits chore today');
  Kid.store.toggleTaskForest(targetTask.id);
  await sleep(LAT * 10);

  const heroAfterReattempt = Kid.store.getState().selectedHero;
  assert(heroAfterReattempt.coins === 30, `Re-attempt succeeds: Kid awarded +30 coins again`);
  assert(heroAfterReattempt.xp === 50, `Re-attempt succeeds: Kid awarded +50 XP again`);
  assert(Kid.store.getPetSparks(activePetId, hero.id) === 15, `Re-attempt succeeds: Active pet sparks +15 (0 + 15 = 15)`);

  const reattemptApproval = Kid.store.getState().pendingApprovals.find(p => p.taskId === targetTask.id && p.status === 'pending');
  assert(Boolean(reattemptApproval), `Re-attempt successfully generates fresh pending approval`);


  // ==========================================================================
  // SECTION 2: Approval Integrity
  // ==========================================================================
  console.log('\n--- 2. Approval Integrity ---');
  // Baseline screen time and points
  heroAfterReattempt.points = 10;
  heroAfterReattempt.screenTimeMinutes = 45;
  Kid.store.saveState(true);
  await sleep(LAT * 10);

  console.log(`Kid initial Gold Points: 10, screenTimeMinutes: 45`);

  // Parent approves reattemptApproval
  const parentReattemptReq = Parent.store.getState().pendingApprovals.find(p => p.id === reattemptApproval.id);
  assert(Boolean(parentReattemptReq), 'Parent finds re-attempt pending approval');

  Parent.store.approveParentRequest(reattemptApproval.id);
  await sleep(LAT * 15);

  const heroAfterApproval = Kid.store.getState().selectedHero;
  const parentHeroAfterApproval = Parent.store.getState().heroes.find(h => h.id === hero.id);

  assert(heroAfterApproval.points === 25, `Gold Points awarded: Kid points increased by +15 (10 + 15 = ${heroAfterApproval.points})`);
  assert(parentHeroAfterApproval.points === 25, `Parent device reflects 25 Gold Points`);

  // CRITICAL CHECK: screenTimeMinutes MUST NOT CHANGE
  assert(
    heroAfterApproval.screenTimeMinutes === 45,
    `APPROVAL INTEGRITY: screenTimeMinutes is STRICTLY UNCHANGED (expected 45, got ${heroAfterApproval.screenTimeMinutes})`
  );
  assert(
    parentHeroAfterApproval.screenTimeMinutes === 45,
    `APPROVAL INTEGRITY: screenTimeMinutes on Parent device is STRICTLY UNCHANGED (remains 45)`
  );

  const approvedLog = Kid.store.getState().taskCompletionLogs.find(l => l.approvalRequestId === reattemptApproval.id);
  assert(Boolean(approvedLog && approvedLog.status === 'approved'), 'taskCompletionLogs entry marked status: approved');

  // Verify task resets to completed: false for subsequent cycles
  const taskAfterApproval = Kid.store.getState().taskForest.find(t => t.id === targetTask.id);
  assert(taskAfterApproval && taskAfterApproval.completed === false, 'Task reset to completed: false so it can be completed in future cycles');


  // ==========================================================================
  // SECTION 3: Zero-Drop Simulation
  // ==========================================================================
  console.log('\n--- 3. Zero-Drop Simulation ---');

  // 3.1 Simulate a local pending approval created 5 minutes ago (300,000ms old)
  const now = Date.now();
  const fiveMinutesAgo = now - 300000;
  const oldApprovalId = `task_chore_5min_old_${fiveMinutesAgo}`;

  const oldLocalApproval = {
    id: oldApprovalId,
    logId: `compl_${fiveMinutesAgo}_test`,
    kidId: hero.id,
    kidName: hero.name || 'Little Hero',
    type: 'task_point_approval',
    taskId: 'homework_reading',
    taskTitle: 'Read Adventure Book',
    zone: 'Task Forest',
    tokensAwarded: 25,
    xpAwarded: 40,
    sparksAwarded: 20,
    pendingPoints: 20,
    timestamp: new Date(fiveMinutesAgo).toISOString(),
    status: 'pending'
  };

  // Inject this 5-minute-old pending approval into Kid device state
  Kid.store.getState().pendingApprovals.push(oldLocalApproval);

  // Set up spy on pushStateToCloud
  let repairPushCalled = false;
  let repairPushForce = null;
  const originalPush = Kid.sync.pushStateToCloud;
  Kid.sync.pushStateToCloud = function (force) {
    repairPushCalled = true;
    repairPushForce = force;
    return originalPush.apply(this, arguments);
  };

  console.log(`Created 5-minute-old approval (age: 300,000ms, id: ${oldApprovalId})`);

  // 3.2 Trigger cloud hydration with remote document missing the approval
  console.log('Triggering cloud hydration with remote document missing the 5-minute-old approval...');
  const remoteDocMissingApproval = {
    household: { syncCode: 'CHALLENGER-SYNC-CODE' },
    pendingApprovals: [
      // Cloud contains another unrelated approval or is empty
      {
        id: 'some_other_cloud_req_999',
        kidId: 'hero_2',
        kidName: 'Sam',
        type: 'task_point_approval',
        taskId: 'brush_teeth',
        pendingPoints: 10,
        status: 'pending'
      }
    ],
    taskCompletionLogs: [],
    resolvedApprovals: []
  };

  Kid.store.hydrateFromCloud(remoteDocMissingApproval);

  // 3.3 Verify the 5-minute-old approval survives hydration
  const survivedApproval = Kid.store.getState().pendingApprovals.find(p => p.id === oldApprovalId);
  assert(Boolean(survivedApproval), 'ZERO-DROP: 5-minute-old (300,000ms) pending approval survived cloud hydration!');
  assert(survivedApproval?.pendingPoints === 20, 'ZERO-DROP: Survived approval metadata (pendingPoints: 20) fully intact');
  assert(survivedApproval?.tokensAwarded === 25, 'ZERO-DROP: Survived approval metadata (tokensAwarded: 25) fully intact');
  assert(survivedApproval?.sparksAwarded === 20, 'ZERO-DROP: Survived approval metadata (sparksAwarded: 20) fully intact');

  // Verify remote approval was also merged (non-destructive union)
  const otherCloudApproval = Kid.store.getState().pendingApprovals.find(p => p.id === 'some_other_cloud_req_999');
  assert(Boolean(otherCloudApproval), 'ZERO-DROP: Remote approval merged alongside local approval without clobbering');

  // Verify immediate repair push was triggered
  assert(repairPushCalled === true, 'ZERO-DROP REPAIR: pushStateToCloud was immediately triggered');
  assert(repairPushForce === true, 'ZERO-DROP REPAIR: pushStateToCloud was invoked with force=true');

  // Restore original push
  Kid.sync.pushStateToCloud = originalPush;

  // Let the repair push complete and propagate to cloud
  await sleep(LAT * 10);
  const cloudDoc = FS.docs['households/CHALLENGER-SYNC-CODE'];
  const presentInCloud = cloudDoc?.pendingApprovals?.some(p => p.id === oldApprovalId);
  assert(Boolean(presentInCloud), 'ZERO-DROP REPAIR: Cloud document now contains the repaired 5-minute-old approval');

  // 3.4 Verify persistence across device reboot / reload from persistent storage
  console.log('\n[Scenario 3.4] Device reload with 5-minute-old approval in localStorage');
  Kid.store.saveState(true);
  Kid.reload();

  const approvalAfterReload = Kid.store.getState().pendingApprovals.find(p => p.id === oldApprovalId);
  assert(Boolean(approvalAfterReload), 'ZERO-DROP PERSISTENCE: 5-minute-old approval survives device restart/reload from localStorage');

  // 3.5 Resolution Integrity: Once resolved, verify it does NOT resurrect
  console.log('\n[Scenario 3.5] Resolution Integrity: Explicit parent resolution permanently resolves item');
  Parent.store.approveParentRequest(oldApprovalId);
  await sleep(LAT * 15);

  const postResolutionKid = Kid.store.getState().pendingApprovals.find(p => p.id === oldApprovalId);
  assert(!postResolutionKid, 'Resolved approval cleanly removed from Kid pendingApprovals');

  // Trigger hydration with stale remote doc still containing old approval
  Kid.store.hydrateFromCloud({
    household: { syncCode: 'CHALLENGER-SYNC-CODE' },
    pendingApprovals: [{ id: oldApprovalId, status: 'pending' }],
    resolvedApprovals: [{ id: oldApprovalId, resolvedAt: new Date().toISOString(), action: 'approve' }]
  });

  const resurrectedCheck = Kid.store.getState().pendingApprovals.find(p => p.id === oldApprovalId);
  assert(!resurrectedCheck, 'RESOLVED DEFENSE: Resolved approval is NOT resurrected by stale cloud document');

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n======================================================================');
  console.log(`STRESS TEST SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED (Total: ${totalAssertions})`);
  console.log('======================================================================\n');

  if (failedAssertions > 0) {
    console.error('❌ STRESS TESTS FAILED WITH DEFECTS:');
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. ${f.message}`, f.context);
    });
    process.exit(1);
  } else {
    console.log('🎉 ALL CHALLENGER EMPIRICAL STRESS TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

runChallengerStressTests().catch(err => {
  console.error('💥 Unhandled exception during stress test execution:', err);
  process.exit(1);
});
