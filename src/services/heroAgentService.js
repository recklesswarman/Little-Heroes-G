import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, functions as existingFunctions } from "../config/firebase.js";
import { signInAnonymously } from "firebase/auth";
import { speakCompanion } from "./voiceService.js";
import { store } from "../state/store.js";

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
 * Sends a message to the AI pet companion (Rex or active pet) and returns reaction.
 * Includes detailed error logging for CORS, unauthenticated requests, and Cloud Function diagnostics.
 */
export async function talkToRex(message, heroId = "hero_demo_1", currentHabit = null, petId = null) {
  try {
    // Automatically ensure active Firebase Auth session so request.auth is populated
    if (auth && !auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        console.warn("Anonymous auth notice (proceeding as guest):", authErr.message);
      }
    }

    const activePet = store.getActivePet?.();
    const effectivePetId = petId || activePet?.id || "rex";
    const isToddler = store.isEasyMode?.() ?? true;

    const chatWithPetFn = httpsCallable(functions, "chatWithPet");
    const result = await chatWithPetFn({
      heroId,
      message,
      currentHabit,
      petId: effectivePetId,
      ageTier: isToddler ? "toddler" : "kid"
    });
    return result.data.reply;
  } catch (error) {
    // Surface full diagnostic error details
    console.error("Pet Companion Cloud Function call failed [chatWithPet]:", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      customData: error?.customData,
      region: "us-central1",
      endpoint: "chatWithPet"
    });

    let detailMsg = "";
    if (error?.code === "functions/unauthenticated") {
      detailMsg = " (Session unauthenticated)";
    } else if (error?.code === "functions/unavailable" || error?.message?.includes("CORS")) {
      detailMsg = " (Network/CORS blocked)";
    }

    return `*ROAR!* I had a little trouble hearing you${detailMsg}, but I'm ready for adventure, Little Hero!`;
  }
}

/**
 * Speaks pet companion's dialogue aloud using the unified Spoken Voice Service
 */
export function playRexVoice(text, petId = null) {
  const activePetId = petId || store.getActivePet?.()?.id || "rex";
  speakCompanion(text, activePetId);
}
