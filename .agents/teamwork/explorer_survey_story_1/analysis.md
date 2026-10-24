# Bedtime AI Story Engine, Data Models & Server Architecture Analysis

**Agent:** Explorer 1 (Story Engine & Server Explorer)  
**Target Project:** `c:\APP\stitch_little_hero_adventures`  
**Date:** 2026-10-16  
**Status:** Investigation & Architecture Specification Complete  

---

## Executive Summary

This report delivers a comprehensive architectural survey of the Bedtime Story generation engine, data structures, server API routes, and personalization systems across Little Hero Adventures. It details the existing implementations, identifies structural gaps and incompatibilities, and establishes explicit interface contracts, schema definitions, and implementation blueprints for:

1. **The Combinatorial Dynamic Story Weaver & Data Catalogs (`src/data/bedtimeStoryData.js`)**
2. **Real-Time Per-Child Personalization & Anti-Repetition (`buildChildStoryContext(heroId)` & `hero.bedtimeHistory`)**
3. **Sibling Bookshelf Isolation & Firestore Sync (`bedtimeStoryLibrary` scoped per child)**
4. **End-to-End Server API Routes & Cloud Functions (`server/geminiService.js`, `server.js`, `vite.config.js`, `functions/src/voiceApi.ts`)**
5. **Structured 3-Chapter Story & 3D `sceneDescriptor` JSON Schema**
6. **Client-Side Firebase AI Logic Integration (`gemini-2.5-flash`)**
7. **Task, Habit & Currency Lifecycle Integration (`store.completeBedtimeStory()`)**

---

## 1. Current State Assessment & Gap Analysis

### 1.1 `src/data/bedtimeStoryData.js`
- **Current Structure:**
  - `BEDTIME_REALMS`: Currently defines 4 fantasy realms: `space` (Cosmic Starlight Space), `dino_jungle` (Dinosaur Fossil Jungle), `pirate_lagoon` (Treasure Island Pirate Lagoon), and `enchanted_castle` (Enchanted Knight Citadel).
  - `BEDTIME_MORALS`: 18 morals spanning emotional regulation, honesty, bravery, and seasonal milestones.
  - `CONSTELLATION_STICKERS`: 12 celestial star badges.
  - `generateProceduralBedtimeStory(realmId, moralId, heroName, activePetName, customWish, chapterIndex, userChoices)`:
    - Generates 4 chapters (0: Departure, 1: Discovery, 2: Challenge/Moral, 3: Slumber).
    - Hardcodes `"Rex"` in narrative text lines 478, 490, 502, and 513 regardless of `activePetName`.
    - Only contains 1 fixed sentence structure per realm/chapter without dynamic plot archetypes.
    - Does **not** produce `whisperLine`, `sleepyCue`, `moralReflection`, `choices`, `sceneMood`, or the structured `sceneDescriptor` object needed for the 3D diorama stage.
  - `generateFallbackSvg`:
    - Renders 2D static SVGs for the 4 realms.
    - Hardcodes a cartoon dinosaur with space helmet/nightcap in the SVGs, which does not match active pets (e.g. Bella bunny, Aqua drake, Pip phoenix).

### 1.2 `src/services/bedtimeStoryService.js`
- **Current Structure:**
  - Designed around an obsolete 4-act structure (`actNumber: 1` through `4`), generating one chapter at a time.
  - Generation order: First attempts `generateBedtimeChapterAGY` (`/api/rex/bedtime-story`), then falls back to `firebaseAI.model.generateContent` (`gemini-2.5-flash-lite`), then falls back to `generateProceduralBedtimeStory`.
  - In Node test environments or without server running, `/api/rex/bedtime-story` fails with `Failed to parse URL from /api/rex/bedtime-story`.
  - Client-side Firebase AI Logic in `firebaseAILogicService.js` uses `gemini-2.5-flash-lite` without structured JSON schema enforcement, resulting in potential markdown wrapping.
  - Speech narration relies on `speakCompanion(text, petId, callback, { rate, pitch })`.
  - Does not support background pre-fetching of Chapter N+1 audio buffers.
  - Does not provide hands-free "Auto-Read All 3 Chapters" mode.

