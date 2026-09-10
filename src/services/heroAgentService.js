import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, functions as existingFunctions } from "../config/firebase.js";
import { signInAnonymously } from "firebase/auth";

// Initialize functions using centralized configuration with explicit us-central1 region
let functions = existingFunctions;
if (!functions) {
  try {
    functions = getFunctions(getApp(), "us-central1");
  } catch {
    functions = getFunctions();
  }
}

/**
 * Sends a message to Rex the Dino and returns his reaction.
 * Includes detailed error logging for CORS, unauthenticated requests, and Cloud Function diagnostics.
 */
export async function talkToRex(message, heroId = "hero_demo_1", currentHabit = null) {
  try {
    // Automatically ensure active Firebase Auth session so request.auth is populated
    if (auth && !auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        console.warn("Anonymous auth notice (proceeding as guest):", authErr.message);
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
    // Surface full diagnostic error details
    console.error("Rex Cloud Function call failed [chatWithPet]:", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      customData: error?.customData,
      region: "us-central1",
      endpoint: "chatWithPet"
    });

    // Provide descriptive feedback if unauthenticated, CORS, or quota
    let detailMsg = "";
    if (error?.code === "functions/unauthenticated") {
      detailMsg = " (Session unauthenticated)";
    } else if (error?.code === "functions/unavailable" || error?.message?.includes("CORS")) {
      detailMsg = " (Network/CORS blocked)";
    }

    return `*ROAR!* I had a little trouble hearing you${detailMsg}, but I'm ready for adventure!`;
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
