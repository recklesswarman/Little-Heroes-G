import { store } from '../state/store.js';
import { PETS_DATABASE } from '../data/petsData.js';
import { Sound } from '../audio/sfx.js';

let selectedFusePet1 = 1;
let selectedFusePet2 = 2;

export function renderMasterFuseView() {
  const state = store.getState();

  // Find pets that are stage 4 (or available for fusion)
  const maxedPets = PETS_DATABASE; // Available in roster

  const pet1 = PETS_DATABASE.find(p => p.id === selectedFusePet1) || PETS_DATABASE[0];
  const pet2 = PETS_DATABASE.find(p => p.id === selectedFusePet2) || PETS_DATABASE[1];

  return `
    <div class="max-w-3xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in">
      
      <!-- Header -->
      <div class="flex items-center justify-between">
        <button id="fuse-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm">
          <span class="material-symbols-outlined text-base">arrow_back</span> Back to Pen
        </button>
        <div class="flex flex-col items-end">
          <h1 class="font-headline text-2xl font-black text-secondary text-shadow">Master Fuse Lab</h1>
          <span class="text-xs font-bold text-primary">Combine 2 Level 4 Pets</span>
        </div>
      </div>

      <!-- Fusion Chamber Stage -->
      <div class="relative bg-gradient-to-b from-[#1c2331] via-[#121d26] to-[#09141e] rounded-3xl p-6 border-4 border-secondary/50 min-h-[340px] card-shadow flex flex-col items-center justify-between overflow-hidden">
        
        <!-- Energy Beams -->
        <div class="absolute inset-0 bg-radial from-secondary/15 via-transparent to-transparent pointer-events-none"></div>

        <div class="w-full flex justify-between items-center text-xs font-black uppercase text-on-surface-variant z-10">
          <span>Slot 1: ${pet1.name}</span>
          <span class="text-secondary animate-pulse">⚡ Fusion Matrix Active ⚡</span>
          <span>Slot 2: ${pet2.name}</span>
        </div>

        <!-- The Two Fusion Pedestals -->
        <div class="flex items-center justify-center gap-4 sm:gap-8 my-4 z-10">
          
          <!-- Pet 1 Vessel -->
          <div class="flex flex-col items-center gap-2">
            <div class="w-28 h-28 rounded-3xl bg-surface-container border-3 border-primary flex items-center justify-center p-3 shadow-lg animate-float">
              <img class="w-full h-full object-contain" src="${pet1.avatar}" alt="${pet1.name}" />
            </div>
            <select id="fuse-select-1" class="bg-surface-container-high text-xs font-bold text-inverse-surface rounded-xl px-2 py-1 border border-surface-container-highest">
              ${maxedPets.map(p => `<option value="${p.id}" ${p.id === selectedFusePet1 ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
          </div>

          <!-- Fusion Core Spark -->
          <div class="w-16 h-16 rounded-full bg-secondary-container/40 border-3 border-secondary flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(255,185,97,0.5)] animate-pulse">
            <span class="material-symbols-outlined text-3xl text-secondary">all_inclusive</span>
          </div>

          <!-- Pet 2 Vessel -->
          <div class="flex flex-col items-center gap-2">
            <div class="w-28 h-28 rounded-3xl bg-surface-container border-3 border-tertiary flex items-center justify-center p-3 shadow-lg animate-float" style="animation-delay: 0.5s;">
              <img class="w-full h-full object-contain" src="${pet2.avatar}" alt="${pet2.name}" />
            </div>
            <select id="fuse-select-2" class="bg-surface-container-high text-xs font-bold text-inverse-surface rounded-xl px-2 py-1 border border-surface-container-highest">
              ${maxedPets.map(p => `<option value="${p.id}" ${p.id === selectedFusePet2 ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
          </div>

        </div>

        <!-- Fusion Trigger Button -->
        <button id="fuse-trigger-btn" class="w-full max-w-sm bg-gradient-to-r from-secondary to-primary text-on-primary font-headline text-base font-black py-4 rounded-2xl chunky-btn border-secondary-container shadow-chunky-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 z-10">
          <span class="material-symbols-outlined text-2xl">auto_awesome</span>
          IGNITE MASTER FUSION!
        </button>

      </div>

      <!-- Lore & Info Box -->
      <div class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col gap-2">
        <h3 class="font-headline text-sm font-black text-inverse-surface uppercase tracking-wider flex items-center gap-2">
          <span class="material-symbols-outlined text-secondary">science</span> The Power of Fusion
        </h3>
        <p class="text-xs text-on-surface-variant leading-relaxed">
          Combining two fully evolved Level 4 companion pets merges their elements and unlocks a permanent Hybrid Ascendant Pet with maxed out stats and the <strong>Master Synergy</strong> global chore buff!
        </p>
      </div>

    </div>
  `;
}

export function attachMasterFuseListeners() {
  const backBtn = document.getElementById('fuse-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => store.navigate('pet_pen'));
  }

  const select1 = document.getElementById('fuse-select-1');
  if (select1) {
    select1.addEventListener('change', (e) => {
      selectedFusePet1 = parseInt(e.target.value);
      store.notify();
    });
  }

  const select2 = document.getElementById('fuse-select-2');
  if (select2) {
    select2.addEventListener('change', (e) => {
      selectedFusePet2 = parseInt(e.target.value);
      store.notify();
    });
  }

  const fuseBtn = document.getElementById('fuse-trigger-btn');
  if (fuseBtn) {
    fuseBtn.addEventListener('click', () => {
      if (selectedFusePet1 === selectedFusePet2) {
        Sound.hit();
        store.showReward('Choose 2 Different Pets', 'Please select two distinct companion pets to combine their essences!', 0, 0);
        return;
      }
      store.masterFusePets(selectedFusePet1, selectedFusePet2);
    });
  }
}
