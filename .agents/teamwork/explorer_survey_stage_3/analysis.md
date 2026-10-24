# In-Depth Survey & Architecture Report: 3D Diorama Stage & Store/Currency Lifecycle
**Agent**: Explorer 3 (3D Stage & Currency Explorer)  
**Date**: 2026-10-16T01:30:00Z  
**Target Milestone**: Bedtime AI Storybook Upgrade (`c:\APP\stitch_little_hero_adventures`)  
**Directives**: User Request `## 2026-10-16T01:20:55Z` & `.agents/rules/task_and_currency_lifecycle_rules.md`

---

## Executive Summary
This survey conducts a comprehensive investigation into the two core architectural pillars assigned to Explorer 3:
1. **The 3D Diorama Stage & Visual Experience**: Designing the new dedicated `src/components/BedtimeStoryStage3D.js` component to dynamically render chapter scenes driven by `sceneDescriptor`, an articulated toddler hero avatar + articulated active pet matching all 24 archetypes, chapter-specific choreography (Chapter 1 discovery/lantern, Chapter 2 obstacle resolution/particle burst, Chapter 3 slumber nest/4s-4s breathing pacer), interactive raycast constellations with pentatonic chimes, resilient 2D Canvas/SVG fallback, and strict Explorer Palette enforcement (zero pink/purple).
2. **The Store & Currency Lifecycle Integration**: Analyzing `src/state/store.js` (`completeBedtimeStory`, `getWaypointRewards`, `isTaskPendingApproval`, `enqueuePendingApproval`, `rejectParentRequest`, `approveParentRequest`) to eliminate hardcoded rewards, enforce the strict one-completion-at-a-time payout invariant across pending approval cycles, auto-issue Tokens, Hero XP, and Pet Sparks immediately, queue Gold Points in `pendingApprovals` with full delta metadata, and guarantee clean reversible clawbacks upon parent denial.
3. **Automated Verification Infrastructure**: Reviewing `scratch/run_all_tests.js` and designing the comprehensive verification suite `scratch/verify_bedtime_storybook.mjs`.

---

## Part 1: 3D Stage & Visuals Survey (`BedtimeStoryStage3D.js`)

### 1.1 Current Codebase State
- **File Status**: `src/components/BedtimeStoryStage3D.js` does NOT currently exist in the codebase.
- **Current Presentation in View**: `src/views/BedtimeStoryView.js` (lines 450–477) currently renders a static or procedural SVG inside `#interactive-illustration-container` using `currentAct.svgArt`.
- **Existing 3D Implementations in Codebase**:
  1. `src/components/WorkoutHero3DStage.js` (670 lines): Pure WebGL stage using custom vertex (`VS_SOURCE`) and fragment (`FS_SOURCE`) shaders, matrix operations (`mat4Perspective`, `mat4LookAt`, `mat4Multiply`), a forward-kinematics `BoneNode` rig, procedural buffer geometries, metronome ripple rings, and hot-swap fallback to `WorkoutHeroDuoCanvas` on `webglcontextlost`.
  2. `src/services/avatarSkeletalRig.js` (1,347 lines): Comprehensive pure JavaScript FK bone hierarchy for the Toddler Superhero Avatar (`createAvatarRig`) and Dinosaur Coach (`createCoachRig`). Includes 3D geometric primitives (`createSphereGeometry`, `createCylinderGeometry`, `createBoxGeometry`, `createCapeGeometry`, `createPlateGeometry`, `createSailGeometry`, `createRingGeometry`).
  3. `src/services/hanaBattle3DService.js` (2,861 lines): Integrates `@splinetool/runtime` `Application` alongside WebGL and 2D canvas shaders.
  4. `src/components/Pet3DViewer.js` & `src/services/pet3DService.js`: Interactive pet viewer supporting drag rotation, petting reactions, and stage evolution.
  5. `src/services/petSkeletalBodyService.js`: Bone-and-mesh deformation and Verlet cloth cape simulation for companion pets.

### 1.2 Proposed Architecture for `BedtimeStoryStage3D.js`
`BedtimeStoryStage3D` should be constructed as a modular, high-performance WebGL / Three.js component that mounts directly into the storybook illustration viewport.

