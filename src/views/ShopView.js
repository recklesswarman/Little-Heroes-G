import { store } from '../state/store.js';
import { speakRex } from '../services/voiceService.js';

let selectedCategory = 'all'; // 'all', 'weapons', 'gear', 'badges', 'snacks', 'themes', 'real_life'
let selectedSort = 'cheapest'; // 'cheapest', 'expensive'

export function renderShopView() {
  const state = store.getState();
  const hero = state.selectedHero;
  const recentlyUnlocked = state.recentlyUnlocked || [];
  const digitalGear = state.digitalGear || [];
  const profileThemes = state.profileThemes || [];
  const realLifeRewards = state.realLifeRewards || [];

  // Filter digital items
  let filteredDigital = digitalGear.filter((item) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'weapons') return item.category === 'Weapons';
    if (selectedCategory === 'gear') return item.category === 'Avatar Gear';
    if (selectedCategory === 'badges') return item.category === 'Badges';
    if (selectedCategory === 'snacks') return item.category === 'Snacks';
    return false;
  });

  // Sort digital items
  if (selectedSort === 'cheapest') {
    filteredDigital.sort((a, b) => a.costCoins - b.costCoins);
  } else if (selectedSort === 'expensive') {
    filteredDigital.sort((a, b) => b.costCoins - a.costCoins);
  }

  const showDigital = selectedCategory === 'all' || ['weapons', 'gear', 'badges', 'snacks'].includes(selectedCategory);
  const showThemes = selectedCategory === 'all' || selectedCategory === 'themes';
  const showRealLife = selectedCategory === 'all' || selectedCategory === 'real_life';

  return `
    <div class="max-w-5xl mx-auto px-4 pt-4 pb-32 flex flex-col gap-6 animate-fade-in select-none">
      
      <!-- Top Title & Dual Currency Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 class="font-headline text-2xl sm:text-3xl font-black text-secondary text-shadow">The Hero Shop</h1>
          <p class="text-xs sm:text-sm font-semibold text-on-surface-variant">Trade coins for digital gear & profile themes, or redeem real-world privileges!</p>
        </div>

        <!-- Currency Display -->
        <div class="flex items-center gap-3 w-full sm:w-auto">
          <!-- Habit Coins (Digital) -->
          <div class="flex-1 sm:flex-none flex items-center bg-surface-container/90 backdrop-blur-md px-4 py-2.5 rounded-full border-2 border-secondary-container gap-2.5 shadow-sm">
            <div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center border-b-2 border-on-secondary-container shadow-inner">
              <span class="material-symbols-outlined text-secondary text-xl animate-coin" style="font-variation-settings: 'FILL' 1;">monetization_on</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[9px] text-on-surface-variant uppercase font-black tracking-wider">Habit Tokens</span>
              <span class="font-headline text-sm font-black text-secondary leading-none">${hero.coins.toLocaleString()}</span>
            </div>
          </div>

          <!-- Gold Points (Real Life) -->
          <div class="flex-1 sm:flex-none flex items-center bg-surface-container/90 backdrop-blur-md px-4 py-2.5 rounded-full border-2 border-tertiary-container gap-2.5 shadow-sm">
            <div class="w-8 h-8 rounded-full bg-tertiary-container flex items-center justify-center border-b-2 border-on-tertiary-container shadow-inner">
              <span class="material-symbols-outlined text-tertiary text-xl" style="font-variation-settings: 'FILL' 1;">star</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[9px] text-on-surface-variant uppercase font-black tracking-wider">Gold Points</span>
              <span class="font-headline text-sm font-black text-tertiary leading-none">${hero.points || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Recently Unlocked Carousel -->
      <section class="flex flex-col gap-2">
        <h2 class="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
          <span class="material-symbols-outlined text-base">workspace_premium</span>
          Recently Unlocked Stickers & Trophies
        </h2>

        <div class="flex overflow-x-auto gap-4 pb-2 hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          ${recentlyUnlocked
            .map(
              (item) => `
            <div class="flex-shrink-0 w-32 h-36 bg-surface-container rounded-2xl p-3 flex flex-col items-center justify-between border-2 border-surface-container-highest card-shadow relative overflow-hidden group hover:border-secondary transition-all">
              <div class="absolute inset-0 bg-gradient-to-br from-secondary/15 to-transparent pointer-events-none"></div>
              <span class="text-[9px] font-black uppercase text-secondary bg-surface-container-high px-2 py-0.5 rounded-full z-10 self-start border border-secondary/20">${item.type}</span>
              
              <div class="w-16 h-16 relative flex items-center justify-center z-10 my-auto">
                <img class="w-full h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform" src="${item.image}" alt="${item.title}" />
              </div>

              <span class="text-[11px] font-black text-inverse-surface z-10 text-center leading-tight truncate w-full">${item.title}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </section>

      <!-- Category Filter Pills & Sort Bar -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
        
        <!-- Filter Pills -->
        <div class="flex overflow-x-auto gap-2 pb-1 hide-scrollbar w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <button data-cat="all" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all ${
            selectedCategory === 'all'
              ? 'bg-primary text-on-primary border-primary-container shadow-md'
              : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-variant'
          }">
            All Items
          </button>
          
          <button data-cat="weapons" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all ${
            selectedCategory === 'weapons'
              ? 'bg-primary text-on-primary border-primary-container shadow-md'
              : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-variant'
          }">
            ⚔️ Weapons
          </button>

          <button data-cat="gear" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all ${
            selectedCategory === 'gear'
              ? 'bg-primary text-on-primary border-primary-container shadow-md'
              : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-variant'
          }">
            🛡️ Avatar & Pet Gear
          </button>

          <button data-cat="badges" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all ${
            selectedCategory === 'badges'
              ? 'bg-primary text-on-primary border-primary-container shadow-md'
              : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-variant'
          }">
            🏆 Badges & Loot
          </button>

          <button data-cat="snacks" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all ${
            selectedCategory === 'snacks'
              ? 'bg-primary text-on-primary border-primary-container shadow-md'
              : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-variant'
          }">
            🫐 Snacks & Soaps
          </button>

          <button data-cat="themes" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all ${
            selectedCategory === 'themes'
              ? 'bg-primary text-on-primary border-primary-container shadow-md'
              : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-variant'
          }">
            🎨 Profile Themes
          </button>

          <button data-cat="real_life" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all ${
            selectedCategory === 'real_life'
              ? 'bg-tertiary text-on-tertiary border-tertiary-container shadow-md'
              : 'bg-surface-container-low text-tertiary border-surface-container hover:bg-surface-variant'
          }">
            ⭐ Real-Life Privileges
          </button>
        </div>

        <!-- Sort Control -->
        <div class="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-2xl border-2 border-surface-container self-end sm:self-auto">
          <span class="material-symbols-outlined text-on-surface-variant text-sm">sort</span>
          <select id="shop-sort-select" class="bg-transparent text-xs font-black text-inverse-surface focus:outline-none cursor-pointer">
            <option value="cheapest" ${selectedSort === 'cheapest' ? 'selected' : ''}>Cheapest</option>
            <option value="expensive" ${selectedSort === 'expensive' ? 'selected' : ''}>Most Expensive</option>
          </select>
        </div>

      </div>

      <!-- SECTION 1: Digital Goodies & Gear (Cost Tokens 🪙) -->
      ${
        showDigital
          ? `
        <section class="flex flex-col gap-4 animate-fade-in">
          <div class="flex items-center justify-between">
            <h2 class="font-headline text-lg font-black text-inverse-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-secondary">inventory_2</span>
              Digital Goodies & Gear (Tokens 🪙)
            </h2>
            <span class="text-xs font-bold text-on-surface-variant">Instant Auto-Unlock</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            ${filteredDigital
              .map((item) => {
                const isOwned = (state.inventory || []).includes(item.title);
                const isEquipped = state.equippedPetGear === item.title;
                const canAfford = hero.coins >= item.costCoins;

                return `
                <div data-gear-card-id="${item.id}" class="gear-card-item bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col justify-between gap-4 group hover:border-secondary transition-all cursor-pointer">
                  
                  <div class="flex items-start gap-3.5">
                    <div class="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center p-2 flex-shrink-0 border border-surface-container-highest group-hover:scale-105 transition-transform">
                      <img class="w-full h-full object-contain drop-shadow" src="${item.image}" alt="${item.title}" />
                    </div>

                    <div class="flex flex-col flex-1 truncate">
                      <div class="flex items-center gap-1.5">
                        <span class="text-[10px] font-black uppercase text-secondary">${item.category}</span>
                        ${item.statBonusPercent ? `<span class="text-[9px] font-black uppercase text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">+${item.statBonusPercent}% Boost</span>` : ''}
                      </div>
                      <h3 class="font-headline text-base font-black text-inverse-surface leading-tight truncate mt-0.5">${item.title}</h3>
                      <p class="text-xs text-on-surface-variant mt-0.5 line-clamp-2">${item.desc}</p>
                    </div>
                  </div>

                  <div class="flex items-center justify-between pt-3 border-t border-surface-container-highest">
                    <div class="flex items-center gap-1 font-headline text-sm font-black text-secondary">
                      <span class="material-symbols-outlined text-base">monetization_on</span>
                      <span>${item.costCoins} Tokens</span>
                    </div>

                    <div>
                      ${
                        isEquipped
                          ? `
                        <span class="bg-primary/20 text-primary font-headline text-xs font-black px-4 py-2 rounded-xl border border-primary/40 inline-block">
                          Equipped
                        </span>
                      `
                          : isOwned
                          ? `
                        <button data-buy-gear-id="${item.id}" class="buy-gear-btn bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-xs font-black px-4 py-2 rounded-xl border border-surface-container-highest chunky-btn-sm active:scale-95">
                          Equip
                        </button>
                      `
                          : canAfford
                          ? `
                        <button data-buy-gear-id="${item.id}" class="buy-gear-btn bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2 rounded-xl chunky-btn border-secondary-container shadow-chunky-sm hover:brightness-110 active:scale-95">
                          Buy Now
                        </button>
                      `
                          : `
                        <button class="bg-surface-container-highest text-on-surface-variant font-headline text-xs font-black px-4 py-2 rounded-xl border border-surface-container-low opacity-60 cursor-not-allowed">
                          Need ${item.costCoins - hero.coins} more
                        </button>
                      `
                      }
                    </div>
                  </div>

                </div>
              `;
              })
              .join('')}
          </div>
        </section>
      `
          : ''
      }

      <!-- SECTION 2: Kids Profile Themes (Cost Tokens 🪙) -->
      ${
        showThemes
          ? `
        <section class="flex flex-col gap-4 animate-fade-in">
          <div class="flex items-center justify-between">
            <h2 class="font-headline text-lg font-black text-inverse-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">palette</span>
              Kids Profile Themes (Tokens 🪙)
            </h2>
            <span class="text-xs font-bold text-on-surface-variant">Customize your hero profile look!</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            ${profileThemes
              .map((theme) => {
                const isUnlocked = (hero.unlockedThemes || []).includes(theme.id);
                const isEquipped = hero.equippedProfileTheme === theme.id;
                const canAfford = hero.coins >= theme.costCoins;

                return `
                <div class="bg-gradient-to-br ${theme.bgGradient} rounded-3xl p-5 border-2 ${
                  isEquipped ? 'border-primary shadow-[0_0_20px_rgba(46,204,113,0.4)]' : theme.cardBorder || 'border-surface-container-highest'
                } flex flex-col justify-between gap-4 card-shadow relative overflow-hidden">
                  <div class="flex items-start justify-between">
                    <div class="w-12 h-12 rounded-2xl bg-surface-container/60 backdrop-blur-md flex items-center justify-center text-2xl shadow border border-surface-bright" style="color: ${theme.primaryColor};">
                      <span class="material-symbols-outlined">${theme.badgeIcon}</span>
                    </div>
                    ${
                      isEquipped
                        ? `
                      <span class="bg-primary text-on-primary font-headline text-[10px] font-black px-2.5 py-1 rounded-full uppercase shadow">
                        Equipped
                      </span>
                    `
                        : isUnlocked
                        ? `
                      <span class="bg-surface-container text-primary font-headline text-[10px] font-black px-2.5 py-1 rounded-full uppercase border border-primary/40">
                        Unlocked
                      </span>
                    `
                        : `
                      <div class="flex items-center gap-1 bg-surface-container/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-secondary/40 text-xs font-black text-secondary">
                        <span>🪙 ${theme.costCoins}</span>
                      </div>
                    `
                    }
                  </div>

                  <div>
                    <h3 class="font-headline text-base font-black text-white">${theme.name}</h3>
                    <p class="text-xs text-white/75 font-medium mt-1">${theme.desc}</p>
                  </div>

                  <div class="pt-3 border-t border-white/15 flex items-center justify-between">
                    <span class="text-[10px] font-black uppercase text-white/60">Profile Theme</span>
                    ${
                      isEquipped
                        ? `
                      <button class="bg-surface-container text-white/50 text-xs font-black px-4 py-2 rounded-xl cursor-default">
                        Active
                      </button>
                    `
                        : isUnlocked
                        ? `
                      <button data-theme-id="${theme.id}" class="shop-theme-btn bg-primary text-on-primary font-headline text-xs font-black px-4 py-2 rounded-xl chunky-btn-sm hover:brightness-110 active:scale-95">
                        Equip
                      </button>
                    `
                        : canAfford
                        ? `
                      <button data-theme-id="${theme.id}" class="shop-theme-btn bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2 rounded-xl chunky-btn-sm hover:brightness-110 active:scale-95">
                        Unlock Theme
                      </button>
                    `
                        : `
                      <button class="bg-surface-container-highest text-white/40 text-xs font-black px-4 py-2 rounded-xl opacity-60 cursor-not-allowed">
                        Need ${theme.costCoins - hero.coins} more
                      </button>
                    `
                    }
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        </section>
      `
          : ''
      }

      <!-- SECTION 3: Real-Life Rewards (Cost Points ⭐) -->
      ${
        showRealLife
          ? `
        <section class="flex flex-col gap-4 animate-fade-in">
          <div class="flex items-center justify-between">
            <h2 class="font-headline text-lg font-black text-inverse-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-tertiary">star</span>
              Real-World Rewards & Privileges (Gold Points ⭐)
            </h2>
            <span class="text-xs font-bold text-on-surface-variant">Parent Sign-off Required</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            ${realLifeRewards
              .map((reward) => {
                const canAfford = (hero.points || 0) >= reward.costPoints;
                const pointsNeeded = reward.costPoints - (hero.points || 0);

                return `
                <div class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col justify-between gap-4 group hover:border-tertiary/60 transition-all">
                  
                  <div class="flex items-start gap-3.5">
                    <div class="w-16 h-16 rounded-2xl bg-tertiary/15 text-tertiary flex items-center justify-center text-3xl shadow-inner border border-tertiary/30 flex-shrink-0">
                      ${
                        reward.image?.startsWith('data:image') || reward.image?.startsWith('http')
                          ? `<img src="${reward.image}" class="w-12 h-12 object-contain" />`
                          : `<span class="material-symbols-outlined text-3xl">${reward.icon || 'card_giftcard'}</span>`
                      }
                    </div>

                    <div class="flex flex-col">
                      <span class="text-[10px] font-black uppercase text-tertiary">${reward.category}</span>
                      <h3 class="font-headline text-base font-black text-inverse-surface leading-tight">${reward.title}</h3>
                      <p class="text-xs text-on-surface-variant mt-1 line-clamp-2">${reward.desc}</p>
                    </div>
                  </div>

                  <div class="flex items-center justify-between pt-3 border-t border-surface-container-highest">
                    <div class="flex items-center gap-1 font-headline text-sm font-black text-tertiary">
                      <span class="material-symbols-outlined text-base">star</span>
                      <span>${reward.costPoints} Points</span>
                    </div>

                    <div>
                      ${
                        canAfford
                          ? `
                        <button data-redeem-id="${reward.id}" class="redeem-reward-btn bg-tertiary text-on-tertiary font-headline text-xs font-black px-4 py-2.5 rounded-xl chunky-btn border-tertiary-container shadow-chunky-sm hover:brightness-110 active:scale-95 flex-1 sm:flex-none">
                          Request Parent Sign-off
                        </button>
                      `
                          : `
                        <button class="bg-surface-container-highest text-on-surface-variant font-headline text-xs font-black px-4 py-2.5 rounded-xl border border-surface-container-low opacity-75 cursor-not-allowed flex-1 sm:flex-none">
                          Need ${pointsNeeded} more
                        </button>
                      `
                      }
                    </div>
                  </div>

                </div>
              `;
              })
              .join('')}
          </div>
        </section>
      `
          : ''
      }

    </div>
  `;
}

