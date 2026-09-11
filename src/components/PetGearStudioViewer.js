// PetGearStudioViewer: Interactive Skeletal Companion Gear & Dress-Up Studio
// Provides full-body procedural bone animation, gear socket attachments,
// verlet spring cloth cape wind machine, vibrant superhero color dye palette mixing,
// and quick heroic pose preview with direct launch to the Heroic Runway Showcase.

import { PetSkeletalBodyCanvas, RUNWAY_POSES } from '../services/petSkeletalBodyService.js';
import { GEAR_SOCKETS, COLOR_DYES, PET_GEAR_CATALOG, getGearItem, getAllGearForSocket } from '../data/petGearStudioData.js';
import { getPetFaceProfile } from '../services/petSkeletalFaceService.js';
import { Sound } from '../audio/sfx.js';
import { store } from '../state/store.js';

// Cache active gear studio instances
const activeStudioInstances = new Map();

/**
 * Returns an active gear studio instance by canvas ID.
 */
export function getActivePetGearStudioInstance(canvasId) {
  return activeStudioInstances.get(canvasId) || null;
}

/**
 * Clean up all active gear studio instances.
 */
export function cleanupPetGearStudioInstances() {
  for (const [id, record] of activeStudioInstances.entries()) {
    try {
      if (record.canvasInstance) record.canvasInstance.destroy();
    } catch (e) {
      console.warn(`Error destroying gear studio instance ${id}:`, e);
    }
  }
  activeStudioInstances.clear();
}

/**
 * Render the Pet Gear Studio Viewer HTML
 */
