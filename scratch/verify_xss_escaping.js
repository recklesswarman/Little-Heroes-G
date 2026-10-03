import './setup_mock_env.js';
import { escapeHtml } from '../src/utils/escapeHtml.js';
import { store } from '../src/state/store.js';
import { renderDashboardView } from '../src/views/DashboardView.js';
import { renderProfileView } from '../src/views/ProfileView.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

// A hero's name (and similar fields) is cloud-synced household data that can
// arrive from another device -- including, per the security review, a
// device that was never required to go through a parent. If this ever
// contains an HTML payload, it must not execute when any device renders it.
const XSS_PAYLOAD = '<img src=x onerror="window.__xss_fired = true">';

console.log('\n--- 1. escapeHtml() neutralizes the dangerous characters ---');
const escaped = escapeHtml(XSS_PAYLOAD);
assert(!escaped.includes('<img'), 'Raw "<img" tag is not present in the escaped output');
assert(escaped.includes('&lt;img'), 'The "<" was converted to the &lt; entity');
assert(escapeHtml(`O'Brien "Ace"`) === 'O&#39;Brien &quot;Ace&quot;', 'Quotes are escaped too (needed for attribute contexts like <input value="...">)');
assert(escapeHtml(null) === '' && escapeHtml(undefined) === '', 'null/undefined are handled safely, not rendered as the string "null"');

console.log('\n--- 2. DashboardView renders a malicious hero name as inert text, not a tag ---');
store.state.heroes = [{ id: 'h1', name: XSS_PAYLOAD, level: 1, streak: 1, avatar: 'x.png', coins: 0, points: 0 }];
store.state.selectedHero = store.state.heroes[0];
const dashHtml = renderDashboardView();
assert(!dashHtml.includes('<img src=x onerror'), 'DashboardView does not emit the raw <img onerror tag');
assert(dashHtml.includes('&lt;img'), 'DashboardView emits the escaped form of the hero name instead');

console.log('\n--- 3. ProfileView renders a malicious hero name as inert text, not a tag ---');
const profileHtml = renderProfileView();
assert(!profileHtml.includes('<img src=x onerror'), 'ProfileView does not emit the raw <img onerror tag');
assert(profileHtml.includes('&lt;img'), 'ProfileView emits the escaped form of the hero name instead');

console.log('\n(ParentPortalView.js:3775 and ShopView.js:491 were fixed the same way -- verified by direct');
console.log(' code inspection; not re-exercised here since both require simulating extra UI state/clicks.)');

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
