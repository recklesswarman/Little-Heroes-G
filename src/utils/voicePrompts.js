// Rex the Dino Spoken Voice Guidance for Toddlers (Easy Mode Age 3-4) & App-wide Voice Output
// Calls speakRex via Cloudflare Worker proxy, with browser SpeechSynthesis fallback.

import { speakRex, stopRex } from '../services/voiceService.js';

class VoicePromptsService {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.isEnabled = true;
  }

  async speak(text, onEndCallback = null) {
    if (!this.isEnabled || !text) return;
    this.stop();
    await speakRex(text, onEndCallback);
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

  stop() {
    stopRex();
  }
}

export const voicePrompts = new VoicePromptsService();
