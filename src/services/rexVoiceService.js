import { getFunctions, httpsCallable } from "firebase/functions";
import { app, functions as existingFunctions } from "../config/firebase.js";

const functions = existingFunctions || (app ? getFunctions(app) : getFunctions());

export async function askRex(heroId, message, currentHabit = null) {
  try {
    const chatWithPetFn = httpsCallable(functions, "chatWithPet");
    const response = await chatWithPetFn({ heroId, message, currentHabit });
    const replyText = response.data?.reply || "*ROAR!* Awesome job, Little Hero!";

    // Speak response aloud using browser SpeechSynthesis
    speakAsRex(replyText);

    return replyText;
  } catch (err) {
    console.warn("Rex cloud function notice, falling back:", err.message);
    const fallbackText = `*ROAR!* High five, Little Hero! Let's keep exploring!`;
    speakAsRex(fallbackText);
    return fallbackText;
  }
}

export function speakAsRex(text) {
  if (!("speechSynthesis" in window)) return;

  // Strip stage directions like *ROAR!* for cleaner text-to-speech audio
  const cleanSpokenText = text.replace(/\*.*?\*/g, "").trim();
  if (!cleanSpokenText) return;

  // Cancel any ongoing speech to avoid overlapping
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
  utterance.pitch = 1.3; // Higher, animated kid-friendly voice pitch
  utterance.rate = 1.05;

  const voices = window.speechSynthesis.getVoices();
  const friendlyVoice = voices.find((v) => v.lang.startsWith("en") && v.name.includes("Natural")) ||
    voices.find((v) => v.lang.startsWith("en"));
  if (friendlyVoice) utterance.voice = friendlyVoice;

  window.speechSynthesis.speak(utterance);
}
