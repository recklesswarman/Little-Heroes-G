/**
 * PetSanctuaryView.js
 * 
 * 3D Living Pet Sanctuary & Playpark
 * Unified, kid-friendly companion habitat built with the Adventurous Explorer design system.
 * Zero pink or purple: Emerald Green (#2ecc71), Solar Orange (#f39c12), Amber (#ffb961),
 * Starlight Cyan (#00d2d3), and Midnight Slate (#09141e).
 */

import { store } from '../state/store.js';
import { PETS_DATABASE, SANCTUARY_TREATS, getPetArchetype, getPetBondBonus, getPetById, getPetLevelData, calculatePetStatBonus, getDailyRotatingPetCoach } from '../data/petsData.js';
import { PET_GEAR_CATALOG, getGearHaloStyle, normalizeGearSlot, getGearItem, calculateActiveGearBuffs } from '../data/petGearStudioData.js';
import { PetSanctuaryCanvas } from '../components/PetSanctuaryCanvas.js';
import { Sound } from '../audio/sfx.js';
import { registerActiveCanvas } from '../utils/activeViewCanvasRegistry.js';

let activeCanvasInstance = null;
let eggCrackTaps = {}; // { [eggId]: tapCount }
let expeditionInterval = null;
let selectedRosterFilter = 'all';
let selectedWardrobeCategory = 'masks';

