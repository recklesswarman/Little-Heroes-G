import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { DIGITAL_REWARDS_CATALOG } from '../src/data/digitalRewardsCatalog.js';
import { PROFILE_THEMES } from '../src/data/profileThemesData.js';
import { renderShopView } from '../src/views/ShopView.js';

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

const NEW_DIGITAL_IDS = [
  'comet_tail_whip', 'storm_trident_lance', 'ember_ridge_helm', 'phoenix_ember_wings',
  'emerald_streak_medal', 'cosmic_explorer_badge', 'glowing_moon_melon', 'thunderclap_tonic'
];
const SEASONAL_THEME_BY_SEASON = {
  spring: 'theme_spring_sprout_ranger',
  summer: 'theme_solstice_surf_hero',
  autumn: 'theme_harvest_ember_warden',
  winter: 'theme_frostpeak_guardian'
};

console.log('\n--- 1. Digital rewards catalog expanded with full data shape ---');
assert(DIGITAL_REWARDS_CATALOG.length >= 26, `Catalog expanded to at least 26 items (has ${DIGITAL_REWARDS_CATALOG.length})`);
const REQUIRED_DIGITAL_FIELDS = ['name', 'desc', 'category', 'costCoins', 'statBonusType', 'statBonusLabel', 'image'];
for (const id of NEW_DIGITAL_IDS) {
  const item = DIGITAL_REWARDS_CATALOG.find(i => i.id === id);
  assert(Boolean(item), `New catalog item "${id}" exists`);
  if (item) {
    for (const field of REQUIRED_DIGITAL_FIELDS) {
      assert(item[field] !== undefined && item[field] !== null, `Item "${id}" has a "${field}" field`);
    }
  }
}
const digitalIds = DIGITAL_REWARDS_CATALOG.map(i => i.id);
assert(new Set(digitalIds).size === digitalIds.length, 'No duplicate catalog item ids');

console.log('\n--- 2. Profile themes expanded with 4 season-exclusive themes ---');
assert(PROFILE_THEMES.length >= 10, `PROFILE_THEMES expanded to at least 10 (has ${PROFILE_THEMES.length})`);
for (const [season, id] of Object.entries(SEASONAL_THEME_BY_SEASON)) {
  const theme = PROFILE_THEMES.find(t => t.id === id);
  assert(Boolean(theme) && theme.seasonId === season, `Season-exclusive theme "${id}" exists and is tagged seasonId="${season}"`);
}
const themeIds = PROFILE_THEMES.map(t => t.id);
assert(new Set(themeIds).size === themeIds.length, 'No duplicate theme ids');

console.log('\n--- 3. Shop view filters profile themes by the current season ---');
store.state.heroes = [{ id: 'hero_1', name: 'Test', coins: 0, unlockedThemes: [], equippedProfileTheme: 'theme_dragon_emerald' }];
store.state.selectedHero = store.state.heroes[0];
store.state.activeView = 'shop';

store.setIslandSeason('summer');
document.body.innerHTML = renderShopView();
let html = document.body.innerHTML;
assert(html.includes('Solstice Surf Hero'), 'Shop shows the in-season (summer) exclusive theme card');
assert(!html.includes('Frostpeak Guardian'), 'Shop does NOT show the out-of-season (winter) exclusive theme card');
assert(html.includes('Emerald Dragon Guardian'), 'Ordinary evergreen themes remain visible regardless of season');

store.setIslandSeason('winter');
document.body.innerHTML = renderShopView();
html = document.body.innerHTML;
assert(html.includes('Frostpeak Guardian'), 'Shop shows the winter-exclusive theme once the season flips to winter');
assert(!html.includes('Solstice Surf Hero'), 'Shop hides the summer-exclusive theme once the season flips to winter');

console.log('\n--- 4. buyProfileTheme() rejects an out-of-season purchase (defense in depth) ---');
store.setIslandSeason('winter');
store.state.selectedHero.coins = 1000;
store.buyProfileTheme('theme_solstice_surf_hero');
assert(
  !(store.state.selectedHero.unlockedThemes || []).includes('theme_solstice_surf_hero'),
  'A season-exclusive theme cannot be purchased while its season is not active, even with enough coins'
);
store.buyProfileTheme('theme_frostpeak_guardian');
assert(
  (store.state.selectedHero.unlockedThemes || []).includes('theme_frostpeak_guardian'),
  'The same theme purchases successfully once its season is active'
);

console.log('\n--- 5. Real Shop render shows the new digital reward items ---');
document.body.innerHTML = renderShopView();
html = document.body.innerHTML;
assert(html.includes('Comet Tail Whip'), 'Shop shows the new weapon item');
assert(html.includes('Emerald Streak Medal'), 'Shop shows the new badge item');
assert(html.includes('Glowing Moon Melon'), 'Shop shows the new snack item');

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);

process.exit(failed > 0 ? 1 : 0);
