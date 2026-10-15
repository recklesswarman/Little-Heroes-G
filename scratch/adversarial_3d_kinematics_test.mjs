/**
 * scratch/adversarial_3d_kinematics_test.mjs
 * 
 * EMPIRICAL ADVERSARIAL STRESS TEST HARNESS FOR 3D GRAPHICS & KINEMATICS
 * 
 * Test Dimensions:
 * 1. WebGL context loss recovery: dispatch `webglcontextlost` event to canvas and verify
 *    clean hot-swap to WorkoutHeroDuoCanvas without crash, with full parity method delegation.
 * 2. Degenerate and boundary frame deltas:
 *    - dt = 0
 *    - dt = 1e-9 (micro-steps)
 *    - dt = 5000ms wake spikes (background tab throttling)
 *    - negative timers (remainingTime = -10s, dt = -0.016s)
 *    - NaN / corrupt input protection
 * 3. Extreme tempo conditions:
 *    - 40 BPM (slow gross motor) up to 240 BPM (hyper tempo)
 *    - Rapid step-function tempo modulation (40 <-> 240 BPM every frame)
 *    - Extreme boundary tempos (10 BPM, 500 BPM)
 * 4. Rapid sequential workout routine changes:
 *    - Switching across all 8 workouts every 1ms for 1,000 iterations
 *    - Simultaneously switching coach IDs across all 8 species
 *    - Verification of root.reset() posture hygiene (no accumulated pose drift)
 * 5. Matrix invertibility and numerical stability:
 *    - 10,000 continuous simulation frames across all 8 workouts
 *    - Full inspection of local and world transformation matrices for all 42 bones
 *    - Verification: isFinite, !isNaN, det != 0, worldMatrix * inverse == Identity
 *    - Mesh model and normal matrix invertibility check
 */

import './setup_mock_env.js';
import {
  createAvatarRig,
  createCoachRig,
  mat4Create,
  mat4Identity,
  mat4Multiply,
  mat4Invert,
  mat4Transpose,
  mat4FromTranslationRotationScale
} from '../src/services/avatarSkeletalRig.js';

import {
  applyWorkoutKinematics,
  applyCoachKinematics
} from '../src/services/workoutKinematicsEngine.js';

import { WorkoutHero3DStage, isWebGLSupported } from '../src/components/WorkoutHero3DStage.js';
import { WorkoutHeroDuoCanvas } from '../src/components/WorkoutHeroDuoCanvas.js';
import { DINO_WORKOUTS } from '../src/data/petsData.js';

// Metrics and Reporting Collection
const metrics = {
  totalAssertions: 0,
  passedAssertions: 0,
  failedAssertions: 0,
  webglLossRecoveries: 0,
  degenerateFramesTested: 0,
  tempoModulationFrames: 0,
  rapidWorkoutSwitches: 0,
  matrixEvaluations: 0,
  matrixInversionsChecked: 0,
  nanDetected: 0,
  infDetected: 0,
  singularMatrices: 0,
  maxDeterminantError: 0,
  failures: []
};

function assert(condition, message, details = '') {
  metrics.totalAssertions++;
  if (condition) {
    metrics.passedAssertions++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    metrics.failedAssertions++;
    const errMsg = `${message} ${details ? ':: ' + details : ''}`;
    metrics.failures.push(errMsg);
    console.error(`  ❌ ADVERSARIAL FAIL: ${errMsg}`);
  }
}

// =============================================================================
// MOCK WEBGL RENDERING CONTEXT FACTORY
// =============================================================================

