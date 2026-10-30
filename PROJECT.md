# Project: Bedtime AI Storybook Comprehensive Overhaul

## Architecture
The Bedtime AI Storybook in Little Hero Adventures delivers an immersive, calming bedtime experience for young children (ages 3–7) featuring personalized narratives, 3D Pixar-style illustrations via Cloudflare Workers AI, soothing voice narration via ElevenLabs, a responsive 3D diorama stage, and a soothing lullaby soundscape.

### Data Flow & Component Boundaries
1. **Story Generation Pipeline**:
   - `BedtimeStoryView.js` requests a story via `bedtimeStoryService.startStory()`.
   - Context is constructed via `buildChildStoryContext(heroId)` incorporating active pet, today's completed chores, parent bedtime wishes, and past 25 story records (`hero.bedtimeHistory` including `recentOpenings`).
   - Generates 4 rich chapters (~180–220 words per chapter) via online Gemini route (`/api/gemini/bedtime-story` or `/api/rex/bedtime-story`) or offline combinatorial dynamic weaver (`generateFullBedtimeStory` in `bedtimeStoryData.js`).
   - Anti-repetition registry enforces strict ban on stock clichés and formulaic whisper lines.
2. **Illustration & Cache Pipeline**:
   - `bedtimeIllustrationService.generateChapterIllustration()` receives full unabridged chapter text, `sessionId`, `chapterIndex`, and a randomized seed (`Math.floor(Math.random() * 2147483647)`).
   - Cache key is computed as `${sessionId}_ch${chapterIndex}_${md5(fullChapterText)}`.
   - Prompts contain unabridged narrative context and negative prompt strictly enforcing Explorer Palette (zero pink or purple).
3. **Voice & Audio Pipeline**:
   - Audio narration routes through `voiceService.js` and `server/elevenLabsService.js` using canonical voice ID `e9sQs6aLWU82SSolkPYZ` with bedtime settings (stability 0.65, similarity 0.80, speed 0.85).
   - `sfx.js` lullaby synthesizer ducks to 15% volume during narration and smoothly swells back up over 1.2s on chapter transitions.
4. **Hands-Free Slumber Pacing**:
   - All mid-story question banners, decision chips, and mic listening interruptions are removed.
   - Once narration finishes, the app pauses for 3 seconds of gentle lullaby music, then automatically advances to the next chapter.
   - A manual "Turn Page ➡️" button remains accessible at all times.
   - `BedtimeStoryStage3D.js` aligns with the 4-chapter narrative arc, activating the slumber nest and breathing pacer on Chapter 4 (index 3).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Full Chapter Text in Illustration Prompt | Cloudflare Workers AI prompt includes full unabridged chapter text (~180–220 words) | M2 | R1 |
| 2 | Unique Session & Text-Bound Cache Keys | Illustration cache key bound to `sessionId + chapterIndex + md5(fullChapterText)` | M2 | R1 |
| 3 | Dynamic Seed Entropy & Palette Guard | Pass `Math.floor(Math.random() * 2147483647)` and negative prompt enforcing Explorer Palette (no pink/purple) | M2 | R1 |
| 4 | 4-Chapter Narrative Expansion | Expand chapters to ~180–220 words each (~750–850 words total, 7–8 min) across 4 arcs | M1 | R2 |
| 5 | Anti-Repetition Registry & Sentence Builders | Ban stock clichés ("smiled happily beside", etc.); dynamic sentence builders and whisper lines | M1 | R2 |
| 6 | Seed Rotation & History Memory | Persist `hero.bedtimeHistory` with `recentOpenings`; rotate combinatorial seeds away from past stories | M1 | R2 |
| 7 | Removal of Mid-Story Choices & Questions | Remove question banners, mic button ("SPEAK TO REX"), and suggestion chips from UI and narrative prose | M3 | R3 |
| 8 | Hands-Free Auto-Advance & Turn Page | 3s gentle lullaby pause after narration ends before auto-advance; manual "Turn Page ➡️" button | M3 | R3 |
| 9 | Unified Canonical ElevenLabs Voice | Standardize on voice ID `e9sQs6aLWU82SSolkPYZ` with bedtime settings (stability 0.65, similarity 0.80, speed 0.85) | M3 | R4 |
| 10 | Dynamic Lullaby Synthesizer Ducking | Synthesizer ducks to 15% volume during speech and smoothly swells back up during chapter transitions | M3 | R4 |
| 11 | 3D Stage 4-Chapter Synchronization | Update `BedtimeStoryStage3D.js` so nest and breathing ring activate on Chapter 4 (index 3) | M3 | R2/R3 |
| 12 | Opaque-Box E2E Test Suite | 4-tier test suite covering feature tests, boundaries, pairwise combinations, and real-world scenarios | E2E Track | Testing |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Narrative & Anti-Repetition Engine | 4-chapter expansion, anti-repetition registry, banned phrases, combinatorial sentence builders, history memory with recent openings | none | DONE |
| M2 | Unique AI Illustrations & Cache Integrity | Full text in prompts, md5 cache keys (`session + index + md5(text)`), seed entropy, negative prompt palette guard | M1 interface | DONE |
| M3 | Slumber Pacing, Turn Page & Unified Voice | Remove choice/mic/question UI, 3s auto-advance, manual turn page, ElevenLabs `e9sQs6aLWU82SSolkPYZ`, lullaby ducking/swelling, 3D stage sync | M1, M2 | DONE |
| M4 | Final Integration & Adversarial Hardening | Phase 1: 100% E2E test pass (Tiers 1-4); Phase 2: Adversarial coverage hardening (Tier 5); full regression suite | M1, M2, M3, E2E Track | DONE |
| E2E | Opaque-Box E2E Test Suite | 4-tier test suite covering feature tests, boundaries, pairwise combinations, and real-world scenarios | none | DONE (TEST_READY.md published) |

