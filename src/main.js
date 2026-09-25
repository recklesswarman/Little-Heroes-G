import './styles/index.css';
import { store } from './state/store.js';
import { initTactileSoundEngine } from './audio/sfx.js';
import { firestoreSync } from './services/firestoreSyncService.js';

// Connect centralized Firestore Sync Service to Store
store.setSyncService(firestoreSync);
import { firebaseAuth } from './services/firebaseAuthService.js';
import { isFirebaseAvailable } from './config/firebase.js';

// Layout Components
import { renderLandingAuthModal, attachLandingAuthModalListeners } from './components/LandingAuthModal.js';
import { renderTopHeader, attachTopHeaderListeners } from './components/TopHeader.js';
import { renderBottomNav, attachBottomNavListeners } from './components/BottomNav.js';
import { renderRewardModal, attachRewardModalListeners } from './components/RewardModal.js';
import { renderParentLockModal, initParentLockModal, attachParentLockListeners } from './components/ParentLockModal.js';
import { renderHouseholdLinkModal, initHouseholdModal, attachHouseholdLinkModalListeners } from './components/HouseholdLinkModal.js';
import { renderPetSelectionModal, attachPetSelectionModalListeners } from './components/PetSelectionModal.js';
import { renderPetLockerModal, attachPetLockerModalListeners } from './components/PetLockerModal.js';
import { renderMysterySurpriseModal, attachMysterySurpriseModalListeners } from './components/MysterySurpriseModal.js';
import { renderLiveRexWidget, attachLiveRexWidgetListeners } from './components/LiveRexWidget.js';
import { geminiLiveService } from './services/geminiLiveService.js';
import { rexEngine } from './services/rexCompanionEngine.js';
import { stopRex } from './services/voiceService.js';
import { renderGiftCrateWidget, renderGiftCrateModal, attachGiftCrateListeners } from './components/GiftCrateModal.js';

// Views
import { renderDashboardView, attachDashboardListeners } from './views/DashboardView.js';
import { renderQuestMapView, attachQuestMapListeners } from './views/QuestMapView.js';
import { renderPetSanctuaryView, attachPetSanctuaryListeners } from './views/PetSanctuaryView.js';
import { renderPetPenView, attachPetPenListeners } from './views/PetPenView.js';
import { renderPetRosterView, attachPetRosterListeners } from './views/PetRosterView.js';
import { renderPetDetailView, attachPetDetailListeners } from './views/PetDetailView.js';
import { renderPetBathView, attachPetBathListeners } from './views/PetBathView.js';
import { renderAdventuresMapView, attachAdventuresMapListeners } from './views/AdventuresMapView.js';
import { renderShopView, attachShopListeners } from './views/ShopView.js';
import { renderBattleView, attachBattleListeners, abandonBattleIfRunning } from './views/BattleView.js';
import { renderDancePartyView, attachDancePartyListeners } from './views/DancePartyView.js';
import { renderProfileView, attachProfileListeners } from './views/ProfileView.js';
import { renderParentPortalView, attachParentPortalListeners } from './views/ParentPortalView.js';
import { renderPetLockerView, attachPetLockerListeners } from './views/PetLockerView.js';
import { renderHeroHQView, attachHeroHQListeners } from './views/HeroHQView.js';
import { renderHeroForgeView, attachHeroForgeListeners } from './views/HeroForgeView.js';
import { renderDinoWorkoutView, attachDinoWorkoutListeners } from './views/DinoWorkoutView.js';
import { destroyActiveCanvas } from './utils/activeViewCanvasRegistry.js';
import { isExistingActiveHousehold } from './utils/householdHeuristics.js';

const app = document.getElementById('app');

let lastActiveViewForBattleCleanup = null;

