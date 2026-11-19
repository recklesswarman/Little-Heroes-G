/**
 * scratch/e2e_overhaul_harness.mjs
 *
 * Shared Layer A Node.js simulation harness for Little Hero Adventures Overhaul E2E Suites.
 * Installs real window EventTarget, SpeechRecognition, speechSynthesis, AudioContext,
 * and navigator.mediaDevices mocks BEFORE dynamically importing singleton modules.
 */

import './setup_mock_env.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STORAGE_KEY = 'little_heroes_adventure_master_v10';

// ---------------------------------------------------------------------------
// 1. Real Map-backed EventTarget on window + Event Log
// ---------------------------------------------------------------------------
const windowListeners = new Map();
export const eventLog = [];

export function clearEventLog() {
  eventLog.length = 0;
}

export function getEventLog(type = null) {
  return type ? eventLog.filter(e => e.type === type) : [...eventLog];
}

export function getWindowListenerCount(type) {
  return windowListeners.get(type)?.size || 0;
}

globalThis.window.CustomEvent = globalThis.CustomEvent;
globalThis.window.addEventListener = (type, fn) => {
  if (!type || typeof fn !== 'function') return;
  if (!windowListeners.has(type)) windowListeners.set(type, new Set());
  windowListeners.get(type).add(fn);
};
globalThis.window.removeEventListener = (type, fn) => {
  windowListeners.get(type)?.delete(fn);
};
globalThis.window.dispatchEvent = (evt) => {
  const type = evt?.type;
  if (!type) return true;
  eventLog.push({ type, detail: evt.detail ?? null, timestamp: Date.now() });
  const set = windowListeners.get(type);
  if (set) {
    for (const fn of [...set]) {
      fn(evt);
    }
  }
  return true;
};

// Also ensure document listener methods exist safely if views attach document listeners
if (!globalThis.document.addEventListener) globalThis.document.addEventListener = () => {};
if (!globalThis.document.removeEventListener) globalThis.document.removeEventListener = () => {};

