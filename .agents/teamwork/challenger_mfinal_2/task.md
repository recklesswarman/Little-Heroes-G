# Challenger 2 Task: Adversarial Stress Testing of Hybrid Audio & Cadence Engine

Empirically stress test:
1. Audio collision stress: trigger multiple cadence lines, cheers, and mascot taps simultaneously to verify anti-overlapping speechGeneration safeguards and stopRex cleanup.
2. Zero-latency vs cold start: compare latency between pre-warmed cache hits and cache misses; verify fallback chain without network crashes.
3. Cadence timing under rapid pause/resume: simulate 100 rapid pause/resume cycles during a 60-second move; verify cadence cues never double-fire or miss.
4. Diplodocus 30s synchronous announcement vs visual flip timing under timer jitter.
5. Write adversarial stress test harness, execute it, report empirical metrics, and provide verdict: APPROVE or REQUEST_CHANGES in handoff.md.
