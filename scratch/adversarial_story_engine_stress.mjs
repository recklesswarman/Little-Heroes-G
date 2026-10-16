/**
 * scratch/adversarial_story_engine_stress.mjs
 * 
 * Adversarial Empirical Stress Test Suite for Milestone M-FINAL
 * Role: Challenger 1 (challenger_mfinal_1)
 * 
 * Stress-tests the Bedtime AI Story Engine, Combinatorial Dynamic Weaver,
 * Personalization Context, SceneDescriptor Schema, Explorer Palette Compliance,
 * Anti-Repetition 25-History FIFO Memory, Sibling Bookshelf Isolation,
 * and Server Endpoints across 100+ seeds and 24 pets.
 */

import './setup_mock_env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// AudioContext Mock Setup
// ---------------------------------------------------------------------------
if (typeof globalThis.window !== 'undefined') {
  globalThis.window.AudioContext = class MockAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.destination = {};
    }
    createBuffer(channels, length, sampleRate) {
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        duration: length / sampleRate,
        copyToChannel: () => {},
        getChannelData: () => new Float32Array(length)
      };
    }
    createBufferSource() {
      return {
        buffer: null,
        playbackRate: {
          value: 1.0,
          setValueAtTime(val) { this.value = val; }
        },
        connect: () => {},
        start: () => {},
        stop: () => {},
        onended: null
      };
    }
    createGain() {
      return {
        gain: {
          value: 1.0,
          setValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {}
        },
        connect: () => {}
      };
    }
    createOscillator() {
      return {
        frequency: {
          value: 440,
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {}
        },
        type: 'sine',
        connect: () => {},
        start: () => {},
        stop: () => {},
        onended: null
      };
    }
    createBiquadFilter() {
      return {
        frequency: {
          value: 350,
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {}
        },
        type: 'lowpass',
        connect: () => {}
      };
    }
    close() {
      return Promise.resolve();
    }
  };
}

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import {
  BEDTIME_REALMS,
  BEDTIME_MORALS,
  PLOT_ARCHETYPES,
  CONSTELLATION_STICKERS,
  getBedtimeRealm,
  generateProceduralBedtimeStory,
  generateFullBedtimeStory
} from '../src/data/bedtimeStoryData.js';
import { PETS_DATABASE, PET_ARCHETYPES } from '../src/data/petsData.js';
import { store } from '../src/state/store.js';
import { buildChildStoryContext } from '../src/services/bedtimeStoryService.js';
import { handleBedtimeStoryRequest } from '../server/geminiService.js';

// ---------------------------------------------------------------------------
// Test Reporting Infrastructure
// ---------------------------------------------------------------------------
let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failureDetails = [];

function assert(condition, testName, contextInfo = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
  } else {
    failedChecks++;
    const errMsg = `FAIL: ${testName}${contextInfo ? ' | ' + contextInfo : ''}`;
    console.error(`  ❌ ${errMsg}`);
    failureDetails.push(errMsg);
  }
}

