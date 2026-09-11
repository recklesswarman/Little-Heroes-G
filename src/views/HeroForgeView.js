/**
 * HeroForgeView.js
 * 
 * Hero Crafting Forge & 3D Tinkering Lab View
 * Generated based on Stitch Screen 30a5a7a651af417085fcdfee39dd870e
 * Adhering strictly to Tactile Toy & Adventurous Explorer Design System (zero pink/purple).
 */

import { store } from '../state/store.js';
import { FORGE_CATEGORIES, FORGE_BLUEPRINTS, getBlueprintById, getBlueprintsByCategory, isBlueprintUnlocked } from '../data/heroForgeData.js';
import { HeroForgeCanvas } from '../components/HeroForgeCanvas.js';
import { speakCompanion } from '../services/voiceService.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';

let activeCanvasInstance = null;

// Dye Color Palettes for the 3 Zones
export const DYE_PALETTES = {
  primary: [
    { id: 'emerald', label: 'Emerald Green', hex: '#2ecc71' },
    { id: 'slate', label: 'Dark Slate', hex: '#16212b' },
    { id: 'mint', label: 'Mint Tint', hex: '#4ae183' },
    { id: 'solar', label: 'Solar Orange', hex: '#e89300' },
    { id: 'gold', label: 'Cyber Gold', hex: '#f1c40f' }
  ],
  accent: [
    { id: 'orange', label: 'Solar Orange', hex: '#f39c12' },
    { id: 'bone', label: 'Solar Bone', hex: '#ffddb9' },
    { id: 'amber', label: 'Amber Core', hex: '#e89300' },
    { id: 'forest', label: 'Deep Forest', hex: '#1b7a43' },
    { id: 'ice', label: 'Ice Cyan', hex: '#00d2d3' }
  ],
  glow: [
    { id: 'cyan', label: 'Neon Cyan', hex: '#00d2d3' },
    { id: 'blue', label: 'Starlight Blue', hex: '#5fbaff' },
    { id: 'mint_glow', label: 'Electric Mint', hex: '#54e98a' },
    { id: 'supernova', label: 'Supernova Gold', hex: '#f1c40f' },
    { id: 'pure_white', label: 'Pure White', hex: '#ffffff' }
  ]
};

