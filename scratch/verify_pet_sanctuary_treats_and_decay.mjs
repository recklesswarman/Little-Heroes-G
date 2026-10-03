import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { SANCTUARY_TREATS } from '../src/data/petsData.js';
import { renderDashboardView, attachDashboardListeners } from '../src/views/DashboardView.js';
import { renderPetSanctuaryView } from '../src/views/PetSanctuaryView.js';

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

const REQUIRED_FIELDS = ['name', 'emoji', 'color', 'hungerFill', 'energyFill', 'joyBoost', 'xpBoost', 'costCoins'];
const NEW_TREAT_IDS = ['glacier_mint_pop', 'thunder_kiwi', 'forge_pretzel', 'dune_date_cluster', 'moonlit_pear'];

console.log('\n--- 1. Treat catalog expanded with full data shape ---');
assert(SANCTUARY_TREATS.length >= 9, `SANCTUARY_TREATS expanded to at least 9 (has ${SANCTUARY_TREATS.length})`);
for (const id of NEW_TREAT_IDS) {
  const treat = SANCTUARY_TREATS.find(t => t.id === id);
  assert(Boolean(treat), `New treat "${id}" exists`);
  if (treat) {
    for (const field of REQUIRED_FIELDS) {
      assert(treat[field] !== undefined && treat[field] !== null, `Treat "${id}" has a "${field}" field`);
    }
  }
}
const treatIds = SANCTUARY_TREATS.map(t => t.id);
assert(new Set(treatIds).size === treatIds.length, 'No duplicate treat ids');

console.log('\n--- 2. getPetNeedsWithDecay() is a no-op on first read ---');
const petId = store.state.selectedHero.activePetId;
const sanct = store.getPetSanctuaryState();
delete sanct.needsLastTendedAt;
sanct.petNeedsMap[petId] = { hunger: 90, hygiene: 85, joy: 95, energy: 90 };
const firstRead = store.getPetNeedsWithDecay(petId);
assert(firstRead.hunger === 90 && firstRead.joy === 95, 'First-ever read returns the raw stored needs unchanged');
assert(Boolean(sanct.needsLastTendedAt?.[String(petId)]), 'First read seeds the decay clock');

console.log('\n--- 3. Needs decay gently over real elapsed time ---');
sanct.needsLastTendedAt[String(petId)] = Date.now() - (4 * 60 * 60 * 1000); // 4 hours ago
const decayed = store.getPetNeedsWithDecay(petId);
assert(decayed.hunger < 90 && decayed.hunger > 80, `Hunger decays gently after 4 hours (was 90, now ${decayed.hunger})`);
assert(decayed.hygiene < 85 && decayed.hygiene >= 80, `Hygiene decays more slowly than hunger (now ${decayed.hygiene})`);

console.log('\n--- 4. Decay never drops below a comfortable floor ---');
sanct.needsLastTendedAt[String(petId)] = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago
const longNeglected = store.getPetNeedsWithDecay(petId);
for (const stat of ['hunger', 'hygiene', 'joy', 'energy']) {
  assert(longNeglected[stat] >= 35, `${stat} never drops below the gentle floor of 35 (is ${longNeglected[stat]})`);
}
assert(sanct.petNeedsMap[petId].hunger === 90, 'Stored raw needs are never mutated by reading the decayed view');

console.log('\n--- 5. Feeding/bathing/playing resets the decay clock ---');
sanct.needsLastTendedAt[String(petId)] = Date.now() - (10 * 60 * 60 * 1000);
if (!store.state.selectedHero.consumables) store.state.selectedHero.consumables = {};
store.state.selectedHero.consumables.moonlit_pear = 2;
const feedResult = store.feedPetTreat(petId, 'moonlit_pear');
assert(feedResult.success, 'feedPetTreat() succeeds with a new treat once its consumable stock is purchased');
const sinceTouch = Date.now() - sanct.needsLastTendedAt[String(petId)];
assert(sinceTouch < 1000, 'feedPetTreat() resets the decay clock to now');
const rightAfterFeed = store.getPetNeedsWithDecay(petId);
assert(rightAfterFeed.joy === sanct.petNeedsMap[petId].joy, 'Immediately after tending, the decayed view matches the freshly-updated raw needs');

console.log('\n--- 6. Real Dashboard render shows the gentle Sanctuary nudge when a need is low ---');
sanct.petNeedsMap[petId] = { hunger: 50, hygiene: 95, joy: 95, energy: 95 };
store.touchPetNeeds(sanct, petId);
document.body.innerHTML = renderDashboardView();
attachDashboardListeners();
assert(document.body.innerHTML.includes('Sanctuary Check-In'), 'Dashboard shows the gentle pet needs nudge banner when a need has decayed');
assert(Boolean(document.getElementById('dash-pet-needs-nudge-btn')), 'Nudge banner renders a "Visit Sanctuary" button');

console.log('\n--- 7. Real Dashboard render hides the nudge once the pet is freshly tended ---');
store.touchPetNeeds(sanct, petId);
sanct.petNeedsMap[petId] = { hunger: 95, hygiene: 95, joy: 95, energy: 95 };
document.body.innerHTML = renderDashboardView();
assert(!document.body.innerHTML.includes('Sanctuary Check-In'), 'Dashboard hides the nudge once all needs are freshly topped up');

console.log('\n--- 8. Real Pet Sanctuary Hub render reflects the decayed needs bars ---');
sanct.needsLastTendedAt[String(petId)] = Date.now() - (5 * 60 * 60 * 1000);
sanct.petNeedsMap[petId] = { hunger: 90, hygiene: 85, joy: 95, energy: 90 };
const sanctuaryHtml = renderPetSanctuaryView();
assert(typeof sanctuaryHtml === 'string' && sanctuaryHtml.length > 100, 'Pet Sanctuary Hub renders successfully using the decayed needs view');

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);

process.exit(failed > 0 ? 1 : 0);