// ---------------------------------------------------------------------------
// 2. Network / Fetch safe wrapper
// ---------------------------------------------------------------------------
export const networkCalls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);
  networkCalls.push({ url: urlStr, options, timestamp: Date.now() });
  if (urlStr.includes('/api/tts') || urlStr.includes('run.app')) {
    return new Response(JSON.stringify({ error: 'Offline test mock' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (originalFetch && urlStr.startsWith('file://')) {
    return originalFetch(url, options);
  }
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

// ---------------------------------------------------------------------------
// 3. Controllable SpeechRecognition / webkitSpeechRecognition Mock
// ---------------------------------------------------------------------------
const recognitionInstances = [];
let speechRecognitionAvailable = true;
let startErrorToThrow = null;

export class MockSpeechRecognition {
  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.lang = 'en-US';
    this.maxAlternatives = 1;
    this.started = false;
    this.stopCount = 0;
    this.abortCount = 0;
    this.startCount = 0;
    this.onstart = null;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    recognitionInstances.push(this);
  }

  start() {
    if (!speechRecognitionAvailable) {
      throw new Error('SpeechRecognition not available');
    }
    if (startErrorToThrow) {
      const err = startErrorToThrow;
      startErrorToThrow = null;
      if (typeof this.onerror === 'function') {
        this.onerror({ error: err.code || err.message || 'not-allowed' });
      }
      if (err.throwOnStart) throw err;
      return;
    }
    this.started = true;
    this.startCount++;
    if (typeof this.onstart === 'function') {
      this.onstart({ type: 'start' });
    }
  }

  stop() {
    this.started = false;
    this.stopCount++;
    if (typeof this.onend === 'function') {
      this.onend({ type: 'end' });
    }
  }

  abort() {
    this.started = false;
    this.abortCount++;
    if (typeof this.onend === 'function') {
      this.onend({ type: 'end' });
    }
  }

  emitTranscript(text, { isFinal = true, confidence = 0.96 } = {}) {
    const alt = [{ transcript: String(text), confidence }];
    const resultItem = Object.assign(alt, { isFinal, item: (idx) => alt[idx] });
    const results = Object.assign([resultItem], { item: (idx) => results[idx] });
    if (typeof this.onresult === 'function') {
      this.onresult({
        type: 'result',
        resultIndex: 0,
        results
      });
    }
  }

  emitError(errorCode = 'no-speech') {
    this.started = false;
    if (typeof this.onerror === 'function') {
      this.onerror({ type: 'error', error: errorCode });
    }
    if (typeof this.onend === 'function') {
      this.onend({ type: 'end' });
    }
  }
}

export const voiceMockControl = {
  get instances() {
    return recognitionInstances;
  },
  get latest() {
    return recognitionInstances[recognitionInstances.length - 1] || null;
  },
  setAvailable(avail) {
    speechRecognitionAvailable = Boolean(avail);
    if (speechRecognitionAvailable) {
      globalThis.window.SpeechRecognition = MockSpeechRecognition;
      globalThis.window.webkitSpeechRecognition = MockSpeechRecognition;
      globalThis.SpeechRecognition = MockSpeechRecognition;
      globalThis.webkitSpeechRecognition = MockSpeechRecognition;
    } else {
      delete globalThis.window.SpeechRecognition;
      delete globalThis.window.webkitSpeechRecognition;
      delete globalThis.SpeechRecognition;
      delete globalThis.webkitSpeechRecognition;
    }
  },
  setStartError(code, throwOnStart = false) {
    startErrorToThrow = { code, message: code, throwOnStart };
  },
  emitTranscript(text, opts = {}) {
    const inst = this.latest;
    if (!inst) throw new Error('No MockSpeechRecognition instance active');
    inst.emitTranscript(text, opts);
  },
  emitError(code) {
    const inst = this.latest;
    if (!inst) throw new Error('No MockSpeechRecognition instance active');
    inst.emitError(code);
  },
  reset() {
    startErrorToThrow = null;
    this.setAvailable(true);
  }
};

voiceMockControl.setAvailable(true);

// ---------------------------------------------------------------------------
// 4. Controllable speechSynthesis & SpeechSynthesisUtterance Mock
// ---------------------------------------------------------------------------
class MockSpeechSynthesisVoice {
  constructor(name, lang = 'en-US', isDefault = false) {
    this.name = name;
    this.lang = lang;
    this.default = isDefault;
    this.voiceURI = name;
    this.localService = true;
  }
}

const MOCK_VOICES = [
  new MockSpeechSynthesisVoice('Microsoft Jenny Natural - English (United States)', 'en-US', true),
  new MockSpeechSynthesisVoice('Google US English', 'en-US')
];

class MockSpeechSynthesisUtterance {
  constructor(text = '') {
    this.text = String(text);
    this.voice = null;
    this.pitch = 1.0;
    this.rate = 1.0;
    this.volume = 1.0;
    this.lang = 'en-US';
    this.onstart = null;
    this.onboundary = null;
    this.onend = null;
    this.onerror = null;
    this._canceled = false;
  }
}

let synthSpeaking = false;
let synthPending = false;
let synthPaused = false;
let activeUtterance = null;
const spokenHistory = [];

export const speechMockControl = {
  manualCompletion: false,
  get speaking() {
    return synthSpeaking;
  },
  get spokenHistory() {
    return spokenHistory;
  },
  setSpeaking(val) {
    synthSpeaking = Boolean(val);
    synthPending = false;
  },
  completeActiveUtterance() {
    const utt = activeUtterance;
    activeUtterance = null;
    synthSpeaking = false;
    synthPending = false;
    if (utt && !utt._canceled && typeof utt.onend === 'function') {
      utt.onend({ type: 'end' });
    }
  },
  dispatchSpeechStart(text = '') {
    synthSpeaking = true;
    globalThis.window.dispatchEvent(new globalThis.CustomEvent('companion-speech-start', {
      detail: { text }
    }));
  },
  dispatchSpeechEnd(text = '') {
    synthSpeaking = false;
    synthPending = false;
    globalThis.window.dispatchEvent(new globalThis.CustomEvent('companion-speech-end', {
      detail: { text }
    }));
  },
  reset() {
    this.manualCompletion = false;
    synthSpeaking = false;
    synthPending = false;
    synthPaused = false;
    activeUtterance = null;
    spokenHistory.length = 0;
  }
};

const mockSpeechSynthesis = {
  get speaking() { return synthSpeaking; },
  get pending() { return synthPending; },
  get paused() { return synthPaused; },
  getVoices() { return [...MOCK_VOICES]; },
  speak(utterance) {
    if (!utterance) return;
    activeUtterance = utterance;
    synthSpeaking = true;
    synthPending = false;
    synthPaused = false;
    utterance._canceled = false;
    spokenHistory.push({ text: utterance.text, timestamp: Date.now() });

    if (typeof utterance.onstart === 'function') {
      utterance.onstart({ type: 'start' });
    }
    if (!speechMockControl.manualCompletion) {
      setTimeout(() => {
        if (activeUtterance === utterance && !utterance._canceled) {
          speechMockControl.completeActiveUtterance();
        }
      }, 15);
    }
  },
  cancel() {
    const utt = activeUtterance;
    activeUtterance = null;
    synthSpeaking = false;
    synthPending = false;
    synthPaused = false;
    if (utt) {
      utt._canceled = true;
      if (typeof utt.onerror === 'function') {
        utt.onerror({ type: 'error', error: 'canceled' });
      }
    }
  },
  pause() { synthPaused = true; },
  resume() { synthPaused = false; }
};

globalThis.window.speechSynthesis = mockSpeechSynthesis;
globalThis.speechSynthesis = mockSpeechSynthesis;
globalThis.window.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
globalThis.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

// ---------------------------------------------------------------------------
// 5. SpyAudioContext & navigator.mediaDevices Mock
// ---------------------------------------------------------------------------
const createdAudioContexts = [];
export class SpyAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = {};
    createdAudioContexts.push(this);
  }
  createGain() {
    const gainParam = {
      value: 1,
      setValueAtTime(v) { this.value = v; },
      linearRampToValueAtTime(v) { this.value = v; },
      exponentialRampToValueAtTime(v) { this.value = v; }
    };
    return {
      gain: gainParam,
      connect: () => {},
      disconnect: () => {}
    };
  }
  createOscillator() {
    const freqParam = {
      value: 440,
      setValueAtTime(v) { this.value = v; },
      linearRampToValueAtTime(v) { this.value = v; },
      exponentialRampToValueAtTime(v) { this.value = v; }
    };
    return {
      type: 'sine',
      frequency: freqParam,
      connect: () => {},
      start: () => {},
      stop: () => {}
    };
  }
  createAnalyser() {
    return {
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: (arr) => arr.fill(0),
      getByteTimeDomainData: (arr) => arr.fill(128),
      connect: () => {}
    };
  }
  createBiquadFilter() {
    const freqParam = {
      value: 1000,
      setValueAtTime(v) { this.value = v; },
      linearRampToValueAtTime(v) { this.value = v; },
      exponentialRampToValueAtTime(v) { this.value = v; }
    };
    const qParam = {
      value: 1,
      setValueAtTime(v) { this.value = v; },
      linearRampToValueAtTime(v) { this.value = v; }
    };
    return { type: 'lowpass', frequency: freqParam, Q: qParam, connect: () => {} };
  }
  createBufferSource() {
    return { buffer: null, loop: false, connect: () => {}, start: () => {}, stop: () => {}, onended: null };
  }
  createMediaStreamSource() {
    return { connect: () => {}, disconnect: () => {} };
  }
  async decodeAudioData() {
    return { duration: 0.2, length: 8820, sampleRate: 44100 };
  }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}

export const audioMockControl = {
  get contexts() { return createdAudioContexts; },
  reset() { createdAudioContexts.length = 0; }
};

globalThis.window.AudioContext = SpyAudioContext;
globalThis.window.webkitAudioContext = SpyAudioContext;
globalThis.AudioContext = SpyAudioContext;
globalThis.webkitAudioContext = SpyAudioContext;

export function setMediaDevices(md) {
  try {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: md,
      writable: true,
      configurable: true
    });
  } catch {
    try { globalThis.navigator.mediaDevices = md; } catch {}
  }
  try {
    globalThis.window.navigator.mediaDevices = md;
  } catch {}
}

