// PetSkeletalFaceViewer: Reusable Interactive Skeletal Companion Face Component
// Renders procedural bone-and-mesh animated facial canvas with real-time lip-sync,
// natural blinks, ear/crest spring physics, and tactile touch interactions (pat, poke, drag).

import { PetSkeletalFaceCanvas, getPetFaceProfile } from '../services/petSkeletalFaceService.js';
import { Sound } from '../audio/sfx.js';

// Cache active skeletal face instances by canvas ID
const activeInstances = new Map();

/**
 * Returns an active skeletal face instance by canvas ID.
 */
export function getActivePetSkeletalInstance(canvasId) {
  return activeInstances.get(canvasId) || null;
}

/**
 * Clean up all active skeletal face instances.
 */
export function cleanupPetSkeletalInstances() {
  for (const [id, instance] of activeInstances.entries()) {
    try {
      instance.destroy();
    } catch (e) {
      console.warn(`Error destroying skeletal face instance ${id}:`, e);
    }
  }
  activeInstances.clear();
}

/**
 * Render the skeletal face canvas HTML element.
 */
export function renderPetSkeletalFaceViewer({
  canvasId = 'mascot-skeletal-face-canvas',
  petId = 'rex',
  width = 120,
  height = 120,
  isInteractive = true,
  className = ''
} = {}) {
  const profile = getPetFaceProfile(petId);

  return `
  <div class="pet-skeletal-face-wrapper relative flex items-center justify-center select-none ${className}" data-canvas-id="${canvasId}">
    <canvas 
      id="${canvasId}" 
      width="${width}" 
      height="${height}" 
      class="pet-skeletal-face-canvas w-full h-full object-contain touch-none cursor-pointer rounded-full transition-transform active:scale-95"
      data-pet-id="${petId}"
      data-interactive="${isInteractive}"
      aria-label="${profile.name} animated face"
      role="img"
    ></canvas>
  </div>
  `;
}

/**
 * Initialize a PetSkeletalFaceCanvas on the given canvas ID.
 */
export function initPetSkeletalFaceViewer(canvasId, options = {}) {
  if (typeof document === 'undefined') return null;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // Cleanup existing instance on this canvas if any
  if (activeInstances.has(canvasId)) {
    try {
      activeInstances.get(canvasId).destroy();
    } catch (e) {
      console.warn(`Error cleaning up previous instance on ${canvasId}:`, e);
    }
    activeInstances.delete(canvasId);
  }

  const petId = options.petId || canvas.getAttribute('data-pet-id') || 'rex';
  const isInteractive = options.isInteractive !== undefined 
    ? options.isInteractive 
    : (canvas.getAttribute('data-interactive') !== 'false');

  let instance = null;
  try {
    instance = new PetSkeletalFaceCanvas(canvas, {
      petId,
      isInteractive,
      ...options
    });
    activeInstances.set(canvasId, instance);
  } catch (err) {
    console.warn(`Failed to initialize PetSkeletalFaceCanvas on #${canvasId}:`, err);
    return null;
  }

  // Wire tactile pointer interactions if interactive
  if (isInteractive && canvas) {
    setupTactileInteractions(canvas, instance);
  }

  return instance;
}

/**
 * Wire tactile pointer & touch listeners (forehead pat, cheek poke, drag tilt).
 */
function setupTactileInteractions(canvas, instance) {
  let isPointerDown = false;
  let startX = 0;
  let startY = 0;
  let hasMoved = false;

  const handlePointerDown = (e) => {
    isPointerDown = true;
    hasMoved = false;
    startX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    startY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
  };

  const handlePointerMove = (e) => {
    if (!isPointerDown) return;
    const currentX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const currentY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const dx = currentX - startX;
    const dy = currentY - startY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasMoved = true;
      instance.applyDragOffset(dx, dy);
    }
  };

  const handlePointerUp = (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    instance.releaseDrag();

    if (!hasMoved) {
      // Tap detected: Determine tap location relative to face center
      const rect = canvas.getBoundingClientRect();
      const clickX = (e.clientX || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : (rect.left + rect.width / 2))) - rect.left;
      const clickY = (e.clientY || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : (rect.top + rect.height / 2))) - rect.top;

      const normY = clickY / rect.height; // 0 (top) to 1 (bottom)
      const normX = clickX / rect.width;  // 0 (left) to 1 (right)

      if (normY < 0.42) {
        // Forehead Pat!
        instance.triggerForeheadPat();
      } else if (normY > 0.45 && (normX < 0.35 || normX > 0.65)) {
        // Cheek Poke!
        instance.triggerCheekPoke();
      } else {
        // Center / Chin Tickle
        instance.triggerForeheadPat();
      }
    }
  };

  canvas.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);
}
