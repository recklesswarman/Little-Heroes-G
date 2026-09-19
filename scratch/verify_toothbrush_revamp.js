/**
 * verify_toothbrush_revamp.js
 * 
 * Comprehensive automated verification script for AR/AI Toothbrush Battle Revamp:
 * 1. Mirrored bathroom perspective quadrant consistency (hygieneBossesData.js & Dental3DMap.js).
 * 2. Single-source victory reward state and elimination of double-reward bug.
 * 3. Chore Turbo Boost travel time reduction on active expeditions.
 * 4. Module integrity for hanaBattle3DService & brushAudioAnalyzer.
 * 5. Supernova charging and threshold validation.
 */

import './setup_mock_env.js';
import { DENTAL_QUADRANTS, getDentalQuadrant, HYGIENE_BOSSES } from '../src/data/hygieneBossesData.js';
import { DENTAL_ZONES, renderDental3DMap } from '../src/components/Dental3DMap.js';
import { store } from '../src/state/store.js';
import { hanaBattle3DService, HanaBattle3DService } from '../src/services/hanaBattle3DService.js';
import { brushAudioAnalyzer } from '../src/audio/brushAudioAnalyzer.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('\n--- 1. Testing Mirrored Bathroom Perspective Quadrant Mapping ---');
{
  const q1 = DENTAL_QUADRANTS.find(q => q.id === 'q1');
  const q2 = DENTAL_QUADRANTS.find(q => q.id === 'q2');
  const q3 = DENTAL_QUADRANTS.find(q => q.id === 'q3');
  const q4 = DENTAL_QUADRANTS.find(q => q.id === 'q4');
  const q5 = DENTAL_QUADRANTS.find(q => q.id === 'q5');

  assert(q1 && q1.name.includes('Upper Right'), 'DENTAL_QUADRANTS: Q1 is Upper Right');
  assert(q1.brushPosition.x > 50, 'DENTAL_QUADRANTS: Q1 brushPosition is on screen right (>50)');
  assert(q1.roi.minX >= 32, 'DENTAL_QUADRANTS: Q1 ROI is on right half (minX >= 32)');

  assert(q2 && q2.name.includes('Upper Left'), 'DENTAL_QUADRANTS: Q2 is Upper Left');
  assert(q2.brushPosition.x < 50, 'DENTAL_QUADRANTS: Q2 brushPosition is on screen left (<50)');
  assert(q2.roi.maxX <= 32, 'DENTAL_QUADRANTS: Q2 ROI is on left half (maxX <= 32)');

  assert(q3 && q3.name.includes('Lower Right'), 'DENTAL_QUADRANTS: Q3 is Lower Right');
  assert(q3.brushPosition.x > 50, 'DENTAL_QUADRANTS: Q3 brushPosition is on screen right (>50)');

  assert(q4 && q4.name.includes('Lower Left'), 'DENTAL_QUADRANTS: Q4 is Lower Left');
  assert(q4.brushPosition.x < 50, 'DENTAL_QUADRANTS: Q4 brushPosition is on screen left (<50)');

  assert(q5 && q5.name.includes('Tongue'), 'DENTAL_QUADRANTS: Q5 is Tongue Polish');

  // Verify Dental3DMap zones match
  const z1 = DENTAL_ZONES.find(z => z.id === 'q1');
  const z2 = DENTAL_ZONES.find(z => z.id === 'q2');
  const z3 = DENTAL_ZONES.find(z => z.id === 'q3');
  const z4 = DENTAL_ZONES.find(z => z.id === 'q4');
  const z5 = DENTAL_ZONES.find(z => z.id === 'q5');

  assert(z1 && z1.name === 'Top Right Molars', 'DENTAL_ZONES: Q1 is Top Right Molars');
  assert(z1.arrowAngle === 45, 'DENTAL_ZONES: Q1 arrow points to Top Right (45 deg)');
  assert(z2 && z2.name === 'Top Left Molars', 'DENTAL_ZONES: Q2 is Top Left Molars');
  assert(z2.arrowAngle === -45, 'DENTAL_ZONES: Q2 arrow points to Top Left (-45 deg)');
  assert(z3 && z3.name === 'Bottom Right Molars', 'DENTAL_ZONES: Q3 is Bottom Right Molars');
  assert(z4 && z4.name === 'Bottom Left Molars', 'DENTAL_ZONES: Q4 is Bottom Left Molars');
  assert(z5 && z5.name === 'Tongue & Front Polish', 'DENTAL_ZONES: Q5 is Tongue & Front Polish');

  // Verify initial rendered arrow coordinates for Q1 (Right side)
  const initialMapHtml = renderDental3DMap({ activeQuadrant: 'q1' });
  assert(initialMapHtml.includes('translate(265, 65)'), 'renderDental3DMap: initial Q1 arrow placed on screen right (265, 65)');

  // Verify timer progression maps correctly
  assert(getDentalQuadrant(110, 120).id === 'q1', 'getDentalQuadrant: 110s remaining maps to Q1');
  assert(getDentalQuadrant(80, 120).id === 'q2', 'getDentalQuadrant: 80s remaining maps to Q2');
  assert(getDentalQuadrant(45, 120).id === 'q3', 'getDentalQuadrant: 45s remaining maps to Q3');
  assert(getDentalQuadrant(20, 120).id === 'q4', 'getDentalQuadrant: 20s remaining maps to Q4');
  assert(getDentalQuadrant(5, 120).id === 'q5', 'getDentalQuadrant: 5s remaining maps to Q5');
}

