import './setup_mock_env.js';
import { escapeHtml } from '../src/utils/escapeHtml.js';
import { safeImageUrl } from '../src/utils/safeImageUrl.js';
import { store } from '../src/state/store.js';
import { renderDashboardView } from '../src/views/DashboardView.js';
import { renderProfileView } from '../src/views/ProfileView.js';
import { renderTopHeader } from '../src/components/TopHeader.js';
import { renderPetGearStudioViewer } from '../src/components/PetGearStudioViewer.js';
import { getAllGearForSocket } from '../src/data/petGearStudioData.js';
import { renderLandingAuthModal, attachLandingAuthModalListeners } from '../src/components/LandingAuthModal.js';
import { firebaseAuth } from '../src/services/firebaseAuthService.js';

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
assert(safeImageUrl('javascript:alert(1)', '/fallback.png') === '/fallback.png', 'Image URLs reject executable schemes');
assert(safeImageUrl('https://images.example/photo.jpg" onerror="alert(1)', '/fallback.png') === '/fallback.png', 'Image URLs reject markup in their attribute value');
assert(safeImageUrl('data:image/jpeg;base64,Zm9v') === 'data:image/jpeg;base64,Zm9v', 'Compressed profile photos remain valid image URLs');
const generatedIcon = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"></svg>')}`;
assert(safeImageUrl(generatedIcon) === generatedIcon, 'Generated reward and item icons (SVG data URLs) stay visible');
assert(safeImageUrl('blob:https://little-heroes-quest-8842.web.app/0f1e') === 'blob:https://little-heroes-quest-8842.web.app/0f1e', 'Offline upload fallback blob URLs stay visible');
assert(safeImageUrl('data:text/html;base64,Zm9v', '/fallback.png') === '/fallback.png', 'Non-image data URLs are rejected');
assert(safeImageUrl('data:image/svg+xml;utf8,<svg onload="alert(1)">', '/fallback.png') === '/fallback.png', 'SVG data URLs containing raw markup are rejected');

console.log('\n--- 2. DashboardView renders a malicious hero name as inert text, not a tag ---');
store.state.heroes = [{ id: 'h1', name: XSS_PAYLOAD, title: XSS_PAYLOAD, level: 1, streak: 1, avatar: 'javascript:alert(1)', coins: 0, points: 0 }];
store.state.selectedHero = store.state.heroes[0];
const dashHtml = renderDashboardView();
assert(!dashHtml.includes('<img src=x onerror'), 'DashboardView does not emit the raw <img onerror tag');
assert(dashHtml.includes('&lt;img'), 'DashboardView emits the escaped form of the hero name instead');
assert(!dashHtml.includes('javascript:alert(1)'), 'DashboardView rejects executable avatar URLs');
assert(dashHtml.includes(escapeHtml(XSS_PAYLOAD)), 'DashboardView escapes the user-editable hero title');
const headerHtml = renderTopHeader();
assert(headerHtml.includes(escapeHtml(XSS_PAYLOAD)), 'TopHeader escapes the user-editable hero title');

console.log('\n--- 3. ProfileView renders a malicious hero name as inert text, not a tag ---');
const profileHtml = renderProfileView();
assert(!profileHtml.includes('<img src=x onerror'), 'ProfileView does not emit the raw <img onerror tag');
assert(profileHtml.includes('&lt;img'), 'ProfileView emits the escaped form of the hero name instead');

console.log('\n--- 4. Pet Gear Studio escapes cloud-synced companion names ---');
const originalGetPetWithProgress = store.getPetWithProgress;
store.getPetWithProgress = () => ({ name: XSS_PAYLOAD });
const gearHtml = renderPetGearStudioViewer();
assert(!gearHtml.includes('<img src=x onerror'), 'Pet Gear Studio does not emit a raw companion-name tag');
assert(gearHtml.includes('&lt;img'), 'Pet Gear Studio emits an escaped companion name');
store.getPetWithProgress = originalGetPetWithProgress;

const originalGetCustomGearDyes = store.getCustomGearDyes;
const originalGetEquippedPetStudioGear = store.getEquippedPetStudioGear;
store.getCustomGearDyes = () => ({ back: '#ffffff" onerror="window.__xss_fired = true' });
store.getEquippedPetStudioGear = () => ({ back: getAllGearForSocket('back')[0].id });
const unsafeDyeHtml = renderPetGearStudioViewer();
assert(!unsafeDyeHtml.includes('onerror="window.__xss_fired'), 'Cloud-synced dye values cannot inject HTML attributes');
assert(unsafeDyeHtml.includes('background-color: #475569;'), 'Invalid dye values fall back to a safe color');
store.getCustomGearDyes = originalGetCustomGearDyes;
store.getEquippedPetStudioGear = originalGetEquippedPetStudioGear;

console.log('\n--- 5. A sign-in exception is escaped before rendering in LandingAuthModal ---');
const originalSignInWithGoogle = firebaseAuth.signInWithGoogle;
firebaseAuth.signInWithGoogle = async () => { throw new Error(XSS_PAYLOAD); };
store.state.isAuthenticated = false;
store.state.isHouseholdConfigured = false;
store.state.householdSetupStep = 'auth';
document.body.innerHTML = '<button id="auth-google-signin-btn"></button><span data-auth-error-message="true"></span>';
attachLandingAuthModalListeners();
document.getElementById('auth-google-signin-btn').click();
await new Promise(resolve => setTimeout(resolve, 0));
store.state.isAuthenticated = false;
store.state.isHouseholdConfigured = false;
store.state.householdSetupStep = 'auth';
const landingAuthHtml = renderLandingAuthModal();
assert(landingAuthHtml.includes('data-auth-error-message="true"'), 'LandingAuthModal renders a static error-message placeholder');
attachLandingAuthModalListeners();
const authErrorMessageElement = document.querySelector('[data-auth-error-message]');
assert(authErrorMessageElement.textContent === XSS_PAYLOAD, 'LandingAuthModal displays exception text as inert text');
firebaseAuth.signInWithGoogle = originalSignInWithGoogle;

console.log('\n(ParentPortalView.js:3775 and ShopView.js:491 were fixed the same way -- verified by direct');
console.log(' code inspection; not re-exercised here since both require simulating extra UI state/clicks.)');

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
