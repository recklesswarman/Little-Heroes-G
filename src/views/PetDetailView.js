import { store } from '../state/store.js';
import { getPetById, getPetArchetype, getPetLevelData, calculatePetStatBonus } from '../data/petsData.js';
import { Sound } from '../audio/sfx.js';

export function renderPetDetailView() {
  const state = store.getState();
  const hero = state.selectedHero || {};
  const petId = state.selectedPetDetailId || '1';
  const pet = getPetById(petId);
  const archetype = getPetArchetype(pet);
  const level = store.getPetLevel(pet.id);
  const levelData = getPetLevelData(level);
  const statBonus = calculatePetStatBonus(pet, level);
  const isEquipped = String(hero.activePetId || '1') === String(pet.id);
  const currentAvatar = pet.avatar || `assets/pets/${pet.key || 'rex'}.png`;
  const stats = (state.petStatsMap && state.petStatsMap[pet.id]) || { hunger: 75, hygiene: 85, energy: 90, joy: 80 };
  const exclusiveGear = pet.exclusiveGear || [
    { name: `${pet.name}'s Crest`, desc: `Empowers ${pet.name}'s signature moves`, icon: 'shield' }
  ];

  return `
    <div class="max-w-3xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-5 animate-fade-in select-none">
      
      <!-- Top Navigation -->
      <div class="flex items-center justify-between">
        <button id="pet-detail-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm min-h-[44px]">
          <span class="material-symbols-outlined text-base">arrow_back</span> Back to Roster
        </button>
        <div class="flex items-center gap-2">
          <span class="bg-primary/20 text-primary text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-primary/40">
            ✓ Available
          </span>
          <span class="text-xs font-black uppercase text-secondary tracking-wider">Companion #${pet.id}</span>
        </div>
      </div>

      <!-- Introduction Screen Header -->
      <div class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div class="flex flex-col">
          <span class="text-[10px] font-black uppercase tracking-widest text-primary flex items-center justify-center sm:justify-start gap-1">
            <span class="material-symbols-outlined text-sm">auto_awesome</span> ${archetype.name} • Level ${level} (${levelData.title})
          </span>
          <h1 class="font-headline text-2xl sm:text-3xl font-black text-inverse-surface text-shadow">${pet.name}</h1>
          <p class="text-sm font-bold text-secondary">${pet.title}</p>
        </div>

        <!-- Action Button -->
        <div>
          ${
            isEquipped
              ? `
            <div class="bg-primary/20 text-primary font-headline text-xs font-black px-5 py-3 rounded-2xl border-2 border-primary/40 flex items-center gap-1.5 shadow-sm min-h-[48px]">
              <span class="material-symbols-outlined text-lg">check_circle</span> CURRENT COMPANION
            </div>
          `
              : `
            <button id="pet-detail-equip-btn" class="bg-primary text-slate-950 font-headline text-xs font-black px-6 py-3.5 rounded-2xl chunky-btn border-b-2 border-[#1b7a43] shadow-md flex items-center gap-2 hover:brightness-110 active:scale-95 min-h-[48px]">
              <span class="material-symbols-outlined text-lg">pets</span> EQUIP AS COMPANION
            </button>
          `
          }
        </div>
      </div>

      <!-- Avatar Stage: Glowing 3D Pedestal with Floating Animation -->
      <div class="relative bg-gradient-to-b from-[#16212b] via-[#121d26] to-[#09141e] rounded-3xl p-6 border-4 border-surface-container-highest min-h-[300px] card-shadow flex flex-col items-center justify-center overflow-hidden">
        
        <!-- Glowing Pedestal Radial Aura -->
        <div class="absolute inset-0 bg-radial from-primary/20 via-transparent to-transparent pointer-events-none"></div>

        <!-- 3D Floating Pet Image -->
        <div class="relative z-10 w-52 h-52 flex items-center justify-center animate-float">
          <img 
            class="w-full h-full object-contain drop-shadow-[0_20px_20px_rgba(0,0,0,0.8)]" 
            src="${currentAvatar}" 
            alt="${pet.name}"
            loading="lazy"
            onerror="this.onerror=null; this.src='assets/pets/${pet.key || 'rex'}.png';"
          />
        </div>

        <!-- 3D Crystal Pedestal Base -->
        <div class="w-48 h-6 bg-gradient-to-r from-surface-container-highest via-surface-bright to-surface-container-highest rounded-full border-2 border-primary/40 shadow-[0_0_25px_rgba(84,233,138,0.3)] mt-2"></div>
      </div>

      <!-- Story Scroll: Dark Inset Text Box with Backstory -->
      <section class="bg-surface-container-lowest rounded-3xl p-5 border-2 border-surface-container-highest shadow-inner flex flex-col gap-2">
        <div class="flex items-center gap-2 text-secondary">
          <span class="material-symbols-outlined text-xl">menu_book</span>
          <h2 class="font-headline text-sm font-black uppercase tracking-wider">Whimsical Backstory</h2>
        </div>
        <p class="font-body text-sm font-medium text-on-surface leading-relaxed italic">
          "${pet.backstory}"
        </p>
      </section>

      <!-- Habit Bonus Badge -->
      <div class="bg-gradient-to-r from-primary-container/20 to-primary/10 rounded-3xl p-4 border-2 border-primary/40 shadow-sm flex items-center gap-3.5">
        <div class="w-12 h-12 rounded-2xl bg-primary text-slate-950 flex items-center justify-center flex-shrink-0 shadow-md">
          <span class="material-symbols-outlined text-2xl">military_tech</span>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] font-black uppercase text-primary tracking-wider">Unique Habit Buff • ${statBonus.label}</span>
          <span class="font-headline text-sm font-black text-inverse-surface">${pet.habitBonus || 'Bravery Boost: +10% Quest XP'}</span>
        </div>
      </div>

      <!-- Base Stats Panel (Hunger, Hygiene, Energy, Joy) -->
      <section class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col gap-3.5">
        <h2 class="font-headline text-xs font-black uppercase text-on-surface-variant tracking-wider">Companion Base Vitals</h2>
        
        <div class="grid grid-cols-2 gap-3.5">
          <!-- Hunger -->
          <div class="bg-surface-container-high p-3 rounded-2xl border border-surface-container-highest flex flex-col gap-1">
            <div class="flex justify-between items-center text-xs font-bold">
              <span class="text-error flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">restaurant</span> Hunger
              </span>
              <span class="text-inverse-surface font-black">${stats.hunger}%</span>
            </div>
            <div class="w-full h-3 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
              <div class="h-full bg-error rounded-full" style="width: ${stats.hunger}%;"></div>
            </div>
          </div>

          <!-- Hygiene -->
          <div class="bg-surface-container-high p-3 rounded-2xl border border-surface-container-highest flex flex-col gap-1">
            <div class="flex justify-between items-center text-xs font-bold">
              <span class="text-tertiary flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">water_drop</span> Hygiene
              </span>
              <span class="text-inverse-surface font-black">${stats.hygiene}%</span>
            </div>
            <div class="w-full h-3 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
              <div class="h-full bg-tertiary rounded-full" style="width: ${stats.hygiene}%;"></div>
            </div>
          </div>

          <!-- Energy -->
          <div class="bg-surface-container-high p-3 rounded-2xl border border-surface-container-highest flex flex-col gap-1">
            <div class="flex justify-between items-center text-xs font-bold">
              <span class="text-secondary flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">bolt</span> Energy
              </span>
              <span class="text-inverse-surface font-black">${stats.energy}%</span>
            </div>
            <div class="w-full h-3 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
              <div class="h-full bg-secondary rounded-full" style="width: ${stats.energy}%;"></div>
            </div>
          </div>

          <!-- Joy -->
          <div class="bg-surface-container-high p-3 rounded-2xl border border-surface-container-highest flex flex-col gap-1">
            <div class="flex justify-between items-center text-xs font-bold">
              <span class="text-primary flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">mood</span> Joy
              </span>
              <span class="text-inverse-surface font-black">${stats.joy}%</span>
            </div>
            <div class="w-full h-3 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
              <div class="h-full bg-primary rounded-full" style="width: ${stats.joy}%;"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- Exclusive Gear Showcase -->
      <section class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col gap-3.5">
        <div class="flex justify-between items-center">
          <h2 class="font-headline text-xs font-black uppercase text-on-surface-variant tracking-wider">Exclusive Gear Sets</h2>
          <span class="text-[11px] font-bold text-secondary">Tap any item to inspect</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          ${exclusiveGear
            .map((gear) => {
              return `
              <button data-gear-name="${gear.name}" data-gear-desc="${gear.desc}" class="gear-inspect-btn bg-surface-container-high hover:bg-surface-bright rounded-2xl p-3.5 border-2 border-surface-container-highest flex flex-col items-center justify-center gap-2 chunky-btn-sm text-center active:scale-95 min-h-[80px]">
                <div class="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center text-2xl shadow-inner text-secondary">
                  <span class="material-symbols-outlined text-2xl" style="font-variation-settings: 'FILL' 1;">${gear.icon || 'shield'}</span>
                </div>
                <span class="text-xs font-headline font-black text-inverse-surface leading-tight">${gear.name}</span>
                <span class="text-[10px] text-on-surface-variant line-clamp-1">${gear.desc}</span>
              </button>
            `;
            })
            .join('')}
        </div>
      </section>

    </div>
  `;
}

export function attachPetDetailListeners() {
  const backBtn = document.getElementById('pet-detail-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => store.navigate('pet_roster'));
  }

  const equipBtn = document.getElementById('pet-detail-equip-btn');
  if (equipBtn) {
    equipBtn.addEventListener('click', () => {
      const state = store.getState();
      store.setActivePet(state.selectedPetDetailId || '1');
      store.notify();
    });
  }

  document.querySelectorAll('.gear-inspect-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-gear-name');
      const desc = btn.getAttribute('data-gear-desc');
      Sound.click();
      store.showReward(`Exclusive Gear: ${name}`, desc, 0, 0);
    });
  });
}