export function renderHeroForgeView() {
  const state = store.getState();
  const forge = store.getHeroForgeState();
  const hero = state.selectedHero || {};
  const activePet = store.getActivePet();

  const heroLevel = hero.level || 1;
  const heroStreak = hero.streak || 1;
  const heroCoins = hero.coins || 0;

  const currentCategory = forge.selectedCategory || 'wings';
  const currentBp = getBlueprintById(forge.selectedBlueprintId);
  const isUnlocked = isBlueprintUnlocked(currentBp, heroLevel, heroStreak);
  const canAfford = heroCoins >= (currentBp?.costTokens || 0);

  const blueprints = getBlueprintsByCategory(currentCategory);
  const dyes = forge.customDyes || currentBp.defaultDyes || { primary: '#2ecc71', accent: '#f39c12', glow: '#00d2d3' };
  const mode = forge.forgeMode || 'forge';

  const modalItem = forge.activeForgedModal;

  // Check if current item was crafted already
  const alreadyCrafted = (forge.craftedHistory || []).some(h => h.blueprintId === currentBp.id);

  return `
    <div class="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 flex flex-col gap-5 font-headline text-slate-100 pb-28">
      
      <!-- ===================================================================
           TOP APP BAR / HEADER (STITCH TACTILE TOY STYLE)
           =================================================================== -->
      <header class="w-full bg-[#16212b] border-4 border-[#2b3640] rounded-3xl p-3 sm:p-4 shadow-[0_6px_0_0_#050f18] flex flex-wrap items-center justify-between gap-3">
        <!-- Back Button & Brand Headline -->
        <div class="flex items-center gap-3">
          <button id="forge-back-btn" class="flex items-center gap-1.5 bg-[#121d26] hover:bg-[#202b35] px-3.5 py-2 rounded-2xl border-2 border-[#2b3640] text-slate-200 shadow-[0_3px_0_0_#050f18] active:translate-y-1 active:shadow-none transition-all" type="button">
            <span class="material-symbols-outlined text-primary text-xl">arrow_back</span>
            <span class="font-headline font-black text-xs uppercase tracking-wider hidden sm:inline">Back to HQ</span>
          </button>
          
          <div class="flex items-center gap-2">
            <div class="w-9 h-9 rounded-xl bg-primary/20 border-2 border-primary flex items-center justify-center text-primary shadow-[0_2px_0_0_#005027]">
              <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 1;">build</span>
            </div>
            <div>
              <h1 class="font-headline font-black text-base sm:text-xl text-primary tracking-tight uppercase leading-none">
                HERO FORGE &amp; 3D TINKERING LAB
              </h1>
              <p class="text-[10px] sm:text-xs font-bold text-slate-400">Craft legendary 3D gear to supercharge your hero & pets</p>
            </div>
          </div>
        </div>

        <!-- Forge Level & Scrap Pill Counters -->
        <div class="flex items-center gap-2">
          <!-- Hero Level Badge -->
          <div class="flex items-center gap-1.5 bg-[#121d26] px-3 py-1.5 rounded-2xl border-2 border-secondary shadow-[0_3px_0_0_#563400]">
            <span class="material-symbols-outlined text-secondary text-base" style="font-variation-settings: 'FILL' 1;">military_tech</span>
            <span class="font-headline font-black text-xs text-secondary tracking-wide">LVL ${heroLevel} HERO</span>
          </div>

          <!-- Scrap Tokens Balance Pill -->
          <div class="flex items-center gap-1.5 bg-[#121d26] px-3 py-1.5 rounded-2xl border-2 border-primary shadow-[0_3px_0_0_#005027]">
            <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1;">toll</span>
            <span class="font-headline font-black text-xs text-primary font-bold tracking-wide">${heroCoins} Scrap</span>
          </div>
        </div>
      </header>

      <!-- ===================================================================
           MAIN BENTO SECTION: 3D VIEWPORT (COL 8) & CONTROLS DOCK (COL 4)
           =================================================================== -->
      <section class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        <!-- 3D HERO FORGE VIEWPORT CONTAINER (Col 8) -->
        <div class="lg:col-span-8 bg-[#121d26] rounded-3xl border-4 border-[#2b3640] p-4 relative overflow-hidden shadow-[0_8px_0_0_#050f18] flex flex-col gap-3">
          
          <!-- Viewport HUD: Top Overlays -->
          <div class="relative z-20 flex flex-wrap justify-between items-center gap-2 pointer-events-none">
            <!-- Top-Left Item Name & Rare Tier Badge -->
            <div class="flex items-center gap-2 pointer-events-auto">
              <div class="bg-[#16212b]/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border-2 border-[#5fbaff] shadow-[0_3px_0_0_#004970] flex items-center gap-2">
                <span class="material-symbols-outlined text-[#5fbaff] text-lg" style="font-variation-settings: 'FILL' 1;">${currentBp.icon}</span>
                <span class="font-headline font-black text-sm sm:text-base text-white tracking-wide uppercase">${currentBp.title}</span>
              </div>
              <div class="bg-secondary/20 px-2.5 py-1 rounded-xl border border-secondary shadow-[0_2px_0_0_#563400] flex items-center gap-1">
                <span class="material-symbols-outlined text-secondary text-xs" style="font-variation-settings: 'FILL' 1;">star</span>
                <span class="font-headline font-black text-[10px] text-secondary uppercase tracking-wider">
                  ${currentBp.requiredLevel >= 7 ? 'LEGENDARY' : currentBp.requiredLevel >= 4 ? 'EPIC' : 'RARE TIER'}
                </span>
              </div>
            </div>

            <!-- Top-Right Mode Toggle: Forge Anvil vs 3D Testing Range -->
            <button id="forge-mode-toggle-btn" class="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border-2 transition-all active:translate-y-1 shadow-[0_3px_0_0_#004970] ${
              mode === 'testing' 
                ? 'bg-secondary text-[#050f18] border-secondary-fixed shadow-[0_3px_0_0_#563400]' 
                : 'bg-[#5fbaff] hover:bg-[#92ccff] text-[#001d31] border-[#cce5ff]'
            }" type="button">
              <span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1;">
                ${mode === 'testing' ? 'cyclone' : 'air'}
              </span>
              <div class="text-left leading-tight">
                <div class="font-headline font-black text-xs">${mode === 'testing' ? 'Testing Active' : '3D Test Range'}</div>
                <div class="text-[9px] font-bold uppercase opacity-90">${
                  currentBp.category === 'wings' ? 'WIND SPEED: 140 KM/H' :
                  currentBp.category === 'boots' ? 'GRAV LAUNCH: 9000 N' :
                  currentBp.category === 'shields' ? 'DEFLECT: 100% SPLAT' : 'OPTIC SCAN: ACTIVE'
                }</div>
              </div>
            </button>
          </div>

          <!-- EMBEDDED THREE.JS 3D CANVAS VIEWPORT -->
          <div class="w-full relative min-h-[380px] h-[380px] rounded-2xl bg-gradient-to-b from-[#0e1c28] via-[#09141e] to-[#050f18] border-2 border-[#202b35] overflow-hidden flex items-center justify-center">
            <div id="hero-forge-threejs-container" class="w-full h-full relative z-10 cursor-grab active:cursor-grabbing"></div>

            <!-- Visual Underlay Target Rings & Energy Coils -->
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15">
              <div class="w-72 h-72 border-4 border-dashed border-primary rounded-full animate-spin" style="animation-duration: 35s;"></div>
              <div class="w-52 h-52 border-2 border-[#5fbaff] rounded-full absolute"></div>
              <div class="w-36 h-36 border-4 border-secondary rounded-full absolute"></div>
            </div>

            <!-- Testing Range HUD Overlay (when testing mode active) -->
            ${mode === 'testing' ? `
              <div class="absolute top-4 left-4 z-20 bg-[#09141e]/90 border-2 border-secondary px-3 py-1.5 rounded-2xl backdrop-blur-md flex items-center gap-2 animate-pulse">
                <span class="material-symbols-outlined text-secondary text-sm">speed</span>
                <span class="text-xs font-headline font-black text-secondary uppercase tracking-wide">
                  ${currentBp.category === 'wings' ? 'Dynamic Aero Wind Tunnel: 140 km/h' :
                    currentBp.category === 'boots' ? 'Launchpad Shock Test: Nominal' :
                    currentBp.category === 'shields' ? 'Bubble Shield Matrix: 100% Charged' : 'Optic Sight Calibration: Locked'}
                </span>
              </div>
            ` : ''}
          </div>

          <!-- Viewport HUD: Bottom Overlays -->
          <div class="relative z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <!-- Bottom-Left Turntable Hint -->
            <div class="pointer-events-auto flex items-center gap-1.5 bg-[#16212b]/90 px-3 py-1.5 rounded-2xl border-2 border-[#2b3640] text-slate-300 shadow-[0_3px_0_0_#050f18]">
              <span class="material-symbols-outlined text-secondary text-base">sync</span>
              <span class="font-headline font-black text-xs text-slate-200">Drag to Spin 360°</span>
              <span class="material-symbols-outlined text-secondary text-base">rotate_right</span>
            </div>

            <!-- Bottom-Right Stat Boost Pill -->
            <div class="pointer-events-auto flex items-center gap-2 bg-[#16212b]/95 px-3 py-1.5 rounded-2xl border-2 border-primary shadow-[0_3px_0_0_#005027]">
              <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1;">
                ${currentBp.buffType === 'coin_boost' ? 'savings' :
                  currentBp.buffType === 'expedition_speed' ? 'speed' :
                  currentBp.buffType === 'expedition_fuel' ? 'local_gas_station' : 'shield'}
              </span>
              <span class="font-headline font-black text-xs text-primary tracking-wide">${currentBp.buffDesc}</span>
            </div>
          </div>

        </div>

        <!-- TACTILE CONTROLS & DYE RACK DOCK (Col 4) -->
        <div class="lg:col-span-4 flex flex-col gap-4">
          
          <!-- Master Anvil Card -->
          <div class="bg-[#16212b] rounded-3xl border-4 border-[#2b3640] p-4 shadow-[0_6px_0_0_#050f18] flex flex-col gap-3">
            <div class="flex items-center justify-between border-b-2 border-[#202b35] pb-2">
              <h2 class="font-headline font-black text-sm text-slate-100 uppercase flex items-center gap-1.5">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">hardware</span>
                Master Anvil
              </h2>
              <span class="bg-[#121d26] text-primary font-black text-xs px-2.5 py-1 rounded-xl border border-primary/40">
                Cost: ${currentBp.costTokens} 🪙
              </span>
            </div>

            <p class="text-xs font-bold text-slate-300 leading-snug">
              ${currentBp.desc}
            </p>

            <!-- Big Chunky Anvil Strike Button -->
            ${isUnlocked ? `
              <button id="forge-strike-btn" ${!canAfford ? 'disabled' : ''} class="w-full py-3.5 px-4 rounded-2xl font-headline font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 transition-all border-2 ${
                canAfford 
                  ? 'bg-primary-container hover:bg-[#4ae183] text-[#003919] border-primary shadow-[0_6px_0_0_#005027] active:translate-y-1 active:shadow-none' 
                  : 'bg-[#202b35] text-slate-500 border-slate-600 cursor-not-allowed opacity-60'
              }" type="button">
                <span class="material-symbols-outlined text-2xl" style="font-variation-settings: 'FILL' 1;">drive_file_stream</span>
                <span>${alreadyCrafted ? 'CRAFT AGAIN! 🔨' : 'TAP TO FORGE! 🔨'}</span>
              </button>
            ` : `
              <div class="w-full py-3 px-3 rounded-2xl bg-[#121d26] border-2 border-[#2b3640] text-center flex flex-col items-center gap-1">
                <span class="material-symbols-outlined text-secondary text-xl">lock</span>
                <span class="font-headline font-black text-xs text-secondary uppercase">
                  Locked • Requires Level ${currentBp.requiredLevel} ${currentBp.requiredStreak ? `& ${currentBp.requiredStreak} Streak` : ''}
                </span>
              </div>
            `}

            <div class="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-bold">
              <span class="material-symbols-outlined text-sm text-secondary">verified</span>
              <span>100% Success • Auto-Equips to ${activePet?.name || 'Pet'}</span>
            </div>
          </div>

          <!-- 3-Zone Color Dye Rack Card -->
          <div class="bg-[#16212b] rounded-3xl border-4 border-[#2b3640] p-4 shadow-[0_6px_0_0_#050f18] flex flex-col gap-3">
            <div class="flex items-center justify-between border-b-2 border-[#202b35] pb-2">
              <h2 class="font-headline font-black text-sm text-slate-100 uppercase flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[#5fbaff]" style="font-variation-settings: 'FILL' 1;">palette</span>
                3-Zone Dye Rack
              </h2>
              <span class="text-[10px] font-black text-secondary uppercase bg-[#121d26] px-2 py-0.5 rounded-lg border border-[#202b35]">
                Custom Rigs
              </span>
            </div>

            <!-- Zone 1: Primary Shell -->
            <div class="bg-[#121d26] p-2.5 rounded-2xl border-2 border-[#202b35] flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-xl border-2 border-white shadow-[0_2px_0_0_#000] flex items-center justify-center" style="background-color: ${dyes.primary};">
                  <span class="material-symbols-outlined text-white text-xs">check</span>
                </div>
                <div>
                  <div class="font-headline font-black text-xs text-white">Zone 1: Primary</div>
                  <div class="text-[10px] font-bold text-primary">Main Armor Plate</div>
                </div>
              </div>

              <!-- Swatches -->
              <div class="flex items-center gap-1.5">
                ${DYE_PALETTES.primary.map(color => `
                  <button data-dye-zone="primary" data-dye-hex="${color.hex}" class="w-6 h-6 rounded-full border-2 transition-all ${dyes.primary === color.hex ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'border-slate-600 hover:scale-105'}" style="background-color: ${color.hex};" title="${color.label}"></button>
                `).join('')}
              </div>
            </div>

            <!-- Zone 2: Accent Trim -->
            <div class="bg-[#121d26] p-2.5 rounded-2xl border-2 border-[#202b35] flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-xl border-2 border-white shadow-[0_2px_0_0_#000] flex items-center justify-center" style="background-color: ${dyes.accent};">
                  <span class="material-symbols-outlined text-white text-xs">check</span>
                </div>
                <div>
                  <div class="font-headline font-black text-xs text-white">Zone 2: Trim</div>
                  <div class="text-[10px] font-bold text-secondary">Aero Fins & Rings</div>
                </div>
              </div>

              <!-- Swatches -->
              <div class="flex items-center gap-1.5">
                ${DYE_PALETTES.accent.map(color => `
                  <button data-dye-zone="accent" data-dye-hex="${color.hex}" class="w-6 h-6 rounded-full border-2 transition-all ${dyes.accent === color.hex ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'border-slate-600 hover:scale-105'}" style="background-color: ${color.hex};" title="${color.label}"></button>
                `).join('')}
              </div>
            </div>

            <!-- Zone 3: Glow Core -->
            <div class="bg-[#121d26] p-2.5 rounded-2xl border-2 border-[#202b35] flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-xl border-2 border-white shadow-[0_2px_0_0_#000] flex items-center justify-center" style="background-color: ${dyes.glow};">
                  <span class="material-symbols-outlined text-white text-xs">check</span>
                </div>
                <div>
                  <div class="font-headline font-black text-xs text-white">Zone 3: Glow Core</div>
                  <div class="text-[10px] font-bold text-[#5fbaff]">Thrusters & Beams</div>
                </div>
              </div>

              <!-- Swatches -->
              <div class="flex items-center gap-1.5">
                ${DYE_PALETTES.glow.map(color => `
                  <button data-dye-zone="glow" data-dye-hex="${color.hex}" class="w-6 h-6 rounded-full border-2 transition-all ${dyes.glow === color.hex ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'border-slate-600 hover:scale-105'}" style="background-color: ${color.hex};" title="${color.label}"></button>
                `).join('')}
              </div>
            </div>

          </div>

        </div>

      </section>

      <!-- ===================================================================
           BLUEPRINT VAULT SECTION (TABS & SCHEMATICS GRID)
           =================================================================== -->
      <section class="bg-[#16212b] rounded-3xl border-4 border-[#2b3640] p-4 sm:p-5 shadow-[0_8px_0_0_#050f18] flex flex-col gap-4">
        
        <!-- Vault Header & Category Tabs -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b-2 border-[#202b35] pb-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-[#5fbaff] flex items-center justify-center text-[#001d31] border-2 border-[#cce5ff] shadow-[0_3px_0_0_#004970]">
              <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 1;">layers</span>
            </div>
            <div>
              <h2 class="font-headline font-black text-sm sm:text-base text-white uppercase leading-none">BLUEPRINT VAULT</h2>
              <p class="text-xs font-bold text-slate-400">Unlock high-tier schematics as you complete quests & maintain streaks</p>
            </div>
          </div>

          <!-- 4 Chunky Category Navigation Tabs -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
            ${FORGE_CATEGORIES.map(cat => {
              const isActive = cat.id === currentCategory;
              return `
                <button data-forge-category="${cat.id}" class="px-3.5 py-1.5 rounded-2xl font-headline font-black text-xs uppercase tracking-wider flex items-center gap-1.5 border-2 transition-all active:translate-y-0.5 ${
                  isActive
                    ? 'bg-[#5fbaff] text-[#001d31] border-[#cce5ff] shadow-[0_3px_0_0_#004970] -translate-y-0.5'
                    : 'bg-[#121d26] text-slate-300 border-[#2b3640] hover:bg-[#202b35] shadow-[0_3px_0_0_#050f18]'
                }">
                  <span class="material-symbols-outlined text-sm" ${isActive ? "style=\"font-variation-settings: 'FILL' 1;\"" : ""}>${cat.icon}</span>
                  <span>${cat.label}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Blueprint Cards Grid (3-4 Items per category) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${blueprints.map(bp => {
            const isCardActive = bp.id === currentBp.id;
            const isCardUnlocked = isBlueprintUnlocked(bp, heroLevel, heroStreak);
            const isCardCrafted = (forge.craftedHistory || []).some(h => h.blueprintId === bp.id);

            return `
              <div data-select-blueprint="${bp.id}" class="rounded-3xl border-3 p-4 flex flex-col justify-between gap-3 cursor-pointer transition-all ${
                isCardActive
                  ? 'bg-[#1a2b3c] border-[#5fbaff] shadow-[0_0_20px_rgba(95,186,255,0.35),0_6px_0_0_#004970] -translate-y-1'
                  : isCardUnlocked
                  ? 'bg-[#121d26] border-[#2b3640] hover:border-primary shadow-[0_4px_0_0_#050f18]'
                  : 'bg-[#0b141c]/80 border-[#1a252f] opacity-60'
              }">
                
                <div class="flex flex-col gap-2">
                  <div class="flex justify-between items-start">
                    <div class="w-10 h-10 rounded-2xl flex items-center justify-center border-2 ${
                      isCardActive 
                        ? 'bg-[#5fbaff] text-[#001d31] border-[#cce5ff]' 
                        : isCardUnlocked 
                        ? 'bg-[#16212b] text-primary border-primary/40' 
                        : 'bg-[#121d26] text-slate-500 border-slate-700'
                    }">
                      <span class="material-symbols-outlined text-xl" ${isCardActive ? "style=\"font-variation-settings: 'FILL' 1;\"" : ""}>${bp.icon}</span>
                    </div>

                    ${isCardCrafted ? `
                      <span class="bg-primary/20 text-primary border border-primary px-2 py-0.5 rounded-xl font-headline font-black text-[10px] flex items-center gap-1">
                        <span class="material-symbols-outlined text-xs">check_circle</span>
                        <span>Crafted</span>
                      </span>
                    ` : !isCardUnlocked ? `
                      <span class="bg-secondary/20 text-secondary border border-secondary/40 px-2 py-0.5 rounded-xl font-headline font-black text-[10px] flex items-center gap-1">
                        <span class="material-symbols-outlined text-xs">lock</span>
                        <span>Lvl ${bp.requiredLevel}</span>
                      </span>
                    ` : `
                      <span class="bg-[#16212b] text-slate-300 border border-[#2b3640] px-2 py-0.5 rounded-xl font-headline font-black text-[10px]">
                        ${bp.costTokens} 🪙
                      </span>
                    `}
                  </div>

                  <div>
                    <h3 class="font-headline font-black text-sm text-white">${bp.title}</h3>
                    <p class="text-[11px] font-bold text-slate-400 line-clamp-2 mt-0.5">${bp.desc}</p>
                  </div>
                </div>

                <!-- Card Bottom Pill -->
                <div class="w-full py-1.5 px-3 rounded-xl font-headline font-black text-xs text-center flex items-center justify-center gap-1.5 border ${
                  isCardActive
                    ? 'bg-primary text-[#003919] border-primary-fixed shadow-[0_2px_0_0_#005027]'
                    : isCardUnlocked
                    ? 'bg-[#16212b] text-slate-300 border-[#2b3640] hover:text-white'
                    : 'bg-[#0f1820] text-slate-500 border-slate-700 cursor-not-allowed'
                }">
                  ${isCardActive ? 'Selected in Forge' : isCardUnlocked ? 'Tap to Inspect' : `Requires LVL ${bp.requiredLevel}`}
                </div>

              </div>
            `;
          }).join('')}
        </div>

      </section>

      <!-- ===================================================================
           CELEBRATION SYNTHESIS MODAL (POPUP ON FORGE SUCCESS)
           =================================================================== -->
      ${modalItem ? `
        <div id="forge-celebration-modal-backdrop" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div class="w-full max-w-md bg-[#16212b] rounded-3xl border-4 border-primary p-5 sm:p-6 shadow-[0_16px_35px_rgba(0,0,0,0.8),0_0_30px_rgba(84,233,138,0.35)] relative flex flex-col items-center text-center gap-3">
            
            <!-- Close Button -->
            <button id="close-forged-modal-btn" aria-label="Close celebration modal" class="absolute top-3 right-3 w-8 h-8 rounded-xl bg-[#121d26] hover:bg-[#202b35] border-2 border-[#2b3640] text-slate-300 flex items-center justify-center active:translate-y-0.5" type="button">
              <span class="material-symbols-outlined text-lg">close</span>
            </button>

            <!-- Starburst Badge -->
            <div class="w-16 h-16 rounded-2xl bg-primary-container border-4 border-white shadow-[0_6px_0_0_#005027] flex items-center justify-center text-[#003919] -mt-10">
              <span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' 1;">celebration</span>
            </div>

            <div class="flex flex-col gap-1">
              <span class="bg-secondary px-2.5 py-0.5 rounded-full text-[#2b1700] font-headline font-black text-[11px] uppercase tracking-widest self-center border border-secondary-container">
                SUCCESSFUL SYNTHESIS
              </span>
              <h2 class="font-headline font-black text-xl text-primary tracking-tight">ITEM FORGED! 🎉</h2>
              <div class="font-headline font-black text-base text-white">${modalItem.title}</div>
              <p class="text-xs font-bold text-slate-300 leading-snug">
                Auto-equipped to <span class="text-secondary font-black">${activePet?.name || 'Pet'}</span> with <span class="text-primary font-black">${modalItem.buffDesc}</span>!
              </p>
            </div>

            <!-- Stats Pill Confirmation -->
            <div class="w-full bg-[#121d26] p-3 rounded-2xl border-2 border-[#2b3640] flex items-center justify-around">
              <div class="flex flex-col items-center">
                <span class="text-[10px] text-slate-400 uppercase font-black">Buff Power</span>
                <span class="text-primary font-headline font-black text-base">+${modalItem.buffValue}%</span>
              </div>
              <div class="h-7 w-0.5 bg-[#2b3640]"></div>
              <div class="flex flex-col items-center">
                <span class="text-[10px] text-slate-400 uppercase font-black">Gear Slot</span>
                <span class="text-[#5fbaff] font-headline font-black text-base uppercase">${modalItem.slot}</span>
              </div>
            </div>

            <!-- Chunky Equip/Done Button -->
            <button id="equip-forged-done-btn" class="w-full py-3 bg-primary-container hover:bg-[#4ae183] text-[#003919] font-headline font-black text-sm uppercase tracking-wider rounded-2xl border-2 border-primary shadow-[0_5px_0_0_#005027] flex items-center justify-center gap-2 active:translate-y-1 active:shadow-none" type="button">
              <span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1;">check_circle</span>
              <span>EQUIPPED &amp; READY!</span>
            </button>
          </div>
        </div>
      ` : ''}

    </div>
  `;
}

export function attachHeroForgeListeners() {
  // 1. Back button
  const backBtn = document.getElementById('forge-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate('hero_hq');
    });
  }

  // 2. Mount 3D Canvas
  const canvasContainer = document.getElementById('hero-forge-threejs-container');
  if (canvasContainer) {
    const forge = store.getHeroForgeState();
    const currentBp = getBlueprintById(forge.selectedBlueprintId);
    
    // Destroy previous canvas instance if exists
    if (activeCanvasInstance) {
      activeCanvasInstance.destroy();
      activeCanvasInstance = null;
    }

    activeCanvasInstance = new HeroForgeCanvas(canvasContainer, {
      meshType: currentBp?.meshType || 'jetpack',
      category: currentBp?.category || 'wings',
      dyes: forge.customDyes || currentBp?.defaultDyes,
      testingMode: forge.forgeMode === 'testing'
    });
  }

  // 3. Category Tabs
  document.querySelectorAll('[data-forge-category]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cat = e.currentTarget.getAttribute('data-forge-category');
      Sound.click();
      store.selectForgeCategory(cat);
    });
  });

  // 4. Select Blueprint Cards
  document.querySelectorAll('[data-select-blueprint]').forEach(card => {
    card.addEventListener('click', (e) => {
      const bpId = e.currentTarget.getAttribute('data-select-blueprint');
      Sound.click();
      store.selectForgeBlueprint(bpId);
    });
  });

  // 5. Dye Swatches
  document.querySelectorAll('[data-dye-zone]').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      const zone = e.currentTarget.getAttribute('data-dye-zone');
      const hex = e.currentTarget.getAttribute('data-dye-hex');
      Sound.click();
      store.setForgeDye(zone, hex);

      // Live update canvas if active
      if (activeCanvasInstance) {
        if (zone === 'primary') activeCanvasInstance.setShellColor(hex);
        else if (zone === 'accent') activeCanvasInstance.setTrimColor(hex);
        else if (zone === 'glow') activeCanvasInstance.setCoreColor(hex);
      }
    });
  });

  // 6. Mode Toggle (Forge Anvil vs 3D Testing Range)
  const modeBtn = document.getElementById('forge-mode-toggle-btn');
  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      Sound.click();
      const forge = store.getHeroForgeState();
      const newMode = forge.forgeMode === 'testing' ? 'forge' : 'testing';
      store.setForgeMode(newMode);

      if (activeCanvasInstance) {
        activeCanvasInstance.setTestingMode(newMode === 'testing');
      }

      if (newMode === 'testing') {
        speakCompanion("Engaging 3D Testing Range! Aerodynamics and force sensors online!");
      }
    });
  }

  // 7. Forge Strike Action
  const strikeBtn = document.getElementById('forge-strike-btn');
  if (strikeBtn) {
    strikeBtn.addEventListener('click', () => {
      const forge = store.getHeroForgeState();
      const bp = getBlueprintById(forge.selectedBlueprintId);
      
      // Trigger canvas strike animation
      if (activeCanvasInstance) {
        activeCanvasInstance.triggerForgeStrike();
      }

      const result = store.forgeItem(bp.id);
      if (result.success) {
        speakCompanion(`Forged ${result.item.title}! Added to ${store.getActivePet()?.name || 'your pet'}!`);
        store.openForgedCelebrationModal(result.item);
      } else {
        Sound.error?.();
        alert(result.message);
      }
    });
  }

  // 8. Celebration Modal Handlers
  const closeModalBtn = document.getElementById('close-forged-modal-btn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      Sound.click();
      store.closeForgedCelebrationModal();
    });
  }

  const equipDoneBtn = document.getElementById('equip-forged-done-btn');
  if (equipDoneBtn) {
    equipDoneBtn.addEventListener('click', () => {
      Sound.click();
      store.closeForgedCelebrationModal();
    });
  }
}
