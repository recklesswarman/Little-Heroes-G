const assert = require('assert');

console.log('🧪 Running Mobile Responsiveness & Avatar Fix Tests...');

// Setup minimal DOM mock
if (!global.performance) {
  global.performance = { now: () => Date.now() };
}
global.window = {
  devicePixelRatio: 1,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {}
};
global.document = {
  body: {},
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

async function run() {
  const { store } = await import('../src/state/store.js');
  const { renderBedtimeStoryView } = await import('../src/views/BedtimeStoryView.js');
  const { renderTopHeader } = await import('../src/components/TopHeader.js');

  console.log('\n--- 1. Testing Pet Avatar with Long Base64 / Cloud Storage URL ---');
  // Set hero with Kalep and pet with the exact URL from the user's screenshot
  const longUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-tO1SdRfRGAdffGZiLQxMfvzeWK75gnu-8V_g3uY_1zZSyW7V1gBj5eL8EaKNQ0bEYLoIJX8_MrJKE_FTNyJjWhMiDyFXcs11Vql8nzDOSXfGFkzBKSaEB6DiOvappqJJhiqFEEvVhDhFMqzCkZED1YDgAFVWcQOc0dn4cWiyd34yVJc9c7aF6_UYRrB4Ml5we64YPZuC17yjouHWXCGyOnqDbruj8B6sXSWQEcYhnNXJ0t-S4k1JPw';
  
  store.state.selectedHero.name = 'Kalep';
  store.state.pets = [
    {
      id: '9',
      key: 'sparky',
      name: 'Sparky the Dragon',
      avatar: longUrl,
      image: longUrl,
      emoji: '🐉'
    }
  ];
  store.state.selectedHero.activePetId = '9';

  const bedtimeHtml = renderBedtimeStoryView();
  
  // 1. Verify Good evening has the kid's name
  assert(bedtimeHtml.includes('Good evening, Kalep!'), 'Greeting must contain "Good evening, Kalep!"');
  console.log('  ✅ PASS: Greeting correctly renders "Good evening, Kalep!"');

  // 2. Verify that the long URL is inside an img tag, NOT raw spilled text
  assert(bedtimeHtml.includes(`<img src="${longUrl}" alt="Sparky the Dragon"`), 'Pet avatar must be rendered inside an img tag with src');
  console.log('  ✅ PASS: Pet companion badge renders as an <img src="..." /> element without raw text leakage');

  // 3. Verify hero avatar img exists
  assert(bedtimeHtml.includes('alt="Kalep"'), 'Hero avatar img tag must exist');
  console.log('  ✅ PASS: Hero avatar image exists and renders Kalep\'s avatar');

  // 4. Verify no raw unescaped URL text in the h2
  assert(!bedtimeHtml.includes(`Good evening, ${longUrl}`), 'Greeting must not contain the raw url');
  console.log('  ✅ PASS: Greeting has no raw URL pollution');

  console.log('\n--- 2. Testing Mobile & Tablet Responsiveness in Bedtime View ---');
  // Check main container has pb-32 to prevent bottom navigation occlusion
  assert(bedtimeHtml.includes('pb-32'), 'Main container must include pb-32 to clear fixed bottom navigation');
  assert(!bedtimeHtml.includes('flex flex-col justify-center'), 'Main container must NOT use justify-center which breaks scrolling on mobile');
  console.log('  ✅ PASS: Main bedtime container clears fixed navigation (pb-32) and avoids vertical centering');

  // Check Step 3 button does not use hash navigation
  assert(bedtimeHtml.includes('id="step-goto-customizer-btn"'), 'Step 3 button must use dedicated ID for smooth scrolling');
  console.log('  ✅ PASS: Step 3 button uses step-goto-customizer-btn');

  // Check Realm cards use responsive 2x2 grid on mobile
  assert(bedtimeHtml.includes('grid grid-cols-2 lg:grid-cols-4'), 'Realm selection uses 2x2 grid on mobile');
  console.log('  ✅ PASS: Realm selection uses responsive 2x2 mobile grid');

  console.log('\n--- 3. Testing TopHeader Responsiveness & Anti-Squash ---');
  const headerHtml = renderTopHeader();
  assert(headerHtml.includes('flex-shrink-0'), 'Profile button must have flex-shrink-0');
  assert(headerHtml.includes('hidden md:flex'), 'Hero HQ button is hidden on narrow mobile screens to prevent avatar overlap');
  console.log('  ✅ PASS: TopHeader profile button is protected from squash (flex-shrink-0)');
  console.log('  ✅ PASS: TopHeader hides HQ button on small phone screens (hidden md:flex)');

  console.log('\n=========================================');
  console.log('🎉 ALL MOBILE & AVATAR TESTS PASSED! 🎉');
  console.log('=========================================');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
