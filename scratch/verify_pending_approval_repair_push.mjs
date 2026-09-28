// Focused unit check (not part of the full two-device sim): does
// hydrateFromCloud proactively push a repair to the cloud when it recovers a
// local pendingApprovals/taskCompletionLogs entry the cloud snapshot lost,
// or does it only fix the LOCAL copy and leave the cloud (and every other
// device/the Parent Portal reading only the cloud) still missing it?
import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-hydrate-'));

const stubs = {
  'firebase-config.js': `export const app = {}; export const auth = null; export const db = {}; export const functions = null; export const googleProvider = null; export const isFirebaseAvailable = true; export const firestoreDatabaseId = ''; export const firebaseConfig = {};`,
  'firestore.js': `export const deleteField = () => ({__op:'delete'}); export const arrayRemove = () => ({}); export const arrayUnion = () => ({}); export const serverTimestamp = () => new Date().toISOString(); export const increment = (n) => n; export const doc = () => ({}); export const collection = () => ({}); export const getFirestore = () => ({}); export const setDoc = async () => {}; export const updateDoc = async () => {}; export const getDoc = async () => ({exists:()=>false,data:()=>null}); export const onSnapshot = () => () => {};`,
  'sound.js': `export const Sound = new Proxy({}, { get: () => () => {} }); export function initTactileSoundEngine() {}`,
  'confetti.js': `export default function confetti() {}`,
  'voice.js': `export const COMPANION_VOICE_PROFILES = {}; export const cleanDialogueText = (t) => t; export const unlockVoiceAudio = () => {}; export const stopRex = () => {}; export const stopCompanionAudio = () => {}; export const isRexSpeaking = () => false; export const isCompanionSpeaking = () => false; export const selectPreferredVoice = () => null; export const getCompanionVoiceParams = () => ({}); export const speakCompanion = async () => {};`,
  'celebration.js': `export function triggerInteractiveCelebration() {} export function closeInteractiveCelebration() {}`,
  'firebaseai.js': `export const SPLINE_3D_PRESETS = {}; export const firebaseAI = {}; export const THREE_D_ASSETS = []; export const getThreeDAssetsByCategory = () => []; export const matchBestThreeDAsset = () => null;`,
  'entry.js': `import { store } from '${REPO}/src/state/store.js'; export { store };`,
};
for (const [f, c] of Object.entries(stubs)) fs.writeFileSync(path.join(TMP, f), c);
const map = [[/config\/firebase\.js$/, 'firebase-config.js'], [/^firebase\/firestore$/, 'firestore.js'], [/audio\/sfx\.js$/, 'sound.js'], [/^canvas-confetti$/, 'confetti.js'], [/services\/voiceService\.js$/, 'voice.js'], [/InteractiveCelebrationOverlay\.js$/, 'celebration.js'], [/firebaseAILogicService\.js$/, 'firebaseai.js']];
await esbuild.build({
  entryPoints: [path.join(TMP, 'entry.js')], bundle: true, format: 'iife', globalName: 'Device', platform: 'browser', logLevel: 'error',
  outfile: path.join(TMP, 'device.js'),
  plugins: [{ name: 'stubs', setup(b) { b.onResolve({ filter: /.*/ }, (a) => { for (const [re, f] of map) if (re.test(a.path)) return { path: path.join(TMP, f) }; return null; }); } }],
});
const bundle = fs.readFileSync(path.join(TMP, 'device.js'), 'utf8');

const m = new Map(); const noop = () => {};
const ls = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
const el = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => '' : el), apply: () => el, set: () => true });
const ctx = { console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop, queueMicrotask, Promise, Date, Math, JSON, URL, localStorage: ls, sessionStorage: ls, navigator: { userAgent: 'node', onLine: true, vibrate: noop }, document: el, requestAnimationFrame: noop, cancelAnimationFrame: noop, addEventListener: noop, removeEventListener: noop, dispatchEvent: noop, location: { href: 'http://localhost/', hostname: 'localhost', pathname: '/', search: '', hash: '' }, matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }), CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail; } }, fetch: async () => { throw new Error('offline'); } };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx); vm.runInContext(bundle, ctx);
const store = ctx.Device.store;

let pushCount = 0;
store.setSyncService({ pushStateToCloud: () => { pushCount++; }, broadcastState: () => {} });

const s = store.getState();
s.heroes = [{ id: 'hero_1', name: 'Kid', points: 0, coins: 0, fieldStamps: {} }];
s.selectedHero = { id: 'hero_1', name: 'Kid', points: 0, coins: 0 };
s.resolvedApprovals = [];
s.taskCompletionLogs = [];
// Local device has its OWN just-created pending approval that the incoming
// cloud snapshot (below) has no record of -- simulating another device's
// concurrent write having overwritten the shared pendingApprovals array
// field before this local one ever reached the cloud.
const localOnlyReq = { id: 'req_local_only', kidId: 'hero_1', kidName: 'Kid', taskId: 'brush', title: 'Brush Teeth', status: 'pending', timestamp: new Date().toISOString() };
s.pendingApprovals = [localOnlyReq];

const cloudReq = { id: 'req_cloud_only', kidId: 'hero_2', kidName: 'Sam', taskId: 'brush', title: 'Brush Teeth', status: 'pending', timestamp: new Date().toISOString() };
// Deliberately omit heroesMap/heroes so the unrelated hero-fieldStamps merge
// section (which can independently set repairPushNeeded on its own, e.g. on
// a first-ever hydrate with no prior stamp baseline) never runs -- isolating
// this check to ONLY the pendingApprovals repair path.
store.hydrateFromCloud({
  pendingApprovals: [cloudReq],
  resolvedApprovals: [],
  taskCompletionLogs: [],
  taskLedgerLogs: [],
});

const finalPending = store.getState().pendingApprovals.map((r) => r.id).sort();
console.log('Local pendingApprovals after hydrate:', JSON.stringify(finalPending));
console.log('pushStateToCloud call count after hydrate:', pushCount);

const localRecovered = finalPending.includes('req_local_only') && finalPending.includes('req_cloud_only');
const pushedRepair = pushCount > 0;

console.log(localRecovered ? '✅ local state recovered both entries' : '❌ local state LOST the local-only entry');
console.log(pushedRepair ? '✅ repair was pushed back to cloud (other devices/Parent Portal will see req_local_only)' : '❌ NO repair pushed -- cloud (and Parent Portal / sibling devices) stay missing req_local_only until an unrelated save happens');

fs.rmSync(TMP, { recursive: true, force: true });
process.exit(localRecovered && pushedRepair ? 0 : 1);
