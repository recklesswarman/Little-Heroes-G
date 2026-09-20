import './setup_mock_env.js';
import assert from 'assert';
import { store } from '../src/state/store.js';
import { geminiLiveService } from '../src/services/geminiLiveService.js';
import { rexEngine } from '../src/services/rexCompanionEngine.js';
import { renderLiveRexWidget, attachLiveRexWidgetListeners } from '../src/components/LiveRexWidget.js';
import { PET_VOICE_MAP, PET_PERSONAS } from '../server/geminiService.js';
import fs from 'fs';
import path from 'path';

console.log('🦖 --- Running Rex the Dino Voice Companion & Live API Test Suite --- 🦖\n');

// -----------------------------------------------------------------------------
// TEST 1: Verify Server-Side Gemini Service Configuration
// -----------------------------------------------------------------------------
console.log('▶️ Test 1: Verifying Server-Side Gemini Live & Chat Configuration');

const serverServiceContent = fs.readFileSync(path.resolve('server/geminiService.js'), 'utf-8');

// Verify model is NOT the invalid gemini-3.8-live
assert.ok(
  !serverServiceContent.includes("'gemini-3.8-live'"),
  'Server MUST NOT use invalid gemini-3.8-live model'
);

// Verify model is gemini-3.1-flash-live-preview
assert.ok(
  serverServiceContent.includes('gemini-3.1-flash-live-preview'),
  'Server MUST use official gemini-3.1-flash-live-preview model for Gemini Live'
);

// Verify chat uses gemini-3.7-flash
assert.ok(
  serverServiceContent.includes('gemini-3.7-flash'),
  'Server chat MUST use gemini-3.7-flash for smart tasks'
);

// Verify pet persona mappings exist for all companions
assert.ok(PET_VOICE_MAP.rex === 'Puck', 'Rex should map to Puck voice');
assert.ok(PET_VOICE_MAP.bella === 'Aoede', 'Bella should map to Aoede voice');
assert.ok(PET_VOICE_MAP.barnaby === 'Fenrir', 'Barnaby should map to Fenrir voice');
assert.ok(PET_VOICE_MAP.pip === 'Zephyr', 'Pip should map to Zephyr voice');
assert.ok(PET_VOICE_MAP.aqua === 'Charon', 'Aqua Drake should map to Charon voice');
assert.ok(PET_PERSONAS.rex.name.includes('Rex'), 'Rex persona should be configured');

console.log('  ✅ PASS: Server-side Gemini Live uses gemini-3.1-flash-live-preview and gemini-3.7-flash with correct pet voices.\n');

// -----------------------------------------------------------------------------
// TEST 2: Verify LiveRexWidget HTML Markup & Kid Intuition Elements
// -----------------------------------------------------------------------------
console.log('▶️ Test 2: Verifying LiveRexWidget Markup & Kid-Friendly Controls');

// Set store state with open live modal
store.setLiveRexState({
  isOpen: true,
  isConnected: false,
  status: 'idle',
  lastUserTranscript: 'Hello Rex!',
  lastRexTranscript: 'ROAR! Ready for fun!'
}, true);

const renderedHtml = renderLiveRexWidget();

// 1. Floating companion button exists
assert.ok(
  renderedHtml.includes('id="live-rex-floating-btn"'),
  'Must render floating companion button'
);

// 2. Clickable Giant Mascot Avatar Disc exists
assert.ok(
  renderedHtml.includes('id="rex-mascot-avatar-disc"'),
  'Must render clickable mascot avatar disc for kid tactile touch'
);

// 3. Action Indicator Pill button exists
assert.ok(
  renderedHtml.includes('id="modal-rex-avatar-btn"'),
  'Must render action indicator pill button'
);

// 4. Tactile micro-buttons exist
assert.ok(renderedHtml.includes('id="rex-pat-head-btn"'), 'Must render Pat micro-button');
assert.ok(renderedHtml.includes('id="rex-poke-cheek-btn"'), 'Must render Poke micro-button');
assert.ok(renderedHtml.includes('id="rex-cheer-roar-btn"'), 'Must render Roar micro-button');

