import { store } from '../state/store.js';
import { PETS_DATABASE } from '../data/petsData.js';
import { Sound } from '../audio/sfx.js';

let activeElementFilter = 'All';

export function renderPetRosterView() {
  const state = store.getState();
  const hero = state.selectedHero;
  const activePetId = hero.activePetId || (hero.unlockedPetIds?.[0] || 1);
  const unlockedIds = hero.unlockedPetIds || [];
  const habitatSlots = hero.habitatSlots || Math.max(1, unlockedIds.length);
  const hasOpenSlot = unlockedIds.length < habitatSlots;

  const elements = ['All', 'Fire', 'Water', 'Earth', 'Air', 'Nature'];

  const filteredPets =
    activeElementFilter === 'All'
      ? PETS_DATABASE
      : PETS_DATABASE.filter((p) => p.element.toLowerCase().includes(activeElementFilter.toLowerCase()));

  return `
    <div class="max-w-5xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-5 animate-fade-in">
      
      <!-- Header -->
      <div class="flex items-center justify-between">
        <button id="roster-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm">
          <span class="material-symbols-outlined text-base">arrow_back</span> Back to Pen
        </button>
        <div class="flex flex-col items-end">
          <h1 class="font-headline text-2xl font-black text-inverse-surface text-shadow">The 24 Pet Roster</h1>
          <span class="text-xs font-bold text-primary">${unlockedIds.length} of 24 Companions Unlocked</span>
        </div>
      </div>

      <!-- Habitat Slots Management Card -->
      <div class="bg-surface-container rounded-3xl p-4 sm:p-5 border-2 border-primary/40 card-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-secondary/20 text-secondary border border-secondary/40 flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">holiday_village</span>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="font-headline text-base sm:text-lg font-black text-inverse-surface">
                Companion Habitat: ${unlockedIds.length} / ${habitatSlots} Slots Occupied
              </h2>
              ${
                hasOpenSlot
                  ? `<span class="bg-primary/20 text-primary text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-primary/40 animate-pulse">✨ ${
                      habitatSlots - unlockedIds.length
                    } Open Slot Available</span>`
                  : `<span class="bg-surface-container-highest text-on-surface-variant text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full">All Slots Occupied</span>`
              }
            </div>
            <p class="text-xs text-on-surface-variant mt-0.5">
              ${
                unlockedIds.length < 3
                  ? 'Evolve your pets to Stage 2 and Stage 4 to earn your 3 free companions! Extra slots cost Habit Coins.'
                  : 'Unlock additional Habitat Slots for 250 Habit Coins (🪙) each to expand your sanctuary.'
              }
            </p>
          </div>
        </div>

        <button id="buy-habitat-slot-btn" class="bg-gradient-to-r from-secondary to-primary text-on-secondary font-headline text-xs font-black px-4 py-3 rounded-2xl chunky-btn border-secondary-container shadow-sm flex items-center gap-1.5 active:scale-95 flex-shrink-0">
          <span class="material-symbols-outlined text-base">add_home</span>
          <span>+ Habitat Slot (🪙 250)</span>
        </button>
      </div>

      <!-- Element Filter Badges -->
      <div class="flex gap-2 overflow-x-auto pb-1">
        ${elements
          .map((elem) => {
            const isActive = activeElementFilter === elem;
            return `
            <button data-elem="${elem}" class="elem-filter-btn px-4 py-2 rounded-2xl font-headline text-xs font-black whitespace-nowrap transition-all ${
              isActive
                ? 'bg-primary text-on-primary chunky-btn-sm border-primary-container shadow-sm'
                : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border border-surface-container-highest'
            }">
              ${elem}
            </button>
          `;
          })
          .join('')}
      </div>

      <!-- 24 Pets Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        ${filteredPets
          .map((pet) => {
            const isUnlocked = unlockedIds.includes(pet.id);
            const isEquipped = activePetId === pet.id;
            const stage = state.petStageMap[pet.id] || hero.petStageMap?.[pet.id] || 1;

            return `
            <div data-pet-card-id="${pet.id}" class="pet-roster-card bg-surface-container rounded-3xl p-4 border-3 ${
              isEquipped
                ? 'border-primary bg-surface-container-high shadow-[0_0_20px_rgba(84,233,138,0.3)]'
                : isUnlocked
                ? 'border-surface-container-highest hover:border-primary/50'
                : 'border-surface-container-highest/60 opacity-85 hover:opacity-100'
            } card-shadow flex flex-col items-center justify-between gap-3 cursor-pointer group relative overflow-hidden text-center transition-transform active:scale-95">
              
              <!-- Stage / Status Ribbon -->
              <div class="w-full flex justify-between items-center text-[10px] font-black uppercase">
                ${
                  isUnlocked
                    ? `<span class="text-primary bg-primary/15 px-2 py-0.5 rounded-full border border-primary/30">Stage ${stage}/4</span>`
                    : `<span class="text-on-surface-variant bg-surface-container-lowest px-2 py-0.5 rounded-full border border-surface-container-highest">🔒 Locked</span>`
                }
                ${isEquipped ? `<span class="text-secondary bg-secondary/20 px-2 py-0.5 rounded-full font-black border border-secondary/40">Active</span>` : ''}
              </div>

              <!-- Avatar Stage -->
              <div class="w-24 h-24 rounded-full bg-gradient-to-tr from-surface-container-low to-surface-container-highest flex items-center justify-center p-2 shadow-inner border-2 ${
                isUnlocked ? 'border-primary/40' : 'border-surface-container-highest grayscale contrast-75'
              } relative">
                <img class="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-md" src="${pet.avatar}" alt="${pet.name}" />
              </div>

              <!-- Pet Info -->
              <div class="flex flex-col items-center">
                <h3 class="font-headline text-base font-black text-inverse-surface leading-tight">${pet.name}</h3>
                <span class="text-[11px] font-bold text-on-surface-variant mt-0.5">${pet.title}</span>
                <span class="text-[10px] font-black uppercase tracking-wider text-secondary mt-1">${pet.element}</span>
              </div>

              <!-- Action Buttons -->
              <div class="w-full flex flex-col gap-1.5" onclick="event.stopPropagation();">
                ${
                  isEquipped
                    ? `
                  <div class="w-full bg-primary/20 text-primary font-headline text-[10px] font-black py-2 rounded-xl border border-primary/40">
                    ✓ Active Companion
                  </div>
                `
                    : isUnlocked
                    ? `
                  <button data-equip-pet-id="${pet.id}" class="equip-roster-pet-btn w-full bg-primary text-on-primary font-headline text-[11px] font-black py-2 rounded-xl chunky-btn-sm border-primary-container shadow-sm hover:brightness-110 active:scale-95">
                    Equip Companion
                  </button>
                `
                    : hasOpenSlot
                    ? `
                  <button data-adopt-pet-id="${pet.id}" class="adopt-roster-pet-btn w-full bg-gradient-to-r from-primary to-secondary text-on-primary font-headline text-[11px] font-black py-2 rounded-xl chunky-btn-sm border-primary-container shadow-sm hover:brightness-110 active:scale-95 flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-sm">pets</span> Adopt (Slot Open!)
                  </button>
                `
                    : `
                  <button data-buy-adopt-pet-id="${pet.id}" class="buy-adopt-roster-pet-btn w-full bg-surface-container-high hover:bg-secondary text-secondary hover:text-on-secondary font-headline text-[11px] font-black py-2 rounded-xl border border-secondary/40 transition-colors flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-sm">add_home</span> Unlock Slot (🪙 250)
                  </button>
                `
                }

                <button data-inspect-pet-id="${pet.id}" class="inspect-roster-pet-btn w-full bg-surface-container-high hover:bg-surface-bright text-on-surface-variant font-headline text-[10px] font-bold py-1 rounded-xl border border-surface-container-lowest transition-colors">
                  View Lore & Stats
                </button>
              </div>

            </div>
          `;
          })
          .join('')}
      </div>

    </div>
  `;
}

