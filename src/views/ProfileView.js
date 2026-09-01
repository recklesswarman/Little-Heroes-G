import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';

export function renderProfileView() {
  const state = store.getState();
  const currentHero = state.selectedHero;
  const heroes = state.heroes;
  const profileThemes = state.profileThemes || [];

  // Find active profile theme object
  const activeTheme = profileThemes.find(t => t.id === currentHero.equippedProfileTheme) || profileThemes[0] || {
    id: 'theme_dragon_emerald',
    name: 'Emerald Dragon Guardian',
    desc: 'Lush dragon scales with glowing emerald borders.',
    bgGradient: 'from-[#081c15] via-[#0d281e] to-[#040e0b]',
    primaryColor: '#2ecc71',
    badgeIcon: 'shield',
    bannerPattern: '🐉'
  };

  const unlockedThemes = currentHero.unlockedThemes || [activeTheme.id];

  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-32 flex flex-col gap-6 animate-fade-in select-none">
      
      <!-- Top Navigation & Header -->
      <div class="flex items-center justify-between">
        <button id="profile-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">arrow_back</span> Back to Quests
        </button>
        <div class="flex items-center gap-2">
          <span class="text-xs font-black uppercase text-secondary">Active Theme:</span>
          <span class="bg-surface-container-high px-3 py-1 rounded-full text-xs font-bold text-inverse-surface border border-secondary/40">
            ${activeTheme.name}
          </span>
        </div>
      </div>

      <!-- ACTIVE HERO IDENTITY CARD (Styled with Equipped Profile Theme) -->
      <div class="bg-gradient-to-br ${activeTheme.bgGradient} rounded-4xl p-6 sm:p-8 border-3 border-primary/50 shadow-[0_12px_24px_rgba(0,0,0,0.6)] flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <!-- Ambient Decorative Glow -->
        <div class="absolute -top-10 -right-10 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-10 -left-10 w-48 h-48 bg-secondary/20 rounded-full blur-3xl pointer-events-none"></div>

        <div class="flex items-center gap-5 z-10">
          <div class="relative">
            <img class="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-primary object-cover shadow-2xl" src="${currentHero.avatar}" alt="${currentHero.name}" />
            <div class="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-surface-container-highest border-2 border-primary flex items-center justify-center text-primary shadow">
              <span class="material-symbols-outlined text-lg">${activeTheme.badgeIcon}</span>
            </div>
          </div>

          <div class="flex flex-col text-left">
            <div class="flex items-center gap-2">
              <h1 class="font-headline text-2xl sm:text-3xl font-black text-white">${currentHero.name}</h1>
              <span class="bg-primary/25 text-primary text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border border-primary/40">
                ${activeTheme.name}
              </span>
            </div>
            <p class="text-xs text-white/80 font-bold">${currentHero.title || 'Little Hero Adventurer'}</p>

            <div class="flex items-center gap-3 mt-2 text-xs font-black">
              <span class="text-secondary flex items-center gap-1">
                <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">monetization_on</span>
                ${currentHero.coins} Tokens
              </span>
              <span class="text-tertiary flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">star</span>
                ${currentHero.points || 0} Points
              </span>
              <span class="text-white/70 flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">school</span>
                Level: ${currentHero.gameDifficulty === 'easy' ? 'Easy (Toddler 3-4)' : currentHero.gameDifficulty === 'hard' ? 'Hard (7-9)' : 'Medium (5-6)'}
              </span>
            </div>
          </div>
        </div>

        <div class="flex flex-col items-center sm:items-end gap-2 z-10">
          <div class="bg-surface-container/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary text-base">local_fire_department</span>
            <span class="text-xs font-black text-white">${currentHero.streak || 5} Day Streak!</span>
          </div>
          <span class="text-[11px] font-bold text-white/60">Theme: ${activeTheme.bannerPattern} ${activeTheme.name}</span>
        </div>
      </div>

      <!-- HERO CHARACTERS GRID (Pick Adventurer) -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h2 class="font-headline text-lg font-black text-inverse-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary">group</span>
            Switch Adventurer
          </h2>
          <span class="text-xs font-bold text-on-surface-variant">Tap to play as a different hero</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          ${heroes
            .map((h) => {
              const isSelected = currentHero.id === h.id;
              const kidDiff = h.gameDifficulty || 'medium';

              return `
              <button data-hero-id="${h.id}" class="select-hero-btn bg-surface-container rounded-3xl p-4 border-3 ${
                isSelected
                  ? 'border-primary bg-surface-container-high shadow-[0_0_24px_rgba(84,233,138,0.35)] scale-102'
                  : 'border-surface-container-highest hover:border-primary/50'
              } card-shadow flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group text-center">
                
                <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-inner border-2 border-surface-container-highest overflow-hidden">
                  <img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" src="${h.avatar}" alt="${h.name}" />
                </div>

                <div class="flex flex-col items-center">
                  <h3 class="font-headline text-base font-black text-on-surface leading-tight">${h.name}</h3>
                  <span class="text-[10px] text-on-surface-variant font-bold">${h.role}</span>
                </div>

                <div class="bg-surface-container-highest px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-surface-container-low text-[10px] font-black text-secondary">
                  <span>★ Lvl ${h.level}</span>
                  <span>• ${kidDiff === 'easy' ? 'Toddler' : kidDiff === 'hard' ? 'Hard' : 'Med'}</span>
                </div>

                ${
                  isSelected
                    ? `
                  <div class="w-full bg-primary text-on-primary text-[10px] font-black uppercase py-1 rounded-xl mt-0.5">
                    Active
                  </div>
                `
                    : `
                  <div class="w-full bg-surface-container-high text-on-surface-variant group-hover:text-primary text-[10px] font-black uppercase py-1 rounded-xl mt-0.5 transition-colors">
                    Select
                  </div>
                `
                }
              </button>
            `;
            })
            .join('')}
        </div>
      </div>

      <!-- PROFILE THEMES WARDROBE SECTION -->
      <div class="bg-surface-container rounded-4xl p-6 border-2 border-surface-container-highest card-shadow flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-primary text-2xl">palette</span>
            <div>
              <h2 class="font-headline text-lg font-black text-inverse-surface">Hero Profile Themes</h2>
              <p class="text-xs text-on-surface-variant font-bold">Equip custom backgrounds and badge styles for ${currentHero.name}</p>
            </div>
          </div>

          <button id="profile-shop-themes-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2 rounded-xl chunky-btn-sm flex items-center gap-1.5 active:scale-95 hover:brightness-110 shadow">
            <span class="material-symbols-outlined text-sm">storefront</span>
            Shop Themes
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-1">
          ${profileThemes.map(theme => {
            const isUnlocked = unlockedThemes.includes(theme.id);
            const isEquipped = currentHero.equippedProfileTheme === theme.id;

            return `
              <div class="bg-gradient-to-br ${theme.bgGradient} rounded-3xl p-4 border-2 ${isEquipped ? 'border-primary shadow-[0_0_16px_rgba(46,204,113,0.5)] ring-2 ring-primary' : 'border-white/10'} flex flex-col justify-between gap-3 text-left">
                <div class="flex items-start justify-between">
                  <div class="w-10 h-10 rounded-xl bg-surface-container/60 backdrop-blur-md flex items-center justify-center text-xl shadow" style="color: ${theme.primaryColor};">
                    <span class="material-symbols-outlined">${theme.badgeIcon}</span>
                  </div>
                  
                  ${isEquipped ? `
                    <span class="bg-primary text-on-primary font-headline text-[9px] font-black px-2 py-0.5 rounded-full uppercase shadow">
                      Active Theme
                    </span>
                  ` : isUnlocked ? `
                    <span class="bg-white/20 text-white font-headline text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                      Unlocked
                    </span>
                  ` : `
                    <span class="bg-secondary/30 text-secondary border border-secondary/50 font-headline text-[10px] font-black px-2 py-0.5 rounded-full">
                      🪙 ${theme.costCoins}
                    </span>
                  `}
                </div>

                <div>
                  <h3 class="font-headline text-sm font-black text-white">${theme.name}</h3>
                  <p class="text-[11px] text-white/70 font-medium line-clamp-2">${theme.desc}</p>
                </div>

                <div class="pt-2 border-t border-white/15 flex items-center justify-between">
                  <span class="text-[9px] font-black text-white/50 uppercase">${theme.bannerPattern} Skin</span>
                  
                  ${isEquipped ? `
                    <button class="bg-surface-container/50 text-white/40 text-xs font-black px-3 py-1.5 rounded-xl cursor-default">
                      Equipped
                    </button>
                  ` : isUnlocked ? `
                    <button data-equip-theme-id="${theme.id}" class="profile-equip-theme-btn bg-primary text-on-primary font-headline text-xs font-black px-4 py-1.5 rounded-xl chunky-btn-sm hover:brightness-110 active:scale-95 shadow">
                      Equip
                    </button>
                  ` : `
                    <button data-buy-theme-id="${theme.id}" class="profile-buy-theme-btn bg-secondary text-on-secondary font-headline text-xs font-black px-3.5 py-1.5 rounded-xl chunky-btn-sm hover:brightness-110 active:scale-95 shadow flex items-center gap-1">
                      <span>Unlock</span>
                      <span class="text-[10px]">🪙 ${theme.costCoins}</span>
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Quick Action: Open Parent Portal -->
      <div class="flex justify-center pt-1">
        <button id="profile-parent-portal-btn" class="bg-surface-container-high hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-6 py-3.5 rounded-2xl border-2 border-dashed border-outline-variant flex items-center gap-2 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-xl">shield_person</span>
          <span>Open Parent Portal (Safety, Sliders & Learning Levels)</span>
        </button>
      </div>

    </div>
  `;
}

export function attachProfileListeners() {
  const backBtn = document.getElementById('profile-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate(store.getState().previousView || 'dashboard');
    });
  }

  const shopThemesBtn = document.getElementById('profile-shop-themes-btn');
  if (shopThemesBtn) {
    shopThemesBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate('shop');
    });
  }

  const parentBtn = document.getElementById('profile-parent-portal-btn');
  if (parentBtn) {
    parentBtn.addEventListener('click', () => {
      Sound.click();
      window.dispatchEvent(new CustomEvent('open-parent-modal'));
    });
  }

  // Switch hero
  document.querySelectorAll('.select-hero-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hId = btn.getAttribute('data-hero-id');
      if (hId) {
        store.switchHero(hId);
      }
    });
  });

  // Equip unlocked theme
  document.querySelectorAll('.profile-equip-theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const themeId = btn.getAttribute('data-equip-theme-id');
      if (themeId) {
        store.equipProfileTheme(themeId);
      }
    });
  });

  // Buy locked theme directly
  document.querySelectorAll('.profile-buy-theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const themeId = btn.getAttribute('data-buy-theme-id');
      if (themeId) {
        store.buyProfileTheme(themeId);
      }
    });
  });
}
