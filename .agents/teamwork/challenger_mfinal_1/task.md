# Challenger 1 Task: Adversarial Stress Testing of 3D Graphics & Kinematics

Empirically stress test:
1. WebGL context loss simulation (`webglcontextlost`) and recovery hot-swap to WorkoutHeroDuoCanvas under load.
2. Boundary and extreme tempo inputs (60 BPM, 180 BPM, rapid step-function BPM jumps).
3. Degenerate frame deltas (dt = 0, dt = 10,000ms pause wake-up, negative timers).
4. Rapid workout switching across all 8 routines in <10ms intervals.
5. Write adversarial stress test harness, execute it, report empirical results, and provide verdict: APPROVE or REQUEST_CHANGES in handoff.md.
