// Regression test: the Rex voice persona chosen in the Parent Panel is saved,
// synced, migrated from the old unused liveRex.voiceName, and actually changes
// Rex's Web Speech voice and the Gemini Live voice (Rex only).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { makeFS, makeDevice, makeRunner } from './parent_panel_device_harness.mjs';
import { REX_VOICE_PERSONAS, REX_VOICE_IDS, getRexVoicePersona } from '../src/data/rexVoicePersonas.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, expect, finish } = makeRunner('🦖 --- Verifying Rex voice persona --- 🦖');

await check('persona list is valid and lookups fall back to Puck', async () => {
  expect(REX_VOICE_PERSONAS.length === 5 && REX_VOICE_IDS.join() === 'Puck,Aoede,Charon,Fenrir,Kore', `ids=${REX_VOICE_IDS}`);
  expect(getRexVoicePersona('kore').id === 'Kore' && getRexVoicePersona('nope').id === 'Puck' && getRexVoicePersona(undefined).id === 'Puck', 'lookup');
  expect(getRexVoicePersona('Puck').webSpeech === null, 'Puck should keep the normal Rex voice');
});

await check('server Gemini Live allowlist matches the client persona list', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'server/geminiService.js'), 'utf8');
  const m = src.match(/LIVE_REX_VOICES\s*=\s*\[([^\]]*)\]/);
  expect(m, 'LIVE_REX_VOICES not found');
  const ids = m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
  expect(ids.join() === REX_VOICE_IDS.join(), `server=${ids} client=${REX_VOICE_IDS}`);
  expect(/searchParams\.get\('voice'\)/.test(src), 'server ignores the voice query parameter');
  const live = fs.readFileSync(path.join(ROOT, 'src/services/geminiLiveService.js'), 'utf8');
  expect(/&voice=\$\{encodeURIComponent\(rexVoice\)\}/.test(live), 'client does not send the voice to Gemini Live');
});

await check('setRexVoicePersona saves a valid persona and stamps it', async () => {
  const D = makeDevice(makeFS(1), { sync: false });
  D.store.setRexVoicePersona('Charon');
  const ps = D.store.getState().parentSettings;
  expect(ps.rexVoice === 'Charon' && Number(ps.fieldStamps?.rexVoice) > 0, `rexVoice=${ps.rexVoice}`);
  D.store.setRexVoicePersona('<script>');
  expect(D.store.getState().parentSettings.rexVoice === 'Puck', `invalid -> ${D.store.getState().parentSettings.rexVoice}`);
});

await check('old liveRex.voiceName is migrated into parentSettings.rexVoice', async () => {
  const D = makeDevice(makeFS(1), { sync: false });
  const key = 'little_heroes_adventure_master_v10';
  D.store.saveState(true);
  const saved = JSON.parse(D.storage.get(key));
  delete saved.parentSettings.rexVoice;
  saved.liveRex = { ...(saved.liveRex || {}), voiceName: 'Fenrir' };
  const storage = new Map([[key, JSON.stringify(saved)]]);
  const D2 = makeDevice(makeFS(1), { storage, sync: false });
  expect(D2.store.getState().parentSettings.rexVoice === 'Fenrir', `migrated rexVoice=${D2.store.getState().parentSettings.rexVoice}`);
});

// Bundle the real voiceService with a store whose persona we control.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rex-voice-'));
fs.writeFileSync(path.join(TMP, 'store.js'), `export const store = { getRexVoicePersona: () => globalThis.__persona__, getState: () => ({ parentSettings: {}, liveRex: {} }) };`);
fs.writeFileSync(path.join(TMP, 'sound.js'), `export const Sound = new Proxy({}, { get: () => () => {} });`);
fs.writeFileSync(path.join(TMP, 'local.js'), `export const isLocalVoiceAvailable = async () => false; export const fetchLocalSpeechUrl = async () => null;`);
fs.writeFileSync(path.join(TMP, 'entry.js'), `export { getCompanionVoiceParams } from '${ROOT.replace(/\\/g, '/')}/src/services/voiceService.js';`);
await esbuild.build({
  entryPoints: [path.join(TMP, 'entry.js')], bundle: true, format: 'iife', globalName: 'V', platform: 'browser', logLevel: 'error', outfile: path.join(TMP, 'v.js'),
  plugins: [{ name: 'stubs', setup(b) { b.onResolve({ filter: /.*/ }, (a) => {
    if (/state\/store\.js$/.test(a.path)) return { path: path.join(TMP, 'store.js') };
    if (/audio\/sfx\.js$/.test(a.path)) return { path: path.join(TMP, 'sound.js') };
    if (/localVoiceService\.js$/.test(a.path)) return { path: path.join(TMP, 'local.js') };
    return null;
  }); } }],
});
const noop = () => {};
const ctx = { console: { log: noop, info: noop, warn: noop, error: noop }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop, Promise, Date, Math, JSON, URL, navigator: { userAgent: 'node' }, localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, addEventListener: noop, removeEventListener: noop, document: { addEventListener: noop, removeEventListener: noop }, location: { hostname: 'localhost', protocol: 'http:', host: 'localhost' } };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(TMP, 'v.js'), 'utf8'), ctx);
const params = (pet) => ctx.V.getCompanionVoiceParams(pet);

await check('Puck keeps Rex\'s normal Web Speech voice', async () => {
  ctx.__persona__ = getRexVoicePersona('Puck');
  const base = params('rex');
  ctx.__persona__ = getRexVoicePersona('Kore');
  const kore = params('rex');
  expect(kore.pitch === 1.05 && kore.rate === 0.88, `Kore pitch/rate=${kore.pitch}/${kore.rate}`);
  expect(base.pitch !== kore.pitch || base.rate !== kore.rate, 'Kore sounds the same as Puck');
});

await check('each persona changes Rex\'s pitch and rate', async () => {
  for (const p of REX_VOICE_PERSONAS.filter((x) => x.webSpeech)) {
    ctx.__persona__ = p;
    const v = params('rex');
    expect(v.pitch === p.webSpeech.pitch && v.rate === p.webSpeech.rate, `${p.id}: ${v.pitch}/${v.rate}`);
  }
});

await check('the persona applies to Rex only', async () => {
  ctx.__persona__ = null;
  const before = params('stego');
  ctx.__persona__ = getRexVoicePersona('Charon');
  const after = params('stego');
  expect(JSON.stringify(before) === JSON.stringify(after), 'Stego\'s voice changed with the Rex persona');
});

fs.rmSync(TMP, { recursive: true, force: true });
finish('Rex voice persona');