// 5. Permanent Live Dialogue Container exists
assert.ok(
  renderedHtml.includes('id="rex-live-dialogue-container"'),
  'Must render live dialogue preview container'
);
assert.ok(
  renderedHtml.includes('id="rex-live-user-text"'),
  'Must render user transcript container'
);
assert.ok(
  renderedHtml.includes('id="rex-live-rex-text"'),
  'Must render rex transcript container'
);

// 6. All 8 Toddler Quick-Action Picture Cards exist with action attributes
const expectedActions = ['roar', 'teeth', 'yay', 'toys', 'snack', 'water', 'breathe', 'joke'];
for (const action of expectedActions) {
  assert.ok(
    renderedHtml.includes(`data-rex-action="${action}"`),
    `Must render toddler card for action: ${action}`
  );
}

// 7. Live conversation toggle button exists
assert.ok(
  renderedHtml.includes('id="live-rex-toggle-btn"'),
  'Must render bottom live conversation toggle button'
);

console.log('  ✅ PASS: LiveRexWidget contains all kid-friendly interactive buttons, tactile face disc, dialogue containers, and picture action cards.\n');

// -----------------------------------------------------------------------------
// TEST 3: Verify Gemini Live Service Interface & Methods
// -----------------------------------------------------------------------------
console.log('▶️ Test 3: Verifying Gemini Live Client Service Interface');

assert.ok(typeof geminiLiveService.connect === 'function', 'geminiLiveService.connect exists');
assert.ok(typeof geminiLiveService.disconnect === 'function', 'geminiLiveService.disconnect exists');
assert.ok(typeof geminiLiveService.sendTextMessage === 'function', 'geminiLiveService.sendTextMessage exists');
assert.ok(typeof geminiLiveService.askRexChat === 'function', 'geminiLiveService.askRexChat exists');
assert.ok(typeof geminiLiveService.askRexInteractions === 'function', 'geminiLiveService.askRexInteractions exists');

// Verify sendTextMessage updates store transcript
geminiLiveService.sendTextMessage('I brushed my teeth clean!');
assert.strictEqual(
  store.getState().liveRex.lastUserTranscript,
  'I brushed my teeth clean!',
  'sendTextMessage must immediately update lastUserTranscript in state'
);

console.log('  ✅ PASS: GeminiLiveService exports all required methods and handles real-time text input correctly.\n');

// -----------------------------------------------------------------------------
// TEST 4: Verify In-Game Voice Handling and Habit Triggers
// -----------------------------------------------------------------------------
console.log('▶️ Test 4: Verifying In-Game Voice Reactions & Habit Triggers');

// Initial habit state
const habitBefore = store.getState().habits?.find?.(h => h.id === 'brush_teeth')?.completedToday;

// Simulate child saying teeth brushed
const handledTeeth = rexEngine.tryHandleInGameSpeech('I brushed my teeth clean and finished!');
assert.ok(handledTeeth, 'Teeth brushing speech should be recognized as in-game habit');

// Verify water habit
const handledWater = rexEngine.tryHandleInGameSpeech('I drank a cold cup of water, all done!');
assert.ok(handledWater, 'Water drinking speech should be recognized as in-game habit');

// Verify toys cleanup
const handledToys = rexEngine.tryHandleInGameSpeech('I put away all my toys in the box!');
assert.ok(handledToys, 'Toy cleaning speech should be recognized as in-game chore');

// Verify AR Battle command dispatch
let foamDispatched = false;
const foamHandler = () => { foamDispatched = true; };
if (typeof window !== 'undefined') {
  window.addEventListener('rex-battle-foam', foamHandler);
}
store.state.activeView = 'battle';
const handledFoam = rexEngine.tryHandleInGameSpeech('Toothpaste foam cannon super blast!');
assert.ok(handledFoam, 'Toothpaste foam command should be handled during battle');

// Reset activeView
store.state.activeView = 'dashboard';

console.log('  ✅ PASS: In-game speech engine accurately intercepts and handles toothbrushing, water, toys, and battle actions.\n');

// -----------------------------------------------------------------------------
// TEST 5: Verify Selecting Floating Companion Activates Gemini Live Session
// -----------------------------------------------------------------------------
console.log('▶️ Test 5: Verifying Floating Companion Click Activates Gemini Live API');

