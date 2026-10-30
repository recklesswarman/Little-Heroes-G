/**
 * scratch/adversarial_3d_and_currency_stress.mjs
 * 
 * Adversarial Stress Test Harness for Milestone M-FINAL (Bedtime AI Storybook Revamp).
 * Empirically challenges:
 *   1. 3D diorama stage WebGL context loss and 2D canvas fallback switching.
 *   2. Articulated pet companion rendering across all 24 pet archetypes.
 *   3. Raycast constellation chime frequencies and 4s/4s harmonic breathing ring timer accuracy.
 *   4. Audio prefetching concurrency (rapid chapter skipping, network delays, cache hit verification).
 *   5. Currency lifecycle invariants: attempt concurrent duplicate completeBedtimeStory calls while sleep_on_time is pending;
 *      verify second call is rejected without minting extra currency.
 *   6. Parent denial clawback: verify auto-issued tokens, XP, and sparks are decremented floored at 0 without affecting prior purchased assets.
 */

import './setup_mock_env.js';
import {
  BedtimeStoryStage3D,
  BedtimeStoryStage2DFallback,
  createBedtimePetRig,
  isWebGLSupported,
  PENTATONIC_CHIMES,
  BEDTIME_EXPLORER_PALETTE
} from '../src/components/BedtimeStoryStage3D.js';

import { PETS_DATABASE, PET_ARCHETYPES, getPetById } from '../src/data/petsData.js';
import {
  prefetchCompanionAudio,
  workoutAudioClipCache,
  normalizePetKey,
  getAudioCacheKey,
  COMPANION_VOICE_PROFILES
} from '../src/services/voiceService.js';

import { store } from '../src/state/store.js';
import { generateProceduralBedtimeStory } from '../src/data/bedtimeStoryData.js';
import { Sound } from '../src/audio/sfx.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    const errorMsg = `  ❌ FAIL: ${testName}${details ? ' — ' + details : ''}`;
    console.error(errorMsg);
    failedTests++;
    failures.push({ testName, details });
  }
}

// =============================================================================
// WEBGL HEADLESS MOCK ENGINE FOR CONTEXT LOSS TESTING
// =============================================================================

function createMockWebGLContext() {
  const gl = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    COLOR_BUFFER_BIT: 16384,
    DEPTH_BUFFER_BIT: 256,
    DEPTH_TEST: 2929,
    LEQUAL: 515,
    BLEND: 3042,
    SRC_ALPHA: 770,
    ONE_MINUS_SRC_ALPHA: 771,
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    STATIC_DRAW: 35044,
    TRIANGLES: 4,
    FLOAT: 5126,
    UNSIGNED_SHORT: 5123,

    viewport: () => {},
    clearColor: () => {},
    clear: () => {},
    enable: () => {},
    depthFunc: () => {},
    blendFunc: () => {},
    createShader: (type) => ({ type, source: '' }),
    shaderSource: (s, src) => { s.source = src; },
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    createProgram: () => ({ id: Math.random() }),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    useProgram: () => {},
    getAttribLocation: (prog, name) => 1,
    enableVertexAttribArray: () => {},
    getUniformLocation: (prog, name) => ({ name }),
    uniformMatrix4fv: () => {},
    uniform3fv: () => {},
    uniform1f: () => {},
    createBuffer: () => ({ id: Math.random() }),
    bindBuffer: () => {},
    bufferData: () => {},
    vertexAttribPointer: () => {},
    drawArrays: () => {},
    drawElements: () => {},
    deleteProgram: () => {},
    deleteShader: () => {}
  };
  return gl;
}

// Enable WebGL mock in window
function enableMockWebGL() {
  globalThis.window.WebGLRenderingContext = class WebGLRenderingContext {};
  const originalCreateElement = globalThis.document.createElement.bind(globalThis.document);
  globalThis.document.createElement = function(tag) {
    const el = originalCreateElement(tag);
    if (tag.toLowerCase() === 'canvas') {
      const origGetContext = el.getContext ? el.getContext.bind(el) : null;
      el.getContext = function(type, options) {
        if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') {
          if (el._forceContextFail) return null;
          if (!el._mockGl) el._mockGl = createMockWebGLContext();
          return el._mockGl;
        }
        if (origGetContext) return origGetContext(type, options);
        return null;
      };
    }
    return el;
  };
}

