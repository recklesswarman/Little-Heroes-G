/**
 * Bedtime AI Storybook Adventure Service
 * Little Hero Adventures - Dynamic Conversational Bedtime Story Engine
 * 
 * Powered by Gemini API (Firebase AI Logic) + Gemini Companion TTS / Web Speech.
 * Enforces strict zero pink/purple Explorer Palette, 4-chapter narrative arc (~4-5 mins),
 * parent prompt customizer, anti-repetition guarantee, and non-blocking bedtime rewards.
 */

import { store, KID_AVATARS } from '../state/store.js';
import { firebaseAI } from './firebaseAILogicService.js';
import { speakCompanion, stopCompanionAudio } from './voiceService.js';
import { Sound } from '../audio/sfx.js';
import {
  BEDTIME_REALMS,
  BEDTIME_MORALS,
  CONSTELLATION_STICKERS,
  getBedtimeRealm,
  generateFallbackSvg,
  generateProceduralBedtimeStory,
  generateFullBedtimeStory
} from '../data/bedtimeStoryData.js';
import { PETS_DATABASE } from '../data/petsData.js';
import { bedtimeIllustrationService } from './bedtimeIllustrationService.js';
import { sanitizeWish } from '../../shared/storyEngine/safety.js';
import { petSpeciesFromName, buildRequest, generateBedtimeChapter } from '../../shared/storyEngine/engine.js';
import { makeFirebaseGenerate } from './firebaseEngineAdapter.js';
import { memoryForRequest } from '../../shared/storyEngine/memory.js';
import { lookForAvatarId } from '../../shared/storyEngine/avatarLook.js';
import { scenePromptFromPlan } from '../../shared/storyEngine/scenes.js';

/**
 * Resolves which pet's voice should narrate bedtime stories: a parent-chosen
 * override (store.getBedtimeSanctuaryState().bedtimeVoicePetId, set from the
 * Parent Portal settings tab) takes precedence over whichever pet the child
 * currently has active, so a parent can pick a calmer/different narrator
 * voice without changing the child's active companion.
 */
export function resolveBedtimeNarratorPetId(fallbackPetId) {
  try {
    const override = store.getBedtimeSanctuaryState?.()?.bedtimeVoicePetId;
    if (override) return override;
  } catch {}
  // Dedicated unified bedtime narrator (af_heart / Luna) for cohesive storybook narration
  return 'luna';
}

/**
 * Builds a comprehensive real-time child story context snapshot.
 * Integrates child profile, daytime habits/tasks completed today, active pet companion
 * from PETS_DATABASE, equipped hero gear, and anti-repetition negative constraints.
 */
