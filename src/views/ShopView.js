import { store } from '../state/store.js';

let selectedCategory = 'all'; // 'all', 'weapons', 'gear', 'badges', 'snacks', 'real_life'
let selectedSort = 'cheapest'; // 'cheapest', 'expensive', 'rarity'

export function renderShopView() {
  const state = store.getState();
  const hero = state.selectedHero;
  const recentlyUnlocked = state.recentlyUnlocked || [];
  const digitalGear = state.digitalGear || [];
  const realLifeRewards = state.realLifeRewards || [];
  const inventory = state.inventory || [];
  const equippedGear = state.equippedPetGear;

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

  const showDigital = selectedCategory !== 'real_life';
  const showRealLife = selectedCategory === 'all' || selectedCategory === 'real_life';

  return `
    <div class="max-w-5xl mx-auto px-4 pt-4 pb-32 flex flex-col gap-6 animate-fade-in">
      
      <!-- Top Title & Dual Currency Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 class="font-headline text-2xl sm:text-3xl font-black text-secondary text-shadow">The Hero Shop</h1>
          <p class="text-xs sm:text-sm font-semibold text-on-surface-variant">Trade coins for digital gear & toys, or redeem real-world privileges!</p>
        </div>

        <!-- Currency Display -->
        <div class="flex items-center gap-3 w-full sm:w-auto">
          <!-- Habit Coins (Digital) -->
          <div class="flex-1 sm:flex-none flex items-center bg-surface-container/90 backdrop-blur-md px-4 py-2.5 rounded-full border-2 border-secondary-container gap-2.5 shadow-sm">
            <div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center border-b-2 border-on-secondary-container shadow-inner">
              <span class="material-symbols-outlined text-secondary text-xl animate-coin" style="font-variation-settings: 'FILL' 1;">monetization_on</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[9px] text-on-surface-variant uppercase font-black tracking-wider">Habit Coins</span>
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
            All Goodies
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

      <!-- SECTION 1: Digital Goodies & Gear (Cost Coins 🪙) -->
      ${
        showDigital
          ? `
        <section class="flex flex-col gap-4 animate-fade-in">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shadow-sm">
              <span class="material-symbols-outlined text-on-secondary text-base" style="font-variation-settings: 'FILL' 1;">toys</span>
            </div>
            <h2 class="font-headline text-xl font-black text-inverse-surface">Digital Goodies & Gear</h2>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            ${filteredDigital
              .map((item) => {
                const isOwned = inventory.includes(item.title);
                const isEquipped = equippedGear === item.title;
                const canAfford = hero.coins >= item.costCoins;

                return `
                <div class="bg-surface-container rounded-3xl p-5 border-2 border-surface-bright card-shadow flex flex-col justify-between gap-4 relative group hover:border-secondary transition-all">
                  
                  <!-- Product Image / Visual Box -->
                  <div class="bg-surface-container-highest rounded-2xl h-44 relative overflow-hidden flex items-center justify-center p-3">
                    ${
                      item.isNew
                        ? `<div class="absolute top-2 right-2 bg-secondary text-on-secondary text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm z-10">NEW</div>`
                        : ''
                    }
                    <div class="absolute top-2 left-2 bg-surface-container-highest/90 backdrop-blur-sm text-on-surface-variant text-[10px] font-black px-2 py-0.5 rounded-lg border border-outline-variant z-10">
                      ${item.category}
                    </div>

                    ${
                      item.image
                        ? `<img class="w-3/4 h-3/4 object-contain drop-shadow-md group-hover:scale-105 transition-transform" src="${item.image}" alt="${item.title}" />`
                        : `<div class="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-4xl shadow-inner" style="color: ${item.color};">
                             <span class="material-symbols-outlined text-4xl" style="font-variation-settings: 'FILL' 1;">${item.icon}</span>
                           </div>`
                    }
                  </div>

                  <!-- Info -->
                  <div class="flex-1 flex flex-col">
                    <h3 class="font-headline text-base font-black text-inverse-surface group-hover:text-secondary transition-colors">${item.title}</h3>
                    <p class="text-xs text-on-surface-variant mt-1 leading-relaxed">${item.desc}</p>
                  </div>

                  <!-- Price & Action Button -->
                  <div class="flex items-center justify-between pt-3 border-t border-surface-container-highest mt-auto">
                    <div class="flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1.5 rounded-xl border border-surface-container">
                      <span class="material-symbols-outlined text-secondary text-base" style="font-variation-settings: 'FILL' 1;">monetization_on</span>
                      <span class="font-headline font-black text-sm text-secondary">${item.costCoins}</span>
                    </div>

                    ${
                      isOwned
                        ? `
                      <button data-buy-gear-id="${item.id}" class="buy-gear-btn ${
                            isEquipped
                              ? 'bg-primary text-on-primary border-primary-container'
                              : 'bg-surface-container-highest text-primary border-surface-container-low hover:bg-surface-bright'
                          } font-headline text-xs font-black px-4 py-2.5 rounded-xl border flex items-center gap-1 chunky-btn-sm active:scale-95">
                        <span class="material-symbols-outlined text-sm">${isEquipped ? 'check_circle' : 'checkroom'}</span>
                        ${isEquipped ? 'Equipped' : 'Equip'}
                      </button>
                    `
                        : `
                      <button data-buy-gear-id="${item.id}" class="buy-gear-btn ${
                            canAfford
                              ? 'bg-primary text-on-primary border-primary-container hover:brightness-110'
                              : 'bg-surface-container-highest text-on-surface-variant border-surface-container-low opacity-75'
                          } font-headline text-xs font-black px-5 py-2.5 rounded-xl chunky-btn shadow-chunky-sm flex items-center gap-1 active:scale-95">
                        Buy Now
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

      <!-- SECTION 2: Real-Life Rewards (Cost Points ⭐) -->
      ${
        showRealLife
          ? `
        <section class="flex flex-col gap-4 animate-fade-in pt-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-full bg-tertiary flex items-center justify-center shadow-sm">
                <span class="material-symbols-outlined text-on-tertiary text-base" style="font-variation-settings: 'FILL' 1;">card_giftcard</span>
              </div>
              <h2 class="font-headline text-xl font-black text-inverse-surface">Real-Life Rewards</h2>
            </div>
            
            <span class="text-xs font-bold text-tertiary hidden sm:flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">verified_user</span>
              Requires Parent Approval
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            ${realLifeRewards
              .map((reward) => {
                const canAfford = hero.points >= reward.costPoints;
                const pointsNeeded = reward.costPoints - hero.points;

                return `
                <div class="bg-surface-container rounded-3xl p-5 border-2 border-tertiary/40 card-shadow flex flex-col sm:flex-row gap-4 items-center relative group hover:border-tertiary transition-all">
                  
                  <div class="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-surface-container-highest flex-shrink-0 flex items-center justify-center relative overflow-hidden p-2">
                    <div class="absolute top-1.5 left-1.5 bg-surface-container-highest/90 text-tertiary text-[9px] font-black px-1.5 py-0.5 rounded border border-tertiary/30">
                      ${reward.category || 'Experience'}
                    </div>

                    ${
                      reward.image
                        ? `<img class="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform" src="${reward.image}" alt="${reward.title}" />`
                        : `<div class="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-3xl shadow-inner text-tertiary">
                             <span class="material-symbols-outlined text-4xl" style="font-variation-settings: 'FILL' 1;">${reward.icon}</span>
                           </div>`
                    }
                  </div>

                  <div class="flex-1 flex flex-col h-full py-1 text-center sm:text-left justify-between w-full">
                    <div>
                      <h3 class="font-headline text-base font-black text-tertiary">${reward.title}</h3>
                      <p class="text-xs text-on-surface-variant mt-1 leading-relaxed">${reward.desc}</p>
                    </div>

                    <div class="flex items-center justify-between sm:justify-start gap-3 mt-4 pt-2 border-t border-surface-container-highest">
                      <div class="flex items-center gap-1 bg-surface-container-lowest px-3 py-1.5 rounded-xl border border-surface-container">
                        <span class="material-symbols-outlined text-tertiary text-base" style="font-variation-settings: 'FILL' 1;">star</span>
                        <span class="font-headline font-black text-sm text-tertiary">${reward.costPoints}</span>
                      </div>

                      ${
                        canAfford
                          ? `
                        <button data-redeem-id="${reward.id}" class="redeem-reward-btn bg-tertiary text-on-tertiary font-headline text-xs font-black px-5 py-2.5 rounded-xl chunky-btn-sm border-tertiary-container hover:brightness-110 flex-1 sm:flex-none active:scale-95">
                          Claim Reward
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

  document.querySelectorAll('.buy-gear-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-buy-gear-id');
      store.buyDigitalGear(id);
    });
  });
}
