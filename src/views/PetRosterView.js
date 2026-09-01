import { store } from '../state/store.js';
import { PETS_DATABASE } from '../data/petsData.js';

let activeElementFilter = 'All';

export function renderPetRosterView() {
  const state = store.getState();
  const activePetId = state.selectedHero.activePetId || 1;

  const elements = ['All', 'Fire', 'Water', 'Earth', 'Air', 'Lightning', 'Tech'];

  const filteredPets =
    activeElementFilter === 'All'
      ? PETS_DATABASE
      : PETS_DATABASE.filter((p) => p.element.toLowerCase().includes(activeElementFilter.toLowerCase()));

  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in">
      
      <!-- Header -->
      <div class="flex items-center justify-between">
        <button id="roster-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm">
          <span class="material-symbols-outlined text-base">arrow_back</span> Back to Pen
        </button>
        <div class="flex flex-col items-end">
          <h1 class="font-headline text-2xl font-black text-inverse-surface text-shadow">The 24 Pet Roster</h1>
          <span class="text-xs font-bold text-primary">Discover Lore, Stats & Exclusive Gear</span>
        </div>
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
            const isEquipped = activePetId === pet.id;
            const stage = state.petStageMap[pet.id] || 1;

            return `
            <div data-pet-card-id="${pet.id}" class="pet-roster-card bg-surface-container rounded-3xl p-4 border-3 ${
              isEquipped
                ? 'border-primary bg-surface-container-high shadow-[0_0_20px_rgba(84,233,138,0.3)]'
                : 'border-surface-container-highest hover:border-primary/50'
            } card-shadow flex flex-col items-center justify-between gap-3 cursor-pointer group relative overflow-hidden text-center transition-transform active:scale-95">
              
              <!-- Stage Ribbon -->
              <div class="w-full flex justify-between items-center text-[10px] font-black uppercase">
                <span class="text-tertiary bg-surface-container-lowest px-2 py-0.5 rounded-full border border-surface-container-highest">Stage ${stage}/4</span>
                ${isEquipped ? `<span class="text-primary bg-primary/20 px-2 py-0.5 rounded-full font-black border border-primary/40">Active</span>` : ''}
              </div>

              <!-- Avatar Stage -->
              <div class="w-24 h-24 rounded-full bg-gradient-to-tr from-surface-container-low to-surface-container-highest flex items-center justify-center p-2 shadow-inner border-2 border-surface-container-highest relative">
                <img class="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-md" src="${pet.avatar}" alt="${pet.name}" />
              </div>

              <!-- Pet Info -->
              <div class="flex flex-col items-center">
                <h3 class="font-headline text-base font-black text-inverse-surface leading-tight">${pet.name}</h3>
                <span class="text-[11px] font-bold text-on-surface-variant mt-0.5">${pet.title}</span>
                <span class="text-[10px] font-black uppercase tracking-wider text-secondary mt-1">${pet.element}</span>
              </div>

              <!-- Inspect Button -->
              <button class="w-full bg-surface-container-high group-hover:bg-primary group-hover:text-on-primary text-on-surface-variant font-headline text-[11px] font-black py-2 rounded-xl border border-surface-container-low transition-colors">
                View Lore & Stats
              </button>
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

  document.querySelectorAll('.elem-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeElementFilter = btn.getAttribute('data-elem');
      store.notify();
    });
  });

  document.querySelectorAll('.pet-roster-card').forEach((card) => {
    card.addEventListener('click', () => {
      const petId = parseInt(card.getAttribute('data-pet-card-id'));
      store.navigate('pet_detail', { petId });
    });
  });
}
