/**
 * PetSanctuaryView.js
 * 
 * 3D Living Pet Sanctuary & Playpark
 * Unified, kid-friendly companion habitat built with the Adventurous Explorer design system.
 * Zero pink or purple: Emerald Green (#2ecc71), Solar Orange (#f39c12), Amber (#ffb961),
 * Starlight Cyan (#00d2d3), and Midnight Slate (#09141e).
 */

import { store } from '../state/store.js';
import { PETS_DATABASE, SANCTUARY_TREATS, getPetArchetype, getPetBondBonus, getPetById } from '../data/petsData.js';
import { PetSanctuaryCanvas } from '../components/PetSanctuaryCanvas.js';
import { Sound } from '../audio/sfx.js';

let activeCanvasInstance = null;
let eggCrackTaps = {}; // { [eggId]: tapCount }

export function renderPetSanctuaryView() {
  const state = store.getState();
  const hero = state.selectedHero || {};
  const activePetId = hero.activePetId || '2';
  const activePet = getPetById(activePetId) || PETS_DATABASE[0] || { id: '2', name: 'Sparky', archetype: 'dragon', color: '#2ecc71', stage: 1 };
  const archetype = getPetArchetype(activePet);

  const sanctuaryState = store.getPetSanctuaryState();
  const bondState = store.getPetBondState(activePet.id);
  const isPearly = store.getPearlyGleamStatus(activePet.id);
  const activeDrawer = sanctuaryState.activeDrawer; // null | 'feed' | 'bath' | 'wardrobe' | 'evolution' | 'roster'
  const unhatchedEggs = sanctuaryState.unhatchedEggs || [];
  const sparks = hero.sparks || hero.evolutionSparks || 45;

  // Active Pet Needs
  const needs = (sanctuaryState.petNeedsMap && sanctuaryState.petNeedsMap[activePet.id]) || {
    hunger: 75,
    hygiene: 80,
    joy: 85,
    energy: 90
  };

  const currentStage = activePet.stage || 1;
  const stageNames = ['Baby Hatchling', 'Heroic Scout', 'Champion Guardian', 'Cosmic Titan'];
  const stageName = stageNames[currentStage - 1] || 'Cosmic Legend';

  // Equipped Forged Gear for this pet
  const equippedGear = (state.petGear && state.petGear[activePet.id]) || {};

  return `
    <div class="min-h-screen bg-surface-container-lowest text-on-background flex flex-col font-body select-none pb-28 sm:pb-32 animate-fade-in relative overflow-x-hidden">
      
      <!-- ===================================================================== -->
      <!-- TOP NAVIGATION & STATUS HUD                                           -->
      <!-- ===================================================================== -->
      <header class="w-full bg-surface-container/90 backdrop-blur-md border-b-2 border-surface-container-highest px-4 py-3 sticky top-0 z-30 flex items-center justify-between gap-3 shadow-md">
        
        <!-- Left: Back Button & Active Pet Badge -->
        <div class="flex items-center gap-2.5">
          <button 
            id="sanctuary-back-btn" 
            class="w-11 h-11 rounded-2xl bg-surface hover:bg-surface-bright text-on-surface flex items-center justify-center border-2 border-surface-container-highest active:scale-95 transition-all shadow-sm"
            aria-label="Back to Hero HQ"
          >
            <span class="material-symbols-outlined text-xl">arrow_back</span>
          </button>

          <div class="flex items-center gap-2">
            <div class="w-10 h-10 rounded-2xl bg-surface-container-high border-2 border-primary/50 flex items-center justify-center text-xl shadow-inner">
              ${activePet.emoji || '🐾'}
            </div>
            <div class="flex flex-col">
              <div class="flex items-center gap-1.5">
                <span class="font-headline font-black text-sm text-on-surface">${activePet.name}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/40">
                  ${archetype.name}
                </span>
              </div>
              <span class="text-[11px] font-bold text-secondary">Stage ${currentStage}: ${stageName}</span>
            </div>
          </div>
        </div>

        <!-- Center: Pet Bond Level Heart Meter (Lv 1-10) -->
        <div class="hidden sm:flex items-center gap-3 bg-surface-container-lowest/80 px-4 py-1.5 rounded-2xl border border-surface-container-highest shadow-inner">
          <div class="flex items-center gap-1.5 text-secondary">
            <span class="material-symbols-outlined text-xl animate-pulse text-secondary">favorite</span>
            <span class="font-headline font-black text-sm">Bond Lv.${bondState.level}</span>
          </div>
          <div class="w-28 h-3.5 bg-surface-container-high rounded-full overflow-hidden p-0.5 border border-surface-container-highest flex">
            <div 
              class="h-full bg-gradient-to-r from-secondary to-secondary-fixed rounded-full transition-all duration-500 shadow-sm"
              style="width: ${Math.min(100, (bondState.xp % 100))}%"
            ></div>
          </div>
          <span class="text-[10px] font-black text-on-surface-variant">${bondState.xp % 100}/100 XP</span>
        </div>

        <!-- Right: Evolution Sparks + Switch Companion Roster Button -->
        <div class="flex items-center gap-2">
          
          <!-- Starlight Spark Capsule -->
          <div class="flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1.5 rounded-2xl border border-tertiary/40 shadow-inner">
            <span class="material-symbols-outlined text-base text-tertiary">bolt</span>
            <span class="font-headline font-black text-xs text-tertiary-fixed">${sparks}/100</span>
          </div>

          <!-- Switch Companion Button -->
          <button 
            id="sanctuary-roster-btn" 
            class="px-3.5 py-2 rounded-2xl bg-secondary hover:bg-secondary-fixed text-slate-950 font-headline font-black text-xs flex items-center gap-1.5 border-b-4 border-[#b26a00] active:translate-y-1 active:border-b-0 transition-all shadow-md"
          >
            <span class="material-symbols-outlined text-sm">pets</span>
            <span class="hidden md:inline">ROSTER</span>
          </button>
        </div>
      </header>

      <!-- ===================================================================== -->
      <!-- MOBILE BOND STRIP (VISIBLE ON PHONES)                                 -->
      <!-- ===================================================================== -->
      <div class="sm:hidden px-4 py-2 bg-surface-container-low border-b border-surface-container-highest flex items-center justify-between text-xs">
        <div class="flex items-center gap-1 text-secondary font-black">
          <span class="material-symbols-outlined text-base">favorite</span>
          <span>Bond Lv.${bondState.level}</span>
        </div>
        <div class="flex-1 mx-3 h-3 bg-surface-container-high rounded-full overflow-hidden border border-surface-container-highest">
          <div 
            class="h-full bg-gradient-to-r from-secondary to-secondary-fixed rounded-full transition-all"
            style="width: ${Math.min(100, (bondState.xp % 100))}%"
          ></div>
        </div>
        <span class="text-[10px] font-bold text-on-surface-variant">${bondState.xp % 100}/100 XP</span>
      </div>

      <!-- ===================================================================== -->
      <!-- MAIN 3D LIVING SANCTUARY HABITAT STAGE                                -->
      <!-- ===================================================================== -->
      <main class="flex-1 relative flex flex-col items-center justify-center min-h-[380px] sm:min-h-[460px] overflow-hidden">
        
        <!-- Canvas Viewport Mount -->
        <div 
          id="sanctuary-canvas-mount" 
          class="w-full h-full absolute inset-0 z-0 touch-none flex items-center justify-center"
        >
          <!-- PetSanctuaryCanvas will append canvas here -->
        </div>

        <!-- Floating Status Badges & Quick Action Pills (Top Left) -->
        <div class="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
          ${isPearly ? `
            <div class="pointer-events-auto px-3 py-1.5 rounded-xl bg-surface-container/90 backdrop-blur-md border-2 border-primary text-primary-fixed font-black text-xs flex items-center gap-1.5 shadow-lg animate-bounce">
              <span class="material-symbols-outlined text-sm text-primary">hotel_class</span>
              <span>Pearly Gleam ✨ Active!</span>
            </div>
          ` : ''}

          <!-- Habit Synergy Tag -->
          <div class="pointer-events-auto px-3 py-1 rounded-xl bg-surface-container/80 backdrop-blur-md border border-surface-container-highest text-on-surface text-[11px] font-bold flex items-center gap-1.5 shadow">
            <span class="material-symbols-outlined text-xs text-secondary">verified</span>
            <span>${activePet.perk || archetype.habitBonus || 'Bravery Boost: +10% Quest XP'}</span>
          </div>
        </div>

        <!-- Floating Quick Pet Controls (Top Right) -->
        <div class="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <!-- Whistle Quick Hop -->
          <button 
            id="quick-whistle-btn" 
            class="w-11 h-11 rounded-2xl bg-surface-container/90 hover:bg-surface-bright text-secondary border-2 border-surface-container-highest active:scale-90 transition-all flex items-center justify-center shadow-lg"
            title="Whistle to Pet!"
            aria-label="Whistle"
          >
            <span class="material-symbols-outlined text-xl">sports</span>
          </button>

          <!-- Belly Tickle Flip -->
          <button 
            id="quick-tickle-btn" 
            class="w-11 h-11 rounded-2xl bg-surface-container/90 hover:bg-surface-bright text-primary border-2 border-surface-container-highest active:scale-90 transition-all flex items-center justify-center shadow-lg"
            title="Tickle Belly Flip!"
            aria-label="Tickle"
          >
            <span class="material-symbols-outlined text-xl">sentiment_very_satisfied</span>
          </button>
        </div>

        <!-- =================================================================== -->
        <!-- MAGIC EGG HATCHING POD (IF ANY UNHATCHED EGGS EXIST)                 -->
        <!-- =================================================================== -->
        ${unhatchedEggs.length > 0 ? (() => {
          const egg = unhatchedEggs[0];
          const eggTaps = eggCrackTaps[egg.id] || 0;
          const remaining = 3 - eggTaps;
          return `
            <div 
              id="magic-egg-pedestal" 
              class="absolute z-20 bottom-8 px-6 py-4 rounded-3xl bg-surface-container/95 backdrop-blur-lg border-2 border-tertiary shadow-2xl flex flex-col items-center gap-2 animate-bounce cursor-pointer active:scale-95 transition-all max-w-xs"
              data-egg-id="${egg.id}"
            >
              <div class="relative w-16 h-20 flex items-center justify-center">
                <span class="text-5xl filter drop-shadow-[0_0_12px_#00d2d3] ${eggTaps > 0 ? 'animate-pulse' : ''}">🥚</span>
                <span class="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-950">
                  ${eggTaps === 1 ? '⚡' : eggTaps === 2 ? '✨⚡' : ''}
                </span>
              </div>
              <div class="text-center">
                <span class="font-headline font-black text-sm text-tertiary-fixed block">Mysterious Magic Egg!</span>
                <span class="text-[11px] font-bold text-on-surface-variant block">Tap to crack & hatch (${remaining} taps left)</span>
              </div>
            </div>
          `;
        })() : ''}

        <!-- 3D Turntable Touch Prompt -->
        <div class="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-[10px] font-black tracking-wider uppercase text-on-surface-variant/60 bg-surface-container-lowest/60 px-3 py-1 rounded-full border border-surface-container-highest/40 flex items-center gap-1">
          <span class="material-symbols-outlined text-xs">sync</span>
          <span>Drag 360° to Orbit • Tap Head to Pet</span>
        </div>
      </main>

      <!-- ===================================================================== -->
      <!-- BOTTOM ACTION DOCK (4 GIANT CHUNKY TACTILE BUTTONS)                  -->
      <!-- ===================================================================== -->
      <nav class="fixed bottom-0 left-0 right-0 z-30 bg-surface-container/95 backdrop-blur-lg border-t-2 border-surface-container-highest px-3 sm:px-6 py-3 shadow-2xl">
        <div class="max-w-xl mx-auto grid grid-cols-4 gap-2 sm:gap-3">
          
          <!-- 1. FEED TREAT -->
          <button 
            id="action-feed-btn" 
            class="sanctuary-dock-btn flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-2xl font-headline font-black text-xs transition-all active:translate-y-1 active:border-b-0 border-b-4 ${
              activeDrawer === 'feed'
                ? 'bg-primary text-slate-950 border-[#1b7a43] shadow-md ring-2 ring-primary/60'
                : 'bg-surface-container-high hover:bg-surface-bright text-on-surface border-surface-container-highest'
            }"
            aria-label="Feed pet treats"
          >
            <span class="text-2xl sm:text-3xl leading-none">🍎</span>
            <span class="mt-1 text-[10px] sm:text-xs">FEED</span>
          </button>

          <!-- 2. BUBBLE BATH -->
          <button 
            id="action-bath-btn" 
            class="sanctuary-dock-btn flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-2xl font-headline font-black text-xs transition-all active:translate-y-1 active:border-b-0 border-b-4 ${
              activeDrawer === 'bath'
                ? 'bg-tertiary text-slate-950 border-[#007b83] shadow-md ring-2 ring-tertiary/60'
                : 'bg-surface-container-high hover:bg-surface-bright text-on-surface border-surface-container-highest'
            }"
            aria-label="Scrub in bubble lagoon"
          >
            <span class="text-2xl sm:text-3xl leading-none">🫧</span>
            <span class="mt-1 text-[10px] sm:text-xs">BATH</span>
          </button>

          <!-- 3. HERO WARDROBE -->
          <button 
            id="action-wardrobe-btn" 
            class="sanctuary-dock-btn flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-2xl font-headline font-black text-xs transition-all active:translate-y-1 active:border-b-0 border-b-4 ${
              activeDrawer === 'wardrobe'
                ? 'bg-secondary text-slate-950 border-[#b26a00] shadow-md ring-2 ring-secondary/60'
                : 'bg-surface-container-high hover:bg-surface-bright text-on-surface border-surface-container-highest'
            }"
            aria-label="Snap-on 3D forged gear"
          >
            <span class="text-2xl sm:text-3xl leading-none">🪞</span>
            <span class="mt-1 text-[10px] sm:text-xs">GEAR</span>
          </button>

          <!-- 4. STARLIGHT EVOLUTION -->
          <button 
            id="action-evolution-btn" 
            class="sanctuary-dock-btn flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-2xl font-headline font-black text-xs transition-all active:translate-y-1 active:border-b-0 border-b-4 ${
              activeDrawer === 'evolution'
                ? 'bg-gradient-to-r from-secondary to-primary text-slate-950 border-[#1b7a43] shadow-md ring-2 ring-primary/60'
                : 'bg-surface-container-high hover:bg-surface-bright text-on-surface border-surface-container-highest'
            }"
            aria-label="Starlight pet evolution altar"
          >
            <span class="text-2xl sm:text-3xl leading-none">⚡</span>
            <span class="mt-1 text-[10px] sm:text-xs">EVOLVE</span>
          </button>
        </div>
      </nav>

      <!-- ===================================================================== -->
      <!-- SLIDE-OUT TACTILE DRAWER PANELS                                       -->
      <!-- ===================================================================== -->
      ${renderActiveDrawer(activeDrawer, activePet, archetype, needs, sparks, bondState, equippedGear)}
    </div>
  `;
}

