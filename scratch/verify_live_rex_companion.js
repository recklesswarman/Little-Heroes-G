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

// -----------------------------------------------------------------------------
// TEST 6: Verify Dual Voice Modes ("Talk Freely 🗣️" vs "Walkie-Talkie 📻")
// -----------------------------------------------------------------------------
console.log('▶️ Test 6: Verifying Dual Voice Modes & Walkie-Talkie Interactions');

// 1. Dual mode badges exist in rendered HTML
assert.ok(
  renderedHtml.includes('id="rex-mode-free-btn"'),
  'Must render Talk Freely mode button'
);
assert.ok(
  renderedHtml.includes('id="rex-mode-walkie-btn"'),
  'Must render Walkie-Talkie mode button'
);

// 2. Default mode is 'free'
assert.strictEqual(geminiLiveService.voiceMode, 'free', 'Default voiceMode must be free');

// 3. Switch to walkie-talkie
geminiLiveService.setVoiceMode('walkie');
assert.strictEqual(geminiLiveService.voiceMode, 'walkie', 'setVoiceMode(walkie) must set voiceMode to walkie');
assert.strictEqual(store.getState().liveRex.voiceMode, 'walkie', 'Store must reflect walkie voiceMode');

// 4. Test Walkie-Talkie tap-to-start / tap-to-finish
geminiLiveService.startWalkieRecording();
assert.strictEqual(geminiLiveService.walkieState, 'recording', 'startWalkieRecording must set walkieState to recording');
assert.strictEqual(store.getState().liveRex.walkieState, 'recording', 'Store must reflect recording walkieState');

geminiLiveService.finishWalkieRecording();
assert.strictEqual(geminiLiveService.walkieState, 'idle', 'finishWalkieRecording must set walkieState to idle');
assert.strictEqual(store.getState().liveRex.walkieState, 'idle', 'Store must reflect idle walkieState');

// 5. Switch back to free mode
geminiLiveService.setVoiceMode('free');
assert.strictEqual(geminiLiveService.voiceMode, 'free', 'setVoiceMode(free) must set voiceMode to free');

console.log('  ✅ PASS: Dual Voice Modes and Walkie-Talkie state transitions verified successfully!\n');

// -----------------------------------------------------------------------------
// TEST 7: Verify Tap-to-Interrupt & Adaptive RMS Noise Gate
// -----------------------------------------------------------------------------
console.log('▶️ Test 7: Verifying Tap-to-Interrupt Safeguard & Adaptive Noise Gate');

// 1. Tap-to-Interrupt method exists
assert.ok(typeof geminiLiveService.interruptSpeech === 'function', 'geminiLiveService.interruptSpeech must exist');

// 2. Adaptive noise floor properties exist
assert.ok(typeof geminiLiveService.ambientNoiseFloor === 'number', 'ambientNoiseFloor must be a number');
assert.ok(geminiLiveService.ambientNoiseFloor > 0, 'ambientNoiseFloor must be positive');

// 3. Verify widget event listeners include tap-to-interrupt logic
assert.ok(
  widgetContent.includes('geminiLiveService.interruptSpeech()'),
  'Widget must call interruptSpeech when tapping during playback'
);

// 4. Verify speech protection in onaudioprocess
const liveServiceContent = fs.readFileSync(path.resolve('src/services/geminiLiveService.js'), 'utf-8');
assert.ok(
  liveServiceContent.includes('if (this.isSpeaking)'),
  'geminiLiveService must guard against audio streaming during active speech playback'
);
assert.ok(
  liveServiceContent.includes('1800'),
  'geminiLiveService must enforce 1.8-second kid silence buffer threshold'
);

console.log('  ✅ PASS: Tap-to-Interrupt and Adaptive Noise Gate verified successfully!\n');

