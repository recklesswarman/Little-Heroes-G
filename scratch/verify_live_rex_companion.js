import './setup_mock_env.js';
import assert from 'assert';
import { store } from '../src/state/store.js';
import { geminiLiveService } from '../src/services/geminiLiveService.js';
import { rexEngine } from '../src/services/rexCompanionEngine.js';
import { renderLiveRexWidget, renderRexAvatarSvg } from '../src/components/LiveRexWidget.js';
import { renderParentPortalView, setActiveAdminTab } from '../src/views/ParentPortalView.js';
import { renderBedtimeStoryView } from '../src/views/BedtimeStoryView.js';
import { DEFAULT_COMPANION_PHRASES } from '../src/data/companionPhrasesData.js';
import { PET_VOICE_MAP, PET_PERSONAS } from '../server/geminiService.js';
import fs from 'fs';
import path from 'path';

console.log('🦖 --- Running Companion Widget, Preset Phrase Rotation & App Wiring Test Suite --- 🦖\n');

// -----------------------------------------------------------------------------
// TEST 1: Verify Server-Side Gemini Service Configuration
// -----------------------------------------------------------------------------
console.log('▶️ Test 1: Verifying Server-Side Gemini Configuration');

const serverServiceContent = fs.readFileSync(path.resolve('server/geminiService.js'), 'utf-8');

assert.ok(
  !serverServiceContent.includes("'gemini-3.8-live'"),
  'Server MUST NOT use invalid gemini-3.8-live model'
);
assert.ok(
  serverServiceContent.includes('gemini-3.1-flash-live-preview'),
  'Server MUST use official gemini-3.1-flash-live-preview model'
);
assert.ok(
  serverServiceContent.includes('gemini-3.7-flash'),
  'Server chat MUST use gemini-3.7-flash for smart tasks'
);
assert.ok(PET_VOICE_MAP.rex === 'Puck', 'Rex should map to Puck voice');
assert.ok(PET_VOICE_MAP.bella === 'Aoede', 'Bella should map to Aoede voice');
assert.ok(PET_VOICE_MAP.barnaby === 'Fenrir', 'Barnaby should map to Fenrir voice');
assert.ok(PET_VOICE_MAP.pip === 'Zephyr', 'Pip should map to Zephyr voice');
assert.ok(PET_VOICE_MAP.aqua === 'Charon', 'Aqua Drake should map to Charon voice');
assert.ok(PET_PERSONAS.rex.name.includes('Rex'), 'Rex persona should be configured');

console.log('  ✅ PASS: Server-side Gemini configuration and pet voices verified.\n');

// -----------------------------------------------------------------------------
// TEST 2: Verify Zero-Lag Floating Companion Widget (Live Chat Removed)
// -----------------------------------------------------------------------------
console.log('▶️ Test 2: Verifying Zero-Lag Floating Companion Widget Markup');

store.state.isAuthenticated = true;
const renderedHtml = renderLiveRexWidget();

assert.ok(
  renderedHtml.includes('id="live-rex-container"'),
  'Must render floating companion container'
);
assert.ok(
  renderedHtml.includes('id="live-rex-floating-btn"'),
  'Must render floating companion button'
);
assert.ok(
  renderedHtml.includes('id="floating-mascot-skeletal-canvas"'),
  'Must render animated skeletal face viewer canvas'
);
assert.ok(
  renderedHtml.includes('id="live-rex-speaking-rings"'),
  'Must render aura speaking ripple rings'
);
assert.ok(
  renderedHtml.includes('z-50'),
  'LiveRexWidget container must have z-50'
);

// Verify Live Chat Modal and Speech Bubbles are completely removed
assert.ok(
  !renderedHtml.includes('id="live-rex-modal-card"'),
  'Live Chat modal card MUST be removed'
);
assert.ok(
  !renderedHtml.includes('id="rex-live-dialogue-container"'),
  'Live dialogue speech bubble container MUST be removed'
);
assert.ok(
  !renderedHtml.includes('id="live-rex-toggle-btn"'),
  'Hold-to-talk / live chat toggle button MUST be removed'
);

const forbiddenPalette = /pink|purple|magenta|violet|#f472b6|#ec4899|#a855f7|#8b5cf6/i;
assert.ok(
  !forbiddenPalette.test(renderedHtml + renderRexAvatarSvg()),
  'Companion widget and SVG must strictly enforce Explorer Palette (zero pink/purple)'
);

console.log('  ✅ PASS: Floating companion widget renders animated skeletal face + aura rings with zero Live Chat modal or speech bubble.\n');