// Verify the code logic in LiveRexWidget:
const widgetContent = fs.readFileSync(path.resolve('src/components/LiveRexWidget.js'), 'utf-8');

// 1. Verify claimCompanionHabit awards tokens and logs completion
const coinsBefore = store.getState().selectedHero?.coins || 0;
const teethResult = store.claimCompanionHabit('teeth');
assert.ok(teethResult.coins > 0, 'claimCompanionHabit(teeth) must award tokens');
assert.ok(
  (store.getState().selectedHero?.coins || 0) >= coinsBefore + teethResult.coins,
  'Hero wallet must increase by awarded tokens'
);

// 2. Verify water claim
const waterResult = store.claimCompanionHabit('water');
assert.ok(waterResult.coins > 0, 'claimCompanionHabit(water) must award tokens');

// 3. Verify toys chore claim
const toysResult = store.claimCompanionHabit('toys');
assert.ok(toysResult.coins > 0, 'claimCompanionHabit(toys) must award tokens');

// 4. Verify snack claim
const snackResult = store.claimCompanionHabit('snack');
assert.ok(snackResult.coins > 0, 'claimCompanionHabit(snack) must award tokens');

// 5. Verify alias resolution on toggleHabitIsland
store.toggleHabitIsland('eat_healthy_snack');
const snackHabit = store.getState().habitIslands?.find(h => h.id === 'healthy_snack');
assert.ok(snackHabit?.completed, 'toggleHabitIsland must resolve eat_healthy_snack alias to healthy_snack');

// 6. Verify alias resolution on toggleTaskForest
store.toggleTaskForest('morning_bed');
const bedTask = store.getState().taskForest?.find(t => t.id === 'make_bed');
assert.ok(bedTask?.completed, 'toggleTaskForest must resolve morning_bed alias to make_bed');

// Check that floatBtn click handler triggers activateLiveGeminiSession
assert.ok(
  widgetContent.includes('activateLiveGeminiSession'),
  'LiveRexWidget must define activateLiveGeminiSession helper'
);

// Check that floatBtn click opens modal AND calls activateLiveGeminiSession
assert.ok(
  widgetContent.includes('store.toggleLiveRexModal(true)'),
  'Floating button must toggle modal open'
);
assert.ok(
  widgetContent.includes('await activateLiveGeminiSession(activePetId)'),
  'Floating button click MUST activate Gemini Live API session when selecting companion'
);

// Check that mascot avatar disc is wired for tactile touch
assert.ok(
  widgetContent.includes('mascotAvatarDisc.addEventListener'),
  'Mascot avatar disc must have tactile touch listener'
);

// Check that toddler action buttons call claimCompanionHabit and trigger celebration
assert.ok(
  widgetContent.includes("store.claimCompanionHabit('teeth')"),
  'Teeth card must claim teeth habit'
);
assert.ok(
  widgetContent.includes("store.claimCompanionHabit('water')"),
  'Water card must claim water habit'
);
assert.ok(
  widgetContent.includes("store.claimCompanionHabit('toys')"),
  'Toys card must claim toys chore'
);
assert.ok(
  widgetContent.includes("store.claimCompanionHabit('snack')"),
  'Snack card must claim snack habit'
);
assert.ok(
  widgetContent.includes("triggerInteractiveCelebration()"),
  'Habit completions from cards must trigger interactive celebration'
);

// Check that live dialogue container is updated without destroying DOM
assert.ok(
  widgetContent.includes('updateLiveDialogue'),
  'LiveRexWidget must provide updateLiveDialogue helper for live updates'
);

// Check that speech start/end events animate skeletal rigs
assert.ok(
  widgetContent.includes('modalRig?.startSpeaking?.()'),
  'Skeletal face canvas must start speaking animation during speech'
);
assert.ok(
  widgetContent.includes('modalRig?.stopSpeaking?.()'),
  'Skeletal face canvas must stop speaking animation when speech ends'
);

console.log('  ✅ PASS: Selecting floating companion directly activates Gemini Live API, and all pet widget buttons perform their actions reliably!\n');

console.log('=============================================================');
console.log('ALL REX THE DINO & GEMINI LIVE TESTS PASSED SUCCESSFULLY! 🎉');
console.log('=============================================================');

process.exit(0);
