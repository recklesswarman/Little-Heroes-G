import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../config/firebase.js";
import { signInAnonymously } from "firebase/auth";

// Initialize functions using your existing Firebase app setup
let functions;
try {
  functions = getFunctions(getApp());
} catch {
  functions = getFunctions();
}

/**
 * Sends a message to Rex the Dino and returns his reaction
 */
export async function talkToRex(message, heroId = "hero_demo_1", currentHabit = null) {
  try {
    // Automatically ensure active Firebase Auth session so request.auth is populated
    if (auth && !auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        console.warn("Anonymous auth notice:", authErr.message);
      }
    }

    const chatWithPetFn = httpsCallable(functions, "chatWithPet");
    const result = await chatWithPetFn({
      heroId,
      message,
      currentHabit,
    });
    return result.data.reply;
  } catch (error) {
    console.error("Rex communication error:", error);
    return "*ROAR!* I had a little trouble hearing you, but I'm ready for adventure!";
  }
}

/**
 * Speaks Rex's dialogue aloud using browser speech synthesis
 */
export function playRexVoice(text) {
  if (!("speechSynthesis" in window)) return;

  // Clean out stage action cues like *ROAR!* for clear text-to-speech audio
  const cleanSpokenText = text.replace(/\*.*?\*/g, "").trim();

  const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
  utterance.pitch = 1.35; // Energetic, child-friendly pitch
  utterance.rate = 1.05;

  const voices = window.speechSynthesis.getVoices();
  const naturalVoice = voices.find((v) => v.lang.startsWith("en") && v.name.includes("Natural")) ||
    voices.find((v) => v.lang.startsWith("en"));
  if (naturalVoice) utterance.voice = naturalVoice;

  window.speechSynthesis.speak(utterance);
}
