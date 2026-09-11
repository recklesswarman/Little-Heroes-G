import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { voicePrompts } from '../utils/voicePrompts.js';
import {
  EXPEDITION_BIOMES,
  EXPEDITION_DURATIONS,
  EXPEDITION_ARTIFACTS,
  getExpeditionBiome,
  getExpeditionDuration,
  calculateExpeditionAffinity
} from '../data/petExpeditionsData.js';

// =========================================================================
// PET EXPEDITIONS & SOUVENIR SHELF MODAL COMPONENT
// =========================================================================

export function renderPetExpeditionsModal() {
  const state = store.getState();
  const modal = state.expeditionModal || { isOpen: false, selectedPetId: null, selectedBiomeId: 'fern_woods', selectedDuration: 15, snackPacked: false, activeTab: 'dispatch' };
  
  if (!modal.isOpen) return '';

  const hero = state.selectedHero || {};
  const heroLevel = hero.level || 1;
  const maxSlots = heroLevel >= 3 ? 2 : 1;
  const activeExpeditions = state.activeExpeditions || [];
  const expeditionHistory = state.expeditionHistory || [];
  const artifacts = state.unlockedArtifacts || [];
  const activeTab = modal.activeTab || 'dispatch';

  const unlockedPetIds = hero.unlockedPetIds || [1];
  const activePetIds = activeExpeditions.map(e => e.petId);
  const idlePets = state.pets.filter(p => unlockedPetIds.includes(p.id) && !activePetIds.includes(p.id));

  const selectedPet = state.pets.find(p => p.id === modal.selectedPetId) || idlePets[0] || state.pets[0];
  const selectedBiome = getExpeditionBiome(modal.selectedBiomeId);
  const affinity = calculateExpeditionAffinity(selectedPet, selectedBiome.id);

  return `
    <div id="pet-expeditions-modal-backdrop" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in select-none">
      
      <div class="relative bg-surface-container rounded-3xl border-2 border-surface-container-highest shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
        
        <!-- MODAL HEADER -->
        <div class="bg-surface-container-high px-5 py-4 border-b border-surface-container-highest flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-2xl shadow-inner">
              🧭
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-headline text-base sm:text-lg font-black text-on-surface">Pet Expeditions Camp</h2>
                <span class="bg-primary/20 text-primary text-[10px] font-black px-2 py-0.5 rounded-full border border-primary/40">
                  Slots: ${activeExpeditions.length}/${maxSlots}
                </span>
              </div>
              <p class="text-xs text-on-surface-variant font-medium">Send companion pets on foraging journeys to bring back sparks, gear & postcards!</p>
            </div>
          </div>

          <button id="close-expedition-modal-btn" class="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-bright border border-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface active:scale-95 transition-all">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <!-- TABS BAR -->
        <div class="flex border-b border-surface-container-highest bg-surface-container-lowest/50 px-4 pt-2 gap-2">
          <button data-tab="dispatch" class="expedition-tab-btn px-4 py-2 text-xs font-black rounded-t-2xl transition-all flex items-center gap-1.5 ${activeTab === 'dispatch' ? 'bg-surface-container text-primary border-t-2 border-x-2 border-surface-container-highest shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}">
            <span>🎒</span> Dispatch Expedition
          </button>
          
          <button data-tab="active" class="expedition-tab-btn px-4 py-2 text-xs font-black rounded-t-2xl transition-all flex items-center gap-1.5 ${activeTab === 'active' ? 'bg-surface-container text-primary border-t-2 border-x-2 border-surface-container-highest shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}">
            <span>🗺️</span> Active Travelers (${activeExpeditions.length})
            ${activeExpeditions.some(e => e.endTime <= Date.now()) ? '<span class="w-2 h-2 rounded-full bg-primary animate-ping"></span>' : ''}
          </button>

          <button data-tab="shelf" class="expedition-tab-btn px-4 py-2 text-xs font-black rounded-t-2xl transition-all flex items-center gap-1.5 ${activeTab === 'shelf' ? 'bg-surface-container text-primary border-t-2 border-x-2 border-surface-container-highest shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}">
            <span>💌</span> Souvenir & Postcard Shelf (${expeditionHistory.length})
          </button>
        </div>

        <!-- TAB CONTENT CONTAINER -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">

          ${activeTab === 'dispatch' ? renderDispatchTab(modal, idlePets, selectedPet, selectedBiome, affinity, maxSlots, activeExpeditions.length) : ''}

          ${activeTab === 'active' ? renderActiveTab(activeExpeditions) : ''}

          ${activeTab === 'shelf' ? renderShelfTab(expeditionHistory, artifacts) : ''}

        </div>

        <!-- FOOTER: CHORE TURBO BOOST HINT -->
        <div class="bg-surface-container-high px-4 py-3 border-t border-surface-container-highest flex items-center justify-between text-xs text-on-surface-variant">
          <div class="flex items-center gap-1.5">
            <span class="text-base">🚀</span>
            <span class="font-bold text-[11px]">Chore Turbo Boost: Completing any real-life habit or chore cuts 15 mins off all traveling pets!</span>
          </div>
          <span class="text-[10px] font-black text-secondary uppercase tracking-wider hidden sm:inline">Automatic Sync</span>
        </div>

      </div>

    </div>
  `;
}