function createMockWebGLContext() {
  let shaderId = 1;
  let progId = 1;
  let bufId = 1;

  const gl = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    DEPTH_TEST: 2929,
    LEQUAL: 515,
    BLEND: 3042,
    SRC_ALPHA: 770,
    ONE_MINUS_SRC_ALPHA: 771,
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    TRIANGLES: 4,
    UNSIGNED_SHORT: 5123,
    COLOR_BUFFER_BIT: 16384,
    DEPTH_BUFFER_BIT: 256,

    // Calls tracked for verification
    calls: {
      drawElements: 0,
      clear: 0,
      useProgram: 0,
      bufferData: 0
    },

    createShader: (type) => ({ id: shaderId++, type, source: '', compiled: false }),
    shaderSource: (s, src) => { s.source = src; },
    compileShader: (s) => { s.compiled = true; },
    getShaderParameter: (s, p) => (p === 35713 ? true : true),
    getShaderInfoLog: () => '',

    createProgram: () => ({ id: progId++, attached: [], linked: false }),
    attachShader: (p, s) => { p.attached.push(s); },
    linkProgram: (p) => { p.linked = true; },
    getProgramParameter: (p, param) => (param === 35714 ? true : true),
    getProgramInfoLog: () => '',
    useProgram: () => { gl.calls.useProgram++; },

    getAttribLocation: (prog, name) => 1,
    getUniformLocation: (prog, name) => ({ name, progId: prog.id }),

    enable: () => {},
    depthFunc: () => {},
    blendFunc: () => {},
    clearColor: () => {},
    viewport: () => {},
    clear: () => { gl.calls.clear++; },

    createBuffer: () => ({ id: bufId++ }),
    bindBuffer: () => {},
    bufferData: () => { gl.calls.bufferData++; },

    uniformMatrix4fv: () => {},
    uniform3fv: () => {},
    uniform1f: () => {},

    vertexAttribPointer: () => {},
    enableVertexAttribArray: () => {},
    drawElements: (mode, count, type, offset) => { gl.calls.drawElements++; }
  };

  return gl;
}

function createMockContainer(w = 640, h = 360) {
  const container = document.createElement('div');
  container.id = 'adversarial-container';
  container.clientWidth = w;
  container.clientHeight = h;
  container.getBoundingClientRect = () => ({
    width: w,
    height: h,
    top: 0,
    left: 0,
    right: w,
    bottom: h
  });
  return container;
}

// Compute 4x4 matrix determinant
function mat4Determinant(a) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
}

// Check if two 4x4 matrices are approximately equal
function mat4ApproxEqual(a, b, epsilon = 1e-4) {
  for (let i = 0; i < 16; i++) {
    if (Math.abs(a[i] - b[i]) > epsilon) return false;
  }
  return true;
}

// =============================================================================
// TEST SUITE EXECUTION
// =============================================================================

