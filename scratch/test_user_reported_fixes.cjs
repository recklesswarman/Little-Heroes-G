/**
 * Comprehensive Automated Verification Suite for User Reported Fixes:
 * 1. Procedural Bedtime Lullaby Synthesizer & Store Integration
 * 2. Pet Selection Persistence to Kid Profiles (String IDs & Bidirectional Sync)
 * 3. Pet Selection Modal Scrollability (CSS flex shrink min-h-0 & Touch Pan)
 * 4. Total Removal of Hero Forge & 3D Tinkering Lab from UI & Navigation
 * 5. AI Spark Quests Persistence (No instant disappearance on sync or empty cloud snapshots)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting Verification Suite for User Reported Fixes...\n');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function runAll() {
  // Dynamically import ESM modules
  const { store } = await import('../src/state/store.js');
  const { Sound } = await import('../src/audio/sfx.js');
  const { renderPetSelectionModal } = await import('../src/components/PetSelectionModal.js');
  const { renderProfileView } = await import('../src/views/ProfileView.js');
  const { renderHeroHQView } = await import('../src/views/HeroHQView.js');
  const { renderPetPenView } = await import('../src/views/PetPenView.js');

  console.log('--- 1. Procedural Bedtime Lullaby Synthesizer ---');

  it('Sound engine exposes startLullaby, stopLullaby, and isLullabyPlaying', () => {
    assert.strictEqual(typeof Sound.startLullaby, 'function', 'startLullaby must be a function');
    assert.strictEqual(typeof Sound.stopLullaby, 'function', 'stopLullaby must be a function');
    assert.strictEqual(typeof Sound.isLullabyPlaying, 'function', 'isLullabyPlaying must be a function');
  });

  it('store.toggleBedtimeLullaby updates state and triggers Sound lullaby methods', () => {
    let started = false;
    let stopped = false;
    const origStart = Sound.startLullaby;
    const origStop = Sound.stopLullaby;

    Sound.startLullaby = () => { started = true; };
    Sound.stopLullaby = () => { stopped = true; };

    try {
      // Toggle ON
      const active1 = store.toggleBedtimeLullaby(true);
      assert.strictEqual(active1, true);
      assert.strictEqual(store.getWorldAdventureMapState().bedtimeLullabyActive, true);
      assert.strictEqual(started, true, 'startLullaby must be called when toggled on');

      // Toggle OFF
      const active2 = store.toggleBedtimeLullaby(false);
      assert.strictEqual(active2, false);
      assert.strictEqual(store.getWorldAdventureMapState().bedtimeLullabyActive, false);
      assert.strictEqual(stopped, true, 'stopLullaby must be called when toggled off');
    } finally {
      Sound.startLullaby = origStart;
      Sound.stopLullaby = origStop;
      store.toggleBedtimeLullaby(false);
    }
  });

  it('startDisco and startBattleRhythm automatically stop active lullaby to prevent overlapping music', () => {
    let lullabyStopped = false;
    const origStop = Sound.stopLullaby;
    Sound.stopLullaby = () => { lullabyStopped = true; };

    try {
      Sound.startDisco();
      assert.strictEqual(lullabyStopped, true, 'startDisco must stop lullaby');

      lullabyStopped = false;
      Sound.startBattleRhythm();
      assert.strictEqual(lullabyStopped, true, 'startBattleRhythm must stop lullaby');
    } finally {
      Sound.stopDisco();
      Sound.stopBattleRhythm();
      Sound.stopLullaby = origStop;
    }
  });

  console.log('\n--- 2. Pet Selection Persistence to Kid Profiles ---');

  it('choosePet coerces numeric string IDs and persists activePetId and unlockedPetIds to selectedHero', () => {
    const hero = store.getState().selectedHero;
    const initialCoins = hero.coins || 100;

    // Adopt Pet '3' (Finn the Shark)
    store.choosePet('3', 'starter');

    const updatedHero = store.getState().selectedHero;
    assert.strictEqual(String(updatedHero.activePetId), '3', 'activePetId must be string 3');
    assert.ok(updatedHero.unlockedPetIds.includes('3'), 'unlockedPetIds must contain string 3');
    assert.strictEqual(typeof updatedHero.unlockedPetIds[0], 'string', 'All pet IDs must be strings');

    // Check heroes array has the exact same updated pet
    const matchingInHeroes = store.getState().heroes.find(h => h.id === hero.id);
    assert.ok(matchingInHeroes, 'Hero must be present in heroes array');
    assert.strictEqual(String(matchingInHeroes.activePetId), '3', 'heroes array activePetId must match');
    assert.ok(matchingInHeroes.unlockedPetIds.includes('3'), 'heroes array unlockedPetIds must include 3');
  });

  it('ProfileView renders active companion pet showcase card with pet details', () => {
    store.choosePet('1', 'starter');
    const html = renderProfileView();
    assert.ok(html.includes('Active Companion'), 'ProfileView must render Active Companion badge');
    assert.ok(html.includes('Rex the T-Rex') || html.includes('Rex'), 'ProfileView must render active pet name');
    assert.ok(html.includes('profile-choose-pet-btn'), 'ProfileView must render switch pet button');
    assert.ok(html.includes('profile-goto-sanctuary-btn'), 'ProfileView must render sanctuary button');
  });

  it('ProfileView hero switcher cards display each hero assigned companion pet', () => {
    const html = renderProfileView();
    assert.ok(html.includes('🐾'), 'ProfileView hero switcher cards must display companion pet icon');
  });

  it('Switching heroes preserves each kid profile distinct active pet', () => {
    // Hero 1 has Pet 1
    const heroes = store.getState().heroes;
    if (heroes.length >= 2) {
      store.switchHero(heroes[0].id);
      store.choosePet('1', 'starter');

      store.switchHero(heroes[1].id);
      store.choosePet('2', 'starter');

      // Switch back to Hero 1
      store.switchHero(heroes[0].id);
      assert.strictEqual(String(store.getState().selectedHero.activePetId), '1', 'Hero 0 must keep pet 1');

      // Switch to Hero 2
      store.switchHero(heroes[1].id);
      assert.strictEqual(String(store.getState().selectedHero.activePetId), '2', 'Hero 1 must keep pet 2');
    }
  });

  it('setActivePet persists to both selectedHero and matching hero in heroes array', () => {
    const hero = store.getState().selectedHero;
    store.choosePet('2', 'starter'); // Ensure unlocked
    store.setActivePet('2');

    assert.strictEqual(String(store.getState().selectedHero.activePetId), '2', 'selectedHero must have activePetId 2');
    const heroInArray = store.getState().heroes.find(h => h.id === hero.id);
    assert.strictEqual(String(heroInArray.activePetId), '2', 'hero in heroes array must have activePetId 2');
  });

  it('setActivePet auto-unlocks pet and closes modal without throwing locked modal', () => {
    store.openPetSelectionModal('switch');
    assert.strictEqual(store.getState().petSelectionModal.isOpen, true);

    // Equip Pet 5 (even if not yet unlocked)
    const success = store.setActivePet('5');
    assert.strictEqual(success, true, 'setActivePet must succeed');
    assert.strictEqual(String(store.getState().selectedHero.activePetId), '5');
    assert.ok(store.getState().selectedHero.unlockedPetIds.includes('5'), 'unlockedPetIds must contain 5');
    assert.strictEqual(store.getState().petSelectionModal.isOpen, false, 'Modal must close cleanly on setActivePet');
  });

  it('editHero supports updating activePetId and unlockedPetIds', () => {
    const hero = store.getState().selectedHero;
    store.editHero(hero.id, { activePetId: '4', unlockedPetIds: ['1', '2', '4'] });

    assert.strictEqual(String(store.getState().selectedHero.activePetId), '4');
    assert.ok(store.getState().selectedHero.unlockedPetIds.includes('4'));
    const heroInArray = store.getState().heroes.find(h => h.id === hero.id);
    assert.strictEqual(String(heroInArray.activePetId), '4');
    assert.ok(heroInArray.unlockedPetIds.includes('4'));
  });

  console.log('\n--- 3. Pet Selection Modal Scrollability & Switch Mode ---');

  it('PetSelectionModal renders dedicated scroll container, min-h-0, overscroll-contain, and switch mode', () => {
    store.openPetSelectionModal('switch');
    const html = renderPetSelectionModal();
    assert.ok(html.includes('id="pet-selection-scroll-container"'), 'Modal must have pet-selection-scroll-container');
    assert.ok(html.includes('id="pet-selection-grid"'), 'Modal must have pet-selection-grid id');
    assert.ok(html.includes('min-h-0'), 'Modal must include min-h-0 for CSS flex shrink');
    assert.ok(html.includes('overscroll-contain'), 'Modal must include overscroll-contain');
    assert.ok(html.includes('touch-pan-y'), 'Modal must include touch-pan-y');
    assert.ok(html.includes('Choose Companion Pet'), 'Switch mode must render title');
    assert.ok(html.includes('pet-selection-close-btn'), 'Switch mode must render close button');
    store.closePetSelectionModal();
  });

  console.log('\n--- 4. Removal of Hero Forge & 3D Tinkering Lab ---');

  it('HeroHQView contains zero Hero Forge or 3D Tinkering Lab launch buttons or banner cards', () => {
    const hqHtml = renderHeroHQView();
    assert.strictEqual(hqHtml.includes('hq-launch-3d-forge-btn'), false, 'hq-launch-3d-forge-btn must be removed');
    assert.strictEqual(hqHtml.includes('hq-forge-banner-card'), false, 'hq-forge-banner-card must be removed');
    assert.strictEqual(hqHtml.includes('HERO FORGE &amp; 3D TINKERING LAB'), false, 'Hero Forge title must be removed from HeroHQView');
  });

  it('PetPenView contains zero Hero Forge or Tinkering Lab buttons', () => {
    const penHtml = renderPetPenView();
    assert.strictEqual(penHtml.includes('pen-open-forge-btn'), false, 'pen-open-forge-btn must be removed');
    assert.strictEqual(penHtml.includes('Tinkering Lab'), false, 'Tinkering Lab text must be removed from PetPenView');
  });

  it('store.navigate safely redirects hero_forge and hero-forge to hero_hq', () => {
    store.navigate('hero_forge');
    assert.strictEqual(store.getState().activeView, 'hero_hq', 'hero_forge must redirect to hero_hq');
    store.navigate('hero-forge');
    assert.strictEqual(store.getState().activeView, 'hero_hq', 'hero-forge must redirect to hero_hq');
  });

  console.log('\n--- 5. AI Spark Quests Persistence ---');

  it('store.setAiQuests saves quests and getAiQuests returns them', () => {
    const hero = store.getState().selectedHero;
    const testQuests = [
      { id: 'q_test_1', title: 'Brush Teeth Like a Champ', coinReward: 25, completed: false },
      { id: 'q_test_2', title: 'Pick up 5 Blocks', coinReward: 30, completed: false }
    ];

    store.setAiQuests(testQuests, hero.id);
    const retrieved = store.getAiQuests(hero.id);
    assert.strictEqual(retrieved.length, 2, 'Must retrieve both quests');
    assert.strictEqual(retrieved[0].id, 'q_test_1');
    assert.strictEqual(retrieved[1].id, 'q_test_2');
  });

  it('hydrateFromCloud with empty aiQuests does NOT wipe out active local quests', () => {
    const hero = store.getState().selectedHero;
    const testQuests = [
      { id: 'q_local_1', title: 'Drink water', coinReward: 20, completed: false }
    ];
    store.setAiQuests(testQuests, hero.id);

    // Simulate incoming Firestore snapshot with empty aiQuests
    store.hydrateFromCloud({
      stateSnapshot: { aiQuests: [] },
      aiQuests: [],
      heroAiQuestsMap: {}
    });

    const activeQuests = store.getAiQuests(hero.id);
    assert.ok(activeQuests.length > 0, 'Active local quests must NOT be wiped by empty cloud array');
    assert.strictEqual(activeQuests[0].id, 'q_local_1');
  });

  it('hydrateFromCloud merges new cloud quests without dropping existing local quests', () => {
    const hero = store.getState().selectedHero;
    const testQuests = [
      { id: 'q_local_keep', title: 'Keep this local quest', coinReward: 20 }
    ];
    store.setAiQuests(testQuests, hero.id);

    // Incoming remote cloud snapshot has 1 new quest
    store.hydrateFromCloud({
      aiQuests: [
        { id: 'q_remote_new', title: 'Remote new quest', coinReward: 35 }
      ]
    });

    const activeQuests = store.getAiQuests(hero.id);
    assert.ok(activeQuests.some(q => q.id === 'q_local_keep'), 'Local quest must be preserved');
    assert.ok(activeQuests.some(q => q.id === 'q_remote_new'), 'Remote quest must be merged');
  });

  it('completeAiQuest marks the quest completed in both aiQuests and heroAiQuestsMap', () => {
    const hero = store.getState().selectedHero;
    const testQuests = [
      { id: 'q_complete_me', title: 'Complete Me', coinReward: 25, pointReward: 10, xpReward: 30, completed: false }
    ];
    store.setAiQuests(testQuests, hero.id);

    store.completeAiQuest('q_complete_me');
    const updatedQuests = store.getAiQuests(hero.id);
    const q = updatedQuests.find(item => item.id === 'q_complete_me');
    assert.ok(q, 'Quest must exist');
    assert.strictEqual(q.completed, true, 'Quest must be marked completed');
  });

  it('hydrateFromCloud preserves selectedHero.aiQuests even when incoming cloud hero lacks quests', () => {
    const hero = store.getState().selectedHero;
    const testQuests = [
      { id: 'q_hero_preserve', title: 'Special Hero Quest', coinReward: 50 }
    ];
    store.setAiQuests(testQuests, hero.id);

    // Incoming snapshot with heroes without aiQuests
    store.hydrateFromCloud({
      heroes: [
        { id: hero.id, name: hero.name, coins: 100 }
      ]
    });

    assert.ok(store.getState().selectedHero.aiQuests?.length > 0, 'selectedHero.aiQuests must not be clobbered by cloud snapshot missing aiQuests');
    assert.strictEqual(store.getState().selectedHero.aiQuests[0].id, 'q_hero_preserve');
  });

  it('loadState restores selectedHero and heroes aiQuests from heroAiQuestsMap if missing', () => {
    const hero = store.getState().selectedHero;
    const testQuests = [{ id: 'q_restored_1', title: 'Restored Quest', coinReward: 20 }];
    store.state.heroAiQuestsMap = { [hero.id]: testQuests };
    delete store.state.selectedHero.aiQuests;

    // Simulate saving state with hero missing aiQuests field
    const rawState = JSON.stringify(store.state);
    const mockStorage = {
      getItem: () => rawState,
      setItem: () => {}
    };
    global.localStorage = mockStorage;

    store.loadState();
    assert.ok(store.getState().selectedHero.aiQuests?.length > 0, 'loadState must restore aiQuests from heroAiQuestsMap');
    assert.strictEqual(store.getState().selectedHero.aiQuests[0].id, 'q_restored_1');
  });

  console.log(`\n=========================================`);
  console.log(`Results: ${passedTests} passed, 0 failed (${totalTests} total)`);
  console.log(`=========================================\n`);
}

runAll().catch(err => {
  console.error('\n❌ Verification script encountered an error:', err);
  process.exit(1);
});
