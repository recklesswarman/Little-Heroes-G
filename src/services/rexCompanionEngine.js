// Toddler-Resilient Rex the Dino Voice & Companion Engine
// Provides audio pre-unlocking, automatic reconnection loops,
// sound effects, and child-safe speech synthesis for 3-4 year olds.

import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { store } from "../state/store.js";
import { Sound } from "../audio/sfx.js";
import { auth, functions as existingFunctions } from "../config/firebase.js";
import { signInAnonymously } from "firebase/auth";
import { geminiLiveService } from "./geminiLiveService.js";

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
          // ignore if sound engine is busy
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
        console.warn("Rex Speech error:", e.error);
        if (e.error === "no-speech" && this.shouldKeepListening) {
          // Normal timeout on silence - attempt restart loop
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
        } catch (err) {
          console.warn("Speech restart retry notice:", err?.message);
        }
      }
    }, 400);
  }

  setState(state) {
    this.currentState = state;

    // Update global store so UI components react instantly
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
    });

    if (this.onStateChange) {
      try {
        this.onStateChange(state);
      } catch (e) {
        console.error("Error in onStateChange callback:", e);
      }
    }
  }

  // Pre-unlock speech synthesis on the very first toddler tap
  // Prevents mobile/WebKit browsers from muting asynchronous TTS
  unlockAudio() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const silent = new SpeechSynthesisUtterance("");
        silent.volume = 0;
        window.speechSynthesis.speak(silent);
      } catch (e) {
        console.warn("Audio unlock notice:", e);
      }
    }
  }

  tryHandleInGameSpeech(spokenText) {
    const clean = spokenText.toLowerCase().trim();

    // Check if in active Toothbrush Battle
    const activeView = store.getState().currentView;
    if (activeView === 'battle' || activeView === 'ar_battle') {
      if (/blast|foam|toothpaste|attack|fire/i.test(clean)) {
        this.speak("Toothpaste Foam Cannon! Super Blast!");
        window.dispatchEvent(
          new CustomEvent('rex-battle-foam', {
            detail: { powerLevel: 'mega', comment: 'Toothpaste Foam Cannon!' }
          })
        );
        return true;
      }
      if (/shield|bubble|protect|block/i.test(clean)) {
        this.speak("Hero Mint Bubble Shield activated!");
        window.dispatchEvent(
          new CustomEvent('rex-battle-shield', {
            detail: { shieldType: 'mint' }
          })
        );
        return true;
      }
      if (/roar|dino|smash|power/i.test(clean)) {
        this.speak("ROAR! Dino Power Scrub!");
        window.dispatchEvent(
          new CustomEvent('rex-battle-foam', {
            detail: { powerLevel: 'dino-roar', comment: 'Dino Power Scrub!' }
          })
        );
        return true;
      }
    }

    const context = geminiLiveService.currentQuestContext;
    if (!context || !context.options || context.options.length === 0) {
      return false;
    }

    // 1. Hint request
    if (/hint|clue|help|stuck|tell me/i.test(clean)) {
      this.speak("Rex says: Look closely at the pictures and colors!");
      window.dispatchEvent(
        new CustomEvent('rex-live-hint', {
          detail: { hintText: "Look closely at the pictures and colors!" }
        })
      );
      return true;
    }

    // 2. Eliminate / 50-50 Stomp request
    if (/stomp|eliminate|remove|50|take away/i.test(clean)) {
      const correctIdx = context.correctAnswerIndex ?? 0;
      const wrongIndices = context.options
        .map((_, i) => i)
        .filter(i => i !== correctIdx);
      const elimIdx = wrongIndices.length > 0 ? wrongIndices[0] : 1;
      this.speak("Dino Stomp! That one is not the answer!");
      window.dispatchEvent(
        new CustomEvent('rex-live-eliminate', {
          detail: { eliminatedOptionIndex: elimIdx, comment: "Dino Stomp!" }
        })
      );
      return true;
    }

    // 3. Read question
    if (/read|repeat|say it|what is/i.test(clean)) {
      const q = context.question || "Can you find the right answer?";
      this.speak(q);
      window.dispatchEvent(
        new CustomEvent('rex-live-read', {
          detail: { questionText: q }
        })
      );
      return true;
    }

    // 4. Answering option: check A, B, C, D or exact/fuzzy word match
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
      this.speak(`Rex picked ${context.options[matchedIdx]}! Rawr!`);
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
        this.speak("Roar! I hear you, Little Hero! Tap the pictures to play!");
        return;
      }
      try {
        this.shouldKeepListening = true;
        this.setState("listening");
        this.recognition.start();
      } catch (err) {
        console.warn("Could not start recognition:", err);
        // If already started, force restart
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

    store.setLiveRexState({
      lastUserTranscript: message,
      statusMessage: "Rex is thinking..."
    });

    const activeHero = store.getState().selectedHero;
    const heroId = activeHero?.name || activeHero?.id || "Little Hero";

    try {
      // Ensure anonymous session if Firebase Auth is active
      if (auth && !auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch {
          // Continue gracefully even without auth
        }
      }

      const chatFn = httpsCallable(functions, "chatWithPet");
      const res = await chatFn({
        heroId,
        message,
        ageTier: "toddler"
      });

      const reply = res.data?.reply || "*Happy Roar!* Great job, Little Hero!";
      store.setLiveRexState({ lastRexTranscript: reply });
      this.speak(reply);
    } catch (err) {
      console.error("Rex Cloud Function chatWithPet error details:", {
        code: err?.code,
        message: err?.message,
        details: err?.details,
        customData: err?.customData,
        region: "us-central1"
      });

      let errReason = "";
      if (err?.code === "functions/unauthenticated") {
        errReason = " (Unauthenticated)";
      } else if (err?.code === "functions/unavailable" || err?.message?.includes("CORS")) {
        errReason = " (CORS / Region check failed)";
      } else if (err?.code === "functions/internal") {
        errReason = " (API Key / Quota error)";
      }

      const fallbackReply = "*Happy Roar!* Rex loves you, Little Hero! Let's play!";
      store.setLiveRexState({
        lastRexTranscript: fallbackReply,
        statusMessage: `Note: ${err?.message || "Connection issue"}${errReason}. Ready to play!`
      });
      this.speak(fallbackReply);
    }
  }

  speak(text) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.setState("idle");
      return;
    }

    this.setState("talking");
    try {
      window.speechSynthesis.cancel();
    } catch {}

    // Clean out stage-directions (*ROAR!*, *Happy Dino Giggle!*) for crystal-clear TTS audio
    const speechText = text.replace(/\*.*?\*/g, "").trim() || "Roar! Great job!";
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.pitch = 1.35; // friendly animated cartoon dino pitch
    utterance.rate = 0.95;  // gentle, slightly slower cadence for toddlers

    // Select natural child-friendly voice if available
    const voices = window.speechSynthesis.getVoices();
    const friendlyVoice =
      voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Child") || v.name.includes("Junior"))) ||
      voices.find((v) => v.lang.startsWith("en"));
    if (friendlyVoice) utterance.voice = friendlyVoice;

    utterance.onend = () => {
      this.setState("idle");
    };
    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
      this.setState("idle");
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("speechSynthesis.speak failed:", err);
      this.setState("idle");
    }
  }
}

export const rexEngine = new RexVoiceEngine();
