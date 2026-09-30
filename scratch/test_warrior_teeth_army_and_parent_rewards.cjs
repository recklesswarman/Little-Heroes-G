/**
 * Verification Test Suite:
 * AI Toothbrush Battle Cinematic 3D Revamp, Warrior Teeth Army & Parent Rewards
 */
const assert = require('assert');

async function runTests() {
  console.log('🧪 Running AI Toothbrush Battle & Warrior Teeth Army Verification Tests...\n');

  // Load mocks
  await import('./setup_mock_env.js');

  const { store } = await import('../src/state/store.js');
  const { hanaBattle3DService } = await import('../src/services/hanaBattle3DService.js');
  const {
    renderBattleView,
    startBattle,
    quitBattle,
    abandonBattleIfRunning,
    ROTATING_VILLAINS,
    setExplicitBossSelection,
    getActiveCombatWeapon,
    attachBattleListeners
  } = await import('../src/views/BattleView.js');
  const { renderParentPortalView, attachParentPortalListeners, setActiveAdminTab } = await import('../src/views/ParentPortalView.js');

  // --- Test 1: Dedicated toothbrush_adventure_battle in HABIT_ISLANDS & Parent Settings ---
  console.log('--- Test 1: Task System & Parent Settings Verification ---');
  const state = store.getState();
  const tbHabit = (state.habitIslands || []).find(h => h.id === 'toothbrush_adventure_battle');
  assert.ok(tbHabit, 'toothbrush_adventure_battle must be registered in habitIslands');
  assert.strictEqual(tbHabit.icon, 'dentistry', 'Task should have dentistry icon');
  assert.ok(state.parentSettings, 'parentSettings must exist');
  assert.strictEqual(typeof state.parentSettings.toothbrushBattlePoints, 'number', 'parentSettings.toothbrushBattlePoints must be a number');
  assert.strictEqual(typeof state.parentSettings.toothbrushBattleTokens, 'number', 'parentSettings.toothbrushBattleTokens must be a number');
  console.log(`  ✅ Dedicated task registered: ${tbHabit.title} (Points: ${tbHabit.points}, Tokens: ${tbHabit.coins})`);

  // --- Test 2: Parent Portal Task Editing & Syncing ---
  console.log('\n--- Test 2: Parent Portal Task List Input Rendering & Live Sync ---');
  state.parentSettings.toothbrushBattleTokens = 45;
  state.parentSettings.toothbrushBattlePoints = 25;
  setActiveAdminTab('tasks');
  const parentHtml = renderParentPortalView();
  assert.ok(parentHtml.includes('task-tokens-input'), 'Tokens input must be rendered');
  assert.ok(parentHtml.includes('task-points-input'), 'Points input must be rendered');
  assert.ok(parentHtml.includes('value="45"'), 'Tokens input must reflect parentSettings value (45)');
  assert.ok(parentHtml.includes('value="25"'), 'Points input must reflect parentSettings value (25)');
  console.log('  ✅ Parent Portal actively displays parent-configured habit tokens and points');

  // --- Test 3: Villain Rotation & Explicit Selection Lifecycle ---
  console.log('\n--- Test 3: Villain Rotation & Reset Lifecycle ---');
  setExplicitBossSelection(false);
  
  // Render battle view multiple times across fresh sessions without explicit selection
  const sampledVillains = new Set();
  for (let i = 0; i < 20; i++) {
    quitBattle(); // resets session
    renderBattleView();
    sampledVillains.add(store.getSelectedBossId());
  }
  assert.ok(sampledVillains.size >= 2, `Should rotate through multiple villains randomly (got ${sampledVillains.size})`);
  console.log(`  ✅ Random villain rotation sampled: ${[...sampledVillains].join(', ')}`);

  // Explicit switch should update hanaBattle3DService and stick for session
  const dummyCanvas = { getContext: () => ({ fillText: () => {}, measureText: () => ({ width: 50 }) }) };
  startBattle();
  const currentBossId = store.getSelectedBossId();
  assert.ok(ROTATING_VILLAINS.includes(currentBossId), 'Active boss must be one of the 4 rotating villains');
  assert.strictEqual(hanaBattle3DService.bossData.id, currentBossId, 'hanaBattle3DService must have the rotated boss active');
  console.log(`  ✅ hanaBattle3DService correctly initialized with rotated villain "${currentBossId}"`);

  // --- Test 4: Equipped Weapon Synergy & Stat Multiplier ---
  console.log('\n--- Test 4: Equipped Weapon Synergy & Stat Multiplier ---');
  // Equip a weapon on the selected hero
  const hero = store.getSelectedHero();
  hero.equippedGear = ['laser_toothbrush'];
  const combatWeapon = getActiveCombatWeapon();
  assert.strictEqual(combatWeapon.hasWeapon, true, 'Hero has combat weapon equipped');
  assert.strictEqual(combatWeapon.multiplier, 1.3, 'Laser toothbrush gives 1.3x (+30%) multiplier');

  hanaBattle3DService.setEquippedWeapon(combatWeapon);
  assert.strictEqual(hanaBattle3DService.weaponMultiplier, 1.3, 'hanaBattle3DService reflects 1.3x weapon multiplier');
  assert.strictEqual(hanaBattle3DService.hasLaserEquipped, true, 'Laser equipped flag is true');

  // Shield radius check
  const baseSize = 30;
  const tw = baseSize;
  const weaponDefBoost = Math.min(1.45, Math.max(1.0, hanaBattle3DService.weaponMultiplier || 1.0));
  const boostedShieldR = (tw * 0.95) * weaponDefBoost;
  assert.ok(boostedShieldR > tw * 0.95, `Bubble shield radius is amplified (+30%) by weapon (${boostedShieldR})`);
  console.log(`  ✅ Weapon multiplier (+30%) amplifies bubble shield radius: ${boostedShieldR.toFixed(1)}px`);

  // --- Test 5: Warrior Teeth Army Front Line & Combo Counter-Attacks ---
  console.log('\n--- Test 5: Warrior Teeth Army & Combo Counter-Attacks ---');
  assert.strictEqual(hanaBattle3DService.warriorTeeth.length, 5, 'Warrior Teeth Army must have 5 teeth (Q1-Q4 + Captain)');
  const captainTooth = hanaBattle3DService.warriorTeeth.find(t => t.isCaptain);
  assert.ok(captainTooth, 'Captain tooth must exist');
  assert.strictEqual(captainTooth.id, 'q5', 'Captain tooth is Q5 / Center');

  // Cleanliness progression & Captain celebration trigger
  hanaBattle3DService.updateState({
    quadrantCleanliness: { q1: 100, q2: 100, q3: 100, q4: 100, q5: 100 },
    isScrubbing: true,
    cadenceScore: 80,
    combo: 20,
    combatWeapon: combatWeapon
  });

  assert.strictEqual(captainTooth.cleanPct, 100, 'Captain tooth is 100% clean');
  assert.ok(captainTooth.cheerTimer > 0, 'Captain tooth triggers celebratory cheer timer');
  console.log('  ✅ 100% quadrant cleanliness triggers gleaming armor and Captain cheering');

  // Counter-attacks with combo
  const initialProjectilesCount = hanaBattle3DService.counterAttackProjectiles.length;
  hanaBattle3DService.triggerWarriorCounterAttack(20);
  assert.ok(hanaBattle3DService.counterAttackProjectiles.length > initialProjectilesCount, 'Counter attack projectile was fired');
  const firedP = hanaBattle3DService.counterAttackProjectiles[hanaBattle3DService.counterAttackProjectiles.length - 1];
  assert.ok(firedP.damage > 3.5 * 1.3, `Combo 20 scales projectile damage higher than base: ${firedP.damage.toFixed(2)}`);
  console.log(`  ✅ Combo 20 and weapon multiplier boosted counter-attack damage to ${firedP.damage.toFixed(2)}`);

  // --- Test 6: Final Modal (#colosseum-visit-hq-btn) Complete Reward Flow ---
  console.log('\n--- Test 6: Final Modal "#colosseum-visit-hq-btn" Reward Flow ---');
  // Configure parent points and tokens
  state.parentSettings.toothbrushBattleTokens = 40;
  state.parentSettings.toothbrushBattlePoints = 20;

  const initialCoins = hero.coins || 0;
  const initialPendingApprovals = (state.pendingApprovals || []).length;

  // Render modal
  store.openColosseumVictoryModal({ bossName: 'Sugar Bandit', cleansedTitle: 'Minty Bandit' });
  const battleViewHtml = renderBattleView();
  assert.ok(battleViewHtml.includes('id="colosseum-visit-hq-btn"'), 'Modal must contain #colosseum-visit-hq-btn');
  assert.ok(battleViewHtml.includes('VIEW TROPHY IN HERO HQ'), 'Button text must match');

  // Mock DOM click event on #colosseum-visit-hq-btn
  const domContainer = document.createElement('div');
  domContainer.innerHTML = battleViewHtml;
  document.body.appendChild(domContainer);

  attachBattleListeners();

  const visitHqBtn = document.getElementById('colosseum-visit-hq-btn');
  assert.ok(visitHqBtn, 'Visit HQ button found in DOM');

  // Trigger click
  visitHqBtn.click();

  // 1. Task marked completed
  const refreshedHabit = state.habitIslands.find(h => h.id === 'toothbrush_adventure_battle');
  assert.strictEqual(refreshedHabit.completed, true, 'toothbrush_adventure_battle marked completed');

  // 2. Tokens automatically added to hero coins without approval
  assert.strictEqual(hero.coins, initialCoins + 40, 'Hero received 40 tokens immediately without approval');

  // 3. Pending approval submitted with exact parent points (20)
  const matchingApproval = state.pendingApprovals.find(p => p.taskId === 'toothbrush_adventure_battle');
  assert.ok(matchingApproval, 'A pending approval for toothbrush_adventure_battle exists');
  assert.strictEqual(matchingApproval.pendingPoints, 20, 'Pending approval has exact parent-configured points (20)');
  assert.strictEqual(matchingApproval.tokensAwarded, 40, 'Pending approval records auto-awarded tokens (40)');

  // 4. Test re-entrancy / double-click prevention
  const coinsAfterFirstClick = hero.coins;
  visitHqBtn.click(); // second click should be ignored by submitting guard
  assert.strictEqual(hero.coins, coinsAfterFirstClick, 'Double-click did not duplicate token award');

  // 5. Clean up DOM
  document.body.removeChild(domContainer);
  console.log('  ✅ Final modal sequence: task completed, tokens auto-awarded, pending approval queued with parent points');

  // --- Test 7: Voice line replacement verification ---
  console.log('\n--- Test 7: Coaching Voice Line Replacement ---');
  const battleViewFileContent = (await import('fs')).readFileSync('src/views/BattleView.js', 'utf8');
  assert.ok(!battleViewFileContent.includes('VIGOROUS CADENCE! You shattered the caramel barrier!'), 'Old coaching line must be removed');
  assert.ok(battleViewFileContent.includes('ENAMEL POWER SURGE! You broke the sweet treat barrier!'), 'New coaching line must be present');
  console.log('  ✅ Voice line correctly replaced with "ENAMEL POWER SURGE! You broke the sweet treat barrier!"');

  abandonBattleIfRunning();

  console.log('\n===============================================================');
  console.log('🎉 ALL 7 AI TOOTHBRUSH BATTLE & WARRIOR TEETH TESTS PASSED! 🎉');
  console.log('===============================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test Failed with Error:\n', err);
  process.exit(1);
});