### 1.3 Server & Cloud Functions (`server/`, `server.js`, `vite.config.js`, `functions/src/voiceApi.ts`)
- **Current Route State:**
  - `server.js` mounts:
    - `POST /api/gemini/tts`
    - `POST /api/gemini/chat`
    - `POST /api/elevenlabs/tts`
    - **Missing:** `POST /api/rex/bedtime-story` and `POST /api/gemini/bedtime-story`.
  - `vite.config.js` middlewares proxy:
    - `/api/gemini/tts`, `/api/elevenlabs/tts`, `/api/gemini/chat`.
    - **Missing:** `/api/rex/bedtime-story` and `/api/gemini/bedtime-story`.
  - `functions/src/voiceApi.ts` mounts:
    - `/api/elevenlabs/tts` (with bug: returns 404 for non-Rex pets).
    - `/api/gemini/tts`.
    - **Missing:** `/api/rex/bedtime-story` and `/api/gemini/bedtime-story`.
  - `server/elevenLabsService.js`:
    - `ELEVENLABS_VOICE_MAP` only contains `rex`. Returns HTTP 404 for all other 23 pets.

### 1.4 State Management & Store Invariants (`src/state/store.js`)
- **`bedtimeStoryLibrary`:**
  - `getBedtimeStoryLibrary()` returns `this.state.bedtimeStoryLibrary` globally without filtering by `heroId`.
  - Sibling A and Sibling B share a single unisolated library.
  - `saveBedtimeStory(storyData)` saves stories without ensuring a `heroId` attribute.
- **`hero.bedtimeHistory`:**
  - Logs `{ moralId, title, timestamp }`. Does not store combinatorial seeds, plot archetypes, or chapter openings for negative prompt injection.
- **`completeBedtimeStory(storyData)`:**
  - Coins (30), sparks (15), and xp (20) are currently hardcoded instead of being read from parent settings via `store.getWaypointRewards('wp_bedtime')`.
  - Does not enforce the **one completion payout at a time** rule with `isTaskPendingApproval('sleep_on_time', hero.id)`.

---

## 2. Real-Time Per-Child Personalization Engine (`buildChildStoryContext(heroId)`)

### 2.1 Function Specification
`buildChildStoryContext(heroId, options = {})` extracts a complete snapshot of the active child's world to inject into both generative AI prompts and the offline Combinatorial Story Weaver.

```javascript
/**
 * Assembles a comprehensive child story personalization context.
 * @param {string} [heroId] - Child hero profile ID (defaults to selected hero)
 * @param {Object} [options] - Additional story options (realmId, moralId, customWish, etc.)
 * @returns {ChildStoryContext}
 */
export function buildChildStoryContext(heroId = null, options = {}) { ... }
```

### 2.2 Data Contract: `ChildStoryContext`
```typescript
interface ChildStoryContext {
  // 1. Child Profile
  child: {
    heroId: string;
    name: string;
    ageTier: '3-4' | '5-6' | '7+';
    level: number;
    title: string;          // e.g. "Brave Starlight Guardian"
    streak: number;
  };

  // 2. Daytime Accomplishments (Today's Completed Chores & Habits)
  daytimeAccomplishments: {
    taskIds: string[];
    taskTitles: string[];   // e.g. ["Brushed teeth clean", "Tidied building blocks"]
    summarySentence: string; // e.g. "Liam brushed his teeth sparkling clean and tidied his toys"
    celebrationHook: string; // Tailored sentence for realm celebration
  };

  // 3. Active Companion Pet (From PETS_DATABASE)
  activePet: {
    id: string;             // "1", "2", "3", etc.
    key: string;            // "rex", "raptor", "stego", "sparky"
    name: string;           // "Raptor the Velociraptor"
    shortName: string;      // "Raptor"
    title: string;          // "The Lightning Sprinter"
    element: string;        // "Volcanic Magma & Sunrise Bolt"
    archetype: 'dino' | 'dragon' | 'beast' | 'aquatic' | 'robot' | 'mystic';
    backstory: string;
    emoji: string;
    actionVerb: string;     // e.g. "sprints ahead with glowing tail"
  };

  // 4. Equipped Gear & Interactive Choices
  gearAndChoices: {
    equippedWeapon: {
      id: string;
      title: string;        // e.g. "Laser Toothbrush Saber"
      description: string;
      icon: string;
    };
    realm: {
      id: string;           // e.g. "whispering_woods"
      name: string;
      biome: string;
      accentColor: string;
    };
    moral: {
      id: string;           // e.g. "brave_dark"
      name: string;
      guidance: string;
      petAction: string;
      slumberResolution: string;
    };
    magicItem: string;      // e.g. "Starlight Lantern", "Whispering Compass"
    gentleObstacle: string; // e.g. "Lost Baby Star", "Sleepy Bridge Troll"
    parentWish: string;     // e.g. "Liam was brave at swimming lessons today"
  };

  // 5. Anti-Repetition Constraints & Seed Rotation
  antiRepetition: {
    recentTitles: string[];      // Last 25 generated titles to ban
    recentArchetypes: string[];  // Last 25 plot archetype IDs to ban
    forbiddenKeywords: string[]; // Realm-specific repeated patterns
    deterministicSeed: number;   // Seed rotated away from last 25 seeds
  };
}
```

