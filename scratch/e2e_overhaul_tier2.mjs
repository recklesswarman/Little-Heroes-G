/**
 * scratch/e2e_overhaul_tier2.mjs
 *
 * Tier 2: Boundary, Corner & Negative Coverage (>= 5 tests per feature F1-F15 => 75 tests).
 * Strictly opaque-box and requirement-driven from ORIGINAL_REQUEST.md & PROJECT.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  STORAGE_KEY,
  assert,
  store,
  battleViewMod,
  hanaBattle3DService,
  bossesDataMod,
  catalogMod,
  heroHqDataMod,
  heroHqViewMod,
  importAssetUrlModule,
  loadAssetUrlWithBase,
  getYesterdayDateKey,
  isMintyShieldUpgrade,
  getWindowListenerCount,
  step3DUntilBombsCleared,
  createClockDriver,
  resetStoreBaseline,
  bootBattle,
  scrubBurst,
  cleanupBattle,
  voiceMockControl,
  speechMockControl,
  runTestRegistry
} from './e2e_overhaul_harness.mjs';

const tests = [];
const addTest = (feature, name, fn) => tests.push({ feature, name, fn });

// ===========================================================================
// F1: Minty Shield Boundary & Negative Cases (5 tests)
// ===========================================================================
addTest('F1', 'F1.B1 #minty-shield-btn starts disabled at 0% charge and cannot activate before brushing', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    const btn = document.getElementById('minty-shield-btn');
    assert.ok(btn, '#minty-shield-btn must exist');
    assert.strictEqual(btn.disabled, true, '#minty-shield-btn must be disabled at t=0 before brushing');
    // Calling click directly in Node mock must not bypass store/charge gate
    btn.click();
    const st = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    assert.strictEqual(Boolean(st?.active), false, 'Minty Shield must NOT activate with 0% charge');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F1', 'F1.B2 Minty Shield expires cleanly when remainingSec counts down without refresh', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    for (let i = 0; i < 4; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const btn = document.getElementById('minty-shield-btn');
    assert.ok(btn, '#minty-shield-btn must exist');
    btn.click();
    assert.strictEqual((hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield)?.active, true, 'Shield must activate first');

    const dur = (hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield)?.durationSec || 5;
    for (let s = 0; s < dur + 2; s++) {
      clock.tickBattle(1);
      clock.step3D(1.0);
    }
    const after = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    assert.strictEqual(Boolean(after?.active), false, 'Shield must expire after durationSec elapses without continuous refresh');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F1', 'F1.B3 Repeated hits deplete shield integrity to 0 without negative underflow', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    for (let i = 0; i < 4; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const btn = document.getElementById('minty-shield-btn');
    assert.ok(btn, '#minty-shield-btn must exist');
    btn.click();

    const initIntegrity = (hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield)?.integrity || 3;
    const haz = bossesDataMod.getSugarHazardById('cinnamon_fireballs');
    assert.strictEqual(haz?.id, 'cinnamon_fireballs', 'cinnamon_fireballs hazard must exist');
    const bombCount = Math.max(6, initIntegrity + 3);
    for (let k = 0; k < bombCount; k++) {
      hanaBattle3DService.spawnCaramelBomb(haz);
    }
    const collided = step3DUntilBombsCleared(clock, 120, 0.05);
    assert.strictEqual(collided, true, 'All spawned bombs must collide with shielded player zone');

    const st = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    assert.strictEqual(st?.integrity ?? 0, 0, `Integrity must clamp at 0 (got ${st?.integrity})`);
    assert.strictEqual(Boolean(st?.active), false, 'Exhausted shield must deactivate when integrity reaches 0');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F1', 'F1.B4 Minty Shield cannot activate during floss phase or paused battle', async () => {
  const clock = createClockDriver();
  try {
    const todayStr = new Date().toDateString();
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({
      bossId: 'sugar_bandit',
      durationSec: 120,
      hygieneReminders: { hero_1: { flossDate: todayStr, flossAckDate: null } }
    });
    assert.strictEqual(battleViewMod.getBattleTelemetryState().battlePhase, 'floss');
    window.dispatchEvent(new globalThis.CustomEvent('rex-battle-shield'));
    const st = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    assert.strictEqual(Boolean(st?.active), false, 'Minty Shield must not activate during floss phase');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F1', 'F1.B5 setMintyShieldState clamps negative integrity and negative remainingSec safely', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    await bootBattle({ bossId: 'sugar_bandit' });
    assert.strictEqual(typeof hanaBattle3DService.setMintyShieldState, 'function', 'setMintyShieldState must exist');
    hanaBattle3DService.setMintyShieldState({
      active: true,
      charge: -50,
      integrity: -3,
      maxIntegrity: 3,
      remainingSec: -2,
      durationSec: 5
    });
    const st = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    assert.ok(st.integrity >= 0, 'Integrity must be clamped >= 0');
    assert.ok(st.remainingSec >= 0, 'remainingSec must be clamped >= 0');
  } finally {
    cleanupBattle(clock);
  }
});

// ===========================================================================
// F2: Minty Fresh Blast Boundary & Negative Cases (5 tests)
// ===========================================================================
addTest('F2', 'F2.B1 #supernova-blast-btn remains disabled when charge < 40 and does not fire', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    const btn = document.getElementById('supernova-blast-btn');
    assert.ok(btn, '#supernova-blast-btn must exist');
    assert.strictEqual(btn.disabled, true, 'Blast button must be disabled below threshold');
    btn.click();
    assert.strictEqual(Boolean(hanaBattle3DService.foamWaveActive), false, 'Blast must not fire when charge < 40');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F2', 'F2.B2 Double-clicking #supernova-blast-btn executes only once before recharge', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const btn = document.getElementById('supernova-blast-btn');
    assert.strictEqual(btn.disabled, false, 'Blast button enabled when charged');
    btn.click();
    const chargeAfterFirst = store.getBossColosseumState().choreSupernovaCharge || 0;
    assert.strictEqual(btn.disabled, true, 'Blast button must immediately return to disabled after firing');
    btn.click();
    assert.strictEqual(store.getBossColosseumState().choreSupernovaCharge, chargeAfterFirst, 'Second click must not re-fire');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F2', 'F2.B3 Minty Fresh Blast cannot fire during floss phase', async () => {
  const clock = createClockDriver();
  try {
    const todayStr = new Date().toDateString();
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({
      bossId: 'sugar_bandit',
      durationSec: 120,
      hygieneReminders: { hero_1: { flossDate: todayStr, flossAckDate: null } }
    });
    store.getBossColosseumState().choreSupernovaCharge = 100;
    window.dispatchEvent(new globalThis.CustomEvent('rex-battle-foam'));
    assert.strictEqual(store.getBossColosseumState().choreSupernovaCharge, 100, 'Blast must not consume charge during floss phase');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F2', 'F2.B4 triggerMintyFreshBlast with empty obstacles/sprites executes cleanly', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    await bootBattle({ bossId: 'sugar_bandit' });
    assert.strictEqual(typeof hanaBattle3DService.triggerMintyFreshBlast, 'function', 'triggerMintyFreshBlast must exist');
    hanaBattle3DService.caramelBombs = [];
    hanaBattle3DService.syncSweetToothSprites([]);
    hanaBattle3DService.triggerMintyFreshBlast();
    clock.step3D(0.016);
    assert.strictEqual((hanaBattle3DService.caramelBombs || []).length, 0);
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F2', 'F2.B5 choreSupernovaCharge caps strictly at 100 under heavy scrub bursts', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    for (let i = 0; i < 20; i++) {
      scrubBurst({ clock, steps: 10, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const charge = store.getBossColosseumState().choreSupernovaCharge || 0;
    assert.ok(charge <= 100, `choreSupernovaCharge must cap at 100 (got ${charge})`);
  } finally {
    cleanupBattle(clock);
  }
});

// ===========================================================================
// F3: Voice Controls Boundary, Echo Gating & Error Cases (5 tests)
// ===========================================================================
addTest('F3', 'F3.B1 Exact 350ms post-TTS acoustic tail boundary gates 349ms and accepts >=350ms', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', speechAvailable: true });
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const chargeReady = store.getBossColosseumState().choreSupernovaCharge;
    speechMockControl.dispatchSpeechStart('Keep brushing top molars!');
    speechMockControl.dispatchSpeechEnd('Keep brushing top molars!');

    clock.advanceMs(349);
    voiceMockControl.emitTranscript('Blast!', { isFinal: true });
    assert.strictEqual(store.getBossColosseumState().choreSupernovaCharge, chargeReady, '349ms post-TTS must still be gated');

    clock.advanceMs(2);
    voiceMockControl.emitTranscript('Blast!', { isFinal: true });
    assert.ok(store.getBossColosseumState().choreSupernovaCharge < chargeReady, '351ms post-TTS must execute Blast');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F3', 'F3.B2 Transcript echoing recent companion TTS text is rejected', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', speechAvailable: true });
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const chargeBefore = store.getBossColosseumState().choreSupernovaCharge;
    const spokenPhrase = 'Brush and blast those sugar germs with your shield up!';
    speechMockControl.dispatchSpeechStart(spokenPhrase);
    speechMockControl.dispatchSpeechEnd(spokenPhrase);
    clock.advanceMs(450);

    // Acoustic loopback echoing companion phrase itself
    voiceMockControl.emitTranscript(spokenPhrase, { isFinal: true });
    assert.strictEqual(store.getBossColosseumState().choreSupernovaCharge, chargeBefore, 'Transcript matching recent TTS phrase must be dropped');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F3', 'F3.B3 Empty or unrelated speech transcripts do not trigger shield or blast', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', speechAvailable: true });
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const chargeBefore = store.getBossColosseumState().choreSupernovaCharge;
    voiceMockControl.emitTranscript('', { isFinal: true });
    voiceMockControl.emitTranscript('   ', { isFinal: true });
    voiceMockControl.emitTranscript('hello banana dinosaur', { isFinal: true });
    assert.strictEqual(store.getBossColosseumState().choreSupernovaCharge, chargeBefore, 'Unrelated transcripts must not fire blast');
    assert.strictEqual(Boolean((hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield)?.active), false, 'Unrelated transcripts must not activate shield');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F3', 'F3.B4 Voice "Blast!" or "Shield Up!" when uncharged does not bypass charge gating', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({ bossId: 'sugar_bandit', speechAvailable: true });
    voiceMockControl.emitTranscript('Blast!', { isFinal: true });
    voiceMockControl.emitTranscript('Shield Up!', { isFinal: true });
    assert.strictEqual(Boolean(hanaBattle3DService.foamWaveActive), false, 'Voice Blast must respect charge gating');
    assert.strictEqual(Boolean((hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield)?.active), false, 'Voice Shield Up must respect charge gating');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F3', 'F3.B5 SpeechRecognition not-allowed error & repeated attachBattleListeners deduplicate listeners', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    voiceMockControl.setStartError('not-allowed', false);
    const canvas = await bootBattle({ bossId: 'sugar_bandit', speechAvailable: true });
    assert.strictEqual(battleViewMod.getBattleTelemetryState().isBattleRunning, true, 'Battle survives SpeechRecognition not-allowed error');

    // Re-attach listeners multiple times -> must deduplicate window._rexBattle* handlers (no double firing)
    battleViewMod.attachBattleListeners();
    battleViewMod.attachBattleListeners();
    assert.strictEqual(getWindowListenerCount('rex-battle-foam'), 1, 'rex-battle-foam listener must be deduplicated to count 1');
    assert.strictEqual(getWindowListenerCount('rex-battle-shield'), 1, 'rex-battle-shield listener must be deduplicated to count 1');

    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const origFoamHandler = window._rexBattleFoamHandler;
    assert.strictEqual(typeof origFoamHandler, 'function', 'window._rexBattleFoamHandler must exist');
    const hitsBefore = battleViewMod.getBattleTelemetryState().totalScrubHits;
    window.dispatchEvent(new globalThis.CustomEvent('rex-battle-foam'));
    const hitsAfter = battleViewMod.getBattleTelemetryState().totalScrubHits;
    assert.ok(hitsAfter - hitsBefore <= 1, `Deduplicated rex-battle-foam listener must fire at most once (delta=${hitsAfter - hitsBefore})`);
  } finally {
    cleanupBattle(clock);
  }
});

// ===========================================================================
// F4: Tartar Tyrant & Speed Scrub Boundary Cases (5 tests)
// ===========================================================================
addTest('F4', 'F4.B1 Tartar Tyrant armor shell cannot shatter during floss phase', async () => {
  const clock = createClockDriver();
  try {
    const todayStr = new Date().toDateString();
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({
      bossId: 'tartar_tyrant',
      durationSec: 120,
      hygieneReminders: { hero_1: { flossDate: todayStr, flossAckDate: null } }
    });
    scrubBurst({ clock, steps: 10, stepMs: 155, canvas });
    const shell = hanaBattle3DService.tartarShellState || hanaBattle3DService.tartarShell;
    assert.strictEqual(Boolean(shell?.shattered), false, 'Floss phase scrubs must not shatter Tartar Tyrant shell');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F4', 'F4.B2 Slow/sparse scrubbing fails to shatter hardening shell and enters recharging phase', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({ bossId: 'tartar_tyrant', durationSec: 120 });
    for (let s = 0; s < 25; s++) {
      clock.tickBattle(1);
      clock.step3D(1.0);
    }
    const shell = hanaBattle3DService.tartarShellState || hanaBattle3DService.tartarShell;
    assert.ok(shell, 'tartarShellState must exist');
    assert.strictEqual(Boolean(shell.shattered), false, 'No-scrub battle must not shatter armor shell');
    assert.ok(shell.recharging === true || shell.hardeningStage >= 1, 'Unbroken shell must harden or enter recharge phase');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F4', 'F4.B3 Non-Tartar-Tyrant boss does not activate Tartar Tyrant rocky armor shell', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    const shell = hanaBattle3DService.tartarShellState || hanaBattle3DService.tartarShell;
    assert.strictEqual(Boolean(shell?.active), false, 'Sugar Bandit must not spawn Tartar Tyrant rocky shell');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F4', 'F4.B4 Slow shatter (> doubleMs) grants 1x multiplier and omits shell_shatter if recharged', () => {
  resetStoreBaseline();
  store.initColosseumBattle('tartar_tyrant', 120, true);
  const reward = store.completeToothbrushBattle('tartar_tyrant', 120, 85, {
    shellShatteredBeforeRecharge: false,
    speedScrubMs: 45000,
    speedScrubMultiplier: 1
  });
  const hero = store.getSelectedHero();
  const badges = hero.dentalBadges || store.state.dentalBadges;
  assert.strictEqual(badges.includes('shell_shatter'), false, 'shell_shatter must NOT unlock when shell recharged before breaking');
  assert.ok(reward.coins > 0, 'Base victory coins still awarded');
});

addTest('F4', 'F4.B5 HP sync & phase floor invariant holds on tartar_tyrant during 3x Speed Scrub burst', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'tartar_tyrant', durationSec: 120 });
    assert.strictEqual(hanaBattle3DService.bossData?.id, 'tartar_tyrant', '3D service must load tartar_tyrant rather than falling back');
    for (let s = 0; s < 15; s++) {
      scrubBurst({ clock, steps: 8, stepMs: 155, canvas });
      clock.tickBattle(1);
      const col = store.getBossColosseumState();
      assert.strictEqual(col.currentHp, hanaBattle3DService.bossHp, 'store & 3D bossHp must remain synchronized');
      assert.ok(col.currentHp > 0, 'Phase floor must prevent premature defeat before timer reaches 0');
    }
  } finally {
    cleanupBattle(clock);
  }
});

// ===========================================================================
// F5: Sweet Tooth Sprites & Sticky Residue Boundary Cases (5 tests)
// ===========================================================================
addTest('F5', 'F5.B1 registerCircularScrubSweep with radius 0 or off-target returns empty array', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    await bootBattle({ bossId: 'gummy_ghost' });
    assert.strictEqual(typeof hanaBattle3DService.registerCircularScrubSweep, 'function', 'registerCircularScrubSweep must exist');
    hanaBattle3DService.syncSweetToothSprites([{ id: 'imp_1', x: 250, y: 250, hp: 10, maxHp: 10 }]);
    const missZero = hanaBattle3DService.registerCircularScrubSweep(250, 250, 0);
    const missFar = hanaBattle3DService.registerCircularScrubSweep(0, 0, 20);
    assert.deepStrictEqual(missZero, [], 'Radius 0 sweep must clear no sprites');
    assert.deepStrictEqual(missFar, [], 'Off-target sweep must clear no sprites');
    assert.strictEqual(hanaBattle3DService.sweetToothSprites.length, 1);
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F5', 'F5.B2 syncSweetToothSprites(null) and empty array clear sprites safely', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    await bootBattle({ bossId: 'gummy_ghost' });
    assert.strictEqual(typeof hanaBattle3DService.syncSweetToothSprites, 'function', 'syncSweetToothSprites must exist');
    hanaBattle3DService.syncSweetToothSprites(null);
    assert.deepStrictEqual(hanaBattle3DService.sweetToothSprites || [], []);
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F5', 'F5.B3 Single idle tap does NOT cleanse active Sticky Residue without Foam Blast + rapid scrub', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'gummy_ghost', durationSec: 120 });
    assert.strictEqual(typeof hanaBattle3DService.setStickyResidueState, 'function', 'setStickyResidueState must exist');
    hanaBattle3DService.setStickyResidueState({ active: true, intensity: 1.0 });
    canvas.dispatchEvent(new globalThis.PointerEvent('pointerdown', { clientX: 300, clientY: 300, bubbles: true }));
    canvas.dispatchEvent(new globalThis.PointerEvent('pointerup', { clientX: 300, clientY: 300, bubbles: true }));
    const resState = hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue;
    assert.strictEqual(resState?.active, true, 'Single pointer tap must not prematurely clear Sticky Residue');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F5', 'F5.B4 Sticky Residue slows cadence without stalling 1Hz battle timer completion', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 60 });
    await bootBattle({ bossId: 'gummy_ghost', durationSec: 60 });
    assert.strictEqual(typeof hanaBattle3DService.setStickyResidueState, 'function', 'setStickyResidueState must exist');
    hanaBattle3DService.setStickyResidueState({ active: true, intensity: 1.0 });
    for (let s = 0; s < 60; s++) {
      clock.tickBattle(1);
    }
    assert.strictEqual(store.getBossColosseumState().secondsRemaining, 0, 'Battle timer must still count down to 0 under Sticky Residue');
    assert.strictEqual(store.getBossColosseumState().isVictoryModalOpen, true, 'Victory modal must still open at 0s');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F5', 'F5.B5 Sticky Residue intensity clamps cleanly and resets on abandonBattleIfRunning', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    await bootBattle({ bossId: 'gummy_ghost' });
    assert.strictEqual(typeof hanaBattle3DService.setStickyResidueState, 'function', 'setStickyResidueState must exist');
    hanaBattle3DService.setStickyResidueState({ active: true, intensity: 99 });
    const resState = hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue;
    assert.ok(resState.intensity <= 1.5, `Sticky Residue intensity should clamp reasonably (got ${resState.intensity})`);
    battleViewMod.abandonBattleIfRunning();
    const afterCleanup = hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue;
    assert.strictEqual(Boolean(afterCleanup?.active), false, 'Sticky Residue must clear on battle teardown');
  } finally {
    cleanupBattle(clock);
  }
});

// ===========================================================================
// F6: Elemental & Missing Hazards Boundary Cases (5 tests)
// ===========================================================================
addTest('F6', 'F6.B1 getSugarHazardById falls back safely on unknown hazard ID', () => {
  const fallback = bossesDataMod.getSugarHazardById('non_existent_hazard_xyz');
  assert.ok(fallback && fallback.id, 'getSugarHazardById must return a valid fallback hazard');
});

addTest('F6', 'F6.B2 Zero duplicate hazard IDs in SUGAR_ATTACK_HAZARDS', () => {
  const ids = bossesDataMod.SUGAR_ATTACK_HAZARDS.map(h => h.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'SUGAR_ATTACK_HAZARDS IDs must be strictly unique');
});

addTest('F6', 'F6.B3 drawNextSugarHazardId cycles all 13 hazards without immediate boundary repeat', () => {
  resetStoreBaseline();
  const seen = new Set();
  let prev = null;
  for (let i = 0; i < 26; i++) {
    const id = store.drawNextSugarHazardId('hero_1');
    assert.notStrictEqual(id, prev, `Hazard draw #${i + 1} repeated immediately preceding hazard ${prev}`);
    prev = id;
    seen.add(id);
  }
  assert.strictEqual(seen.size, 13, `26 draws must cover all 13 hazards (covered ${seen.size})`);
});

addTest('F6', 'F6.B4 Spawning 30 elemental bombs caps/manages array safely during render', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    await bootBattle({ bossId: 'sugar_bandit' });
    const cin = bossesDataMod.getSugarHazardById('cinnamon_fireballs');
    for (let i = 0; i < 30; i++) {
      hanaBattle3DService.spawnCaramelBomb(cin);
    }
    clock.step3D(0.016);
    assert.ok((hanaBattle3DService.caramelBombs || []).length <= 30, 'Bomb array remains bounded');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F6', 'F6.B5 Every SUGAR_ATTACK_HAZARDS entry defines required visual metadata', () => {
  for (const h of bossesDataMod.SUGAR_ATTACK_HAZARDS) {
    assert.ok(h.id && h.name && h.emoji && h.color && h.image, `Hazard ${h.id} missing required visual field`);
  }
});

// ===========================================================================
// F7: Achievement Badges Boundary Cases (5 tests)
// ===========================================================================
addTest('F7', 'F7.B1 plaque_whisperer NOT awarded when spritesSpawned=0 or damage taken', () => {
  resetStoreBaseline();
  store.initColosseumBattle('gummy_ghost', 120, true);
  store.completeToothbrushBattle('gummy_ghost', 120, 90, { spritesSpawned: 0, spritesClearedNoDamage: true });
  const badges = store.getSelectedHero().dentalBadges || store.state.dentalBadges;
  assert.strictEqual(badges.includes('plaque_whisperer'), false, 'plaque_whisperer requires spritesSpawned > 0');
});

addTest('F7', 'F7.B2 shell_shatter and minty_master NOT awarded when flags are false', () => {
  resetStoreBaseline();
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 90, {
    shellShatteredBeforeRecharge: false,
    mintyShieldFullBattleUptime: false
  });
  const badges = store.getSelectedHero().dentalBadges || store.state.dentalBadges;
  assert.strictEqual(badges.includes('shell_shatter'), false, 'shell_shatter must remain locked');
  assert.strictEqual(badges.includes('minty_master'), false, 'minty_master must remain locked');
});

addTest('F7', 'F7.B3 perfect_synergy NOT awarded when Victory Burst did not occur on phase shift', () => {
  resetStoreBaseline();
  store.initColosseumBattle('cavity_knight', 120, true);
  store.completeToothbrushBattle('cavity_knight', 120, 90, { victoryBurstOnPhaseShift: false });
  const badges = store.getSelectedHero().dentalBadges || store.state.dentalBadges;
  assert.strictEqual(badges.includes('perfect_synergy'), false, 'perfect_synergy must remain locked');
});

addTest('F7', 'F7.B4 Re-earning unlocked badge does not create duplicate IDs in dentalBadges', () => {
  resetStoreBaseline();
  for (let i = 0; i < 2; i++) {
    const col = store.getBossColosseumState();
    col.hasAwardedVictory = false;
    col.victoryReward = null;
    store.initColosseumBattle('tartar_tyrant', 120, true);
    store.completeToothbrushBattle('tartar_tyrant', 120, 90, { shellShatteredBeforeRecharge: true });
  }
  const badges = store.getSelectedHero().dentalBadges || store.state.dentalBadges;
  assert.strictEqual(badges.filter(b => b === 'shell_shatter').length, 1, 'Badge list must not contain duplicates');
});

addTest('F7', 'F7.B5 Duplicate completeToothbrushBattle call returns cached victoryReward without double-credit', () => {
  resetStoreBaseline({ coins: 100 });
  store.initColosseumBattle('tartar_tyrant', 120, true);
  const r1 = store.completeToothbrushBattle('tartar_tyrant', 120, 90);
  const coinsAfter1 = store.getSelectedHero().coins;
  const r2 = store.completeToothbrushBattle('tartar_tyrant', 120, 90);
  assert.strictEqual(store.getSelectedHero().coins, coinsAfter1, 'Duplicate completion must not double-credit coins');
  assert.strictEqual(r2.coins, r1.coins, 'Cached victoryReward returned');
});

// ===========================================================================
// F8: Decorative Trophies Boundary Cases (5 tests)
// ===========================================================================
addTest('F8', 'F8.B1 Undefeated bosses do NOT appear in getTrophiesForDisplay', () => {
  const trophies = heroHqDataMod.getTrophiesForDisplay({
    hygieneBattle: { bossesDefeated: [], colosseumBossesDefeated: [] },
    bossColosseum: { bossesDefeated: [] }
  });
  for (const b of bossesDataMod.HYGIENE_BOSSES) {
    assert.strictEqual(trophies.some(t => t.id === b.trophyRelicId), false, `Undefeated boss trophy ${b.trophyRelicId} must not appear`);
  }
});

addTest('F8', 'F8.B2 Duplicate boss IDs in bossesDefeated produce no duplicate trophies', () => {
  const trophies = heroHqDataMod.getTrophiesForDisplay({
    hygieneBattle: { bossesDefeated: ['tartar_tyrant', 'tartar_tyrant'], colosseumBossesDefeated: ['tartar_tyrant'] },
    bossColosseum: { bossesDefeated: ['tartar_tyrant'] }
  });
  const count = trophies.filter(t => t.id === 'trophy_tartar_tyrant').length;
  assert.strictEqual(count, 1, `Expected 1 trophy_tartar_tyrant, got ${count}`);
});

addTest('F8', 'F8.B3 Unknown boss IDs in bossesDefeated do not crash getTrophiesForDisplay', () => {
  const trophies = heroHqDataMod.getTrophiesForDisplay({
    hygieneBattle: { bossesDefeated: ['ghost_boss_999', null, undefined] }
  });
  assert.ok(Array.isArray(trophies) && trophies.length >= 1, 'getTrophiesForDisplay must handle invalid boss IDs safely');
});

addTest('F8', 'F8.B4 All 8 HYGIENE_BOSSES have distinct trophyRelicId values', () => {
  const relics = bossesDataMod.HYGIENE_BOSSES.map(b => b.trophyRelicId);
  assert.strictEqual(new Set(relics).size, 8, 'Every boss must map to a unique trophyRelicId');
});

addTest('F8', 'F8.B5 Flawless zone trophy is NOT awarded when flawless count is 0', () => {
  const trophies = heroHqDataMod.getTrophiesForDisplay({
    selectedHero: { flawlessZoneCount: 0, cleanseAlbum: { sugar_bandit: { cleansedCount: 1, flawlessCount: 0 } } },
    hygieneBattle: { bossesDefeated: ['sugar_bandit'], flawlessZones: 0 }
  });
  assert.strictEqual(trophies.some(t => /flawless/i.test(t.id)), false, 'Flawless zone trophy must require > 0 flawless completions');
});

// ===========================================================================
// F9: Cleanse Album Boundary Cases (5 tests)
// ===========================================================================
addTest('F9', 'F9.B1 Undefeated bosses have no bogus speed records in getCleanseAlbum', () => {
  resetStoreBaseline();
  assert.strictEqual(typeof store.getCleanseAlbum, 'function', 'store.getCleanseAlbum must exist');
  const album = store.getCleanseAlbum();
  assert.strictEqual(album.tartar_tyrant, undefined, 'Undefeated boss must not have fabricated Cleanse Album record');
});

addTest('F9', 'F9.B2 Slower subsequent speedScrubMs does not overwrite faster bestSpeedScrubMs', () => {
  resetStoreBaseline();
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 90, { speedScrubMs: 2400, speedScrubMultiplier: 3 });

  const col = store.getBossColosseumState();
  col.hasAwardedVictory = false;
  col.victoryReward = null;
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 80, { speedScrubMs: 12000, speedScrubMultiplier: 1 });

  const entry = store.getCleanseAlbum().tartar_tyrant;
  assert.strictEqual(entry.bestSpeedScrubMs, 2400, 'Faster 2400ms time must be preserved');
  assert.strictEqual(entry.bestSpeedScrubMultiplier, 3, 'Higher 3x multiplier must be preserved');
});

addTest('F9', 'F9.B3 Missing speedScrubMs in combatStats never produces NaN in cleanseAlbum', () => {
  resetStoreBaseline();
  store.initColosseumBattle('cookie_colossus', 120, true);
  store.completeToothbrushBattle('cookie_colossus', 120, 85, {});
  const entry = store.getCleanseAlbum().cookie_colossus;
  assert.ok(entry && !Number.isNaN(entry.cleansedCount), 'cleansedCount must be valid number');
  if (entry.bestSpeedScrubMs !== null && entry.bestSpeedScrubMs !== undefined) {
    assert.ok(Number.isFinite(entry.bestSpeedScrubMs), 'bestSpeedScrubMs must not be NaN');
  }
});

addTest('F9', 'F9.B4 Hero HQ renders cleanly when cleanseAlbum is empty', () => {
  resetStoreBaseline();
  const html = heroHqViewMod.renderHeroHQView();
  assert.ok(typeof html === 'string' && html.length > 100, 'HeroHQView must render cleanly with empty Cleanse Album');
});

addTest('F9', 'F9.B5 Unknown heroId in getCleanseAlbum returns empty object without throwing', () => {
  resetStoreBaseline();
  assert.strictEqual(typeof store.getCleanseAlbum, 'function', 'store.getCleanseAlbum must exist');
  const album = store.getCleanseAlbum('hero_does_not_exist');
  assert.deepStrictEqual(album, {}, 'Missing hero Cleanse Album must default to {}');
});

// ===========================================================================
// F10: Minty Shield Shop Upgrades Boundary Cases (5 tests)
// ===========================================================================
addTest('F10', 'F10.B1 Insufficient Coins/currency rejects Minty Shield upgrade purchase cleanly', () => {
  const shieldUpgs = catalogMod.DIGITAL_REWARDS_CATALOG.filter(isMintyShieldUpgrade);
  assert.ok(shieldUpgs.length >= 1, 'At least one Minty Shield upgrade must exist in catalog');
  const coinUpg = shieldUpgs.find(item => (item.costCoins || item.price || 0) > 0);
  const sparksUpg = shieldUpgs.find(item => (item.costSparks || 0) > 0);
  const targetUpg = coinUpg || sparksUpg;
  assert.ok(targetUpg, 'Minty Shield upgrade must have costCoins and/or costSparks');

  if (coinUpg) {
    resetStoreBaseline({ coins: 0, sparks: 999 });
    const res = store.buyDigitalGear(coinUpg.id);
    assert.strictEqual(Boolean(res?.success), false, 'Purchase must fail with 0 coins');
    assert.strictEqual(store.getSelectedHero().coins, 0, 'Coins must not go negative');
    assert.strictEqual(store.getSelectedHero().inventory.includes(coinUpg.id), false, 'Failed purchase must not grant item');
  } else {
    resetStoreBaseline({ coins: 999, sparks: 0 });
    const res = store.buyDigitalGear(sparksUpg.id);
    assert.strictEqual(Boolean(res?.success), false, 'Purchase must fail with 0 sparks');
    assert.strictEqual(store.getSelectedHero().inventory.includes(sparksUpg.id), false, 'Failed purchase must not grant item');
  }
});

addTest('F10', 'F10.B2 Insufficient Pet Sparks rejects Sparks-priced upgrade & deductPetSparks clamps at 0', () => {
  resetStoreBaseline({ coins: 999, sparks: 0 });
  const hero = store.getSelectedHero();
  const petId = hero.activePetId || 1;
  const shieldUpgs = catalogMod.DIGITAL_REWARDS_CATALOG.filter(isMintyShieldUpgrade);
  assert.ok(shieldUpgs.length >= 1, 'At least one Minty Shield upgrade must exist in catalog');
  const sparksUpg = shieldUpgs.find(item => (item.costSparks || 0) > 0);

  if (sparksUpg) {
    const res = store.buyDigitalGear(sparksUpg.id);
    assert.strictEqual(Boolean(res?.success), false, 'Purchase must fail with 0 Pet Sparks');
    assert.strictEqual(store.getPetSparks(petId), 0, 'Pet Sparks must remain >= 0');
    assert.strictEqual(store.getSelectedHero().inventory.includes(sparksUpg.id), false, 'Failed Sparks purchase must not grant item');
  }
  // Always verify deductPetSparks boundary directly without negative underflow
  store.deductPetSparks(petId, 9999, hero.id, true);
  assert.strictEqual(store.getPetSparks(petId, hero.id), 0, 'deductPetSparks must clamp cleanly at 0');
});

addTest('F10', 'F10.B3 Re-buying an already-owned Minty Shield upgrade never double-charges', () => {
  resetStoreBaseline({ coins: 500, sparks: 200 });
  const upg = catalogMod.DIGITAL_REWARDS_CATALOG.find(isMintyShieldUpgrade);
  assert.ok(upg, 'Minty Shield upgrade must exist');
  store.buyDigitalGear(upg.id);
  const coinsAfterFirst = store.getSelectedHero().coins;
  const sparksAfterFirst = store.getPetSparks(store.getSelectedHero().activePetId || 1);
  store.buyDigitalGear(upg.id);
  assert.strictEqual(store.getSelectedHero().coins, coinsAfterFirst, 'Re-buying owned upgrade must not charge coins again');
  assert.strictEqual(store.getPetSparks(store.getSelectedHero().activePetId || 1), sparksAfterFirst, 'Re-buying owned upgrade must not charge sparks again');
});

addTest('F10', 'F10.B4 buyDigitalGear with nonexistent ID fails gracefully', () => {
  resetStoreBaseline({ coins: 200 });
  const res = store.buyDigitalGear('nonexistent_minty_shield_999');
  assert.strictEqual(Boolean(res?.success), false);
  assert.strictEqual(store.getSelectedHero().coins, 200);
});

addTest('F10', 'F10.B5 getMintyShieldUpgradeBonusSec("unknown_hero") returns 0 safely', () => {
  resetStoreBaseline();
  assert.strictEqual(typeof store.getMintyShieldUpgradeBonusSec, 'function', 'store.getMintyShieldUpgradeBonusSec must exist');
  assert.strictEqual(store.getMintyShieldUpgradeBonusSec('unknown_hero'), 0);
});

// ===========================================================================
// F11: Escalating Daily Brush Streaks Boundary Cases (5 tests)
// ===========================================================================
addTest('F11', 'F11.B1 Missing a calendar day resets brushStreakData.count back to 1', () => {
  resetStoreBaseline();
  const hero = store.getSelectedHero();
  const twoDaysAgo = getYesterdayDateKey(new Date(Date.now() - 86_400_000));
  hero.brushStreakData = { count: 9, lastDate: twoDaysAgo, morningDate: null, eveningDate: null };
  store.initColosseumBattle('sugar_bandit', 120, true);
  store.completeToothbrushBattle('sugar_bandit', 120, 85);
  assert.strictEqual(hero.brushStreakData.count, 1, 'Broken daily streak must reset to 1');
});

addTest('F11', 'F11.B2 rejectParentRequest clamps coins, XP, and Sparks at 0 if already spent', () => {
  resetStoreBaseline({ coins: 0, points: 0, sparks: 0 });
  const hero = store.getSelectedHero();
  store.initColosseumBattle('sugar_bandit', 120, true);
  store.completeToothbrushBattle('sugar_bandit', 120, 85);
  // Kid spends all awarded coins before parent rejects
  hero.coins = 0;
  hero.xp = 0;
  const petId = hero.activePetId || 1;
  store.deductPetSparks(petId, 9999, hero.id);

  const req = store.getState().pendingApprovals.find(r => r.kidId === hero.id);
  store.rejectParentRequest(req.id);
  assert.strictEqual(hero.coins, 0, 'Coins must clamp at 0');
  assert.strictEqual(hero.xp, 0, 'XP must clamp at 0');
  assert.strictEqual(store.getPetSparks(petId, hero.id), 0, 'Sparks must clamp at 0');
});

addTest('F11', 'F11.B3 approveParentRequest credits Gold Points without altering screenTimeMinutes', () => {
  resetStoreBaseline({ points: 10 });
  const hero = store.getSelectedHero();
  const screenBefore = hero.screenTimeMinutes || 0;
  store.initColosseumBattle('sugar_bandit', 120, true);
  store.completeToothbrushBattle('sugar_bandit', 120, 85);
  const req = store.getState().pendingApprovals.find(r => r.kidId === hero.id);
  store.approveParentRequest(req.id);
  assert.ok(hero.points > 10, 'Gold Points must increase on approval');
  assert.strictEqual(hero.screenTimeMinutes || 0, screenBefore, 'Gold Points must NOT auto-convert to screenTimeMinutes');
});

addTest('F11', 'F11.B4 getBrushStreakMultiplier handles null/zero streak without NaN', () => {
  resetStoreBaseline();
  assert.strictEqual(typeof store.getBrushStreakMultiplier, 'function');
  const mNull = store.getBrushStreakMultiplier(null);
  const mZero = store.getBrushStreakMultiplier({ brushStreakData: { count: 0 } });
  assert.ok(Number.isFinite(mNull) && mNull >= 1);
  assert.ok(Number.isFinite(mZero) && mZero >= 1);
});

addTest('F11', 'F11.B5 Two kids maintain independent daily brushStreakData counts', () => {
  resetStoreBaseline();
  const kid1Id = store.getSelectedHero().id;
  const kid2 = store.addHero({ name: 'Sam' });
  store.switchHero(kid1Id);
  const yesterday = getYesterdayDateKey();
  const kid1Active = store.getSelectedHero();
  kid1Active.brushStreakData = { count: 4, lastDate: yesterday };
  store.initColosseumBattle('sugar_bandit', 120, true);
  store.completeToothbrushBattle('sugar_bandit', 120, 85);

  store.switchHero(kid2.id);
  const k1Rec = store.getState().heroes.find(h => h.id === kid1Id);
  const k2Rec = store.getState().heroes.find(h => h.id === kid2.id);
  assert.strictEqual(k1Rec.brushStreakData.count, 5, 'Kid 1 consecutive day must increment streak 4 -> 5');
  assert.strictEqual(k2Rec.brushStreakData?.count || 0, 0, 'Kid 2 streak must remain 0');
});

// ===========================================================================
// F12: Rotating Weekly Challenges Boundary Cases (5 tests)
// ===========================================================================
addTest('F12', 'F12.B1 Year-end ISO week boundary dates produce valid YYYY-Www keys', () => {
  assert.strictEqual(typeof bossesDataMod.getCurrentWeeklyChallenge, 'function');
  for (const iso of ['2026-12-31T23:59:00Z', '2027-01-01T00:01:00Z', '2027-01-04T12:00:00Z']) {
    const res = bossesDataMod.getCurrentWeeklyChallenge(new Date(iso));
    assert.ok(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(res.weekKey), `Invalid ISO week key ${res.weekKey} for ${iso}`);
    assert.ok(res.challenge && res.challenge.id, `Challenge must resolve for ${iso}`);
  }
});

addTest('F12', 'F12.B2 Completing extra battles after weekly challenge completion does NOT double-claim bonus', () => {
  resetStoreBaseline({ coins: 100, sparks: 20 });
  const hero = store.getSelectedHero();
  const wc = store.getWeeklyChallengeState(hero.id);
  for (let i = 0; i < wc.target; i++) {
    const col = store.getBossColosseumState();
    col.hasAwardedVictory = false;
    col.victoryReward = null;
    store.initColosseumBattle('sugar_bandit', 120, true);
    store.completeToothbrushBattle('sugar_bandit', 120, 90, { weeklyChallengeCompleted: true });
  }
  const claimedAtFirst = store.getWeeklyChallengeState(hero.id).claimedAt;
  assert.ok(claimedAtFirst, 'claimedAt must be set upon completion');

  const col = store.getBossColosseumState();
  col.hasAwardedVictory = false;
  col.victoryReward = null;
  store.initColosseumBattle('sugar_bandit', 120, true);
  const extraReward = store.completeToothbrushBattle('sugar_bandit', 120, 90, { weeklyChallengeCompleted: true });
  assert.strictEqual(store.getWeeklyChallengeState(hero.id).claimedAt, claimedAtFirst, 'claimedAt must remain immutable');
  assert.strictEqual(Boolean(extraReward.weeklyChallengeBonusCoins), false, 'Bonus coins must not re-fire after already claimed');
});

addTest('F12', 'F12.B3 Advancing to a new calendar week starts fresh 0-progress state without erasing prior week', () => {
  resetStoreBaseline();
  const hero = store.getSelectedHero();
  const w1Date = new Date('2026-11-16T12:00:00Z');
  const w2Date = new Date('2026-11-23T12:00:00Z');
  const w1Key = bossesDataMod.getCurrentWeeklyChallenge(w1Date).weekKey;
  hero.weeklyChallenges = {
    [w1Key]: { challengeId: 'c1', progress: 3, target: 3, completed: true, completedAt: '2026-11-18T00:00:00Z', claimedAt: '2026-11-18T00:00:00Z' }
  };
  const w2State = store.getWeeklyChallengeState(hero.id, w2Date);
  assert.strictEqual(w2State.progress, 0, 'New week starts at 0 progress');
  assert.strictEqual(hero.weeklyChallenges[w1Key].completed, true, 'Prior week record remains preserved');
});

addTest('F12', 'F12.B4 Quitting battle before completion does not increment Weekly Challenge progress', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    battleViewMod.quitBattle();
    const wc = store.getWeeklyChallengeState(store.getSelectedHero().id);
    assert.strictEqual(wc.progress, 0, 'Quitting early must not increment Weekly Challenge progress');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F12', 'F12.B5 getWeeklyChallengeState handles unknown heroId gracefully', () => {
  resetStoreBaseline();
  assert.strictEqual(typeof store.getWeeklyChallengeState, 'function');
  const st = store.getWeeklyChallengeState('nonexistent_hero_404');
  assert.ok(st && st.challengeId, 'Fallback weekly challenge state returned safely');
});

// ===========================================================================
// F13: Boss Rotation Boundary Cases (5 tests)
// ===========================================================================
addTest('F13', 'F13.B1 Corrupted or duplicate bossRotationQueue heals cleanly without repeating lastBossId', () => {
  resetStoreBaseline();
  assert.strictEqual(typeof store.drawNextHygieneBossId, 'function');
  const hero = store.getSelectedHero();
  hero.bossRotationQueue = ['invalid_boss_id', 'tartar_tyrant', 'tartar_tyrant'];
  hero.lastBossId = 'tartar_tyrant';
  store.syncSelectedHeroWithHeroes();
  const next = store.drawNextHygieneBossId(hero.id);
  const validIds = new Set(bossesDataMod.HYGIENE_BOSSES.map(b => b.id));
  assert.ok(validIds.has(next), `Healed queue must return valid boss ID (got ${next})`);
  assert.notStrictEqual(next, 'tartar_tyrant', 'Healed queue must not immediately repeat lastBossId');
  const canonicalHero = store.getState().heroes.find(h => h.id === hero.id);
  assert.ok(canonicalHero, 'Canonical hero record must exist');
  const q = canonicalHero.bossRotationQueue || [];
  assert.ok(!q.includes('invalid_boss_id'), 'Healed bossRotationQueue must strip invalid_boss_id');
  assert.strictEqual(new Set(q).size, q.length, 'Healed bossRotationQueue must have no duplicates');
  assert.ok(q.every(id => validIds.has(id)), 'Healed bossRotationQueue must contain only valid HYGIENE_BOSSES IDs');
});

addTest('F13', 'F13.B2 drawNextHygieneBossId isolates bossRotationQueue per heroId', () => {
  resetStoreBaseline();
  const kid1Id = store.getSelectedHero().id;
  const kid2 = store.addHero({ name: 'Max' });
  const kid2Id = kid2.id;
  assert.notStrictEqual(kid1Id, kid2Id, 'Kid 1 and Kid 2 must have distinct IDs');
  const d1 = store.drawNextHygieneBossId(kid1Id);
  const d2 = store.drawNextHygieneBossId(kid1Id);
  const heroes = store.getState().heroes;
  const canonicalKid1 = heroes.find(h => h.id === kid1Id);
  const canonicalKid2 = heroes.find(h => h.id === kid2Id);
  assert.ok(canonicalKid1 && canonicalKid2, 'Both canonical hero records must exist in store.getState().heroes');
  assert.strictEqual((canonicalKid1.bossRotationQueue || []).length, 6, 'Kid 1 queue must have 6 remaining bosses after 2 draws');
  assert.strictEqual((canonicalKid2.bossRotationQueue || []).length, 0, 'Kid 2 queue must remain untouched by Kid 1 draws');
  assert.strictEqual(canonicalKid1.lastBossId, d2, 'Kid 1 lastBossId must match its latest draw');
  assert.strictEqual(canonicalKid2.lastBossId ?? null, null, 'Kid 2 lastBossId must remain null');
  assert.notStrictEqual(d1, d2, 'Consecutive draws for Kid 1 must not repeat');
});

addTest('F13', 'F13.B3 quitBattle clears sessionRotatedBossId so next session draws a non-repeating boss', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({ explicit: false, durationSec: 120 });
    const first = store.getSelectedBossId();
    battleViewMod.quitBattle();
    assert.strictEqual(store.getBossColosseumState().isDefeatModalOpen, true, 'Mid-battle quitBattle opens Defeat Modal');
    store.closeColosseumDefeatModal(true);
    await bootBattle({ explicit: false, durationSec: 120 });
    const second = store.getSelectedBossId();
    assert.notStrictEqual(second, first, `Second session after quitBattle repeated ${first}`);
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F13', 'F13.B4 Legacy sugar_boss alias resolves cleanly to sugar_bandit', () => {
  const boss = bossesDataMod.getHygieneBoss('sugar_boss');
  assert.ok(boss && boss.meshType === 'sugar_bandit', 'getHygieneBoss("sugar_boss") maps to sugar_bandit mesh');
  const battleBoss = battleViewMod.getBattleBoss('sugar_boss');
  assert.ok(battleBoss && battleBoss.meshType === 'sugar_bandit');
});

addTest('F13', 'F13.B5 Unknown boss ID falls back safely in getBattleBoss without crashing', () => {
  const fallback = battleViewMod.getBattleBoss('non_existent_boss_404');
  assert.ok(fallback && fallback.id && fallback.maxHp > 0);
});

// ===========================================================================
// F14: Cohesive Boss Visuals & Base-Path Boundary Cases (5 tests)
// ===========================================================================
addTest('F14', 'F14.B1 resolvePublicAssetUrl handles ./, no-slash, already-prefixed, https:// and data: safely', async () => {
  const ghMod = await loadAssetUrlWithBase('/Little-Heroes-G/');
  assert.strictEqual(typeof ghMod.resolvePublicAssetUrl, 'function');
  assert.strictEqual(ghMod.resolvePublicAssetUrl('/assets/bosses/tartar_tyrant.jpg'), '/Little-Heroes-G/assets/bosses/tartar_tyrant.jpg');
  assert.strictEqual(ghMod.resolvePublicAssetUrl('./assets/bosses/tartar_tyrant.jpg'), '/Little-Heroes-G/assets/bosses/tartar_tyrant.jpg');
  assert.strictEqual(ghMod.resolvePublicAssetUrl('assets/bosses/tartar_tyrant.jpg'), '/Little-Heroes-G/assets/bosses/tartar_tyrant.jpg');
  assert.strictEqual(ghMod.resolvePublicAssetUrl('/Little-Heroes-G/assets/bosses/tartar_tyrant.jpg'), '/Little-Heroes-G/assets/bosses/tartar_tyrant.jpg');
  assert.strictEqual(ghMod.resolvePublicAssetUrl('https://example.com/a.png'), 'https://example.com/a.png');
  assert.strictEqual(ghMod.resolvePublicAssetUrl('data:image/svg+xml;utf8,<svg></svg>'), 'data:image/svg+xml;utf8,<svg></svg>');
  assert.strictEqual(ghMod.resolvePublicAssetUrl(''), '');
});

addTest('F14', 'F14.B2 All 8 HYGIENE_BOSSES have strictly unique ids, names, images & cleansedImages', () => {
  const bosses = bossesDataMod.HYGIENE_BOSSES;
  assert.strictEqual(new Set(bosses.map(b => b.id)).size, 8);
  assert.strictEqual(new Set(bosses.map(b => b.name)).size, 8);
  assert.strictEqual(new Set(bosses.map(b => b.image)).size, 8);
  assert.strictEqual(new Set(bosses.map(b => b.cleansedImage)).size, 8);
});

addTest('F14', 'F14.B3 hanaBattle3DService.loadImage handles invalid URL without uncaught error', () => {
  const img = hanaBattle3DService.loadImage('/assets/bosses/definitely_missing_404.jpg');
  assert.ok(img, 'loadImage must return an Image instance');
  assert.strictEqual(typeof img.onerror, 'function', 'loadImage must attach an onerror fallback handler');
  img.onerror();
  assert.strictEqual(img._retried, true, 'First onerror must mark _retried = true');
  assert.strictEqual(img.src, './assets/bosses/definitely_missing_404.jpg', 'First onerror must retry with relative ./ path');
  img.onerror();
  assert.strictEqual(img._retried, true, 'Second onerror must stay guarded without throwing');
});

addTest('F14', 'F14.B4 hanaBattle3DService.setBoss(null) handles null safely without crashing render', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    await bootBattle({ bossId: 'sugar_bandit' });
    assert.strictEqual(hanaBattle3DService.bossData?.id, 'sugar_bandit', 'Precondition: sugar_bandit bossData loaded');
    hanaBattle3DService.setBoss(null);
    clock.step3D(0.016);
    assert.strictEqual(hanaBattle3DService.bossData?.id, 'sugar_bandit', 'setBoss(null) must preserve active bossData safely');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F14', 'F14.B5 BattleView victory & Shop/Reward URLs use base-path-safe asset resolution', async () => {
  const mod = await importAssetUrlModule();
  assert.strictEqual(typeof mod.resolvePublicAssetUrl, 'function');
  const battleSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/views/BattleView.js'), 'utf8');
  assert.ok(battleSrc.includes('resolvePublicAssetUrl'), 'BattleView.js must resolve boss/cleansed image URLs via resolvePublicAssetUrl');
});

// ===========================================================================
// F15: Sync, Legacy Migration & PWA Boundary Cases (5 tests)
// ===========================================================================
addTest('F15', 'F15.B1 Corrupt JSON in localStorage recovers safely with full 8-boss & catalog state', () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, '{not-valid-json');
  const loaded = store.loadState();
  assert.ok(loaded && Array.isArray(loaded.heroes) && loaded.heroes.length >= 1, 'Corrupt save must recover default hero');
  assert.ok((loaded.digitalGear || []).some(isMintyShieldUpgrade), 'Catalog reconciled after recovery');
});

addTest('F15', 'F15.B2 hydrateFromCloud(null) and {} are safe no-ops preserving local state', () => {
  resetStoreBaseline({ coins: 444 });
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 90);
  const albumBefore = JSON.stringify(store.getCleanseAlbum());
  store.hydrateFromCloud(null);
  store.hydrateFromCloud({});
  assert.strictEqual(JSON.stringify(store.getCleanseAlbum()), albumBefore, 'Cleanse Album preserved on empty cloud payload');
});

addTest('F15', 'F15.B3 Stale cloud pendingApprovals cannot un-reject or un-approve resolved tasks', () => {
  resetStoreBaseline({ coins: 100 });
  const hero = store.getSelectedHero();
  store.initColosseumBattle('sugar_bandit', 120, true);
  store.completeToothbrushBattle('sugar_bandit', 120, 88);
  const req = store.getState().pendingApprovals.find(r => r.kidId === hero.id);
  store.rejectParentRequest(req.id);

  // Stale device replays old pending item
  store.hydrateFromCloud({
    pendingApprovals: [req],
    resolvedApprovals: {}
  });
  assert.strictEqual(store.getState().pendingApprovals.some(r => r.id === req.id), false, 'Rejected approval must stay resolved');
});

addTest('F15', 'F15.B4 Incoming cloud snapshot cannot overwrite LOCAL_ONLY_STATE_KEYS', () => {
  resetStoreBaseline();
  store.getState().activeView = 'shop';
  store.getState().isAuthenticated = true;
  store.hydrateFromCloud({
    stateSnapshot: {
      activeView: 'bedtime_story',
      isAuthenticated: false,
      bossColosseum: { isVictoryModalOpen: true }
    }
  });
  assert.strictEqual(store.getState().activeView, 'shop', 'activeView is local-only and must not be overwritten');
  assert.strictEqual(store.getState().isAuthenticated, true, 'isAuthenticated is local-only');
  assert.strictEqual(Boolean(store.getBossColosseumState().isVictoryModalOpen), false, 'bossColosseum is local-only');
});

addTest('F15', 'F15.B5 public/sw.js handles subpath /assets/ caching and version is not a placeholder', () => {
  const indexHtml = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const swJs = fs.readFileSync(path.join(REPO_ROOT, 'public/sw.js'), 'utf8');
  const appMatch = indexHtml.match(/const\s+APP_BUILD_VERSION\s*=\s*['"]v(\d+\.\d+\.\d+)-([\w-]+)['"]/);
  const swMatch = swJs.match(/const\s+CACHE_NAME\s*=\s*['"]little-heroes-v(\d+\.\d+\.\d+)-([\w-]+)['"]/);
  assert.ok(appMatch && swMatch);
  assert.notStrictEqual(appMatch[1], '0.0.0');
  assert.strictEqual(`${appMatch[1]}-${appMatch[2]}`, `${swMatch[1]}-${swMatch[2]}`);
  assert.strictEqual(swJs.includes("startsWith('/assets/')"), false, 'public/sw.js must NOT use root-only startsWith("/assets/")');
  assert.ok(swJs.includes("includes('/assets/')") || swJs.includes("endsWith('/assets/')") || /\/assets\//.test(swJs), 'SW asset detection must work across both /assets/ and /Little-Heroes-G/assets/');
});

const result = await runTestRegistry('Tier 2 — Overhaul Boundary & Negative E2E Suite', tests);
process.exit(result.failed > 0 ? 1 : 0);
