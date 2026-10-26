/**
 * Bedtime AI Storybook Adventure Service
 * Little Hero Adventures - Dynamic Conversational Bedtime Story Engine
 * 
 * Powered by Gemini API (Firebase AI Logic) + Gemini Companion TTS / Web Speech.
 * Enforces strict zero pink/purple Explorer Palette, 4-chapter narrative arc (~4-5 mins),
 * parent prompt customizer, anti-repetition guarantee, and non-blocking bedtime rewards.
 */

import { store } from '../state/store.js';
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
import { generateBedtimeChapterAGY } from './heroAgentService.js';
import { bedtimeIllustrationService } from './bedtimeIllustrationService.js';

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
  return fallbackPetId;
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
    const context = store.buildChildStoryContext(heroId, { realmId, moralId, customWish, ...options });

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

    try {
      speakCompanion(text, narratorPetId, handleSpeechEnded, {
        rate,
        pitch: chapterNumber >= 3 ? 0.95 : 1.05,
        voiceStyle: 'bedtime',
        timeoutMs: 25000,
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
   * Generate an Act using Server Route -> AGY -> Firebase AI Logic -> Combinatorial Story Weaver
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
          body: JSON.stringify({
            heroName,
            heroId: session.heroId,
            petId,
            petName,
            realmId: realm.id,
            moralId: moral.id,
            customWish,
            actNumber,
            previousChoice: previousChoice || '',
            userChoices: session.userChoices || [],
            recentTitles: pastTitles,
            recentArchetypes
          })
        });

        if (res.ok) {
          const apiData = await res.json();
          const chData = (Array.isArray(apiData.chapters) && apiData.chapters[actNumber - 1]) || apiData;
          if (chData && (chData.text || chData.chapterText)) {
            const fallbackSvg = generateFallbackSvg(realm.id, actNumber, previousChoice || (chData.choices && chData.choices[0]) || '');
            generatedAct = {
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
              archetypeId: chData.archetypeId
            };
          }
        }
      }
    } catch (routeErr) {
      // In offline / test environment, proceed smoothly to AGY / Firebase / procedural fallback
    } finally {
      this.isGenerating = false;
    }

    // 2. Try Google Antigravity (AGY) Bedtime Story Narrator Agent
    if (!generatedAct) {
      try {
        this.isGenerating = true;
        const agyChapter = await generateBedtimeChapterAGY({
          heroName,
          petName,
          realmName: realm.name,
          moralName: moral.name,
          moralGuidance: moral.moralGuidance || moral.tagline,
          actNumber,
          previousChoice: previousChoice || '',
          customWish: customWish || '',
          pastTitles
        });

        if (agyChapter && agyChapter.text) {
          const fallbackSvg = generateFallbackSvg(realm.id, actNumber, previousChoice || (agyChapter.suggestion_chips && agyChapter.suggestion_chips[0]) || '');
          const proceduralForDescriptor = generateProceduralBedtimeStory(realm.id, moral.id, heroName, petName, customWish, actNumber - 1, session.userChoices || [], session.childContext?.antiRepetition || {});
          generatedAct = {
            actNumber,
            chapterNumber: actNumber,
            chapterIndex: actNumber - 1,
            title: agyChapter.title || `Chapter ${actNumber}: ${realm.name}`,
            text: agyChapter.text,
            chapterText: agyChapter.text,
            promptQuestion: agyChapter.prompt_question || (actNumber < 4 ? '' : 'Sleep tight, little hero.'),
            prompt: agyChapter.prompt_question || (actNumber < 4 ? '' : 'Sleep tight, little hero.'),
            suggestionChips: Array.isArray(agyChapter.suggestion_chips) && agyChapter.suggestion_chips.length > 0
              ? agyChapter.suggestion_chips.map(c => typeof c === 'string' ? { text: c, icon: 'stars' } : c)
              : (actNumber === 1 ? realm.act1DefaultChips : actNumber === 2 ? realm.act2DefaultChips : realm.act3DefaultChips),
            defaultChips: Array.isArray(agyChapter.suggestion_chips) && agyChapter.suggestion_chips.length > 0
              ? agyChapter.suggestion_chips.map(c => typeof c === 'string' ? { text: c, icon: 'stars' } : c)
              : (actNumber === 1 ? realm.act1DefaultChips : actNumber === 2 ? realm.act2DefaultChips : realm.act3DefaultChips),
            svgArt: fallbackSvg,
            whisperLine: proceduralForDescriptor.whisperLine,
            sleepyCue: proceduralForDescriptor.sleepyCue,
            moralReflection: proceduralForDescriptor.moralReflection,
            choices: proceduralForDescriptor.choices,
            sceneMood: proceduralForDescriptor.sceneMood,
            sceneDescriptor: proceduralForDescriptor.sceneDescriptor,
            isSleepingEnd: actNumber === 4,
            archetypeId: proceduralForDescriptor.archetypeId
          };
        }
      } catch (agyErr) {
        // Fall back to Firebase AI
      } finally {
        this.isGenerating = false;
      }
    }

    // 3. Fall back to Firebase AI Logic (Gemini API)
    if (!generatedAct && firebaseAI.isAiReady && firebaseAI.model) {
      try {
        this.isGenerating = true;
        const prompt = `You are a sweet, gentle cartoon companion narrating a children's (ages 3-7) bedtime story.
The setting is "${realm.name}".
The child hero is "${heroName}".
Today's bedtime moral theme: "${moral.name}" (${moral.tagline}).
${customWish ? `Parent/Child Special Bedtime Wish: "${customWish}". Weave this gently into the story!` : ''}
Current chapter: Chapter ${actNumber} of 4.
${previousChoice ? `The child chose: "${previousChoice}".` : ''}

COMPANION NAMING RULE:
Never use the companion pet's actual name. Refer to it only as "the Faithful Companion" the first time it appears in this chapter, then with pronouns ("it"/"its") afterward. If this chapter doesn't need the companion to act, it's fine to leave it out entirely rather than naming it in every chapter.

ANTI-REPETITION MANDATE:
Do NOT repeat or copy any of these past story titles or plots: ${pastTitles.join(', ') || 'None yet'}. Do NOT reuse these plot archetypes: ${recentArchetypes.join(', ') || 'None yet'}. Make this story unique and refreshing, varying your phrasing even when the realm and moral repeat from an earlier story.

CHAPTER GUIDELINES:
- Chapter 1: The Evening Departure. Introduce twilight, packing bedtime hero gear or pajamas, and the soothing calm of dusk. (Target: ~110-130 words).
- Chapter 2: The Curious Discovery. The Faithful Companion uses its gentle senses to discover a sleepy creature or gentle bedtime mystery. (Target: ~120-140 words).
- Chapter 3: Overcoming the Challenge with the Daily Moral. The hurdle is resolved through ${moral.name} (${moral.moralGuidance}). The Faithful Companion helps by ${moral.petAction}. (Target: ~130-150 words).
- Chapter 4: Peaceful Cozy Slumber. Tucking in, deep calming breaths, yawns, and soft goodnight whispers as ambient stars shine. (Target: ~110-130 words).

STRICT PALETTE RULE: NEVER use pink or purple words or hex colors in SVG. Only slate (#09141e), emerald green (#2ecc71), starlight cyan (#00d2d3), solar orange (#f39c12), and warm amber (#ffb961).

CONTINUOUS NARRATION RULE:
- This is a continuous read-aloud story. Do NOT ask the child any questions, offer choices, or say things like "What should we do next?".
- Never repeat a sentence or signature phrase within the story or across chapters. Every sentence must be fresh.

Return ONLY raw JSON with these exact keys (no markdown code blocks, just raw JSON):
{
  "title": "Chapter ${actNumber}: Short Title (max 4 words)",
  "text": "The rich soothing narrative text (target ~120-150 words), with no questions to the child"
}`;

        const result = await firebaseAI.model.generateContent(prompt);
        const rawText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(rawText);

        const fallbackSvg = generateFallbackSvg(realm.id, actNumber, previousChoice || (parsed.suggestionChips && parsed.suggestionChips[0]) || '');
        const proceduralForDescriptor = generateProceduralBedtimeStory(realm.id, moral.id, heroName, petName, customWish, actNumber - 1, session.userChoices || [], session.childContext?.antiRepetition || {});

        generatedAct = {
          actNumber,
          chapterNumber: actNumber,
          chapterIndex: actNumber - 1,
          title: parsed.title || `Chapter ${actNumber}: ${realm.name}`,
          text: parsed.text || `${petName} smiled happily beside ${heroName} as they gazed at the quiet, starry night.`,
          chapterText: parsed.text || `${petName} smiled happily beside ${heroName} as they gazed at the quiet, starry night.`,
          promptQuestion: actNumber === 4 ? 'Sleep tight, little hero.' : '',
          prompt: actNumber === 4 ? 'Sleep tight, little hero.' : '',
          suggestionChips: [],
          defaultChips: [],
          svgArt: fallbackSvg,
          whisperLine: proceduralForDescriptor.whisperLine,
          sleepyCue: proceduralForDescriptor.sleepyCue,
          moralReflection: proceduralForDescriptor.moralReflection,
          choices: proceduralForDescriptor.choices,
          sceneMood: proceduralForDescriptor.sceneMood,
          sceneDescriptor: proceduralForDescriptor.sceneDescriptor,
          isSleepingEnd: actNumber === 4,
          archetypeId: proceduralForDescriptor.archetypeId
        };
      } catch (err) {
        // Fall back to offline procedural generator
      } finally {
        this.isGenerating = false;
      }
    }

    // 4. Resilient offline Combinatorial Dynamic Story Weaver
    if (!generatedAct) {
      generatedAct = this.createOfflineAct(actNumber, realm, moral, heroName, petName, customWish, previousChoice, session.childContext?.antiRepetition || {});
    }

    // Attach 3D Pixar / Claymation illustration from Cloudflare Workers AI
    if (generatedAct) {
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
          magicItem: session?.childContext?.gearAndChoices?.magicItem || 'Starlight Lantern'
        });
        if (illResult && illResult.imageUrl) {
          generatedAct.imageUrl = illResult.imageUrl;
        }
      } catch (illErr) {
        console.warn('Illustration attachment notice:', illErr.message);
      }

      // Pre-fetch next chapter illustration in background for instant transition
      if (actNumber < 4) {
        bedtimeIllustrationService.prefetchNextChapterIllustration({
          sessionId: session?.id,
          chapterIndex: actNumber,
          chapterNumber: actNumber + 1,
          seed: Math.floor(Math.random() * 2147483647),
          realmId: realm.id,
          realmName: realm.name,
          heroName,
          petName,
          petArchetype: session?.childContext?.activePet?.archetype || 'dino',
          magicItem: session?.childContext?.gearAndChoices?.magicItem || 'Starlight Lantern'
        });
      }
    }

    return generatedAct;
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
      antiRepetition
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
    const context = store.buildChildStoryContext(heroId, options);
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
      context.antiRepetition || {}
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
