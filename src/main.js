import './styles/index.css';
import { store } from './state/store.js';

// Layout Components
import { renderTopHeader, attachTopHeaderListeners } from './components/TopHeader.js';
import { renderBottomNav, attachBottomNavListeners } from './components/BottomNav.js';
import { renderRewardModal, attachRewardModalListeners } from './components/RewardModal.js';
import { renderParentLockModal, initParentLockModal, attachParentLockListeners } from './components/ParentLockModal.js';
import { renderHouseholdLinkModal, initHouseholdModal, attachHouseholdLinkModalListeners } from './components/HouseholdLinkModal.js';

// Views
import { renderDashboardView, attachDashboardListeners } from './views/DashboardView.js';
import { renderQuestMapView, attachQuestMapListeners } from './views/QuestMapView.js';
import { renderPetPenView, attachPetPenListeners } from './views/PetPenView.js';
import { renderPetRosterView, attachPetRosterListeners } from './views/PetRosterView.js';
import { renderPetDetailView, attachPetDetailListeners } from './views/PetDetailView.js';
import { renderPetBathView, attachPetBathListeners } from './views/PetBathView.js';
import { renderMasterFuseView, attachMasterFuseListeners } from './views/MasterFuseView.js';
import { renderAdventuresMapView, attachAdventuresMapListeners } from './views/AdventuresMapView.js';
import { renderShopView, attachShopListeners } from './views/ShopView.js';
import { renderBattleView, attachBattleListeners } from './views/BattleView.js';
import { renderEvolutionView, attachEvolutionListeners } from './views/EvolutionView.js';
import { renderDancePartyView, attachDancePartyListeners } from './views/DancePartyView.js';
import { renderProfileView, attachProfileListeners } from './views/ProfileView.js';
import { renderParentPortalView, attachParentPortalListeners } from './views/ParentPortalView.js';

const app = document.getElementById('app');

function renderApp() {
  const state = store.getState();
  const activeView = state.activeView;

  let mainContent = '';
  let attachViewListeners = () => {};

  switch (activeView) {
    case 'dashboard':
      mainContent = renderDashboardView();
      attachViewListeners = attachDashboardListeners;
      break;
    case 'quest_map':
      mainContent = renderQuestMapView();
      attachViewListeners = attachQuestMapListeners;
      break;
    case 'pet_pen':
      mainContent = renderPetPenView();
      attachViewListeners = attachPetPenListeners;
      break;
    case 'pet_roster':
      mainContent = renderPetRosterView();
      attachViewListeners = attachPetRosterListeners;
      break;
    case 'pet_detail':
      mainContent = renderPetDetailView();
      attachViewListeners = attachPetDetailListeners;
      break;
    case 'pet_bath':
      mainContent = renderPetBathView();
      attachViewListeners = attachPetBathListeners;
      break;
    case 'master_fuse':
      mainContent = renderMasterFuseView();
      attachViewListeners = attachMasterFuseListeners;
      break;
    case 'adventures_map':
      mainContent = renderAdventuresMapView();
      attachViewListeners = attachAdventuresMapListeners;
      break;
    case 'shop':
      mainContent = renderShopView();
      attachViewListeners = attachShopListeners;
      break;
    case 'ar_battle':
      mainContent = renderBattleView();
      attachViewListeners = attachBattleListeners;
      break;
    case 'evolution':
      mainContent = renderEvolutionView();
      attachViewListeners = attachEvolutionListeners;
      break;
    case 'dance_party':
      mainContent = renderDancePartyView();
      attachViewListeners = attachDancePartyListeners;
      break;
    case 'profile':
      mainContent = renderProfileView();
      attachViewListeners = attachProfileListeners;
      break;
    case 'parent_portal':
      if (!store.isParentUnlocked()) {
        mainContent = renderDashboardView();
        attachViewListeners = attachDashboardListeners;
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('open-parent-modal'));
        }, 50);
      } else {
        mainContent = renderParentPortalView();
        attachViewListeners = attachParentPortalListeners;
      }
      break;
    default:
      mainContent = renderDashboardView();
      attachViewListeners = attachDashboardListeners;
      break;
  }

  // Render Full Application Shell
  app.innerHTML = `
    <div class="min-h-screen bg-background text-on-surface flex flex-col font-body selection:bg-primary selection:text-on-primary">
      ${renderTopHeader()}
      <main class="flex-1 w-full max-w-7xl mx-auto">
        ${mainContent}
      </main>
      ${renderBottomNav()}
      ${renderRewardModal()}
      ${renderParentLockModal()}
      ${renderHouseholdLinkModal()}
    </div>
  `;

  // Attach All Component Listeners
  attachTopHeaderListeners();
  attachBottomNavListeners();
  attachRewardModalListeners();
  attachParentLockListeners();
  attachHouseholdLinkModalListeners();
  attachViewListeners();
}

function handleStateUpdate() {
  // Modern Web Guidance: Native View Transitions API with progressive enhancement
  if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    renderApp();
  } else {
    document.startViewTransition(() => {
      renderApp();
    });
  }
}

// Global Keyboard Escape handler for modals (Modern Web Baseline)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    store.closeReward();
    const lockBackdrop = document.getElementById('parent-lock-modal-backdrop');
    if (lockBackdrop) {
      window.dispatchEvent(new CustomEvent('close-parent-lock'));
    }
  }
});

// Initial Listeners & Store Subscription
initParentLockModal();
initHouseholdModal();
store.subscribe(handleStateUpdate);

// Initial Render
renderApp();
