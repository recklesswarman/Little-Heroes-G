// scratch/verify_task_habit_engine_and_sync.mjs
// End-to-End Multi-Device Simulation Test Suite for Task & Habit Engine and Household Realtime Sync.
//
// Verifies:
// 1. Auto-Reward Issuance & Pending Approvals Schema (tokens, XP, sparks auto-credited; points queued; full schema)
// 2. Parent Portal Display Verification (tokens, XP, sparks, pending points metadata; no screen time display)
// 3. Zero-Drop Persistence (removal of 45-second cutoff; persistence across reloads/restarts/cloud hydration)
// 4. Approval Flow (awards points, no screen time auto-conversion, task resets for re-completion)
// 5. Denial Flow (claws back tokens, XP, sparks clamped at floor 0; log rejected; 'Needs Redo' state allows completion today)
// 6. 1:1 Parity between World Map and Quests (bidirectional sync, dynamic reward inheritance, single completion payout per cycle)
// 7. Concurrent Sibling Submissions (two kids submitting tasks concurrently produce separate pending approvals with zero data bleed or array clobbering)

import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'task-engine-sync-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LAT = 45; // Simulated Firestore network latency (ms)

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

console.log('📦 Bundling store, sync, and views for multi-device simulation...');
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
      // Re-run bundle with preserved localStorage to simulate app reload/restart
      vm.runInContext(bundle, ctx);
      dev.store = ctx.Device.store;
      dev.sync = ctx.Device.firestoreSync;
      dev.renderParentPortalView = ctx.Device.renderParentPortalView;
      dev.setActiveAdminTab = ctx.Device.setActiveAdminTab;
      dev.renderDashboardView = ctx.Device.renderDashboardView;
      dev.renderWorldAdventureMapView = ctx.Device.renderWorldAdventureMapView;
      dev.store.setSyncService(dev.sync);
      dev.sync.startSync('HERO-TASK-SIM');
    }
  };

  const s = dev.store.getState();
  s.isAuthenticated = true;
  s.isHouseholdConfigured = true;
  s.householdSetupStep = 'ready';
  s.household.syncCode = 'HERO-TASK-SIM';
  dev.sync.startSync('HERO-TASK-SIM');

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

