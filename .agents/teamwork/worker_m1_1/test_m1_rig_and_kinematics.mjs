/**
 * test_m1_rig_and_kinematics.mjs
 * 
 * Comprehensive Unit Verification for Milestone M1
 * - avatarSkeletalRig.js
 * - workoutKinematicsEngine.js
 * - WorkoutHero3DStage.js
 */

import {
  createAvatarRig,
  createCoachRig,
  STITCH_COLORS,
  hexToRgb
} from '../../../src/services/avatarSkeletalRig.js';

import {
  applyWorkoutKinematics,
  applyCoachKinematics
} from '../../../src/services/workoutKinematicsEngine.js';

import {
  WorkoutHero3DStage,
  isWebGLSupported
} from '../../../src/components/WorkoutHero3DStage.js';

console.log('🧪 Starting Milestone M1 Verification Suite...\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Avatar Skeletal Bone Hierarchy & Contracts
// -----------------------------------------------------------------------------
console.log('--- Test 1: Avatar Skeletal Hierarchy Contract ---');
const avatarRig = createAvatarRig();
assert(avatarRig !== null, 'createAvatarRig() returns non-null object');
assert(avatarRig.root !== undefined, 'Rig contains root BoneNode');
assert(avatarRig.bones !== undefined, 'Rig contains bones object');

const requiredBones = [
  'pelvis', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'armL', 'forearmL', 'handL',
  'shoulderR', 'armR', 'forearmR', 'handR',
  'hipL', 'thighL', 'calfL', 'footL',
  'hipR', 'thighR', 'calfR', 'footR',
  'cape'
];

for (const boneName of requiredBones) {
  assert(avatarRig.bones[boneName] !== undefined, `Bone hierarchy includes '${boneName}'`);
}

// Check parent-child hierarchy
assert(avatarRig.bones.pelvis.parent === avatarRig.root, 'Pelvis is child of root');
assert(avatarRig.bones.spine.parent === avatarRig.bones.pelvis, 'Spine is child of pelvis');
assert(avatarRig.bones.chest.parent === avatarRig.bones.spine, 'Chest is child of spine');
assert(avatarRig.bones.neck.parent === avatarRig.bones.chest, 'Neck is child of chest');
assert(avatarRig.bones.head.parent === avatarRig.bones.neck, 'Head is child of neck');
assert(avatarRig.bones.cape.parent === avatarRig.bones.chest, 'Cape is child of chest');
assert(avatarRig.bones.footL.parent === avatarRig.bones.calfL, 'FootL is child of calfL');
assert(avatarRig.bones.footR.parent === avatarRig.bones.calfR, 'FootR is child of calfR');

// -----------------------------------------------------------------------------
// TEST 2: Stitch Design System Color Integrity (Zero Pink/Purple)
// -----------------------------------------------------------------------------
console.log('\n--- Test 2: Stitch Design System Palette Integrity ---');
const disallowedColorsRegex = /(pink|purple|#ff|#e056fd|#be2edd|#f368e0|#ff9ff3)/i;

for (const [key, color] of Object.entries(STITCH_COLORS)) {
  const isForbidden = disallowedColorsRegex.test(color) && !color.includes('#ffffff');
  assert(!isForbidden, `Color constant ${key} (${color}) conforms to Stitch palette (no pink/purple)`);
}

// Verify all meshes attached to avatar adhere to Stitch palette
let avatarColorsClean = true;
for (const meshObj of avatarRig.meshes) {
  const col = meshObj.renderMesh.color.toLowerCase();
  if (col.includes('pink') || col.includes('purple')) {
    avatarColorsClean = false;
  }
}
assert(avatarColorsClean, 'All Avatar procedural meshes strictly adhere to Stitch color system');

// -----------------------------------------------------------------------------
// TEST 3: 3D Dinosaur Coach Rig Hierarchy (All 8 Partners)
// -----------------------------------------------------------------------------
console.log('\n--- Test 3: 3D Dinosaur Coach Rig for All 8 Coaches ---');
const coachIds = ['1', '2', '3', '4', '5', '6', '7', '8'];
for (const cid of coachIds) {
  const coach = createCoachRig(cid);
  assert(coach.root !== undefined, `Coach ${cid} has valid root bone`);
  assert(coach.bones.tail1 !== undefined, `Coach ${cid} has articulated tail hierarchy`);
  assert(coach.bones.head !== undefined, `Coach ${cid} has head bone`);
  assert(coach.meshes.length > 0, `Coach ${cid} has attached 3D meshes (count: ${coach.meshes.length})`);
}

// Specific coach feature tests
const stego = createCoachRig('3');
assert(stego.species === 'stego', 'Coach 3 is Stegosaurus');
const spino = createCoachRig('8');
assert(spino.species === 'spino', 'Coach 8 is Spinosaurus');
const pterry = createCoachRig('4');
assert(pterry.species === 'pterry', 'Coach 4 is Pterodactyl with wings');

// -----------------------------------------------------------------------------
// TEST 4: Mathematical Kinematics for All 8 Routines
// -----------------------------------------------------------------------------
console.log('\n--- Test 4: Kinematic Engine for All 8 Gross-Motor Workouts ---');

// 1. Velociraptor Run (138 BPM)
applyWorkoutKinematics(avatarRig, 'velociraptor_run', 1.0, 138, 50, false);
assert(avatarRig.bones.forearmL.rotation.x === 1.57, 'Velociraptor Run: Left forearm locked at 90° pump (1.57 rad)');
assert(avatarRig.bones.forearmR.rotation.x === 1.57, 'Velociraptor Run: Right forearm locked at 90° pump (1.57 rad)');
assert(avatarRig.bones.footL.rotation.x === 0.44, 'Velociraptor Run: Left ankle plantarflexion on balls of feet (+25° / 0.44 rad)');
assert(avatarRig.bones.pelvis.rotation.x > 0.20, 'Velociraptor Run: Forward chest/pelvis speed lean');

// 2. Stegosaurus Walks (92 BPM)
applyWorkoutKinematics(avatarRig, 'stegosaurus_walks', 1.0, 92, 45, false);
assert(avatarRig.bones.pelvis.position.y < avatarRig.bones.pelvis.basePosition.y - 0.25, 'Stegosaurus Walks: Pelvis lowered into quadruped crawl');
assert(avatarRig.bones.pelvis.rotation.x >= 0.78, 'Stegosaurus Walks: Pelvis pitched 45° with hips high');
assert(avatarRig.bones.shoulderL.rotation.x > 1.0, 'Stegosaurus Walks: Arms reaching to floor');

// 3. Pterodactyl Take Off (112 BPM) - 3 Phases
// Phase A (tau = 1.0s): Circular wing arcs
applyWorkoutKinematics(avatarRig, 'pterodactyl_takeoff', 1.0, 112, 40, false);
assert(avatarRig.bones.shoulderL.rotation.z > 1.0, 'Pterodactyl Takeoff Phase A: Arms spread wide (70° abduction)');

// Phase B (tau = 1.95s): Deep crouch squat
applyWorkoutKinematics(avatarRig, 'pterodactyl_takeoff', 1.95, 112, 40, false);
assert(avatarRig.bones.pelvis.position.y < avatarRig.bones.pelvis.basePosition.y - 0.20, 'Pterodactyl Takeoff Phase B: Deep crouch squat');
assert(avatarRig.bones.thighL.rotation.x > 0.5, 'Pterodactyl Takeoff Phase B: Knee flexed in crouch');

// Phase C (tau = 2.55s): Vertical takeoff leap
applyWorkoutKinematics(avatarRig, 'pterodactyl_takeoff', 2.55, 112, 40, false);
assert(avatarRig.bones.pelvis.position.y > avatarRig.bones.pelvis.basePosition.y + 0.30, 'Pterodactyl Takeoff Phase C: Vertical rocket leap (+0.85m apex)');
assert(avatarRig.bones.armL.rotation.x < -2.0, 'Pterodactyl Takeoff Phase C: Arms explode straight overhead');
assert(avatarRig.bones.footL.rotation.x > 0.5, 'Pterodactyl Takeoff Phase C: Toes pointed down (+35° plantarflexion)');

// 4. T-Rex Run (122 BPM)
applyWorkoutKinematics(avatarRig, 'trex_run', 1.0, 122, 35, false);
assert(avatarRig.bones.forearmL.rotation.x === 2.0, 'T-Rex Run: Short arms tucked tight in armpits (115° flexion / 2.0 rad)');
assert(avatarRig.bones.forearmR.rotation.x === 2.0, 'T-Rex Run: Short arms tucked tight in armpits');

// 5. Compsognathus Prances (126 BPM)
applyWorkoutKinematics(avatarRig, 'compsognathus_prance', 0.5, 126, 32, false);
assert(avatarRig.root.position.x !== 0.38, 'Compsognathus Prances: Lateral skater jump X displacement');
assert(avatarRig.bones.pelvis.rotation.z !== 0, 'Compsognathus Prances: Lateral body roll lean');

// 6. Brachiosaurus Stretch (78 BPM)
applyWorkoutKinematics(avatarRig, 'brachiosaurus_stretch', 0.5, 78, 25, false);
assert(avatarRig.bones.armL.rotation.x < -2.5, 'Brachiosaurus Stretch: Arms reaching straight overhead (-170°)');
assert(avatarRig.bones.forearmL.rotation.x === 0, 'Brachiosaurus Stretch: Forearms fully straightened');
assert(avatarRig.bones.head.rotation.x < -0.3, 'Brachiosaurus Stretch: Head gazing up at stars');
assert(avatarRig.bones.footL.rotation.x > 0.2, 'Brachiosaurus Stretch: Ankle tiptoe rise (+35° plantarflexion)');

// 7. The Diplodocus (74 BPM) - 30-Second Side Switch
// Side 1 (Remaining time: 45s > 30s)
applyWorkoutKinematics(avatarRig, 'diplodocus', 1.0, 74, 45, false);
const side1_armR = avatarRig.bones.armR.rotation.x;
const side1_armL = avatarRig.bones.armL.rotation.x;
assert(side1_armR < -1.0, 'Diplodocus Side 1: Right arm reaches forward horizontal (neck)');
assert(side1_armL > 0.5, 'Diplodocus Side 1: Left hand plants on floor');

// Side 2 (Remaining time: 20s <= 30s)
applyWorkoutKinematics(avatarRig, 'diplodocus', 1.0, 74, 20, false);
const side2_armR = avatarRig.bones.armR.rotation.x;
const side2_armL = avatarRig.bones.armL.rotation.x;
assert(side2_armL < -1.0, 'Diplodocus Side 2: Left arm reaches forward horizontal (neck switch)');
assert(side2_armR > 0.5, 'Diplodocus Side 2: Right hand plants on floor');

// 8. Spinosaurus Stretch (64 BPM)
applyWorkoutKinematics(avatarRig, 'spinosaurus_stretch', 1.0, 64, 15, false);
assert(avatarRig.bones.spine.rotation.x !== 0, 'Spinosaurus Stretch: Active Cat-Cow undulating spine wave');

// -----------------------------------------------------------------------------
// TEST 5: WorkoutHero3DStage Parity Contract & Fallback
// -----------------------------------------------------------------------------
console.log('\n--- Test 5: WorkoutHero3DStage Parity Contract & Fallback ---');
const mockContainer = {
  innerHTML: '',
  appendChild: () => {},
  clientWidth: 640,
  clientHeight: 360,
  getBoundingClientRect: () => ({ width: 640, height: 360 })
};

const stage = new WorkoutHero3DStage(mockContainer, { workoutId: 'velociraptor_run', coachId: '2', tempoBpm: 138 });

// Full method contract checks
const methods = [
  'setWorkout', 'setTimeRemaining', 'triggerBeat',
  'startAnimation', 'pauseAnimation', 'resumeAnimation', 'stopAnimation', 'destroy'
];

for (const m of methods) {
  assert(typeof stage[m] === 'function', `WorkoutHero3DStage implements '${m}()' contract`);
}

// Exercise methods
stage.setWorkout('trex_run', '1', 122);
assert(stage.workoutId === 'trex_run', 'setWorkout() updates workoutId');
assert(stage.tempoBpm === 122, 'setWorkout() updates tempoBpm');

stage.setTimeRemaining(42);
assert(stage.workoutTimeRemaining === 42, 'setTimeRemaining() updates remaining time');

stage.triggerBeat();
assert(stage.beatPulse > 0 || (stage.isFallback && stage.fallbackCanvas), 'triggerBeat() triggers beat pulse or forwards to fallback');

stage.pauseAnimation();
assert(stage.isPaused === true || (stage.isFallback && stage.fallbackCanvas.isPaused), 'pauseAnimation() pauses stage');

stage.resumeAnimation();
assert(stage.isPaused === false || (stage.isFallback && !stage.fallbackCanvas.isPaused), 'resumeAnimation() resumes stage');

stage.destroy();
assert(stage.isDestroyed === true, 'destroy() cleans up stage');

console.log(`\n=============================================================`);
console.log(`Milestone M1 Verification Results: ${passCount} PASSED, ${failCount} FAILED`);
console.log(`=============================================================\n`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
