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
  const currentHero = store.getSelectedHero?.() || state.selectedHero || {};
  const heroes = state.heroes || [];
  let hero = currentHero;
  if (heroId && heroId !== 'hero_demo_1' && currentHero.id !== heroId) {
    hero = heroes.find(h => h.id === heroId) || currentHero;
  }
  const rawName = hero.name || currentHero.name || (heroes[0] && heroes[0].name) || '';
  const heroName = (rawName && rawName.trim()) ? rawName.trim() : 'Little Hero';
  const effectiveHeroId = hero.id || heroId || 'hero_1';
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
    lastFlossDate: (state.hygieneReminders?.[effectiveHeroId]?.flossDate) || null,
    lastMouthwashDate: (state.hygieneReminders?.[effectiveHeroId]?.mouthwashDate) || null,
  };

  return {
    hero: {
      id: effectiveHeroId,
      name: heroName,
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
 * Falls back directly to the chatWithPet Cloud Function if the AGY service is unavailable.
 */
export async function talkToRexAGY(message, heroId = null, petId = null) {
  const state = store.getState?.() || {};
  const currentHero = store.getSelectedHero?.() || state.selectedHero || {};
  const effectiveHeroId = heroId || currentHero.id || store.getSelectedKidId?.() || "hero_1";
  const activePet = store.getActivePet?.();
  const effectivePetId = petId || activePet?.id || "rex";
  const householdId = state.household?.id || null;
  const appState = buildAppState(effectiveHeroId);
  const heroName = appState.hero.name || "Little Hero";

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
        heroId: effectiveHeroId,
        childId: effectiveHeroId,
        heroName,
        childName: heroName,
        householdId,
        petId: effectivePetId,
        appState,
      }),
      signal: AbortSignal.timeout(12000), // 12s timeout
    });

    if (res.ok) {
      const data = await res.json();
      const hasErrorNote = typeof data?.parentNote === 'string' && data.parentNote.toLowerCase().includes('error');
      if (data?.reply && !hasErrorNote) {
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

  // ── 2. Cloud Function fallback (chatWithPet directly) ──────────────────────
  try {
    if (auth && !auth.currentUser) {
      try { await signInAnonymously(auth); } catch {}
    }
    const isToddler = store.isEasyMode?.() ?? true;
    const chatWithPetFn = httpsCallable(functions, "chatWithPet");
    const now = new Date();
    const result = await chatWithPetFn({
      heroId: effectiveHeroId,
      message,
      petId: effectivePetId,
      childName: heroName,
      heroName,
      ageTier: isToddler ? "toddler" : "kid",
      clientHour: now.getHours(),
      timezoneOffsetMinutes: now.getTimezoneOffset(),
    });
    return { reply: result.data.reply, emotion: 'excited', voiceTone: 'energetic' };
  } catch {
    return {
      reply: `*Happy cheer!* Rawr! Great job, ${heroName}! Let's explore and have fun together! 🦖✨`,
      emotion: 'excited',
      voiceTone: 'energetic',
    };
  }
}

/**
 * Sends a recorded audio blob directly to the Cloud Run AGY Rex service (/api/rex/audio)
 * for multimodal audio comprehension and returns structured Rex response.
 */
export async function sendRexAudioAGY(audioBlob, heroId = null, petId = null) {
  const state = store.getState?.() || {};
  const currentHero = store.getSelectedHero?.() || state.selectedHero || {};
  const effectiveHeroId = heroId || currentHero.id || store.getSelectedKidId?.() || "hero_1";
  const activePet = store.getActivePet?.();
  const effectivePetId = petId || activePet?.id || "rex";
  const householdId = state.household?.id || null;
  const appState = buildAppState(effectiveHeroId);
  const heroName = appState.hero.name || "Little Hero";

  const agyAudioEndpoint = AGY_REX_URL
    ? `${AGY_REX_URL}/api/rex/audio`
    : '/api/rex/audio';

  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'toddler_voice.webm');
    formData.append('heroId', effectiveHeroId);
    formData.append('childId', effectiveHeroId);
    formData.append('heroName', heroName);
    formData.append('childName', heroName);
    if (householdId) formData.append('householdId', householdId);
    formData.append('petId', effectivePetId);
    formData.append('appState', JSON.stringify(appState));

    const res = await fetch(agyAudioEndpoint, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.reply) {
        if (data.habitAwarded) {
          store.toggleHabitIsland?.(data.habitAwarded);
        }
        if (data.suggestedAction) {
          const [action, target] = data.suggestedAction.split(':');
          if (action === 'navigate' && target) {
            store.dispatchCustomEvent?.('rex-navigate', { view: target });
          }
        }
        return data;
      }
    }
  } catch (err) {
    console.warn("[heroAgentService] AGY audio endpoint notice, falling back:", err?.message || err);
  }

  // Graceful fallback if audio processing had a network hiccup
  return {
    userTranscript: "I want to explore with Rex!",
    reply: `Rawr! Rex heard your super voice, ${heroName}! Let's have fun adventures together! 🦖✨`,
    emotion: 'excited',
    voiceTone: 'energetic',
  };
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
export async function getBattleCoachAdvice(bossId, bossHpPercent, currentQuadrant, cadenceScore, equippedWeapon = "laser_toothbrush", heroName = null) {
  const state = store.getState?.() || {};
  const currentHero = store.getSelectedHero?.() || state.selectedHero || {};
  const effectiveHeroName = heroName || currentHero.name || "Little Hero";
  const endpoint = AGY_REX_URL ? `${AGY_REX_URL}/api/rex/battle-coach` : '/api/rex/battle-coach';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bossId,
        bossHpPercent,
        currentQuadrant,
        cadenceScore,
        equippedWeapon,
        heroName: effectiveHeroName,
        childName: effectiveHeroName,
      }),
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("[heroAgentService] Battle coach unavailable:", err?.message || err);
  }
  return {
    coach_text: `ENAMEL POWER SURGE! Keep scrubbing those sweet treats away, ${effectiveHeroName}!`,
    suggested_move: "scrub",
    target_quadrant: currentQuadrant,
    urgency: "normal"
  };
}

/**
 * Invokes the Quest Guide AGY agent for Path of Valor directions
 */
export async function getQuestGuideDirections(heroName = null, level = 1, completedWaypoints = [], currentWaypointId = null) {
  const state = store.getState?.() || {};
  const currentHero = store.getSelectedHero?.() || state.selectedHero || {};
  const effectiveHeroName = heroName || currentHero.name || "Little Hero";
  const endpoint = AGY_REX_URL ? `${AGY_REX_URL}/api/rex/quest-guide` : '/api/rex/quest-guide';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        heroName: effectiveHeroName,
        childName: effectiveHeroName,
        level,
        completedWaypoints,
        currentWaypointId
      }),
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("[heroAgentService] Quest guide unavailable:", err?.message || err);
  }
  return {
    guidance_text: `Onward ${effectiveHeroName}! Check your map for the next glowing waypoint!`,
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
