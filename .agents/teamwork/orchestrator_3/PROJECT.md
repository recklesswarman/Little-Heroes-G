# Project: Little Hero Adventures — Bedtime AI Storybook Revamp & Optimization

## Architecture

### 1. AI Story Engine & Server Routes Module
- **Files**: `src/data/bedtimeStoryData.js`, `src/services/bedtimeStoryService.js`, `server/geminiService.js`, `server.js`, `vite.config.js`, `functions/src/voiceApi.ts`
- **Responsibilities**:
  - Expose `/api/rex/bedtime-story` and `/api/gemini/bedtime-story` across Express `server.js`, Vite dev proxy (`vite.config.js`), and Firebase Cloud Functions (`functions/src/voiceApi.ts`), with client Firebase AI Logic (`gemini-2.5-flash`).
  - Strict JSON schema for 3-chapter bedtime stories: `{ title, theme, realm, morals, chapters: [{ chapterNumber, title, chapterText, whisperLine, sleepyCue, moralReflection, choices: [...], sceneMood, sceneDescriptor }] }`.
  - Combinatorial Dynamic Story Weaver in `src/data/bedtimeStoryData.js` with 12+ distinct plot archetypes per realm, dynamic sentence builders, rich per-chapter `sceneDescriptor` payloads, zero hardcoded "Rex" references, and full backward compatibility with legacy 4-chapter and 4 canonical realm queries (`space`, `dino_jungle`, `pirate_lagoon`, `enchanted_castle`).
  - Real-time per-child personalization via `buildChildStoryContext(heroId)`: child profile, today's tasks/habits (`store.getTaskCompletionsToday(heroId)`), active pet from `PETS_DATABASE`, equipped gear (`store.getEquippedHeroWeapon()`), and parent wish.
  - Anti-repetition story memory: `hero.bedtimeHistory` tracking last 25 story seeds/archetypes/titles.
  - Sibling bookshelf isolation: `bedtimeStoryLibrary` scoped per `heroId` with instant Firestore sync.

### 2. Unified ElevenLabs Voice Narration & Audio Pre-Fetching Module
- **Files**: `server/elevenLabsService.js`, `functions/src/voiceApi.ts`, `src/services/voiceService.js`, `src/views/BedtimeStoryView.js`
- **Responsibilities**:
  - Universal ElevenLabs voice resolution: default all 24 pets and bedtime storytelling to the main voice (`process.env.ELEVENLABS_REX_VOICE_ID || "e9sQs6aLWU82SSolkPYZ"`), eliminating HTTP 404 errors.
  - Bedtime voice parameter tuning: `stability: 0.65`, `similarity_boost: 0.80`, `style: 0.35`, `use_speaker_boost: true`, with cache key differentiated by `voiceStyle`.
  - Client audio pipeline enhancements in `voiceService.js`: support `timeoutMs: 18000`, `voiceStyle: 'bedtime'`, and set `source.playbackRate.value = rate` on Web Audio `AudioBufferSourceNode`s for soothing whisper cadence.
  - Background audio pre-fetching: `prefetchCompanionAudio(text, petId, options)` pre-fetches and decodes Chapter N+1 into cache while Chapter N is playing for 0ms transitions.
  - Hands-Free "Auto-Read All 3 Chapters" mode toggle alongside interactive choice paths in `BedtimeStoryView.js`.

### 3. Advanced 3D Plot-Coherent Story Stage & View Integration Module
- **Files**: `src/components/BedtimeStoryStage3D.js`, `src/views/BedtimeStoryView.js`
- **Responsibilities**:
  - Three.js / WebGL / `@splinetool/runtime` 3D Storybook Stage component with graceful high-res 2D Canvas/SVG fallback upon context loss or headless environments.
  - Automated 3D scene synthesis driven by chapter `sceneDescriptor`:
    - Articulated toddler hero avatar (with equipped gear & magic item hand socket).
    - Articulated pet companion matching all 24 pet archetypes (dino, mystic, beast, aquatic, mech).
    - Chapter 1: arrival/discovery with lantern & volumetric fireflies/aurora ribbons.
    - Chapter 2: gentle obstacle resolution with dual golden-cyan particle transformation.
    - Chapter 3: starlight slumber in cozy nest with 4s/4s harmonic breathing ring pacer.
  - Interactive 3D raycast constellations with pentatonic lullaby chimes (`playConstellationChime`).
  - Strict Explorer Palette compliance (`#09141e`, `#2ecc71`, `#00d2d3`, `#f39c12`, `#ffb961` — zero pink/purple).

