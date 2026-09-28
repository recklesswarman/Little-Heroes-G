// Regression test: two kids, on two separate devices, both completing the
// SAME task at nearly the same moment must each get their own, separate
// pending-approval item (visible on a third, parent device), and approving
// one must credit ONLY that kid -- never the other, never both, never neither.
import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'two-kid-sync-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const stubs = {
  'firebase-config.js': `export const app = {}; export const auth = null; export const db = {}; export const functions = null; export const googleProvider = null; export const isFirebaseAvailable = true; export const firestoreDatabaseId = ''; export const firebaseConfig = {};`,
  'firestore.js': `const D = { __op: 'delete' };
export const deleteField = () => D; export const arrayRemove = (...vals) => ({ __op: 'arrayRemove', vals }); export const arrayUnion = (...vals) => ({ __op: 'arrayUnion', vals });
export const serverTimestamp = () => new Date().toISOString(); export const increment = (n) => ({ __op: 'increment', n });
export const doc = (db, ...p) => ({ path: p.join('/') }); export const collection = (db, ...p) => ({ path: p.join('/') }); export const getFirestore = () => ({});
export const setDoc = (ref, data, opts) => globalThis.__FS__.write(ref.path, data, !!(opts && opts.merge), false);
export const updateDoc = (ref, data) => globalThis.__FS__.write(ref.path, data, true, true);
export const getDoc = async (ref) => globalThis.__FS__.get(ref.path);
export const onSnapshot = (ref, cb) => globalThis.__FS__.listen(ref.path, cb);`,
  'sound.js': `export const Sound = new Proxy({}, { get: () => () => {} }); export function initTactileSoundEngine() {}`,
  'confetti.js': `export default function confetti() {}`,
  'voice.js': `export const COMPANION_VOICE_PROFILES = {}; export const cleanDialogueText = (t) => t; export const unlockVoiceAudio = () => {}; export const stopRex = () => {}; export const stopCompanionAudio = () => {}; export const isRexSpeaking = () => false; export const isCompanionSpeaking = () => false; export const selectPreferredVoice = () => null; export const getCompanionVoiceParams = () => ({}); export const speakCompanion = async () => {};`,
  'celebration.js': `export function triggerInteractiveCelebration() {} export function closeInteractiveCelebration() {}`,
  'firebaseai.js': `export const SPLINE_3D_PRESETS = {}; export const firebaseAI = {}; export const THREE_D_ASSETS = []; export const getThreeDAssetsByCategory = () => []; export const matchBestThreeDAsset = () => null;`,
  'entry.js': `import { store } from '${REPO}/src/state/store.js'; import { firestoreSync } from '${REPO}/src/services/firestoreSyncService.js'; store.setSyncService(firestoreSync); export { store, firestoreSync };`,
};
for (const [f, c] of Object.entries(stubs)) fs.writeFileSync(path.join(TMP, f), c);
const map = [[/config\/firebase\.js$/, 'firebase-config.js'], [/^firebase\/firestore$/, 'firestore.js'], [/audio\/sfx\.js$/, 'sound.js'], [/^canvas-confetti$/, 'confetti.js'], [/services\/voiceService\.js$/, 'voice.js'], [/InteractiveCelebrationOverlay\.js$/, 'celebration.js'], [/firebaseAILogicService\.js$/, 'firebaseai.js']];
await esbuild.build({
  entryPoints: [path.join(TMP, 'entry.js')], bundle: true, format: 'iife', globalName: 'Device', platform: 'browser', logLevel: 'error',
  outfile: path.join(TMP, 'device.js'),
  plugins: [{ name: 'stubs', setup(b) { b.onResolve({ filter: /.*/ }, (a) => { for (const [re, f] of map) if (re.test(a.path)) return { path: path.join(TMP, f) }; return null; }); } }],
});
const bundle = fs.readFileSync(path.join(TMP, 'device.js'), 'utf8');

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
function setVal(t, k, v, deep) {
  if (v && v.__op === 'delete') { delete t[k]; return; }
  if (v && v.__op === 'arrayRemove') { t[k] = (t[k] || []).filter((x) => !v.vals.includes(x)); return; }
  if (v && v.__op === 'arrayUnion') { t[k] = Array.from(new Set([...(t[k] || []), ...v.vals])); return; }
  if (deep && v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) { for (const [kk, vv] of Object.entries(v)) setVal(t[k], kk, vv, true); return; }
  t[k] = clone(v);
}
function makeFS(latency) {
  const docs = {}; const listeners = [];
  const snap = (p) => ({ exists: () => !!docs[p], data: () => clone(docs[p]) });
  return {
    docs,
    async write(p, data, merge, dotted) {
      await sleep(latency);
      if (!merge || !docs[p]) docs[p] = merge && docs[p] ? docs[p] : {};
      for (const [k, v] of Object.entries(clone(data))) {
        if (dotted && k.includes('.')) { const parts = k.split('.'); let t = docs[p]; for (const x of parts.slice(0, -1)) { t[x] = t[x] && typeof t[x] === 'object' ? t[x] : {}; t = t[x]; } setVal(t, parts.at(-1), v, true); } else setVal(docs[p], k, v, true);
      }
      for (const l of listeners) if (l.p === p) setTimeout(() => l.cb(snap(p)), latency);
    },
    async get(p) { return snap(p); },
    listen(p, cb) { const l = { p, cb }; listeners.push(l); setTimeout(() => cb(snap(p)), latency); return () => listeners.splice(listeners.indexOf(l), 1); },
  };
}

