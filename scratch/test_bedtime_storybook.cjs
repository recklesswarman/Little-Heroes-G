/**
 * Test Suite: Bedtime AI Storybook Adventure & Bookshelf Library
 * Validates realms catalog, strict Explorer Palette, fallback SVGs,
 * store library persistence, quiet bedtime habit completion, and HTML view rendering.
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
  console.log('📖 Starting Bedtime AI Storybook Test Suite...\n');

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
    const { BEDTIME_REALMS, generateFallbackSvg } = await import('../src/data/bedtimeStoryData.js');
    const { store } = await import('../src/state/store.js');
    const { bedtimeStoryService } = await import('../src/services/bedtimeStoryService.js');
    const { renderBedtimeStoryView } = await import('../src/views/BedtimeStoryView.js');

    // 1. Realms Catalog Validation
    console.log('--- 1. Bedtime Realms Catalog ---');
    assert(BEDTIME_REALMS.length === 4, 'Should define exactly 4 bedtime fantasy realms');
    const realmIds = BEDTIME_REALMS.map(r => r.id);
    assert(realmIds.includes('space'), 'Includes Cosmic Starlight Space');
    assert(realmIds.includes('dino_jungle'), 'Includes Dinosaur Fossil Jungle');
    assert(realmIds.includes('pirate_lagoon'), 'Includes Treasure Island Pirate Lagoon');
    assert(realmIds.includes('enchanted_castle'), 'Includes Enchanted Knight Citadel');

    // Strict zero pink or purple palette check
    const hasForbiddenColors = BEDTIME_REALMS.some(r =>
      r.accentColor.toLowerCase().includes('pink') ||
      r.accentColor.toLowerCase().includes('purple') ||
      r.accentColor.toLowerCase() === '#ec4899' ||
      r.accentColor.toLowerCase() === '#a855f7' ||
      r.glowColor.toLowerCase().includes('pink') ||
      r.glowColor.toLowerCase().includes('purple')
    );
    assert(!hasForbiddenColors, 'Strictly zero pink or purple colors in bedtime realms');

    // Default suggestion chips check
    const allHaveChips = BEDTIME_REALMS.every(r => r.act1DefaultChips.length >= 3 && r.act2DefaultChips.length >= 3);
    assert(allHaveChips, 'All realms have at least 3 suggestion chips for Act 1 and Act 2');

    // 2. Procedural Fallback SVG Generator
    console.log('\n--- 2. Procedural SVG Fallback Generator ---');
    for (const realm of BEDTIME_REALMS) {
      const svgAct1 = generateFallbackSvg(realm.id, 1, 'Laser Toothbrush');
      assert(svgAct1.includes('<svg') && svgAct1.includes('</svg>'), `Generates valid SVG for ${realm.name} Act 1`);
      assert(svgAct1.includes('LASER TOOTHBRUSH'), `Includes custom hero choice text in ${realm.name} SVG`);
      assert(!svgAct1.includes('#ec4899') && !svgAct1.includes('#a855f7'), `Zero forbidden pink/purple in ${realm.name} SVG`);
    }

    // 3. Store Library & Persistence
    console.log('\n--- 3. Store Bedtime Library & Persistence ---');
    const initialLibrary = store.getBedtimeStoryLibrary();
    assert(Array.isArray(initialLibrary), 'getBedtimeStoryLibrary() returns an array');

    const sampleStory = {
      title: "Hero Leo's Cosmic Space Quest",
      realmId: 'space',
      realmName: 'Cosmic Starlight Space',
      realmEmoji: '🚀',
      heroName: 'Leo',
      petName: 'Rex',
      acts: [
        { actNumber: 1, title: 'Blastoff', text: 'Rex fired up his boots.', childChoice: 'Laser Toothbrush' },
        { actNumber: 2, title: 'Stardust', text: 'Cleaned the runway.', childChoice: 'Tidy Up' },
        { actNumber: 3, title: 'Slumber', text: 'Slept under the moon.' }
      ]
    };

    const savedStory = store.saveBedtimeStory(sampleStory);
    assert(savedStory.id !== undefined, 'Saved story receives a unique ID');
    assert(savedStory.savedAt !== undefined, 'Saved story has timestamp');
    assert(store.getBedtimeStoryLibrary().some(s => s.id === savedStory.id), 'Story registered in store library');

    // 4. Quiet Bedtime Habit Completion
    console.log('\n--- 4. Quiet Bedtime Habit Completion ---');
    const initialCoins = store.getState().selectedHero.coins;
    const initialSparks = store.getPetSparks(store.getState().selectedHero.activePetId || '1');

    const completeRes = store.completeBedtimeStory(sampleStory);
    assert(completeRes.success === true, 'completeBedtimeStory succeeds');
    assert(completeRes.rewardCoins === 30, 'Awards exactly 30 tokens for bedtime story');
    assert(completeRes.rewardSparks === 15, 'Awards 15 sparks to active pet');
    assert(store.getState().selectedHero.coins === initialCoins + 30, 'Hero coin balance increased by 30');
    assert(store.getPetSparks(store.getState().selectedHero.activePetId || '1') === initialSparks + 15, 'Pet sparks increased by 15');
    assert(store.getWorldAdventureMapState().bedtimeLullabyActive === true, 'Bedtime lullaby automatically activated');

    // Verify non-blocking: rewardModal should be null (no pop-up full-screen dialog per guidelines)
    assert(store.getState().rewardModal === null, 'Non-blocking: No full-screen modal opened during bedtime routine');

    // 5. Bedtime Story Service Progression
    console.log('\n--- 5. Bedtime Story Service 3-Act Progression ---');
    const act1 = await bedtimeStoryService.startStory('space');
    assert(act1 !== null, 'startStory returns Act 1');
    assert(act1.actNumber === 1, 'Act 1 correctly indexed');
    assert(act1.suggestionChips.length >= 3, 'Act 1 has quick suggestion chips');

    const act2 = await bedtimeStoryService.advanceStory('Laser Toothbrush 🪥');
    assert(act2 !== null, 'advanceStory returns Act 2');
    assert(act2.actNumber === 2, 'Act 2 correctly indexed');

    const act3 = await bedtimeStoryService.advanceStory('Brush Away Stardust ✨');
    assert(act3 !== null, 'advanceStory returns Act 3');
    assert(act3.actNumber === 3, 'Act 3 correctly indexed');

    const act4 = await bedtimeStoryService.advanceStory('Share Warm Blanket 🤝');
    assert(act4 !== null, 'advanceStory returns Act 4');
    assert(act4.actNumber === 4, 'Act 4 correctly indexed');
    assert(act4.isSleepingEnd === true, 'Act 4 marked as sleeping end');

    // 6. View HTML Rendering
    console.log('\n--- 6. HTML View Rendering ---');
    const viewHtml = renderBedtimeStoryView();
    assert(viewHtml.includes('Bedtime AI Storybook'), 'Renders Bedtime AI Storybook header');
    assert(viewHtml.includes('Cosmic Starlight Space'), 'Renders Space realm card');
    assert(viewHtml.includes('Dinosaur Fossil Jungle'), 'Renders Dino Jungle realm card');
    assert(viewHtml.includes('Treasure Island Pirate Lagoon'), 'Renders Pirate Lagoon realm card');
    assert(viewHtml.includes('Enchanted Knight Citadel'), 'Renders Knight Citadel realm card');
    assert(viewHtml.includes('Bookshelf'), 'Renders Bookshelf button');

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