function renderApp() {
  // Stop any canvas-backed view's requestAnimationFrame loop from the
  // previous render before tearing down/rebuilding app.innerHTML below --
  // innerHTML alone removes the DOM node but not the running RAF loop.
  destroyActiveCanvas();

  const state = store.getState();
  const activeView = state.activeView;

  // The AR Toothbrush Battle keeps its countdown timer, rhythm music and
  // camera/mic sensors running in module-level state that isn't tied to the
  // Battle view's DOM (see BattleView.js's stopBattleSensorsAndTimers). If the
  // player navigates away without tapping Quit, none of that stops on its
  // own -- the timer keeps ticking and the music keeps playing behind
  // whatever screen they're now on. Catch that the instant we're about to
  // render a different view.
  const wasOnBattleView = lastActiveViewForBattleCleanup === 'battle' || lastActiveViewForBattleCleanup === 'ar_battle';
  const isLeavingBattleView = wasOnBattleView && activeView !== 'battle' && activeView !== 'ar_battle';
  if (isLeavingBattleView) {
    abandonBattleIfRunning();
  }
  lastActiveViewForBattleCleanup = activeView;

  // Check if this device has been revoked by a household parent
  const myDeviceId = (typeof localStorage !== 'undefined') ? localStorage.getItem('stitch_device_id') : null;
  const isRevoked = Boolean(
    state.isDeviceRevoked === true ||
    (myDeviceId && (
      state.devices?.[myDeviceId]?.revoked === true ||
      (Array.isArray(state.revokedDeviceIds) && state.revokedDeviceIds.includes(myDeviceId))
    ))
  );

  // Auto-heal active household devices if valid household signals exist locally AND not revoked
  const isExistingHouseholdDevice = !isRevoked && isExistingActiveHousehold(state);

  if ((!state.isAuthenticated || !state.isHouseholdConfigured) && isExistingHouseholdDevice) {
    state.isAuthenticated = true;
    state.isHouseholdConfigured = true;
    state.householdSetupStep = 'ready';
    if (!state.household.syncCode || state.household.syncCode.trim().length < 4) {
      state.household.syncCode = (state.household?.syncCode || '').trim().toUpperCase() || 'HERO-8842';
    }
  } else if (isRevoked) {
    state.isAuthenticated = false;
    state.isHouseholdConfigured = false;
    state.householdSetupStep = 'auth';
    state.isDeviceRevoked = true;
    if (state.household) {
      state.household.syncCode = '';
    }
  }

  // Auth Readiness Gate:
  // If user is unauthenticated and Firebase Auth is still asynchronously checking cached
  // Google sessions / redirect results, display a momentary Rex loading splash instead of
  // prematurely flashing the Google Login landing modal.
  if ((!state.isAuthenticated || !state.isHouseholdConfigured) && !state.isAuthReady && isFirebaseAvailable) {
    app.innerHTML = `
      <div class="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in font-body">
        <div class="relative mb-5">
          <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-primary via-emerald-500 to-teal-400 p-1 shadow-xl shadow-primary/30 flex items-center justify-center animate-bounce">
            <span class="text-4xl sm:text-5xl" role="img" aria-label="Rex">🦖</span>
          </div>
          <span class="absolute -bottom-2 -right-2 bg-amber-400 text-slate-950 font-headline font-black text-[10px] px-2.5 py-0.5 rounded-full border-2 border-slate-900 shadow">
            CONNECTING
          </span>
        </div>
        <h2 class="font-headline text-xl sm:text-2xl font-black text-white tracking-tight">
          Opening Little Hero Adventures...
        </h2>
        <p class="text-xs sm:text-sm text-slate-400 mt-1 font-bold max-w-xs">
          Waking up Rex and restoring your family headquarters...
        </p>
        <div class="mt-6 w-32 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full animate-pulse w-full"></div>
        </div>
      </div>
    `;
    return;
  }

  // Strict Auth Wall Gate:
  // If user is unauthenticated OR household has not been configured/joined yet,
  // strictly render the Landing Auth Wall so that NO stranger's data is displayed!
  if (!state.isAuthenticated || !state.isHouseholdConfigured) {
    app.innerHTML = `
      <div class="min-h-screen bg-background text-on-surface flex flex-col font-body selection:bg-primary selection:text-on-primary">
        ${renderLandingAuthModal()}
      </div>
    `;
    attachLandingAuthModalListeners();
    return;
  }

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
    case 'pet_sanctuary':
    case 'pet-sanctuary':
    case 'pet_pen':
    case 'pet-pen':
      mainContent = renderPetSanctuaryView();
      attachViewListeners = attachPetSanctuaryListeners;
      break;
    case 'dino_workout':
      mainContent = renderDinoWorkoutView();
      attachViewListeners = attachDinoWorkoutListeners;
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
    case 'pet_locker':
      mainContent = renderPetLockerView();
      attachViewListeners = attachPetLockerListeners;
      break;
    case 'adventures_map':
    case 'learn':
    case '/learn':
      mainContent = renderAdventuresMapView();
      attachViewListeners = attachAdventuresMapListeners;
      break;
    case 'shop':
      mainContent = renderShopView();
      attachViewListeners = attachShopListeners;
      break;
    case 'battle':
    case 'ar_battle':
    case 'boost':
    case '/boost':
      mainContent = renderBattleView();
      attachViewListeners = attachBattleListeners;
      break;
    case 'evolution':
      mainContent = renderPetSanctuaryView();
      attachViewListeners = attachPetSanctuaryListeners;
      break;
    case 'dance_party':
      mainContent = renderDancePartyView();
      attachViewListeners = attachDancePartyListeners;
      break;
    case 'profile':
      mainContent = renderProfileView();
      attachViewListeners = attachProfileListeners;
      break;
    case 'hero_hq':
      mainContent = renderHeroHQView();
      attachViewListeners = attachHeroHQListeners;
      break;
    case 'hero_forge':
    case 'hero-forge':
      mainContent = renderHeroForgeView();
      attachViewListeners = attachHeroForgeListeners;
      break;
    case 'parent_portal':
      if (!store.isParentUnlocked()) {
        store.state.activeView = 'dashboard';
        mainContent = renderDashboardView();
        attachViewListeners = attachDashboardListeners;
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
      ${renderPetSelectionModal()}
      ${renderPetLockerModal()}
      ${renderMysterySurpriseModal()}
      ${renderLiveRexWidget()}
      ${renderGiftCrateWidget()}
      ${renderGiftCrateModal()}
    </div>
  `;

  // Attach All Component Listeners
  attachTopHeaderListeners();
  attachBottomNavListeners();
  attachRewardModalListeners();
  attachParentLockListeners();
  attachHouseholdLinkModalListeners();
  attachPetSelectionModalListeners();
  attachPetLockerModalListeners();
  attachMysterySurpriseModalListeners();
  attachLiveRexWidgetListeners();
  attachGiftCrateListeners();
  attachViewListeners();
}

let lastRenderedView = null;
let activeTransition = null;

function handleStateUpdate() {
  const currentView = store.getState().activeView;
  const isViewChange = lastRenderedView !== null && lastRenderedView !== currentView;
  lastRenderedView = currentView;

  // Only animate top-level full-screen view transitions (e.g. Dashboard <-> Quests <-> Pet Sanctuary)
  // For standard reactive state updates (coins, streak, ticks, modal toggles), render directly
  if (
    isViewChange &&
    typeof document.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    // If a previous view transition is still in progress, skip it safely
    if (activeTransition && typeof activeTransition.skipTransition === 'function') {
      try {
        activeTransition.skipTransition();
      } catch {
        // Ignore skip errors
      }
    }

    try {
      const transition = document.startViewTransition(() => {
        renderApp();
      });
      activeTransition = transition;

      // Handle transition promises to catch "Transition was skipped" rejections gracefully
      if (transition) {
        if (transition.ready) {
          transition.ready.catch(() => {
            // Handled: Transition was skipped or aborted
          });
        }
        if (transition.finished) {
          transition.finished
            .catch(() => {
              // Handled: Transition was skipped or superseded by a newer transition
            })
            .finally(() => {
              if (activeTransition === transition) {
                activeTransition = null;
              }
            });
        }
      }
      return;
    } catch {
      // Fallback to direct render if startViewTransition throws
    }
  }

  renderApp();
}

// Global Keyboard Escape handler for modals (Modern Web Baseline)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    store.closeReward();
    window.dispatchEvent(new CustomEvent('close-parent-lock'));
    window.dispatchEvent(new CustomEvent('close-household-modal'));
    if (store.getState().liveRex?.isOpen) {
      store.toggleLiveRexModal(false);
      if (geminiLiveService.isActive) {
        geminiLiveService.disconnect();
      }
      rexEngine.stop();
      stopRex();
    }
  }
});

// Initial Listeners & Store Subscription
initTactileSoundEngine();
initParentLockModal();
initHouseholdModal();
store.subscribe(handleStateUpdate);

// Start Real-Time Live Multi-Device Sync on App Launch ONLY if household is configured
const activeHouseholdCode = store.getState().household.syncCode;
if (store.getState().isHouseholdConfigured && activeHouseholdCode) {
  firestoreSync.startSync(activeHouseholdCode);
  firestoreSync.syncNow().catch(() => {});
}

// Auto-resync when returning to the tab, gaining window focus, or coming online
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store.getState().isHouseholdConfigured) {
    firestoreSync.syncNow().catch(() => {});
  }
});

window.addEventListener('focus', () => {
  if (store.getState().isHouseholdConfigured) {
    firestoreSync.syncNow().catch(() => {});
  }
});

window.addEventListener('online', () => {
  const code = store.getState().household.syncCode;
  if (store.getState().isHouseholdConfigured && code) {
    firestoreSync.startSync(code);
    firestoreSync.syncNow().catch(() => {});
  }
});

// Route Resolver for /learn and /boost shortcuts
function resolveRouteFromUrl() {
  if (typeof window === 'undefined') return null;
  const path = (window.location.pathname || '').toLowerCase();
  const hash = (window.location.hash || '').toLowerCase().replace(/^#\/?/, '');
  if (path === '/learn' || path === 'learn' || hash === 'learn') {
    return 'adventures_map';
  }
  if (path === '/boost' || path === 'boost' || hash === 'boost') {
    return 'battle';
  }
  return null;
}

const initialRoute = resolveRouteFromUrl();
if (initialRoute && store.getState().activeView !== initialRoute) {
  store.navigate(initialRoute);
}

window.addEventListener('popstate', () => {
  const route = resolveRouteFromUrl();
  if (route && store.getState().activeView !== route) {
    store.navigate(route);
  }
});

// Initial Render
renderApp();

// Expose Live Rex Companion Service on window for convenient console testing
import('./services/heroAgentService.js').then(({ talkToRex, playRexVoice }) => {
  window.talkToRex = talkToRex;
  window.playRexVoice = playRexVoice;
  console.log('🦖 Rex the Dino Agent Service active! Test anytime in console: await talkToRex("Hello Rex!")');
});

