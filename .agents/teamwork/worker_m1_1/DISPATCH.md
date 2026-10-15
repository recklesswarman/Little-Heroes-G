## 2026-10-15T03:56:36Z
You are the 3D Graphics & Skeletal Animation Specialist (Worker M1).
Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m1_1
The authoritative requirements are located at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md
The project architecture is at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\PROJECT.md
Survey findings and exact joint kinematics formulas are at: c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_2\handoff.md
Please read these files immediately.

Write Ownership (Strict Boundary):
You EXCLUSIVELY own:
- `c:\APP\stitch_little_hero_adventures\src\services\avatarSkeletalRig.js`
- `c:\APP\stitch_little_hero_adventures\src\services\workoutKinematicsEngine.js`
- `c:\APP\stitch_little_hero_adventures\src\components\WorkoutHero3DStage.js`
You MUST NOT write to `src/services/voiceService.js`, `server/`, `vite.config.js`, or `scratch/`.

Task Requirements:
1. Implement `src/services/avatarSkeletalRig.js`:
   - Builds a procedural 3D Toddler Superhero Avatar and 3D Dinosaur Coach using Three.js (or Spline/WebGL primitives) with an articulated forward-kinematic bone hierarchy:
     Root -> Pelvis -> Spine -> Chest -> Neck -> Head -> Shoulders -> Upper Arms -> Forearms -> Hands -> Hips -> Thighs -> Calves -> Chunky Sneakers -> Cape.
   - Styled strictly in Stitch design colors: Electric Cyan (#00d2d3), Emerald Green (#2ecc71), Solar Amber (#f1c40f), Midnight Slate (#09141e). ZERO pink or purple.
2. Implement `src/services/workoutKinematicsEngine.js`:
   - Pure mathematical kinematics driving bone rotations and translations for all 8 prehistoric gross-motor routines per Explorer 2's formulas:
     1. Velociraptor Run (138 BPM, sprint on balls of feet, 90° arm pumps, forward lean)
     2. Stegosaurus Walks (92 BPM, bear walk quadruped on hands/feet, hips high, 4 steps forward/backward, stomps)
     3. Pterodactyl Take Off (112 BPM, wide circular wing arcs, crouch, vertical takeoff leap)
     4. T-Rex Run (122 BPM, short arms tucked into armpits, driving high knees)
     5. Compsognathus Prances (126 BPM, lateral skater jumps, rear leg crossing behind, balancing arm swing)
     6. Brachiosaurus Stretch (78 BPM, feet together, tiptoe rise, overhead arm reach)
     7. The Diplodocus (74 BPM, tabletop bird-dog balance with neck reach and tail wag, smooth 30s side switch)
     8. Spinosaurus Stretch (64 BPM, cat-cow spine waves with dorsal sail arching)
3. Implement `src/components/WorkoutHero3DStage.js`:
   - Mounts 3D scene side-by-side (Coach on left, Avatar on right) in the container.
   - Implements full parity contract with WorkoutHeroDuoCanvas:
     `setWorkout(workoutId, coachId, tempoBpm)`, `setTimeRemaining(seconds)`, `triggerBeat()`, `startAnimation()`, `pauseAnimation()`, `resumeAnimation()`, `stopAnimation()`, `destroy()`.
   - Robust WebGL fallback: detects WebGL availability via `isWebGLSupported()`, wraps context acquisition in try/catch, handles `webglcontextlost` by cleanly hot-swapping to `WorkoutHeroDuoCanvas` without breaking workout execution.
4. Verify build: run `npm run build` and ensure it completes with exit code 0.
5. Write your handoff report to `c:\APP\stitch_little_hero_adventures\.agents\teamwork\worker_m1_1\handoff.md` and send a message when done.
