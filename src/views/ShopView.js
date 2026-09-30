import { store } from '../state/store.js';
import { speakRex } from '../services/voiceService.js';
import { Sound } from '../audio/sfx.js';
import { preserveScrollPosition } from '../utils/scrollPreserve.js';

let selectedCategory = 'all'; // 'all', 'weapons', 'gear', 'badges', 'snacks', 'themes', 'real_life'
let selectedSort = 'cheapest'; // 'cheapest', 'expensive'
let inspectingShopItem = null;

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

        <div id="shop-recent-unlocked-carousel" class="flex overflow-x-auto gap-4 pb-2 hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
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
        <div id="shop-category-pill-bar" class="flex overflow-x-auto gap-2 pb-1 hide-scrollbar w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <button data-cat="all" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all min-h-[44px] inline-flex items-center justify-center ${
            selectedCategory === 'all'
              ? 'bg-primary text-on-primary border-primary-container shadow-md'
              : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-variant'
          }">
            All Items
          </button>
          
          <button data-cat="weapons" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all min-h-[44px] inline-flex items-center justify-center ${
            selectedCategory === 'weapons'
              ? 'bg-primary text-on-primary border-primary-container shadow-md'
              : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-variant'
          }">
            ⚔️ Weapons
          </button>

          <button data-cat="gear" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all min-h-[44px] inline-flex items-center justify-center ${
            selectedCategory === 'gear'
              ? 'bg-primary text-on-primary border-primary-container shadow-md'
              : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-variant'
          }">
            🛡️ Avatar & Pet Gear
          </button>

          <button data-cat="badges" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all min-h-[44px] inline-flex items-center justify-center ${
            selectedCategory === 'badges'
              ? 'bg-primary text-on-primary border-primary-container shadow-md'
              : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-variant'
          }">
            🏆 Badges & Loot
          </button>

          <button data-cat="snacks" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all min-h-[44px] inline-flex items-center justify-center ${
            selectedCategory === 'snacks'
              ? 'bg-primary text-on-primary border-primary-container shadow-md'
              : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-variant'
          }">
            🫐 Snacks & Soaps
          </button>

          <button data-cat="themes" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all min-h-[44px] inline-flex items-center justify-center ${
            selectedCategory === 'themes'
              ? 'bg-primary text-on-primary border-primary-container shadow-md'
              : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-variant'
          }">
            🎨 Profile Themes
          </button>

          <button data-cat="real_life" class="cat-pill-btn flex-shrink-0 font-headline text-xs font-black px-4 py-2 rounded-full border transition-all min-h-[44px] inline-flex items-center justify-center ${
            selectedCategory === 'real_life'
              ? 'bg-tertiary text-on-tertiary border-tertiary-container shadow-md'
              : 'bg-surface-container-low text-tertiary border-surface-container hover:bg-surface-variant'
          }">
            ⭐ Real-Life Privileges
          </button>
        </div>

        <!-- Sort Control -->
        <div class="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-2xl border-2 border-surface-container self-end sm:self-auto min-h-[44px]">
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
                const heroInventory = Array.isArray(hero.inventory) ? hero.inventory : (state.inventory || []);
                const isWeapon = item.category === 'Weapons';
                const isFood = item.category === 'Snacks' || item.usageType === 'single_use' || item.usageType === 'multi_use';
                
                // Servings count for consumables
                let servingsCount = 0;
                if (hero.consumables && hero.consumables[item.id]) {
                  const cons = hero.consumables[item.id];
                  servingsCount = typeof cons === 'object' ? (cons.servingsRemaining || 0) : cons;
                }

                const isOwned = heroInventory.includes(item.id) || heroInventory.includes(item.title);
                let isEquipped = false;
                if (isWeapon) {
                  isEquipped = (hero.equippedWeapon === item.id) || (hero.equippedWeapon === item.title);
                } else if (item.targetPetSocket) {
                  isEquipped = (hero.equippedPetGear && (hero.equippedPetGear[item.targetPetSocket] === item.id || hero.equippedPetGear[item.targetPetSocket] === item.title)) || (state.equippedPetGear === item.title);
                } else {
                  isEquipped = (state.equippedPetGear === item.title) || (Array.isArray(hero.equippedGear) && hero.equippedGear.includes(item.id));
                }

                const canAfford = (hero.coins || 0) >= item.costCoins;
                const isParentCrafted = Boolean(item.isParentCrafted || item.isCustomAI);
                const socketIconMap = { head: '👑 Head', back: '🚀 Back', chest: '🛡️ Chest', feet: '👟 Paws' };
                const socketLabel = item.targetPetSocket ? socketIconMap[item.targetPetSocket] || item.targetPetSocket : null;

                return `
                <div data-gear-card-id="${item.id}" class="gear-card-item bg-surface-container rounded-3xl p-5 border-2 ${
                  isEquipped ? 'border-primary shadow-[0_0_15px_rgba(46,204,113,0.3)]' : isParentCrafted ? 'border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'border-surface-container-highest'
                } card-shadow flex flex-col justify-between gap-4 group hover:border-secondary transition-all cursor-pointer">
                  
                  <div class="flex items-start gap-3.5">
                    <div class="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center p-2 flex-shrink-0 border border-surface-container-highest group-hover:scale-105 transition-transform relative overflow-hidden">
                      <img class="w-full h-full object-contain drop-shadow" src="${item.image}" alt="${item.title}" />
                      ${isParentCrafted ? `<div class="absolute inset-0 bg-gradient-to-tr from-amber-400/10 via-transparent to-yellow-300/20 pointer-events-none"></div>` : ''}
                      <button class="shop-inspect-item-btn absolute bottom-0.5 right-0.5 w-6 h-6 rounded-lg bg-black/70 text-white/80 hover:text-white flex items-center justify-center text-xs" data-inspect-id="${item.id}" title="Inspect 3D">
                        🔍
                      </button>
                    </div>

                    <div class="flex flex-col flex-1 min-w-0">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[10px] font-black uppercase text-secondary">${item.category}</span>
                        ${
                          isWeapon
                            ? `<span class="text-[9px] font-black uppercase text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-700/60 flex items-center gap-0.5">⚔️ 1 Active / Battle</span>`
                            : ''
                        }
                        ${
                          isFood
                            ? `<span class="text-[9px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-600/50">${servingsCount > 0 ? `🫐 ${servingsCount} Serving${servingsCount > 1 ? 's' : ''}` : item.usageType === 'single_use' ? 'Single Use' : 'Snack Treat'}</span>`
                            : ''
                        }
                        ${
                          socketLabel
                            ? `<span class="text-[9px] font-bold text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-700/50">${socketLabel}</span>`
                            : ''
                        }
                        ${
                          item.statBonusLabel
                            ? `<span class="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-0.5">
                                 <span class="material-symbols-outlined text-[10px]" style="font-variation-settings: 'FILL' 1;">bolt</span> ${item.statBonusLabel}
                               </span>`
                            : item.statBonusPercent
                            ? `<span class="text-[9px] font-black uppercase text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-0.5">
                                 <span class="material-symbols-outlined text-[10px]" style="font-variation-settings: 'FILL' 1;">bolt</span> +${item.statBonusPercent}% ${item.statBonusType ? item.statBonusType.replace('_', ' ') : 'Boost'}
                               </span>`
                            : ''
                        }
                      </div>
                      <h3 class="font-headline text-base font-black text-inverse-surface leading-tight truncate mt-1">${item.title}</h3>
                      <p class="text-xs text-on-surface-variant mt-0.5 line-clamp-2">${item.desc}</p>
                      ${
                        item.voiceLine
                          ? `<div class="text-[10px] text-cyan-300/90 italic mt-1 truncate">🦖 "${item.voiceLine}"</div>`
                          : ''
                      }
                    </div>
                  </div>

                  <div class="flex items-center justify-between pt-3 border-t border-surface-container-highest">
                    <div class="flex items-center gap-1 font-headline text-sm font-black text-secondary">
                      <span class="material-symbols-outlined text-base">monetization_on</span>
                      <span>${item.costCoins} Tokens</span>
                    </div>

                    <div>
                      ${
                        isWeapon
                          ? isEquipped
                            ? `
                            <span class="bg-primary/20 text-primary font-headline text-xs font-black px-3.5 py-2 rounded-xl border border-primary/40 inline-flex items-center gap-1">
                              <span>✅</span> Equipped (1/1)
                            </span>
                          `
                            : isOwned
                            ? `
                            <button data-equip-weapon-id="${item.id}" class="shop-equip-weapon-btn min-h-[44px] bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-headline text-xs font-black px-4 py-2 rounded-xl border border-cyan-300 chunky-btn-sm active:scale-95 shadow">
                              Equip Weapon
                            </button>
                          `
                            : canAfford
                            ? `
                            <button data-buy-gear-id="${item.id}" class="buy-gear-btn min-h-[44px] bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2 rounded-xl chunky-btn border-secondary-container shadow-chunky-sm hover:brightness-110 active:scale-95">
                              Buy Weapon
                            </button>
                          `
                            : `
                            <button class="min-h-[44px] bg-surface-container-highest text-on-surface-variant font-headline text-xs font-black px-4 py-2 rounded-xl border border-surface-container-low opacity-60 cursor-not-allowed">
                              Need ${item.costCoins - (hero.coins || 0)} more
                            </button>
                          `
                          : isFood
                          ? servingsCount > 0
                            ? `
                            <div class="flex items-center gap-1.5">
                              <button data-feed-snack-id="${item.id}" class="shop-feed-snack-btn min-h-[44px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-headline text-xs font-black px-3.5 py-2 rounded-xl border border-emerald-300 chunky-btn-sm active:scale-95 shadow flex items-center gap-1">
                                <span>🍽️</span>
                                <span>Feed Rex (${servingsCount})</span>
                              </button>
                              ${canAfford ? `
                                <button data-buy-gear-id="${item.id}" class="buy-gear-btn min-h-[44px] bg-surface-container-high hover:bg-surface-bright text-secondary font-headline text-xs font-black px-2.5 py-2 rounded-xl border border-secondary/40" title="Buy More Servings">
                                  +🪙
                                </button>
                              ` : ''}
                            </div>
                          `
                            : canAfford
                            ? `
                            <button data-buy-gear-id="${item.id}" class="buy-gear-btn min-h-[44px] bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2 rounded-xl chunky-btn border-secondary-container shadow-chunky-sm hover:brightness-110 active:scale-95">
                              Buy Snack (${item.maxServings || 1}x)
                            </button>
                          `
                            : `
                            <button class="min-h-[44px] bg-surface-container-highest text-on-surface-variant font-headline text-xs font-black px-4 py-2 rounded-xl border border-surface-container-low opacity-60 cursor-not-allowed">
                              Need ${item.costCoins - (hero.coins || 0)} more
                            </button>
                          `
                          : isEquipped
                          ? `
                        <span class="bg-primary/20 text-primary font-headline text-xs font-black px-4 py-2 rounded-xl border border-primary/40 inline-block">
                          Equipped
                        </span>
                      `
                          : isOwned
                          ? `
                        <button data-buy-gear-id="${item.id}" class="buy-gear-btn min-h-[44px] bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-xs font-black px-4 py-2 rounded-xl border border-surface-container-highest chunky-btn-sm active:scale-95">
                          Equip
                        </button>
                      `
                          : canAfford
                          ? `
                        <button data-buy-gear-id="${item.id}" class="buy-gear-btn min-h-[44px] bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2 rounded-xl chunky-btn border-secondary-container shadow-chunky-sm hover:brightness-110 active:scale-95">
                          Buy Now
                        </button>
                      `
                          : `
                        <button class="min-h-[44px] bg-surface-container-highest text-on-surface-variant font-headline text-xs font-black px-4 py-2 rounded-xl border border-surface-container-low opacity-60 cursor-not-allowed">
                          Need ${item.costCoins - (hero.coins || 0)} more
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
                      <button data-theme-id="${theme.id}" class="shop-theme-btn min-h-[44px] bg-primary text-on-primary font-headline text-xs font-black px-4 py-2 rounded-xl chunky-btn-sm hover:brightness-110 active:scale-95">
                        Equip
                      </button>
                    `
                        : canAfford
                        ? `
                      <button data-theme-id="${theme.id}" class="shop-theme-btn min-h-[44px] bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2 rounded-xl chunky-btn-sm hover:brightness-110 active:scale-95">
                        Unlock Theme
                      </button>
                    `
                        : `
                      <button class="min-h-[44px] bg-surface-container-highest text-white/40 text-xs font-black px-4 py-2 rounded-xl opacity-60 cursor-not-allowed">
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
                        <button data-redeem-id="${reward.id}" class="redeem-reward-btn min-h-[44px] bg-tertiary text-on-tertiary font-headline text-xs font-black px-4 py-2.5 rounded-xl chunky-btn border-tertiary-container shadow-chunky-sm hover:brightness-110 active:scale-95 flex-1 sm:flex-none">
                          Request Parent Sign-off
                        </button>
                      `
                          : `
                        <button class="min-h-[44px] bg-surface-container-highest text-on-surface-variant font-headline text-xs font-black px-4 py-2.5 rounded-xl border border-surface-container-low opacity-75 cursor-not-allowed flex-1 sm:flex-none">
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

      <!-- 3D Item Inspect Modal -->
      ${inspectingShopItem ? renderShopItemInspectModal(inspectingShopItem, hero, state) : ''}

    </div>
  `;
}

function renderShopItemInspectModal(item, hero, state) {
  const heroInventory = Array.isArray(hero?.inventory) ? hero.inventory : (state.inventory || []);
  const isWeapon = item.category === 'Weapons';
  const isFood = item.category === 'Snacks' || item.usageType === 'single_use' || item.usageType === 'multi_use';
  let servingsCount = 0;
  if (hero?.consumables && hero.consumables[item.id]) {
    const cons = hero.consumables[item.id];
    servingsCount = typeof cons === 'object' ? (cons.servingsRemaining || 0) : cons;
  }
  const isOwned = heroInventory.includes(item.id) || heroInventory.includes(item.title);
  let isEquipped = false;
  if (isWeapon) {
    isEquipped = (hero?.equippedWeapon === item.id) || (hero?.equippedWeapon === item.title);
  } else if (item.targetPetSocket) {
    isEquipped = (hero?.equippedPetGear && (hero.equippedPetGear[item.targetPetSocket] === item.id || hero.equippedPetGear[item.targetPetSocket] === item.title)) || (state.equippedPetGear === item.title);
  } else {
    isEquipped = (state.equippedPetGear === item.title) || (Array.isArray(hero?.equippedGear) && hero.equippedGear.includes(item.id));
  }
  const canAfford = (hero?.coins || 0) >= item.costCoins;

  return `
  <div id="shop-inspect-modal-backdrop" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in font-body">
    <div class="bg-surface-container-high border-4 border-amber-400 rounded-3xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(245,158,11,0.4)] flex flex-col items-center gap-4 text-center animate-scale-up text-on-surface">
      
      <!-- Modal Header -->
      <div class="w-full flex items-center justify-between border-b border-white/10 pb-3">
        <span class="text-xs font-black uppercase text-secondary font-headline tracking-wider">${item.category}</span>
        <button id="shop-close-inspect-btn" class="w-8 h-8 rounded-xl bg-surface-container hover:bg-surface-bright flex items-center justify-center text-white/70 hover:text-white border border-white/20">
          <span class="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      <!-- 3D Item Showcase & Model -->
      <div class="relative w-36 h-36 rounded-3xl bg-surface-container-lowest border-2 border-amber-400/60 p-2 flex items-center justify-center overflow-hidden shadow-inner group">
        <div class="absolute inset-0 bg-radial from-amber-400/20 via-transparent to-transparent pointer-events-none"></div>
        ${item.modelUrl ? `
          <model-viewer src="${item.modelUrl}" auto-rotate camera-controls shadow-intensity="1.2" ar style="width: 100%; height: 100%; background: transparent;"></model-viewer>
        ` : `
          <img src="${item.image}" alt="${item.title}" class="w-28 h-28 object-contain drop-shadow-xl group-hover:scale-105 transition-transform" />
        `}
      </div>

      <!-- Title & Stat Badge -->
      <div class="flex flex-col gap-1 items-center">
        <h3 class="font-headline text-xl font-black text-inverse-surface">${item.title}</h3>
        <p class="text-xs text-on-surface-variant max-w-xs font-medium">${item.desc || ''}</p>
        
        <div class="flex flex-wrap items-center justify-center gap-2 mt-2">
          ${item.statBonusLabel || item.statBonus ? `
            <span class="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
              <span class="material-symbols-outlined text-xs">bolt</span>
              ${item.statBonusLabel || item.statBonus}
            </span>
          ` : ''}
          ${isWeapon ? `
            <span class="text-[10px] font-black uppercase text-cyan-300 bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-500/40">
              ⚔️ 1 Weapon Equipped / Battle
            </span>
          ` : ''}
          ${isFood ? `
            <span class="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-500/40">
              ${servingsCount > 0 ? `🫐 ${servingsCount} Serving(s) Available` : item.usageType === 'single_use' ? 'Single Use Treat' : 'Multi-Use Servings'}
            </span>
          ` : ''}
        </div>
      </div>

      <!-- Rex Companion Spoken Dialogue -->
      <div class="w-full bg-slate-900/80 border border-cyan-400/40 p-3 rounded-2xl flex flex-col gap-1 text-left">
        <div class="flex items-center justify-between">
          <span class="text-xs font-headline font-black text-cyan-300 flex items-center gap-1">
            <span>🦖</span> Rex Voice Companion
          </span>
          <button id="shop-replay-voice-btn" class="text-[10px] font-bold text-amber-300 hover:text-amber-200 flex items-center gap-0.5">
            <span class="material-symbols-outlined text-xs">volume_up</span> Speak
          </button>
        </div>
        <p class="text-xs text-white/90 font-medium italic">
          "${item.voiceLine || item.companionReaction || `This ${item.title} has great heroic energy!`}"
        </p>
      </div>

      <!-- Actions -->
      <div class="w-full pt-2 border-t border-white/10 flex items-center justify-between gap-3">
        <div class="flex items-center gap-1 text-secondary font-headline text-sm font-black">
          <span class="material-symbols-outlined text-base">monetization_on</span>
          <span>${item.costCoins} Tokens</span>
        </div>

        <div>
          ${isWeapon ? `
            ${isEquipped ? `
              <span class="bg-primary/20 text-primary font-headline text-xs font-black px-4 py-2.5 rounded-xl border border-primary/40 inline-flex items-center gap-1">
                <span>✅</span> Equipped in Battle
              </span>
            ` : isOwned ? `
              <button data-equip-weapon-id="${item.id}" class="shop-equip-weapon-btn bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-headline text-xs font-black px-5 py-2.5 rounded-xl border border-cyan-300 shadow chunky-btn-sm active:scale-95">
                Equip Weapon
              </button>
            ` : canAfford ? `
              <button data-buy-gear-id="${item.id}" class="buy-gear-btn bg-secondary text-on-secondary font-headline text-xs font-black px-5 py-2.5 rounded-xl chunky-btn border-secondary-container shadow hover:brightness-110 active:scale-95">
                Buy Weapon
              </button>
            ` : `
              <span class="text-xs text-on-surface-variant font-bold">Need ${item.costCoins - (hero?.coins || 0)} more</span>
            `}
          ` : isFood ? `
            ${servingsCount > 0 ? `
              <button data-feed-snack-id="${item.id}" class="shop-feed-snack-btn bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-headline text-xs font-black px-5 py-2.5 rounded-xl border border-emerald-300 shadow chunky-btn-sm active:scale-95 flex items-center gap-1">
                <span>🍽️</span> Feed Rex (${servingsCount})
              </button>
            ` : canAfford ? `
              <button data-buy-gear-id="${item.id}" class="buy-gear-btn bg-secondary text-on-secondary font-headline text-xs font-black px-5 py-2.5 rounded-xl chunky-btn border-secondary-container shadow hover:brightness-110 active:scale-95">
                Buy Snack (${item.maxServings || 1}x)
              </button>
            ` : `
              <span class="text-xs text-on-surface-variant font-bold">Need ${item.costCoins - (hero?.coins || 0)} more</span>
            `}
          ` : `
            ${isEquipped ? `
              <span class="bg-primary/20 text-primary font-headline text-xs font-black px-4 py-2.5 rounded-xl border border-primary/40 inline-block">
                Equipped
              </span>
            ` : isOwned ? `
              <button data-buy-gear-id="${item.id}" class="buy-gear-btn bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-xs font-black px-5 py-2.5 rounded-xl border border-surface-container-highest chunky-btn-sm active:scale-95">
                Equip
              </button>
            ` : canAfford ? `
              <button data-buy-gear-id="${item.id}" class="buy-gear-btn bg-secondary text-on-secondary font-headline text-xs font-black px-5 py-2.5 rounded-xl chunky-btn border-secondary-container shadow hover:brightness-110 active:scale-95">
                Buy Now
              </button>
            ` : `
              <span class="text-xs text-on-surface-variant font-bold">Need ${item.costCoins - (hero?.coins || 0)} more</span>
            `}
          `}
        </div>
      </div>

    </div>
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
  preserveScrollPosition('shop-category-pill-bar');
  preserveScrollPosition('shop-recent-unlocked-carousel');

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

  // Card click / inspect
  document.querySelectorAll('.gear-card-item').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const id = card.getAttribute('data-gear-card-id');
      const item = (store.getState().digitalGear || []).find((g) => g.id === id);
      if (item) {
        inspectingShopItem = item;
        Sound.bloop();
        if (item.voiceLine) {
          speakRex(item.voiceLine);
        } else if (item.companionReaction) {
          speakRex(item.companionReaction);
        } else {
          speakRex(`Look at this ${item.title}! Super hero power!`);
        }
        store.notify();
      }
    });
  });

  // Inspect 3D button click
  document.querySelectorAll('.shop-inspect-item-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-inspect-id');
      const item = (store.getState().digitalGear || []).find((g) => g.id === id);
      if (item) {
        inspectingShopItem = item;
        Sound.bloop();
        if (item.voiceLine) {
          speakRex(item.voiceLine);
        }
        store.notify();
      }
    });
  });

  // Close inspect modal
  const closeInspectBtn = document.getElementById('shop-close-inspect-btn');
  if (closeInspectBtn) {
    closeInspectBtn.addEventListener('click', () => {
      inspectingShopItem = null;
      Sound.pop();
      store.notify();
    });
  }
  const inspectBackdrop = document.getElementById('shop-inspect-modal-backdrop');
  if (inspectBackdrop) {
    inspectBackdrop.addEventListener('click', (e) => {
      if (e.target === inspectBackdrop) {
        inspectingShopItem = null;
        Sound.pop();
        store.notify();
      }
    });
  }

  // Replay voice button in inspect modal
  const replayVoiceBtn = document.getElementById('shop-replay-voice-btn');
  if (replayVoiceBtn && inspectingShopItem) {
    replayVoiceBtn.addEventListener('click', () => {
      const voiceText = inspectingShopItem.voiceLine || inspectingShopItem.companionReaction || `This ${inspectingShopItem.title} is awesome!`;
      speakRex(voiceText);
    });
  }

  // Equip Weapon button
  document.querySelectorAll('.shop-equip-weapon-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-equip-weapon-id');
      const item = (store.getState().digitalGear || []).find((g) => g.id === id);
      store.equipHeroWeapon(id);
      Sound.gearSnap();
      if (item?.voiceLine) {
        speakRex(item.voiceLine);
      } else {
        speakRex(`Equipped ${item?.title || 'weapon'} for battle!`);
      }
      inspectingShopItem = null;
      store.notify();
    });
  });

  // Feed Snack button
  document.querySelectorAll('.shop-feed-snack-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-feed-snack-id');
      store.feedPetConsumableSnack(id);
      inspectingShopItem = null;
    });
  });

  // Buy Gear / Weapon / Snack button
  document.querySelectorAll('.buy-gear-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-buy-gear-id');
      const state = store.getState();
      const item = (state.digitalGear || []).find((g) => g.id === id);
      const isOwned = (state.selectedHero?.inventory || []).includes(item?.title) || (state.selectedHero?.inventory || []).includes(item?.id);

      if (item && isOwned && item.category !== 'Snacks') {
        speakRex(`Awesome! You equipped the ${item.title}! Super hero power!`);
      } else if (item && (state.selectedHero?.coins || 0) >= item.costCoins) {
        if (item.category === 'Snacks') {
          speakRex(item.voiceLine || "Delicious pet snacks have arrived! Feed them to Rex!");
        } else if (item.category === 'Weapons') {
          speakRex(item.voiceLine || `Awesome! You got the ${item.title}! Ready for battle!`);
        } else {
          speakRex(item.voiceLine || "A mystery treasure chest has arrived! Tap it fast to crack it open!");
        }
      }
      store.buyDigitalGear(id);
      inspectingShopItem = null;
    });
  });

  // Theme buy/equip button
  document.querySelectorAll('.shop-theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-theme-id');
      if (id) {
        store.buyProfileTheme(id);
      }
    });
  });
}
