import { store } from '../state/store.js';
import { PETS_DATABASE, getPetArchetype, getPetLevelData, calculatePetStatBonus } from '../data/petsData.js';
import { Sound } from '../audio/sfx.js';

let activeArchetypeFilter = 'all';

export function renderPetRosterView() {
  const activePet = store.getActivePet();
  const activePetId = activePet ? String(activePet.id) : '1';

  const filterTabs = [
    { id: 'all', label: 'All (24)', icon: 'apps' },
    { id: 'dino', label: 'Dinos (8)', icon: 'cruelty_free' },
    { id: 'mystic', label: 'Mystics (5)', icon: 'auto_awesome' },
    { id: 'beast', label: 'Beasts (6)', icon: 'pets' },
    { id: 'aquatic', label: 'Aquatic (3)', icon: 'water' },
    { id: 'mech', label: 'Mechs (2)', icon: 'smart_toy' }
  ];

  const filteredPets =
    activeArchetypeFilter === 'all'
      ? PETS_DATABASE
      : PETS_DATABASE.filter((p) => (p.archetype || 'dino') === activeArchetypeFilter);

  return `
    <div class="max-w-5xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-5 animate-fade-in">
      
      <!-- Header -->
      <div class="flex items-center justify-between">
        <button id="roster-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm min-h-[44px]">
          <span class="material-symbols-outlined text-base">arrow_back</span> Back to Sanctuary
        </button>
        <div class="flex flex-col items-end">
          <h1 class="font-headline text-2xl font-black text-inverse-surface text-shadow">The 24 Pet Roster</h1>
          <span class="text-xs font-bold text-primary">All 24 Tactile Companions Ready</span>
        </div>
      </div>

      <!-- Habitat Overview Banner -->
      <div class="bg-surface-container rounded-3xl p-4 sm:p-5 border-2 border-primary/40 card-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-secondary/20 text-secondary border border-secondary/40 flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">holiday_village</span>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="font-headline text-base sm:text-lg font-black text-inverse-surface">
                Companion Sanctuary: 24 Hero Toys Available
              </h2>
              <span class="bg-primary/20 text-primary text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-primary/40">
                ✨ Level 1-25 Mastery
              </span>
            </div>
            <p class="text-xs text-on-surface-variant mt-0.5">
              Train each companion with daily healthy habits and active play to boost your hero coin and XP bonuses!
            </p>
          </div>
        </div>
      </div>

      <!-- Archetype Filter Pills -->
      <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        ${filterTabs
          .map((tab) => {
            const isActive = activeArchetypeFilter === tab.id;
            return `
            <button data-archetype="${tab.id}" class="archetype-filter-btn px-4 py-2 rounded-2xl font-headline text-xs font-black whitespace-nowrap transition-all min-h-[44px] inline-flex items-center justify-center gap-1.5 ${
              isActive
                ? 'bg-primary text-slate-950 font-black shadow-md'
                : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border border-surface-container-highest'
            }">
              <span class="material-symbols-outlined text-sm">${tab.icon}</span>
              <span>${tab.label}</span>
            </button>
          `;
          })
          .join('')}
      </div>

      <!-- 24 Pets Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        ${filteredPets
          .map((pet) => {
            const isEquipped = String(activePetId) === String(pet.id);
            const archetype = getPetArchetype(pet);
            const level = store.getPetLevel(pet.id);
            const levelData = getPetLevelData(level);
            const statBonus = calculatePetStatBonus(pet, level);
            const petImg = pet.avatar || `/assets/pets/${pet.key || 'rex'}.png`;

            return `
            <div data-pet-card-id="${pet.id}" class="pet-roster-card bg-surface-container rounded-3xl p-4 border-2 ${
              isEquipped
                ? 'border-primary bg-surface-container-high shadow-[0_0_20px_rgba(84,233,138,0.3)] ring-2 ring-primary/40'
                : 'border-surface-container-highest hover:border-primary/50'
            } card-shadow flex flex-col items-center justify-between gap-3 cursor-pointer group relative overflow-hidden text-center transition-transform active:scale-95">
              
              <!-- Level & Archetype Status Ribbon -->
              <div class="w-full flex justify-between items-center text-[10px] font-black uppercase">
                <span class="text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-400/30">
                  Lv.${level} • ${levelData.title}
                </span>
                ${isEquipped ? `<span class="text-slate-950 bg-primary px-2.5 py-0.5 rounded-full font-black shadow-sm">ACTIVE</span>` : `<span class="text-secondary bg-secondary/20 px-2 py-0.5 rounded-full border border-secondary/40">${archetype.name}</span>`}
              </div>

              <!-- Avatar 3D Toy Figurine Stage -->
              <div class="w-28 h-28 rounded-2xl bg-surface-container-lowest flex items-center justify-center p-2 shadow-inner border-2 ${
                isEquipped ? 'border-primary' : 'border-surface-container-highest'
              } relative">
                <img 
                  class="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-md" 
                  src="${petImg}" 
                  alt="${pet.name}"
                  loading="lazy"
                  onerror="this.onerror=null; this.src='/assets/pets/${pet.key || 'rex'}.png';"
                />
              </div>

              <!-- Pet Info -->
              <div class="flex flex-col items-center w-full">
                <h3 class="font-headline text-base font-black text-inverse-surface leading-tight truncate max-w-full">${pet.name}</h3>
                <span class="text-[11px] font-bold text-on-surface-variant mt-0.5 truncate max-w-full">${pet.title}</span>
                <span class="text-[10px] font-black text-emerald-400 mt-1">${statBonus.label} ${pet.habitBonus ? `• ${pet.habitBonus.split(':')[0]}` : ''}</span>
              </div>

              <!-- Action Buttons -->
              <div class="w-full flex flex-col gap-1.5" onclick="event.stopPropagation();">
                ${
                  isEquipped
                    ? `
                  <div class="w-full bg-primary/20 text-primary font-headline text-[11px] font-black py-2.5 rounded-xl border border-primary/40 min-h-[44px] flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-sm">check_circle</span> Active Companion
                  </div>
                `
                    : `
                  <button data-equip-pet-id="${pet.id}" class="equip-roster-pet-btn w-full bg-primary text-slate-950 font-headline text-[11px] font-black py-2.5 rounded-xl chunky-btn-sm border-b-2 border-[#1b7a43] shadow-sm hover:brightness-110 active:scale-95 min-h-[44px] flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-sm">pets</span> Equip Companion
                  </button>
                `
                }

                <button data-inspect-pet-id="${pet.id}" class="inspect-roster-pet-btn w-full bg-surface-container-high hover:bg-surface-bright text-on-surface-variant font-headline text-[10px] font-bold py-1.5 rounded-xl border border-surface-container-lowest transition-colors min-h-[38px] flex items-center justify-center">
                  View Lore & Moves
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
    backBtn.addEventListener('click', () => store.navigate('pet_sanctuary'));
  }

  // Archetype Filters
  document.querySelectorAll('.archetype-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeArchetypeFilter = btn.getAttribute('data-archetype') || 'all';
      Sound.click();
      store.notify();
    });
  });

  // Equip Pet
  document.querySelectorAll('.equip-roster-pet-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const petId = btn.getAttribute('data-equip-pet-id');
      if (petId) store.setActivePet(petId);
    });
  });

  // Card or Inspect Button Click -> Navigate to Pet Detail
  document.querySelectorAll('.pet-roster-card, .inspect-roster-pet-btn').forEach((el) => {
    el.addEventListener('click', () => {
      const petId = el.getAttribute('data-pet-card-id') || el.getAttribute('data-inspect-pet-id');
      if (petId) {
        Sound.click();
        store.navigate('pet_detail', { petId });
      }
    });
  });
}