export function renderPetSanctuaryView() {
  const state = store.getState();
  const hero = state.selectedHero || {};
  const activePet = store.getActivePet();
  const archetype = getPetArchetype(activePet);
  const petLevel = store.getPetLevel(activePet.id);
  const petLevelData = getPetLevelData(petLevel);
  const petStatBonus = calculatePetStatBonus(activePet, petLevel);
  const petXp = store.getPetXp(activePet.id);
  const xpNeeded = petLevelData.xpNeededForNext || 100;

  const sanctuaryState = store.getPetSanctuaryState();
  const bondState = store.getPetBondState(activePet.id);
  const isPearly = store.getPearlyGleamStatus(activePet.id);
  const activeDrawer = sanctuaryState.activeDrawer; // null | 'feed' | 'bath' | 'wardrobe' | 'roster' | 'workout'
  const unhatchedEggs = sanctuaryState.unhatchedEggs || [];

  // Active Pet Needs
  const needs = (sanctuaryState.petNeedsMap && sanctuaryState.petNeedsMap[activePet.id]) || {
    hunger: 75,
    hygiene: 80,
    joy: 85,
    energy: 90
  };

  // Equipped Forged Gear for this pet
  const equippedGear = (state.petGear && state.petGear[activePet.id]) || {};

  return `
    <div class="min-h-screen bg-surface-container-lowest text-on-background flex flex-col font-body select-none pb-36 sm:pb-44 animate-fade-in relative overflow-x-hidden">
      
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
            <div class="w-11 h-11 rounded-2xl bg-surface-container-high border-2 border-primary/50 flex items-center justify-center overflow-hidden shadow-inner p-1">
              <img src="${activePet.avatar || `/assets/pets/${activePet.key || 'rex'}.png`}" alt="${activePet.name}" class="w-full h-full object-contain">
            </div>
            <div class="flex flex-col">
              <div class="flex items-center gap-1.5">
                <span class="font-headline font-black text-sm text-on-surface">${activePet.name}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/40">
                  ${archetype.name}
                </span>
              </div>
              <span class="text-[11px] font-bold text-secondary">Level ${petLevel}: ${petLevelData.title} • ${petStatBonus.label}</span>
            </div>
          </div>
        </div>

        <!-- Center: Pet Training XP Meter (Level 1-25) -->
        <div class="hidden sm:flex items-center gap-3 bg-surface-container-lowest/80 px-4 py-1.5 rounded-2xl border border-surface-container-highest shadow-inner">
          <div class="flex items-center gap-1.5 text-cyan-300">
            <span class="material-symbols-outlined text-xl animate-pulse text-cyan-400">bolt</span>
            <span class="font-headline font-black text-sm">XP Lvl.${petLevel}</span>
          </div>
          <div class="w-28 h-3.5 bg-surface-container-high rounded-full overflow-hidden p-0.5 border border-surface-container-highest flex">
            <div 
              class="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-500 shadow-sm"
              style="width: ${Math.min(100, Math.floor((petXp / xpNeeded) * 100))}%"
            ></div>
          </div>
          <span class="text-[10px] font-black text-on-surface-variant">${petXp}/${xpNeeded} XP</span>
        </div>

        <!-- Right: Daily Workout & Switch Companion Roster Button -->
        <div class="flex items-center gap-2">
          
          <!-- Daily Workout Capsule -->
          <button 
            id="sanctuary-workout-btn"
            class="flex items-center gap-1.5 bg-surface-container-lowest hover:bg-surface-container px-3 py-1.5 rounded-2xl border border-amber-400/40 shadow-inner text-amber-300 text-xs font-headline font-black active:scale-95"
            title="Daily Rotating Pet Workout"
          >
            <span class="material-symbols-outlined text-base text-amber-400">fitness_center</span>
            <span class="hidden md:inline">TRAIN</span>
          </button>

          <!-- Switch Companion Button -->
          <button 
            id="sanctuary-roster-btn" 
            class="px-3.5 py-2 rounded-2xl bg-secondary hover:bg-secondary-fixed text-slate-950 font-headline font-black text-xs flex items-center gap-1.5 border-b-4 border-[#b26a00] active:translate-y-1 active:border-b-0 transition-all shadow-md"
          >
            <span class="material-symbols-outlined text-sm">pets</span>
            <span class="hidden md:inline">24 ROSTER</span>
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
      <!-- BOTTOM ACTION DOCK (6 TACTILE ACTION BUTTONS)                         -->
      <!-- Positioned right above the BottomNav bar (68px-72px)                 -->
      <!-- ===================================================================== -->
      <nav class="fixed bottom-[68px] sm:bottom-[72px] left-0 right-0 z-30 bg-surface-container/95 backdrop-blur-lg border-t-2 border-surface-container-highest px-2 sm:px-6 py-2 sm:py-2.5 shadow-2xl">
        <div class="max-w-xl mx-auto grid grid-cols-6 gap-1.5 sm:gap-3">
          
          <!-- 1. FEED TREAT -->
          <button 
            id="action-feed-btn" 
            class="sanctuary-dock-btn min-h-[48px] flex flex-col items-center justify-center p-1.5 sm:p-2.5 rounded-2xl font-headline font-black text-xs transition-all active:translate-y-1 active:border-b-0 border-b-4 ${
              activeDrawer === 'feed'
                ? 'bg-primary text-slate-950 border-[#1b7a43] shadow-md ring-2 ring-primary/60'
                : 'bg-surface-container-high hover:bg-surface-bright text-on-surface border-surface-container-highest'
            }"
            aria-label="Feed pet treats"
          >
            <span class="text-xl sm:text-3xl leading-none">🍎</span>
            <span class="mt-0.5 sm:mt-1 text-[9px] sm:text-xs">FEED</span>
          </button>

          <!-- 2. BUBBLE BATH -->
          <button 
            id="action-bath-btn" 
            class="sanctuary-dock-btn min-h-[48px] flex flex-col items-center justify-center p-1.5 sm:p-2.5 rounded-2xl font-headline font-black text-xs transition-all active:translate-y-1 active:border-b-0 border-b-4 ${
              activeDrawer === 'bath'
                ? 'bg-tertiary text-slate-950 border-[#007b83] shadow-md ring-2 ring-tertiary/60'
                : 'bg-surface-container-high hover:bg-surface-bright text-on-surface border-surface-container-highest'
            }"
            aria-label="Scrub in bubble lagoon"
          >
            <span class="text-xl sm:text-3xl leading-none">🫧</span>
            <span class="mt-0.5 sm:mt-1 text-[9px] sm:text-xs">BATH</span>
          </button>

          <!-- 3. HERO WARDROBE -->
          <button 
            id="action-wardrobe-btn" 
            class="sanctuary-dock-btn min-h-[48px] flex flex-col items-center justify-center p-1.5 sm:p-2.5 rounded-2xl font-headline font-black text-xs transition-all active:translate-y-1 active:border-b-0 border-b-4 ${
              activeDrawer === 'wardrobe'
                ? 'bg-secondary text-slate-950 border-[#b26a00] shadow-md ring-2 ring-secondary/60'
                : 'bg-surface-container-high hover:bg-surface-bright text-on-surface border-surface-container-highest'
            }"
            aria-label="Snap-on 3D forged gear"
          >
            <span class="text-xl sm:text-3xl leading-none">🪞</span>
            <span class="mt-0.5 sm:mt-1 text-[9px] sm:text-xs">GEAR</span>
          </button>

          <!-- 4. 24 PET COMPANIONS ROSTER -->
          <button 
            id="action-roster-dock-btn" 
            class="sanctuary-dock-btn min-h-[48px] flex flex-col items-center justify-center p-1.5 sm:p-2.5 rounded-2xl font-headline font-black text-xs transition-all active:translate-y-1 active:border-b-0 border-b-4 ${
              activeDrawer === 'roster'
                ? 'bg-gradient-to-r from-secondary to-primary text-slate-950 border-[#1b7a43] shadow-md ring-2 ring-primary/60'
                : 'bg-surface-container-high hover:bg-surface-bright text-on-surface border-surface-container-highest'
            }"
            aria-label="24 Pet Companions Roster"
          >
            <span class="text-xl sm:text-3xl leading-none">🐾</span>
            <span class="mt-0.5 sm:mt-1 text-[9px] sm:text-xs">ROSTER</span>
          </button>

          <!-- 5. EXPEDITION -->
          <button 
            id="action-expedition-btn" 
            class="sanctuary-dock-btn min-h-[48px] flex flex-col items-center justify-center p-1.5 sm:p-2.5 rounded-2xl font-headline font-black text-xs transition-all active:translate-y-1 active:border-b-0 border-b-4 ${
              activeDrawer === 'expedition'
                ? 'bg-amber-400 text-slate-950 border-[#b7791f] shadow-md ring-2 ring-amber-400/60'
                : 'bg-surface-container-high hover:bg-surface-bright text-on-surface border-surface-container-highest'
            }"
            aria-label="Send on Adventure"
          >
            <span class="text-xl sm:text-3xl leading-none">🏕️</span>
            <span class="mt-0.5 sm:mt-1 text-[9px] sm:text-xs">EXPLORE</span>
          </button>

          <!-- 6. WORKOUT -->
          <button 
            id="action-workout-btn" 
            class="sanctuary-dock-btn min-h-[48px] flex flex-col items-center justify-center p-1.5 sm:p-2.5 rounded-2xl font-headline font-black text-xs transition-all active:translate-y-1 active:border-b-0 border-b-4 ${
              activeDrawer === 'workout'
                ? 'bg-rose-400 text-slate-950 border-[#9b2c2c] shadow-md ring-2 ring-rose-400/60'
                : 'bg-surface-container-high hover:bg-surface-bright text-on-surface border-surface-container-highest'
            }"
            aria-label="Companion Workout"
          >
            <span class="text-xl sm:text-3xl leading-none">💪</span>
            <span class="mt-0.5 sm:mt-1 text-[9px] sm:text-xs">WORKOUT</span>
          </button>

        </div>
      </nav>

      <!-- ===================================================================== -->
      <!-- SLIDE-OUT TACTILE DRAWER PANELS                                       -->
      <!-- ===================================================================== -->
      ${renderActiveDrawer(activeDrawer, activePet, archetype, needs, petLevel, petLevelData, petStatBonus, bondState, equippedGear)}
    </div>
  `;
}