// -----------------------------------------------------------------------------
// TEST 3: Verify Seeded Companion Phrases & Store CRUD + Non-Repeating Rotation
// -----------------------------------------------------------------------------
console.log('▶️ Test 3: Verifying Seeded Companion Phrases & Store CRUD');

assert.ok(DEFAULT_COMPANION_PHRASES.length >= 30, 'Must ship with ~32 seeded companion phrases');
assert.ok(
  DEFAULT_COMPANION_PHRASES.every(p => !forbiddenPalette.test(p.text)),
  'All seeded companion phrases must respect Explorer Palette vocabulary'
);

store.resetCompanionPhrasesToDefault();
const initialPhrases = store.getCompanionPhrases();
assert.strictEqual(initialPhrases.length, DEFAULT_COMPANION_PHRASES.length, 'Reset restores all default phrases');

// Add custom phrase
const added = store.addCompanionPhrase('High five, {name}! Great brushing today!', 'hygiene');
assert.ok(added && added.id, 'addCompanionPhrase returns created phrase');
assert.strictEqual(store.getCompanionPhrases().length, DEFAULT_COMPANION_PHRASES.length + 1, 'Phrase count incremented');

// Update custom phrase
const updated = store.updateCompanionPhrase(added.id, { text: 'Super roar, {name}! Shiny dino teeth!', category: 'encouragement' });
assert.ok(updated, 'updateCompanionPhrase returns true');
const foundUpdated = store.getCompanionPhrases().find(p => p.id === added.id);
assert.strictEqual(foundUpdated.text, 'Super roar, {name}! Shiny dino teeth!', 'Phrase text updated in store');

// Non-repeating random rotation check
const seenIds = new Set();
let prevId = null;
let immediateRepeat = false;
for (let i = 0; i < 15; i++) {
  const pick = store.pickRandomCompanionPhrase();
  assert.ok(pick && pick.text, 'pickRandomCompanionPhrase always returns a valid phrase');
  if (pick.id === prevId) immediateRepeat = true;
  prevId = pick.id;
  seenIds.add(pick.id);
}
assert.strictEqual(immediateRepeat, false, 'Consecutive taps must never immediately repeat the exact same phrase');
assert.ok(seenIds.size >= 5, 'Random rotation cycles across multiple distinct phrases');

// Delete phrase
const deleted = store.deleteCompanionPhrase(added.id);
assert.ok(deleted, 'deleteCompanionPhrase removes phrase');
assert.strictEqual(store.getCompanionPhrases().length, DEFAULT_COMPANION_PHRASES.length, 'Phrase count restored after delete');

console.log('  ✅ PASS: Companion phrase seeding, CRUD, and non-repeating zero-lag rotation verified.\n');

// -----------------------------------------------------------------------------
// TEST 4: Verify Parent Portal Companion Phrase Manager & Bedtime 3D Removal
// -----------------------------------------------------------------------------
console.log('▶️ Test 4: Verifying Parent Portal Phrase Manager & Bedtime 3D Stage Removal');

setActiveAdminTab('settings');
store.state.isParentUnlocked = true;
const parentHtml = renderParentPortalView();
assert.ok(
  parentHtml.includes('id="parent-companion-phrases-section"'),
  'Parent Portal Settings tab must render Companion Phrases manager section'
);
assert.ok(
  parentHtml.includes('id="parent-new-phrase-input"') && parentHtml.includes('id="parent-add-phrase-btn"'),
  'Parent Portal must render Add Companion Phrase input and button'
);
assert.ok(
  parentHtml.includes('id="parent-reset-phrases-btn"') && parentHtml.includes('id="parent-precache-phrases-btn"'),
  'Parent Portal must render Reset Defaults and Pre-Cache Voices buttons for companion phrases'
);

const bedtimeViewCode = fs.readFileSync(path.resolve('src/views/BedtimeStoryView.js'), 'utf-8');
assert.ok(
  !bedtimeViewCode.includes('Show 3D Stage') && !bedtimeViewCode.includes('toggle-stage-view-btn'),
  'Show 3D Stage button must be completely removed from BedtimeStoryView'
);
assert.ok(
  !bedtimeViewCode.includes('BedtimeStoryStage3D'),
  'BedtimeStoryView must no longer import or mount BedtimeStoryStage3D'
);
assert.ok(
  bedtimeViewCode.includes('id="story-save-bookshelf-btn"'),
  'BedtimeStoryView must render Save to Bookshelf button'
);
assert.ok(
  bedtimeViewCode.includes('id="story-replay-voice-btn"'),
  'BedtimeStoryView must render Replay Voice button'
);

