import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { SECRET_SHRINES } from '../src/data/worldMapData.js';
import { getTrophiesForDisplay } from '../src/data/heroHQData.js';
import { renderHeroHQView, attachHeroHQListeners } from '../src/views/HeroHQView.js';

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

console.log('\n--- 1. World Map biome-exploration trophy requires every shrine in a biome ---');
const noneDiscovered = getTrophiesForDisplay({ worldAdventureMap: { discoveredSecrets: [] } });
assert(
  !noneDiscovered.some(t => t.id === 'trophy_biome_cartographer'),
  'Trophy is NOT awarded with zero shrines discovered'
);

const biomeIds = [...new Set(SECRET_SHRINES.filter(s => !s.seasonId).map(s => s.biomeId))];
assert(biomeIds.length > 0, 'At least one biome has ordinary (non-seasonal) shrines to test against');
const firstBiome = biomeIds[0];
const allInFirstBiome = SECRET_SHRINES.filter(s => !s.seasonId && s.biomeId === firstBiome).map(s => s.id);
const allButOne = allInFirstBiome.slice(0, -1);

const partialDiscovered = getTrophiesForDisplay({ worldAdventureMap: { discoveredSecrets: allButOne } });
assert(
  !partialDiscovered.some(t => t.id === 'trophy_biome_cartographer'),
  'Trophy is NOT awarded when one shrine in the biome is still missing'
);

const fullDiscovered = getTrophiesForDisplay({ worldAdventureMap: { discoveredSecrets: allInFirstBiome } });
assert(
  fullDiscovered.some(t => t.id === 'trophy_biome_cartographer'),
  'Trophy IS awarded once every ordinary shrine in a biome is discovered'
);

console.log('\n--- 2. Seasonal shrines are never required for the biome-exploration trophy ---');
const seasonalShrineIds = SECRET_SHRINES.filter(s => s.seasonId).map(s => s.id);
assert(seasonalShrineIds.length > 0, 'At least one season-exclusive shrine exists to test against');
const fullDiscoveredNoSeasonal = getTrophiesForDisplay({
  worldAdventureMap: { discoveredSecrets: allInFirstBiome.filter(id => !seasonalShrineIds.includes(id)) }
});
assert(
  fullDiscoveredNoSeasonal.some(t => t.id === 'trophy_biome_cartographer'),
  'Trophy still awards without any season-exclusive shrines discovered'
);

console.log('\n--- 3. Learning Realm hard-tier mastery trophy requires BOTH hard difficulty AND a 3-star realm ---');
const noMastery = getTrophiesForDisplay({
  selectedHero: { gameDifficulty: 'hard' },
  gameMasteryMap: { phonics_forest: { stars: 2 } }
});
assert(
  !noMastery.some(t => t.id === 'trophy_realm_mastermind'),
  'Trophy is NOT awarded with hard difficulty but only 2-star mastery'
);

const masteryWrongDifficulty = getTrophiesForDisplay({
  selectedHero: { gameDifficulty: 'medium' },
  gameMasteryMap: { phonics_forest: { stars: 3 } }
});
assert(
  !masteryWrongDifficulty.some(t => t.id === 'trophy_realm_mastermind'),
  'Trophy is NOT awarded with 3-star mastery but difficulty set below hard'
);

const fullMastery = getTrophiesForDisplay({
  selectedHero: { gameDifficulty: 'hard' },
  gameMasteryMap: { phonics_forest: { stars: 3 } }
});
assert(
  fullMastery.some(t => t.id === 'trophy_realm_mastermind'),
  'Trophy IS awarded with hard difficulty and a 3-star realm mastery'
);

console.log('\n--- 4. New trophies have the full data shape every trophy needs for rendering ---');
const REQUIRED_TROPHY_FIELDS = ['id', 'title', 'category', 'emoji', 'iconColor', 'dateEarned', 'lore', 'rexPraise'];
for (const trophy of [
  fullDiscovered.find(t => t.id === 'trophy_biome_cartographer'),
  fullMastery.find(t => t.id === 'trophy_realm_mastermind')
]) {
  for (const field of REQUIRED_TROPHY_FIELDS) {
    assert(trophy[field] !== undefined && trophy[field] !== null, `Trophy "${trophy.id}" has a "${field}" field`);
  }
}

console.log('\n--- 5. Real Hero HQ render shows the new trophy once earned ---');
store.state.heroes = [{ id: 'hero_1', name: 'Test', gameDifficulty: 'hard', coins: 0, pets: [] }];
store.state.selectedHero = store.state.heroes[0];
store.state.gameMasteryMap = { phonics_forest: { stars: 3 } };
store.state.worldAdventureMap = { discoveredSecrets: allInFirstBiome, activeTab: 'path', season: 'auto' };
store.state.activeView = 'hero_hq';
document.body.innerHTML = renderHeroHQView();
attachHeroHQListeners();
const viewAllBtn = document.getElementById('hq-view-all-trophies-btn');
viewAllBtn.click();
document.body.innerHTML = renderHeroHQView();
const html = document.body.innerHTML;
assert(html.includes('Island Cartographer Starlight Map'), 'Hero HQ "all trophies" gallery includes the new World Map trophy title');
assert(html.includes('Realm Mastermind Diamond Brain'), 'Hero HQ "all trophies" gallery includes the new Learning Realm trophy title');

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);

process.exit(failed > 0 ? 1 : 0);
