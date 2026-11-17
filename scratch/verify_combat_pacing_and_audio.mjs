import './setup_mock_env.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Install a real EventTarget dispatcher on window before importing sfx/voiceService
// so companion-speech-start / companion-speech-end listeners fire genuinely.
{
  const listeners = new Map();
  globalThis.window.addEventListener = (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
  };
  globalThis.window.removeEventListener = (type, fn) => {
    listeners.get(type)?.delete(fn);
  };
  globalThis.window.dispatchEvent = (evt) => {
    const type = evt?.type;
    if (!type || !listeners.has(type)) return true;
    for (const fn of [...listeners.get(type)]) {
      fn(evt);
    }
    return true;
  };
}

const {
  renderBattleView,
  attachBattleListeners,
  abandonBattleIfRunning,
  getBattleTelemetryState
} = await import('../src/views/BattleView.js');
const { hanaBattle3DService } = await import('../src/services/hanaBattle3DService.js');
const { store } = await import('../src/state/store.js');
const { Sound } = await import('../src/audio/sfx.js');
const { voicePrompts } = await import('../src/utils/voicePrompts.js');
const { speakCompanion, workoutAudioClipCache, getAudioCacheKey } = await import('../src/services/voiceService.js');

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

console.log('\n🧪 Running R2 120s Combat Pacing, Gameplay Enhancements & R3 Audio Verification...\n');

// =========================================================================
// 1. FULL 120-SECOND (PLUS 60s & 180s) ACTIVE BRUSHING COMBAT PACING
// =========================================================================
console.log('--- 1. Simulating 120s, 60s, and 180s Active Brushing Battles ---');

