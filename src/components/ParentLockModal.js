import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';

let isOpen = false;
let isUnlocked = false;

export function renderParentLockModal() {
  if (!isOpen) return '';

  return `
    <div id="parent-modal-backdrop" class="fixed inset-0 bg-background/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-surface-container border-4 border-surface-container-highest rounded-3xl p-6 max-w-md w-full card-shadow-lg flex flex-col gap-4 relative">
        
        <!-- Header -->
        <div class="flex justify-between items-center border-b-2 border-surface-container-highest pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary text-2xl" style="font-variation-settings: 'FILL' 1;">shield_person</span>
            <h2 class="font-headline text-xl font-black text-inverse-surface">Parent Quick Gate</h2>
          </div>
          <button id="parent-modal-close" class="text-on-surface-variant hover:text-error text-2xl p-1">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        ${
          !isUnlocked
            ? `
          <!-- Security Challenge -->
          <div class="flex flex-col items-center gap-4 py-4 text-center">
            <p class="text-sm font-semibold text-on-surface-variant">Adults Only: Solve the equation to access parental dashboard.</p>
            <div class="bg-surface-container-high px-6 py-3 rounded-2xl border-2 border-surface-container-highest text-2xl font-headline font-black text-primary">
              7 x 8 = ?
            </div>
            <div class="flex gap-2 w-full max-w-xs">
              <input id="parent-pin-input" type="number" placeholder="Answer" class="bg-surface-container-low border-2 border-surface-container-highest rounded-xl px-4 py-3 text-center text-lg font-bold text-inverse-surface w-full focus:outline-none focus:border-primary" />
              <button id="parent-pin-submit" class="bg-primary text-on-primary font-headline font-bold px-6 py-3 rounded-xl chunky-btn border-primary-container">
                Verify
              </button>
            </div>
            <p id="parent-pin-error" class="text-xs text-error font-bold hidden">Incorrect answer, please try again.</p>
          </div>
        `
            : `
          <!-- Parent Settings Dashboard -->
          <div class="flex flex-col gap-3 py-2">
            <div class="bg-surface-container-high p-4 rounded-2xl flex flex-col gap-2">
              <span class="font-headline text-sm font-bold text-inverse-surface">Full Admin Dashboard</span>
              <button id="parent-open-full-portal" class="bg-secondary text-on-secondary font-headline text-xs font-black py-3 rounded-xl chunky-btn border-secondary-container">
                Launch Full Parent Admin Portal →
              </button>
            </div>

            <div class="bg-surface-container-high p-4 rounded-2xl flex flex-col gap-2">
              <span class="font-headline text-sm font-bold text-inverse-surface">Reward Booster</span>
              <div class="flex gap-2">
                <button id="parent-add-coins" class="flex-1 bg-secondary-container/20 hover:bg-secondary-container/30 text-secondary text-xs font-bold py-2.5 px-3 rounded-xl border border-secondary-container/40 flex items-center justify-center gap-1">
                  <span class="material-symbols-outlined text-sm">add_circle</span> +100 Coins
                </button>
                <button id="parent-add-points" class="flex-1 bg-tertiary-container/20 hover:bg-tertiary-container/30 text-tertiary text-xs font-bold py-2.5 px-3 rounded-xl border border-tertiary-container/40 flex items-center justify-center gap-1">
                  <span class="material-symbols-outlined text-sm">star</span> +50 Points
                </button>
              </div>
            </div>

            <button id="parent-reset-data" class="bg-error/10 hover:bg-error/20 text-error border border-error/30 text-xs font-bold py-2.5 rounded-xl transition-colors">
              Reset Entire Game Save Data
            </button>
          </div>
        `
        }

      </div>
    </div>
  `;
}

export function initParentLockModal() {
  window.addEventListener('open-parent-modal', () => {
    isOpen = true;
    isUnlocked = false;
    store.notify();
  });
}

export function attachParentLockListeners() {
  const closeBtn = document.getElementById('parent-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      Sound.click();
      isOpen = false;
      isUnlocked = false;
      store.notify();
    });
  }

  const submitBtn = document.getElementById('parent-pin-submit');
  const input = document.getElementById('parent-pin-input');
  const errorMsg = document.getElementById('parent-pin-error');

  if (submitBtn && input) {
    const handleCheck = () => {
      if (input.value.trim() === '56' || input.value.trim() === '1234') {
        Sound.fanfare();
        isUnlocked = true;
        store.notify();
      } else {
        Sound.hit();
        if (errorMsg) errorMsg.classList.remove('hidden');
      }
    };

    submitBtn.addEventListener('click', handleCheck);
    input.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') handleCheck();
    });
  }

  const openPortalBtn = document.getElementById('parent-open-full-portal');
  if (openPortalBtn) {
    openPortalBtn.addEventListener('click', () => {
      isOpen = false;
      store.navigate('parent_portal');
    });
  }

  const addCoinsBtn = document.getElementById('parent-add-coins');
  if (addCoinsBtn) {
    addCoinsBtn.addEventListener('click', () => {
      Sound.coin();
      store.getState().selectedHero.coins += 100;
      store.saveState();
      isOpen = false;
      store.showReward('Coins Added', '+100 Bonus Coins credited!', 100, 0);
    });
  }

  const addPointsBtn = document.getElementById('parent-add-points');
  if (addPointsBtn) {
    addPointsBtn.addEventListener('click', () => {
      Sound.fanfare();
      store.getState().selectedHero.points += 50;
      store.saveState();
      isOpen = false;
      store.showReward('Points Added', '+50 Gold Points credited!', 0, 50);
    });
  }

  const resetDataBtn = document.getElementById('parent-reset-data');
  if (resetDataBtn) {
    resetDataBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all game progress?')) {
        Sound.click();
        store.resetAllProgress();
        isOpen = false;
      }
    });
  }
}
