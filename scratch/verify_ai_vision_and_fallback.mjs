import './setup_mock_env.js';
import assert from 'node:assert/strict';
import {
  analyzeFrameDelta,
  BrushVisionTracker
} from '../src/services/brushVisionTracker.js';
import { hanaBattle3DService } from '../src/services/hanaBattle3DService.js';
import {
  renderBattleView,
  attachBattleListeners,
  startBattle,
  abandonBattleIfRunning,
  getBattleTelemetryState
} from '../src/views/BattleView.js';
import { store } from '../src/state/store.js';

let passed = 0;
let failed = 0;

function check(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

function makeRgbaFrame(width, height, fill = [20, 30, 40, 255]) {
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = fill[0];
    buf[i + 1] = fill[1];
    buf[i + 2] = fill[2];
    buf[i + 3] = fill[3];
  }
  return buf;
}

function paintRect(buf, width, height, x0, y0, x1, y1, color) {
  for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) {
      const idx = (y * width + x) * 4;
      buf[idx] = color[0];
      buf[idx + 1] = color[1];
      buf[idx + 2] = color[2];
      buf[idx + 3] = color[3];
    }
  }
}

console.log('\n🧪 Running R1 AI Vision & Non-Camera Fallback Verification Suite...\n');

// =========================================================================
// 1. PURE FRAME-DELTA & ZONE DETECTION TESTS
// =========================================================================
console.log('--- 1. Testing analyzeFrameDelta (Static, Q1/Q2 Motion, Sensitivity) ---');
{
  const W = 64;
  const H = 48;
  const frameA = makeRgbaFrame(W, H, [30, 40, 50, 255]);
  const frameStatic = makeRgbaFrame(W, H, [30, 40, 50, 255]);

  const staticRes = analyzeFrameDelta(frameA, frameStatic, W, H, 'q1', 'medium');
  check(staticRes.hasMotion === false, 'Static frames report hasMotion === false');
  check(staticRes.movementSpeed === 0, 'Static frames report movementSpeed === 0');
  check(staticRes.confidence === 0, 'Static frames report confidence === 0');

  // Paint motion inside Q1 ROI (minX: 32..56, minY: 12..28)
  const frameQ1 = makeRgbaFrame(W, H, [30, 40, 50, 255]);
  paintRect(frameQ1, W, H, 34, 14, 54, 26, [220, 220, 220, 255]);
  const q1Res = analyzeFrameDelta(frameA, frameQ1, W, H, 'q1', 'medium');
  check(q1Res.hasMotion === true, 'Q1 ROI motion reports hasMotion === true');
  check(q1Res.detectedZoneId === 'q1', `Q1 ROI motion detects zone q1 (got ${q1Res.detectedZoneId})`);
  check(q1Res.targetZoneMatch === true, 'Q1 ROI motion matches target zone q1');
  check(q1Res.movementSpeed >= 20 && q1Res.movementSpeed <= 100, `Q1 movementSpeed in [20..100] (${q1Res.movementSpeed})`);
  check(q1Res.confidence >= 40 && q1Res.confidence <= 100, `Q1 confidence in [40..100] (${q1Res.confidence})`);

  // Paint motion inside Q2 ROI (minX: 8..32, minY: 12..28)
  const frameQ2 = makeRgbaFrame(W, H, [30, 40, 50, 255]);
  paintRect(frameQ2, W, H, 10, 14, 30, 26, [210, 210, 210, 255]);
  const q2Res = analyzeFrameDelta(frameA, frameQ2, W, H, 'q2', 'medium');
  check(q2Res.detectedZoneId === 'q2', `Q2 ROI motion detects zone q2 (got ${q2Res.detectedZoneId})`);
  check(q2Res.targetZoneMatch === true, 'Q2 ROI motion matches target zone q2');

  // Sensitivity comparison (subtle +21 channel delta: passes high, ignored by medium/low)
  const frameSubtle = makeRgbaFrame(W, H, [30, 40, 50, 255]);
  paintRect(frameSubtle, W, H, 34, 14, 54, 26, [51, 61, 71, 255]);
  const highSens = analyzeFrameDelta(frameA, frameSubtle, W, H, 'q1', 'high');
  const medSens = analyzeFrameDelta(frameA, frameSubtle, W, H, 'q1', 'medium');
  check(highSens.hasMotion === true && medSens.hasMotion === false, 'motionSensitivity high detects subtle motion ignored by medium');
}

// =========================================================================
// 2. BRUSH VISION TRACKER STATE MACHINE & HYSTERESIS
// =========================================================================
console.log('\n--- 2. Testing BrushVisionTracker State Machine & Idle Hysteresis ---');
{
  const tracker = new BrushVisionTracker({ hysteresisMs: 650 });
  const W = 64;
  const H = 48;
  const base = makeRgbaFrame(W, H, [20, 20, 20, 255]);
  const active = makeRgbaFrame(W, H, [20, 20, 20, 255]);
  paintRect(active, W, H, 33, 13, 55, 27, [230, 230, 230, 255]);

  let snap = tracker.processFrame(base, W, H, 'q1', 'medium', 1000);
  check(snap.isBrushing === false && snap.state === 'idle', 'Initial frame starts idle');

  snap = tracker.processFrame(active, W, H, 'q1', 'medium', 1100);
  check(snap.isBrushing === true, 'Motion frame transitions isBrushing -> true');
  check(snap.state === 'active' || snap.state === 'charging', `Active state reported (${snap.state})`);

  // Brief pause (300ms < 650ms hysteresis): stays brushing
  snap = tracker.processFrame(active, W, H, 'q1', 'medium', 1400);
  check(snap.isBrushing === true, 'Brief pause within hysteresis keeps isBrushing === true');

  // Sustained stillness (800ms > 650ms hysteresis): transitions cleanly to idle
  snap = tracker.processFrame(active, W, H, 'q1', 'medium', 1900);
  check(snap.isBrushing === false, 'Stopping motion beyond hysteresis transitions isBrushing -> false');
  check(snap.state === 'idle' && snap.movementSpeed === 0, 'State resets cleanly to idle with speed 0');
}

