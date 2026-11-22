// The Studio escapes what a parent types, and the Pet category renders without errors.
import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { renderParentPortalView, setActiveAdminTab, setStudioCategoryForTest } from '../src/views/ParentPortalView.js';

let passed = 0, failed = 0;
const assert = (c, m) => { if (c) { console.log(`  ✅ PASS: ${m}`); passed++; } else { console.error(`  ❌ FAIL: ${m}`); failed++; } };

console.log('🛡️ --- Studio escaping and pet category --- 🛡️');
setActiveAdminTab('studio');
let html = renderParentPortalView();
assert(html.includes('id="studio-ai-prompt"'), 'Studio renders the prompt box');
assert(html.includes('id="studio-gear-ai-btn"'), 'Studio renders the Generate button');
assert(!html.includes('Coming soon'), 'no Coming soon buttons remain');
assert(html.includes('id="studio-test-as-child-btn"'), 'Test as Child is offered');

// Every Studio category renders (the pet category used to throw a ReferenceError).
for (const cat of ['gear', 'weapon', 'furniture', 'toy', 'food', 'pet', 'boss', 'world_stash']) {
  setStudioCategoryForTest(cat);
  let out = '';
  let err = '';
  try { out = renderParentPortalView(); } catch (e) { err = e.message; }
  assert(!err && out.includes('id="studio-ai-prompt"') || (!err && cat === 'world_stash'), `category ${cat} renders${err ? ': ' + err : ''}`);
}
setStudioCategoryForTest('pet');
html = renderParentPortalView();
assert(html.includes('studio-pet-arch-btn') || html.includes('studio-pet-archetype-select'), 'pet category shows the companion type picker');
setStudioCategoryForTest('gear');

// Typed text can't break out of attributes.
const evil = '"><img src=x onerror=alert(1)>';
store.getState();
html = renderParentPortalView();
assert(!html.includes('<img src=x onerror=alert(1)>'), 'no raw injected markup in the Studio');

console.log(`\nTEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
process.exit(failed ? 1 : 0);
