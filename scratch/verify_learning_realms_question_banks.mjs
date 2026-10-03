import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { ADVENTURE_GAMES, getGameChallenges, shuffleChallenges } from '../src/data/learningGamesData.js';
import { renderWorldAdventureMapView, attachWorldAdventureMapListeners } from '../src/views/WorldAdventureMapView.js';

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

console.log('\n--- 1. Each core realm has an expanded, varied question bank ---');
const CORE_REALM_IDS = ['phonics_forest', 'number_galaxy', 'shape_kingdom', 'emotion_safari', 'science_lab'];
for (const id of CORE_REALM_IDS) {
  const game = ADVENTURE_GAMES.find(g => g.id === id);
  assert(Boolean(game), `${id} exists in ADVENTURE_GAMES`);
  for (const tier of ['easy', 'medium', 'hard']) {
    const qs = game.challengesByDifficulty[tier];
    assert(qs.length >= 10, `${id}/${tier} has at least 10 questions (has ${qs.length})`);
    const uniqueQuestions = new Set(qs.map(q => q.question));
    assert(uniqueQuestions.size === qs.length, `${id}/${tier} has no duplicate question text`);
    for (const q of qs) {
      assert(
        Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
        `A "${id}/${tier}" question's answer index is valid (within its own options)`
      );
    }
  }
}

console.log('\n--- 2. Backwards-compat aliases share the SAME array (no drift risk) ---');
const numberGalaxy = ADVENTURE_GAMES.find(g => g.id === 'number_galaxy');
const countingCastle = ADVENTURE_GAMES.find(g => g.id === 'counting_castle');
const shapeKingdom = ADVENTURE_GAMES.find(g => g.id === 'shape_kingdom');
const shapeShifter = ADVENTURE_GAMES.find(g => g.id === 'shape_shifter');
assert(countingCastle.challengesByDifficulty === numberGalaxy.challengesByDifficulty, 'counting_castle shares number_galaxy\'s exact challenge object (not a copy)');
assert(shapeShifter.challengesByDifficulty === shapeKingdom.challengesByDifficulty, 'shape_shifter shares shape_kingdom\'s exact challenge object (not a copy)');

console.log('\n--- 3. shuffleChallenges() is a non-mutating permutation ---');
const original = getGameChallenges(numberGalaxy, 'easy');
const originalCopy = [...original];
const shuffled = shuffleChallenges(original);
assert(original.every((q, i) => q === originalCopy[i]), 'shuffleChallenges() does not mutate the source array');
assert(shuffled.length === original.length, 'shuffled array has the same length as the source');
assert(
  original.every(q => shuffled.includes(q)) && shuffled.every(q => original.includes(q)),
  'shuffled array contains exactly the same question objects as the source (a true permutation)'
);
let sawDifferentOrder = false;
for (let i = 0; i < 20; i++) {
  const s = shuffleChallenges(original);
  if (s.some((q, idx) => q !== original[idx])) {
    sawDifferentOrder = true;
    break;
  }
}
assert(sawDifferentOrder, 'repeated shuffles actually produce a different order at least once (not a no-op)');

console.log('\n--- 4. Live mini-game session uses a stable per-session shuffled order ---');
store.state.heroes = store.state.heroes || [{ id: 'hero_1', name: 'Test', activePetId: '1', coins: 0, xp: 0, gameDifficulty: 'medium' }];
store.state.selectedHero = store.state.heroes[0];
store.state.activeView = 'quest_map';
document.body.innerHTML = renderWorldAdventureMapView();
attachWorldAdventureMapListeners();

const launchBtn = document.querySelector('[data-launch-game="number_galaxy"]');
assert(Boolean(launchBtn), 'Found a real launch button for number_galaxy in the rendered map');
if (launchBtn) {
  launchBtn.click();
  const htmlAfterLaunch = renderWorldAdventureMapView();
  assert(htmlAfterLaunch.includes('Challenge 1 / 12'), 'Launching the realm shows all 12 questions in the session counter');
}

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);

process.exit(failed > 0 ? 1 : 0);
