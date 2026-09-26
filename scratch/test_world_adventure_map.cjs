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
      TOY_BOX_ENTITIES
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
    assert(islandHtml.includes('Apples Picked'), 'Renders toy-box stats bar');

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
