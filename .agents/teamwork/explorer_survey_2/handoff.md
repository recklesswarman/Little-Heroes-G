# Handoff Report: Phase 0 Survey (R2 - Rich, Extended Non-Repetitive Story Generation Engine)

**Agent Role**: AI Story Engine & Anti-Repetition Specialist (Explorer)  
**Task**: Phase 0 Architecture & Codebase Survey for Requirement R2  
**Working Directory**: `c:\APP\stitch_little_hero_adventures\.agents\teamwork\explorer_survey_2`  
**Timestamp**: 2026-10-25T02:26:00Z  

---

## 1. Observation

### 1.1 Complete Codebase Map of Files Involved in Story Generation
Direct inspection reveals that story generation in Little Hero Adventures spans 15 key files across server routes, serverless functions, multi-agent frameworks, client services, procedural weavers, and 3D/UI stages:

| Component / Layer | File Path | Lines | Key Responsibility |
|---|---|---|---|
| **Online Gemini Server Route** | `server/geminiService.js` | 590–845 | `handleBedtimeStoryRequest`: HTTP POST `/api/rex/bedtime-story` & `/api/gemini/bedtime-story` via `gemini-2.5-flash`, schema formatting, rate limiting, and procedural fallback. |
| **Server Route Mount** | `server.js` | 26–27 | Production Express mounting of `/api/gemini/bedtime-story` and `/api/rex/bedtime-story`. |
| **Vite Dev Server Middleware** | `vite.config.js` | 119–142 | Local development proxy intercepting `/api/gemini/bedtime-story` and executing `handleBedtimeStoryRequest`. |
| **Cloud Functions API** | `functions/src/voiceApi.ts` | 316–600 | Firebase serverless Cloud Functions implementing `/api/rex/bedtime-story` and `/api/gemini/bedtime-story` with GoogleGenAI SDK and embedded fallback. |
| **Google Antigravity (AGY) Agent** | `little-heroes-agy-service/agents/bedtime_narrator.py` | 1–153 | Autonomous AGY Bedtime Story Narrator agent (`generate_bedtime_chapter`, `BedtimeChapterResponse`, LocalAgentConfig). |
| **Client AGY Bridge** | `src/services/heroAgentService.js` | 339–355 | `generateBedtimeChapterAGY`: client HTTP invocation of AGY service with `AbortSignal.timeout(10000)`. |
| **Client Firebase AI Logic** | `src/services/firebaseAILogicService.js` & `bedtimeStoryService.js` | 572–639 | Client-side Gemini API fallback via Firebase AI Logic (`gemini-2.5-flash`). |
| **Client Story Service** | `src/services/bedtimeStoryService.js` | 1–785 | Bedtime story orchestrator: `buildChildStoryContext`, `startStory`, `advanceStory`, `generateAct`, `narrateAct`, `generateBedtimeStory`, auto-advance, speech recognition. |
| **Offline Combinatorial Weaver** | `src/data/bedtimeStoryData.js` | 711–1065 | Catalogs (`BEDTIME_MORALS`, `PLOT_ARCHETYPES`, `BEDTIME_REALMS`, `EXTENDED_BEDTIME_REALMS`), `generateProceduralBedtimeStory`, `generateFullBedtimeStory`, `generateFallbackSvg`. |
| **Audio Voice Engine** | `src/services/voiceService.js` | 38–733, 818–1065 | Audio playback via Web Audio API, `prefetchCompanionAudio`, playback rate scaling, lullaby ducking, `timeoutMs: 18000`. |
| **ElevenLabs Voice Backend** | `server/elevenLabsService.js` | 32–120 | Universal voice ID resolution (`e9sQs6aLWU82SSolkPYZ`) for all pets and bedtime storytelling, voice tuning (`stability: 0.65`, `similarity_boost: 0.80`, `style: 0.35`). |
| **Storybook UI Stage** | `src/views/BedtimeStoryView.js` | 405–623 | Cinema screen UI (`renderStoryStage`), chapter navigation, progress indicators, hands-free auto-advance, manual page turn. |
| **Articulated 3D Stage** | `src/components/BedtimeStoryStage3D.js` | 490–1070, 1250–1360 | WebGL/Canvas diorama stage: `setSceneDescriptor`, `setChapter`, camera choreography, scenery props, breathing ring. |
| **Store & State Engine** | `src/state/store.js` | 9400–9680 | `hero.bedtimeHistory` persistence (last 25 records), `completeBedtimeStory`, `saveBedtimeStory`, `getBedtimeStoryLibrary`, task completions integration. |
| **Verification Suites** | `scratch/verify_bedtime_storybook.mjs`, `scratch/test_bedtime_storybook.cjs`, `scratch/test_bedtime_sanctuary.cjs` | All | Automated regression and E2E verification suites. |