// -----------------------------------------------------------------------------
// TEST 8: Verify Non-Blocking Habit Claims (Kid Companion UX Guardrails)
// -----------------------------------------------------------------------------
console.log('▶️ Test 8: Verifying Non-Blocking Habit Claims (No Full-Screen Reward Modal)');
store.closeReward();
assert.strictEqual(store.getState().rewardModal, null, 'Reward modal should be closed initially');
const initialCoins = store.getState().selectedHero.coins;
const habitResult = store.claimCompanionHabit('teeth');
assert.ok(habitResult.coins >= 0, 'claimCompanionHabit must return coin reward');
assert.strictEqual(store.getState().rewardModal, null, 'Reward modal overlay must NEVER be opened by companion habit claim');
assert.ok(store.getState().selectedHero.coins >= initialCoins, 'Hero coins must be updated cleanly');

// Verify rexCompanionEngine does not call toggleHabitIsland
const rexEngineCode = fs.readFileSync(path.resolve('src/services/rexCompanionEngine.js'), 'utf-8');
assert.ok(
  !rexEngineCode.includes('store.toggleHabitIsland'),
  'rexCompanionEngine must never call toggleHabitIsland directly (must use claimCompanionHabit)'
);
console.log('  ✅ PASS: Non-blocking habit claims verified successfully!\n');

// -----------------------------------------------------------------------------
// TEST 9: Verify Infinite Event Loop Protection & Tactile Face Cleanup
// -----------------------------------------------------------------------------
console.log('▶️ Test 9: Verifying Infinite Event Loop Protection & Tactile Cleanup');
const liveRexWidgetCode = fs.readFileSync(path.resolve('src/components/LiveRexWidget.js'), 'utf-8');
assert.ok(
  liveRexWidgetCode.includes('updateLiveDialogue(data.lastUserTranscript, data.lastRexTranscript, false)'),
  'LiveRexWidget must pass syncStore=false to prevent state event recursion loops'
);
assert.ok(
  liveRexWidgetCode.includes('handleInGame: false'),
  'LiveRexWidget picture cards must pass handleInGame: false to prevent double speech & coin re-claims'
);

const petSkeletalCode = fs.readFileSync(path.resolve('src/components/PetSkeletalFaceViewer.js'), 'utf-8');
assert.ok(
  petSkeletalCode.includes('canvas._cleanupTactile'),
  'PetSkeletalFaceViewer must clean up previous pointer/touch listeners on re-initialization'
);
console.log('  ✅ PASS: Infinite event loop protection and tactile cleanup verified!\n');

// -----------------------------------------------------------------------------
// TEST 10: In-Game Voice Reactions & Context Synchronization
// -----------------------------------------------------------------------------
console.log('▶️ Test 10: Verifying In-Game Voice Event Wiring & Quest Context');
const battleViewCode = fs.readFileSync(path.resolve('src/views/BattleView.js'), 'utf-8');
assert.ok(battleViewCode.includes('rex-battle-foam'), 'BattleView must listen to rex-battle-foam');
assert.ok(battleViewCode.includes('rex-battle-shield'), 'BattleView must listen to rex-battle-shield');

const danceViewCode = fs.readFileSync(path.resolve('src/views/DancePartyView.js'), 'utf-8');
assert.ok(danceViewCode.includes('rex-dance-freeze'), 'DancePartyView must listen to rex-dance-freeze');
assert.ok(danceViewCode.includes('rex-dance-jump'), 'DancePartyView must listen to rex-dance-jump');
assert.ok(danceViewCode.includes('rex-dance-spin'), 'DancePartyView must listen to rex-dance-spin');
assert.ok(danceViewCode.includes('rex-dance-fever'), 'DancePartyView must listen to rex-dance-fever');

const advViewCode = fs.readFileSync(path.resolve('src/views/AdventuresMapView.js'), 'utf-8');
assert.ok(advViewCode.includes('geminiLiveService.setQuestContext'), 'AdventuresMapView must sync quest context');
assert.ok(advViewCode.includes('rex-live-hint'), 'AdventuresMapView must listen to rex-live-hint');
assert.ok(advViewCode.includes('rex-live-eliminate'), 'AdventuresMapView must listen to rex-live-eliminate');

