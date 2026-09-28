// Regression test: two kids on the SAME device who both own the same pet
// species (same pet id) must have independent training level/XP and
// hunger/hygiene/joy/energy -- feeding/training one kid's pet must never
// change what the OTHER kid sees for theirs. petStatsMap/petLevelMap/
// petXpMap/petSanctuary started as single shared (household-level) maps
// keyed only by pet id, so this used to leak across kids who both unlocked
// the same species.
import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-isolation-'));

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

store.setSyncService({ pushStateToCloud: () => {}, broadcastState: () => {} });

let failed = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  ✅ PASS: ${name}`); } else { failed++; console.log(`  ❌ FAIL: ${name} ${detail}`); }
}

console.log('🐾 --- Verifying pet training/needs stay isolated per kid --- 🐾');

// Kid A (the default hero) and Kid B both unlock and play as the SAME pet id ('2').
const PET_ID = '2';
store.getState().selectedHero.activePetId = PET_ID;
store.getState().selectedHero.unlockedPetIds = [PET_ID];

// Kid A trains their pet up and feeds it.
store.addPetTrainingXp(PET_ID, 150);
store.feedPet(PET_ID);
const kidALevel = store.getPetLevel(PET_ID);
const kidAHunger = store.getPetStats(PET_ID).hunger;
check('Kid A pet leveled up from training', kidALevel > 1, `(level=${kidALevel})`);

// Kid B is added (shares the same device) and also picks pet id '2'.
const kidB = store.addHero({ name: 'Sam' });
store.getState().selectedHero.activePetId = PET_ID;
store.getState().selectedHero.unlockedPetIds = [PET_ID];

const kidBLevelBeforeTraining = store.getPetLevel(PET_ID);
const kidBHungerBeforeFeeding = store.getPetStats(PET_ID).hunger;
check(
  "Switching to Kid B does NOT inherit Kid A's trained-up level for the same pet id",
  kidBLevelBeforeTraining === 1,
  `(expected fresh level 1, got ${kidBLevelBeforeTraining})`
);
check(
  "Switching to Kid B does NOT inherit Kid A's fed-up hunger for the same pet id",
  kidBHungerBeforeFeeding < kidAHunger,
  `(Kid A hunger=${kidAHunger}, Kid B hunger=${kidBHungerBeforeFeeding})`
);

// Kid B trains their own copy of the same pet id.
store.addPetTrainingXp(PET_ID, 50);
const kidBLevelAfter = store.getPetLevel(PET_ID);

// Switch back to Kid A (hero_1) and confirm their progress is untouched by
// Kid B's training in between.
store.switchHero('hero_1');
const kidALevelAfterSwitch = store.getPetLevel(PET_ID);
const kidAHungerAfterSwitch = store.getPetStats(PET_ID).hunger;
check(
  "Kid A's own pet level survives switching away and back, unaffected by Kid B",
  kidALevelAfterSwitch === kidALevel,
  `(before=${kidALevel}, after=${kidALevelAfterSwitch})`
);
check(
  "Kid A's own pet hunger survives switching away and back, unaffected by Kid B",
  kidAHungerAfterSwitch === kidAHunger,
  `(before=${kidAHunger}, after=${kidAHungerAfterSwitch})`
);

// Switch back to Kid B and confirm THEIR progress also survived independently.
store.switchHero(kidB.id);
const kidBLevelAfterSwitch = store.getPetLevel(PET_ID);
check(
  "Kid B's own pet level survives switching away and back",
  kidBLevelAfterSwitch === kidBLevelAfter,
  `(before=${kidBLevelAfter}, after=${kidBLevelAfterSwitch})`
);

fs.rmSync(TMP, { recursive: true, force: true });
if (failed) { console.log(`\n❌ ${failed} check(s) failed`); process.exit(1); }
console.log('\n✅ ALL PET ISOLATION CHECKS PASSED');
process.exit(0);
