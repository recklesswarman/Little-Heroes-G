import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';

export function renderTopHeader() {
  const state = store.getState();
  const hero = state.selectedHero;
  const isMuted = Sound.isMuted();

  return `
    <header class="bg-surface/90 backdrop-blur-md font-headline docked sticky top-0 border-b-4 border-surface-container-highest shadow-chunky-sm flex justify-between items-center px-4 md:px-8 h-22 w-full z-40">
      <!-- Left: App Brand & Hero Avatar -->
      <div class="flex items-center gap-3">
        <button id="header-profile-btn" class="flex items-center gap-3 bg-surface-container hover:bg-surface-bright rounded-2xl p-1.5 pr-3.5 border-2 border-surface-container-highest chunky-btn-sm transition-all group">
          <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-primary bg-surface-variant flex items-center justify-center shadow-inner">
            <img class="w-full h-full object-cover group-hover:scale-105 transition-transform" src="${hero.avatar}" alt="${hero.name}" />
          </div>
          <div class="flex flex-col text-left">
            <span class="text-[10px] text-on-surface-variant font-black uppercase tracking-wider">${hero.title}</span>
            <span class="font-headline text-lg font-black text-secondary leading-tight">${hero.name}</span>
          </div>
          <span class="material-symbols-outlined text-sm text-on-surface-variant">expand_more</span>
        </button>
      </div>

      <!-- Right: Dual Currencies (Points ⭐ & Coins 🪙), Household Sync & Parent Gate -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Points (⭐) - Real-Life Reward Currency -->
        <div title="Gold Points: Used for Real-Life Rewards (Needs Parent Approval)" class="flex items-center bg-surface-container-high rounded-full px-3 py-1.5 border-2 border-tertiary-container/70 gap-1.5 shadow-sm">
          <span class="material-symbols-outlined text-tertiary text-xl" style="font-variation-settings: 'FILL' 1;">star</span>
          <span class="font-headline text-sm font-black text-tertiary">${hero.points || 0}</span>
        </div>

        <!-- Habit Coins (🪙) - In-App Game & Gear Currency -->
        <div title="Habit Coins: Earned from all in-app quests & games" class="flex items-center bg-surface-container-high rounded-full px-3.5 py-1.5 border-2 border-secondary-container/70 gap-1.5 shadow-sm">
          <span class="material-symbols-outlined text-secondary animate-coin text-xl" style="font-variation-settings: 'FILL' 1;">monetization_on</span>
          <span id="header-coins" class="font-headline text-sm font-black text-secondary">${hero.coins.toLocaleString()}</span>
        </div>

        <!-- Household Sync Button -->
        <button id="header-sync-btn" title="Household Device Link" class="bg-surface-container text-on-surface-variant rounded-xl w-10 h-10 chunky-btn-sm border-surface-container-low hover:bg-surface-bright active:scale-95 flex items-center justify-center transition-all">
          <span class="material-symbols-outlined text-xl text-primary" style="font-variation-settings: 'FILL' 1;">sync</span>
        </button>

        <!-- Sound Toggle Button -->
        <button id="header-sound-btn" title="Toggle Sound FX" class="bg-surface-container text-on-surface-variant rounded-xl w-10 h-10 chunky-btn-sm border-surface-container-low hover:bg-surface-bright active:scale-95 flex items-center justify-center transition-all">
          <span class="material-symbols-outlined text-xl ${isMuted ? 'text-error' : 'text-primary'}" style="font-variation-settings: 'FILL' 1;">
            ${isMuted ? 'volume_off' : 'volume_up'}
          </span>
        </button>

        <!-- Parent Gate Lock Button -->
        <button id="header-lock-btn" title="Parent Admin Portal" aria-label="Parent Portal" class="bg-surface-container-highest text-on-surface-variant rounded-xl w-10 h-10 chunky-btn-sm border-surface-container-low hover:bg-surface-bright hover:text-secondary active:scale-95 flex items-center justify-center transition-all">
          <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 1;">shield_person</span>
        </button>
      </div>
    </header>
  `;
}

export function attachTopHeaderListeners() {
  const profileBtn = document.getElementById('header-profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      store.navigate('profile');
    });
  }

  const syncBtn = document.getElementById('header-sync-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      Sound.click();
      window.dispatchEvent(new CustomEvent('open-household-modal'));
    });
  }

  const soundBtn = document.getElementById('header-sound-btn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      Sound.toggleMute();
      Sound.click();
      store.saveState();
    });
  }

  const lockBtn = document.getElementById('header-lock-btn');
  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate('parent_portal');
    });
  }
}
