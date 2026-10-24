# Plan: Bedtime AI Storybook Revamp & Optimization

## Objectives
Completely overhaul the Bedtime AI Storybook in Little Hero Adventures across:
1. R1: Generative AI Story Engine (server routes, Gemini Flash, client Firebase AI, Combinatorial Weaver, real-time personalization, anti-repetition, sibling bookshelf isolation).
2. R2: Unified ElevenLabs Voice Narration (universal voice `e9sQs6aLWU82SSolkPYZ`, 18s timeout, Web Audio playback rate, Chapter N+1 pre-fetching, Hands-Free Auto-Read).
3. R3: Advanced 3D Plot-Coherent Story Stage (Three.js diorama driven by `sceneDescriptor`, articulated hero & pet, chapter choreography, interactive lullaby constellations, 2D fallback, strict Explorer Palette).
4. R4: Store Task/Habit & Currency Lifecycle Integration (`store.completeBedtimeStory`, one-payout invariant, immediate Tokens/XP/Sparks, queued Gold Points, reversible clawback on denial).
5. Verification: Comprehensive 4-tier E2E test suite (`scratch/verify_bedtime_storybook.mjs`), regression suite (`scratch/run_all_tests.js`), and production build (`npm run build`).

## Execution Pipeline
### Phase 0: Survey & Scoping
- Spawn 3 parallel Explorers:
  - Explorer 1: Story Engine, Data, & Server Routes
  - Explorer 2: ElevenLabs Voice Narration & Audio Pre-Fetching
  - Explorer 3: 3D Story Stage & Store Currency Lifecycle
- Synthesize findings into `PROJECT.md` Feature Inventory & Interface Contracts.

### Dual Tracks:
- **Track 1: E2E Testing Track (M-TEST)**:
  - Build `TEST_INFRA.md` & `scratch/verify_bedtime_storybook.mjs` (Tiers 1-4).
  - Publish `TEST_READY.md`.
- **Track 2: Implementation Track**:
  - M1: Story Engine, Server Routes, & Combinatorial Weaver
  - M2: Voice Pipeline, Pre-fetching, & Hands-Free Auto-Read
  - M3: 3D Plot-Coherent Diorama Stage & Interactive Constellations
  - M4: State Store, Bedtime Routine Completion, & Currency Lifecycle
  - M-FINAL: Full E2E Verification (Tiers 1-4) + Adversarial Hardening (Tier 5) + Forensic Integrity Audit + Clean Build.