```
+----------------------------------------------------------------------------------+
|                              BedtimeStoryStage3D                                 |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  | WebGL Scene / Three.js Pipeline (Fallback: 2D Procedural Canvas / SVG)     |  |
|  |                                                                            |  |
|  |  [3D Camera]: orbit_pan / follow_walk / crane_descend_nest                 |  |
|  |  [3D Lights]: Ambient (Midnight Slate) + Key + Cyan Rim + Lantern Point    |  |
|  |  [Weather Particles]: Fireflies / Aurora Ribbons / Starlight Snow / Bubbles |  |
|  |                                                                            |  |
|  |  +---------------------------+       +----------------------------------+  |  |
|  |  | 3D Articulated Toddler    |       | 3D Articulated Companion Pet     |  |  |
|  |  | Hero Avatar               |       | (All 24 Pet Archetypes)          |  |  |
|  |  | - Cowl Helmet & Cape      | <---> | - Dinos, Mystics, Beasts,        |  |  |
|  |  | - Hand Magic Item Socket  |       |   Aquatics, Mechs                |  |  |
|  |  | - Chapter Kinematic Pose  |       | - Chapter Kinematic Pose         |  |  |
|  |  +---------------------------+       +----------------------------------+  |  |
|  |                                                                            |  |
|  |  [Chapter 1]: Terrain Path + 3D Magic Item + Volumetric Fireflies          |  |
|  |  [Chapter 2]: Arched Bridge / Landmark + Gentle Obstacle + Particle Burst  |  |
|  |  [Chapter 3]: Cozy Nest + Slumber Pose + 4s/4s Harmonic Breathing Pacer    |  |
|  |                                                                            |  |
|  |  [Interactive Constellations]: Raycast Touch/Click -> Lullaby Chime Audio  |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
```

### 1.3 Dynamic Scene Construction from `sceneDescriptor`
Each chapter generated by `bedtimeStoryService.js` (via `/api/gemini/bedtime-story`, `/api/rex/bedtime-story`, or the procedural weaver) includes a structured `sceneDescriptor`. The 3D stage parses this object on chapter transitions:

| Descriptor Field | Expected Values | 3D Stage Realization |
|---|---|---|
| `environmentBiome` | `whispering_woods`, `starlight_cove`, `cloud_kingdom`, `dino_slumber_valley`, `crystal_cavern`, `underwater_coral_sanctuary` | Biome geometry: rolling hills, moss mounds, crystal stalagmites, coral formations, or fluffy cloud planes. |
| `timeOfNight` | `twilight_arrival` (Ch 1), `starlit_journey` (Ch 2), `deep_slumber_sanctuary` (Ch 3) | Adjusts ambient and background clear color: dark teal twilight -> deep sapphire -> midnight slate `#09141e`. |
| `weatherParticles` | `fireflies`, `aurora_ribbons`, `starlight_snow`, `bioluminescent_spores`, `gentle_bubbles` | Instanced particle system with sinusoidal drift, soft glow, and alpha pulse. |
| `cameraWork` | `orbit_pan`, `follow_walk`, `crane_descend_nest` | Smooth camera position & target interpolation (`mat4LookAt` or Three.js camera tweening). |
| `heroAction` | `walking_with_lantern`, `discovering_landmark`, `helping_obstacle`, `curled_asleep` | Drives avatar rig forward kinematics (leg stride, raised arm, reaching gesture, curled sleep). |
| `petAction` | `trotting_beside`, `sniffing_clue`, `glowing_magic`, `sleeping_curled` | Drives companion pet bone rotations & emissive particle glow. |
| `keyProps` | Landmarks, bridges, crystal trees, sleepy creatures, chosen magic item & gentle obstacle | 3D procedural meshes rendered at designated scene coordinates. |
| `lightingPalette` | Explorer Palette hex values | Key light (`#ffb961`), rim light (`#00d2d3`), point lights (`#f39c12`), ambient (`#09141e`). |

### 1.4 Articulated Hero Avatar & 24 Pet Archetypes
1. **Articulated Toddler Hero Rig**:
   - Reuses and adapts the bone hierarchy from `src/services/avatarSkeletalRig.js`:
     `pelvis -> spine -> chest -> neck -> head`, `shoulder[L/R] -> arm[L/R] -> forearm[L/R] -> hand[L/R]`, `hip[L/R] -> thigh[L/R] -> calf[L/R] -> foot[L/R]`, `cape`.
   - **Hand Sockets**: Right hand holds the chapter's 3D magic item:
     - *Starlight Lantern*: 3D cylinder + sphere with warm glowing yellow core (`#ffb961`) and real-time point light source.
     - *Whispering Compass*: 3D dial with rotating needle (`#00d2d3`).
     - *Feather Quilt / Blanket*: Translucent folded mesh (`#2ecc71`).
     - *Moonstone Flute*: Slender cylinder with musical sparkle particles.
   - Equipped hero armor and cape dynamically match child's equipped inventory.

