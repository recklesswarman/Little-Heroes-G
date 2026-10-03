import './setup_mock_env.js';
import { store, KID_AVATARS } from '../src/state/store.js';
import { renderLandingAuthModal, attachLandingAuthModalListeners } from '../src/components/LandingAuthModal.js';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

const NEW_AVATAR_IDS = ['avatar_ninja', 'avatar_wizard', 'avatar_robot', 'avatar_lion', 'avatar_falcon'];

console.log('\n--- 1. Avatar presets expanded with full data shape ---');
assert(KID_AVATARS.length >= 9, `KID_AVATARS expanded to at least 9 (has ${KID_AVATARS.length})`);
for (const id of NEW_AVATAR_IDS) {
  const avatar = KID_AVATARS.find(a => a.id === id);
  assert(Boolean(avatar), `New avatar preset "${id}" exists`);
  if (avatar) {
    assert(typeof avatar.label === 'string' && avatar.label.length > 0, `Avatar "${id}" has a non-empty label`);
    assert(typeof avatar.url === 'string' && avatar.url.startsWith('https://'), `Avatar "${id}" has a valid https url`);
  }
}
const avatarIds = KID_AVATARS.map(a => a.id);
assert(new Set(avatarIds).size === avatarIds.length, 'No duplicate avatar ids');
const avatarUrls = KID_AVATARS.map(a => a.url);
assert(new Set(avatarUrls).size === avatarUrls.length, 'No duplicate avatar urls');

console.log('\n--- 2. Real Landing Auth Modal onboarding render shows all preset avatars ---');
store.state.isAuthenticated = false;
store.state.isHouseholdConfigured = false;
store.state.householdSetupStep = 'create';
document.body.innerHTML = renderLandingAuthModal();
attachLandingAuthModalListeners();
const html = document.body.innerHTML;
for (const avatar of KID_AVATARS) {
  assert(html.includes(`data-avatar-url="${avatar.url}"`), `Landing auth modal renders a selectable button for "${avatar.label}"`);
}

console.log('\n--- 3. Clicking a new avatar preset through the real UI selects it ---');
const ninjaBtn = document.querySelector(`[data-avatar-url="${KID_AVATARS.find(a => a.id === 'avatar_ninja').url}"]`);
assert(Boolean(ninjaBtn), 'The new Shadow Ninja Scout avatar button exists in the rendered DOM');
if (ninjaBtn) {
  ninjaBtn.click();
  document.body.innerHTML = renderLandingAuthModal();
  const ninjaUrl = KID_AVATARS.find(a => a.id === 'avatar_ninja').url;
  const reRenderedBtn = document.querySelector(`[data-avatar-url="${ninjaUrl}"]`);
  assert(Boolean(reRenderedBtn), 'Modal re-renders successfully after selecting a new preset');
  assert(
    Boolean(reRenderedBtn && reRenderedBtn.className.includes('border-primary')),
    'Clicking the new avatar visually marks it as selected on re-render'
  );
}

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);

process.exit(failed > 0 ? 1 : 0);