---

## Interface Contracts

### 1. Narrative Generator ↔ Story Service & Stage (`M1 ↔ M2, M3`)
```javascript
// Each chapter object in story.chapters:
{
  chapterIndex: number,     // 0, 1, 2, 3
  chapterNumber: number,    // 1, 2, 3, 4
  title: string,            // e.g. "Chapter 1: The Starlit Threshold"
  text: string,             // ~180–220 words narrative
  chapterText: string,      // Identical to text
  whisperLine: string,      // Non-formulaic, soothing relaxation whisper
  sleepyCue: string,        // Somatic cue (e.g. "relax heavy shoulders")
  moralReflection: string,  // Reflection on active moral
  sceneMood: string,        // Visual mood descriptor
  sceneDescriptor: {        // 3D diorama choreography
    environmentBiome: string,
    timeOfNight: string,    // 'twilight_arrival' | 'starlit_journey' | 'deep_slumber_sanctuary'
    weatherParticles: string,
    cameraWork: string,
    heroAction: string,
    petAction: string,
    keyProps: string[],
    lightingPalette: string[]
  }
}
```

### 2. Story Service ↔ Illustration Service (`M1, M3 ↔ M2`)
```javascript
// Parameters to bedtimeIllustrationService.generateChapterIllustration(params)
{
  sessionId: string,        // e.g. "story_1729821234567"
  chapterIndex: number,     // 0, 1, 2, 3
  chapterNumber: number,    // 1, 2, 3, 4
  chapterText: string,      // Full unabridged ~180–220 words chapter text
  chapterTitle: string,
  realmId: string,
  heroName: string,
  petName: string,
  petArchetype: string,
  seed: number              // Math.floor(Math.random() * 2147483647)
}
// Cache Key Specification:
// `${sessionId}_ch${chapterIndex}_${computeMd5(chapterText)}`
```

### 3. Voice Service & Audio Synthesizer (`M3`)
```javascript
// ElevenLabs Bedtime Voice Options:
{
  voiceStyle: 'bedtime',
  timeoutMs: 25000,
  rate: 0.85,
  pitch: 1.0
}
// Voice ID: 'e9sQs6aLWU82SSolkPYZ'
// Settings: { stability: 0.65, similarity_boost: 0.80, style: 0.35, speed: 0.85, use_speaker_boost: true }
// Sound.duckLullaby(true) -> ducks lullaby volume to 15%
// Sound.duckLullaby(false) -> smoothly swells lullaby volume back to 100% over 1.2s
```

---

## Code Layout
- `src/data/bedtimeStoryData.js`: Procedural story generation, combinatorial sentence builders, anti-repetition registry, banned phrases.
- `src/services/bedtimeStoryService.js`: Bedtime story lifecycle orchestrator, child context builder, auto-advance coordinator.
- `src/utils/md5.js`: Lightweight pure JS MD5 hash utility for collision-free cache keys.
- `src/services/bedtimeIllustrationService.js`: Client illustration service with full text prompts, seed entropy, and MD5 cache keys.
- `server/imageGenService.js`: Server-side image generation proxy with full text prompts and Cloudflare Workers AI forwarding.
- `cloudflare-worker/worker.js`: Cloudflare Workers AI edge worker passing seed entropy and negative prompt.
- `src/views/BedtimeStoryView.js`: Cinema storybook UI, hands-free auto-advance, prominent Turn Page button, removal of choice/mic UI.
- `src/services/voiceService.js`: Audio narration pipeline, ElevenLabs TTS routing, background pre-fetching.
- `src/audio/sfx.js`: Web Audio lullaby synthesizer with 15% ducking and smooth swelling.
- `server/elevenLabsService.js`: ElevenLabs TTS backend route with canonical voice `e9sQs6aLWU82SSolkPYZ`.
- `src/components/BedtimeStoryStage3D.js`: Articulated 3D diorama stage synchronized to 4-chapter narrative arc.
