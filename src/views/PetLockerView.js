import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import { speakRex } from '../services/voiceService.js';

let activeCategoryFilter = 'all';

export function renderPetLockerView() {
  const state = store.getState();
  const hero = state.selectedHero;
  const activePet = store.getActivePet();
  const equippedGear = store.getEquippedPetGear(activePet.id);
  const inventoryList = hero?.inventory || state.inventory || [];
  const coins = hero?.coins || 0;

  // Compile all available digital content
  const digitalGear = state.digitalGear || [];
  const petAccessories = (activePet.accessories || []).map(acc => ({
    id: 'acc_' + acc.name.toLowerCase().replace(/\s+/g, '_'),
    title: acc.name,
    desc: acc.desc,
    category: 'Pet Accessories',
    icon: acc.icon || 'shield',
    image: null,
    isUnlocked: acc.unlocked || inventoryList.includes(acc.name),
    statBonusPercent: 20,
    statBonusType: 'defense_boost'
  }));

  const shopDigitalItems = digitalGear.map(gear => ({
    id: gear.id,
    title: gear.title,
    desc: gear.desc,
    category: gear.category,
    icon: gear.icon || 'star',
    image: gear.image,
    isUnlocked: inventoryList.includes(gear.title),
    statBonusPercent: gear.statBonusPercent || 15,
    statBonusType: gear.statBonusType || 'coin_boost'
  }));

  // Combined content list
  const allDigitalContent = [...petAccessories, ...shopDigitalItems];

  // Deduplicate by title
  const uniqueContent = [];
  const seenTitles = new Set();
  for (const item of allDigitalContent) {
    if (!seenTitles.has(item.title)) {
      seenTitles.add(item.title);
      uniqueContent.push(item);
    }
  }

  // Filter based on selected category
  const filteredContent = uniqueContent.filter(item => {
    if (activeCategoryFilter === 'all') return true;
    if (activeCategoryFilter === 'equipped') return item.title === equippedGear;
    if (activeCategoryFilter === 'unlocked') return item.isUnlocked;
    if (activeCategoryFilter === 'accessories') return item.category === 'Pet Accessories' || item.category === 'Avatar Gear';
    if (activeCategoryFilter === 'badges') return item.category === 'Badges' || item.category === 'Weapons';
    return true;
  });

  return `
    <div class="max-w-4xl mx-auto px-4 pt-3 pb-28 flex flex-col gap-4 animate-fade-in select-none">
      
      <!-- Top Navigation Header -->
      <div class="flex items-center justify-between z-20">
        <button id="locker-exit-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95 shadow-sm">
          <span class="material-symbols-outlined text-base">arrow_back</span>
          <span>Back to Pet Pen</span>
        </button>

        <div class="flex items-center gap-3">
          <!-- Token Wallet -->
          <div class="bg-surface-container-high px-4 py-2 rounded-full border-2 border-secondary-container flex items-center gap-2 shadow-md">
            <span class="material-symbols-outlined text-secondary text-base">monetization_on</span>
            <span class="font-headline text-xs font-black text-inverse-surface">${coins} Tokens</span>
          </div>
        </div>
      </div>

      <!-- Active Companion Equipment Stage -->
      <section class="bg-gradient-to-b from-[#182838] via-[#121e2b] to-[#0a121a] rounded-3xl p-6 border-4 border-amber-500/40 card-shadow flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        
        <!-- Ambient Gold Glow -->
        <div class="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent pointer-events-none"></div>

        <!-- Left: Companion Stage Visual -->
        <div class="flex items-center gap-5 z-10">
          <div class="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl bg-gradient-to-b from-surface-container-high to-surface-container-lowest p-2 border-3 border-amber-500/50 flex items-center justify-center shadow-lg">
            <img class="w-full h-full object-contain animate-float drop-shadow-md" src="${activePet.avatar || activePet.image}" alt="${activePet.name}" />
            <div class="absolute -bottom-2 -right-2 bg-amber-500 text-on-primary text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow">
              Stage ${activePet.stage}
            </div>
          </div>

          <div class="flex flex-col">
            <span class="text-[10px] font-black uppercase text-amber-400 tracking-wider">Active Companion</span>
            <h2 class="font-headline text-2xl font-black text-inverse-surface">${activePet.name}</h2>
            <span class="text-xs text-on-surface-variant font-bold">${activePet.species || 'Hero Pet'} • ${activePet.element || 'Fire'} Element</span>
            
            <div class="mt-2 flex items-center gap-2">
              <span class="text-xs font-black text-secondary flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">favorite</span> Joy: ${activePet.joy}%
              </span>
              <span class="text-xs font-black text-tertiary flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">bolt</span> Energy: ${activePet.energy}%
              </span>
            </div>
          </div>
        </div>

        <!-- Right: Current Equipped Gear Box -->
        <div class="bg-surface-container-high/90 backdrop-blur-md rounded-2xl p-4 border-2 border-amber-500/40 flex flex-col items-center sm:items-start gap-2.5 z-10 w-full md:w-auto min-w-[240px]">
          <div class="flex justify-between items-center w-full">
            <span class="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">checkroom</span> Equipped Gear
            </span>
            ${
              equippedGear
                ? `<button id="locker-unequip-active-btn" class="text-error hover:text-error/80 text-[10px] font-black uppercase flex items-center gap-0.5" title="Remove Gear">
                     <span class="material-symbols-outlined text-xs">close</span> Unequip
                   </button>`
                : ''
            }
          </div>

          ${
            equippedGear
              ? `
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center justify-center text-2xl shadow-inner">
                <span class="material-symbols-outlined">shield</span>
              </div>
              <div class="flex flex-col">
                <span class="font-headline text-sm font-black text-inverse-surface">${equippedGear}</span>
                <span class="text-[10px] font-bold text-primary flex items-center gap-0.5">
                  <span class="material-symbols-outlined text-xs">verified</span> Active Stat Boost Applied!
                </span>
              </div>
            </div>
          `
              : `
            <div class="flex items-center gap-2.5 py-1 text-on-surface-variant text-xs font-bold">
              <span class="material-symbols-outlined text-xl text-on-surface-variant/60">lock</span>
              <span>No gear equipped. Select an unlocked item below!</span>
            </div>
          `
          }
        </div>

      </section>

      <!-- Category Filter Pills -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 z-10">
        <button data-locker-cat="all" class="locker-filter-btn px-4 py-2 rounded-xl font-headline text-xs font-black whitespace-nowrap transition-all ${
          activeCategoryFilter === 'all'
            ? 'bg-amber-500 text-on-primary shadow-sm'
            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
        }">
          All Digital Items (${uniqueContent.length})
        </button>
        <button data-locker-cat="unlocked" class="locker-filter-btn px-4 py-2 rounded-xl font-headline text-xs font-black whitespace-nowrap transition-all ${
          activeCategoryFilter === 'unlocked'
            ? 'bg-amber-500 text-on-primary shadow-sm'
            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
        }">
          Unlocked & Owned (${uniqueContent.filter(i => i.isUnlocked).length})
        </button>
        <button data-locker-cat="accessories" class="locker-filter-btn px-4 py-2 rounded-xl font-headline text-xs font-black whitespace-nowrap transition-all ${
          activeCategoryFilter === 'accessories'
            ? 'bg-amber-500 text-on-primary shadow-sm'
            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
        }">
          Accessories & Gear
        </button>
        <button data-locker-cat="badges" class="locker-filter-btn px-4 py-2 rounded-xl font-headline text-xs font-black whitespace-nowrap transition-all ${
          activeCategoryFilter === 'badges'
            ? 'bg-amber-500 text-on-primary shadow-sm'
            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
        }">
          Badges & Weapons
        </button>
      </div>

      <!-- Digital Gear Locker Grid -->
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 z-10">
        ${
          filteredContent.length === 0
            ? `
          <div class="col-span-full bg-surface-container rounded-3xl p-8 text-center border-2 border-surface-container-highest card-shadow flex flex-col items-center gap-2">
            <span class="material-symbols-outlined text-4xl text-on-surface-variant/50">inventory_2</span>
            <h3 class="font-headline text-base font-black text-inverse-surface">No Items Found</h3>
            <p class="text-xs text-on-surface-variant">Complete daily quests or visit the Hero Shop to unlock new pet gear!</p>
          </div>
        `
            : filteredContent
                .map((item) => {
                  const isCurrentlyEquipped = item.title === equippedGear;
                  const statLabel = getStatBonusLabel(item.statBonusPercent, item.statBonusType);

                  return `
            <div class="bg-surface-container rounded-3xl p-4.5 border-2 ${
              isCurrentlyEquipped
                ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                : item.isUnlocked
                ? 'border-surface-container-highest hover:border-amber-500/50'
                : 'border-surface-container-highest opacity-70'
            } card-shadow flex flex-col justify-between gap-3 transition-all">
              
              <div class="flex items-start gap-3.5">
                <!-- Visual Icon or Image -->
                <div class="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#182838] to-[#0e1620] border-2 ${
                  isCurrentlyEquipped ? 'border-amber-500' : 'border-surface-container-high'
                } flex items-center justify-center p-1.5 flex-shrink-0 shadow-md">
                  ${
                    item.image
                      ? `<img src="${item.image}" class="w-full h-full object-contain rounded-xl drop-shadow" alt="${item.title}" />`
                      : `<span class="material-symbols-outlined text-2xl text-amber-400">${item.icon || 'shield'}</span>`
                  }
                </div>

                <div class="flex flex-col flex-1 truncate">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[9px] font-black uppercase text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md">${item.category}</span>
                    ${item.isUnlocked ? `<span class="text-[9px] font-black uppercase text-primary bg-primary/15 px-2 py-0.5 rounded-md">Owned</span>` : ''}
                  </div>
                  <h3 class="font-headline text-base font-bold text-inverse-surface truncate mt-0.5">${item.title}</h3>
                  <p class="text-xs text-on-surface-variant line-clamp-1 mt-0.5">${item.desc}</p>
                  
                  <!-- Stat Bonus Badge -->
                  <div class="mt-1 flex items-center gap-1">
                    <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-secondary/15 text-secondary border border-secondary/30 flex items-center gap-1">
                      <span class="material-symbols-outlined text-xs">auto_awesome</span>
                      <span>+${item.statBonusPercent}% ${statLabel}</span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Equip / Swap Action Footer -->
              <div class="border-t border-surface-container-highest/60 pt-2.5 flex items-center justify-between">
                ${
                  isCurrentlyEquipped
                    ? `
                  <span class="bg-amber-500/20 text-amber-300 font-headline text-xs font-black px-4 py-2 rounded-xl border border-amber-500/50 flex items-center gap-1.5 shadow-sm">
                    <span class="material-symbols-outlined text-sm">check_circle</span>
                    <span>EQUIPPED</span>
                  </span>
                  <button data-unequip-title="${item.title}" class="locker-unequip-btn text-error hover:bg-error/10 font-headline text-xs font-bold px-3 py-2 rounded-xl border border-error/30 active:scale-95">
                    Unequip
                  </button>
                `
                    : item.isUnlocked
                    ? `
                  <button data-equip-title="${item.title}" class="locker-equip-btn w-full bg-amber-500 text-on-primary font-headline text-xs font-black py-2.5 px-4 rounded-xl chunky-btn-sm active:scale-95 shadow-sm hover:brightness-110 flex items-center justify-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">checkroom</span>
                    <span>EQUIP ON PET</span>
                  </button>
                `
                    : `
                  <div class="w-full flex items-center justify-between">
                    <span class="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
                      <span class="material-symbols-outlined text-xs">lock</span> Locked in Shop
                    </span>
                    <button id="locker-go-shop-btn" class="bg-surface-container-high hover:bg-secondary/20 text-secondary font-headline text-[10px] font-black px-3 py-1.5 rounded-xl border border-secondary/30 active:scale-95 flex items-center gap-1">
                      <span class="material-symbols-outlined text-xs">shopping_bag</span> Unlock
                    </button>
                  </div>
                `
                }
              </div>

            </div>
          `;
                })
                .join('')
        }
      </section>

      <!-- Shop Redirect Footer Banner -->
      <section class="bg-gradient-to-r from-surface-container to-surface-container-high rounded-3xl p-5 border-2 border-amber-500/30 flex items-center justify-between card-shadow mt-2">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl">
            <span class="material-symbols-outlined">storefront</span>
          </div>
          <div>
            <h4 class="font-headline text-sm font-black text-inverse-surface">Looking for More Outfits & Gear?</h4>
            <p class="text-xs text-on-surface-variant">Spend your earned Habit Tokens in the Hero Shop to unlock legendary capes, wands, and armor!</p>
          </div>
        </div>

        <button id="locker-footer-shop-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2.5 rounded-xl chunky-btn-sm active:scale-95 shadow-sm hover:brightness-110 flex items-center gap-1 whitespace-nowrap">
          <span class="material-symbols-outlined text-sm">shopping_bag</span>
          <span>Open Shop</span>
        </button>
      </section>

    </div>
  `;
}

