import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';

export function renderProfileView() {
  const state = store.getState();
  const currentHero = state.selectedHero;
  const heroes = state.heroes;

  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in">
      
      <!-- Top Navigation & Header -->
      <div class="flex items-center justify-between">
        <button id="profile-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm">
          <span class="material-symbols-outlined text-base">arrow_back</span> Back to Quests
        </button>
        <span class="text-xs font-black uppercase text-on-surface-variant">Profile Selection</span>
      </div>

      <div class="text-center flex flex-col items-center">
        <h1 class="font-headline text-3xl font-black text-primary drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
          Who's playing today?
        </h1>
        <p class="text-sm font-semibold text-on-surface-variant mt-1">Pick your adventurer or start a new quest!</p>
      </div>

      <!-- Hero Characters Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${heroes
          .map((h) => {
            const isSelected = currentHero.id === h.id;

            return `
            <button data-hero-id="${h.id}" class="select-hero-btn bg-surface-container rounded-3xl p-5 border-3 ${
              isSelected
                ? 'border-primary bg-surface-container-high shadow-[0_0_24px_rgba(84,233,138,0.35)] scale-102'
                : 'border-surface-container-highest hover:border-primary/50'
            } card-shadow flex flex-col items-center justify-center gap-3 transition-all active:scale-95 group relative overflow-hidden text-center">
              
              <!-- 3D Avatar Container -->
              <div class="w-28 h-28 rounded-full ${h.badgeBg} flex items-center justify-center shadow-inner border-4 border-surface-container-highest overflow-hidden">
                <img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" src="${h.avatar}" alt="${h.name}" />
              </div>

              <!-- Hero Name & Title -->
              <div class="flex flex-col items-center">
                <h2 class="font-headline text-2xl font-black text-on-surface leading-tight">${h.name}</h2>
                <span class="text-xs text-on-surface-variant font-bold">${h.role}</span>
              </div>

              <!-- Level Badge -->
              <div class="bg-surface-container-highest px-3 py-1 rounded-full flex items-center gap-1.5 border border-surface-container-low">
                <span class="material-symbols-outlined text-secondary text-sm" style="font-variation-settings: 'FILL' 1;">stars</span>
                <span class="font-headline text-xs font-black text-on-surface">Lvl ${h.level}</span>
              </div>

              <p class="text-[11px] text-outline font-semibold">${h.lastSeen}</p>

              <!-- Active Status Ribbon -->
              ${
                isSelected
                  ? `
                <div class="w-full bg-primary text-on-primary text-[10px] font-black uppercase py-1.5 rounded-xl mt-1">
                  Active Hero
                </div>
              `
                  : `
                <div class="w-full bg-surface-container-high text-on-surface-variant group-hover:text-primary text-[10px] font-black uppercase py-1.5 rounded-xl mt-1 transition-colors">
                  Select
                </div>
              `
              }
            </button>
          `;
          })
          .join('')}
      </div>

      <!-- Add New Hero / Parent Portal Quick Gate -->
      <div class="flex justify-center pt-2">
        <button id="profile-parent-portal-btn" class="bg-surface-container-high hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-6 py-3.5 rounded-2xl border-2 border-dashed border-outline-variant flex items-center gap-2 chunky-btn-sm">
          <span class="material-symbols-outlined text-xl">shield_person</span>
          <span>Open Parent Portal</span>
        </button>
      </div>

    </div>
  `;
}

export function attachProfileListeners() {
  const backBtn = document.getElementById('profile-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate(store.getState().previousView || 'dashboard');
    });
  }

  const parentBtn = document.getElementById('profile-parent-portal-btn');
  if (parentBtn) {
    parentBtn.addEventListener('click', () => {
      Sound.click();
      window.dispatchEvent(new CustomEvent('open-parent-modal'));
    });
  }

  document.querySelectorAll('.select-hero-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hId = btn.getAttribute('data-hero-id');
      if (hId) {
        store.switchHero(hId);
      }
    });
  });
}
