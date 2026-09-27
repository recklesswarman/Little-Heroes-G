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
  generateFallbackSvg,
  generateProceduralBedtimeStory
} from '../data/bedtimeStoryData.js';

class BedtimeStoryService {
  constructor() {
    this.activeSession = null;
    this.recognition = null;
    this.isListening = false;
    this.isGenerating = false;
    this.autoAdvanceTimer = null;
    this.autoAdvanceSecondsRemaining = 15;
    this.autoAdvanceInterval = null;
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
    if (this.autoAdvanceTimer) {
      clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = null;
    }
    if (this.autoAdvanceInterval) {
      clearInterval(this.autoAdvanceInterval);
      this.autoAdvanceInterval = null;
    }
    this.autoAdvanceSecondsRemaining = 15;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bedtime-story-autoadvance-tick', { detail: { secondsRemaining: 15, active: false } }));
    }
  }

  startAutoAdvance(onAdvance) {
    this.cancelAutoAdvance();
    if (!this.activeSession || this.activeSession.completed) return;

    this.autoAdvanceSecondsRemaining = 15;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bedtime-story-autoadvance-tick', { detail: { secondsRemaining: 15, active: true } }));
    }

    this.autoAdvanceInterval = setInterval(() => {
      this.autoAdvanceSecondsRemaining--;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bedtime-story-autoadvance-tick', { detail: { secondsRemaining: Math.max(0, this.autoAdvanceSecondsRemaining), active: true } }));
      }
      if (this.autoAdvanceSecondsRemaining <= 0) {
        this.cancelAutoAdvance();
        if (typeof onAdvance === 'function') {
          onAdvance();
        }
      }
    }, 1000);
  }

  /**
   * Start a brand new 4-chapter Bedtime Story (~4-5 mins total)
   */
  async startStory(realmId, moralId = null, customWish = '', narrationMode = 'rex') {
    this.cancelAutoAdvance();
    const realm = BEDTIME_REALMS.find(r => r.id === realmId) || BEDTIME_REALMS[0];
    const hero = store.getState().selectedHero;
    const petId = String(hero.activePetId || '1');
    const pet = (store.getState().pets || []).find(p => String(p.id) === petId) || { name: 'Rex the Dino' };
    
    // Choose moral from available or passed parameter
    const morals = store.getAvailableBedtimeMorals(hero.id);
    const moral = BEDTIME_MORALS.find(m => m.id === moralId) || morals[0] || BEDTIME_MORALS[0];

    // Pick a celestial constellation sticker for this story
    const stickerIdx = Math.floor(Math.random() * CONSTELLATION_STICKERS.length);
    const sticker = CONSTELLATION_STICKERS[stickerIdx] || CONSTELLATION_STICKERS[0];

    this.activeSession = {
      id: `story_${Date.now()}`,
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
      title: `${hero.name}'s Adventure in ${realm.name}`,
      heroName: hero.name || 'Little Hero',
      petId: petId,
      petName: pet.name || 'Rex',
      actNumber: 1, // 1 to 4
      acts: [],
      userChoices: [],
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
    this.narrateAct(act1.text, petId, 1);

    return act1;
  }

  /**
   * Advance story with the child's choice / speech response
   */
  async advanceStory(childInput = '') {
    this.cancelAutoAdvance();
    if (!this.activeSession) return null;

    const currentActNumber = this.activeSession.actNumber;
    const currentAct = this.activeSession.acts[currentActNumber - 1];
    if (currentAct) {
      currentAct.childChoice = childInput;
    }
    if (childInput) {
      this.activeSession.userChoices.push(childInput);
    }

    // 4 chapters total
    if (currentActNumber >= 4) {
      return this.activeSession.acts[3];
    }

    const nextActNumber = currentActNumber + 1;
    this.activeSession.actNumber = nextActNumber;

    const nextAct = await this.generateAct(nextActNumber, childInput);
    if (!this.activeSession) return nextAct;
    this.activeSession.acts.push(nextAct);

    if (nextActNumber === 4) {
      this.activeSession.completed = true;
      // Complete bedtime story quietly per guidelines
      store.completeBedtimeStory(this.activeSession);
    }

    // Narrate act aloud
    const petId = this.activeSession.petId;
    this.narrateAct(nextAct.text, petId, nextActNumber);

    return nextAct;
  }

  narrateAct(text, petId, chapterNumber = 1) {
    const session = this.activeSession;
    if (session?.narrationMode === 'parent') {
      // In Parent Read Aloud mode, skip AI speech, unduck lullaby, and start auto-advance
      Sound.duckLullaby(false);
      this.startAutoAdvance(() => this.advanceStory());
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bedtime-story-speech-finished'));
      }
      return;
    }

    // Progressive hushed cadence rates:
    // Ch 1: 0.94 -> Ch 2: 0.88 -> Ch 3: 0.82 -> Ch 4: 0.76 (sleepy whisper)
    const rates = [0.94, 0.88, 0.82, 0.76];
    const rate = rates[Math.min(chapterNumber - 1, rates.length - 1)];

    // Duck the lullaby synthesizer volume while speaking
    Sound.duckLullaby(true);

    try {
      speakCompanion(text, petId, () => {
        // Speech finished: restore lullaby volume and start 15s sleep auto-advance
        Sound.duckLullaby(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bedtime-story-speech-finished'));
        }
        this.startAutoAdvance(() => this.advanceStory());
      }, { rate, pitch: chapterNumber === 4 ? 0.95 : 1.05 });
    } catch (e) {
      Sound.duckLullaby(false);
      console.warn('Story speech error:', e);
      this.startAutoAdvance(() => this.advanceStory());
    }
  }

  /**
   * Generate an Act (1, 2, 3, or 4) using Gemini or offline procedural generator
   */
  async generateAct(actNumber, previousChoice) {
    const session = this.activeSession;
    const realm = BEDTIME_REALMS.find(r => r.id === session.realmId) || BEDTIME_REALMS[0];
    const moral = BEDTIME_MORALS.find(m => m.id === session.moralId) || BEDTIME_MORALS[0];
    const heroName = session.heroName;
    const petName = session.petName;
    const customWish = session.customWish || '';

    // Collect past titles for strict anti-repetition
    const pastStories = store.getBedtimeStoryLibrary() || [];
    const pastTitles = pastStories.map(s => `"${s.title}"`).slice(0, 15).join(', ');

    let generatedAct = null;

    // If Gemini AI Logic is ready, attempt rich dynamic generation (~120-150 words per chapter)
    if (firebaseAI.isAiReady && firebaseAI.model) {
      try {
        this.isGenerating = true;
        const prompt = `You are ${petName}, a sweet, gentle cartoon companion narrating a children's (ages 3-7) bedtime story.
The setting is "${realm.name}".
The child hero is "${heroName}".
Today's bedtime moral theme: "${moral.name}" (${moral.tagline}).
${customWish ? `Parent/Child Special Bedtime Wish: "${customWish}". Weave this gently into the story!` : ''}
Current chapter: Chapter ${actNumber} of 4.
${previousChoice ? `The child chose: "${previousChoice}".` : ''}

ANTI-REPETITION MANDATE:
Do NOT repeat or copy any of these past story titles or plots: ${pastTitles || 'None yet'}. Make this story unique and refreshing!

CHAPTER GUIDELINES:
- Chapter 1: The Evening Departure. Introduce the twilight setting, packing bedtime hero gear or pajamas, and the soothing calm of dusk. (Target: ~110-130 words).
- Chapter 2: The Curious Discovery. The active pet (${petName}) uses their gentle senses to discover a sleepy creature or gentle bedtime mystery. (Target: ~120-140 words).
- Chapter 3: Overcoming the Challenge with the Daily Moral. The hurdle is resolved through ${moral.name} (${moral.moralGuidance}). ${petName} helps by ${moral.petAction}. (Target: ~130-150 words).
- Chapter 4: Peaceful Cozy Slumber. Tucking in, deep calming breaths, yawns, and soft goodnight whispers as ambient stars shine. (Target: ~110-130 words).

STRICT PALETTE RULE: NEVER use pink or purple words or hex colors in SVG. Only slate (#09141e), emerald green (#2ecc71), starlight cyan (#00d2d3), solar orange (#f39c12), and warm amber (#ffb961).

Return ONLY raw JSON with these exact keys (no markdown code blocks, just raw JSON):
{
  "title": "Chapter ${actNumber}: Short Title (max 4 words)",
  "text": "The rich soothing narrative text (target ~120-150 words)",
  "promptQuestion": "${actNumber < 4 ? 'A playful bedtime question or choice for the child' : 'A gentle sleepy goodnight whisper'}",
  "suggestionChips": [${actNumber === 1 ? '"Laser Toothbrush 🪥", "Star Map 🗺️", "Cozy Pajamas 🧸"' : actNumber === 2 ? '"A Baby Creature! 🦕", "A Glowing Star! ⭐", "A Lost Blanket! 🧶"' : actNumber === 3 ? '"Share Our Warmth! 🤝", "Take 3 Deep Breaths! 🧘", "Tidy Up Together! 🧹"' : '""'}]
}`;

        const result = await firebaseAI.model.generateContent(prompt);
        const rawText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(rawText);

        const fallbackSvg = generateFallbackSvg(realm.id, actNumber, previousChoice || (parsed.suggestionChips && parsed.suggestionChips[0]) || '');

        generatedAct = {
          actNumber,
          title: parsed.title || `Chapter ${actNumber}: ${realm.name}`,
          text: parsed.text || `Rex smiled happily beside ${heroName} as they gazed at the quiet, starry night.`,
          promptQuestion: parsed.promptQuestion || (actNumber < 4 ? 'What should we do next?' : 'Sleep tight, little hero.'),
          suggestionChips: Array.isArray(parsed.suggestionChips) && parsed.suggestionChips.length > 0
            ? parsed.suggestionChips.map(c => typeof c === 'string' ? { text: c, icon: 'stars' } : c)
            : (actNumber === 1 ? realm.act1DefaultChips : actNumber === 2 ? realm.act2DefaultChips : realm.act3DefaultChips),
          svgArt: fallbackSvg,
          isSleepingEnd: actNumber === 4
        };
      } catch (err) {
        console.warn('Gemini bedtime story generation fallback:', err);
      } finally {
        this.isGenerating = false;
      }
    }

    // Resilient offline combinatorial generator if AI generation failed or wasn't available
    if (!generatedAct) {
      generatedAct = this.createOfflineAct(actNumber, realm, moral, heroName, petName, customWish, previousChoice);
    }

    return generatedAct;
  }

  createOfflineAct(actNumber, realm, moral, heroName, petName, customWish, previousChoice) {
    const procedural = generateProceduralBedtimeStory(
      realm.id,
      moral?.id || 'brave_dark',
      heroName,
      petName,
      customWish,
      actNumber - 1,
      this.activeSession?.userChoices || []
    );

    const fallbackSvg = generateFallbackSvg(realm.id, actNumber, previousChoice || '');

    return {
      actNumber,
      title: procedural.title,
      text: procedural.text,
      promptQuestion: procedural.prompt,
      suggestionChips: procedural.defaultChips || [],
      svgArt: fallbackSvg,
      isSleepingEnd: actNumber === 4
    };
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