function getStatBonusLabel(percent, type) {
  switch (type) {
    case 'coin_boost':
      return 'Token Payouts';
    case 'xp_boost':
      return 'Adventure XP';
    case 'defense_boost':
      return 'Defense Armor';
    case 'damage_boost':
      return 'AR Damage';
    case 'speed_boost':
      return 'Quest Speed';
    case 'joy_boost':
      return 'Happiness';
    case 'hygiene_boost':
      return 'Cleanliness';
    case 'energy_boost':
      return 'Energy Regen';
    default:
      return 'Hero Stat Boost';
  }
}

export function attachPetLockerListeners() {
  // Back to Pet Pen
  const exitBtn = document.getElementById('locker-exit-btn');
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate('pet_pen');
    });
  }

  // Category filter tabs
  document.querySelectorAll('.locker-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategoryFilter = btn.getAttribute('data-locker-cat') || 'all';
      Sound.click();
      store.notify();
    });
  });

  // Equip Gear Buttons
  document.querySelectorAll('.locker-equip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const title = btn.getAttribute('data-equip-title');
      if (title) {
        speakRex(`Awesome! Equipped ${title}! Super hero power!`);
        store.equipPetGear(title);
      }
    });
  });

  // Unequip Buttons
  document.querySelectorAll('.locker-unequip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      speakRex("Gear stored safely in your locker!");
      store.unequipPetGear();
    });
  });

  const unequipActiveBtn = document.getElementById('locker-unequip-active-btn');
  if (unequipActiveBtn) {
    unequipActiveBtn.addEventListener('click', () => {
      speakRex("Gear stored safely in your locker!");
      store.unequipPetGear();
    });
  }

  // Shop redirect buttons
  const goShopBtn = document.getElementById('locker-go-shop-btn');
  if (goShopBtn) {
    goShopBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate('shop');
    });
  }

  const footerShopBtn = document.getElementById('locker-footer-shop-btn');
  if (footerShopBtn) {
    footerShopBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate('shop');
    });
  }
}