### 2.3 Store Query Implementation Details
1. **Child Profile Resolution:**
   ```javascript
   const hero = (store.state.heroes || []).find(h => h.id === effectiveHeroId) || store.state.selectedHero;
   const ageTier = hero.age ? (hero.age <= 4 ? '3-4' : hero.age <= 6 ? '5-6' : '7+') : '5-6';
   const heroTitle = hero.title || (hero.level >= 10 ? 'Grand Master Hero' : hero.level >= 5 ? 'Brave Starlight Guardian' : 'Little Explorer');
   ```
2. **Completed Habits Today (`getTaskCompletionsToday`):**
   ```javascript
   const todayStr = new Date().toISOString().split('T')[0];
   const validLogsToday = (store.state.taskCompletionLogs || []).filter(log => 
     (!effectiveHeroId || log.heroId === effectiveHeroId) &&
     (log.completedAt || '').startsWith(todayStr) &&
     log.status !== 'rejected'
   );
   const completedTitles = Array.from(new Set(validLogsToday.map(l => l.taskTitle || l.taskId))).slice(0, 4);
   const summary = completedTitles.length > 0 
     ? completedTitles.join(', ')
     : 'brushed teeth and tidied their room';
   ```
3. **Active Pet Companion (`PETS_DATABASE` lookup):**
   ```javascript
   import { PETS_DATABASE } from '../data/petsData.js';
   const petId = String(hero.activePetId || '1');
   const petData = PETS_DATABASE.find(p => String(p.id) === petId || p.key === petId) || PETS_DATABASE[0];
   ```
4. **Equipped Weapon:**
   ```javascript
   const weaponObj = store.getEquippedHeroWeapon(true) || {
     id: 'laser_toothbrush',
     title: 'Laser Toothbrush Saber',
     description: 'A glowing photon saber that brushes away nighttime shadows',
     icon: 'swords'
   };
   ```

---

## 3. Anti-Repetition Memory & Sibling Bookshelf Isolation

### 3.1 `hero.bedtimeHistory` Data Model
Stored directly on each child's hero object in Firestore (`/households/{householdId}/heroes/{heroId}`):
```typescript
interface BedtimeHistoryEntry {
  id: string;               // Unique story ID (e.g. "story_1729041234567")
  seed: number;             // Deterministic combinatorial seed
  archetypeId: string;      // e.g. "lost_baby_constellation"
  realmId: string;          // e.g. "whispering_woods"
  title: string;            // e.g. "Liam and Raptor in the Whispering Woods"
  moralId: string;          // e.g. "brave_dark"
  chapterOpenings: string[];// First 40 chars of each chapter
  timestamp: number;        // UTC epoch ms
}
```
- **Cap:** Maintained at the most recent 25 entries.
- **Negative Constraints Prompt Injection:**
  ```text
  STRICT ANTI-REPETITION MANDATE:
  The child has recently enjoyed these stories:
  Titles: ["Liam and Raptor's Starlight Voyage", "The Sleepy Stego of Slumber Valley", ...]
  Plot Archetypes: ["lost_baby_constellation", "bridge_of_whispers", ...]
  YOU MUST NEVER reuse these titles, opening premises, or plot archetypes. Invent a completely fresh journey!
  ```

