// scratch/verify_toothbrush_enhancements_and_sky_attacks.mjs
// Verification suite for AI Toothbrush Timer Platform Enhancements & Upgrades

import './setup_mock_env.js';
import { renderBattleView, attachBattleListeners } from '../src/views/BattleView.js';
import { hanaBattle3DService } from '../src/services/hanaBattle3DService.js';
import { renderLiveRexWidget } from '../src/components/LiveRexWidget.js';
import { store } from '../src/state/store.js';

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

console.log('\n🧪 Starting AI Toothbrush Enhancements & Sky Attacks Verification...\n');

// =========================================================================
// 1. TOP-CENTERED COUNTDOWN TIMER & HUD LAYOUT
// =========================================================================
console.log('--- 1. Testing Top-Centered Countdown Timer in BattleView ---');
store.initColosseumBattle('sugar_bandit', 120);
const battleHtml = renderBattleView();

assert(battleHtml.includes('id="battle-timer-capsule"'), 'Found #battle-timer-capsule in BattleView HTML');
assert(battleHtml.includes('id="battle-timer-display"'), 'Found #battle-timer-display in BattleView HTML');
assert(battleHtml.includes('left-1/2 -translate-x-1/2'), 'Timer capsule is horizontally centered at top of screen');
assert(battleHtml.includes('id="battle-quit-btn"'), 'Found #battle-quit-btn in BattleView HTML');
assert(battleHtml.includes('id="boss-hp-bar"'), 'Found #boss-hp-bar in BattleView HTML');

// =========================================================================
// 2. REMOVAL OF SECOND REX PILL FROM ARENA FLOOR
// =========================================================================
console.log('\n--- 2. Testing Removal of Second Rex Pill in BattleView ---');
assert(!battleHtml.includes('id="rex-companion-pill"'), '#rex-companion-pill is completely removed from BattleView');

// =========================================================================
// 3. ELEVATED WARRIOR TEETH ARMY COORDINATES
// =========================================================================
console.log('\n--- 3. Testing Elevated Warrior Teeth Army Coordinates ---');
const warriorTeeth = hanaBattle3DService.warriorTeeth;
assert(Array.isArray(warriorTeeth) && warriorTeeth.length === 5, 'Warrior Teeth army has 5 teeth');

warriorTeeth.forEach(t => {
  assert(t.yRatio >= 0.68 && t.yRatio <= 0.73, `Tooth ${t.name} (${t.label}) is elevated: yRatio=${t.yRatio}`);
});

// =========================================================================
// 4. SKY-FALL SUGAR ATTACKS (FALLING FROM TOP OF SCREEN)
// =========================================================================
console.log('\n--- 4. Testing Sky-Fall Sugar Attack Spawning ---');
hanaBattle3DService.width = 800;
hanaBattle3DService.height = 600;
hanaBattle3DService.caramelBombs = [];

hanaBattle3DService.spawnCaramelBomb({
  id: 'cookies',
  name: 'Cookies',
  color: '#d97706',
  shatterType: 'cookie_crumbs',
  shatterColors: ['#d97706', '#92400e', '#451a03'],
  image: '/assets/hazards/cookies.jpg'
});

assert(hanaBattle3DService.caramelBombs.length === 1, 'Caramel bomb spawned');
const bomb = hanaBattle3DService.caramelBombs[0];
assert(bomb.y <= 0, `Bomb starts at or above the top of screen: startY=${bomb.y}`);
assert(bomb.vy > 0, `Bomb has downward velocity falling toward player: vy=${bomb.vy.toFixed(2)}`);
assert(bomb.x > 0 && bomb.x < 800, `Bomb is horizontally distributed: x=${bomb.x.toFixed(2)}`);

// =========================================================================
// 5. TODDLER-FRIENDLY TAP HITBOX DEFLECTION
// =========================================================================
console.log('\n--- 5. Testing Toddler-Friendly Tap Hitbox Deflection ---');
// Position a bomb mid-fall
bomb.x = 400;
bomb.y = 250;
bomb.z = 50;

// Test miss: tap far away (150px away)
const missResult = hanaBattle3DService.checkAndDeflectBombAt(400, 420);
assert(missResult === false, 'Tapping far away does not deflect the bomb');
assert(hanaBattle3DService.caramelBombs.length === 1, 'Bomb still active after tap miss');

// Test hit: tap within 55px generous hitbox
const hitResult = hanaBattle3DService.checkAndDeflectBombAt(415, 260); // ~18px away
assert(hitResult === true, 'Tapping within generous 55px radius deflects the bomb');
assert(hanaBattle3DService.caramelBombs.length === 0, 'Shattered bomb removed from active bombs list');
assert(hanaBattle3DService.candyShards.length > 0, 'Shattered bomb created candy shards');
assert(hanaBattle3DService.shockwaves.length > 0, 'Deflection triggered shockwave');

// =========================================================================
// 6. CANVAS POINTERDOWN INTEGRATION IN BATTLEVIEW
// =========================================================================
console.log('\n--- 6. Testing Canvas Pointerdown Integration in BattleView ---');
document.body.innerHTML = battleHtml;
attachBattleListeners();

const canvas = document.getElementById('battle-webgl-canvas');
assert(canvas !== null, 'Canvas element exists in DOM');

// Spawn another bomb and test canvas pointerdown
hanaBattle3DService.spawnCaramelBomb();
const testBomb = hanaBattle3DService.caramelBombs[0];
testBomb.x = 200;
testBomb.y = 150;
testBomb.z = 40;

// Mock canvas bounds
canvas.getBoundingClientRect = () => ({
  left: 0,
  top: 0,
  width: 800,
  height: 600
});
canvas.width = 800;
canvas.height = 600;

// Trigger pointerdown near bomb
const tapEvent = new MouseEvent('pointerdown', {
  clientX: 210,
  clientY: 155,
  bubbles: true
});
canvas.dispatchEvent(tapEvent);

assert(hanaBattle3DService.caramelBombs.length === 0, 'Canvas pointerdown event successfully deflected falling sugar bomb');

// =========================================================================
// 7. APP-WIDE LIVE REX WIDGET SIZE REDUCTION
// =========================================================================
console.log('\n--- 7. Testing App-Wide Live Rex Widget Size Reduction ---');
const rexHtml = renderLiveRexWidget();

assert(rexHtml.includes('w-12 h-12 sm:w-13 sm:h-13'), 'Live Rex mascot button has compact w-12 h-12 sm:w-13 sm:h-13 footprint');
assert(rexHtml.includes('width="48"') && rexHtml.includes('height="48"'), 'Skeletal face viewer canvas sized to 48x48');
assert(rexHtml.includes('w-5 h-5'), 'Status pill badge sized to compact w-5 h-5');
assert(rexHtml.includes('bottom-20 right-3 sm:bottom-24 sm:right-5'), 'Live Rex container neatly positioned with compact offsets');

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