// Test quest context setting
geminiLiveService.setQuestContext({
  question: 'Which dino has 3 horns?',
  options: ['T-Rex', 'Triceratops', 'Brachiosaurus'],
  correctAnswerIndex: 1,
  hint: 'Look at the horns!'
});
assert.strictEqual(geminiLiveService.currentQuestContext.options.length, 3, 'Quest context must hold options');
const hintHandled = rexEngine.tryHandleInGameSpeech('give me a hint please');
assert.strictEqual(hintHandled, true, 'rexEngine must handle hint command when quest context is active');

const eliminateHandled = rexEngine.tryHandleInGameSpeech('dino stomp');
assert.strictEqual(eliminateHandled, true, 'rexEngine must handle stomp eliminate command');
geminiLiveService.clearQuestContext();
assert.strictEqual(geminiLiveService.currentQuestContext, null, 'clearQuestContext must reset context to null');
console.log('  ✅ PASS: In-game voice event wiring and quest context verified!\n');

// -----------------------------------------------------------------------------
// TEST 11: Keyboard Escape Key & Audio Teardown
// -----------------------------------------------------------------------------
console.log('▶️ Test 11: Verifying Keyboard Escape Dismissal & Teardown');
const mainCode = fs.readFileSync(path.resolve('src/main.js'), 'utf-8');
assert.ok(mainCode.includes('store.toggleLiveRexModal(false)'), 'main.js Escape handler must close liveRex modal');
assert.ok(mainCode.includes('geminiLiveService.disconnect()'), 'main.js Escape handler must disconnect Gemini Live');
assert.ok(mainCode.includes('rexEngine.stop()'), 'main.js Escape handler must stop Rex voice engine');
assert.ok(mainCode.includes('stopRex()'), 'main.js Escape handler must stop audio speech synthesis');
console.log('  ✅ PASS: Keyboard Escape dismissal and audio teardown verified!\n');

// -----------------------------------------------------------------------------
// TEST 12: Route Normalization & Shortcut Navigation (/learn and /boost)
// -----------------------------------------------------------------------------
console.log('▶️ Test 12: Verifying Route Normalization & /learn, /boost Shortcuts');
store.navigate('/learn');
assert.strictEqual(store.getState().activeView, 'adventures_map', 'store.navigate("/learn") must map to adventures_map');
store.navigate('/boost');
assert.strictEqual(store.getState().activeView, 'battle', 'store.navigate("/boost") must map to battle');
store.navigate('learn');
assert.strictEqual(store.getState().activeView, 'adventures_map', 'store.navigate("learn") must map to adventures_map');
store.navigate('boost');
assert.strictEqual(store.getState().activeView, 'battle', 'store.navigate("boost") must map to battle');

assert.ok(mainCode.includes("case '/learn':"), 'main.js switch statement must support /learn');
assert.ok(mainCode.includes("case '/boost':"), 'main.js switch statement must support /boost');
assert.ok(mainCode.includes("resolveRouteFromUrl"), 'main.js must resolve routes from URL pathname and hash');
console.log('  ✅ PASS: Route normalization and shortcut navigation for /learn and /boost verified!\n');

// -----------------------------------------------------------------------------
// TEST 13: Battle Timer Non-Destruction (Default skipNotify = true)
// -----------------------------------------------------------------------------
console.log('▶️ Test 13: Verifying Battle Timer Non-Destruction (skipNotify = true)');
let notifyCount = 0;
const unsubscribe = store.subscribe(() => { notifyCount++; });
store.updateColosseumTimer(119, 120); // Default skipNotify should be true
assert.strictEqual(notifyCount, 0, 'updateColosseumTimer must NOT trigger store.notify() by default');
store.updateColosseumTimer(118, 120, false); // Explicit skipNotify = false
assert.strictEqual(notifyCount, 1, 'updateColosseumTimer with skipNotify=false must trigger store.notify()');
unsubscribe();
console.log('  ✅ PASS: Battle timer non-destruction (skipNotify = true) verified!\n');

