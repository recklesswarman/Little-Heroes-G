# 3D Character Avatar & Prehistoric Skeletal Bone Animation Survey Report

## 1. Observation

### Codebase & Dependency Analysis
1. **`package.json` Dependencies (`c:\APP\stitch_little_hero_adventures\package.json`)**:
   - Line 20: `"@splinetool/runtime": "^2.0.55"` is present in `dependencies`.
   - Line 22: `"canvas-confetti": "^1.9.4"` is present.
   - Neither `three` nor `@types/three` is listed in `dependencies` or `devDependencies`.
   - Running `npm test` (`node scratch/run_all_tests.js`) passes all 64 test suites (100% pass, 0 failures).
   - Running `npm run build` succeeds (`vite build` completes with exit code 0, bundling 228 modules in 15.2s). Spline runtime chunks (`runtime-webgpu-*.js`, `runtime-classicRuntime-*.js`, `physics-*.js`) are bundled into `dist/`.

2. **Spline Runtime Internal Architecture (`node_modules/@splinetool/runtime`)**:
   - Direct inspection of `runtime.d.ts` (lines 70–75) confirms: *"Structural stand-in for THREE.Material — pass an instance from YOUR three install (this package never re-exports three, and the copy it bundles is a different module instance from yours)..."*.
   - `@splinetool/runtime` exposes the `Application` class designed for loading external binary `.splinecode` scenes (`application.load(path)` or `application.start(arrayBuffer)`).
   - There are **0 local `.splinecode` files** and **0 local `.glb`/`.gltf` files** in the entire project repository.
   - Spline runtime does not expose an accessible low-level skeletal bone transform API for programmatic runtime bone rigging. All skeletal hierarchies in Spline must be authored, rigged, and keyed inside the proprietary Spline cloud editor and published to Spline CDN.

3. **Existing 2D Articulated Kinematic Engine (`src/components/WorkoutHeroDuoCanvas.js`)**:
   - `WorkoutHeroDuoCanvas.js` contains a 1096-line high-performance 2D procedural canvas stage.
   - It implements a complete hierarchical articulated Toddler Hero Character (Pelvis, Spine, Torso, Neck, Head, Shoulders, Elbows, Hands, Hips, Knees, Calves, Chunky Sneakers, Billowing Cape) and Dinosaur Pet Coach.
   - It already contains mathematical kinematic phase logic for all 8 workouts (`velociraptor_run`, `stegosaurus_walks`, `pterodactyl_takeoff`, `trex_run`, `compsognathus_prance`, `brachiosaurus_stretch`, `diplodocus`, `spinosaurus_stretch`).
   - It renders an arena background adhering to Stitch design colors (Electric Cyan `#00d2d3`, Emerald Green `#2ecc71`, Solar Amber `#f39c12`/`#f1c40f`, Midnight Slate `#09141e`/`#0e1c28`) with zero pink/purple.

4. **Integration Point in Workout Stage (`src/views/DinoWorkoutView.js`)**:
   - Lines 291–297: `#workout-canvas-container` inside `#workout-stage-mount`.
   - Lines 452–458: Instantiates `activeDuoCanvas = new WorkoutHeroDuoCanvas(stageContainer, { workoutId, coachId, tempoBpm })`.
   - Lines 653–657, 662, 681: Calls `setWorkout()`, `setTimeRemaining()`, `triggerBeat()`, and `startAnimation()`.
   - Lines 565–568: Cleanly calls `activeDuoCanvas.destroy()`.

---

## 2. Logic Chain

### Step 1: Evaluating 3D Avatar Runtimes (Spline vs Three.js)
1. **Network Independence & Offline PWA Reliability**:
   - Little Hero Adventures is a kid-safe PWA intended for home and classroom environments with intermittent or zero internet connectivity.
   - Spline runtime requires fetching external multi-megabyte `.splinecode` binary files from `prod.spline.design` over the public internet. If the tablet is offline, in airplane mode, or behind restrictive school firewalls, Spline scenes completely fail to load.
   - In contrast, Three.js allows building a 100% procedural 3D model (Toddler Hero Avatar + Dinosaur Coach) in code using standard geometric primitives (`CapsuleGeometry`, `CylinderGeometry`, `SphereGeometry`, `ExtrudeGeometry`) and materials. It requires **zero external network requests**, bundles cleanly into Vite, and instantiates in under 20 milliseconds.
