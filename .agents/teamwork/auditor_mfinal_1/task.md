# Forensic Auditor Task: Integrity Verification

Execute forensic integrity audit on Little Hero Adventures 3D Avatar & Audio Companion codebase:
1. Static Analysis: Scan all new and modified files (`src/services/avatarSkeletalRig.js`, `src/services/workoutKinematicsEngine.js`, `src/components/WorkoutHero3DStage.js`, `src/services/voiceService.js`, `server/geminiService.js`, `vite.config.js`, `src/views/DinoWorkoutView.js`, `scratch/verify_dino_workout_e2e.mjs`).
2. Anti-Cheating Forensics:
   - Verify NO hardcoded test results, expected outputs, or verification strings in source code.
   - Verify NO dummy/facade implementations (verify genuine Float32Array matrix math and bone forward kinematics, genuine WebGL rendering pipeline, genuine audio caching Map, genuine timing logic).
   - Verify NO fabrication of test results or logs.
   - Verify genuine 3D skeletal hierarchy (21 bones) and genuine mathematical kinematics for all 8 workouts.
   - Verify strict Stitch design system adherence (Electric Cyan, Emerald Green, Solar Amber, Midnight Slate — zero pink/purple).
3. Provide binary verdict: CLEAN or INTEGRITY VIOLATION with full evidence chain in handoff.md.
