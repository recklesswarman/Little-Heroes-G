/**
 * workoutKinematicsEngine.js
 * 
 * Pure Mathematical Forward-Kinematic Engine for Prehistoric Gross-Motor Workouts
 * 
 * Drives all joint rotations, angular velocities, and translational offsets
 * for 3D Toddler Superhero Avatar and 3D Dinosaur Coach.
 * 
 * All 8 Prehistoric Routines:
 * 1. Velociraptor Run (138 BPM, sprint on balls of feet, 90° arm pumps, forward lean)
 * 2. Stegosaurus Walks (92 BPM, bear walk quadruped on hands/feet, hips high, 4 steps forward/backward, stomps)
 * 3. Pterodactyl Take Off (112 BPM, wide circular wing arcs, crouch, vertical takeoff leap)
 * 4. T-Rex Run (122 BPM, short arms tucked into armpits, driving high knees)
 * 5. Compsognathus Prances (126 BPM, lateral skater jumps, rear leg crossing behind, balancing arm swing)
 * 6. Brachiosaurus Stretch (78 BPM, feet together, tiptoe rise, overhead arm reach)
 * 7. The Diplodocus (74 BPM, tabletop bird-dog balance with neck reach and tail wag, smooth 30s side switch)
 * 8. Spinosaurus Stretch (64 BPM, cat-cow spine waves with dorsal sail arching)
 */

// Helper: Smooth Hermite interpolation (smoothstep)
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Helper: Linear interpolation
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * applyWorkoutKinematics
 * 
 * Updates the 3D Avatar's articulated bone hierarchy based on current workout parameters.
 * 
 * @param {Object} rig - Avatar skeletal rig returned by createAvatarRig()
 * @param {string} workoutId - One of the 8 gross-motor workout IDs
 * @param {number} clock - Elapsed workout time in seconds
 * @param {number} tempoBpm - Workout tempo in BPM
 * @param {number} remainingTime - Workout countdown timer in seconds (60 down to 0)
 * @param {boolean} isHalfwayFlipped - Explicit flag for 30s Diplodocus side switch
 */
