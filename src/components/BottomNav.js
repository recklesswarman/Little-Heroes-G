import { store } from '../state/store.js';

export function renderBottomNav() {
  const state = store.getState();
  const activeView = state.activeView;

  const navItems = [
    { id: 'dashboard', label: 'Quests', icon: 'swords', color: 'primary' },
    { id: 'quest_map', label: 'Map', icon: 'map', color: 'secondary' },
    { id: 'pet_pen', label: 'Pet Pen', icon: 'pets', color: 'tertiary' },
    { id: 'shop', label: 'Shop', icon: 'storefront', color: 'secondary' },
    { id: 'dance_party', label: 'Arcade', icon: 'sports_esports', color: 'primary' }
  ];

  return `
    <nav class="bg-surface-container/95 backdrop-blur-lg fixed bottom-0 left-0 right-0 border-t-4 border-surface-container-highest shadow-[0_-8px_20px_rgba(0,0,0,0.5)] z-40 px-2 py-2 select-none">
      <div class="max-w-xl mx-auto grid grid-cols-5 gap-1 items-center">
        ${navItems
          .map((item) => {
            const isTabActive =
              activeView === item.id ||
              (item.id === 'pet_pen' && ['pet_roster', 'pet_detail', 'pet_bath', 'pet_locker', 'evolution', 'master_fuse', 'adventures_map'].includes(activeView)) ||
              (item.id === 'dashboard' && ['profile', 'ar_battle'].includes(activeView));

            return `
            <button data-nav-id="${item.id}" class="nav-tab-btn flex flex-col items-center justify-center py-1.5 rounded-2xl transition-all active:scale-90 ${
              isTabActive
                ? 'bg-surface-container-high text-primary -translate-y-1 shadow-chunky-sm border-2 border-primary/40'
                : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high/50'
            }">
              <span class="material-symbols-outlined text-2xl transition-transform ${isTabActive ? 'scale-110' : ''}" style="font-variation-settings: 'FILL' ${
              isTabActive ? '1' : '0'
            };">
                ${item.icon}
              </span>
              <span class="font-headline text-[11px] font-black tracking-tight leading-tight mt-0.5">
                ${item.label}
              </span>
            </button>
          `;
          })
          .join('')}
      </div>
    </nav>
  `;
}

export function attachBottomNavListeners() {
  document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const viewId = btn.getAttribute('data-nav-id');
      store.navigate(viewId);
    });
  });
}