---

### 1.2 Current Chapter Length, Word Counts, and Chapter Count Gaps
Direct inspection reveals that all online and offline story generators currently generate **only 3 chapters** with short lengths of **~100–140 words per chapter**, falling significantly short of the R2 mandate (~180–220 words per chapter, ~750–850 words total, lasting 7–8 minutes):

1. **`server/geminiService.js`**:
   - Line 624:
     ```javascript
     const prompt = `You are an expert children's bedtime author and soothing cartoon companion creating a deeply personalized, 3-chapter bedtime story for a young child (ages 3-7).
     ```
   - Lines 644–649:
     ```javascript
     STRUCTURE:
     Generate exactly 3 chapters:
     Chapter 1 (Twilight Arrival & Discovery): ~110-130 words. Packing hero gear/magic item, entering ${realm.name}, celebrating daytime achievements.
     Chapter 2 (Starlit Journey & Gentle Obstacle): ~120-140 words. Discovering a sleepy creature or gentle obstacle, resolving it with ${moral.name} and ${petName}'s help.
     Chapter 3 (Deep Slumber Sanctuary): ~110-130 words. Tucking in, cozy nest, synchronized 4s inhale / 4s exhale breathing, sleepy yawns, whispered goodnight.
     ```
   - Line 747:
     ```javascript
     if (parsed && Array.isArray(parsed.chapters) && parsed.chapters.length >= 3) {
       const normalizedChapters = parsed.chapters.slice(0, 3).map((ch, idx) => ({
     ```
   - Line 799: Hardcoded `isSleepingEnd: reqIdx >= 2`.
   - **Observed word count**: ~350–400 words total across 3 chapters, lasting only ~3.5 minutes.

2. **`functions/src/voiceApi.ts`**:
   - Line 345: `creating a deeply personalized, 3-chapter bedtime story`
   - Lines 364–369: Specifies 3 chapters with ~110–140 words.
   - Line 468: `parsed.chapters.slice(0, 3)`
   - Lines 531–599: Fallback generates only 3 chapters (`chapters: [ch1, ch2, ch3]`).

3. **`src/data/bedtimeStoryData.js`**:
   - Lines 876–987: `generateProceduralBedtimeStory` generates:
     - Chapter 0 (Ch 1): ~106 words.
     - Chapter 1 (Ch 2): ~115 words.
     - Chapter 2 (Ch 3): ~126 words.
     - Chapter 3 (Ch 4): ~114 words.
   - Lines 1039–1064: `generateFullBedtimeStory` explicitly **drops Chapter 2** and produces only 3 chapters:
     ```javascript
     const ch1 = generateProceduralBedtimeStory(realm.id, moral.id, hName, pName, customWish, 0, userChoices);
     const ch2 = generateProceduralBedtimeStory(realm.id, moral.id, hName, pName, customWish, 1, userChoices);
     // In the 3-chapter narrative arc, Chapter 3 is the Slumber Sanctuary conclusion
     const ch3 = generateProceduralBedtimeStory(realm.id, moral.id, hName, pName, customWish, 3, userChoices);
     ch3.chapterIndex = 2;
     ch3.chapterNumber = 3;
     ch3.title = 'Chapter 3: The Slumber Sanctuary';
     ...
     chapters: [ch1, ch2, ch3]
     ```
   - **Critical defect**: In `generateFullBedtimeStory`, chapter index 2 (the cooperative resolution of the moral hurdle) is completely omitted, jumping directly from initial encounter (index 1) to falling asleep (index 3).

4. **`src/components/BedtimeStoryStage3D.js`**:
   - Lines 499, 797, 1040–1041, 1063, 1262, 1337:
     ```javascript
     this.isBreathingActive = (this.chapterIndex === 2);
     if (item.renderMesh.name === 'nest_woven_bed' && this.chapterIndex !== 2) continue;
     if (item.renderMesh.name === 'obstacle_arch' && this.chapterIndex === 2) continue;
     if (this.chapterIndex === 2 && this.nestNode) { ... }
     ```
   - The 3D stage assumes index 2 is the slumber nest and breathing pacer. In a 4-chapter arc, index 2 is the cooperative resolution, and index 3 is the slumber sanctuary.

5. **`src/views/BedtimeStoryView.js`**:
   - Line 409: `const totalActs = (session.acts && session.acts.length) || 3;`
   - Line 439: `title="Toggle Hands-Free Auto-Read All 3 Chapters"`
   - Line 471: `Relax and listen as all 3 chapters unfold seamlessly.`

---

### 1.3 Identification of Repetition Issues
The investigation uncovered several specific repetition issues:

#### A. Verbatim Stock Sentences
1. **`src/services/bedtimeStoryService.js:614-615`**:
   ```javascript
   text: parsed.text || `${petName} smiled happily beside ${heroName} as they gazed at the quiet, starry night.`,
   chapterText: parsed.text || `${petName} smiled happily beside ${heroName} as they gazed at the quiet, starry night.`,
   ```
   *Quoted directly: contains both `"smiled happily beside"` and `"gazed at the quiet, starry night"`.*

2. **`src/services/rexCompanionEngine.js:563` and `src/services/geminiLiveService.js:724`**:
   ```javascript
   fallbackReply = `Once upon a time, a brave little hero flew across the starry sky with their dinosaur buddy, dreaming happy dreams. Close your eyes, superhero! 🌙⭐`;
   ```

#### B. Repetitive Stock Chapter Openings in `src/data/bedtimeStoryData.js`
In the procedural weaver, every chapter currently uses a single, rigid string template with zero opening variation:
1. **Chapter 1 Opening (Line 877)**: Always starts with:
   > `"The golden sun had dipped peacefully below the horizon, painting the sky in deep shades of midnight slate and starlight cyan. Tonight, ${hName} and faithful companion ${pName} stood at the edge of ${subBiome}."`
2. **Chapter 2 Opening (Line 914)**: Always starts with:
   > `"With ${choiceText || 'their favorite hero gear'} snugly tucked into their pack, ${hName} and ${pName} ventured deeper along the glowing pathway. The stars overhead twinkled like cheerful fireflies."`
3. **Chapter 3 Opening (Line 951)**: Always starts with:
   > `"The gentle creature looked up at ${hName} with wide, hopeful eyes. It seemed they had encountered a little bedtime hurdle: ${moral.tagline.toLowerCase()}."`
4. **Chapter 4 Opening (Line 987)**: Always starts with:
   > `"All was quiet now across the vast expanse of ${realm.name}. The little creature was safely tucked into its cozy mossy hammock, purring softly in deep slumber."`

#### C. Static, Formulaic Whisper Lines
Both `src/data/bedtimeStoryData.js` (lines 897, 934, 971, 1007) and `functions/src/voiceApi.ts` (lines 546, 568, 590) return fixed, unvarying whisper lines:
- Chapter 1: `"The evening sky is calm and quiet, ${hName}. Rest your shoulders and breathe in the peaceful dusk."`
- Chapter 2: `"You are safe with friends nearby, little one. The night is gentle and kind."`
- Chapter 3: `"Kindness and patience always light the way home. Feel your muscles melt and relax."`
- Chapter 4: `"Close your eyes, brave hero. Sleep is here, warm and sweet. Goodnight."`

#### D. Invariant Seed Hash in Procedural Weaver
In `src/data/bedtimeStoryData.js` lines 855–857:
```javascript
const hash = String(hName + pName + realm.id + moral.id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
const archetypeIdx = (hash + Number(chapterIndex || 0)) % PLOT_ARCHETYPES.length;
const archetype = PLOT_ARCHETYPES[archetypeIdx] || PLOT_ARCHETYPES[0];
```
Because `hName`, `pName`, `realm.id`, and `moral.id` remain identical when a child selects the same favorite realm and moral on consecutive nights, `hash` is **100% constant**. It does not incorporate `Date.now()`, random seed entropy, or prior history, forcing the child to receive the exact same plot archetype night after night.

#### E. Anti-Repetition Gaps in AI Prompts
In `server/geminiService.js` (lines 635–638) and `functions/src/voiceApi.ts` (lines 355–358):
```javascript
ANTI-REPETITION MANDATE:
Do NOT copy or repeat any of these recently generated titles: ${JSON.stringify(recentTitles.slice(0, 15))}.
Do NOT reuse these plot archetypes: ${JSON.stringify(recentArchetypes.slice(0, 10))}.
Create a completely fresh, enchanting tale!
```
- **Gaps**:
  1. No negative constraints forbidding stock clichés: `"smiled happily beside"`, `"looked up at the starry sky"`, `"gazed with wonder"`, `"twinkled like cheerful fireflies"`, `"golden sun had dipped peacefully"`, `"all was quiet now"`.
  2. `recentChapterOpenings` stored in `hero.bedtimeHistory` are **never passed** to the prompt.
  3. Prompts still request mid-story interactive choice chips (`"choices": ["Choice 1", "Choice 2", "Choice 3"]`) and question prompts (`"What should we do next?"`), which break hands-free slumber.

---

### 1.4 History Persistence (`hero.bedtimeHistory`) Inspection
In `src/state/store.js` (lines 9640–9670):
```javascript
// Anti-Repetition Story Memory:
// Track last 25 story records containing { seed, archetype, title, chapterOpenings, timestamp } per child (heroId)
const chapterOpenings = Array.isArray(storyData?.chapters)
  ? storyData.chapters.map(ch => (ch.chapterText || ch.text || '').slice(0, 120)).filter(Boolean)
  : (Array.isArray(storyData?.acts) ? storyData.acts.map(a => (a.text || '').slice(0, 120)).filter(Boolean) : []);

if (!Array.isArray(hero.bedtimeHistory)) {
  hero.bedtimeHistory = [];
}
hero.bedtimeHistory.unshift({
  id: storyData?.id || `story_${Date.now()}`,
  seed: storyData?.seed || storyData?.combinatorialSeed || Date.now(),
  archetype: storyData?.archetype || storyData?.archetypeId || storyData?.realmId || 'calm_journey',
  archetypeId: storyData?.archetypeId || storyData?.archetype || storyData?.realmId || 'calm_journey',
  title: storyData?.title || 'Bedtime Story',
  moralId: storyData?.moralId || 'brave_dark',
  chapterOpenings,
  timestamp: Date.now()
});
if (hero.bedtimeHistory.length > 25) {
  hero.bedtimeHistory = hero.bedtimeHistory.slice(0, 25);
}
```
In `src/services/bedtimeStoryService.js` (lines 74–77):
```javascript
const bedtimeHistory = Array.isArray(hero.bedtimeHistory) ? hero.bedtimeHistory : [];
const recentTitles = bedtimeHistory.map(h => h.title).filter(Boolean).slice(0, 25);
const recentArchetypes = bedtimeHistory.map(h => h.archetypeId).filter(Boolean).slice(0, 25);
```
- **Observation**: `hero.bedtimeHistory` correctly stores the last 25 records with `chapterOpenings` (120 chars each), but `buildChildStoryContext` extracts only `recentTitles` and `recentArchetypes`, discarding `chapterOpenings`.

---

## 2. Logic Chain

```
[Observation 1.1, 1.2] ─────────┐
All 5 story generators        │
hardwired to 3 chapters       ├──> [Step 1: Universal 4-Chapter Data Contract Required]
(Gemini, Functions, AGY,      │    Schema, prompts, normalizers, and generators must emit
procedural weaver, 3D stage)   │    exactly 4 structured chapters across all routes and fallbacks.
                              │
[Observation 1.2] ────────────┘
Words per chapter: ~100-140   ───> [Step 2: Narrative Expansion to ~180-220 Words]
Total words: ~350-400 words        Each chapter needs rich, multi-sentence progression: sensory setting,
Lasting: ~3.5 minutes              personalization hook, daytime task celebration, pet interaction,
Target: ~180-220 words/ch          gentle pacing, and somatic relaxation cues without repetitive filler.
Total: ~750-850 words (7-8m)

[Observation 1.2] ────────────┐
generateFullBedtimeStory      │
omits Chapter index 2          ├──> [Step 3: 4 Progressive Story Arcs Alignment]
(skips moral resolution)      │    Ch 1: Departure & gentle curiosity (subBiome 0)
                              │    Ch 2: Whimsical encounter & gentle mystery (subBiome 1)
                              │    Ch 3: Calming cooperative resolution (subBiome 2)
                              │    Ch 4: Cozy starlight nest & slumber (subBiome 3)

[Observation 1.3A, B, C] ─────┐
Stock phrases in code         │
("smiled happily beside",     ├──> [Step 4: Anti-Repetition Registry & Sentence Builders]
"starry sky", "gazed")        │    Create combinatorial sentence builders in bedtimeStoryData.js
Rigid single templates        │    with 5+ distinct opening formulas (sensory, pet-action, celestial,
Static whisper lines          │    dialogue, environmental) and 12+ whisper lines per chapter.

[Observation 1.3D, E, 1.4] ───┐
Constant hash equation        │
No ban-list in prompts        ├──> [Step 5: Dynamic Entropy & Prompt Negative Constraints]
recentOpenings ignored        │    Inject high-entropy seed (seed || Date.now() ^ historyHash).
                              │    Extract recentOpenings from hero.bedtimeHistory.
                              │    Add strict negative constraints banning all stock phrases.

[Observation 1.2, 1.3E] ──────┐
3D Stage: isBreathingActive   │
on chapterIndex === 2         ├──> [Step 6: Stage 3D & View Synchronization]
BedtimeStoryView: choice chips│    Update BedtimeStoryStage3D.js to activate nest and breathing on
and 15s countdown timer       │    chapterIndex === 3. Remove prompt choices/mic in BedtimeStoryView.js.
```

---

## 3. Caveats

1. **Test Suite Invariants**: `scratch/verify_bedtime_storybook.mjs` currently contains assertions expecting `chapters.length === 3` and `isBreathingActive` on chapter index 2 (lines 468, 671, 707, 1515). When the implementer updates the codebase to 4 chapters, these test assertions must be systematically updated to assert `chapters.length === 4` and chapter index 3.
2. **Audio Generation Duration**: Spoken narration for ~180–220 words at bedtime rate (0.88–0.76) will take ~100–130 seconds per chapter. In `voiceService.js`, the network fetch timeout (`timeoutMs: 18000`) applies only to the HTTP request to synthesize audio, not playback. However, generating audio for ~200 words over ElevenLabs HTTP API may occasionally take 8–15 seconds; raising `timeoutMs` to `25000ms` for bedtime style is recommended to prevent premature aborts.
3. **No Code Written**: In accordance with the Explorer archetype rules, no production source code has been modified during this survey. All analysis is read-only.

---

## 4. Conclusion & Proposed Architectural Plan

To achieve the requirements of R2, the implementation should be executed across the following modules:

### 4.1 Module 1: Comprehensive Anti-Repetition Registry & Dynamic Combinatorial Story Weaver (`src/data/bedtimeStoryData.js`)
1. **Define Anti-Repetition Ban-List Constants**:
   ```javascript
   export const BANNED_BEDTIME_STOCK_PHRASES = [
     'smiled happily beside',
     'looked up at the starry sky',
     'gazed with wonder',
     'twinkled like cheerful fireflies',
     'golden sun had dipped peacefully',
     'all was quiet now across the vast expanse',
     'gazed at the quiet, starry night',
     'flew across the starry sky'
   ];
   ```
2. **Combinatorial Whisper Line Registry**:
   Expand whisper lines into a categorized matrix of 12+ soothing whisper lines per chapter, keyed by moral and atmosphere, rotated deterministically away from recent history.
3. **Dynamic Combinatorial Chapter Builders**:
   Replace the monolithic single template with dynamic sentence banks for each of the 4 arcs:
   - **Chapter 1 (Departure & Gentle Curiosity, ~180–220 words)**:
     - 4 distinct opening structures (Atmospheric twilight, Companion anticipation, Cozy bedroom threshold, Realm horizon view).
     - Hero gear & magic item packing with sensory tactile descriptions.
     - Daytime habit celebration hook integrated naturally.
     - Companion pet species-specific animation and vocalization (purr, chirp, boof, tail swish).
     - Relaxing shoulder breathing prompt.
   - **Chapter 2 (Whimsical Encounter & Gentle Mystery, ~180–220 words)**:
     - Progression into second subBiome.
     - Novel encounter description driven by realm and archetype.
     - Pet companion's playful investigative senses.
     - Gentle reassurance establishing safety in the quiet night.
   - **Chapter 3 (Calming Cooperative Resolution, ~180–220 words)**:
     - Progression into third subBiome.
     - The bedtime hurdle resolved through the specific moral guidance.
     - Hero and pet cooperative action yielding warm amber/cyan particle transformation.
     - Release of tension, soothing sigh of relief, muscle relaxation cue.
   - **Chapter 4 (Curling Up in Cozy Starlight Nest, ~180–220 words)**:
     - Final sanctuary subBiome.
     - Nest preparation: tucking into cloud quilt / moss hollow / hammock.
     - Pet curling up together with sleepy yawns.
     - 4-second inhale / 4-second exhale somatic breathing guidance.
     - Celestial dimming, soothing ambient chime fade, whispered goodnight with parent's bedtime wish.
4. **Update `generateFullBedtimeStory`**:
   Return all 4 chapters: `chapters: [ch1, ch2, ch3, ch4]`, each conforming to ~180–220 words.
5. **High-Entropy Seed Rotation**:
   Incorporate `Date.now()`, random seed entropy, and recent archetype history into index calculation to ensure successive stories never repeat plot archetypes.

### 4.2 Module 2: AI Prompt Overhaul & Negative Constraints (`server/geminiService.js`, `functions/src/voiceApi.ts`, `little-heroes-agy-service/agents/bedtime_narrator.py`)
1. **Prompts Update to 4 Chapters**:
   - Target length: `~180-220 words per chapter (~750-850 words total)`.
   - Update JSON schema to define 4 chapters.
   - Remove `"choices"` array and prompt questions (`"What should we do next?"`).
2. **Inject Strict Negative Constraints**:
   ```
   ANTI-REPETITION MANDATE:
   1. NEVER copy or repeat any of these recent story titles: ${JSON.stringify(recentTitles)}.
   2. NEVER reuse these recent plot archetypes: ${JSON.stringify(recentArchetypes)}.
   3. NEVER repeat any of these recent chapter opening sentences: ${JSON.stringify(recentOpenings)}.
   4. BANNED PHRASES: Strictly NEVER use stock clichés such as "smiled happily beside", "looked up at the starry sky", "gazed with wonder", "twinkled like cheerful fireflies", "golden sun had dipped peacefully", or "all was quiet now". Craft fresh, vivid, soothing prose!
   ```
3. **Update Truncation and End Condition**:
   - Change `slice(0, 3)` to `slice(0, 4)`.
   - Change `isSleepingEnd: reqIdx >= 2` to `isSleepingEnd: reqIdx >= 3`.

### 4.3 Module 3: Client Story Service & History Integration (`src/services/bedtimeStoryService.js`)
1. In `buildChildStoryContext`:
   - Extract `recentOpenings` from `hero.bedtimeHistory`:
     ```javascript
     const recentOpenings = bedtimeHistory
       .flatMap(h => h.chapterOpenings || [])
       .filter(Boolean)
       .slice(0, 25);
     ```
   - Pass `recentOpenings` to `/api/gemini/bedtime-story` and `generateFullBedtimeStory`.
2. Replace stock sentence fallback in lines 614–615 with a dynamic procedural fallback.
3. Update `generateBedtimeStory(options)` to return 4 chapters.

### 4.4 Module 4: 3D Stage & UI Pacing Synchronization (`BedtimeStoryStage3D.js` & `BedtimeStoryView.js`)
1. In `src/components/BedtimeStoryStage3D.js`:
   - Change `this.isBreathingActive = (this.chapterIndex === 3)` (was 2).
   - In scenery meshes rendering: show `obstacle_arch` in chapters 1 and 2; show `nest_woven_bed` and breathing ring in chapter 3.
2. In `src/views/BedtimeStoryView.js`:
   - Update header to `Chapter ${currentActNumber} of 4`.
   - Update auto-read badges from "All 3 Chapters" to "All 4 Chapters".
   - Support smooth continuous hands-free auto-advance 3 seconds after narration completes.

---

## 5. Verification Method

To independently verify the findings and proposed solution:

1. **Verify Exact Current File Paths and Line Numbers**:
   - `server/geminiService.js:624, 645, 747` (3 chapters, ~110-130 words).
   - `functions/src/voiceApi.ts:345, 365, 468` (3 chapters, ~110-140 words).
   - `src/data/bedtimeStoryData.js:876-1020, 1039-1064` (`generateFullBedtimeStory` omits index 2; words ~106, ~115, ~126, ~114).
   - `src/services/bedtimeStoryService.js:614-615` (stock sentence `"smiled happily beside"`).
   - `src/components/BedtimeStoryStage3D.js:499, 797, 1337` (`this.isBreathingActive = (this.chapterIndex === 2)`).

2. **Verify Baseline Test Suite Execution**:
   Run the full project test suite in terminal:
   ```powershell
   node scratch/run_all_tests.js
   ```
   *Expected*: Passes with 0 failures across all existing test suites.

3. **Verify Bedtime Storybook Suite**:
   ```powershell
   node scratch/verify_bedtime_storybook.mjs
   node scratch/test_bedtime_storybook.cjs
   node scratch/test_bedtime_sanctuary.cjs
   ```

4. **Invalidation Conditions**:
   - Any chapter containing stock phrases: `"smiled happily beside"`, `"looked up at the starry sky"`, `"gazed with wonder"`.
   - Word count of any chapter falling below 160 or exceeding 240 words.
   - Generation of fewer or more than 4 chapters.
   - `BedtimeStoryStage3D` failing to display the nest and breathing ring on Chapter 4 (index 3).
   - Identical chapter openings across 5 consecutive stories generated for the same child and realm.
