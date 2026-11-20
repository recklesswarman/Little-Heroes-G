/**
 * scratch/e2e_overhaul_tier4_cdp.mjs
 *
 * Tier 4 (Layer B): Real-Browser Headless Chrome CDP E2E Suite (>= 7 scenarios).
 * Runs against built `dist/` via `vite preview` + `ws` CDP client, plus isolated
 * temp subpath build for `/Little-Heroes-G/` asset & base-path 404 verification.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORAGE_KEY = 'little_heroes_adventure_master_v10';

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const activeChildren = new Set();
const activeTempDirs = new Set();

function killChildProcess(proc) {
  if (!proc || proc.exitCode !== null || proc.killed) return;
  try { proc.kill(); } catch {}
  if (process.platform === 'win32' && proc.pid) {
    try {
      spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', timeout: 5000 });
    } catch {}
  }
}

function cleanupAllOnSignal() {
  for (const proc of [...activeChildren]) {
    killChildProcess(proc);
  }
  for (const dir of [...activeTempDirs]) {
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }); } catch {}
  }
}

process.on('SIGINT', () => { cleanupAllOnSignal(); process.exit(130); });
process.on('SIGTERM', () => { cleanupAllOnSignal(); process.exit(143); });

function findChromeBinary() {
  for (const p of CHROME_CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return null;
}

async function waitForHttp(url, timeoutMs = 15000, childProc = null) {
  let childExited = false;
  let childExitCode = null;
  const onExit = (code) => {
    childExited = true;
    childExitCode = code;
  };
  if (childProc) {
    if (childProc.exitCode !== null) {
      throw new Error(`Process exited prematurely with code ${childProc.exitCode} before ${url} was ready`);
    }
    childProc.once('exit', onExit);
  }
  try {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (childExited) {
        throw new Error(`Process exited prematurely with code ${childExitCode} while waiting for ${url}`);
      }
      try {
        const res = await fetch(url);
        if (res.ok) return true;
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error(`Timed out waiting for ${url}`);
  } finally {
    if (childProc) childProc.removeListener('exit', onExit);
  }
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.closed = false;
    this.ready = new Promise((resolve, reject) => {
      const onOpen = () => {
        this.ws.removeListener('close', onPreOpenClose);
        this.ws.removeListener('error', onPreOpenError);
        resolve();
      };
      const onPreOpenClose = () => {
        this.ws.removeListener('open', onOpen);
        this.ws.removeListener('error', onPreOpenError);
        reject(new Error('CDP WebSocket closed before open'));
      };
      const onPreOpenError = (err) => {
        this.ws.removeListener('open', onOpen);
        this.ws.removeListener('close', onPreOpenClose);
        reject(err || new Error('CDP WebSocket error before open'));
      };
      this.ws.once('open', onOpen);
      this.ws.once('close', onPreOpenClose);
      this.ws.once('error', onPreOpenError);
    });
    const rejectAllPending = (err) => {
      this.closed = true;
      for (const [id, entry] of this.pending.entries()) {
        clearTimeout(entry.timer);
        entry.reject(err);
        this.pending.delete(id);
      }
    };
    this.ws.on('close', () => rejectAllPending(new Error('CDP WebSocket closed')));
    this.ws.on('error', (err) => rejectAllPending(err || new Error('CDP WebSocket error')));
    this.ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id);
        clearTimeout(timer);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  async send(method, params = {}, timeoutMs = 15000) {
    await this.ready;
    if (this.closed) throw new Error(`Cannot send ${method}: CDP WebSocket closed`);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'Runtime eval error');
    }
    return res.result?.value;
  }

  close() {
    this.closed = true;
    for (const [id, entry] of this.pending.entries()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('CDP client closed'));
      this.pending.delete(id);
    }
    try { this.ws.close(); } catch {}
  }
}

async function waitForCondition(client, expr, timeoutMs = 8000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const val = await client.eval(expr);
      if (val) return val;
    } catch {}
    await new Promise(r => setTimeout(r, 80));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`);
}

const ASSET_EXT_RE = /\.(?:js|mjs|css|jpg|jpeg|png|svg|webp|json|wasm|splinecode|glb|gltf|mp3|wav|ogg)$/i;

function assertNoNetworkOrRuntimeErrors(client, label, { allowExternalFailure = true } = {}) {
  const exceptions = client.events.filter(e => e.method === 'Runtime.exceptionThrown');
  assert.strictEqual(
    exceptions.length,
    0,
    `${label}: Unexpected runtime exception(s): ${exceptions.map(e => e.params?.exceptionDetails?.text || e.params?.exceptionDetails?.exception?.description).join('; ')}`
  );

  const requestUrls = new Map();
  for (const evt of client.events) {
    if (evt.method === 'Network.requestWillBeSent' && evt.params?.requestId) {
      requestUrls.set(evt.params.requestId, evt.params.request?.url || '');
    }
  }

  const badResponses = client.events
    .filter(e => e.method === 'Network.responseReceived' && (e.params?.response?.status || 0) >= 400)
    .map(e => ({ url: e.params.response.url, status: e.params.response.status }))
    .filter(r => !allowExternalFailure || r.url.startsWith('http://127.0.0.1'));

  assert.strictEqual(
    badResponses.length,
    0,
    `${label}: HTTP >= 400 responses detected: ${JSON.stringify(badResponses)}`
  );

  // Catch Vite preview SPA-fallback 200 text/html responses on non-document asset URLs
  const htmlAssetFallbacks = client.events
    .filter(e => e.method === 'Network.responseReceived' && (e.params?.response?.status || 0) < 400)
    .map(e => ({
      url: e.params.response.url || '',
      mimeType: (e.params.response.mimeType || '').toLowerCase()
    }))
    .filter(r => {
      if (!r.url.startsWith('http://127.0.0.1')) return false;
      if (!r.mimeType.includes('text/html')) return false;
      let pathname = '';
      try { pathname = new URL(r.url).pathname; } catch { pathname = r.url.split('?')[0].split('#')[0]; }
      return pathname.includes('/assets/') || ASSET_EXT_RE.test(pathname);
    });

  assert.strictEqual(
    htmlAssetFallbacks.length,
    0,
    `${label}: SPA-fallback text/html response on non-document asset(s): ${JSON.stringify(htmlAssetFallbacks)}`
  );

  const failedLoads = client.events
    .filter(e => e.method === 'Network.loadingFailed')
    .filter(e => !e.params?.canceled)
    .map(e => ({
      requestId: e.params?.requestId,
      url: requestUrls.get(e.params?.requestId) || '',
      errorText: e.params?.errorText || ''
    }))
    .filter(f => !allowExternalFailure || f.url.startsWith('http://127.0.0.1'));

  assert.strictEqual(
    failedLoads.length,
    0,
    `${label}: Local Network.loadingFailed detected: ${JSON.stringify(failedLoads)}`
  );
}

async function assertCanvasPainted(client, label) {
  const { w, h, nonEmptyPixels } = await client.eval(`(() => {
    const c = document.getElementById('battle-webgl-canvas');
    if (!c) return { w: 0, h: 0, nonEmptyPixels: 0 };
    const ctx = c.getContext('2d');
    let nonEmpty = 0;
    if (ctx && c.width > 0 && c.height > 0) {
      const sample = ctx.getImageData(0, 0, Math.min(200, c.width), Math.min(200, c.height)).data;
      for (let i = 3; i < sample.length; i += 16) {
        if (sample[i] > 0 && (sample[i - 3] + sample[i - 2] + sample[i - 1]) > 15) nonEmpty++;
      }
    }
    return { w: c.width || 0, h: c.height || 0, nonEmptyPixels: nonEmpty };
  })()`);
  assert.ok(w > 0 && h > 0, `${label}: Canvas dimensions valid (${w}x${h})`);
  assert.ok(nonEmptyPixels > 10, `${label}: Canvas contains painted pixels (${nonEmptyPixels})`);
}

async function assertCanvasAnimatingAndPainted(client, label) {
  const { w, h, frame1, nonEmptyPixels } = await client.eval(`(() => {
    const c = document.getElementById('battle-webgl-canvas');
    if (!c) return { w: 0, h: 0, frame1: '', nonEmptyPixels: 0 };
    const ctx = c.getContext('2d');
    let nonEmpty = 0;
    if (ctx && c.width > 0 && c.height > 0) {
      const sample = ctx.getImageData(0, 0, Math.min(200, c.width), Math.min(200, c.height)).data;
      for (let i = 3; i < sample.length; i += 16) {
        if (sample[i] > 0 && (sample[i - 3] + sample[i - 2] + sample[i - 1]) > 15) nonEmpty++;
      }
    }
    return { w: c.width || 0, h: c.height || 0, frame1: c.toDataURL('image/png'), nonEmptyPixels: nonEmpty };
  })()`);
  await new Promise(r => setTimeout(r, 240));
  const frame2 = await client.eval(`document.getElementById('battle-webgl-canvas')?.toDataURL('image/png') || ''`);
  assert.ok(w > 0 && h > 0, `${label}: Canvas dimensions valid (${w}x${h})`);
  assert.ok(nonEmptyPixels > 10, `${label}: Canvas contains painted pixels (${nonEmptyPixels})`);
  assert.ok(frame1.length > 0 && frame1 !== frame2, `${label}: Canvas actively animating`);
}

async function dispatchCircularMouseSweep(client, cx = 320, cy = 260, radius = 70, steps = 14) {
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: cx + radius,
    y: cy,
    button: 'left',
    clickCount: 1
  });
  for (let i = 1; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(cx + Math.cos(angle) * radius),
      y: Math.round(cy + Math.sin(angle) * radius),
      button: 'left'
    });
    await new Promise(r => setTimeout(r, 35));
  }
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: cx + radius,
    y: cy,
    button: 'left',
    clickCount: 1
  });
}

function buildPreloadScript({
  seededState,
  accelerateTimers = false,
  accelerateDelayMs = 55,
  mockSpeechApi = true,
  mockCameraMode = 'motion'
}) {
  return `(() => {
    try {
      if (!localStorage.getItem(${JSON.stringify(STORAGE_KEY)})) {
        localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(seededState))});
      }
    } catch {}

    window.__cdpAccelerateTimers = ${JSON.stringify(accelerateTimers)};
    window.__cdpAccelerateDelayMs = ${JSON.stringify(accelerateDelayMs)};
    window.__mockBrushMotion = ${JSON.stringify(mockCameraMode === 'motion')};
    window.__setMockBrushMotion = (val) => { window.__mockBrushMotion = Boolean(val); };
    window.__oneSecIntervalCount = 0;

    {
      const origSetInterval = window.setInterval.bind(window);
      window.setInterval = (fn, delay, ...args) => {
        if (delay === 1000) {
          window.__oneSecIntervalCount++;
          if (window.__cdpAccelerateTimers) {
            return origSetInterval(fn, window.__cdpAccelerateDelayMs || 55, ...args);
          }
        }
        return origSetInterval(fn, delay, ...args);
      };
    }

    // Synthetic camera stream
    const camCanvas = document.createElement('canvas');
    camCanvas.width = 64;
    camCanvas.height = 48;
    const camCtx = camCanvas.getContext('2d');
    let tick = 0;
    setInterval(() => {
      tick++;
      camCtx.fillStyle = '#141e28';
      camCtx.fillRect(0, 0, 64, 48);
      if (window.__mockBrushMotion) {
        const offset = (tick * 5) % 14;
        camCtx.fillStyle = '#ffffff';
        camCtx.fillRect(8 + offset, 10, 14, 18);
      }
    }, 65);

    const customMedia = {
      enumerateDevices: async () => [],
      getUserMedia: async () => {
        if (${JSON.stringify(mockCameraMode)} === 'denied') {
          throw new DOMException('Permission denied', 'NotAllowedError');
        }
        const stream = camCanvas.captureStream(15);
        const track = stream.getVideoTracks()[0];
        if (track && typeof track.requestFrame === 'function') {
          setTimeout(() => track.requestFrame(), 30);
        }
        return stream;
      }
    };
    try {
      Object.defineProperty(navigator, 'mediaDevices', { value: customMedia, configurable: true });
    } catch {
      navigator.mediaDevices = customMedia;
    }

    // Controllable speechSynthesis & SpeechSynthesisUtterance mock hooks
    {
      let synthSpeaking = false;
      let synthPending = false;
      let synthPaused = false;
      let manualCompletion = false;
      let activeUtt = null;
      const spokenHistory = [];
      class CdpSpeechSynthesisUtterance {
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
      const completeActiveUtterance = () => {
        const utt = activeUtt;
        activeUtt = null;
        synthSpeaking = false;
        synthPending = false;
        if (utt && !utt._canceled && typeof utt.onend === 'function') {
          utt.onend({ type: 'end' });
        }
      };
      const mockSynth = {
        get speaking() { return synthSpeaking; },
        get pending() { return synthPending; },
        get paused() { return synthPaused; },
        getVoices() { return [{ name: 'Mock US English', lang: 'en-US', default: true, localService: true }]; },
        speak(utt) {
          if (!utt) return;
          activeUtt = utt;
          synthSpeaking = true;
          synthPending = false;
          synthPaused = false;
          utt._canceled = false;
          spokenHistory.push({ text: utt.text, timestamp: Date.now() });
          if (typeof utt.onstart === 'function') utt.onstart({ type: 'start' });
          if (!manualCompletion) {
            setTimeout(() => {
              if (activeUtt === utt && !utt._canceled) {
                completeActiveUtterance();
              }
            }, 20);
          }
        },
        cancel() {
          const prev = activeUtt;
          activeUtt = null;
          synthSpeaking = false;
          synthPending = false;
          synthPaused = false;
          if (prev) {
            prev._canceled = true;
            if (typeof prev.onerror === 'function') prev.onerror({ type: 'error', error: 'canceled' });
          }
        },
        pause() { synthPaused = true; },
        resume() { synthPaused = false; }
      };
      try {
        Object.defineProperty(window, 'speechSynthesis', { value: mockSynth, configurable: true });
        window.SpeechSynthesisUtterance = CdpSpeechSynthesisUtterance;
      } catch {}
      window.__speechMock = {
        get speaking() { return synthSpeaking; },
        get pending() { return synthPending; },
        get paused() { return synthPaused; },
        get spokenHistory() { return spokenHistory; },
        get manualCompletion() { return manualCompletion; },
        set manualCompletion(val) { manualCompletion = Boolean(val); },
        setSpeaking(val) { synthSpeaking = Boolean(val); synthPending = false; },
        completeActiveUtterance,
        dispatchSpeechStart(text = '') {
          synthSpeaking = true;
          window.dispatchEvent(new CustomEvent('companion-speech-start', { detail: { text } }));
        },
        dispatchSpeechEnd(text = '') {
          synthSpeaking = false;
          synthPending = false;
          window.dispatchEvent(new CustomEvent('companion-speech-end', { detail: { text } }));
        },
        reset() {
          manualCompletion = false;
          synthSpeaking = false;
          synthPending = false;
          synthPaused = false;
          activeUtt = null;
          spokenHistory.length = 0;
        }
      };
    }

    // Controllable SpeechRecognition mock or explicit unavailable removal
    window.__mockSpeechRecInstances = [];
    if (${JSON.stringify(mockSpeechApi)}) {
      class CdpSpeechRecognition {
        constructor() {
          this.continuous = false;
          this.interimResults = false;
          this.lang = 'en-US';
          this.started = false;
          this.onstart = null;
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
          window.__mockSpeechRecInstances.push(this);
        }
        start() {
          this.started = true;
          if (typeof this.onstart === 'function') this.onstart({ type: 'start' });
        }
        stop() {
          this.started = false;
          if (typeof this.onend === 'function') this.onend({ type: 'end' });
        }
        abort() { this.stop(); }
        emitTranscript(text, isFinal = true) {
          const alt = [{ transcript: String(text), confidence: 0.96 }];
          const item = Object.assign(alt, { isFinal });
          if (typeof this.onresult === 'function') {
            this.onresult({ type: 'result', resultIndex: 0, results: [item] });
          }
        }
      }
      window.SpeechRecognition = CdpSpeechRecognition;
      window.webkitSpeechRecognition = CdpSpeechRecognition;
      window.__emitVoiceCommand = (text, isFinal = true) => {
        const inst = window.__mockSpeechRecInstances[window.__mockSpeechRecInstances.length - 1];
        if (inst) inst.emitTranscript(text, isFinal);
      };
    } else {
      try { delete window.SpeechRecognition; } catch { window.SpeechRecognition = undefined; }
      try { delete window.webkitSpeechRecognition; } catch { window.webkitSpeechRecognition = undefined; }
    }
  })();`;
}

async function withBrowserPage(chromeBin, debugPort, modeLabel, preloadOpts, fn) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `lh-overhaul-${modeLabel}-`));
  activeTempDirs.add(userDataDir);

  const chromeProc = spawn(chromeBin, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-crash-reporter',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ], { stdio: 'ignore' });
  activeChildren.add(chromeProc);

  const waitProcExit = (timeoutMs = 2500) => new Promise((resolve) => {
    if (chromeProc.exitCode !== null) return resolve(true);
    const t = setTimeout(() => {
      chromeProc.removeListener('exit', onExit);
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(t);
      resolve(true);
    };
    chromeProc.once('exit', onExit);
  });

  let client = null;
  let scenarioErr = null;
  try {
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 12000, chromeProc);
    const targetsRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error(`No CDP page target found for ${modeLabel}`);
    }

    client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    if (preloadOpts) {
      await client.send('Page.addScriptToEvaluateOnNewDocument', {
        source: buildPreloadScript(preloadOpts)
      });
    }

    await fn(client);
  } catch (err) {
    scenarioErr = err;
    throw err;
  } finally {
    if (client) {
      try { await client.send('Browser.close', {}, 2500); } catch {}
      client.close();
    }
    const exitedCleanly = await waitProcExit(2500);
    if (!exitedCleanly) {
      killChildProcess(chromeProc);
      await waitProcExit(1500);
    }
    activeChildren.delete(chromeProc);

    let rmErr = null;
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
    } catch (e) {
      rmErr = e;
    }
    if (fs.existsSync(userDataDir)) {
      const msg = `Failed to remove Chrome userDataDir ${userDataDir}: ${rmErr?.message || 'still exists'}`;
      console.error(`⚠️  ${msg}`);
      if (!scenarioErr) throw new Error(msg);
    } else {
      activeTempDirs.delete(userDataDir);
    }
  }
}

function defaultSeededState(overrides = {}, heroOverrides = {}) {
  const hero = {
    id: 'hero_1',
    name: 'Hero',
    role: 'Adventurer',
    coins: 500,
    tokens: 500,
    points: 40,
    sparks: 150,
    evolutionSparks: 150,
    activePetId: 1,
    petSparkMap: { 1: 150 },
    inventory: ['laser_toothbrush', 'cowl_hero'],
    equippedWeapon: 'laser_toothbrush',
    equippedGear: ['laser_toothbrush'],
    gameDifficulty: 'medium',
    ...heroOverrides
  };
  if (heroOverrides.coins !== undefined && heroOverrides.tokens === undefined) {
    hero.tokens = heroOverrides.coins;
  }
  if (heroOverrides.sparks !== undefined && heroOverrides.petSparkMap === undefined) {
    hero.petSparkMap = { ...(hero.petSparkMap || {}), [hero.activePetId || 1]: heroOverrides.sparks };
  }
  if (heroOverrides.sparks !== undefined && heroOverrides.evolutionSparks === undefined) {
    hero.evolutionSparks = heroOverrides.sparks;
  }
  return {
    isAuthenticated: true,
    isAuthReady: true,
    isHouseholdConfigured: true,
    householdSetupStep: 'ready',
    household: { syncCode: 'HERO8842' },
    activeView: 'ar_battle',
    hygieneReminders: {},
    parentSettings: {
      arBattleDuration: 120,
      motionSensitivity: 'medium',
      voicePromptsEnabled: false
    },
    heroes: [hero],
    selectedHero: { ...hero },
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// 7 Realistic End-User CDP Scenarios
// ---------------------------------------------------------------------------
const scenarios = [
  {
    name: 'Scenario 1: Minty Shield 120s uptime, frosty barrier rendering & battle victory',
    port: 9241,
    run: async (chromeBin, baseUrl) => {
      await withBrowserPage(chromeBin, 9241, 's1-shield', {
        seededState: defaultSeededState(),
        accelerateTimers: true,
        accelerateDelayMs: 85,
        mockCameraMode: 'motion'
      }, async (client) => {
        await client.send('Page.navigate', { url: `${baseUrl}/#/boost` });
        await waitForCondition(
          client,
          `(() => { const c = document.getElementById('battle-webgl-canvas'); return Boolean(c && c.width > 0 && c.height > 0 && document.getElementById('battle-timer-display')); })()`,
          8000,
          'S1 BattleView canvas & timer'
        );
        await assertCanvasPainted(client, 'S1 Minty Shield (pre-loop)');

        const shieldBtnExists = await client.eval(`Boolean(document.getElementById('minty-shield-btn'))`);
        assert.strictEqual(shieldBtnExists, true, 'S1: #minty-shield-btn must be present in live BattleView DOM');

        let shieldActivated = false;
        let canvasAnimationVerified = false;
        let shieldActiveSamples = 0;
        let consecutiveInactiveAfterActivation = 0;
        let maxInactiveStreakAfterActivation = 0;
        let modalOpen = false;
        const loopStart = Date.now();
        while (Date.now() - loopStart < 22000) {
          const iterState = await client.eval(`(() => {
            const c = document.getElementById('battle-webgl-canvas');
            if (c) {
              c.dispatchEvent(new PointerEvent('pointerdown', { clientX: 300, clientY: 280, bubbles: true }));
              c.dispatchEvent(new PointerEvent('pointermove', { clientX: 315, clientY: 285, bubbles: true }));
              c.dispatchEvent(new PointerEvent('pointerup', { clientX: 315, clientY: 285, bubbles: true }));
            }
            const b = document.getElementById('minty-shield-btn');
            let clicked = false;
            if (b && !b.disabled) {
              b.click();
              clicked = true;
            }
            const btnText = b?.innerText || '';
            const isActive = Boolean(
              b && (b.dataset?.active === 'true' || /\bactive\b/i.test(btnText))
            );
            return {
              clicked,
              isActive,
              modalOpen: Boolean(document.getElementById('colosseum-victory-modal'))
            };
          })()`);
          if (iterState.clicked) shieldActivated = true;
          if (iterState.isActive) {
            shieldActiveSamples++;
            consecutiveInactiveAfterActivation = 0;
            if (!canvasAnimationVerified) {
              await assertCanvasAnimatingAndPainted(client, 'S1 Minty Shield');
              canvasAnimationVerified = true;
            }
          } else if (shieldActivated && !iterState.modalOpen) {
            consecutiveInactiveAfterActivation++;
            maxInactiveStreakAfterActivation = Math.max(maxInactiveStreakAfterActivation, consecutiveInactiveAfterActivation);
          }
          modalOpen = iterState.modalOpen;
          if (modalOpen) break;
          await new Promise(r => setTimeout(r, 45));
        }

        if (!canvasAnimationVerified) {
          await assertCanvasAnimatingAndPainted(client, 'S1 Minty Shield');
        }
        assert.strictEqual(shieldActivated, true, 'S1: #minty-shield-btn became enabled and activated Minty Shield');
        assert.ok(shieldActiveSamples >= 5, `S1: Minty Shield must remain continuously active across battle samples (samples=${shieldActiveSamples})`);
        assert.ok(maxInactiveStreakAfterActivation < 3, `S1: Minty Shield dropped unexpectedly after activation (maxInactiveStreak=${maxInactiveStreakAfterActivation})`);
        assert.strictEqual(modalOpen, true, 'S1: #colosseum-victory-modal must open on battle victory');

        const victoryCheck = await client.eval(`(() => {
          const modalText = document.getElementById('colosseum-victory-modal')?.innerText || '';
          const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
          const parsed = raw ? JSON.parse(raw) : {};
          const badges = parsed.selectedHero?.dentalBadges || parsed.dentalBadges || [];
          return { hasMintyMaster: badges.includes('minty_master') || /Minty Master/i.test(modalText) };
        })()`);
        assert.strictEqual(victoryCheck.hasMintyMaster, true, 'S1: 120s Minty Shield uptime must earn minty_master without expiring');
        assertNoNetworkOrRuntimeErrors(client, 'S1');
      });
    }
  },
  {
    name: 'Scenario 2: Minty Fresh Blast clears Sweet Tooth Sprites & Sticky Residue slime',
    port: 9242,
    run: async (chromeBin, baseUrl) => {
      await withBrowserPage(chromeBin, 9242, 's2-blast', {
        seededState: defaultSeededState({ selectedBossId: 'gummy_ghost', hasExplicitBossSelection: true }),
        accelerateTimers: false,
        mockCameraMode: 'motion'
      }, async (client) => {
        await client.send('Page.navigate', { url: `${baseUrl}/#/boost` });
        await waitForCondition(
          client,
          `(() => { const c = document.getElementById('battle-webgl-canvas'); return Boolean(c && c.width > 0 && c.height > 0 && document.getElementById('supernova-hud')); })()`,
          8000,
          'S2 BattleView canvas & supernova HUD'
        );

        await dispatchCircularMouseSweep(client, 340, 260, 75, 14);
        await new Promise(r => setTimeout(r, 250));

        const blastReady = await client.eval(`(() => {
          const hud = document.getElementById('supernova-hud');
          const bar = document.getElementById('supernova-charge-bar');
          const btn = document.getElementById('supernova-blast-btn');
          return { hasBar: Boolean(bar), width: bar?.style?.width || '', hasBtn: Boolean(btn), hudText: hud?.innerText || '' };
        })()`);
        assert.ok(blastReady.hasBar && blastReady.hasBtn, 'S2: Bottom #supernova-charge-bar and #supernova-blast-btn mounted');
        assert.ok(/Minty Fresh Blast/i.test(blastReady.hudText), `S2: Bottom HUD must surface Minty Fresh Blast (got "${blastReady.hudText}")`);

        let blasted = false;
        for (let i = 0; i < 14; i++) {
          await dispatchCircularMouseSweep(client, 340, 260, 75, 8);
          blasted = await client.eval(`(() => {
            const b = document.getElementById('supernova-blast-btn');
            if (b && !b.disabled) { b.click(); return true; }
            return false;
          })()`);
          if (blasted) break;
          await new Promise(r => setTimeout(r, 250));
        }
        assert.strictEqual(blasted, true, 'S2: #supernova-blast-btn charged and triggered Minty Fresh Blast');
        const postBlastWidth = await client.eval(`parseInt(document.getElementById('supernova-charge-bar')?.style?.height || '0', 10)`);
        assert.ok(postBlastWidth < 40, `S2: Minty Fresh Blast must consume charge (postWidth=${postBlastWidth}%)`);
        await assertCanvasAnimatingAndPainted(client, 'S2 Foam Blast');
        assertNoNetworkOrRuntimeErrors(client, 'S2');
      });
    }
  },
  {
    name: 'Scenario 3: Voice commands "Blast!" & "Shield Up!" + echo gating + unavailable fallback',
    port: 9243,
    run: async (chromeBin, baseUrl) => {
      // Part A: SpeechRecognition enabled + echo gating + post-cooldown execution
      await withBrowserPage(chromeBin, 9243, 's3-voice', {
        seededState: defaultSeededState(),
        accelerateTimers: false,
        mockSpeechApi: true,
        mockCameraMode: 'motion'
      }, async (client) => {
        await client.send('Page.navigate', { url: `${baseUrl}/#/boost` });
        await waitForCondition(
          client,
          `(() => { const c = document.getElementById('battle-webgl-canvas'); return Boolean(c && c.width > 0 && c.height > 0 && window.__mockSpeechRecInstances?.length > 0); })()`,
          8000,
          'S3A BattleView & SpeechRecognition init'
        );

        const recProps = await client.eval(`(() => {
          const inst = window.__mockSpeechRecInstances?.[window.__mockSpeechRecInstances.length - 1];
          return inst ? { continuous: inst.continuous, interimResults: inst.interimResults, started: inst.started } : null;
        })()`);
        assert.ok(recProps, 'S3A: Battle SpeechRecognition instance created');
        assert.strictEqual(recProps.continuous, true, 'S3A: continuous must be true');
        assert.strictEqual(recProps.interimResults, true, 'S3A: interimResults must be true');

        // Charge up both Blast (>= 40%) and Minty Shield (!disabled) via sweeps
        let chargedReady = false;
        for (let i = 0; i < 12; i++) {
          await dispatchCircularMouseSweep(client, 320, 260, 70, 8);
          chargedReady = await client.eval(`(() => {
            const pct = parseInt(document.getElementById('supernova-charge-bar')?.style?.height || '0', 10);
            const sb = document.getElementById('minty-shield-btn');
            const bb = document.getElementById('supernova-blast-btn');
            return pct >= 40 && Boolean(sb && !sb.disabled) && Boolean(bb && !bb.disabled);
          })()`);
          if (chargedReady) break;
          await new Promise(r => setTimeout(r, 250));
        }
        assert.strictEqual(chargedReady, true, 'S3A: #supernova-charge-bar >= 40% and #minty-shield-btn enabled before voice commands');

        // Echo gate during companion-speech-start AND window.__speechMock.setSpeaking(true)
        await client.eval(`(() => {
          window.dispatchEvent(new CustomEvent('companion-speech-start', { detail: { text: 'Blast!' } }));
          window.__emitVoiceCommand('Blast!', true);
        })()`);
        const chargeGatedPct = await client.eval(`parseInt(document.getElementById('supernova-charge-bar')?.style?.height || '0', 10)`);
        assert.ok(chargeGatedPct >= 40, `S3A: Echo-gated "Blast!" must NOT consume charge while companion speaks (got ${chargeGatedPct}%)`);

        // Wait past 350ms post-TTS tail, verify speechSynthesis.speaking === true also gates, then issue real voice commands
        await client.eval(`window.dispatchEvent(new CustomEvent('companion-speech-end', { detail: { text: 'Blast!' } }))`);
        await new Promise(r => setTimeout(r, 420));

        await client.eval(`(() => {
          window.__speechMock.setSpeaking(true);
          window.__emitVoiceCommand('Blast!', true);
        })()`);
        const chargeGatedBySynthPct = await client.eval(`parseInt(document.getElementById('supernova-charge-bar')?.style?.height || '0', 10)`);
        assert.ok(chargeGatedBySynthPct >= 40, `S3A: speechSynthesis.speaking=true must gate "Blast!" (got ${chargeGatedBySynthPct}%)`);
        await client.eval(`window.__speechMock.setSpeaking(false)`);

        const shieldSnapshotBefore = await client.eval(`(() => {
          const sb = document.getElementById('minty-shield-btn');
          const comicEl = document.getElementById('comic-hit-badge');
          return {
            text: sb?.innerText || '',
            disabled: Boolean(sb?.disabled),
            activeAttr: sb?.dataset?.active || '',
            comicText: comicEl?.innerText || '',
            comicOpacity: comicEl ? getComputedStyle(comicEl).opacity : '0'
          };
        })()`);

        await client.eval(`window.__emitVoiceCommand('Shield Up!', true)`);
        await new Promise(r => setTimeout(r, 120));
        const shieldSnapshotAfter = await client.eval(`(() => {
          const sb = document.getElementById('minty-shield-btn');
          const comicEl = document.getElementById('comic-hit-badge');
          return {
            text: sb?.innerText || '',
            disabled: Boolean(sb?.disabled),
            activeAttr: sb?.dataset?.active || '',
            className: sb?.className || '',
            comicText: comicEl?.innerText || '',
            comicOpacity: comicEl ? getComputedStyle(comicEl).opacity : '0'
          };
        })()`);
        const freshComicShield = (
          shieldSnapshotAfter.comicText !== shieldSnapshotBefore.comicText &&
          shieldSnapshotAfter.comicOpacity !== '0' &&
          /active|shield/i.test(shieldSnapshotAfter.comicText)
        );
        const shieldChanged = (
          shieldSnapshotAfter.text !== shieldSnapshotBefore.text ||
          shieldSnapshotAfter.activeAttr === 'true' ||
          freshComicShield ||
          /\bactive\b|\d+(?:\.\d+)?s/i.test(shieldSnapshotAfter.text)
        );
        assert.strictEqual(shieldChanged, true, `S3A: Post-cooldown "Shield Up!" must activate Minty Shield (before=${JSON.stringify(shieldSnapshotBefore)}, after=${JSON.stringify(shieldSnapshotAfter)})`);

        await client.eval(`window.__emitVoiceCommand('Blast!', true)`);
        await new Promise(r => setTimeout(r, 150));
        const blastPostCheck = await client.eval(`(() => ({
          pct: parseInt(document.getElementById('supernova-charge-bar')?.style?.height || '0', 10),
          btnDisabled: Boolean(document.getElementById('supernova-blast-btn')?.disabled)
        }))()`);
        assert.ok(blastPostCheck.pct < 40 && blastPostCheck.btnDisabled, `S3A: Post-cooldown "Blast!" must trigger Foam Blast and consume charge (got ${JSON.stringify(blastPostCheck)})`);
        assertNoNetworkOrRuntimeErrors(client, 'S3A');
      });

      // Part B: SpeechRecognition & mic unavailable -> silent fallback
      await withBrowserPage(chromeBin, 9244, 's3-fallback', {
        seededState: defaultSeededState(),
        accelerateTimers: false,
        mockSpeechApi: false,
        mockCameraMode: 'denied'
      }, async (client) => {
        await client.send('Page.navigate', { url: `${baseUrl}/#/boost` });
        await waitForCondition(
          client,
          `Boolean(document.getElementById('battle-webgl-canvas') && document.getElementById('supernova-blast-btn'))`,
          8000,
          'S3B fallback BattleView DOM'
        );
        const hasFallbackControls = await client.eval(`Boolean(document.getElementById('minty-shield-btn') && document.getElementById('supernova-blast-btn'))`);
        assert.strictEqual(hasFallbackControls, true, 'S3B: On-screen Minty Shield & Blast fallback controls mounted when Speech & camera unavailable');
        assertNoNetworkOrRuntimeErrors(client, 'S3B');
      });
    }
  },
  {
    name: 'Scenario 4: Tartar Tyrant shell shatter, Speed Scrub 2x/3x & Cleanse Album persistence',
    port: 9245,
    run: async (chromeBin, baseUrl) => {
      await withBrowserPage(chromeBin, 9245, 's4-tyrant', {
        seededState: defaultSeededState({ selectedBossId: 'tartar_tyrant', hasExplicitBossSelection: true }),
        accelerateTimers: true,
        accelerateDelayMs: 60,
        mockCameraMode: 'motion'
      }, async (client) => {
        await client.send('Page.navigate', { url: `${baseUrl}/#/boost` });
        await waitForCondition(
          client,
          `(() => { const c = document.getElementById('battle-webgl-canvas'); return Boolean(c && c.width > 0 && c.height > 0 && document.getElementById('battle-boss-name-hud')); })()`,
          8000,
          'S4 Tartar Tyrant BattleView'
        );

        const hudName = await client.eval(`document.getElementById('battle-boss-name-hud')?.textContent || ''`);
        assert.ok(/Tartar Tyrant/i.test(hudName), `S4: HUD must display Tartar Tyrant (got "${hudName}")`);

        // Rapid circular scrubbing to shatter shell quickly for 2x/3x Speed Scrub
        for (let i = 0; i < 6; i++) {
          await dispatchCircularMouseSweep(client, 340, 260, 75, 10);
        }
        await assertCanvasAnimatingAndPainted(client, 'S4 Tartar Tyrant');

        // Wait for victory modal while keeping battle clean
        const victoryOpened = await waitForCondition(
          client,
          `Boolean(document.getElementById('colosseum-victory-modal'))`,
          12000,
          'S4 #colosseum-victory-modal'
        );
        assert.strictEqual(Boolean(victoryOpened), true, 'S4: Tartar Tyrant battle must reach #colosseum-victory-modal');

        const tyrantCheck = await client.eval(`(() => {
          const modalText = document.getElementById('colosseum-victory-modal')?.innerText || '';
          const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
          const parsed = raw ? JSON.parse(raw) : {};
          const albumEntry = parsed.selectedHero?.cleanseAlbum?.tartar_tyrant || parsed.heroes?.[0]?.cleanseAlbum?.tartar_tyrant || null;
          const badges = parsed.selectedHero?.dentalBadges || parsed.dentalBadges || [];
          return { modalText, albumEntry, hasShellShatter: badges.includes('shell_shatter') };
        })()`);
        assert.ok(tyrantCheck.albumEntry && tyrantCheck.albumEntry.cleansedCount >= 1, `S4: Cleanse Album must record tartar_tyrant victory (${JSON.stringify(tyrantCheck.albumEntry)})`);
        assert.ok(
          (tyrantCheck.albumEntry.bestSpeedScrubMultiplier || 1) >= 2 && (tyrantCheck.albumEntry.bestSpeedScrubMs || 0) > 0,
          `S4: Speed Scrub 2x/3x and bestSpeedScrubMs > 0 must record on rapid shatter (${JSON.stringify(tyrantCheck.albumEntry)})`
        );
        assert.strictEqual(tyrantCheck.hasShellShatter, true, 'S4: shell_shatter badge must unlock on pre-recharge shatter');

        // Persist Cleanse Album to Hero HQ across root reload (avoiding /#/boost auto-relaunch)
        await client.eval(`(() => {
          const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
          if (raw) {
            const parsed = JSON.parse(raw);
            parsed.activeView = 'hero_hq';
            localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(parsed));
          }
        })()`);
        await client.send('Page.navigate', { url: `${baseUrl}/` });
        await waitForCondition(
          client,
          `Boolean(document.getElementById('hq-stage-wrapper') || document.getElementById('hq-view-all-trophies-btn'))`,
          8000,
          'S4 post-reload Hero HQ hydration'
        );
        const persistedEntry = await client.eval(`(() => {
          const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
          const parsed = raw ? JSON.parse(raw) : {};
          return {
            albumEntry: parsed.selectedHero?.cleanseAlbum?.tartar_tyrant || parsed.heroes?.[0]?.cleanseAlbum?.tartar_tyrant || null,
            hqText: document.body.innerText || ''
          };
        })()`);
        assert.ok(persistedEntry.albumEntry && persistedEntry.albumEntry.cleansedCount >= 1, 'S4: Cleanse Album tartar_tyrant record must persist across navigation/reload');
        assert.ok(/Tartar Tyrant|Polished Pearl Paladin/i.test(persistedEntry.hqText), 'S4: Hero HQ Cleanse Album DOM renders Tartar Tyrant / Polished Pearl Paladin after reload');
        assertNoNetworkOrRuntimeErrors(client, 'S4');
      });
    }
  },
  {
    name: 'Scenario 5: Shop Minty Shield upgrade purchase & extended duration in Battle',
    port: 9246,
    run: async (chromeBin, baseUrl) => {
      await withBrowserPage(chromeBin, 9246, 's5-shop', {
        seededState: defaultSeededState({ activeView: 'dashboard' }, { coins: 600, tokens: 600, sparks: 150 }),
        accelerateTimers: false,
        mockCameraMode: 'motion'
      }, async (client) => {
        await client.send('Page.navigate', { url: `${baseUrl}/` });
        await waitForCondition(
          client,
          `Boolean(document.getElementById('dash-to-hero-hq-btn') && document.querySelector('.nav-tab-btn[data-nav-id="shop"]'))`,
          8000,
          'S5 Dashboard mount'
        );

        await client.eval(`document.querySelector('.nav-tab-btn[data-nav-id="shop"]')?.click()`);
        await waitForCondition(
          client,
          `Boolean(document.querySelector('.buy-gear-btn'))`,
          8000,
          'S5 Shop view render'
        );

        const beforeBalances = await client.eval(`(() => {
          const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
          const p = raw ? JSON.parse(raw) : {};
          const hero = p.selectedHero || {};
          const petId = hero.activePetId || 1;
          return {
            coins: hero.coins ?? 0,
            sparks: hero.petSparkMap?.[petId] ?? hero.sparks ?? 0
          };
        })()`);
        assert.strictEqual(beforeBalances.coins, 600, 'S5: Seeded hero coins must start at 600');

        const shopInfo = await client.eval(`(() => {
          const text = document.body.innerText || '';
          const buyBtns = [...document.querySelectorAll('.buy-gear-btn')];
          const shieldBtn = buyBtns.find(b => {
            const id = b.dataset.buyGearId || '';
            const cardText = b.closest('.gear-card-item')?.innerText || '';
            return /shield|minty_frost|cryo_mint|glacier/i.test(id) || /Minty Shield/i.test(cardText);
          });
          const cardText = shieldBtn?.closest('.gear-card-item')?.innerText || '';
          const hasSparksCost = /spark/i.test(cardText) || Number(shieldBtn?.dataset?.costSparks || 0) > 0;
          if (shieldBtn) shieldBtn.click();
          return {
            hasMintyShieldText: /Minty Shield/i.test(text),
            clickedId: shieldBtn?.dataset?.buyGearId || null,
            hasSparksCost
          };
        })()`);
        assert.strictEqual(shopInfo.hasMintyShieldText, true, 'S5: Shop must render Minty Shield upgrades');
        assert.ok(shopInfo.clickedId, 'S5: Shop must have purchasable Minty Shield upgrade button');

        await waitForCondition(
          client,
          `(() => {
            const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
            const p = raw ? JSON.parse(raw) : {};
            return (p.selectedHero?.inventory || []).includes(${JSON.stringify(shopInfo.clickedId)});
          })()`,
          5000,
          'S5 Shop upgrade inventory persistence'
        );
        const afterPurchase = await client.eval(`(() => {
          const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
          const p = raw ? JSON.parse(raw) : {};
          const hero = p.selectedHero || {};
          const petId = hero.activePetId || 1;
          return {
            coins: hero.coins ?? 0,
            sparks: hero.petSparkMap?.[petId] ?? hero.sparks ?? 0,
            inventory: hero.inventory || []
          };
        })()`);
        assert.ok(afterPurchase.coins < beforeBalances.coins, `S5: Shop purchase must deduct coins (${beforeBalances.coins} -> ${afterPurchase.coins})`);
        if (shopInfo.hasSparksCost) {
          assert.ok(afterPurchase.sparks < beforeBalances.sparks, `S5: Shop purchase must deduct Pet Sparks (${beforeBalances.sparks} -> ${afterPurchase.sparks})`);
        }
        assert.ok(afterPurchase.inventory.includes(shopInfo.clickedId), `S5: Purchased upgrade ${shopInfo.clickedId} must be in hero inventory`);

        // Navigate back to Dashboard and launch Battle via habit launcher
        await client.eval(`document.querySelector('.nav-tab-btn[data-nav-id="dashboard"]')?.click()`);
        await waitForCondition(
          client,
          `Boolean(document.querySelector('.habit-ar-launch-btn, .task-ar-launch-btn'))`,
          8000,
          'S5 Dashboard habit launcher'
        );
        await client.eval(`document.querySelector('.habit-ar-launch-btn, .task-ar-launch-btn')?.click()`);
        await waitForCondition(
          client,
          `(() => { const c = document.getElementById('battle-webgl-canvas'); return Boolean(c && c.width > 0 && c.height > 0); })()`,
          8000,
          'S5 BattleView launch'
        );
        const hasMintyShieldBtn = await client.eval(`Boolean(document.getElementById('minty-shield-btn'))`);
        assert.ok(hasMintyShieldBtn, 'S5: #minty-shield-btn must be present in live BattleView');

        // Charge and activate Minty Shield, then verify extended duration (> 5s)
        let activatedBtnText = '';
        for (let i = 0; i < 10; i++) {
          await dispatchCircularMouseSweep(client, 320, 260, 70, 8);
          const res = await client.eval(`(() => {
            const b = document.getElementById('minty-shield-btn');
            if (b && !b.disabled) {
              b.click();
              return { clicked: true, text: b.innerText || '' };
            }
            return { clicked: false, text: b?.innerText || '' };
          })()`);
          if (res.clicked) {
            await new Promise(r => setTimeout(r, 120));
            activatedBtnText = await client.eval(`document.getElementById('minty-shield-btn')?.innerText || document.body.innerText || ''`);
            break;
          }
          await new Promise(r => setTimeout(r, 250));
        }
        assert.ok(activatedBtnText.length > 0, 'S5: Minty Shield must charge and activate in Battle after Shop purchase');
        const secMatch = activatedBtnText.match(/(\d+(?:\.\d+)?)\s*s\b/i);
        if (secMatch) {
          assert.ok(Number(secMatch[1]) > 5, `S5: Extended Minty Shield duration must be > 5s (got ${secMatch[1]}s)`);
        } else {
          // Verify shield remains active past 5.4s (base 5s would have expired)
          await new Promise(r => setTimeout(r, 5400));
          const stillActiveText = await client.eval(`document.getElementById('minty-shield-btn')?.innerText || ''`);
          assert.ok(/active|\ds/i.test(stillActiveText), `S5: Upgraded Minty Shield must remain active past base 5s (got "${stillActiveText}")`);
        }
        assertNoNetworkOrRuntimeErrors(client, 'S5');
      });
    }
  },
  {
    name: 'Scenario 6: Hero HQ Badges, Trophy Showcase, Cleanse Album Rematch & Dashboard Streaks/Challenges',
    port: 9247,
    run: async (chromeBin, baseUrl) => {
      const seeded = defaultSeededState({
        activeView: 'dashboard',
        dentalBadges: ['enamel_guardian', 'shell_shatter', 'minty_master', 'plaque_whisperer', 'perfect_synergy'],
        hygieneBattle: { bossesDefeated: ['tartar_tyrant', 'sugar_bandit'], colosseumBossesDefeated: ['tartar_tyrant', 'sugar_bandit'], flawlessZones: 3 }
      });
      seeded.heroes[0].dentalBadges = seeded.dentalBadges;
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      seeded.heroes[0].brushStreakData = { count: 14, lastDate: todayKey };
      seeded.heroes[0].cleanseAlbum = {
        tartar_tyrant: { cleansedCount: 2, bestSpeedScrubMs: 2800, bestSpeedScrubMultiplier: 3, bestCadence: 92, flawlessCount: 1 }
      };
      seeded.selectedHero = { ...seeded.heroes[0] };

      await withBrowserPage(chromeBin, 9247, 's6-hq', {
        seededState: seeded,
        accelerateTimers: false,
        mockCameraMode: 'motion'
      }, async (client) => {
        await client.send('Page.navigate', { url: `${baseUrl}/` });
        await waitForCondition(
          client,
          `Boolean(document.getElementById('dash-to-hero-hq-btn'))`,
          8000,
          'S6 Dashboard #dash-to-hero-hq-btn'
        );

        const dashCheck = await client.eval(`(() => ({
          text: document.body.innerText || '',
          hasHqBtn: Boolean(document.getElementById('dash-to-hero-hq-btn'))
        }))()`);
        assert.strictEqual(dashCheck.hasHqBtn, true, 'S6: #dash-to-hero-hq-btn must exist on Dashboard');
        assert.ok(/streak/i.test(dashCheck.text) && dashCheck.text.includes('14'), 'S6: Dashboard displays daily brush streak (14)');
        assert.ok(/weekly challenge/i.test(dashCheck.text), 'S6: Dashboard displays Weekly Challenge summary');

        // Navigate to Hero HQ via UI button
        await client.eval(`document.getElementById('dash-to-hero-hq-btn')?.click()`);
        await waitForCondition(
          client,
          `Boolean(document.getElementById('hq-stage-wrapper') || document.getElementById('hq-view-all-trophies-btn'))`,
          8000,
          'S6 Hero HQ mount'
        );

        const hqCheck = await client.eval(`(() => {
          const text = document.body.innerText || '';
          const findTartarRematch = () => {
            const byAttr = document.querySelector('[data-rematch-boss-id="tartar_tyrant"]');
            if (byAttr) return byAttr;
            const btns = [...document.querySelectorAll('button')];
            return btns.find(b => {
              const isRematch = /rematch/i.test(b.innerText || '') || /rematch/i.test(b.className || '');
              if (!isRematch) return false;
              if (b.dataset?.bossId === 'tartar_tyrant' || b.dataset?.rematchId === 'tartar_tyrant') return true;
              const card = b.closest('div, li, article, section');
              const cardText = card?.innerText || '';
              return /Tartar Tyrant|Polished Pearl Paladin/i.test(cardText);
            }) || null;
          };
          return {
            hasAlbum: /Cleansed Villains|Cleanse Album/i.test(text),
            hasShellShatter: /Shell Shatter/i.test(text),
            hasRematch: Boolean(findTartarRematch())
          };
        })()`);
        assert.strictEqual(hqCheck.hasAlbum, true, 'S6: Hero HQ displays Cleansed Villains / Cleanse Album');
        assert.strictEqual(hqCheck.hasShellShatter, true, 'S6: Hero HQ displays unlocked Shell Shatter badge');
        assert.strictEqual(hqCheck.hasRematch, true, 'S6: Hero HQ Cleanse Album exposes Boss Rematch button for tartar_tyrant');

        // Verify Hero HQ Trophy Showcase displays Tartar Tyrant & Flawless trophies
        const trophyShowcase = await client.eval(`(() => {
          const viewAllBtn = document.getElementById('hq-view-all-trophies-btn');
          if (viewAllBtn) viewAllBtn.click();
          const modalText = document.body.innerText || '';
          const hasTartarTrophy = /Tartar Tyrant|Pearl Crown|Flawless/i.test(modalText);
          document.getElementById('hq-close-all-trophies-btn')?.click();
          return { hadButton: Boolean(viewAllBtn), hasTartarTrophy };
        })()`);
        assert.strictEqual(trophyShowcase.hadButton, true, 'S6: #hq-view-all-trophies-btn must exist in Hero HQ Trophy Showcase');
        assert.strictEqual(trophyShowcase.hasTartarTrophy, true, 'S6: Trophy Showcase must display Tartar Tyrant / Flawless trophies');

        const clickedRematch = await client.eval(`(() => {
          const byAttr = document.querySelector('[data-rematch-boss-id="tartar_tyrant"]');
          if (byAttr) { byAttr.click(); return true; }
          const btns = [...document.querySelectorAll('button')];
          const match = btns.find(b => {
            const isRematch = /rematch/i.test(b.innerText || '') || /rematch/i.test(b.className || '');
            if (!isRematch) return false;
            if (b.dataset?.bossId === 'tartar_tyrant' || b.dataset?.rematchId === 'tartar_tyrant') return true;
            const card = b.closest('div, li, article, section');
            return /Tartar Tyrant|Polished Pearl Paladin/i.test(card?.innerText || '');
          });
          if (match) { match.click(); return true; }
          return false;
        })()`);
        assert.strictEqual(clickedRematch, true, 'S6: Scoped tartar_tyrant rematch button clicked');

        await waitForCondition(
          client,
          `Boolean(document.getElementById('battle-webgl-canvas') && document.getElementById('battle-boss-name-hud'))`,
          8000,
          'S6 Rematch BattleView mount'
        );
        const rematchBoss = await client.eval(`document.getElementById('battle-boss-name-hud')?.textContent || ''`);
        assert.ok(/Tartar Tyrant/i.test(rematchBoss), `S6: Boss Rematch launched battle against Tartar Tyrant (got "${rematchBoss}")`);
        assertNoNetworkOrRuntimeErrors(client, 'S6');
      });
    }
  },
  {
    name: 'Scenario 7: All 8 Bosses & 13 Hazards 2D Assets (0 404s on / & /Little-Heroes-G/), Canvas Pixels & PWA Parity',
    port: 9248,
    run: async (chromeBin, baseUrl) => {
      // 1. PWA parity check
      const indexHtml = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
      const swJs = fs.readFileSync(path.join(REPO_ROOT, 'public/sw.js'), 'utf8');
      const appVer = indexHtml.match(/const\s+APP_BUILD_VERSION\s*=\s*['"](v\d+\.\d+\.\d+-[\w-]+)['"]/)?.[1];
      const swVer = swJs.match(/const\s+CACHE_NAME\s*=\s*['"]little-heroes-(v\d+\.\d+\.\d+-[\w-]+)['"]/)?.[1];
      assert.ok(appVer && swVer && appVer === swVer, `S7: PWA parity mismatch (${appVer} vs ${swVer})`);

      // 2. Collect all 8 boss + 13 hazard asset paths from source data
      const { HYGIENE_BOSSES, SUGAR_ATTACK_HAZARDS } = await import('../src/data/hygieneBossesData.js');
      assert.strictEqual(HYGIENE_BOSSES.length, 8, 'S7: HYGIENE_BOSSES must have 8 bosses');
      assert.strictEqual(SUGAR_ATTACK_HAZARDS.length, 13, 'S7: SUGAR_ATTACK_HAZARDS must have 13 hazards');
      const assetRelPaths = [
        ...HYGIENE_BOSSES.flatMap(b => [b.image, b.cleansedImage]),
        ...SUGAR_ATTACK_HAZARDS.map(h => h.image)
      ];

      // 3. Verify root "/" asset loads, app-rendered <img> tags, + live canvas pixels
      await withBrowserPage(chromeBin, 9248, 's7-root', {
        seededState: defaultSeededState(),
        accelerateTimers: false,
        mockCameraMode: 'motion'
      }, async (client) => {
        await client.send('Page.navigate', { url: `${baseUrl}/#/boost` });
        await waitForCondition(
          client,
          `(() => { const c = document.getElementById('battle-webgl-canvas'); return Boolean(c && c.width > 0 && c.height > 0); })()`,
          8000,
          'S7 Root BattleView canvas'
        );
        await assertCanvasAnimatingAndPainted(client, 'S7 Root Canvas');

        const loadedCount = await client.eval(`(async (paths) => {
          const results = await Promise.all(paths.map(p => new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ p, ok: img.naturalWidth > 0 });
            img.onerror = () => resolve({ p, ok: false });
            img.src = p;
          })));
          return results.filter(r => !r.ok);
        })(${JSON.stringify(assetRelPaths)})`);
        assert.deepStrictEqual(loadedCount, [], `S7 Root: Broken boss/hazard images: ${JSON.stringify(loadedCount)}`);

        // Verify app-rendered <img> elements in Hero HQ Cleanse Album resolve cleanly under root "/"
        await client.eval(`(() => {
          const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
          const s = raw ? JSON.parse(raw) : {};
          s.activeView = 'hero_hq';
          if (s.selectedHero) {
            s.selectedHero.cleanseAlbum = { tartar_tyrant: { cleansedCount: 1, bestSpeedScrubMs: 3000, bestSpeedScrubMultiplier: 3 } };
          }
          localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(s));
        })()`);
        await client.send('Page.navigate', { url: `${baseUrl}/` });
        await waitForCondition(
          client,
          `Boolean(document.getElementById('hq-stage-wrapper') || document.getElementById('hq-view-all-trophies-btn'))`,
          8000,
          'S7 Root Hero HQ mount'
        );
        await waitForCondition(
          client,
          `(() => {
            const imgs = [...document.querySelectorAll('img')].filter(img => {
              const src = img.getAttribute('src') || '';
              return src && !src.startsWith('data:') && (!/^https?:\\/\\//i.test(src) || src.startsWith('http://127.0.0.1'));
            });
            return imgs.length > 0 && imgs.every(i => i.complete);
          })()`,
          5000,
          'S7 Root Hero HQ images loaded'
        );
        const brokenRootImgs = await client.eval(`(() => {
          return [...document.querySelectorAll('img')]
            .filter(img => {
              const src = img.getAttribute('src') || '';
              if (!src || src.startsWith('data:')) return false;
              if (/^https?:\\/\\//i.test(src) && !src.startsWith('http://127.0.0.1')) return false;
              return !(img.complete && img.naturalWidth > 0);
            })
            .map(img => img.getAttribute('src'));
        })()`);
        assert.deepStrictEqual(brokenRootImgs, [], `S7 Root: Broken app-rendered <img> tags: ${JSON.stringify(brokenRootImgs)}`);
        assertNoNetworkOrRuntimeErrors(client, 'S7 Root');
      });

      // 4. Isolated subpath build & preview for "/Little-Heroes-G/" (never mutates workspace dist/)
      const tmpSubpathDist = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-subpath-dist-'));
      activeTempDirs.add(tmpSubpathDist);
      let subpathPreview = null;
      try {
        const buildRes = spawnSync(
          process.execPath,
          ['./node_modules/vite/bin/vite.js', 'build', '--outDir', tmpSubpathDist],
          { cwd: REPO_ROOT, env: { ...process.env, VITE_BASE_PATH: '/Little-Heroes-G/' }, stdio: 'pipe', timeout: 240000 }
        );
        assert.strictEqual(buildRes.status, 0, `S7 Subpath build failed: ${buildRes.stderr?.toString() || ''}`);

        subpathPreview = spawn(
          process.execPath,
          ['./node_modules/vite/bin/vite.js', 'preview', '--outDir', tmpSubpathDist, '--base', '/Little-Heroes-G/', '--host', '127.0.0.1', '--port', '4180', '--strictPort'],
          { cwd: REPO_ROOT, env: { ...process.env, VITE_BASE_PATH: '/Little-Heroes-G/' }, stdio: 'ignore' }
        );
        activeChildren.add(subpathPreview);
        await waitForHttp('http://127.0.0.1:4180/Little-Heroes-G/', 15000, subpathPreview);

        await withBrowserPage(chromeBin, 9249, 's7-subpath', {
          seededState: defaultSeededState(),
          accelerateTimers: false,
          mockCameraMode: 'motion'
        }, async (client) => {
          await client.send('Page.navigate', { url: 'http://127.0.0.1:4180/Little-Heroes-G/#/boost' });
          await waitForCondition(
            client,
            `(() => { const c = document.getElementById('battle-webgl-canvas'); return Boolean(c && c.width > 0 && c.height > 0); })()`,
            8000,
            'S7 Subpath BattleView canvas'
          );
          await assertCanvasAnimatingAndPainted(client, 'S7 Subpath Canvas');

          const prefixedPaths = assetRelPaths.map(p => `/Little-Heroes-G/${p.replace(/^\.?\//, '')}`);
          const brokenSubpath = await client.eval(`(async (paths) => {
            const results = await Promise.all(paths.map(p => new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve({ p, ok: img.naturalWidth > 0 });
              img.onerror = () => resolve({ p, ok: false });
              img.src = p;
            })));
            return results.filter(r => !r.ok);
          })(${JSON.stringify(prefixedPaths)})`);
          assert.deepStrictEqual(brokenSubpath, [], `S7 Subpath: Broken boss/hazard images: ${JSON.stringify(brokenSubpath)}`);

          // Also verify app-rendered <img> elements in Hero HQ Cleanse Album resolve cleanly under /Little-Heroes-G/
          await client.eval(`(() => {
            const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
            const s = raw ? JSON.parse(raw) : {};
            s.activeView = 'hero_hq';
            if (s.selectedHero) {
              s.selectedHero.cleanseAlbum = { tartar_tyrant: { cleansedCount: 1, bestSpeedScrubMs: 3000, bestSpeedScrubMultiplier: 3 } };
            }
            localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(s));
          })()`);
          await client.send('Page.navigate', { url: 'http://127.0.0.1:4180/Little-Heroes-G/' });
          await waitForCondition(
            client,
            `Boolean(document.getElementById('hq-stage-wrapper') || document.getElementById('hq-view-all-trophies-btn'))`,
            8000,
            'S7 Subpath Hero HQ mount'
          );
          await waitForCondition(
            client,
            `(() => {
              const imgs = [...document.querySelectorAll('img')].filter(img => {
                const src = img.getAttribute('src') || '';
                return src && !src.startsWith('data:') && (!/^https?:\\/\\//i.test(src) || src.startsWith('http://127.0.0.1'));
              });
              return imgs.length > 0 && imgs.every(i => i.complete);
            })()`,
            5000,
            'S7 Subpath Hero HQ images loaded'
          );
          const brokenRenderedImgs = await client.eval(`(() => {
            return [...document.querySelectorAll('img')]
              .filter(img => {
                const src = img.getAttribute('src') || '';
                if (!src || src.startsWith('data:')) return false;
                if (/^https?:\\/\\//i.test(src) && !src.startsWith('http://127.0.0.1')) return false;
                return !(img.complete && img.naturalWidth > 0);
              })
              .map(img => img.getAttribute('src'));
          })()`);
          assert.deepStrictEqual(brokenRenderedImgs, [], `S7 Subpath: Broken app-rendered <img> tags: ${JSON.stringify(brokenRenderedImgs)}`);
          assertNoNetworkOrRuntimeErrors(client, 'S7 Subpath');
        });
      } finally {
        if (subpathPreview) {
          killChildProcess(subpathPreview);
          await new Promise((resolve) => {
            if (subpathPreview.exitCode !== null) return resolve(true);
            const t = setTimeout(() => {
              subpathPreview.removeListener('exit', onExit);
              resolve(false);
            }, 2500);
            const onExit = () => {
              clearTimeout(t);
              resolve(true);
            };
            subpathPreview.once('exit', onExit);
          });
          activeChildren.delete(subpathPreview);
        }
        try {
          fs.rmSync(tmpSubpathDist, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
        } catch (err) {
          console.warn(`⚠️  Failed to remove subpath temp dist ${tmpSubpathDist}: ${err?.message || err}`);
        }
        if (fs.existsSync(tmpSubpathDist)) {
          console.warn(`⚠️  Subpath temp dist still exists after cleanup: ${tmpSubpathDist}`);
        } else {
          activeTempDirs.delete(tmpSubpathDist);
        }
      }
    }
  }
];

async function main() {
  console.log('\n🌐 === Tier 4 (Layer B): Headless Chrome CDP E2E Suite (7 Scenarios) ===\n');
  const chromeBin = findChromeBinary();
  if (!chromeBin) {
    if (process.env.REQUIRE_CDP === 'true') {
      console.error('❌ Chrome/Edge binary not found and REQUIRE_CDP=true');
      process.exit(1);
    }
    console.log('⏭️  Skipping Tier 4 CDP suite (no Chrome/Edge binary found in this environment).');
    process.exit(0);
  }

  if (!fs.existsSync(path.join(REPO_ROOT, 'dist', 'index.html'))) {
    console.error('❌ dist/index.html not found. Run npm run build first.');
    process.exit(1);
  }

  const vitePreview = spawn(
    process.execPath,
    ['./node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4179', '--strictPort'],
    { cwd: REPO_ROOT, stdio: 'ignore' }
  );
  activeChildren.add(vitePreview);

  let passed = 0;
  let failed = 0;
  try {
    const baseUrl = 'http://127.0.0.1:4179';
    await waitForHttp(baseUrl, 15000, vitePreview);

    for (const sc of scenarios) {
      try {
        await sc.run(chromeBin, baseUrl);
        passed++;
        console.log(`  ✅ PASS: ${sc.name}`);
      } catch (err) {
        failed++;
        console.error(`  ❌ FAIL: ${sc.name} -> ${err?.message || err}`);
      }
    }
  } finally {
    killChildProcess(vitePreview);
    activeChildren.delete(vitePreview);
  }

  console.log(`\n📊 Tier 4 CDP Summary: ${passed} passed, ${failed} failed (total ${scenarios.length})`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  cleanupAllOnSignal();
  console.error('❌ Tier 4 CDP Runner Fatal Error:', err);
  process.exit(1);
});