### 3.2 Sibling Bookshelf Isolation Model
Currently, `store.state.bedtimeStoryLibrary` is a flat array without child filtering.
**Updated Method Contracts:**
1. `store.getBedtimeStoryLibrary(heroId = null)`:
   ```javascript
   getBedtimeStoryLibrary(heroId = null) {
     if (!this.state.bedtimeStoryLibrary) {
       this.state.bedtimeStoryLibrary = [];
     }
     const targetHeroId = heroId || this.state.selectedHero?.id;
     if (!targetHeroId) return this.state.bedtimeStoryLibrary;
     return this.state.bedtimeStoryLibrary.filter(s => !s.heroId || s.heroId === targetHeroId);
   }
   ```
2. `store.saveBedtimeStory(storyData, heroId = null)`:
   ```javascript
   saveBedtimeStory(storyData, heroId = null) {
     const targetHeroId = storyData.heroId || heroId || this.state.selectedHero?.id || 'hero_1';
     const storyId = storyData.id || `story_${Date.now()}`;
     const newStory = {
       ...storyData,
       id: storyId,
       heroId: targetHeroId,
       heroName: storyData.heroName || this.state.selectedHero?.name || 'Little Hero',
       constellationStickerId: storyData.constellationStickerId || 'starlight_dino',
       isFavorite: Boolean(storyData.isFavorite),
       savedAt: storyData.savedAt || Date.now()
     };
     const idx = this.state.bedtimeStoryLibrary.findIndex(s => s.id === storyId);
     if (idx >= 0) {
       this.state.bedtimeStoryLibrary[idx] = newStory;
     } else {
       this.state.bedtimeStoryLibrary.unshift(newStory);
     }
     this.saveState(true); // Triggers real-time Firestore sync
     return newStory;
   }
   ```

---

## 4. Combinatorial Dynamic Story Weaver (`src/data/bedtimeStoryData.js`)

### 4.1 Realm Catalog Expansion
The catalog must provide the 4 canonical realms (preserving compatibility with existing test suites) plus the 6 extended bedtime realms:

| Realm ID | Display Name | 3D Environment Biome | Key Landmarks & Props | Ambient Sound |
|---|---|---|---|---|
| `space` | Cosmic Starlight Space | Asteroid Meadow & Dock | Rocket, Satellite, Moon Rings | `space_drone` |
| `dino_jungle` | Dinosaur Fossil Jungle | Glowing Fern Canopy | Hot Spring, Fern Arch, Sleepy Stego | `jungle_night` |
| `pirate_lagoon` | Treasure Island Pirate Lagoon | Turquoise Shallows & Cove | Sloop Ship, Conch Shell Cave, Hammock | `ocean_waves` |
| `enchanted_castle` | Enchanted Knight Citadel | Hearthstone Tower & Courtyard | Turret Spire, Gargoyle Nook, Ember Hearth | `hearth_fire` |
| `whispering_woods` | Whispering Woods | Luminescent Forest Glade | Hollow Ancient Tree, Glowing Mushrooms | `forest_crickets` |
| `starlight_cove` | Starlight Cove | Bioluminescent Ocean Tidepool | Sea Glass Reef, Singing Slumber Whale | `ocean_lullaby` |
| `cloud_kingdom` | Cloud Kingdom | Floating Cumulus Islands | Moonbeam Bridge, Cloud Sheep Hammock | `cloud_breeze` |
| `dino_slumber_valley` | Dino Slumber Valley | Prehistoric Hot Springs Basin | Mossy Geyser Nest, Soft Amber Lava Lamp | `warm_geyser` |
| `crystal_cavern` | Crystal Cavern | Musical Geode Grotto | Chime Stalactites, Mirror Glade Pool | `crystal_chimes` |
| `coral_sanctuary` | Underwater Coral Sanctuary | Deep Marine Starlight Lagoon | Velvet Anemone Beds, Bioluminescent Jellies | `underwater_bubbles` |

