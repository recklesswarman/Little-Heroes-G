/**
 * Verification Suite: Toothbrush Battle 3D Visual Refresh & Sugar Hazard Rotation
 */
const assert = require('assert');

async function runTests() {
  console.log('🧪 Running Toothbrush Battle 3D Visual Refresh & Sugar Hazard Rotation Tests...');

  // 1. Verify HYGIENE_BOSSES & Assets
  const { HYGIENE_BOSSES, SUGAR_ATTACK_HAZARDS, getRandomSugarHazard } = await import('../src/data/hygieneBossesData.js');

  console.log('\n--- 1. Testing HYGIENE_BOSSES Roster & 3D Character Art ---');
  assert.strictEqual(HYGIENE_BOSSES.length >= 4, true, 'Should have at least 4 primary hygiene bosses');
  
  const expectedBossIds = ['sugar_bandit', 'plaque_kraken', 'cavity_knight', 'tartar_titan'];
  expectedBossIds.forEach(id => {
    const boss = HYGIENE_BOSSES.find(b => b.id === id);
    assert.ok(boss, `Boss with id "${id}" should exist in HYGIENE_BOSSES`);
    assert.ok(boss.image, `Boss "${id}" must have an illustrated image path`);
    assert.ok(boss.cleansedImage, `Boss "${id}" must have a cleansed counterpart image path`);
    console.log(`  ✅ Boss "${boss.name}" (${boss.id}): image=${boss.image}, cleansed=${boss.cleansedImage}`);
  });

  // 2. Verify SUGAR_ATTACK_HAZARDS Definitions
  console.log('\n--- 2. Testing 7 Rotating Sugar Attack Hazards ---');
  assert.strictEqual(SUGAR_ATTACK_HAZARDS.length, 7, 'Should have exactly 7 sugar attack hazards');

  const expectedHazardIds = [
    'smarties',
    'lava_cake',
    'mint_icecream',
    'soda',
    'cookies',
    'gummy_bears',
    'lollipops'
  ];

  expectedHazardIds.forEach(hazardId => {
    const hazard = SUGAR_ATTACK_HAZARDS.find(h => h.id === hazardId);
    assert.ok(hazard, `Hazard "${hazardId}" must exist in SUGAR_ATTACK_HAZARDS`);
    assert.ok(hazard.name, `Hazard "${hazardId}" must have a display name`);
    assert.ok(hazard.emoji, `Hazard "${hazardId}" must have an emoji`);
    assert.ok(hazard.rexWarning, `Hazard "${hazardId}" must have a Rex voice warning`);
    assert.ok(hazard.shatterType, `Hazard "${hazardId}" must define a shatterType`);
    assert.ok(Array.isArray(hazard.shatterColors), `Hazard "${hazardId}" must define shatterColors`);
    assert.ok(hazard.image, `Hazard "${hazardId}" must specify an image asset`);
    console.log(`  ✅ Hazard "${hazard.name}" (${hazard.emoji}): shatterType=${hazard.shatterType}, colors=${hazard.shatterColors.length}`);
  });

  // 3. Verify getRandomSugarHazard Randomizer
  console.log('\n--- 3. Testing getRandomSugarHazard Functionality ---');
  const sampledHazards = new Set();
  for (let i = 0; i < 40; i++) {
    const h = getRandomSugarHazard();
    assert.ok(h && h.id, 'getRandomSugarHazard must return a valid hazard object');
    sampledHazards.add(h.id);
  }
  assert.ok(sampledHazards.size >= 4, 'Multiple runs of getRandomSugarHazard should produce varied hazards');
  console.log(`  ✅ Successfully sampled ${sampledHazards.size} unique hazard types across 40 random rolls`);

  // 4. Verify hanaBattle3DService Methods
  console.log('\n--- 4. Testing hanaBattle3DService Hazard & Boss Engine APIs ---');
  const { hanaBattle3DService } = await import('../src/services/hanaBattle3DService.js');

  assert.strictEqual(typeof hanaBattle3DService.setHazard, 'function', 'setHazard must be a function on hanaBattle3DService');
  assert.strictEqual(typeof hanaBattle3DService.spawnCaramelBomb, 'function', 'spawnCaramelBomb must be a function');
  assert.strictEqual(typeof hanaBattle3DService.setBoss, 'function', 'setBoss must be a function');

  // Test setHazard & spawn
  const testHazard = SUGAR_ATTACK_HAZARDS[0];
  hanaBattle3DService.setHazard(testHazard);
  assert.strictEqual(hanaBattle3DService.currentHazard.id, testHazard.id, 'currentHazard should be updated');

  hanaBattle3DService.spawnCaramelBomb(testHazard);
  assert.strictEqual(hanaBattle3DService.caramelBombs.length, 1, 'Caramel bomb with hazard should be queued');
  const spawnedBomb = hanaBattle3DService.caramelBombs[0];
  assert.strictEqual(spawnedBomb.hazard.id, testHazard.id, 'Spawned bomb should contain the test hazard');
  console.log('  ✅ hanaBattle3DService.setHazard and spawnCaramelBomb passed with 3D hazard registration');

  // Test setBoss with new Tartar Titan
  const tartarTitan = HYGIENE_BOSSES.find(b => b.id === 'tartar_titan');
  hanaBattle3DService.setBoss(tartarTitan);
  assert.strictEqual(hanaBattle3DService.bossData.id, 'tartar_titan', 'Boss id should be tartar_titan');
  console.log('  ✅ hanaBattle3DService.setBoss successfully loaded Tartar Titan & preloaded artwork');

  // 5. Verify BattleView Rendering with Hazard & 4 Villains Dock
  console.log('\n--- 5. Testing BattleView HTML Output ---');
  const { renderBattleView, startBattle, abandonBattleIfRunning, isNighttimeBattle, shouldRunFlossBattle } = await import('../src/views/BattleView.js');

  assert.strictEqual(typeof renderBattleView, 'function', 'renderBattleView must be exported');
  assert.strictEqual(typeof startBattle, 'function', 'startBattle must be exported');
  assert.strictEqual(typeof isNighttimeBattle, 'function', 'isNighttimeBattle must be exported');
  assert.strictEqual(typeof shouldRunFlossBattle, 'function', 'shouldRunFlossBattle must be exported');

  // Start battle to initialize currentSugarHazard
  startBattle();

  const battleHtml = renderBattleView();
  assert.ok(battleHtml.includes('id="battle-webgl-canvas"'), 'Canvas element must be present in BattleView');
  assert.ok(battleHtml.includes('id="sugar-hazard-badge"'), 'Sugar hazard badge must be present in BattleView HUD');
  assert.ok(battleHtml.includes('data-villain-id="sugar_bandit"'), 'Sugar Bandit button must be in bottom dock');
  assert.ok(battleHtml.includes('data-villain-id="plaque_kraken"'), 'Plaque Kraken button must be in bottom dock');
  assert.ok(battleHtml.includes('data-villain-id="cavity_knight"'), 'Cavity Knight button must be in bottom dock');
  assert.ok(battleHtml.includes('data-villain-id="tartar_titan"'), 'Tartar Titan button must be in bottom dock');
  console.log('  ✅ BattleView rendered full HUD with active Sugar Hazard badge & 4-villain dock');

  // Clean up timers
  abandonBattleIfRunning();

  console.log('\n🎉 ALL 5 TOOTHBRUSH BATTLE 3D REFRESH TEST SUITES PASSED FLAWLESSLY! 🎉\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