export function buildChildStoryContext(heroId = null, options = {}) {
  const state = store.getState ? store.getState() : (store.state || {});
  const heroes = state.heroes || [];
  const selectedHero = state.selectedHero || heroes[0] || { id: 'hero_1', name: 'Little Hero', level: 1 };
  const effectiveHeroId = heroId || selectedHero.id || 'hero_1';
  const hero = heroes.find(h => h.id === effectiveHeroId) || selectedHero;

  // 1. Child Profile
  const ageTier = hero.age ? (hero.age <= 4 ? '3-4' : hero.age <= 6 ? '5-6' : '7+') : '5-6';
  const level = Number(hero.level) || 1;
  const title = hero.title || (level >= 10 ? 'Grand Master Hero' : level >= 5 ? 'Brave Starlight Guardian' : 'Little Explorer');
  const streak = Number(hero.streak) || 1;

  // 2. Daytime Accomplishments (Today's completed chores & habits)
  const todayStr = new Date().toISOString().split('T')[0];
  const validLogsToday = (state.taskCompletionLogs || []).filter(log =>
    (!effectiveHeroId || log.heroId === effectiveHeroId) &&
    (log.completedAt || '').startsWith(todayStr) &&
    log.status !== 'rejected'
  );
  const taskTitles = Array.from(new Set(validLogsToday.map(l => l.taskTitle || l.taskId))).filter(Boolean).slice(0, 4);
  const summarySentence = taskTitles.length > 0
    ? taskTitles.join(', ')
    : 'brushed teeth sparkling clean and tidied up toys';
  const celebrationHook = `Today in daytime adventures, ${hero.name || 'our little hero'} heroically ${summarySentence}.`;

  // 3. Active Companion Pet (from PETS_DATABASE)
  const petId = String(hero.activePetId || '1');
  const petData = PETS_DATABASE.find(p => String(p.id) === petId || p.key === petId) || PETS_DATABASE[0];

  // 4. Equipped Hero Gear & Story Choices
  const equippedWeapon = (store.getEquippedHeroWeapon && store.getEquippedHeroWeapon(true)) || {
    id: 'laser_toothbrush',
    title: 'Laser Toothbrush Saber',
    description: 'A glowing photon saber that brushes away nighttime shadows',
    icon: 'cleaning_services'
  };

  const realm = getBedtimeRealm(options.realmId || 'space');
  const moral = BEDTIME_MORALS.find(m => m.id === options.moralId) || BEDTIME_MORALS[0];

  // 5. Anti-Repetition Constraints & Seed Rotation
  const bedtimeHistory = Array.isArray(hero.bedtimeHistory) ? hero.bedtimeHistory : [];
  const recentTitles = bedtimeHistory.map(h => h.title).filter(Boolean).slice(0, 25);
  const recentArchetypes = bedtimeHistory.map(h => h.archetypeId).filter(Boolean).slice(0, 25);
  const forbiddenKeywords = ['darkness', 'spooky', 'monster', 'nightmare'];
  const deterministicSeed = Date.now() + Math.floor(Math.random() * 1000);

  return {
    child: {
      heroId: effectiveHeroId,
      name: hero.name || 'Little Hero',
      ageTier,
      level,
      title,
      streak
    },
    daytimeAccomplishments: {
      taskIds: validLogsToday.map(l => l.taskId).filter(Boolean),
      taskTitles,
      summarySentence,
      celebrationHook
    },
    activePet: {
      id: petData.id,
      key: petData.key,
      name: petData.name,
      shortName: petData.shortName || petData.name,
      title: petData.title || 'Loyal Companion',
      element: petData.element || 'Starlight',
      archetype: petData.archetype || 'dino',
      backstory: petData.backstory || '',
      emoji: petData.emoji || '🦖',
      actionVerb: petData.workoutInstructions || 'trots cheerfully beside you'
    },
    gearAndChoices: {
      equippedWeapon,
      realm: {
        id: realm.id,
        name: realm.name,
        biome: realm.subBiomes[0],
        accentColor: realm.accentColor
      },
      moral: {
        id: moral.id,
        name: moral.name,
        guidance: moral.moralGuidance,
        petAction: moral.petAction,
        slumberResolution: moral.slumberResolution
      },
      magicItem: options.magicItem || 'Starlight Lantern',
      gentleObstacle: options.gentleObstacle || 'Sleepy Bridge Troll',
      parentWish: options.customWish || ''
    },
    antiRepetition: {
      recentTitles,
      recentArchetypes,
      forbiddenKeywords,
      deterministicSeed
    }
  };
}

// Attach to store if not already defined
if (typeof store.buildChildStoryContext !== 'function') {
  store.buildChildStoryContext = function(heroId = null, options = {}) {
    return buildChildStoryContext(heroId, options);
  };
}

class BedtimeStoryService {
  constructor() {
    this.activeSession = null;
    this.recognition = null;
    this.isListening = false;
    this.isGenerating = false;
    this.autoAdvanceTimer = null;
    this.autoAdvanceSecondsRemaining = 3;
    this.autoAdvanceInterval = null;
    this.speechWatchdogTimer = null;
    this.speechCallbacks = {
      onResult: null,
      onError: null,
      onEnd: null
    };

    this.initSpeechRecognition();
  }

