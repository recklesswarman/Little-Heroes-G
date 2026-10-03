import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { renderDinoWorkoutView, attachDinoWorkoutListeners, abandonDinoWorkoutIfRunning } from '../src/views/DinoWorkoutView.js';
import { renderPetSanctuaryView, attachPetSanctuaryListeners, abandonPetSanctuaryExpeditionIfRunning } from '../src/views/PetSanctuaryView.js';
import { renderDancePartyView, attachDancePartyEvents, abandonDancePartyIfRunning } from '../src/views/DancePartyView.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

// Three more views (Dino Workout, Pet Sanctuary's expedition countdown, Dance
// Party's movement-routine/minigame timers) run their own setInterval loops
// in module-level state that isn't tied to the view's DOM, exactly like the
// AR Toothbrush Battle bug verify_battle_stops_on_navigation.js covers. If
// the player navigates away without hitting the view's own Finish/Quit
// button, nothing used to stop them -- they kept ticking (and in Pet
// Sanctuary's case, could even fire a surprise store.notify() full-app
// re-render) behind whatever screen the player is now on.

const activeIntervals = new Set();
const realSetInterval = global.setInterval;
const realClearInterval = global.clearInterval;
global.setInterval = (...args) => {
  const id = realSetInterval(...args);
  activeIntervals.add(id);
  return id;
};
global.clearInterval = (id) => {
  activeIntervals.delete(id);
  return realClearInterval(id);
};

store.state.heroes = [{ id: 'hero_1', name: 'Test Hero', coins: 0, points: 0, xp: 0, level: 1, activePetId: '2', gameDifficulty: 'medium' }];
store.state.selectedHero = store.state.heroes[0];
store.state.pets = [{ id: '2', name: 'Rex', species: 'dino' }];

console.log('\n--- 1. Dino Workout: starting a workout creates a running timerInterval ---');
document.body.innerHTML = renderDinoWorkoutView();
attachDinoWorkoutListeners();
activeIntervals.clear();
const startWorkoutBtn = document.getElementById('btn-start-workout');
assert(!!startWorkoutBtn, 'btn-start-workout exists after rendering the Dino Workout view');
startWorkoutBtn.click();
assert(activeIntervals.size >= 1, `Clicking start created a running countdown interval - got ${activeIntervals.size}`);

console.log('\n--- 2. abandonDinoWorkoutIfRunning() clears it (simulating navigating away without Finish) ---');
abandonDinoWorkoutIfRunning();
assert(activeIntervals.size === 0, `abandonDinoWorkoutIfRunning() cleared every running interval - got ${activeIntervals.size} still active`);

let threwDino = false;
try { abandonDinoWorkoutIfRunning(); } catch (e) { threwDino = true; }
assert(!threwDino, 'abandonDinoWorkoutIfRunning() is idempotent when called again with no workout running');

console.log('\n--- 3. Pet Sanctuary: reopening the expedition drawer on an active expedition starts a countdown interval ---');
store.startPetExpedition('2', 'fern_woods', 15);
store.getPetSanctuaryState().activeDrawer = 'expedition';
document.body.innerHTML = renderPetSanctuaryView();
activeIntervals.clear();
attachPetSanctuaryListeners();
assert(activeIntervals.size >= 1, `Attaching listeners with the expedition drawer open started a countdown interval - got ${activeIntervals.size}`);

console.log('\n--- 4. abandonPetSanctuaryExpeditionIfRunning() clears it (simulating navigating away mid-expedition-view) ---');
abandonPetSanctuaryExpeditionIfRunning();
assert(activeIntervals.size === 0, `abandonPetSanctuaryExpeditionIfRunning() cleared every running interval - got ${activeIntervals.size} still active`);

let threwSanctuary = false;
try { abandonPetSanctuaryExpeditionIfRunning(); } catch (e) { threwSanctuary = true; }
assert(!threwSanctuary, 'abandonPetSanctuaryExpeditionIfRunning() is idempotent when called again with no expedition drawer open');

console.log('\n--- 5. Dance Party: launching a movement routine creates a running routineTimer ---');
document.body.innerHTML = renderDancePartyView();
activeIntervals.clear();
attachDancePartyEvents();
const launchRoutineBtn = document.querySelector('.launch-routine-btn');
assert(!!launchRoutineBtn, 'A .launch-routine-btn exists after rendering the Dance Party hub');
launchRoutineBtn.click();
assert(activeIntervals.size >= 1, `Launching a routine created a running routineTimer - got ${activeIntervals.size}`);

console.log('\n--- 6. abandonDancePartyIfRunning() clears it and stops the music (simulating navigating away mid-routine) ---');
abandonDancePartyIfRunning();
assert(activeIntervals.size === 0, `abandonDancePartyIfRunning() cleared every running interval - got ${activeIntervals.size} still active`);

let threwDance = false;
try { abandonDancePartyIfRunning(); } catch (e) { threwDance = true; }
assert(!threwDance, 'abandonDancePartyIfRunning() is idempotent when called again with nothing running');

global.setInterval = realSetInterval;
global.clearInterval = realClearInterval;

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
