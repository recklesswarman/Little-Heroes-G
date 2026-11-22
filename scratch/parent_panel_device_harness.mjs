// Shared harness for the Parent Panel regression tests (not a test itself).
// Bundles the REAL store + firestoreSyncService + companionSafety and runs each
// "device" in its own VM context with its own localStorage, against one shared
// in-memory fake of the Firestore household doc. Based on
// verify_approval_sync_across_devices.js.
import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'parent-panel-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- stubs for browser-only / network modules ----
const stubs = {
  'firebase-config.js': `export const app = {}; export const auth = null; export const db = {}; export const functions = null; export const googleProvider = null; export const isFirebaseAvailable = true; export const firestoreDatabaseId = ''; export const firebaseConfig = {}; export const ensureAuthReady = async () => null;`,
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
  'entry.js': `import { store } from '${ROOT}/src/state/store.js'; import { firestoreSync } from '${ROOT}/src/services/firestoreSyncService.js'; import * as companionSafety from '${ROOT}/src/services/companionSafety.js'; store.setSyncService(firestoreSync); export { store, firestoreSync, companionSafety };`,
};
for (const [f, c] of Object.entries(stubs)) fs.writeFileSync(path.join(TMP, f), c);
const map = [[/config\/firebase\.js$/, 'firebase-config.js'], [/^firebase\/firestore$/, 'firestore.js'], [/audio\/sfx\.js$/, 'sound.js'], [/^canvas-confetti$/, 'confetti.js'], [/services\/voiceService\.js$/, 'voice.js'], [/InteractiveCelebrationOverlay\.js$/, 'celebration.js'], [/firebaseAILogicService\.js$/, 'firebaseai.js']];
await esbuild.build({
  entryPoints: [path.join(TMP, 'entry.js')], bundle: true, format: 'iife', globalName: 'Device', platform: 'browser', logLevel: 'error',
  outfile: path.join(TMP, 'device.js'),
  plugins: [{ name: 'stubs', setup(b) { b.onResolve({ filter: /.*/ }, (a) => { for (const [re, f] of map) if (re.test(a.path)) return { path: path.join(TMP, f) }; return null; }); } }],
});
const bundle = fs.readFileSync(path.join(TMP, 'device.js'), 'utf8');

// ---- fake Firestore: deep-merges like {merge:true}, notifies every listener after a delay ----
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isUnsafeProp = (k) => k === '__proto__' || k === 'constructor' || k === 'prototype';
function setVal(t, k, v, deep) {
  if (isUnsafeProp(k)) return;
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
    failWrites: false,
    async write(p, data, merge, dotted) {
      await sleep(latency);
      if (this.failWrites) { const e = new Error('simulated network failure'); e.code = 'unavailable'; throw e; }
      if (!merge || !docs[p]) docs[p] = merge && docs[p] ? docs[p] : {};
      for (const [k, v] of Object.entries(clone(data))) {
        if (dotted && k.includes('.')) { const parts = k.split('.'); if (parts.some(isUnsafeProp)) continue; let t = docs[p]; for (const x of parts.slice(0, -1)) { t[x] = Object.prototype.hasOwnProperty.call(t, x) && t[x] && typeof t[x] === 'object' ? t[x] : {}; t = t[x]; } setVal(t, parts.at(-1), v, true); } else setVal(docs[p], k, v, true);
      }
      for (const l of listeners) if (l.p === p) setTimeout(() => l.cb(snap(p)), latency);
    },
    async get(p) { return snap(p); },
    listen(p, cb) { const l = { p, cb }; listeners.push(l); setTimeout(() => cb(snap(p)), latency); return () => listeners.splice(listeners.indexOf(l), 1); },
  };
}

function makeDevice(FS, { storage = new Map(), sync = true } = {}) {
  const m = storage; const noop = () => {};
  const ls = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
  const el = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => '' : el), apply: () => el, set: () => true });
  const ctx = { console: { log: noop, info: noop, warn: noop, error: (...a) => console.error(...a) }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop, queueMicrotask, Promise, Date, Math, JSON, URL, localStorage: ls, sessionStorage: ls, __FS__: FS, navigator: { userAgent: 'node', onLine: true, vibrate: noop }, document: el, requestAnimationFrame: noop, cancelAnimationFrame: noop, addEventListener: noop, removeEventListener: noop, dispatchEvent: noop, location: { href: 'http://localhost/', hostname: 'localhost', pathname: '/', search: '', hash: '' }, matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }), CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail; } }, fetch: async () => { throw new Error('offline'); } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.crypto = globalThis.crypto; vm.createContext(ctx); vm.runInContext(bundle, ctx);
  const dev = { store: ctx.Device.store, sync: ctx.Device.firestoreSync, safety: ctx.Device.companionSafety };
  const s = dev.store.getState(); s.isAuthenticated = true; s.isHouseholdConfigured = true; s.householdSetupStep = 'ready'; s.household.syncCode = 'HERO-TEST';
  dev.storage = m;
  if (sync) dev.sync.startSync('HERO-TEST');
  return dev;
}
const LAT = 60;
async function household() {
  const FS = makeFS(LAT);
  const K = makeDevice(FS); K.store.saveState(true); await sleep(LAT * 8);
  const P = makeDevice(FS); await sleep(LAT * 8);
  return { FS, K, P, cloud: () => FS.docs['households/HERO-TEST'] };
}

export { sleep, makeFS, makeDevice, household, LAT, TMP };

export function makeRunner(title) {
  let failed = 0;
  console.log(title);
  return {
    async check(name, fn) {
      try { await fn(); console.log(`  ✅ PASS: ${name}`); } catch (e) { failed++; console.log(`  ❌ FAIL: ${name} -- ${e.message}`); }
    },
    expect(cond, msg) { if (!cond) throw new Error(msg); },
    finish(label) {
      fs.rmSync(TMP, { recursive: true, force: true });
      if (failed) { console.log(`\n❌ ${failed} ${label} check(s) failed`); process.exit(1); }
      console.log(`\n✅ ALL ${label.toUpperCase()} CHECKS PASSED`);
      process.exit(0);
    }
  };
}