export function resetMediaDevices() {
  setMediaDevices(undefined);
}

// Default to undefined mediaDevices for deterministic non-camera fallback unless test installs mock
resetMediaDevices();

// ---------------------------------------------------------------------------
// 6. Namespace Dynamic Imports (AFTER all global mocks are installed)
// ---------------------------------------------------------------------------
export const storeMod = await import('../src/state/store.js');
export const battleViewMod = await import('../src/views/BattleView.js');
export const battle3DMod = await import('../src/services/hanaBattle3DService.js');
export const rexMod = await import('../src/services/rexCompanionEngine.js');
export const voiceMod = await import('../src/services/voiceService.js');
export const sfxMod = await import('../src/audio/sfx.js');
export const voicePromptsMod = await import('../src/utils/voicePrompts.js');
export const bossesDataMod = await import('../src/data/hygieneBossesData.js');
export const catalogMod = await import('../src/data/digitalRewardsCatalog.js');
export const heroHqDataMod = await import('../src/data/heroHQData.js');
export const shopViewMod = await import('../src/views/ShopView.js');
export const heroHqViewMod = await import('../src/views/HeroHQView.js');
export const dashboardViewMod = await import('../src/views/DashboardView.js');
export const rewardGraphicsMod = await import('../src/utils/rewardGraphics.js');
export const visionMod = await import('../src/services/brushVisionTracker.js');
export const syncMod = await import('../src/services/firestoreSyncService.js');