async function simulateDuration(durationSec, equipLaser = true) {
  const registered = [];
  const realSetInterval = global.setInterval;
  const realClearInterval = global.clearInterval;
  const realDateNow = Date.now;
  let simNow = 1_700_000_000_000;
  Date.now = () => simNow;

  // Deterministic fake mediaDevices returning non-camera fallback or active video
  const origMediaDevices = globalThis.navigator?.mediaDevices;
  globalThis.navigator.mediaDevices = undefined;

  global.setInterval = (fn, delay) => {
    const id = realSetInterval(() => {}, 1 << 30);
    registered.push({ id, fn, delay });
    return id;
  };
  global.clearInterval = (id) => realClearInterval(id);

  // Spy voicePrompts.speak & Sound.zoneChime / speedUpBattleRhythm
  const speakCalls = [];
  const origSpeak = voicePrompts.speak.bind(voicePrompts);
  voicePrompts.speak = (txt, ...rest) => {
    speakCalls.push({ sec: store.getBossColosseumState().secondsRemaining, text: txt });
    return Promise.resolve();
  };
  let zoneChimes = 0;
  const origZoneChime = Sound.zoneChime;
  Sound.zoneChime = () => { zoneChimes++; };

  let speedUps = [];
  const origSpeedUp = Sound.speedUpBattleRhythm;
  Sound.speedUpBattleRhythm = (urgent) => { speedUps.push(urgent); };

  try {
    const hero = store.getSelectedHero();
    hero.equippedGear = equipLaser ? ['laser_toothbrush'] : [];
    hero.inventory = equipLaser ? ['laser_toothbrush'] : [];
    store.state.hygieneReminders = {};
    store.state.parentSettings.arBattleDuration = durationSec;
    store.initColosseumBattle('tartar_titan', durationSec);

    document.body.setMockHtml(renderBattleView());
    attachBattleListeners();
    await new Promise(r => setTimeout(r, 10));

    const oneSec = registered.filter(r => r.delay === 1000);
    const battleTick = oneSec[oneSec.length - 1].fn;
    const canvas = document.getElementById('battle-webgl-canvas');

    let earlyDefeat = false;
    let maxConcurrentProj = 0;
    let maxHpDesync = 0;
    let q1CleanAt3s = 0;
    const hpTimeline = [];
    const col = store.getBossColosseumState();
    const maxHp = col.maxHp;

    // Check t=0 initial HP sync between store and hanaBattle3DService
    maxHpDesync = Math.max(maxHpDesync, Math.abs(col.currentHp - hanaBattle3DService.bossHp));

    for (let elapsed = 0; elapsed < durationSec; elapsed++) {
      // Simulate continuous active scrubbing (8 bursts per second spaced by 125ms)
      for (let sub = 0; sub < 8; sub++) {
        simNow += 125;
        canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 300, clientY: 300 }));
        if (hanaBattle3DService.counterAttackProjectiles.length > maxConcurrentProj) {
          maxConcurrentProj = hanaBattle3DService.counterAttackProjectiles.length;
        }
        // Exercise real renderCounterAttackProjectiles() projectile expiry
        hanaBattle3DService.counterAttackProjectiles.forEach(p => { p.life = -0.01; });
        if (hanaBattle3DService.ctx && typeof hanaBattle3DService.renderCounterAttackProjectiles === 'function') {
          hanaBattle3DService.renderCounterAttackProjectiles(hanaBattle3DService.ctx, 0.016);
        } else {
          hanaBattle3DService.counterAttackProjectiles = [];
        }
        maxHpDesync = Math.max(maxHpDesync, Math.abs(store.getBossColosseumState().currentHp - hanaBattle3DService.bossHp));
      }

      // Exercise Supernova blast at 15s when charged
      if (elapsed === 15) {
        const novaBtn = document.getElementById('supernova-blast-btn');
        if (novaBtn && !novaBtn.disabled) {
          novaBtn.click();
          maxHpDesync = Math.max(maxHpDesync, Math.abs(store.getBossColosseumState().currentHp - hanaBattle3DService.bossHp));
        }
      }

      battleTick();
      const secsLeft = store.getBossColosseumState().secondsRemaining;
      const curHp = store.getBossColosseumState().currentHp;
      if (secsLeft > 0) {
        maxHpDesync = Math.max(maxHpDesync, Math.abs(curHp - hanaBattle3DService.bossHp));
      }
      if (elapsed === 2) {
        q1CleanAt3s = getBattleTelemetryState().quadrantCleanliness.q1;
      }
      hpTimeline.push({ secsLeft, curHp, maxHp });

      if (secsLeft > 0 && curHp <= 0) {
        earlyDefeat = true;
      }
      // Check phase floors at key ratios
      if (secsLeft > 0) {
        const ratio = secsLeft / durationSec;
        if (ratio > 0.75 && curHp < Math.ceil(maxHp * 0.75)) earlyDefeat = true;
        if (ratio > 0.50 && curHp < Math.ceil(maxHp * 0.50)) earlyDefeat = true;
        if (ratio > 0.25 && curHp < Math.ceil(maxHp * 0.25)) earlyDefeat = true;
        if (ratio > 0.083 && curHp < Math.ceil(maxHp * 0.10)) earlyDefeat = true;
      }
    }

    const telem = getBattleTelemetryState();
    const finalCol = store.getBossColosseumState();
    const finalHp = finalCol.currentHp;
    const isVictory = Boolean(finalCol.isVictoryModalOpen && finalCol.hasAwardedVictory);
    abandonBattleIfRunning();

    return {
      earlyDefeat,
      maxConcurrentProj,
      maxHpDesync,
      q1CleanAt3s,
      finalHp,
      isVictory,
      volleyCount: telem.volleyCount,
      zoneChimes,
      speedUps,
      speakCalls,
      hpTimeline
    };
  } finally {
    Date.now = realDateNow;
    global.setInterval = realSetInterval;
    global.clearInterval = realClearInterval;
    globalThis.navigator.mediaDevices = origMediaDevices;
    voicePrompts.speak = origSpeak;
    Sound.zoneChime = origZoneChime;
    Sound.speedUpBattleRhythm = origSpeedUp;
  }
}

const sim120 = await simulateDuration(120, true);
check(!sim120.earlyDefeat, '120s active battle never defeats boss early and respects all 5 quadrant HP floors');
check(sim120.finalHp === 0 && sim120.isVictory, '120s battle cleanses boss to 0 HP and opens victory modal at 00:00');
check(sim120.maxHpDesync === 0, `store.bossColosseum.currentHp and hanaBattle3DService.bossHp stay 100% synced (maxDesync=${sim120.maxHpDesync})`);
check(sim120.q1CleanAt3s > 0 && sim120.q1CleanAt3s < 30, `quadrantCleanliness.q1 does not inflate to 100% in <=3s under manual+sensor flood (q1@3s=${sim120.q1CleanAt3s})`);
check(sim120.maxConcurrentProj <= 6, `Max concurrent on-screen projectiles capped <= 6 (got ${sim120.maxConcurrentProj})`);
const avgHz = sim120.volleyCount / 120;
check(avgHz >= 0.8 && avgHz <= 1.8, `120s volley fire rate balanced near ~1.33 Hz (got ${avgHz.toFixed(2)} Hz, ${sim120.volleyCount} volleys)`);
check(sim120.zoneChimes >= 4, `QuadPacer played >= 4 zone chimes across Q1->Q5 (got ${sim120.zoneChimes})`);
check(sim120.speedUps.includes(true), 'Q5 final 10s activated Sound.speedUpBattleRhythm(true)');
const halfwaySpeaks = sim120.speakCalls.filter(s => s.sec === 60 || s.text.includes('Halfway'));
check(halfwaySpeaks.length === 1, `60s halfway prompt fires cleanly once without self-cancellation (got ${halfwaySpeaks.length})`);

