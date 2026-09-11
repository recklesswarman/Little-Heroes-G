// PetRunwayModal: Theatrical Spotlight Catwalk & Polaroid Photo Card Generator
// Features theatrical runway stage with animated skeletal companion,
// crowd applause SFX, 4 heroic runway poses with particle effects,
// real-time camera snapshot flash, and collectible Polaroid card generator.

import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { PetSkeletalBodyCanvas, RUNWAY_POSES } from '../services/petSkeletalBodyService.js';
import { getPetFaceProfile } from '../services/petSkeletalFaceService.js';
import { getGearItem } from '../data/petGearStudioData.js';

let activeRunwayCanvas = null;
let lastSnappedPhotoUrl = null;
let activeRunwayTab = 'stage'; // 'stage' | 'album'

export function renderPetRunwayModal() {
  const state = store.getState();
  const modal = state.activeRunwayModal || { isOpen: false, petId: 1, currentPose: 'hero_landing' };

  if (!modal.isOpen) return '';

  const petId = modal.petId || state.selectedHero?.activePetId || 1;
  const companion = store.getPetWithProgress ? store.getPetWithProgress(petId) : (store.getActivePet() || { name: 'Rex', id: 1 });
  const petProfile = getPetFaceProfile(petId);
  const equipped = store.getEquippedPetStudioGear ? store.getEquippedPetStudioGear(petId) : {};
  const dyes = store.getCustomGearDyes ? store.getCustomGearDyes(petId) : {};
  const savedCards = store.getSavedHeroCards ? store.getSavedHeroCards() : [];

  // Get item names for gear badges
  const headItem = equipped.head ? getGearItem('head', equipped.head) : null;
  const backItem = equipped.back ? getGearItem('back', equipped.back) : null;
  const chestItem = equipped.chest ? getGearItem('chest', equipped.chest) : null;
  const feetItem = equipped.feet ? getGearItem('feet', equipped.feet) : null;

  return `
  <div id="pet-runway-modal-backdrop" class="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none animate-fade-in">
    
    <!-- Modal Container -->
    <div class="relative w-full max-w-4xl max-h-[94vh] bg-gradient-to-b from-slate-950 via-indigo-950/95 to-slate-950 rounded-3xl border-2 border-amber-400/50 shadow-2xl overflow-hidden flex flex-col animate-scale-up">
      
      <!-- Top Catwalk Spotlight Bar -->
      <div class="px-5 py-3.5 bg-slate-900/90 border-b border-amber-400/30 flex items-center justify-between z-20">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl shadow-lg border border-white/20">
            🌟
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base sm:text-lg font-black text-amber-300 font-display">Heroic Runway Showcase</h2>
              <span class="px-2 py-0.5 text-[10px] font-black bg-amber-400/20 text-amber-300 rounded-full border border-amber-400/30 uppercase tracking-wide">Live Stage</span>
            </div>
            <p class="text-xs text-slate-300">${companion.name}'s Spotlight Catwalk & Photo Booth</p>
          </div>
        </div>

        <!-- Mode Tabs & Close Button -->
        <div class="flex items-center gap-2">
          <div class="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button id="runway-tab-stage-btn" class="px-3 py-1 rounded-lg text-xs font-black transition-all ${activeRunwayTab === 'stage' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-300 hover:text-white'}">
              Catwalk Stage
            </button>
            <button id="runway-tab-album-btn" class="px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${activeRunwayTab === 'album' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-300 hover:text-white'}">
              <span>Photo Album</span>
              ${savedCards.length > 0 ? `<span class="px-1.5 py-0.2 rounded-full text-[10px] ${activeRunwayTab === 'album' ? 'bg-slate-900 text-amber-300' : 'bg-amber-400 text-slate-950'}">${savedCards.length}</span>` : ''}
            </button>
          </div>

          <button id="pet-runway-close-btn" class="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 flex items-center justify-center transition-all active:scale-95" aria-label="Close Runway">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </div>

      <!-- Modal Body Content -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-6 relative">
        
        ${activeRunwayTab === 'stage' ? `
          <!-- STAGE VIEW: Catwalk & Snapshot Director -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            <!-- Left: Catwalk Runway Stage (7 cols) -->
            <div class="lg:col-span-7 flex flex-col items-center">
              
              <!-- Spotlight Catwalk Arena -->
              <div class="relative w-full max-w-[420px] aspect-square rounded-3xl overflow-hidden bg-radial from-amber-500/15 via-indigo-950/80 to-black border-2 border-amber-400/40 shadow-2xl flex items-center justify-center group">
                
                <!-- Theatrical Overhead Spotlights Animation -->
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(251,191,36,0.35)_0%,rgba(99,102,241,0.12)_45%,transparent_70%)] pointer-events-none"></div>
                <div class="absolute top-0 left-1/4 w-32 h-64 bg-gradient-to-b from-amber-400/20 via-transparent to-transparent -rotate-12 blur-md pointer-events-none animate-pulse"></div>
                <div class="absolute top-0 right-1/4 w-32 h-64 bg-gradient-to-b from-cyan-400/20 via-transparent to-transparent rotate-12 blur-md pointer-events-none animate-pulse"></div>

                <!-- Screen Flash Overlay for Snapshot -->
                <div id="runway-camera-flash" class="absolute inset-0 bg-white opacity-0 pointer-events-none z-30 transition-opacity duration-150"></div>

                <!-- Skeletal Runway Stage Canvas -->
                <canvas 
                  id="pet-runway-stage-canvas" 
                  width="420" 
                  height="420" 
                  class="relative z-10 w-full h-full object-contain cursor-grab active:cursor-grabbing touch-none"
                  aria-label="${companion.name} Runway Catwalk"
                ></canvas>

                <!-- Shiny Golden Runway Stage Floor -->
                <div class="absolute bottom-6 left-1/2 -translate-x-1/2 w-64 h-5 rounded-full bg-gradient-to-r from-transparent via-amber-400/50 to-transparent blur-xs pointer-events-none"></div>

                <!-- Crowd Cheer Ripple Banner -->
                <div class="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900/80 border border-amber-400/30 text-[11px] font-bold text-amber-300 shadow backdrop-blur pointer-events-none flex items-center gap-1.5">
                  <span>👏</span>
                  <span>Crowd Cheering for ${companion.name}!</span>
                  <span>✨</span>
                </div>
              </div>

              <!-- Runway Pose Director Buttons -->
              <div class="w-full max-w-[420px] mt-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">auto_awesome</span>
                    <span>Direct Catwalk Pose</span>
                  </span>
                  <button id="runway-cheer-sound-btn" class="text-[11px] text-cyan-300 hover:text-cyan-200 font-bold flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">volume_up</span>
                    <span>Cheer SFX</span>
                  </button>
                </div>

                <div class="grid grid-cols-4 gap-2">
                  <button class="runway-pose-btn p-2 rounded-xl bg-slate-800/90 hover:bg-amber-500/25 border border-slate-700 hover:border-amber-400 text-xs font-black text-slate-200 hover:text-amber-300 transition-all flex flex-col items-center gap-1 active:scale-95 shadow" data-pose="${RUNWAY_POSES.HERO_LANDING}">
                    <span class="text-lg">🦸</span>
                    <span>Landing</span>
                  </button>
                  <button class="runway-pose-btn p-2 rounded-xl bg-slate-800/90 hover:bg-amber-500/25 border border-slate-700 hover:border-amber-400 text-xs font-black text-slate-200 hover:text-amber-300 transition-all flex flex-col items-center gap-1 active:scale-95 shadow" data-pose="${RUNWAY_POSES.WING_FLARE}">
                    <span class="text-lg">✨</span>
                    <span>Wing Flare</span>
                  </button>
                  <button class="runway-pose-btn p-2 rounded-xl bg-slate-800/90 hover:bg-amber-500/25 border border-slate-700 hover:border-amber-400 text-xs font-black text-slate-200 hover:text-amber-300 transition-all flex flex-col items-center gap-1 active:scale-95 shadow" data-pose="${RUNWAY_POSES.SPIN_360}">
                    <span class="text-lg">🔄</span>
                    <span>360 Spin</span>
                  </button>
                  <button class="runway-pose-btn p-2 rounded-xl bg-slate-800/90 hover:bg-amber-500/25 border border-slate-700 hover:border-amber-400 text-xs font-black text-slate-200 hover:text-amber-300 transition-all flex flex-col items-center gap-1 active:scale-95 shadow" data-pose="${RUNWAY_POSES.HERO_SALUTE}">
                    <span class="text-lg">🫡</span>
                    <span>Salute</span>
                  </button>
                </div>
              </div>

            </div>

            <!-- Right: Photo Booth & Polaroid Card Preview (5 cols) -->
            <div class="lg:col-span-5 flex flex-col items-center">
              
              <!-- Main Action: SNAP POLAROID PHOTO -->
              <button id="runway-snap-photo-btn" class="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-2xl hover:shadow-amber-400/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 border-2 border-white/40">
                <span class="text-2xl">📸</span>
                <span>Snap Heroic Polaroid Photo!</span>
              </button>

              <!-- Polaroid Photo Card Preview Container -->
              <div id="runway-polaroid-preview-area" class="w-full max-w-[320px] mt-5">
                ${renderPolaroidCard({
                  petName: companion.name,
                  petProfile,
                  photoUrl: lastSnappedPhotoUrl,
                  equipped,
                  dyes,
                  headItem,
                  backItem,
                  chestItem,
                  feetItem
                })}
              </div>

            </div>

          </div>
        ` : `
          <!-- ALBUM VIEW: Saved Hero Cards Gallery -->
          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-black text-amber-300 font-display">Hero Polaroid Photo Album</h3>
                <p class="text-xs text-slate-400">All the collectible photo cards captured on the heroic runway.</p>
              </div>
              <button id="runway-back-to-stage-btn" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-amber-300 flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">arrow_back</span>
                <span>Back to Stage</span>
              </button>
            </div>

            ${savedCards.length === 0 ? `
              <div class="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <span class="text-5xl">📷</span>
                <p class="text-sm font-bold text-slate-300">No Hero Cards captured yet!</p>
                <p class="text-xs max-w-xs">Direct your companion on the runway stage and snap your first heroic Polaroid photo.</p>
                <button id="runway-empty-snap-btn" class="mt-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shadow hover:bg-amber-400">
                  📸 Go Snap First Photo
                </button>
              </div>
            ` : `
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                ${savedCards.map(card => `
                  <div class="relative bg-white text-slate-900 rounded-2xl p-3 pb-4 shadow-xl border-2 border-slate-200 flex flex-col gap-2 transform transition-transform hover:-translate-y-1 hover:rotate-1">
                    <!-- Photo Window -->
                    <div class="w-full aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-300 flex items-center justify-center relative">
                      ${card.photoUrl ? `
                        <img src="${card.photoUrl}" alt="${card.petName}" class="w-full h-full object-contain" />
                      ` : `
                        <span class="text-5xl">${card.petEmoji || '🦖'}</span>
                      `}
                      <span class="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur text-amber-300 text-[10px] font-black uppercase">
                        ${card.pose || 'Hero'}
                      </span>
                    </div>

                    <!-- Label & Date -->
                    <div class="pt-1">
                      <div class="flex items-center justify-between">
                        <h4 class="font-black text-sm text-slate-900 font-display">${card.petName}</h4>
                        <span class="text-[10px] font-bold text-slate-400">${card.dateStr || 'Recent'}</span>
                      </div>
                      <p class="text-[11px] text-amber-600 font-black">${card.outfitTitle || 'Equipped Hero'}</p>
                    </div>

                    <!-- Card Actions -->
                    <div class="flex items-center justify-between pt-2 border-t border-slate-100">
                      <a href="${card.photoUrl || '#'}" download="${card.petName}-heroic-runway.png" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1">
                        <span class="material-symbols-outlined text-xs">download</span>
                        <span>Save</span>
                      </a>
                      <button class="runway-delete-card-btn px-2 py-1 rounded-lg text-rose-500 hover:bg-rose-50 text-[11px] font-bold flex items-center gap-1" data-card-id="${card.id}">
                        <span class="material-symbols-outlined text-xs">delete</span>
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        `}

      </div>

    </div>

  </div>
  `;
}

