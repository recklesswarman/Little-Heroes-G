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

// ── AGY Rex microservice URL ──────────────────────────────────────────────────
// In development, point to local uvicorn server (python main.py).
// In production (Cloud Run), the /api/rex/* path is proxied via firebase.json rewrites.
const AGY_REX_URL = import.meta.env?.VITE_AGY_REX_URL || '';

/**
 * Builds the app-state snapshot the AGY Rex service needs to be app-aware.
 * Reads live state from the store so Rex knows exactly what the child has done.
 */
function buildAppState(heroId) {
  const state = store.getState?.() || {};
  const selectedHero = state.selectedHero || {};
  const heroes = state.heroes || [];
  const hero = heroes.find(h => h.id === heroId) || selectedHero;
  const activePet = store.getActivePet?.() || {};
  const petStats = (state.petStatsMap || {})[activePet.id] || {};

  // Quest progress snapshot
  const questProgress = {
    currentWaypointId: state.currentWaypointId || null,
    currentWaypointTitle: state.currentWaypointTitle || null,
    completedWaypointCount: (state.completedWaypointIds || []).length,
    totalWaypoints: 10,
    completedQuestIds: state.completedWaypointIds || [],
    nextQuestTitle: state.nextQuestTitle || null,
    nextQuestDescription: state.nextQuestDescription || null,
  };

  // Dental habits snapshot
  const dentalHabits = {
    lastBrushedMorning: state.lastBrushedMorning || null,
    lastBrushedEvening: state.lastBrushedEvening || null,
    consecutiveStreak: hero.streak || 0,
    dentalBadges: state.dentalBadges || [],
    lastFlossDate: (state.hygieneReminders?.[heroId]?.flossDate) || null,
    lastMouthwashDate: (state.hygieneReminders?.[heroId]?.mouthwashDate) || null,
  };

  return {
    hero: {
      id: hero.id,
      name: hero.name,
      level: hero.level || 1,
      xp: hero.xp || 0,
      xpNext: hero.xpNext || 100,
      points: hero.points || 0,
      coins: hero.coins || 0,
      streak: hero.streak || 0,
      gameDifficulty: hero.gameDifficulty || 'medium',
    },
    activePet: {
      id: activePet.id || 'rex',
      name: activePet.name || 'Rex',
      species: activePet.species || 'Dino',
      level: (state.petLevelMap || {})[activePet.id] || 1,
      evolutionStage: activePet.evolutionStage || 1,
    },
    petVitals: {
      hunger: petStats.hunger ?? 75,
      hygiene: petStats.hygiene ?? 90,
      energy: petStats.energy ?? 65,
      joy: petStats.joy ?? 85,
      lastBathDate: null,
      onExpedition: (state.activeExpeditions || []).some(e => e.petId === activePet.id),
    },
    questProgress,
    dentalHabits,
    dentalBattleHistory: state.dentalBattleHistory || [],
    movementHistory: state.movementSessionHistory || [],
  };
}

/**
 * Sends a message to the AGY persistent Rex companion and returns a full
 * structured response ({ reply, emotion, voiceTone, suggestedAction, ... }).
 *
 * Falls back to the legacy /api/gemini/chat endpoint and then the Cloud
 * Function if the AGY service is unavailable.
 */
