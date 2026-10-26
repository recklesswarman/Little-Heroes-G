import assert from 'assert';
import {
  BEDTIME_REALMS,
  EXTENDED_BEDTIME_REALMS,
  ALL_BEDTIME_REALMS,
  getBedtimeRealm,
  PLOT_ARCHETYPES,
  generateProceduralBedtimeStory,
  generateFullBedtimeStory,
  generateFallbackSvg
} from '../src/data/bedtimeStoryData.js';
import { store } from '../src/state/store.js';
import { buildChildStoryContext, bedtimeStoryService } from '../src/services/bedtimeStoryService.js';
import { handleBedtimeStoryRequest } from '../server/geminiService.js';
import { COMPANION_VOICE_PROFILES, normalizePetKey } from '../src/services/voiceService.js';
import { PETS_DATABASE } from '../src/data/petsData.js';

console.log('🧪 Starting Milestone M1 Verification Suite...\n');

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc} ->`, err.message);
    failed++;
  }
}

async function run() {
  console.log('--- 1. Canonical & Extended Realms Catalog ---');
  check('BEDTIME_REALMS has exactly 4 canonical realms (test invariant)', () => {
    assert.strictEqual(BEDTIME_REALMS.length, 4);
  });

  check('EXTENDED_BEDTIME_REALMS contains new rich realms', () => {
    const extendedIds = EXTENDED_BEDTIME_REALMS.map(r => r.id);
    assert.ok(extendedIds.includes('whispering_woods'), 'includes whispering_woods');
    assert.ok(extendedIds.includes('starlight_cove'), 'includes starlight_cove');
    assert.ok(extendedIds.includes('cloud_kingdom'), 'includes cloud_kingdom');
    assert.ok(extendedIds.includes('crystal_caverns'), 'includes crystal_caverns');
    assert.ok(extendedIds.includes('coral_sanctuary'), 'includes coral_sanctuary');
  });

  check('getBedtimeRealm resolves canonical and extended realms including aliases', () => {
    assert.strictEqual(getBedtimeRealm('space').id, 'space');
    assert.strictEqual(getBedtimeRealm('whispering_woods').id, 'whispering_woods');
    assert.strictEqual(getBedtimeRealm('crystal_caverns').id, 'crystal_caverns');
    assert.strictEqual(getBedtimeRealm('crystal_cavern').id, 'crystal_caverns');
    assert.strictEqual(BEDTIME_REALMS.find(r => r.id === 'cloud_kingdom').id, 'cloud_kingdom');
  });

  console.log('\n--- 2. Explorer Palette Strict Compliance (Zero Pink / Purple) ---');
  const FORBIDDEN_COLORS = ['#ec4899', '#a855f7', '#d946ef', '#c084fc', '#f43f5e', '#e879f9'];
  check('All realms strictly use Explorer Palette colors', () => {
    for (const realm of ALL_BEDTIME_REALMS) {
      const lowerAccent = (realm.accentColor || '').toLowerCase();
      const lowerGlow = (realm.glowColor || '').toLowerCase();
      assert.ok(!lowerAccent.includes('pink') && !lowerAccent.includes('purple'), `${realm.id} accent has no pink/purple`);
      assert.ok(!lowerGlow.includes('pink') && !lowerGlow.includes('purple'), `${realm.id} glow has no pink/purple`);
      for (const fc of FORBIDDEN_COLORS) {
        assert.notStrictEqual(lowerAccent, fc);
        assert.notStrictEqual(lowerGlow, fc);
      }
    }
  });

  console.log('\n--- 3. 12+ Plot Archetypes & Dynamic Sentence Builders ---');
  check('Catalog defines at least 12 distinct plot archetypes', () => {
    assert.ok(PLOT_ARCHETYPES.length >= 12, `Has ${PLOT_ARCHETYPES.length} archetypes (>= 12)`);
    const archetypeIds = new Set(PLOT_ARCHETYPES.map(a => a.id));
    assert.strictEqual(archetypeIds.size, PLOT_ARCHETYPES.length, 'All archetype IDs are unique');
  });

  console.log('\n--- 4. Combinatorial Dynamic Story Weaver & SceneDescriptor ---');
  check('generateProceduralBedtimeStory produces structured sceneDescriptor for all chapters', () => {
    for (let ch = 0; ch < 4; ch++) {
      const storyCh = generateProceduralBedtimeStory('space', 'brave_dark', 'Maya', 'Luna the Cat', 'sweet dreams', ch, ['Star Lantern']);
      assert.strictEqual(storyCh.chapterIndex, ch);
      assert.strictEqual(storyCh.chapterNumber, ch + 1);
      assert.ok(storyCh.sceneDescriptor, `Chapter ${ch + 1} has sceneDescriptor`);
      assert.ok(storyCh.sceneDescriptor.environmentBiome, 'has environmentBiome');
      assert.ok(['twilight_arrival', 'starlit_journey', 'deep_slumber_sanctuary'].includes(storyCh.sceneDescriptor.timeOfNight), 'valid timeOfNight');
      assert.ok(storyCh.sceneDescriptor.cameraWork, 'has cameraWork');
      assert.ok(storyCh.sceneDescriptor.heroAction, 'has heroAction');
      assert.ok(storyCh.sceneDescriptor.petAction, 'has petAction');
      assert.ok(Array.isArray(storyCh.sceneDescriptor.keyProps), 'keyProps is array');
      assert.ok(storyCh.sceneDescriptor.lightingPalette, 'has lightingPalette');
      assert.ok(storyCh.sceneDescriptor.lightingPalette.ambient, 'has ambient');
      assert.ok(storyCh.sceneDescriptor.lightingPalette.directional, 'has directional');
      assert.ok(storyCh.sceneDescriptor.lightingPalette.accent, 'has accent');
    }
  });

  console.log('\n--- 5. Zero Hardcoded "Rex" References for Non-Rex Pets ---');
  check('Zero mention of "Rex" when companion is Luna', () => {
    for (let ch = 0; ch < 4; ch++) {
      const storyCh = generateProceduralBedtimeStory('whispering_woods', 'helping_friends', 'Liam', 'Luna', '', ch);
      assert.ok(!storyCh.text.includes('Rex'), `Chapter ${ch + 1} must not contain "Rex" when companion is Luna`);
      assert.ok(storyCh.text.includes('Luna'), `Chapter ${ch + 1} contains "Luna"`);
      assert.ok(storyCh.text.includes('Liam'), `Chapter ${ch + 1} contains "Liam"`);
    }
  });

  console.log('\n--- 6. generateFullBedtimeStory 3-Chapter Payload ---');
  check('generateFullBedtimeStory outputs full 3-chapter payload conforming to PROJECT.md schema', () => {
    const fullStory = generateFullBedtimeStory('cloud_kingdom', 'calm_feelings', 'Noah', 'Sparky', 'peaceful rest');
    assert.strictEqual(fullStory.success, true);
    assert.strictEqual(fullStory.chapters.length, 3);
    assert.strictEqual(fullStory.realmId, 'cloud_kingdom');
    assert.strictEqual(fullStory.moralId, 'calm_feelings');
    assert.strictEqual(fullStory.heroName, 'Noah');
    assert.strictEqual(fullStory.petName, 'Sparky');

    fullStory.chapters.forEach((ch, idx) => {
      assert.strictEqual(ch.chapterIndex, idx);
      assert.strictEqual(ch.chapterNumber, idx + 1);
      assert.ok(ch.title, 'has title');
      assert.ok(ch.chapterText && ch.chapterText.length > 250, 'has rich chapterText');
      assert.ok(ch.whisperLine, 'has whisperLine');
      assert.ok(ch.sleepyCue, 'has sleepyCue');
      assert.ok(ch.moralReflection, 'has moralReflection');
      assert.ok(ch.sceneDescriptor, 'has sceneDescriptor');
    });
  });

  console.log('\n--- 7. Real-Time Per-Child Personalization & Context Builder ---');
  check('buildChildStoryContext integrates child profile, daytime habits, active pet, and anti-repetition', () => {
    const context = buildChildStoryContext(null, { realmId: 'crystal_caverns', moralId: 'honest_hero', customWish: 'brave at swim' });
    assert.ok(context.child, 'has child profile');
    assert.ok(context.child.name, 'has child name');
    assert.ok(context.daytimeAccomplishments, 'has daytime accomplishments');
    assert.ok(context.activePet, 'has active pet');
    assert.ok(context.activePet.name, 'active pet has name');
    assert.ok(context.gearAndChoices, 'has gear and choices');
    assert.ok(context.antiRepetition, 'has antiRepetition constraints');
    assert.ok(Array.isArray(context.antiRepetition.recentTitles), 'has recentTitles array');
  });

  console.log('\n--- 8. Distinct Per-Pet Kokoro Voice Casting (All 24 Companion Pets) ---');
  const makeRes = () => {
    const res = { statusCode: 200 };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; return res; };
    return res;
  };

  const makeReq = (body) => ({
    body,
    headers: {},
    socket: { remoteAddress: '127.0.0.1' }
  });

  check('COMPANION_VOICE_PROFILES has an entry (with a Kokoro voice id) for all 24 PETS_DATABASE pets', () => {
    for (const pet of PETS_DATABASE) {
      const profile = COMPANION_VOICE_PROFILES[normalizePetKey(pet.id)] || COMPANION_VOICE_PROFILES[pet.key];
      assert.ok(profile, `Missing voice profile for pet ${pet.id} (${pet.key})`);
      assert.ok(profile.kokoroVoice, `Pet ${pet.key} is missing a kokoroVoice id`);
    }
  });

  check('Distinct pets are cast to more than one voice (not all collapsed to a single universal voice)', () => {
    const uniqueVoices = new Set(PETS_DATABASE.map(pet => (COMPANION_VOICE_PROFILES[normalizePetKey(pet.id)] || {}).kokoroVoice));
    assert.ok(uniqueVoices.size > 1, `Expected more than one distinct voice across 24 pets, got ${uniqueVoices.size}`);
  });

  console.log('\n--- 9. Server Bedtime Story Endpoint (handleBedtimeStoryRequest) ---');
  await (async () => {
    const res = makeRes();
    await handleBedtimeStoryRequest(makeReq({
      heroName: 'Emma',
      petName: 'Pterry',
      petId: 'pterry',
      realmId: 'starlight_cove',
      moralId: 'trying_new_things',
      customWish: 'Emma swam across the pool'
    }), res);

    check('handleBedtimeStoryRequest returns valid 3-chapter payload with sceneDescriptor', () => {
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.chapters.length, 3);
      assert.strictEqual(res.body.heroName, 'Emma');
      assert.strictEqual(res.body.petName, 'Pterry');
      assert.ok(res.body.chapters[0].sceneDescriptor);
      assert.ok(!res.body.chapters[0].text.includes('Rex'), 'No Rex when Pterry is active');
    });
  })();

  console.log(`\n=========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`=========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