### 4.2 12+ Plot Archetypes Matrix
Each realm supports 12+ combinatorial plot archetypes:
1. `lost_baby_constellation` — Finding and guiding a lost baby celestial/creature home.
2. `bridge_of_whispers` — Helping a sleepy guardian repair or cross a mystical bridge.
3. `magic_lantern_glow` — Lighting slumber beacons along a dim twilight path.
4. `singing_crystal_pond` — Restoring harmonic calm to a shimmering water pool.
5. `cloud_sheep_blanket` — Untangling a floating cloud sheep to share a bedtime quilt.
6. `yawning_ancient_tree` — Tucking forest/star friends into a great hollow cedar.
7. `tidepool_night_chimes` — Placing gentle musical conch shells along the shoreline.
8. `glowing_stardust_trail` — Following firefly trails to a secret cozy glade.
9. `floating_island_hammock` — Weaving a suspended velvet hammock between gentle boughs.
10. `moonstone_lullaby` — Chanting the evening lullaby with the guardian creature.
11. `kind_dragon_hearth` — Warming chamomile tea for a gentle dragon with bedtime hiccups.
12. `peaceful_slumber_bell` — Ringing the soft silver bell that lulls the entire realm to sleep.

### 4.3 3-Chapter Narrative Arc & Word Count Benchmarks
- **Chapter 1: The Evening Departure & Discovery (`twilight_arrival`)**
  - *Word count target:* 110–130 words.
  - *Tone:* Twilight descent, wonder, packing magic item and hero gear, celebrating daytime accomplishments.
  - *3D Choreography:* `walking_with_lantern`, `orbit_pan`, fireflies / starlight particles.
- **Chapter 2: The Gentle Obstacle & Character Reflection (`starlit_journey`)**
  - *Word count target:* 120–140 words.
  - *Tone:* Gentle mystery, companion pet sniffs out clue, overcoming hurdle with the daily moral value.
  - *3D Choreography:* `helping_obstacle`, `follow_walk`, aurora ribbons / water reflections.
- **Chapter 3: The Deep Starlight Slumber Sanctuary (`deep_slumber_sanctuary`)**
  - *Word count target:* 110–130 words.
  - *Tone:* Cozy tuck-in, heavy eyelids, yawn wave, synchronized 4s/4s breathing pacer, ambient goodnight whisper.
  - *3D Choreography:* `curled_asleep`, `crane_descend_nest`, dimming lighting to midnight slate.

---

## 5. Server API Routes & Cloud Functions Architecture

### 5.1 Route Mapping
The bedtime story generation endpoints must be wired identically across all deployment targets:

| Route | Express Server (`server.js`) | Vite Dev Proxy (`vite.config.js`) | Cloud Functions (`functions/src/voiceApi.ts`) |
|---|---|---|---|
| `POST /api/gemini/bedtime-story` | `handleBedtimeStoryRequest` | `handleBedtimeStoryRequest` | Mounted in `voiceApi.ts` Express `app` |
| `POST /api/rex/bedtime-story` | `handleBedtimeStoryRequest` | `handleBedtimeStoryRequest` | Mounted in `voiceApi.ts` Express `app` |

### 5.2 Server-Side Implementation (`server/geminiService.js`)
Export `handleBedtimeStoryRequest(req, res)`:
- Uses `getGeminiClient()` to connect with `@google/genai` using model `gemini-2.5-flash` or `gemini-3.8-flash`.
- In-memory per-IP rate limiting (`isRateLimited(key, 20, 60_000)`).
- Input validation: verifies `heroName`, `realmId`, `moralId`, `actNumber` / `chapterIndex`.
- Configures Gemini `responseSchema` with Pydantic/JSON Schema equivalent to guarantee valid, parseable JSON on every response with zero markdown fences.

### 5.3 Cloud Function Implementation (`functions/src/voiceApi.ts`)
- Mirrors `server/geminiService.js` using `import("@google/genai")` and secrets `GEMINI_API_KEY`.
- Also fixes the ElevenLabs voice resolution bug:
  - Defaults all pets to `process.env.ELEVENLABS_REX_VOICE_ID || "e9sQs6aLWU82SSolkPYZ"` instead of returning HTTP 404 for non-Rex pets!

### 5.4 `firebase.json` Hosting Rewrites
Ensure `/api/gemini/**` and `/api/rex/**` forward to `api` Cloud Function:
```json
{
  "source": "/api/gemini/**",
  "function": {
    "functionId": "api",
    "region": "us-central1"
  }
},
{
  "source": "/api/rex/bedtime-story",
  "function": {
    "functionId": "api",
    "region": "us-central1"
  }
}
```

---

## 6. Structured JSON Schema: 3-Chapter Story & 3D `sceneDescriptor`

