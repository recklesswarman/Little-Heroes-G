import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { getDailyRotatingPetCoach, PETS_DATABASE } from '../src/data/petsData.js';

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

function freshHero() {
  return {
    id: 'hero_1',
    name: 'Test Hero',
    coins: 0,
    points: 0,
    xp: 0,
    activePetId: '1',
    bedtimeHistory: [],
    unlockedThemes: ['theme_dragon_emerald']
  };
}

store.state.heroes = [freshHero()];
store.state.selectedHero = store.state.heroes[0];

// --- 1. renderWorkoutDrawer's "Daily Featured Coach" card no longer renders
// literal "undefined" for the coach's signature move / workout description.
// (dailyCoach is a raw PETS_DATABASE entry, which has workoutName /
// workoutInstructions -- NOT the signatureMove / workoutDesc fields this
// card used to read, so every rotation silently printed "undefined".)
console.log('\n--- 1. Workout drawer "Daily Featured Coach" card shows real content, not "undefined" ---');
const mod = await import('../src/views/PetSanctuaryView.js');
store.getPetSanctuaryState().activeDrawer = 'workout';
const htmlWithDrawer = mod.renderPetSanctuaryView();
assert(!htmlWithDrawer.includes('undefined'), 'Workout drawer output contains no literal "undefined"');

const dailyCoach = getDailyRotatingPetCoach();
assert(htmlWithDrawer.includes(dailyCoach.workoutName), `Shows the real signature move text ("${dailyCoach.workoutName}")`);
assert(htmlWithDrawer.includes(dailyCoach.workoutInstructions), 'Shows the real workout instructions text');

// --- 2. The 24-pet roster drawer card shows each pet's own real signature
// move instead of the same generic "Hero Stomp" fallback for every pet.
console.log('\n--- 2. Pet roster cards show each pet\'s own real signature move ---');
store.getPetSanctuaryState().activeDrawer = 'roster';
const rosterHtml = mod.renderPetSanctuaryView();
for (const pet of PETS_DATABASE.slice(0, 3)) {
  assert(rosterHtml.includes(pet.workoutName), `Roster shows ${pet.name}'s real move ("${pet.workoutName}"), not a generic fallback`);
}

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);
process.exit(failed > 0 ? 1 : 0);
