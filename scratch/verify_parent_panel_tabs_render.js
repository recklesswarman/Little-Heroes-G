// Render test: the Screen Time, Settings and Studio tabs show the saved values
// (not hard-coded ones) and the Studio controls are live (no more Coming soon buttons).
import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { renderParentPortalView, setActiveAdminTab } from '../src/views/ParentPortalView.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}
const selected = (html, id) => {
  const i = html.indexOf(`id="${id}"`);
  const block = html.slice(i, html.indexOf('</select>', i));
  const m = block.match(/<option value="([^"]*)"\s+selected/);
  return m ? m[1] : null;
};

console.log('🧩 --- Verifying Parent Panel tabs render saved values --- 🧩');

// Screen Time tab
store.updateScreenTimeSettings('all', { dailyMaxScreenTime: 0, bedtimeCurfew: '', screenTimeRate: 5, screenTimeLockMessage: 'Time to <b>read</b>!' });
setActiveAdminTab('screentime');
let html = renderParentPortalView();
assert(selected(html, 'screentime-cap-select') === '0', `cap select shows saved 0 (got ${selected(html, 'screentime-cap-select')})`);
assert(selected(html, 'screentime-rate-select') === '5', `rate select shows saved 5 (got ${selected(html, 'screentime-rate-select')})`);
assert(/id="screentime-curfew-off"[^>]*checked/.test(html), '"No curfew" is checked when the curfew is empty');
assert(html.includes('Time to &lt;b&gt;read&lt;/b&gt;!') && !html.includes('Time to <b>read</b>!'), 'lock message is shown escaped');
assert(html.includes('id="screentime-save-feedback"'), 'inline save feedback is rendered');

store.updateScreenTimeSettings('all', { dailyMaxScreenTime: 90, bedtimeCurfew: '21:15', screenTimeRate: 3 });
html = renderParentPortalView();
assert(selected(html, 'screentime-cap-select') === '90' && selected(html, 'screentime-rate-select') === '3', 'updated cap and rate are shown');
assert(/id="screentime-curfew-input" value="21:15"/.test(html), 'saved curfew time is shown');

// Settings tab
store.setParentPin('4821');
store.setRexVoicePersona('Charon');
setActiveAdminTab('settings');
html = renderParentPortalView();
assert(/id="parent-setting-pin-input"[^>]*type="password"|type="password"[^>]*id="parent-setting-pin-input"/.test(html), 'PIN input is a password field');
assert(html.includes('id="pin-save-error"'), 'PIN error message slot is rendered');
assert(/data-voice-id="Charon" aria-pressed="true"/.test(html), 'saved Rex voice (Charon) is selected');
assert((html.match(/class="rex-voice-select-btn/g) || []).length === 5, 'all 5 Rex voices are offered');
assert((html.match(/rex-voice-preview-btn/g) || []).length >= 5, 'each Rex voice has a preview button');
assert(!html.includes('Prebuilt Voice Selection'), 'duplicate voice picker is gone');
assert(html.includes('id="companion-rules-feedback"'), 'companion rules save feedback is rendered');

// Studio tab
setActiveAdminTab('studio');
html = renderParentPortalView();
for (const id of ['studio-mode-modelviewer-btn', 'studio-test-as-child-btn']) {
  const i = html.indexOf(`id="${id}"`);
  const tag = html.slice(i, html.indexOf('>', i));
  assert(i > 0 && !/disabled/.test(tag) && !/Coming soon/.test(tag), `${id} is enabled`);
}
// Mic only shows where the browser can listen (the mock DOM has no SpeechRecognition).
assert(!html.includes('id="studio-voice-mic-btn"'), 'mic button is hidden when speech recognition is unavailable');
assert(/id="studio-photo-upload"/.test(html) && !/id="studio-photo-upload"[^>]*disabled/.test(html), 'photo upload is enabled');

setActiveAdminTab('approvals');
console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
