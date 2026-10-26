/**
 * scratch/verify_bedtime_voice_picker.mjs
 *
 * Regression coverage for the Parent Portal "Bedtime Storybook Narrator
 * Voice" setting: parents can override which companion pet's voice reads
 * bedtime stories, independent of whichever pet the child currently has
 * active. Verifies the store default/getter, that bedtimeStoryService's
 * resolveBedtimeNarratorPetId() helper actually prefers the override, and
 * that the Parent Portal settings tab renders a selectable option per pet.
 */
import './setup_mock_env.js';
import assert from 'node:assert';

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc} -> ${err.message}`);
    failed++;
  }
}

async function run() {
  console.log('🧪 Bedtime Storybook Narrator Voice Picker Verification\n');

  const { store } = await import('../src/state/store.js');
  const { resolveBedtimeNarratorPetId } = await import('../src/services/bedtimeStoryService.js');
  const { PETS_DATABASE } = await import('../src/data/petsData.js');
  const { renderParentPortalView, setActiveAdminTab } = await import('../src/views/ParentPortalView.js');

  store.state.selectedHero = { id: 'hero_voice_test', name: 'Test Hero', activePetId: '1', bedtimeHistory: [] };
  store.state.heroes = [store.state.selectedHero];

  check('bedtimeSanctuaryState defaults bedtimeVoicePetId to null (match active companion)', () => {
    store.state.bedtimeSanctuaryState = undefined;
    const sanctuary = store.getBedtimeSanctuaryState();
    assert.strictEqual(sanctuary.bedtimeVoicePetId, null);
  });

  check('resolveBedtimeNarratorPetId falls back to the provided petId when no override is set', () => {
    store.updateBedtimeSanctuaryState({ bedtimeVoicePetId: null });
    assert.strictEqual(resolveBedtimeNarratorPetId('raptor'), 'raptor');
  });

  check('resolveBedtimeNarratorPetId prefers the parent-chosen override over the active companion', () => {
    store.updateBedtimeSanctuaryState({ bedtimeVoicePetId: 'luna' });
    assert.strictEqual(resolveBedtimeNarratorPetId('raptor'), 'luna');
  });

  check('Clearing the override (back to null) restores default match-active-companion behavior', () => {
    store.updateBedtimeSanctuaryState({ bedtimeVoicePetId: null });
    assert.strictEqual(resolveBedtimeNarratorPetId('raptor'), 'raptor');
  });

  check('Parent Portal settings tab renders a selectable voice option for all 24 companion pets plus the default', () => {
    setActiveAdminTab('settings');
    const html = renderParentPortalView();
    assert.ok(html.includes('Bedtime Storybook Narrator Voice'), 'Section heading must render');
    const optionCount = (html.match(/data-bedtime-voice-pet-id/g) || []).length;
    assert.strictEqual(optionCount, PETS_DATABASE.length + 1, `Expected ${PETS_DATABASE.length + 1} options (24 pets + match-active default), got ${optionCount}`);
  });

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
  process.exit(process.exitCode || 0);
}

run().catch((err) => {
  console.error('❌ Test suite crashed:', err);
  process.exit(1);
});