export function attachShopListeners() {
  document.querySelectorAll('.cat-pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedCategory = btn.getAttribute('data-cat');
      store.notify();
    });
  });

  const sortSelect = document.getElementById('shop-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      selectedSort = e.target.value;
      store.notify();
    });
  }

  document.querySelectorAll('.redeem-reward-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-redeem-id');
      store.redeemRealLifeReward(id);
    });
  });

  document.querySelectorAll('.gear-card-item').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const id = card.getAttribute('data-gear-card-id');
      const item = (store.getState().digitalGear || []).find((g) => g.id === id);
      if (item) {
        const text = (item.title + ' ' + (item.desc || '')).toLowerCase();
        if (text.includes('rex') || text.includes('dino')) {
          speakRex("Rawr! I am Rex the Dino! Let's go on an adventure!");
        } else {
          speakRex(`Look at this ${item.title}! Super hero power!`);
        }
      }
    });
  });

  document.querySelectorAll('.buy-gear-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-buy-gear-id');
      const state = store.getState();
      const item = (state.digitalGear || []).find((g) => g.id === id);
      const isOwned = (state.inventory || []).includes(item?.title);

      if (item && isOwned) {
        speakRex(`Awesome! You equipped the ${item.title}! Super hero power!`);
      } else if (item && state.selectedHero.coins >= item.costCoins) {
        const isPet = item.id.includes('rex') || item.id.includes('pet') || (item.category && item.category.toLowerCase().includes('companion'));
        if (isPet) {
          speakRex("A glowing companion egg has arrived! Tap it fast to hatch it!");
        } else {
          speakRex("A mystery treasure chest has arrived! Tap it fast to crack it open!");
        }
      }
      store.buyDigitalGear(id);
    });
  });

  document.querySelectorAll('.shop-theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-theme-id');
      if (id) {
        store.buyProfileTheme(id);
      }
    });
  });
}