2. **24 Pet Archetypes Support**:
   The catalog in `src/data/petsData.js` categorizes all 24 pets into 5 archetypes:
   - **Prehistoric Dinos (8 pets)**: Rex (T-Rex), Raptor (Velociraptor), Stego (Stegosaurus), Pterry (Pterodactyl), Chomper (T-Rex), Brachio (Brachiosaurus), Dippy (Diplodocus), Spino (Spinosaurus).
     *Features*: Quadruped/biped stances, wagging multi-joint tail, dorsal plates/sail, elongated neck, or wing membranes.
   - **Dragons & Mystics (5 pets)**: Pyro the Dragon, Aero the Griffin, Blaze the Phoenix, Luna the Unicorn, Kira the Kirin.
     *Features*: Spreadable wings, glowing horn/crest, feathered plumes, golden hooves.
   - **Wild Beasts (6 pets)**: Leo the Lion, Stripe the Tiger, Fang the Wolf, Scout the Eagle, Shadow the Panther, Barnaby the Bear.
     *Features*: Fluffy mane, quadruped prowling bones, round or pointed ears, swooping wings.
   - **Aquatic Guardians (3 pets)**: Hydra the Sea Serpent, Gnasher the Shark, Ollie the Otter.
     *Features*: Undulating spine body, dorsal fin, flippers, playful rolling animations.
   - **Tech Mechs (2 pets)**: Boulder the Crystal Golem, Cosmo the Cyber Mech.
     *Features*: Segmented crystalline armor, glowing visor antenna, robotic stride.
   - Each archetype maps to procedural 3D geometric rig components with dynamic color mapping (`color`, `accentColor`, `darkColor` from `PETS_DATABASE`).

### 1.5 Specific Chapter Choreography
- **Chapter 1 (Arrival & Discovery)**:
  - Hero and companion pet walk along a glowing cobblestone / crystal path into the chosen realm.
  - Camera follows in a gentle angled side-tracking view (`follow_walk`).
  - Hero holds the illuminated 3D magic item casting a soft light circle on the terrain.
  - Drifting volumetric weather particles (e.g. fireflies gently orbiting).
- **Chapter 2 (Gentle Obstacle Resolution)**:
  - Camera pans forward (`orbit_pan`) to reveal a 3D obstacle prop (e.g. arched stone bridge with yawning troll, hollow ancient tree with sleepy owl, mossy crystal pond with baby star).
  - Hero and pet halt, gesture toward the obstacle (`heroAction: 'helping_obstacle'`, `petAction: 'glowing_magic'`).
  - Upon interaction or chapter midpoint, a dual-color particle transformation burst (`#ffb961` warm amber and `#00d2d3` electric cyan) radiates from the obstacle, transforming it into a peaceful, smiling sleepy state.
- **Chapter 3 (Deep Starlight Slumber)**:
  - Camera cranes gently downward and tilts (`crane_descend_nest`) into a cozy 3D slumber sanctuary nest (woven twigs, starlight moss, or soft cloud pillows).
  - Hero and companion pet lie down together in curled slumber poses (`curled_asleep`, `sleeping_curled`).
  - **Harmonic Breathing Ring Pacer**: A 3D circular glowing ring encircles the nest, expanding and contracting with a calming 8-second cycle:
    - `0s - 4s`: Inhale — ring smoothly expands from scale `0.9` to `1.2`, emissive intensity softens.
    - `4s - 8s`: Exhale — ring smoothly contracts back to `0.9`, gentle starlight glow settles.
  - Sky environment dims gradually to deep midnight slate (`#09141e`).

### 1.6 Interactive 3D Raycast Constellations & Lullaby Chimes
- Stars and fireflies rendered in the 3D scene maintain normalized 3D coordinates.
- On user pointer down / tap:
  - An internal 3D raycaster tests intersection against interactive celestial bodies.
  - On hit, an expanding 3D ripple ring is emitted at the star's world position.
  - `playConstellationChime()` triggers `Sound.playBedtimeChime(freq)` with pentatonic frequencies: `[523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]` (C5, D5, E5, G5, A5, C6).
  - A subtle floating musical note or sparkle ascends and fades out.