console.log('\n--- 2. Testing Single-Source Victory & Reward Consolidation ---');
{
  // Initialize Colosseum state
  store.initColosseumBattle('sugar_bandit', 120);
  const colState = store.getBossColosseumState();

  assert(colState.hasAwardedVictory === false, 'Colosseum state hasAwardedVictory is initially false');
  assert(colState.isVictoryModalOpen === false, 'Colosseum state isVictoryModalOpen is initially false');

  const hero = store.getState().selectedHero || (store.state.selectedHero = { id: 'hero_1', name: 'TestHero', coins: 100, xp: 50, streak: 1 });
  const initialCoins = hero.coins;
  const initialXp = hero.xp;
  const initialStreak = hero.streak;

  // Complete battle
  const reward = store.completeToothbrushBattle('sugar_bandit', 120, 88);

  assert(colState.isVictoryModalOpen === true, 'completeToothbrushBattle opens victory modal');
  assert(colState.hasAwardedVictory === true, 'completeToothbrushBattle sets hasAwardedVictory = true');
  assert(hero.coins > initialCoins, `Coins awarded once (+${hero.coins - initialCoins})`);
  assert(hero.xp > initialXp, `XP awarded once (+${hero.xp - initialXp})`);
  assert(hero.streak === initialStreak + 1, `Hero streak incremented by 1 (${hero.streak})`);
  assert(colState.bossesDefeated.includes('sugar_bandit'), 'Boss marked as defeated in colosseum state');

  const coinsAfterFirst = hero.coins;
  const xpAfterFirst = hero.xp;
  const streakAfterFirst = hero.streak;

  // Test Idempotency: call completeToothbrushBattle again
  const duplicateBattleCallReward = store.completeToothbrushBattle('sugar_bandit', 120, 88);
  assert(hero.coins === coinsAfterFirst, 'Double-reward prevented: Coins did not increase on second completeToothbrushBattle() call');
  assert(hero.xp === xpAfterFirst, 'Double-reward prevented: XP did not increase on second completeToothbrushBattle() call');
  assert(hero.streak === streakAfterFirst, 'Double-reward prevented: Streak did not increase on second completeToothbrushBattle() call');
  assert(duplicateBattleCallReward.bossId === 'sugar_bandit', 'completeToothbrushBattle idempotently returns existing victory reward');

  // Test legacy defeatColosseumBoss call
  const secondReward = store.defeatColosseumBoss();
  assert(hero.coins === coinsAfterFirst, 'Double-reward prevented: Coins did not increase on defeatColosseumBoss()');
  assert(hero.xp === xpAfterFirst, 'Double-reward prevented: XP did not increase on defeatColosseumBoss()');
  assert(hero.streak === streakAfterFirst, 'Double-reward prevented: Streak did not increase on defeatColosseumBoss()');
  assert(secondReward.bossId === 'sugar_bandit', 'defeatColosseumBoss safely returns existing victory reward');

  // Test next battle re-initialization clears hasAwardedVictory
  store.initColosseumBattle('plaque_kraken', 120);
  assert(colState.hasAwardedVictory === false, 'initColosseumBattle resets hasAwardedVictory = false for next battle');
  assert(colState.isVictoryModalOpen === false, 'initColosseumBattle resets isVictoryModalOpen = false');
}

