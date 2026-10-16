# Little Hero Adventures — Test Infrastructure Documentation

## Overview

This document details the test infrastructure, architecture, and verification methodology for the **Bedtime AI Storybook Upgrade** in Little Hero Adventures (`c:\APP\stitch_little_hero_adventures`).

The test suite is structured around a rigorous **4-Tier E2E Testing Methodology**, providing opaque-box, requirement-driven verification covering:
1. End-to-end generative story routes and schemas (`/api/rex/bedtime-story`, `/api/gemini/bedtime-story`).
2. Combinatorial Story Weaver with 12+ archetypes per realm, dynamic sentence builders, and zero hardcoded "Rex" references.
3. Real-time per-child personalization (`buildChildStoryContext`) incorporating active profile, today's chores/habits, active pet metadata from `PETS_DATABASE`, equipped gear, and parent wishes.
4. Anti-repetition memory (`hero.bedtimeHistory`) with 25-item rollover and negative prompt injection.
5. Sibling bookshelf isolation (`bedtimeStoryLibrary` scoped per `heroId`).
6. Universal ElevenLabs voice resolution defaulting all 24 pets and storytelling to the main voice (`e9sQs6aLWU82SSolkPYZ`) without HTTP 404s.
7. Bedtime voice narration tuning (`stability: 0.65`, `similarity_boost: 0.80`, `style: 0.35`, `use_speaker_boost: true`) and style-differentiated caching.
8. Extended 18s audio timeouts and Web Audio `AudioBufferSourceNode.playbackRate` scaling.
9. Zero-latency background audio pre-fetching (`prefetchCompanionAudio`) for Chapter N+1 during Chapter N playback.
10. Hands-free "Auto-Read All 3 Chapters" mode alongside interactive choice paths in `BedtimeStoryView.js`.
11. 3D diorama stage generation (`BedtimeStoryStage3D.js`) driven by chapter `sceneDescriptor`.
12. Articulated toddler hero avatar (with magic item socket) and 24 articulated companion pet rigs across 5 archetypes.
13. 3-chapter diorama choreography (Ch 1 arrival/lantern, Ch 2 obstacle/particle burst, Ch 3 slumber nest/breathing pacer).
14. 4s/4s harmonic breathing ring pacer.
15. Interactive 3D raycast constellations and pentatonic lullaby chimes (`playConstellationChime`).
16. Graceful 2D Canvas/SVG fallback upon context loss or headless execution with strict Explorer Palette compliance (`#09141e`, `#2ecc71`, `#00d2d3`, `#f39c12`, `#ffb961` — zero pink/purple).
17. Dynamic parent-configured bedtime rewards (`store.getWaypointRewards('wp_bedtime')` / `sleep_on_time`).
18. One-completion-at-a-time payout invariant across pending approval cycles.
19. Reversible currency lifecycle (auto-issue Tokens/XP/Sparks; queue Gold Points; clean clawback on parent denial clamped at floor 0).
20. Master test suite integration and automated verification.

---

## 4-Tier Test Architecture

```
+-----------------------------------------------------------------------------------------+
|                                4-TIER TEST ARCHITECTURE                                 |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  [TIER 1: Feature Coverage]  >=5 tests per feature for all 20 features in PROJECT.md   |
|  - Generative routes & schemas (F1-F2)       - Combinatorial Story Weaver (F3)          |
|  - Child personalization & memory (F4-F6)    - ElevenLabs voice & audio pipeline (F7-F11)  |
|  - 3D Diorama Stage & choreography (F12-F16) - Task engine & currency lifecycle (F17-F19) |
|  - Master test infrastructure (F20)          => Total: >=100 tests                      |
|                                                                                         |
|  [TIER 2: Boundary & Corner Cases]                                                      |
|  - Empty history initialization              - 25+ history rollover (FIFO eviction)     |
|  - Non-Rex pets (all 24 pets pass)           - Missing/empty tasks today fallback       |
|  - Headless WebGL context loss recovery      - Denial clawback clamped at floor 0       |
|  - Exhaustive zero pink/purple color scan    => Total: 7 suites                         |
|                                                                                         |
|  [TIER 3: Cross-Feature Combinations (Pairwise Matrix)]                                 |
|  - Realm (Whispering Woods, Starlight Cove, Cloud Kingdom, Dino Slumber, Space)        |
|  - Pet Archetype (Dino, Mystic, Beast, Aquatic, Mech)                                   |
|  - Mode (Auto-Read Hands-Free vs. Interactive Choices)                                  |
|  - Parent Bedtime Wish (custom wish vs. empty)                                          |
|                                                                                         |
|  [TIER 4: Realistic Real-World Workflows]                                               |
|  - Child bedtime routine: selection -> Ch 1 -> Ch 2 prefetch -> Ch 3 breathing nest     |
|  - Bedtime story completion & currency issuance                                         |
|  - Parent Portal review: pending approval metadata, approve vs. deny clawback            |
|  - Sibling routine isolation: Child A and Child B concurrent submissions                |
+-----------------------------------------------------------------------------------------+
```

