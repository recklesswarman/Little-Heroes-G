const fs = require('fs');

async function testTrophyShowcase() {
  console.log('🧪 Testing Hero HQ Trophy Showcase & Spotlights slot...');

  // Setup DOM mocks
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    }
  };
  global.document = {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => []
  };

  const { store } = await import('../src/state/store.js');
  const { renderHeroHQView } = await import('../src/views/HeroHQView.js');

  store.init();

  // Render view
  const html = renderHeroHQView();

  // Verify 5th Spotlight Pedestal exists
  if (!html.includes('id="hq-weapon-spotlight-pedestal"')) {
    throw new Error('Missing hq-weapon-spotlight-pedestal in HeroHQView markup');
  }
  console.log('✅ Back wall 5th Spotlight Pedestal for Equipped Combat Weapon verified');

  // Verify All Trophies button exists
  if (!html.includes('id="hq-view-all-trophies-btn"')) {
    throw new Error('Missing hq-view-all-trophies-btn in HeroHQView markup');
  }
  console.log('✅ All Trophies button verified');

  // Verify modal template functions properly
  if (!html.includes('Trophy Showcase & Spotlights')) {
    throw new Error('Missing Trophy Showcase & Spotlights header');
  }
  console.log('✅ Trophy Showcase & Spotlights header verified');

  console.log('🎉 Hero HQ Trophy Showcase & Spotlights tests passed 100%!');
  process.exit(0);
}

testTrophyShowcase().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