// Verify passive Non-Camera Fallback 120s battle has zero same-tick shield vs zone voice cancellations at 90s / 30s
{
  const passiveRegistered = [];
  const realSetInt = global.setInterval;
  const realClrInt = global.clearInterval;
  const origMd = globalThis.navigator?.mediaDevices;
  globalThis.navigator.mediaDevices = undefined;
  global.setInterval = (fn, delay) => {
    const id = realSetInt(() => {}, 1 << 30);
    passiveRegistered.push({ id, fn, delay });
    return id;
  };
  global.clearInterval = (id) => realClrInt(id);
  const voiceLog = [];
  const origSpeak2 = voicePrompts.speak.bind(voicePrompts);
  const origShieldSpeak = voicePrompts.speakShieldActive.bind(voicePrompts);
  voicePrompts.speak = (txt) => {
    voiceLog.push({ sec: store.getBossColosseumState().secondsRemaining, kind: 'zone', txt });
    return Promise.resolve();
  };
  voicePrompts.speakShieldActive = (bossName) => {
    voiceLog.push({ sec: store.getBossColosseumState().secondsRemaining, kind: 'shield', txt: bossName });
    return Promise.resolve();
  };
  try {
    store.state.hygieneReminders = {};
    store.state.parentSettings.arBattleDuration = 120;
    store.initColosseumBattle('sugar_bandit', 120);
    document.body.setMockHtml(renderBattleView());
    attachBattleListeners();
    await new Promise(r => setTimeout(r, 10));
    const oneSec = passiveRegistered.filter(r => r.delay === 1000);
    const tickFn = oneSec[oneSec.length - 1].fn;
    for (let s = 0; s < 120; s++) tickFn();
    const sameTickCollisions = [];
    for (const sec of [90, 60, 30]) {
      const atSec = voiceLog.filter(v => v.sec === sec);
      if (atSec.length > 1) sameTickCollisions.push({ sec, count: atSec.length });
    }
    check(sameTickCollisions.length === 0, `Passive 120s fallback has zero same-tick shield/zone voice collisions at 90s/60s/30s (collisions=${JSON.stringify(sameTickCollisions)})`);
    abandonBattleIfRunning();
  } finally {
    global.setInterval = realSetInt;
    global.clearInterval = realClrInt;
    globalThis.navigator.mediaDevices = origMd;
    voicePrompts.speak = origSpeak2;
    voicePrompts.speakShieldActive = origShieldSpeak;
  }
}

const sim60 = await simulateDuration(60, true);
check(!sim60.earlyDefeat && sim60.isVictory, '60s duration-scaled battle paces cleanly across all quadrants');
check(sim60.maxHpDesync === 0, `60s store/3D service HP stay 100% synced (maxDesync=${sim60.maxHpDesync})`);
check(sim60.volleyCount > 0, `60s battle fires Warrior Tooth volleys cleanly (volleys=${sim60.volleyCount})`);
check(sim60.q1CleanAt3s > 0 && sim60.q1CleanAt3s < 30, `60s laser_toothbrush q1@3s stays < 30% (q1@3s=${sim60.q1CleanAt3s})`);

const sim180 = await simulateDuration(180, true);
check(!sim180.earlyDefeat && sim180.isVictory, '180s duration-scaled battle paces cleanly across all quadrants');
check(sim180.maxHpDesync === 0, `180s store/3D service HP stay 100% synced (maxDesync=${sim180.maxHpDesync})`);
check(sim180.volleyCount > 0, `180s battle fires Warrior Tooth volleys cleanly (volleys=${sim180.volleyCount})`);
check(sim180.q1CleanAt3s > 0 && sim180.q1CleanAt3s < 30, `180s laser_toothbrush q1@3s stays < 30% (q1@3s=${sim180.q1CleanAt3s})`);