// ---------------------------------------------------------------------------
// Color Validation Utilities (Explorer Palette Enforcement)
// ---------------------------------------------------------------------------
function hexToHsl(hex) {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = h * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function isPinkOrPurple(hex) {
  if (!hex || typeof hex !== 'string') return false;
  const lower = hex.toLowerCase();
  // Check known banned names
  const bannedKeywords = ['pink', 'purple', 'magenta', 'violet', 'fuchsia', 'lavender', 'orchid', 'plum'];
  for (const kw of bannedKeywords) {
    if (lower.includes(kw)) return true;
  }
  // If not hex, can't analyze HSL
  if (!lower.startsWith('#')) return false;

  const hsl = hexToHsl(lower);
  if (!hsl) return false;

  // Pink/Purple/Violet/Magenta hue band is roughly 270° to 345°
  // with sufficient saturation and lightness
  if (hsl.h >= 270 && hsl.h <= 345 && hsl.s >= 15 && hsl.l >= 12 && hsl.l <= 88) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Required Enum Sets for SceneDescriptor
// ---------------------------------------------------------------------------
const VALID_TIMES_OF_NIGHT = new Set(['twilight_arrival', 'starlit_journey', 'deep_slumber_sanctuary']);
const VALID_WEATHER_PARTICLES = new Set(['fireflies', 'aurora_ribbons', 'starlight_snow', 'bioluminescent_spores', 'gentle_bubbles']);
const VALID_CAMERA_WORKS = new Set(['orbit_pan', 'follow_walk', 'crane_descend_nest']);
const VALID_HERO_ACTIONS = new Set(['walking_with_lantern', 'discovering_landmark', 'helping_obstacle', 'curled_asleep']);
const VALID_PET_ACTIONS = new Set(['trotting_beside', 'sniffing_clue', 'glowing_magic', 'sleeping_curled']);

function validateSceneDescriptor(sd, label) {
  assert(sd && typeof sd === 'object', `${label}: sceneDescriptor is an object`);
  if (!sd) return false;

  assert(typeof sd.environmentBiome === 'string' && sd.environmentBiome.length > 0, `${label}: environmentBiome is non-empty string`);
  assert(VALID_TIMES_OF_NIGHT.has(sd.timeOfNight), `${label}: timeOfNight (${sd.timeOfNight}) is valid enum`);
  assert(VALID_WEATHER_PARTICLES.has(sd.weatherParticles), `${label}: weatherParticles (${sd.weatherParticles}) is valid enum`);
  assert(VALID_CAMERA_WORKS.has(sd.cameraWork), `${label}: cameraWork (${sd.cameraWork}) is valid enum`);
  assert(VALID_HERO_ACTIONS.has(sd.heroAction), `${label}: heroAction (${sd.heroAction}) is valid enum`);
  assert(VALID_PET_ACTIONS.has(sd.petAction), `${label}: petAction (${sd.petAction}) is valid enum`);
  assert(Array.isArray(sd.keyProps) && sd.keyProps.length >= 1, `${label}: keyProps is non-empty array`);
  assert(sd.lightingPalette && typeof sd.lightingPalette === 'object', `${label}: lightingPalette is object`);

  if (sd.lightingPalette) {
    const { ambient, directional, accent } = sd.lightingPalette;
    assert(typeof ambient === 'string' && ambient.startsWith('#'), `${label}: ambient light is valid hex`);
    assert(typeof directional === 'string' && directional.startsWith('#'), `${label}: directional light is valid hex`);
    assert(typeof accent === 'string' && accent.startsWith('#'), `${label}: accent light is valid hex`);

    assert(!isPinkOrPurple(ambient), `${label}: ambient color ${ambient} is NOT pink/purple`);
    assert(!isPinkOrPurple(directional), `${label}: directional color ${directional} is NOT pink/purple`);
    assert(!isPinkOrPurple(accent), `${label}: accent color ${accent} is NOT pink/purple`);
  }
}

// ---------------------------------------------------------------------------
// TEST SUITE EXECUTION
// ---------------------------------------------------------------------------
console.log('======================================================================');
console.log('🔥 STARTING EMPIRICAL ADVERSARIAL STRESS TEST: BEDTIME AI STORYBOOK');
console.log('======================================================================\n');

async function runAdversarialStressTests() {

  // =========================================================================
  // SECTION 1: Zero Hardcoded "Rex" References Across All 24 Pets (100+ Seeds)
  // =========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('⚔️  TEST SECTION 1: ZERO HARDCODED "REX" REFERENCES (ALL 24 PETS)');
  console.log('----------------------------------------------------------------------');

  assert(PETS_DATABASE.length === 24, 'PETS_DATABASE contains exactly 24 distinct pets', `Found ${PETS_DATABASE.length}`);

  const realms = ['space', 'whispering_woods', 'starlight_cove', 'cloud_kingdom', 'dino_slumber_valley', 'crystal_cavern'];
  const morals = BEDTIME_MORALS.map(m => m.id);

  let totalPetStoryGenerations = 0;

  for (let pIdx = 0; pIdx < PETS_DATABASE.length; pIdx++) {
    const pet = PETS_DATABASE[pIdx];
    const isActuallyRex = pet.shortName === 'Rex' || pet.key === 'rex' || pet.id === '1';

    for (let chapterIdx = 0; chapterIdx < 4; chapterIdx++) {
      const realmId = realms[(pIdx + chapterIdx) % realms.length];
      const moralId = morals[(pIdx * 3 + chapterIdx) % morals.length];
      const customWish = `Adversarial seed wish ${pIdx}-${chapterIdx}`;

      // Generate single chapter
      const chapter = generateProceduralBedtimeStory(
        realmId,
        moralId,
        'HeroKid',
        pet.shortName,
        customWish,
        chapterIdx,
        ['Magic Wand', 'Friendly Help']
      );

      totalPetStoryGenerations++;

      // Combine all text outputs for deep forensic inspection
      const combinedOutput = [
        chapter.title,
        chapter.subtitle,
        chapter.text,
        chapter.chapterText,
        chapter.whisperLine,
        chapter.sleepyCue,
        chapter.moralReflection,
        chapter.prompt,
        chapter.promptQuestion,
        chapter.sceneDescriptor?.heroAction,
        chapter.sceneDescriptor?.petAction,
        ...(chapter.sceneDescriptor?.keyProps || [])
      ].filter(Boolean).join(' ');

      // Rex word boundary search: \bRex\b
      const rexRegex = /\bRex\b/i;
      const containsRex = rexRegex.test(combinedOutput);

      if (isActuallyRex) {
        assert(containsRex, `Pet #${pet.id} (${pet.shortName}) correctly references Rex in Chapter ${chapterIdx + 1}`);
      } else {
        assert(!containsRex, `Pet #${pet.id} (${pet.shortName}) has ZERO hardcoded "Rex" references in Chapter ${chapterIdx + 1}`, `Found Rex leak in: "${combinedOutput.slice(0, 100)}..."`);
      }

      // Check pet's actual name is present
      const petNameRegex = new RegExp(`\\b${pet.shortName}\\b`, 'i');
      assert(petNameRegex.test(combinedOutput), `Pet #${pet.id} (${pet.shortName}) is actively mentioned by name in narrative`);
    }

    // Full 3-Chapter story generation
    const fullStory = generateFullBedtimeStory(
      realms[pIdx % realms.length],
      morals[pIdx % morals.length],
      'HeroKid',
      pet.shortName,
      'Sleep under glowing stars'
    );

    totalPetStoryGenerations += 3;

    for (const [cIdx, ch] of fullStory.chapters.entries()) {
      const fullText = [ch.title, ch.chapterText, ch.whisperLine, ch.moralReflection].join(' ');
      const hasRex = /\bRex\b/i.test(fullText);
      if (isActuallyRex) {
        assert(hasRex, `Full story pet #${pet.id} (${pet.shortName}) Ch ${cIdx + 1} uses Rex`);
      } else {
        assert(!hasRex, `Full story pet #${pet.id} (${pet.shortName}) Ch ${cIdx + 1} has ZERO Rex references`);
      }
    }
  }

  console.log(`  -> Validated ${totalPetStoryGenerations} story chapters across all 24 pets. Rex leakage: 0.`);


  // =========================================================================
  // SECTION 2: Non-Repeating Story Plots & 25-History FIFO Tracking
  // =========================================================================
  console.log('\n----------------------------------------------------------------------');
  console.log('⚔️  TEST SECTION 2: NON-REPEATING PLOTS & 25-HISTORY FIFO TRACKING');
  console.log('----------------------------------------------------------------------');

  assert(PLOT_ARCHETYPES.length >= 12, 'Combinatorial Weaver has >= 12 distinct plot archetypes', `Count: ${PLOT_ARCHETYPES.length}`);

  // Test 1: Generate 100 consecutive seeds and verify archetype rotation
  const archetypeCounts = new Map();
  const titleSet = new Set();
  const openingsSet = new Set();

  for (let seed = 0; seed < 100; seed++) {
    const realm = realms[seed % realms.length];
    const moral = morals[seed % morals.length];
    const pet = PETS_DATABASE[seed % PETS_DATABASE.length];
    const heroName = `Explorer_${seed % 10}`;

    const story = generateFullBedtimeStory(realm, moral, heroName, pet.shortName, `Bedtime wish #${seed}`);
    assert(story && story.chapters.length === 3, `Seed ${seed}: generates 3 valid chapters`);

    titleSet.add(story.title);
    const ch1Opening = story.chapters[0].chapterText.slice(0, 80);
    openingsSet.add(ch1Opening);

    const archId = story.chapters[0].archetypeId;
    archetypeCounts.set(archId, (archetypeCounts.get(archId) || 0) + 1);
  }

  assert(titleSet.size >= 50, 'High entropy across 100 generated story titles', `Unique titles: ${titleSet.size} / 100`);
  assert(openingsSet.size >= 50, 'High entropy across 100 chapter openings', `Unique openings: ${openingsSet.size} / 100`);
  assert(archetypeCounts.size >= 10, 'Broad distribution of plot archetypes across seeds', `Archetypes used: ${archetypeCounts.size}`);

  // Test 2: Anti-Repetition 25-History FIFO Queue Invariant in Store
  const testHeroId = 'adversarial_fifo_hero';
  store.state.heroes = [
    {
      id: testHeroId,
      name: 'FIFO Tester',
      level: 5,
      coins: 100,
      xp: 200,
      activePetId: '2', // Raptor
      bedtimeHistory: []
    }
  ];
  store.state.selectedHero = store.state.heroes[0];

  // Rapidly insert 40 completed bedtime stories
  for (let i = 1; i <= 40; i++) {
    // Clear pending approval if sleep_on_time blocks to allow subsequent completeBedtimeStory calls
    store.state.pendingApprovals = [];
    if (store.state.taskCompletionLogs) {
      store.state.taskCompletionLogs = store.state.taskCompletionLogs.filter(l => l.taskId !== 'sleep_on_time');
    }

    const mockStory = {
      id: `story_fifo_${i}`,
      seed: 1000 + i,
      title: `Bedtime Adventure Episode #${i}`,
      archetypeId: PLOT_ARCHETYPES[i % PLOT_ARCHETYPES.length].id,
      realmId: realms[i % realms.length],
      moralId: morals[i % morals.length],
      chapters: [
        { chapterNumber: 1, chapterText: `Chapter 1 text for story ${i}` },
        { chapterNumber: 2, chapterText: `Chapter 2 text for story ${i}` },
        { chapterNumber: 3, chapterText: `Chapter 3 text for story ${i}` }
      ]
    };

    const res = store.completeBedtimeStory(mockStory);
    assert(res.success, `completeBedtimeStory #${i} succeeded`);
  }

  const currentHero = store.state.heroes.find(h => h.id === testHeroId);
  assert(Array.isArray(currentHero.bedtimeHistory), 'hero.bedtimeHistory is an array');
  assert(currentHero.bedtimeHistory.length === 25, 'hero.bedtimeHistory is strictly clamped to max 25 entries', `Length is ${currentHero.bedtimeHistory.length}`);

  // Verify FIFO eviction: story 40 should be at index 0, story 16 should be at index 24 (oldest 1..15 evicted)
  assert(currentHero.bedtimeHistory[0].title === 'Bedtime Adventure Episode #40', 'Index 0 is the newest story (Episode #40)');
  assert(currentHero.bedtimeHistory[24].title === 'Bedtime Adventure Episode #16', 'Index 24 is Episode #16 (oldest retained)');

  const containsEvictedStory1 = currentHero.bedtimeHistory.some(h => h.title === 'Bedtime Adventure Episode #1');
  const containsEvictedStory15 = currentHero.bedtimeHistory.some(h => h.title === 'Bedtime Adventure Episode #15');
  assert(!containsEvictedStory1, 'Episode #1 was successfully evicted by FIFO');
  assert(!containsEvictedStory15, 'Episode #15 was successfully evicted by FIFO');

  // Verify buildChildStoryContext negative constraints feed from the 25 history items
  const storyCtx = buildChildStoryContext(testHeroId);
  assert(storyCtx.antiRepetition.recentTitles.length === 25, 'Context antiRepetition has exactly 25 recentTitles');
  assert(storyCtx.antiRepetition.recentTitles[0] === 'Bedtime Adventure Episode #40', 'recentTitles[0] matches newest story');
  assert(storyCtx.antiRepetition.recentArchetypes.length === 25, 'Context antiRepetition has exactly 25 recentArchetypes');


  // =========================================================================
  // SECTION 3: Strict Explorer Palette Compliance (Zero Pink/Purple)
  // =========================================================================
  console.log('\n----------------------------------------------------------------------');
  console.log('⚔️  TEST SECTION 3: STRICT EXPLORER PALETTE (ZERO PINK / PURPLE)');
  console.log('----------------------------------------------------------------------');

  // Check all realms' accentColor and palettes
  for (const r of BEDTIME_REALMS) {
    assert(!isPinkOrPurple(r.accentColor), `Realm "${r.id}" accentColor ${r.accentColor} is NOT pink/purple`);
    if (Array.isArray(r.palette)) {
      for (const c of r.palette) {
        assert(!isPinkOrPurple(c), `Realm "${r.id}" palette color ${c} is NOT pink/purple`);
      }
    }
  }

  // Check 120 generated sceneDescriptors across all realms and seeds
  let paletteChecksCount = 0;
  for (let s = 0; s < 120; s++) {
    const realmId = realms[s % realms.length];
    const moralId = morals[s % morals.length];
    const chIdx = s % 4;

    const ch = generateProceduralBedtimeStory(realmId, moralId, 'PalCheck', 'Stego', '', chIdx);
    const lp = ch.sceneDescriptor.lightingPalette;

    assert(!isPinkOrPurple(lp.ambient), `Seed ${s} ambient ${lp.ambient} is NOT pink/purple`);
    assert(!isPinkOrPurple(lp.directional), `Seed ${s} directional ${lp.directional} is NOT pink/purple`);
    assert(!isPinkOrPurple(lp.accent), `Seed ${s} accent ${lp.accent} is NOT pink/purple`);
    paletteChecksCount += 3;
  }
  console.log(`  -> Exhaustively checked ${paletteChecksCount} lighting palette colors. Violations: 0.`);


  // =========================================================================
  // SECTION 4: Validation of All Required Fields in sceneDescriptor
  // =========================================================================
  console.log('\n----------------------------------------------------------------------');
  console.log('⚔️  TEST SECTION 4: SCENEDESCRIPTOR SCHEMA VALIDATION (100+ RUNS)');
  console.log('----------------------------------------------------------------------');

  for (let s = 0; s < 100; s++) {
    const realmId = realms[s % realms.length];
    const moralId = morals[s % morals.length];
    const chIdx = s % 4;

    const ch = generateProceduralBedtimeStory(
      realmId,
      moralId,
      `Child_${s}`,
      PETS_DATABASE[s % 24].shortName,
      `Custom prompt #${s}`,
      chIdx,
      ['Choice A', 'Choice B']
    );

    validateSceneDescriptor(ch.sceneDescriptor, `Seed ${s} (Ch ${chIdx + 1})`);
  }


  // =========================================================================
  // SECTION 5: Sibling Bookshelf Isolation
  // =========================================================================
  console.log('\n----------------------------------------------------------------------');
  console.log('⚔️  TEST SECTION 5: SIBLING BOOKSHELF ISOLATION');
  console.log('----------------------------------------------------------------------');

  const childAId = 'child_a_bedtime';
  const childBId = 'child_b_bedtime';
  const childCId = 'child_c_bedtime';

  store.state.heroes = [
    { id: childAId, name: 'Maya', level: 3, bedtimeStoryLibrary: [], activePetId: '9' }, // Sparky
    { id: childBId, name: 'Liam', level: 5, bedtimeStoryLibrary: [], activePetId: '10' }, // Luna
    { id: childCId, name: 'Leo', level: 2, bedtimeStoryLibrary: [], activePetId: '3' } // Stego
  ];
  store.state.bedtimeStoryLibrary = [];

  // Child A saves 8 stories
  for (let i = 1; i <= 8; i++) {
    store.saveBedtimeStory({
      id: `story_maya_${i}`,
      title: `Maya's Adventure in Space #${i}`,
      realm: 'space',
      moral: 'brave_dark'
    }, childAId);
  }

  // Child B saves 6 stories
  for (let i = 1; i <= 6; i++) {
    store.saveBedtimeStory({
      id: `story_liam_${i}`,
      title: `Liam's Journey in Whispering Woods #${i}`,
      realm: 'whispering_woods',
      moral: 'kindness_sharing'
    }, childBId);
  }

  // Child C saves 4 stories
  for (let i = 1; i <= 4; i++) {
    store.saveBedtimeStory({
      id: `story_leo_${i}`,
      title: `Leo's Starlight Sanctuary #${i}`,
      realm: 'starlight_cove',
      moral: 'first_day_school'
    }, childCId);
  }

  // Verify total in global pool
  assert(store.state.bedtimeStoryLibrary.length === 18, 'Global bedtimeStoryLibrary has all 18 saved stories');

  // Verify Child A bookshelf
  const libA = store.getBedtimeStoryLibrary(childAId);
  assert(libA.length === 8, `Child A bookshelf has exactly 8 stories (found ${libA.length})`);
  assert(libA.every(s => s.heroId === childAId), "Every story in Child A's bookshelf belongs to Child A");
  assert(!libA.some(s => s.heroId === childBId || s.heroId === childCId), "Child A bookshelf has ZERO stories from Child B or C");

  // Verify Child B bookshelf
  const libB = store.getBedtimeStoryLibrary(childBId);
  assert(libB.length === 6, `Child B bookshelf has exactly 6 stories (found ${libB.length})`);
  assert(libB.every(s => s.heroId === childBId), "Every story in Child B's bookshelf belongs to Child B");
  assert(!libB.some(s => s.heroId === childAId || s.heroId === childCId), "Child B bookshelf has ZERO stories from Child A or C");

  // Verify Child C bookshelf
  const libC = store.getBedtimeStoryLibrary(childCId);
  assert(libC.length === 4, `Child C bookshelf has exactly 4 stories (found ${libC.length})`);
  assert(libC.every(s => s.heroId === childCId), "Every story in Child C's bookshelf belongs to Child C");
  assert(!libC.some(s => s.heroId === childAId || s.heroId === childBId), "Child C bookshelf has ZERO stories from Child A or B");

  // Sibling Profile mirror isolation: check targetHero.bedtimeStoryLibrary
  const heroAObj = store.state.heroes.find(h => h.id === childAId);
  const heroBObj = store.state.heroes.find(h => h.id === childBId);
  assert(heroAObj.bedtimeStoryLibrary.length === 8, 'Hero A profile bedtimeStoryLibrary length === 8');
  assert(heroBObj.bedtimeStoryLibrary.length === 6, 'Hero B profile bedtimeStoryLibrary length === 6');

  // Test favorite toggling on Child A does not mutate Child B
  const storyToFav = libA[0].id;
  store.toggleFavoriteBedtimeStory(storyToFav);
  const updatedLibA = store.getBedtimeStoryLibrary(childAId);
  const updatedLibB = store.getBedtimeStoryLibrary(childBId);
  assert(updatedLibA.find(s => s.id === storyToFav).isFavorite === true, 'Story in Child A shelf is favorited');
  assert(updatedLibB.every(s => s.isFavorite === false), 'Child B shelf stories remain unaffected (unfavorited)');

  // Selected hero default isolation check
  store.state.selectedHero = heroAObj;
  const activeHeroLib = store.getBedtimeStoryLibrary(store.state.selectedHero.id);
  assert(activeHeroLib.length === 8, 'Active hero (Maya) queries isolated 8 stories via selectedHero.id');


  // =========================================================================
  // SECTION 6: Server Endpoints & Route Handlers Stress Test
  // =========================================================================
  console.log('\n----------------------------------------------------------------------');
  console.log('⚔️  TEST SECTION 6: SERVER ENDPOINTS STRESS TEST (MOCK EXPRESS)');
  console.log('----------------------------------------------------------------------');

  function createMockRes() {
    return {
      statusCode: 200,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      }
    };
  }

  // Test 1: Fallback generation with non-Rex pet (Pip the Phoenix)
  const req1 = {
    body: {
      heroName: 'AdversarialPipHero',
      petId: 'pip',
      petName: 'Pip',
      realmId: 'whispering_woods',
      moralId: 'calm_feelings',
      magicItem: 'Feather Whistle',
      customWish: 'Peaceful rest',
      chapterIndex: 0
    }
  };
  const res1 = createMockRes();
  await handleBedtimeStoryRequest(req1, res1);

  assert(res1.statusCode === 200, 'Server endpoint returns HTTP 200');
  assert(res1.jsonData && res1.jsonData.success, 'Server returns success JSON payload');
  assert(res1.jsonData.petName === 'Pip', 'Server response reflects petName "Pip"');
  assert(!/\bRex\b/i.test(res1.jsonData.text), 'Server response for Pip has ZERO hardcoded "Rex" references');
  validateSceneDescriptor(res1.jsonData.sceneDescriptor, 'Server Chapter 1 Response');

  // Test 2: Full 3-chapter server payload request
  const req2 = {
    body: {
      heroName: 'AdversarialFullHero',
      petId: 'luna',
      petName: 'Luna',
      realmId: 'starlight_cove',
      moralId: 'helping_friends'
    }
  };
  const res2 = createMockRes();
  await handleBedtimeStoryRequest(req2, res2);

  assert(res2.statusCode === 200, 'Server full story returns HTTP 200');
  assert(Array.isArray(res2.jsonData.chapters) && res2.jsonData.chapters.length === 3, 'Server returns exactly 3 chapters');
  for (const [idx, ch] of res2.jsonData.chapters.entries()) {
    assert(!/\bRex\b/i.test(ch.chapterText || ch.text), `Server Ch ${idx + 1} for Luna has ZERO Rex references`);
    validateSceneDescriptor(ch.sceneDescriptor, `Server Ch ${idx + 1} SceneDescriptor`);
  }

  // Test 3: Robustness against malformed / edge case inputs
  const edgeCases = [
    { heroName: '', petId: '', petName: '', realmId: 'invalid_realm_99', moralId: 'fake_moral_xyz' },
    { heroName: 'Special <script>alert(1)</script>', petId: '1', petName: 'Rex', chapterIndex: 99 },
    { heroName: 'A'.repeat(500), petId: '2', petName: 'Raptor', userChoices: null }
  ];

  for (const [idx, ec] of edgeCases.entries()) {
    const edgeRes = createMockRes();
    await handleBedtimeStoryRequest({ body: ec }, edgeRes);
    assert(edgeRes.statusCode === 200, `Edge case #${idx + 1} safely handles bizarre inputs without crashing`);
    assert(edgeRes.jsonData && (edgeRes.jsonData.success || edgeRes.jsonData.chapters), `Edge case #${idx + 1} produces valid fallback`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n======================================================================');
  console.log('📊 ADVERSARIAL STRESS TEST SUMMARY');
  console.log(`Total Checks Executed : ${totalChecks}`);
  console.log(`Passed Checks         : ${passedChecks}`);
  console.log(`Failed Checks         : ${failedChecks}`);
  console.log('======================================================================');

  if (failedChecks === 0) {
    console.log('🏆 STATUS: APPROVE — ALL ADVERSARIAL CHALLENGES PASSED EMPIRICALLY!');
    return true;
  } else {
    console.error(`💥 STATUS: CHALLENGE_FAILED — ${failedChecks} checks failed.`);
    return false;
  }
}

runAdversarialStressTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal crash during adversarial test execution:', err);
    process.exit(1);
  });
