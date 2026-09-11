// Pet Companion & Rex the Dino Spoken Voice Guidance for Toddlers (Easy Mode Age 3-4) & App-wide Voice Output
// Calls speakCompanion via Cloudflare Worker proxy, with device-native Daniel SpeechSynthesis fallback.

import { speakCompanion, stopRex } from '../services/voiceService.js';
import { store } from '../state/store.js';

class VoicePromptsService {
  constructor() {
    this.isEnabled = true;
  }

  async speak(text, onEndCallback = null, petId = null) {
    if (!this.isEnabled || !text) return;
    this.stop();
    const targetPetId = petId || store.getActivePet?.()?.id || 'rex';
    await speakCompanion(text, targetPetId, onEndCallback);
  }

  speakGuidance(stepName, questionText, options = []) {
    const welcome = stepName ? `Welcome to ${stepName}!` : '';
    const prompt = questionText ? `${questionText}. Can you tap the right answer?` : '';
    const textToSpeak = [welcome, prompt].filter(Boolean).join(' ');
    this.speak(textToSpeak);
  }

  speakSuccess() {
    const praises = [
      "Great job! You found the right answer!",
      "Hooray! That is correct! You are a super hero!",
      "Awesome work! Your companion is so happy!",
      "You did it! Super hero power!"
    ];
    const pick = praises[Math.floor(Math.random() * praises.length)];
    this.speak(pick);
  }

  speakTryAgain() {
    this.speak("Almost there! Give it another try!");
  }

  speakExpeditionDepart(petName = 'Your companion', biomeTitle = 'the wilderness') {
    this.speak(`Safe travels into ${biomeTitle}, ${petName}! Bring back shiny treasures and postcards!`);
  }

  speakExpeditionReturn(petName = 'Your companion', souvenirTitle = '') {
    const itemMsg = souvenirTitle ? ` You found ${souvenirTitle}!` : '';
    this.speak(`Hooray! Welcome home, ${petName}!${itemMsg} Check your souvenir shelf!`);
  }

  stop() {
    stopRex();
  }
}

export const voicePrompts = new VoicePromptsService();