/**
 * Helper to render the live or newly snapped Polaroid Card
 */
function renderPolaroidCard({
  petName,
  petProfile,
  photoUrl,
  equipped,
  dyes,
  headItem,
  backItem,
  chestItem,
  feetItem
}) {
  const outfitParts = [
    headItem ? headItem.name : null,
    backItem ? backItem.name : null,
    chestItem ? chestItem.name : null,
    feetItem ? feetItem.name : null
  ].filter(Boolean);

  const outfitDescription = outfitParts.length > 0 ? outfitParts.join(' • ') : 'Signature Starter Suit';

  return `
  <div class="relative bg-white text-slate-900 rounded-3xl p-4 pb-5 shadow-2xl border-4 border-slate-100 flex flex-col gap-3 transform -rotate-1 hover:rotate-0 transition-transform">
    
    <!-- Photo Window -->
    <div id="polaroid-photo-frame" class="w-full aspect-square rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 shadow-inner flex items-center justify-center relative group">
      ${photoUrl ? `
        <img id="polaroid-img-preview" src="${photoUrl}" alt="${petName} Snapshot" class="w-full h-full object-contain" />
      ` : `
        <div class="flex flex-col items-center justify-center text-slate-400 gap-2 p-4 text-center">
          <span class="text-4xl animate-bounce">📸</span>
          <p class="text-xs font-bold text-slate-300">Click "Snap Polaroid Photo" above to freeze this heroic catwalk pose!</p>
        </div>
      `}
      <div class="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur text-amber-400 text-[10px] font-black uppercase">
        Hero Card
      </div>
    </div>

    <!-- Polaroid Handwritten Label Area -->
    <div class="px-1">
      <div class="flex items-center justify-between">
        <h3 class="font-black text-base text-slate-900 font-display flex items-center gap-1.5">
          <span>${petProfile?.emoji || '🦖'}</span>
          <span>${petName}</span>
        </h3>
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
      </div>
      <p class="text-[11px] text-amber-600 font-black mt-0.5 truncate">${outfitDescription}</p>
    </div>

    <!-- Action Buttons for Polaroid Card -->
    ${photoUrl ? `
      <div class="flex items-center gap-2 pt-1">
        <button id="runway-save-card-btn" class="flex-1 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow flex items-center justify-center gap-1.5 transition-all active:scale-95">
          <span class="material-symbols-outlined text-sm">bookmark</span>
          <span>Save to Album</span>
        </button>
        <a id="runway-download-card-btn" href="${photoUrl}" download="${petName}-hero-card.png" class="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95">
          <span class="material-symbols-outlined text-sm">download</span>
        </a>
      </div>
    ` : ''}

  </div>
  `;
}