### 6.1 Complete JSON Output Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "BedtimeStory3ChapterResponse",
  "type": "object",
  "required": [
    "success",
    "storyId",
    "title",
    "realmId",
    "moralId",
    "heroName",
    "petName",
    "seed",
    "archetypeId",
    "chapters"
  ],
  "properties": {
    "success": { "type": "boolean" },
    "storyId": { "type": "string" },
    "title": { "type": "string" },
    "realmId": { "type": "string" },
    "realmName": { "type": "string" },
    "moralId": { "type": "string" },
    "heroName": { "type": "string" },
    "petName": { "type": "string" },
    "seed": { "type": "integer" },
    "archetypeId": { "type": "string" },
    "chapters": {
      "type": "array",
      "minItems": 3,
      "maxItems": 3,
      "items": {
        "type": "object",
        "required": [
          "chapterIndex",
          "chapterNumber",
          "title",
          "chapterText",
          "whisperLine",
          "sleepyCue",
          "moralReflection",
          "choices",
          "sceneMood",
          "sceneDescriptor"
        ],
        "properties": {
          "chapterIndex": { "type": "integer", "enum": [0, 1, 2] },
          "chapterNumber": { "type": "integer", "enum": [1, 2, 3] },
          "title": { "type": "string" },
          "chapterText": { "type": "string" },
          "whisperLine": { "type": "string" },
          "sleepyCue": { "type": "string" },
          "moralReflection": { "type": "string" },
          "choices": {
            "type": "array",
            "items": { "type": "string" }
          },
          "sceneMood": {
            "type": "string",
            "enum": ["tranquil", "mystical", "gentle", "deep_slumber"]
          },
          "sceneDescriptor": {
            "type": "object",
            "required": [
              "environmentBiome",
              "timeOfNight",
              "weatherParticles",
              "cameraWork",
              "heroAction",
              "petAction",
              "keyProps",
              "lightingPalette"
            ],
            "properties": {
              "environmentBiome": { "type": "string" },
              "timeOfNight": {
                "type": "string",
                "enum": ["twilight_arrival", "starlit_journey", "deep_slumber_sanctuary"]
              },
              "weatherParticles": {
                "type": "string",
                "enum": ["fireflies", "aurora_ribbons", "starlight_snow", "bioluminescent_spores", "gentle_bubbles"]
              },
              "cameraWork": {
                "type": "string",
                "enum": ["orbit_pan", "follow_walk", "crane_descend_nest"]
              },
              "heroAction": {
                "type": "string",
                "enum": ["walking_with_lantern", "discovering_landmark", "helping_obstacle", "curled_asleep"]
              },
              "petAction": {
                "type": "string",
                "enum": ["trotting_beside", "sniffing_clue", "glowing_magic", "sleeping_curled"]
              },
              "keyProps": {
                "type": "array",
                "items": { "type": "string" }
              },
              "lightingPalette": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": ["#09141e", "#2ecc71", "#00d2d3", "#f39c12", "#ffb961"]
                }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## 7. Voice Service & Zero-Lag Audio Pipeline Integration

### 7.1 Key Requirements from User Request
1. **Extended Timeout for Chapters:** Story chapters are ~120–150 words long, requiring 10–14s to stream audio from ElevenLabs or Gemini TTS. `fetchPcmTts` in `voiceService.js` currently defaults to `4500ms`, causing premature aborts. It must accept custom options: `timeoutMs: 18000`.
2. **Playback Rate on Decoded Web Audio Buffers:** `playPcmTtsResponse` in `voiceService.js` creates an `AudioBufferSourceNode`, but never sets `source.playbackRate.value`. Progressive hushed bedtime rates (`0.94 -> 0.88 -> 0.80`) must be applied directly to the buffer source.
3. **Background Pre-Fetching (`prefetchCompanionAudio`):**
   ```javascript
   export async function prefetchCompanionAudio(text, petId = 'rex', options = {}) {
     const cleanSpoken = cleanDialogueText(text);
     if (!cleanSpoken) return null;
     const normKey = normalizePetKey(petId);
     const cacheKey = `${normKey}:${cleanSpoken}`;
     if (workoutAudioClipCache.has(cacheKey)) return workoutAudioClipCache.get(cacheKey);

     const timeoutMs = options.timeoutMs || 18000;
     let data = await fetchPcmTts(ELEVENLABS_TTS_ENDPOINT, cleanSpoken, petId, timeoutMs);
     if (!data) {
       data = await fetchPcmTts(TTS_ENDPOINT, cleanSpoken, petId, timeoutMs);
     }
     if (data && data.audio) {
       // Decode AudioBuffer ahead of time
       decodeToAudioBuffer(data);
       workoutAudioClipCache.set(cacheKey, data);
       workoutAudioClipCache.set(cleanSpoken, data);
     }
     return data;
   }
   ```
4. **Hands-Free Auto-Read Pipeline:**
   While Chapter 1 is playing, `bedtimeStoryService` triggers `prefetchCompanionAudio(act2.chapterText, petId, { rate: 0.88, timeoutMs: 18000 })`. When Chapter 1 ends (or the 15s auto-advance expires), Chapter 2 begins instantly from memory with 0ms latency.

---

## 8. Task & Currency Lifecycle Invariants (`store.completeBedtimeStory`)

### 8.1 Invariant Rules Checklist
Following `.agents/rules/task_and_currency_lifecycle_rules.md`:
1. **Parent-Configured Dynamic Rewards:**
   Read dynamic reward values via `store.getWaypointRewards('wp_bedtime')` or `store.getTaskConfig('sleep_on_time')` instead of hardcoding `coins = 30`.
2. **One Completion Payout at a Time:**
   Check if `store.isTaskPendingApproval('sleep_on_time', hero.id)` is true. If so, do not mint duplicate Tokens, XP, or Sparks.
3. **Auto-Issue Tokens, XP, and Sparks immediately:**
   - `hero.coins = (hero.coins || 0) + tokensAwarded`
   - `hero.xp = (hero.xp || 0) + xpAwarded`
   - Active pet sparks: `store.addPetSparks(hero.activePetId, sparksAwarded, hero.id)`
4. **Queue Gold Points in `pendingApprovals`:**
   Gold points are **never** auto-issued.
   Delta metadata must record `tokensAwarded`, `xpAwarded`, `sparksAwarded`, `pendingPoints`.
   Parent approval awards `pendingPoints` to `hero.points` without auto-converting to screen time.
   Parent denial claws back `tokensAwarded`, `xpAwarded`, and `sparksAwarded` clamped to a floor of 0.

---

## 9. Code Changes & Implementation Roadmap

```
Phase 1: Data Engine Upgrade (src/data/bedtimeStoryData.js)
  ├── Expand BEDTIME_REALMS with 6 extended realms while retaining 4 canonical realms
  ├── Define 12+ combinatorial plot archetypes per realm
  ├── Rewrite generateProceduralBedtimeStory to output 3-chapter rich payloads with sceneDescriptor
  └── Eliminate all hardcoded "Rex" references for non-Rex pets

Phase 2: Store & Personalization Engine (src/state/store.js & src/services/bedtimeStoryService.js)
  ├── Implement buildChildStoryContext(heroId)
  ├── Scope getBedtimeStoryLibrary(heroId) and saveBedtimeStory(storyData, heroId)
  ├── Upgrade hero.bedtimeHistory to record seeds, archetypes, and chapter openings
  └── Align store.completeBedtimeStory() with task & currency lifecycle invariants

Phase 3: Server API Routes & Cloud Functions
  ├── server/geminiService.js: Implement handleBedtimeStoryRequest with structured JSON schema
  ├── server.js: Mount POST /api/rex/bedtime-story and POST /api/gemini/bedtime-story
  ├── vite.config.js: Add middleware routes for both bedtime endpoints
  └── functions/src/voiceApi.ts: Mount routes in Cloud Functions Express app and fix voice fallback

Phase 4: Audio Pre-Fetching & Voice Pipeline (src/services/voiceService.js)
  ├── Support timeoutMs: 18000 and playbackRate on Web Audio buffers
  └── Implement prefetchCompanionAudio for zero-lag chapter transitions

Phase 5: Verification Suite
  ├── Create scratch/verify_bedtime_storybook.mjs covering all R1-R4 acceptance criteria
  └── Verify node scratch/run_all_tests.js passes 100%
```

---

## 10. Conclusion

The Bedtime Story engine survey is complete. All interface contracts, schemas, store query mechanisms, and backward compatibility guards are formally specified. Downstream implementers can now execute against these blueprints with zero ambiguity.
