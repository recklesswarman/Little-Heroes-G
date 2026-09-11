// Dance3DViewer: Reusable 3D Pet Dance Coach Component for Movement Studio
// Embeds a responsive 3D dance coach canvas with real-time beat bouncing on a neon disco turntable,
// 6 distinct gross motor dance choreographies, and Freeze-Dance ice statue transformations.

import { Dance3DInteractiveCanvas, DANCE_MOVES } from '../services/dance3DService.js';
import { getPet3DProfile } from '../services/pet3DService.js';

// Cache active 3D dance instances by canvas ID
const activeDanceInstances = new Map();

export function renderDance3DViewer({
  canvasId = 'dance-coach-3d-canvas',
  petId = 'rex',
  stage = 1,
  width = 240,
  height = 240,
  currentMove = 'dino_march',
  bpm = 118,
  showBadge = true
} = {}) {
  const profile = getPet3DProfile(petId);
  const moveData = DANCE_MOVES[currentMove] || DANCE_MOVES.dino_march;

  return `
  <div id="${canvasId}-wrapper" class="dance-3d-viewer-wrapper relative flex flex-col items-center justify-center select-none w-full max-w-[${width}px] mx-auto group">
    
    <!-- Neon Disco Stage Lighting Aura -->
    <div class="absolute -inset-3 bg-radial from-cyan-500/20 via-pink-500/10 to-transparent rounded-full blur-xl pointer-events-none transition-all duration-700"></div>

    <!-- 3D Canvas Stage Container -->
    <div class="relative w-[${width}px] h-[${height}px] flex items-center justify-center overflow-visible">
      <canvas 
        id="${canvasId}" 
        width="${width}" 
        height="${height}" 
        class="dance-3d-canvas w-full h-full object-contain pointer-events-auto"
        data-pet-id="${petId}"
        data-stage="${stage}"
        data-move="${currentMove}"
        data-bpm="${bpm}"
      ></canvas>

      <!-- 2D Fallback Graphic (Shown if WebGL/Canvas fails) -->
      <div id="${canvasId}-fallback" class="hidden w-28 h-28 flex items-center justify-center animate-bounce">
        <span class="text-6xl filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">🦖</span>
      </div>

      <!-- Live Move & Tempo Badge -->
      ${showBadge ? `
        <div id="${canvasId}-move-badge" class="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 bg-surface-container-lowest/90 backdrop-blur-md px-3 py-0.5 rounded-full border border-outline-variant/40 shadow-md flex items-center gap-1.5 whitespace-nowrap z-20 pointer-events-none">
          <span class="text-xs">${moveData.emoji}</span>
          <span class="font-headline text-[10px] font-black text-on-surface uppercase tracking-wider">${moveData.name}</span>
          <span class="text-[9px] font-bold text-primary">· ${bpm} BPM</span>
        </div>
      ` : ''}
    </div>

  </div>
  `;
}

export function initDance3DViewer(canvasId, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // Cleanup prior instance if re-rendering
  if (activeDanceInstances.has(canvasId)) {
    activeDanceInstances.get(canvasId).destroy();
    activeDanceInstances.delete(canvasId);
  }

  let controller = null;
  try {
    controller = new Dance3DInteractiveCanvas(canvas, {
      petId: options.petId || canvas.getAttribute('data-pet-id') || 'rex',
      stage: parseInt(options.stage || canvas.getAttribute('data-stage') || '1', 10),
      currentMove: options.currentMove || canvas.getAttribute('data-move') || 'dino_march',
      bpm: parseInt(options.bpm || canvas.getAttribute('data-bpm') || '118', 10),
      ...options
    });
    activeDanceInstances.set(canvasId, controller);
  } catch (err) {
    console.warn(`[Dance3DViewer] 3D Canvas initialization failed for ${canvasId}, using fallback:`, err);
    const fallback = document.getElementById(`${canvasId}-fallback`);
    if (fallback) fallback.classList.remove('hidden');
    canvas.classList.add('hidden');
    return null;
  }

  return controller;
}

export function getActiveDance3DInstance(canvasId = 'dance-coach-3d-canvas') {
  return activeDanceInstances.get(canvasId) || null;
}