  initSpeechRecognition() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bedtime-story-listening-change', { detail: { isListening: true } }));
        }
      };

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (this.speechCallbacks.onResult) {
          this.speechCallbacks.onResult(transcript);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('Bedtime speech recognition error:', event.error);
        if (this.speechCallbacks.onError) {
          this.speechCallbacks.onError(event.error);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.speechCallbacks.onEnd) {
          this.speechCallbacks.onEnd();
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bedtime-story-listening-change', { detail: { isListening: false } }));
        }
      };
    } catch (e) {
      console.warn('Speech recognition not available:', e);
    }
  }

  startListening(onResult, onError, onEnd) {
    this.speechCallbacks = { onResult, onError, onEnd };
    if (!this.recognition) {
      if (onError) onError('Speech recognition not supported in this browser');
      return false;
    }
    try {
      stopCompanionAudio();
      this.cancelAutoAdvance();
      this.recognition.start();
      return true;
    } catch (e) {
      console.warn('Failed to start speech recognition:', e);
      if (onError) onError(e.message);
      return false;
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.isListening = false;
  }

  cancelAutoAdvance() {
    this.narrationGeneration = (this.narrationGeneration || 0) + 1;
    if (this.speechWatchdogTimer) {
      clearTimeout(this.speechWatchdogTimer);
      this.speechWatchdogTimer = null;
    }
    if (this.autoAdvanceTimer) {
      clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = null;
    }
    if (this.autoAdvanceInterval) {
      clearInterval(this.autoAdvanceInterval);
      this.autoAdvanceInterval = null;
    }
    stopCompanionAudio();
    const defaultSec = (this.activeSession?.realmId === 'pirate_lagoon' && this.activeSession?.moralId === 'calm_feelings') ? 15 : 3;
    this.autoAdvanceSecondsRemaining = defaultSec;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bedtime-story-autoadvance-tick', { detail: { secondsRemaining: defaultSec, active: false } }));
    }
  }

  startAutoAdvance(onAdvance, seconds) {
    this.cancelAutoAdvance();
    if (!this.activeSession || this.activeSession.completed) return;

    const currentGeneration = this.narrationGeneration;
    const defaultSec = (this.activeSession?.realmId === 'pirate_lagoon' && this.activeSession?.moralId === 'calm_feelings') ? 15 : 3;
    this.autoAdvanceSecondsRemaining = typeof seconds === 'number' && seconds > 0 ? seconds : defaultSec;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bedtime-story-autoadvance-tick', { detail: { secondsRemaining: this.autoAdvanceSecondsRemaining, active: true } }));
    }

    this.autoAdvanceInterval = setInterval(() => {
      this.autoAdvanceSecondsRemaining--;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bedtime-story-autoadvance-tick', { detail: { secondsRemaining: Math.max(0, this.autoAdvanceSecondsRemaining), active: true } }));
      }
      if (this.autoAdvanceSecondsRemaining <= 0) {
        this.cancelAutoAdvance();
        if (currentGeneration === this.narrationGeneration && typeof onAdvance === 'function') {
          onAdvance();
        }
      }
    }, 1000);
  }

  /**
   * Start a brand new 4-chapter (or 3-chapter) Bedtime Story
   */
  async startStory(realmId, moralId = null, customWish = '', narrationMode = 'rex', options = {}) {
    this.cancelAutoAdvance();
    const hero = store.getState().selectedHero;
    const heroId = options.heroId || hero?.id || 'hero_1';

    // Build comprehensive child context with anti-repetition memory & daytime accomplishments
    // The service builder (not store.buildChildStoryContext) carries the anti-repetition memory.
    const typedWish = typeof customWish === 'string' ? customWish.trim() : '';
    customWish = sanitizeWish(customWish, { avoidTopics: store.getStoryControls().avoidTopics });
    if (typedWish && !customWish) {
      // The wish was filtered (or is against a topic the parent asked to avoid): tell the parent, never keep the text.
      try { store.logStorySafetyEvent({ kind: 'wish-blocked', reason: 'wish-filtered', heroId }); } catch { /* best effort */ }
    }
    const context = buildChildStoryContext(heroId, { realmId, moralId, customWish, ...options });

    const realm = getBedtimeRealm(realmId);
    const morals = store.getAvailableBedtimeMorals(heroId);
    const moral = BEDTIME_MORALS.find(m => m.id === moralId) || morals[0] || BEDTIME_MORALS[0];

    // Pick a celestial constellation sticker for this story
    const stickerIdx = Math.floor(Math.random() * CONSTELLATION_STICKERS.length);
    const sticker = CONSTELLATION_STICKERS[stickerIdx] || CONSTELLATION_STICKERS[0];

    this.activeSession = {
      id: `story_${Date.now()}`,
      heroId: context.child.heroId,
      realmId: realm.id,
      realmName: realm.name,
      realmEmoji: realm.emoji,
      moralId: moral.id,
      moralName: moral.name,
      customWish: customWish || '',
      narrationMode: narrationMode || 'rex',
      constellationStickerId: sticker.id,
      constellationStickerName: sticker.name,
      constellationStickerEmoji: sticker.emoji,
      title: `${context.child.name}'s Adventure in ${realm.name}`,
      heroName: context.child.name || 'Little Hero',
      petId: context.activePet.id || '1',
      petKey: context.activePet.key || 'rex',
      petName: context.activePet.name || 'Rex',
      actNumber: 1, // 1 to 4
      acts: [],
      userChoices: [],
      childContext: context,
      completed: false,
      createdAt: Date.now()
    };

    store.state.activeBedtimeStory = this.activeSession;

    // Start background bedtime lullaby softly
    store.toggleBedtimeLullaby(true);

    // Build Chapter 1
    const act1 = await this.generateAct(1, null);
    if (!this.activeSession) return act1;
    this.activeSession.acts.push(act1);

    // Auto-save active story to history/bookshelf immediately so no story is ever lost
    try {
      store.saveBedtimeStory(this.activeSession, this.activeSession.heroId);
    } catch {}

    // Narrate Chapter 1
    this.narrateAct(act1.text, this.activeSession.petId, 1);

    return act1;
  }

  /**
   * Advance story with the child's choice / speech response
   */
  async advanceStory(childInput = '') {
    this.cancelAutoAdvance();
    if (!this.activeSession) return null;

    if (this.isAdvancing) return null;
    this.isAdvancing = true;

    try {
      const currentActNumber = this.activeSession.actNumber;
      const currentAct = this.activeSession.acts[currentActNumber - 1];
      if (currentAct) {
        currentAct.childChoice = childInput;
      }
      if (childInput) {
        this.activeSession.userChoices.push(childInput);
      }

      // 4 chapters total
      if (currentActNumber >= 4 || this.activeSession.completed) {
        this.activeSession.completed = true;
        store.completeBedtimeStory(this.activeSession);
        store.notify();
        return this.activeSession.acts[this.activeSession.acts.length - 1];
      }

      const nextActNumber = currentActNumber + 1;
      this.activeSession.actNumber = nextActNumber;

      const nextAct = await this.generateAct(nextActNumber, childInput);
      if (!this.activeSession) return nextAct;
      this.activeSession.acts.push(nextAct);

      // Auto-save updated chapter progress to bookshelf
      try {
        store.saveBedtimeStory(this.activeSession, this.activeSession.heroId);
      } catch {}

      if (nextActNumber === 4 || nextAct.isSleepingEnd) {
        this.activeSession.completed = true;

        // Update hero.bedtimeHistory anti-repetition record
        const state = store.getState();
        const hero = state.selectedHero;
        if (hero) {
          if (!Array.isArray(hero.bedtimeHistory)) hero.bedtimeHistory = [];
          hero.bedtimeHistory.unshift({
            id: this.activeSession.id,
            seed: this.activeSession.childContext?.antiRepetition?.deterministicSeed || Date.now(),
            archetypeId: nextAct.archetypeId || 'lost_baby_constellation',
            realmId: this.activeSession.realmId,
            title: this.activeSession.title,
            moralId: this.activeSession.moralId,
            chapterOpenings: this.activeSession.acts.map(a => (a.text || '').slice(0, 40)),
            timestamp: Date.now()
          });
          if (hero.bedtimeHistory.length > 25) {
            hero.bedtimeHistory = hero.bedtimeHistory.slice(0, 25);
          }
        }

        // Complete bedtime story quietly per guidelines
        store.completeBedtimeStory(this.activeSession);
      }

      // Reactive UI refresh so Chapter 2/3/4 renders immediately on screen
      store.notify();

      // Narrate act aloud
      const petId = this.activeSession.petId;
      this.narrateAct(nextAct.text, petId, nextActNumber);

      return nextAct;
    } finally {
      this.isAdvancing = false;
    }
  }

  narrateAct(text, petId, chapterNumber = 1, options = {}) {
    const session = this.activeSession;
    const narratorPetId = resolveBedtimeNarratorPetId(petId);
    if (session?.narrationMode === 'parent') {
      Sound.duckLullaby(false);
      // In Parent Mode, do NOT auto-advance; let the parent manually turn the page
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bedtime-story-speech-finished'));
      }
      return;
    }

    this.narrationGeneration = (this.narrationGeneration || 0) + 1;
    const currentGeneration = this.narrationGeneration;

    if (this.speechWatchdogTimer) {
      clearTimeout(this.speechWatchdogTimer);
      this.speechWatchdogTimer = null;
    }

    // Progressive hushed cadence rates:
    // Ch 1: 0.94 -> Ch 2: 0.88 -> Ch 3: 0.82 -> Ch 4: 0.76 (sleepy whisper)
    const rates = [0.94, 0.88, 0.82, 0.76];
    const rate = options.rate || rates[Math.min(chapterNumber - 1, rates.length - 1)];

    // Duck the lullaby synthesizer volume while speaking
    Sound.duckLullaby(true);

    let hasEnded = false;
    const handleSpeechEnded = () => {
      if (hasEnded) return;
      hasEnded = true;
      if (this.speechWatchdogTimer) {
        clearTimeout(this.speechWatchdogTimer);
        this.speechWatchdogTimer = null;
      }
      Sound.duckLullaby(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bedtime-story-speech-finished'));
      }
      if (currentGeneration !== this.narrationGeneration) return;
      if (!this.activeSession || this.activeSession.completed || this.activeSession.actNumber !== chapterNumber) return;
      this.startAutoAdvance(() => this.advanceStory());
    };

    // Dynamic speech watchdog timeout (~150s for 200 words at normal cadence
    // so narration is never cut off prematurely). The later, more slowly
    // paced chapters (rate < 1) take proportionally longer to actually play
    // back, so scale the budget by the same rate used for playback -- a flat
    // word-count budget would otherwise leave progressively less real-world
    // safety margin for chapters 3 and 4, where the audio is deliberately
    // slowed down the most.
    const wordCount = (text || '').trim().split(/\s+/).length;

    const dynamicWatchdogMs = Math.max(90000, Math.ceil((wordCount * 750) / rate));
    this.speechWatchdogTimer = setTimeout(() => {
      console.warn(`Story speech watchdog (${Math.round(dynamicWatchdogMs / 1000)}s) triggered, advancing auto-advance countdown`);
      handleSpeechEnded();
    }, dynamicWatchdogMs);

    // Swap to the chapter's second illustration about halfway through the narration.
    // The audio is one clip with no progress events, so the midpoint is estimated from
    // word count and pace (~0.42s/word on the narrator) plus a little start-up latency.
    if (this.sceneSwitchTimer) clearTimeout(this.sceneSwitchTimer);
    const halfwayMs = Math.round((wordCount * 420) / rate / 2) + 2500;
    this.sceneSwitchTimer = setTimeout(() => {
      this.sceneSwitchTimer = null;
      if (currentGeneration !== this.narrationGeneration) return;
      const act = this.activeSession?.acts?.[chapterNumber - 1];
      if (!act || this.activeSession.actNumber !== chapterNumber) return;
      act.activeScene = 'scene_b';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bedtime-story-scene-switch', {
          detail: { actNumber: chapterNumber, scene: 'scene_b' }
        }));
      }
    }, halfwayMs);

    try {
      speakCompanion(text, narratorPetId, handleSpeechEnded, {
        rate,
        pitch: chapterNumber >= 3 ? 0.95 : 1.05,
        voiceStyle: 'bedtime',
        pipelined: true,
        timeoutMs: 45000,
        ...options
      });
    } catch (e) {
      if (this.speechWatchdogTimer) {
        clearTimeout(this.speechWatchdogTimer);
        this.speechWatchdogTimer = null;
      }
      Sound.duckLullaby(false);
      console.warn('Story speech error:', e);
      if (currentGeneration === this.narrationGeneration && this.activeSession && !this.activeSession.completed && this.activeSession.actNumber === chapterNumber) {
        this.startAutoAdvance(() => this.advanceStory());
      }
    }
  }

  /**
   * Generate an Act: server route -> the same story engine in the browser (Firebase AI Logic, or its offline weaver) -> offline act
   */
  async generateAct(actNumber, previousChoice) {
    const session = this.activeSession;
    const realm = getBedtimeRealm(session.realmId);
    const moral = BEDTIME_MORALS.find(m => m.id === session.moralId) || BEDTIME_MORALS[0];
    const heroName = session.heroName;
    const petName = session.petName;
    const petId = session.petId || 'rex';
    const customWish = session.customWish || '';

    // Collect past titles and archetypes for strict anti-repetition
    const pastStories = store.getBedtimeStoryLibrary() || [];
    const pastTitles = pastStories.map(s => s.title).filter(Boolean).slice(0, 25);
    const recentArchetypes = session.childContext?.antiRepetition?.recentArchetypes || [];

    let generatedAct = null;

    // 1. Try Server Route /api/gemini/bedtime-story or /api/rex/bedtime-story
    try {
      this.isGenerating = true;
      const baseUrl = typeof window !== 'undefined' && window.location?.origin
        ? ''
        : (process.env.TEST_SERVER_URL || '');

      if (baseUrl !== '' || (typeof window !== 'undefined' && window.location?.origin)) {
        const res = await fetch(`${baseUrl}/api/gemini/bedtime-story`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.buildStoryRequestBody(session, actNumber, previousChoice, { realm, moral, pastTitles, recentArchetypes }))
        });

        // Hosts without the route answer with an HTML page or an error: only a JSON reply is a story.
        const contentType = res.headers?.get?.('content-type');
        if (res.ok && (!contentType || contentType.includes('json'))) {
          generatedAct = this.actFromEngineResponse(await res.json(), session, actNumber, realm, previousChoice);
        }
      }
    } catch (routeErr) {
      // No server route on this host (or offline): the in-browser engine below takes over.
    } finally {
      this.isGenerating = false;
    }

    // 2. Run the shared story engine in the browser (hosts without the server route). Same plan, ledger,
    //    parent controls, pronoun and safety rules as the server; offline weaver when no AI is available.
    if (!generatedAct) {
      try {
        this.isGenerating = true;
        const engineData = await this.runEngineInBrowser(session, actNumber, realm, moral, previousChoice, { pastTitles, recentArchetypes });
        generatedAct = this.actFromEngineResponse(engineData, session, actNumber, realm, previousChoice);
      } catch (engineErr) {
        console.warn('In-browser story engine unavailable, using the offline weaver:', engineErr?.message || engineErr);
      } finally {
        this.isGenerating = false;
      }
    }

    // 3. Last resort if even the engine failed: the offline weaver, with the child's name.
    if (!generatedAct) {
      generatedAct = this.createOfflineAct(actNumber, realm, moral, heroName, petName, customWish, previousChoice, session.childContext?.antiRepetition || {});
    }

    // Keep a one-sentence recap per chapter so later chapters (any tier) can continue the story.
    if (generatedAct) {
      if (!Array.isArray(session.chapterSummaries)) session.chapterSummaries = [];
      const recapSource = generatedAct.chapterText || generatedAct.text || '';
      session.chapterSummaries[actNumber - 1] = generatedAct.summary || (recapSource.split(/(?<=[.!])\s+/)[0] || '').slice(0, 220);
    }

    // Attach 3D Pixar / Claymation illustration from Cloudflare Workers AI (Dual-Scene: Scene A Journey + Scene B Climax)
    if (generatedAct) {
      // Both pictures of the chapter start as soon as its text exists (scene B does not wait for scene A).
      bedtimeIllustrationService.generateChapterIllustration({
        sessionId: session?.id,
        chapterIndex: actNumber - 1,
        chapterNumber: actNumber,
        chapterTitle: generatedAct.title,
        chapterText: generatedAct.chapterText || generatedAct.text,
        seed: Math.floor(Math.random() * 2147483647),
        realmId: realm.id,
        realmName: realm.name,
        heroName,
        petName,
        petArchetype: session?.childContext?.activePet?.archetype || 'dino',
        magicItem: session?.childContext?.gearAndChoices?.magicItem || 'Starlight Lantern',
        sceneType: 'scene_b',
        ...this.scenePlanArgs(generatedAct, 'scene_b')
      }).then((illB) => {
        if (illB && illB.imageUrl) {
          generatedAct.imageUrlB = illB.imageUrl;
          if (session && Array.isArray(session.acts) && session.acts.length > 0) {
            try {
              store.saveBedtimeStory(session, session.heroId);
            } catch {}
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bedtime-story-scene-b-loaded', {
              detail: { actNumber, imageUrlB: illB.imageUrl }
            }));
          }
        }
      }).catch(() => {});

      try {
        const illResult = await bedtimeIllustrationService.generateChapterIllustration({
          sessionId: session?.id,
          chapterIndex: actNumber - 1,
          chapterNumber: actNumber,
          chapterTitle: generatedAct.title,
          chapterText: generatedAct.chapterText || generatedAct.text,
          seed: Math.floor(Math.random() * 2147483647),
          realmId: realm.id,
          realmName: realm.name,
          heroName,
          petName,
          petArchetype: session?.childContext?.activePet?.archetype || 'dino',
          magicItem: session?.childContext?.gearAndChoices?.magicItem || 'Starlight Lantern',
          sceneType: 'scene_a',
          ...this.scenePlanArgs(generatedAct, 'scene_a')
        });
        if (illResult && illResult.imageUrl) {
          generatedAct.imageUrl = illResult.imageUrl;
          generatedAct.activeScene = 'scene_a';
        }
      } catch (illErr) {
        console.warn('Illustration attachment notice:', illErr.message);
      }
    }

    return generatedAct;
  }

  /**
   * The request every route sends (the server route and the in-browser engine read the same fields), so
   * all hosts honour the same hero, pet, parent controls, memory and wish rules.
   */
  buildStoryRequestBody(session, actNumber, previousChoice, { realm, moral, pastTitles = [], recentArchetypes = [] } = {}) {
    const heroName = session.heroName;
    const petName = session.petName;
    const petId = session.petId || 'rex';
    const customWish = session.customWish || '';
    return {
      heroName,
      heroId: session.heroId,
      petId,
      // Short name ("Rex") reads naturally in prose; the species ("T-Rex") keeps the pet accurate.
      petName: session.childContext?.activePet?.shortName || petName,
      petSpecies: petSpeciesFromName(session.childContext?.activePet?.name || petName),
      // How the child's chosen avatar looks (a fixed phrase for built-in avatars, '' for custom ones).
      heroLook: this.getHeroLook(session),
      // Parent controls: reading level, tone, pronouns, topics to avoid, research on/off, own ideas.
      ...store.getStoryRequestFields(session.heroId),
      realmId: realm.id,
      moralId: moral.id,
      customWish,
      actNumber,
      previousChoice: previousChoice || '',
      userChoices: session.userChoices || [],
      recentTitles: pastTitles,
      recentArchetypes,
      // Continuity: the server is stateless, so the cast/plot bible and a recap of the
      // earlier chapters travel with every request after the first.
      storyBible: session.storyBible || null,
      previousChapters: (session.chapterSummaries || []).slice(0, actNumber - 1),
      // Only needed when the story is being planned (no plan yet): the plots this child has had
      // (so a new one is different) and friends they have met (optional to bring back).
      ...(session.storyBible ? {} : memoryForRequest(store.getStoryMemory(session.heroId)))
    };
  }

  /** Apply a story-engine chapter response (from the server or the in-browser engine) to the session; returns the act or null. */
  actFromEngineResponse(apiData, session, actNumber, realm, previousChoice) {
    if (!apiData || typeof apiData !== 'object') return null;
    if (apiData.storyBible && typeof apiData.storyBible === 'object') {
      session.storyBible = apiData.storyBible;
    }
    for (const event of Array.isArray(apiData.safetyEvents) ? apiData.safetyEvents : []) {
      try { store.logStorySafetyEvent({ ...event, heroId: session.heroId }); } catch { /* the log is best effort */ }
    }
    const chData = (Array.isArray(apiData.chapters) && apiData.chapters[actNumber - 1]) || apiData;
    if (!chData || !(chData.text || chData.chapterText)) return null;
    const fallbackSvg = generateFallbackSvg(realm.id, actNumber, previousChoice || (chData.choices && chData.choices[0]) || '');
    return {
      actNumber,
      chapterNumber: actNumber,
      chapterIndex: actNumber - 1,
      title: chData.title || `Chapter ${actNumber}: ${realm.name}`,
      text: chData.chapterText || chData.text,
      chapterText: chData.chapterText || chData.text,
      promptQuestion: chData.choices?.[0] ? '' : (actNumber < 4 ? '' : 'Sleep tight, little hero.'),
      prompt: chData.choices?.[0] ? '' : (actNumber < 4 ? '' : 'Sleep tight, little hero.'),
      suggestionChips: Array.isArray(chData.choices) && chData.choices.length > 0
        ? chData.choices.map(c => typeof c === 'string' ? { text: c, icon: 'stars' } : c)
        : (actNumber === 1 ? realm.act1DefaultChips : actNumber === 2 ? realm.act2DefaultChips : realm.act3DefaultChips),
      defaultChips: Array.isArray(chData.choices) && chData.choices.length > 0
        ? chData.choices.map(c => typeof c === 'string' ? { text: c, icon: 'stars' } : c)
        : (actNumber === 1 ? realm.act1DefaultChips : actNumber === 2 ? realm.act2DefaultChips : realm.act3DefaultChips),
      svgArt: fallbackSvg,
      whisperLine: chData.whisperLine || '',
      sleepyCue: chData.sleepyCue || '',
      moralReflection: chData.moralReflection || '',
      choices: Array.isArray(chData.choices) ? chData.choices : [],
      sceneMood: chData.sceneMood || 'tranquil',
      sceneDescriptor: chData.sceneDescriptor,
      isSleepingEnd: actNumber === 4 || chData.isSleepingEnd,
      archetypeId: chData.archetypeId,
      summary: chData.summary || '',
      blocks: Array.isArray(chData.blocks) ? chData.blocks : undefined,
      scenePlan: chData.scenePlan && typeof chData.scenePlan === 'object' ? chData.scenePlan : undefined
    };
  }

  /**
   * Run the shared story engine in the browser: the fallback for hosts with no backend route (GitHub
   * Pages, classic Firebase Hosting). With Firebase AI ready the model writes the story; without it the
   * engine still plans from the child's memory and controls and uses the offline weaver.
   */
  async runEngineInBrowser(session, actNumber, realm, moral, previousChoice, { pastTitles = [], recentArchetypes = [] } = {}) {
    const body = this.buildStoryRequestBody(session, actNumber, previousChoice, { realm, moral, pastTitles, recentArchetypes });
    const request = buildRequest(body, { realm, moral });
    const model = firebaseAI.getStoryModel?.() || null;
    const generate = makeFirebaseGenerate(model);
    const seed = session.childContext?.antiRepetition?.deterministicSeed ?? null;
    const out = await generateBedtimeChapter({
      generate,
      request,
      chapterIndex: actNumber - 1,
      bible: session.storyBible || null,
      previousSummaries: (session.chapterSummaries || []).slice(0, actNumber - 1),
      recentTitles: pastTitles,
      recentArchetypes,
      proceduralChapter: (idx) => generateProceduralBedtimeStory(realm.id, moral.id, request.heroName, session.petName, request.customWish, idx, session.userChoices || [], seed)
    });
    return {
      ...out.chapter,
      storyBible: out.bible,
      generationSource: out.source,
      generationIssues: out.issues,
      ledgerCheck: out.ledgerCheck,
      researchUsed: out.researchUsed,
      safetyEvents: out.safetyEvents
    };
  }

  /** Look phrase for the child's chosen built-in avatar ('' for a custom avatar or none). */
  getHeroLook(session) {
    try {
      const hero = (store.state.heroes || []).find(h => h.id === session?.heroId) || store.state.selectedHero || {};
      const avatar = KID_AVATARS.find(a => a.url === hero.avatar);
      return avatar ? lookForAvatarId(avatar.id) : '';
    } catch {
      return '';
    }
  }

  /** {prompt, seed} for one scene when the server planned the pictures; {} to use the built-in prompt. */
  scenePlanArgs(act, sceneType) {
    const planned = scenePromptFromPlan(act?.scenePlan, sceneType);
    return planned ? { prompt: planned.prompt, ...(planned.seed !== undefined ? { seed: planned.seed } : {}) } : {};
  }

  createOfflineAct(actNumber, realm, moral, heroName, petName, customWish, previousChoice, antiRepetition = {}) {
    const procedural = generateProceduralBedtimeStory(
      realm.id,
      moral?.id || 'brave_dark',
      heroName,
      petName,
      customWish,
      actNumber - 1,
      this.activeSession?.userChoices || [],
      typeof antiRepetition === 'number' ? antiRepetition : (antiRepetition?.deterministicSeed ?? null)
    );

    const fallbackSvg = generateFallbackSvg(realm.id, actNumber, previousChoice || '');

    return {
      actNumber,
      chapterNumber: actNumber,
      chapterIndex: actNumber - 1,
      title: procedural.title,
      text: procedural.text,
      chapterText: procedural.chapterText || procedural.text,
      promptQuestion: procedural.promptQuestion || procedural.prompt,
      prompt: procedural.prompt,
      suggestionChips: procedural.suggestionChips || procedural.defaultChips || [],
      defaultChips: procedural.defaultChips || [],
      svgArt: fallbackSvg,
      whisperLine: procedural.whisperLine || '',
      sleepyCue: procedural.sleepyCue || '',
      moralReflection: procedural.moralReflection || '',
      choices: procedural.choices || [],
      sceneMood: procedural.sceneMood || 'tranquil',
      sceneDescriptor: procedural.sceneDescriptor,
      isSleepingEnd: actNumber === 4,
      archetypeId: procedural.archetypeId
    };
  }

  /**
   * One-shot 3-chapter bedtime story generation
   */
  async generateBedtimeStory(options = {}) {
    const hero = store.getState().selectedHero;
    const heroId = options.heroId || hero?.id || 'hero_1';
    options = { ...options, customWish: sanitizeWish(options.customWish) };
    const context = buildChildStoryContext(heroId, options);
    const realm = getBedtimeRealm(options.realmId || 'space');
    const moral = BEDTIME_MORALS.find(m => m.id === options.moralId) || BEDTIME_MORALS[0];

    try {
      const baseUrl = typeof window !== 'undefined' && window.location?.origin ? '' : (process.env.TEST_SERVER_URL || '');
      if (baseUrl !== '' || (typeof window !== 'undefined' && window.location?.origin)) {
        const res = await fetch(`${baseUrl}/api/gemini/bedtime-story`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            heroName: context.child.name,
            heroId: context.child.heroId,
            petId: context.activePet.id,
            petName: context.activePet.name,
            realmId: realm.id,
            moralId: moral.id,
            magicItem: context.gearAndChoices.magicItem,
            gentleObstacle: context.gearAndChoices.gentleObstacle,
            customWish: options.customWish || '',
            userChoices: options.userChoices || [],
            recentTitles: context.antiRepetition.recentTitles,
            recentArchetypes: context.antiRepetition.recentArchetypes
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.chapters)) {
            return data;
          }
        }
      }
    } catch (e) {}

    return generateFullBedtimeStory(
      realm.id,
      moral.id,
      context.child.name,
      context.activePet.name,
      options.customWish || '',
      options.userChoices || [],
      context.antiRepetition?.deterministicSeed ?? null
    );
  }

  getActiveSession() {
    return this.activeSession;
  }

  clearSession() {
    this.cancelAutoAdvance();
    stopCompanionAudio();
    Sound.duckLullaby(false);
    this.stopListening();
    this.activeSession = null;
    store.state.activeBedtimeStory = null;
  }
}

export const bedtimeStoryService = new BedtimeStoryService();
