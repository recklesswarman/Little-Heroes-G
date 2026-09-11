import { renderPet3DViewer, initPet3DViewer } from '../components/Pet3DViewer.js';
import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { speakRex } from '../services/voiceService.js';
import confetti from 'canvas-confetti';
import {
  ROOM_THEMES,
  FURNITURE_SLOTS,
  FURNITURE_ITEMS,
  getHQTheme,
  getFurnitureItem,
  getFurnitureForSlot,
  getTrophiesForDisplay
} from '../data/heroHQData.js';

// Local UI state for live previewing and interactive widgets
let activePreviewItem = null;
let selectedTrophyForModal = null;
let isHologramActive = false;
let isNapping = false;
let isBouncing = false;
let napTimeout = null;
let bounceTimeout = null;
let hasSpokenHQGreeting = false;

export function renderHeroHQView() {
  const state = store.getState();
  const hero = state.selectedHero || {};
  const heroHQ = state.heroHQ || {
    themeId: 'dino_treehouse',
    isNightMode: false,
    equippedFurniture: {
      bed: 'dino_leaf_canopy',
      petLounge: 'giant_beanbag',
      desk: 'hologram_mission_table',
      decor: 'starlight_projector_lamp',
      rug: 'hero_road_rug'
    },
    unlockedFurnitureIds: [
      'dino_leaf_canopy',
      'giant_beanbag',
      'hologram_mission_table',
      'starlight_projector_lamp',
      'hero_road_rug'
    ],
    featuredTrophyIds: ['rookie_hero_crest'],
    redecorateDrawerOpen: false,
    redecorateActiveCategory: 'themes'
  };

  const currentTheme = getHQTheme(heroHQ.themeId);
  const isNight = Boolean(heroHQ.isNightMode);
  const coins = hero.coins || 0;
  const activePet = store.getActivePet ? store.getActivePet() : { name: 'Rex', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZfP7_Cwlp4sz41asI8ymuapAKvjmqHtvI4zcMAF_XwUmibj8IheGrS5cA5QD5gmXgVxEkZM9FlWJPRZnct3x6-9SQB7zJKqkEDjJ3m95tAy3zRqS-PbmcQ4kv_9pmIfm2Py4mh3Fw083hkDookz1w4_r50SBA1jc9igDaAPFLYBFgSP2aQBz7Q4jVE-DwhMOyUEHlxDkQk6Gwc2EAFCSKs1c0QuhUOi3tkrk5MXRARKqZcYVzyJe6gA' };

  // Resolve equipped items (applying live preview if active)
  const equipped = { ...(heroHQ.equippedFurniture || {}) };
  if (activePreviewItem && activePreviewItem.slot) {
    equipped[activePreviewItem.slot] = activePreviewItem.id;
  }

  const bedItem = getFurnitureItem(equipped.bed) || FURNITURE_ITEMS[0];
  const petLoungeItem = getFurnitureItem(equipped.petLounge) || FURNITURE_ITEMS[5];
  const deskItem = getFurnitureItem(equipped.desk) || FURNITURE_ITEMS[10];
  const decorItem = getFurnitureItem(equipped.decor) || FURNITURE_ITEMS[15];
  const rugItem = getFurnitureItem(equipped.rug) || FURNITURE_ITEMS[20];

  const trophies = getTrophiesForDisplay(state);
  const featuredTrophyIds = Array.isArray(heroHQ.featuredTrophyIds) ? heroHQ.featuredTrophyIds : ['rookie_hero_crest'];
  const featuredTrophies = [0, 1, 2, 3].map(slotIdx => {
    const tId = featuredTrophyIds[slotIdx];
    return tId ? trophies.find(t => t.id === tId) || null : null;
  });

  // Calculate habit stats for the Hologram Globe
  const brushStreak = state.brushStreak || hero.streak || 1;
  const choresDone = (state.choresCompletedCount || 0) + (state.taskCompletionLogs?.length || 0);
  const totalTrophies = trophies.length;

  return `
  <div class="hero-hq-container max-w-5xl mx-auto px-3 pt-3 pb-28 flex flex-col gap-4 animate-fade-in select-none relative font-body">

    <!-- Top Action & Navigation Bar -->
    <div class="flex flex-wrap items-center justify-between gap-3 bg-surface-container/90 backdrop-blur-md px-4 py-3 rounded-3xl border-2 border-surface-container-highest shadow-md z-30">
      <div class="flex items-center gap-3">
        <button id="hq-back-dashboard-btn" class="bg-surface-bright hover:bg-surface-container-highest text-primary p-2.5 rounded-2xl border border-primary/30 transition-all flex items-center justify-center chunky-btn-sm" title="Back to Quests">
          <span class="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div class="flex flex-col">
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-black uppercase tracking-wider text-primary font-headline flex items-center gap-1">
              🏠 Hero HQ & Hideout
            </span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-black ${isNight ? 'bg-indigo-900/60 text-cyan-300 border border-cyan-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}">
              ${isNight ? '🌙 Starlight Night' : '☀️ Daytime Glow'}
            </span>
          </div>
          <h1 class="font-headline text-lg sm:text-xl font-black text-inverse-surface flex items-center gap-1.5">
            ${currentTheme.name}
          </h1>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Day/Night Lighting Switch -->
        <button id="hq-toggle-night-btn" class="px-3.5 py-2 rounded-2xl font-headline text-xs font-black border-2 transition-all flex items-center gap-1.5 chunky-btn-sm ${isNight ? 'bg-indigo-950 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-amber-100 text-amber-900 border-amber-400 hover:bg-amber-200'}">
          <span class="material-symbols-outlined text-base">${isNight ? 'bedtime' : 'light_mode'}</span>
          <span class="hidden sm:inline">${isNight ? 'Night Starlight' : 'Daylight Mode'}</span>
        </button>

        <!-- Redecorate Studio Button -->
        <button id="hq-open-redecorate-btn" class="bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-400 text-on-primary px-4 py-2 rounded-2xl font-headline text-xs font-black border-2 border-emerald-300 shadow-md flex items-center gap-1.5 chunky-btn-sm">
          <span class="material-symbols-outlined text-base">palette</span>
          <span>Redecorate</span>
        </button>

        <!-- Tokens Counter -->
        <div class="flex items-center gap-1 bg-surface-bright/90 px-3 py-1.5 rounded-2xl border border-amber-400/40 shadow-inner">
          <span class="text-sm">🪙</span>
          <span class="font-headline text-xs font-black text-amber-300">${coins}</span>
        </div>
      </div>
    </div>

    <!-- 2.5D Isometric Bedroom & Superhero Hideout Stage -->
    <div id="hq-stage-wrapper" class="relative w-full rounded-3xl overflow-hidden border-4 ${currentTheme.floorColor} shadow-2xl transition-all duration-700 min-h-[520px] sm:min-h-[580px] flex flex-col justify-between ${isNight ? 'bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900' : 'bg-gradient-to-b ' + currentTheme.bgGradient}">
      
      <!-- Night Mode Starlight Constellation Overlay -->
      <div class="absolute inset-0 pointer-events-none transition-opacity duration-700 ${isNight ? 'opacity-100' : 'opacity-0'}">
        <div class="absolute top-4 left-8 text-xl animate-pulse text-amber-200">✨</div>
        <div class="absolute top-12 left-1/4 text-sm animate-ping text-cyan-200">⭐</div>
        <div class="absolute top-6 left-1/2 text-2xl animate-pulse text-yellow-100">🌟</div>
        <div class="absolute top-10 right-1/3 text-sm animate-bounce text-pink-200">✨</div>
        <div class="absolute top-5 right-12 text-xl animate-pulse text-cyan-100">⭐</div>
        <div class="absolute top-16 right-1/4 text-xs animate-ping text-yellow-200">✨</div>
        <!-- Soft Ceiling Galaxy Glow -->
        <div class="absolute -top-12 inset-x-0 h-40 bg-radial from-indigo-500/20 via-transparent to-transparent blur-xl"></div>
      </div>

      <!-- Live Preview Banner if Active -->
      ${activePreviewItem ? `
        <div class="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-amber-400 text-slate-950 px-4 py-1.5 rounded-full font-headline text-xs font-black flex items-center gap-2 shadow-lg animate-bounce border-2 border-white">
          <span>👀 Live Preview: ${activePreviewItem.name}</span>
          <button id="hq-cancel-preview-btn" class="bg-black/20 hover:bg-black/40 text-black px-2 py-0.5 rounded-md text-[10px] uppercase font-black">Cancel</button>
        </div>
      ` : ''}

      <!-- Back Wall: 3D Trophy Showcase & Spotlights -->
      <div class="relative z-10 w-full px-4 pt-4 pb-2 flex flex-col gap-2">
        <div class="flex items-center justify-between border-b border-white/10 pb-1.5">
          <div class="flex items-center gap-2">
            <span class="text-sm">🏆</span>
            <h3 class="font-headline text-xs font-black uppercase tracking-wider text-amber-300 drop-shadow">
              Trophy Showcase & Spotlights
            </h3>
          </div>
          <button id="hq-view-all-trophies-btn" class="text-[10px] font-headline font-black text-cyan-300 hover:text-cyan-200 flex items-center gap-1 bg-black/30 px-2.5 py-1 rounded-xl border border-cyan-400/30">
            <span class="material-symbols-outlined text-xs">military_tech</span>
            All Trophies (${totalTrophies})
          </button>
        </div>

        <!-- 4 Featured Spotlight Pedestals -->
        <div class="grid grid-cols-4 gap-2 sm:gap-4 max-w-2xl mx-auto w-full pt-1">
          ${featuredTrophies.map((trophy, idx) => {
            if (trophy) {
              return `
                <div class="group relative flex flex-col items-center cursor-pointer transition-transform hover:scale-105" data-inspect-trophy-id="${trophy.id}">
                  <!-- Spotlight Beam -->
                  <div class="absolute -top-4 w-12 h-16 bg-gradient-to-b from-yellow-300/20 to-transparent blur-[2px] pointer-events-none rounded-full"></div>
                  <!-- Trophy 3D Icon & Pedestal -->
                  <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${trophy.iconColor} p-0.5 shadow-[0_0_15px_rgba(234,179,8,0.4)] border-2 border-yellow-200 flex items-center justify-center text-2xl sm:text-3xl animate-pulse">
                    ${trophy.emoji}
                  </div>
                  <!-- Mini Plaque -->
                  <div class="mt-1.5 px-2 py-0.5 rounded-lg bg-black/60 border border-yellow-400/40 text-[9px] sm:text-[10px] font-black text-amber-200 text-center truncate max-w-[85px]">
                    ${trophy.title}
                  </div>
                  <span class="text-[8px] text-white/60 font-bold uppercase tracking-widest mt-0.5">Spotlight #${idx + 1}</span>
                </div>
              `;
            } else {
              return `
                <div class="flex flex-col items-center justify-center cursor-pointer opacity-70 hover:opacity-100 transition-opacity" data-pin-slot="${idx}">
                  <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/5 border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-white/50 hover:border-amber-400 hover:text-amber-300 transition-colors">
                    <span class="material-symbols-outlined text-base sm:text-xl">add</span>
                  </div>
                  <span class="text-[9px] text-white/40 font-black mt-1 uppercase">Spotlight #${idx + 1}</span>
                </div>
              `;
            }
          }).join('')}
        </div>
      </div>

      <!-- Isometric 2.5D Floor Stage Area -->
      <div class="relative w-full flex-1 flex flex-col justify-end min-h-[340px] sm:min-h-[380px] px-4 pb-6">

        <!-- Wall Shadows & Floor Perspective Gradient -->
        <div class="absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none"></div>

        <!-- Center Floor Rug (Positioned flat beneath roaming pets) -->
        <div id="hq-slot-rug" class="absolute bottom-10 left-1/2 -translate-x-1/2 w-64 sm:w-80 h-32 sm:h-40 rounded-[50px] bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-cyan-500/20 border-2 border-white/20 shadow-inner flex flex-col items-center justify-center transition-all cursor-pointer hover:scale-102 hover:border-amber-300" title="${rugItem.name} - Tap to play!">
          <div class="text-3xl sm:text-4xl opacity-80 animate-pulse">${rugItem.icon || rugItem.emoji}</div>
          <span class="text-[10px] font-headline font-black text-white/70 bg-black/30 px-2.5 py-0.5 rounded-full border border-white/10 mt-1">
            ${rugItem.name}
          </span>
        </div>

        <!-- Free-Roaming Companion Pets on Room Floor -->
        <div id="hq-roaming-pet" class="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center cursor-pointer transition-transform hover:scale-110 group" title="${activePet.name} is chilling in your HQ!">
          <!-- Speech Bubble -->
          <div class="mb-1 bg-white text-slate-900 text-[10px] sm:text-xs font-black px-3 py-1 rounded-full shadow-lg border-2 border-emerald-400 animate-bounce flex items-center gap-1">
            <span>🐾</span>
            <span>${isNight ? 'Nighty night, Hero! 🌙' : 'I love our secret base! 🦖'}</span>
          </div>
          <!-- 3D Roaming Companion Pet Model -->
          <div class="w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center pointer-events-auto">
            ${renderPet3DViewer({
              canvasId: 'hq-roaming-pet-3d',
              petId: activePet.id || 'rex',
              stage: store.getState().selectedHero?.petStageMap?.[activePet.id || 'rex'] || 1,
              mode: 'hq',
              avatarFallback: activePet.avatar,
              petName: activePet.name,
              width: 130,
              height: 130,
              showControls: false
            })}
          </div>
          <span class="mt-1 px-2 py-0.5 rounded-full bg-black/60 text-white font-headline text-[10px] font-black border border-white/20">
            ${activePet.name}
          </span>
        </div>

        <!-- Hologram Quest HUD Overlay (If desk is clicked) -->
        ${isHologramActive ? `
          <div id="hq-hologram-hud" class="absolute top-8 right-6 z-30 bg-cyan-950/90 backdrop-blur-md p-4 rounded-3xl border-2 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.5)] text-cyan-200 max-w-xs animate-scale-up flex flex-col gap-2">
            <div class="flex items-center justify-between border-b border-cyan-500/30 pb-1.5">
              <div class="flex items-center gap-1.5 text-xs font-headline font-black uppercase text-cyan-300">
                <span class="material-symbols-outlined text-sm animate-spin">cyclone</span>
                Mission Holo-Status
              </div>
              <button id="hq-close-hologram-btn" class="text-cyan-400 hover:text-white text-xs font-black">✕</button>
            </div>
            <div class="text-[11px] font-bold space-y-1">
              <div class="flex justify-between">
                <span>🔥 Brushing Streak:</span>
                <span class="font-black text-amber-300">${brushStreak} Days</span>
              </div>
              <div class="flex justify-between">
                <span>🛡️ Chores Mastered:</span>
                <span class="font-black text-emerald-300">${choresDone} Done</span>
              </div>
              <div class="flex justify-between">
                <span>🏆 Trophies Displayed:</span>
                <span class="font-black text-yellow-300">${totalTrophies} Cups</span>
              </div>
              <div class="flex justify-between">
                <span>🪙 Habit Tokens:</span>
                <span class="font-black text-cyan-300">${coins}</span>
              </div>
            </div>
            <div class="text-[9px] bg-cyan-900/50 p-1.5 rounded-xl text-center text-cyan-100 font-bold">
              "Great work, Little Hero! Every daily habit strengthens your superhero squad!"
            </div>
          </div>
        ` : ''}

        <!-- Interactive Placement Slots (Grid Layout) -->
        <div class="relative z-10 w-full grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 items-end">
          
          <!-- Slot 1: BED & NAPPING POD (Left) -->
          <div id="hq-slot-bed" class="flex flex-col items-center cursor-pointer group transition-transform hover:-translate-y-1" title="${bedItem.name} - Tap to snooze!">
            <div class="relative w-full max-w-[140px] h-28 sm:h-32 rounded-3xl bg-surface-container/80 backdrop-blur-sm border-2 ${isNight ? 'border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)]' : 'border-white/30'} flex flex-col items-center justify-center p-2 text-center group-hover:border-primary transition-all">
              <!-- Zzz Sleep Bubble if napping -->
              ${isNapping ? `
                <div class="absolute -top-6 text-xl animate-bounce">💤💤💤</div>
              ` : ''}
              ${bedItem.modelUrl ? `
                <model-viewer src="${bedItem.modelUrl}" auto-rotate camera-controls shadow-intensity="1" ar style="width: 100%; height: 60px; background: transparent;"></model-viewer>
              ` : `
                <div class="text-3xl sm:text-4xl transition-transform group-hover:scale-110">
                  ${bedItem.icon || bedItem.emoji}
                </div>
              `}
              <div class="text-[10px] font-headline font-black text-inverse-surface truncate w-full mt-1">
                ${bedItem.name}
              </div>
              <span class="text-[9px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md mt-0.5">
                ${isNapping ? 'Snoozing... 💤' : bedItem.actionPrompt || 'Take a Snooze'}
              </span>
            </div>
          </div>

          <!-- Slot 2: PET LOUNGE & TRAMPOLINE (Center-Left) -->
          <div id="hq-slot-petLounge" class="flex flex-col items-center cursor-pointer group transition-transform hover:-translate-y-1" title="${petLoungeItem.name} - Tap to play!">
            <div class="relative w-full max-w-[140px] h-28 sm:h-32 rounded-3xl bg-surface-container/80 backdrop-blur-sm border-2 border-white/30 flex flex-col items-center justify-center p-2 text-center group-hover:border-amber-400 transition-all ${isBouncing ? 'animate-bounce border-amber-400' : ''}">
              ${isBouncing ? `
                <div class="absolute -top-7 text-xl animate-ping">🤸💥</div>
              ` : ''}
              ${petLoungeItem.modelUrl ? `
                <model-viewer src="${petLoungeItem.modelUrl}" auto-rotate camera-controls shadow-intensity="1" ar style="width: 100%; height: 60px; background: transparent;"></model-viewer>
              ` : `
                <div class="text-3xl sm:text-4xl transition-transform group-hover:scale-110 ${isBouncing ? 'animate-spin' : ''}">
                  ${petLoungeItem.icon || petLoungeItem.emoji}
                </div>
              `}
              <div class="text-[10px] font-headline font-black text-inverse-surface truncate w-full mt-1">
                ${petLoungeItem.name}
              </div>
              <span class="text-[9px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md mt-0.5">
                ${isBouncing ? 'SUPER BOING!' : petLoungeItem.actionPrompt || 'Bounce & Play'}
              </span>
            </div>
          </div>

          <!-- Slot 3: MISSION DESK & WORKSTATION (Center-Right) -->
          <div id="hq-slot-desk" class="flex flex-col items-center cursor-pointer group transition-transform hover:-translate-y-1" title="${deskItem.name} - Tap for hologram!">
            <div class="relative w-full max-w-[140px] h-28 sm:h-32 rounded-3xl bg-surface-container/80 backdrop-blur-sm border-2 ${isHologramActive ? 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]' : 'border-white/30'} flex flex-col items-center justify-center p-2 text-center group-hover:border-cyan-400 transition-all">
              ${deskItem.modelUrl ? `
                <model-viewer src="${deskItem.modelUrl}" auto-rotate camera-controls shadow-intensity="1" ar style="width: 100%; height: 60px; background: transparent;"></model-viewer>
              ` : `
                <div class="text-3xl sm:text-4xl transition-transform group-hover:scale-110 ${isHologramActive ? 'animate-pulse' : ''}">
                  ${deskItem.icon || deskItem.emoji}
                </div>
              `}
              <div class="text-[10px] font-headline font-black text-inverse-surface truncate w-full mt-1">
                ${deskItem.name}
              </div>
              <span class="text-[9px] text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-md mt-0.5">
                ${isHologramActive ? 'Holo Active 🌐' : deskItem.actionPrompt || 'Hologram Globe'}
              </span>
            </div>
          </div>

          <!-- Slot 4: DECOR & NIGHTLIGHT LAMP (Right) -->
          <div id="hq-slot-decor" class="flex flex-col items-center cursor-pointer group transition-transform hover:-translate-y-1" title="${decorItem.name} - Tap to toggle nightlight!">
            <div class="relative w-full max-w-[140px] h-28 sm:h-32 rounded-3xl bg-surface-container/80 backdrop-blur-sm border-2 ${isNight ? 'border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.5)]' : 'border-white/30'} flex flex-col items-center justify-center p-2 text-center group-hover:border-yellow-400 transition-all">
              <div class="text-3xl sm:text-4xl transition-transform group-hover:scale-110 animate-pulse">
                ${decorItem.icon || decorItem.emoji}
              </div>
              <div class="text-[10px] font-headline font-black text-inverse-surface truncate w-full mt-1">
                ${decorItem.name}
              </div>
              <span class="text-[9px] text-yellow-300 font-bold bg-yellow-500/10 px-2 py-0.5 rounded-md mt-0.5 flex items-center gap-1">
                <span class="material-symbols-outlined text-[11px]">power_settings_new</span>
                ${isNight ? 'Turn Day' : 'Night Starlight'}
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>

    <!-- Redecorate Studio Slide-Up Drawer -->
    ${heroHQ.redecorateDrawerOpen ? renderRedecorateDrawer(state) : ''}

    <!-- Trophy Inspect Modal -->
    ${selectedTrophyForModal ? renderTrophyModal(selectedTrophyForModal, state) : ''}

  </div>
  `;
}

function renderRedecorateDrawer(state) {
  const heroHQ = state.heroHQ || {};
  const activeCategory = heroHQ.redecorateActiveCategory || 'themes';
  const unlockedIds = new Set(heroHQ.unlockedFurnitureIds || []);
  const equipped = heroHQ.equippedFurniture || {};
  const coins = state.selectedHero?.coins || 0;

  return `
  <div id="hq-redecorate-backdrop" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end animate-fade-in">
    <div id="hq-redecorate-panel" class="bg-surface-container-high border-t-4 border-primary rounded-t-[36px] p-5 max-w-4xl mx-auto w-full max-h-[85vh] flex flex-col gap-4 shadow-2xl overflow-hidden animate-slide-up">
      
      <!-- Drawer Header -->
      <div class="flex items-center justify-between border-b border-surface-container-highest pb-3">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🎨</span>
          <div>
            <h3 class="font-headline text-lg font-black text-inverse-surface">
              Hero HQ Redecorate Studio
            </h3>
            <p class="text-xs text-on-surface-variant font-bold">
              Customize your hideout theme, furniture, and play mats!
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 bg-surface-bright px-3 py-1.5 rounded-2xl border border-amber-400/40">
            <span class="text-base">🪙</span>
            <span class="font-headline text-sm font-black text-amber-300">${coins}</span>
          </div>
          <button id="hq-close-redecorate-btn" class="bg-surface-bright hover:bg-surface-container-highest text-on-surface p-2 rounded-2xl border border-surface-container-highest chunky-btn-sm">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </div>

      <!-- Category Filter Tabs -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button class="hq-cat-tab px-3.5 py-2 rounded-2xl font-headline text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap chunky-btn-sm ${activeCategory === 'themes' ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-bright text-on-surface-variant hover:bg-surface-container-highest'}" data-category="themes">
          <span>🏛️</span> Themes
        </button>
        ${FURNITURE_SLOTS.map(slot => `
          <button class="hq-cat-tab px-3.5 py-2 rounded-2xl font-headline text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap chunky-btn-sm ${activeCategory === slot.id ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-bright text-on-surface-variant hover:bg-surface-container-highest'}" data-category="${slot.id}">
            <span>${slot.emoji}</span> ${slot.name}
          </button>
        `).join('')}
      </div>

      <!-- Items Grid -->
      <div class="overflow-y-auto max-h-[50vh] pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${activeCategory === 'themes' ? renderThemesGrid(heroHQ) : renderFurnitureGrid(activeCategory, heroHQ, coins)}
      </div>

    </div>
  </div>
  `;
}

function renderThemesGrid(heroHQ) {
  const currentThemeId = heroHQ.themeId;

  return ROOM_THEMES.map(theme => {
    const isEquipped = currentThemeId === theme.id;
    return `
      <div class="p-4 rounded-3xl border-2 ${isEquipped ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(46,204,113,0.3)]' : 'border-surface-container-highest bg-surface-bright/60'} flex flex-col justify-between gap-3">
        <div class="flex items-start gap-3">
          <div class="text-3xl p-2.5 rounded-2xl bg-surface-container border border-white/10">
            ${theme.emoji}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <h4 class="font-headline text-sm font-black text-inverse-surface truncate">
                ${theme.shortName}
              </h4>
              ${isEquipped ? '<span class="bg-primary text-on-primary text-[9px] font-black px-2 py-0.5 rounded-full">ACTIVE</span>' : ''}
            </div>
            <p class="text-xs text-on-surface-variant line-clamp-2 mt-0.5">
              ${theme.desc}
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between pt-1 border-t border-white/5">
          <span class="text-[10px] uppercase font-black tracking-wider text-primary">
            ${theme.bannerBadge}
          </span>
          ${isEquipped ? `
            <button class="bg-surface-container text-primary text-xs font-black px-3.5 py-1.5 rounded-xl border border-primary/40 cursor-default" disabled>
              Equipped ✅
            </button>
          ` : `
            <button class="hq-select-theme-btn bg-primary hover:bg-primary/90 text-on-primary text-xs font-black px-4 py-1.5 rounded-xl shadow chunky-btn-sm" data-theme-id="${theme.id}">
              Apply Theme 🪄
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function renderFurnitureGrid(slotId, heroHQ, userCoins) {
  const items = getFurnitureForSlot(slotId);
  const unlocked = new Set(heroHQ.unlockedFurnitureIds || []);
  const equippedId = heroHQ.equippedFurniture?.[slotId];

  return items.map(item => {
    const isEquipped = equippedId === item.id;
    const isUnlocked = unlocked.has(item.id);
    const canAfford = userCoins >= item.costCoins;

    return `
      <div class="p-4 rounded-3xl border-2 ${isEquipped ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-surface-container-highest bg-surface-bright/60'} flex flex-col justify-between gap-3">
        <div class="flex items-start gap-3">
          <div class="text-3xl p-2.5 rounded-2xl bg-surface-container border border-white/10">
            ${item.icon || item.emoji}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <h4 class="font-headline text-sm font-black text-inverse-surface truncate">
                ${item.name}
              </h4>
              ${isEquipped ? '<span class="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">IN ROOM</span>' : ''}
            </div>
            <p class="text-xs text-on-surface-variant line-clamp-2 mt-0.5">
              ${item.desc}
            </p>
          </div>
        </div>

        <!-- Action / Unlock Section -->
        <div class="flex items-center justify-between pt-1 border-t border-white/5">
          <div class="flex items-center gap-1">
            ${item.costCoins > 0 ? `
              <span class="text-xs">🪙</span>
              <span class="font-headline text-xs font-black text-amber-300">${item.costCoins}</span>
            ` : `
              <span class="text-[10px] font-black uppercase text-emerald-400">Starter Free</span>
            `}
          </div>

          <div class="flex items-center gap-1.5">
            ${isEquipped ? `
              <button class="bg-surface-container text-emerald-400 text-xs font-black px-3.5 py-1.5 rounded-xl border border-emerald-500/40 cursor-default" disabled>
                Equipped ✅
              </button>
            ` : isUnlocked ? `
              <button class="hq-equip-item-btn bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black px-4 py-1.5 rounded-xl shadow chunky-btn-sm" data-slot="${item.slot}" data-item-id="${item.id}">
                Place in Room 🪄
              </button>
            ` : `
              <button class="hq-unlock-item-btn ${canAfford ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-surface-container text-on-surface-variant opacity-60'} text-xs font-black px-3.5 py-1.5 rounded-xl border border-amber-400/40 flex items-center gap-1 chunky-btn-sm" data-item-id="${item.id}" ${!canAfford ? 'disabled' : ''}>
                <span>🪙</span> Unlock
              </button>
            `}
          </div>
        </div>

        ${!isUnlocked && item.reqLabel ? `
          <div class="text-[10px] text-amber-300/90 font-bold bg-amber-500/10 px-2.5 py-1 rounded-xl flex items-center gap-1">
            <span class="material-symbols-outlined text-xs">lock</span>
            <span>Milestone: ${item.reqLabel}</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderTrophyModal(trophy, state) {
  const heroHQ = state.heroHQ || {};
  const featuredIds = heroHQ.featuredTrophyIds || [];

  return `
  <div id="hq-trophy-modal-backdrop" class="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
    <div class="bg-surface-container-high border-4 border-amber-400 rounded-3xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(234,179,8,0.4)] flex flex-col items-center gap-4 text-center animate-scale-up">
      
      <!-- Trophy 3D Icon & Glow -->
      <div class="relative">
        <div class="absolute -inset-3 bg-radial from-amber-400/40 via-transparent to-transparent rounded-full blur-md"></div>
        <div class="relative w-24 h-24 rounded-3xl bg-gradient-to-br ${trophy.iconColor} p-1 shadow-2xl border-4 border-amber-200 flex items-center justify-center text-6xl">
          ${trophy.emoji}
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-[11px] font-black uppercase tracking-widest text-amber-400 font-headline">
          ${trophy.category}
        </span>
        <h3 class="font-headline text-xl sm:text-2xl font-black text-inverse-surface">
          ${trophy.title}
        </h3>
        <span class="text-xs text-on-surface-variant font-bold">
          Achieved: ${trophy.dateEarned}
        </span>
      </div>

      <p class="text-sm text-on-surface font-medium bg-surface-bright/80 p-3.5 rounded-2xl border border-white/10">
        ${trophy.lore}
      </p>

      <!-- Rex Spoken Voice Praise Box -->
      <div class="w-full bg-emerald-950/40 border border-emerald-400/40 p-3 rounded-2xl flex flex-col gap-2 text-left">
        <div class="flex items-center justify-between">
          <span class="text-xs font-headline font-black text-emerald-300 flex items-center gap-1.5">
            <span>🦖</span> Rex Companion Praise
          </span>
          <button id="hq-speak-trophy-btn" class="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black px-2.5 py-1 rounded-xl flex items-center gap-1 chunky-btn-sm" data-praise="${trophy.rexPraise}">
            <span class="material-symbols-outlined text-sm">volume_up</span> Hear Rex!
          </button>
        </div>
        <p class="text-xs text-emerald-100 italic">
          "${trophy.rexPraise}"
        </p>
      </div>

      <!-- Spotlight Pin Selector -->
      <div class="w-full flex flex-col gap-2 pt-1 border-t border-white/10">
        <span class="text-xs font-headline font-black text-on-surface-variant">
          Pin to Spotlight Pedestal:
        </span>
        <div class="grid grid-cols-4 gap-2">
          ${[0, 1, 2, 3].map(slotIdx => {
            const isPinnedHere = featuredIds[slotIdx] === trophy.id;
            return `
              <button class="hq-pin-trophy-btn px-2 py-1.5 rounded-xl font-headline text-xs font-black border transition-all chunky-btn-sm ${isPinnedHere ? 'bg-amber-400 text-slate-950 border-amber-300 shadow' : 'bg-surface-bright text-on-surface border-white/10 hover:border-amber-400'}" data-slot="${slotIdx}" data-trophy-id="${trophy.id}">
                #${slotIdx + 1} ${isPinnedHere ? '★' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Close Button -->
      <button id="hq-close-trophy-modal-btn" class="w-full bg-surface-bright hover:bg-surface-container-highest text-on-surface font-headline text-sm font-black py-2.5 rounded-2xl border border-surface-container-highest mt-1 chunky-btn">
        Close Inspect
      </button>

    </div>
  </div>
  `;
}

export function attachHeroHQListeners() {
  // Initialize 3D Roaming Companion Pet in Hero HQ
  const hqPetController = initPet3DViewer('hq-roaming-pet-3d', {
    petId: store.getActivePet()?.id || 'rex',
    stage: store.getState().selectedHero?.petStageMap?.[store.getActivePet()?.id || 'rex'] || 1,
    mode: 'hq'
  });

  const container = document.querySelector('.hero-hq-container');
  if (!container) return;

  // Speak welcoming greeting once when entering HQ
  if (!hasSpokenHQGreeting) {
    hasSpokenHQGreeting = true;
    const state = store.getState();
    const hero = state.selectedHero || {};
    const heroHQ = state.heroHQ || {};
    const theme = getHQTheme(heroHQ.themeId);
    setTimeout(() => {
      speakRex(`Welcome to Hero HQ, ${hero.name || 'Hero'}! Your secret hideout is in ${theme.shortName} mode! Tap anywhere to explore!`);
    }, 600);
  }

  // 1. Back to Dashboard
  const backBtn = document.getElementById('hq-back-dashboard-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      Sound.whoosh();
      store.navigate('dashboard');
    });
  }

  // 2. Day / Night Toggle
  const nightToggleBtn = document.getElementById('hq-toggle-night-btn');
  if (nightToggleBtn) {
    nightToggleBtn.addEventListener('click', () => {
      Sound.lightSwitch();
      store.toggleHQNightMode();
    });
  }

  // 3. Open Redecorate Drawer
  const openRedecorateBtn = document.getElementById('hq-open-redecorate-btn');
  if (openRedecorateBtn) {
    openRedecorateBtn.addEventListener('click', () => {
      Sound.bloop();
      store.setHQRedecorateDrawer(true);
    });
  }

  // 4. Close Redecorate Drawer
  const closeRedecorateBtn = document.getElementById('hq-close-redecorate-btn');
  if (closeRedecorateBtn) {
    closeRedecorateBtn.addEventListener('click', () => {
      Sound.pop();
      activePreviewItem = null;
      store.setHQRedecorateDrawer(false);
    });
  }

  // 5. Category Tabs in Redecorate Drawer
  document.querySelectorAll('.hq-cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const cat = tab.getAttribute('data-category');
      Sound.bloop();
      store.setHQRedecorateDrawer(true, cat);
    });
  });

  // 6. Select Theme
  document.querySelectorAll('.hq-select-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const themeId = btn.getAttribute('data-theme-id');
      store.setHQTheme(themeId);
      Sound.sparkle();
      speakRex(`New hideout theme activated! Looks incredible, Little Hero!`);
    });
  });

  // 7. Equip Furniture Item
  document.querySelectorAll('.hq-equip-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = btn.getAttribute('data-slot');
      const itemId = btn.getAttribute('data-item-id');
      activePreviewItem = null;
      store.equipHQFurniture(slot, itemId);
      Sound.placeFurniture();
    });
  });

  // 8. Unlock Furniture Item (Token Purchase)
  document.querySelectorAll('.hq-unlock-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.getAttribute('data-item-id');
      const res = store.unlockHQFurniture(itemId, true);
      if (!res.success) {
        Sound.pop();
        speakRex(res.reason || 'Not enough Habit Tokens yet! Complete chores to earn more!');
      }
    });
  });

  // 9. Cancel Live Preview
  const cancelPreviewBtn = document.getElementById('hq-cancel-preview-btn');
  if (cancelPreviewBtn) {
    cancelPreviewBtn.addEventListener('click', () => {
      activePreviewItem = null;
      Sound.pop();
      store.notify();
    });
  }

  // 10. Interactive Furniture Slots
  const currentEquippedFurniture = store.getState().heroHQ?.equippedFurniture || {};

  // A. Bed Nap
  const bedSlot = document.getElementById('hq-slot-bed');
  if (bedSlot) {
    bedSlot.addEventListener('click', () => {
      if (isNapping) return;
      isNapping = true;
      Sound.snore();
      hqPetController?.triggerHeadScratch();
      const equippedBed = currentEquippedFurniture.bed;
      if (equippedBed && store.interactWithHQFurniture) {
        store.interactWithHQFurniture(equippedBed);
      } else {
        speakRex("Zzz... Power nap engaged! Dreaming of victory against Sugar Bugs! 🦖💤");
      }
      store.notify();
      if (napTimeout) clearTimeout(napTimeout);
      napTimeout = setTimeout(() => {
        isNapping = false;
        store.notify();
      }, 3500);
    });
  }

  // B. Trampoline / Pet Lounge Bounce
  const loungeSlot = document.getElementById('hq-slot-petLounge');
  if (loungeSlot) {
    loungeSlot.addEventListener('click', () => {
      if (isBouncing) return;
      isBouncing = true;
      Sound.boing();
      hqPetController?.triggerBellyTickle();
      const equippedLounge = currentEquippedFurniture.petLounge;
      if (equippedLounge && store.interactWithHQFurniture) {
        store.interactWithHQFurniture(equippedLounge);
      } else {
        speakRex("WHEEEE! Look at that high jump flip! Superhero bounce! 🤸✨");
      }
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch (e) {}
      store.notify();
      if (bounceTimeout) clearTimeout(bounceTimeout);
      bounceTimeout = setTimeout(() => {
        isBouncing = false;
        store.notify();
      }, 2500);
    });
  }

  // C. Mission Desk Hologram Activation
  const deskSlot = document.getElementById('hq-slot-desk');
  if (deskSlot) {
    deskSlot.addEventListener('click', () => {
      isHologramActive = !isHologramActive;
      Sound.hologram();
      const equippedDesk = currentEquippedFurniture.desk;
      if (equippedDesk && store.interactWithHQFurniture) {
        store.interactWithHQFurniture(equippedDesk);
      } else if (isHologramActive) {
        speakRex("Mission Hologram Online! Reviewing today's heroic routine status!");
      }
      store.notify();
    });
  }

  const closeHoloBtn = document.getElementById('hq-close-hologram-btn');
  if (closeHoloBtn) {
    closeHoloBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isHologramActive = false;
      Sound.pop();
      store.notify();
    });
  }

  // D. Decor / Nightlight Lamp Toggle
  const decorSlot = document.getElementById('hq-slot-decor');
  if (decorSlot) {
    decorSlot.addEventListener('click', () => {
      Sound.lightSwitch();
      store.toggleHQNightMode();
    });
  }

  // E. Rug Hop
  const rugSlot = document.getElementById('hq-slot-rug');
  if (rugSlot) {
    rugSlot.addEventListener('click', () => {
      Sound.rubberPop();
      speakRex("Hop hop! The play mat is ready for toy car races and hero training!");
    });
  }

  // 11. Free-Roaming Companion Pet Petting
  const roamingPet = document.getElementById('hq-roaming-pet');
  if (roamingPet) {
    roamingPet.addEventListener('click', () => {
      Sound.boing();
      Sound.sparkle();
      const hero = store.getState().selectedHero || {};
      speakRex(`Hehehe, hugs! You are my best friend and favorite superhero, ${hero.name || 'partner'}! ❤️`);
      try {
        confetti({
          particleCount: 30,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#ff6b6b', '#f06595', '#ffd43b']
        });
      } catch (e) {}
    });
  }

  // 12. Trophy Inspect Modal
  document.querySelectorAll('[data-inspect-trophy-id]').forEach(el => {
    el.addEventListener('click', () => {
      const trophyId = el.getAttribute('data-inspect-trophy-id');
      const trophies = getTrophiesForDisplay(store.getState());
      selectedTrophyForModal = trophies.find(t => t.id === trophyId) || null;
      Sound.sparkle();
      store.notify();
    });
  });

  const closeTrophyBtn = document.getElementById('hq-close-trophy-modal-btn');
  if (closeTrophyBtn) {
    closeTrophyBtn.addEventListener('click', () => {
      selectedTrophyForModal = null;
      Sound.pop();
      store.notify();
    });
  }

  // 13. Hear Rex Praise
  const speakTrophyBtn = document.getElementById('hq-speak-trophy-btn');
  if (speakTrophyBtn) {
    speakTrophyBtn.addEventListener('click', () => {
      const praise = speakTrophyBtn.getAttribute('data-praise');
      if (praise) {
        speakRex(praise);
      }
    });
  }

  // 14. Pin Trophy to Spotlight Pedestal
  document.querySelectorAll('.hq-pin-trophy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const slotIdx = parseInt(btn.getAttribute('data-slot'), 10);
      const trophyId = btn.getAttribute('data-trophy-id');
      store.setFeaturedTrophy(slotIdx, trophyId);
      Sound.fanfare();
      speakRex(`Pinned to Spotlight #${slotIdx + 1}! It looks majestic up there!`);
      selectedTrophyForModal = null;
    });
  });

  // 15. View All Trophies
  const viewAllTrophiesBtn = document.getElementById('hq-view-all-trophies-btn');
  if (viewAllTrophiesBtn) {
    viewAllTrophiesBtn.addEventListener('click', () => {
      const trophies = getTrophiesForDisplay(store.getState());
      if (trophies.length > 0) {
        selectedTrophyForModal = trophies[0];
        Sound.bloop();
        store.notify();
      }
    });
  }
}
