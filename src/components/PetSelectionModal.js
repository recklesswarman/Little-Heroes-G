import { store } from '../state/store.js';
import { PETS_DATABASE } from '../data/petsData.js';
import { Sound } from '../audio/sfx.js';

let activeElementFilter = 'All';

export function renderPetSelectionModal() {
  const state = store.getState();
  const modal = state.petSelectionModal;

  if (!modal || !modal.isOpen) return '';

  const hero = state.selectedHero;
  const unlockedIds = hero.unlockedPetIds || [];
  const modalType = modal.type || 'starter'; // 'starter', 'second_pet', 'third_pet'

  // Filter out already unlocked pets for 2nd and 3rd pet choices
  const availablePets =
    modalType === 'starter'
      ? PETS_DATABASE
      : PETS_DATABASE.filter((p) => !unlockedIds.includes(p.id));

  const filteredPets =
    activeElementFilter === 'All'
      ? availablePets
      : availablePets.filter((p) => p.element.toLowerCase().includes(activeElementFilter.toLowerCase()));

  const elements = ['All', 'Fire', 'Water', 'Earth', 'Air', 'Nature'];

  let title = 'Choose Your First Companion!';
  let subtitle = 'Welcome, Little Hero! Choose your first magical pet to begin your journey. Your companion starts at Stage 1 (Mystic Egg)!';
  let badgeText = '✨ FREE STARTER COMPANION • STAGE 1';
  let badgeColor = 'bg-primary/20 text-primary border-primary/40';

  if (modalType === 'second_pet') {
    title = 'Choose Your 2nd Free Pet!';
    subtitle = 'Milestone Reached: Your first companion has evolved to Stage 2! Pick your 2nd free companion to join your hero team (starts at Stage 1).';
    badgeText = '🎉 STAGE 2 MILESTONE REWARD • 2ND FREE PET';
    badgeColor = 'bg-secondary/20 text-secondary border-secondary/40';
  } else if (modalType === 'third_pet') {
    title = 'Choose Your 3rd Free Pet!';
    subtitle = 'Master Titan Evolution: Both of your first two companions have evolved through all 4 stages! Choose your 3rd free companion (starts at Stage 1).';
    badgeText = '👑 TITAN EVOLUTION REWARD • 3RD FREE PET';
    badgeColor = 'bg-tertiary-container/30 text-tertiary border-tertiary-container/50';
  }

  return `
    <div id="pet-selection-backdrop" class="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-fade-in select-none">
      <div class="bg-surface-container border-4 border-primary/50 rounded-3xl p-5 sm:p-6 max-w-3xl w-full max-h-[92vh] card-shadow-lg flex flex-col gap-4 relative overflow-hidden">
        
        <!-- Header -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b-2 border-surface-container-highest pb-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center text-2xl shadow-md flex-shrink-0">
              <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">pets</span>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="font-headline text-lg sm:text-xl font-black text-inverse-surface">${title}</h2>
                <span class="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${badgeColor}">
                  ${badgeText}
                </span>
              </div>
              <p class="text-xs text-on-surface-variant font-medium mt-0.5">${subtitle}</p>
            </div>
          </div>

          ${
            modalType !== 'starter'
              ? `
            <button id="pet-selection-close-btn" class="text-on-surface-variant hover:text-error text-2xl p-1 active:scale-95 transition-transform" title="Dismiss">
              <span class="material-symbols-outlined">close</span>
            </button>
          `
              : ''
          }
        </div>

        <!-- Element Filter Chips -->
        <div class="flex gap-2 overflow-x-auto pb-1 flex-shrink-0">
          ${elements
            .map((elem) => {
              const isActive = activeElementFilter === elem;
              return `
              <button data-select-elem="${elem}" class="pet-select-elem-btn px-3 py-1.5 rounded-xl font-headline text-xs font-black whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-primary text-on-primary chunky-btn-sm border-primary-container shadow-sm'
                  : 'bg-surface-container-high hover:bg-surface-bright text-on-surface-variant border border-surface-container-highest'
              }">
                ${elem}
              </button>
            `;
            })
            .join('')}
        </div>

        <!-- Scrollable Pets Grid -->
        <div class="overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 flex-1 min-h-[300px]">
          ${filteredPets
            .map((pet) => {
              return `
              <div class="bg-surface-container-high rounded-2xl p-4 border-2 border-surface-container-highest hover:border-primary flex flex-col justify-between gap-3 text-center group transition-transform hover:-translate-y-1 card-shadow">
                
                <div class="flex flex-col items-center gap-2">
                  <!-- Stage 1 Pill & Element Tag -->
                  <div class="w-full flex justify-between items-center text-[10px] font-black uppercase">
                    <span class="bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/30">
                      Stage 1 (Egg/Baby)
                    </span>
                    <span class="text-secondary font-bold">${pet.element}</span>
                  </div>

                  <!-- Pet Avatar -->
                  <div class="w-24 h-24 rounded-full bg-surface-container-lowest border-2 border-surface-container-highest flex items-center justify-center p-2 shadow-inner group-hover:scale-105 transition-transform relative">
                    <img class="w-full h-full object-contain drop-shadow-md" src="${pet.avatar}" alt="${pet.name}" />
                  </div>

                  <!-- Name & Lore -->
                  <div>
                    <h3 class="font-headline text-base font-black text-inverse-surface">${pet.name}</h3>
                    <p class="text-[11px] font-bold text-secondary">${pet.title}</p>
                    <p class="text-[10px] text-on-surface-variant font-medium mt-1 line-clamp-2 italic">"${pet.backstory}"</p>
                  </div>

                  <!-- Habit Buff Tag -->
                  <div class="bg-surface-container px-2.5 py-1 rounded-xl border border-surface-container-highest text-[10px] font-bold text-primary w-full">
                    ⚡ ${pet.habitBonus}
                  </div>
                </div>

                <!-- Choose Pet Button -->
                <button data-choose-pet-id="${pet.id}" class="choose-pet-btn w-full bg-primary text-on-primary font-headline text-xs font-black py-2.5 px-3 rounded-xl chunky-btn border-primary-container shadow-sm hover:brightness-110 active:scale-95 flex items-center justify-center gap-1.5">
                  <span class="material-symbols-outlined text-base">pets</span>
                  <span>Adopt This Pet!</span>
                </button>

              </div>
            `;
            })
            .join('')}
        </div>

        <!-- Footer Guidance -->
        <div class="bg-surface-container-high rounded-2xl p-2.5 border border-surface-container-highest flex items-center justify-between text-[11px] text-on-surface-variant flex-shrink-0">
          <span class="flex items-center gap-1.5 font-bold">
            <span class="material-symbols-outlined text-sm text-primary">verified</span>
            All companions start at Stage 1 and grow into legendary Titans as you complete habits and AR battles!
          </span>
          <span class="font-black text-secondary uppercase">${filteredPets.length} Companions Available</span>
        </div>

      </div>
    </div>
  `;
}

export function attachPetSelectionModalListeners() {
  const closeBtn = document.getElementById('pet-selection-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      Sound.click();
      store.closePetSelectionModal();
    });
  }

  // Backdrop click to dismiss (only if not starter pet)
  const backdrop = document.getElementById('pet-selection-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        const modal = store.getState().petSelectionModal;
        if (modal && modal.type !== 'starter') {
          Sound.click();
          store.closePetSelectionModal();
        }
      }
    });
  }

  // Element Filters
  document.querySelectorAll('.pet-select-elem-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeElementFilter = btn.getAttribute('data-select-elem') || 'All';
      Sound.click();
      store.notify();
    });
  });

  // Choose Pet Action
  document.querySelectorAll('.choose-pet-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const petId = Number(btn.getAttribute('data-choose-pet-id'));
      const modal = store.getState().petSelectionModal;
      if (petId) {
        store.choosePet(petId, modal?.type || 'starter');
      }
    });
  });
}