function renderActiveDrawer(drawer, activePet, archetype, needs, sparks, bondState, equippedGear) {
  if (!drawer) return '';

  return `
    <!-- Drawer Overlay Backdrop -->
    <div id="drawer-backdrop" class="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm animate-fade-in"></div>

    <!-- Drawer Content Sheet -->
    <div 
      id="sanctuary-drawer-sheet" 
      class="fixed bottom-0 left-0 right-0 z-50 max-h-[82vh] bg-surface-container border-t-4 border-surface-container-highest rounded-t-3xl shadow-2xl overflow-y-auto pb-8 animate-slide-up flex flex-col max-w-2xl mx-auto"
    >
      <!-- Top Grip Handle & Close Button -->
      <div class="sticky top-0 bg-surface-container/95 backdrop-blur-md px-6 py-3 border-b border-surface-container-highest flex items-center justify-between z-10">
        <div class="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2"></div>
        
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xl">
            ${drawer === 'feed' ? '🍎' : drawer === 'bath' ? '🫧' : drawer === 'wardrobe' ? '🪞' : drawer === 'evolution' ? '⚡' : '🐾'}
          </span>
          <h3 class="font-headline font-black text-base text-on-surface uppercase tracking-wide">
            ${drawer === 'feed' ? 'Snack Shelf' : drawer === 'bath' ? 'Bubble Spa Lagoon' : drawer === 'wardrobe' ? '3D Hero Wardrobe' : drawer === 'evolution' ? 'Starlight Evolution Altar' : '24 Pet Companion Roster'}
          </h3>
        </div>

        <button 
          id="drawer-close-btn" 
          class="w-9 h-9 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface flex items-center justify-center border border-surface-container-highest active:scale-95 transition-all"
          aria-label="Close drawer"
        >
          <span class="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      <!-- Drawer Body Content -->
      <div class="p-6 flex flex-col gap-6">
        ${
          drawer === 'feed' ? renderFeedDrawer(activePet, needs) :
          drawer === 'bath' ? renderBathDrawer(activePet, needs) :
          drawer === 'wardrobe' ? renderWardrobeDrawer(activePet, equippedGear) :
          drawer === 'evolution' ? renderEvolutionDrawer(activePet, sparks, currentStage(activePet)) :
          renderRosterDrawer(activePet)
        }
      </div>
    </div>
  `;
}

