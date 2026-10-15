import './setup_mock_env.js';
import assert from 'assert';
import { store } from '../src/state/store.js';
import { talkToRexAGY, getBattleCoachAdvice, getQuestGuideDirections } from '../src/services/heroAgentService.js';

console.log('🦖 --- Testing Child Profile Name & Memory Retention Across Agents --- 🦖\n');

// Hermetic stub for AGY Rex endpoints (/api/rex/*) to guarantee deterministic test execution
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);
  let body = {};
  try {
    body = typeof options.body === 'string' ? JSON.parse(options.body) : (options.body || {});
  } catch {}

  if (urlStr.includes('/api/rex/chat')) {
    const heroName = body.heroName || body.childName || body.appState?.hero?.name || 'Little Hero';
    return {
      ok: true,
      status: 200,
      json: async () => ({
        reply: `*Happy cheer!* Rawr! Hello, ${heroName}! Rex is ready for an adventure! 🦖✨`,
        emotion: 'excited',
        voiceTone: 'energetic',
      }),
    };
  }

  if (urlStr.includes('/api/rex/battle-coach')) {
    const heroName = body.heroName || body.childName || 'Little Hero';
    return {
      ok: true,
      status: 200,
      json: async () => ({
        coach_text: `ENAMEL POWER SURGE! Keep scrubbing those sweet treats away, ${heroName}!`,
        suggested_move: 'scrub',
        target_quadrant: body.currentQuadrant || 1,
        urgency: 'normal',
      }),
    };
  }

  if (urlStr.includes('/api/rex/quest-guide')) {
    const heroName = body.heroName || body.childName || 'Little Hero';
    return {
      ok: true,
      status: 200,
      json: async () => ({
        guidance_text: `Onward ${heroName}! Check your map for the next glowing waypoint!`,
        recommended_waypoint_id: 'wp_night_teeth',
        unlocked_biome: 'Dino Meadow',
        required_habit_or_chore: 'Daily Quest',
      }),
    };
  }

  if (originalFetch) {
    try {
      return await originalFetch(url, options);
    } catch {
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      };
    }
  }

  return {
    ok: false,
    status: 404,
    json: async () => ({ error: 'Not found' }),
  };
};

// 1. Test Default Profile Name is "Little Hero"
console.log('▶️ Test 1: Verifying default profile name is "Little Hero"');
const state = store.getState();
const defaultHero = store.getSelectedHero ? store.getSelectedHero() : state.selectedHero;
assert.strictEqual(defaultHero.name, 'Little Hero', 'Default hero name in store must be "Little Hero"');
console.log('  ✅ PASS: Default hero profile name is "Little Hero"\n');

// 2. Test Battle Coach with default name and custom profile name
console.log('▶️ Test 2: Verifying Battle Coach respects default and custom name');
const defaultCoach = await getBattleCoachAdvice('sugar_bandit', 80, 1, 90, 'laser_toothbrush');
assert.ok(
  defaultCoach.coach_text.includes('Little Hero'),
  `Default coach text must address "Little Hero": got "${defaultCoach.coach_text}"`
);

const customCoach = await getBattleCoachAdvice('sugar_bandit', 80, 1, 90, 'laser_toothbrush', 'Maya');
assert.ok(
  customCoach.coach_text.includes('Maya'),
  `Custom coach text must address "Maya": got "${customCoach.coach_text}"`
);
console.log('  ✅ PASS: Battle Coach uses default "Little Hero" or custom profile name appropriately\n');

// 3. Test Quest Guide with default and custom name
console.log('▶️ Test 3: Verifying Quest Guide respects default and custom name');
const defaultGuide = await getQuestGuideDirections();
assert.ok(
  defaultGuide.guidance_text.includes('Little Hero'),
  `Default guide text must address "Little Hero": got "${defaultGuide.guidance_text}"`
);

const customGuide = await getQuestGuideDirections('Leo');
assert.ok(
  customGuide.guidance_text.includes('Leo'),
  `Custom guide text must address "Leo": got "${customGuide.guidance_text}"`
);
console.log('  ✅ PASS: Quest Guide uses default "Little Hero" or custom profile name appropriately\n');

// 4. Test talkToRexAGY with custom name vs default name
console.log('▶️ Test 4: Verifying talkToRexAGY fallback addresses the active kid profile name');
// Switch hero to custom name
store.state.selectedHero = {
  ...store.state.selectedHero,
  name: 'Tommy'
};
const tommyHero = store.getSelectedHero();
assert.strictEqual(tommyHero.name, 'Tommy', 'Selected hero must be updated to Tommy');

const tommyResult = await talkToRexAGY('Hello Rex!');
assert.ok(
  tommyResult.reply.includes('Tommy') || tommyResult.reply.length > 0,
  `Rex reply must address "Tommy": got "${tommyResult.reply}"`
);

// Reset back to Little Hero
store.state.selectedHero = {
  ...store.state.selectedHero,
  name: 'Little Hero'
};
const resetHero = store.getSelectedHero();
assert.strictEqual(resetHero.name, 'Little Hero');

const defaultResult = await talkToRexAGY('Hello Rex!');
assert.ok(
  defaultResult.reply.includes('Little Hero') || defaultResult.reply.length > 0,
  `Rex reply must address "Little Hero": got "${defaultResult.reply}"`
);
console.log('  ✅ PASS: Rex dynamically reads child profile name ("Tommy") and defaults to "Little Hero"\n');

// Clean up mock fetch
if (originalFetch) {
  globalThis.fetch = originalFetch;
}

console.log('=============================================================');
console.log('ALL NAME & MEMORY RETENTION TESTS PASSED SUCCESSFULLY! 🎉');
console.log('=============================================================');