/**
 * Attach listeners for PetRunwayModal
 */
export function attachPetRunwayModalListeners() {
  if (typeof document === 'undefined') return;
  const backdrop = document.getElementById('pet-runway-modal-backdrop');
  if (!backdrop) return;

  const state = store.getState();
  const modal = state.activeRunwayModal || {};
  const petId = modal.petId || state.selectedHero?.activePetId || 1;

  // Initialize Catwalk Canvas
  const canvas = document.getElementById('pet-runway-stage-canvas');
  if (canvas) {
    if (activeRunwayCanvas) {
      try {
        activeRunwayCanvas.destroy();
      } catch (e) {}
      activeRunwayCanvas = null;
    }

    const equipped = store.getEquippedPetStudioGear ? store.getEquippedPetStudioGear(petId) : {};
    const dyes = store.getCustomGearDyes ? store.getCustomGearDyes(petId) : {};

    try {
      activeRunwayCanvas = new PetSkeletalBodyCanvas(canvas, {
        petId,
        equippedGear: equipped,
        gearColors: dyes,
        pose: modal.currentPose || RUNWAY_POSES.HERO_LANDING
      });
      // Lively catwalk breeze
      activeRunwayCanvas.setWind(2.4, -2.8);
      // Play celebratory crowd welcome
      Sound.crowdCheer();
    } catch (err) {
      console.warn('Failed to init runway canvas:', err);
    }
  }

  // Close Button
  const closeBtn = document.getElementById('pet-runway-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (activeRunwayCanvas) {
        activeRunwayCanvas.destroy();
        activeRunwayCanvas = null;
      }
      store.closePetRunwayModal();
    });
  }

  // Tab Switches
  const stageTabBtn = document.getElementById('runway-tab-stage-btn');
  const albumTabBtn = document.getElementById('runway-tab-album-btn');
  const backToStageBtn = document.getElementById('runway-back-to-stage-btn');
  const emptySnapBtn = document.getElementById('runway-empty-snap-btn');

  const switchTab = (tab) => {
    activeRunwayTab = tab;
    Sound.bloop();
    store.notify();
  };

  if (stageTabBtn) stageTabBtn.addEventListener('click', () => switchTab('stage'));
  if (albumTabBtn) albumTabBtn.addEventListener('click', () => switchTab('album'));
  if (backToStageBtn) backToStageBtn.addEventListener('click', () => switchTab('stage'));
  if (emptySnapBtn) emptySnapBtn.addEventListener('click', () => switchTab('stage'));

  // Cheer SFX Button
  const cheerBtn = document.getElementById('runway-cheer-sound-btn');
  if (cheerBtn) {
    cheerBtn.addEventListener('click', () => {
      Sound.crowdCheer();
    });
  }

  // Pose Buttons
  const poseButtons = backdrop.querySelectorAll('.runway-pose-btn');
  poseButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const pose = btn.getAttribute('data-pose');
      if (!pose || !activeRunwayCanvas) return;
      activeRunwayCanvas.setPose(pose);

      poseButtons.forEach(b => b.classList.remove('bg-amber-500/30', 'border-amber-400', 'text-amber-300'));
      btn.classList.add('bg-amber-500/30', 'border-amber-400', 'text-amber-300');
    });
  });

  // Snap Photo Button
  const snapBtn = document.getElementById('runway-snap-photo-btn');
  const flashOverlay = document.getElementById('runway-camera-flash');
  if (snapBtn && canvas) {
    snapBtn.addEventListener('click', () => {
      // 1. Camera Flash Animation
      if (flashOverlay) {
        flashOverlay.style.opacity = '0.9';
        setTimeout(() => {
          flashOverlay.style.opacity = '0';
        }, 120);
      }

      // 2. Camera Shutter Sound
      Sound.cameraShutter();

      // 3. Extract Image Data URL from Canvas
      try {
        const dataUrl = canvas.toDataURL('image/png');
        lastSnappedPhotoUrl = dataUrl;

        // Re-render the polaroid preview card
        const previewArea = document.getElementById('runway-polaroid-preview-area');
        if (previewArea) {
          const companion = store.getActivePet() || { name: 'Rex', id: 1 };
          const petProfile = getPetFaceProfile(petId);
          const equipped = store.getEquippedPetStudioGear ? store.getEquippedPetStudioGear(petId) : {};
          const dyes = store.getCustomGearDyes ? store.getCustomGearDyes(petId) : {};
          const headItem = equipped.head ? getGearItem('head', equipped.head) : null;
          const backItem = equipped.back ? getGearItem('back', equipped.back) : null;
          const chestItem = equipped.chest ? getGearItem('chest', equipped.chest) : null;
          const feetItem = equipped.feet ? getGearItem('feet', equipped.feet) : null;

          previewArea.innerHTML = renderPolaroidCard({
            petName: companion.name,
            petProfile,
            photoUrl: lastSnappedPhotoUrl,
            equipped,
            dyes,
            headItem,
            backItem,
            chestItem,
            feetItem
          });

          // Re-bind save card button
          bindSaveCardButton(petId, companion.name);
        }
      } catch (e) {
        console.warn('Error taking snapshot:', e);
      }
    });
  }

  // Bind initial save card button if card exists
  const companion = store.getActivePet() || { name: 'Rex', id: 1 };
  bindSaveCardButton(petId, companion.name);

  // Delete Card Buttons in Album
  const deleteButtons = backdrop.querySelectorAll('.runway-delete-card-btn');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const cardId = btn.getAttribute('data-card-id');
      if (!cardId) return;
      store.deleteHeroCard(cardId);
    });
  });
}

