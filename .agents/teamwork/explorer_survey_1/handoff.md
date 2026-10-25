# Survey Report: Cloudflare Workers AI Image Generation & Cache Integrity (R1)

**Working Directory**: `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_1`  
**Target Milestone**: Phase 0 Survey / R1  
**Investigator Archetype**: Teamwork Explorer (Read-Only Investigation)  
**Parent Task ID**: `b9493cb1-e4ed-444a-a0d3-d8aedbf36adc`  

---

## 1. Observation

### 1.1 Architecture & Files Involved
The story illustration pipeline spans 10 key files across client, server, and cloud worker tiers:

1. **Client-side Illustration Service**: `src/services/bedtimeIllustrationService.js` (lines 1–233)
   - Instantiates module-level in-memory cache: `const clientIllustrationCache = new Map();` (line 9).
   - In-flight request de-duplication: `const inFlightRequests = new Map();` (line 10).
   - Configures default endpoint: `this.apiUrl = 'https://little-heroes-free-image-api.recklesswarman.workers.dev'` (line 15).
   - Defines `getCacheKey(params)` (lines 21–24), but it is **bypassed/unused** in `generateChapterIllustration()`.
   - `generateFallbackIllustration(params)` (lines 26–60): generates inline SVG with Explorer Palette.
   - `generateChapterIllustration(params)` (lines 65–191): hardcodes cache key computation at line 79.
   - `prefetchNextChapterIllustration(params)` (lines 196–204): increments `chapterNumber` and invokes `generateChapterIllustration`.
   - `buildPrompt(params)` (lines 209–229): accepts `chapterText` at line 217, but completely omits it from the returned prompt string.
2. **Story Orchestrator**: `src/services/bedtimeStoryService.js` (lines 1–785)
   - Assigns session ID: `this.activeSession = { id: 'story_' + Date.now(), ... }` (lines 290–314).
   - Coordinates chapter generation and calls `bedtimeIllustrationService.generateChapterIllustration` (lines 648–665) and `prefetchNextChapterIllustration` (lines 668–678).
   - **Omits** `sessionId: session.id` and `seed` from the illustration parameter payload (lines 649–659).
3. **Storybook Stage & View Mount**: `src/views/BedtimeStoryView.js` (lines 1–1221)
   - Line 28: `let displayStageMode = 'auto'; // 'auto' | '3d' | 'illustration'`
   - Lines 481–494: when `displayStageMode !== '3d'` and `currentAct.imageUrl` is present, renders `<img src="${currentAct.imageUrl}" ...>` with Ken Burns hover effect and "3D Pixar AI Art" badge.
   - Lines 502–507 & 877–882: `#toggle-stage-view-btn` toggles between `'3d'` and `'illustration'`.
   - Lines 938–944: `#interactive-illustration-container` click listener triggers lullaby chime SFX.
