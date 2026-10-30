// Scratch verification test for Rex Audio Recorder & Zero-Lag Preset Phrase Companion Widget
import './setup_mock_env.js';
import assert from 'node:assert';
import { audioRecorder } from '../src/services/audioRecorderService.js';
import { getKidProfileName, playEmotionSFX, renderLiveRexWidget, renderRexAvatarSvg } from '../src/components/LiveRexWidget.js';
import { store } from '../src/state/store.js';

console.log('--- Testing Rex Audio Utilities & Zero-Lag Preset Phrase Widget ---');

// 1. AudioRecorderService unit tests
console.log('1. Testing AudioRecorderService API...');
assert(typeof audioRecorder.startRecording === 'function', 'audioRecorder has startRecording');
assert(typeof audioRecorder.stopRecording === 'function', 'audioRecorder has stopRecording');
assert(typeof audioRecorder.cancelRecording === 'function', 'audioRecorder has cancelRecording');
assert(typeof audioRecorder.requestMicPermission === 'function', 'audioRecorder has requestMicPermission');

const mime = audioRecorder.getSupportedMimeType();
console.log('Supported MIME type detected:', mime);

// Test accidental tap logic
audioRecorder.isRecording = true;
audioRecorder.startTime = Date.now() - 250; // 250ms elapsed
audioRecorder.dataChunks = [];
const shortTapResult = await audioRecorder.stopRecording();
assert.strictEqual(shortTapResult.isAccidentalTap, true, 'Short tap (<400ms) flagged as accidental tap');
console.log('✓ Accidental tap (<400ms) correctly detected');

// Test valid duration recording
audioRecorder.isRecording = true;
audioRecorder.startTime = Date.now() - 1200; // 1.2s elapsed
audioRecorder.dataChunks = [new Uint8Array([1, 2, 3, 4])];
audioRecorder.currentTranscript = 'Hello Rex!';
const validResult = await audioRecorder.stopRecording();
assert.strictEqual(validResult.isAccidentalTap, false, 'Longer tap (>=400ms) flagged as valid recording');
assert.strictEqual(validResult.transcript, 'Hello Rex!', 'Transcript preserved');
console.log('✓ Valid hold recording correctly processed');

// 2. Kid Profile Name Resolution
console.log('2. Testing Kid Profile Name Resolution...');
const defaultName = getKidProfileName();
console.log('Current resolved name:', defaultName);
assert(typeof defaultName === 'string' && defaultName.length > 0, 'Name is a non-empty string');
console.log('✓ Kid profile name resolution verified');

// 3. Emotion SFX Mapping
console.log('3. Testing Emotion SFX Dispatch...');
assert.doesNotThrow(() => {
  playEmotionSFX('excited');
  playEmotionSFX('happy');
  playEmotionSFX('proud');
  playEmotionSFX('gentle');
  playEmotionSFX('sleepy');
  playEmotionSFX(null);
}, 'Emotion SFX dispatches cleanly without errors');
console.log('✓ Emotion-synchronized Dino SFX verified');

// 4. Zero-Lag Floating Companion Widget Markup (Live Chat Modal Removed)
console.log('4. Testing Zero-Lag Floating Companion Widget Markup...');
store.state.isAuthenticated = true;
const html = renderLiveRexWidget();
assert(html.includes('id="live-rex-container"'), 'Floating container rendered');
assert(html.includes('id="live-rex-floating-btn"'), 'Floating companion button rendered');
assert(html.includes('id="floating-mascot-skeletal-canvas"'), 'Animated skeletal face viewer rendered');
assert(html.includes('id="live-rex-speaking-rings"'), 'Aura ripple ring indicator rendered');
assert(!html.includes('id="live-rex-modal-card"'), 'Live chat modal card completely removed');
assert(!html.includes('id="rex-waveform-bars"'), 'Live chat mic bars completely removed');
assert(!/pink|purple|magenta|violet|#f472b6|#ec4899|#a855f7/i.test(html + renderRexAvatarSvg()), 'Strict Explorer Palette enforced');
console.log('✓ Zero-lag preset phrase companion widget rendered properly');

console.log('\n--- ALL REX COMPANION WIDGET & AUDIO TESTS PASSED 100% ---');
process.exit(0);