// Post-Victory Router Replay: concludeVictory() -> abandonBattleIfRunning() -> navigate('battle') -> attachBattleListeners()
{
  const replayReg = [];
  const realSetIntR = global.setInterval;
  const realClrIntR = global.clearInterval;
  const origMdR = globalThis.navigator?.mediaDevices;
  const origSpeakR = voicePrompts.speak.bind(voicePrompts);
  globalThis.navigator.mediaDevices = undefined;
  voicePrompts.speak = () => Promise.resolve();
  global.setInterval = (fn, delay) => {
    const id = realSetIntR(() => {}, 1 << 30);
    replayReg.push({ id, fn, delay });
    return id;
  };
  global.clearInterval = (id) => realClrIntR(id);

  try {
    store.state.hygieneReminders = {};
    store.state.parentSettings.arBattleDuration = 60;
    store.initColosseumBattle('cavity_knight', 60);
    document.body.setMockHtml(renderBattleView());
    attachBattleListeners();
    await new Promise(r => setTimeout(r, 10));

    const oneSecR = replayReg.filter(r => r.delay === 1000);
    const tickR = oneSecR[oneSecR.length - 1].fn;
    for (let s = 0; s < 60; s++) tickR();
    check(hanaBattle3DService.isVictory === true, 'Post-victory replay prep: 1st battle sets hanaBattle3DService.isVictory=true');

    // Simulate router leaving BattleView after victory (via BottomNav/LiveRexWidget) then returning
    abandonBattleIfRunning();
    const colAfterAbandon = store.getBossColosseumState();
    check(
      hanaBattle3DService.isVictory === false && colAfterAbandon.isVictoryModalOpen === false && colAfterAbandon.hasAwardedVictory === false && colAfterAbandon.victoryReward === null,
      'abandonBattleIfRunning() after victory clears stale victory modal/reward flags and resets hanaBattle3DService.isVictory'
    );

    store.navigate('battle');
    document.body.setMockHtml(renderBattleView());
    attachBattleListeners();
    await new Promise(r => setTimeout(r, 10));

    const colReplay = store.getBossColosseumState();
    const replayDesync = Math.abs(colReplay.currentHp - hanaBattle3DService.bossHp);
    check(hanaBattle3DService.isVictory === false, 'Post-victory router replay resets hanaBattle3DService.isVictory=false');
    check(replayDesync === 0 && hanaBattle3DService.bossHp > 0, `Post-victory router replay syncs HP cleanly (store=${colReplay.currentHp}, service=${hanaBattle3DService.bossHp}, desync=${replayDesync})`);

    const replayCanvas = document.getElementById('battle-webgl-canvas');
    replayCanvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 300, clientY: 300 }));
    const replayTelem = getBattleTelemetryState();
    check(replayTelem.volleyCount > 0, `Post-victory router replay fires projectiles on scrub (volleyCount=${replayTelem.volleyCount})`);
    abandonBattleIfRunning();
  } finally {
    global.setInterval = realSetIntR;
    global.clearInterval = realClrIntR;
    globalThis.navigator.mediaDevices = origMdR;
    voicePrompts.speak = origSpeakR;
  }
}