### 1.7 Resilient WebGL Fallback
- `isWebGLSupported()` performs canvas context testing before WebGL initialization.
- If WebGL is unavailable, or if `webglcontextlost` is emitted during execution:
  - Immediately detaches WebGL resources and instantiates a high-fidelity 2D Canvas fallback engine (`BedtimeStoryStage2DFallback` or procedural SVG).
  - The fallback continues running the same 4s/4s breathing ring cycle, interactive constellation taps, and scene transitions without throwing runtime exceptions.

### 1.8 Strict Explorer Palette Compliance
- Verified colors across all materials, lights, background clears, and particles:
  - Midnight Slate: `#09141e` (RGB: `0.035, 0.078, 0.118`)
  - Emerald Green: `#2ecc71` (RGB: `0.180, 0.800, 0.443`)
  - Electric Cyan: `#00d2d3` (RGB: `0.000, 0.824, 0.827`)
  - Solar Amber / Orange: `#f39c12` (RGB: `0.953, 0.612, 0.071`)
  - Warm Amber: `#ffb961` (RGB: `1.000, 0.725, 0.380`)
- **Prohibited**: Zero magenta, pink (`#ec4899`, `#ff69b4`), or purple (`#a855f7`, `#8b5cf6`).

---

## Part 2: Store & Currency Lifecycle Survey (`src/state/store.js`)

### 2.1 Current Implementation Analysis (`store.completeBedtimeStory`)
Located at `src/state/store.js` (lines 9420–9523):
```javascript
completeBedtimeStory(storyData) {
  const savedStory = this.saveBedtimeStory(storyData);

  const hero = this.state.selectedHero;
  const coinsAwarded = 30;
  const sparksAwarded = 15;
  const xpAwarded = 20;
  const pendingPoints = Math.round(coinsAwarded / 2);

  if (hero) {
    hero.coins = (hero.coins || 0) + coinsAwarded;
    hero.xp = (hero.xp || 0) + xpAwarded;
    this.addPetSparks(hero.activePetId, sparksAwarded, hero.id);
    ...
```

**Critical Defects in Existing Implementation**:
1. **Hardcoded Rewards**: Coins (`30`), sparks (`15`), and XP (`20`) are hardcoded, ignoring parent-configured rewards from `getWaypointRewards('wp_bedtime')` or `sleep_on_time`.
2. **Missing Pending Approval Check (Duplicate Minting Vulnerability)**:
   It does NOT call `this.isTaskPendingApproval('sleep_on_time', hero.id)`. As a result, if a child completes the bedtime story multiple times while a prior submission is pending parent approval, `hero.coins`, `hero.xp`, and pet sparks are incremented repeatedly!
3. **Flawed Completion Log Gate**:
   Line 9460 only checks `if (this.getTaskCompletionsToday('sleep_on_time', hero.id).length === 0)` before creating the log and pending approval, but the currency was *already minted unconditionally above* in lines 9430–9432.
4. **Hardcoded Rex Assumption in Action Log**:
   Line 9510 logs: `Read "${storyData.title || 'Bedtime Story'}" with Rex.` regardless of which pet companion is active.

### 2.2 Parent-Configured Dynamic Reward Lookup
In `src/state/store.js`, `getWaypointRewards(waypointId)` (lines 1914–1929) correctly checks parent custom settings for chores:
```javascript
getWaypointRewards(waypointId) {
  const waypoint = PATH_OF_VALOR_WAYPOINTS.find(w => w.id === waypointId);
  if (!waypoint) return null;
  const taskConfig = this.getTaskConfig(waypoint.choreKey);
  ...
  return { coins, points, xp, sparks };
}
```
For `wp_bedtime`, `waypoint.choreKey` resolves to `sleep_on_time`.
`store.completeBedtimeStory` must dynamically retrieve:
```javascript
const wpRewards = this.getWaypointRewards('wp_bedtime') || {
  coins: 30,
  points: 15,
  xp: 20,
  sparks: 15
};
const coinsAwarded = Number(wpRewards.coins) || 30;
const pointsToQueue = Number(wpRewards.points) || Math.round(coinsAwarded / 2);
const xpAwarded = Number(wpRewards.xp) || 20;
const sparksAwarded = Number(wpRewards.sparks) || 15;
```