4. **3D Storybook Stage**: `src/components/BedtimeStoryStage3D.js` (lines 1–1730)
   - Lines 59–68: defines `BEDTIME_EXPLORER_PALETTE` (#09141e, #040a10, #0e2634, #2ecc71, #00d2d3, #f39c12, #ffb961, #ffffff).
   - Renders 3D diorama inside `#bedtime-3d-stage-mount` when `displayStageMode === '3d'` or when `currentAct.imageUrl` is null.
5. **Backend Proxy Route**: `server.js` (lines 1–84)
   - Lines 8, 33–34: mounts `handleStoryIllustrationRequest` on `POST /api/story/illustration` and `POST /api/ai/image`.
6. **Vite Dev Server Middleware**: `vite.config.js` (lines 1–202)
   - Lines 27, 144–167: dynamically imports `server/imageGenService.js` and handles `POST /api/story/illustration` and `POST /api/ai/image`.
7. **Server-side Image Generation Service**: `server/imageGenService.js` (lines 1–260)
   - Lines 7–8: `const imageCache = new Map(); const MAX_CACHE_SIZE = 50;`
   - Lines 14–58: `buildBedtimeIllustrationPrompt(params)`: truncates narrative to 150 characters on line 28: `const cleanText = (chapterText || '').replace(/[^\w\s,.]/g, '').slice(0, 150);`.
   - Lines 63–187: `handleStoryIllustrationRequest(req, res)`: computes cache key on line 92: `const cacheKey = `${realmId}_ch${chapterNumber}_${prompt.slice(0, 60)}`;`. Calls Cloudflare Workers AI API with `prompt`, `model`, and `format: 'base64'`.
   - Lines 192–259: `generateStorybookSvgDataUri(...)`: generates procedural SVG fallback in Explorer Palette.
8. **Cloudflare Worker Runtime**: `cloudflare-worker/worker.js` (lines 1–132)
   - Lines 54–78: extracts `prompt`, `model`, `format`. Invokes `env.AI.run(model, { prompt })`.
   - **Completely ignores** `seed` and `negative_prompt`.
9. **Cloudflare Worker Config**: `cloudflare-worker/wrangler.toml` (lines 1–16)
   - Configures `[ai] binding = "AI"` and `API_KEY = "little-heroes-secret-key"`.
10. **Cloud Functions**: `functions/src/voiceApi.ts` (lines 1–653)
    - Exposes `/api/gemini/bedtime-story`, `/api/rex/bedtime-story`, and `/api/elevenlabs/tts`. Currently lacks `/api/story/illustration` proxy.

---

### 1.2 Verbatim Findings by Requirement

#### Finding A: Image Generation Prompt Structure & Chapter Text Truncation
- In `src/services/bedtimeIllustrationService.js` (lines 209–229):
  ```javascript
  buildPrompt(params = {}) {
    const {
      heroName = 'Little Hero',
      petName = 'Rex',
      petArchetype = 'dino',
      realmName = 'Starlight Woods',
      chapterNumber = 1,
      magicItem = 'Starlight Lantern',
      chapterText = '' // <--- Parameter accepted here
    } = params;

    const action = chapterNumber === 1
      ? `${heroName} and ${petName} starting their journey with a glowing ${magicItem}`
      : chapterNumber === 2
      ? `${heroName} and ${petName} discovering a sleepy magical friend`
      : chapterNumber === 3
      ? `${heroName} and ${petName} helping a friend with kindness and teamwork`
      : `${heroName} and ${petName} snuggled up asleep under gentle twinkling stars`;

    // chapterText is COMPLETELY EXCLUDED from the return value:
    return `${action}, cute toddler hero and baby ${petArchetype} companion, 3D Pixar animation style, claymation textures, soft nighttime lighting in ${realmName}, cozy storybook illustration, palette of starlight cyan, warm amber, midnight slate and emerald, masterpiece.`;
  }
  ```
- In `server/imageGenService.js` (lines 14–29, 57):
  ```javascript
  export function buildBedtimeIllustrationPrompt(params = {}) {
    ...
    // Truncates text to at most 150 characters:
    const cleanText = (chapterText || '').replace(/[^\w\s,.]/g, '').slice(0, 150);
    ...
    return `${chapterAction}, ${heroDescription}, ${petDescription}. Setting: ${realmAtmosphere}. Context: ${cleanText}. Style: ${stylePrompt}.`;
  }
  ```
  A bedtime chapter of ~180–220 words contains ~950–1200 characters. Slicing to 150 characters drops >85% of the narrative, discarding characters, specific obstacles, and plot context.

#### Finding B: Caching Logic and Cross-Story / Cross-Chapter Collision Vulnerability
- In `src/services/bedtimeIllustrationService.js` (line 79):
  ```javascript
  const cacheKey = `${realmId}_ch${chapterNumber}_${(chapterTitle || '').slice(0, 30)}`;
  ```
  - `session.id` is not present in the key.
  - `chapterIndex` is not present in the key.
  - Full chapter text hash (`md5(fullChapterText)`) is not present in the key.
  - Consequence: Generating any new bedtime story in the same realm (e.g. `space`) with chapter 1 titles like `"Chapter 1: Starlit Voyage"` will hit the in-memory cache and return the illustration from the previous story!
- In `server/imageGenService.js` (lines 92–93):
  ```javascript
  const cacheKey = `${realmId}_ch${chapterNumber}_${prompt.slice(0, 60)}`;
  ```
  - The first 60 characters of `prompt` is only the boilerplate action prefix (e.g., `"Little Hero and Rex embarking on their evening bedtime journey "`):
  - Because `Context: ${cleanText}` is placed near character position 350+ of the prompt, `prompt.slice(0, 60)` is 100% identical for every story generated by that child in that realm.
  - Consequence: All bedtime stories generated for a hero in a realm collide on the backend and return identical images.
- In `src/services/bedtimeStoryService.js` (lines 649–659):
  - `session.id` is never passed to `bedtimeIllustrationService.generateChapterIllustration`.

#### Finding C: Missing Random Seed / Entropy Parameter
- In `src/services/bedtimeStoryService.js` (lines 649–659):
  - No seed parameter is generated or passed (`params.seed` is undefined).
- In `src/services/bedtimeIllustrationService.js` (lines 94–106, 150–155):
  - `payload` does not contain `seed`.
  - Direct Cloudflare Worker fetch sends: `{ prompt: cfPrompt, model: '...', format: 'base64' }` without `seed`.
- In `server/imageGenService.js` (lines 65–77, 119–123):
  - `handleStoryIllustrationRequest` does not read `seed` from `req.body`.
  - Fetch to Cloudflare Workers AI omits `seed`.
- In `cloudflare-worker/worker.js` (lines 54–78):
  - `body.seed` is never extracted.
  - `env.AI.run(model, { prompt })` does not pass `seed`.
  - Without `seed`, the latent diffusion model uses default internal seed 0, resulting in repetitive images whenever prompts share phrasing.

#### Finding D: Explorer Palette Adherence
- **Prompts**:
  - `server/imageGenService.js` (line 53) specifies: `"Explorer Palette: deep midnight slate, luminous starlight cyan, solar orange warmth, and emerald green accents (no pink, no purple, cozy bedtime atmosphere)"`.
  - `src/services/bedtimeIllustrationService.js` (line 228) specifies: `"palette of starlight cyan, warm amber, midnight slate and emerald, masterpiece."`, but lacks an explicit negative prompt instruction.
  - Neither client nor server passes `negative_prompt` to Cloudflare Workers AI.
- **SVG Fallbacks**:
  - `src/services/bedtimeIllustrationService.js` lines 35–60: `#050f18`, `#0a2236`, `#ffb961`, `#00d2d3`, `#09141e`, `#ffffff`.
  - `server/imageGenService.js` lines 193–255: `#07131d`, `#00253d`, `#00d2d3`, `#09141e`, `#0b2b1a`, `#2ecc71`, `#1c2838`, `#ffb961`, `#23180c`, `#f39c12`, `#ffffff`, `#050c13`, `#0f2334`.
  - `src/data/bedtimeStoryData.js` lines 1072–1449: `#050f18`, `#091b29`, `#0f2b3e`, `#00d2d3`, `#ffffff`, `#ffb961`, `#122736`, `#091520`, `#e0f2fe`, `#f39c12`, `#2ecc71`.
  - All SVG fallbacks strictly adhere to Explorer Palette with zero pink and zero purple.

---

## 2. Logic Chain

1. **Premise**: R1 requires that the Cloudflare Workers AI image generator receives the full, unabridged text of each chapter directly embedded in the prompt so that illustrations visually mirror the specific story narrative.
   - **Observation Reference**: Section 1.2, Finding A.
   - **Deduction**: Currently, `bedtimeIllustrationService.buildPrompt()` completely discards `chapterText`, while `imageGenService.buildBedtimeIllustrationPrompt()` slices it to 150 characters. To satisfy R1, both prompt builders must embed the entire unabridged chapter text without truncation.

2. **Premise**: R1 requires that cache keys are uniquely bound to `session.id + chapterIndex + md5(fullChapterText)` to eliminate cross-story and cross-chapter collisions.
   - **Observation Reference**: Section 1.2, Finding B.
   - **Deduction**: Currently, client cache keys use `${realmId}_ch${chapterNumber}_${chapterTitle.slice(0, 30)}` and server cache keys use `${realmId}_ch${chapterNumber}_${prompt.slice(0, 60)}`. Because titles and the first 60 characters of prompts are shared across stories, collisions are guaranteed between consecutive stories in the same realm. Binding the cache key to `session.id`, `chapterIndex`, and an MD5 hash of `fullChapterText` will mathematically guarantee collision freedom.

3. **Premise**: R1 requires passing a randomized seed / entropy parameter (`Math.floor(Math.random() * 2147483647)`) with every generation request so every chapter and every book produces completely unique 3D Pixar / Claymation artwork.
   - **Observation Reference**: Section 1.2, Finding C.
   - **Deduction**: Currently, no seed is generated or passed in `bedtimeStoryService.js`, `bedtimeIllustrationService.js`, `server/imageGenService.js`, or `cloudflare-worker/worker.js`. To ensure entropy, `seed` must be generated at request time and propagated through the payload to `env.AI.run(model, { prompt, seed, ... })`.

4. **Premise**: R1 requires strict adherence to the Explorer Palette (zero pink or purple) across prompts and SVG fallbacks.
   - **Observation Reference**: Section 1.2, Finding D.
   - **Deduction**: While SVG fallbacks strictly use Explorer Palette hex values, the AI image generator prompt needs an explicit `negative_prompt: "pink, purple, magenta, violet, neon pink, scary, dark, deformed, blurry"` passed to Cloudflare Workers AI to prevent diffusion models from injecting default fantasy purple/pink hues.

---

## 3. Caveats

- **No Caveats**: All 10 files involved in story illustration generation and caching were inspected directly via `view_file`.
- Baseline automated test suite (`scratch/run_all_tests.js`) and production build (`npm run build`) were executed synchronously and verified at 100% pass (0 failures).

---

## 4. Conclusion & Proposed Implementation Plan

The codebase has the core Cloudflare Workers AI integration and SVG fallbacks in place, but has 4 critical architectural gaps relative to R1:
1. **Truncated / Omitted Narrative Context**: Prompts truncate chapter text to 150 chars (server) or drop it entirely (client).
2. **Defective Cache Key Structure**: Cache keys do not bind to `session.id`, `chapterIndex`, or `md5(chapterText)`, causing cross-story collisions in the same realm.
3. **Missing Seed Entropy**: Random seed (`Math.floor(Math.random() * 2147483647)`) is neither generated nor passed anywhere in the call chain.
4. **Missing Negative Prompt Enforcement**: Cloudflare Worker and prompt generators lack explicit `negative_prompt` parameters to strictly exclude pink/purple.

### Proposed Implementation Plan (Targeting Implementation Agent)

1. **Lightweight Pure JS MD5 Helper (`src/utils/md5.js`)**:
   - Provide a zero-dependency, pure JS `computeMd5(str)` function producing a 32-character hexadecimal string, compatible with both browser and Node/Cloudflare environments.
2. **Update `src/services/bedtimeIllustrationService.js`**:
   - Update `getCacheKey({ sessionId, chapterIndex, chapterNumber, chapterText, ... })` to return:
     `${sessionId || 'story'}_ch${chapterIndex ?? (chapterNumber - 1)}_${computeMd5(chapterText || '')}`
   - Update `generateChapterIllustration(params)` to use `this.getCacheKey(params)`.
   - Update `buildPrompt(params)`: Include the full unabridged `chapterText` into the prompt context:
     `"Full Chapter Narrative: \"${chapterText.trim()}\". Visual Illustration Instruction: In 3D Pixar animation style with claymation textures, illustrate this exact scene depicting ${heroName} and baby ${petArchetype} companion in ${realmName}..."`
   - Generate `seed = params.seed ?? Math.floor(Math.random() * 2147483647)` and include in request payload to both proxy and direct worker endpoints.
   - Pass `negative_prompt: "pink, purple, magenta, violet, neon pink, dark, scary, deformed, blurry"`.
3. **Update `server/imageGenService.js`**:
   - Import or implement `computeMd5`.
   - Extract `sessionId`, `chapterIndex`, `seed`, `chapterText` from `req.body`.
   - Remove `.slice(0, 150)` from `buildBedtimeIllustrationPrompt`; incorporate the entire unabridged chapter text.
   - Update `cacheKey` to:
     `${sessionId || 'story'}_ch${chapterIndex ?? (chapterNumber - 1)}_${computeMd5(chapterText || prompt)}`
   - Pass `seed` and `negative_prompt` in fetch call to Cloudflare Workers AI.
4. **Update `cloudflare-worker/worker.js`**:
   - Extract `const seed = body.seed !== undefined ? Number(body.seed) : Math.floor(Math.random() * 2147483647);`
   - Extract `const negative_prompt = body.negative_prompt || "pink, purple, magenta, violet, neon pink, scary, dark, deformed, blurry";`
   - Pass `{ prompt, seed, negative_prompt }` to `env.AI.run(model, ...)`.
5. **Update `src/services/bedtimeStoryService.js`**:
   - In `generateAct` (lines 648–665):
     Pass `sessionId: session.id`, `chapterIndex: actNumber - 1`, and `seed: Math.floor(Math.random() * 2147483647)` to `generateChapterIllustration`.

---

## 5. Verification Method

To verify R1 implementation independently:

1. **Cache Collision Verification**:
   - Generate two distinct stories in the same realm (`space`) with different chapter narratives.
   - Assert `bedtimeIllustrationService.getCacheKey()` generates distinct keys for Chapter 1 of Story 1 vs Chapter 1 of Story 2.
   - Assert neither key collides with previous cached entries.
2. **Full Text in Prompt Verification**:
   - Inspect the prompt string received by `buildBedtimeIllustrationPrompt` and direct Cloudflare call with a 200-word chapter text.
   - Assert the generated prompt contains the complete chapter narrative (>800 characters) without truncation (`slice(0, 150)`).
3. **Random Seed Verification**:
   - Verify that requests to `/api/story/illustration` and Cloudflare Worker contain a numeric `seed` between `0` and `2147483647`.
4. **Explorer Palette Verification**:
   - Assert all fallback SVGs and prompt instructions exclude `#ec4899`, `#a855f7`, `pink`, `purple`, `magenta`.
5. **Automated Test Suite & Build Verification**:
   - Run `node scratch/run_all_tests.js` -> must exit with code 0 (0 failures).
   - Run `npm run build` -> must compile cleanly with exit code 0.