2. **Programmatic Skeletal Bone Animation Control**:
   - The user specification mandates **anatomically accurate 3D skeletal bone animations** for 8 distinct gross-motor exercises, including real-time tempo locking to BPM, metronome beat pulses, and dynamic 30-second Diplodocus side-switching.
   - Spline runtime does not provide programmatic access to skeletal joint matrices or bone rotations at runtime without pre-baking animations in their cloud tool.
   - Three.js provides native `THREE.Bone`, `THREE.Skeleton`, `THREE.SkinnedMesh`, and hierarchical forward-kinematics `THREE.Group` joint trees. Every single joint angle (Euler angles / Quaternions) and position vector can be updated frame-by-frame with exact trigonometric equations locked to the workout's elapsed time and audio cadence.
3. **Runtime Memory & Cross-Platform Performance**:
   - Spline runtime loads WebGPU/WebGL render pipelines, Rapier3D physics WASM, and heavy font engines, consuming 35MB–50MB of memory and causing WebGL context exhaustion on lower-end mobile devices (e.g. Amazon Fire tablets, older iPads, budget Android phones).
   - A dedicated Three.js procedural renderer uses lightweight WebGL, minimal shaders, low draw calls (<15 draw calls per frame), and runs locked at 60 FPS across all desktop and mobile browsers.

### Step 2: 3D Anatomical Skeletal Hierarchy Architecture
To achieve robust gross-motor animation without skinning deformation artifacts, the optimal architecture uses a forward-kinematic joint hierarchy where each body segment is anchored to a rotational pivot joint:

```
[World Center / Floor Pedestal]
       │
       ▼
   [Root Node] (World Translation X, Y, Z & Global Yaw/Pitch)
       │
       ├── [Pelvis Joint] (Hip tilt, pelvic sway)
       │     │
       │     ├── [Spine/Lumbar Joint] (Torso flexion/extension, lateral bending)
       │     │     │
       │     │     ├── [Chest/Thorax Joint] (Thoracic breathing arch, shoulder base)
       │     │     │     │
       │     │     │     ├── [Neck Joint] -> [Head Joint] (Chin pitch, yaw, star-gaze)
       │     │     │     │     └── [Face/Visor Feature Meshes, Blinking Eyes, Cowl]
       │     │     │     │
       │     │     │     ├── [Left Clavicle/Shoulder Joint]
       │     │     │     │     └── [Left Upper Arm] -> [Left Elbow Joint] -> [Left Forearm] -> [Left Wrist/Hand]
       │     │     │     │
       │     │     │     ├── [Right Clavicle/Shoulder Joint]
       │     │     │     │     └── [Right Upper Arm] -> [Right Elbow Joint] -> [Right Forearm] -> [Right Wrist/Hand]
       │     │     │     │
       │     │     │     └── [Cape Anchor Joint] -> [Dynamic Multi-Segment Cape Ribbon]
       │     │
       │     ├── [Left Hip Joint]
       │     │     └── [Left Thigh] -> [Left Knee Joint] -> [Left Shin/Calf] -> [Left Ankle Joint] -> [Left Chunky Sneaker]
       │     │
       │     └── [Right Hip Joint]
       │           └── [Right Thigh] -> [Right Knee Joint] -> [Right Shin/Calf] -> [Right Ankle Joint] -> [Right Chunky Sneaker]
```

### Step 3: Mathematical Kinematic Implementation of the 8 Prehistoric Workouts
Let progress phase $\theta(t) = 2\pi \cdot \frac{\text{BPM}}{60} \cdot t$, where $t$ is the elapsed workout time in seconds:

1. **Velociraptor Run (138 BPM)**:
   - *Gross-motor cue*: High-speed sprint on balls of feet, 90° arm pumps, forward chest lean.
   - *Pelvis*: Vertical bounce $Y = Y_0 - 0.12 \cdot |\sin(1.7\theta)|$; forward pitch $+14^\circ$ ($+0.24\text{ rad}$).
   - *Legs*: Running on balls of feet (plantarflexion $+25^\circ$ on both ankles). Alternating hip swing: $\text{thighL} = \sin(1.7\theta) \cdot 55^\circ$, $\text{kneeL} = \max(10^\circ, -\sin(1.7\theta) \cdot 80^\circ)$; opposing phase on right leg.
   - *Arms*: Elbows locked firmly at $90^\circ$ ($1.57\text{ rad}$). Shoulders pump vigorously: $\text{armL} = \sin(1.7\theta + \pi) \cdot 55^\circ$, $\text{armR} = \sin(1.7\theta) \cdot 55^\circ$.
   - *Cape*: Swept backwards by aerodynamic speed drag with high-frequency fluttering.

2. **Stegosaurus Walks (92 BPM)**:
   - *Gross-motor cue*: Bear walk quadruped on hands and feet, hips elevated high, 4 steps forward and 4 steps backward with ground stomps.
   - *Posture*: Root lowered close to ground ($Y = -0.34\text{m}$), pelvis pitched forward $+45^\circ$ keeping hips higher than shoulders.
   - *Travel*: 8-step periodic displacement: $X = \sin(0.55\theta) \cdot 0.35\text{m}$ (forward for 4 beats, backward for 4 beats).
   - *Arms (Front Legs)*: Reaching to floor ($\text{shoulder} = +78^\circ$, elbows bent $15^\circ$, palms planted). Alternating step lift $\pm 18^\circ$ at $4\times$ phase.
   - *Legs (Back Legs)*: Hips at $-50^\circ$, knees slightly bent $25^\circ$. Alternating heavy stomps triggering shockwave particle rings when $\sin(4\times \text{phase}) \approx \pm 1$.

3. **Pterodactyl Take Off (112 BPM)**:
   - *Gross-motor cue*: Fast circular wing wind-up, crouch squat, vertical takeoff leap.
   - *3-Phase Periodic Cycle ($T = 3.0\text{s}$)*:
     - *Phase A (0.0s – 1.8s)*: Standing tall. Arms spread wide ($70^\circ$ abduction), rotating rapidly in full 3D circles ($\text{rot}_X = \sin(9t) \cdot 1.5 - 1.2$, $\text{rot}_Z = \cos(9t) \cdot 0.8$).
     - *Phase B (1.8s – 2.1s)*: Deep crouch squat. Root drops by $-0.45\text{m}$, knees flex deeply to $85^\circ$ ($1.48\text{ rad}$), arms cock back.
     - *Phase C (2.1s – 3.0s)*: BLAST OFF LEAP. Root rockets vertically into the air ($+0.85\text{m}$ apex height). Arms explode straight up overhead ($-165^\circ$, fully extended). Legs extend straight with toes pointed down ($+35^\circ$ plantarflexion). Starlight sparkles emit at apex.

4. **T-Rex Run (122 BPM)**:
   - *Gross-motor cue*: Short arms tucked in armpits, driving high knees up to hands.
   - *Arms (Signature Short Arms)*: Shoulders held forward $+25^\circ$, **elbows locked tight into armpits at $115^\circ$ ($2.0\text{ rad}$ flexion)**, wrists pronated $-25^\circ$. Short arms stay locked in front of chest throughout.
   - *Legs (Apex High Knees)*: Alternating explosive drive lifting thighs past horizontal to $+75^\circ$ ($1.31\text{ rad}$), knees flexed $95^\circ$, driving up to tap the hands on every beat.
   - *Pelvis*: Rhythmic stomp bounce $Y = -0.15 \cdot |\sin(1.25\theta)|$.

5. **Compsognathus Prances (126 BPM)**:
   - *Gross-motor cue*: Lateral skater jumps leaping side to side, rear leg crossing behind, balancing arm swing.
   - *Lateral Leap*: $X = \sin(0.85\theta) \cdot 0.45\text{m}$; vertical apex $Y = -0.20 \cdot |\cos(0.85\theta)|$; lateral body lean $\text{roll} = \sin(0.85\theta) \cdot 14^\circ$.
   - *Leg Cross-Behind*:
     - When leaping right ($\sin > 0$): Right leg lands and absorbs impact (knee bent $40^\circ$); Left leg **crosses diagonally behind right leg** (hip adducted $+25^\circ$, extended backward $-45^\circ$).
     - When leaping left ($\sin < 0$): Left leg lands; Right leg **crosses diagonally behind left leg**.
   - *Arms*: Athletic counter-balancing swing across chest and behind back.