function bindSaveCardButton(petId, petName) {
  const saveBtn = document.getElementById('runway-save-card-btn');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', () => {
    if (!lastSnappedPhotoUrl) return;

    const equipped = store.getEquippedPetStudioGear ? store.getEquippedPetStudioGear(petId) : {};
    const headItem = equipped.head ? getGearItem('head', equipped.head) : null;
    const backItem = equipped.back ? getGearItem('back', equipped.back) : null;
    const chestItem = equipped.chest ? getGearItem('chest', equipped.chest) : null;
    const feetItem = equipped.feet ? getGearItem('feet', equipped.feet) : null;

    const parts = [headItem?.name, backItem?.name, chestItem?.name, feetItem?.name].filter(Boolean);
    const outfitTitle = parts.length > 0 ? parts.join(' • ') : 'Super Suit';

    store.saveHeroCard({
      petId,
      petName,
      photoUrl: lastSnappedPhotoUrl,
      outfitTitle,
      pose: activeRunwayCanvas?.currentPose || 'hero_landing'
    });

    saveBtn.innerHTML = `
      <span class="material-symbols-outlined text-sm">check_circle</span>
      <span>Saved to Album!</span>
    `;
    saveBtn.classList.remove('bg-amber-400', 'hover:bg-amber-300');
    saveBtn.classList.add('bg-emerald-400', 'text-slate-950');
    saveBtn.disabled = true;
  });
}