export async function talkToRexAGY(message, heroId = "hero_demo_1", petId = null) {
  const activePet = store.getActivePet?.();
  const effectivePetId = petId || activePet?.id || "rex";
  const householdId = store.getState?.()?.household?.id || null;
  const appState = buildAppState(heroId);

  // ── 1. AGY Rex microservice (primary) ──────────────────────────────────────
  const agyEndpoint = AGY_REX_URL
    ? `${AGY_REX_URL}/api/rex/chat`
    : '/api/rex/chat';

  try {
    const res = await fetch(agyEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        heroId,
        householdId,
        petId: effectivePetId,
        appState,
      }),
      signal: AbortSignal.timeout(12000), // 12s timeout
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.reply) {
        // Handle optional habit award
        if (data.habitAwarded) {
          store.toggleHabitIsland?.(data.habitAwarded);
        }
        // Handle suggested navigation action
        if (data.suggestedAction) {
          const [action, target] = data.suggestedAction.split(':');
          if (action === 'navigate' && target) {
            store.dispatchCustomEvent?.('rex-navigate', { view: target });
          }
        }
        return data; // Full structured response
      }
    }
  } catch (err) {
    console.warn("[heroAgentService] AGY Rex service unavailable, falling back:", err?.message || err);
  }

  // ── 2. Legacy /api/gemini/chat fallback ────────────────────────────────────
  try {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        petId: effectivePetId,
        speedMode: 'smart',
        childName: heroId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.reply) {
        if (data.awardedHabit) {
          store.toggleHabitIsland?.(data.awardedHabit);
        }
        return { reply: data.reply, emotion: 'excited', voiceTone: 'energetic' };
      }
    }
  } catch (err) {
    console.warn("[heroAgentService] Legacy chat fallback notice:", err?.message || err);
  }

  // ── 3. Cloud Function fallback ─────────────────────────────────────────────
  try {
    if (auth && !auth.currentUser) {
      try { await signInAnonymously(auth); } catch {}
    }
    const isToddler = store.isEasyMode?.() ?? true;
    const chatWithPetFn = httpsCallable(functions, "chatWithPet");
    const result = await chatWithPetFn({
      heroId,
      message,
      petId: effectivePetId,
      ageTier: isToddler ? "toddler" : "kid",
    });
    return { reply: result.data.reply, emotion: 'excited', voiceTone: 'energetic' };
  } catch {
    return {
      reply: `*Happy cheer!* Great job, Little Hero! Let's explore and have fun together!`,
      emotion: 'excited',
      voiceTone: 'energetic',
    };
  }
}

/**
 * Convenience wrapper — sends a message to Rex and returns just the reply text.
 * Backwards-compatible with all existing callers of talkToRex().
 */
export async function talkToRex(message, heroId = "hero_demo_1", currentHabit = null, petId = null) {
  const result = await talkToRexAGY(message, heroId, petId);
  return result?.reply || `*Happy cheer!* Great job, Little Hero!`;
}

/**
 * Speaks pet companion's dialogue aloud using the unified Spoken Voice Service
 */
export function playRexVoice(text, petId = null) {
  const activePetId = petId || store.getActivePet?.()?.id || "rex";
  speakCompanion(text, activePetId);
}

/**
 * Invokes the Battle Coach AGY agent for tactical brushing guidance
 */
export async function getBattleCoachAdvice(bossId, bossHpPercent, currentQuadrant, cadenceScore, equippedWeapon = "laser_toothbrush") {
  const endpoint = AGY_REX_URL ? `${AGY_REX_URL}/api/rex/battle-coach` : '/api/rex/battle-coach';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bossId, bossHpPercent, currentQuadrant, cadenceScore, equippedWeapon }),
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("[heroAgentService] Battle coach unavailable:", err?.message || err);
  }
  return {
    coach_text: "ENAMEL POWER SURGE! Keep scrubbing those sweet treats away!",
    suggested_move: "scrub",
    target_quadrant: currentQuadrant,
    urgency: "normal"
  };
}

/**
 * Invokes the Quest Guide AGY agent for Path of Valor directions
 */
export async function getQuestGuideDirections(heroName, level, completedWaypoints, currentWaypointId = null) {
  const endpoint = AGY_REX_URL ? `${AGY_REX_URL}/api/rex/quest-guide` : '/api/rex/quest-guide';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroName, level, completedWaypoints, currentWaypointId }),
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("[heroAgentService] Quest guide unavailable:", err?.message || err);
  }
  return {
    guidance_text: `Onward ${heroName}! Check your map for the next glowing waypoint!`,
    recommended_waypoint_id: currentWaypointId || "wp_night_teeth",
    unlocked_biome: "Dino Meadow",
    required_habit_or_chore: "Daily Quest"
  };
}

/**
 * Invokes the Bedtime Story Narrator AGY agent
 */
export async function generateBedtimeChapterAGY(params) {
  const endpoint = AGY_REX_URL ? `${AGY_REX_URL}/api/rex/bedtime-story` : '/api/rex/bedtime-story';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("[heroAgentService] AGY Bedtime story unavailable:", err?.message || err);
  }
  return null;
}

/**
 * Invokes the Proactive Trigger AGY agent
 */
export async function checkProactiveTriggerAGY(params) {
  const endpoint = AGY_REX_URL ? `${AGY_REX_URL}/api/rex/proactive` : '/api/rex/proactive';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("[heroAgentService] AGY Proactive check unavailable:", err?.message || err);
  }
  return null;
}