---

## Test Directory & File Layout

| File Path | Description | Ownership |
|---|---|---|
| `scratch/verify_bedtime_storybook.mjs` | Primary 4-Tier E2E automated test suite | test_writer_mtest_1 |
| `scratch/run_all_tests.js` | Master test runner executing all project suites sequentially | Shared / Registered |
| `scratch/setup_mock_env.js` | Headless browser DOM, window, document, and localStorage mocks | Shared |
| `TEST_INFRA.md` | Test architecture, contracts, and execution guide (this file) | test_writer_mtest_1 |
| `TEST_READY.md` | Test readiness certification and milestone pass declaration | test_writer_mtest_1 |

---

## Test Execution Guide

### 1. Run Bedtime Storybook Verification Suite Directly
```bash
node scratch/verify_bedtime_storybook.mjs
```

### 2. Run Full Regression Test Runner
```bash
node scratch/run_all_tests.js
```

### 3. Syntax Verification
```bash
node --check scratch/verify_bedtime_storybook.mjs
```

---

## Environment Mocking & Headless Polyfills

`scratch/verify_bedtime_storybook.mjs` runs directly under Node.js without requiring a browser or live cloud credentials. The test suite includes self-contained polyfills for:

1. **Web Audio API (`AudioContext`)**:
   - Mocks `AudioContext`, `createBuffer`, `createBufferSource`, `createGain`, and `createOscillator`.
   - Specifically validates that `sourceNode.playbackRate.setValueAtTime(rate, currentTime)` properly applies playback rate to decoded buffers.

2. **WebGL Context (`WebGLRenderingContext`)**:
   - `createMockWebGLContext()` simulates WebGL shader compilation, program linking, buffer binding, uniform transfer, and draw calls.
   - Verifies fallback transitions when WebGL returns `null` or emits `webglcontextlost`.

3. **HTTP Server Mock (`createMockReqRes`)**:
   - Simulates Express.js `req` and `res` objects for server route controllers (`handleElevenLabsTTSRequest`, `handleBedtimeStoryRequest`).
   - Tracks response status codes (`res.status(code)`) and JSON payloads (`res.json(data)`).

4. **DOM & Canvas Elements**:
   - Powered by `scratch/setup_mock_env.js` providing `document.createElement`, `classList`, `addEventListener`, `dispatchEvent`, `getBoundingClientRect`, and 2D canvas context.

---

## Invariants & QA Escalation Protocol

Tests in `scratch/verify_bedtime_storybook.mjs` strictly assert invariants from:
- `.agents/rules/kid_voice_companion_guidelines.md` (non-blocking quiet bedtime habit logging, calm cadence, zero jarring modal interruptions).
- `.agents/rules/task_and_currency_lifecycle_rules.md` (dynamic parent-configured rewards, single payout per pending cycle, Gold Points queued for parent sign-off, clawback clamped at floor 0 upon denial).
- Stitch Design System (strictly `#09141e`, `#2ecc71`, `#00d2d3`, `#f39c12`, `#ffb961` — zero pink or purple).

If an assertion fails during milestone implementation:
1. **Test defects**: The Test Writer modifies test expectations only if specifications change.
2. **Implementation bugs**: Escalate to the assigned milestone implementing agent (M1 for AI story engine, M2 for ElevenLabs voice, M3 for 3D stage, M4 for store currency lifecycle).