// Floss Phase Isolation & advanceToBrushPhase() Parity (Button + Natural 00:00 Expiry)
for (const transitionMode of ['button', 'expiry']) {
  const flossReg = [];
  const realSetIntF = global.setInterval;
  const realClrIntF = global.clearInterval;
  const realDateNowF = Date.now;
  let simNowF = 1_700_000_500_000;
  Date.now = () => simNowF;
  const origMdF = globalThis.navigator?.mediaDevices;
  const origSpeakF = voicePrompts.speak.bind(voicePrompts);
  globalThis.navigator.mediaDevices = undefined;
  voicePrompts.speak = () => Promise.resolve();
  global.setInterval = (fn, delay) => {
    const id = realSetIntF(() => {}, 1 << 30);
    flossReg.push({ id, fn, delay });
    return id;
  };
  global.clearInterval = (id) => realClrIntF(id);

  let unsubF = null;
  try {
    const hero = store.getSelectedHero();
    store.state.hygieneReminders = {};
    store.setHygieneReminder(hero.id, 'floss', true);
    store.state.parentSettings.arBattleDuration = 60;
    store.state.activeView = 'battle';

    unsubF = store.subscribe(() => {
      if (store.getState().activeView === 'battle') {
        document.body.setMockHtml(renderBattleView());
        attachBattleListeners();
      }
    });

    document.body.setMockHtml(renderBattleView());
    attachBattleListeners();
    await new Promise(r => setTimeout(r, 15));

    const startTelem = getBattleTelemetryState();
    check(
      startTelem.battlePhase === 'floss' && startTelem.secondsRemaining === 120 && startTelem.totalDuration === 120,
      `Floss isolation (${transitionMode}): launches in battlePhase='floss' with 120s timer`
    );
    check(
      document.getElementById('floss-banner-container') !== null && document.getElementById('boss-hp-bar') === null,
      `Floss isolation (${transitionMode}): renders floss HUD without brush #boss-hp-bar`
    );

    const oneSecF = flossReg.filter(r => r.delay === 1000);
    const assistTickF = oneSecF[0].fn;
    const battleTickF = oneSecF[oneSecF.length - 1].fn;
    const flossCanvas = document.getElementById('battle-webgl-canvas');

    // Attack inputs during floss: autoAssist, battleTicks, pointerdown/move, rex-battle-foam, rex-battle-shield
    const ticksToRun = transitionMode === 'expiry' ? 119 : 10;
    for (let i = 0; i < ticksToRun; i++) {
      simNowF += 2500;
      assistTickF();
      battleTickF();
      if (i < 10) {
        flossCanvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 250, clientY: 250 }));
        flossCanvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 270, clientY: 260 }));
        window.dispatchEvent(new CustomEvent('rex-battle-foam'));
        window.dispatchEvent(new CustomEvent('rex-battle-shield'));
      }
    }

    const colDuringFloss = store.getBossColosseumState();
    const telemDuringFloss = getBattleTelemetryState();
    check(
      colDuringFloss.currentHp === colDuringFloss.maxHp && colDuringFloss.isShieldActive === false && hanaBattle3DService.bossHp === colDuringFloss.maxHp,
      `Floss isolation (${transitionMode}): zero Boss HP / shield leak during floss (hp=${colDuringFloss.currentHp}/${colDuringFloss.maxHp})`
    );
    check(
      Object.values(telemDuringFloss.quadrantCleanliness).every(v => v === 0) && telemDuringFloss.totalScrubHits === 0 && telemDuringFloss.volleyCount === 0 && hanaBattle3DService.counterAttackProjectiles.length === 0,
      `Floss isolation (${transitionMode}): zero cleanliness, scrub hits, or projectile leaks during floss`
    );

    if (transitionMode === 'button') {
      document.getElementById('battle-done-floss-btn').click();
    } else {
      battleTickF(); // 120th tick -> secondsRemaining reaches 0 -> advanceToBrushPhase()
    }
    await new Promise(r => setTimeout(r, 15));

    const brushTelem = getBattleTelemetryState();
    const brushCol = store.getBossColosseumState();
    check(
      brushTelem.battlePhase === 'brush' && brushTelem.secondsRemaining === 60 && brushTelem.totalDuration === 60,
      `Floss->Brush (${transitionMode}): switches cleanly to brush phase with arBattleDuration=60`
    );
    check(
      brushCol.currentHp === brushCol.maxHp && hanaBattle3DService.bossHp === brushCol.maxHp && Object.values(brushTelem.quadrantCleanliness).every(v => v === 0),
      `Floss->Brush (${transitionMode}): resets Boss HP to 100% (${brushCol.currentHp}/${brushCol.maxHp}) and cleanliness to 0`
    );
    check(
      document.getElementById('floss-banner-container') === null && document.getElementById('boss-hp-bar') !== null && document.getElementById('active-zone-banner') !== null && document.getElementById('supernova-hud') !== null,
      `Floss->Brush (${transitionMode}): re-renders brush HUD (#boss-hp-bar, #active-zone-banner, #supernova-hud)`
    );
    check(
      hanaBattle3DService.isDestroyed === false && hanaBattle3DService.animId !== null && store.shouldShowHygieneReminder(hero.id, 'floss') === false,
      `Floss->Brush (${transitionMode}): 3D canvas remains live and floss reminder acknowledged`
    );

    abandonBattleIfRunning();
  } finally {
    if (unsubF) unsubF();
    store.state.hygieneReminders = {};
    Date.now = realDateNowF;
    global.setInterval = realSetIntF;
    global.clearInterval = realClrIntF;
    globalThis.navigator.mediaDevices = origMdF;
    voicePrompts.speak = origSpeakF;
  }
}

