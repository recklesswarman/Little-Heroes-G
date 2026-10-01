/**
 * Test Suite: 3D World Adventure Map & Waypoint Quests
 * Validates biomes, waypoints, shrines, toy-box physics state,
 * parent streak stashes, and dual-tab view rendering.
 */

// Node 24 mock safety
if (!global.performance) {
  global.performance = { now: () => Date.now() };
} else if (!global.performance.now) {
  global.performance.now = () => Date.now();
}

// Mock DOM
global.window = {
  devicePixelRatio: 1,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {}
};
global.document = {
  body: {},
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {}
};

async function runTests() {
  console.log('🧪 Starting 3D World Adventure Map Test Suite...\n');

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

  try {
    const {
      WORLD_BIOMES,
      PATH_OF_VALOR_WAYPOINTS,
      SECRET_SHRINES,
      TOY_BOX_ENTITIES,
      LANDMARK_ARCHETYPES,
      BIOME_PLACEMENT_PRESETS,
      SEASONS_DATA
    } = await import('../src/data/worldMapData.js');

    const { store } = await import('../src/state/store.js');
    const { renderWorldAdventureMapView } = await import('../src/views/WorldAdventureMapView.js');

    // 1. Data Integrity Tests
    console.log('--- 1. Biomes & Waypoints Catalog ---');
    assert(WORLD_BIOMES.length === 4, 'Should define exactly 4 distinct biomes');
    const biomeIds = WORLD_BIOMES.map(b => b.id);
    assert(biomeIds.includes('whispering_meadows'), 'Includes Whispering Meadows');
    assert(biomeIds.includes('sunken_lagoon'), 'Includes Sunken Lagoon');
    assert(biomeIds.includes('molten_volcano'), 'Includes Molten Volcano');
    assert(biomeIds.includes('crystal_summit'), 'Includes Crystal Summit');

    // Explorer Color Palette verification (Strictly zero pink or purple)
    const hasForbiddenColors = WORLD_BIOMES.some(b => 
      b.color.toLowerCase().includes('pink') || 
      b.color.toLowerCase().includes('purple') ||
      b.color.toLowerCase() === '#ec4899' ||
      b.color.toLowerCase() === '#a855f7'
    );
    assert(!hasForbiddenColors, 'Strictly zero pink or purple colors in biomes');

    assert(PATH_OF_VALOR_WAYPOINTS.length === 8, 'Should define 8 sequential Path of Valor waypoints');
    assert(PATH_OF_VALOR_WAYPOINTS[0].stepNumber === 1, 'First waypoint is step 1');
    assert(PATH_OF_VALOR_WAYPOINTS[7].stepNumber === 8, 'Last waypoint is step 8');

    // 2. Secret Shrines & Toy-Box Entities
    console.log('\n--- 2. Shrines & Toy-Box Physics ---');
    assert(SECRET_SHRINES.length === 4, 'Should define 4 secret discovery shrines');
    assert(TOY_BOX_ENTITIES.length >= 4, 'Should define at least 4 toy-box interactive entities');
    assert(TOY_BOX_ENTITIES.some(e => e.type === 'fruit_tree'), 'Includes fruit trees for shaking');
    assert(TOY_BOX_ENTITIES.some(e => e.type === 'waterfall'), 'Includes waterfall for splashing');
    assert(TOY_BOX_ENTITIES.some(e => e.type === 'rune_monolith'), 'Includes rune monoliths for chimes');

    // 3. Store State & Tab Switching
    console.log('\n--- 3. Store State & Tabs ---');
    const initialMapState = store.getWorldAdventureMapState();
    assert(initialMapState !== null, 'World Adventure Map state slice initialized');
    assert(initialMapState.activeTab === 'path', 'Default tab is "path"');

    store.setWorldMapTab('island');
    assert(store.getWorldAdventureMapState().activeTab === 'island', 'Successfully switches tab to "island"');

    store.setWorldMapTab('path');
    assert(store.getWorldAdventureMapState().activeTab === 'path', 'Successfully switches back to "path"');

    // 4. Toy-Box Interactions Tracking
    console.log('\n--- 4. Toy-Box Micro-Interactions ---');
    const startApples = store.getWorldAdventureMapState().toyBoxInteractions.applesHarvested || 0;
    store.recordToyBoxInteraction('apple');
    assert(
      store.getWorldAdventureMapState().toyBoxInteractions.applesHarvested === startApples + 1,
      'Harvesting apple increments applesHarvested counter'
    );

    const startSplashes = store.getWorldAdventureMapState().toyBoxInteractions.waterfallSplashes || 0;
    store.recordToyBoxInteraction('splash');
    assert(
      store.getWorldAdventureMapState().toyBoxInteractions.waterfallSplashes === startSplashes + 1,
      'Splashing waterfall increments waterfallSplashes counter'
    );

    const startChimes = store.getWorldAdventureMapState().toyBoxInteractions.chimesPlayed || 0;
    store.recordToyBoxInteraction('chime');
    assert(
      store.getWorldAdventureMapState().toyBoxInteractions.chimesPlayed === startChimes + 1,
      'Chiming rune increments chimesPlayed counter'
    );

    // 5. Secret Shrines Discovery
    console.log('\n--- 5. Secret Shrine Discovery ---');
    const secretRes = store.discoverWorldSecret('shrine_orchard');
    assert(secretRes.success === true, 'First discovery of orchard shrine succeeds');
    assert(secretRes.rewardCoins > 0, 'Awards coins on discovery');
    assert(
      store.getWorldAdventureMapState().discoveredSecrets.includes('shrine_orchard'),
      'Shrine recorded in discoveredSecrets'
    );

    const duplicateRes = store.discoverWorldSecret('shrine_orchard');
    assert(duplicateRes.alreadyDiscovered === true, 'Duplicate discovery recognized without double rewards');

    // 6. Parent Secret Stashes & Streak Bounties
    console.log('\n--- 6. Parent Mystery Stashes & Streaks ---');
    const newChest = store.placeParentWorldChest({
      title: 'Legendary Streak Vault',
      rewardCoins: 150,
      rewardSparks: 60,
      requiredStreak: 5
    });
    assert(newChest.id !== undefined, 'Parent chest placed successfully with unique ID');
    assert(newChest.requiredStreak === 5, 'Chest requires 5-day streak');

    // Attempt unlock with current streak (assuming streak < 5)
    store.getState().selectedHero.streak = 2;
    const failUnlock = store.unlockParentWorldChest(newChest.id);
    assert(failUnlock.success === false, 'Blocks unlock if streak is below requirement');

    // Now set streak to 5 and unlock
    store.getState().selectedHero.streak = 5;
    const passUnlock = store.unlockParentWorldChest(newChest.id);
    assert(passUnlock.success === true, 'Successfully unlocks chest when streak matches or exceeds requirement');
    assert(passUnlock.chest.unlocked === true, 'Chest marked as unlocked');

    // 7. Waypoint Chore Completion & Pearly Gleam Synergy
    console.log('\n--- 7. Waypoint Chore Completion ---');
    const choreRes = store.completeWaypointChore('wp_morning_teeth');
    assert(choreRes.success === true, 'Morning teeth waypoint chore completed successfully');
    assert(choreRes.waypoint.rewardCoins === 25, 'Correct waypoint token reward granted');

    // Check Pearly Gleam activation from dental chore
    const bondState = store.getPetBondState();
    assert(bondState.isPearlyGleamActive === true, 'Pearly Gleam activated for companion on dental chore completion');

    // 7b. Regression: completeWaypointChore() must not be re-grantable, and
    // must record a completion so isWaypointDone()/Today's Path can see it.
    // Live-played discovery: the function previously awarded coins/points/xp
    // on every call with no guard (an unlimited reward-farming exploit) and
    // never wrote to taskCompletionLogs, so the Next Hero Stop banner could
    // never advance past the very first waypoint even after "completing" it.
    console.log('\n--- 7b. Regression: Waypoint Reward Exploit & Stuck Progression ---');
    const heroForExploitCheck = store.getState().selectedHero;
    const coinsAfterFirstComplete = heroForExploitCheck.coins;
    const repeatRes = store.completeWaypointChore('wp_morning_teeth');
    assert(repeatRes.success === false, 'Completing the same waypoint again is refused, not re-granted');
    assert(heroForExploitCheck.coins === coinsAfterFirstComplete, 'No additional coins granted on a repeat completion attempt');
    assert(
      store.getTaskCompletionsToday('brush_teeth_am', heroForExploitCheck.id).length > 0,
      "completeWaypointChore() recorded the completion under the waypoint's choreKey so isWaypointDone() can see it"
    );

    // 7c. Regression: the "📖 READ BEDTIME STORY" button at the final
    // waypoint (wp_bedtime) was gated on a typo'd 'wp_bedtime_sleep' id that
    // never matched the real waypoint id, so the last Today's Path stop
    // always fell through to a generic "COMPLETE HABIT" button instead.
    console.log('\n--- 7c. Regression: Final Waypoint Bedtime Story Button ---');
    const allChoreKeys = PATH_OF_VALOR_WAYPOINTS.filter(w => w.id !== 'wp_bedtime').map(w => w.choreKey);
    store.state.taskCompletionLogs = allChoreKeys.map((k, i) => ({
      id: 'regress_bedtime_' + i,
      taskId: k,
      heroId: heroForExploitCheck.id,
      completedAt: new Date().toISOString(),
      timestamp: Date.now()
    }));
    store.setWorldMapTab('path');
    const finalStopHtml = renderWorldAdventureMapView();
    assert(finalStopHtml.includes('path-launch-bedtime-story-btn'), 'Final waypoint (wp_bedtime) now correctly shows the READ BEDTIME STORY button');
    assert(finalStopHtml.includes('Starlight Dream Slumber'), 'Next Hero Stop banner shows the final waypoint, not stuck on an earlier stop');

    // 7d. Regression: a waypoint-linked boss battle must log its completion
    // under the waypoint's OWN choreKey, not a real-wall-clock guess. Live
    // play exposed that completeToothbrushBattle() previously inferred
    // morning-vs-evening purely from isNighttimeToothbrushBattle() (the
    // real device clock's hour), which mislabels the "morning" wp_morning_teeth
    // waypoint's sugar_gremlin battle as an evening battle for any kid who
    // plays during real local hours 5pm-5am -- logging it under
    // 'brush_teeth_pm' instead of 'brush_teeth_am' so the waypoint can never
    // show as done even after a real win.
    console.log('\n--- 7d. Regression: Waypoint Boss Battle Morning/Evening Breadcrumb ---');
    store.state.taskCompletionLogs = [];
    const heroForBreadcrumbCheck = store.getState().selectedHero;
    heroForBreadcrumbCheck.dentalHabits = {};
    store.state.activeWaypointChoreKey = 'brush_teeth_am';
    store.completeToothbrushBattle('sugar_gremlin', 90, 85);
    assert(
      store.getTaskCompletionsToday('brush_teeth_am', heroForBreadcrumbCheck.id).length > 0,
      'A battle launched from the morning waypoint logs under brush_teeth_am even when the real-world clock reads night'
    );
    assert(
      Boolean(heroForBreadcrumbCheck.dentalHabits?.morningBrushDate),
      'Morning dental habit date recorded, not the evening one, thanks to the explicit waypoint breadcrumb'
    );
    assert(
      store.state.activeWaypointChoreKey === null,
      'The breadcrumb is consumed after one battle so it cannot leak into the next, unrelated battle'
    );

    // 8. Time Overrides & Bedtime Lullaby
    console.log('\n--- 8. Time of Day & Bedtime Lullaby ---');
    store.setIslandTimeOverride('bedtime');
    assert(store.getWorldAdventureMapState().islandTimeOverride === 'bedtime', 'Bedtime override applied');

    const lullabyActive = store.toggleBedtimeLullaby(true);
    assert(lullabyActive === true, 'Bedtime lullaby active');
    assert(store.getWorldAdventureMapState().bedtimeLullabyActive === true, 'Lullaby state preserved in store');

    // 9. View Render Verification
    console.log('\n--- 9. View HTML Rendering ---');
    store.setWorldMapTab('path');
    const pathHtml = renderWorldAdventureMapView();
    assert(pathHtml.includes("TODAY'S PATH"), 'Renders Today\'s Path tab header');
    assert(pathHtml.includes('wp_morning_teeth') || pathHtml.includes('Pearly White Defense') || pathHtml.includes('Morning Toothbrushing Shield'), 'Renders waypoint chore item');

    store.setWorldMapTab('island');
    const islandHtml = renderWorldAdventureMapView();
    assert(islandHtml.includes('world-adventure-canvas'), 'Renders #world-adventure-canvas container');
    assert(islandHtml.includes('Apples'), 'Renders toy-box stats bar');
    assert(islandHtml.includes('island-cycle-season-btn'), 'Renders season cycle button in Island HUD');
    assert(islandHtml.includes('Landmarks'), 'Renders active landmarks counter in bottom bar');

    // 10. Seasonal Weather System & Dynamic Season Cycler
    console.log('\n--- 10. Seasonal Weather System ---');
    assert(Object.keys(SEASONS_DATA).length === 4, 'Should define exactly 4 seasons');
    assert(SEASONS_DATA.spring && SEASONS_DATA.summer && SEASONS_DATA.autumn && SEASONS_DATA.winter, 'All 4 canonical seasons defined');

    // Palette check for seasons: zero pink or purple
    const seasonPaletteCheck = Object.values(SEASONS_DATA).every(s => 
      !s.accentColor.toLowerCase().includes('pink') &&
      !s.accentColor.toLowerCase().includes('purple') &&
      s.accentColor.toLowerCase() !== '#ec4899' &&
      s.accentColor.toLowerCase() !== '#a855f7' &&
      !s.particleColor.toLowerCase().includes('pink') &&
      !s.particleColor.toLowerCase().includes('purple')
    );
    assert(seasonPaletteCheck, 'Strictly zero pink or purple in seasonal color definitions');

    const effectiveSeason = store.getEffectiveSeason();
    assert(['spring', 'summer', 'autumn', 'winter'].includes(effectiveSeason), 'getEffectiveSeason() returns valid season');

    store.setIslandSeason('winter');
    assert(store.getWorldAdventureMapState().islandSeason === 'winter', 'Season successfully set to winter');
    assert(store.getEffectiveSeason() === 'winter', 'Effective season matches forced winter season');

    store.setIslandSeason('summer');
    assert(store.getEffectiveSeason() === 'summer', 'Effective season matches forced summer season');

    // 11. Dynamic AI Landmark Placement & Interaction
    console.log('\n--- 11. Dynamic AI Landmark Placement & Interaction ---');
    assert(LANDMARK_ARCHETYPES.length === 7, 'Defines 7 landmark archetypes');
    assert(BIOME_PLACEMENT_PRESETS.length === 8, 'Defines 8 biome placement presets across the island');

    const archetypeTypes = LANDMARK_ARCHETYPES.map(a => a.type);
    assert(archetypeTypes.includes('fort') && archetypeTypes.includes('lighthouse') && archetypeTypes.includes('observatory'), 'Includes fort, lighthouse, and observatory archetypes');

    const customLandmark = store.addCustomWorldLandmark({
      name: 'Crystal Star Spire',
      description: 'Gleams under the polar auroras',
      type: 'crystal_tree',
      biomeId: 'crystal_summit',
      rewardCoins: 45,
      rewardSparks: 20,
      coordinates: { x: 14, y: 0, z: -14 },
      voiceLine: 'A radiant crystal spire sings in the cold wind!'
    });
    assert(customLandmark.id !== undefined, 'Custom landmark placed with unique ID');
    assert(customLandmark.name === 'Crystal Star Spire', 'Custom landmark name preserved');

    const mapStateWithLm = store.getWorldAdventureMapState();
    assert(mapStateWithLm.customLandmarks.some(lm => lm.id === customLandmark.id), 'Custom landmark registered in map state');

    const initialCoins = store.getState().selectedHero.coins;
    const initialSparks = store.getPetSparks(store.getState().selectedHero.selectedPetId || '1');
    const interactRes = store.interactWithCustomLandmark(customLandmark.id);
    assert(interactRes.success === true, 'First interaction with landmark succeeds');
    assert(interactRes.alreadyClaimed === false, 'Awards initial claim status');
    assert(store.getState().selectedHero.coins === initialCoins + 45, 'Rewards 45 gold coins to hero');
    assert(store.getPetSparks(store.getState().selectedHero.selectedPetId || '1') === initialSparks + 20, 'Rewards 20 sparks to pet');

    const secondInteract = store.interactWithCustomLandmark(customLandmark.id);
    assert(secondInteract.alreadyClaimed === true, 'Subsequent interaction indicates already claimed');

    // Remove landmark test
    const removeRes = store.removeCustomWorldLandmark(customLandmark.id);
    assert(removeRes === true, 'removeCustomWorldLandmark succeeds');
    assert(!store.getWorldAdventureMapState().customLandmarks.some(lm => lm.id === customLandmark.id), 'Landmark cleanly removed from store');

  } catch (err) {
    console.error('Unexpected error in test execution:', err);
    failed++;
  }

  console.log(`\n=========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`=========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
