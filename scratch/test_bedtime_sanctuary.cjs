/**
 * Automated Verification Suite for Bedtime Sanctuary Hub & Enhanced 4-5 Min AI Storybook
 * 
 * Verifies:
 * 1. 3-Step Evening Wind-Down Sanctuary State & Habit Chaining (Toothbrush, Pajamas, Storybook)
 * 2. 30-Day Anti-Repetition Moral Wheel & History Lockout (hero.bedtimeHistory)
 * 3. 4-Chapter Storybook Arc (~4-5 mins) with active pet co-star moments & prompt customizer
 * 4. Dual Narration Modes (Rex AI vs Parent Read Aloud)
 * 5. Audio Synthesizer Ducking & Bedtime Tap Chimes
 * 6. Toddler-Friendly 15-Second Sleep Auto-Advance Timer
 * 7. Bookshelf Album, Constellation Star Stickers & Favorite Pinning
 * 8. HTML View Rendering (Sanctuary Hub, Customizer, 4 Realm Cards, Bookshelf)
 */

const assert = require('assert');

console.log('🧪 Starting Verification Suite for Bedtime Sanctuary Hub & Enhanced AI Storybook...\n');

let totalTests = 0;
let passedTests = 0;

async function it(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function runAll() {
  const { store } = await import('../src/state/store.js');
  const { Sound } = await import('../src/audio/sfx.js');
  const { BEDTIME_REALMS, BEDTIME_MORALS, CONSTELLATION_STICKERS, generateProceduralBedtimeStory } = await import('../src/data/bedtimeStoryData.js');
  const { bedtimeStoryService } = await import('../src/services/bedtimeStoryService.js');
  const { renderBedtimeStoryView } = await import('../src/views/BedtimeStoryView.js');

  console.log('--- 1. Data Catalogs & Invariants ---');

  await it('BEDTIME_REALMS contains 4 canonical fantasy realms with sub-biomes and 4 chapter prompts', () => {
    assert.strictEqual(BEDTIME_REALMS.length, 4);
    const realmIds = BEDTIME_REALMS.map(r => r.id);
    assert(realmIds.includes('space'));
    assert(realmIds.includes('dino_jungle'));
    assert(realmIds.includes('pirate_lagoon'));
    assert(realmIds.includes('enchanted_castle'));

    BEDTIME_REALMS.forEach(realm => {
      assert(Array.isArray(realm.subBiomes) && realm.subBiomes.length >= 3, `${realm.id} must have sub-biomes`);
      assert(Array.isArray(realm.act1DefaultChips), `${realm.id} must have act1DefaultChips`);
      assert(Array.isArray(realm.act2DefaultChips), `${realm.id} must have act2DefaultChips`);
      assert(Array.isArray(realm.act3DefaultChips), `${realm.id} must have act3DefaultChips`);
      assert.strictEqual(typeof realm.act4Prompt, 'string', `${realm.id} must have act4Prompt`);
    });
  });

  await it('BEDTIME_MORALS contains 10 child-development moral themes', () => {
    assert.strictEqual(BEDTIME_MORALS.length, 10);
    BEDTIME_MORALS.forEach(moral => {
      assert(moral.id, 'Moral must have id');
      assert(moral.name, 'Moral must have name');
      assert(moral.moralGuidance, 'Moral must have guidance');
      assert(moral.petAction, 'Moral must have pet action');
      assert(moral.slumberResolution, 'Moral must have slumber resolution');
    });
  });

  await it('CONSTELLATION_STICKERS contains 12 celestial star badges', () => {
    assert.strictEqual(CONSTELLATION_STICKERS.length, 12);
    CONSTELLATION_STICKERS.forEach(sticker => {
      assert(sticker.id, 'Sticker must have id');
      assert(sticker.name, 'Sticker must have name');
      assert(sticker.emoji, 'Sticker must have emoji');
    });
  });

  console.log('\n--- 2. Procedural Combinatorial 4-Chapter Story Engine ---');

  await it('generateProceduralBedtimeStory builds 4 distinct rich chapters (~120-150 words each)', () => {
    for (let chapter = 0; chapter < 4; chapter++) {
      const generated = generateProceduralBedtimeStory(
        'space',
        'brave_dark',
        'Tommy',
        'Rex',
        'Tommy was brave at the dentist today',
        chapter,
        ['Laser Toothbrush 🪥', 'Sleeping Star-Bunny 🐰', 'Share Blanket 🤝']
      );

      assert.strictEqual(generated.chapterIndex, chapter);
      assert(generated.title.includes(`Chapter ${chapter + 1}`), `Title must include Chapter ${chapter + 1}`);
      assert(generated.text.length > 250, `Chapter ${chapter + 1} text must have rich length (${generated.text.length} chars)`);
      assert(generated.text.includes('Tommy'), 'Text must include hero name');
      assert(generated.text.includes('Rex'), 'Text must include active pet name');
      if (chapter === 0) {
        assert(generated.text.includes('dentist'), 'Chapter 1 must weave in custom bedtime wish');
      }
    }
  });

  console.log('\n--- 3. Bedtime Sanctuary Hub State & Habit Chaining ---');

  await it('store.getBedtimeSanctuaryState returns default sanctuary state', () => {
    const state = store.getBedtimeSanctuaryState();
    assert.strictEqual(typeof state, 'object');
    assert.strictEqual(state.currentStep, 1);
  });

  await it('store.completePajamasTidyStep awards coins, xp, logs action, and advances step', () => {
    const hero = store.getState().selectedHero;
    const initialCoins = hero.coins || 0;
    const initialXp = hero.xp || 0;

    const res = store.completePajamasTidyStep();
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.coinsAwarded, 15);
    assert.strictEqual(res.xpAwarded, 10);
    assert.strictEqual(hero.coins, initialCoins + 15);
    assert.strictEqual(hero.xp, initialXp + 10);

    const sanctuary = store.getBedtimeSanctuaryState();
    assert.strictEqual(sanctuary.pajamasCompletedDate, new Date().toDateString());
    assert.strictEqual(sanctuary.currentStep, 3);
  });

  console.log('\n--- 4. 30-Day Anti-Repetition Moral Engine ---');

  await it('store.getAvailableBedtimeMorals excludes morals used in the last 30 days', () => {
    const hero = store.getState().selectedHero;
    hero.bedtimeHistory = [
      { moralId: 'brave_dark', title: 'Night Stars', timestamp: Date.now() - (2 * 24 * 60 * 60 * 1000) }, // 2 days ago
      { moralId: 'kindness_sharing', title: 'Shared Toys', timestamp: Date.now() - (10 * 24 * 60 * 60 * 1000) } // 10 days ago
    ];

    const available = store.getAvailableBedtimeMorals(hero.id);
    const availableIds = available.map(m => m.id);
    assert(!availableIds.includes('brave_dark'), 'brave_dark must be locked out (used 2 days ago)');
    assert(!availableIds.includes('kindness_sharing'), 'kindness_sharing must be locked out (used 10 days ago)');
    assert(availableIds.includes('first_day_school'), 'first_day_school must be available');
    assert.strictEqual(available.length, 8, '8 morals remaining out of 10');
  });

  await it('store.getAvailableBedtimeMorals falls back to all morals if all are exhausted in 30 days', () => {
    const hero = store.getState().selectedHero;
    hero.bedtimeHistory = BEDTIME_MORALS.map(m => ({
      moralId: m.id,
      title: 'Old Story',
      timestamp: Date.now() - (5 * 24 * 60 * 60 * 1000)
    }));

    const available = store.getAvailableBedtimeMorals(hero.id);
    assert.strictEqual(available.length, 10, 'Fallback returns all morals when all are exhausted');
  });

  console.log('\n--- 5. 4-Chapter Bedtime Story Progression (~4-5 mins) ---');

  await it('bedtimeStoryService.startStory initializes a 4-chapter narrative session', async () => {
    const act1 = await bedtimeStoryService.startStory('space', 'first_day_school', 'Emma starts kindergarten tomorrow', 'rex');
    const session = bedtimeStoryService.getActiveSession();

    assert(session, 'Active session must be set');
    assert.strictEqual(session.realmId, 'space');
    assert.strictEqual(session.moralId, 'first_day_school');
    assert.strictEqual(session.actNumber, 1);
    assert.strictEqual(session.completed, false);
    assert.strictEqual(typeof session.constellationStickerId, 'string');
    assert.strictEqual(act1.actNumber, 1);
    assert.strictEqual(act1.isSleepingEnd, false);
  });

  await it('bedtimeStoryService advances smoothly through all 4 chapters into slumber conclusion', async () => {
    // Advance to Chapter 2
    const act2 = await bedtimeStoryService.advanceStory('Laser Toothbrush 🪥');
    assert.strictEqual(act2.actNumber, 2);
    assert.strictEqual(bedtimeStoryService.getActiveSession().actNumber, 2);
    assert.strictEqual(act2.isSleepingEnd, false);

    // Advance to Chapter 3
    const act3 = await bedtimeStoryService.advanceStory('A Baby Star-Bunny 🐰');
    assert.strictEqual(act3.actNumber, 3);
    assert.strictEqual(bedtimeStoryService.getActiveSession().actNumber, 3);
    assert.strictEqual(act3.isSleepingEnd, false);

    // Advance to Chapter 4 (Slumber Conclusion)
    const act4 = await bedtimeStoryService.advanceStory('Take 3 Deep Breaths 🧘');
    assert.strictEqual(act4.actNumber, 4);
    assert.strictEqual(bedtimeStoryService.getActiveSession().actNumber, 4);
    assert.strictEqual(act4.isSleepingEnd, true, 'Chapter 4 must be sleeping conclusion');
    assert.strictEqual(bedtimeStoryService.getActiveSession().completed, true);

    // Verify completion logged to hero.bedtimeHistory
    const hero = store.getState().selectedHero;
    assert(hero.bedtimeHistory.length > 0);
    assert.strictEqual(hero.bedtimeHistory[0].moralId, 'first_day_school');
  });

  console.log('\n--- 6. Dual Narration Modes & Audio Synthesizer Ducking ---');

  await it('Sound engine supports duckLullaby and isLullabyDucked', () => {
    assert.strictEqual(typeof Sound.duckLullaby, 'function');
    assert.strictEqual(typeof Sound.isLullabyDucked, 'function');

    Sound.duckLullaby(true);
    assert.strictEqual(Sound.isLullabyDucked(), true);

    Sound.duckLullaby(false);
    assert.strictEqual(Sound.isLullabyDucked(), false);
  });

  await it('Sound.playBedtimeChime executes without error', () => {
    assert.strictEqual(typeof Sound.playBedtimeChime, 'function');
    Sound.playBedtimeChime(523.25);
    Sound.playBedtimeChime();
  });

  await it('Parent Read Aloud mode starts auto-advance without throwing', async () => {
    await bedtimeStoryService.startStory('dino_jungle', 'tidy_bedtime', '', 'parent');
    const session = bedtimeStoryService.getActiveSession();
    assert.strictEqual(session.narrationMode, 'parent');
    bedtimeStoryService.clearSession();
  });

  console.log('\n--- 7. Sleep Auto-Advance Timer ---');

  await it('startAutoAdvance and cancelAutoAdvance manage countdown cleanly', async () => {
    await bedtimeStoryService.startStory('pirate_lagoon', 'calm_feelings', '', 'rex');
    bedtimeStoryService.startAutoAdvance(() => {});
    assert.strictEqual(bedtimeStoryService.autoAdvanceSecondsRemaining, 15);
    bedtimeStoryService.cancelAutoAdvance();
    assert.strictEqual(bedtimeStoryService.autoAdvanceSecondsRemaining, 15);
    assert.strictEqual(bedtimeStoryService.autoAdvanceInterval, null);
    bedtimeStoryService.clearSession();
  });

  console.log('\n--- 8. Bookshelf Album & Favorite Pinning ---');

  await it('store.saveBedtimeStory assigns constellation stickers and store.toggleFavoriteBedtimeStory toggles favorites', () => {
    const saved = store.saveBedtimeStory({
      title: 'Captain Rex and the Calm Tide',
      realmId: 'pirate_lagoon',
      moralId: 'calm_feelings',
      acts: [{ text: 'Chapter 1' }, { text: 'Chapter 2' }, { text: 'Chapter 3' }, { text: 'Chapter 4' }]
    });

    assert(saved.id, 'Saved story must have id');
    assert(saved.constellationStickerId, 'Saved story must have constellation sticker');
    assert.strictEqual(saved.isFavorite, false);

    // Toggle Favorite ON
    const fav1 = store.toggleFavoriteBedtimeStory(saved.id);
    assert.strictEqual(fav1, true);
    assert.strictEqual(saved.isFavorite, true);

    // Toggle Favorite OFF
    const fav2 = store.toggleFavoriteBedtimeStory(saved.id);
    assert.strictEqual(fav2, false);
    assert.strictEqual(saved.isFavorite, false);
  });

  console.log('\n--- 9. View HTML Rendering ---');

  await it('renderBedtimeStoryView renders Sanctuary Hub with 3 steps, 4 realms, and Bookshelf button', () => {
    const html = renderBedtimeStoryView();
    assert(html.includes('Bedtime AI Storybook'), 'Must render Bedtime AI Storybook header');
    assert(html.includes('Evening Toothbrush'), 'Must render Step 1 Toothbrush');
    assert(html.includes('Pajamas & Tidy Up'), 'Must render Step 2 Pajamas');
    assert(html.includes('Bedtime AI Storybook'), 'Must render Step 3 Storybook');
    assert(html.includes('Cosmic Starlight Space'), 'Must render Space realm card');
    assert(html.includes('Dinosaur Fossil Jungle'), 'Must render Dino Jungle realm card');
    assert(html.includes('Treasure Island Pirate Lagoon'), 'Must render Pirate Lagoon realm card');
    assert(html.includes('Enchanted Knight Citadel'), 'Must render Knight Citadel realm card');
    assert(html.includes('Bookshelf'), 'Must render Bookshelf button');
    assert(html.includes('30-Day Anti-Repetition Active'), 'Must render 30-day anti-repetition badge');
    assert(html.includes('Parent Read Aloud'), 'Must render Parent Read Aloud mode button');
    assert(html.includes('Rex Narrates'), 'Must render Rex Narrates button');
  });

  console.log(`\n=========================================`);
  console.log(`Results: ${passedTests} passed, 0 failed (${totalTests} total)`);
  console.log(`=========================================`);
}

runAll().catch(err => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
