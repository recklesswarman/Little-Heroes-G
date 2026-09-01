// Realistic Voice Prompts & Audio Guidance for Toddlers (Easy Mode)
// Uses Web Speech API (SpeechSynthesis) with cheerful, child-friendly pitch and pacing.

class VoicePromptsService {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.isEnabled = true;
    this.currentUtterance = null;
  }

  speak(text, onEndCallback = null) {
    if (!this.synth || !this.isEnabled || !text) return;

    try {
      this.stop(); // Stop any ongoing speech

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Cheerful, encouraging toddler guide voice settings
      utterance.pitch = 1.25; // Slightly higher, friendly pitch
      utterance.rate = 0.88;  // Clear, gentle, unhurried pacing for ages 3-4
      utterance.volume = 1.0;

      // Prefer warm natural English voices if available
      const voices = this.synth.getVoices();
      const preferredVoice = voices.find(v => 
        (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Victoria') || v.name.includes('Google')))
      ) || voices.find(v => v.lang.startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      if (onEndCallback) {
        utterance.onend = onEndCallback;
      }

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    } catch (e) {
      console.warn("SpeechSynthesis error:", e);
    }
  }

  speakGuidance(stepName, questionText, options = []) {
    const welcome = `Welcome to ${stepName}! Let's play together!`;
    const prompt = `${questionText}. Can you tap the right answer?`;
    this.speak(`${welcome} ... ${prompt}`);
  }

  speakSuccess() {
    const praises = [
      "Great job! You found the right answer!",
      "Hooray! That is correct! You are a super hero!",
      "Awesome work! Your companion is so happy!",
      "You did it! Keep on exploring!"
    ];
    const pick = praises[Math.floor(Math.random() * praises.length)];
    this.speak(pick);
  }

  speakTryAgain() {
    this.speak("Almost there! Give it another try!");
  }

  stop() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
    }
  }
}

export const voicePrompts = new VoicePromptsService();
