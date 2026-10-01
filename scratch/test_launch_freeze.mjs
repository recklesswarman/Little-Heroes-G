import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { renderBattleView, attachBattleListeners } from '../src/views/BattleView.js';

console.log('Simulating full browser renderApp loop...');

let renderAppCount = 0;
let isRendering = false;

function renderApp() {
  renderAppCount++;
  console.log(`[renderApp #${renderAppCount}] rendering view: ${store.state.activeView}`);
  if (renderAppCount > 20) {
    console.error('CRITICAL BUG REPRODUCED: INFINITE RENDER LOOP DETECTED!');
    process.exit(1);
  }
  if (store.state.activeView === 'ar_battle') {
    const html = renderBattleView();
    attachBattleListeners();
  }
}

store.subscribe(() => {
  renderApp();
});

console.log('Navigating to ar_battle via store.navigate...');
store.navigate('ar_battle');

console.log(`Render loop completed! Total renders: ${renderAppCount}`);
process.exit(0);