console.log('\n--- 3. Testing Chore Turbo Boost on Pet Expeditions ---');
{
  const now = Date.now();
  store.state.activeExpeditions = [
    { id: 'exp_test_1', petId: 1, durationMinutes: 60, startTime: now, endTime: now + (45 * 60 * 1000) }
  ];

  const beforeEnd = store.state.activeExpeditions[0].endTime;
  const boostResult = store.applyChoreTurboBoost(15, 'Toothbrush AR Battle');

  const afterEnd = store.state.activeExpeditions[0].endTime;
  const diffMinutes = Math.round((beforeEnd - afterEnd) / (60 * 1000));

  assert(boostResult.boostedCount >= 1, 'applyChoreTurboBoost boosted active expedition');
  assert(diffMinutes === 15, `applyChoreTurboBoost shaved exactly 15 minutes off expedition (diff: ${diffMinutes}m)`);

  // Edge case: 0 active expeditions
  store.state.activeExpeditions = [];
  if (store.state.petSanctuary && store.state.petSanctuary.expedition) {
    store.state.petSanctuary.expedition.active = false;
  }
  const emptyBoost = store.applyChoreTurboBoost(15, 'Toothbrush AR Battle');
  assert(emptyBoost.boostedCount === 0, 'applyChoreTurboBoost safely handles 0 active expeditions without throwing');
}

console.log('\n--- 4. Testing Hana 3D Service & Audio Analyzer APIs ---');
{
  assert(typeof hanaBattle3DService.init === 'function', 'hanaBattle3DService.init exists');
  assert(typeof hanaBattle3DService.onArmorFracture === 'function', 'hanaBattle3DService.onArmorFracture exists');
  assert(typeof hanaBattle3DService.onFoamStream === 'function', 'hanaBattle3DService.onFoamStream exists');
  assert(typeof hanaBattle3DService.onDeflectRicochet === 'function', 'hanaBattle3DService.onDeflectRicochet exists');
  assert(typeof hanaBattle3DService.onCleanseVictory === 'function', 'hanaBattle3DService.onCleanseVictory exists');
  assert(typeof hanaBattle3DService.triggerSupernova === 'function', 'hanaBattle3DService.triggerSupernova exists');
  assert(typeof hanaBattle3DService.destroy === 'function', 'hanaBattle3DService.destroy exists');

  // Test armor plate fracture
  hanaBattle3DService.onArmorFracture('q1');
  assert(hanaBattle3DService.armorPlates.q1.intact === false, 'hanaBattle3DService: Q1 armor plate fractured');
  assert(hanaBattle3DService.candyShards.length > 0, 'hanaBattle3DService: 3D candy shards spawned');

  // Test shield fracture
  const shardsBeforeShield = hanaBattle3DService.candyShards.length;
  hanaBattle3DService.onArmorFracture('shield');
  assert(hanaBattle3DService.candyShards.length > shardsBeforeShield, 'hanaBattle3DService: Shield fracture spawns golden shards');

  // Test deflection & timer
  hanaBattle3DService.onDeflectRicochet();
  assert(hanaBattle3DService.isDeflectActive === true, 'hanaBattle3DService: Deflect active state set');
  assert(hanaBattle3DService.deflectTimer > 0, 'hanaBattle3DService: Deflect timer initialized');
  assert(hanaBattle3DService.shockwaves.length > 0, 'hanaBattle3DService: Shockwaves spawned on deflect');

  // Test re-initialization idempotency (prevent fractured plates from resetting on store updates)
  const mockCanvas = document.createElement('canvas');
  hanaBattle3DService.init(mockCanvas);
  hanaBattle3DService.onArmorFracture('q1');
  assert(hanaBattle3DService.armorPlates.q1.intact === false, 'hanaBattle3DService: Q1 armor fractured before re-init');

  // Re-init on same canvas (simulates store.notify during battle)
  hanaBattle3DService.init(mockCanvas);
  assert(hanaBattle3DService.armorPlates.q1.intact === false, 'hanaBattle3DService: Re-init idempotency preserves fractured armor plates');

  // Test caramel bomb spawn & ricochet
  hanaBattle3DService.caramelBombs = [];
  hanaBattle3DService.spawnCaramelBomb();
  assert(hanaBattle3DService.caramelBombs.length === 1, 'hanaBattle3DService: spawnCaramelBomb creates bomb');
  assert(hanaBattle3DService.caramelBombs[0].vz < 0, 'hanaBattle3DService: bomb initially moves toward player (vz < 0)');
  hanaBattle3DService.onDeflectRicochet();
  assert(hanaBattle3DService.caramelBombs[0].deflected === true, 'hanaBattle3DService: onDeflectRicochet marks bomb as deflected');
  assert(hanaBattle3DService.caramelBombs[0].vz > 0, 'hanaBattle3DService: onDeflectRicochet reverses bomb direction toward boss (vz > 0)');

  // Test cleanup
  hanaBattle3DService.destroy();
  assert(hanaBattle3DService.isDestroyed === true, 'hanaBattle3DService cleanly destroyed');
  assert(hanaBattle3DService.isInitialized === false, 'hanaBattle3DService isInitialized reset to false');

  // Test Audio Analyzer existingStream support
  assert(typeof brushAudioAnalyzer.startListening === 'function', 'brushAudioAnalyzer.startListening exists');
  assert(typeof brushAudioAnalyzer.stopListening === 'function', 'brushAudioAnalyzer.stopListening exists');
  assert(brushAudioAnalyzer.startListening.length >= 1, 'brushAudioAnalyzer.startListening accepts callback and stream parameter');
}