function makeDevice(FS) {
  const m = new Map(); const noop = () => {};
  const ls = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
  const el = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => '' : el), apply: () => el, set: () => true });
  const ctx = { console: { log: noop, info: noop, warn: noop, error: (...a) => console.error(...a) }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop, queueMicrotask, Promise, Date, Math, JSON, URL, localStorage: ls, sessionStorage: ls, __FS__: FS, navigator: { userAgent: 'node', onLine: true, vibrate: noop }, document: el, requestAnimationFrame: noop, cancelAnimationFrame: noop, addEventListener: noop, removeEventListener: noop, dispatchEvent: noop, location: { href: 'http://localhost/', hostname: 'localhost', pathname: '/', search: '', hash: '' }, matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }), CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail; } }, fetch: async () => { throw new Error('offline'); } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx); vm.runInContext(bundle, ctx);
  const dev = { store: ctx.Device.store, sync: ctx.Device.firestoreSync };
  const s = dev.store.getState(); s.isAuthenticated = true; s.isHouseholdConfigured = true; s.householdSetupStep = 'ready'; s.household.syncCode = 'HERO-TEST';
  dev.sync.startSync('HERO-TEST');
  return dev;
}
const LAT = 60;

let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  ✅ PASS: ${name}`); } catch (e) { failed++; console.log(`  ❌ FAIL: ${name} -- ${e.message}`); }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

console.log('👥 --- Verifying two kids completing the SAME task stay isolated --- 👥');

await check('two kids completing the same task at nearly the same time both get separate approval items', async () => {
  const FS = makeFS(LAT);
  // K1 is hero_1's device.
  const K1 = makeDevice(FS);
  K1.store.saveState(true);
  await sleep(LAT * 8);

  // Parent adds a second kid "Sam" (hero_2) from their own device.
  const P = makeDevice(FS);
  await sleep(LAT * 8);
  const sam = P.store.addHero({ name: 'Sam' });
  await sleep(LAT * 10);

  // K2 is Sam's own device: a fresh device that syncs down the household
  // (including hero_2), then switches its local selectedHero to Sam --
  // exactly like a second child signing into their own tablet.
  const K2 = makeDevice(FS);
  await sleep(LAT * 10);
  expect(K2.store.getState().heroes.some((h) => h.id === sam.id), 'hero_2 (Sam) never synced down to K2');
  K2.store.switchHero(sam.id);
  await sleep(LAT * 4);

  const taskId = K1.store.getState().taskForest[0].id;

  // Both kids complete the SAME task within a few ms of each other -- neither
  // device has yet seen the other's write land in the cloud.
  K1.store.toggleTaskForest(taskId);
  K2.store.toggleTaskForest(taskId);
  await sleep(LAT * 20);

  const pendingOnParent = P.store.getState().pendingApprovals.filter((r) => r.taskId === taskId);
  const pendingOnK1 = K1.store.getState().pendingApprovals.filter((r) => r.taskId === taskId);
  const pendingOnK2 = K2.store.getState().pendingApprovals.filter((r) => r.taskId === taskId);

  expect(pendingOnParent.length === 2, `parent sees ${pendingOnParent.length} pending items for this task, expected 2 (one per kid): ${JSON.stringify(pendingOnParent.map((r) => r.kidId))}`);
  const kidIdsOnParent = new Set(pendingOnParent.map((r) => r.kidId));
  expect(kidIdsOnParent.has('hero_1') && kidIdsOnParent.has(sam.id), `parent's pending items aren't tagged to both kids: ${JSON.stringify([...kidIdsOnParent])}`);
  expect(pendingOnK1.length === 2, `K1 (hero_1's device) sees ${pendingOnK1.length} pending items, expected 2`);
  expect(pendingOnK2.length === 2, `K2 (Sam's device) sees ${pendingOnK2.length} pending items, expected 2`);

  // Parent approves ONLY hero_1's request.
  const req1 = P.store.getState().pendingApprovals.find((r) => r.taskId === taskId && r.kidId === 'hero_1');
  expect(req1, 'parent never received hero_1 (K1) request');
  P.store.approveParentRequest(req1.id);
  await sleep(LAT * 25);

  const hero1Points = (d) => d.store.getState().heroes.find((h) => h.id === 'hero_1')?.points;
  const samPoints = (d) => d.store.getState().heroes.find((h) => h.id === sam.id)?.points;

  expect(hero1Points(P) > 0, `hero_1 was not credited after approval: ${hero1Points(P)}`);
  expect((samPoints(P) || 0) === 0, `Sam was incorrectly credited when only hero_1's request was approved: ${samPoints(P)}`);
  expect(hero1Points(K1) === hero1Points(P), `hero_1's points diverge between devices: K1=${hero1Points(K1)} P=${hero1Points(P)}`);
  expect((samPoints(K2) || 0) === 0, `Sam's own device shows incorrect credit: ${samPoints(K2)}`);

  const samStillPending = P.store.getState().pendingApprovals.filter((r) => r.taskId === taskId && r.kidId === sam.id);
  expect(samStillPending.length === 1, `Sam's request should still be pending after only hero_1's was approved, found ${samStillPending.length}`);
});

fs.rmSync(TMP, { recursive: true, force: true });
if (failed) { console.log(`\n❌ ${failed} check(s) failed`); process.exit(1); }
console.log('\n✅ ALL TWO-KID ISOLATION CHECKS PASSED');
process.exit(0);