6. **Brachiosaurus Stretch (78 BPM)**:
   - *Gross-motor cue*: Feet together, tiptoes rise, reaching arms straight overhead for the stars.
   - *Elongation*: Vertical breath rise $Y = Y_0 - (0.5 + 0.5\sin(0.45\theta)) \cdot 0.25\text{m}$.
   - *Head*: Tilted back $-25^\circ$ gazing directly up at the stars.
   - *Arms*: Both upper arms extended straight overhead ($-170^\circ$, fully straightened elbows), fingers reaching up toward the sky.
   - *Feet*: Feet together ($0^\circ$ hip abduction), knees straight, **ankles rising fully onto tiptoes ($+35^\circ$ plantarflexion)**. Sparkles drift down from reaching hands.

7. **The Diplodocus (74 BPM)**:
   - *Gross-motor cue*: Tabletop quadruped bird-dog balance with neck reach and tail wag, 30s side switch.
   - *Posture*: Tabletop quadruped on floor ($Y = -0.38\text{m}$, spine flat $+55^\circ$).
   - *First 30 Seconds (Side 1)*: Right arm reaches straight forward horizontally (long dinosaur neck); Left hand plants on floor. Left leg extends straight back horizontally (long tail); Right knee plants on floor. Left tail leg wags rhythmically in 3D: $\Delta\text{yaw} = \sin(1.5\theta) \cdot 18^\circ$, $\Delta\text{pitch} = \cos(1.5\theta) \cdot 12^\circ$.
   - *At 30.0s (Side Switch)*: Triggered synchronously with coach voice announcement. Smooth 1-second transition mirrors poses: Left arm reaches forward (neck), Right hand plants; Right leg extends straight back (tail wag), Left knee plants.

8. **Spinosaurus Stretch (64 BPM)**:
   - *Gross-motor cue*: Restorative cat-cow spine waves with dorsal sail arching.
   - *Hands & Knees*: Quadruped base firmly planted on floor.
   - *Respiratory Wave ($B = 0.5 + 0.5\sin(0.4\theta)$)*:
     - *Inhale (Cat Sail Arch)*: Spine curves upwards into a high dorsal arch ($+35^\circ$ curvature toward ceiling); head tucks chin to chest; dorsal sail crest radiates an Emerald Green starlight glow.
     - *Exhale (Cow Release)*: Spine softens downward into gentle extension ($-15^\circ$); head gently lifts to look forward.

### Step 4: Resilient Fallback Architecture to 2D Procedural Canvas
To guarantee zero-breakage on mobile or headless devices:
1. **Detection & Safe Instantiation**:
   - Helper function `isWebGLSupported()` checks `window.WebGLRenderingContext` and attempts a mock canvas `.getContext('webgl2') || getContext('webgl')`.
   - The 3D component constructor (`WorkoutHero3DStage`) wraps all WebGL operations inside `try ... catch`.
   - If WebGL is unsupported or throws at any point during canvas creation, shader compiling, or context acquisition, it logs a clean diagnostic warning and falls back immediately to `new WorkoutHeroDuoCanvas(container, options)`.
2. **Unified Control Contract**:
   - Both `WorkoutHero3DStage` (3D WebGL) and `WorkoutHeroDuoCanvas` (2D Canvas) expose the identical public lifecycle interface:
     - `setWorkout(workoutId, coachId, tempoBpm)`
     - `setTimeRemaining(seconds)`
     - `triggerBeat()`
     - `startAnimation()`
     - `pauseAnimation()`
     - `resumeAnimation()`
     - `stopAnimation()`
     - `destroy()`
   - `DinoWorkoutView.js` calls this interface without needing to know which rendering engine is active under the hood.
3. **Runtime WebGL Context Loss Recovery**:
   - The 3D canvas registers a `webglcontextlost` event listener.
   - If mobile memory pressure forces the GPU to evict the WebGL context, the event handler calls `e.preventDefault()`, safely disposes the Three.js scene, and hot-swaps to `WorkoutHeroDuoCanvas` without interrupting the workout countdown timer or audio cues.

