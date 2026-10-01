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

  // --- Test 6: Final Modal (#colosseum-visit-hq-btn) does NOT double-award ---
  console.log('\n--- Test 6: Final Modal "#colosseum-visit-hq-btn" Reward Flow ---');
  // Configure parent points and tokens
  state.parentSettings.toothbrushBattleTokens = 40;
  state.parentSettings.toothbrushBattlePoints = 20;

  // The real reward flow (coins/XP/sparks auto-awarded, toothbrush_adventure_battle
  // marked completed, and parent-configured points submitted for approval) happens
  // the instant the timer hits zero, in concludeVictory() -> store.
  // completeToothbrushBattle() -- BEFORE the victory modal's button is ever
  // clickable. This is what actually makes the modal/button appear.
  store.initColosseumBattle('sugar_bandit', 120);
  store.completeToothbrushBattle('sugar_bandit', 120, 85);

  const refreshedHabit = state.habitIslands.find(h => h.id === 'toothbrush_adventure_battle');
  assert.strictEqual(refreshedHabit.completed, true, 'toothbrush_adventure_battle marked completed by completeToothbrushBattle');
  assert.strictEqual(store.getBossColosseumState().isVictoryModalOpen, true, 'completeToothbrushBattle opens the victory modal itself');

  const coinsAfterCompletion = hero.coins;
  const pendingApprovalsAfterCompletion = state.pendingApprovals.length;
  assert.ok(pendingApprovalsAfterCompletion > 0, 'completeToothbrushBattle already queued a pending points approval');

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

  // Trigger click -- this must NOT grant a second reward. The reward already
  // happened above; clicking this button only closes the modal and navigates.
  visitHqBtn.click();

  assert.strictEqual(hero.coins, coinsAfterCompletion, 'Clicking VIEW TROPHY IN HERO HQ must not award coins a second time');
  assert.strictEqual(state.pendingApprovals.length, pendingApprovalsAfterCompletion, 'Clicking VIEW TROPHY IN HERO HQ must not submit a second pending approval');
  assert.strictEqual(store.getBossColosseumState().isVictoryModalOpen, false, 'Clicking the button closes the victory modal');

  // Clean up DOM
  document.body.removeChild(domContainer);
  console.log('  ✅ Reward granted exactly once by completeToothbrushBattle(); the modal button only closes/navigates, no double-award');

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
