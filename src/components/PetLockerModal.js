import { store } from '../state/store.js';
import { PETS_DATABASE } from '../data/petsData.js';
import { Sound } from '../audio/sfx.js';
import { speakRex } from '../services/voiceService.js';

export const PET_GEAR_CATALOG = {
  hat: [
    {
      id: 'wizard_hat',
      title: 'Enchanted Wizard Hat',
      icon: 'auto_fix_high',
      emoji: '🧙‍♂️',
      perk: '+10% Joy Retention',
      desc: 'Magical wisdom keeps your companion joyful throughout long play days.'
    },
    {
      id: 'golden_crown',
      title: 'Golden Horn Crown',
      icon: 'military_tech',
      emoji: '👑',
      perk: '+25% XP Boost',
      desc: 'Regal titanium crown multiplying task experience points.'
    },
    {
      id: 'knight_visor',
      title: 'Knight Visor Helm',
      icon: 'shield',
      emoji: '🪖',
      perk: '+15% Armor Defense',
      desc: 'Tough silver helm protecting pets during Sugar Bug AR battles.'
    },
    {
      id: 'dino_cap',
      title: 'Dino Spiked Cap',
      icon: 'sports_motorsports',
      emoji: '🧢',
      perk: '+10% Energy Speed',
      desc: 'Sporty green cap boosting companion walking and play speed.'
    }
  ],
  cape: [
    {
      id: 'hero_cape',
      title: 'Bright Blue Hero Cape',
      icon: 'flight',
      emoji: '🦸',
      perk: '+20% Speed & Energy',
      desc: 'Flowing blue satin cape helping pets zip across the sanctuary.'
    },
    {
      id: 'solar_wings',
      title: 'Solar Wing Spikes',
      icon: 'air',
      emoji: '🪽',
      perk: '2x Flight Mini-Game Speed',
      desc: 'Gleaming feather wings granting super sonic flight glide.'
    },
    {
      id: 'starlight_glide',
      title: 'Starlight Glide Cape',
      icon: 'flare',
      emoji: '✨',
      perk: '+10% Extra Coin Drops',
      desc: 'Woven with cosmic stardust that shakes loose bonus shiny coins.'
    },
    {
      id: 'rainbow_wings',
      title: 'Rainbow Cloud Wings',
      icon: 'filter_drama',
      emoji: '🌈',
      perk: '+15% Cleanliness Guard',
      desc: 'Soft fluffy cloud wings that stay clean through mud and puddles.'
    }
  ],
  aura: [
    {
      id: 'sparkle_aura',
      title: 'Sparkling Starlight Aura',
      icon: 'stars',
      emoji: '🌟',
      perk: '+5 Bonus Tokens on Chores',
      desc: 'Swirling star particles reward extra tokens upon chore verification.'
    },
    {
      id: 'flame_core',
      title: 'Blazing Flame Core',
      icon: 'local_fire_department',
      emoji: '🔥',
      perk: '+15% Habit Coin Drops',
      desc: 'Fiery glowing warmth boosting habit streak coin multipliers.'
    },
    {
      id: 'nature_shimmer',
      title: 'Emerald Nature Shimmer',
      icon: 'eco',
      emoji: '🌿',
      perk: '+10% Hygiene Protection',
      desc: 'Fresh herbal scent that keeps bath suds sparkling longer.'
    },
    {
      id: 'void_pulse',
      title: 'Cosmic Void Pulse',
      icon: 'dark_mode',
      emoji: '🌌',
      perk: '+20% Joy from Hugs',
      desc: 'Mystic nebula rings radiating deep warmth during snuggle hugs.'
    }
  ]
};

let activeTab = 'hat'; // 'hat', 'cape', 'aura'