### 2.3 Strict One-Completion-at-a-Time Invariant
Per `.agents/rules/task_and_currency_lifecycle_rules.md` (Rule 1):
- A task/habit may only have one active completion payout pending at any given time.
- Implementation pattern (matching `completeWaypointChore`, lines 9151–9157):
```javascript
const heroId = hero?.id || 'hero_1';
if (this.isTaskPendingApproval('sleep_on_time', heroId) || this.isTaskPendingApproval('bedtime_story', heroId)) {
  return {
    success: false,
    alreadyPending: true,
    story: savedStory,
    message: 'Bedtime story completion is already pending parent sign-off.'
  };
}
if (this.getTaskCompletionsToday('sleep_on_time', heroId).length > 0) {
  return {
    success: false,
    alreadyCompleted: true,
    story: savedStory,
    message: 'Bedtime routine already completed today.'
  };
}
```

### 2.4 Auto-Issuance & Pending Approvals Schema
Once validated that no pending approval exists:
1. **Auto-Issue**:
   - `hero.coins = (hero.coins || 0) + coinsAwarded;`
   - `hero.xp = (hero.xp || 0) + xpAwarded;`
   - `this.addPetSparks(hero.activePetId, sparksAwarded, heroId);`
2. **Queue Gold Points**:
   Enqueued in `this.state.pendingApprovals` via `this.enqueuePendingApproval(...)` with full delta metadata:
   ```javascript
   {
     id: approvalReqId,
     logId: logId,
     kidId: hero.id,
     kidName: hero.name,
     type: 'task_point_approval',
     taskId: 'sleep_on_time',
     taskTitle: storyData.title || 'Bedtime Story',
     title: storyData.title || 'Bedtime Story',
     zone: "Today's Path",
     pendingPoints: pointsToQueue,
     tokensAwarded: coinsAwarded,
     xpAwarded: xpAwarded,
     sparksAwarded: sparksAwarded,
     date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
     timestamp: nowIso,
     status: 'pending'
   }
   ```
3. **1:1 Parity Sync**:
   Mark aliases in `habitIslands` and `taskForest` (`sleep_on_time`, `bedtime_story`, `wp_bedtime`) as `completed: true, pointsApproved: false`.

### 2.5 Reversible Denial & Approval Lifecycle
- **Parent Approval (`store.approveParentRequest`)**:
  - Awards `req.pendingPoints` to `hero.points`.
  - Points are NOT converted to screen time minutes.
  - Removes request from `pendingApprovals` and marks log `status: 'approved'`.
  - Resets task so it can be completed again in future cycles.
- **Parent Denial (`store.rejectParentRequest`)**:
  - Investigated in lines 5478–5544 of `src/state/store.js`:
    ```javascript
    const tokensToClawback = Number(req.tokensAwarded) || 0;
    const xpToClawback = Number(req.xpAwarded) || 0;
    const sparksToClawback = Number(req.sparksAwarded) || 0;

    hero.coins = Math.max(0, (hero.coins || 0) - tokensToClawback);
    hero.xp = Math.max(0, (hero.xp || 0) - xpToClawback);
    if (sparksToClawback > 0) {
      this.deductPetSparks(petId, sparksToClawback, hero.id);
    }
    ```
  - When `completeBedtimeStory` records `tokensAwarded`, `xpAwarded`, and `sparksAwarded` on the pending approval object, `rejectParentRequest` seamlessly claws back the exact granted amounts (clamped at 0 floor), marks the completion log as `rejected`, and clears the task state so the child can re-attempt it.

---

## Part 3: Test Infrastructure & Verification Plan

### 3.1 Existing Test Suite Survey (`scratch/run_all_tests.js`)
- `scratch/run_all_tests.js` executes 56+ individual test suites sequentially via `spawnSync('node', [file])`.
- Existing bedtime tests:
  - `scratch/test_bedtime_storybook.cjs`: Tests 4 realms, SVG fallback, library saving, habit completion, and view rendering.
  - `scratch/test_bedtime_sanctuary.cjs`: Tests sanctuary state, pajamas completion, lullaby toggle.
  - `scratch/verify_bedtime_moral_expansion.mjs`: Tests 30-day moral wheel rotation and non-repeating moral selection.
  - `scratch/verify_bedtime_quest7_sugar_fortress.mjs`: Tests evening toothbrush quest coupling.
  - `scratch/verify_bedtime_waypoint_marks_done.js`: Tests waypoint completion on the World Adventure Map.

### 3.2 Design Plan for `scratch/verify_bedtime_storybook.mjs`
The new comprehensive test file `scratch/verify_bedtime_storybook.mjs` will be created and added to `scratch/run_all_tests.js`. It will execute 12 verification sections:

1. **3D Stage Initialization & WebGL Lifecycle**:
   - `BedtimeStoryStage3D` instantiates without errors in simulated DOM.
   - Context acquisition, resize handling, and matrix initialization.
   - Context loss handler switches cleanly to 2D fallback without crashing.
2. **Plot-Driven Scene Synthesis**:
   - Accepts chapter `sceneDescriptor` (biomes, timeOfNight, weatherParticles, cameraWork, heroAction, petAction, keyProps, lightingPalette).
   - Validates proper geometry selection and camera framing per chapter.
3. **Articulated Toddler Hero & 24 Pet Archetypes**:
   - Verifies hero bone rig and magic item socket attachment.
   - Verifies all 24 pets across the 5 archetypes (dino, mystic, beast, aquatic, mech) instantiate proper 3D rigs and color assignments.
4. **Chapter Choreography Verification**:
   - Chapter 1: Arrival path, lantern light point source, fireflies.
   - Chapter 2: Gentle obstacle revelation, helper gesture, golden-cyan particle transformation.
   - Chapter 3: Slumber nest, curled sleeping poses, 4s/4s harmonic breathing ring pacer.
5. **Interactive 3D Constellations & Pentatonic Chimes**:
   - Tapping/raycasting celestial stars triggers 3D ripple and invokes `Sound.playBedtimeChime` / `playConstellationChime` with valid pentatonic frequencies.
6. **Strict Explorer Palette Enforcement**:
   - Deep scans all 3D materials, particle colors, lighting palettes, and styles for prohibited pink/purple hex values.
7. **Dynamic Reward Inheritance (`completeBedtimeStory`)**:
   - Verifies reward amounts dynamically inherit parent portal configuration via `store.getWaypointRewards('wp_bedtime')`.
8. **One-Completion-at-a-Time Invariant**:
   - Submitting a second bedtime story while an approval is pending returns `alreadyPending: true` and refuses to issue duplicate tokens, XP, or sparks.
9. **Pending Approvals Schema & Persistence**:
   - Confirms `pendingApprovals` record contains full delta schema (`tokensAwarded`, `xpAwarded`, `sparksAwarded`, `pendingPoints`, `kidId`, `taskId: 'sleep_on_time'`, `status: 'pending'`).
10. **Reversible Denial Flow (Clawback Floor 0)**:
    - Denying the bedtime approval claws back auto-issued tokens, XP, and sparks clamped at floor 0, resets task to uncompleted, and allows re-completion.
11. **Approval Flow (Gold Points Credited, No Screen Time Conversion)**:
    - Approving credits Gold Points directly to the child's balance without altering screen time minutes.
12. **Multi-Child Data Isolation**:
    - Concurrent completions by Child A and Child B maintain strict balance and pending approval isolation.

---

## Part 4: Implementation Roadmap & File Change Matrix

| Component | Target File | Action Required |
|---|---|---|
| **3D Diorama Stage** | `src/components/BedtimeStoryStage3D.js` | **Create new file**: Implement articulated toddler avatar + 24 pet rigs, chapter choreography (Ch 1 lantern, Ch 2 particle burst, Ch 3 slumber nest + 4s/4s breathing pacer), raycast constellation chimes, 2D fallback, Explorer palette. |
| **Story View Integration** | `src/views/BedtimeStoryView.js` | **Update**: Mount `BedtimeStoryStage3D` into story stage; support Hands-Free "Auto-Read All 3 Chapters" mode toggle alongside interactive choice paths; route constellation taps to 3D stage. |
| **Store & Currency Lifecycle** | `src/state/store.js` | **Update `completeBedtimeStory` (lines 9420–9523)**: Query `getWaypointRewards('wp_bedtime')`, enforce `isTaskPendingApproval` invariant, auto-issue tokens/XP/sparks, queue Gold Points in `pendingApprovals` with full schema, link to `sleep_on_time`. |
| **Story Service Scene Generation** | `src/services/bedtimeStoryService.js` | **Update**: Generate structured 3-chapter stories with complete `sceneDescriptor` payloads, background pre-fetching, and 3D stage updates. |
| **Procedural Fallback Weaver** | `src/data/bedtimeStoryData.js` | **Update**: Combinatorial story weaver generating 3 chapters with rich `sceneDescriptor` objects and dynamic pet co-stars. |
| **Automated Verification Suite** | `scratch/verify_bedtime_storybook.mjs` | **Create new file**: Implement the 12-section test suite. |
| **Master Test Runner** | `scratch/run_all_tests.js` | **Update**: Register `scratch/verify_bedtime_storybook.mjs` in `testFiles` array. |
