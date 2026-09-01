import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';

export function renderQuestMapView() {
  const state = store.getState();
  const nodes = state.mapNodes;

  return `
    <div class="max-w-3xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in">
      
      <!-- Top Title -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="font-headline text-2xl font-black text-inverse-surface text-shadow">Hero Quest Map</h1>
          <p class="text-xs font-semibold text-on-surface-variant">Conquer daily realms to reach the Sugar Fortress!</p>
        </div>
        <div class="bg-surface-container-high px-3 py-1.5 rounded-full border-2 border-surface-container-highest flex items-center gap-1.5">
          <span class="material-symbols-outlined text-secondary text-sm" style="font-variation-settings: 'FILL' 1;">stars</span>
          <span class="font-headline text-xs font-black text-secondary">8 / 15 Stars</span>
        </div>
      </div>

      <!-- Adventure Map Canvas Container -->
      <div class="relative bg-surface-container-low rounded-3xl p-6 border-4 border-surface-container-highest min-h-[460px] card-shadow flex flex-col justify-between overflow-hidden">
        
        <!-- Ambient Decorative Glowing Stars/Trees -->
        <div class="absolute inset-0 bg-gradient-to-b from-surface-container/60 via-transparent to-surface-container-lowest/80 pointer-events-none"></div>

        <!-- SVG Path connecting the Nodes -->
        <svg class="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
          <path d="M 80 380 Q 220 330 260 260 T 140 180 T 260 100 T 180 40" fill="none" stroke="#2b3640" stroke-width="8" stroke-linecap="round" stroke-dasharray="12 8" />
          <path d="M 80 380 Q 220 330 260 260 T 140 180" fill="none" stroke="#2ecc71" stroke-width="8" stroke-linecap="round" />
        </svg>

        <!-- Node List -->
        <div class="relative z-10 flex flex-col gap-8 py-4">
          
          <!-- Node 5: Boss Lair -->
          <div class="flex justify-center items-center">
            <button data-node-id="5" class="map-node-btn bg-error text-on-error rounded-3xl p-4 chunky-btn-lg border-error-container shadow-chunky-md flex items-center gap-3 active:scale-95 animate-pulse-glow">
              <span class="material-symbols-outlined text-3xl font-black">skull</span>
              <div class="flex flex-col text-left">
                <span class="text-[10px] font-black uppercase text-error-container">Boss Challenge</span>
                <span class="font-headline text-sm font-black text-white">Sugar Fortress</span>
              </div>
            </button>
          </div>

          <!-- Node 4: Cloud Summit -->
          <div class="flex justify-end pr-8">
            <button data-node-id="4" class="map-node-btn opacity-60 bg-surface-container-highest text-on-surface-variant rounded-2xl p-3 border-2 border-surface-container-low flex items-center gap-2">
              <span class="material-symbols-outlined text-xl">lock</span>
              <span class="text-xs font-bold">Cloud Summit</span>
            </button>
          </div>

          <!-- Node 3: Dragon Perch (Active) -->
          <div class="flex justify-start pl-6">
            <button data-node-id="3" class="map-node-btn bg-primary text-on-primary rounded-3xl p-4 chunky-btn border-primary-container shadow-chunky-md flex items-center gap-3 active:scale-95 animate-bounce-slow">
              <span class="material-symbols-outlined text-3xl font-black">pets</span>
              <div class="flex flex-col text-left">
                <span class="text-[10px] font-black uppercase text-primary-container">Current Quest</span>
                <span class="font-headline text-sm font-black text-on-primary">Dragon Perch</span>
              </div>
              <span class="material-symbols-outlined text-secondary text-xl">play_circle</span>
            </button>
          </div>

          <!-- Node 2: Crystal River (Completed) -->
          <div class="flex justify-end pr-10">
            <button data-node-id="2" class="map-node-btn bg-surface-container text-primary rounded-2xl p-3.5 border-2 border-primary/50 flex items-center gap-2 chunky-btn-sm">
              <span class="material-symbols-outlined text-2xl text-tertiary">water</span>
              <div class="flex flex-col text-left">
                <span class="font-headline text-xs font-bold text-inverse-surface">Crystal River</span>
                <div class="flex text-secondary text-xs">★★★</div>
              </div>
            </button>
          </div>

          <!-- Node 1: Hero Meadow (Completed) -->
          <div class="flex justify-start pl-8">
            <button data-node-id="1" class="map-node-btn bg-surface-container text-primary rounded-2xl p-3.5 border-2 border-primary/50 flex items-center gap-2 chunky-btn-sm">
              <span class="material-symbols-outlined text-2xl text-primary">eco</span>
              <div class="flex flex-col text-left">
                <span class="font-headline text-xs font-bold text-inverse-surface">Hero Meadow</span>
                <div class="flex text-secondary text-xs">★★★</div>
              </div>
            </button>
          </div>

        </div>

      </div>

      <!-- Quick Action: Go to AR Battle -->
      <div class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-error/20 text-error flex items-center justify-center border-b-4 border-error/40">
            <span class="material-symbols-outlined text-2xl">swords</span>
          </div>
          <div>
            <h3 class="font-headline text-base font-bold text-inverse-surface">Defeat Sugar Bugs</h3>
            <p class="text-xs text-on-surface-variant">Daily habit boss battle awaits!</p>
          </div>
        </div>
        <button id="map-battle-btn" class="bg-primary text-on-primary font-headline text-xs font-black px-4 py-3 rounded-xl chunky-btn border-primary-container">
          FIGHT BOSS!
        </button>
      </div>

    </div>
  `;
}

export function attachQuestMapListeners() {
  document.querySelectorAll('.map-node-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nodeId = btn.getAttribute('data-node-id');
      Sound.click();
      if (nodeId === '5') {
        store.navigate('ar_battle');
      } else if (nodeId === '3') {
        store.navigate('pet_pen');
      } else if (nodeId === '4') {
        store.showReward('Summit Locked', 'Complete your Dragon Perch habits to unlock the Cloud Summit!', 0, 0);
      } else {
        store.showReward('Realm Cleared!', 'You earned 3 Stars in this realm! Excellent hero work!', 10, 15);
      }
    });
  });

  const battleBtn = document.getElementById('map-battle-btn');
  if (battleBtn) {
    battleBtn.addEventListener('click', () => {
      store.navigate('ar_battle');
    });
  }
}