// Verify completeBedtimeStory saves story even when sleep_on_time is already pending approval
const hero = store.getSelectedHero();
const testStoryId = `story_autosave_test_${Date.now()}`;
store.completeBedtimeStory({
  id: testStoryId,
  realmId: 'whispering_woods',
  moralId: 'brave_dark',
  title: 'The Emerald Lantern Quest',
  chapters: [{ title: 'Ch 1', text: 'Once upon a starlit evening...' }]
});
// Call a second time while sleep_on_time is already pending approval with a new story id
const secondStoryId = `story_autosave_second_${Date.now()}`;
store.completeBedtimeStory({
  id: secondStoryId,
  realmId: 'starlight_cove',
  moralId: 'kind_sharing',
  title: 'The Cyan Harbor Lullaby',
  chapters: [{ title: 'Ch 1', text: 'Gentle waves shimmered...' }]
});
const savedLibrary = store.getSelectedHero()?.bedtimeStoryLibrary || store.getState().bedtimeStoryLibrary || [];
assert.ok(
  savedLibrary.some(s => s.id === testStoryId) && savedLibrary.some(s => s.id === secondStoryId),
  'completeBedtimeStory must persist story to bookshelf even if sleep_on_time task is already pending today'
);

const bedtimeHtml = renderBedtimeStoryView();
assert.ok(!bedtimeHtml.includes('Show 3D Stage'), 'Rendered BedtimeStoryView contains zero 3D stage toggle');

console.log('  ✅ PASS: Parent Portal Phrase Manager, Bookshelf persistence, and 3D Stage removal verified.\n');

// -----------------------------------------------------------------------------
// TEST 5: Verify In-Game Voice Handling, Habit Claims & Tactile Face Cleanup
// -----------------------------------------------------------------------------
console.log('▶️ Test 5: Verifying Habit Claims, Event Wiring & Tactile Cleanup');

assert.ok(typeof geminiLiveService.connect === 'function', 'geminiLiveService.connect exists');
assert.ok(typeof geminiLiveService.disconnect === 'function', 'geminiLiveService.disconnect exists');

const handledTeeth = rexEngine.tryHandleInGameSpeech('I brushed my teeth clean and finished!');
assert.ok(handledTeeth, 'Teeth brushing speech should be recognized as in-game habit');

store.closeReward();
const habitResult = store.claimCompanionHabit('teeth');
assert.ok(habitResult.coins >= 0, 'claimCompanionHabit must return coin reward');
assert.strictEqual(store.getState().rewardModal, null, 'Reward modal overlay must NEVER be opened by companion habit claim');

const widgetContent = fs.readFileSync(path.resolve('src/components/LiveRexWidget.js'), 'utf-8');
assert.ok(
  widgetContent.includes('pickRandomCompanionPhrase'),
  'Floating companion click must rotate through preset companion phrases'
);
assert.ok(
  widgetContent.includes('floatRig?.startSpeaking?.()'),
  'Skeletal face canvas must start speaking animation during speech'
);
assert.ok(
  widgetContent.includes('floatRig?.stopSpeaking?.()'),
  'Skeletal face canvas must stop speaking animation when speech ends'
);

const petSkeletalCode = fs.readFileSync(path.resolve('src/components/PetSkeletalFaceViewer.js'), 'utf-8');
assert.ok(
  petSkeletalCode.includes('canvas._cleanupTactile'),
  'PetSkeletalFaceViewer must clean up previous pointer/touch listeners on re-initialization'
);

// Route normalization & timer checks
const mainCode = fs.readFileSync(path.resolve('src/main.js'), 'utf-8');
assert.ok(mainCode.includes('stopRex()'), 'main.js Escape handler must stop audio speech synthesis');

store.navigate('/learn');
assert.strictEqual(store.getState().activeView, 'adventures_map', 'store.navigate("/learn") must map to adventures_map');
store.navigate('/boost');
assert.strictEqual(store.getState().activeView, 'battle', 'store.navigate("/boost") must map to battle');

let notifyCount = 0;
const unsubscribe = store.subscribe(() => { notifyCount++; });
store.updateColosseumTimer(119, 120);
assert.strictEqual(notifyCount, 0, 'updateColosseumTimer must NOT trigger store.notify() by default');
store.updateColosseumTimer(118, 120, false);
assert.strictEqual(notifyCount, 1, 'updateColosseumTimer with skipNotify=false must trigger store.notify()');
unsubscribe();

console.log('  ✅ PASS: Habit claims, tactile face cleanup, route shortcuts, and non-destructive timers verified!\n');

console.log('=============================================================');
console.log('ALL COMPANION WIDGET & PHRASE ROTATION TESTS PASSED! 🎉');
console.log('=============================================================');

process.exit(0);