export const { store } = storeMod;
export const { hanaBattle3DService } = battle3DMod;
export const { rexEngine } = rexMod;

export async function importAssetUrlModule() {
  const absPath = path.join(REPO_ROOT, 'src', 'utils', 'assetUrl.js');
  if (!fs.existsSync(absPath)) {
    throw new Error('Contract missing: src/utils/assetUrl.js does not exist');
  }
  return await import('../src/utils/assetUrl.js');
}

export async function loadAssetUrlWithBase(baseEnv) {
  const absPath = path.join(REPO_ROOT, 'src', 'utils', 'assetUrl.js');
  if (!fs.existsSync(absPath)) {
    throw new Error('Contract missing: src/utils/assetUrl.js does not exist');
  }
  const defineEnv = baseEnv === undefined
    ? 'undefined'
    : JSON.stringify({ BASE_URL: baseEnv });
  const res = await esbuild.build({
    entryPoints: [absPath],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'AssetUrlMod',
    platform: 'browser',
    logLevel: 'error',
    define: {
      'import.meta.env': defineEnv
    }
  });
  const code = res.outputFiles[0].text;
  const ctx = { globalThis: {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.AssetUrlMod;
}

export function getLocalDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getYesterdayDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return getLocalDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
}

export function isMintyShieldUpgrade(item) {
  if (!item) return false;
  return (
    item.statBonusType === 'minty_shield_duration' ||
    item.statBonusType === 'shield_duration' ||
    item.subCategory === 'shield_upgrade' ||
    item.subcategory === 'shield_upgrade' ||
    Number(item.shieldBonusSec) > 0 ||
    Number(item.shieldDurationBonusSec) > 0
  );
}

export function getMintyShieldUpgradeBonus(item) {
  if (!item) return 0;
  return Number(item.shieldDurationBonusSec ?? item.shieldBonusSec ?? 0) || 0;
}

export function findCleanseRematchButton(doc, html, bossId, bossName = '', cleansedTitle = '') {
  const byData = doc.querySelector(`[data-rematch-boss-id="${bossId}"]`)
    || doc.querySelector(`[data-cleanse-rematch-id="${bossId}"]`);
  if (byData) return byData;

  const allBtns = doc.querySelectorAll('button');
  const byDataset = allBtns.find(b => {
    const bid = b.dataset?.rematchBossId || b.dataset?.bossId || b.dataset?.rematchId;
    if (bid !== bossId) return false;
    return /rematch/i.test(`${b.className || ''} ${b.id || ''} ${b.title || ''} ${b.textContent || ''}`) || b.dataset?.rematchBossId === bossId;
  });
  if (byDataset) return byDataset;

  const btnMatches = [...String(html || '').matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
  const rematchIndices = [];
  btnMatches.forEach((m, idx) => {
    const attrs = m[1] || '';
    const inner = (m[2] || '').replace(/<[^>]+>/g, ' ');
    if (/rematch/i.test(inner) || /rematch/i.test(attrs)) {
      rematchIndices.push({ idx, attrs, inner });
    }
  });
  const scoped = rematchIndices.find(r =>
    r.attrs.includes(bossId) ||
    (bossName && r.inner.includes(bossName)) ||
    (cleansedTitle && r.inner.includes(cleansedTitle))
  );
  if (scoped && allBtns[scoped.idx]) return allBtns[scoped.idx];
  if (rematchIndices.length === 1 && allBtns[rematchIndices[0].idx]) return allBtns[rematchIndices[0].idx];
  return null;
}

export function step3DUntilBombsCleared(clock, maxSteps = 90, dt = 0.05) {
  for (let i = 0; i < maxSteps; i++) {
    if ((hanaBattle3DService.caramelBombs || []).length === 0) return true;
    clock.advanceMs(Math.round(dt * 1000));
    clock.step3D(dt, 1);
  }
  return (hanaBattle3DService.caramelBombs || []).length === 0;
}

// ---------------------------------------------------------------------------
// 7. Deterministic Clock & Interval Driver
// ---------------------------------------------------------------------------
export function createClockDriver(startMs = 1_700_000_000_000) {
  const realSetInterval = global.setInterval;
  const realClearInterval = global.clearInterval;
  const realDateNow = Date.now;
  const realPerfNow = globalThis.performance.now.bind(globalThis.performance);

  let simNow = startMs;
  const registered = [];

  Date.now = () => simNow;
  globalThis.performance.now = () => simNow - startMs;

  global.setInterval = (fn, delay, ...args) => {
    const id = realSetInterval(() => {}, 1 << 30);
    registered.push({ id, fn, delay, args, cleared: false });
    return id;
  };
  global.clearInterval = (id) => {
    const entry = registered.find(r => r.id === id);
    if (entry) entry.cleared = true;
    return realClearInterval(id);
  };

  function getActiveIntervals(predicate = null) {
    return registered.filter(r => !r.cleared && (!predicate || predicate(r)));
  }

  return {
    now: () => simNow,
    advanceMs(ms) {
      simNow += ms;
      return simNow;
    },
    getIntervals(delayFilter = null) {
      return getActiveIntervals(delayFilter === null ? null : (r) => r.delay === delayFilter);
    },
    tickBattle(times = 1, { advanceClock = true } = {}) {
      for (let i = 0; i < times; i++) {
        if (advanceClock) simNow += 1000;
        const oneSec = getActiveIntervals(r => r.delay === 1000);
        const battleTick = oneSec.find(r => {
          const src = String(r.fn);
          return src.includes('updateColosseumTimer') || src.includes('secondsRemaining--') || src.includes('concludeVictory');
        }) || oneSec[oneSec.length - 1];
        if (!battleTick) {
          throw new Error('No active 1000ms battleTimer interval registered');
        }
        battleTick.fn(...battleTick.args);
      }
    },
    tickAutoAssist() {
      const oneSec = getActiveIntervals(r => r.delay === 1000);
      const autoAssist = oneSec.find(r => {
        const src = String(r.fn);
        return src.includes('autoAssistIdleMs') || src.includes('isAutoAssistPulseActive');
      }) || oneSec[0];
      if (autoAssist) {
        autoAssist.fn(...autoAssist.args);
      }
    },
    tickBomb() {
      const bomb = getActiveIntervals(r => r.delay >= 10000);
      if (bomb.length > 0) {
        bomb[bomb.length - 1].fn(...bomb[bomb.length - 1].args);
      }
    },
    tickMotion(times = 1) {
      for (let i = 0; i < times; i++) {
        simNow += 100;
        const motion = getActiveIntervals(r => r.delay === 100);
        if (motion.length > 0) {
          motion[motion.length - 1].fn(...motion[motion.length - 1].args);
        }
      }
    },
    step3D(dt = 0.016, steps = 1) {
      for (let i = 0; i < steps; i++) {
        if (hanaBattle3DService.ctx && typeof hanaBattle3DService.renderProceduralScene === 'function') {
          hanaBattle3DService.renderProceduralScene(dt);
        } else {
          if (typeof hanaBattle3DService.renderCounterAttackProjectiles === 'function' && hanaBattle3DService.ctx) {
            hanaBattle3DService.renderCounterAttackProjectiles(hanaBattle3DService.ctx, dt);
          }
          if (typeof hanaBattle3DService.renderCaramelBombs === 'function' && hanaBattle3DService.ctx) {
            hanaBattle3DService.renderCaramelBombs(hanaBattle3DService.ctx, dt);
          }
        }
      }
    },
    restore() {
      for (const r of registered) {
        if (!r.cleared) realClearInterval(r.id);
      }
      Date.now = realDateNow;
      globalThis.performance.now = realPerfNow;
      global.setInterval = realSetInterval;
      global.clearInterval = realClearInterval;
    }
  };
}

// ---------------------------------------------------------------------------
// 8. Store & Battle Lifecycle Helpers
// ---------------------------------------------------------------------------
export function resetStoreBaseline({ coins = 200, points = 50, sparks = 40, difficulty = 'medium', durationSec = 120, xpNext = null } = {}) {
  try { battleViewMod.abandonBattleIfRunning(); } catch {}
  localStorage.clear();
  store.loadState();

  const s = store.getState();
  s.isAuthenticated = true;
  s.isAuthReady = true;
  s.isHouseholdConfigured = true;
  s.householdSetupStep = 'ready';
  s.household = { ...(s.household || {}), syncCode: 'HERO8842' };
  s.activeView = 'dashboard';
  s.previousView = 'dashboard';
  s.hygieneReminders = {};
  s.parentCustomBosses = [];
  s.parentSettings = {
    ...(s.parentSettings || {}),
    arBattleDuration: durationSec,
    motionSensitivity: 'medium',
    voicePromptsEnabled: true,
    toothbrushBattlePoints: 15,
    toothbrushBattleTokens: 40
  };
  s.pendingApprovals = [];
  s.resolvedApprovals = [];
  s.taskCompletionLogs = [];

  const hero = store.getSelectedHero();
  if (hero) {
    hero.coins = coins;
    hero.tokens = coins;
    hero.points = points;
    hero.sparks = sparks;
    hero.evolutionSparks = sparks;
    hero.gameDifficulty = difficulty;
    hero.inventory = ['laser_toothbrush', 'cowl_hero'];
    hero.equippedWeapon = 'laser_toothbrush';
    hero.equippedGear = ['laser_toothbrush'];
    hero.petSparkMap = { ...(hero.petSparkMap || {}), [hero.activePetId || 1]: sparks };
    if (xpNext !== null) hero.xpNext = xpNext;
  }
  store.saveState(true, true);
  return s;
}

export async function bootBattle({
  bossId = 'sugar_bandit',
  explicit = true,
  durationSec = 120,
  difficulty = 'medium',
  equippedWeapon = 'laser_toothbrush',
  inventory = ['laser_toothbrush'],
  hygieneReminders = {},
  mediaDevices = undefined,
  speechAvailable = true
} = {}) {
  setMediaDevices(mediaDevices);
  voiceMockControl.setAvailable(speechAvailable);

  const s = store.getState();
  s.hygieneReminders = hygieneReminders;
  s.activeView = 'ar_battle';
  s.parentSettings = { ...(s.parentSettings || {}), arBattleDuration: durationSec };
  const hero = store.getSelectedHero();
  if (hero) {
    hero.gameDifficulty = difficulty;
    hero.inventory = [...inventory];
    hero.equippedWeapon = equippedWeapon;
    hero.equippedGear = equippedWeapon ? [equippedWeapon] : [];
  }

  battleViewMod.setExplicitBossSelection(explicit);
  if (explicit && bossId) {
    s.selectedBossId = bossId;
    store.initColosseumBattle(bossId, durationSec, true);
  } else if (!explicit) {
    s.hasExplicitBossSelection = false;
    if (s.selectedBossId === 'sugar_boss') {
      s.selectedBossId = 'sugar_bandit';
    }
  }

  document.body.setMockHtml(battleViewMod.renderBattleView());
  battleViewMod.attachBattleListeners();
  await new Promise(r => setTimeout(r, 20));
  return document.getElementById('battle-webgl-canvas');
}

export function scrubBurst({
  clock,
  steps = 8,
  stepMs = 160,
  x = 300,
  y = 300,
  dx = 12,
  dy = 4,
  canvas = document.getElementById('battle-webgl-canvas')
} = {}) {
  if (!canvas) throw new Error('scrubBurst: #battle-webgl-canvas not mounted');
  canvas.dispatchEvent(new globalThis.PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
  for (let i = 1; i <= steps; i++) {
    if (clock) clock.advanceMs(stepMs);
    canvas.dispatchEvent(new globalThis.PointerEvent('pointermove', {
      clientX: x + (i % 2 === 0 ? dx : -dx),
      clientY: y + (i % 2 === 0 ? dy : -dy),
      bubbles: true
    }));
  }
  canvas.dispatchEvent(new globalThis.PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true }));
}

export function circularScrubSweep({
  clock,
  cx = 300,
  cy = 260,
  radius = 65,
  points = 12,
  stepMs = 160,
  canvas = document.getElementById('battle-webgl-canvas')
} = {}) {
  if (!canvas) throw new Error('circularScrubSweep: #battle-webgl-canvas not mounted');
  const firstX = Math.round(cx + radius);
  const firstY = Math.round(cy);
  canvas.dispatchEvent(new globalThis.PointerEvent('pointerdown', { clientX: firstX, clientY: firstY, bubbles: true }));
  for (let i = 1; i <= points; i++) {
    if (clock) clock.advanceMs(stepMs);
    const angle = (i / points) * Math.PI * 2;
    const px = Math.round(cx + Math.cos(angle) * radius);
    const py = Math.round(cy + Math.sin(angle) * radius);
    canvas.dispatchEvent(new globalThis.PointerEvent('pointermove', { clientX: px, clientY: py, bubbles: true }));
  }
  canvas.dispatchEvent(new globalThis.PointerEvent('pointerup', { clientX: firstX, clientY: firstY, bubbles: true }));
}

export function cleanupBattle(clock = null) {
  try { battleViewMod.abandonBattleIfRunning(); } catch {}
  try { battleViewMod.setExplicitBossSelection(false); } catch {}
  try { store.getState().hygieneReminders = {}; } catch {}
  if (clock) {
    try { clock.restore(); } catch {}
  }
  speechMockControl.reset();
  voiceMockControl.reset();
  audioMockControl.reset();
  resetMediaDevices();
  clearEventLog();
}

// ---------------------------------------------------------------------------
// 9. Multi-Device Firestore Sync Simulator (esbuild + vm)
// ---------------------------------------------------------------------------
export async function createSyncHarness({ latencyMs = 30 } = {}) {
  const repoUnix = REPO_ROOT.replace(/\\/g, '/');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'overhaul-sync-'));
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
    'sound.js': `export const Sound = new Proxy({}, { get: () => () => {} }); export function initTactileSoundEngine() {}`,
    'confetti.js': `export default function confetti() {}`,
    'voice.js': `export const COMPANION_VOICE_PROFILES = {}; export const cleanDialogueText = (t) => t; export const unlockVoiceAudio = () => {}; export const stopRex = () => {}; export const stopCompanionAudio = () => {}; export const isRexSpeaking = () => false; export const isCompanionSpeaking = () => false; export const selectPreferredVoice = () => null; export const getCompanionVoiceParams = () => ({}); export const speakCompanion = async () => {};`,
    'celebration.js': `export function triggerInteractiveCelebration() {} export function closeInteractiveCelebration() {}`,
    'firebaseai.js': `export const SPLINE_3D_PRESETS = {}; export const firebaseAI = {}; export const THREE_D_ASSETS = []; export const getThreeDAssetsByCategory = () => []; export const matchBestThreeDAsset = () => null;`,
    'entry.js': `import { store } from '${repoUnix}/src/state/store.js'; import { firestoreSync } from '${repoUnix}/src/services/firestoreSyncService.js'; store.setSyncService(firestoreSync); export { store, firestoreSync };`
  };
  for (const [f, c] of Object.entries(stubs)) {
    fs.writeFileSync(path.join(tmpDir, f), c);
  }
  const map = [
    [/config\/firebase\.js$/, 'firebase-config.js'],
    [/^firebase\/firestore$/, 'firestore.js'],
    [/audio\/sfx\.js$/, 'sound.js'],
    [/^canvas-confetti$/, 'confetti.js'],
    [/services\/voiceService\.js$/, 'voice.js'],
    [/InteractiveCelebrationOverlay\.js$/, 'celebration.js'],
    [/firebaseAILogicService\.js$/, 'firebaseai.js']
  ];
  await esbuild.build({
    entryPoints: [path.join(tmpDir, 'entry.js')],
    bundle: true,
    format: 'iife',
    globalName: 'Device',
    platform: 'browser',
    logLevel: 'error',
    outfile: path.join(tmpDir, 'device.js'),
    plugins: [{
      name: 'stubs',
      setup(b) {
        b.onResolve({ filter: /.*/ }, (a) => {
          for (const [re, f] of map) {
            if (re.test(a.path)) return { path: path.join(tmpDir, f) };
          }
          return null;
        });
      }
    }]
  });
  const bundle = fs.readFileSync(path.join(tmpDir, 'device.js'), 'utf8');
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const isUnsafeProp = (k) => k === '__proto__' || k === 'constructor' || k === 'prototype';
  function setVal(t, k, v, deep) {
    if (isUnsafeProp(k)) return;
    if (v && v.__op === 'delete') { delete t[k]; return; }
    if (v && v.__op === 'arrayRemove') { t[k] = (t[k] || []).filter((x) => !v.vals.includes(x)); return; }
    if (v && v.__op === 'arrayUnion') { t[k] = Array.from(new Set([...(t[k] || []), ...v.vals])); return; }
    if (deep && v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) {
      for (const [kk, vv] of Object.entries(v)) setVal(t[k], kk, vv, true);
      return;
    }
    t[k] = clone(v);
  }

  const docs = {};
  const listeners = [];
  const snap = (p) => ({ exists: () => !!docs[p], data: () => clone(docs[p]) });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const FS = {
    docs,
    async write(p, data, merge, dotted) {
      await sleep(latencyMs);
      if (!merge || !docs[p]) docs[p] = merge && docs[p] ? docs[p] : {};
      for (const [k, v] of Object.entries(clone(data))) {
        if (dotted && k.includes('.')) {
          const parts = k.split('.');
          if (parts.some(isUnsafeProp)) continue;
          let t = docs[p];
          for (const x of parts.slice(0, -1)) {
            t[x] = Object.prototype.hasOwnProperty.call(t, x) && t[x] && typeof t[x] === 'object' ? t[x] : {};
            t = t[x];
          }
          setVal(t, parts.at(-1), v, true);
        } else {
          setVal(docs[p], k, v, true);
        }
      }
      for (const l of listeners) {
        if (l.p === p) setTimeout(() => l.cb(snap(p)), latencyMs);
      }
    },
    async get(p) { return snap(p); },
    listen(p, cb) {
      const l = { p, cb };
      listeners.push(l);
      setTimeout(() => cb(snap(p)), latencyMs);
      return () => {
        const idx = listeners.indexOf(l);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }
  };

  function makeDevice(syncCode = 'HERO-SYNC') {
    const m = new Map();
    const noop = () => {};
    const ls = {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
      clear: () => m.clear(),
      key: (i) => [...m.keys()][i] ?? null,
      get length() { return m.size; }
    };
    const el = new Proxy(function () {}, {
      get: (t, p) => (p === Symbol.toPrimitive ? () => '' : el),
      apply: () => el,
      set: () => true
    });
    const ctx = {
      console: { log: noop, info: noop, warn: noop, error: (...a) => console.error(...a) },
      setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
      queueMicrotask, Promise, Date, Math, JSON, URL,
      localStorage: ls, sessionStorage: ls, __FS__: FS,
      navigator: { userAgent: 'node', onLine: true, vibrate: noop },
      document: el, requestAnimationFrame: noop, cancelAnimationFrame: noop,
      addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
      location: { href: 'http://localhost/', hostname: 'localhost', pathname: '/', search: '', hash: '' },
      matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
      CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail; } },
      fetch: async () => { throw new Error('offline'); }
    };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    ctx.self = ctx;
    ctx.crypto = globalThis.crypto;
    vm.createContext(ctx);
    vm.runInContext(bundle, ctx);
    const dev = { store: ctx.Device.store, sync: ctx.Device.firestoreSync };
    const s = dev.store.getState();
    s.isAuthenticated = true;
    s.isHouseholdConfigured = true;
    s.householdSetupStep = 'ready';
    s.household.syncCode = syncCode;
    dev.sync.startSync(syncCode);
    return dev;
  }

  return {
    FS,
    sleep,
    makeDevice,
    dispose() {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  };
}

// ---------------------------------------------------------------------------
// 10. Granular Suite Runner
// ---------------------------------------------------------------------------
export async function runTestRegistry(suiteTitle, tests) {
  console.log(`\n🧪 === ${suiteTitle} (${tests.length} tests) ===\n`);
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  ✅ PASS [${t.feature}] ${t.name}`);
    } catch (err) {
      failed++;
      const msg = err?.message || String(err);
      failures.push({ feature: t.feature, name: t.name, error: msg });
      console.error(`  ❌ FAIL [${t.feature}] ${t.name} -> ${msg}`);
    }
  }

  console.log(`\n📊 ${suiteTitle}: ${passed} passed, ${failed} failed (total ${tests.length})`);
  return { passed, failed, total: tests.length, failures };
}

export { assert };