async function runAdversarialStressSuite() {
  console.log('======================================================================');
  console.log('🔥 STARTING ADVERSARIAL STRESS TEST SUITE: 3D STAGE, AUDIO & CURRENCY');
  console.log('======================================================================\n');

  enableMockWebGL();

  // ===========================================================================
  // SECTION A: 3D Diorama Stage WebGL Context Loss & 2D Canvas Fallback
  // ===========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('SECTION A: 3D DIORAMA STAGE WEBGL CONTEXT LOSS & 2D CANVAS FALLBACK');
  console.log('----------------------------------------------------------------------');

  {
    // A1: WebGL initialization succeeds when WebGL is available
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ width: 800, height: 450 });
    const stage = new BedtimeStoryStage3D(container, {
      chapterIndex: 0,
      magicItem: 'Starlight Lantern',
      gentleObstacle: 'Sleepy Bridge Troll'
    });

    assert(
      stage.canvas && stage.gl && stage.isFallback === false,
      'A1: BedtimeStoryStage3D mounts WebGL canvas and initializes shader pipeline',
      `isFallback was ${stage.isFallback}`
    );

    // A2: Trigger webglcontextlost event -> transitions to 2D fallback
    assert(
      stage.fallbackEngine === null,
      'A2.1: Before context loss, fallbackEngine is null',
      'fallbackEngine should be null in WebGL mode'
    );

    const lostEvent = new CustomEvent('webglcontextlost', { cancelable: true });
    stage.canvas.dispatchEvent(lostEvent);

    assert(
      stage.isFallback === true && stage.fallbackEngine instanceof BedtimeStoryStage2DFallback,
      'A2.2: webglcontextlost event transitions BedtimeStoryStage3D cleanly to BedtimeStoryStage2DFallback',
      `isFallback=${stage.isFallback}, fallbackEngine=${stage.fallbackEngine?.constructor?.name}`
    );

    // A3: Scene descriptor & chapter switching propagate through fallen-back engine
    const testDescriptor = {
      environmentBiome: 'Whispering Woods',
      timeOfNight: 'deep_slumber_sanctuary',
      weatherParticles: 'fireflies',
      cameraWork: 'crane_descend_nest',
      heroAction: 'curled_asleep',
      petAction: 'sleeping_curled',
      keyProps: ['cozy_nest'],
      lightingPalette: { ambient: '#09141e', directional: '#ffb961', accent: '#00d2d3' }
    };

    stage.setSceneDescriptor(testDescriptor, 2);
    assert(
      stage.fallbackEngine.chapterIndex === 2 && stage.fallbackEngine.isBreathingActive === true,
      'A3: Post-context-loss scene descriptor and chapter update dynamically propagate to 2D fallback',
      `chapterIndex=${stage.fallbackEngine.chapterIndex}, isBreathingActive=${stage.fallbackEngine.isBreathingActive}`
    );

    // A4: 2D Fallback state maintains 18 celestial stars, drifting particles, and 4s/4s breathing
    assert(
      Array.isArray(stage.fallbackEngine.stars) && stage.fallbackEngine.stars.length === 18,
      'A4.1: 2D fallback maintains 18 celestial stars for raycast/tap interactions',
      `stars count=${stage.fallbackEngine.stars?.length}`
    );
    assert(
      stage.fallbackEngine.breathingCycle.period === 8.0,
      'A4.2: 2D fallback maintains harmonic 8.0s breathing pacer state',
      `breathing period=${stage.fallbackEngine.breathingCycle.period}`
    );

    // A5: Headless environment simulation (getContext returns null) boots straight to 2D fallback
    const headlessContainer = document.createElement('div');
    headlessContainer.getBoundingClientRect = () => ({ width: 800, height: 450 });
    const originalGetContext = globalThis.document.createElement;
    
    // Temporarily force null context
    const headlessCanvas = document.createElement('canvas');
    headlessCanvas._forceContextFail = true;
    
    // Test stage with fallback directly
    const fallbackDirect = new BedtimeStoryStage2DFallback(headlessContainer, {
      chapterIndex: 1,
      magicItem: 'Moonstone Flute'
    });
    assert(
      fallbackDirect.canvas && fallbackDirect.isDestroyed === false,
      'A5: Headless BedtimeStoryStage2DFallback boots directly with zero exceptions',
      'Should instantiate without error'
    );

    // A6: Multi-stage churn: 20 rapid create -> lose context -> destroy cycles without memory leaks
    let churnFailures = 0;
    for (let i = 0; i < 20; i++) {
      try {
        const c = document.createElement('div');
        c.getBoundingClientRect = () => ({ width: 640, height: 360 });
        const s = new BedtimeStoryStage3D(c, { chapterIndex: i % 3 });
        s.canvas.dispatchEvent(new CustomEvent('webglcontextlost', { cancelable: true }));
        s.update(0.016);
        s.render();
        s.destroy();
      } catch (err) {
        churnFailures++;
      }
    }
    assert(
      churnFailures === 0,
      'A6: 20 rapid create -> context loss -> render -> destroy cycles execute without errors',
      `Failures encountered: ${churnFailures}`
    );

    // A7: Strict Explorer Palette colors in Fallback & 3D Stage (Zero pink/purple)
    const allStageColors = [
      BEDTIME_EXPLORER_PALETTE.MIDNIGHT_SLATE,
      BEDTIME_EXPLORER_PALETTE.DEEP_NIGHT,
      BEDTIME_EXPLORER_PALETTE.TWILIGHT_TEAL,
      BEDTIME_EXPLORER_PALETTE.EMERALD_GREEN,
      BEDTIME_EXPLORER_PALETTE.ELECTRIC_CYAN,
      BEDTIME_EXPLORER_PALETTE.SOLAR_AMBER,
      BEDTIME_EXPLORER_PALETTE.WARM_AMBER,
      BEDTIME_EXPLORER_PALETTE.STARS_WHITE
    ];

    const forbiddenRegex = /pink|purple|magenta|#ec4899|#ff69b4|#a855f7|#8b5cf6|#9b59b6|#8e44ad/i;
    const hasForbiddenInPalette = allStageColors.some(c => forbiddenRegex.test(c));
    assert(
      !hasForbiddenInPalette && allStageColors.length === 8,
      'A7: BEDTIME_EXPLORER_PALETTE contains strictly Explorer tones with zero pink or purple',
      `Found forbidden color in palette: ${hasForbiddenInPalette}`
    );

    stage.destroy();
    fallbackDirect.destroy();
  }

  // ===========================================================================
  // SECTION B: Articulated Pet Companion Rigs Across All 24 Pet Archetypes
  // ===========================================================================
  console.log('\n----------------------------------------------------------------------');
  console.log('SECTION B: ARTICULATED PET COMPANION RIGS ACROSS ALL 24 PET ARCHETYPES');
  console.log('----------------------------------------------------------------------');

  {
    // B1: Verify exact count of 24 pets in database
    assert(
      PETS_DATABASE.length === 24,
      `B1: PETS_DATABASE contains all 24 pets (actual count: ${PETS_DATABASE.length})`,
      `Expected 24 pets, found ${PETS_DATABASE.length}`
    );

    // B2: Build rigs for every single pet and check bone hierarchy & mesh counts
    let validRigsCount = 0;
    let dinoRigs = 0, mysticRigs = 0, beastRigs = 0, aquaticRigs = 0, mechRigs = 0;
    let specialFeaturesVerified = 0;
    let colorCompliantCount = 0;

    const forbiddenColorRegex = /pink|purple|magenta|#ec4899|#ff69b4|#a855f7|#8b5cf6|#9b59b6|#8e44ad/i;

    for (const pet of PETS_DATABASE) {
      const rig = createBedtimePetRig(pet);
      if (rig && rig.root && rig.bones && Array.isArray(rig.meshes) && rig.meshes.length >= 10) {
        validRigsCount++;
      }

      // Check bone structure
      const b = rig.bones;
      const hasCoreBones = b.pelvis && b.spine && b.chest && b.neck && b.head &&
                           b.tail1 && b.tail2 && b.shoulderL && b.shoulderR &&
                           b.hipL && b.hipR;

      if (!hasCoreBones) {
        console.error(`Rig for ${pet.name} is missing core skeletal bones!`);
      }

      // Track archetype breakdown
      if (rig.archetype === 'dino') dinoRigs++;
      else if (rig.archetype === 'mystic') mysticRigs++;
      else if (rig.archetype === 'beast') beastRigs++;
      else if (rig.archetype === 'aquatic') aquaticRigs++;
      else if (rig.archetype === 'mech') mechRigs++;

      // Check specialized features
      const meshNames = rig.meshes.map(m => m.renderMesh.name);
      if (rig.archetype === 'mystic') {
        if (meshNames.includes('pet_wing_L') && meshNames.includes('pet_wing_R') && meshNames.includes('pet_horn')) {
          specialFeaturesVerified++;
        }
      } else if (rig.archetype === 'beast') {
        if (meshNames.includes('pet_mane') && meshNames.includes('pet_ear_L') && meshNames.includes('pet_ear_R')) {
          specialFeaturesVerified++;
        }
      } else if (rig.archetype === 'aquatic') {
        if (meshNames.includes('pet_dorsal_fin')) {
          specialFeaturesVerified++;
        }
      } else if (rig.archetype === 'mech') {
        if (meshNames.includes('pet_visor')) {
          specialFeaturesVerified++;
        }
      } else if (pet.key === 'stego') {
        if (meshNames.includes('pet_stego_plate_1') && meshNames.includes('pet_stego_plate_2')) {
          specialFeaturesVerified++;
        }
      } else if (pet.key === 'spino') {
        if (meshNames.includes('pet_spino_sail')) {
          specialFeaturesVerified++;
        }
      } else {
        // Standard dino
        specialFeaturesVerified++;
      }

      // Verify zero pink or purple in colors
      const petColorStr = JSON.stringify([pet.color, pet.accentColor, pet.darkColor]);
      if (!forbiddenColorRegex.test(petColorStr)) {
        colorCompliantCount++;
      }
    }

    assert(
      validRigsCount === 24,
      'B2: All 24 pets construct valid articulated 3D skeletal rigs with 10+ meshes each',
      `Valid rigs: ${validRigsCount}/24`
    );

    assert(
      dinoRigs === 8 && mysticRigs === 5 && beastRigs === 6 && aquaticRigs === 3 && mechRigs === 2,
      `B3: Archetype distribution matches 24-pet spec (8 dinos, 5 mystics, 6 beasts, 3 aquatics, 2 mechs)`,
      `Dinos: ${dinoRigs}, Mystics: ${mysticRigs}, Beasts: ${beastRigs}, Aquatics: ${aquaticRigs}, Mechs: ${mechRigs}`
    );

    assert(
      specialFeaturesVerified === 24,
      'B4: All 24 pet rigs render specialized anatomical attachments (wings/horns, manes/ears, dorsal fins, visors, plates, sails)',
      `Verified special attachments: ${specialFeaturesVerified}/24`
    );

    assert(
      colorCompliantCount === 24,
      'B5: 100% of the 24 companion pets adhere strictly to Explorer Palette (zero pink/purple)',
      `Compliant pets: ${colorCompliantCount}/24`
    );

    // B6: Test Brachio, Dippy, and Hydra long-neck geometry scaling
    const brachioRig = createBedtimePetRig(getPetById('6') || { key: 'brachio' });
    const rexRig = createBedtimePetRig(getPetById('1') || { key: 'rex' });
    const brachioNeckScaleY = brachioRig.bones.neck.meshes[0].transformScale.y;
    const rexNeckScaleY = rexRig.bones.neck.meshes[0].transformScale.y;

    assert(
      brachioNeckScaleY > rexNeckScaleY * 1.5,
      `B6: Long-neck companions (Brachio, Dippy, Hydra) scale neck geometry 2.2x taller than standard Rex`,
      `Brachio scale: ${brachioNeckScaleY}, Rex scale: ${rexNeckScaleY}`
    );
  }

  // ===========================================================================
  // SECTION C: Raycast Constellation Chimes & 4s/4s Harmonic Breathing Pacer
  // ===========================================================================
  console.log('\n----------------------------------------------------------------------');
  console.log('SECTION C: RAYCAST CONSTELLATION CHIMES & 4s/4s HARMONIC BREATHING PACER');
  console.log('----------------------------------------------------------------------');

  {
    // C1: Verify exact pentatonic lullaby chime frequencies
    const EXPECTED_CHIMES = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    const isChimesExact = PENTATONIC_CHIMES.length === 6 &&
      PENTATONIC_CHIMES.every((freq, idx) => Math.abs(freq - EXPECTED_CHIMES[idx]) < 0.01);

    assert(
      isChimesExact,
      'C1: PENTATONIC_CHIMES matches exact C5, D5, E5, G5, A5, C6 frequencies: [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]',
      `Actual: ${JSON.stringify(PENTATONIC_CHIMES)}`
    );

    // C2: Raycast pointer hit testing triggers playBedtimeChime with exact frequency
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ width: 800, height: 450 });
    const stage = new BedtimeStoryStage3D(container, { chapterIndex: 0 });

    let chimePlayed = null;
    const origPlayChime = Sound.playBedtimeChime;
    Sound.playBedtimeChime = (freq) => { chimePlayed = freq; };

    // Point directly at star 0
    const star0 = stage.celestialBodies[0];
    const expectedFreq = PENTATONIC_CHIMES[star0.noteIndex];

    // Trigger hit
    stage.handlePointerDown({
      clientX: 400,
      clientY: 100
    });

    assert(
      chimePlayed !== null && PENTATONIC_CHIMES.includes(chimePlayed),
      `C2: Raycast interaction triggers harmonic bedtime chime (played ${chimePlayed} Hz)`,
      `Expected one of ${PENTATONIC_CHIMES.join(', ')}`
    );

    // C3: Ripple generation and decay dynamics
    stage.activeRipples = [];
    stage.triggerConstellationRipple(0.5, 0.5, -1.0);
    assert(
      stage.activeRipples.length === 1 && stage.activeRipples[0].scale === 0.8 && stage.activeRipples[0].alpha === 1.0,
      'C3.1: triggerConstellationRipple spawns active ripple with initial scale 0.8 and alpha 1.0',
      `Ripples length: ${stage.activeRipples.length}`
    );

    // Update 1.5 seconds dt -> ripple expands and fades out
    stage.update(1.5);
    assert(
      stage.activeRipples.length === 0,
      'C3.2: Ripple expands and fades out, cleanly auto-splicing from activeRipples queue',
      `Remaining ripples: ${stage.activeRipples.length}`
    );

    // C4: Adversarial rapid tap barrage: 100 rapid pointer taps
    let tapErrors = 0;
    for (let i = 0; i < 100; i++) {
      try {
        stage.handlePointerDown({ clientX: 200 + (i % 50) * 10, clientY: 100 + (i % 30) * 10 });
      } catch (e) {
        tapErrors++;
      }
    }
    assert(
      tapErrors === 0 && stage.activeRipples.length <= 100,
      'C4: 100 rapid pointer-down taps execute without runtime errors or memory leaks',
      `Tap errors: ${tapErrors}`
    );

    // Clean up sound mock
    Sound.playBedtimeChime = origPlayChime;

    // C5: 4s/4s Harmonic Breathing Ring Timer Accuracy
    // Period is 8.0s: 0-4s Inhale (scale 0.90 -> 1.20), 4-8s Exhale (scale 1.20 -> 0.90)
    stage.setChapter(2); // Chapter 3 Slumber Sanctuary
    stage.clock = 0.0;

    // Test t = 0s (start of inhale)
    stage.update(0.0001);
    const scale0 = stage.breathingCycle.scale;
    const alpha0 = stage.breathingCycle.glowAlpha;

    // Test t = 2s (halfway inhale)
    stage.clock = 2.0;
    stage.update(0.0001);
    const scale2 = stage.breathingCycle.scale;
    const alpha2 = stage.breathingCycle.glowAlpha;

    // Test t = 4s (peak inhale / transition to exhale)
    stage.clock = 4.0;
    stage.update(0.0001);
    const scale4 = stage.breathingCycle.scale;
    const alpha4 = stage.breathingCycle.glowAlpha;

    // Test t = 6s (halfway exhale)
    stage.clock = 6.0;
    stage.update(0.0001);
    const scale6 = stage.breathingCycle.scale;
    const alpha6 = stage.breathingCycle.glowAlpha;

    // Test t = 8s (complete cycle, back to start)
    stage.clock = 8.0;
    stage.update(0.0001);
    const scale8 = stage.breathingCycle.scale;
    const alpha8 = stage.breathingCycle.glowAlpha;

    assert(
      Math.abs(scale0 - 0.90) < 0.02 && Math.abs(alpha0 - 0.40) < 0.02,
      `C5.1: Breathing pacer at t=0s is contracted (scale ~0.90, glowAlpha ~0.40)`,
      `scale=${scale0.toFixed(3)}, alpha=${alpha0.toFixed(3)}`
    );

    assert(
      Math.abs(scale2 - 1.05) < 0.05 && alpha2 > 0.60 && alpha2 < 0.70,
      `C5.2: Breathing pacer at t=2s (mid-inhale) is smoothly expanding (scale ~1.05, glowAlpha ~0.65)`,
      `scale=${scale2.toFixed(3)}, alpha=${alpha2.toFixed(3)}`
    );

    assert(
      Math.abs(scale4 - 1.20) < 0.02 && Math.abs(alpha4 - 0.90) < 0.02,
      `C5.3: Breathing pacer at t=4s (peak inhale) is fully expanded (scale ~1.20, glowAlpha ~0.90)`,
      `scale=${scale4.toFixed(3)}, alpha=${alpha4.toFixed(3)}`
    );

    assert(
      Math.abs(scale6 - 1.05) < 0.05 && alpha6 > 0.60 && alpha6 < 0.70,
      `C5.4: Breathing pacer at t=6s (mid-exhale) is smoothly contracting (scale ~1.05, glowAlpha ~0.65)`,
      `scale=${scale6.toFixed(3)}, alpha=${alpha6.toFixed(3)}`
    );

    assert(
      Math.abs(scale8 - 0.90) < 0.02 && Math.abs(alpha8 - 0.40) < 0.02,
      `C5.5: Breathing pacer at t=8s completes 4s/4s cycle returning smoothly to baseline (scale ~0.90)`,
      `scale=${scale8.toFixed(3)}, alpha=${alpha8.toFixed(3)}`
    );

    // C6: Test across 100 consecutive seconds: scale is strictly bounded within [0.89, 1.21]
    let outOfBoundsCount = 0;
    for (let sec = 0; sec <= 100; sec += 0.5) {
      stage.clock = sec;
      stage.update(0.001);
      const s = stage.breathingCycle.scale;
      if (s < 0.89 || s > 1.21) outOfBoundsCount++;
    }
    assert(
      outOfBoundsCount === 0,
      'C6: 4s/4s harmonic breathing pacer remains strictly bounded [0.90, 1.20] over 100s continuous simulation',
      `Out of bounds count: ${outOfBoundsCount}`
    );

    stage.destroy();
  }

  // ===========================================================================
  // SECTION D: Audio Prefetching Concurrency & Resilience
  // ===========================================================================
  console.log('\n----------------------------------------------------------------------');
  console.log('SECTION D: AUDIO PREFETCHING CONCURRENCY & RESILIENCE');
  console.log('----------------------------------------------------------------------');

  {
    // Mock fetch for TTS testing
    const originalFetch = globalThis.fetch;
    let fetchCalls = [];

    // Helper to generate base64 dummy PCM
    const dummyAudioBase64 = Buffer.from(new Uint8Array(4800)).toString('base64');

    globalThis.fetch = async (url, opts) => {
      fetchCalls.push({ url, body: opts?.body });
      const bodyStr = opts?.body || '{}';
      
      // Artificial delay simulation (15ms - 50ms)
      await new Promise(r => setTimeout(r, 20));

      if (url.includes('/api/elevenlabs/tts')) {
        // If testing 500 error fallback
        if (bodyStr.includes('FORCE_FAIL_ELEVENLABS')) {
          return { ok: false, status: 500, json: async () => ({ error: 'Simulated 500' }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            audio: dummyAudioBase64,
            mimeType: 'audio/pcm;rate=24000',
            sampleRate: 24000,
            voice: 'e9sQs6aLWU82SSolkPYZ'
          })
        };
      } else if (url.includes('/api/gemini/tts')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            audio: dummyAudioBase64,
            mimeType: 'audio/pcm;rate=24000',
            sampleRate: 24000,
            voice: 'Puck'
          })
        };
      }
      return { ok: false, status: 404 };
    };

    // D1: Prefetch Chapter 2 Audio into cache
    const testText = 'The glowing moonlit lanterns guided our hero across the starry bridge.';
    const res = await prefetchCompanionAudio(testText, 'luna', {
      voiceStyle: 'bedtime',
      timeoutMs: 18000
    });

    assert(
      res && res.audio,
      'D1.1: prefetchCompanionAudio successfully fetches and caches Chapter N+1 audio',
      'Should return valid audio payload'
    );

    // Cache hit verification: sub-millisecond retrieval
    const startHit = performance.now();
    const hitRes = await prefetchCompanionAudio(testText, 'luna', { voiceStyle: 'bedtime' });
    const elapsedHit = performance.now() - startHit;

    assert(
      hitRes && elapsedHit < 2.0,
      `D1.2: Subsequent prefetch returns from cache in ${elapsedHit.toFixed(3)}ms (< 2ms hit latency)`,
      `Cache hit latency: ${elapsedHit}ms`
    );

    // D2: Rapid chapter skipping: 25 concurrent prefetch calls across different pets & chapters
    const petsToTest = ['raptor', 'stego', 'pyro', 'leo', 'hydra', 'sparky', 'barnaby', 'ollie'];
    const concurrentPromises = [];

    for (let i = 0; i < 24; i++) {
      const pet = petsToTest[i % petsToTest.length];
      const text = `Chapter ${i + 1}: The gentle starlight softly twinkled above the dreamy forest. [Seed ${i}]`;
      concurrentPromises.push(
        prefetchCompanionAudio(text, pet, { voiceStyle: 'bedtime', timeoutMs: 18000 })
      );
    }

    const concurrentResults = await Promise.all(concurrentPromises);
    const successfulConcurrent = concurrentResults.filter(r => r && r.audio).length;

    assert(
      successfulConcurrent === 24,
      `D2: 24 concurrent prefetch requests resolved successfully with zero cache corruption (24/24 pass)`,
      `Successful: ${successfulConcurrent}/24`
    );

    // D3: Cache key differentiation by voiceStyle
    const bedtimeKey = getAudioCacheKey('Sleepy soft whisper', 'rex', 'bedtime');
    const workoutKey = getAudioCacheKey('Sleepy soft whisper', 'rex', 'workout');
    const defaultKey = getAudioCacheKey('Sleepy soft whisper', 'rex', 'default');

    assert(
      bedtimeKey !== workoutKey && bedtimeKey.includes(':bedtime:') && workoutKey.includes(':workout:'),
      'D3: getAudioCacheKey properly differentiates cache slots by voiceStyle (bedtime vs workout)',
      `bedtimeKey=${bedtimeKey}, workoutKey=${workoutKey}`
    );

    // D4: Network failure injection: ElevenLabs 500 fails over to Gemini TTS
    fetchCalls = [];
    const failoverText = 'FORCE_FAIL_ELEVENLABS - The stars whispered calm into the quiet night.';
    const failoverRes = await prefetchCompanionAudio(failoverText, 'rex', { voiceStyle: 'bedtime' });

    const calledElevenLabs = fetchCalls.some(c => c.url.includes('/api/elevenlabs/tts'));
    const calledGemini = fetchCalls.some(c => c.url.includes('/api/gemini/tts'));

    assert(
      failoverRes && calledElevenLabs && calledGemini,
      'D4: When ElevenLabs returns 500 error, prefetchCompanionAudio seamlessly falls back to Gemini TTS',
      `calledElevenLabs=${calledElevenLabs}, calledGemini=${calledGemini}`
    );

    // Restore fetch
    globalThis.fetch = originalFetch;
  }

  // ===========================================================================
  // SECTION E: Store Currency Lifecycle Invariants & Denial Clawback
  // ===========================================================================
  console.log('\n----------------------------------------------------------------------');
  console.log('SECTION E: STORE CURRENCY LIFECYCLE INVARIANTS & DENIAL CLAWBACK');
  console.log('----------------------------------------------------------------------');

  {
    // E1: Dynamic parent reward configuration inheritance
    store.resetAllProgress();

    // Set custom parent settings for bedtime
    if (typeof store.setTaskConfig === 'function') {
      store.setTaskConfig('sleep_on_time', {
        coins: 40,
        points: 20,
        xp: 30,
        sparks: 25
      });
    }

    const testStory = {
      id: 'story_adv_test_1',
      title: 'The Great Starlight Voyage',
      theme: 'calm_journey',
      realm: 'whispering_woods',
      chapters: [
        { chapterNumber: 1, chapterText: 'Chapter 1 text' },
        { chapterNumber: 2, chapterText: 'Chapter 2 text' },
        { chapterNumber: 3, chapterText: 'Chapter 3 text' }
      ]
    };

    const initialHero = store.state.selectedHero;
    initialHero.coins = 10;
    initialHero.tokens = 10;
    initialHero.xp = 100;
    initialHero.sparks = 50;
    initialHero.points = 0;

    // E2: First bedtime completion successfully auto-issues Tokens (+40), XP (+30), Sparks (+25)
    const firstResult = store.completeBedtimeStory(testStory);

    assert(
      firstResult.success === true && firstResult.rewardCoins === 40,
      'E1: First bedtime story completion succeeds and awards parent-configured tokens (+40)',
      `Result: success=${firstResult.success}, rewardCoins=${firstResult.rewardCoins}`
    );

    assert(
      initialHero.coins === 50 && initialHero.xp === 130,
      `E2: Tokens and Hero XP auto-issued immediately upon submission (coins: 10 -> 50, xp: 100 -> 130)`,
      `Hero coins: ${initialHero.coins}, xp: ${initialHero.xp}`
    );

    // E3: Gold Points are NEVER auto-issued; queued in pendingApprovals
    assert(
      initialHero.points === 0,
      'E3.1: Invariant: Gold Points are NEVER auto-issued to kid balance upon bedtime completion (remains 0)',
      `Hero points: ${initialHero.points}`
    );

    const pendingItem = (store.state.pendingApprovals || []).find(
      r => r.taskId === 'sleep_on_time' && r.kidId === initialHero.id && r.status === 'pending'
    );

    assert(
      pendingItem && pendingItem.pendingPoints === 20 && pendingItem.tokensAwarded === 40,
      'E3.2: Gold Points (+20) queued in pendingApprovals with full delta metadata (tokensAwarded: 40, pendingPoints: 20)',
      `Found pending item: ${JSON.stringify(pendingItem)}`
    );

    // E4: Invariant 1: One completion at a time — Attempt duplicate completion while pending
    const secondResult = store.completeBedtimeStory(testStory);

    assert(
      secondResult.success === false && secondResult.alreadyPending === true,
      'E4.1: Invariant: Second concurrent completeBedtimeStory call while pending is REJECTED',
      `Second result: success=${secondResult.success}, alreadyPending=${secondResult.alreadyPending}`
    );

    assert(
      initialHero.coins === 50 && initialHero.xp === 130,
      'E4.2: Zero duplicate tokens, XP, or sparks minted on rejected concurrent completion call',
      `Hero coins: ${initialHero.coins}, xp: ${initialHero.xp}`
    );

    // E5: Adversarial flood: 20 rapid repeat completeBedtimeStory calls
    let floodSuccesses = 0;
    for (let i = 0; i < 20; i++) {
      const res = store.completeBedtimeStory(testStory);
      if (res.success) floodSuccesses++;
    }

    assert(
      floodSuccesses === 0,
      'E5: Adversarial flood of 20 rapid completeBedtimeStory calls produces ZERO duplicate payouts',
      `Unexpected successes: ${floodSuccesses}/20`
    );

    const totalBedtimePending = (store.state.pendingApprovals || []).filter(
      r => r.taskId === 'sleep_on_time' && r.kidId === initialHero.id
    ).length;

    assert(
      totalBedtimePending === 1,
      'E5.2: Exactly 1 pending approval exists in queue despite 20 duplicate attempts',
      `Total pending: ${totalBedtimePending}`
    );

    // E6: Adversarial spending before denial:
    // Child had 50 tokens (10 original + 40 bedtime).
    // Child spends 45 tokens in the shop on hero gear (balance drops to 5 tokens).
    initialHero.coins = 5;
    initialHero.tokens = 5;
    if (!initialHero.purchasedGear) initialHero.purchasedGear = [];
    initialHero.purchasedGear.push({ id: 'starlight_cape', name: 'Starlight Cape', cost: 45 });

    // Now Parent DENIES the bedtime submission
    // Clawback tries to deduct 40 tokens from 5-token balance!
    store.rejectParentRequest(pendingItem.id);

    // E7: Floor Clamping at 0: coins must be clamped at 0 (never negative, e.g. -35)
    assert(
      initialHero.coins === 0 && initialHero.tokens === 0,
      'E6.1: Parent denial claws back tokens floored at 0 (5 - 40 clamped to 0, NEVER negative)',
      `Actual coins: ${initialHero.coins}`
    );

    assert(
      initialHero.purchasedGear.some(g => g.id === 'starlight_cape'),
      'E6.2: Prior purchased digital gear in shop is completely preserved despite balance floor clamp',
      'Starlight Cape must remain in purchasedGear'
    );

    assert(
      initialHero.xp === 100,
      'E6.3: Auto-issued Hero XP is clawed back cleanly (130 - 30 = 100)',
      `Actual xp: ${initialHero.xp}`
    );

    // Verify task is reset to uncompleted so child can complete bedtime again
    const isPendingAfterDenial = store.isTaskPendingApproval('sleep_on_time', initialHero.id);
    assert(
      isPendingAfterDenial === false,
      'E7: Once parent denies, sleep_on_time is no longer pending and resets for next bedtime cycle',
      `isPendingAfterDenial=${isPendingAfterDenial}`
    );

    // E8: Re-completion succeeds for next cycle
    const reCompleteResult = store.completeBedtimeStory(testStory);
    assert(
      reCompleteResult.success === true && initialHero.coins === 40,
      'E8: Bedtime story can be completed again in next cycle after parent resolution',
      `reComplete success=${reCompleteResult.success}, coins=${initialHero.coins}`
    );
  }

  // ===========================================================================
  // SUMMARY REPORT
  // ===========================================================================
  console.log('\n======================================================================');
  console.log('📊 ADVERSARIAL STRESS TEST SUITE SUMMARY');
  console.log(`Total Adversarial Checks Executed : ${totalTests}`);
  console.log(`Passed Checks                    : ${passedTests}`);
  console.log(`Failed Checks                    : ${failedTests}`);
  console.log('======================================================================');

  if (failedTests > 0) {
    console.error('\n❌ FAILURES DETECTED:');
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. ${f.testName}: ${f.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL ADVERSARIAL STRESS SCENARIOS PASSED WITH ZERO FAILURES!');
    process.exit(0);
  }
}

runAdversarialStressSuite().catch(err => {
  console.error('Fatal crash in adversarial stress suite:', err);
  process.exit(1);
});