function renderActiveDrawer(drawer, activePet, archetype, needs, petLevel, petLevelData, petStatBonus, bondState, equippedGear) {
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
            ${drawer === 'feed' ? '🍎' : drawer === 'expedition' ? '🏕️' : drawer === 'workout' ? '💪' : drawer === 'bath' ? '🫧' : drawer === 'wardrobe' ? '🪞' : '🐾'}
          </span>
          <h3 class="font-headline font-black text-base text-on-surface uppercase tracking-wide">
            ${drawer === 'feed' ? 'Snack Shelf' : drawer === 'expedition' ? 'Adventure Expedition' : drawer === 'workout' ? 'Companion Hero Workout' : drawer === 'bath' ? 'Bubble Spa Lagoon' : drawer === 'wardrobe' ? 'Hero Gear Wardrobe' : '24 Pet Companion Roster'}
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
          drawer === 'expedition' ? renderExpeditionDrawer(activePet) :
          drawer === 'workout' ? renderWorkoutDrawer(activePet) :
          drawer === 'bath' ? renderBathDrawer(activePet, needs) :
          drawer === 'wardrobe' ? renderWardrobeDrawer(activePet, equippedGear) :
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
              <span class="text-[10px] font-bold text-secondary mt-0.5">+${treat.hungerFill || treat.hunger || 25} Hunger</span>
              <span class="text-[10px] font-black text-primary">+${treat.bondXp || 20} Bond XP</span>
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
// DRAWER 3: HERO WARDROBE DRAWER (4 CATEGORIES: MASKS, CAPES, ARMOR, BOOTS)
// -----------------------------------------------------------------------------
function renderWardrobeDrawer(pet, equippedGear) {
  const categories = [
    { id: 'masks', name: 'Masks', icon: 'masks', legacyKey: 'head' },
    { id: 'capes', name: 'Capes', icon: 'blind', legacyKey: 'back' },
    { id: 'armor', name: 'Armor', icon: 'shield', legacyKey: 'chest' },
    { id: 'boots', name: 'Boots', icon: 'footprint', legacyKey: 'feet' }
  ];

  const activeCategory = selectedWardrobeCategory || 'masks';
  const availableItems = PET_GEAR_CATALOG[activeCategory] || [];
  const buffs = calculateActiveGearBuffs(equippedGear);

  return `
    <div class="flex flex-col gap-6">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="font-headline font-black text-sm text-on-surface">Tactile Hero Gear Slots</h4>
          <p class="text-[11px] text-on-surface-variant font-bold">1 piece per category • Halos reflect gear forged level</p>
        </div>
        <span class="px-2.5 py-1 rounded-xl bg-primary/20 text-primary border border-primary/40 font-black text-xs">
          4 Categories
        </span>
      </div>

      <!-- 4 Squircle Gear Spotlight Pedestals (Masks, Capes, Armor, Boots) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        ${categories.map(cat => {
          const equipped = equippedGear[cat.id] || equippedGear[cat.legacyKey];
          const hasItem = Boolean(equipped);
          const itemData = hasItem ? ((typeof equipped === 'object' && equipped.level) ? equipped : (getGearItem(cat.id, equipped.id || equipped) || { name: equipped.name || equipped, level: 1 })) : null;
          const halo = hasItem ? getGearHaloStyle(itemData.level || 1) : null;

          return `
            <div class="relative flex flex-col items-center p-3 rounded-2xl bg-surface-container-lowest border-2 ${
              hasItem ? `${halo.border} ${halo.haloShadow}` : 'border-dashed border-surface-container-highest'
            } transition-all">
              <span class="text-[10px] font-black uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">
                <span class="material-symbols-outlined text-xs">${cat.icon}</span>
                <span>${cat.name}</span>
              </span>

              <div class="w-14 h-14 rounded-2xl flex items-center justify-center my-1 relative ${
                hasItem ? `${halo.bg} border-2 ${halo.border}` : 'bg-surface-container border border-surface-container-highest/60'
              }">
                ${hasItem ? `
                  <span class="material-symbols-outlined text-2xl ${halo.text}">${cat.icon}</span>
                  <span class="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase ${halo.text} bg-slate-950 border ${halo.border}">
                    L${itemData.level || 1}
                  </span>
                ` : `
                  <span class="material-symbols-outlined text-xl text-on-surface-variant/40">add</span>
                `}
              </div>

              <div class="text-center min-h-[32px] flex flex-col items-center justify-center mt-1">
                <span class="font-headline font-black text-xs text-on-surface truncate max-w-[100px]">
                  ${hasItem ? (itemData.name || 'Equipped') : 'Empty Slot'}
                </span>
                ${hasItem && itemData.statBonusLabel ? `
                  <span class="text-[9px] font-bold text-emerald-400 truncate max-w-[110px]">${itemData.statBonusLabel}</span>
                ` : ''}
              </div>

              ${hasItem ? `
                <button 
                  class="wardrobe-unequip-btn mt-2 px-2.5 py-1 rounded-xl bg-surface-container hover:bg-rose-500/20 text-rose-300 border border-surface-container-highest hover:border-rose-400/60 font-black text-[10px] active:scale-95 transition-all"
                  data-category="${cat.id}"
                >
                  Unequip
                </button>
              ` : `
                <button 
                  class="wardrobe-category-tab mt-2 px-2.5 py-1 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface-variant font-black text-[10px] active:scale-95 transition-all"
                  data-category="${cat.id}"
                >
                  Browse
                </button>
              `}
            </div>
          `;
        }).join('')}
      </div>

      <!-- Active Gear Buffs Banner -->
      ${buffs.activeBuffLabels.length > 0 ? `
        <div class="p-3 rounded-2xl bg-surface-container-lowest border border-primary/40 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-base">hotel_class</span>
          <span class="text-xs font-black text-on-surface">Active Set Bonus:</span>
          <div class="flex flex-wrap gap-1.5">
            ${buffs.activeBuffLabels.map(l => `
              <span class="px-2 py-0.5 rounded-lg bg-primary/20 text-primary-fixed border border-primary/40 text-[10px] font-black">${l}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Category Filter Tabs -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-1.5 p-1 bg-surface-container-lowest rounded-2xl border border-surface-container-highest">
          ${categories.map(cat => `
            <button 
              class="wardrobe-category-tab flex-1 py-2 px-2 rounded-xl font-headline font-black text-xs flex items-center justify-center gap-1 transition-all ${
                activeCategory === cat.id
                  ? 'bg-secondary text-slate-950 shadow-md'
                  : 'text-on-surface-variant hover:text-on-surface'
              }"
              data-category="${cat.id}"
            >
              <span class="material-symbols-outlined text-sm">${cat.icon}</span>
              <span>${cat.name}</span>
            </button>
          `).join('')}
        </div>

        <!-- Available Gear Items Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[36vh] overflow-y-auto pr-1">
          ${availableItems.map(item => {
            const currentlyEquipped = equippedGear[activeCategory] || equippedGear[categories.find(c => c.id === activeCategory)?.legacyKey];
            const isEquipped = currentlyEquipped && (currentlyEquipped.id === item.id || currentlyEquipped === item.id);
            const halo = getGearHaloStyle(item.level || 1);

            return `
              <div class="p-3.5 rounded-2xl bg-surface-container-high border-2 flex items-center justify-between gap-3 transition-all ${
                isEquipped ? `${halo.border} ${halo.bg} shadow-md` : 'border-surface-container-highest hover:border-primary/50'
              }">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center ${halo.bg} border-2 ${halo.border} ${halo.haloShadow}">
                    <span class="material-symbols-outlined text-xl ${halo.text}">${item.icon || 'shield'}</span>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="font-headline font-black text-xs text-on-surface truncate">${item.name}</span>
                      <span class="px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase ${halo.text} bg-slate-950 border ${halo.border}">
                        ${item.levelLabel || `Lv.${item.level}`}
                      </span>
                    </div>
                    <span class="text-[10px] text-on-surface-variant truncate">${item.desc}</span>
                    <span class="text-[10px] font-black text-emerald-400 mt-0.5">${item.statBonusLabel}</span>
                  </div>
                </div>

                <button 
                  class="${isEquipped ? 'wardrobe-unequip-btn' : 'wardrobe-equip-btn'} px-3 py-2 rounded-xl font-headline font-black text-xs flex-shrink-0 active:scale-95 transition-all ${
                    isEquipped
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                      : 'bg-primary text-slate-950 border-b-2 border-[#1b7a43] hover:bg-emerald-400 shadow-sm'
                  }"
                  data-category="${activeCategory}"
                  data-gear-id="${item.id}"
                >
                  ${isEquipped ? 'UNEQUIP' : 'EQUIP'}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// DRAWER: EXPEDITION (ADVENTURE)
