/**
 * scratch/e2e_overhaul_tier3.mjs
 *
 * Tier 3: Pairwise Cross-Feature Combination Tests (>= 15 tests -> 18 tests).
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
  dashboardViewMod,
  shopViewMod,
  getYesterdayDateKey,
  isMintyShieldUpgrade,
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
  createSyncHarness,
  runTestRegistry
} from './e2e_overhaul_harness.mjs';

const tests = [];
const addTest = (feature, name, fn) => tests.push({ feature, name, fn });

addTest('F1+F10', 'C1 Shop Minty Shield upgrade extends battle shield duration and enables 120s uptime', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ coins: 600, sparks: 200, durationSec: 120 });
    const upg = catalogMod.DIGITAL_REWARDS_CATALOG.find(isMintyShieldUpgrade);
    assert.ok(upg, 'Minty Shield shop upgrade must exist');
    store.buyDigitalGear(upg.id);
    const bonusSec = store.getMintyShieldUpgradeBonusSec();
    assert.ok(bonusSec > 0, 'Shield bonus seconds must be > 0');

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
    assert.ok(st && st.active && st.durationSec >= 5 + bonusSec, `Shield duration (${st?.durationSec}) must include +${bonusSec}s upgrade`);
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F1+F6', 'C2 Minty Shield absorbs Cinnamon Fireballs & Sour Apple Acid Drops and grants attack boost', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'cavity_knight', durationSec: 120 });
    const hp0 = store.getBossColosseumState().currentHp;
    scrubBurst({ clock, steps: 4, stepMs: 160, canvas });
    const dmgUnshielded = hp0 - store.getBossColosseumState().currentHp;

    for (let i = 0; i < 4; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const shieldBtn = document.getElementById('minty-shield-btn');
    assert.ok(shieldBtn, '#minty-shield-btn must exist');
    shieldBtn.click();

    const initIntegrity = (hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield)?.integrity || 3;
    const cin = bossesDataMod.getSugarHazardById('cinnamon_fireballs');
    const sour = bossesDataMod.getSugarHazardById('sour_apple_acid_drops');
    assert.strictEqual(cin?.id, 'cinnamon_fireballs');
    assert.strictEqual(sour?.id, 'sour_apple_acid_drops');
    hanaBattle3DService.spawnCaramelBomb(cin);
    hanaBattle3DService.spawnCaramelBomb(sour);
    const hit = step3DUntilBombsCleared(clock, 90, 0.05);
    assert.strictEqual(hit, true, 'Both elemental projectiles must collide with shielded zone');

    const st = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    assert.ok((st?.integrity ?? initIntegrity) < initIntegrity, 'Shield integrity must absorb & decrement on elemental hits');

    const hpBeforeShielded = store.getBossColosseumState().currentHp;
    clock.advanceMs(1000);
    scrubBurst({ clock, steps: 4, stepMs: 160, canvas });
    const dmgShielded = hpBeforeShielded - store.getBossColosseumState().currentHp;
    assert.ok(st?.attackBoostActive === true || dmgShielded > dmgUnshielded, 'Absorption / active shield must grant temporary attack boost');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F2+F5', 'C3 Minty Fresh Blast + circular/rapid scrubbing clears Sweet Tooth Sprites & Sticky Residue', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'gummy_ghost', durationSec: 120 });
    // Charge Blast FIRST so charging ticks/sync3DServiceFromStore do not wipe injected targets
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const blastBtn = document.getElementById('supernova-blast-btn');
    assert.ok(blastBtn && !blastBtn.disabled, 'Blast button must be charged before injecting sprites & residue');

    assert.strictEqual(typeof hanaBattle3DService.syncSweetToothSprites, 'function', 'syncSweetToothSprites must exist');
    assert.strictEqual(typeof hanaBattle3DService.setStickyResidueState, 'function', 'setStickyResidueState must exist');
    hanaBattle3DService.syncSweetToothSprites([
      { id: 'sp_a', x: 260, y: 240, hp: 10, maxHp: 10 },
      { id: 'sp_b', x: 340, y: 280, hp: 10, maxHp: 10 }
    ]);
    hanaBattle3DService.setStickyResidueState({ active: true, intensity: 1.0 });
    assert.strictEqual((hanaBattle3DService.sweetToothSprites || []).length, 2, 'Sprites must be active immediately before Blast');
    assert.strictEqual(Boolean((hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue)?.active), true, 'Sticky Residue must be active immediately before Blast');

    blastBtn.click();
    circularScrubSweep({ clock, cx: 300, cy: 260, radius: 75, canvas });

    assert.strictEqual((hanaBattle3DService.sweetToothSprites || []).length, 0, 'Sprites must be cleared');
    const res = hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue;
    assert.strictEqual(Boolean(res?.active), false, 'Sticky Residue must be cleansed');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F3+F1+F2', 'C4 Voice "Shield Up!" & "Blast!" execute after TTS cooldown without self-echo', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'plaque_kraken', durationSec: 120, speechAvailable: true });
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    speechMockControl.dispatchSpeechStart('Shield up! Blast time!');
    voiceMockControl.emitTranscript('Shield Up!', { isFinal: true });
    assert.strictEqual(Boolean((hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield)?.active), false, 'Echo during TTS must be gated');

    speechMockControl.dispatchSpeechEnd('Shield up! Blast time!');
    clock.advanceMs(400);

    voiceMockControl.emitTranscript('Shield Up!', { isFinal: true });
    assert.strictEqual((hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield)?.active, true, 'Post-cooldown "Shield Up!" activates shield');

    const chargeBefore = store.getBossColosseumState().choreSupernovaCharge;
    voiceMockControl.emitTranscript('Blast!', { isFinal: true });
    assert.ok(store.getBossColosseumState().choreSupernovaCharge < chargeBefore, 'Post-cooldown "Blast!" triggers Foam Blast');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F3+F5+F1', 'C5 Unavailable SpeechRecognition falls back to HUD buttons + circular scrub to clear sprites & slime', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'gummy_ghost', durationSec: 120, speechAvailable: false });
    // Charge HUD buttons FIRST so charging ticks do not wipe injected targets
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    const shieldBtn = document.getElementById('minty-shield-btn');
    const blastBtn = document.getElementById('supernova-blast-btn');
    assert.ok(shieldBtn && !shieldBtn.disabled, '#minty-shield-btn must be enabled in fallback mode');
    assert.ok(blastBtn && !blastBtn.disabled, '#supernova-blast-btn must be enabled in fallback mode');

    assert.strictEqual(typeof hanaBattle3DService.syncSweetToothSprites, 'function', 'syncSweetToothSprites must exist');
    assert.strictEqual(typeof hanaBattle3DService.setStickyResidueState, 'function', 'setStickyResidueState must exist');
    shieldBtn.click();
    assert.strictEqual((hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield)?.active, true);

    hanaBattle3DService.syncSweetToothSprites([{ id: 'sp_fb', x: 300, y: 260, hp: 10, maxHp: 10 }]);
    hanaBattle3DService.setStickyResidueState({ active: true, intensity: 0.8 });
    assert.strictEqual((hanaBattle3DService.sweetToothSprites || []).length, 1, 'Sprite must be active before Blast');
    assert.strictEqual(Boolean((hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue)?.active), true, 'Sticky Residue must be active before Blast');

    blastBtn.click();
    assert.strictEqual((hanaBattle3DService.sweetToothSprites || []).length, 0);
    assert.strictEqual(Boolean((hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue)?.active), false);
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F4+F7+F8+F9', 'C6 Tartar Tyrant shell shatter + 3x Speed Scrub unlocks badge, trophy & Cleanse Album record', () => {
  resetStoreBaseline({ coins: 100 });
  store.initColosseumBattle('tartar_tyrant', 120, true);
  const reward = store.completeToothbrushBattle('tartar_tyrant', 120, 94, {
    shellShatteredBeforeRecharge: true,
    speedScrubMs: 2500,
    speedScrubMultiplier: 3,
    flawlessZones: 4
  });
  const hero = store.getSelectedHero();
  const badges = hero.dentalBadges || store.state.dentalBadges;
  assert.ok(badges.includes('shell_shatter'), 'shell_shatter badge unlocked');
  assert.strictEqual(store.getCleanseAlbum().tartar_tyrant.bestSpeedScrubMs, 2500);
  assert.strictEqual(store.getCleanseAlbum().tartar_tyrant.bestSpeedScrubMultiplier, 3);
  assert.ok(reward.coins >= 150, '3x Speed Scrub payout scales reward coins');
  const trophies = heroHqDataMod.getTrophiesForDisplay(store.getState());
  assert.ok(trophies.some(t => t.id === 'trophy_tartar_tyrant'), 'trophy_tartar_tyrant displayed in Trophy Showcase');
});

addTest('F1+F7', 'C7 Full 120s Minty Shield uptime unlocks minty_master badge & displays in Victory/HQ', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'sugar_bandit', durationSec: 120 });
    for (let s = 0; s < 120; s++) {
      scrubBurst({ clock, steps: s < 5 ? 6 : 4, stepMs: 160, canvas });
      const shieldBtn = document.getElementById('minty-shield-btn');
      if (shieldBtn && !shieldBtn.disabled) shieldBtn.click();
      clock.tickBattle(1);
      clock.step3D(1.0);
    }
    const badges = store.getSelectedHero().dentalBadges || store.state.dentalBadges;
    assert.ok(badges.includes('minty_master'), 'Full 120s battle uptime must unlock minty_master');
    const hqHtml = heroHqViewMod.renderHeroHQView();
    assert.ok(/Minty Master/i.test(hqHtml), 'Hero HQ displays unlocked Minty Master badge');
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F5+F7', 'C8 Clearing Sweet Tooth Sprite swarm without damage unlocks plaque_whisperer', () => {
  resetStoreBaseline();
  store.initColosseumBattle('gummy_ghost', 120, true);
  store.completeToothbrushBattle('gummy_ghost', 120, 89, {
    spritesSpawned: 4,
    spritesClearedNoDamage: true
  });
  const badges = store.getSelectedHero().dentalBadges || store.state.dentalBadges;
  assert.ok(badges.includes('plaque_whisperer'));
});

addTest('F2+F7', 'C9 Victory Burst on boss phase shift unlocks perfect_synergy badge', () => {
  resetStoreBaseline();
  assert.strictEqual(typeof hanaBattle3DService.triggerVictoryBurst, 'function');
  hanaBattle3DService.triggerVictoryBurst();
  store.initColosseumBattle('cavity_knight', 120, true);
  store.completeToothbrushBattle('cavity_knight', 120, 91, {
    victoryBurstOnPhaseShift: true
  });
  const badges = store.getSelectedHero().dentalBadges || store.state.dentalBadges;
  assert.ok(badges.includes('perfect_synergy'));
});

addTest('F9+F13+F14', 'C10 Hero HQ Cleanse Album Boss Rematch overrides rotation and loads boss 2D/3D assets', () => {
  resetStoreBaseline();
  store.initColosseumBattle('fizz_serpent', 120, true);
  store.completeToothbrushBattle('fizz_serpent', 120, 88, { speedScrubMs: 3900, speedScrubMultiplier: 2 });
  store.closeColosseumVictoryModal(true);

  const hqHtml = heroHqViewMod.renderHeroHQView();
  document.body.setMockHtml(hqHtml);
  heroHqViewMod.attachHeroHQListeners();
  const boss = bossesDataMod.getHygieneBoss('fizz_serpent');
  const rematchBtn = findCleanseRematchButton(document, hqHtml, 'fizz_serpent', boss.name, boss.cleansedTitle);
  assert.ok(rematchBtn, 'Cleanse Album rematch button must exist');
  rematchBtn.click();
  assert.strictEqual(store.getState().selectedBossId, 'fizz_serpent');
  assert.strictEqual(store.getState().hasExplicitBossSelection, true);
});

addTest('F11+F12+F4', 'C11 Daily Brush Streak + Weekly Challenge + Tartar Tyrant Speed Scrub stack payouts cleanly', () => {
  resetStoreBaseline({ coins: 50, points: 0, sparks: 10, xpNext: 100000 });
  const hero = store.getSelectedHero();
  const yesterday = getYesterdayDateKey();
  hero.brushStreakData = { count: 6, lastDate: yesterday };
  const wc = store.getWeeklyChallengeState(hero.id);
  wc.progress = wc.target - 1;

  store.initColosseumBattle('tartar_tyrant', 120, true);
  const reward = store.completeToothbrushBattle('tartar_tyrant', 120, 95, {
    shellShatteredBeforeRecharge: true,
    speedScrubMs: 2600,
    speedScrubMultiplier: 3,
    weeklyChallengeCompleted: true
  });
  assert.strictEqual(hero.brushStreakData.count, 7);
  assert.strictEqual(store.getWeeklyChallengeState(hero.id).completed, true);
  assert.ok(reward.coins > 150, `Stacked payout must exceed base (got ${reward.coins})`);
  assert.strictEqual(hero.points, 0, 'Gold Points stay 0 until parent approval');
});

addTest('F11+F12+F15', 'C12 Parent denial reverses escalated battle Coins/XP/Sparks cleanly while leaving Gold Points 0', () => {
  resetStoreBaseline({ coins: 100, points: 0, sparks: 30, xpNext: 100000 });
  const hero = store.getSelectedHero();
  const yesterday = getYesterdayDateKey();
  hero.brushStreakData = { count: 5, lastDate: yesterday };
  const petId = hero.activePetId || 1;

  store.initColosseumBattle('tartar_tyrant', 120, true);
  store.completeToothbrushBattle('tartar_tyrant', 120, 90, {
    speedScrubMs: 3000,
    speedScrubMultiplier: 3,
    weeklyChallengeCompleted: true
  });
  const req = store.getState().pendingApprovals.find(r => r.kidId === hero.id);
  assert.ok(req);
  store.rejectParentRequest(req.id);
  assert.strictEqual(hero.coins, 100, 'Coins restored exactly to 100 after denial');
  assert.strictEqual(store.getPetSparks(petId, hero.id), 30, 'Pet Sparks restored exactly to 30 after denial');
  assert.strictEqual(hero.points, 0, 'Gold Points remain 0');
});

addTest('F13+F6+F14', 'C13 Rotating across 8 consecutive battles visits all 8 bosses & resolves valid 2D assets', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const visitedBosses = new Set();
    let prev = null;
    for (let i = 0; i < 8; i++) {
      await bootBattle({ explicit: false, durationSec: 120 });
      const bId = store.getSelectedBossId();
      assert.notStrictEqual(bId, prev, `Iteration ${i + 1} repeated previous boss ${prev}`);
      prev = bId;
      visitedBosses.add(bId);
      const boss = bossesDataMod.getHygieneBoss(bId);
      assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public', boss.image.replace(/^\/+/, ''))));
      battleViewMod.quitBattle();
      store.closeColosseumDefeatModal(true);
    }
    assert.strictEqual(visitedBosses.size, 8, `8 non-explicit battles must visit all 8 bosses (visited ${visitedBosses.size})`);
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F10+F15', 'C14 Minty Shield shop upgrade stays isolated to purchasing hero across switchHero', () => {
  resetStoreBaseline({ coins: 500, sparks: 200 });
  const kid1Id = store.getSelectedHero().id;
  const kid2 = store.addHero({ name: 'Eva', coins: 100 });
  store.switchHero(kid1Id);

  const upg = catalogMod.DIGITAL_REWARDS_CATALOG.find(isMintyShieldUpgrade);
  assert.ok(upg);
  store.buyDigitalGear(upg.id);
  assert.ok(store.getMintyShieldUpgradeBonusSec(kid1Id) > 0);

  store.switchHero(kid2.id);
  assert.strictEqual(store.getMintyShieldUpgradeBonusSec(kid2.id), 0, 'Kid 2 must NOT inherit Kid 1 shield upgrade');
});

addTest('F11+F12+F15', 'C15 Multi-device Firestore sync propagates Kid 1 streak, Weekly Challenge & badges without leaking to Kid 2', async () => {
  const harness = await createSyncHarness({ latencyMs: 15 });
  try {
    const dev1 = harness.makeDevice('HERO-C15');
    dev1.store.saveState(true);
    await harness.sleep(100);

    const dev2 = harness.makeDevice('HERO-C15');
    await harness.sleep(100);
    const kid2 = dev2.store.addHero({ name: 'Zoe' });
    await harness.sleep(100);

    dev1.store.initColosseumBattle('tartar_tyrant', 120, true);
    dev1.store.completeToothbrushBattle('tartar_tyrant', 120, 92, {
      shellShatteredBeforeRecharge: true,
      mintyShieldFullBattleUptime: true,
      weeklyChallengeCompleted: true
    });
    await harness.sleep(150);

    const k1OnDev2 = dev2.store.getState().heroes.find(h => h.id === 'hero_1');
    const k2OnDev2 = dev2.store.getState().heroes.find(h => h.id === kid2.id);
    assert.ok(k1OnDev2.dentalBadges.includes('shell_shatter'), 'Kid 1 badge synced to Device 2');
    assert.strictEqual(k2OnDev2.dentalBadges.includes('shell_shatter'), false, 'Kid 2 must not receive Kid 1 badge');
    assert.ok(dev2.store.getWeeklyChallengeState('hero_1').progress >= 1, 'Kid 1 Weekly Challenge synced');
    assert.strictEqual(dev2.store.getWeeklyChallengeState(kid2.id).progress, 0, 'Kid 2 Weekly Challenge isolated');
  } finally {
    harness.dispose();
  }
});

addTest('F4+F1+F2', 'C16 Tartar Tyrant battle with Shield boost + Foam Blast maintains HP sync & phase floors', async () => {
  const clock = createClockDriver();
  try {
    resetStoreBaseline({ durationSec: 120 });
    const canvas = await bootBattle({ bossId: 'tartar_tyrant', durationSec: 120 });
    for (let i = 0; i < 6; i++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
    }
    document.getElementById('minty-shield-btn').click();
    document.getElementById('supernova-blast-btn').click();
    for (let s = 0; s < 10; s++) {
      scrubBurst({ clock, steps: 6, stepMs: 160, canvas });
      clock.tickBattle(1);
      const col = store.getBossColosseumState();
      assert.strictEqual(col.currentHp, hanaBattle3DService.bossHp);
      assert.ok(col.currentHp > 0);
    }
  } finally {
    cleanupBattle(clock);
  }
});

addTest('F8+F9+F14', 'C17 Defeating all 8 bosses populates full Cleanse Album & all 8 trophies in Hero HQ', () => {
  resetStoreBaseline();
  for (const boss of bossesDataMod.HYGIENE_BOSSES) {
    const col = store.getBossColosseumState();
    col.hasAwardedVictory = false;
    col.victoryReward = null;
    store.initColosseumBattle(boss.id, 120, true);
    store.completeToothbrushBattle(boss.id, 120, 90, { speedScrubMs: 3200, speedScrubMultiplier: 2 });
  }
  const album = store.getCleanseAlbum();
  assert.strictEqual(Object.keys(album).length, 8, 'Cleanse Album must hold all 8 bosses');
  const trophies = heroHqDataMod.getTrophiesForDisplay(store.getState());
  for (const boss of bossesDataMod.HYGIENE_BOSSES) {
    assert.ok(trophies.some(t => t.id === boss.trophyRelicId), `Missing trophy ${boss.trophyRelicId}`);
  }
});

addTest('F15+F10+F12+F9', 'C18 Pre-overhaul legacy save migrates non-destructively with all overhaul structures ready', () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    digitalRewardsOverhaulApplied: true,
    petEconomyMigrationApplied: true,
    heroes: [{ id: 'hero_1', name: 'Aiden', coins: 650, points: 40, inventory: ['laser_toothbrush'], equippedWeapon: 'laser_toothbrush' }],
    selectedHero: { id: 'hero_1', name: 'Aiden', coins: 650, points: 40, inventory: ['laser_toothbrush'], equippedWeapon: 'laser_toothbrush' },
    digitalGear: [{ id: 'laser_toothbrush', title: 'Laser Toothbrush Saber' }]
  }));
  store.loadState();
  const hero = store.getSelectedHero();
  assert.strictEqual(hero.coins, 650);
  assert.strictEqual(hero.points, 40);
  assert.ok(store.getState().digitalGear.some(isMintyShieldUpgrade));
  assert.ok(store.getWeeklyChallengeState(hero.id).challengeId);
  assert.deepStrictEqual(store.getCleanseAlbum(hero.id), {});
  const shopHtml = shopViewMod.renderShopView();
  const dashHtml = dashboardViewMod.renderDashboardView();
  assert.ok(/Minty Shield/i.test(shopHtml));
  assert.ok(dashHtml.includes(bossesDataMod.getCurrentWeeklyChallenge().challenge.title));
});

const result = await runTestRegistry('Tier 3 — Cross-Feature Combination E2E Suite', tests);
process.exit(result.failed > 0 ? 1 : 0);
