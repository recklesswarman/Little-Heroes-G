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

    try {
      await speakRex(text, onEndCallback);
    } catch (e) {
      console.warn("Rex voice fallback to browser synth:", e);
      if (this.synth) {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.pitch = 1.25;
          utterance.rate = 0.88;
          utterance.volume = 1.0;
          if (onEndCallback) utterance.onend = onEndCallback;
          this.synth.speak(utterance);
        } catch (err) {
          console.warn("Browser SpeechSynthesis error:", err);
        }
      }
    }
  }

  speakGuidance(stepName, questionText, options = []) {
    const welcome = `Welcome to ${stepName}!`;
    const prompt = `${questionText}. Can you tap the right answer?`;
    this.speak(`${welcome} ... ${prompt}`);
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
    if (this.synth && this.synth.speaking) {
      try {
        this.synth.cancel();
      } catch {
        // Ignore
      }
    }
  }
}

export const voicePrompts = new VoicePromptsService();