function currentStage(pet) {
  return pet.stage || 1;
}

// -----------------------------------------------------------------------------
// DRAWER 1: FEED TREAT DRAWER
// -----------------------------------------------------------------------------
function renderFeedDrawer(pet, needs) {
  return `
    <div class="flex flex-col gap-5">
      <!-- Pet Hunger & Joy Status -->
      <div class="grid grid-cols-2 gap-3 bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-highest">
        <div>
          <div class="flex items-center justify-between text-xs font-black text-on-surface mb-1">
            <span>Hunger Tummy</span>
            <span class="text-secondary">${needs.hunger}%</span>
          </div>
          <div class="w-full h-3 bg-surface-container-high rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
            <div class="h-full bg-secondary rounded-full transition-all" style="width: ${needs.hunger}%"></div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between text-xs font-black text-on-surface mb-1">
            <span>Playful Joy</span>
            <span class="text-primary">${needs.joy}%</span>
          </div>
          <div class="w-full h-3 bg-surface-container-high rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
            <div class="h-full bg-primary rounded-full transition-all" style="width: ${needs.joy}%"></div>
          </div>
        </div>
      </div>

      <!-- Treat Snacks Shelf Grid -->
      <div>
        <span class="text-xs font-black uppercase text-on-surface-variant tracking-wider block mb-3">Choose a snack to feed ${pet.name}:</span>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${SANCTUARY_TREATS.map(treat => `
            <button 
              class="feed-treat-btn flex flex-col items-center text-center p-3.5 rounded-2xl bg-surface-container-high hover:bg-surface-bright border-2 border-surface-container-highest active:scale-95 transition-all shadow group"
              data-treat-id="${treat.id}"
            >
              <span class="text-3xl sm:text-4xl group-hover:scale-110 transition-transform">${treat.emoji}</span>
              <span class="font-headline font-black text-xs text-on-surface mt-2">${treat.name}</span>
              <span class="text-[10px] font-bold text-secondary mt-0.5">+${treat.hunger} Hunger</span>
              <span class="text-[10px] font-black text-primary">+${treat.bondXp} Bond XP</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// DRAWER 2: BUBBLE BATH DRAWER
// -----------------------------------------------------------------------------
function renderBathDrawer(pet, needs) {
  return `
    <div class="flex flex-col gap-5 text-center">
      <!-- Pet Hygiene Meter -->
      <div class="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-highest">
        <div class="flex items-center justify-between text-xs font-black text-on-surface mb-1.5">
          <span class="flex items-center gap-1 text-tertiary">
            <span class="material-symbols-outlined text-sm">soap</span>
            <span>Cleanliness Level</span>
          </span>
          <span class="text-tertiary font-black">${needs.hygiene}%</span>
        </div>
        <div class="w-full h-4 bg-surface-container-high rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
          <div class="h-full bg-gradient-to-r from-tertiary to-primary rounded-full transition-all" style="width: ${needs.hygiene}%"></div>
        </div>
      </div>

      <!-- Scrubbing Action Button -->
      <div class="flex flex-col items-center gap-3">
        <button 
          id="scrub-sponge-btn"
          class="w-full sm:w-80 py-4 px-6 rounded-2xl bg-tertiary hover:bg-tertiary-fixed text-slate-950 font-headline font-black text-sm flex items-center justify-center gap-2 border-b-4 border-[#007b83] active:translate-y-1 active:border-b-0 transition-all shadow-lg"
        >
          <span class="text-2xl">🫧</span>
          <span>SCRUB WITH SPONGE (+25% HYGIENE)</span>
        </button>

        <p class="text-xs text-on-surface-variant font-bold max-w-sm">
          Scrub away muddy spots from outdoor expeditions! Keeps your companion sparkling with a soothing starlight sheen.
        </p>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// DRAWER 3: HERO WARDROBE DRAWER
// -----------------------------------------------------------------------------
function renderWardrobeDrawer(pet, equippedGear) {
  // Available 3D Forged Gear Catalog
  const gearSlots = [
    { slot: 'head', name: 'Helmet / Crown', icon: '👑', items: [
      { id: 'titan_helm', name: 'Titan Horn Helm', slot: 'head', emoji: '🪖', stat: '+15% Armor' },
      { id: 'cyber_visor', name: 'Cyber Visor', slot: 'head', emoji: '👓', stat: '+20% Aim' },
      { id: 'sun_crown', name: 'Regal Sun Crown', slot: 'head', emoji: '👑', stat: '+30% Coins' }
    ]},
    { slot: 'wings', name: 'Wings / Cape', icon: '🦸', items: [
      { id: 'aero_wings', name: 'Aero Glider Wings', slot: 'wings', emoji: '🪽', stat: '+25% Speed' },
      { id: 'phoenix_wings', name: 'Phoenix Flame Wings', slot: 'wings', emoji: '🔥', stat: '+30% Boost' },
      { id: 'star_cape', name: 'Starlight Cloak', slot: 'wings', emoji: '✨', stat: '+15% Shield' }
    ]},
    { slot: 'boots', name: 'Hero Greaves', icon: '⚡', items: [
      { id: 'iron_greaves', name: 'Iron Forged Greaves', slot: 'boots', emoji: '🛡️', stat: '+20% Defense' },
      { id: 'spring_runners', name: 'Spring Jump Boots', slot: 'boots', emoji: '👟', stat: '+25% Flip' }
    ]}
  ];

  return `
    <div class="flex flex-col gap-5">
      <p class="text-xs text-on-surface-variant font-bold">
        Snap forged 3D helmets, wings, and boots directly onto ${pet.name}'s bone joints in real time!
      </p>

      <div class="flex flex-col gap-4">
        ${gearSlots.map(group => `
          <div>
            <span class="text-xs font-black uppercase text-on-surface tracking-wider block mb-2 flex items-center gap-1.5">
              <span>${group.icon}</span>
              <span>${group.name}</span>
            </span>
            <div class="grid grid-cols-3 gap-2.5">
              ${group.items.map(item => {
                const isEquipped = equippedGear[group.slot]?.id === item.id;
                return `
                  <button 
                    class="equip-gear-btn p-3 rounded-2xl border-2 flex flex-col items-center text-center transition-all active:scale-95 ${
                      isEquipped
                        ? 'bg-secondary/20 border-secondary text-secondary-fixed ring-2 ring-secondary/50 shadow-md'
                        : 'bg-surface-container-high hover:bg-surface-bright border-surface-container-highest text-on-surface'
                    }"
                    data-slot="${item.slot}"
                    data-gear-id="${item.id}"
                    data-gear-name="${item.name}"
                  >
                    <span class="text-2xl mb-1">${item.emoji}</span>
                    <span class="font-headline font-black text-[11px] leading-tight line-clamp-1">${item.name}</span>
                    <span class="text-[10px] font-bold text-primary mt-1">${item.stat}</span>
                    <span class="mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isEquipped ? 'bg-secondary text-slate-950' : 'bg-surface-container text-on-surface-variant'}">
                      ${isEquipped ? 'EQUIPPED' : 'EQUIP'}
                    </span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// DRAWER 4: STARLIGHT EVOLUTION ALTAR DRAWER
// -----------------------------------------------------------------------------
function renderEvolutionDrawer(pet, sparks, stage) {
  const canEvolve = sparks >= 100 && stage < 4;
  const isMaxStage = stage >= 4;

  const stages = [
    { num: 1, name: 'Baby Hatchling', desc: 'Cute, playful companion starting out' },
    { num: 2, name: 'Heroic Scout', desc: 'Bigger stature, small protective armor' },
    { num: 3, name: 'Champion Guardian', desc: 'Powerful elemental aura & wings' },
    { num: 4, name: 'Cosmic Titan', desc: 'Full starlight majesty & maximum buffs' }
  ];

  return `
    <div class="flex flex-col gap-6 text-center">
      <!-- Sparks Tube Counter -->
      <div class="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-highest">
        <div class="flex items-center justify-between text-xs font-black text-on-surface mb-1.5">
          <span class="flex items-center gap-1 text-tertiary">
            <span class="material-symbols-outlined text-sm">bolt</span>
            <span>Starlight Evolution Fuel</span>
          </span>
          <span class="text-tertiary-fixed font-black">${sparks}/100 Sparks</span>
        </div>
        <div class="w-full h-4 bg-surface-container-high rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
          <div 
            class="h-full bg-gradient-to-r from-tertiary to-primary rounded-full transition-all duration-500 shadow-sm"
            style="width: ${Math.min(100, (sparks / 100) * 100)}%"
          ></div>
        </div>
      </div>

      <!-- 4-Stage Metamorphosis Roadmap -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        ${stages.map(st => {
          const isCurrent = st.num === stage;
          const isPassed = st.num < stage;
          return `
            <div class="p-3 rounded-2xl border-2 flex flex-col items-center text-center ${
              isCurrent
                ? 'bg-primary/20 border-primary text-primary-fixed shadow-md ring-2 ring-primary/40'
                : isPassed
                ? 'bg-surface-container-lowest border-surface-container-highest opacity-70 text-on-surface'
                : 'bg-surface-container-high border-surface-container-highest/40 opacity-40 text-on-surface-variant'
            }">
              <div class="w-7 h-7 rounded-full flex items-center justify-center font-black text-xs mb-1.5 ${
                isCurrent ? 'bg-primary text-slate-950' : isPassed ? 'bg-surface-container-highest text-on-surface' : 'bg-surface-container text-on-surface-variant'
              }">
                ${isPassed ? '✓' : st.num}
              </div>
              <span class="font-headline font-black text-xs">${st.name}</span>
              <span class="text-[10px] text-on-surface-variant mt-1 leading-tight">${st.desc}</span>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Evolution Action Button -->
      <div class="flex flex-col items-center gap-3">
        ${isMaxStage ? `
          <div class="px-6 py-3 rounded-2xl bg-surface-container-high border border-primary/40 text-primary font-black text-xs">
            🌟 Maximum Cosmic Titan Evolution Reached!
          </div>
        ` : `
          <button 
            id="awaken-evolution-btn"
            class="w-full sm:w-80 py-4 px-6 rounded-2xl font-headline font-black text-sm flex items-center justify-center gap-2 border-b-4 transition-all shadow-xl ${
              canEvolve
                ? 'bg-gradient-to-r from-primary to-secondary text-slate-950 border-[#1b7a43] active:translate-y-1 active:border-b-0 animate-pulse cursor-pointer'
                : 'bg-surface-container-high text-on-surface-variant border-surface-container-highest opacity-50 cursor-not-allowed'
            }"
            ${!canEvolve ? 'disabled' : ''}
          >
            <span class="text-2xl">⚡</span>
            <span>AWAKEN METAMORPHOSIS (100 SPARKS)</span>
          </button>

          ${!canEvolve ? `
            <p class="text-xs text-secondary font-bold">
              Complete toothbrushing and chore quests to gather 100 Starlight Sparks!
            </p>
          ` : ''}
        `}
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// DRAWER 5: 24 PET COMPANION ROSTER DRAWER
// -----------------------------------------------------------------------------
function renderRosterDrawer(activePet) {
  return `
    <div class="flex flex-col gap-4">
      <span class="text-xs font-black uppercase text-on-surface-variant tracking-wider block">Choose your active adventure companion:</span>
      
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto pr-1">
        ${PETS_DATABASE.map(pet => {
          const isActive = pet.id === activePet.id;
          const archetype = getPetArchetype(pet);
          return `
            <button 
              class="switch-pet-btn p-3 rounded-2xl border-2 flex items-center gap-3 text-left transition-all active:scale-95 ${
                isActive
                  ? 'bg-primary/20 border-primary text-primary-fixed ring-2 ring-primary/40 shadow-md'
                  : 'bg-surface-container-high hover:bg-surface-bright border-surface-container-highest text-on-surface'
              }"
              data-pet-id="${pet.id}"
            >
              <span class="text-3xl flex-shrink-0">${pet.emoji || '🐾'}</span>
              <div class="flex flex-col min-w-0">
                <span class="font-headline font-black text-xs truncate">${pet.name}</span>
                <span class="text-[10px] font-bold text-secondary truncate">${archetype.name}</span>
                <span class="text-[9px] font-medium text-on-surface-variant truncate">${pet.element || 'Normal'}</span>
              </div>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// =============================================================================
// EVENT LISTENERS & LIFECYCLE HOOKS
// =============================================================================
export function attachPetSanctuaryListeners() {
  const mount = document.getElementById('sanctuary-canvas-mount');
  if (mount) {
    if (activeCanvasInstance) {
      activeCanvasInstance.destroy();
      activeCanvasInstance = null;
    }
    const state = store.getState();
    const hero = state.selectedHero || {};
    const activePetId = hero.activePetId || '2';
    const activePet = getPetById(activePetId) || PETS_DATABASE[0];
    const equippedGear = (state.petGear && state.petGear[activePet.id]) || {};

    activeCanvasInstance = new PetSanctuaryCanvas(mount, {
      petId: activePet.id,
      gear: equippedGear
    });
  }

  // Back Button
  const backBtn = document.getElementById('sanctuary-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      Sound.bloop();
      store.setView('dashboard');
    });
  }

  // Quick Whistle
  const whistleBtn = document.getElementById('quick-whistle-btn');
  if (whistleBtn) {
    whistleBtn.addEventListener('click', () => {
      Sound.sparkle();
      if (activeCanvasInstance) activeCanvasInstance.triggerCheer();
    });
  }

  // Quick Tickle Flip
  const tickleBtn = document.getElementById('quick-tickle-btn');
  if (tickleBtn) {
    tickleBtn.addEventListener('click', () => {
      if (activeCanvasInstance) activeCanvasInstance.triggerBellyTickle();
    });
  }

  // Bottom Dock Actions: Feed, Bath, Wardrobe, Evolution
  const feedBtn = document.getElementById('action-feed-btn');
  if (feedBtn) {
    feedBtn.addEventListener('click', () => {
      Sound.bloop();
      store.openSanctuaryDrawer('feed');
    });
  }

  const bathBtn = document.getElementById('action-bath-btn');
  if (bathBtn) {
    bathBtn.addEventListener('click', () => {
      Sound.bloop();
      store.openSanctuaryDrawer('bath');
    });
  }

  const wardrobeBtn = document.getElementById('action-wardrobe-btn');
  if (wardrobeBtn) {
    wardrobeBtn.addEventListener('click', () => {
      Sound.bloop();
      store.openSanctuaryDrawer('wardrobe');
    });
  }

  const evoBtn = document.getElementById('action-evolution-btn');
  if (evoBtn) {
    evoBtn.addEventListener('click', () => {
      Sound.bloop();
      store.openSanctuaryDrawer('evolution');
    });
  }

  // Roster Switch Button
  const rosterBtn = document.getElementById('sanctuary-roster-btn');
  if (rosterBtn) {
    rosterBtn.addEventListener('click', () => {
      Sound.bloop();
      store.openSanctuaryDrawer('roster');
    });
  }

  // Drawer Close Button & Backdrop
  const closeBtn = document.getElementById('drawer-close-btn');
  const backdrop = document.getElementById('drawer-backdrop');
  const closeDrawer = () => {
    Sound.bloop();
    store.closeSanctuaryDrawer();
  };
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  // Feeding Snack Buttons
  document.querySelectorAll('.feed-treat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const treatId = btn.getAttribute('data-treat-id');
      const activePet = store.getActivePet();
      const treat = SANCTUARY_TREATS.find(t => t.id === treatId);
      if (activePet && treat) {
        store.feedPetTreat(activePet.id, treatId);
        if (activeCanvasInstance) activeCanvasInstance.triggerFeedTreat(treat);
      }
    });
  });

  // Bath Scrub Button
  const spongeBtn = document.getElementById('scrub-sponge-btn');
  if (spongeBtn) {
    spongeBtn.addEventListener('click', () => {
      const activePet = store.getActivePet();
      if (activePet) {
        store.bathPetScrub(activePet.id, 25);
        if (activeCanvasInstance) activeCanvasInstance.triggerBathLagoon();
      }
    });
  }

  // Wardrobe Equip Buttons
  document.querySelectorAll('.equip-gear-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = btn.getAttribute('data-slot');
      const gearId = btn.getAttribute('data-gear-id');
      const gearName = btn.getAttribute('data-gear-name');
      const activePet = store.getActivePet();
      if (activePet && slot) {
        Sound.sparkle();
        store.equipPetForgeGear(activePet.id, slot, { id: gearId, name: gearName });
      }
    });
  });

  // Starlight Evolution Awaken Button
  const evoAwakenBtn = document.getElementById('awaken-evolution-btn');
  if (evoAwakenBtn) {
    evoAwakenBtn.addEventListener('click', () => {
      const activePet = store.getActivePet();
      if (activePet) {
        const res = store.evolvePetStarlight(activePet.id);
        if (res && res.success) {
          Sound.fanfare();
          if (typeof window !== 'undefined' && typeof window.confetti === 'function') {
            window.confetti({ particleCount: 75, spread: 80, origin: { y: 0.6 } });
          }
          if (activeCanvasInstance) activeCanvasInstance.triggerCheer();
        }
      }
    });
  }

  // Roster Switch Pet Buttons
  document.querySelectorAll('.switch-pet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const petId = btn.getAttribute('data-pet-id');
      if (petId) {
        Sound.bloop();
        store.selectHeroPet(petId);
        store.closeSanctuaryDrawer();
      }
    });
  });

  // Magic Egg Hatching Taps
  const eggEl = document.getElementById('magic-egg-pedestal');
  if (eggEl) {
    eggEl.addEventListener('click', () => {
      const eggId = eggEl.getAttribute('data-egg-id');
      eggCrackTaps[eggId] = (eggCrackTaps[eggId] || 0) + 1;
      
      if (eggCrackTaps[eggId] < 3) {
        Sound.sparkle();
        eggEl.classList.add('animate-ping');
        setTimeout(() => { eggEl.classList.remove('animate-ping'); }, 300);
        store.notify();
      } else {
        // Hatch!
        Sound.fanfare();
        if (typeof window !== 'undefined' && typeof window.confetti === 'function') {
          window.confetti({ particleCount: 100, spread: 90, origin: { y: 0.5 } });
        }
        delete eggCrackTaps[eggId];
        store.hatchMagicEgg(eggId);
      }
    });
  }
}