export function renderPetGearStudioViewer({
  containerId = 'pet-gear-studio-container',
  canvasId = 'pet-gear-studio-canvas',
  petId = 1,
  activeSocket = 'back',
  className = ''
} = {}) {
  const companion = store.getPetWithProgress ? store.getPetWithProgress(petId) : (store.getActivePet() || { name: 'Rex', id: 1 });
  const equipped = store.getEquippedPetStudioGear ? store.getEquippedPetStudioGear(petId) : {};
  const dyes = store.getCustomGearDyes ? store.getCustomGearDyes(petId) : {};
  const petProfile = getPetFaceProfile(petId);

  const socketTabs = [
    { key: GEAR_SOCKETS.HEAD, label: 'Headgear', icon: 'crown', emoji: '👑' },
    { key: GEAR_SOCKETS.BACK, label: 'Cape & Back', icon: 'shield', emoji: '🦸' },
    { key: GEAR_SOCKETS.CHEST, label: 'Armor Plate', icon: 'security', emoji: '🛡️' },
    { key: GEAR_SOCKETS.FEET, label: 'Hero Boots', icon: 'sprint', emoji: '⚡' }
  ];

  const currentGearList = getAllGearForSocket(activeSocket);

  return `
  <div id="${containerId}" class="pet-gear-studio-wrapper relative bg-gradient-to-b from-slate-900/95 via-indigo-950/90 to-slate-900/95 border-2 border-amber-400/40 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl text-white select-none ${className}" data-pet-id="${petId}" data-active-socket="${activeSocket}">
    
    <!-- Top Header Bar -->
    <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-amber-400/20">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg border-2 border-white/20">
          ${petProfile.emoji || '🦖'}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl sm:text-2xl font-black text-amber-300 tracking-wide font-display">${companion.name || 'Hero Companion'}</h2>
            <span class="px-2 py-0.5 text-xs font-bold bg-amber-400/20 text-amber-300 rounded-full border border-amber-400/30">Gear Studio</span>
          </div>
          <p class="text-xs text-slate-300">Equip heroic armor, customize superhero dyes & test catwalk poses!</p>
        </div>
      </div>

      <!-- Studio Quick Controls: Wind & Reset -->
      <div class="flex items-center gap-2">
        <button id="gear-studio-wind-btn" class="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-cyan-400/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow" title="Toggle Cape Wind Breeze">
          <span class="material-symbols-outlined text-sm">air</span>
          <span id="gear-wind-label">Wind: Turbo</span>
        </button>
        <button id="gear-studio-reset-btn" class="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-600 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow" title="Reset Colors to Default">
          <span class="material-symbols-outlined text-sm">palette</span>
          <span>Reset Dyes</span>
        </button>
      </div>
    </div>

    <!-- Main Studio Grid Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5 items-start">
      
      <!-- Left Column: Skeletal Body Canvas & Pose Bar (5 cols) -->
      <div class="lg:col-span-5 flex flex-col items-center">
        
        <!-- Canvas Stage with Theatrical Lighting -->
        <div class="relative w-full max-w-[340px] aspect-square rounded-3xl overflow-hidden bg-radial from-indigo-900/60 via-slate-900/90 to-black border-2 border-amber-400/30 shadow-2xl flex items-center justify-center group">
          <!-- Spotlight Glow Ring -->
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.18)_0%,rgba(99,102,241,0.08)_50%,transparent_75%)] pointer-events-none"></div>
          
          <canvas 
            id="${canvasId}" 
            width="340" 
            height="340" 
            class="relative z-10 w-full h-full object-contain cursor-grab active:cursor-grabbing touch-none"
            aria-label="${companion.name} Full-Body Skeletal Companion"
          ></canvas>

          <!-- Stage Floor Reflection line -->
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 w-48 h-3 rounded-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent blur-xs pointer-events-none"></div>
        </div>

        <!-- Heroic Pose Buttons Bar -->
        <div class="w-full max-w-[340px] mt-4">
          <p class="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-xs">star</span>
            <span>Test Heroic Poses</span>
          </p>
          <div class="grid grid-cols-3 gap-2">
            <button class="gear-pose-btn px-2 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-amber-300 transition-all flex items-center justify-center gap-1 active:scale-95" data-pose="${RUNWAY_POSES.HERO_LANDING}">
              <span>🦸</span><span>Landing</span>
            </button>
            <button class="gear-pose-btn px-2 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-amber-300 transition-all flex items-center justify-center gap-1 active:scale-95" data-pose="${RUNWAY_POSES.WING_FLARE}">
              <span>✨</span><span>Flare</span>
            </button>
            <button class="gear-pose-btn px-2 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-amber-300 transition-all flex items-center justify-center gap-1 active:scale-95" data-pose="${RUNWAY_POSES.SPIN_360}">
              <span>🔄</span><span>360 Spin</span>
            </button>
            <button class="gear-pose-btn px-2 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-amber-300 transition-all flex items-center justify-center gap-1 active:scale-95" data-pose="${RUNWAY_POSES.HERO_SALUTE}">
              <span>🫡</span><span>Salute</span>
            </button>
            <button class="gear-pose-btn px-2 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-amber-300 transition-all flex items-center justify-center gap-1 active:scale-95" data-pose="${RUNWAY_POSES.RUNWAY_WALK}">
              <span>🚶</span><span>Strut</span>
            </button>
            <button class="gear-pose-btn px-2 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-amber-300 transition-all flex items-center justify-center gap-1 active:scale-95" data-pose="${RUNWAY_POSES.IDLE}">
              <span>🧍</span><span>Idle</span>
            </button>
          </div>
        </div>

      </div>

      <!-- Right Column: Socket Tabs, Gear Inventory, and Color Dyes (7 cols) -->
      <div class="lg:col-span-7 flex flex-col gap-4">
        
        <!-- Gear Socket Category Tabs -->
        <div class="flex items-center gap-2 p-1.5 bg-slate-800/80 rounded-2xl border border-slate-700/60 overflow-x-auto">
          ${socketTabs.map(tab => {
            const isTabActive = tab.key === activeSocket;
            const equippedId = equipped[tab.key];
            const hasEquipped = !!equippedId;
            return `
            <button class="gear-socket-tab flex-1 min-w-[90px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              isTabActive 
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 shadow-md font-black scale-102' 
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }" data-socket="${tab.key}">
              <span>${tab.emoji}</span>
              <span>${tab.label}</span>
              ${hasEquipped ? `<span class="w-2 h-2 rounded-full ${isTabActive ? 'bg-slate-900' : 'bg-emerald-400'}"></span>` : ''}
            </button>
            `;
          }).join('')}
        </div>

        <!-- Color Dye Palette Swatches -->
        <div class="p-3 bg-slate-800/50 rounded-2xl border border-slate-700/40">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm">colors</span>
              <span>Superhero Dye Palette</span>
            </span>
            <span class="text-[11px] text-slate-400">Tint: <strong class="text-white capitalize">${activeSocket}</strong></span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${COLOR_DYES.map(dye => {
              const currentSocketDye = dyes[activeSocket];
              const isSelected = currentSocketDye === dye.hex;
              return `
              <button 
                class="gear-dye-btn w-8 h-8 rounded-full border-2 transition-transform hover:scale-115 active:scale-95 shadow flex items-center justify-center ${isSelected ? 'border-white ring-2 ring-amber-400 scale-110' : 'border-white/30'}"
                style="background-color: ${dye.hex};"
                data-hex="${dye.hex}"
                data-dye-id="${dye.id}"
                title="${dye.name}"
              >
                ${isSelected ? '<span class="text-white text-xs font-black drop-shadow">✓</span>' : ''}
              </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Gear Items Grid for Selected Socket -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-300 uppercase tracking-wider">Available ${activeSocket} Items</span>
            <span class="text-xs text-slate-400">${currentGearList.length} items</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
            ${currentGearList.map(item => {
              const isEquipped = equipped[activeSocket] === item.id;
              const isUnlocked = item.unlocked !== false;
              const itemColor = (isEquipped && dyes[activeSocket]) ? dyes[activeSocket] : item.defaultColor;

              return `
              <div class="gear-card-item relative p-3 rounded-2xl border-2 transition-all flex flex-col justify-between gap-2 ${
                isEquipped 
                  ? 'bg-amber-500/15 border-amber-400 shadow-lg shadow-amber-500/10' 
                  : isUnlocked 
                    ? 'bg-slate-800/70 border-slate-700/80 hover:border-slate-500' 
                    : 'bg-slate-900/60 border-slate-800/80 opacity-75'
              }" data-gear-id="${item.id}" data-socket="${activeSocket}">
                
                <div class="flex items-start gap-2.5">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow border border-white/20" style="background-color: ${itemColor};">
                    <span class="material-symbols-outlined text-white text-xl">${item.icon || 'shield'}</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-1">
                      <h4 class="text-xs font-black text-white truncate">${item.name}</h4>
                      ${isEquipped ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-400 text-slate-950 uppercase tracking-wider shrink-0">On</span>' : ''}
                    </div>
                    <p class="text-[11px] text-slate-300 leading-snug line-clamp-2 mt-0.5">${item.desc}</p>
                  </div>
                </div>

                <!-- Footer: Unlock Badge or Equip Action -->
                <div class="flex items-center justify-between pt-2 border-t border-white/10 mt-1">
                  ${isUnlocked ? `
                    <span class="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <span class="material-symbols-outlined text-xs">check_circle</span>
                      <span>Unlocked</span>
                    </span>
                    <button class="gear-equip-btn px-3 py-1 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      isEquipped 
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30' 
                        : 'bg-amber-500 text-slate-950 font-black hover:bg-amber-400 shadow'
                    }" data-gear-id="${item.id}" data-socket="${activeSocket}">
                      ${isEquipped ? 'Unequip' : 'Equip'}
                    </button>
                  ` : `
                    <span class="text-[10px] font-bold text-amber-400/90 flex items-center gap-1">
                      <span class="material-symbols-outlined text-xs">lock</span>
                      <span>${item.unlockReq || 'Locked'}</span>
                    </span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">Locked</span>
                  `}
                </div>

              </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Launch Heroic Runway Showcase Portal Button -->
        <div class="mt-2 pt-3 border-t border-slate-700/60">
          <button id="gear-studio-launch-runway-btn" class="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-slate-950 font-black text-sm tracking-wide shadow-xl hover:shadow-amber-400/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 border-2 border-white/30">
            <span class="text-xl">🌟</span>
            <span>Launch Heroic Runway Showcase & Photo Booth</span>
            <span class="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        </div>

      </div>

    </div>

  </div>
  `;
}

/**
 * Initialize PetGearStudioViewer on the container element
 */
export function initPetGearStudioViewer(containerId = 'pet-gear-studio-container', options = {}) {
  if (typeof document === 'undefined') return null;
  const container = document.getElementById(containerId);
  if (!container) return null;

  const canvasId = options.canvasId || 'pet-gear-studio-canvas';
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const petId = options.petId || container.getAttribute('data-pet-id') || 1;
  let activeSocket = container.getAttribute('data-active-socket') || 'back';
  let windMode = 2; // 0: off, 1: breeze, 2: turbo

  // Cleanup prior instance
  if (activeStudioInstances.has(canvasId)) {
    try {
      activeStudioInstances.get(canvasId).canvasInstance.destroy();
    } catch (e) {}
    activeStudioInstances.delete(canvasId);
  }

  // Load current equipped gear and custom dyes from store
  const equipped = store.getEquippedPetStudioGear ? store.getEquippedPetStudioGear(petId) : {};
  const dyes = store.getCustomGearDyes ? store.getCustomGearDyes(petId) : {};

  let canvasInstance = null;
  try {
    canvasInstance = new PetSkeletalBodyCanvas(canvas, {
      petId,
      equippedGear: equipped,
      gearColors: dyes,
      pose: RUNWAY_POSES.IDLE
    });
    // Set initial turbo wind for lively cape flutter
    canvasInstance.setWind(2.2, -2.5);
  } catch (err) {
    console.warn('Failed to initialize PetSkeletalBodyCanvas:', err);
    return null;
  }

  const record = {
    canvasInstance,
    petId,
    activeSocket,
    container
  };
  activeStudioInstances.set(canvasId, record);

  // --- ATTACH EVENT LISTENERS ---

  // 1. Socket Tab Selection
  const socketTabs = container.querySelectorAll('.gear-socket-tab');
  socketTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const socket = tab.getAttribute('data-socket');
      if (!socket || socket === activeSocket) return;
      activeSocket = socket;
      container.setAttribute('data-active-socket', socket);
      Sound.bloop();
      
      // Re-render viewer keeping same pet
      container.outerHTML = renderPetGearStudioViewer({
        containerId,
        canvasId,
        petId,
        activeSocket
      });
      initPetGearStudioViewer(containerId, { ...options, petId });
    });
  });

  // 2. Color Dye Selection
  const dyeButtons = container.querySelectorAll('.gear-dye-btn');
  dyeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const hex = btn.getAttribute('data-hex');
      if (!hex) return;
      
      // Update store and live canvas
      store.setCustomGearDye(petId, activeSocket, hex);
      if (canvasInstance) {
        canvasInstance.setGearColor(activeSocket, hex);
      }

      // Update UI active indicator
      dyeButtons.forEach(b => {
        b.classList.remove('border-white', 'ring-2', 'ring-amber-400', 'scale-110');
        b.classList.add('border-white/30');
        b.innerHTML = '';
      });
      btn.classList.remove('border-white/30');
      btn.classList.add('border-white', 'ring-2', 'ring-amber-400', 'scale-110');
      btn.innerHTML = '<span class="text-white text-xs font-black drop-shadow">✓</span>';
    });
  });

  // 3. Equip / Unequip Gear Item Buttons
  const equipButtons = container.querySelectorAll('.gear-equip-btn');
  equipButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const gearId = btn.getAttribute('data-gear-id');
      const socket = btn.getAttribute('data-socket');
      if (!gearId || !socket) return;

      const newEquipped = store.equipPetStudioGear ? store.equipPetStudioGear(petId, socket, gearId) : store.equipPetGear(petId, socket, gearId);
      if (canvasInstance) {
        canvasInstance.setGear(socket, newEquipped[socket]);
      }

      // Re-render UI to update card states
      container.outerHTML = renderPetGearStudioViewer({
        containerId,
        canvasId,
        petId,
        activeSocket
      });
      initPetGearStudioViewer(containerId, { ...options, petId });
    });
  });

  // 4. Pose Trigger Buttons
  const poseButtons = container.querySelectorAll('.gear-pose-btn');
  poseButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const pose = btn.getAttribute('data-pose');
      if (!pose || !canvasInstance) return;
      canvasInstance.setPose(pose);

      poseButtons.forEach(b => b.classList.remove('bg-amber-500/30', 'border-amber-400', 'text-amber-300'));
      btn.classList.add('bg-amber-500/30', 'border-amber-400', 'text-amber-300');
    });
  });

  // 5. Wind Machine Toggle Button
  const windBtn = container.querySelector('#gear-studio-wind-btn');
  const windLabel = container.querySelector('#gear-wind-label');
  if (windBtn) {
    windBtn.addEventListener('click', () => {
      windMode = (windMode + 1) % 3;
      if (windMode === 0) {
        canvasInstance.setWind(0.0, 0);
        if (windLabel) windLabel.textContent = 'Wind: Off';
      } else if (windMode === 1) {
        canvasInstance.setWind(1.0, -1.5);
        if (windLabel) windLabel.textContent = 'Wind: Breeze';
      } else {
        canvasInstance.setWind(2.5, -3.0);
        if (windLabel) windLabel.textContent = 'Wind: Turbo';
      }
      Sound.capeWhoosh();
    });
  }

  // 6. Reset Dyes Button
  const resetBtn = container.querySelector('#gear-studio-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const defaultDyes = { head: '#f59e0b', back: '#ef4444', chest: '#475569', feet: '#10b981' };
      Object.keys(defaultDyes).forEach(slot => {
        store.setCustomGearDye(petId, slot, defaultDyes[slot]);
        if (canvasInstance) {
          canvasInstance.setGearColor(slot, defaultDyes[slot]);
        }
      });
      Sound.sparkle();
      container.outerHTML = renderPetGearStudioViewer({
        containerId,
        canvasId,
        petId,
        activeSocket
      });
      initPetGearStudioViewer(containerId, { ...options, petId });
    });
  }

  // 7. Launch Heroic Runway Showcase
  const launchBtn = container.querySelector('#gear-studio-launch-runway-btn');
  if (launchBtn) {
    launchBtn.addEventListener('click', () => {
      store.openPetRunwayModal(petId);
    });
  }

  return {
    instance: canvasInstance,
    destroy: () => {
      if (canvasInstance) canvasInstance.destroy();
      activeStudioInstances.delete(canvasId);
    }
  };
}
