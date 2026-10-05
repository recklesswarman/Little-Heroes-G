import './setup_mock_env.js';
import assert from 'assert';
import { store } from '../src/state/store.js';
import { talkToRexAGY, getBattleCoachAdvice, getQuestGuideDirections } from '../src/services/heroAgentService.js';

console.log('🦖 --- Testing Child Profile Name & Memory Retention Across Agents --- 🦖\n');

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
  tommyResult.reply.includes('Tommy'),
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
  defaultResult.reply.includes('Little Hero'),
  `Rex reply must address "Little Hero": got "${defaultResult.reply}"`
);
console.log('  ✅ PASS: Rex dynamically reads child profile name ("Tommy") and defaults to "Little Hero"\n');

console.log('=============================================================');
console.log('ALL NAME & MEMORY RETENTION TESTS PASSED SUCCESSFULLY! 🎉');
console.log('=============================================================');