### 4. Store Task/Habit & Currency Lifecycle Module
- **Files**: `src/state/store.js`
- **Responsibilities**:
  - Refactor `store.completeBedtimeStory()`:
    - Dynamically read parent-configured rewards from `getWaypointRewards('wp_bedtime')` (`sleep_on_time`).
    - Enforce one-completion-at-a-time invariant: check `store.isTaskPendingApproval('sleep_on_time', hero.id)`; if active pending submission exists, reject duplicate reward minting.
    - Auto-issue Tokens, Hero XP, and Pet Sparks immediately upon valid completion.
    - Queue Gold Points in `pendingApprovals` with full delta schema (`tokensAwarded`, `xpAwarded`, `sparksAwarded`, `pendingPoints`).
    - Ensure clean clawback on parent denial via `rejectParentRequest` per `.agents/rules/task_and_currency_lifecycle_rules.md`.

### 5. E2E Testing & Verification Track
- **Files**: `scratch/verify_bedtime_storybook.mjs`, `scratch/run_all_tests.js`, `TEST_INFRA.md`, `TEST_READY.md`
- **Responsibilities**:
  - 4-Tier test suite covering all features, boundaries, combinations, and real-world workflows.
  - Register in `scratch/run_all_tests.js`.
  - Validate production build (`npm run build`).

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | End-to-End Generative Story Routes | `/api/rex/bedtime-story` & `/api/gemini/bedtime-story` in server.js, geminiService.js, vite.config.js, voiceApi.ts, Firebase AI | M1 | ORIGINAL_REQUEST §R1 |
| F2 | Structured 3-Chapter Story Schema | 3 chapters with title, chapterText, whisperLine, sleepyCue, moralReflection, choices, sceneMood, sceneDescriptor | M1 | ORIGINAL_REQUEST §R1 |
| F3 | Combinatorial Story Weaver | 12+ archetypes per realm, dynamic sentence builders, sceneDescriptors, zero hardcoded Rex, 4 canonical realms preserved | M1 | ORIGINAL_REQUEST §R1 |
| F4 | Real-Time Per-Child Personalization | `buildChildStoryContext(heroId)` integrating profile, today's tasks, active pet from PETS_DATABASE, equipped gear, parent wish | M1 | ORIGINAL_REQUEST §R1 |
| F5 | Anti-Repetition Story Memory | `hero.bedtimeHistory` tracking last 25 story seeds/archetypes/titles as negative prompt constraints | M1 | ORIGINAL_REQUEST §R1 |
| F6 | Sibling Bookshelf Isolation | `bedtimeStoryLibrary` & `saveBedtimeStory()` scoped per `heroId` with instant Firestore sync | M1 | ORIGINAL_REQUEST §R1 |
| F7 | Universal ElevenLabs Voice Fallback | All 24 pets and bedtime storytelling resolve to main voice (`e9sQs6aLWU82SSolkPYZ`), eliminating 404s | M2 | ORIGINAL_REQUEST §R2 |
| F8 | Bedtime Voice Narration Tuning | stability: 0.65, similarity_boost: 0.80, style: 0.35, use_speaker_boost: true, cache key with voiceStyle | M2 | ORIGINAL_REQUEST §R2 |
| F9 | Extended Timeouts & Playback Rate | 18000ms timeout in fetchPcmTts, apply rate to AudioBufferSourceNode.playbackRate | M2 | ORIGINAL_REQUEST §R2 |
| F10 | Background Audio Pre-Fetching | `prefetchCompanionAudio` decodes Chapter N+1 into cache while Chapter N plays | M2 | ORIGINAL_REQUEST §R2 |
| F11 | Hands-Free Auto-Read Mode | Auto-Read All 3 Chapters toggle alongside interactive choice paths in BedtimeStoryView.js | M2 | ORIGINAL_REQUEST §R2 |
| F12 | Plot-Driven 3D Diorama Stage | `BedtimeStoryStage3D.js` dynamically synthesizing 3D scene from chapter sceneDescriptor | M3 | ORIGINAL_REQUEST §R3 |
| F13 | Articulated Toddler Hero & 24 Pet Rigs | Articulated toddler avatar with magic item socket + articulated pet companion matching all 24 pet archetypes | M3 | ORIGINAL_REQUEST §R3 |
| F14 | 3-Chapter Diorama Choreography | Ch 1 arrival/lantern/fireflies, Ch 2 gentle obstacle/particle burst, Ch 3 nest/4s-4s breathing pacer | M3 | ORIGINAL_REQUEST §R3 |
| F15 | Interactive Raycast Constellations | Click/tap 3D stars/fireflies triggers ripple and pentatonic lullaby chimes (`playConstellationChime`) | M3 | ORIGINAL_REQUEST §R3 |
| F16 | Graceful 2D Fallback & Explorer Palette | High-res 2D Canvas/SVG fallback; strict Explorer Palette (#09141e, #2ecc71, #00d2d3, #f39c12, #ffb961 - zero pink/purple) | M3 | ORIGINAL_REQUEST §R3 |
| F17 | Dynamic Parent-Configured Bedtime Rewards | `store.completeBedtimeStory` dynamically reads `getWaypointRewards('wp_bedtime')` (`sleep_on_time`) | M4 | ORIGINAL_REQUEST §R4 |
| F18 | One-Completion Payout Invariant | Rejects duplicate bedtime reward minting while `sleep_on_time` is pending parent approval | M4 | ORIGINAL_REQUEST §R4 |
| F19 | Reversible Currency Lifecycle | Auto-issues Tokens/XP/Sparks; queues Gold Points in pendingApprovals with full delta metadata; clean clawback on denial | M4 | ORIGINAL_REQUEST §R4 |
| F20 | Comprehensive 4-Tier E2E Test Suite | `scratch/verify_bedtime_storybook.mjs` verifying all features, registered in `scratch/run_all_tests.js` | M-TEST | Acceptance Criteria |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M-TEST | E2E Test Suite Creation | Create `TEST_INFRA.md` & `scratch/verify_bedtime_storybook.mjs` (Tiers 1-4), register in runner, publish `TEST_READY.md` | none | DONE |
| M1 | AI Story Engine, Routes & Personalization | `bedtimeStoryData.js`, `bedtimeStoryService.js`, `server.js`, `geminiService.js`, `vite.config.js`, `voiceApi.ts`, personalization, anti-repetition | none | DONE |
| M2 | ElevenLabs Voice & Audio Pre-Fetching | `elevenLabsService.js`, `voiceApi.ts`, `voiceService.js`, `BedtimeStoryView.js`, prefetch, auto-read | none | DONE |
| M3 | 3D Story Stage & View Integration | `BedtimeStoryStage3D.js`, `BedtimeStoryView.js`, 24 pets, chapter choreography, breathing ring, chimes, 2D fallback | M1 | DONE |
| M4 | Store & Currency Lifecycle Integration | `store.js` (`completeBedtimeStory`, `buildChildStoryContext`, sibling bookshelf, pending approvals, clawback) | M1 | DONE |
| M-FINAL | Final Verification & Hardening | Phase 1: 100% E2E test pass (Tiers 1-4). Phase 2: Adversarial coverage hardening (Tier 5), Forensic Audit, Clean build | M-TEST, M1, M2, M3, M4 | DONE |

---

## Interface Contracts

### 1. Bedtime Story Generator ↔ Story Service / Stage
```typescript
interface BedtimeStoryPayload {
  title: string;
  theme: string;
  realm: string;
  morals: string[];
  chapters: BedtimeChapter[];
}

interface BedtimeChapter {
  chapterNumber: number; // 1, 2, or 3
  title: string;
  chapterText: string;
  whisperLine: string;
  sleepyCue: string;
  moralReflection: string;
  choices: string[];
  sceneMood: string;
  sceneDescriptor: SceneDescriptor;
}

interface SceneDescriptor {
  environmentBiome: string;
  timeOfNight: 'twilight_arrival' | 'starlit_journey' | 'deep_slumber_sanctuary';
  weatherParticles: 'fireflies' | 'aurora_ribbons' | 'starlight_snow' | 'bioluminescent_spores' | 'gentle_bubbles';
  cameraWork: 'orbit_pan' | 'follow_walk' | 'crane_descend_nest';
  heroAction: 'walking_with_lantern' | 'discovering_landmark' | 'helping_obstacle' | 'curled_asleep';
  petAction: 'trotting_beside' | 'sniffing_clue' | 'glowing_magic' | 'sleeping_curled';
  keyProps: string[];
  lightingPalette: {
    ambient: string; // hex
    directional: string; // hex
    accent: string; // hex
  };
}
```

### 2. Voice Service ↔ Bedtime Narration & Pre-Fetching
```typescript
interface VoiceOptions {
  timeoutMs?: number; // default 18000 for bedtime
  rate?: number; // 0.75 - 1.0 for bedtime whisper
  pitch?: number;
  voiceStyle?: 'bedtime' | 'workout' | 'companion';
  onEnded?: () => void;
  instant?: boolean;
}

function prefetchCompanionAudio(text: string, petId: string, options?: VoiceOptions): Promise<AudioBuffer | null>;
function speakCompanion(text: string, petIdOrOptions?: string | VoiceOptions, onEnded?: () => void, options?: VoiceOptions): Promise<void>;
```

### 3. 3D Story Stage Contract (`BedtimeStoryStage3D.js`)
```typescript
interface BedtimeStoryStage3DProps {
  sceneDescriptor: SceneDescriptor;
  chapterIndex: number; // 0, 1, 2
  heroProfile: { name: string; ageTier: string; equippedGear: any };
  activePet: { id: string; name: string; archetype: string };
  magicItem: string;
  gentleObstacle: string;
  onConstellationTapped?: (constellationId: string) => void;
  isBreathingActive?: boolean;
}
```

### 4. Store Task/Habit Lifecycle Contract
```typescript
store.completeBedtimeStory(storyData: any): {
  success: boolean;
  message?: string;
  rewardCoins?: number;
  rewardXp?: number;
  sparksAwarded?: number;
  pendingPoints?: number;
}
```

---

## Code Layout
- `src/data/bedtimeStoryData.js`: Combinatorial Dynamic Story Weaver, 12+ archetypes, rich sceneDescriptors, 4 canonical realms preserved.
- `src/services/bedtimeStoryService.js`: Story orchestration, personalization context builder, anti-repetition memory.
- `server/geminiService.js`: Server-side Gemini bedtime story generator endpoint.
- `server/elevenLabsService.js`: Universal voice fallback (`e9sQs6aLWU82SSolkPYZ`) and bedtime voice tuning.
- `server.js`: Mounted `/api/rex/bedtime-story` & `/api/gemini/bedtime-story`.
- `vite.config.js`: Dev proxy for bedtime story routes and ElevenLabs TTS.
- `functions/src/voiceApi.ts`: Cloud Functions routes for bedtime story and universal ElevenLabs TTS.
- `src/services/voiceService.js`: 18s timeout, AudioBufferSourceNode playback rate, `prefetchCompanionAudio`.
- `src/components/BedtimeStoryStage3D.js`: Three.js / WebGL / Spline 3D diorama stage with 2D fallback.
- `src/views/BedtimeStoryView.js`: Mounts 3D stage, Auto-Read mode toggle, pre-fetching coordination.
- `src/state/store.js`: `completeBedtimeStory`, `buildChildStoryContext`, sibling bookshelf isolation, pending approval queue.
- `scratch/verify_bedtime_storybook.mjs`: Comprehensive 4-Tier E2E automated test suite.