export function attachPetRosterListeners() {
  const backBtn = document.getElementById('roster-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => store.navigate('pet_pen'));
  }

  // Buy Habitat Slot Button
  const buySlotBtn = document.getElementById('buy-habitat-slot-btn');
  if (buySlotBtn) {
    buySlotBtn.addEventListener('click', () => {
      Sound.click();
      store.buyHabitatSlot();
    });
  }

  // Element Filters
  document.querySelectorAll('.elem-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeElementFilter = btn.getAttribute('data-elem') || 'All';
      Sound.click();
      store.notify();
    });
  });

  // Equip Unlocked Pet
  document.querySelectorAll('.equip-roster-pet-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const petId = Number(btn.getAttribute('data-equip-pet-id'));
      if (petId) store.setActivePet(petId);
    });
  });

  // Adopt Pet into Open Slot
  document.querySelectorAll('.adopt-roster-pet-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const petId = Number(btn.getAttribute('data-adopt-pet-id'));
      if (petId) store.adoptPetIntoSlot(petId);
    });
  });

  // Buy Slot & Adopt Pet
  document.querySelectorAll('.buy-adopt-roster-pet-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const petId = Number(btn.getAttribute('data-buy-adopt-pet-id'));
      if (petId) store.adoptPetIntoSlot(petId);
    });
  });

  // Card or Inspect Button Click -> Navigate to Pet Detail
  document.querySelectorAll('.pet-roster-card, .inspect-roster-pet-btn').forEach((el) => {
    el.addEventListener('click', () => {
      const petId = Number(el.getAttribute('data-pet-card-id') || el.getAttribute('data-inspect-pet-id'));
      if (petId) {
        Sound.click();
        store.navigate('pet_detail', { petId });
      }
    });
  });
}