// =========================================================================
// 3. HANA 3D SERVICE NO-DUPLICATE-FIRE & IDLE HOLD INVARIANT
// =========================================================================
console.log('\n--- 3. Testing hanaBattle3DService Single-Authority Firing ---');
{
  const canvas = document.createElement('canvas');
  await hanaBattle3DService.init(canvas, { preserveBattleState: false });
  hanaBattle3DService.counterAttackProjectiles = [];

  // Calling updateState with high cadence & isScrubbing must NOT fire projectiles directly
  hanaBattle3DService.updateState({
    bossHp: 100,
    maxHp: 100,
    isScrubbing: true,
    cadenceScore: 95,
    combo: 30
  });
  check(
    hanaBattle3DService.counterAttackProjectiles.length === 0,
    'hanaBattle3DService.updateState() never auto-fires duplicate projectiles'
  );

  // Idle update sets isScrubbing false cleanly
  hanaBattle3DService.updateState({ isScrubbing: false, cadenceScore: 0 });
  check(hanaBattle3DService.isScrubbing === false, 'hanaBattle3DService transitions cleanly to isScrubbing === false');
  hanaBattle3DService.destroy();
}

// =========================================================================
// 4. CAMERA PERMISSION DENIED / UNAVAILABLE / OVERCONSTRAINED FALLBACKS
// =========================================================================
console.log('\n--- 4. Testing Sensor Cascade & Non-Camera Fallback Scenarios ---');
{
  const col = store.getBossColosseumState();
  check(col.showPipCam === true, 'store.bossColosseum.showPipCam defaults to true');

  const registeredIntervals = [];
  const realSetInterval = global.setInterval;
  const realClearInterval = global.clearInterval;
  global.setInterval = (fn, delay) => {
    const id = realSetInterval(() => {}, 1 << 30);
    registeredIntervals.push({ id, fn, delay });
    return id;
  };
  global.clearInterval = (id) => realClearInterval(id);

  const origMediaDevices = globalThis.navigator?.mediaDevices;
  const setMediaDevices = (md) => {
    if (!globalThis.navigator) globalThis.navigator = {};
    globalThis.navigator.mediaDevices = md;
  };

  try {
    // 4A. Missing navigator.mediaDevices
    setMediaDevices(undefined);
    store.state.hygieneReminders = {};
    store.state.parentSettings.arBattleDuration = 120;
    store.initColosseumBattle('sugar_bandit', 120);
    document.body.setMockHtml(renderBattleView());
    attachBattleListeners();
    await new Promise(r => setTimeout(r, 20));
    let telem = getBattleTelemetryState();
    check(telem.sensorMode === 'fallback', 'Missing navigator.mediaDevices activates fallback mode without throwing');
    check(telem.cameraError?.name === 'Unsupported', 'cameraError records Unsupported cleanly');
    abandonBattleIfRunning();

    // 4B. Permission Denied (NotAllowedError)
    setMediaDevices({
      getUserMedia: async () => {
        const e = new Error('Permission denied');
        e.name = 'NotAllowedError';
        throw e;
      }
    });
    document.body.setMockHtml(renderBattleView());
    attachBattleListeners();
    await new Promise(r => setTimeout(r, 20));
    telem = getBattleTelemetryState();
    check(telem.isCameraActive === false && telem.sensorMode === 'fallback', 'NotAllowedError activates Non-Camera Fallback Mode');
    check(telem.cameraError?.name === 'NotAllowedError', 'cameraError captures NotAllowedError');
    const badge = document.getElementById('vision-status-badge');
    check(badge && badge.textContent.includes('HERO SHIELD AUTO-MODE'), 'Fallback status badge displays kid-friendly HERO SHIELD AUTO-MODE');
    abandonBattleIfRunning();

    // 4C. Camera NotFoundError
    setMediaDevices({
      getUserMedia: async () => {
        const e = new Error('Requested device not found');
        e.name = 'NotFoundError';
        throw e;
      }
    });
    document.body.setMockHtml(renderBattleView());
    attachBattleListeners();
    await new Promise(r => setTimeout(r, 20));
    telem = getBattleTelemetryState();
    check(telem.sensorMode === 'fallback' && telem.cameraError?.name === 'NotFoundError', 'NotFoundError activates fallback cleanly');

    // 4D. Pointer-drag scrub & full 120s completion in fallback mode
    const canvas = document.getElementById('battle-webgl-canvas');
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 200, clientY: 200 }));
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 240, clientY: 210 }));
    canvas.dispatchEvent(new MouseEvent('pointerup', {}));
    const afterManual = getBattleTelemetryState();
    check(afterManual.totalScrubHits >= 1, 'Canvas pointerdown/pointermove triggers manual scrub hits in fallback mode');

    // Drive all 120 1Hz battle ticks to completion in fallback mode
    const oneSecTicks = registeredIntervals.filter(r => r.delay === 1000);
    const latestBattleTick = oneSecTicks[oneSecTicks.length - 1].fn;
    for (let s = 0; s < 120; s++) latestBattleTick();
    const colAfter = store.getBossColosseumState();
    check(colAfter.isVictoryModalOpen === true && colAfter.hasAwardedVictory === true, 'Full 120s battle completes cleanly in Non-Camera Fallback Mode');
    abandonBattleIfRunning();

    // 4E. OverconstrainedError video-only fallback + active camera idle-hold check
    let callCount = 0;
    const mockTrack = { stop: () => {}, readyState: 'live' };
    const mockStream = {
      active: true,
      getTracks: () => [mockTrack],
      getVideoTracks: () => [mockTrack],
      getAudioTracks: () => []
    };
    setMediaDevices({
      getUserMedia: async (constraints) => {
        callCount++;
        if (constraints.audio && constraints.video) {
          const e = new Error('No mic');
          e.name = 'NotFoundError';
          throw e;
        }
        if (constraints.video && typeof constraints.video === 'object') {
          const e = new Error('Overconstrained');
          e.name = 'OverconstrainedError';
          throw e;
        }
        if (constraints.video === true) {
          return mockStream;
        }
        throw new Error('Unexpected constraint');
      }
    });

    registeredIntervals.length = 0;
    store.initColosseumBattle('sugar_bandit', 120);
    document.body.setMockHtml(renderBattleView());
    attachBattleListeners();
    await new Promise(r => setTimeout(r, 25));
    telem = getBattleTelemetryState();
    check(telem.isCameraActive === true && telem.sensorMode === 'vision', 'Sensor cascade falls back from audio+video -> Overconstrained -> {video:true}');
    const videoEl = document.getElementById('ar-camera-feed');
    check(videoEl && !videoEl.classList.contains('hidden'), '#ar-camera-feed has hidden class removed when stream attaches');

    // Verify active camera idle-hold: advancing Date.now() by 1500ms without motion puts defenders into hold/idle (autoAssist does NOT fire)
    const hitsBeforeIdle = getBattleTelemetryState().totalScrubHits;
    const realDateNow = Date.now;
    Date.now = () => realDateNow() + 2000;
    const oneSecAssist = registeredIntervals.find(r => r.delay === 1000).fn;
    oneSecAssist();
    Date.now = realDateNow;
    const hitsAfterIdle = getBattleTelemetryState().totalScrubHits;
    check(hitsAfterIdle === hitsBeforeIdle, 'When camera is active and motion stops, autoAssist does NOT fire idle projectiles');
    check(hanaBattle3DService.isScrubbing === false, 'When camera is active and motion stops, Tooth Defenders enter hold/idle');

    // User toggle to Non-Camera Mode
    const toggleBtn = document.getElementById('vision-fallback-toggle-btn');
    toggleBtn.click();
    await new Promise(r => setTimeout(r, 10));
    telem = getBattleTelemetryState();
    check(telem.isCameraActive === false && telem.sensorMode === 'fallback', 'Clicking #vision-fallback-toggle-btn switches cleanly to Non-Camera Fallback Mode');

    abandonBattleIfRunning();

    // =========================================================================
    // 5. REGRESSION SUITES FOR ITERATION 2 FIXES (R1)
    // =========================================================================
    console.log('\n--- 5. Regression Tests: Audio-Only Idle Hold, Stale Async Cancel, Single-Click Retry, No Re-Entrant startBattle ---');

    // 5A. Re-entrant startBattle guard after 120s completion (store.notify + attachBattleListeners)
    {
      registeredIntervals.length = 0;
      setMediaDevices(undefined);
      store.initColosseumBattle('sugar_bandit', 120);
      document.body.setMockHtml(renderBattleView());
      attachBattleListeners();
      await new Promise(r => setTimeout(r, 15));
      const oneSec = registeredIntervals.filter(r => r.delay === 1000);
      const tick = oneSec[oneSec.length - 1].fn;
      for (let s = 0; s < 120; s++) tick();
      const colDone = store.getBossColosseumState();
      const telemDone = getBattleTelemetryState();
      check(colDone.isVictoryModalOpen === true && colDone.hasAwardedVictory === true, 'Re-entry guard: Victory modal open and victory awarded');
      check(telemDone.isBattleRunning === false && telemDone.secondsRemaining === 0, 'Re-entry guard: Battle stays stopped (isBattleRunning=false, secondsRemaining=0) after completion');
      // Explicitly re-trigger attachBattleListeners while modal open
      attachBattleListeners();
      const telemAfterReattach = getBattleTelemetryState();
      check(telemAfterReattach.isBattleRunning === false && telemAfterReattach.secondsRemaining === 0, 'Re-entry guard: attachBattleListeners() never restarts battle behind Victory Modal');
      store.closeColosseumVictoryModal(true);
    }

    // 5B. Audio-only mic mode holds idle on quiet frames (does NOT downgrade to fallback)
    {
      const origAudioCtx = window.AudioContext;
      const origGlobalAudioCtx = globalThis.AudioContext;
      const silentAudioTrack = { stop: () => {}, readyState: 'live', kind: 'audio' };
      const audioOnlyStream = {
        active: true,
        getTracks: () => [silentAudioTrack],
        getVideoTracks: () => [],
        getAudioTracks: () => [silentAudioTrack]
      };
      class SilentMicAudioContext {
        constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
        resume() { return Promise.resolve(); }
        close() { this.state = 'closed'; return Promise.resolve(); }
        createGain() {
          return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {} };
        }
        createDynamicsCompressor() {
          return { threshold: { setValueAtTime() {} }, knee: { setValueAtTime() {} }, ratio: { setValueAtTime() {} }, attack: { setValueAtTime() {} }, release: { setValueAtTime() {} }, connect() {} };
        }
        createOscillator() {
          return { type: 'sine', frequency: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} };
        }
        createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
        createBiquadFilter() { return { type: 'bandpass', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { setValueAtTime() {} }, connect() {}, disconnect() {} }; }
        createAnalyser() {
          return {
            fftSize: 256,
            smoothingTimeConstant: 0.4,
            getFloatTimeDomainData(buf) { buf.fill(0); } // silent room
          };
        }
      }
      window.AudioContext = SilentMicAudioContext;
      globalThis.AudioContext = SilentMicAudioContext;

      setMediaDevices({
        getUserMedia: async (constraints) => {
          if (constraints.video) {
            const e = new Error('Camera denied');
            e.name = 'NotAllowedError';
            throw e;
          }
          if (constraints.audio) return audioOnlyStream;
          throw new Error('Unexpected constraint');
        }
      });

      registeredIntervals.length = 0;
      store.initColosseumBattle('sugar_bandit', 120);
      document.body.setMockHtml(renderBattleView());
      attachBattleListeners();
      await new Promise(r => setTimeout(r, 30));
      const audioTelem1 = getBattleTelemetryState();
      check(audioTelem1.sensorMode === 'audio' && audioTelem1.isMicActive === true, 'Audio-only Step 4 enters sensorMode="audio" with isMicActive=true');

      // Simulate quiet 50ms analyzer ticks + >= 2s of 1Hz autoAssistInterval checks
      const cadenceFn = registeredIntervals.find(r => r.delay === 50)?.fn;
      const assistFn = registeredIntervals.find(r => r.delay === 1000)?.fn;
      const hitsBeforeQuiet = getBattleTelemetryState().totalScrubHits;
      const realDateNow2 = Date.now;
      let simT = realDateNow2();
      Date.now = () => simT;
      if (cadenceFn) cadenceFn();
      simT += 1200;
      if (assistFn) assistFn();
      simT += 1200;
      if (cadenceFn) cadenceFn();
      if (assistFn) assistFn();
      Date.now = realDateNow2;

      const audioTelem2 = getBattleTelemetryState();
      check(audioTelem2.sensorMode === 'audio', `Audio-only mode stays "audio" on quiet pauses (got ${audioTelem2.sensorMode})`);
      check(audioTelem2.totalScrubHits === hitsBeforeQuiet, 'Audio-only idle hold does NOT fire fallback assist shots');
      check(hanaBattle3DService.isScrubbing === false, 'Audio-only quiet pause holds Tooth Defenders idle (isScrubbing=false)');
      abandonBattleIfRunning();

      // 5C. startListening() returning false (no AudioContext) falls back cleanly to 'fallback'
      window.AudioContext = undefined;
      window.webkitAudioContext = undefined;
      globalThis.AudioContext = undefined;
      store.initColosseumBattle('sugar_bandit', 120);
      document.body.setMockHtml(renderBattleView());
      attachBattleListeners();
      await new Promise(r => setTimeout(r, 30));
      const noCtxTelem = getBattleTelemetryState();
      check(noCtxTelem.sensorMode === 'fallback', `startListening() returning false activates fallback cleanly (got ${noCtxTelem.sensorMode})`);
      abandonBattleIfRunning();

      window.AudioContext = origAudioCtx;
      globalThis.AudioContext = origGlobalAudioCtx;
    }

    // 5D. Stale async getUserMedia cancelled cleanly when battle abandoned before settlement
    {
      let resolvePendingGum = null;
      let lateTrackStopped = false;
      const lateTrack = { stop: () => { lateTrackStopped = true; }, readyState: 'live' };
      const lateStream = {
        active: true,
        getTracks: () => [lateTrack],
        getVideoTracks: () => [lateTrack],
        getAudioTracks: () => []
      };
      setMediaDevices({
        getUserMedia: () => new Promise((resolve) => { resolvePendingGum = resolve; })
      });

      store.initColosseumBattle('sugar_bandit', 120);
      document.body.setMockHtml(renderBattleView());
      attachBattleListeners();
      // Abandon immediately while getUserMedia is still pending
      abandonBattleIfRunning();
      resolvePendingGum(lateStream);
      await new Promise(r => setTimeout(r, 20));
      const staleTelem = getBattleTelemetryState();
      check(lateTrackStopped === true, 'Late getUserMedia stream resolved after abandonBattleIfRunning() has tracks stopped');
      check(staleTelem.isCameraActive === false && staleTelem.isBattleRunning === false, 'Late getUserMedia does not reactivate camera after battle abandoned');
    }

    // 5E. Single-click #vision-fallback-toggle-btn after startup NotAllowedError retries getUserMedia immediately
    {
      let allowCameraNow = false;
      let gumAttempts = 0;
      const retryTrack = { stop: () => {}, readyState: 'live' };
      const retryStream = {
        active: true,
        getTracks: () => [retryTrack],
        getVideoTracks: () => [retryTrack],
        getAudioTracks: () => []
      };
      setMediaDevices({
        getUserMedia: async (constraints) => {
          gumAttempts++;
          if (!allowCameraNow) {
            const e = new Error('Denied');
            e.name = 'NotAllowedError';
            throw e;
          }
          if (constraints.video) return retryStream;
          const e = new Error('No audio');
          e.name = 'NotFoundError';
          throw e;
        }
      });

      store.initColosseumBattle('sugar_bandit', 120);
      document.body.setMockHtml(renderBattleView());
      attachBattleListeners();
      await new Promise(r => setTimeout(r, 25));
      const beforeRetry = getBattleTelemetryState();
      check(beforeRetry.sensorMode === 'fallback' && beforeRetry.isCameraActive === false, 'Startup NotAllowedError starts in fallback mode');

      allowCameraNow = true;
      const attemptsBeforeClick = gumAttempts;
      document.getElementById('vision-fallback-toggle-btn').click();
      await new Promise(r => setTimeout(r, 25));
      const afterSingleClick = getBattleTelemetryState();
      check(gumAttempts > attemptsBeforeClick, 'Single click on #vision-fallback-toggle-btn invokes getUserMedia immediately');
      check(afterSingleClick.isCameraActive === true && afterSingleClick.sensorMode === 'vision', 'Single click on "📷 Enable Camera" activates camera on first click');
      abandonBattleIfRunning();
    }

    // =========================================================================
    // 6. REGRESSION TESTS FOR ITERATION 3 FIXES (LISTENERS, MIC LEAK, INIT CANCEL)
    // =========================================================================
    console.log('\n--- 6. Regression Tests: Single Listener Attach, Mic Track Cleanup, Init-Cancel Fallback ---');

    // 6A. Subscriber-wired Dashboard -> BattleView navigation attaches 1 listener per button + Option B Victory/Defeat Retry + Live <video> Re-Attach
    {
      registeredIntervals.length = 0;
      let renderCount = 0;
      let lastMockView = store.getState().activeView;
      const unsub = store.subscribe(() => {
        const nextView = store.getState().activeView;
        const isBattle = nextView === 'battle' || nextView === 'ar_battle';
        const wasBattle = lastMockView === 'battle' || lastMockView === 'ar_battle';
        if (wasBattle && !isBattle) {
          abandonBattleIfRunning();
        }
        lastMockView = nextView;
        if (isBattle) {
          renderCount++;
          document.body.setMockHtml(renderBattleView());
          attachBattleListeners();
        }
      });

      try {
        setMediaDevices({
          getUserMedia: async () => ({
            active: true,
            getTracks: () => [{ stop: () => {}, readyState: 'live', kind: 'video' }],
            getVideoTracks: () => [{ stop: () => {}, readyState: 'live', kind: 'video' }],
            getAudioTracks: () => []
          })
        });
        store.state.activeView = 'dashboard';
        lastMockView = 'dashboard';
        store.state.hygieneReminders = {};
        store.state.parentSettings.arBattleDuration = 120;
        renderCount = 0;
        store.navigate('battle');
        await new Promise(r => setTimeout(r, 25));

        check(renderCount === 1, `Dashboard -> BattleView navigation triggers exactly 1 renderApp (got ${renderCount})`);

        // Single click on #vision-fallback-toggle-btn switches cleanly to fallback in 1 click (proving 1 listener)
        document.getElementById('vision-fallback-toggle-btn').click();
        await new Promise(r => setTimeout(r, 15));
        const afterToggle = getBattleTelemetryState();
        check(
          afterToggle.isCameraActive === false && afterToggle.sensorMode === 'fallback' && afterToggle.isFallbackManualOverride === true,
          'Single click on #vision-fallback-toggle-btn after store.navigate("battle") switches cleanly to fallback (no duplicate listener)'
        );

        // triggerColosseumDeflect(true) does not trigger a synchronous render
        const rendersBeforeDeflect = renderCount;
        store.triggerColosseumDeflect(true);
        check(renderCount === rendersBeforeDeflect, 'store.triggerColosseumDeflect(true) suppresses full-DOM notify() re-render');

        // Real Defeat -> #colosseum-defeat-retry-btn clears modal DOM, re-inits 3D canvas, re-attaches live <video>, and starts battle once (2x 1000ms intervals)
        document.getElementById('battle-quit-btn').click();
        await new Promise(r => setTimeout(r, 10));
        check(document.getElementById('colosseum-defeat-modal') !== null, 'Clicking #battle-quit-btn renders #colosseum-defeat-modal');
        check(store.getBossColosseumState().isDefeatModalOpen === true, 'Defeat modal sets col.isDefeatModalOpen=true while waiting');

        registeredIntervals.length = 0;
        const rendersBeforeRetry = renderCount;
        document.getElementById('colosseum-defeat-retry-btn').click();
        await new Promise(r => setTimeout(r, 25));
        const oneSecAfterRetry = registeredIntervals.filter(r => r.delay === 1000);
        const retryVideo = document.getElementById('ar-camera-feed');
        check(renderCount === rendersBeforeRetry + 1, `defeatRetryBtn triggers exactly 1 re-render (expected ${rendersBeforeRetry + 1}, got ${renderCount})`);
        check(document.getElementById('colosseum-defeat-modal') === null, 'defeatRetryBtn removes #colosseum-defeat-modal from DOM');
        check(store.getBossColosseumState().isDefeatModalOpen === false, 'defeatRetryBtn clears col.isDefeatModalOpen');
        check(oneSecAfterRetry.length === 2, `defeatRetryBtn starts battle only once (2x1000ms intervals, got ${oneSecAfterRetry.length})`);
        check(
          hanaBattle3DService.isDestroyed === false && hanaBattle3DService.isInitialized === true && hanaBattle3DService.animId !== null && hanaBattle3DService.canvas === document.getElementById('battle-webgl-canvas'),
          'defeatRetryBtn re-initializes active hanaBattle3DService on fresh #battle-webgl-canvas'
        );
        check(getBattleTelemetryState().isBattleRunning === true, 'defeatRetryBtn resumes active battle (isBattleRunning=true)');
        check(
          getBattleTelemetryState().isCameraActive === true && retryVideo && Boolean(retryVideo.srcObject) && !retryVideo.classList.contains('hidden'),
          'defeatRetryBtn re-attaches live <video id="ar-camera-feed"> stream on camera retry'
        );

        // 6D. Victory #colosseum-play-again-btn (including co-existing RewardModal)
        const oneSecForVictory = registeredIntervals.filter(r => r.delay === 1000);
        const victoryTick = oneSecForVictory[oneSecForVictory.length - 1].fn;
        for (let s = 0; s < 120; s++) victoryTick();
        check(document.getElementById('colosseum-victory-modal') !== null, '6D: 120s completion opens #colosseum-victory-modal');
        check(store.getBossColosseumState().hasAwardedVictory === true, '6D: 120s completion sets hasAwardedVictory=true');

        // Simulate level-up RewardModal open concurrently with VictoryModal
        store.state.rewardModal = { title: 'Level Up!', message: 'Hero Level 2!', coins: 0, xp: 0 };
        registeredIntervals.length = 0;
        const rendersBeforePlayAgain = renderCount;
        document.getElementById('colosseum-play-again-btn').click();
        await new Promise(r => setTimeout(r, 25));
        const oneSecAfterPlayAgain = registeredIntervals.filter(r => r.delay === 1000);
        check(renderCount === rendersBeforePlayAgain + 1, `6D: playAgainBtn triggers exactly 1 re-render (expected ${rendersBeforePlayAgain + 1}, got ${renderCount})`);
        check(document.getElementById('colosseum-victory-modal') === null, '6D: playAgainBtn removes #colosseum-victory-modal from DOM');
        check(store.state.rewardModal === null, '6D: playAgainBtn closes any co-existing RewardModal cleanly');
        check(
          store.getBossColosseumState().isVictoryModalOpen === false && store.getBossColosseumState().hasAwardedVictory === false && store.getBossColosseumState().victoryReward === null,
          '6D: playAgainBtn clears isVictoryModalOpen, hasAwardedVictory, and victoryReward'
        );
        check(oneSecAfterPlayAgain.length === 2, `6D: playAgainBtn starts battle only once (2x1000ms intervals, got ${oneSecAfterPlayAgain.length})`);
        check(
          hanaBattle3DService.isDestroyed === false && hanaBattle3DService.isInitialized === true && hanaBattle3DService.animId !== null && hanaBattle3DService.isVictory === false,
          '6D: playAgainBtn revives hanaBattle3DService with isVictory=false'
        );
        check(
          getBattleTelemetryState().isBattleRunning === true && getBattleTelemetryState().secondsRemaining === 120,
          '6D: playAgainBtn restarts 120s battle cleanly'
        );

        // 6E. Router Departure While Victory or Defeat Modal Is Open (no manual closeColosseum*Modal)
        const ticks6E = registeredIntervals.filter(r => r.delay === 1000);
        const victoryTick6E = ticks6E[ticks6E.length - 1].fn;
        for (let s = 0; s < 120; s++) victoryTick6E();
        check(store.getBossColosseumState().isVictoryModalOpen === true, '6E: Victory modal open before router departure');
        store.navigate('dashboard');
        const colAfterVicDep = store.getBossColosseumState();
        check(
          colAfterVicDep.isVictoryModalOpen === false && colAfterVicDep.hasAwardedVictory === false && colAfterVicDep.victoryReward === null,
          '6E: Router departure while Victory modal is open clears modal & victory flags'
        );
        store.navigate('battle');
        await new Promise(r => setTimeout(r, 25));
        check(
          document.getElementById('colosseum-victory-modal') === null && getBattleTelemetryState().isBattleRunning === true && hanaBattle3DService.isDestroyed === false && hanaBattle3DService.isVictory === false,
          '6E: Returning to BattleView after Victory modal departure starts a fresh battle with no stale modal'
        );

        // Repeat 6E with Defeat Modal open
        document.getElementById('battle-quit-btn').click();
        await new Promise(r => setTimeout(r, 10));
        check(store.getBossColosseumState().isDefeatModalOpen === true, '6E: Defeat modal open before router departure');
        store.navigate('dashboard');
        const colAfterDefDep = store.getBossColosseumState();
        check(
          colAfterDefDep.isDefeatModalOpen === false && colAfterDefDep.defeatInfo === null,
          '6E: Router departure while Defeat modal is open clears defeat modal & defeatInfo'
        );
        store.navigate('battle');
        await new Promise(r => setTimeout(r, 25));
        check(
          document.getElementById('colosseum-defeat-modal') === null && getBattleTelemetryState().isBattleRunning === true && hanaBattle3DService.isDestroyed === false,
          '6E: Returning to BattleView after Defeat modal departure starts a fresh battle with no stale modal'
        );

        // 6F. Mouthwash Ack + Repeat-Click Guard + Exit Buttons (#colosseum-visit-hq-btn & #colosseum-defeat-return-btn)
        const heroId = store.getSelectedHero().id;
        store.setHygieneReminder(heroId, 'mouthwash', true);
        const ticks6F = registeredIntervals.filter(r => r.delay === 1000);
        const victoryTick6F = ticks6F[ticks6F.length - 1].fn;
        for (let s = 0; s < 120; s++) victoryTick6F();
        const mwBtn = document.getElementById('mouthwash-modal-ack-btn');
        check(Boolean(mwBtn), '6F: #mouthwash-modal-ack-btn renders when mouthwash reminder is active');
        mwBtn.click();
        await new Promise(r => setTimeout(r, 15));
        check(
          store.hasAcknowledgedHygieneReminderToday(heroId, 'mouthwash') === true && document.getElementById('colosseum-victory-modal') !== null && hanaBattle3DService.isDestroyed === false,
          '6F: Clicking #mouthwash-modal-ack-btn acknowledges mouthwash while keeping Victory modal & 3D canvas alive'
        );
        const rendersAfterMwAck = renderCount;
        document.getElementById('mouthwash-modal-ack-btn')?.click();
        check(renderCount === rendersAfterMwAck, '6F: Repeat click on #mouthwash-modal-ack-btn is guarded (no duplicate notify)');
        document.getElementById('colosseum-visit-hq-btn').click();
        check(
          store.getState().activeView === 'hero_hq' && store.getBossColosseumState().isVictoryModalOpen === false && hanaBattle3DService.isDestroyed === true,
          '6F: #colosseum-visit-hq-btn navigates to hero_hq, closes modal, and destroys 3D service'
        );

        // Check #colosseum-defeat-return-btn guard & navigation
        store.navigate('battle');
        await new Promise(r => setTimeout(r, 20));
        document.getElementById('battle-quit-btn').click();
        await new Promise(r => setTimeout(r, 10));
        document.getElementById('colosseum-defeat-return-btn').click();
        check(
          store.getState().activeView === 'dashboard' && store.getBossColosseumState().isDefeatModalOpen === false && hanaBattle3DService.isDestroyed === true,
          '6F: #colosseum-defeat-return-btn closes defeat modal, navigates away, and destroys 3D service'
        );

        abandonBattleIfRunning();
      } finally {
        unsub();
        store.state.hygieneReminders = {};
      }
    }

    // 6B. flipCamera() recovery & 'audio'-to-camera upgrade stop prior audioStream track + 'audio' re-render keeps #ar-camera-feed hidden
    {
      const origAudioCtx2 = window.AudioContext;
      const origGlobalAudioCtx2 = globalThis.AudioContext;
      class MockMicAudioContext {
        constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
        resume() { return Promise.resolve(); }
        close() { this.state = 'closed'; return Promise.resolve(); }
        createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {} }; }
        createDynamicsCompressor() { return { threshold: { setValueAtTime() {} }, knee: { setValueAtTime() {} }, ratio: { setValueAtTime() {} }, attack: { setValueAtTime() {} }, release: { setValueAtTime() {} }, connect() {} }; }
        createOscillator() { return { type: 'sine', frequency: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
        createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
        createBiquadFilter() { return { type: 'bandpass', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { setValueAtTime() {} }, connect() {}, disconnect() {} }; }
        createAnalyser() { return { fftSize: 256, smoothingTimeConstant: 0.4, getFloatTimeDomainData(buf) { buf.fill(0); } }; }
      }
      window.AudioContext = MockMicAudioContext;
      globalThis.AudioContext = MockMicAudioContext;

      const audioTracksCreated = [];
      let failEnvCamera = true;
      let allowUserCamera = true;
      setMediaDevices({
        getUserMedia: async (constraints) => {
          if (constraints.video) {
            const facing = typeof constraints.video === 'object' ? constraints.video.facingMode : 'user';
            if ((facing === 'environment' && failEnvCamera) || !allowUserCamera) {
              const e = new Error('Camera unavailable');
              e.name = 'NotFoundError';
              throw e;
            }
            const vt = { stop: () => { vt.readyState = 'ended'; }, readyState: 'live', kind: 'video' };
            return { active: true, getTracks: () => [vt], getVideoTracks: () => [vt], getAudioTracks: () => [] };
          }
          if (constraints.audio) {
            const at = {
              stopped: false,
              readyState: 'live',
              kind: 'audio',
              stop() { this.stopped = true; this.readyState = 'ended'; }
            };
            audioTracksCreated.push(at);
            return { active: true, getTracks: () => [at], getVideoTracks: () => [], getAudioTracks: () => [at] };
          }
          throw new Error('Unexpected');
        }
      });

      // Part 1: flipCamera() recovery after 'environment' fails -> Step 4 mic -> recovers 'user'
      store.initColosseumBattle('sugar_bandit', 120);
      document.body.setMockHtml(renderBattleView());
      attachBattleListeners();
      await new Promise(r => setTimeout(r, 25));
      document.getElementById('camera-flip-btn').click();
      await new Promise(r => setTimeout(r, 40));
      const flipTelem = getBattleTelemetryState();
      check(
        flipTelem.isCameraActive === true && audioTracksCreated.length === 1 && audioTracksCreated[0].stopped === true,
        `flipCamera() recovery stops intermediate audio MediaStreamTrack (stopped=${audioTracksCreated[0]?.stopped})`
      );
      abandonBattleIfRunning();

      // Part 2: 'audio' mode re-render keeps #ar-camera-feed hidden + 'audio'-to-camera upgrade stops audio track
      allowUserCamera = false;
      store.initColosseumBattle('sugar_bandit', 120);
      document.body.setMockHtml(renderBattleView());
      attachBattleListeners();
      await new Promise(r => setTimeout(r, 30));
      // Simulate mid-battle re-render during 'audio' mode
      document.body.setMockHtml(renderBattleView());
      attachBattleListeners();
      const feedInAudio = document.getElementById('ar-camera-feed');
      check(feedInAudio && feedInAudio.classList.contains('hidden'), 'Mid-battle re-render in "audio" mode keeps #ar-camera-feed hidden');

      // Upgrade from 'audio' -> camera via #vision-fallback-toggle-btn
      allowUserCamera = true;
      document.getElementById('vision-fallback-toggle-btn').click();
      await new Promise(r => setTimeout(r, 30));
      const upgradeTelem = getBattleTelemetryState();
      const secondAudioTrack = audioTracksCreated[1];
      check(
        upgradeTelem.isCameraActive === true && secondAudioTrack && secondAudioTrack.stopped === true,
        `'audio'-to-camera toggle stops prior audio MediaStreamTrack cleanly (stopped=${secondAudioTrack?.stopped})`
      );
      abandonBattleIfRunning();

      window.AudioContext = origAudioCtx2;
      globalThis.AudioContext = origGlobalAudioCtx2;
    }

    // 6C. Clicking "🛡️ Non-Camera Mode" while sensorMode === 'initializing' cancels into fallback cleanly
    {
      let resolvePendingInit = null;
      let pendingGumCalls = 0;
      let lateInitTrackStopped = false;
      const lateInitTrack = {
        stop: () => { lateInitTrackStopped = true; lateInitTrack.readyState = 'ended'; },
        readyState: 'live',
        kind: 'video'
      };
      const lateInitStream = {
        active: true,
        getTracks: () => [lateInitTrack],
        getVideoTracks: () => [lateInitTrack],
        getAudioTracks: () => []
      };
      setMediaDevices({
        getUserMedia: () => {
          pendingGumCalls++;
          return new Promise((resolve) => { resolvePendingInit = resolve; });
        }
      });

      store.initColosseumBattle('sugar_bandit', 120);
      document.body.setMockHtml(renderBattleView());
      attachBattleListeners();

      const btnBefore = document.getElementById('vision-fallback-toggle-btn');
      const telemBefore = getBattleTelemetryState();
      check(
        telemBefore.sensorMode === 'initializing' && btnBefore?.textContent?.includes('Non-Camera Mode'),
        'While getUserMedia is pending, sensorMode==="initializing" and button shows "🛡️ Non-Camera Mode"'
      );

      btnBefore.click();
      await new Promise(r => setTimeout(r, 10));
      const telemAfterClick = getBattleTelemetryState();
      check(
        pendingGumCalls === 1 && telemAfterClick.sensorMode === 'fallback' && telemAfterClick.isFallbackManualOverride === true,
        `Clicking "🛡️ Non-Camera Mode" during initializing enters fallback without duplicate getUserMedia (calls=${pendingGumCalls})`
      );

      // Resolve pending getUserMedia and verify late tracks are stopped & camera stays off
      resolvePendingInit(lateInitStream);
      await new Promise(r => setTimeout(r, 20));
      const telemFinal = getBattleTelemetryState();
      const feedFinal = document.getElementById('ar-camera-feed');
      check(
        lateInitTrackStopped === true && telemFinal.isCameraActive === false && telemFinal.sensorMode === 'fallback' && feedFinal?.classList.contains('hidden'),
        'Late getUserMedia stream after initializing-cancel is stopped and camera remains inactive'
      );
      abandonBattleIfRunning();
    }
  } finally {
    global.setInterval = realSetInterval;
    global.clearInterval = realClearInterval;
    if (origMediaDevices !== undefined) {
      setMediaDevices(origMediaDevices);
    }
  }
}

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);
process.exit(failed > 0 ? 1 : 0);
