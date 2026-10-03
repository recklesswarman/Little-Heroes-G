import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { BEDTIME_MORALS } from '../src/data/bedtimeStoryData.js';
import { renderBedtimeStoryView, setupBedtimeStoryListeners } from '../src/views/BedtimeStoryView.js';

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

const REQUIRED_FIELDS = ['name', 'icon', 'emoji', 'tagline', 'moralGuidance', 'petAction', 'slumberResolution'];
const NEW_EVERGREEN_IDS = ['gratitude_heart', 'letting_go', 'teamwork_together', 'self_belief'];
const SEASONAL_MORAL_BY_SEASON = {
  spring: 'spring_new_beginnings',
  summer: 'summer_stargazing',
  autumn: 'autumn_gratitude_harvest',
  winter: 'winter_cozy_together'
};

console.log('\n--- 1. Moral catalog expanded with full data shape ---');
assert(BEDTIME_MORALS.length >= 18, `BEDTIME_MORALS expanded to at least 18 (has ${BEDTIME_MORALS.length})`);
for (const id of NEW_EVERGREEN_IDS) {
  const moral = BEDTIME_MORALS.find(m => m.id === id);
  assert(Boolean(moral), `New evergreen moral "${id}" exists`);
  if (moral) {
    for (const field of REQUIRED_FIELDS) {
      assert(moral[field] !== undefined && moral[field] !== null, `Moral "${id}" has a "${field}" field`);
    }
  }
}
const moralIds = BEDTIME_MORALS.map(m => m.id);
assert(new Set(moralIds).size === moralIds.length, 'No duplicate moral ids');

console.log('\n--- 2. Season-exclusive morals exist, one per season ---');
for (const [season, id] of Object.entries(SEASONAL_MORAL_BY_SEASON)) {
  const moral = BEDTIME_MORALS.find(m => m.id === id);
  assert(Boolean(moral) && moral.seasonId === season, `Season-exclusive moral "${id}" exists and is tagged seasonId="${season}"`);
}

console.log('\n--- 3. getAvailableBedtimeMorals() excludes out-of-season morals ---');
store.state.heroes = [{ id: 'hero_1', name: 'Test', bedtimeHistory: [] }];
store.state.selectedHero = store.state.heroes[0];

store.setIslandSeason('summer');
const summerAvailable = store.getAvailableBedtimeMorals('hero_1').map(m => m.id);
assert(summerAvailable.includes('summer_stargazing'), 'Summer-exclusive moral is available when the season is summer');
assert(!summerAvailable.includes('winter_cozy_together'), 'Winter-exclusive moral is NOT available when the season is summer');
assert(!summerAvailable.includes('spring_new_beginnings'), 'Spring-exclusive moral is NOT available when the season is summer');
assert(!summerAvailable.includes('autumn_gratitude_harvest'), 'Autumn-exclusive moral is NOT available when the season is summer');
assert(summerAvailable.includes('brave_dark'), 'Ordinary evergreen morals remain available regardless of season');

store.setIslandSeason('winter');
const winterAvailable = store.getAvailableBedtimeMorals('hero_1').map(m => m.id);
assert(winterAvailable.includes('winter_cozy_together'), 'Winter-exclusive moral becomes available once the season is winter');
assert(!winterAvailable.includes('summer_stargazing'), 'Summer-exclusive moral is excluded once the season flips to winter');

console.log('\n--- 4. Season gating composes correctly with the existing 30-day anti-repeat filter ---');
store.setIslandSeason('spring');
store.state.selectedHero.bedtimeHistory = [{ moralId: 'spring_new_beginnings', timestamp: Date.now() - (2 * 24 * 60 * 60 * 1000) }];
const afterRecentUse = store.getAvailableBedtimeMorals('hero_1').map(m => m.id);
assert(!afterRecentUse.includes('spring_new_beginnings'), 'A recently-used season-exclusive moral is still excluded by the 30-day filter even while in season');
assert(!afterRecentUse.includes('summer_stargazing'), 'An out-of-season moral stays excluded regardless of the 30-day filter');

console.log('\n--- 5. Real Bedtime Sanctuary Hub render reflects season-filtered morals ---');
store.state.selectedHero.bedtimeHistory = [];
store.state.activeView = 'bedtime_story';
store.setIslandSeason('autumn');
document.body.innerHTML = renderBedtimeStoryView();
setupBedtimeStoryListeners();
const htmlHasAutumnMoral = document.body.innerHTML.includes('Autumn Gratitude Harvest');
const htmlHasWinterMoral = document.body.innerHTML.includes('Winter Cozy Togetherness');
assert(htmlHasAutumnMoral, 'Sanctuary Hub shows the in-season (autumn) exclusive moral card');
assert(!htmlHasWinterMoral, 'Sanctuary Hub does NOT show the out-of-season (winter) exclusive moral card');

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);

process.exit(failed > 0 ? 1 : 0);