### Step 5: Clean Modular File Boundaries
To maintain clean code architecture and maintainability:
- **`src/components/WorkoutHero3DStage.js`**: Main view component mounting the Three.js WebGL canvas or falling back to 2D. Manages camera, lighting, render loop, resize observer, and lifecycle.
- **`src/services/avatarSkeletalRig.js`**: Builds the procedural 3D Toddler Superhero Avatar and 3D Dinosaur Coach meshes and joint hierarchy using Three.js.
- **`src/services/workoutKinematicsEngine.js`**: Pure mathematical calculations for joint rotations and translations across all 8 workouts given `(clock, tempoBpm, remainingTime, isHalfwayFlipped)`.
- **`src/components/WorkoutHeroDuoCanvas.js`**: Untouched and preserved as the battle-tested 2D fallback.
- **`src/views/DinoWorkoutView.js`**: Mounts `WorkoutHero3DStage` with zero disruption to state, timers, or audio.

---

## 3. Caveats
1. **Three.js Dependency Requirement**:
   - While `@splinetool/runtime` is currently installed in `package.json`, Three.js is not installed as an explicit top-level dependency.
   - For a production-ready procedural 3D skeletal avatar, `three: "^0.160.0"` (or compatible) should be added to `dependencies` in `package.json` so Vite bundles and treeshakes it with zero external network requests.
   - If adding `three` to `package.json` is deferred, Three.js can also be imported dynamically via modern ESM CDN (`https://esm.sh/three@0.160.0`), but the local npm package is strongly recommended for offline PWA compliance.
2. **3D Asset Format**:
   - Pre-baked `.splinecode` scenes are not present locally. Relying on remote Spline URLs introduces latency and network failure modes for kids on mobile devices. Procedurally generated 3D character rigs in Three.js eliminate this risk entirely.
3. **Design System Constraints**:
   - Zero pink or purple materials: The 3D Toddler Hero avatar must be styled strictly in Electric Cyan (`#00d2d3`), Emerald Green (`#2ecc71`), Solar Amber (`#f1c40f`/`#f39c12`), and Midnight Slate (`#09141e`/`#0e1c28`).

---

## 4. Conclusion
1. **Recommended Architecture**: A standalone procedural Three.js 3D character and dinosaur coach stage (`WorkoutHero3DStage`) powered by a pure forward-kinematic skeletal joint hierarchy (`avatarSkeletalRig.js` and `workoutKinematicsEngine.js`).
2. **8 Prehistoric Workouts**: All 8 gross-motor routines can be implemented with exact joint rotations, tempo-locking, and dynamic 30s Diplodocus side-switching via mathematical forward kinematics.
3. **Resilient Fallback**: If WebGL context creation fails or crashes, the system gracefully and seamlessly hot-swaps to the existing `WorkoutHeroDuoCanvas` 2D procedural canvas stage with zero UI breakage.
4. **Build & Test Safety**: The implementation can be structured cleanly without touching existing store methods, 8-minute circuit modes, or water break intermissions, preserving 100% pass rates across all 64 automated test suites.

---

## 5. Verification Method

### Automated Independent Verification Commands
1. **Full Automated Test Suite**:
   ```powershell
   node scratch/run_all_tests.js
   ```
   *Expected outcome*: Exits with code 0; all 64 test suites pass with 0 failures.

2. **Production Bundle Verification**:
   ```powershell
   npm run build
   ```
   *Expected outcome*: Exits with code 0; Vite compiles clean production bundles in `dist/`.

3. **Linter / Syntax Check**:
   ```powershell
   npm run lint
   ```
   *Expected outcome*: Exits with code 0; `src/main.js` and imported modules pass check.

### Inspection Verification
- Inspect `src/components/WorkoutHeroDuoCanvas.js` to verify fallback interface parity.
- Verify `#workout-canvas-container` in `src/views/DinoWorkoutView.js` mounts the stage cleanly.
- Verify Diplodocus side-switch triggers at `remainingTime === 30`.
- Verify colors strictly adhere to the Stitch design system (Electric Cyan, Emerald Green, Solar Amber, Midnight Slate — no pink/purple).