console.log('\n--- 5. Testing Chore Supernova Charging & Threshold ---');
{
  store.initColosseumBattle('sugar_bandit', 120);
  const col = store.getBossColosseumState();
  assert(col.choreSupernovaCharge !== undefined, `Supernova charge calculated: ${col.choreSupernovaCharge}%`);
  assert(col.choreSupernovaCharge >= 30, 'Supernova base charge >= 30%');

  // Test harmonized 40% threshold
  col.choreSupernovaCharge = 40;
  const supernovaResult = store.unleashChoreSupernova();
  assert(supernovaResult.success === true, 'unleashChoreSupernova fires successfully at 40% threshold');
  assert(col.choreSupernovaCharge === 0, 'Supernova discharges to 0 after firing');
}

console.log('\n--- 6. Testing Battle View Victory Modal Display ---');
{
  const { renderBattleView } = await import('../src/views/BattleView.js');

  store.initColosseumBattle('sugar_bandit', 120);
  store.completeToothbrushBattle('sugar_bandit', 120, 92);
  const col = store.getBossColosseumState();
  assert(col.isVictoryModalOpen === true, 'Colosseum victory modal is open after completion');

  const viewHtml = renderBattleView();
  assert(viewHtml.includes('colosseum-victory-modal'), 'renderBattleView: includes colosseum-victory-modal HTML');
  assert(viewHtml.includes('VILLAIN CLEANSED!'), 'renderBattleView: displays VILLAIN CLEANSED! text');
  assert(viewHtml.includes('colosseum-visit-hq-btn'), 'renderBattleView: displays VIEW TROPHY IN HERO HQ button');

  // Close modal
  store.closeColosseumVictoryModal();
  assert(col.isVictoryModalOpen === false, 'closeColosseumVictoryModal closes modal');
}

console.log('\n--- 7. Testing Subsequent Battle State Reset & Hardware Reconnect ---');
{
  const { hanaBattle3DService } = await import('../src/services/hanaBattle3DService.js');
  const { renderBattleView } = await import('../src/views/BattleView.js');

  // Simulate end of previous battle
  hanaBattle3DService.onCleanseVictory();
  assert(hanaBattle3DService.isVictory === true, 'hanaBattle3DService marked as victory');
  assert(hanaBattle3DService.bossHp === 0, 'hanaBattle3DService bossHp is 0 after cleanse');

  // Clean destruction
  hanaBattle3DService.destroy();
  assert(hanaBattle3DService.isVictory === false, 'hanaBattle3DService: destroy resets isVictory to false');
  assert(hanaBattle3DService.bossHp === 100, 'hanaBattle3DService: destroy resets bossHp to 100');
  assert(hanaBattle3DService.armorPlates.q1.intact === true, 'hanaBattle3DService: destroy resets Q1 armor plate to intact');

  // Simulate new battle init on a fresh canvas
  const canvas2 = document.createElement('canvas');
  hanaBattle3DService.init(canvas2);
  assert(hanaBattle3DService.isVictory === false, 'hanaBattle3DService: subsequent battle starts with isVictory = false');
  assert(hanaBattle3DService.bossHp === 100, 'hanaBattle3DService: subsequent battle starts with 100% HP');
  assert(hanaBattle3DService.armorPlates.q1.intact === true, 'hanaBattle3DService: subsequent battle has intact armor plates');

  // Verify video element is directly in Magic Mirror HTML
  const battleHtml = renderBattleView();
  assert(battleHtml.includes('id="ar-camera-feed"'), 'renderBattleView: includes ar-camera-feed video element');
  assert(battleHtml.includes('id="pip-window"'), 'renderBattleView: includes pip-window Magic Mirror frame');
  assert(battleHtml.includes('gem-arrow'), 'renderBattleView: includes gem-arrow pointer markers');

  // Verify setBoss preserves cleaned quadrants when switching villains mid-battle
  hanaBattle3DService.setBoss({ id: 'plaque_kraken', name: 'Plaque Kraken' }, { q1: 100, q2: 50 });
  assert(hanaBattle3DService.armorPlates.q1.intact === false, 'hanaBattle3DService: setBoss preserves fractured Q1 plate when 100% clean');
  assert(hanaBattle3DService.armorPlates.q2.intact === true, 'hanaBattle3DService: setBoss keeps incomplete Q2 plate intact');

  hanaBattle3DService.destroy();
}

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