export function applyWorkoutKinematics(rig, workoutId = 'velociraptor_run', clock = 0, tempoBpm = 120, remainingTime = 60, isHalfwayFlipped = false) {
  if (!rig || !rig.bones) return;

  const b = rig.bones;
  const root = rig.root;

  // Reset bones to base transforms first
  root.reset();

  // Angular progress phase theta(t) = 2*PI * (BPM / 60) * t
  const theta = 2 * Math.PI * (tempoBpm / 60) * clock;

  switch (workoutId) {
    // -------------------------------------------------------------------------
    // 1. VELOCIRAPTOR RUN (138 BPM)
    // High-speed sprint on balls of feet, 90° arm pumps, forward chest lean
    // -------------------------------------------------------------------------
    case 'velociraptor_run': {
      const stridePhase = 1.7 * theta;
      const bounce = Math.abs(Math.sin(stridePhase));

      // Root & Pelvis bounce + forward speed lean
      b.pelvis.position.y = b.pelvis.basePosition.y - 0.12 * bounce;
      b.pelvis.rotation.x = 0.24; // 14° forward pitch
      b.chest.rotation.x = 0.18;
      b.head.rotation.x = -0.15; // Chin up looking forward

      // 90° Locked Arm Pumps (opposing phase)
      b.forearmL.rotation.x = 1.57; // 90° locked
      b.forearmR.rotation.x = 1.57;
      b.armL.rotation.x = Math.sin(stridePhase + Math.PI) * 0.96; // 55° pump
      b.armR.rotation.x = Math.sin(stridePhase) * 0.96;
      b.shoulderL.rotation.y = 0.10;
      b.shoulderR.rotation.y = -0.10;

      // Legs: Running on balls of feet (plantarflexion +25° on both ankles)
      b.thighL.rotation.x = Math.sin(stridePhase) * 0.96;
      b.calfL.rotation.x = Math.max(0.17, -Math.sin(stridePhase) * 1.40);
      b.footL.rotation.x = 0.44; // 25° on balls of feet

      b.thighR.rotation.x = Math.sin(stridePhase + Math.PI) * 0.96;
      b.calfR.rotation.x = Math.max(0.17, -Math.sin(stridePhase + Math.PI) * 1.40);
      b.footR.rotation.x = 0.44;

      // Billowing Cape flutter swept back by aerodynamic drag
      b.cape.rotation.x = -0.75 + Math.sin(clock * 14) * 0.20;
      b.cape.rotation.z = Math.cos(clock * 10) * 0.12;
      break;
    }

    // -------------------------------------------------------------------------
    // 2. STEGOSAURUS WALKS (92 BPM)
    // Bear walk quadruped on hands and feet, hips high, 4 steps forward/backward, stomps
    // -------------------------------------------------------------------------
    case 'stegosaurus_walks': {
      // Lower root close to floor, hips elevated higher than shoulders (+45°)
      b.pelvis.position.y = b.pelvis.basePosition.y - 0.34;
      b.pelvis.rotation.x = 0.785; // 45° forward pitch
      b.spine.rotation.x = -0.28;
      b.chest.rotation.x = -0.25;
      b.neck.rotation.x = 0.45;
      b.head.rotation.x = 0.20; // Looking forward

      // 8-beat periodic travel displacement (4 steps forward, 4 steps backward)
      const travelDisplacement = Math.sin(0.55 * theta) * 0.35;
      root.position.z = travelDisplacement;

      // Front legs (arms reaching down to floor)
      const armStepPhase = 2 * theta;
      b.shoulderL.rotation.x = 1.36; // 78° reaching down
      b.shoulderR.rotation.x = 1.36;
      b.armL.rotation.x = 0.26 + Math.sin(armStepPhase) * 0.31;
      b.armR.rotation.x = 0.26 + Math.sin(armStepPhase + Math.PI) * 0.31;
      b.forearmL.rotation.x = 0.26;
      b.forearmR.rotation.x = 0.26;

      // Back legs (hips back, knees bent, stomping)
      b.thighL.rotation.x = -0.87 + Math.sin(armStepPhase + Math.PI) * 0.35;
      b.calfL.rotation.x = 0.44;
      b.thighR.rotation.x = -0.87 + Math.sin(armStepPhase) * 0.35;
      b.calfR.rotation.x = 0.44;

      // Cape rests along angled spine
      b.cape.rotation.x = -0.30 + Math.sin(clock * 4) * 0.08;
      break;
    }

    // -------------------------------------------------------------------------
    // 3. PTERODACTYL TAKE OFF (112 BPM)
    // Wide circular wing arcs, crouch squat, vertical takeoff leap
    // -------------------------------------------------------------------------
    case 'pterodactyl_takeoff': {
      const cycleT = 3.0;
      const tau = clock % cycleT;

      if (tau < 1.8) {
        // Phase A: Standing tall with fast circular wing wind-up loops
        b.pelvis.position.y = b.pelvis.basePosition.y + Math.sin(clock * 6) * 0.04;
        // Arms spread wide in fast 3D circular rotations
        b.shoulderL.rotation.z = 1.22; // 70° abduction
        b.shoulderR.rotation.z = -1.22;
        b.armL.rotation.x = Math.sin(9 * clock) * 1.50 - 1.20;
        b.armL.rotation.z = Math.cos(9 * clock) * 0.80;
        b.armR.rotation.x = Math.sin(9 * clock) * 1.50 - 1.20;
        b.armR.rotation.z = -Math.cos(9 * clock) * 0.80;
        b.forearmL.rotation.x = 0.15;
        b.forearmR.rotation.x = 0.15;

        // Legs straight
        b.thighL.rotation.x = 0;
        b.thighR.rotation.x = 0;
        b.calfL.rotation.x = 0;
        b.calfR.rotation.x = 0;
      } else if (tau < 2.1) {
        // Phase B: Deep crouch squat (1.8s - 2.1s)
        const crouchProg = (tau - 1.8) / 0.3;
        b.pelvis.position.y = b.pelvis.basePosition.y - 0.45 * smoothstep(0, 1, crouchProg);
        b.thighL.rotation.x = 1.48 * crouchProg; // 85° deep knee flexion
        b.thighR.rotation.x = 1.48 * crouchProg;
        b.calfL.rotation.x = -1.55 * crouchProg;
        b.calfR.rotation.x = -1.55 * crouchProg;

        // Arms cocked back ready to explode
        b.armL.rotation.x = 0.85;
        b.armR.rotation.x = 0.85;
        b.shoulderL.rotation.z = 0.40;
        b.shoulderR.rotation.z = -0.40;
      } else {
        // Phase C: BLAST OFF VERTICAL LEAP (2.1s - 3.0s)
        const leapProg = (tau - 2.1) / 0.9; // 0 to 1
        const apexY = Math.sin(leapProg * Math.PI) * 0.85; // Rockets up +0.85m apex
        b.pelvis.position.y = b.pelvis.basePosition.y + apexY;

        // Arms explode straight overhead reaching to the sky (-165°)
        b.armL.rotation.x = -2.88;
        b.armR.rotation.x = -2.88;
        b.forearmL.rotation.x = 0;
        b.forearmR.rotation.x = 0;
        b.shoulderL.rotation.z = 0.20;
        b.shoulderR.rotation.z = -0.20;

        // Legs fully extended with toes pointed down (+35° plantarflexion)
        b.thighL.rotation.x = -0.15;
        b.thighR.rotation.x = -0.15;
        b.calfL.rotation.x = 0;
        b.calfR.rotation.x = 0;
        b.footL.rotation.x = 0.61; // 35° toes down
        b.footR.rotation.x = 0.61;

        // Cape trailing straight down below body
        b.cape.rotation.x = 0.40 + Math.sin(clock * 16) * 0.15;
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 4. T-REX RUN (122 BPM)
    // Short arms tucked tight in armpits, driving high knees up to hands
    // -------------------------------------------------------------------------
    case 'trex_run': {
      const runPhase = 1.25 * theta;
      const stompBounce = Math.abs(Math.sin(runPhase));

      b.pelvis.position.y = b.pelvis.basePosition.y - 0.15 * stompBounce;
      b.pelvis.rotation.x = 0.20;
      b.chest.rotation.x = 0.15;

      // Arms: Signature short arms locked into armpits (115° flexion)
      b.shoulderL.rotation.x = 0.44; // 25° forward
      b.shoulderR.rotation.x = 0.44;
      b.armL.rotation.x = 0.15;
      b.armR.rotation.x = 0.15;
      b.forearmL.rotation.x = 2.0; // 115° locked tight into armpits!
      b.forearmR.rotation.x = 2.0;
      b.handL.rotation.z = -0.44; // Pronated claws
      b.handR.rotation.z = 0.44;

      // Legs: Apex high knee drive lifting thighs past horizontal (+75° / 1.31 rad)
      const kneeWaveL = Math.sin(runPhase);
      const kneeWaveR = Math.sin(runPhase + Math.PI);

      b.thighL.rotation.x = Math.max(-0.25, kneeWaveL * 1.31);
      b.calfL.rotation.x = Math.max(0.15, -kneeWaveL * 1.66);

      b.thighR.rotation.x = Math.max(-0.25, kneeWaveR * 1.31);
      b.calfR.rotation.x = Math.max(0.15, -kneeWaveR * 1.66);

      // Cape flapping behind
      b.cape.rotation.x = -0.65 + Math.sin(clock * 12) * 0.18;
      break;
    }

    // -------------------------------------------------------------------------
    // 5. COMPSOGNATHUS PRANCES (126 BPM)
    // Lateral skater jumps leaping side to side, crossing rear leg behind with balancing arm swing
    // -------------------------------------------------------------------------
    case 'compsognathus_prance': {
      const skatePhase = 0.85 * theta;
      const skateDir = Math.sin(skatePhase);
      const skateApex = Math.abs(Math.cos(skatePhase));

      // Lateral Leap displacement & parabolic apex height
      root.position.x = 0.38 + skateDir * 0.45;
      b.pelvis.position.y = b.pelvis.basePosition.y + 0.20 * skateApex;
      b.pelvis.rotation.z = skateDir * 0.24; // 14° lateral lean

      if (skateDir >= 0) {
        // Leaping to the Right:
        // Right leg lands and absorbs impact (knee bent 40°)
        b.thighR.rotation.x = 0.70;
        b.calfR.rotation.x = -0.60;
        b.thighR.rotation.z = 0.10;

        // Left leg CROSSES BEHIND right leg (hip adducted +25°, extended backward -45°)
        b.thighL.rotation.x = -0.78; // -45° backward
        b.thighL.rotation.z = 0.44;  // +25° adduction cross behind
        b.calfL.rotation.x = 0.50;

        // Athletic counter-balancing arm swing
        b.armL.rotation.x = -0.85;
        b.armL.rotation.z = 0.35;
        b.armR.rotation.x = 0.85;
        b.armR.rotation.z = -0.35;
      } else {
        // Leaping to the Left:
        // Left leg lands and absorbs impact
        b.thighL.rotation.x = 0.70;
        b.calfL.rotation.x = -0.60;
        b.thighL.rotation.z = -0.10;

        // Right leg CROSSES BEHIND left leg
        b.thighR.rotation.x = -0.78;
        b.thighR.rotation.z = -0.44;
        b.calfR.rotation.x = 0.50;

        // Athletic counter-balancing arm swing
        b.armL.rotation.x = 0.85;
        b.armL.rotation.z = -0.35;
        b.armR.rotation.x = -0.85;
        b.armR.rotation.z = 0.35;
      }

      // Cape swishes diagonally
      b.cape.rotation.z = -skateDir * 0.35;
      b.cape.rotation.x = -0.45 + Math.sin(clock * 10) * 0.15;
      break;
    }

    // -------------------------------------------------------------------------
    // 6. BRACHIOSAURUS STRETCH (78 BPM)
    // Feet together, rising high onto tiptoes, reaching arms straight overhead
    // -------------------------------------------------------------------------
    case 'brachiosaurus_stretch': {
      const breathPhase = 0.5 + 0.5 * Math.sin(0.45 * theta);

      // Elongation: vertical breath rise
      b.pelvis.position.y = b.pelvis.basePosition.y + breathPhase * 0.25;
      b.spine.rotation.x = -breathPhase * 0.12; // Slight spine back extension
      b.neck.rotation.x = -0.20;
      b.head.rotation.x = -0.44; // Looking up at the stars (-25°)

      // Feet together, knees straight, rising high onto tiptoes (+35° plantarflexion)
      b.thighL.rotation.x = 0;
      b.thighR.rotation.x = 0;
      b.calfL.rotation.x = 0;
      b.calfR.rotation.x = 0;
      b.footL.rotation.x = breathPhase * 0.61; // Up to 35° tiptoes
      b.footR.rotation.x = breathPhase * 0.61;

      // Arms reaching straight overhead (-170°, elbows fully straight)
      b.shoulderL.rotation.z = 0.15;
      b.shoulderR.rotation.z = -0.15;
      b.armL.rotation.x = -2.96; // -170°
      b.armR.rotation.x = -2.96;
      b.forearmL.rotation.x = 0; // Fully straight
      b.forearmR.rotation.x = 0;

      // Gentle finger reach pulse
      b.handL.rotation.y = Math.sin(clock * 4) * 0.12;
      b.handR.rotation.y = -Math.sin(clock * 4) * 0.12;

      // Cape hangs gently down
      b.cape.rotation.x = -0.15 + Math.sin(clock * 2) * 0.05;
      break;
    }

    // -------------------------------------------------------------------------
    // 7. THE DIPLODOCUS (74 BPM)
    // Tabletop quadruped bird-dog balance with neck reach & tail wag, 30s side switch
    // -------------------------------------------------------------------------
    case 'diplodocus': {
      // Tabletop quadruped on floor (hips and spine horizontal to floor)
      b.pelvis.position.y = b.pelvis.basePosition.y - 0.38;
      b.pelvis.rotation.x = 0.96; // 55° horizontal spine
      b.spine.rotation.x = -0.10;
      b.chest.rotation.x = -0.10;
      b.neck.rotation.x = 0.40;
      b.head.rotation.x = 0.30;

      // Diplodocus 30-Second Side Switch
      // Side 1: Right Arm reaches forward (neck), Left Leg extends backward (tail wag)
      // Side 2: Left Arm reaches forward (neck), Right Leg extends backward (tail wag)
      const isSide2 = (remainingTime <= 30.0) || isHalfwayFlipped;

      // Smooth 1.0s transition blend around 30.0s
      let blend = isSide2 ? 1.0 : 0.0;
      if (Math.abs(remainingTime - 30.0) < 0.8) {
        const t = (30.8 - remainingTime) / 1.6;
        blend = smoothstep(0, 1, Math.max(0, Math.min(1, t)));
      }

      // Tail wagging oscillation in 3D (yaw ±18°, pitch ±12°)
      const tailWagYaw = Math.sin(1.5 * theta) * 0.31;
      const tailWagPitch = Math.cos(1.5 * theta) * 0.21;

      // Pose 1 values (Side 1)
      const armL_x1 = 0.85;  // Planted on floor
      const armR_x1 = -1.57; // Reaching forward horizontal
      const thighL_x1 = -1.57 + tailWagPitch; // Extended straight back horizontal
      const thighL_y1 = tailWagYaw;
      const thighR_x1 = 0.70; // Planted knee on floor
      const calfR_x1 = -0.70;

      // Pose 2 values (Side 2 - Mirrored)
      const armL_x2 = -1.57; // Reaching forward horizontal
      const armR_x2 = 0.85;  // Planted on floor
      const thighL_x2 = 0.70; // Planted knee on floor
      const calfL_x2 = -0.70;
      const thighR_x2 = -1.57 + tailWagPitch; // Extended straight back horizontal
      const thighR_y2 = tailWagYaw;

      // Blend between sides smoothly
      b.armL.rotation.x = lerp(armL_x1, armL_x2, blend);
      b.armR.rotation.x = lerp(armR_x1, armR_x2, blend);
      b.forearmL.rotation.x = lerp(0.20, 0, blend);
      b.forearmR.rotation.x = lerp(0, 0.20, blend);

      b.thighL.rotation.x = lerp(thighL_x1, thighL_x2, blend);
      b.thighL.rotation.y = lerp(thighL_y1, 0, blend);
      b.calfL.rotation.x = lerp(0, calfL_x2, blend);

      b.thighR.rotation.x = lerp(thighR_x1, thighR_x2, blend);
      b.thighR.rotation.y = lerp(0, thighR_y2, blend);
      b.calfR.rotation.x = lerp(calfR_x1, 0, blend);

      // Cape lays smoothly across back
      b.cape.rotation.x = -0.20 + Math.sin(clock * 3) * 0.06;
      break;
    }

    // -------------------------------------------------------------------------
    // 8. SPINOSAURUS STRETCH (64 BPM)
    // Restorative Cat-Cow spine waves with rounded dorsal sail arching
    // -------------------------------------------------------------------------
    case 'spinosaurus_stretch': {
      // Quadruped base on hands and knees
      b.pelvis.position.y = b.pelvis.basePosition.y - 0.38;
      b.thighL.rotation.x = 0.85;
      b.thighR.rotation.x = 0.85;
      b.calfL.rotation.x = -0.85;
      b.calfR.rotation.x = -0.85;
      b.armL.rotation.x = 1.15;
      b.armR.rotation.x = 1.15;
      b.forearmL.rotation.x = 0.20;
      b.forearmR.rotation.x = 0.20;

      // Calming Cat-Cow undulating spine wave (0.0 to 1.0)
      const wave = 0.5 + 0.5 * Math.sin(0.40 * theta);

      // Inhale: Cat Sail Arch (wave -> 1.0)
      // Spine curves up into ceiling (+35°), chin tucks to chest
      // Exhale: Cow Release (wave -> 0.0)
      // Spine softens downward (-15°), head gently lifts
      b.spine.rotation.x = lerp(-0.26, 0.61, wave);
      b.chest.rotation.x = lerp(-0.15, 0.45, wave);
      b.head.rotation.x = lerp(-0.35, 0.52, wave);
      b.pelvis.position.y = b.pelvis.basePosition.y - lerp(0.40, 0.33, wave);

      // Cape arches along back
      b.cape.rotation.x = lerp(-0.40, 0.20, wave);
      break;
    }

    default:
      break;
  }

  // Update complete forward-kinematic world matrix tree
  root.updateMatrix();
}

/**
 * applyCoachKinematics
 * 
 * Drives the 3D Dinosaur Coach's articulated joints (neck, head, jaws, tail, limbs, plates/wings/sail)
 * synchronized with the workout and toddler movements.
 */
export function applyCoachKinematics(coachRig, workoutId = 'velociraptor_run', coachId = '2', clock = 0, tempoBpm = 120, remainingTime = 60, isHalfwayFlipped = false) {
  if (!coachRig || !coachRig.bones) return;

  const b = coachRig.bones;
  const root = coachRig.root;
  root.reset();

  const theta = 2 * Math.PI * (tempoBpm / 60) * clock;

  switch (workoutId) {
    case 'velociraptor_run': {
      // Rapid sprint stride + tail counterbalancing
      const stride = 1.7 * theta;
      b.pelvis.position.y = b.pelvis.basePosition.y - 0.10 * Math.abs(Math.sin(stride));
      b.pelvis.rotation.x = 0.35; // Forward lean
      b.neck.rotation.x = -0.20 + Math.sin(stride) * 0.15;
      b.head.rotation.x = 0.10;

      // Legs
      b.thighL.rotation.x = Math.sin(stride) * 0.90;
      b.calfL.rotation.x = Math.max(0.15, -Math.sin(stride) * 1.30);
      b.thighR.rotation.x = Math.sin(stride + Math.PI) * 0.90;
      b.calfR.rotation.x = Math.max(0.15, -Math.sin(stride + Math.PI) * 1.30);

      // Arms
      b.armL.rotation.x = Math.sin(stride + Math.PI) * 0.60;
      b.armR.rotation.x = Math.sin(stride) * 0.60;

      // Tail counterbalances body lean
      b.tail1.rotation.y = Math.sin(stride * 0.5) * 0.25;
      b.tail2.rotation.y = Math.sin(stride * 0.5 - 0.4) * 0.35;
      b.tail3.rotation.y = Math.sin(stride * 0.5 - 0.8) * 0.45;
      break;
    }

    case 'stegosaurus_walks': {
      // Quadruped walking heavy steps
      const step = 2 * theta;
      b.pelvis.position.y = b.pelvis.basePosition.y - 0.18;
      root.position.z = Math.sin(0.55 * theta) * 0.35;

      b.thighL.rotation.x = Math.sin(step) * 0.35;
      b.thighR.rotation.x = Math.sin(step + Math.PI) * 0.35;
      b.armL.rotation.x = Math.sin(step + Math.PI) * 0.30;
      b.armR.rotation.x = Math.sin(step) * 0.30;

      // Head bobbing down
      b.neck.rotation.x = 0.25 + Math.sin(step) * 0.10;
      b.tail1.rotation.y = Math.sin(step * 0.5) * 0.20;
      break;
    }

    case 'pterodactyl_takeoff': {
      const cycleT = 3.0;
      const tau = clock % cycleT;

      if (tau < 1.8) {
        // Wing flapping prep
        b.armL.rotation.z = 0.80 + Math.sin(9 * clock) * 0.65;
        b.armR.rotation.z = -0.80 - Math.sin(9 * clock) * 0.65;
        b.armL.rotation.x = Math.cos(9 * clock) * 0.40;
        b.armR.rotation.x = Math.cos(9 * clock) * 0.40;
      } else if (tau < 2.1) {
        // Crouch
        b.pelvis.position.y = b.pelvis.basePosition.y - 0.30;
        b.thighL.rotation.x = 1.10;
        b.thighR.rotation.x = 1.10;
      } else {
        // Leap & Flight Hover
        const leapProg = (tau - 2.1) / 0.9;
        b.pelvis.position.y = b.pelvis.basePosition.y + Math.sin(leapProg * Math.PI) * 0.85;
        b.armL.rotation.z = 1.30 + Math.sin(clock * 16) * 0.50;
        b.armR.rotation.z = -1.30 - Math.sin(clock * 16) * 0.50;
        b.thighL.rotation.x = -0.30;
        b.thighR.rotation.x = -0.30;
      }
      break;
    }

    case 'trex_run': {
      // Short arm high-knee stomp run
      const run = 1.25 * theta;
      b.pelvis.position.y = b.pelvis.basePosition.y - 0.12 * Math.abs(Math.sin(run));
      b.armL.rotation.x = 0.65;
      b.armR.rotation.x = 0.65;
      b.thighL.rotation.x = Math.sin(run) * 0.95;
      b.thighR.rotation.x = Math.sin(run + Math.PI) * 0.95;
      b.tail1.rotation.y = Math.sin(run * 0.5) * 0.30;
      break;
    }

    case 'compsognathus_prance': {
      // Skater prances
      const skate = 0.85 * theta;
      root.position.x = -0.40 + Math.sin(skate) * 0.45;
      b.pelvis.position.y = b.pelvis.basePosition.y + 0.18 * Math.abs(Math.cos(skate));
      b.tail1.rotation.y = -Math.sin(skate) * 0.45;
      b.armL.rotation.x = Math.cos(skate) * 0.55;
      b.armR.rotation.x = -Math.cos(skate) * 0.55;
      break;
    }

    case 'brachiosaurus_stretch': {
      // Graceful neck elevation stretch
      const breath = 0.5 + 0.5 * Math.sin(0.45 * theta);
      b.neck.rotation.x = -0.45 - breath * 0.35; // Neck reaching high
      b.head.rotation.x = -0.20;
      b.pelvis.position.y = b.pelvis.basePosition.y + breath * 0.20;
      b.tail1.rotation.y = Math.sin(clock * 2) * 0.15;
      break;
    }

    case 'diplodocus': {
      // Tabletop stretch with long neck and 30s side switch
      b.pelvis.position.y = b.pelvis.basePosition.y - 0.25;
      b.neck.rotation.x = 0.10;
      b.head.rotation.x = 0.10;
      const tailWag = Math.sin(1.5 * theta) * 0.45;
      b.tail1.rotation.y = tailWag * 0.5;
      b.tail2.rotation.y = tailWag * 0.8;
      b.tail3.rotation.y = tailWag;
      break;
    }

    case 'spinosaurus_stretch': {
      // Undulating Cat-Cow spine wave
      const wave = 0.5 + 0.5 * Math.sin(0.40 * theta);
      b.spine.rotation.x = lerp(-0.20, 0.45, wave);
      b.neck.rotation.x = lerp(-0.15, 0.35, wave);
      b.tail1.rotation.x = lerp(0.15, -0.30, wave);
      break;
    }

    default:
      break;
  }

  root.updateMatrix();
}