function renderDispatchTab(modal, idlePets, selectedPet, selectedBiome, affinity, maxSlots, currentActiveCount) {
  const isSlotFull = currentActiveCount >= maxSlots;

  return `
    <div class="flex flex-col gap-4">
      
      ${isSlotFull ? `
        <div class="bg-amber-500/15 border-2 border-amber-500/40 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-amber-300">
          <span class="text-2xl">⏳</span>
          <div>
            <div class="font-headline font-black">All Expedition Slots Occupied (${currentActiveCount}/${maxSlots})</div>
            <div class="text-[11px] opacity-90 mt-0.5">Wait for your traveling pets to return, or complete a chore to speed them up! (Reach Level 3 to unlock Slot 2)</div>
          </div>
        </div>
      ` : ''}

      <!-- STEP 1: CHOOSE BIOME -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black uppercase text-on-surface tracking-wider flex items-center gap-1.5">
            <span class="material-symbols-outlined text-base text-primary">public</span> 1. Select Expedition Biome:
          </span>
          <span class="text-[10px] text-on-surface-variant font-bold">4 Unique Biomes</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          ${EXPEDITION_BIOMES.map(b => {
            const isSelected = b.id === selectedBiome.id;
            return `
              <div data-biome-id="${b.id}" class="expedition-biome-card cursor-pointer bg-surface-container-high rounded-2xl p-3 border-2 transition-all flex flex-col justify-between gap-1.5 ${isSelected ? b.accentBorder + ' bg-gradient-to-b ' + b.gradient + ' scale-[1.02] shadow-md' : 'border-surface-container-highest hover:border-white/30'}">
                <div class="flex items-center justify-between">
                  <span class="text-2xl">${b.emoji}</span>
                  ${isSelected ? '<span class="material-symbols-outlined text-xs text-primary">check_circle</span>' : ''}
                </div>
                <div class="font-headline text-xs font-black text-on-surface leading-tight mt-1">${b.name}</div>
                <div class="text-[9px] text-on-surface-variant line-clamp-1">${b.description}</div>
                <div class="text-[9px] font-bold text-primary mt-1">+${b.baseSparks} Base Sparks</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- STEP 2: SELECT IDLE PET -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black uppercase text-on-surface tracking-wider flex items-center gap-1.5">
            <span class="material-symbols-outlined text-base text-secondary">pets</span> 2. Select Exploring Pet:
          </span>
          <span class="text-[10px] text-on-surface-variant font-bold">${idlePets.length} Idle Companion(s)</span>
        </div>

        ${idlePets.length === 0 ? `
          <div class="bg-surface-container-high rounded-2xl p-3 text-center text-xs text-on-surface-variant">
            All your unlocked pets are currently out exploring!
          </div>
        ` : `
          <div class="flex items-center gap-2 overflow-x-auto pb-1.5">
            ${idlePets.map(p => {
              const isSelected = p.id === selectedPet?.id;
              const aff = calculateExpeditionAffinity(p, selectedBiome.id);
              return `
                <div data-pet-id="${p.id}" class="expedition-pet-select-card cursor-pointer flex-shrink-0 bg-surface-container-high rounded-2xl p-2.5 border-2 transition-all flex items-center gap-2 ${isSelected ? 'border-secondary ring-2 ring-secondary/40 bg-secondary/15' : 'border-surface-container-highest hover:border-white/20'}">
                  <img src="${p.avatar}" alt="${p.name}" class="w-9 h-9 rounded-xl object-contain bg-black/20" />
                  <div class="flex flex-col text-left">
                    <span class="font-headline text-xs font-black text-on-surface leading-tight">${p.name}</span>
                    <span class="text-[9px] text-on-surface-variant">${p.element}</span>
                    ${aff.hasAffinity ? '<span class="text-[8px] font-black text-amber-300">🌟 Affinity Match!</span>' : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- AFFINITY BADGE BANNER -->
      <div class="bg-surface-container-high rounded-2xl p-3 border border-surface-container-highest flex items-center justify-between text-xs">
        <div class="flex items-center gap-2">
          <span class="text-lg">${selectedBiome.emoji}</span>
          <div>
            <div class="font-bold text-on-surface">${selectedPet?.name} + ${selectedBiome.name}</div>
            <div class="${affinity.hasAffinity ? 'text-amber-300 font-black' : 'text-on-surface-variant'} text-[11px]">${affinity.label}</div>
          </div>
        </div>
        ${affinity.hasAffinity ? '<span class="bg-amber-400/20 text-amber-300 text-[9px] font-black px-2.5 py-1 rounded-full border border-amber-400/40 animate-pulse">LUCKY MATCH!</span>' : ''}
      </div>

      <!-- STEP 3: DURATION & SNACK PACKING -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        
        <!-- Duration Selector -->
        <div class="flex flex-col gap-1.5">
          <span class="text-xs font-black uppercase text-on-surface tracking-wider">3. Expedition Duration:</span>
          <div class="grid grid-cols-3 gap-2">
            ${EXPEDITION_DURATIONS.map(d => {
              const isSelected = modal.selectedDuration === d.minutes;
              return `
                <button data-duration="${d.minutes}" class="expedition-duration-btn p-2.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center ${isSelected ? 'border-primary bg-primary/15 text-primary' : 'border-surface-container-highest bg-surface-container-high text-on-surface-variant hover:text-on-surface'}">
                  <span class="text-base">${d.emoji}</span>
                  <span class="font-headline text-xs font-black mt-0.5">${d.minutes}m</span>
                  <span class="text-[8px] opacity-80">${d.label.split(' ')[0]}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Snack Rations Toggle -->
        <div class="flex flex-col gap-1.5">
          <span class="text-xs font-black uppercase text-on-surface tracking-wider">4. Pack Expedition Snack:</span>
          <label class="bg-surface-container-high rounded-2xl p-2.5 border border-surface-container-highest flex items-center justify-between cursor-pointer hover:border-white/20">
            <div class="flex items-center gap-2">
              <span class="text-xl">🍎</span>
              <div>
                <div class="font-headline text-xs font-black text-on-surface">Sweet Apple Snack</div>
                <div class="text-[10px] text-primary font-bold">+20% Speed & Bonus Drops</div>
              </div>
            </div>
            <input type="checkbox" id="pack-snack-checkbox" class="w-4 h-4 rounded text-primary accent-primary" ${modal.snackPacked ? 'checked' : ''} />
          </label>
        </div>

      </div>

      <!-- DISPATCH ACTION BUTTON -->
      <button id="start-expedition-submit-btn" ${isSlotFull || !selectedPet ? 'disabled' : ''} class="w-full bg-primary text-on-primary font-headline text-sm font-black py-3.5 rounded-2xl chunky-btn border-primary-container shadow-chunky-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
        <span class="material-symbols-outlined text-xl">send</span>
        DISPATCH ${selectedPet?.name.toUpperCase() || 'PET'} TO ${selectedBiome.name.toUpperCase()}!
      </button>

    </div>
  `;
}

function renderActiveTab(activeExpeditions) {
  if (activeExpeditions.length === 0) {
    return `
      <div class="py-12 flex flex-col items-center justify-center text-center gap-3">
        <div class="w-16 h-16 rounded-3xl bg-surface-container-high border-2 border-surface-container-highest flex items-center justify-center text-3xl">
          🏕️
        </div>
        <div>
          <h3 class="font-headline text-base font-black text-on-surface">No Pets Currently Exploring</h3>
          <p class="text-xs text-on-surface-variant mt-1 max-w-xs">All your companion pets are safe in the pen. Switch to the Dispatch tab to send a pet on an adventure!</p>
        </div>
        <button id="switch-to-dispatch-btn" class="bg-primary text-on-primary font-headline text-xs font-black px-5 py-2.5 rounded-2xl chunky-btn border-primary-container shadow-sm mt-2">
          Dispatch a Pet Now
        </button>
      </div>
    `;
  }

  const now = Date.now();

  return `
    <div class="flex flex-col gap-3">
      <div class="text-xs font-black uppercase text-on-surface tracking-wider">
        Currently Exploring Companion Pets (${activeExpeditions.length}):
      </div>

      ${activeExpeditions.map(exp => {
        const isReady = exp.endTime <= now;
        const remainingMs = Math.max(0, exp.endTime - now);
        const remMins = Math.floor(remainingMs / 60000);
        const remSecs = Math.floor((remainingMs % 60000) / 1000);
        const timeStr = `${remMins}m ${remSecs.toString().padStart(2, '0')}s`;

        const totalMs = exp.durationMinutes * 60 * 1000;
        const elapsedMs = totalMs - remainingMs;
        const progressPct = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

        return `
          <div class="bg-surface-container-high rounded-3xl p-4 border-2 border-surface-container-highest card-shadow flex flex-col gap-3">
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <img src="${exp.petAvatar}" alt="${exp.petName}" class="w-12 h-12 rounded-2xl bg-black/30 border border-white/10 object-contain p-1" />
                <div>
                  <div class="flex items-center gap-1.5">
                    <h3 class="font-headline text-sm font-black text-on-surface">${exp.petName}</h3>
                    <span class="text-sm">${exp.biomeEmoji}</span>
                    ${exp.affinityBonus ? '<span class="text-[9px] font-black text-amber-300 bg-amber-400/15 px-2 py-0.5 rounded-full border border-amber-400/30">🌟 Affinity Match</span>' : ''}
                  </div>
                  <div class="text-xs text-on-surface-variant font-medium">Exploring: <span class="font-bold text-primary">${exp.biomeName}</span></div>
                </div>
              </div>

              <!-- Status Badge -->
              ${isReady ? `
                <span class="bg-primary/20 text-primary border border-primary/50 text-xs font-black px-3 py-1 rounded-full animate-bounce">
                  🎉 READY TO CLAIM!
                </span>
              ` : `
                <div class="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full border border-white/10 text-xs font-black text-secondary">
                  <span class="material-symbols-outlined text-sm animate-spin">schedule</span>
                  <span>${timeStr}</span>
                </div>
              `}
            </div>

            <!-- Visual Exploration Trail Progress Bar -->
            <div class="flex flex-col gap-1">
              <div class="flex justify-between text-[10px] font-bold text-on-surface-variant">
                <span>🏕️ Camp</span>
                <span class="text-primary font-black">${progressPct}% Traveled</span>
                <span>${exp.biomeEmoji} ${exp.biomeName.split(' ')[0]}</span>
              </div>
              <div class="w-full h-3 bg-black/60 rounded-full border border-white/10 overflow-hidden p-0.5">
                <div class="h-full bg-gradient-to-r from-primary via-secondary to-accent rounded-full transition-all duration-300" style="width: ${progressPct}%;"></div>
              </div>
            </div>

            <!-- ACTION BUTTONS -->
            <div class="flex items-center justify-between gap-2 pt-1">
              ${isReady ? `
                <button data-claim-id="${exp.id}" class="claim-expedition-btn w-full bg-primary text-on-primary font-headline text-xs font-black py-3 rounded-2xl chunky-btn border-primary-container shadow-md flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-95">
                  <span class="material-symbols-outlined text-base">celebration</span>
                  WELCOME ${exp.petName.toUpperCase()} HOME & OPEN SOUVENIRS!
                </button>
              ` : `
                <div class="text-[11px] text-on-surface-variant flex items-center gap-1">
                  <span>💡 Complete a chore to speed up this trip by 15m!</span>
                </div>
                <button data-recall-id="${exp.id}" class="recall-expedition-btn bg-surface-container hover:bg-surface-bright text-error font-headline text-[10px] font-bold px-3 py-1.5 rounded-xl border border-error/30 active:scale-95">
                  Whistle Home
                </button>
              `}
            </div>

          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderShelfTab(expeditionHistory, artifacts) {
  return `
    <div class="flex flex-col gap-5">
      
      <!-- ARTIFACTS SOUVENIR SHELF -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black uppercase text-on-surface tracking-wider flex items-center gap-1.5">
            <span class="material-symbols-outlined text-base text-amber-400">shelves</span> Collectible Souvenir Shelf (${artifacts.length}/4):
          </span>
          <span class="text-[10px] text-on-surface-variant font-bold">Rare Treasures</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          ${EXPEDITION_ARTIFACTS.map(art => {
            const isUnlocked = artifacts.some(a => a.id === art.id);
            return `
              <div class="bg-surface-container-high rounded-2xl p-3 border ${isUnlocked ? 'border-amber-400/40 bg-amber-500/10 shadow-sm' : 'border-surface-container-highest opacity-60'} flex flex-col justify-between gap-2">
                <div class="flex items-center justify-between">
                  <span class="text-2xl">${art.emoji}</span>
                  <span class="text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${isUnlocked ? 'bg-amber-400/20 text-amber-300' : 'bg-black/40 text-white/40'}">${art.rarity}</span>
                </div>
                <div>
                  <div class="font-headline text-xs font-black text-on-surface leading-tight">${art.name}</div>
                  <div class="text-[9px] text-on-surface-variant line-clamp-2 mt-0.5">${art.desc}</div>
                </div>
                <div class="text-[8px] font-bold text-on-surface-variant ${isUnlocked ? 'text-primary' : ''}">
                  ${isUnlocked ? '✓ Collected' : 'Not yet discovered'}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- POSTCARD JOURNAL GALLERY -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black uppercase text-on-surface tracking-wider flex items-center gap-1.5">
            <span class="material-symbols-outlined text-base text-primary">mail</span> Illustrated Postcard Journal (${expeditionHistory.length}):
          </span>
          <span class="text-[10px] text-on-surface-variant font-bold">Chronicles</span>
        </div>

        ${expeditionHistory.length === 0 ? `
          <div class="bg-surface-container-high rounded-2xl p-6 text-center text-xs text-on-surface-variant">
            No postcards received yet! Send your companion pets on expeditions to receive colorful letters and souvenirs.
          </div>
        ` : `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${expeditionHistory.map(item => {
              const post = item.postcard;
              if (!post) return '';
              return `
                <div class="relative bg-gradient-to-br from-amber-100 to-amber-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl p-4 border-2 border-amber-300/40 dark:border-white/10 card-shadow flex flex-col justify-between gap-3 font-sans">
                  
                  <!-- Postcard Header Stamp -->
                  <div class="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2">
                    <div class="flex items-center gap-2">
                      <span class="text-xl">${post.biomeEmoji}</span>
                      <span class="font-headline text-xs font-black truncate max-w-[160px]">${post.title}</span>
                    </div>
                    <div class="w-8 h-8 rounded-lg bg-amber-200 dark:bg-slate-700 border border-amber-400 flex items-center justify-center text-sm shadow-inner">
                      📮
                    </div>
                  </div>

                  <p class="text-xs italic leading-relaxed text-slate-700 dark:text-slate-300">
                    "${post.story}"
                  </p>

                  <div class="flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    <span>From: <b>${post.petName}</b></span>
                    <span>${post.dateString}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

    </div>
  `;
}

// =========================================================================
// EVENT LISTENERS & ATTACHMENT
// =========================================================================

export function attachPetExpeditionsListeners() {
  const backdrop = document.getElementById('pet-expeditions-modal-backdrop');
  const closeBtn = document.getElementById('close-expedition-modal-btn');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      store.closeExpeditionModal();
    });
  }

  // Tab buttons
  const tabBtns = document.querySelectorAll('.expedition-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) {
        Sound.tap();
        store.setExpeditionModalTab(tab);
      }
    });
  });

  const switchToDispatchBtn = document.getElementById('switch-to-dispatch-btn');
  if (switchToDispatchBtn) {
    switchToDispatchBtn.addEventListener('click', () => {
      store.setExpeditionModalTab('dispatch');
    });
  }

  // Biome Cards
  const biomeCards = document.querySelectorAll('.expedition-biome-card');
  biomeCards.forEach(card => {
    card.addEventListener('click', () => {
      const bId = card.getAttribute('data-biome-id');
      if (bId && store.state.expeditionModal) {
        Sound.tap();
        store.state.expeditionModal.selectedBiomeId = bId;
        store.notify();
      }
    });
  });

  // Pet Select Cards
  const petCards = document.querySelectorAll('.expedition-pet-select-card');
  petCards.forEach(card => {
    card.addEventListener('click', () => {
      const pId = Number(card.getAttribute('data-pet-id'));
      if (pId && store.state.expeditionModal) {
        Sound.tap();
        store.state.expeditionModal.selectedPetId = pId;
        store.notify();
      }
    });
  });

  // Duration Buttons
  const durBtns = document.querySelectorAll('.expedition-duration-btn');
  durBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = Number(btn.getAttribute('data-duration'));
      if (mins && store.state.expeditionModal) {
        Sound.tap();
        store.state.expeditionModal.selectedDuration = mins;
        store.notify();
      }
    });
  });

  // Snack checkbox
  const snackCheck = document.getElementById('pack-snack-checkbox');
  if (snackCheck) {
    snackCheck.addEventListener('change', () => {
      if (store.state.expeditionModal) {
        store.state.expeditionModal.snackPacked = snackCheck.checked;
      }
    });
  }

  // Submit start expedition
  const submitBtn = document.getElementById('start-expedition-submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const modal = store.state.expeditionModal;
      if (!modal || !modal.selectedPetId) return;

      const pet = (store.state.pets || []).find(p => p.id === modal.selectedPetId);
      const biome = getExpeditionBiome(modal.selectedBiomeId);

      const res = store.startPetExpedition(
        modal.selectedPetId,
        modal.selectedBiomeId,
        modal.selectedDuration,
        modal.snackPacked
      );

      if (res.success) {
        Sound.fanfare();
        voicePrompts.speakExpeditionDepart(pet?.name || 'Your companion', biome?.name || 'the wilderness');
      }
    });
  }

  // Claim Rewards buttons
  const claimBtns = document.querySelectorAll('.claim-expedition-btn');
  claimBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const expId = btn.getAttribute('data-claim-id');
      if (expId) {
        const claimResult = store.claimExpeditionRewards(expId);
        if (claimResult && claimResult.pet) {
          voicePrompts.speakExpeditionReturn(
            claimResult.pet.name,
            claimResult.rewards?.artifactDropped?.name || ''
          );
        }
      }
    });
  });

  // Recall buttons
  const recallBtns = document.querySelectorAll('.recall-expedition-btn');
  recallBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const expId = btn.getAttribute('data-recall-id');
      if (expId) {
        store.recallPetExpedition(expId);
      }
    });
  });
}