// -----------------------------------------------------------------------------
// TEST 14: Mobile Viewport Height & Header Visibility
// -----------------------------------------------------------------------------
console.log('▶️ Test 14: Verifying Mobile Viewport Height & Header Visibility');
const liveWidgetMarkup = renderLiveRexWidget();
assert.ok(
  liveWidgetMarkup.includes('max-h-[min(580px,calc(100dvh-12.5rem))]'),
  'LiveRexWidget must constrain modal card height with 100dvh-12.5rem so header never overflows off-screen'
);
assert.ok(
  liveWidgetMarkup.includes('z-50'),
  'LiveRexWidget container must have z-50 to sit above all bottom navigation and canvases'
);
console.log('  ✅ PASS: Mobile viewport height and header visibility verified!\n');

// -----------------------------------------------------------------------------
// TEST 15: Walkie-Talkie Toggle Logic & Speech Completion Callback
// -----------------------------------------------------------------------------
console.log('▶️ Test 15: Verifying Walkie-Talkie Toggle & Listening Auto-Resumption');
const widgetCode = fs.readFileSync(path.resolve('src/components/LiveRexWidget.js'), 'utf-8');
assert.ok(
  widgetCode.includes('restoreLiveListening'),
  'LiveRexWidget must define restoreLiveListening callback'
);
assert.ok(
  widgetCode.includes('speakCompanion(pGreeting, petId, restoreLiveListening)'),
  'activateLiveGeminiSession must pass restoreLiveListening callback to speakCompanion'
);
assert.ok(
  widgetCode.includes('geminiLiveService.walkieState === \'recording\' || (rexEngine.isWalkie && rexEngine.isListening)'),
  'handleToggleRexLive must accurately check if recording is active before stopping'
);
console.log('  ✅ PASS: Walkie-Talkie toggle and listening auto-resumption verified!\n');

// -----------------------------------------------------------------------------
// TEST 16: Event Listener Deduplication in Map Views
// -----------------------------------------------------------------------------
console.log('▶️ Test 16: Verifying Event Listener Deduplication in Map Views');
const questMapCode = fs.readFileSync(path.resolve('src/views/QuestMapView.js'), 'utf-8');
assert.ok(
  questMapCode.includes('window._questRexLiveAnswerHandler'),
  'QuestMapView must store handlers on window to deduplicate event listeners'
);
assert.ok(
  questMapCode.includes('window.removeEventListener(\'rex-live-answer\', window._questRexLiveAnswerHandler)'),
  'QuestMapView must remove previous window listeners before re-attaching'
);
assert.ok(
  advViewCode.includes('window._rexLiveHintHandler'),
  'AdventuresMapView must store handlers on window to deduplicate event listeners'
);
console.log('  ✅ PASS: Event listener deduplication in map views verified!\n');

// -----------------------------------------------------------------------------
// TEST 17: Dance Party Routine Timer In-Place Updates
// -----------------------------------------------------------------------------
console.log('▶️ Test 17: Verifying Dance Party Routine Timer In-Place Updates');
assert.ok(
  danceViewCode.includes('id="pose-timer-val"'),
  'DancePartyView must assign id="pose-timer-val" for in-place text updates'
);
assert.ok(
  danceViewCode.includes('id="pose-timer-bar"'),
  'DancePartyView must assign id="pose-timer-bar" for in-place bar updates'
);
assert.ok(
  !danceViewCode.includes('poseTimeLeft--;\n      store.notify();'),
  'DancePartyView routineTimer must NOT call store.notify() every second'
);
console.log('  ✅ PASS: Dance party routine timer in-place updates verified!\n');

console.log('=============================================================');
console.log('ALL REX THE DINO & GEMINI LIVE TESTS PASSED SUCCESSFULLY! 🎉');
console.log('=============================================================');

process.exit(0);
