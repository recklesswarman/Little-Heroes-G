import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { HYGIENE_BOSSES, SUGAR_ATTACK_HAZARDS, getHygieneBoss, getSugarHazardById } from '../src/data/hygieneBossesData.js';
import { renderBattleView, attachBattleListeners, startBattle, abandonBattleIfRunning } from '../src/views/BattleView.js';
import { hanaBattle3DService } from '../src/services/hanaBattle3DService.js';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

const NEW_BOSS_IDS = ['fizz_serpent', 'cookie_colossus', 'gummy_ghost'];
const NEW_HAZARD_IDS = ['donut', 'cupcake', 'chocolate_bar', 'pudding_cup'];
const REQUIRED_BOSS_FIELDS = ['name', 'title', 'avatar', 'color', 'maxHp', 'shieldHp', 'shieldMilestones', 'attackName', 'weakness', 'rewardCoins', 'rewardXP', 'rewardSparks', 'trophyRelicId', 'bombColor', 'bombName', 'cleansedTitle', 'cleansedAvatar'];
const REQUIRED_HAZARD_FIELDS = ['name', 'shortName', 'emoji', 'color', 'accentColor', 'flavorText', 'rexWarning', 'shatterType', 'shatterColors'];

console.log('\n--- 1. New bosses are fully-shaped data entries ---');
assert(HYGIENE_BOSSES.length >= 7, `HYGIENE_BOSSES expanded to at least 7 (has ${HYGIENE_BOSSES.length})`);
for (const id of NEW_BOSS_IDS) {
  const boss = HYGIENE_BOSSES.find(b => b.id === id);
  assert(Boolean(boss), `New boss "${id}" exists in HYGIENE_BOSSES`);
  if (boss) {
    for (const field of REQUIRED_BOSS_FIELDS) {
      assert(boss[field] !== undefined && boss[field] !== null, `Boss "${id}" has a "${field}" field`);
    }
    assert(getHygieneBoss(id) === boss, `getHygieneBoss("${id}") resolves to the same boss entry`);
  }
}

const bossIds = HYGIENE_BOSSES.map(b => b.id);
assert(new Set(bossIds).size === bossIds.length, 'No duplicate boss ids across the full roster');
const hpCurve = HYGIENE_BOSSES.map(b => b.maxHp);
assert(new Set(hpCurve).size === hpCurve.length, 'Every boss has a distinct maxHp (no two feel identical in difficulty)');

console.log('\n--- 2. New sugar hazards are fully-shaped data entries ---');
assert(SUGAR_ATTACK_HAZARDS.length >= 11, `SUGAR_ATTACK_HAZARDS expanded to at least 11 (has ${SUGAR_ATTACK_HAZARDS.length})`);
for (const id of NEW_HAZARD_IDS) {
  const hazard = SUGAR_ATTACK_HAZARDS.find(h => h.id === id);
  assert(Boolean(hazard), `New hazard "${id}" exists in SUGAR_ATTACK_HAZARDS`);
  if (hazard) {
    for (const field of REQUIRED_HAZARD_FIELDS) {
      assert(hazard[field] !== undefined && hazard[field] !== null, `Hazard "${id}" has a "${field}" field`);
    }
    assert(getSugarHazardById(id) === hazard, `getSugarHazardById("${id}") resolves to the same hazard entry`);
  }
}
const hazardIds = SUGAR_ATTACK_HAZARDS.map(h => h.id);
assert(new Set(hazardIds).size === hazardIds.length, 'No duplicate hazard ids across the full pool');

console.log('\n--- 3. New hazards are reachable via the existing rotation shuffle-bag ---');
store.state.heroes = [{ id: 'hazard_test_hero', name: 'Test', hazardRotationQueue: undefined, lastHazardId: undefined }];
const drawnAcrossFullCycle = new Set();
for (let i = 0; i < SUGAR_ATTACK_HAZARDS.length; i++) {
  drawnAcrossFullCycle.add(store.drawNextSugarHazardId('hazard_test_hero'));
}
for (const id of NEW_HAZARD_IDS) {
  assert(drawnAcrossFullCycle.has(id), `New hazard "${id}" is drawn within one full rotation cycle`);
}

console.log('\n--- 4. New bosses are selectable through the real in-battle villain switcher ---');
store.state.selectedHero = store.state.heroes[0];
store.state.selectedHero.gameDifficulty = 'medium';
store.state.activeView = 'ar_battle';
document.body.innerHTML = renderBattleView();
attachBattleListeners();
startBattle();

for (const id of NEW_BOSS_IDS) {
  const btn = document.querySelector(`[data-villain-id="${id}"]`);
  assert(Boolean(btn), `Found a real villain-switch button for new boss "${id}"`);
  if (btn) {
    btn.click();
    assert(store.state.selectedBossId === id, `Clicking the switcher button actually selects "${id}" as the active boss`);
  }
}

console.log('\n--- 5. hanaBattle3DService.setBoss() handles a new boss without throwing ---');
for (const id of NEW_BOSS_IDS) {
  const boss = HYGIENE_BOSSES.find(b => b.id === id);
  let threw = false;
  try {
    hanaBattle3DService.setBoss(boss);
  } catch (e) {
    threw = true;
    console.error(e);
  }
  assert(!threw, `hanaBattle3DService.setBoss() accepts new boss "${id}" without throwing`);
  assert(Boolean(hanaBattle3DService.bossData?.bodyColor), `setBoss() assigned a procedural bodyColor for "${id}" (graceful fallback coloring works)`);
}

abandonBattleIfRunning();

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);

process.exit(failed > 0 ? 1 : 0);