// =========================================================================
// 2. EXPLORER PALETTE COMPLIANCE ON NEW/MODIFIED CODE
// =========================================================================
console.log('\n--- 2. Checking Zero Purple/Pink Policy in New Vision Module & UI ---');
{
  const visionSrc = fs.readFileSync('src/services/brushVisionTracker.js', 'utf8');
  const battleSrc = fs.readFileSync('src/views/BattleView.js', 'utf8');
  const forbiddenRegex = /#[0-9a-fA-F]{0,2}(?:800080|9b59b6|8e44ad|ff00ff|ec4899|a855f7|d946ef|c026d3|7e22ce|9333ea)/i;
  check(!forbiddenRegex.test(visionSrc), 'brushVisionTracker.js contains zero purple/pink HEX');
  // Check newly added UI sections in BattleView.js
  const newUiSlice = battleSrc.slice(battleSrc.indexOf('FLOATING MAGIC MIRROR PORTAL'), battleSrc.indexOf('DEFLECT FLURRY'));
  check(!forbiddenRegex.test(newUiSlice) && !/\b(purple|pink|fuchsia)-/i.test(newUiSlice), 'Newly added BattleView HUD (Vision, Shield, Supernova) obeys Zero Purple/Pink Explorer Palette');
}

// =========================================================================
// 3. R3 AUDIO BUS HIERARCHY, COMPRESSOR, LOWERED GAINS, DEBOUNCE & DUCKING
// =========================================================================
console.log('\n--- 3. Testing R3 Audio Normalization, Compressor, Debounce & Voice Ducking ---');
{
  const mix = Sound.getAudioMixConfig();
  check(mix.buses.master === 0.85, `Master bus target is 0.85 (got ${mix.buses.master})`);
  check(mix.buses.bgm === 0.35 && mix.buses.bgmDucked === 0.10, 'BGM bus target 0.35 and ducks to 0.10');
  check(mix.buses.battleSfx === 0.55 && mix.buses.battleSfxDucked === 0.25, 'Battle SFX bus target 0.55 and ducks to 0.25');
  check(mix.buses.voice === 0.95, 'Voice bus target is 0.95 (highest priority)');
  check(mix.compressor.threshold === -12 && mix.compressor.ratio === 10, 'Master DynamicsCompressorNode configured (-12 dB, ratio 10)');
  check(mix.battleSfxGains.laser <= 0.08, `laser gain lowered to <= 0.08 (got ${mix.battleSfxGains.laser})`);
  check(mix.battleSfxGains.hit <= 0.14, `hit gain lowered to <= 0.14 (got ${mix.battleSfxGains.hit})`);
  check(mix.battleSfxGains.shieldShatter <= 0.07, `shieldShatter gain lowered to <= 0.07 (got ${mix.battleSfxGains.shieldShatter})`);
  check(mix.rhythmGains.kick <= 0.18 && mix.rhythmGains.bass <= 0.09, 'Battle rhythm gains lowered (kick <= 0.18, bass <= 0.09)');
  check(mix.debouncesMs.laser >= 100 && mix.debouncesMs.hit >= 100, 'Rapid battle SFX debounces >= 100ms');

  // Install Spy Web Audio Context to verify real node wiring & ducking
  const created = { contexts: [], gains: [], compressors: [], filters: [], oscillators: [], bufferSources: [] };
  function makeParam(initial = 1) {
    return {
      value: initial,
      history: [],
      setValueAtTime(v, t) { this.value = v; this.history.push({ op: 'set', v, t }); },
      linearRampToValueAtTime(v, t) { this.value = v; this.history.push({ op: 'linear', v, t }); },
      exponentialRampToValueAtTime(v, t) { this.value = v; this.history.push({ op: 'exp', v, t }); },
      cancelScheduledValues() {}
    };
  }
  class SpyAudioContext {
    constructor(opts = {}) {
      this.currentTime = 1.0;
      this.sampleRate = opts.sampleRate || 44100;
      this.state = 'running';
      this.destination = { id: 'ctx.destination' };
      created.contexts.push(this);
    }
    resume() { return Promise.resolve(); }
    createBuffer(channels, length, sampleRate) {
      return { numberOfChannels: channels, length, sampleRate, copyToChannel() {} };
    }
    createBufferSource() {
      const node = {
        type: 'AudioBufferSourceNode',
        buffer: null,
        playbackRate: makeParam(1),
        detune: makeParam(0),
        connectedTo: [],
        connect(dest) { this.connectedTo.push(dest); return dest; },
        start() {},
        stop() {},
        disconnect() {}
      };
      created.bufferSources.push(node);
      return node;
    }
    createGain() {
      const node = {
        type: 'GainNode',
        gain: makeParam(1),
        connectedTo: [],
        connect(dest) { this.connectedTo.push(dest); return dest; }
      };
      created.gains.push(node);
      return node;
    }
    createDynamicsCompressor() {
      const node = {
        type: 'DynamicsCompressorNode',
        threshold: makeParam(-24),
        knee: makeParam(30),
        ratio: makeParam(12),
        attack: makeParam(0.003),
        release: makeParam(0.25),
        connectedTo: [],
        connect(dest) { this.connectedTo.push(dest); return dest; }
      };
      created.compressors.push(node);
      return node;
    }
    createBiquadFilter() {
      const node = {
        type: 'lowpass',
        frequency: makeParam(1000),
        Q: makeParam(1),
        connectedTo: [],
        connect(dest) { this.connectedTo.push(dest); return dest; }
      };
      created.filters.push(node);
      return node;
    }
    createOscillator() {
      const node = {
        type: 'sine',
        frequency: makeParam(440),
        connectedTo: [],
        connect(dest) { this.connectedTo.push(dest); return dest; },
        start() {},
        stop() {}
      };
      created.oscillators.push(node);
      return node;
    }
  }

  window.AudioContext = SpyAudioContext;
  Sound.setMute(false);

  // Wait past the 120ms laser debounce from earlier battle simulation pointerdown
  await new Promise(r => setTimeout(r, 150));

  // Trigger laser twice in < 5ms — debounce must allow only 1 oscillator!
  Sound.laser();
  const oscAfterFirst = created.oscillators.length;
  Sound.laser();
  const oscAfterSecond = created.oscillators.length;
  check(oscAfterFirst === 1 && oscAfterSecond === 1, 'Sound.laser() 120ms debounce blocks rapid duplicate trigger');
  check(created.compressors.length === 1, 'Master DynamicsCompressorNode created and wired in AudioContext');
  check(created.filters.some(f => f.type === 'lowpass'), 'Sound.laser() routes through lowpass filter to soften sawtooth');

  // Verify live bus values and speech ducking
  const liveMixBefore = Sound.getAudioMixConfig();
  check(liveMixBefore.liveBusValues?.hasCompressor === true, 'Live AudioContext confirms masterCompressor active');
  check(Math.abs(liveMixBefore.liveBusValues?.bgm - 0.35) < 0.001, 'Live bgmGain starts at 0.35');
  check(Math.abs(liveMixBefore.liveBusValues?.battleSfx - 0.55) < 0.001, 'Live battleSfxGain starts at 0.55');

  Sound.setBattleSpeechDucking(true);
  const liveDucked = Sound.getAudioMixConfig();
  check(liveDucked.isSpeechDucked === true, 'Speech ducking active');
  check(Math.abs(liveDucked.liveBusValues?.bgm - 0.10) < 0.001, 'bgmGain smoothly ducked to 0.10 during speech');
  check(Math.abs(liveDucked.liveBusValues?.battleSfx - 0.25) < 0.001, 'battleSfxGain smoothly ducked to 0.25 during speech');

  Sound.setBattleSpeechDucking(false);
  const liveRestored = Sound.getAudioMixConfig();
  check(Math.abs(liveRestored.liveBusValues?.bgm - 0.35) < 0.001, 'bgmGain restores to 0.35 after speech ends');
  check(Math.abs(liveRestored.liveBusValues?.battleSfx - 0.55) < 0.001, 'battleSfxGain restores to 0.55 after speech ends');

  // 3B. Regression: Dual-AudioContext protection & shared Sound.getAudioContext() via voiceService PCM TTS
  const contextsBeforeVoice = created.contexts.length;
  const foreignCtx = new SpyAudioContext({ sampleRate: 24000 });
  Sound.getVoiceGainNode(foreignCtx);
  window.dispatchEvent(new CustomEvent('companion-speech-start'));
  const duckedAfterForeign = Sound.getAudioMixConfig();
  check(
    Math.abs(duckedAfterForeign.liveBusValues?.bgm - 0.10) < 0.001 &&
    Math.abs(duckedAfterForeign.liveBusValues?.battleSfx - 0.25) < 0.001,
    'Foreign AudioContext passed to getVoiceGainNode() never clobbers primary speech ducking buses'
  );
  window.dispatchEvent(new CustomEvent('companion-speech-end'));

  // Test voiceService speakCompanion with cached PCM buffer shares Sound.getAudioContext()
  const countBeforePcm = created.contexts.length;
  const sourcesBeforePcm = created.bufferSources.length;
  const pcmKey = getAudioCacheKey('Scrub time', 1, 'default');
  workoutAudioClipCache.set(pcmKey, {
    audio: Buffer.from(new Int16Array([0, 1000, -1000, 0]).buffer).toString('base64'),
    sampleRate: 24000,
    voice: 'test-voice'
  });
  store.state.parentSettings.voicePromptsEnabled = true;
  await new Promise((resolve) => {
    speakCompanion('Scrub time', 1, () => resolve());
    setTimeout(() => {
      const src = created.bufferSources[created.bufferSources.length - 1];
      if (src && typeof src.onended === 'function') src.onended();
      resolve();
    }, 30);
  });
  check(
    created.bufferSources.length > sourcesBeforePcm && created.contexts.length === countBeforePcm,
    `voiceService PCM TTS plays via bufferSource (${sourcesBeforePcm} -> ${created.bufferSources.length}) and shares Sound.getAudioContext() (${countBeforePcm} -> ${created.contexts.length})`
  );

  // 3C. Regression: Sound.speedUpBattleRhythm(true) uses 211ms (142 BPM) and preserves speech ducking
  const rhythmDelays = [];
  const origSetIntAudio = global.setInterval;
  const origClrIntAudio = global.clearInterval;
  global.setInterval = (fn, delay) => {
    rhythmDelays.push(delay);
    return origSetIntAudio(() => {}, 1 << 30);
  };
  global.clearInterval = (id) => origClrIntAudio(id);
  try {
    Sound.startBattleRhythm();
    window.dispatchEvent(new CustomEvent('companion-speech-start'));
    Sound.speedUpBattleRhythm(true);
    const mixDuringFastSpeech = Sound.getAudioMixConfig();
    check(rhythmDelays.includes(254) && rhythmDelays.includes(211), `Sound.speedUpBattleRhythm(true) accelerates interval from 254ms (118 BPM) to 211ms (142 BPM) (delays=${JSON.stringify(rhythmDelays)})`);
    check(
      mixDuringFastSpeech.isSpeechDucked === true &&
      Math.abs(mixDuringFastSpeech.liveBusValues?.bgm - 0.10) < 0.001,
      'Sound.speedUpBattleRhythm(true) preserves active speech ducking'
    );
    window.dispatchEvent(new CustomEvent('companion-speech-end'));
    Sound.stopBattleRhythm();
  } finally {
    global.setInterval = origSetIntAudio;
    global.clearInterval = origClrIntAudio;
  }

  // 3D. Regression: Debounce >= 100ms on bossLunge, bossSplat, shieldDeflect
  for (const [fnName, label] of [['bossLunge', '120ms'], ['bossSplat', '100ms'], ['shieldDeflect', '100ms']]) {
    const before = created.oscillators.length;
    for (let k = 0; k < 8; k++) Sound[fnName]();
    const delta = created.oscillators.length - before;
    check(delta === 1, `Sound.${fnName}() ${label} debounce limits 8 rapid calls to 1 oscillator (got ${delta})`);
  }

  // 3E. Regression: Sound.levelUp() and Sound.pop() route through uiSfxGain -> masterCompressor (0 ctx.destination bypasses)
  const mainCtx = Sound.getAudioContext();
  const gainsBeforeUi = created.gains.length;
  Sound.pop();
  Sound.levelUp();
  const newUiGains = created.gains.slice(gainsBeforeUi);
  const directDestBypass = newUiGains.filter(g => g.connectedTo.includes(mainCtx.destination));
  check(newUiGains.length >= 8 && directDestBypass.length === 0, `Sound.pop() and Sound.levelUp() route through uiSfxGain -> masterCompressor with 0 direct ctx.destination bypasses (bypasses=${directDestBypass.length})`);

  // 3F. Regression: Sound.toggleMute() zeros masterGain immediately and restores 0.85 on unmute
  const mutedState = Sound.toggleMute();
  const mixMuted = Sound.getAudioMixConfig();
  check(mutedState === true && mixMuted.liveBusValues?.master === 0, `Sound.toggleMute() zeros masterGain (master=${mixMuted.liveBusValues?.master})`);
  const unmutedState = Sound.toggleMute();
  const mixUnmuted = Sound.getAudioMixConfig();
  check(unmutedState === false && Math.abs(mixUnmuted.liveBusValues?.master - 0.85) < 0.001, `Sound.toggleMute() restores masterGain to 0.85 (master=${mixUnmuted.liveBusValues?.master})`);
}

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);
process.exit(failed > 0 ? 1 : 0);