// -----------------------------------------------------------------------------
function renderExpeditionDrawer(pet) {
  const sanct = store.getPetSanctuaryState();
  const exp = sanct.expedition || { active: false };
  let content = '';

  if (exp.active) {
    const elapsed = Date.now() - exp.startTime;
    const remaining = exp.durationMs - elapsed;
    if (remaining <= 0) {
      content = `
        <div class="flex flex-col items-center gap-4 text-center">
          <span class="text-5xl">🏆</span>
          <h4 class="font-bold text-xl text-emerald-400">Expedition Complete!</h4>
          <p class="text-xs text-on-surface-variant">${pet.name} brought back shiny rewards from the adventure!</p>
          <button id="claim-expedition-btn" class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-8 rounded-2xl text-sm shadow-xl active:scale-95">
            Claim Rewards (100 Coins 🪙, 50 Pet Training XP ⚡)
          </button>
        </div>
      `;
    } else {
      const min = Math.floor(remaining / 60000);
      const sec = Math.floor((remaining % 60000) / 1000);
      content = `
        <div class="flex flex-col items-center gap-4 text-center">
          <span class="text-5xl animate-bounce">🏕️</span>
          <h4 class="font-bold text-xl text-amber-400">${pet.name} is Exploring!</h4>
          <p id="expedition-countdown-display" class="text-lg text-white font-mono">${min}m ${sec}s remaining</p>
        </div>
      `;
    }
  } else {
    content = `
      <div class="flex flex-col items-center gap-4 text-center">
        <p class="text-sm text-slate-300">Send ${pet.name} on a 15-minute adventure to explore uncharted trails and discover rewards!</p>
        <div class="p-3 bg-surface-container-lowest rounded-2xl border border-surface-container-highest text-xs text-secondary font-bold">
          Rewards: 100 Hero Coins 🪙 + 50 Pet Training XP ⚡
        </div>
        <button id="start-expedition-btn" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 px-8 rounded-2xl text-sm shadow-lg active:scale-95">
          Send on Adventure
        </button>
      </div>
    `;
  }

  return `<div class="flex flex-col gap-5">${content}</div>`;
}

