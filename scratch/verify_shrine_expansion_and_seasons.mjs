import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { SECRET_SHRINES, WORLD_BIOMES } from '../src/data/worldMapData.js';
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

const REQUIRED_SHRINE_FIELDS = ['name', 'biomeId', 'hint', 'icon', 'color', 'coordinates', 'rewardCoins', 'rewardSparks', 'itemGranted', 'speechDiscovery'];

console.log('\n--- 1. Shrine catalog expanded with full data shape ---');
assert(SECRET_SHRINES.length >= 16, `SECRET_SHRINES expanded to at least 16 (has ${SECRET_SHRINES.length})`);
const biomeIds = WORLD_BIOMES.map(b => b.id);
for (const shrine of SECRET_SHRINES) {
  for (const field of REQUIRED_SHRINE_FIELDS) {
    assert(shrine[field] !== undefined && shrine[field] !== null, `Shrine "${shrine.id}" has a "${field}" field`);
  }
  assert(biomeIds.includes(shrine.biomeId), `Shrine "${shrine.id}" references a real biome ("${shrine.biomeId}")`);
}
const shrineIds = SECRET_SHRINES.map(s => s.id);
assert(new Set(shrineIds).size === shrineIds.length, 'No duplicate shrine ids');

for (const biomeId of biomeIds) {
  const count = SECRET_SHRINES.filter(s => s.biomeId === biomeId).length;
  assert(count >= 3, `Biome "${biomeId}" has at least 3 shrines (has ${count})`);
}

console.log('\n--- 2. Season-exclusive shrines exist, one per season ---');
const seasonalShrines = SECRET_SHRINES.filter(s => s.seasonId);
assert(seasonalShrines.length >= 4, `At least 4 season-exclusive shrines exist (has ${seasonalShrines.length})`);
for (const season of ['spring', 'summer', 'autumn', 'winter']) {
  assert(seasonalShrines.some(s => s.seasonId === season), `A season-exclusive shrine exists for "${season}"`);
}

console.log('\n--- 3. discoverWorldSecret() rejects a season-exclusive shrine when out of season ---');
store.state.heroes = [{ id: 'hero_1', name: 'Test', activePetId: '1', coins: 0, points: 0, stars: 0 }];
store.state.selectedHero = store.state.heroes[0];
store.setIslandSeason('summer');
store.getWorldAdventureMapState().discoveredSecrets = [];

const winterShrine = SECRET_SHRINES.find(s => s.seasonId === 'winter');
const outOfSeasonResult = store.discoverWorldSecret(winterShrine.id);
assert(outOfSeasonResult.success === false && outOfSeasonResult.outOfSeason === true, 'Discovering a winter shrine while the season is summer is rejected, not rewarded');
assert(store.state.selectedHero.coins === 0, 'No coins granted for an out-of-season discovery attempt');
assert(!store.getWorldAdventureMapState().discoveredSecrets.includes(winterShrine.id), 'Out-of-season shrine is not marked discovered');

console.log('\n--- 4. discoverWorldSecret() grants the reward once the season matches ---');
store.setIslandSeason('winter');
const inSeasonResult = store.discoverWorldSecret(winterShrine.id);
assert(inSeasonResult.success === true, 'Discovering the winter shrine while the season is winter succeeds');
assert(store.state.selectedHero.coins === winterShrine.rewardCoins, 'Coins granted match the shrine\'s rewardCoins exactly once');

console.log('\n--- 5. An ordinary (non-seasonal) shrine is unaffected by season ---');
store.setIslandSeason('spring');
const ordinaryShrine = SECRET_SHRINES.find(s => !s.seasonId && s.id !== 'shrine_orchard');
const ordinaryResult = store.discoverWorldSecret(ordinaryShrine.id);
assert(ordinaryResult.success === true, 'An ordinary shrine with no seasonId is discoverable regardless of season');

console.log('\n--- 6. Island Sandbox tab (real render) reflects the expanded catalog ---');
store.state.activeView = 'quest_map';
store.setWorldMapTab('island');
const islandHtml = renderWorldAdventureMapView();
assert(islandHtml.includes('world-adventure-canvas'), 'Island tab still renders its canvas container after the shrine expansion');

console.log('\n--- 7. Shrines list button shows only currently-visible shrines ---');
store.setIslandSeason('autumn');
document.body.innerHTML = renderWorldAdventureMapView();
attachWorldAdventureMapListeners();
const secretsBtn = document.getElementById('island-inspect-secrets-btn');
let shownTitle = null;
const originalShowReward = store.showReward.bind(store);
store.showReward = (title) => { shownTitle = title; };
if (secretsBtn) secretsBtn.click();
store.showReward = originalShowReward;
const expectedVisibleCount = SECRET_SHRINES.filter(s => !s.seasonId || s.seasonId === 'autumn').length;
assert(shownTitle === `${expectedVisibleCount} Secret Island Shrines`, `Shrine list title reflects the real in-season count (${expectedVisibleCount}), not a stale hardcoded number`);

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);

process.exit(failed > 0 ? 1 : 0);
