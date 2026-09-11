// Toddler-Resilient Pet Companion & Rex the Dino Voice Engine
// Dual-engine SpeechRecognition + unified VoiceService speech synthesis,
// audio pre-unlocking, automatic reconnection loops, and interactive in-game voice commands.

import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { store } from "../state/store.js";
import { Sound } from "../audio/sfx.js";
import { auth, functions as existingFunctions } from "../config/firebase.js";
import { signInAnonymously } from "firebase/auth";
import { geminiLiveService } from "./geminiLiveService.js";
import { speakCompanion, unlockVoiceAudio } from "./voiceService.js";

let functions = existingFunctions;
if (!functions) {
  try {
    functions = getFunctions(getApp(), "us-central1");
  } catch {
    functions = getFunctions();
  }
}

class RexVoiceEngine {
  constructor() {
    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    this.recognition = SpeechRecognition ? new SpeechRecognition() : null;
    this.isListening = false;
    this.shouldKeepListening = false;
    this.currentState = "idle"; // 'idle' | 'listening' | 'thinking' | 'talking'
    this.onStateChange = null;
    this.restartTimeout = null;

    if (this.recognition) {
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = "en-US";

      this.recognition.onstart = () => {
        this.isListening = true;
        this.setState("listening");
        try {
          Sound.chirp();
        } catch {
          // ignore
        }
      };

      this.recognition.onresult = async (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript && transcript.trim()) {
          this.shouldKeepListening = false;
          const text = transcript.trim();
          const handledInGame = this.tryHandleInGameSpeech(text);
          if (!handledInGame) {
            await this.sendToRex(text);
          }
        }
      };

      this.recognition.onerror = (e) => {
        if (e.error === "no-speech" && this.shouldKeepListening) {
          // Silence timeout on WebKit/Chrome - restart loop
          this.scheduleRestart();
          return;
        }
        this.isListening = false;
        this.shouldKeepListening = false;
        if (this.currentState === "listening") {
          this.setState("idle");
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.shouldKeepListening && this.currentState === "listening") {
          this.scheduleRestart();
        } else if (this.currentState === "listening") {
          this.setState("idle");
        }
      };
    }
  }

  scheduleRestart() {
    if (this.restartTimeout) clearTimeout(this.restartTimeout);
    this.restartTimeout = setTimeout(() => {
      if (this.shouldKeepListening && this.currentState === "listening" && this.recognition) {
        try {
          this.recognition.start();
        } catch {
          // Retry again if still active
          if (this.shouldKeepListening) {
            setTimeout(() => {
              try { if (this.shouldKeepListening) this.recognition.start(); } catch {}
            }, 300);
          }
        }
      }
    }, 400);
  }

  setState(state) {
    this.currentState = state;

    // Update global store without blowing away the app DOM during active gameplay
    store.setLiveRexState({
      status: state,
      isListening: state === "listening",
      isSpeaking: state === "talking",
      statusMessage:
        state === "listening"
          ? "Rex is listening! Speak to your dino buddy!"
          : state === "thinking"
          ? "Rex is thinking..."
          : state === "talking"
          ? "Rex is talking!"
          : "Tap Rex to talk!"
    }, true);

    if (this.onStateChange) {
      try {
        this.onStateChange(state);
      } catch (e) {
        console.error("Error in onStateChange callback:", e);
      }
    }
  }

  unlockAudio() {
    unlockVoiceAudio();
  }

  tryHandleInGameSpeech(spokenText) {
    const clean = spokenText.toLowerCase().trim();
    const activePet = store.getActivePet?.();
    const activePetId = activePet?.id || "rex";

    // 1. AR TOOTHBRUSH BATTLE VOICE COMMANDS
    const activeView = store.getState().activeView || store.getState().currentView;
    if (activeView === 'battle' || activeView === 'ar_battle') {
      if (/blast|foam|toothpaste|attack|laser|fire/i.test(clean)) {
        this.speak("Toothpaste Foam Cannon! Super Blast!", activePetId);
        window.dispatchEvent(
          new CustomEvent('rex-battle-foam', {
            detail: { powerLevel: 'mega', comment: 'Toothpaste Foam Cannon!' }
          })
        );
        return true;
      }
      if (/shield|bubble|protect|block/i.test(clean)) {
        this.speak("Hero Mint Bubble Shield activated!", activePetId);
        window.dispatchEvent(
          new CustomEvent('rex-battle-shield', {
            detail: { shieldType: 'mint' }
          })
        );
        return true;
      }
      if (/roar|dino|smash|power|scrub/i.test(clean)) {
        this.speak("ROAR! Dino Power Scrub!", activePetId);
        window.dispatchEvent(
          new CustomEvent('rex-battle-foam', {
            detail: { powerLevel: 'dino-roar', comment: 'Dino Power Scrub!' }
          })
        );
        return true;
      }
    }

    // 2. MOVEMENT DANCE PARTY VOICE COMMANDS
    if (activeView === 'dance_party' || /dance|freeze|statue|jump|spin|fever/i.test(clean)) {
      if (/freeze|statue|stop/i.test(clean)) {
        this.speak("FREEZE! Freeze like a statue!", activePetId);
        window.dispatchEvent(new CustomEvent('rex-dance-freeze'));
        return true;
      }
      if (/jump|star jump|hop/i.test(clean)) {
        this.speak("Super Star Jump! Reach for the sky!", activePetId);
        window.dispatchEvent(new CustomEvent('rex-dance-jump'));
        return true;
      }
      if (/spin|twirl|circle/i.test(clean)) {
        this.speak("Hero Spin! Wheee!", activePetId);
        window.dispatchEvent(new CustomEvent('rex-dance-spin'));
        return true;
      }
      if (/fever|burst|power/i.test(clean)) {
        this.speak("FEVER BURST! Look at that rhythm energy!", activePetId);
        window.dispatchEvent(new CustomEvent('rex-dance-fever'));
        return true;
      }
    }

    // 3. LEARNING ADVENTURES QUEST COMMANDS
    const context = geminiLiveService.currentQuestContext;
    if (context && context.options && context.options.length > 0) {
      // A. Hint request
      if (/hint|clue|help|stuck|tell me/i.test(clean)) {
        this.speak("Look closely at the pictures and colors!", activePetId);
        window.dispatchEvent(
          new CustomEvent('rex-live-hint', {
            detail: { hintText: "Look closely at the pictures and colors!" }
          })
        );
        return true;
      }

      // B. Eliminate / 50-50 Stomp request
      if (/stomp|eliminate|remove|50|take away/i.test(clean)) {
        const correctIdx = context.correctAnswerIndex ?? 0;
        const wrongIndices = context.options
          .map((_, i) => i)
          .filter(i => i !== correctIdx);
        const elimIdx = wrongIndices.length > 0 ? wrongIndices[0] : 1;
        this.speak("Dino Stomp! That choice is out of the way!", activePetId);
        window.dispatchEvent(
          new CustomEvent('rex-live-eliminate', {
            detail: { eliminatedOptionIndex: elimIdx, comment: "Dino Stomp!" }
          })
        );
        return true;
      }

      // C. Read question
      if (/read|repeat|say it|what is/i.test(clean)) {
        const q = context.question || "Can you find the right answer?";
        this.speak(q, activePetId);
        window.dispatchEvent(
          new CustomEvent('rex-live-read', {
            detail: { questionText: q }
          })
        );
        return true;
      }

      // D. Answering option: check A, B, C, D or exact/fuzzy word match
      let matchedIdx = -1;
      if (/\b(option\s*a|letter\s*a|^a$)\b/i.test(clean)) matchedIdx = 0;
      else if (/\b(option\s*b|letter\s*b|^b$)\b/i.test(clean)) matchedIdx = 1;
      else if (/\b(option\s*c|letter\s*c|^c$)\b/i.test(clean)) matchedIdx = 2;
      else if (/\b(option\s*d|letter\s*d|^d$)\b/i.test(clean)) matchedIdx = 3;

      if (matchedIdx === -1) {
        for (let i = 0; i < context.options.length; i++) {
          const optText = String(context.options[i]).toLowerCase().trim();
          if (clean.includes(optText) || optText.includes(clean)) {
            matchedIdx = i;
            break;
          }
        }
      }

      if (matchedIdx >= 0 && matchedIdx < context.options.length) {
        this.speak(`You picked ${context.options[matchedIdx]}! Super choice!`, activePetId);
        window.dispatchEvent(
          new CustomEvent('rex-live-answer', {
            detail: {
              optionIndex: matchedIdx,
              optionText: String(context.options[matchedIdx]),
              explanation: "Awesome choice!"
            }
          })
        );
        return true;
      }
    }

    // 4. DAILY HABITS & CHORE VOICE CLAIMS
    if (/water|drink/i.test(clean) && /drank|done|finished|cup|glass/i.test(clean)) {
      store.toggleHabitIsland('drink_water');
      this.speak("Gulp gulp! Super hero hydration power! You earned shiny coins!", activePetId);
      return true;
    }
    if (/teeth|brush/i.test(clean) && /brushed|done|clean|finished/i.test(clean)) {
      store.toggleHabitIsland('brush_teeth');
      this.speak("Sparkle smile! Your teeth are super clean and strong!", activePetId);
      return true;
    }
    if (/bed/i.test(clean) && /made|tidy|clean/i.test(clean)) {
      store.toggleTaskForest('morning_bed');
      this.speak("Hero bed all made! Your room looks incredible!", activePetId);
      return true;
    }
    if (/toy|toys|blocks/i.test(clean) && /clean|away|tidy|put/i.test(clean)) {
      store.toggleTaskForest('clean_toys');
      this.speak("Toys all put away! Great teamwork, Little Hero!", activePetId);
      return true;
    }
    if (/snack|fruit|apple|veggie/i.test(clean) && /ate|eat|healthy/i.test(clean)) {
      store.toggleHabitIsland('eat_healthy_snack');
      this.speak("Crunch crunch! Healthy fuel makes heroes super strong!", activePetId);
      return true;
    }

    return false;
  }

  toggleListen() {
    this.unlockAudio();

    if (this.isListening || this.shouldKeepListening) {
      this.shouldKeepListening = false;
      this.isListening = false;
      if (this.restartTimeout) clearTimeout(this.restartTimeout);
      try {
        this.recognition?.stop();
      } catch {
        // ignore
      }
      this.setState("idle");
    } else {
      if (!this.recognition) {
        console.warn("SpeechRecognition not supported in this browser.");
        const activePet = store.getActivePet?.();
        this.speak("Roar! I hear you, Little Hero! Tap the pictures to play with me!", activePet?.id || "rex");
        store.toggleLiveRexModal(true);
        return;
      }
      try {
        this.shouldKeepListening = true;
        this.setState("listening");
        this.recognition.start();
      } catch (err) {
        console.warn("Could not start recognition:", err);
        try {
          this.recognition.stop();
          setTimeout(() => {
            if (this.shouldKeepListening) this.recognition.start();
          }, 200);
        } catch {}
      }
    }
  }

  async sendToRex(message) {
    if (this.restartTimeout) clearTimeout(this.restartTimeout);
    this.shouldKeepListening = false;
    this.setState("thinking");

    const activePet = store.getActivePet?.();
    const activePetId = activePet?.id || "rex";
    const activeHero = store.getState().selectedHero;
    const heroId = activeHero?.name || activeHero?.id || "Little Hero";
    const isToddler = store.isEasyMode?.() ?? true;

    store.setLiveRexState({
      lastUserTranscript: message,
      statusMessage: "Rex is thinking..."
    }, true);

    try {
      if (auth && !auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch {
          // Continue gracefully
        }
      }

      const chatFn = httpsCallable(functions, "chatWithPet");
      const res = await chatFn({
        heroId,
        message,
        petId: activePetId,
        ageTier: isToddler ? "toddler" : "kid"
      });

      const reply = res.data?.reply || `*Happy cheer!* Great job, ${heroId}! Ready for adventure!`;
      store.setLiveRexState({ lastRexTranscript: reply }, true);
      this.speak(reply, activePetId);
    } catch (err) {
      console.error("Rex Cloud Function chatWithPet error details:", {
        code: err?.code,
        message: err?.message,
        details: err?.details,
        customData: err?.customData,
        region: "us-central1"
      });

      const fallbackReply = `*Happy Roar!* High five, ${activeHero?.name || "Little Hero"}! Let's do our quests and play together!`;
      store.setLiveRexState({
        lastRexTranscript: fallbackReply,
        statusMessage: "Rex is ready to play!"
      }, true);
      this.speak(fallbackReply, activePetId);
    }
  }

  speak(text, petId = null) {
    const activePetId = petId || store.getActivePet?.()?.id || "rex";
    this.setState("talking");
    speakCompanion(text, activePetId, () => {
      this.setState("idle");
    });
  }
}

export const rexEngine = new RexVoiceEngine();
