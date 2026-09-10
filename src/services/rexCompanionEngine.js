// Toddler-Resilient Rex the Dino Voice & Companion Engine
// Provides audio pre-unlocking, automatic reconnection loops,
// sound effects, and child-safe speech synthesis for 3-4 year olds.

import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { store } from "../state/store.js";
import { Sound } from "../audio/sfx.js";
import { auth } from "../config/firebase.js";
import { signInAnonymously } from "firebase/auth";

let functions;
try {
  functions = getFunctions(getApp());
} catch {
  functions = getFunctions();
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
          await this.sendToRex(transcript.trim());
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
      console.warn("Rex Cloud Function notice, using fallback reply:", err?.message || err);
      const fallbackReply = "*Happy Roar!* Rex loves you, Little Hero! Let's play!";
      store.setLiveRexState({ lastRexTranscript: fallbackReply });
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