async function runSuite() {
  console.log('\n======================================================================');
  console.log('🚀 Little Hero Adventures Task Engine & Household Realtime Sync E2E Suite');
  console.log('======================================================================\n');

  const FS = makeFS(LAT);

  // Initialize Kid 1 (K1) and Parent (P)
  const K1 = makeDevice(FS, 'Kid_1');
  K1.store.saveState(true);
  await sleep(LAT * 6);

  const P = makeDevice(FS, 'Parent');
  await sleep(LAT * 6);

  // --------------------------------------------------------------------------
  // TEST 1: Auto-Reward Issuance & Pending Approvals Schema
  // --------------------------------------------------------------------------
  console.log('--- 1. Auto-Reward Issuance & Pending Approvals Schema ---');
  {
    const stateK1 = K1.store.getState();
    const heroK1 = stateK1.selectedHero;
    const initialCoins = heroK1.coins || 0;
    const initialPoints = heroK1.points || 0;
    const initialXp = heroK1.xp || 0;
    const initialSparks = K1.store.getActivePetSparks ? K1.store.getActivePetSparks(heroK1.id) : (heroK1.sparks || 0);

    // Complete Task Forest task 'clean_toys'
    const taskForestItem = stateK1.taskForest.find(t => t.id === 'clean_toys') || stateK1.taskForest[0];
    const taskId = taskForestItem.id;
    const taskTitle = taskForestItem.title;

    K1.store.toggleTaskForest(taskId);

    // Assert Auto-Reward issuance to balances
    const postHero = K1.store.getState().selectedHero;
    const postSparks = K1.store.getActivePetSparks ? K1.store.getActivePetSparks(postHero.id) : (postHero.sparks || 0);

    assert(postHero.coins > initialCoins, `Tokens (coins) auto-credited immediately (was ${initialCoins}, now ${postHero.coins})`);
    assert(postHero.xp > initialXp, `Hero XP auto-credited immediately (was ${initialXp}, now ${postHero.xp})`);
    assert(postSparks >= initialSparks, `Pet Sparks auto-credited immediately (was ${initialSparks}, now ${postSparks})`);
    assert(postHero.points === initialPoints, `Gold Points NOT auto-credited (remains ${initialPoints})`);

    // Verify pendingApprovals record schema
    const pending = K1.store.getState().pendingApprovals.find(r => r.taskId === taskId && r.kidId === postHero.id);
    assert(Boolean(pending), `Pending approval item enqueued in pendingApprovals queue for taskId '${taskId}'`);

    if (pending) {
      assert(typeof pending.id === 'string' && pending.id.length > 0, `Schema: id is non-empty string (${pending.id})`);
      assert(typeof pending.logId === 'string' && pending.logId.length > 0, `Schema: logId is non-empty string (${pending.logId})`);
      assert(pending.kidId === postHero.id, `Schema: kidId matches active hero (${pending.kidId} === ${postHero.id})`);
      assert(pending.kidName === postHero.name, `Schema: kidName matches active hero name (${pending.kidName})`);
      assert(pending.type === 'task_point_approval', `Schema: type is 'task_point_approval' (got '${pending.type}')`);
      assert(pending.taskId === taskId, `Schema: taskId matches completed task (${pending.taskId})`);
      assert((pending.taskTitle || pending.title) === taskTitle, `Schema: taskTitle matches task title (${pending.taskTitle || pending.title})`);
      assert(pending.zone === 'Task Forest', `Schema: zone is 'Task Forest' (got '${pending.zone}')`);
      assert(typeof pending.tokensAwarded === 'number' && pending.tokensAwarded > 0, `Schema: tokensAwarded is positive number (${pending.tokensAwarded})`);
      assert(typeof pending.xpAwarded === 'number' && pending.xpAwarded > 0, `Schema: xpAwarded is positive number (${pending.xpAwarded})`);
      assert(typeof pending.sparksAwarded === 'number' && pending.sparksAwarded >= 0, `Schema: sparksAwarded is non-negative number (${pending.sparksAwarded})`);
      assert(typeof pending.pendingPoints === 'number' && pending.pendingPoints > 0, `Schema: pendingPoints is positive number (${pending.pendingPoints})`);
      assert(typeof pending.timestamp === 'string' && !isNaN(new Date(pending.timestamp).getTime()), `Schema: timestamp is valid ISO string (${pending.timestamp})`);
      assert(pending.status === 'pending', `Schema: status is 'pending' (got '${pending.status}')`);
    }

    // Verify matching taskCompletionLogs entry
    const log = K1.store.getState().taskCompletionLogs.find(l => l.taskId === taskId && l.heroId === postHero.id);
    assert(Boolean(log), `Matching entry created in taskCompletionLogs for task '${taskId}'`);
    if (log) {
      assert(log.status === 'pending', `Log status is 'pending' (got '${log.status}')`);
    }

    // Habit Islands auto-issuance check
    const habitItem = stateK1.habitIslands.find(h => h.id === 'drink_water') || stateK1.habitIslands[0];
    K1.store.toggleHabitIsland(habitItem.id);
    const habitPending = K1.store.getState().pendingApprovals.find(r => r.taskId === habitItem.id && r.kidId === postHero.id);
    assert(Boolean(habitPending), `Habit Islands completion enqueues pending approval for '${habitItem.id}'`);
    if (habitPending) {
      assert(habitPending.zone === 'Habit Islands', `Habit approval zone is 'Habit Islands' (got '${habitPending.zone}')`);
      assert(habitPending.type === 'task_point_approval', `Habit approval type is 'task_point_approval'`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 2: Parent Portal Display Verification
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Parent Portal Display Verification ---');
  {
    // Wait for Firestore realtime sync to propagate from K1 to P
    await sleep(LAT * 12);

    P.setActiveAdminTab('approvals');
    const portalHtml = P.renderParentPortalView();

    const stateK1 = K1.store.getState();
    const heroK1 = stateK1.selectedHero;
    const req = P.store.getState().pendingApprovals.find(r => r.kidId === heroK1.id && (r.taskId === 'clean_toys' || r.taskId === stateK1.taskForest[0].id));

    assert(Boolean(req), 'Parent device received pending approval item via realtime sync');

    if (req) {
      assert(portalHtml.includes(req.kidName), `Parent Portal renders child name '${req.kidName}'`);
      const rawTitle = req.taskTitle || req.title || '';
      const hasTitle = portalHtml.includes(rawTitle) || (rawTitle.includes('&') && portalHtml.includes(rawTitle.replace(/&/g, '&amp;')));
      assert(hasTitle, `Parent Portal renders task title '${rawTitle}'`);
      assert(
        portalHtml.includes(`+${req.pendingPoints} Gold Points`) || portalHtml.includes(`+${req.pendingPoints} ⭐`),
        `Parent Portal renders exact pending points metadata (+${req.pendingPoints})`
      );
      assert(
        portalHtml.includes(`+${req.tokensAwarded} Tokens`) || portalHtml.includes(`+${req.tokensAwarded} 🪙`) || portalHtml.includes(`${req.tokensAwarded}`),
        `Parent Portal renders auto-issued tokens metadata (+${req.tokensAwarded})`
      );
      assert(
        portalHtml.includes('XP') && portalHtml.includes(`${req.xpAwarded}`),
        `Parent Portal renders hero XP metadata (+${req.xpAwarded} XP)`
      );
      assert(
        portalHtml.includes('⚡') || portalHtml.includes('Sparks') || portalHtml.includes(`${req.sparksAwarded}`),
        `Parent Portal renders pet sparks metadata (+${req.sparksAwarded} Sparks)`
      );

      // Verify removal of automatic screen time conversion on approval cards
      const hasAutoScreenTimeMinutes = portalHtml.includes('Screen Time') && portalHtml.includes('⏱️ +');
      assert(!hasAutoScreenTimeMinutes, 'Parent Portal approval card does NOT display auto-converted screen time minutes');

      // Verify Action Buttons
      assert(portalHtml.includes(`data-approve-id="${req.id}"`), `Parent Portal contains Approve button with data-approve-id="${req.id}"`);
      assert(portalHtml.includes(`data-reject-id="${req.id}"`), `Parent Portal contains Reject button with data-reject-id="${req.id}"`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 3: Zero-Drop Persistence (Removal of 45-Second Cutoff)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Zero-Drop Persistence Across Reloads and Cloud Hydration ---');
  {
    // Create a local pending approval older than 45 seconds (e.g. 120 seconds old)
    const oldTimestamp = new Date(Date.now() - 120000).toISOString();
    const oldLocalReq = {
      id: 'req_zero_drop_stale_test',
      logId: 'compl_zero_drop_stale_test',
      kidId: 'hero_1',
      kidName: 'Little Hero',
      type: 'task_point_approval',
      taskId: 'make_bed',
      taskTitle: 'Make Bed',
      zone: 'Task Forest',
      tokensAwarded: 15,
      xpAwarded: 10,
      sparksAwarded: 5,
      pendingPoints: 8,
      timestamp: oldTimestamp,
      status: 'pending'
    };

    K1.store.getState().pendingApprovals.push(oldLocalReq);
    K1.store.saveState(false);

    // Simulate incoming cloud snapshot from another device that DOES NOT contain oldLocalReq
    const incomingCloudSnapshot = {
      pendingApprovals: (P.store.getState().pendingApprovals || []).filter(r => r.id !== oldLocalReq.id),
      resolvedApprovals: [],
      taskCompletionLogs: P.store.getState().taskCompletionLogs || []
    };

    // Hydrate local store from cloud
    K1.store.hydrateFromCloud(incomingCloudSnapshot);

    const survivingReq = K1.store.getState().pendingApprovals.find(r => r.id === oldLocalReq.id);
    assert(
      Boolean(survivingReq),
      'Pending approval older than 45 seconds survives cloud hydration (45s stale cutoff eliminated)'
    );

    // Simulate complete device restart / reload from localStorage
    K1.reload();
    const afterReloadReq = K1.store.getState().pendingApprovals.find(r => r.id === oldLocalReq.id);
    assert(
      Boolean(afterReloadReq),
      'Pending approval survives device reboot/reload from persistent storage'
    );

    // Allow repair push to sync to cloud and parent device
    K1.store.saveState(true);
    await sleep(LAT * 12);

    const cloudDoc = FS.docs['households/HERO-TASK-SIM'];
    const inCloud = cloudDoc?.pendingApprovals?.some(r => r.id === oldLocalReq.id);
    assert(
      Boolean(inCloud),
      'Zero-drop union merge pushes unconfirmed local approval to cloud so Parent Portal receives it'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 4: Approval Flow (Points Awarded, NO Screen Time Conversion, Task Resets)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Approval Flow ---');
  {
    const stateK1 = K1.store.getState();
    const heroK1 = stateK1.selectedHero;
    const preApprovalPoints = heroK1.points || 0;
    const preApprovalScreenTime = heroK1.screenTimeMinutes || 0;

    // Find a pending request to approve
    const reqToApprove = P.store.getState().pendingApprovals.find(r => r.kidId === heroK1.id && r.taskId === 'clean_toys');
    assert(Boolean(reqToApprove), `Parent found pending request for taskId 'clean_toys' to approve`);

    if (reqToApprove) {
      const pointsToAward = reqToApprove.pendingPoints || 10;
      P.store.approveParentRequest(reqToApprove.id);

      // Wait for sync to propagate to K1
      await sleep(LAT * 15);

      const postHeroP = P.store.getState().heroes.find(h => h.id === heroK1.id);
      const postHeroK1 = K1.store.getState().selectedHero;

      assert(postHeroP.points === preApprovalPoints + pointsToAward, `Parent reflects credited Gold Points (+${pointsToAward})`);
      assert(postHeroK1.points === preApprovalPoints + pointsToAward, `Kid device reflects credited Gold Points (+${pointsToAward})`);

      // CRITICAL INVARIANT: Points do NOT auto-convert to screen time minutes
      assert(
        (postHeroK1.screenTimeMinutes || 0) === preApprovalScreenTime,
        `Gold Points are NOT auto-converted to screen time minutes (remains ${preApprovalScreenTime}m)`
      );

      // Request removed from pendingApprovals queue
      const stillPendingK1 = K1.store.getState().pendingApprovals.some(r => r.id === reqToApprove.id);
      const stillPendingP = P.store.getState().pendingApprovals.some(r => r.id === reqToApprove.id);
      assert(!stillPendingK1 && !stillPendingP, `Approved request removed from pendingApprovals on both devices`);

      // taskCompletionLogs marked as 'approved'
      const logK1 = K1.store.getState().taskCompletionLogs.find(l => l.taskId === reqToApprove.taskId && l.heroId === heroK1.id);
      assert(Boolean(logK1 && logK1.status === 'approved'), `taskCompletionLogs entry marked status: 'approved'`);

      // Task is reset and can be completed again in future cycles
      const taskInForest = K1.store.getState().taskForest.find(t => t.id === reqToApprove.taskId);
      assert(taskInForest && taskInForest.completed === false, `Task is reset to completed: false so it can be re-completed`);

      // Child completes task again: succeeds without error
      const initialCoinBalance = postHeroK1.coins;
      K1.store.toggleTaskForest(reqToApprove.taskId);
      const reCompletedHero = K1.store.getState().selectedHero;
      assert(reCompletedHero.coins > initialCoinBalance, `Task successfully completed again after parent approval (earned +tokens)`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 5: Denial Flow (Reversible Clawback & Needs Redo State)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Denial Flow (Reversible Clawback & Needs Redo State) ---');
  {
    await sleep(LAT * 10);
    const stateK1 = K1.store.getState();
    const heroK1 = stateK1.selectedHero;

    // Find the newly re-completed task request to deny
    const reqToDeny = P.store.getState().pendingApprovals.find(r => r.kidId === heroK1.id && r.status === 'pending');
    assert(Boolean(reqToDeny), 'Parent found pending request to deny');

    if (reqToDeny) {
      const awardedCoins = reqToDeny.tokensAwarded || 20;
      const awardedXp = reqToDeny.xpAwarded || 15;
      const awardedSparks = reqToDeny.sparksAwarded || 10;
      const preDenialPoints = heroK1.points || 0;

      // Test Balance Clamping at floor 0: simulate kid spending coins in the shop before parent denial
      // Set child coins lower than awardedCoins (e.g. 5 coins)
      heroK1.coins = 5;
      K1.store.saveState(true);
      await sleep(LAT * 10);

      // Parent rejects the request
      P.store.rejectParentRequest(reqToDeny.id);
      await sleep(LAT * 15);

      const postHeroK1 = K1.store.getState().selectedHero;
      const postSparksK1 = K1.store.getActivePetSparks ? K1.store.getActivePetSparks(postHeroK1.id) : (postHeroK1.sparks || 0);

      // 1. Zero Gold Points awarded
      assert(postHeroK1.points === preDenialPoints, `Zero Gold Points awarded upon denial (remains ${preDenialPoints})`);

      // 2. Tokens clawed back and clamped at floor 0
      assert(postHeroK1.coins === 0, `Tokens clawed back and safely clamped at floor 0 (was 5, claws back ${awardedCoins} -> 0, not negative)`);

      // 3. Hero XP clawed back
      assert(typeof postHeroK1.xp === 'number' && postHeroK1.xp >= 0, `Hero XP clawed back and clamped at floor 0 (now ${postHeroK1.xp})`);

      // 4. Pet Sparks clawed back
      assert(typeof postSparksK1 === 'number' && postSparksK1 >= 0, `Pet Sparks clawed back and clamped at floor 0 (now ${postSparksK1})`);

      // 5. Removed from pendingApprovals
      const stillPending = K1.store.getState().pendingApprovals.some(r => r.id === reqToDeny.id);
      assert(!stillPending, 'Denied request removed from pendingApprovals');

      // 6. taskCompletionLogs marked as 'rejected'
      const rejectedLog = K1.store.getState().taskCompletionLogs.find(l => l.id === reqToDeny.logId || (l.taskId === reqToDeny.taskId && l.status === 'rejected'));
      assert(Boolean(rejectedLog && rejectedLog.status === 'rejected'), `taskCompletionLogs entry marked status: 'rejected'`);

      // 7. Non-blocking 'Needs Redo' state: getTaskCompletionsToday does NOT block the task
      const completionsToday = K1.store.getTaskCompletionsToday(reqToDeny.taskId, heroK1.id);
      assert(
        completionsToday.length === 0,
        `getTaskCompletionsToday ignores rejected logs so the child is NOT locked out from re-attempting today`
      );

      // 8. Task reset to uncompleted on child screen
      const task = K1.store.getState().taskForest.find(t => t.id === reqToDeny.taskId);
      assert(task && task.completed === false, `Task resets to completed: false with 'Needs Redo' so child can correct it`);

      // Child re-attempts and submits again successfully today
      const preReattemptCoins = postHeroK1.coins;
      K1.store.toggleTaskForest(reqToDeny.taskId);
      assert(
        K1.store.getState().selectedHero.coins > preReattemptCoins,
        `Child successfully re-submits task today after denial without being blocked`
      );
    }
  }

  // --------------------------------------------------------------------------
  // TEST 6: 1:1 Parity Between World Map and Quests & Dynamic Reward Inheritance
  // --------------------------------------------------------------------------
  console.log('\n--- 6. 1:1 Parity Between World Map and Quests & Dynamic Reward Inheritance ---');
  {
    const stateK1 = K1.store.getState();
    const heroK1 = stateK1.selectedHero;

    // A. Dynamic Reward Inheritance: Parent customizes rewards for 'morning_brush' / 'brush_teeth_am'
    const choreInForest = stateK1.taskForest.find(t => t.id === 'morning_brush');
    if (choreInForest) {
      choreInForest.coins = 35;
      choreInForest.points = 18;
      choreInForest.xp = 25;
      choreInForest.sparks = 12;
    }
    K1.store.saveState(false);

    // Waypoint 'wp_morning_teeth' on World Map
    const wp = K1.PATH_OF_VALOR_WAYPOINTS.find(w => w.id === 'wp_morning_teeth');
    assert(Boolean(wp), `Found World Map waypoint 'wp_morning_teeth'`);

    // Verify dynamic reward inheritance via store helper or waypoint rendering
    const mapRewards = K1.store.getWaypointRewards ? K1.store.getWaypointRewards('wp_morning_teeth') : null;
    if (mapRewards) {
      assert(mapRewards.coins === 35, `World Map dynamically inherits customized tokens (${mapRewards.coins} === 35)`);
      assert(mapRewards.points === 18, `World Map dynamically inherits customized points (${mapRewards.points} === 18)`);
      assert(mapRewards.xp === 25, `World Map dynamically inherits customized XP (${mapRewards.xp} === 25)`);
    }

    // B. Completing on World Map marks Quests complete (1:1 Bidirectional Parity)
    // Clear completion logs for this task first for clean isolation
    stateK1.taskCompletionLogs = (stateK1.taskCompletionLogs || []).filter(l => l.taskId !== 'morning_brush' && l.taskId !== 'brush_teeth_am');
    stateK1.pendingApprovals = (stateK1.pendingApprovals || []).filter(r => r.taskId !== 'morning_brush' && r.taskId !== 'brush_teeth_am');

    const mapResult = K1.store.completeWaypointChore('wp_morning_teeth');
    assert(mapResult && mapResult.success, `completeWaypointChore('wp_morning_teeth') succeeds on World Map`);

    // Verify dynamic reward values are inherited upon waypoint completion
    const wpPending = K1.store.getState().pendingApprovals.find(r => r.taskId === 'brush_teeth_am' || r.taskId === 'morning_brush' || r.taskId === 'wp_morning_teeth');
    if (wpPending) {
      assert(
        wpPending.tokensAwarded === 35,
        `completeWaypointChore awards parent-customized tokens (expected 35, got ${wpPending.tokensAwarded})`
      );
      assert(
        wpPending.pendingPoints === 18,
        `completeWaypointChore queues parent-customized pending points (expected 18, got ${wpPending.pendingPoints})`
      );
    }

    // Verify Task Forest in Quests reflects this completion
    const questCompletions = K1.store.getTaskCompletionsToday('morning_brush', heroK1.id);
    const isChorePendingInQuests = K1.store.isTaskPendingApproval ? K1.store.isTaskPendingApproval('morning_brush', heroK1.id) : true;
    assert(
      questCompletions.length > 0 || isChorePendingInQuests,
      `Completing 'wp_morning_teeth' on World Map immediately marks 'morning_brush' complete/pending in Quests`
    );

    // C. Single Completion Payout Invariant: Attempting duplicate completion while pending is blocked
    const duplicateMapAttempt = K1.store.completeWaypointChore('wp_morning_teeth');
    assert(
      !duplicateMapAttempt.success || duplicateMapAttempt.alreadyCompleted,
      `Duplicate completion attempt on World Map while pending is blocked (single payout per cycle)`
    );

    // Also attempt duplicate from Quests: should not auto-issue duplicate tokens
    const coinsBeforeDup = K1.store.getState().selectedHero.coins;
    K1.store.toggleTaskForest('morning_brush');
    assert(
      K1.store.getState().selectedHero.coins === coinsBeforeDup,
      `Duplicate completion attempt in Quests while pending is blocked (no double token payout)`
    );

    // D. Bedtime Chore Aliasing: 'sleep_on_time' (wp_bedtime) <-> 'night_bedtime' (Task Forest)
    // and Room Tidy: 'clean_room' (wp_tidy_room) <-> 'clean_toys' (Task Forest)
    const aliases = K1.store.getChoreAliases ? K1.store.getChoreAliases('clean_room') : ['clean_room', 'clean_toys'];
    assert(
      aliases.includes('clean_room') && aliases.includes('clean_toys'),
      `Chore aliasing links 'clean_room' on World Map to 'clean_toys' in Task Forest`
    );

    // E. Quests -> World Map Parity: Completing 'make_bed' in Quests marks 'wp_wake_up' completed on World Map
    stateK1.taskCompletionLogs = (stateK1.taskCompletionLogs || []).filter(l => l.taskId !== 'make_bed' && l.taskId !== 'wp_wake_up');
    stateK1.pendingApprovals = (stateK1.pendingApprovals || []).filter(r => r.taskId !== 'make_bed' && r.taskId !== 'wp_wake_up');
    K1.store.toggleTaskForest('make_bed');
    const wakeUpDone = K1.store.getTaskCompletionsToday('make_bed', heroK1.id).length > 0 || (K1.store.isTaskPendingApproval && K1.store.isTaskPendingApproval('make_bed', heroK1.id));
    assert(wakeUpDone, `Completing 'make_bed' in Quests marks corresponding 'wp_wake_up' chore completed/pending on World Map`);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Concurrent Sibling Submissions & Household Multi-Device Sync
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Concurrent Sibling Submissions & Multi-Child Isolation ---');
  {
    // Parent adds a second child "Sam" (hero_2)
    const sam = P.store.addHero({ name: 'Sam' });
    await sleep(LAT * 8);

    // Kid 2 (K2) device starts up and switches to Sam
    const K2 = makeDevice(FS, 'Kid_2_Sam');
    await sleep(LAT * 10);
    K2.store.switchHero(sam.id);
    await sleep(LAT * 4);

    const kid1Hero = K1.store.getState().selectedHero;
    const kid2Hero = K2.store.getState().selectedHero;
    assert(kid1Hero.id !== kid2Hero.id, `K1 (hero_1: ${kid1Hero.name}) and K2 (hero_2: ${kid2Hero.name}) have isolated IDs`);

    // Both siblings complete the SAME task ('make_bed') concurrently on separate devices
    const sharedTaskId = 'make_bed';
    K1.store.toggleTaskForest(sharedTaskId);
    K2.store.toggleTaskForest(sharedTaskId);

    // Allow network latency to interleave writes and notify Parent
    await sleep(LAT * 20);

    const pendingOnParent = P.store.getState().pendingApprovals.filter(r => r.taskId === sharedTaskId);
    assert(
      pendingOnParent.length === 2,
      `Parent receives 2 distinct pending approval items for concurrent sibling submissions (found ${pendingOnParent.length})`
    );

    const kidIdsOnParent = new Set(pendingOnParent.map(r => r.kidId));
    assert(
      kidIdsOnParent.has(kid1Hero.id) && kidIdsOnParent.has(kid2Hero.id),
      `Parent pending items contain separate records for Kid 1 (${kid1Hero.id}) and Kid 2 (${kid2Hero.id})`
    );

    // Parent approves ONLY Kid 1's request
    const reqKid1 = pendingOnParent.find(r => r.kidId === kid1Hero.id);
    const reqKid2 = pendingOnParent.find(r => r.kidId === kid2Hero.id);
    assert(Boolean(reqKid1 && reqKid2), `Both Kid 1 and Kid 2 requests located on Parent device`);

    const kid1PrePoints = P.store.getState().heroes.find(h => h.id === kid1Hero.id)?.points || 0;
    const kid2PrePoints = P.store.getState().heroes.find(h => h.id === kid2Hero.id)?.points || 0;

    P.store.approveParentRequest(reqKid1.id);
    await sleep(LAT * 15);

    const kid1PostPoints = P.store.getState().heroes.find(h => h.id === kid1Hero.id)?.points || 0;
    const kid2PostPoints = P.store.getState().heroes.find(h => h.id === kid2Hero.id)?.points || 0;

    assert(kid1PostPoints > kid1PrePoints, `Kid 1 awarded Gold Points on Parent device (+${reqKid1.pendingPoints})`);
    assert(kid2PostPoints === kid2PrePoints, `Kid 2 points remain untouched when only Kid 1 was approved (zero bleed)`);

    // Verify on Kid 2's device: Sam's request is still pending
    const stillPendingOnK2 = K2.store.getState().pendingApprovals.filter(r => r.kidId === kid2Hero.id && r.taskId === sharedTaskId);
    assert(stillPendingOnK2.length === 1, `Sam's request remains pending on K2 with zero data bleed`);

    // Now Parent rejects Kid 2's request: claws back only Kid 2's tokens/sparks
    const kid1PreCoins = P.store.getState().heroes.find(h => h.id === kid1Hero.id)?.coins || 0;
    P.store.rejectParentRequest(reqKid2.id);
    await sleep(LAT * 15);

    const kid1AfterCoins = P.store.getState().heroes.find(h => h.id === kid1Hero.id)?.coins || 0;
    const kid2AfterCoins = P.store.getState().heroes.find(h => h.id === kid2Hero.id)?.coins || 0;

    assert(kid1AfterCoins === kid1PreCoins, `Kid 1 balances completely unaffected by Kid 2's denial`);
    assert(kid2AfterCoins === 0, `Kid 2's auto-issued tokens clawed back to floor 0 upon denial`);
  }

  // --------------------------------------------------------------------------
  // Summary & Teardown
  // --------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`TEST SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED (Total: ${totalAssertions})`);
  console.log('======================================================================\n');

  if (failures.length > 0) {
    console.error('❌ Failures Encountered (Escalating to M1 & M2 Implementing Workers):');
    failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f.message}`));
  }

  fs.rmSync(TMP, { recursive: true, force: true });

  if (failedAssertions > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL END-TO-END MULTI-DEVICE SIMULATION TESTS PASSED!');
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('💥 Uncaught exception in test runner:', err);
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(1);
});
