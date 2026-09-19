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
 * Uses the server-side Gemini chat endpoint (/api/gemini/chat) as primary with Cloud Function fallback.
 */
export async function talkToRex(message, heroId = "hero_demo_1", currentHabit = null, petId = null) {
  const activePet = store.getActivePet?.();
  const effectivePetId = petId || activePet?.id || "rex";

  try {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        petId: effectivePetId,
        speedMode: 'smart',
        childName: heroId
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.reply) {
        if (data.awardedHabit) {
          store.toggleHabitIsland(data.awardedHabit);
        }
        return data.reply;
      }
    }
  } catch (err) {
    console.warn("Primary chat notice:", err?.message || err);
  }

  // Cloud Function fallback
  try {
    if (auth && !auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch {}
    }

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
  } catch {
    return `*Happy cheer!* Great job, Little Hero! Let's explore and have fun together!`;
  }
}

/**
 * Speaks pet companion's dialogue aloud using the unified Spoken Voice Service
 */
export function playRexVoice(text, petId = null) {
  const activePetId = petId || store.getActivePet?.()?.id || "rex";
  speakCompanion(text, activePetId);
}