export function renderPetLockerModal() {
  const state = store.getState();
  const modal = state.petLockerModal;

  if (!modal || !modal.isOpen) return '';

  const hero = state.selectedHero;
  const unlockedIds = hero?.unlockedPetIds && hero.unlockedPetIds.length > 0
    ? hero.unlockedPetIds
    : [hero?.activePetId || 1];

  const petId = modal.petId || hero?.activePetId || unlockedIds[0] || 1;
  const pet = state.pets?.find((p) => p.id === petId) || PETS_DATABASE.find((p) => p.id === petId) || PETS_DATABASE[0];
  const stage = state.petStageMap?.[petId] || 1;
  const petImg = stage >= 3 && pet.evolvedAvatar ? pet.evolvedAvatar : pet.avatar;

  const equipped = store.getEquippedPetGearSlots(petId);
  const itemsInTab = PET_GEAR_CATALOG[activeTab] || [];

  return `
    <div id="pet-locker-backdrop" class="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-fade-in select-none">
      <div class="bg-surface-container border-4 border-amber-500/50 rounded-3xl p-5 sm:p-6 max-w-3xl w-full max-h-[92vh] card-shadow-lg flex flex-col gap-4 relative overflow-hidden">
        
        <!-- Header -->
        <div class="flex items-center justify-between border-b-2 border-surface-container-highest pb-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-on-primary flex items-center justify-center text-2xl shadow-md flex-shrink-0">
              <span class="material-symbols-outlined text-3xl text-black">checkroom</span>
            </div>
            <div>
              <h2 class="font-headline text-lg sm:text-xl font-black text-inverse-surface flex items-center gap-2">
                Pet Dressing Room & Locker
                <span class="bg-amber-500/20 text-amber-400 text-xs font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-500/40">3-Slot Gear</span>
              </h2>
              <p class="text-xs font-bold text-on-surface-variant">
                Equip stylish hats, heroic capes, and sparkling glow auras for ${pet.name}!
              </p>
            </div>
          </div>

          <button id="pet-locker-close-btn" class="w-10 h-10 rounded-2xl bg-surface-container-highest hover:bg-surface-bright text-on-surface flex items-center justify-center transition-colors">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Companion Switcher (if child has multiple companions) -->
        ${unlockedIds.length > 1 ? `
          <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span class="text-xs font-black text-on-surface-variant uppercase tracking-wider whitespace-nowrap">Companion:</span>
            ${unlockedIds.map(uId => {
              const uPet = state.pets?.find(p => p.id === uId) || PETS_DATABASE.find(p => p.id === uId);
              const isCurrent = uId === petId;
              return `
                <button data-switch-pet="${uId}" class="px-3 py-1.5 rounded-xl font-headline text-xs font-black flex items-center gap-1.5 transition-all ${
                  isCurrent
                    ? 'bg-amber-500 text-black shadow-sm scale-105'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-bright'
                }">
                  <span>${uPet?.name || 'Companion'}</span>
                </button>
              `;
            }).join('')}
          </div>
        ` : ''}

        <!-- Dressing Room Layout (Left: Live Pet Preview, Right: Gear Selector) -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-y-auto">
          
          <!-- Left Column: Live Pet 3D Pedestal Stage -->
          <div class="md:col-span-5 bg-gradient-to-b from-[#18232c] via-[#121c24] to-[#0a131b] rounded-3xl p-4 border-2 border-amber-500/30 flex flex-col items-center justify-between relative overflow-hidden min-h-[260px]">
            
            <!-- Aura Glow Backlight if aura is equipped -->
            ${equipped.aura ? `
              <div class="absolute inset-0 bg-radial from-amber-400/25 via-primary/20 to-transparent animate-pulse pointer-events-none"></div>
            ` : `
              <div class="absolute inset-0 bg-radial from-primary/10 via-transparent to-transparent pointer-events-none"></div>
            `}

            <div class="w-full flex justify-between items-center z-10 text-[10px] font-black uppercase">
              <span class="text-amber-400 font-bold">${pet.name}</span>
              <span class="text-secondary">Stage ${stage}</span>
            </div>

            <!-- Pet Character & Gear Badges Overlay -->
            <div class="relative z-10 w-44 h-44 flex items-center justify-center animate-float my-1">
              <img class="w-full h-full object-contain drop-shadow-[0_15px_20px_rgba(0,0,0,0.8)]" src="${petImg}" alt="${pet.name}" />
              
              <!-- Floating Hat Emoji Overlay -->
              ${equipped.hat ? `
                <div class="absolute -top-1 text-3xl animate-bounce drop-shadow" title="${equipped.hat}">
                  ${(PET_GEAR_CATALOG.hat.find(h => h.title === equipped.hat)?.emoji) || '🎩'}
                </div>
              ` : ''}

              <!-- Floating Cape Emoji Overlay -->
              ${equipped.cape ? `
                <div class="absolute -right-2 top-10 text-3xl animate-pulse drop-shadow" title="${equipped.cape}">
                  ${(PET_GEAR_CATALOG.cape.find(c => c.title === equipped.cape)?.emoji) || '🦸'}
                </div>
              ` : ''}

              <!-- Floating Aura Emoji Overlay -->
              ${equipped.aura ? `
                <div class="absolute -left-2 top-10 text-3xl animate-spin-slow drop-shadow" title="${equipped.aura}">
                  ${(PET_GEAR_CATALOG.aura.find(a => a.title === equipped.aura)?.emoji) || '✨'}
                </div>
              ` : ''}
            </div>

            <!-- Pedestal Base -->
            <div class="w-40 h-4 bg-gradient-to-r from-surface-container-highest via-amber-500/40 to-surface-container-highest rounded-full border border-amber-500/40 shadow-sm z-10"></div>

            <!-- Equipped Slots Summary Pills -->
            <div class="w-full grid grid-cols-3 gap-1.5 z-10 mt-2">
              <div class="bg-surface-container-highest/80 p-1.5 rounded-xl text-center flex flex-col items-center">
                <span class="text-[9px] font-black text-on-surface-variant uppercase">Hat</span>
                <span class="text-[10px] font-bold text-amber-300 truncate max-w-full">${equipped.hat ? '✓ ' + equipped.hat.split(' ')[0] : 'None'}</span>
              </div>
              <div class="bg-surface-container-highest/80 p-1.5 rounded-xl text-center flex flex-col items-center">
                <span class="text-[9px] font-black text-on-surface-variant uppercase">Cape</span>
                <span class="text-[10px] font-bold text-secondary truncate max-w-full">${equipped.cape ? '✓ ' + equipped.cape.split(' ')[0] : 'None'}</span>
              </div>
              <div class="bg-surface-container-highest/80 p-1.5 rounded-xl text-center flex flex-col items-center">
                <span class="text-[9px] font-black text-on-surface-variant uppercase">Aura</span>
                <span class="text-[10px] font-bold text-primary truncate max-w-full">${equipped.aura ? '✓ ' + equipped.aura.split(' ')[0] : 'None'}</span>
              </div>
            </div>
          </div>

          <!-- Right Column: 3-Slot Tab Bar & Item Cards -->
          <div class="md:col-span-7 flex flex-col gap-3">
            
            <!-- Category Tabs -->
            <div class="grid grid-cols-3 gap-2 bg-surface-container-lowest p-1 rounded-2xl border border-surface-container-highest">
              <button data-slot-tab="hat" class="py-2.5 rounded-xl font-headline text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'hat'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-on-surface-variant hover:text-on-surface'
              }">
                <span class="material-symbols-outlined text-base">auto_fix_high</span> Hats / Helms
              </button>
              <button data-slot-tab="cape" class="py-2.5 rounded-xl font-headline text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'cape'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-on-surface-variant hover:text-on-surface'
              }">
                <span class="material-symbols-outlined text-base">flight</span> Capes & Wings
              </button>
              <button data-slot-tab="aura" class="py-2.5 rounded-xl font-headline text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'aura'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-on-surface-variant hover:text-on-surface'
              }">
                <span class="material-symbols-outlined text-base">stars</span> Glow Auras
              </button>
            </div>

            <!-- Items List for Active Tab -->
            <div class="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              ${itemsInTab.map((item) => {
                const isEquipped = equipped[activeTab] === item.title;
                return `
                  <div class="bg-surface-container-high p-3 rounded-2xl border-2 ${
                    isEquipped
                      ? 'border-amber-400 bg-amber-500/10 shadow-sm'
                      : 'border-surface-container-highest hover:border-surface-bright'
                  } flex items-center justify-between gap-3 transition-all">
                    
                    <div class="flex items-center gap-3">
                      <div class="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-2xl border border-surface-container-highest flex-shrink-0">
                        <span>${item.emoji}</span>
                      </div>
                      <div class="flex flex-col">
                        <div class="flex items-center gap-2">
                          <span class="font-headline text-sm font-black text-inverse-surface">${item.title}</span>
                          ${isEquipped ? `
                            <span class="bg-amber-500 text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-full">Equipped</span>
                          ` : ''}
                        </div>
                        <span class="text-xs font-black text-amber-400">${item.perk}</span>
                        <span class="text-[10px] font-bold text-on-surface-variant line-clamp-1">${item.desc}</span>
                      </div>
                    </div>

                    <button data-equip-item="${item.title}" data-slot="${activeTab}" class="px-4 py-2 rounded-xl font-headline text-xs font-black chunky-btn-sm flex-shrink-0 transition-all ${
                      isEquipped
                        ? 'bg-error/20 hover:bg-error/30 text-error border-2 border-error/40'
                        : 'bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-sm hover:brightness-110'
                    }">
                      ${isEquipped ? 'Unequip' : 'Equip'}
                    </button>
                  </div>
                `;
              }).join('')}
            </div>

          </div>

        </div>

      </div>
    </div>
  `;
}

export function attachPetLockerModalListeners() {
  const backdrop = document.getElementById('pet-locker-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        store.closePetLockerModal();
      }
    });
  }

  const closeBtn = document.getElementById('pet-locker-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      Sound.click();
      store.closePetLockerModal();
    });
  }

  // Tab switching
  const tabBtns = document.querySelectorAll('[data-slot-tab]');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      Sound.click();
      activeTab = btn.getAttribute('data-slot-tab');
      store.notify();
    });
  });

  // Companion switching
  const switchBtns = document.querySelectorAll('[data-switch-pet]');
  switchBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const newPetId = parseInt(btn.getAttribute('data-switch-pet'));
      Sound.click();
      store.openPetLockerModal(newPetId);
    });
  });

  // Equip / Unequip buttons
  const equipBtns = document.querySelectorAll('[data-equip-item]');
  equipBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemTitle = btn.getAttribute('data-equip-item');
      const slot = btn.getAttribute('data-slot');
      const state = store.getState();
      const petId = state.petLockerModal?.petId || store.getActivePet().id;

      store.equipPetSlotGear(petId, slot, itemTitle);
      speakRex("Look at that style! Your companion is looking heroic!");
    });
  });
}
