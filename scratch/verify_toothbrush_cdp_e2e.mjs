import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

function findChromeBinary() {
  for (const p of CHROME_CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return null;
}

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
    });
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
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
    try { this.ws.close(); } catch {}
  }
}

async function assertCanvasAnimating(client, label) {
  const { w, h, frame1 } = await client.eval(`(() => {
    const c = document.getElementById('battle-webgl-canvas');
    return { w: c?.width || 0, h: c?.height || 0, frame1: c ? c.toDataURL('image/png') : '' };
  })()`);
  await new Promise(r => setTimeout(r, 220));
  const frame2 = await client.eval(`document.getElementById('battle-webgl-canvas')?.toDataURL('image/png') || ''`);
  assert.ok(w > 0 && h > 0 && frame1.length > 0 && frame1 !== frame2, `${label}: 3D canvas actively animating (${w}x${h})`);
}

async function runScenario(chromeBin, baseUrl, mode) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `lh-cdp-${mode}-`));
  const portMap = { camera: 9231, denied: 9232, notfound: 9233, completion: 9234, dashboard: 9235, init_cancel: 9236, floss: 9237 };
  const debugPort = portMap[mode] || 9238;
  const chromeProc = spawn(chromeBin, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ], { stdio: 'ignore' });

  let client = null;
  try {
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 12000);
    const targetsRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error('No CDP page target found');
    }

    client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    // Inject seed localStorage + deterministic getUserMedia mock BEFORE page scripts load
    const todayStr = new Date().toDateString();
    const seededReminders = mode === 'completion'
      ? { hero_1: { flossDate: null, flossAckDate: null, mouthwashDate: todayStr, mouthwashAckDate: null } }
      : (mode === 'floss'
        ? { hero_1: { flossDate: todayStr, flossAckDate: null, mouthwashDate: null, mouthwashAckDate: null } }
        : {});
    const seededDuration = mode === 'floss' ? 60 : 120;
    const initScript = `
      (() => {
        try {
          localStorage.setItem('little_heroes_adventure_master_v10', JSON.stringify({
            isAuthenticated: true,
            isAuthReady: true,
            isHouseholdConfigured: true,
            householdSetupStep: 'ready',
            household: { syncCode: 'HERO8842' },
            activeView: ${JSON.stringify(mode === 'dashboard' ? 'dashboard' : 'ar_battle')},
            hygieneReminders: ${JSON.stringify(seededReminders)},
            parentSettings: {
              arBattleDuration: ${seededDuration},
              motionSensitivity: 'medium',
              voicePromptsEnabled: false
            }
          }));
        } catch {}

        window.__cdpMode = ${JSON.stringify(mode)};
        window.__mockBrushMotion = false;
        window.__setMockBrushMotion = (val) => { window.__mockBrushMotion = Boolean(val); };
        window.__gumCallCount = 0;
        window.__gumTracks = [];
        window.__pendingGumResolver = null;
        window.__oneSecIntervalCount = 0;

        {
          const origSetInterval = window.setInterval.bind(window);
          window.setInterval = (fn, delay, ...args) => {
            if (delay === 1000) {
              window.__oneSecIntervalCount++;
              if (window.__cdpMode === 'completion') {
                return origSetInterval(fn, 15, ...args);
              }
            }
            return origSetInterval(fn, delay, ...args);
          };
        }

        // Synthetic 64x48 canvas stream for real-browser AI vision testing
        // Non-harmonic 65ms interval + 14-step sweep avoids Nyquist aliasing against 100ms optical tracker
        const camCanvas = document.createElement('canvas');
        camCanvas.width = 64;
        camCanvas.height = 48;
        const camCtx = camCanvas.getContext('2d');
        let frameTick = 0;
        setInterval(() => {
          frameTick++;
          camCtx.fillStyle = '#141e28';
          camCtx.fillRect(0, 0, 64, 48);
          if (window.__mockBrushMotion) {
            // Paint continuously sweeping bright brush bar inside Q1 ROI (mirrored: x in 8..36 maps to 28..56)
            const offset = (frameTick * 5) % 14;
            camCtx.fillStyle = '#ffffff';
            camCtx.fillRect(8 + offset, 10, 14, 18);
          }
        }, 65);

        const origMedia = navigator.mediaDevices || {};
        const customMedia = {
          enumerateDevices: origMedia.enumerateDevices ? origMedia.enumerateDevices.bind(origMedia) : async () => [],
          getUserMedia: async () => {
            window.__gumCallCount++;
            if (window.__cdpMode === 'init_cancel') {
              return new Promise((resolve) => {
                window.__pendingGumResolver = () => {
                  const stream = camCanvas.captureStream(15);
                  const track = stream.getVideoTracks()[0];
                  if (track) {
                    const origStop = track.stop.bind(track);
                    track._stopped = false;
                    track.stop = () => { track._stopped = true; return origStop(); };
                    window.__gumTracks.push(track);
                  }
                  resolve(stream);
                };
              });
            }
            if (window.__cdpMode === 'denied') {
              const err = new DOMException('Permission denied by user', 'NotAllowedError');
              throw err;
            }
            if (window.__cdpMode === 'notfound') {
              const err = new DOMException('Requested device not found', 'NotFoundError');
              throw err;
            }
            camCtx.fillStyle = '#141e28';
            camCtx.fillRect(0, 0, 64, 48);
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
      })();
    `;
    await client.send('Page.addScriptToEvaluateOnNewDocument', { source: initScript });
    if (mode === 'dashboard') {
      await client.send('Page.navigate', { url: `${baseUrl}/` });
      for (let i = 0; i < 40; i++) {
        const dashReady = await client.eval(`Boolean(document.querySelector('.habit-ar-launch-btn, .task-ar-launch-btn'))`);
        if (dashReady) break;
        await new Promise(r => setTimeout(r, 200));
      }
      await client.eval(`document.querySelector('.habit-ar-launch-btn, .task-ar-launch-btn')?.click()`);
    } else {
      await client.send('Page.navigate', { url: `${baseUrl}/#/boost` });
    }

    // Wait for BattleView DOM to mount
    for (let i = 0; i < 40; i++) {
      const ready = await client.eval(`Boolean(document.getElementById('battle-webgl-canvas') && document.getElementById('battle-timer-display'))`);
      if (ready) break;
      await new Promise(r => setTimeout(r, 200));
    }

    // Give initSensors() + video stream a brief moment to attach (except init_cancel which checks pending state immediately)
    if (mode !== 'init_cancel') {
      await new Promise(r => setTimeout(r, 700));
    } else {
      await new Promise(r => setTimeout(r, 150));
    }

    const exceptions = client.events.filter(e => e.method === 'Runtime.exceptionThrown');
    assert.equal(exceptions.length, 0, `Mode "${mode}": zero Runtime.exceptionThrown errors (got ${exceptions.length})`);

    if (mode === 'camera') {
      // Wait up to 3s for video element to decode first frames (readyState >= 2)
      let videoState = null;
      for (let w = 0; w < 15; w++) {
        videoState = await client.eval(`(() => {
          const v = document.getElementById('ar-camera-feed');
          const badge = document.getElementById('vision-status-badge');
          return {
            exists: Boolean(v),
            hidden: v ? v.classList.contains('hidden') : true,
            readyState: v ? v.readyState : 0,
            paused: v ? v.paused : true,
            badgeText: badge ? badge.textContent.trim() : ''
          };
        })()`);
        if (videoState.readyState >= 2) break;
        await new Promise(r => setTimeout(r, 200));
      }
      assert.equal(videoState.exists, true, 'CDP Camera: #ar-camera-feed exists');
      assert.equal(videoState.hidden, false, 'CDP Camera: #ar-camera-feed is un-hidden');
      assert.ok(videoState.readyState >= 2, `CDP Camera: video readyState >= 2 (got ${videoState.readyState})`);

      // Phase 1: Static camera -> defenders hold/idle
      await new Promise(r => setTimeout(r, 900));
      const idleBadge = await client.eval(`document.getElementById('vision-status-badge')?.textContent?.trim() || ''`);
      assert.ok(idleBadge.includes('READY') || idleBadge.includes('HOLDING'), `CDP Camera static shows ready/holding (${idleBadge})`);

      // Phase 2: Turn on continuous brush motion -> poll cleanly for BRUSHING + verify HP intact
      await client.eval(`window.__setMockBrushMotion(true)`);
      let activeState = { badge: '', timerText: '', hpWidth: '100%' };
      for (let p = 0; p < 20; p++) {
        await new Promise(r => setTimeout(r, 100));
        activeState = await client.eval(`(() => {
          const badge = document.getElementById('vision-status-badge')?.textContent?.trim() || '';
          const timerText = document.getElementById('battle-timer-display')?.textContent?.trim() || '';
          const hpWidth = document.getElementById('boss-hp-bar')?.style?.width || '100%';
          return { badge, timerText, hpWidth };
        })()`);
        if (activeState.badge.includes('BRUSHING')) break;
      }
      assert.ok(activeState.badge.includes('BRUSHING'), `CDP Camera motion updates badge to BRUSHING (${activeState.badge})`);
      assert.notEqual(activeState.hpWidth, '0%', `CDP Camera active brushing does not defeat boss immediately (hpWidth=${activeState.hpWidth})`);

      // Phase 3: Stop brush motion -> wait past hysteresis -> returns to idle hold
      await client.eval(`window.__setMockBrushMotion(false)`);
      let postStopBadge = '';
      for (let p = 0; p < 20; p++) {
        await new Promise(r => setTimeout(r, 100));
        postStopBadge = await client.eval(`document.getElementById('vision-status-badge')?.textContent?.trim() || ''`);
        if (postStopBadge.includes('HOLDING') || postStopBadge.includes('READY')) break;
      }
      assert.ok(postStopBadge.includes('HOLDING') || postStopBadge.includes('READY'), `CDP Camera stop returns defenders to idle hold (${postStopBadge})`);

      // Phase 4: Quit -> Defeat Retry in camera mode re-attaches live <video> and resumes 3D canvas animation
      await client.eval(`document.getElementById('battle-quit-btn')?.click()`);
      await new Promise(r => setTimeout(r, 150));
      const hasDefeatInCam = await client.eval(`Boolean(document.getElementById('colosseum-defeat-modal'))`);
      assert.equal(hasDefeatInCam, true, 'CDP Camera: #battle-quit-btn opens #colosseum-defeat-modal');

      await client.eval(`document.getElementById('colosseum-defeat-retry-btn')?.click()`);
      await new Promise(r => setTimeout(r, 400));
      let retryCamVideo = null;
      for (let w = 0; w < 15; w++) {
        retryCamVideo = await client.eval(`(() => {
          const v = document.getElementById('ar-camera-feed');
          return {
            modalGone: !document.getElementById('colosseum-defeat-modal'),
            hidden: v ? v.classList.contains('hidden') : true,
            readyState: v ? v.readyState : 0,
            hasStream: Boolean(v && v.srcObject)
          };
        })()`);
        if (retryCamVideo.modalGone && retryCamVideo.readyState >= 2) break;
        await new Promise(r => setTimeout(r, 150));
      }
      assert.equal(retryCamVideo.modalGone, true, 'CDP Camera Defeat Retry: #colosseum-defeat-modal removed from DOM');
      assert.equal(retryCamVideo.hidden, false, 'CDP Camera Defeat Retry: #ar-camera-feed un-hidden');
      assert.equal(retryCamVideo.hasStream, true, 'CDP Camera Defeat Retry: live srcObject re-attached');
      assert.ok(retryCamVideo.readyState >= 2, `CDP Camera Defeat Retry: video readyState >= 2 (got ${retryCamVideo.readyState})`);
      await assertCanvasAnimating(client, 'CDP Camera Defeat Retry');

      console.log(`  ✅ PASS: CDP Scenario A (Camera Vision Motion -> Active -> Idle Hold + Defeat Retry Live Video) verified cleanly`);
    } else if (mode === 'dashboard') {
      const initDashState = await client.eval(`(() => {
        const feed = document.getElementById('ar-camera-feed');
        const badge = document.getElementById('vision-status-badge')?.textContent?.trim() || '';
        const toggleText = document.getElementById('vision-fallback-toggle-btn')?.textContent?.trim() || '';
        const rhythmIcon = document.querySelector('#rhythm-toggle-btn span')?.textContent?.trim() || '';
        return {
          feedHidden: feed ? feed.classList.contains('hidden') : true,
          badge,
          toggleText,
          rhythmIcon,
          gumCalls: window.__gumCallCount
        };
      })()`);
      assert.equal(initDashState.feedHidden, false, 'CDP Dashboard->Battle: Camera activates on entry');
      assert.ok(initDashState.badge.includes('AI VISION'), `CDP Dashboard->Battle: Badge starts in AI VISION (${initDashState.badge})`);
      assert.equal(initDashState.rhythmIcon, 'music_note', 'CDP Dashboard->Battle: Rhythm starts active (music_note)');

      // Single click on #rhythm-toggle-btn must toggle music_note -> music_off -> music_note cleanly (1 listener)
      const rhythmAfter1 = await client.eval(`(() => {
        document.getElementById('rhythm-toggle-btn')?.click();
        return document.querySelector('#rhythm-toggle-btn span')?.textContent?.trim() || '';
      })()`);
      assert.equal(rhythmAfter1, 'music_off', `CDP Dashboard->Battle: Single click toggles rhythm off (got ${rhythmAfter1})`);
      const rhythmAfter2 = await client.eval(`(() => {
        document.getElementById('rhythm-toggle-btn')?.click();
        return document.querySelector('#rhythm-toggle-btn span')?.textContent?.trim() || '';
      })()`);
      assert.equal(rhythmAfter2, 'music_note', `CDP Dashboard->Battle: Second single click toggles rhythm back on (got ${rhythmAfter2})`);

      // Single click on #vision-fallback-toggle-btn must switch Camera -> Non-Camera Mode in 1 click without duplicate getUserMedia
      const afterToggle = await client.eval(`(async () => {
        const gumBefore = window.__gumCallCount;
        document.getElementById('vision-fallback-toggle-btn')?.click();
        await new Promise(r => setTimeout(r, 200));
        const feed = document.getElementById('ar-camera-feed');
        const badge = document.getElementById('vision-status-badge')?.textContent?.trim() || '';
        const toggleText = document.getElementById('vision-fallback-toggle-btn')?.textContent?.trim() || '';
        return {
          gumBefore,
          gumAfter: window.__gumCallCount,
          feedHidden: feed ? feed.classList.contains('hidden') : true,
          badge,
          toggleText
        };
      })()`);
      assert.equal(afterToggle.gumAfter, afterToggle.gumBefore, `CDP Dashboard->Battle: Switching to Non-Camera Mode does not re-invoke getUserMedia (${afterToggle.gumBefore} -> ${afterToggle.gumAfter})`);
      assert.equal(afterToggle.feedHidden, true, 'CDP Dashboard->Battle: Single click hides #ar-camera-feed');
      assert.ok(afterToggle.badge.includes('HERO SHIELD AUTO-MODE'), `CDP Dashboard->Battle: Single click switches badge to HERO SHIELD AUTO-MODE (${afterToggle.badge})`);
      assert.ok(afterToggle.toggleText.includes('Enable Camera'), `CDP Dashboard->Battle: Button switches to Enable Camera (${afterToggle.toggleText})`);

      // Quit -> #colosseum-defeat-retry-btn removes modal, starts 2x1000ms intervals once, and animates 3D canvas
      await client.eval(`document.getElementById('battle-quit-btn')?.click()`);
      await new Promise(r => setTimeout(r, 150));
      const defeatModalOpen = await client.eval(`Boolean(document.getElementById('colosseum-defeat-modal'))`);
      assert.equal(defeatModalOpen, true, 'CDP Dashboard: #battle-quit-btn opens #colosseum-defeat-modal');

      await client.eval(`(() => {
        window.__oneSecIntervalCount = 0;
        document.getElementById('colosseum-defeat-retry-btn')?.click();
      })()`);
      await new Promise(r => setTimeout(r, 300));
      const retryState = await client.eval(`(() => ({
        modalOpen: Boolean(document.getElementById('colosseum-defeat-modal')),
        intervalCount: window.__oneSecIntervalCount || 0
      }))()`);
      assert.equal(retryState.modalOpen, false, 'CDP Dashboard Defeat Retry: #colosseum-defeat-modal removed from DOM');
      assert.equal(retryState.intervalCount, 2, `CDP Dashboard Defeat Retry: starts battle once (2x1000ms intervals, got ${retryState.intervalCount})`);
      await assertCanvasAnimating(client, 'CDP Dashboard Defeat Retry');

      // Router Departure While Defeat Modal Is Open -> Return to BattleView has NO stale modal
      await client.eval(`document.getElementById('battle-quit-btn')?.click()`);
      await new Promise(r => setTimeout(r, 150));
      assert.equal(await client.eval(`Boolean(document.getElementById('colosseum-defeat-modal'))`), true, 'CDP Router Departure: Defeat modal open before navigating away');
      await client.eval(`document.getElementById('header-profile-btn')?.click()`);
      await new Promise(r => setTimeout(r, 200));
      assert.equal(await client.eval(`Boolean(document.getElementById('colosseum-defeat-modal'))`), false, 'CDP Router Departure: Leaving via #header-profile-btn unmounts defeat modal');
      await client.eval(`document.querySelector('.nav-tab-btn[data-nav-id="dashboard"]')?.click()`);
      for (let i = 0; i < 30; i++) {
        if (await client.eval(`Boolean(document.querySelector('.habit-ar-launch-btn, .task-ar-launch-btn'))`)) break;
        await new Promise(r => setTimeout(r, 150));
      }
      await client.eval(`document.querySelector('.habit-ar-launch-btn, .task-ar-launch-btn')?.click()`);
      for (let i = 0; i < 30; i++) {
        if (await client.eval(`Boolean(document.getElementById('battle-webgl-canvas'))`)) break;
        await new Promise(r => setTimeout(r, 150));
      }
      await new Promise(r => setTimeout(r, 300));
      const returnState = await client.eval(`(() => ({
        defeatOpen: Boolean(document.getElementById('colosseum-defeat-modal')),
        victoryOpen: Boolean(document.getElementById('colosseum-victory-modal'))
      }))()`);
      assert.equal(returnState.defeatOpen, false, 'CDP Router Departure: Returning to BattleView shows no stale defeat modal');
      assert.equal(returnState.victoryOpen, false, 'CDP Router Departure: Returning to BattleView shows no stale victory modal');
      await assertCanvasAnimating(client, 'CDP Router Return After Modal Departure');

      const exceptionsAfter = client.events.filter(e => e.method === 'Runtime.exceptionThrown');
      assert.equal(exceptionsAfter.length, 0, 'CDP Dashboard->Battle: Zero runtime exceptions');
      console.log(`  ✅ PASS: CDP Scenario E (Dashboard -> BattleView, Defeat Retry & Router Modal Departure) verified cleanly`);
    } else if (mode === 'init_cancel') {
      const beforeClick = await client.eval(`(() => ({
        btnText: document.getElementById('vision-fallback-toggle-btn')?.textContent?.trim() || '',
        gumCalls: window.__gumCallCount,
        hasPendingResolver: typeof window.__pendingGumResolver === 'function'
      }))()`);
      assert.ok(beforeClick.btnText.includes('Non-Camera Mode'), `CDP init_cancel: Pending button shows Non-Camera Mode (${beforeClick.btnText})`);
      assert.equal(beforeClick.gumCalls, 1, `CDP init_cancel: Exactly 1 pending getUserMedia call (${beforeClick.gumCalls})`);

      const afterCancel = await client.eval(`(async () => {
        document.getElementById('vision-fallback-toggle-btn')?.click();
        await new Promise(r => setTimeout(r, 100));
        const badge = document.getElementById('vision-status-badge')?.textContent?.trim() || '';
        const btnText = document.getElementById('vision-fallback-toggle-btn')?.textContent?.trim() || '';
        if (typeof window.__pendingGumResolver === 'function') {
          window.__pendingGumResolver();
        }
        await new Promise(r => setTimeout(r, 200));
        const feed = document.getElementById('ar-camera-feed');
        return {
          badge,
          btnText,
          gumCalls: window.__gumCallCount,
          feedHidden: feed ? feed.classList.contains('hidden') : true,
          tracksStopped: (window.__gumTracks || []).map(t => t._stopped)
        };
      })()`);
      assert.equal(afterCancel.gumCalls, 1, `CDP init_cancel: Clicking Non-Camera Mode during initializing spawns no 2nd getUserMedia (got ${afterCancel.gumCalls})`);
      assert.ok(afterCancel.badge.includes('HERO SHIELD AUTO-MODE'), `CDP init_cancel: Enters HERO SHIELD AUTO-MODE (${afterCancel.badge})`);
      assert.ok(afterCancel.btnText.includes('Enable Camera'), `CDP init_cancel: Button switches to Enable Camera (${afterCancel.btnText})`);
      assert.equal(afterCancel.feedHidden, true, 'CDP init_cancel: Late stream does not un-hide #ar-camera-feed');
      assert.deepEqual(afterCancel.tracksStopped, [true], `CDP init_cancel: Late resolved stream tracks stopped (${JSON.stringify(afterCancel.tracksStopped)})`);
      console.log(`  ✅ PASS: CDP Scenario F (Cancel Pending getUserMedia via Non-Camera Mode) verified cleanly`);
    } else if (mode === 'completion') {
      // Wait for accelerated 120s battle to conclude and open #colosseum-victory-modal
      let compState = { modalOpen: false, timerText: '', intervalCount: 0 };
      for (let p = 0; p < 60; p++) {
        compState = await client.eval(`(() => {
          const modal = document.getElementById('colosseum-victory-modal');
          const timerText = document.getElementById('battle-timer-display')?.textContent?.trim() || '';
          return {
            modalOpen: Boolean(modal),
            timerText,
            intervalCount: window.__oneSecIntervalCount || 0
          };
        })()`);
        if (compState.modalOpen) break;
        await new Promise(r => setTimeout(r, 100));
      }
      // Wait extra 400ms to prove no re-entrant startBattle() launches behind Victory Modal
      await new Promise(r => setTimeout(r, 400));
      const postCompState = await client.eval(`(() => {
        const modal = document.getElementById('colosseum-victory-modal');
        const timerText = document.getElementById('battle-timer-display')?.textContent?.trim() || '';
        return {
          modalOpen: Boolean(modal),
          timerText,
          intervalCount: window.__oneSecIntervalCount || 0
        };
      })()`);
      assert.equal(postCompState.modalOpen, true, 'CDP Completion: #colosseum-victory-modal is open');
      assert.equal(postCompState.timerText, '00:00', `CDP Completion: timer stays at 00:00 behind Victory Modal (got ${postCompState.timerText})`);
      assert.equal(postCompState.intervalCount, 2, `CDP Completion: startBattle() launched only once (2x1000ms intervals, got ${postCompState.intervalCount})`);

      // Mouthwash ack inside Victory Modal keeps Victory Modal open and updates button to Rinsed ✓
      const mwAckText = await client.eval(`(async () => {
        const btn = document.getElementById('mouthwash-modal-ack-btn');
        if (!btn) return 'MISSING';
        btn.click();
        await new Promise(r => setTimeout(r, 100));
        return document.getElementById('mouthwash-modal-ack-btn')?.textContent?.trim() || '';
      })()`);
      assert.ok(mwAckText.includes('Rinsed'), `CDP Completion: #mouthwash-modal-ack-btn updates to Rinsed ✓ (${mwAckText})`);
      assert.equal(await client.eval(`Boolean(document.getElementById('colosseum-victory-modal'))`), true, 'CDP Completion: #colosseum-victory-modal remains open after mouthwash ack');

      // Click Victory "BATTLE AGAIN" (#colosseum-play-again-btn) -> wait 250ms -> modal removed, timer reset, 2x1000ms intervals, canvas animating
      await client.eval(`(() => {
        window.__oneSecIntervalCount = 0;
        document.getElementById('colosseum-play-again-btn')?.click();
      })()`);
      await new Promise(r => setTimeout(r, 250));
      const playAgainState = await client.eval(`(() => ({
        modalOpen: Boolean(document.getElementById('colosseum-victory-modal')),
        timerText: document.getElementById('battle-timer-display')?.textContent?.trim() || '',
        intervalCount: window.__oneSecIntervalCount || 0
      }))()`);
      assert.equal(playAgainState.modalOpen, false, 'CDP Completion Battle Again: #colosseum-victory-modal removed from DOM');
      assert.notEqual(playAgainState.timerText, '00:00', `CDP Completion Battle Again: timer reset (got ${playAgainState.timerText})`);
      assert.equal(playAgainState.intervalCount, 2, `CDP Completion Battle Again: single startBattle() (2x1000ms intervals, got ${playAgainState.intervalCount})`);
      await assertCanvasAnimating(client, 'CDP Completion Victory Battle Again');

      const exceptionsAfter = client.events.filter(e => e.method === 'Runtime.exceptionThrown');
      assert.equal(exceptionsAfter.length, 0, `CDP Completion: Zero runtime exceptions`);
      console.log(`  ✅ PASS: CDP Scenario D (Accelerated 120s Completion, Mouthwash Ack & Victory Battle Again) verified cleanly`);
    } else if (mode === 'floss') {
      const flossInit = await client.eval(`(() => ({
        hasDoneFlossBtn: Boolean(document.getElementById('battle-done-floss-btn')),
        hasBossHpBar: Boolean(document.getElementById('boss-hp-bar')),
        hasFlossBanner: Boolean(document.getElementById('floss-banner-container'))
      }))()`);
      assert.equal(flossInit.hasDoneFlossBtn, true, 'CDP Floss: #battle-done-floss-btn present during floss phase');
      assert.equal(flossInit.hasFlossBanner, true, 'CDP Floss: #floss-banner-container present during floss phase');
      assert.equal(flossInit.hasBossHpBar, false, 'CDP Floss: #boss-hp-bar omitted during floss phase');

      // Attempt pointer scrubs during floss (must NOT drain boss HP), then transition via #battle-done-floss-btn
      await client.eval(`(() => {
        const c = document.getElementById('battle-webgl-canvas');
        c.dispatchEvent(new PointerEvent('pointerdown', { clientX: 220, clientY: 220, bubbles: true }));
        c.dispatchEvent(new PointerEvent('pointermove', { clientX: 260, clientY: 230, bubbles: true }));
        c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      })()`);
      await new Promise(r => setTimeout(r, 1200));
      await client.eval(`document.getElementById('battle-done-floss-btn')?.click()`);
      await new Promise(r => setTimeout(r, 250));

      const brushAfterFloss = await client.eval(`(() => ({
        hasFlossBanner: Boolean(document.getElementById('floss-banner-container')),
        hasBossHpBar: Boolean(document.getElementById('boss-hp-bar')),
        hpWidth: document.getElementById('boss-hp-bar')?.style?.width || '',
        hasActiveZoneBanner: Boolean(document.getElementById('active-zone-banner')),
        hasSupernovaHud: Boolean(document.getElementById('supernova-hud')),
        timerText: document.getElementById('battle-timer-display')?.textContent?.trim() || ''
      }))()`);
      assert.equal(brushAfterFloss.hasFlossBanner, false, 'CDP Floss->Brush: #floss-banner-container removed');
      assert.equal(brushAfterFloss.hasBossHpBar, true, 'CDP Floss->Brush: #boss-hp-bar mounted');
      assert.equal(brushAfterFloss.hpWidth, '100%', `CDP Floss->Brush: Boss HP starts at 100% (got ${brushAfterFloss.hpWidth})`);
      assert.equal(brushAfterFloss.hasActiveZoneBanner, true, 'CDP Floss->Brush: #active-zone-banner mounted');
      assert.equal(brushAfterFloss.hasSupernovaHud, true, 'CDP Floss->Brush: #supernova-hud mounted');
      assert.ok(brushAfterFloss.timerText === '01:00' || brushAfterFloss.timerText === '00:59', `CDP Floss->Brush: timer reflects arBattleDuration=60 (got ${brushAfterFloss.timerText})`);
      await assertCanvasAnimating(client, 'CDP Floss -> Brush Transition');

      const exceptionsAfter = client.events.filter(e => e.method === 'Runtime.exceptionThrown');
      assert.equal(exceptionsAfter.length, 0, 'CDP Floss: Zero runtime exceptions');
      console.log(`  ✅ PASS: CDP Scenario G (Floss Isolation -> Brush HUD & 100% HP Transition) verified cleanly`);
    } else {
      const fbState = await client.eval(`(() => {
        const badge = document.getElementById('vision-status-badge')?.textContent?.trim() || '';
        const placeholder = document.getElementById('pip-fallback-label')?.textContent?.trim() || '';
        const timer1 = document.getElementById('battle-timer-display')?.textContent?.trim() || '';
        return { badge, placeholder, timer1 };
      })()`);
      assert.ok(fbState.badge.includes('HERO SHIELD AUTO-MODE'), `CDP ${mode}: Fallback badge active (${fbState.badge})`);
      assert.ok(fbState.placeholder.includes('HERO SHIELD AUTO-MODE'), `CDP ${mode}: Magic Mirror placeholder displays fallback prompt`);

      // Test interactive pointer-drag scrubbing + fallback button + timer tick
      await client.eval(`(() => {
        const canvas = document.getElementById('battle-webgl-canvas');
        canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 250, clientY: 250, bubbles: true }));
        canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 290, clientY: 260, bubbles: true }));
        canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        document.getElementById('fallback-scrub-btn')?.click();
      })()`);
      await new Promise(r => setTimeout(r, 1200));
      const timer2 = await client.eval(`document.getElementById('battle-timer-display')?.textContent?.trim() || ''`);
      assert.notEqual(timer2, fbState.timer1, `CDP ${mode}: Timer ticks cleanly in Non-Camera Fallback (${fbState.timer1} -> ${timer2})`);

      if (mode === 'denied') {
        // Verify single click on #vision-fallback-toggle-btn retries getUserMedia immediately
        const retryResult = await client.eval(`(async () => {
          const gumBefore = window.__gumCallCount;
          window.__cdpMode = 'camera';
          document.getElementById('vision-fallback-toggle-btn')?.click();
          await new Promise(r => setTimeout(r, 600));
          const feed = document.getElementById('ar-camera-feed');
          const badge = document.getElementById('vision-status-badge')?.textContent?.trim() || '';
          return {
            gumBefore,
            gumAfter: window.__gumCallCount,
            feedHidden: feed ? feed.classList.contains('hidden') : true,
            badge
          };
        })()`);
        assert.ok(retryResult.gumAfter > retryResult.gumBefore, `CDP denied: Single click on #vision-fallback-toggle-btn retries getUserMedia (${retryResult.gumBefore} -> ${retryResult.gumAfter})`);
        assert.equal(retryResult.feedHidden, false, 'CDP denied: Single click activates #ar-camera-feed immediately');
        assert.ok(retryResult.badge.includes('AI VISION'), `CDP denied: Single click switches badge to AI VISION (${retryResult.badge})`);
      }

      const exceptionsAfter = client.events.filter(e => e.method === 'Runtime.exceptionThrown');
      assert.equal(exceptionsAfter.length, 0, `CDP ${mode}: Zero runtime exceptions during fallback play`);
      console.log(`  ✅ PASS: CDP Scenario (${mode}) Non-Camera Fallback verified cleanly`);
    }
  } finally {
    if (client) client.close();
    try { chromeProc.kill(); } catch {}
    await new Promise(r => setTimeout(r, 200));
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

async function main() {
  console.log('\n🌐 Running Headless Chrome CDP E2E Verification for Tooth Defenders...\n');
  const chromeBin = findChromeBinary();
  if (!chromeBin) {
    if (process.env.REQUIRE_CDP === 'true') {
      console.error('❌ Chrome binary not found and REQUIRE_CDP=true');
      process.exit(1);
    }
    console.log('⏭️  Skipping Headless Chrome CDP test (no Chrome/Edge binary found in this environment).');
    process.exit(0);
  }

  if (!fs.existsSync(path.resolve('dist/index.html'))) {
    console.error('❌ dist/index.html not found. Run npm run build first.');
    process.exit(1);
  }

  const vitePreview = spawn(
    process.execPath,
    ['./node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4179', '--strictPort'],
    { stdio: 'ignore' }
  );

  try {
    const baseUrl = 'http://127.0.0.1:4179';
    await waitForHttp(baseUrl, 15000);
    await runScenario(chromeBin, baseUrl, 'camera');
    await runScenario(chromeBin, baseUrl, 'denied');
    await runScenario(chromeBin, baseUrl, 'notfound');
    await runScenario(chromeBin, baseUrl, 'completion');
    await runScenario(chromeBin, baseUrl, 'dashboard');
    await runScenario(chromeBin, baseUrl, 'init_cancel');
    await runScenario(chromeBin, baseUrl, 'floss');
    console.log('\n🎉 ALL HEADLESS CHROME CDP E2E CHECKS PASSED!\n');
  } finally {
    try { vitePreview.kill(); } catch {}
  }
}

main().catch(err => {
  console.error('❌ CDP Verification Failed:', err);
  process.exit(1);
});