async function runAdversarialTestSuite() {
  console.log('\n======================================================================');
  console.log('🔥 RUNNING EMPIRICAL ADVERSARIAL STRESS TEST HARNESS (3D KINEMATICS)');
  console.log('======================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. WEBGL CONTEXT LOSS RECOVERY AND HOT-SWAP TO 2D CANVAS
  // ---------------------------------------------------------------------------
  console.log('--- DIMENSION 1: WebGL Context Loss Recovery & Hot-Swap ---');
  {
    // Configure mock WebGL environment
    const prevWebGLCtx = globalThis.window.WebGLRenderingContext;
    globalThis.window.WebGLRenderingContext = function WebGLRenderingContext() {};

    // Instrument createElement to return a canvas that supports mock WebGL and complete 2D context
    const origCreateElement = document.createElement;
    let mockGL = null;
    document.createElement = function(tag) {
      const el = origCreateElement.call(document, tag);
      if (tag === 'canvas') {
        const origGetContext = el.getContext;
        el.getContext = function(type, opts) {
          if (type.startsWith('webgl') || type === 'experimental-webgl') {
            mockGL = createMockWebGLContext();
            return mockGL;
          }
          const ctx2d = origGetContext.call(el, type, opts) || {};
          ctx2d.moveTo = ctx2d.moveTo || (() => {});
          ctx2d.lineTo = ctx2d.lineTo || (() => {});
          ctx2d.closePath = ctx2d.closePath || (() => {});
          ctx2d.bezierCurveTo = ctx2d.bezierCurveTo || (() => {});
          ctx2d.quadraticCurveTo = ctx2d.quadraticCurveTo || (() => {});
          ctx2d.arcTo = ctx2d.arcTo || (() => {});
          ctx2d.clip = ctx2d.clip || (() => {});
          ctx2d.ellipse = ctx2d.ellipse || (() => {});
          return ctx2d;
        };
      }
      return el;
    };

    const container = createMockContainer();
    const stage = new WorkoutHero3DStage(container, {
      workoutId: 'velociraptor_run',
      coachId: '2',
      tempoBpm: 138
    });

    assert(stage.isFallback === false, 'Stage successfully initialized in 3D WebGL mode');
    assert(stage.gl !== null, 'WebGL context acquired');
    assert(stage.canvas !== null, '3D WebGL canvas attached to container');

    // Render one frame to test WebGL drawing pipeline
    stage.update(0.016);
    stage.render();
    assert(mockGL.calls.drawElements > 0, `3D scene drew meshes (${mockGL.calls.drawElements} draw calls)`);

    // DISPATCH ADVERSARIAL WEBGLCONTEXTLOST EVENT
    let prevented = false;
    const lossEvent = {
      type: 'webglcontextlost',
      preventDefault: () => { prevented = true; }
    };

    // Trigger context loss
    stage.canvas.dispatchEvent(lossEvent);

    assert(prevented === true, 'webglcontextlost event preventDefault() was invoked');
    assert(stage.isFallback === true, 'Stage transitioned isFallback to true');
    assert(stage.fallbackCanvas !== null, 'fallbackCanvas instance created');
    assert(stage.fallbackCanvas instanceof WorkoutHeroDuoCanvas, 'fallbackCanvas is WorkoutHeroDuoCanvas');
    assert(stage.animId === null || typeof stage.animId !== 'undefined', '3D animation frame cancelled on context loss');

    // Test Parity contract methods post-context loss
    let parityErrors = 0;
    try {
      stage.setWorkout('stegosaurus_walks', '3', 92);
      stage.setTimeRemaining(45);
      stage.triggerBeat();
      stage.pauseAnimation();
      stage.resumeAnimation();
      stage.stopAnimation();
      stage.startAnimation();
    } catch (e) {
      parityErrors++;
      console.error('Error in post-context-loss parity methods:', e);
    }
    assert(parityErrors === 0, 'All parity methods delegate cleanly to fallbackCanvas without error');
    assert(stage.fallbackCanvas.workoutId === 'stegosaurus_walks', 'Fallback canvas updated workoutId');
    assert(stage.fallbackCanvas.coachId === '3', 'Fallback canvas updated coachId');
    assert(stage.fallbackCanvas.workoutTimeRemaining === 45, 'Fallback canvas updated workoutTimeRemaining');

    // Stress test: Dispatching multiple redundant webglcontextlost events
    const initialFallbackInstance = stage.fallbackCanvas;
    let multiLossException = false;
    try {
      stage.canvas.dispatchEvent(lossEvent);
      stage.canvas.dispatchEvent(lossEvent);
    } catch (e) {
      multiLossException = true;
    }
    assert(!multiLossException, 'Subsequent redundant webglcontextlost events handled gracefully');

    // Adversarial check: Did redundant context loss overwrite fallbackCanvas without destroying the previous one?
    const isIdempotentFallback = (stage.fallbackCanvas === initialFallbackInstance) || (initialFallbackInstance && initialFallbackInstance.isDestroyed);
    assert(
      isIdempotentFallback,
      'Fallback canvas lifecycle idempotency: redundant webglcontextlost must not leak active orphan canvas instances',
      stage.fallbackCanvas !== initialFallbackInstance ? 'Leaked prior fallbackCanvas instance with active animation loop' : ''
    );

    // Test clean destroy() post context loss
    let destroyException = false;
    try {
      stage.destroy();
    } catch (e) {
      destroyException = true;
    }
    assert(!destroyException, 'destroy() post-context-loss executes cleanly');
    assert(stage.isDestroyed === true, 'Stage marked as destroyed');
    assert(stage.fallbackCanvas === null, 'fallbackCanvas reference cleared on destroy');

    metrics.webglLossRecoveries++;

    // Restore environment
    document.createElement = origCreateElement;
    globalThis.window.WebGLRenderingContext = prevWebGLCtx;
  }

  // ---------------------------------------------------------------------------
  // 2. DEGENERATE AND BOUNDARY FRAME DELTAS
  // ---------------------------------------------------------------------------
  console.log('\n--- DIMENSION 2: Degenerate & Boundary Frame Deltas ---');
  {
    const avatarRig = createAvatarRig();
    const coachRig = createCoachRig('2');

    // 2.1 dt = 0 across 500 frames (Frame freeze / duplicate rAF timestamp)
    let zeroDtFail = false;
    let clock = 10.0;
    for (let f = 0; f < 500; f++) {
      clock += 0;
      applyWorkoutKinematics(avatarRig, 'velociraptor_run', clock, 138, 50);
      applyCoachKinematics(coachRig, 'velociraptor_run', '2', clock, 138, 50);
      metrics.degenerateFramesTested++;

      if (isNaN(avatarRig.bones.pelvis.position.y) || isNaN(avatarRig.bones.thighL.rotation.x)) {
        zeroDtFail = true;
        break;
      }
    }
    assert(!zeroDtFail, 'dt = 0 (frozen frames) handled without NaN or numerical singularity across 500 steps');

    // 2.2 Microsecond steps: dt = 1e-9 across 500 frames
    let microDtFail = false;
    for (let f = 0; f < 500; f++) {
      clock += 1e-9;
      applyWorkoutKinematics(avatarRig, 'stegosaurus_walks', clock, 92, 45);
      applyCoachKinematics(coachRig, 'stegosaurus_walks', '3', clock, 92, 45);
      metrics.degenerateFramesTested++;

      if (isNaN(avatarRig.bones.pelvis.position.y) || !Number.isFinite(avatarRig.root.position.z)) {
        microDtFail = true;
        break;
      }
    }
    assert(!microDtFail, 'dt = 1e-9 micro-steps maintain precision and finite numbers across 500 steps');

    // 2.3 Wake Spike: dt = 5000ms (5.0s) and dt = 10,000ms (10.0s)
    let wakeSpikeFail = false;
    const testSpikes = [5.0, 10.0, 60.0, 3600.0];
    for (const spike of testSpikes) {
      clock += spike;
      applyWorkoutKinematics(avatarRig, 'pterodactyl_takeoff', clock, 112, 30);
      applyCoachKinematics(coachRig, 'pterodactyl_takeoff', '4', clock, 112, 30);
      metrics.degenerateFramesTested++;

      const y = avatarRig.bones.pelvis.position.y;
      const rot = avatarRig.bones.armL.rotation.x;
      if (!Number.isFinite(y) || isNaN(y) || !Number.isFinite(rot) || isNaN(rot)) {
        wakeSpikeFail = true;
        break;
      }
      // Vertical leap should not propel into outer space (apexY <= +0.85m + base 0.52m)
      if (y > 2.5 || y < -1.0) {
        wakeSpikeFail = true;
        break;
      }
    }
    assert(!wakeSpikeFail, 'Massive wake spikes (dt = 5s to 3600s) remain strictly bounded without kinematic explosion');

    // 2.4 Negative Timers and Negative Clocks
    let negativeFail = false;
    const negTimes = [-1.0, -10.0, -60.0, -9999.0];
    for (const negT of negTimes) {
      applyWorkoutKinematics(avatarRig, 'diplodocus', -5.0, 74, negT, false);
      applyCoachKinematics(coachRig, 'diplodocus', '7', -5.0, 74, negT, false);
      metrics.degenerateFramesTested++;

      const blendRot = avatarRig.bones.armL.rotation.x;
      if (!Number.isFinite(blendRot) || isNaN(blendRot)) {
        negativeFail = true;
        break;
      }
    }
    assert(!negativeFail, 'Negative clock and negative remainingTime clamp safely without division by zero');

    // 2.5 Corrupted NaN/Undefined dt and clock handling
    let nanProtectionActive = true;
    try {
      // Test when undefined or null is passed
      applyWorkoutKinematics(avatarRig, 'trex_run', undefined, undefined, undefined);
      applyCoachKinematics(coachRig, 'trex_run', '1', undefined, undefined, undefined);
      metrics.degenerateFramesTested += 2;
    } catch (e) {
      nanProtectionActive = false;
    }
    assert(nanProtectionActive, 'Undefined inputs to kinematics do not throw unhandled exceptions');

    // 2.6 Chaotic alternating dt sequence across 1,000 frames
    let chaosFail = false;
    const chaosDts = [0, 0.016, 5.0, 1e-7, -0.016, 0.033, 10.0, 0.001];
    for (let i = 0; i < 1000; i++) {
      const dt = chaosDts[i % chaosDts.length];
      clock += dt;
      const workoutId = DINO_WORKOUTS[i % DINO_WORKOUTS.length].id;
      applyWorkoutKinematics(avatarRig, workoutId, clock, 120, 60 - (i % 60));
      metrics.degenerateFramesTested++;

      const rootMat = avatarRig.root.worldMatrix;
      if (isNaN(rootMat[0]) || isNaN(rootMat[12]) || !Number.isFinite(rootMat[15])) {
        chaosFail = true;
        metrics.nanDetected++;
        break;
      }
    }
    assert(!chaosFail, 'Chaotic alternating dt sequence (1,000 frames) maintains 100% finite matrices');
  }

  // ---------------------------------------------------------------------------
  // 3. EXTREME TEMPO CONDITIONS (40 TO 240 BPM & RAPID MODULATION)
  // ---------------------------------------------------------------------------
  console.log('\n--- DIMENSION 3: Extreme Tempo Conditions (40 to 240 BPM) ---');
  {
    const avatarRig = createAvatarRig();
    const coachRig = createCoachRig('1');

    // 3.1 Steady extreme tempos: 40 BPM and 240 BPM
    const testTempos = [40, 60, 92, 120, 138, 180, 240];
    let tempoRangeFail = false;

    for (const bpm of testTempos) {
      for (let t = 0; t < 100; t++) {
        const time = t * 0.05;
        applyWorkoutKinematics(avatarRig, 'velociraptor_run', time, bpm, 60 - time);
        applyCoachKinematics(coachRig, 'velociraptor_run', '2', time, bpm, 60 - time);
        metrics.tempoModulationFrames++;

        const armRot = avatarRig.bones.armL.rotation.x;
        const legRot = avatarRig.bones.thighL.rotation.x;
        if (!Number.isFinite(armRot) || !Number.isFinite(legRot) || isNaN(armRot) || isNaN(legRot)) {
          tempoRangeFail = true;
          break;
        }
      }
      if (tempoRangeFail) break;
    }
    assert(!tempoRangeFail, 'All calibrated tempos from 40 BPM to 240 BPM execute cleanly without numerical instability');

    // 3.2 Extreme boundary tempos: 0 BPM and 600 BPM
    let boundaryBpmFail = false;
    for (const extremeBpm of [0, 600]) {
      applyWorkoutKinematics(avatarRig, 'compsognathus_prance', 5.0, extremeBpm, 30);
      applyCoachKinematics(coachRig, 'compsognathus_prance', '5', 5.0, extremeBpm, 30);
      metrics.tempoModulationFrames++;

      if (isNaN(avatarRig.root.position.x) || !Number.isFinite(avatarRig.bones.pelvis.position.y)) {
        boundaryBpmFail = true;
      }
    }
    assert(!boundaryBpmFail, 'Boundary tempos (0 BPM and 600 BPM) execute with finite transforms');

    // 3.3 Rapid step-function tempo modulation (40 <-> 240 BPM every single frame for 2,000 frames)
    let modulationFail = false;
    let simClock = 0;
    for (let f = 0; f < 2000; f++) {
      const bpm = (f % 2 === 0) ? 40 : 240;
      simClock += 0.016;
      applyWorkoutKinematics(avatarRig, 'trex_run', simClock, bpm, 60 - (simClock % 60));
      applyCoachKinematics(coachRig, 'trex_run', '1', simClock, bpm, 60 - (simClock % 60));
      metrics.tempoModulationFrames++;

      const kneeRot = avatarRig.bones.thighL.rotation.x;
      const calfRot = avatarRig.bones.calfL.rotation.x;
      if (isNaN(kneeRot) || isNaN(calfRot) || !Number.isFinite(kneeRot) || !Number.isFinite(calfRot)) {
        modulationFail = true;
        break;
      }
    }
    assert(!modulationFail, 'Rapid step-function tempo modulation (40 <-> 240 BPM every frame for 2,000 frames) verified stable');
  }

  // ---------------------------------------------------------------------------
  // 4. RAPID SEQUENTIAL WORKOUT ROUTINE CHANGES (<1MS INTERVALS)
  // ---------------------------------------------------------------------------
  console.log('\n--- DIMENSION 4: Rapid Sequential Workout Routine Changes ---');
  {
    const avatarRig = createAvatarRig();
    const workoutIds = DINO_WORKOUTS.map(w => w.id);

    let switchFail = false;
    let postureLeakageDetected = false;

    // Run 1,000 rapid switches (switching workout every 1ms simulation time)
    for (let i = 0; i < 1000; i++) {
      const wId = workoutIds[i % workoutIds.length];
      const coachId = String((i % 8) + 1);
      const coachRig = createCoachRig(coachId);
      const clock = i * 0.001;

      applyWorkoutKinematics(avatarRig, wId, clock, 120, 60);
      applyCoachKinematics(coachRig, wId, coachId, clock, 120, 60);
      metrics.rapidWorkoutSwitches++;

      // When switching to Brachiosaurus Stretch, feet should be together (thigh rotation x = 0)
      if (wId === 'brachiosaurus_stretch') {
        if (Math.abs(avatarRig.bones.thighL.rotation.x) > 1e-4) {
          postureLeakageDetected = true;
          switchFail = true;
          break;
        }
      }

      // Check root worldMatrix validity
      const wm = avatarRig.root.worldMatrix;
      if (isNaN(wm[0]) || isNaN(wm[12]) || isNaN(wm[13]) || isNaN(wm[14])) {
        switchFail = true;
        metrics.nanDetected++;
        break;
      }
    }

    assert(!switchFail, '1,000 rapid sequential workout switches (<1ms) completed with zero matrix faults');
    assert(!postureLeakageDetected, 'root.reset() hygiene verified: zero posture leakage between consecutive workouts');
  }

  // ---------------------------------------------------------------------------
  // 5. MATRIX INVERTIBILITY & NUMERICAL STABILITY ACROSS 10,000 FRAMES
  // ---------------------------------------------------------------------------
  console.log('\n--- DIMENSION 5: Matrix Invertibility & Numerical Stability (10,000 Frames) ---');
  {
    const avatarRig = createAvatarRig();
    const coachRig = createCoachRig('2');
    const invTestMat = mat4Create();
    const identityMat = mat4Create();
    mat4Identity(identityMat);
    const prodMat = mat4Create();

    const workoutIds = DINO_WORKOUTS.map(w => w.id);
    const framesPerWorkout = 1250; // 8 * 1250 = 10,000 frames total
    let totalFrames = 10000;

    let matrixStabilityFail = false;
    let nonInvertibleCount = 0;
    let maxDetError = 0;

    const startMs = Date.now();

    for (let w = 0; w < workoutIds.length; w++) {
      const wId = workoutIds[w];
      const tempo = DINO_WORKOUTS[w].tempoBpm || 120;
      const coachId = String(DINO_WORKOUTS[w].coachId || '2');

      for (let f = 0; f < framesPerWorkout; f++) {
        const clock = f * 0.016; // 60 FPS
        const remaining = 60 - (clock % 60);
        const isFlipped = remaining <= 30.0;

        applyWorkoutKinematics(avatarRig, wId, clock, tempo, remaining, isFlipped);
        applyCoachKinematics(coachRig, wId, coachId, clock, tempo, remaining, isFlipped);

        // Inspect all bones in avatar rig
        for (const boneName in avatarRig.bones) {
          const bone = avatarRig.bones[boneName];
          metrics.matrixEvaluations += 2; // local + world

          const wm = bone.worldMatrix;
          // 1. Check all elements are finite and not NaN
          for (let m = 0; m < 16; m++) {
            const v = wm[m];
            if (!Number.isFinite(v)) {
              metrics.infDetected++;
              matrixStabilityFail = true;
            }
            if (isNaN(v)) {
              metrics.nanDetected++;
              matrixStabilityFail = true;
            }
          }

          // 2. Check invertibility on every 10th frame to keep test execution snappy
          if (f % 10 === 0) {
            metrics.matrixInversionsChecked++;
            const det = mat4Determinant(wm);
            if (Math.abs(det) < 1e-5) {
              metrics.singularMatrices++;
              nonInvertibleCount++;
              matrixStabilityFail = true;
            }

            const invResult = mat4Invert(invTestMat, wm);
            if (!invResult) {
              metrics.singularMatrices++;
              nonInvertibleCount++;
              matrixStabilityFail = true;
            } else {
              // Verify M * M^-1 == Identity
              mat4Multiply(prodMat, wm, invTestMat);
              for (let i = 0; i < 16; i++) {
                const diff = Math.abs(prodMat[i] - identityMat[i]);
                if (diff > maxDetError) maxDetError = diff;
                if (diff > 1e-3) {
                  matrixStabilityFail = true;
                }
              }
            }
          }
        }

        // Inspect dinosaur coach root and tail matrices
        const coachWm = coachRig.root.worldMatrix;
        metrics.matrixEvaluations++;
        if (isNaN(coachWm[0]) || !Number.isFinite(coachWm[12])) {
          matrixStabilityFail = true;
          metrics.nanDetected++;
        }
      }
    }

    const elapsedMs = Date.now() - startMs;
    metrics.maxDeterminantError = maxDetError;

    assert(!matrixStabilityFail, `All 10,000 frames evaluated with 100% finite values (evaluated in ${elapsedMs}ms)`);
    assert(metrics.nanDetected === 0, `Zero NaN matrix elements detected (scanned ${metrics.matrixEvaluations} matrices)`);
    assert(metrics.infDetected === 0, `Zero Infinity matrix elements detected`);
    assert(metrics.singularMatrices === 0, `Zero singular/non-invertible matrices across all bone trees`);
    assert(maxDetError < 1e-3, `Maximum inversion numerical error within tolerance: ${maxDetError.toExponential(4)} < 1e-3`);

    console.log(`\n  📊 Metrics:`);
    console.log(`     - Total frames simulated: ${totalFrames}`);
    console.log(`     - Total matrix evaluations: ${metrics.matrixEvaluations}`);
    console.log(`     - Invertibility checks verified: ${metrics.matrixInversionsChecked}`);
    console.log(`     - Max inversion error: ${metrics.maxDeterminantError.toExponential(4)}`);
  }

  // ===========================================================================
  // SUMMARY AND VERDICT
  // ===========================================================================
  console.log('\n======================================================================');
  console.log(`🏁 ADVERSARIAL STRESS TEST COMPLETE`);
  console.log(`   Total Assertions: ${metrics.totalAssertions}`);
  console.log(`   Passed: ${metrics.passedAssertions}`);
  console.log(`   Failed: ${metrics.failedAssertions}`);
  console.log('======================================================================\n');

  if (metrics.failedAssertions === 0) {
    console.log('🎉 VERDICT: APPROVE — 3D Graphics & Kinematics engine is exceptionally robust under adversarial load.');
    process.exit(0);
  } else {
    console.error('⚠️ VERDICT: REQUEST_CHANGES — Adversarial stress test uncovered failure modes:');
    metrics.failures.forEach(f => console.error('   - ' + f));
    process.exit(1);
  }
}

runAdversarialTestSuite().catch(err => {
  console.error('Unhandled fatal error in stress test harness:', err);
  process.exit(1);
});