// -----------------------------------------------------------------------------
// DRAWER: WORKOUT (DAILY ROTATING PET COACH & GROSS-MOTOR TRAINING)
// -----------------------------------------------------------------------------
function renderWorkoutDrawer(pet) {
  const dailyCoach = getDailyRotatingPetCoach();

  return `
    <div class="flex flex-col gap-5">
      <!-- Daily Coach Hero Spotlight Card -->
      <div class="p-4 rounded-3xl bg-gradient-to-br from-surface-container-high to-surface-container-lowest border-2 border-amber-400/50 shadow-xl flex items-center gap-4">
        <div class="w-20 h-20 rounded-2xl bg-surface-container-lowest border-2 border-amber-400/60 flex items-center justify-center p-1.5 shadow-md flex-shrink-0">
          <img src="${dailyCoach.avatar || `/assets/pets/${dailyCoach.key || 'rex'}.png`}" alt="${dailyCoach.name}" class="w-full h-full object-contain filter drop-shadow">
        </div>
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40">
              Daily Coach
            </span>
            <span class="text-xs font-bold text-on-surface-variant">${dailyCoach.archetypeName}</span>
          </div>
          <h4 class="font-headline font-black text-lg text-on-surface truncate">Coach ${dailyCoach.name}</h4>
          <span class="text-xs font-black text-secondary mt-0.5">${dailyCoach.signatureMove}</span>
          <span class="text-[11px] text-on-surface-variant font-medium mt-1 leading-tight line-clamp-2">${dailyCoach.workoutDesc}</span>
        </div>
      </div>

      <!-- Training Rewards Banner -->
      <div class="flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest border border-emerald-400/40">
        <div class="flex items-center gap-2 text-emerald-400 font-black text-xs">
          <span class="material-symbols-outlined text-base">military_tech</span>
          <span>Workout Completion Bonus:</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-xl bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 text-xs font-black">+50 Pet XP ⚡</span>
          <span class="px-2.5 py-0.5 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-black">+100 Coins 🪙</span>
        </div>
      </div>

      <!-- Signature Gross Motor Exercise Steps -->
      <div class="flex flex-col gap-2.5">
        <span class="text-xs font-black uppercase text-on-surface-variant tracking-wider">Coach Routine:</span>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div class="p-3 rounded-2xl bg-surface-container-high border border-surface-container-highest flex flex-col">
            <span class="text-xs font-black text-primary mb-1">1. High Knees Stomp</span>
            <span class="text-[11px] text-on-surface-variant font-medium">Warm up big leg muscles with rhythm stomps!</span>
          </div>
          <div class="p-3 rounded-2xl bg-surface-container-high border border-surface-container-highest flex flex-col">
            <span class="text-xs font-black text-secondary mb-1">2. ${dailyCoach.signatureMove}</span>
            <span class="text-[11px] text-on-surface-variant font-medium">Follow Coach ${dailyCoach.name}'s signature motion!</span>
          </div>
          <div class="p-3 rounded-2xl bg-surface-container-high border border-surface-container-highest flex flex-col">
            <span class="text-xs font-black text-tertiary mb-1">3. Victory Hero Pose</span>
            <span class="text-[11px] text-on-surface-variant font-medium">Hold a balanced hero stance for maximum bond!</span>
          </div>
        </div>
      </div>

      <!-- Start Workout Action Button -->
      <button 
        id="start-coach-workout-btn"
        class="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 hover:opacity-95 text-slate-950 font-headline font-black text-sm flex items-center justify-center gap-2 border-b-4 border-amber-600 active:translate-y-1 active:border-b-0 transition-all shadow-xl"
      >
        <span class="material-symbols-outlined text-xl">fitness_center</span>
        <span>TRAIN WITH COACH ${dailyCoach.name.toUpperCase()} (+50 PET XP)</span>
      </button>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// DRAWER 4: 24 PET COMPANIONS ROSTER DRAWER (ALL 24 FIGURINES & ARCHETYPES)
// -----------------------------------------------------------------------------
function renderRosterDrawer(activePet) {
  const filter = selectedRosterFilter || 'all';

  const filterTabs = [
    { id: 'all', label: 'All (24)', icon: 'apps' },
    { id: 'dino', label: 'Dinos (8)', icon: 'cruelty_free' },
    { id: 'mystic', label: 'Mystics (5)', icon: 'auto_awesome' },
    { id: 'beast', label: 'Beasts (6)', icon: 'pets' },
    { id: 'aquatic', label: 'Aquatic (3)', icon: 'water' },
    { id: 'mech', label: 'Mechs (2)', icon: 'smart_toy' }
  ];

  const filteredPets = PETS_DATABASE.filter(p => {
    if (filter === 'all') return true;
    return (p.archetype || 'dino') === filter;
  });

  return `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="font-headline font-black text-sm text-on-surface">24 Companion Heroes</h4>
          <p class="text-[11px] text-on-surface-variant font-bold">Tactile 3D toy figurines • Level 1-25 mastery</p>
        </div>
        <span class="px-2.5 py-1 rounded-xl bg-secondary/20 text-secondary border border-secondary/40 font-black text-xs">
          ${filteredPets.length} Companions
        </span>
      </div>

      <!-- Archetype Filter Pills -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        ${filterTabs.map(tab => `
          <button 
            class="roster-filter-btn flex-shrink-0 px-3 py-1.5 rounded-xl font-headline font-black text-xs flex items-center gap-1.5 transition-all ${
              filter === tab.id
                ? 'bg-primary text-slate-950 shadow-md'
                : 'bg-surface-container-high hover:bg-surface-bright text-on-surface-variant border border-surface-container-highest'
            }"
            data-filter="${tab.id}"
          >
            <span class="material-symbols-outlined text-sm">${tab.icon}</span>
            <span>${tab.label}</span>
          </button>
        `).join('')}
      </div>

      <!-- 24 Pet Cards Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto pr-1">
        ${filteredPets.map(pet => {
          const isActive = String(pet.id) === String(activePet.id);
          const archetype = getPetArchetype(pet);
          const level = store.getPetLevel(pet.id);
          const levelData = getPetLevelData(level);
          const statBonus = calculatePetStatBonus(pet, level);
          const petImg = pet.avatar || `/assets/pets/${pet.key || 'rex'}.png`;

          return `
            <div 
              class="p-3.5 rounded-2xl border-2 flex flex-col justify-between transition-all ${
                isActive
                  ? 'bg-primary/15 border-primary shadow-lg ring-2 ring-primary/40'
                  : 'bg-surface-container-high hover:bg-surface-bright border-surface-container-highest'
              }"
            >
              <div class="flex items-center gap-3">
                <div class="w-16 h-16 rounded-2xl bg-surface-container-lowest border-2 ${
                  isActive ? 'border-primary' : 'border-surface-container-highest'
                } flex items-center justify-center p-1 shadow-inner flex-shrink-0">
                  <img 
                    src="${petImg}" 
                    alt="${pet.name}" 
                    class="w-full h-full object-contain filter drop-shadow hover:scale-105 transition-transform"
                    loading="lazy"
                    onerror="this.onerror=null; this.src='/assets/pets/${pet.key || 'rex'}.png';"
                  >
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="font-headline font-black text-sm text-on-surface truncate">${pet.name}</span>
                    <span class="px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase tracking-wider bg-secondary/20 text-secondary border border-secondary/40">
                      ${archetype.name}
                    </span>
                  </div>
                  <span class="text-[11px] font-bold text-cyan-300 mt-0.5">Lvl ${level}: ${levelData.title}</span>
                  <span class="text-[10px] font-black text-emerald-400 mt-0.5">${statBonus.label}</span>
                </div>
              </div>

              <div class="mt-3 pt-2.5 border-t border-surface-container-highest/60 flex items-center justify-between">
                <span class="text-[10px] text-on-surface-variant font-medium truncate max-w-[130px]">
                  ${pet.signatureMove || 'Hero Stomp'}
                </span>
                ${isActive ? `
                  <span class="px-3 py-1 rounded-xl bg-primary text-slate-950 font-black text-[11px] uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <span class="material-symbols-outlined text-xs">check_circle</span>
                    <span>ACTIVE</span>
                  </span>
                ` : `
                  <button 
                    class="switch-pet-btn px-3 py-1 rounded-xl bg-surface-container hover:bg-primary hover:text-slate-950 text-on-surface font-black text-[11px] uppercase tracking-wider border border-surface-container-highest active:scale-95 transition-all"
                    data-pet-id="${pet.id}"
                  >
                    SELECT
                  </button>
                `}
              </div>
            </div>
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
    const activePet = store.getActivePet() || PETS_DATABASE[0];
    const equippedGear = (state.petGear && state.petGear[activePet.id]) || {};

    activeCanvasInstance = new PetSanctuaryCanvas(mount, {
      petId: activePet.id,
      gear: equippedGear
    });
    registerActiveCanvas(activeCanvasInstance);
  }

  // Back Button
  const backBtn = document.getElementById('sanctuary-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      Sound.bloop();
      store.navigate('dashboard');
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

  const rosterDockBtn = document.getElementById('action-roster-dock-btn');
  if (rosterDockBtn) {
    rosterDockBtn.addEventListener('click', () => {
      Sound.bloop();
      store.openSanctuaryDrawer('roster');
    });
  }
  
  const expBtn = document.getElementById('action-expedition-btn');
  if (expBtn) {
    expBtn.addEventListener('click', () => { Sound.bloop(); store.openSanctuaryDrawer('expedition'); });
  }

  const workBtn = document.getElementById('action-workout-btn');
  if (workBtn) {
    workBtn.addEventListener('click', () => { Sound.bloop(); store.openSanctuaryDrawer('workout'); });
  }

  const topWorkoutBtn = document.getElementById('sanctuary-workout-btn');
  if (topWorkoutBtn) {
    topWorkoutBtn.addEventListener('click', () => { Sound.bloop(); store.openSanctuaryDrawer('workout'); });
  }

  if (expeditionInterval) {
    clearInterval(expeditionInterval);
    expeditionInterval = null;
  }

  const sanctState = store.getPetSanctuaryState();
  if (sanctState.activeDrawer === 'expedition' && sanctState.expedition?.active) {
    const countdownEl = document.getElementById('expedition-countdown-display');
    if (countdownEl) {
      expeditionInterval = setInterval(() => {
        const currentExp = store.getPetSanctuaryState().expedition;
        if (!currentExp || !currentExp.active) {
          clearInterval(expeditionInterval);
          expeditionInterval = null;
          return;
        }
        const elapsed = Date.now() - currentExp.startTime;
        const remaining = currentExp.durationMs - elapsed;
        if (remaining <= 0) {
          clearInterval(expeditionInterval);
          expeditionInterval = null;
          store.notify();
        } else {
          const min = Math.floor(remaining / 60000);
          const sec = Math.floor((remaining % 60000) / 1000);
          countdownEl.textContent = `${min}m ${sec}s remaining`;
        }
      }, 1000);
    }
  }

  const startExpBtn = document.getElementById('start-expedition-btn');
  if (startExpBtn) {
    startExpBtn.addEventListener('click', () => {
      if (expeditionInterval) {
        clearInterval(expeditionInterval);
        expeditionInterval = null;
      }
      Sound.fanfare();
      store.startPetExpedition();
      store.closeSanctuaryDrawer();
    });
  }

  const claimExpBtn = document.getElementById('claim-expedition-btn');
  if (claimExpBtn) {
    claimExpBtn.addEventListener('click', () => {
      if (expeditionInterval) {
        clearInterval(expeditionInterval);
        expeditionInterval = null;
      }
      Sound.fanfare();
      store.claimExpeditionRewards();
      const activePet = store.getActivePet();
      store.addPetTrainingXp(activePet.id, 50);
      store.showReward('Expedition Complete! 🏆', `${activePet?.name || 'Your companion'} brought back 100 Coins 🪙 and 50 Pet Training XP ⚡!`, 100, 0, null, 'explore');
      store.closeSanctuaryDrawer();
    });
  }

  const coachWorkoutBtn = document.getElementById('start-coach-workout-btn');
  if (coachWorkoutBtn) {
    coachWorkoutBtn.addEventListener('click', () => {
      Sound.fanfare();
      store.closeSanctuaryDrawer();
      store.navigate('dino_workout');
    });
  }

  document.querySelectorAll('.start-workout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const wId = btn.getAttribute('data-workout-id');
      store.setActiveWorkoutId(wId);
      store.saveState(true);
      store.closeSanctuaryDrawer();
      store.navigate('dino_workout');
    });
  });

  // Roster Switch Button
  const rosterBtn = document.getElementById('sanctuary-roster-btn');
  if (rosterBtn) {
    rosterBtn.addEventListener('click', () => {
      Sound.bloop();
      store.openSanctuaryDrawer('roster');
    });
  }

  // Roster Archetype Filter Pills
  document.querySelectorAll('.roster-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Sound.bloop();
      selectedRosterFilter = btn.getAttribute('data-filter') || 'all';
      store.notify();
    });
  });

  // Wardrobe Category Tabs
  document.querySelectorAll('.wardrobe-category-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      Sound.bloop();
      selectedWardrobeCategory = btn.getAttribute('data-category') || 'masks';
      store.notify();
    });
  });

  // Wardrobe Equip Buttons
  document.querySelectorAll('.wardrobe-equip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-category');
      const gearId = btn.getAttribute('data-gear-id');
      const activePet = store.getActivePet();
      if (activePet && cat && gearId) {
        Sound.sparkle();
        const item = getGearItem(cat, gearId);
        store.equipPetStudioGear(activePet.id, cat, item || gearId);
      }
    });
  });

  // Wardrobe Unequip Buttons
  document.querySelectorAll('.wardrobe-unequip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-category');
      const activePet = store.getActivePet();
      if (activePet && cat) {
        Sound.bloop();
        store.equipPetStudioGear(activePet.id, cat, null);
      }
    });
  });

  // Roster Switch Pet Buttons
  document.querySelectorAll('.switch-pet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const petId = btn.getAttribute('data-pet-id');
      if (petId) {
        Sound.bloop();
        store.setActivePet(petId);
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
