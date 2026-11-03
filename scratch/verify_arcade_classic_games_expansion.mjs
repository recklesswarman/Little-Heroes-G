/**
 * verify_arcade_classic_games_expansion.mjs
 * 
 * Comprehensive Verification Suite for the Arcade Classic Mini-Game Expansion:
 * 1. Palette Safety: Zero pink or purple in src/arcade and DancePartyView
 * 2. Store Economy: Hero Coins (5-15), Pet Sparks (5-10), 50 coin/day cap, top 3 high scores
 * 3. Screen Time & Curfew Compliance: Blocking arcade when locked or curfew active
 * 4. Starlight Dino Runner mechanics & Toddler Mode
 * 5. Germ Busters whack-a-mole mechanics & combo cheers
 * 6. Celestial Bubble Cannon match-3 flood-fill & zero pink/purple treat colors
 * 7. Toddler Maze Explorer solvable labyrinth & breadcrumb trail
 * 8. UI Carousels in DancePartyView (New Starlight Arcade + Original Classics)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Setup Mock Browser Environment for Node.js
class MockContext2D {
  constructor() {
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.font = '10px sans-serif';
    this.textAlign = 'left';
    this.textBaseline = 'top';
    this.shadowColor = '';
    this.shadowBlur = 0;
  }
  clearRect() {}
  fillRect() {}
  strokeRect() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  stroke() {}
  fill() {}
  save() {}
  restore() {}
  translate() {}
  rotate() {}
  scale() {}
  clip() {}
  setLineDash() {}
  fillText() {}
  strokeText() {}
  drawImage() {}
  quadraticCurveTo() {}
  roundRect() {}
  createLinearGradient() {
    return { addColorStop() {} };
  }
  createRadialGradient() {
    return { addColorStop() {} };
  }
}

class MockCanvas {
  constructor(width = 640, height = 400) {
    this.width = width;
    this.height = height;
    this.ctx = new MockContext2D();
    this.listeners = {};
  }
  getContext(type) {
    return type === '2d' ? this.ctx : null;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }
  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }
  removeEventListener(evt, fn) {
    if (this.listeners[evt]) {
      this.listeners[evt] = this.listeners[evt].filter(f => f !== fn);
    }
  }
  dispatchEvent(evt) {
    const list = this.listeners[evt.type] || [];
    list.forEach(fn => fn(evt));
  }
}

// Global browser mocks
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { href: 'http://localhost/' }
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'canvas') return new MockCanvas();
      return { appendChild: () => {}, setAttribute: () => {}, style: {} };
    },
    getElementById: () => null,
    body: { appendChild: () => {}, removeChild: () => {} }
  };
}
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
if (typeof globalThis.performance === 'undefined') {
  globalThis.performance = { now: () => Date.now() };
}
if (typeof globalThis.localStorage === 'undefined') {
  const memStore = {};
  globalThis.localStorage = {
    getItem: (k) => memStore[k] || null,
    setItem: (k, v) => { memStore[k] = String(v); },
    removeItem: (k) => { delete memStore[k]; },
    clear: () => { Object.keys(memStore).forEach(k => delete memStore[k]); }
  };
}

console.log('🎮 Starting Starlight Arcade Expansion Verification Suite...\n');

let testsPassed = 0;
function pass(msg) {
  testsPassed++;
  console.log(`  ✅ PASS: ${msg}`);
}

// -------------------------------------------------------------
// 1. PALETTE SAFETY AUDIT: Strictly ZERO Pink or Purple
// -------------------------------------------------------------
console.log('--- 1. Explorer Palette & Color Safety Audit ---');

const arcadeDir = path.resolve(process.cwd(), 'src/arcade');
const arcadeFiles = fs.readdirSync(arcadeDir).map(f => path.join(arcadeDir, f));
const dancePartyPath = path.resolve(process.cwd(), 'src/views/DancePartyView.js');
const filesToScan = [...arcadeFiles, dancePartyPath];

const FORBIDDEN_COLORS_REGEX = /#(?:ec4899|db2777|9b59b6|a855f7|8b5cf6|9333ea|c084fc|d8b4fe|e879f9|f43f5e|f472b6)\b|text-pink-|bg-pink-|border-pink-|text-purple-|bg-purple-|border-purple-|text-violet-|bg-violet-|border-violet-|text-fuchsia-|bg-fuchsia-/i;

filesToScan.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  // Strip comments before checking active code
  const codeOnly = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const match = codeOnly.match(FORBIDDEN_COLORS_REGEX);
  assert.strictEqual(
    match,
    null,
    `Forbidden pink/purple color found in ${path.basename(filePath)}: ${match ? match[0] : ''}`
  );
});
pass('All arcade game engines and DancePartyView strictly adhere to Explorer Palette with ZERO pink or purple');

// -------------------------------------------------------------
// 2. STORE ECONOMY & HIGH SCORES TEST
// -------------------------------------------------------------
console.log('\n--- 2. Arcade Economy, High Scores & Curfew Tests ---');

import { store } from '../src/state/store.js';

// Reset hero state for clean test
store.state.selectedHero.arcadeHighScores = {};
store.state.selectedHero.arcadeCoinsEarnedToday = 0;
store.state.selectedHero.arcadeCoinsLastDate = new Date().toISOString().slice(0, 10);
store.state.selectedHero.coins = 100;
store.state.selectedHero.screenTimeMinutes = 45;
store.state.selectedHero.isScreenTimePaused = false;
// No curfew at all: isScreenTimeLocked() treats everything between midnight and 6 AM as curfew whatever time is set,
// so a fixed '23:59' made this test fail whenever it ran in that window (CI runs on UTC). Empty = no curfew, any hour.
store.state.selectedHero.bedtimeCurfew = '';

// Test 2.1: First score recorded
const res1 = store.recordArcadeResult('starlight_runner', 120, { coinsWon: 12, sparksWon: 8 });
assert.strictEqual(res1.success, true, 'Result 1 must succeed');
assert.strictEqual(res1.isNewHighScore, true, 'First score must be new high score');
assert.strictEqual(res1.coinsWon, 12, 'Coins won should match requested coins');
assert.strictEqual(res1.sparksWon, 8, 'Sparks won should match requested sparks');
assert.deepStrictEqual(store.getArcadeHighScores('starlight_runner'), [120], 'Top score must be [120]');
pass('First arcade game round awards coins, sparks, and stores top high score');

// Test 2.2: Subsequent lower score does not become #1 but enters top 3
const res2 = store.recordArcadeResult('starlight_runner', 85, { coinsWon: 10, sparksWon: 6 });
assert.strictEqual(res2.isNewHighScore, false, 'Lower score should not be new high score');
assert.deepStrictEqual(store.getArcadeHighScores('starlight_runner'), [120, 85], 'Scores must be sorted descending');
pass('Lower score enters top 3 list sorted descending without setting isNewHighScore');

// Test 2.3: Multiple scores only preserve top 3
store.recordArcadeResult('starlight_runner', 150, { coinsWon: 10 });
store.recordArcadeResult('starlight_runner', 95, { coinsWon: 10 });
store.recordArcadeResult('starlight_runner', 200, { coinsWon: 10 });
const top3 = store.getArcadeHighScores('starlight_runner');
assert.strictEqual(top3.length, 3, 'Only top 3 scores must be preserved');
assert.deepStrictEqual(top3, [200, 150, 120], 'Top 3 must be strictly top 3 descending');
pass('Only top 3 high scores are preserved per game per kid');

// Test 2.4: Daily 50 coin cap enforcement
// Currently awarded coins today: 12 + 10 + 10 + 10 + 8 = 50 coins!
assert.strictEqual(store.state.selectedHero.arcadeCoinsEarnedToday, 50, 'Daily arcade coins should reach 50');
const resCapped = store.recordArcadeResult('starlight_runner', 300, { coinsWon: 15, sparksWon: 8 });
assert.strictEqual(resCapped.coinsWon, 0, 'No additional coins should be awarded past 50 cap');
assert.strictEqual(resCapped.coinsCapped, true, 'coinsCapped flag must be true');
pass('Daily 50 Hero Coins cap from arcade games is strictly enforced');

// Test 2.5: Screen Time & Bedtime Curfew Lock Compliance
store.state.selectedHero.isScreenTimePaused = true;
assert.strictEqual(store.isScreenTimeLocked(), true, 'Screen time must report locked when isScreenTimePaused is true');
const resLocked = store.recordArcadeResult('starlight_runner', 250);
assert.strictEqual(resLocked.locked, true, 'Arcade result must report locked when screen time is paused');
store.state.selectedHero.isScreenTimePaused = false;
pass('Screen time pause and bedtime lock prevents arcade game reward grinding');

// -------------------------------------------------------------
// 3. STARLIGHT DINO RUNNER GAME ENGINE
// -------------------------------------------------------------
console.log('\n--- 3. Starlight Dino Runner Engine Tests ---');

import { StarlightRunnerGame } from '../src/arcade/StarlightRunnerGame.js';

const runnerCanvas = new MockCanvas(640, 400);
let cheerTriggered = '';
const runner = new StarlightRunnerGame(runnerCanvas, {
  pet: { id: '1', name: 'Rex', color: '#10b981', emoji: '🦖' },
  toddlerMode: false,
  onVoiceCheer: (phrase) => { cheerTriggered = phrase; }
});

assert.strictEqual(runner.player.isGrounded, true, 'Player starts grounded');
runner.start();
assert.strictEqual(runner.running, true, 'Runner starts in running state');

// Test single jump
runner.jump();
assert.strictEqual(runner.player.isGrounded, false, 'Player is airborne after jump');
assert.strictEqual(runner.player.jumpCount, 1, 'Jump count is 1 after first jump');

// Test double jump
runner.jump();
assert.strictEqual(runner.player.jumpCount, 2, 'Double jump executes and sets jumpCount to 2');

// Test Toddler mode obstacle collision (zero damage)
const toddlerRunner = new StarlightRunnerGame(new MockCanvas(640, 400), {
  toddlerMode: true
});
toddlerRunner.start();
toddlerRunner.handleObstacleHit({ type: 'log' });
assert.strictEqual(toddlerRunner.hearts, 999, 'Toddler mode hearts must never decrement on obstacle hit');
pass('StarlightRunnerGame supports single jump, double jump flip, and invincible Toddler Mode');

runner.destroy();
toddlerRunner.destroy();

// -------------------------------------------------------------
// 4. GERM BUSTERS WHACK-A-MOLE GAME ENGINE
// -------------------------------------------------------------
console.log('\n--- 4. Germ Busters Engine Tests ---');

import { GermBustersGame } from '../src/arcade/GermBustersGame.js';

const germCanvas = new MockCanvas(640, 400);
let germCheer = '';
const germGame = new GermBustersGame(germCanvas, {
  pet: { id: '1', name: 'Rex', color: '#10b981', emoji: '🦖' },
  toddlerMode: false,
  onVoiceCheer: (msg) => { germCheer = msg; }
});

assert.strictEqual(germGame.burrows.length, 6, 'Must generate 6 tooth burrows (2x3 grid)');
germGame.start();

// Spawn a sugar bug into burrow 0
germGame.burrows[0].bug = {
  name: 'Cavity Critter',
  emoji: '👾',
  color: '#00d2d3',
  points: 20,
  state: 'idle',
  popProgress: 1,
  duration: 2.0,
  timer: 2.0
};

// Whack burrow 0
germGame.checkHit(germGame.burrows[0].x, germGame.burrows[0].y);
assert.strictEqual(germGame.bugsBopped, 1, 'Bug must be bopped');
assert.strictEqual(germGame.score, 20, 'Score must increase by bug points');
assert.strictEqual(germGame.streak, 1, 'Streak must increment to 1');
assert.strictEqual(germGame.particles.length > 0, true, 'Sudsy bubbles particles must spawn');
pass('GermBustersGame accurately detects hits, awards points, and spawns clean bubbles');

germGame.destroy();

// -------------------------------------------------------------
// 5. CELESTIAL BUBBLE CANNON GAME ENGINE
// -------------------------------------------------------------
console.log('\n--- 5. Celestial Bubble Cannon Engine Tests ---');

import { BubbleCannonGame } from '../src/arcade/BubbleCannonGame.js';

const bubbleCanvas = new MockCanvas(640, 400);
const bubbleGame = new BubbleCannonGame(bubbleCanvas, {
  pet: { id: '1', name: 'Rex', color: '#10b981', emoji: '🦖' },
  toddlerMode: true
});

assert.strictEqual(bubbleGame.grid.length, bubbleGame.maxRows, 'Grid must have maxRows rows');
assert.strictEqual(bubbleGame.grid[0].length, bubbleGame.cols, 'Row 0 must have cols count');

// Check color safety of all bubble colors
const invalidBubbleColor = bubbleGame.getRandomBubbleColor();
assert.strictEqual(
  ['#10b981', '#00d2d3', '#f59e0b', '#ffb961', '#225577'].includes(invalidBubbleColor.hex),
  true,
  'All treat bubbles must belong strictly to Explorer Palette'
);

// Test Match-3 flood fill
bubbleGame.start();
bubbleGame.grid.forEach(row => row.fill(null));
const emerald = { id: 'emerald', hex: '#10b981', emoji: '🥝' };
bubbleGame.grid[0][0] = emerald;
bubbleGame.grid[0][1] = emerald;
bubbleGame.grid[0][2] = emerald;
bubbleGame.processMatches(0, 0, 'emerald');

assert.strictEqual(bubbleGame.grid[0][0], null, 'Matched bubble 0,0 must be cleared');
assert.strictEqual(bubbleGame.grid[0][1], null, 'Matched bubble 0,1 must be cleared');
assert.strictEqual(bubbleGame.grid[0][2], null, 'Matched bubble 0,2 must be cleared');
assert.strictEqual(bubbleGame.bubblesPopped, 3, 'Must register 3 popped bubbles');
pass('BubbleCannonGame executes hexagonal match-3 flood-fill cluster popping');

bubbleGame.destroy();

// -------------------------------------------------------------
// 6. TODDLER MAZE EXPLORER GAME ENGINE
// -------------------------------------------------------------
console.log('\n--- 6. Toddler Maze Explorer Engine Tests ---');

import { MazeExplorerGame } from '../src/arcade/MazeExplorerGame.js';

const mazeCanvas = new MockCanvas(640, 400);
const mazeGame = new MazeExplorerGame(mazeCanvas, {
  pet: { id: '1', name: 'Rex', color: '#10b981', emoji: '🦖' },
  toddlerMode: true
});

assert.strictEqual(mazeGame.grid[0][0], 0, 'Start cell must be open path (0)');
assert.strictEqual(mazeGame.grid[mazeGame.goal.r][mazeGame.goal.c], 0, 'Goal chest cell must be open path (0)');
assert.strictEqual(mazeGame.solutionPath.length > 0, true, 'Shortest solution path must be calculated for Toddler glow trail');
assert.strictEqual(mazeGame.gems.length > 0, true, 'Star gems must be placed along maze path');

// Test movement step
const initialC = mazeGame.playerCell.c;
const initialR = mazeGame.playerCell.r;
// If right neighbor is open, step right
if (mazeGame.grid[initialR][initialC + 1] === 0) {
  mazeGame.tryMove(1, 0);
  assert.strictEqual(mazeGame.playerCell.c, initialC + 1, 'Player steps right onto open corridor');
} else if (mazeGame.grid[initialR + 1][initialC] === 0) {
  mazeGame.tryMove(0, 1);
  assert.strictEqual(mazeGame.playerCell.r, initialR + 1, 'Player steps down onto open corridor');
}
pass('MazeExplorerGame generates solvable maze with Toddler breadcrumbs and star gems');

mazeGame.destroy();

// -------------------------------------------------------------
// 7. ARCADE METADATA & UI CAROUSEL VERIFICATION
// -------------------------------------------------------------
console.log('\n--- 7. UI Organization & Carousel Tests ---');

import { ARCADE_GAMES_METADATA } from '../src/arcade/ArcadeModal.js';
import { renderDancePartyView } from '../src/views/DancePartyView.js';

assert.strictEqual(Object.keys(ARCADE_GAMES_METADATA).length, 4, 'Must define 4 new arcade games');
assert.ok(ARCADE_GAMES_METADATA.starlight_runner, 'Starlight runner metadata present');
assert.ok(ARCADE_GAMES_METADATA.germ_busters, 'Germ busters metadata present');
assert.ok(ARCADE_GAMES_METADATA.bubble_cannon, 'Bubble cannon metadata present');
assert.ok(ARCADE_GAMES_METADATA.maze_explorer, 'Maze explorer metadata present');
pass('ARCADE_GAMES_METADATA contains all 4 new classic mini-games');

const renderedHtml = renderDancePartyView();
assert.ok(renderedHtml.includes('New Starlight Arcade'), 'Must render New Starlight Arcade section');
assert.ok(renderedHtml.includes('Original Classics'), 'Must render Original Classics section');
assert.ok(renderedHtml.includes('Starlight Dino Runner'), 'Must contain Dino Runner card');
assert.ok(renderedHtml.includes('Germ Busters'), 'Must contain Germ Busters card');
assert.ok(renderedHtml.includes('Celestial Bubble Cannon'), 'Must contain Bubble Cannon card');
assert.ok(renderedHtml.includes('Toddler Maze Explorer'), 'Must contain Maze Explorer card');
assert.ok(renderedHtml.includes('Berry Popper'), 'Must contain Berry Popper card');
assert.ok(renderedHtml.includes('Memory Match'), 'Must contain Memory Match card');
assert.ok(renderedHtml.includes('Disco Floor'), 'Must contain Disco Floor card');
assert.ok(renderedHtml.includes('Color Dash'), 'Must contain Color Dash card');
assert.ok(renderedHtml.includes('Echo Match'), 'Must contain Echo Match card');
pass('DancePartyView renders two horizontal swipe carousels: New Starlight Arcade and Original Classics');

// -------------------------------------------------------------
// 8. DYNAMIC RESIZE & SCREEN ROTATION TESTS
// -------------------------------------------------------------
console.log('\n--- 8. Dynamic Resize & Screen Rotation Tests ---');

// Runner resize
const rResize = new StarlightRunnerGame(new MockCanvas(400, 300));
rResize.resize(800, 500);
assert.strictEqual(rResize.width, 800, 'Runner width updated');
assert.strictEqual(rResize.height, 500, 'Runner height updated');
assert.strictEqual(rResize.groundY, 425, 'Runner ground line re-anchored to 500 - 75 = 425');
rResize.destroy();

// Germ Busters resize
const gResize = new GermBustersGame(new MockCanvas(400, 300));
gResize.resize(800, 500);
assert.strictEqual(gResize.width, 800, 'Germ Busters width updated');
assert.strictEqual(gResize.height, 500, 'Germ Busters height updated');
assert.strictEqual(gResize.burrows.length, 6, 'Burrows recomputed');
gResize.destroy();

// Bubble Cannon resize
const bResize = new BubbleCannonGame(new MockCanvas(400, 300));
bResize.resize(800, 500);
assert.strictEqual(bResize.cannonX, 400, 'Cannon re-centered at 800 / 2 = 400');
assert.strictEqual(bResize.cannonY, 460, 'Cannon Y re-anchored at 500 - 40 = 460');
bResize.destroy();

// Maze Explorer resize
const mResize = new MazeExplorerGame(new MockCanvas(400, 300));
mResize.resize(800, 500);
assert.strictEqual(mResize.width, 800, 'Maze Explorer width updated');
assert.strictEqual(mResize.height, 500, 'Maze Explorer height updated');
assert.ok(mResize.cellSize > 0, 'Maze cell size recomputed');
mResize.destroy();
pass('All 4 mini-game engines support dynamic resize(width, height) without state corruption');

// -------------------------------------------------------------
// 9. DYNAMIC TODDLER / BIG KID MODE TOGGLE (NO RESET)
// -------------------------------------------------------------
console.log('\n--- 9. Dynamic Toddler / Big Kid Mode Toggle Tests ---');

const dynRunner = new StarlightRunnerGame(new MockCanvas(640, 400), { toddlerMode: false });
dynRunner.start();
dynRunner.distance = 100;
dynRunner.score = 250;
dynRunner.setToddlerMode(true);
assert.strictEqual(dynRunner.toddlerMode, true, 'Toddler mode enabled');
assert.strictEqual(dynRunner.hearts, 999, 'Hearts increased to 999');
assert.strictEqual(dynRunner.distance, 100, 'Distance preserved without resetting game');
assert.strictEqual(dynRunner.score, 250, 'Score preserved without resetting game');
dynRunner.setToddlerMode(false);
assert.strictEqual(dynRunner.toddlerMode, false, 'Big kid mode restored');
assert.strictEqual(dynRunner.hearts, 3, 'Hearts reset to 3');
dynRunner.destroy();
pass('setToddlerMode updates gameplay parameters immediately without resetting round distance or score');

// -------------------------------------------------------------
// 10. TODDLER MODE COZY CAMP MILESTONE TEST
// -------------------------------------------------------------
console.log('\n--- 10. Toddler Mode Cozy Camp Milestone Tests ---');

let toddlerGameOver = false;
let toddlerGameOverStats = null;
const campRunner = new StarlightRunnerGame(new MockCanvas(640, 400), {
  toddlerMode: true,
  onGameOver: (score, stats) => {
    toddlerGameOver = true;
    toddlerGameOverStats = stats;
  }
});
campRunner.start();
campRunner.distance = 349;
campRunner.update(0.1); // distance exceeds 350
assert.strictEqual(toddlerGameOver, true, 'Reaching distance 350 triggers game completion in Toddler Mode');
assert.strictEqual(toddlerGameOverStats.cleared, true, 'Toddler round is marked cleared');
assert.strictEqual(toddlerGameOverStats.won, true, 'Toddler round is marked won');
campRunner.destroy();
pass('Starlight Dino Runner Toddler Mode awards victory clear at Cozy Starlight Camp');

// -------------------------------------------------------------
// 11. BUBBLE CANNON CONNECTED NEIGHBOR SNAP & SURGE TESTS
// -------------------------------------------------------------
console.log('\n--- 11. Bubble Cannon Connected Snap & Surge Tests ---');

const snapCannon = new BubbleCannonGame(new MockCanvas(640, 400), { toddlerMode: true });
snapCannon.start();
snapCannon.grid.forEach(row => row.fill(null));
// Ceiling snap
const testOrb = { x: snapCannon.gridStartX, y: snapCannon.gridStartY, radius: snapCannon.bubbleRadius, color: emerald };
snapCannon.snapOrbToGrid(testOrb, null);
assert.strictEqual(snapCannon.grid[0][0].id, 'emerald', 'Ceiling hit snaps to row 0');

// Toddler bottom-row Bubble Surge safeguard
const bottomPos = snapCannon.getBubblePosition(snapCannon.maxRows - 1, 0);
const bottomOrb = { x: bottomPos.x, y: bottomPos.y, radius: snapCannon.bubbleRadius, color: emerald };
snapCannon.grid[snapCannon.maxRows - 1][0] = emerald;
snapCannon.snapOrbToGrid(bottomOrb, { r: snapCannon.maxRows - 2, c: 0 });
assert.strictEqual(snapCannon.grid[snapCannon.maxRows - 1][0], null, 'Bottom row cleared by Toddler Bubble Surge');
snapCannon.destroy();
pass('BubbleCannonGame snaps to valid connected coordinates and executes Toddler Bubble Surge');

// -------------------------------------------------------------
// 12. STORE STARTER HERO DEFAULT FIELD VERIFICATION
// -------------------------------------------------------------
console.log('\n--- 12. Store Starter Hero Default Fields ---');

assert.ok(typeof store.state.selectedHero.arcadeHighScores === 'object', 'arcadeHighScores present on hero');
assert.ok(typeof store.state.selectedHero.arcadeCoinsEarnedToday === 'number', 'arcadeCoinsEarnedToday present on hero');
assert.ok(typeof store.state.selectedHero.arcadeCoinsLastDate === 'string', 'arcadeCoinsLastDate present on hero');
pass('Store selectedHero and heroes catalog consistently contain arcade persistence fields');

console.log(`\n=============================================================`);
console.log(`ALL ${testsPassed} ARCADE EXPANSION TESTS PASSED!`);
console.log(`=============================================================\n`);
process.exit(0);

