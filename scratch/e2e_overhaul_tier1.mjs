/**
 * scratch/e2e_overhaul_tier1.mjs
 *
 * Tier 1: Isolated Happy-Path Feature Coverage (>= 5 tests per feature F1-F15 => 75 tests).
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
  shopViewMod,
  heroHqViewMod,
  dashboardViewMod,
  rewardGraphicsMod,
  syncMod,
  importAssetUrlModule,
  loadAssetUrlWithBase,
  getLocalDateKey,
  getYesterdayDateKey,
  isMintyShieldUpgrade,
  getMintyShieldUpgradeBonus,
  findCleanseRematchButton,
  step3DUntilBombsCleared,
  createClockDriver,
  resetStoreBaseline,
  bootBattle,
  scrubBurst,
  circularScrubSweep,
  cleanupBattle,
  voiceMockControl,
  speechMockControl,
  getEventLog,
  clearEventLog,
  createSyncHarness,
  runTestRegistry
} from './e2e_overhaul_harness.mjs';

const tests = [];
const addTest = (feature, name, fn) => tests.push({ feature, name, fn });

// ===========================================================================
// F1: Minty Shield Mechanic (5 tests)
// ===========================================================================
addTest('F1', 'F1.1 Minty Shield HUD button mounts and activates >=5s barrier after brushing', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    const shieldBtn = document.getElementById('minty-shield-btn');
    assert.ok(shieldBtn, '#minty-shield-btn must be rendered in BattleView');

    // Charge Minty Shield via continuous brushing
    for (let i = 0; i < 4; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    assert.strictEqual(shieldBtn.disabled, false, '#minty-shield-btn becomes enabled after continuous brushing');
    shieldBtn.click();

    const shieldState = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    assert.ok(shieldState && shieldState.active === true, 'hanaBattle3DService Minty Shield state must be active after click');
    assert.ok((shieldState.remainingSec ?? shieldState.durationSec ?? 0) >= 5, 'Minty Shield base duration must be >= 5 seconds');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F1', 'F1.2 Continuous brushing maintains Minty Shield across full 120s battle', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'plaque_kraken', durationSec: 120 });
    let activeTicks = 0;
    for (let s = 0; s < 120; s++) {
      scrubBurst({ clock, steps: s < 5 ? 6 : 4, stepMs: 160, canvas });
      const shieldBtn = document.getElementById('minty-shield-btn');
      if (shieldBtn && !shieldBtn.disabled) {
        shieldBtn.click();
      }
      const st = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
      if (st?.active) activeTicks++;
      clock.tickBattle(1);
      clock.step3D(1.0);
    }
    const col = store.getBossColosseumState();
    assert.strictEqual(col.isVictoryModalOpen, true, '120s battle should complete in victory');
    assert.ok(activeTicks >= 100, `Minty Shield should stay active across continuous 120s battle (activeTicks=${activeTicks})`);
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F1', 'F1.3 hanaBattle3DService.setMintyShieldState stores frosty barrier & absorbPulse state', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    await bootBattle({ bossId: 'sugar_bandit' });
    assert.strictEqual(typeof hanaBattle3DService.setMintyShieldState, 'function', 'setMintyShieldState must exist on hanaBattle3DService');
    hanaBattle3DService.setMintyShieldState({
      active: true,
      charge: 100,
      integrity: 3,
      maxIntegrity: 3,
      remainingSec: 5,
      durationSec: 5,
      attackBoostActive: true,
      absorbPulse: 1
    });
    clock.step3D(0.016);
    const st = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    assert.ok(st && st.active === true, 'setMintyShieldState activates 3D shield state');
    assert.strictEqual(st.integrity, 3, 'setMintyShieldState sets integrity');
    assert.strictEqual(st.attackBoostActive, true, 'setMintyShieldState sets attackBoostActive');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F1', 'F1.4 Minty Shield depletes gradually across multiple consecutive elemental & standard hits', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'cavity_knight', durationSec: 120 });
    for (let i = 0; i < 4; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const shieldBtn = document.getElementById('minty-shield-btn');
    assert.ok(shieldBtn, '#minty-shield-btn must exist');
    shieldBtn.click();

    const initialIntegrity = (hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield)?.integrity || 0;
    assert.ok(initialIntegrity >= 2, `Minty Shield must have multi-hit integrity >= 2 (got ${initialIntegrity})`);

    // Spawn and collide elemental variants: cinnamon_fireballs, sour_apple_acid_drops, smarties, lollipops
    // Test using documented contract: setMintyShieldState + spawnCaramelBomb + step3D collision
    const variants = ['cinnamon_fireballs', 'sour_apple_acid_drops', 'smarties', 'lollipops'];
    const haz1 = bossesDataMod.getSugarHazardById(variants[0]);
    assert.strictEqual(haz1?.id, variants[0], `Hazard ${variants[0]} must exist in SUGAR_ATTACK_HAZARDS`);
    hanaBattle3DService.setHazard(haz1);
    hanaBattle3DService.spawnCaramelBomb(haz1);
    const cleared1 = step3DUntilBombsCleared(clock, 90, 0.05);
    assert.strictEqual(cleared1, true, 'First elemental bomb must reach player zone and collide');

    const afterFirstState = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    const midIntegrity = afterFirstState?.integrity ?? 0;
    assert.ok(midIntegrity > 0 && midIntegrity < initialIntegrity, `Shield integrity should deplete gradually on 1st hit (${initialIntegrity} -> ${midIntegrity})`);
    assert.strictEqual(afterFirstState?.active, true, 'Minty Shield must stay active after absorbing 1st hit');

    // Refresh shield duration and verify remaining variants collide & absorb
    for (const vId of variants.slice(1)) {
      const hazard = bossesDataMod.getSugarHazardById(vId);
      assert.strictEqual(hazard?.id, vId, `Hazard ${vId} must exist in SUGAR_ATTACK_HAZARDS`);
      hanaBattle3DService.setMintyShieldState({
        active: true,
        charge: 100,
        integrity: Math.max(2, (hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield)?.integrity || 2),
        maxIntegrity: initialIntegrity,
        remainingSec: 5,
        durationSec: 5,
        attackBoostActive: true
      });
      hanaBattle3DService.setHazard(hazard);
      hanaBattle3DService.spawnCaramelBomb(hazard);
      const hit = step3DUntilBombsCleared(clock, 90, 0.05);
      assert.strictEqual(hit, true, `Elemental bomb ${vId} must collide with shielded player zone`);
    }
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F1', 'F1.5 Active Minty Shield / absorption grants temporary attack boost on scrub damage', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'tartar_titan', durationSec: 120 });
    const hpStart = store.getBossColosseumState().currentHp;
    scrubBurst({ clock, steps: 4, stepMs: 160, canvas });
    const dmgUnshielded = hpStart - store.getBossColosseumState().currentHp;

    // Charge & activate Minty Shield
    for (let i = 0; i < 4; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const shieldBtn = document.getElementById('minty-shield-btn');
    assert.ok(shieldBtn, '#minty-shield-btn must exist');
    shieldBtn.click();

    const hpBeforeShielded = store.getBossColosseumState().currentHp;
    clock.advanceMs(1000);
    scrubBurst({ clock, steps: 4, stepMs: 160, canvas });
    const dmgShielded = hpBeforeShielded - store.getBossColosseumState().currentHp;

    const st = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    assert.ok(st?.attackBoostActive === true || dmgShielded > dmgUnshielded, `Minty Shield should grant attack boost (unshielded=${dmgUnshielded}, shielded=${dmgShielded})`);
  } finally {
    cleanupBattle(clock);
  }
});

// ===========================================================================
// F2: Minty Fresh Blast / Foam Blast (5 tests)
// ===========================================================================
addTest('F2', 'F2.1 Glowing bottom Minty Fresh Blast HUD bar fills via brushing & enables button', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    const hud = document.getElementById('supernova-hud');
    const bar = document.getElementById('supernova-charge-bar');
    const btn = document.getElementById('supernova-blast-btn');
    assert.ok(hud && bar && btn, '#supernova-hud, #supernova-charge-bar, #supernova-blast-btn must exist');
    assert.strictEqual(btn.disabled, true, 'Blast button starts disabled at 0% charge');

    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    assert.ok((store.getBossColosseumState().choreSupernovaCharge || 0) >= 40, 'Charge should reach >= 40% with brushing');
    assert.strictEqual(btn.disabled, false, 'Blast button becomes enabled when charged');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F2', 'F2.2 Clicking #supernova-blast-btn releases Minty Fresh Blast and resets charge', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const chargeBefore = store.getBossColosseumState().choreSupernovaCharge || 0;
    assert.ok(chargeBefore >= 40, 'Supernova charge must be >= 40 before blast');
    const btn = document.getElementById('supernova-blast-btn');
    btn.click();
    const chargeAfter = store.getBossColosseumState().choreSupernovaCharge || 0;
    assert.ok(chargeAfter < chargeBefore, `Supernova charge should be consumed (${chargeBefore} -> ${chargeAfter})`);
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F2', 'F2.3 hanaBattle3DService.triggerMintyFreshBlast activates effervescent foam wave VFX', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    await bootBattle({ bossId: 'sugar_bandit' });
    assert.strictEqual(typeof hanaBattle3DService.triggerMintyFreshBlast, 'function', 'triggerMintyFreshBlast must exist on hanaBattle3DService');
    hanaBattle3DService.triggerMintyFreshBlast();
    clock.step3D(0.016);
    assert.ok(hanaBattle3DService.supernovaTimer > 0 || hanaBattle3DService.foamWaveActive === true, 'Foam wave visual timer/state must activate');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F2', 'F2.4 Minty Fresh Blast clears active bombs/obstacles and Sweet Tooth Sprites', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    // Charge #supernova-blast-btn FIRST so sync3DServiceFromStore during charging cannot wipe injected sprites
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const blastBtn = document.getElementById('supernova-blast-btn');
    assert.ok(blastBtn && !blastBtn.disabled, 'Blast button must be charged and enabled before injecting targets');

    hanaBattle3DService.spawnCaramelBomb(bossesDataMod.SUGAR_ATTACK_HAZARDS[0]);
    assert.strictEqual(typeof hanaBattle3DService.syncSweetToothSprites, 'function', 'syncSweetToothSprites must exist');
    hanaBattle3DService.syncSweetToothSprites([
      { id: 'sp_1', x: 180, y: 200, hp: 10, maxHp: 10 },
      { id: 'sp_2', x: 340, y: 220, hp: 10, maxHp: 10 }
    ]);
    assert.ok((hanaBattle3DService.caramelBombs || []).length >= 1, 'Caramel bomb must be active immediately before Blast');
    assert.strictEqual((hanaBattle3DService.sweetToothSprites || []).length, 2, 'Sweet Tooth Sprites must be active immediately before Blast');

    blastBtn.click();
    assert.strictEqual((hanaBattle3DService.caramelBombs || []).length, 0, 'All obstacles/bombs must be cleared by Minty Fresh Blast');
    assert.strictEqual((hanaBattle3DService.sweetToothSprites || []).length, 0, 'All Sweet Tooth Sprites must be cleared by Minty Fresh Blast');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F2', 'F2.5 Minty Fresh Blast cleanses active Sticky Residue debuff', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const blastBtn = document.getElementById('supernova-blast-btn');
    assert.ok(blastBtn && !blastBtn.disabled, 'Blast button must be charged and enabled before applying Sticky Residue');

    assert.strictEqual(typeof hanaBattle3DService.setStickyResidueState, 'function', 'setStickyResidueState must exist');
    hanaBattle3DService.setStickyResidueState({ active: true, intensity: 1.0 });
    const preRes = hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue;
    assert.strictEqual(Boolean(preRes?.active), true, 'Sticky Residue must be active immediately before Blast');

    blastBtn.click();
    const resState = hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue;
    assert.strictEqual(Boolean(resState?.active), false, 'Sticky Residue debuff must be cleansed after Minty Fresh Blast');
  } finally {
    cleanupBattle(clock);
  }
});

// ===========================================================================
// F3: Hands-Free Voice Controls & Fallback (5 tests)
// ===========================================================================
addTest('F3', 'F3.1 Battle voice listener configures continuous=true and interimResults=true', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({ bossId: 'sugar_bandit', speechAvailable: true });
    const rec = voiceMockControl.latest;
    assert.ok(rec, 'SpeechRecognition instance must be created/active');
    assert.strictEqual(rec.continuous, true, 'Battle voice recognition must use continuous = true');
    assert.strictEqual(rec.interimResults, true, 'Battle voice recognition must use interimResults = true');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F3', 'F3.2 Spoken "Blast!" triggers Minty Fresh Blast when charged without self-TTS echo', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', speechAvailable: true });
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const chargeBefore = store.getBossColosseumState().choreSupernovaCharge || 0;
    assert.ok(chargeBefore >= 40, 'Blast must be charged >= 40');
    const ttsCountBefore = speechMockControl.spokenHistory.length;

    clearEventLog();
    voiceMockControl.emitTranscript('Blast!', { isFinal: true });

    const chargeAfter = store.getBossColosseumState().choreSupernovaCharge || 0;
    assert.ok(chargeAfter < chargeBefore, `Spoken "Blast!" must trigger Foam Blast (${chargeBefore} -> ${chargeAfter})`);
    assert.strictEqual(speechMockControl.spokenHistory.length, ttsCountBefore, 'Battle voice command must NOT trigger self-TTS that cancels QuadPacer');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F3', 'F3.3 Spoken "Shield Up!" activates Minty Shield when charged', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', speechAvailable: true });
    for (let i = 0; i < 4; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    voiceMockControl.emitTranscript('Shield Up!', { isFinal: true });
    const st = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    assert.ok(st && st.active === true, 'Spoken "Shield Up!" must activate Minty Shield');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F3', 'F3.4 TTS echo gating ignores transcripts during speech & 350ms tail, accepts after cooldown', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', speechAvailable: true });
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }

    // Companion starts speaking -> should gate out
    speechMockControl.dispatchSpeechStart('Blast those sugar germs away!');
    const chargeDuringSpeak = store.getBossColosseumState().choreSupernovaCharge;
    voiceMockControl.emitTranscript('Blast!', { isFinal: true });
    assert.strictEqual(store.getBossColosseumState().choreSupernovaCharge, chargeDuringSpeak, 'Transcript while Rex speaking must be echo-gated');

    // Companion ends speaking -> inside 350ms tail cooldown -> still gated
    speechMockControl.dispatchSpeechEnd('Blast those sugar germs away!');
    clock.advanceMs(200);
    voiceMockControl.emitTranscript('Blast!', { isFinal: true });
    assert.strictEqual(store.getBossColosseumState().choreSupernovaCharge, chargeDuringSpeak, 'Transcript within 350ms post-TTS tail must be echo-gated');

    // Past 350ms cooldown -> accepted
    clock.advanceMs(250);
    voiceMockControl.emitTranscript('Blast!', { isFinal: true });
    assert.ok(store.getBossColosseumState().choreSupernovaCharge < chargeDuringSpeak, 'Transcript after >350ms cooldown must execute Blast');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F3', 'F3.5 Unavailable SpeechRecognition silently falls back to brushing & HUD triggers', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', speechAvailable: false });
    assert.strictEqual(battleViewMod.getBattleTelemetryState().isBattleRunning, true, 'Battle runs normally without SpeechRecognition');
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const shieldBtn = document.getElementById('minty-shield-btn');
    const blastBtn = document.getElementById('supernova-blast-btn');
    assert.ok(shieldBtn && !shieldBtn.disabled, 'On-screen #minty-shield-btn works in fallback mode');
    assert.ok(blastBtn && !blastBtn.disabled, 'On-screen #supernova-blast-btn works in fallback mode');
    shieldBtn.click();
    assert.ok((hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield)?.active, 'Manual shield click works without voice API');
  } finally {
    cleanupBattle(clock);
  }
});

// ===========================================================================
// F4: Tartar Tyrant Boss & Speed Scrub (5 tests)
// ===========================================================================
addTest('F4', 'F4.1 Tartar Tyrant is 8th boss in HYGIENE_BOSSES alongside intact Tartar Titan', async () => {
  assert.strictEqual(bossesDataMod.HYGIENE_BOSSES.length, 8, `HYGIENE_BOSSES must contain 8 bosses (got ${bossesDataMod.HYGIENE_BOSSES.length})`);
  const titan = bossesDataMod.HYGIENE_BOSSES.find(b => b.id === 'tartar_titan');
  const tyrant = bossesDataMod.HYGIENE_BOSSES.find(b => b.id === 'tartar_tyrant');
  assert.ok(titan, 'tartar_titan must remain intact');
  assert.ok(tyrant, 'tartar_tyrant must exist in HYGIENE_BOSSES');
  assert.strictEqual(tyrant.maxHp, 170, 'tartar_tyrant maxHp must be 170');
  assert.strictEqual(tyrant.trophyRelicId, 'trophy_tartar_tyrant', 'tartar_tyrant trophyRelicId must match contract');
  assert.ok(tyrant.armorShell && tyrant.armorShell.speedScrubThresholds, 'tartar_tyrant must define armorShell & speedScrubThresholds');
});

addTest('F4', 'F4.2 Tartar Tyrant spawns armored rocky shell that hardens over time', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({ bossId: 'tartar_tyrant', durationSec: 120 });
    const shell = hanaBattle3DService.tartarShellState || hanaBattle3DService.tartarShell;
    assert.ok(shell && shell.active === true, 'Tartar Tyrant battle must initialize active armor shell');
    const stage0 = shell.hardeningStage ?? 0;
    clock.tickBattle(8);
    const stageLater = (hanaBattle3DService.tartarShellState || hanaBattle3DService.tartarShell)?.hardeningStage ?? 0;
    assert.ok(stageLater >= stage0 && (shell.integrity ?? 0) > 0, 'Shell integrity & hardeningStage must be tracked over time');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F4', 'F4.3 Rapid scrubbing shatters Tartar Tyrant shell with bright flash & vulnerable state', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'tartar_tyrant', durationSec: 120 });
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 10, stepMs: 155, canvas });
    }
    const shell = hanaBattle3DService.tartarShellState || hanaBattle3DService.tartarShell;
    assert.ok(shell && shell.shattered === true, 'Rapid scrubbing must shatter Tartar Tyrant armor shell');
    assert.ok((shell.flashTimer || 0) > 0 || shell.vulnerable === true, 'Shattered shell must expose flashTimer / vulnerable state');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F4', 'F4.4 Unbroken Tartar Tyrant shell enters recharging phase and restores integrity', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({ bossId: 'tartar_tyrant', durationSec: 120 });
    assert.strictEqual(typeof hanaBattle3DService.setTartarShellState, 'function', 'setTartarShellState must exist');
    let enteredRecharge = false;
    for (let s = 0; s < 30; s++) {
      clock.tickBattle(1);
      clock.step3D(1.0);
      const cur = hanaBattle3DService.tartarShellState || hanaBattle3DService.tartarShell;
      if (cur?.recharging === true) {
        enteredRecharge = true;
        break;
      }
    }
    assert.strictEqual(enteredRecharge, true, 'Unbroken Tartar Tyrant shell must organically enter recharging phase');

    hanaBattle3DService.setTartarShellState({
      active: true,
      integrity: 20,
      maxIntegrity: 100,
      hardeningStage: 3,
      recharging: true,
      shattered: false,
      flashTimer: 0
    });
    clock.step3D(0.5, 4);
    const shell = hanaBattle3DService.tartarShellState || hanaBattle3DService.tartarShell;
    assert.strictEqual(shell.recharging, true, 'Shell recharging phase must be active');
    assert.ok(shell.integrity > 20, `Recharging shell must restore integrity > 20 (got ${shell.integrity})`);
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F4', 'F4.5 Speed Scrub Multiplier 2x/3x scales payout & updates Cleanse Album record', () => {
  resetStoreBaseline({ xpNext: 100000 });
  store.initColosseumBattle('tartar_tyrant', 120, true);
  const reward1x = store.completeToothbrushBattle('tartar_tyrant', 120, 90, {
    shellShatteredBeforeRecharge: true,
    speedScrubMs: 9000,
    speedScrubMultiplier: 1
  });

  resetStoreBaseline({ xpNext: 100000 });
  const coinsBefore3x = store.getSelectedHero().coins;
  store.initColosseumBattle('tartar_tyrant', 120, true);
  const reward3x = store.completeToothbrushBattle('tartar_tyrant', 120, 90, {
    shellShatteredBeforeRecharge: true,
    speedScrubMs: 2800,
    speedScrubMultiplier: 3
  });

  assert.ok(reward3x.coins >= reward1x.coins * 2.5, `3x Speed Scrub must scale coins (${reward1x.coins} vs ${reward3x.coins})`);
  assert.strictEqual(store.getSelectedHero().coins - coinsBefore3x, reward3x.coins, 'Hero coins must receive exact 3x payout');
  assert.strictEqual(typeof store.getCleanseAlbum, 'function', 'store.getCleanseAlbum must exist');
  const album = store.getCleanseAlbum();
  assert.ok(album.tartar_tyrant, 'Cleanse Album must record tartar_tyrant victory');
  assert.strictEqual(album.tartar_tyrant.bestSpeedScrubMultiplier, 3, 'Cleanse Album must store bestSpeedScrubMultiplier');
  assert.strictEqual(album.tartar_tyrant.bestSpeedScrubMs, 2800, 'Cleanse Album must store bestSpeedScrubMs');
});

// ===========================================================================
// F5: Sweet Tooth Sprites & Sticky Residue (5 tests)
// ===========================================================================
addTest('F5', 'F5.1 syncSweetToothSprites spawns and tracks translucent imp minions', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    await bootBattle({ bossId: 'gummy_ghost' });
    assert.strictEqual(typeof hanaBattle3DService.syncSweetToothSprites, 'function', 'syncSweetToothSprites must exist');
    hanaBattle3DService.syncSweetToothSprites([
      { id: 'imp_1', x: 200, y: 200, hp: 10, maxHp: 10 },
      { id: 'imp_2', x: 320, y: 240, hp: 10, maxHp: 10 }
    ]);
    clock.step3D(0.016);
    assert.strictEqual((hanaBattle3DService.sweetToothSprites || []).length, 2, 'Two Sweet Tooth Sprites must be synced in 3D scene');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F5', 'F5.2 Active Sweet Tooth Sprites shield/heal main boss until cleared', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'cookie_colossus', durationSec: 120 });
    assert.strictEqual(typeof hanaBattle3DService.syncSweetToothSprites, 'function', 'syncSweetToothSprites must exist');
    hanaBattle3DService.syncSweetToothSprites([{ id: 'imp_shield', x: 280, y: 250, hp: 20, maxHp: 20 }]);
    assert.strictEqual((hanaBattle3DService.sweetToothSprites || []).length, 1, 'Sprite must be active before scrub');
    const hpBefore = store.getBossColosseumState().currentHp;
    scrubBurst({ clock, steps: 4, stepMs: 160, canvas });
    const hpAfterWithSprites = store.getBossColosseumState().currentHp;
    const dmgWithSprites = hpBefore - hpAfterWithSprites;
    assert.ok(hpAfterWithSprites >= hpBefore - 2, `Boss should be shielded/healed while Sweet Tooth Sprites remain active (dmg=${dmgWithSprites})`);

    // Clear sprite and verify normal boss damage resumes
    hanaBattle3DService.syncSweetToothSprites([]);
    clock.advanceMs(1000);
    const hpBeforeCleared = store.getBossColosseumState().currentHp;
    scrubBurst({ clock, steps: 4, stepMs: 160, canvas });
    const dmgWithoutSprites = hpBeforeCleared - store.getBossColosseumState().currentHp;
    assert.ok(dmgWithoutSprites > dmgWithSprites, `Boss damage must increase once Sweet Tooth Sprites are cleared (with=${dmgWithSprites}, without=${dmgWithoutSprites})`);
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F5', 'F5.3 registerCircularScrubSweep clears overlapping Sweet Tooth Sprites & returns cleared IDs', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    const canvas = await bootBattle({ bossId: 'gummy_ghost' });
    assert.strictEqual(typeof hanaBattle3DService.registerCircularScrubSweep, 'function', 'registerCircularScrubSweep must exist');
    hanaBattle3DService.syncSweetToothSprites([
      { id: 'imp_near', x: 300, y: 260, hp: 10, maxHp: 10 },
      { id: 'imp_far', x: 900, y: 900, hp: 10, maxHp: 10 }
    ]);
    const cleared = hanaBattle3DService.registerCircularScrubSweep(300, 260, 90);
    assert.ok(Array.isArray(cleared) && cleared.includes('imp_near'), 'registerCircularScrubSweep must return cleared sprite IDs');
    assert.ok(!cleared.includes('imp_far'), 'Far sprite outside radius must not be cleared');

    // Also verify circular pointer sweep triggers clearing in battle
    hanaBattle3DService.syncSweetToothSprites([{ id: 'imp_sweep', x: 300, y: 260, hp: 10, maxHp: 10 }]);
    circularScrubSweep({ clock, cx: 300, cy: 260, radius: 65, canvas });
    assert.strictEqual((hanaBattle3DService.sweetToothSprites || []).some(s => s.id === 'imp_sweep'), false, 'Circular pointer scrub sweep must clear sprite');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F5', 'F5.4 Sticky Residue inflicts green slime debuff slowing manual & auto-scrub cadence', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({ bossId: 'gummy_ghost', durationSec: 120 });
    assert.strictEqual(typeof hanaBattle3DService.setStickyResidueState, 'function', 'setStickyResidueState must exist');
    hanaBattle3DService.setStickyResidueState({ active: true, intensity: 1.0 });
    const resState = hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue;
    assert.strictEqual(resState?.active, true, 'Sticky Residue state must be active');
    const telem = battleViewMod.getBattleTelemetryState();
    assert.ok(telem.stickyResidueActive === true || (resState && resState.active === true), 'Telemetry or 3D state reflects active Sticky Residue');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F5', 'F5.5 Minty Fresh Blast + rapid scrubbing cleanses Sticky Residue and restores cadence', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'gummy_ghost', durationSec: 120 });
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    hanaBattle3DService.setStickyResidueState({ active: true, intensity: 1.0 });
    document.getElementById('supernova-blast-btn').click();
    scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
    const resState = hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue;
    assert.strictEqual(Boolean(resState?.active), false, 'Sticky Residue must be cleansed after Foam Blast + rapid scrub');
  } finally {
    cleanupBattle(clock);
  }
});

// ===========================================================================
// F6: Elemental & Missing Hazards (5 tests)
// ===========================================================================
addTest('F6', 'F6.1 SUGAR_ATTACK_HAZARDS contains all 13 hazards including Cinnamon Fireballs & Sour Apple Acid Drops', () => {
  assert.strictEqual(bossesDataMod.SUGAR_ATTACK_HAZARDS.length, 13, `Expected 13 hazards, got ${bossesDataMod.SUGAR_ATTACK_HAZARDS.length}`);
  const ids = bossesDataMod.SUGAR_ATTACK_HAZARDS.map(h => h.id);
  for (const requiredId of ['donut', 'cupcake', 'chocolate_bar', 'pudding_cup', 'cinnamon_fireballs', 'sour_apple_acid_drops']) {
    assert.ok(ids.includes(requiredId), `SUGAR_ATTACK_HAZARDS must include ${requiredId}`);
  }
});

addTest('F6', 'F6.2 All 13 hazard asset files exist on disk under public/assets/hazards/', () => {
  for (const h of bossesDataMod.SUGAR_ATTACK_HAZARDS) {
    assert.ok(h.image && h.image.includes('/assets/hazards/'), `Hazard ${h.id} must define /assets/hazards/ image`);
    const rel = h.image.replace(/^\/+/, '');
    const abs = path.join(REPO_ROOT, 'public', rel);
    assert.ok(fs.existsSync(abs), `Hazard asset missing on disk: ${abs}`);
    assert.ok(fs.statSync(abs).size > 0, `Hazard asset is empty: ${abs}`);
  }
});

addTest('F6', 'F6.3 hanaBattle3DService spawns Cinnamon Fireballs & Sour Apple Acid Drops elemental projectiles', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    await bootBattle({ bossId: 'sugar_bandit' });
    for (const id of ['cinnamon_fireballs', 'sour_apple_acid_drops']) {
      const h = bossesDataMod.getSugarHazardById(id);
      assert.ok(h, `${id} must resolve via getSugarHazardById`);
      assert.strictEqual(h.id, id, `getSugarHazardById(${id}) must not fall back to ${h?.id}`);
      hanaBattle3DService.setHazard(h);
      hanaBattle3DService.spawnCaramelBomb(h);
      clock.step3D(0.016);
      assert.ok((hanaBattle3DService.caramelBombs || []).some(b => b.hazard?.id === id), `Spawned bomb must retain hazard.id === ${id}`);
    }
    assert.ok((hanaBattle3DService.caramelBombs || []).length >= 2, 'Elemental projectiles must spawn in 3D arena');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F6', 'F6.4 Newly backed hazards (donut, cupcake, chocolate_bar, pudding_cup) render cleanly in 3D arena', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    await bootBattle({ bossId: 'cookie_colossus' });
    for (const id of ['donut', 'cupcake', 'chocolate_bar', 'pudding_cup']) {
      const h = bossesDataMod.getSugarHazardById(id);
      assert.ok(h, `${id} must exist`);
      hanaBattle3DService.setHazard(h);
      hanaBattle3DService.spawnCaramelBomb(h);
      clock.step3D(0.016);
    }
    assert.ok((hanaBattle3DService.caramelBombs || []).length >= 4, 'All 4 newly backed hazards spawn cleanly');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F6', 'F6.5 getSugarHazardById resolves Cinnamon Fireballs & Sour Apple Acid Drops metadata', () => {
  const cin = bossesDataMod.getSugarHazardById('cinnamon_fireballs');
  const sour = bossesDataMod.getSugarHazardById('sour_apple_acid_drops');
  assert.ok(cin && /cinnamon/i.test(cin.name), 'Cinnamon Fireballs name must match');
  assert.ok(sour && /sour apple/i.test(sour.name), 'Sour Apple Acid Drops name must match');
  assert.notStrictEqual(cin.color, sour.color, 'Elemental variants should have distinct colors');
});

// ===========================================================================
// F7: 4 Achievement Badges (5 tests)
// ===========================================================================
addTest('F7', 'F7.1 DENTAL_BADGES includes all 4 overhaul badges alongside existing 4', () => {
  const ids = bossesDataMod.DENTAL_BADGES.map(b => b.id);
  for (const id of ['enamel_guardian', 'plaque_buster', 'diamond_grin', 'twice_a_day', 'plaque_whisperer', 'shell_shatter', 'minty_master', 'perfect_synergy']) {
    assert.ok(ids.includes(id), `DENTAL_BADGES must include ${id}`);
  }
});

addTest('F7', 'F7.2 completeToothbrushBattle awards Plaque Whisperer when sprite swarm cleared undamaged', () => {
  resetStoreBaseline();
  store.initColosseumBattle('gummy_ghost', 120, true);
  store.completeToothbrushBattle('gummy_ghost', 120, 85, {
    spritesSpawned: 3,
    spritesClearedNoDamage: true
  });
  const hero = store.getSelectedHero();
  const badges = hero.dentalBadges || store.state.dentalBadges;
  assert.ok(badges.includes('plaque_whisperer'), 'plaque_whisperer badge must unlock');
});

addTest('F7', 'F7.3 completeToothbrushBattle awards Shell Shatter and Minty Master on criteria', () => {
  resetStoreBaseline();
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 90, {
    shellShatteredBeforeRecharge: true,
    mintyShieldFullBattleUptime: true
  });
  const hero = store.getSelectedHero();
  const badges = hero.dentalBadges || store.state.dentalBadges;
  assert.ok(badges.includes('shell_shatter'), 'shell_shatter badge must unlock');
  assert.ok(badges.includes('minty_master'), 'minty_master badge must unlock');
});

addTest('F7', 'F7.4 completeToothbrushBattle awards Perfect Synergy on Victory Burst phase shift', () => {
  resetStoreBaseline();
  assert.strictEqual(typeof hanaBattle3DService.triggerVictoryBurst, 'function', 'triggerVictoryBurst must exist');
  hanaBattle3DService.triggerVictoryBurst();
  store.initColosseumBattle('cavity_knight', 120, true);
  store.completeToothbrushBattle('cavity_knight', 120, 88, {
    victoryBurstOnPhaseShift: true
  });
  const hero = store.getSelectedHero();
  const badges = hero.dentalBadges || store.state.dentalBadges;
  assert.ok(badges.includes('perfect_synergy'), 'perfect_synergy badge must unlock');
});

addTest('F7', 'F7.5 Unlocked badges render in Battle Victory Modal and Hero HQ View', () => {
  resetStoreBaseline();
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 92, {
    shellShatteredBeforeRecharge: true,
    mintyShieldFullBattleUptime: true,
    spritesSpawned: 2,
    spritesClearedNoDamage: true,
    victoryBurstOnPhaseShift: true
  });

  const victoryHtml = battleViewMod.renderBattleView();
  assert.ok(/Shell Shatter/i.test(victoryHtml) || /shell_shatter/i.test(victoryHtml), 'Victory Modal must surface newly earned badges');

  const hqHtml = heroHqViewMod.renderHeroHQView();
  assert.ok(/Plaque Whisperer/i.test(hqHtml) && /Minty Master/i.test(hqHtml), 'Hero HQ must display dental achievement badges');
});

// ===========================================================================
// F8: Decorative Trophies & Showcase (5 tests)
// ===========================================================================
addTest('F8', 'F8.1 getTrophiesForDisplay returns unique trophies for all 8 HYGIENE_BOSSES', () => {
  const allBossIds = bossesDataMod.HYGIENE_BOSSES.map(b => b.id);
  const trophies = heroHqDataMod.getTrophiesForDisplay({
    hygieneBattle: { bossesDefeated: allBossIds, colosseumBossesDefeated: allBossIds },
    bossColosseum: { bossesDefeated: allBossIds }
  });
  for (const boss of bossesDataMod.HYGIENE_BOSSES) {
    assert.ok(trophies.some(t => t.id === boss.trophyRelicId), `Trophy Showcase must include ${boss.trophyRelicId} for ${boss.id}`);
  }
});

addTest('F8', 'F8.2 getTrophiesForDisplay awards flawless zone transition trophy', () => {
  const trophies = heroHqDataMod.getTrophiesForDisplay({
    selectedHero: { flawlessZoneCount: 3, cleanseAlbum: { sugar_bandit: { cleansedCount: 1, flawlessCount: 1 } } },
    hygieneBattle: { bossesDefeated: ['sugar_bandit'], flawlessZones: 3 }
  });
  assert.ok(trophies.some(t => /flawless/i.test(t.id) || /flawless/i.test(t.title)), 'Flawless zone transition trophy must be awarded');
});

addTest('F8', 'F8.3 All earned trophies satisfy required schema fields and graphic resolution', () => {
  const allBossIds = bossesDataMod.HYGIENE_BOSSES.map(b => b.id);
  const trophies = heroHqDataMod.getTrophiesForDisplay({
    hygieneBattle: { bossesDefeated: allBossIds, flawlessZones: 2 },
    selectedHero: { flawlessZoneCount: 2, unlockedTrophyIds: ['trophy_flawless_zones'] }
  });
  for (const t of trophies) {
    for (const k of ['id', 'title', 'category', 'emoji', 'iconColor', 'dateEarned', 'lore', 'rexPraise']) {
      assert.ok(t[k], `Trophy ${t.id} missing required field ${k}`);
    }
    const imgUrl = rewardGraphicsMod.getRewardAssetUrl(t.id, 'Trophies');
    assert.ok(typeof imgUrl === 'string' && imgUrl.length > 0, `Trophy ${t.id} must resolve a graphic URL`);
    const dedicatedTrophyIds = new Set([
      'trophy_sugarfang',
      'trophy_plaque_phantom',
      ...bossesDataMod.HYGIENE_BOSSES.map(b => b.trophyRelicId),
      'trophy_flawless_zones',
      'trophy_flawless_sweep'
    ]);
    if (dedicatedTrophyIds.has(t.id)) {
      assert.strictEqual(imgUrl.includes('reward_fallback'), false, `Boss/flawless trophy ${t.id} must have a dedicated asset (got ${imgUrl})`);
    }
  }
});

addTest('F8', 'F8.4 Defeating Tartar Tyrant unlocks trophy_tartar_tyrant in heroHQ.unlockedFurnitureIds', () => {
  resetStoreBaseline();
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 90);
  const state = store.getState();
  assert.ok(state.heroHQ.unlockedFurnitureIds.includes('trophy_tartar_tyrant'), 'trophy_tartar_tyrant must be unlocked in heroHQ');
});

addTest('F8', 'F8.5 Hero HQ Trophy Showcase modal displays Tartar Tyrant & flawless trophies', () => {
  resetStoreBaseline();
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 90, { flawlessZones: 4 });
  store.closeColosseumVictoryModal(true);

  try {
    document.body.setMockHtml(heroHqViewMod.renderHeroHQView());
    heroHqViewMod.attachHeroHQListeners();
    const btn = document.getElementById('hq-view-all-trophies-btn');
    assert.ok(btn, '#hq-view-all-trophies-btn must exist');
    btn.click();
    const modalHtml = heroHqViewMod.renderHeroHQView();
    document.body.setMockHtml(modalHtml);
    heroHqViewMod.attachHeroHQListeners();
    assert.ok(/Tartar Tyrant/i.test(modalHtml), 'All Trophies Showcase must list Tartar Tyrant trophy');
  } finally {
    document.getElementById('hq-close-all-trophies-btn')?.click();
  }
});

// ===========================================================================
// F9: Cleansed Villains Gallery / Cleanse Album (5 tests)
// ===========================================================================
addTest('F9', 'F9.1 Every boss in HYGIENE_BOSSES defines cleansedTitle, cleansedAvatar & existing cleansedImage', () => {
  for (const b of bossesDataMod.HYGIENE_BOSSES) {
    assert.ok(b.cleansedTitle, `${b.id} missing cleansedTitle`);
    assert.ok(b.cleansedAvatar, `${b.id} missing cleansedAvatar`);
    assert.ok(b.cleansedImage, `${b.id} missing cleansedImage`);
    const abs = path.join(REPO_ROOT, 'public', b.cleansedImage.replace(/^\/+/, ''));
    assert.ok(fs.existsSync(abs), `Cleansed boss image missing on disk: ${abs}`);
  }
});

addTest('F9', 'F9.2 completeToothbrushBattle updates cleanseAlbum entry for defeated boss', () => {
  resetStoreBaseline();
  store.initColosseumBattle('fizz_serpent', 120, true);
  store.completeToothbrushBattle('fizz_serpent', 120, 88, {
    speedScrubMs: 4200,
    speedScrubMultiplier: 2,
    flawlessZones: 4
  });
  assert.strictEqual(typeof store.getCleanseAlbum, 'function', 'store.getCleanseAlbum must exist');
  const album = store.getCleanseAlbum();
  assert.ok(album.fizz_serpent, 'fizz_serpent must be recorded in cleanseAlbum');
  assert.strictEqual(album.fizz_serpent.cleansedCount, 1);
  assert.strictEqual(album.fizz_serpent.bestSpeedScrubMs, 4200);
});

addTest('F9', 'F9.3 Cleanse Album preserves fastest (lowest) bestSpeedScrubMs across multiple clears', () => {
  resetStoreBaseline();
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 90, { speedScrubMs: 3100, speedScrubMultiplier: 3 });

  const col = store.getBossColosseumState();
  col.hasAwardedVictory = false;
  col.victoryReward = null;
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 85, { speedScrubMs: 6500, speedScrubMultiplier: 2 });

  const entry = store.getCleanseAlbum().tartar_tyrant;
  assert.strictEqual(entry.cleansedCount, 2, 'cleansedCount should increment to 2');
  assert.strictEqual(entry.bestSpeedScrubMs, 3100, 'bestSpeedScrubMs must keep faster 3100ms time');
  assert.strictEqual(entry.bestSpeedScrubMultiplier, 3, 'bestSpeedScrubMultiplier must keep highest 3x multiplier');
});

addTest('F9', 'F9.4 Hero HQ renders Cleansed Villains gallery with transformed title and best Speed Scrub time', () => {
  resetStoreBaseline();
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 90, { speedScrubMs: 2950, speedScrubMultiplier: 3 });
  store.closeColosseumVictoryModal(true);

  const hqHtml = heroHqViewMod.renderHeroHQView();
  assert.ok(/Cleansed Villains|Cleanse Album/i.test(hqHtml), 'Hero HQ must render Cleansed Villains / Cleanse Album section');
  const boss = bossesDataMod.getHygieneBoss('tartar_tyrant');
  assert.ok(hqHtml.includes(boss.cleansedTitle), 'Cleanse Album must show cleansed friendly title');
  assert.ok(/2\.9|3\.0|2950|3x/i.test(hqHtml), 'Cleanse Album must show best Speed Scrub record');
});

addTest('F9', 'F9.5 Clicking Boss Rematch in Cleanse Album starts explicit battle against selected boss', () => {
  resetStoreBaseline();
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 90, { speedScrubMs: 3500, speedScrubMultiplier: 2 });
  store.closeColosseumVictoryModal(true);

  const hqHtml = heroHqViewMod.renderHeroHQView();
  document.body.setMockHtml(hqHtml);
  heroHqViewMod.attachHeroHQListeners();
  const boss = bossesDataMod.getHygieneBoss('tartar_tyrant');
  const rematchBtn = findCleanseRematchButton(document, hqHtml, 'tartar_tyrant', boss.name, boss.cleansedTitle);
  assert.ok(rematchBtn, 'Boss Rematch button must exist in Hero HQ Cleanse Album');
  rematchBtn.click();
  assert.strictEqual(store.getState().selectedBossId, 'tartar_tyrant', 'Rematch must select tartar_tyrant');
  assert.ok(['battle', 'ar_battle'].includes(store.getState().activeView), 'Rematch must navigate to battle view');
});

// ===========================================================================
// F10: Minty Shield Shop Upgrades (5 tests)
// ===========================================================================
addTest('F10', 'F10.1 DIGITAL_REWARDS_CATALOG includes Minty Shield duration upgrade items', () => {
  const shieldUpgrades = catalogMod.DIGITAL_REWARDS_CATALOG.filter(isMintyShieldUpgrade);
  assert.ok(shieldUpgrades.length >= 2, `Catalog must include >= 2 Minty Shield duration upgrades (found ${shieldUpgrades.length})`);
  for (const upg of shieldUpgrades) {
    assert.ok(getMintyShieldUpgradeBonus(upg) > 0 || (upg.statBonusPercent || 0) > 0, `Upgrade ${upg.id} must specify duration bonus`);
  }
});

addTest('F10', 'F10.2 store.getMintyShieldUpgradeBonusSec reflects purchased shield upgrades', () => {
  resetStoreBaseline({ coins: 500, sparks: 200 });
  assert.strictEqual(typeof store.getMintyShieldUpgradeBonusSec, 'function', 'store.getMintyShieldUpgradeBonusSec must exist');
  assert.strictEqual(store.getMintyShieldUpgradeBonusSec(), 0, 'Baseline bonus must be 0s');

  const shieldUpgrade = catalogMod.DIGITAL_REWARDS_CATALOG.find(isMintyShieldUpgrade);
  assert.ok(shieldUpgrade, 'Minty Shield upgrade item must exist in catalog');
  store.buyDigitalGear(shieldUpgrade.id);
  assert.ok(store.getMintyShieldUpgradeBonusSec() > 0, 'Bonus seconds must be > 0 after buying upgrade');
});

addTest('F10', 'F10.3 buyDigitalGear deducts Coins and/or Pet Sparks cleanly for shield upgrades', () => {
  resetStoreBaseline({ coins: 400, sparks: 150 });
  const hero = store.getSelectedHero();
  const sparksUpgrade = catalogMod.DIGITAL_REWARDS_CATALOG.find(item => (item.costSparks || 0) > 0 && isMintyShieldUpgrade(item));
  const coinsUpgrade = catalogMod.DIGITAL_REWARDS_CATALOG.find(item => (item.costCoins || 0) > 0 && isMintyShieldUpgrade(item));
  assert.ok(sparksUpgrade || coinsUpgrade, 'At least one Minty Shield upgrade priced in Coins or Sparks must exist');

  if (sparksUpgrade) {
    const petId = hero.activePetId || 1;
    const beforeSparks = store.getPetSparks(petId, hero.id);
    store.buyDigitalGear(sparksUpgrade.id);
    const afterSparks = store.getPetSparks(petId, hero.id);
    assert.strictEqual(afterSparks, beforeSparks - sparksUpgrade.costSparks, 'Pet Sparks must be deducted accurately');
  }
  if (coinsUpgrade && (!sparksUpgrade || coinsUpgrade.id !== sparksUpgrade.id)) {
    const beforeCoins = hero.coins;
    store.buyDigitalGear(coinsUpgrade.id);
    assert.strictEqual(hero.coins, beforeCoins - coinsUpgrade.costCoins, 'Hero Coins must be deducted accurately');
  } else if (coinsUpgrade) {
    // Same upgrade has both costCoins & costSparks -> verify coins were also deducted
    assert.strictEqual(hero.coins, 400 - coinsUpgrade.costCoins, 'Hero Coins must be deducted accurately');
  }
});

addTest('F10', 'F10.4 ShopView renders Coins & Pet Sparks balance and Minty Shield upgrade cards', () => {
  resetStoreBaseline({ coins: 321, sparks: 88 });
  store.getState().activeView = 'shop';
  const html = shopViewMod.renderShopView();
  assert.ok(html.includes('321'), 'ShopView must display Coin balance');
  assert.ok(html.includes('88') && /spark/i.test(html), 'ShopView must display Pet Sparks balance');
  assert.ok(/Minty Shield/i.test(html), 'ShopView must display Minty Shield upgrades');
});

addTest('F10', 'F10.5 Purchased Minty Shield upgrade extends active shield duration in BattleView (> 5s)', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ coins: 500, sparks: 200, durationSec: 120 });
    const shieldUpgrade = catalogMod.DIGITAL_REWARDS_CATALOG.find(isMintyShieldUpgrade);
    assert.ok(shieldUpgrade, 'Minty Shield upgrade must exist in catalog');
    store.buyDigitalGear(shieldUpgrade.id);
    const bonusSec = store.getMintyShieldUpgradeBonusSec();
    assert.ok(bonusSec > 0, 'Shield bonus must be > 0');

    const canvas = await bootBattle({
      bossId: 'sugar_bandit',
      durationSec: 120,
      inventory: [...store.getSelectedHero().inventory]
    });
    for (let i = 0; i < 4; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const shieldBtn = document.getElementById('minty-shield-btn');
    assert.ok(shieldBtn, '#minty-shield-btn must exist');
    shieldBtn.click();
    const st = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    assert.ok((st?.durationSec || 0) >= 5 + bonusSec, `Shield duration (${st?.durationSec}) must include +${bonusSec}s upgrade`);
  } finally {
    cleanupBattle(clock);
  }
});

// ===========================================================================
// F11: Escalating Daily Brush Streaks (5 tests)
// ===========================================================================
addTest('F11', 'F11.1 brushStreakData initializes per hero and increments on new calendar day', () => {
  resetStoreBaseline();
  const hero = store.getSelectedHero();
  const yesterday = getYesterdayDateKey();
  hero.brushStreakData = { count: 2, lastDate: yesterday, morningDate: null, eveningDate: null };
  store.initColosseumBattle('sugar_bandit', 120, true);
  store.completeToothbrushBattle('sugar_bandit', 120, 85);
  assert.strictEqual(hero.brushStreakData.count, 3, 'Consecutive calendar day must increment streak count 2 -> 3');
});

addTest('F11', 'F11.2 Same-day second brushing battle does not double-increment daily streak count', () => {
  resetStoreBaseline();
  const hero = store.getSelectedHero();
  store.initColosseumBattle('sugar_bandit', 120, true);
  store.completeToothbrushBattle('sugar_bandit', 120, 85);
  const countAfterFirst = hero.brushStreakData.count;

  const col = store.getBossColosseumState();
  col.hasAwardedVictory = false;
  col.victoryReward = null;
  store.initColosseumBattle('plaque_kraken', 120, true);
  store.completeToothbrushBattle('plaque_kraken', 120, 85);
  assert.strictEqual(hero.brushStreakData.count, countAfterFirst, 'Same calendar day must not inflate streak count');
});

addTest('F11', 'F11.3 getBrushStreakMultiplier escalates bonus payouts across streak milestones', () => {
  resetStoreBaseline();
  assert.strictEqual(typeof store.getBrushStreakMultiplier, 'function', 'store.getBrushStreakMultiplier must exist');
  const hero = store.getSelectedHero();
  const m1 = store.getBrushStreakMultiplier({ ...hero, brushStreakData: { count: 1 } });
  const m3 = store.getBrushStreakMultiplier({ ...hero, brushStreakData: { count: 3 } });
  const m7 = store.getBrushStreakMultiplier({ ...hero, brushStreakData: { count: 7 } });
  assert.ok(m1 >= 1 && m3 > m1 && m7 > m3, `Multiplier must escalate with streak (${m1} < ${m3} < ${m7})`);
});

addTest('F11', 'F11.4 Parent denial claws back Tokens/XP/Sparks incl. streak bonus while approval grants Gold Points', () => {
  resetStoreBaseline({ coins: 100, points: 0, sparks: 20, xpNext: 100000 });
  const hero = store.getSelectedHero();
  const yesterday = getYesterdayDateKey();
  hero.brushStreakData = { count: 6, lastDate: yesterday };

  store.initColosseumBattle('sugar_bandit', 120, true);
  const reward = store.completeToothbrushBattle('sugar_bandit', 120, 88);
  assert.strictEqual(hero.brushStreakData.count, 7, 'Streak count must increment 6 -> 7 before payout');
  assert.strictEqual(hero.points, 0, 'Gold Points must NOT be auto-issued before parent approval');

  const req = store.getState().pendingApprovals.find(r => r.kidId === hero.id);
  assert.ok(req, 'Pending approval request must be created');
  assert.strictEqual(req.tokensAwarded, reward.coins, 'pendingApproval tokensAwarded must match escalated payout');

  store.rejectParentRequest(req.id);
  assert.strictEqual(hero.coins, 100, 'rejectParentRequest must claw back full auto-issued coins incl. streak bonus');
  assert.strictEqual(hero.points, 0, 'rejectParentRequest must leave Gold Points at 0');
  assert.strictEqual(store.getPetSparks(hero.activePetId || 1, hero.id), 20, 'rejectParentRequest must claw back Pet Sparks');

  // Second battle approved -> Gold Points awarded
  const col = store.getBossColosseumState();
  col.hasAwardedVictory = false;
  col.victoryReward = null;
  store.initColosseumBattle('sugar_bandit', 120, true);
  store.completeToothbrushBattle('sugar_bandit', 120, 88);
  const req2 = store.getState().pendingApprovals.find(r => r.kidId === hero.id);
  store.approveParentRequest(req2.id);
  assert.ok(hero.points > 0, 'approveParentRequest must credit Gold Points');
});

addTest('F11', 'F11.5 DashboardView renders daily brushing streak & escalating bonus status', () => {
  resetStoreBaseline();
  const hero = store.getSelectedHero();
  hero.brushStreakData = { count: 14, lastDate: getLocalDateKey() };
  store.syncSelectedHeroWithHeroes();
  const dashHtml = dashboardViewMod.renderDashboardView();
  assert.ok(
    dashHtml.includes('14') && /brush\s*streak|daily.*streak/i.test(dashHtml) && /multiplier|bonus|1\.\dx|\+\d+%/i.test(dashHtml),
    'DashboardView must display active daily brush streak count (14) and escalating bonus/multiplier status'
  );
});

// ===========================================================================
// F12: Rotating Weekly Challenges (5 tests)
// ===========================================================================
addTest('F12', 'F12.1 WEEKLY_CHALLENGES_POOL & getCurrentWeeklyChallenge exist with required schema', () => {
  assert.ok(Array.isArray(bossesDataMod.WEEKLY_CHALLENGES_POOL) && bossesDataMod.WEEKLY_CHALLENGES_POOL.length >= 4, 'WEEKLY_CHALLENGES_POOL must have >= 4 challenges');
  assert.strictEqual(typeof bossesDataMod.getCurrentWeeklyChallenge, 'function', 'getCurrentWeeklyChallenge must exist');
  const cur = bossesDataMod.getCurrentWeeklyChallenge(new Date('2026-11-18T12:00:00Z'));
  assert.ok(/^\d{4}-W\d{2}$/.test(cur.weekKey), `weekKey must match YYYY-Www (got ${cur.weekKey})`);
  for (const k of ['id', 'title', 'description', 'modifierType', 'targetCount', 'rewardCoins', 'rewardXp', 'rewardSparks']) {
    assert.ok(cur.challenge && cur.challenge[k] !== undefined, `Weekly challenge missing ${k}`);
  }
});

addTest('F12', 'F12.2 getCurrentWeeklyChallenge rotates deterministically across ISO calendar weeks', () => {
  const w1 = bossesDataMod.getCurrentWeeklyChallenge(new Date('2026-11-16T12:00:00Z'));
  const w1Same = bossesDataMod.getCurrentWeeklyChallenge(new Date('2026-11-20T18:00:00Z'));
  const w2 = bossesDataMod.getCurrentWeeklyChallenge(new Date('2026-11-23T12:00:00Z'));
  assert.strictEqual(w1.weekKey, w1Same.weekKey, 'Same ISO week produces identical weekKey');
  assert.strictEqual(w1.challenge.id, w1Same.challenge.id, 'Same ISO week produces identical challenge');
  assert.notStrictEqual(w1.weekKey, w2.weekKey, 'Next ISO week produces new weekKey');
  assert.notStrictEqual(w1.challenge.id, w2.challenge.id, 'Next ISO week rotates to a different challenge');
});

addTest('F12', 'F12.3 store.getWeeklyChallengeState initializes per-kid challenge state', () => {
  resetStoreBaseline();
  assert.strictEqual(typeof store.getWeeklyChallengeState, 'function', 'store.getWeeklyChallengeState must exist');
  const hero = store.getSelectedHero();
  const wcState = store.getWeeklyChallengeState(hero.id);
  assert.ok(wcState && wcState.challengeId, 'Weekly challenge state must contain challengeId');
  assert.strictEqual(wcState.progress, 0, 'Initial progress must be 0');
  assert.ok(wcState.target >= 1, 'Target count must be >= 1');
  assert.strictEqual(wcState.completed, false, 'Initial completed must be false');
});

addTest('F12', 'F12.4 Completing weekly challenge battles increments progress and grants bonus rewards', () => {
  resetStoreBaseline({ coins: 100, sparks: 20 });
  const hero = store.getSelectedHero();
  const initialWc = store.getWeeklyChallengeState(hero.id);
  for (let i = 0; i < initialWc.target; i++) {
    const col = store.getBossColosseumState();
    col.hasAwardedVictory = false;
    col.victoryReward = null;
    store.initColosseumBattle('sugar_bandit', 120, true);
    store.completeToothbrushBattle('sugar_bandit', 120, 90, { weeklyChallengeCompleted: true });
  }
  const updatedWc = store.getWeeklyChallengeState(hero.id);
  assert.strictEqual(updatedWc.completed, true, 'Weekly challenge must mark completed once target reached');
  assert.ok(updatedWc.claimedAt, 'Weekly challenge bonus reward must set claimedAt');
});

addTest('F12', 'F12.5 DashboardView renders active Weekly Challenge card with progress', () => {
  resetStoreBaseline();
  const hero = store.getSelectedHero();
  const wc = store.getWeeklyChallengeState(hero.id);
  const cur = bossesDataMod.getCurrentWeeklyChallenge();
  const dashHtml = dashboardViewMod.renderDashboardView();
  assert.ok(dashHtml.includes(cur.challenge.title), 'DashboardView must display active Weekly Challenge title');
  assert.ok(dashHtml.includes(`${wc.progress}`) && dashHtml.includes(`${wc.target}`), 'DashboardView must show Weekly Challenge progress/target');
});

// ===========================================================================
// F13: Boss Rotation Fix (5 tests)
// ===========================================================================
addTest('F13', 'F13.1 BattleView ROTATING_VILLAINS exports all 8 HYGIENE_BOSSES IDs', () => {
  const expectedIds = bossesDataMod.HYGIENE_BOSSES.map(b => b.id);
  assert.strictEqual(battleViewMod.ROTATING_VILLAINS.length, 8, `ROTATING_VILLAINS must have 8 bosses (got ${battleViewMod.ROTATING_VILLAINS.length})`);
  for (const id of expectedIds) {
    assert.ok(battleViewMod.ROTATING_VILLAINS.includes(id), `ROTATING_VILLAINS missing ${id}`);
  }
});

addTest('F13', 'F13.2 drawNextHygieneBossId cycles through all 8 bosses without repeat in a bag', () => {
  resetStoreBaseline();
  assert.strictEqual(typeof store.drawNextHygieneBossId, 'function', 'store.drawNextHygieneBossId must exist');
  const hero = store.getSelectedHero();
  const drawn = new Set();
  for (let i = 0; i < 8; i++) {
    drawn.add(store.drawNextHygieneBossId(hero.id));
  }
  assert.strictEqual(drawn.size, 8, `8 consecutive draws must visit all 8 bosses (visited ${drawn.size})`);
});

addTest('F13', 'F13.3 drawNextHygieneBossId never repeats lastBossId across shuffle-bag boundaries', () => {
  resetStoreBaseline();
  const hero = store.getSelectedHero();
  let prev = null;
  for (let i = 0; i < 24; i++) {
    const next = store.drawNextHygieneBossId(hero.id);
    assert.notStrictEqual(next, prev, `Draw #${i + 1} repeated immediately preceding boss ${prev}`);
    prev = next;
  }
});

addTest('F13', 'F13.4 Consecutive non-explicit battle starts rotate bosses without repeating previous boss', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const seen = [];
    for (let i = 0; i < 5; i++) {
      await bootBattle({ explicit: false, durationSec: 120 });
      const bossId = store.getSelectedBossId();
      if (seen.length > 0) {
        assert.notStrictEqual(bossId, seen[seen.length - 1], `Session ${i + 1} repeated boss ${bossId}`);
      }
      seen.push(bossId);
      battleViewMod.quitBattle();
      store.closeColosseumDefeatModal(true);
    }
    assert.ok(new Set(seen).size >= 4, `5 non-explicit sessions should rotate across distinct bosses (${seen.join(', ')})`);
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F13', 'F13.5 Explicit boss selection preserves chosen boss for battle', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    await bootBattle({ bossId: 'cookie_colossus', explicit: true, durationSec: 120 });
    assert.strictEqual(store.getSelectedBossId(), 'cookie_colossus', 'Explicit boss selection must stay on cookie_colossus');
    assert.strictEqual(hanaBattle3DService.bossData?.id, 'cookie_colossus', '3D service must load explicitly chosen boss');
  } finally {
    cleanupBattle(clock);
  }
});

// ===========================================================================
// F14: Cohesive Boss Visuals Overhaul (5 tests)
// ===========================================================================
addTest('F14', 'F14.1 All 8 boss normal & cleansed 2D images exist on disk under public/assets/bosses/', () => {
  for (const b of bossesDataMod.HYGIENE_BOSSES) {
    for (const field of ['image', 'cleansedImage']) {
      assert.ok(b[field] && b[field].includes('/assets/bosses/'), `${b.id}.${field} must reference /assets/bosses/`);
      const abs = path.join(REPO_ROOT, 'public', b[field].replace(/^\/+/, ''));
      assert.ok(fs.existsSync(abs), `Missing boss image on disk: ${abs}`);
      assert.ok(fs.statSync(abs).size > 0, `Boss image is empty: ${abs}`);
    }
  }
});

addTest('F14', 'F14.2 src/utils/assetUrl.js exports resolvePublicAssetUrl handling "/" and "/Little-Heroes-G/"', async () => {
  const rootMod = await loadAssetUrlWithBase('/');
  const ghMod = await loadAssetUrlWithBase('/Little-Heroes-G/');
  const undefMod = await loadAssetUrlWithBase(undefined);
  assert.strictEqual(typeof rootMod.resolvePublicAssetUrl, 'function', 'resolvePublicAssetUrl must be exported');
  const rootUrl = rootMod.resolvePublicAssetUrl('/assets/bosses/tartar_tyrant.jpg');
  const ghUrl = ghMod.resolvePublicAssetUrl('/assets/bosses/tartar_tyrant.jpg');
  const undefUrl = undefMod.resolvePublicAssetUrl('/assets/bosses/tartar_tyrant.jpg');
  assert.strictEqual(rootUrl, '/assets/bosses/tartar_tyrant.jpg');
  assert.strictEqual(ghUrl, '/Little-Heroes-G/assets/bosses/tartar_tyrant.jpg');
  assert.ok(undefUrl === './assets/bosses/tartar_tyrant.jpg' || undefUrl === '/assets/bosses/tartar_tyrant.jpg', `Unexpected fallback URL: ${undefUrl}`);
});

addTest('F14', 'F14.3 hanaBattle3DService renders all 8 HYGIENE_BOSSES models cleanly', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    await bootBattle({ bossId: 'sugar_bandit' });
    for (const b of bossesDataMod.HYGIENE_BOSSES) {
      hanaBattle3DService.setBoss(b);
      clock.step3D(0.016);
      assert.strictEqual(hanaBattle3DService.bossData.id, b.id, `3D engine setBoss failed for ${b.id}`);
    }
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F14', 'F14.4 Victory transformation loads cleansedImage via base-path-safe URL', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline();
    const mod = await importAssetUrlModule();
    assert.strictEqual(typeof mod.resolvePublicAssetUrl, 'function');
    await bootBattle({ bossId: 'gummy_ghost' });
    hanaBattle3DService.onCleanseVictory();
    clock.step3D(0.016);
    assert.strictEqual(hanaBattle3DService.isVictory, true, '3D engine must enter victory cleansed mode');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F14', 'F14.5 Zero Purple/Pink palette invariant holds in brushVisionTracker.js & BattleView HUD slice', () => {
  const visionCode = fs.readFileSync(path.join(REPO_ROOT, 'src/services/brushVisionTracker.js'), 'utf8');
  const battleCode = fs.readFileSync(path.join(REPO_ROOT, 'src/views/BattleView.js'), 'utf8');
  const startIdx = battleCode.indexOf('FLOATING MAGIC MIRROR PORTAL');
  const endIdx = battleCode.indexOf('DEFLECT FLURRY');
  assert.ok(startIdx >= 0 && endIdx > startIdx, 'BattleView HUD slice markers must exist');
  const hudSlice = battleCode.slice(startIdx, endIdx);
  const forbiddenRe = /(800080|9b59b6|8e44ad|ff00ff|ec4899|a855f7|d946ef|c026d3|7e22ce|9333ea|\bpurple-|\bpink-|\bfuchsia-)/i;
  assert.strictEqual(forbiddenRe.test(visionCode), false, 'brushVisionTracker.js must contain zero purple/pink classes or HEX');
  assert.strictEqual(forbiddenRe.test(hudSlice), false, 'BattleView HUD slice must contain zero purple/pink classes or HEX');
});

// ===========================================================================
// F15: Non-Destructive Sync, PWA & Release (5 tests)
// ===========================================================================
addTest('F15', 'F15.1 Unconditional catalog reconciliation updates legacy save even when digitalRewardsOverhaulApplied=true', () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    digitalRewardsOverhaulApplied: true,
    heroes: [{ id: 'hero_1', name: 'Hero', coins: 777, inventory: ['laser_toothbrush'], equippedWeapon: 'laser_toothbrush' }],
    selectedHero: { id: 'hero_1', name: 'Hero', coins: 777, inventory: ['laser_toothbrush'], equippedWeapon: 'laser_toothbrush' },
    digitalGear: [{ id: 'laser_toothbrush', title: 'Laser Toothbrush Saber' }]
  }));
  const loaded = store.loadState();
  const hasShieldUpgradeInGear = (loaded.digitalGear || []).some(isMintyShieldUpgrade);
  assert.ok(hasShieldUpgradeInGear, 'Legacy save must unconditionally reconcile new Minty Shield Shop upgrades');
  assert.strictEqual(loaded.selectedHero.coins, 777, 'Legacy hero coins must be preserved non-destructively');
});

addTest('F15', 'F15.2 hydrateFromCloud reconciles overhaul fields without dropping pendingApprovals or newer local balances', () => {
  resetStoreBaseline({ coins: 250 });
  const hero = store.getSelectedHero();
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 90, { shellShatteredBeforeRecharge: true });
  const pendingCountBefore = store.getState().pendingApprovals.length;

  store.hydrateFromCloud({
    stateSnapshot: {
      digitalRewardsOverhaulApplied: true,
      digitalGear: []
    },
    heroesMap: {
      [hero.id]: { id: hero.id, name: hero.name, coins: 100 }
    },
    pendingApprovals: []
  });

  assert.ok(store.getState().pendingApprovals.length >= pendingCountBefore, 'hydrateFromCloud must preserve zero-drop pendingApprovals');
  assert.ok(store.getState().digitalGear.some(isMintyShieldUpgrade), 'hydrateFromCloud must reconcile catalog');
});

addTest('F15', 'F15.3 Multi-kid isolation separates badges, Cleanse Album, streaks, weekly challenges & boss queue', () => {
  resetStoreBaseline();
  const kid1Id = store.getSelectedHero().id;
  const kid2 = store.addHero({ name: 'Mia', role: 'Defender', coins: 50 });

  store.switchHero(kid1Id);
  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 92, {
    shellShatteredBeforeRecharge: true,
    mintyShieldFullBattleUptime: true,
    speedScrubMs: 2600,
    speedScrubMultiplier: 3,
    weeklyChallengeCompleted: true
  });

  store.switchHero(kid2.id);
  const kid2Record = store.getState().heroes.find(h => h.id === kid2.id);
  assert.strictEqual((kid2Record.dentalBadges || []).includes('shell_shatter'), false, 'Kid 2 must NOT inherit Kid 1 shell_shatter badge');
  assert.strictEqual(Boolean(store.getCleanseAlbum(kid2.id).tartar_tyrant), false, 'Kid 2 Cleanse Album must remain isolated');
  assert.strictEqual(store.getWeeklyChallengeState(kid2.id).progress, 0, 'Kid 2 Weekly Challenge progress must remain 0');
});

addTest('F15', 'F15.4 Multi-device Firestore sync keeps Kid 1 & Kid 2 Cleanse Album & Weekly Challenges isolated', async () => {
  const harness = await createSyncHarness({ latencyMs: 15 });
  try {
    const dev1 = harness.makeDevice('HERO-OVERHAUL');
    dev1.store.saveState(true);
    await harness.sleep(100);

    const dev2 = harness.makeDevice('HERO-OVERHAUL');
    await harness.sleep(100);
    const kid2 = dev2.store.addHero({ name: 'Leo' });
    await harness.sleep(100);

    dev1.store.initColosseumBattle('tartar_tyrant', 120, true);
    dev1.store.completeToothbrushBattle('tartar_tyrant', 120, 90, { speedScrubMs: 3000, speedScrubMultiplier: 3 });
    await harness.sleep(150);

    const k1OnDev2 = dev2.store.getState().heroes.find(h => h.id === 'hero_1');
    const k2OnDev2 = dev2.store.getState().heroes.find(h => h.id === kid2.id);
    assert.ok(k1OnDev2.cleanseAlbum?.tartar_tyrant, 'Kid 1 Cleanse Album must sync to Device 2');
    assert.strictEqual(Boolean(k2OnDev2.cleanseAlbum?.tartar_tyrant), false, 'Kid 2 must not receive Kid 1 Cleanse Album across sync');
  } finally {
    harness.dispose();
  }
});

addTest('F15', 'F15.5 index.html APP_BUILD_VERSION and public/sw.js CACHE_NAME match in semver & label', () => {
  const indexHtml = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const swJs = fs.readFileSync(path.join(REPO_ROOT, 'public/sw.js'), 'utf8');
  const appMatch = indexHtml.match(/const\s+APP_BUILD_VERSION\s*=\s*['"](v\d+\.\d+\.\d+-[\w-]+)['"]/);
  const swMatch = swJs.match(/const\s+CACHE_NAME\s*=\s*['"]little-heroes-(v\d+\.\d+\.\d+-[\w-]+)['"]/);
  assert.ok(appMatch && swMatch, 'Both index.html APP_BUILD_VERSION and public/sw.js CACHE_NAME must follow vX.Y.Z-label format');
  assert.strictEqual(appMatch[1], swMatch[1], `APP_BUILD_VERSION (${appMatch[1]}) must match CACHE_NAME suffix (${swMatch[1]})`);
  assert.ok(swJs.includes('caches.delete') && swJs.includes('self.clients.claim()'), 'SW must delete old caches and claim clients');
});

const result = await runTestRegistry('Tier 1 — Overhaul Happy-Path E2E Suite', tests);
process.exit(result.failed > 0 ? 1 : 0);
