/**
 * Bedtime AI Storybook Adventure Service
 * Little Hero Adventures - Dynamic Conversational Bedtime Story Engine
 * 
 * Powered by Gemini API (Firebase AI Logic) + Gemini Companion TTS / Web Speech.
 * Enforces strict zero pink/purple Explorer Palette and non-blocking bedtime rewards.
 */

import { store } from '../state/store.js';
import { firebaseAI } from './firebaseAILogicService.js';
import { speakCompanion, stopCompanionAudio } from './voiceService.js';
import { BEDTIME_REALMS, generateFallbackSvg } from '../data/bedtimeStoryData.js';

class BedtimeStoryService {
  constructor() {
    this.activeSession = null;
    this.recognition = null;
    this.isListening = false;
    this.isGenerating = false;
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
      } catch (e) {
        // Ignore stop errors
      }
    }
    this.isListening = false;
  }

  /**
   * Start a brand new 3-act Bedtime Story
   */
  async startStory(realmId) {
    const realm = BEDTIME_REALMS.find(r => r.id === realmId) || BEDTIME_REALMS[0];
    const hero = store.getState().selectedHero;
    const petId = String(hero.activePetId || '1');
    const pet = (store.getState().pets || []).find(p => String(p.id) === petId) || { name: 'Rex the Dino' };

    this.activeSession = {
      id: `story_${Date.now()}`,
      realmId: realm.id,
      realmName: realm.name,
      realmEmoji: realm.emoji,
      title: `${hero.name}'s Adventure in ${realm.name}`,
      heroName: hero.name || 'Little Hero',
      petId: petId,
      petName: pet.name || 'Rex',
      actNumber: 1,
      acts: [],
      completed: false,
      createdAt: Date.now()
    };

    store.state.activeBedtimeStory = this.activeSession;

    // Build Act 1
    const act1 = await this.generateAct(1, null);
    this.activeSession.acts.push(act1);

    // Speak narration aloud with pet voice
    this.narrateAct(act1.text, petId);

    return act1;
  }

  /**
   * Advance story with the child's choice / speech response
   */
  async advanceStory(childInput) {
    if (!this.activeSession) return null;

    const currentActNumber = this.activeSession.actNumber;
    // Record choice on current act
    const currentAct = this.activeSession.acts[currentActNumber - 1];
    if (currentAct) {
      currentAct.childChoice = childInput;
    }

    if (currentActNumber >= 3) {
      return this.activeSession.acts[2];
    }

    const nextActNumber = currentActNumber + 1;
    this.activeSession.actNumber = nextActNumber;

    const nextAct = await this.generateAct(nextActNumber, childInput);
    this.activeSession.acts.push(nextAct);

    if (nextActNumber === 3) {
      this.activeSession.completed = true;
      // Complete bedtime story quietly per guidelines
      store.completeBedtimeStory(this.activeSession);
    }

    // Narrate act aloud
    const petId = this.activeSession.petId;
    this.narrateAct(nextAct.text, petId, nextActNumber === 3 ? { rate: 0.88, pitch: 1.15 } : {});

    return nextAct;
  }

  narrateAct(text, petId, options = {}) {
    try {
      speakCompanion(text, petId, () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bedtime-story-speech-finished'));
        }
      }, options);
    } catch (e) {
      console.warn('Story speech error:', e);
    }
  }

  /**
   * Generate an Act (1, 2, or 3) using Gemini or offline fallback
   */
  async generateAct(actNumber, previousChoice) {
    const session = this.activeSession;
    const realm = BEDTIME_REALMS.find(r => r.id === session.realmId) || BEDTIME_REALMS[0];
    const heroName = session.heroName;
    const petName = session.petName;

    let generatedAct = null;

    // If Gemini AI Logic is ready, attempt dynamic generation
    if (firebaseAI.isAiReady && firebaseAI.model) {
      try {
        this.isGenerating = true;
        const prompt = `You are ${petName}, a sweet, gentle cartoon companion in a children's (ages 3-7) bedtime story.
The setting is "${realm.name}".
The child hero is "${heroName}".
Current act: Act ${actNumber} of 3.
${previousChoice ? `The child said: "${previousChoice}".` : ''}

ACT GUIDELINES:
- Act 1: The exciting departure. Introduce the cozy adventure and ask what hero gadget or friend to pack. (Max 2 sentences).
- Act 2: A whimsical bedtime obstacle solved by a good habit (e.g. brushing dinosaur/dragon teeth, tidying up tools, drinking cool water, or putting on cozy pajamas). Celebrate the child's previous choice: "${previousChoice || ''}". (Max 3 sentences).
- Act 3: Cozy slumber conclusion. The stars shine, everyone curls up in warm beds, yawns happily, and drifts off to dreamland. (Max 2 calm, sleepy sentences).

STRICT PALETTE RULE: NEVER use pink or purple words or hex colors in SVG. Only slate (#09141e), emerald green (#2ecc71), starlight cyan (#00d2d3), solar orange (#f39c12), and warm amber (#ffb961).

Return ONLY raw JSON with these exact keys (no markdown code blocks, just raw JSON):
{
  "title": "Short Act Title (max 4 words)",
  "text": "The story text narrated by ${petName} (2-3 gentle sentences)",
  "promptQuestion": "${actNumber < 3 ? 'A playful bedtime question for the child' : 'A gentle sleepy goodnight whisper'}",
  "suggestionChips": [${actNumber === 1 ? '"Laser Toothbrush 🪥", "Star Map 🗺️", "Cosmic Snack 🍎"' : actNumber === 2 ? '"Tidy up! 🧹", "Brush shiny! ✨", "Sip water! 💧"' : '""'}],
  "svgElementsDescription": "Brief description of the illustrated scene"
}`;

        const result = await firebaseAI.model.generateContent(prompt);
        const rawText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(rawText);

        const fallbackSvg = generateFallbackSvg(realm.id, actNumber, previousChoice || (parsed.suggestionChips && parsed.suggestionChips[0]) || '');

        generatedAct = {
          actNumber,
          title: parsed.title || `Act ${actNumber}: ${realm.name}`,
          text: parsed.text || `Rex smiled happily beside ${heroName} as they gazed at the starry night.`,
          promptQuestion: parsed.promptQuestion || (actNumber < 3 ? 'What should we do next?' : 'Sleep tight, little hero.'),
          suggestionChips: Array.isArray(parsed.suggestionChips) && parsed.suggestionChips.length > 0
            ? parsed.suggestionChips.map(c => typeof c === 'string' ? { text: c, icon: 'stars' } : c)
            : (actNumber === 1 ? realm.act1DefaultChips : realm.act2DefaultChips),
          svgArt: fallbackSvg,
          isSleepingEnd: actNumber === 3
        };
      } catch (err) {
        console.warn('Gemini bedtime story generation fallback:', err);
      } finally {
        this.isGenerating = false;
      }
    }

    // Resilient offline fallback if AI generation failed or wasn't available
    if (!generatedAct) {
      generatedAct = this.createOfflineAct(actNumber, realm, heroName, petName, previousChoice);
    }

    return generatedAct;
  }

  createOfflineAct(actNumber, realm, heroName, petName, previousChoice) {
    const fallbackSvg = generateFallbackSvg(realm.id, actNumber, previousChoice || '');

    if (actNumber === 1) {
      return {
        actNumber: 1,
        title: `Act 1: Journey into ${realm.name}`,
        text: `${petName} adjusted his tiny explorer helmet and smiled at ${heroName}. "The moon is high and the stars are out in ${realm.name}! What special hero supply should we pack into our adventure pouch?"`,
        promptQuestion: realm.act1Prompts[0],
        suggestionChips: realm.act1DefaultChips,
        svgArt: fallbackSvg,
        isSleepingEnd: false
      };
    }

    if (actNumber === 2) {
      return {
        actNumber: 2,
        title: `Act 2: The Whimsical Habit Climax`,
        text: `With our ${previousChoice || 'hero gear'} ready, ${petName} and ${heroName} reached the secret clearing! ${realm.act2Prompts[0]}`,
        promptQuestion: `How does our hero habit solve this bedtime puzzle?`,
        suggestionChips: realm.act2DefaultChips,
        svgArt: fallbackSvg,
        isSleepingEnd: false
      };
    }

    // Act 3
    return {
      actNumber: 3,
      title: `Act 3: The Peaceful Slumber`,
      text: `${realm.act3Prompt} ${heroName} and ${petName} snuggled deep into their warm blankets. The whole island drifted into peaceful dreams.`,
      promptQuestion: `Yaaawn... Goodnight, little hero. Sweet dreams under the starlight.`,
      suggestionChips: [],
      svgArt: fallbackSvg,
      isSleepingEnd: true
    };
  }

  getActiveSession() {
    return this.activeSession;
  }

  clearSession() {
    stopCompanionAudio();
    this.stopListening();
    this.activeSession = null;
    store.state.activeBedtimeStory = null;
  }
}

export const bedtimeStoryService = new BedtimeStoryService();
