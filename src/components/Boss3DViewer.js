// Boss3DViewer: Reusable 3D Boss Monster Component for AR Toothbrush Battles
// Embeds a responsive 3D boss canvas with real-time lunges toward mirror quadrants,
// foam knockback recoil, 3D shield barriers, dizzy tumbling, and defeat explosions.

import { Boss3DInteractiveCanvas, getBoss3DProfile } from '../services/boss3DService.js';

// Cache active 3D boss instances by canvas ID
const activeBossInstances = new Map();

export function renderBoss3DViewer({
  canvasId = 'boss-3d-canvas',
  bossId = 'sugar_bandit',
  width = 300,
  height = 300,
  showBadge = true
} = {}) {
  const profile = getBoss3DProfile(bossId);

  return `
  <div id="${canvasId}-wrapper" class="boss-3d-viewer-wrapper relative flex flex-col items-center justify-center select-none w-full max-w-[${width}px] mx-auto pointer-events-none">
    
    <!-- 3D Boss Energy Glow Aura -->
    <div class="absolute -inset-4 rounded-full blur-2xl pointer-events-none transition-all duration-500" style="background: radial-gradient(circle, ${profile.auraColor} 0%, transparent 70%);"></div>

    <!-- Main 3D Canvas Stage -->
    <div class="relative w-[${width}px] h-[${height}px] flex items-center justify-center overflow-visible">
      <canvas 
        id="${canvasId}" 
        width="${width}" 
        height="${height}" 
        class="boss-3d-canvas w-full h-full object-contain pointer-events-auto"
        data-boss-id="${bossId}"
      ></canvas>

      <!-- 2D Fallback Icon (Hidden by default; shown if canvas fails) -->
      <div id="${canvasId}-fallback" class="hidden w-40 h-40 flex items-center justify-center animate-villain-hover">
        <span class="text-7xl filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
          ${bossId.includes('kraken') ? '🐙' : bossId.includes('goblin') ? '🪨' : '🍯'}
        </span>
      </div>

      <!-- Boss Name & Combat Title Pill -->
      ${showBadge ? `
        <div class="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-surface-container-lowest/90 backdrop-blur-md px-3.5 py-1 rounded-full border border-outline-variant/40 shadow-lg flex items-center gap-1.5 whitespace-nowrap z-20 pointer-events-none">
          <span class="w-2 h-2 rounded-full animate-ping" style="background-color: ${profile.bodyColor};"></span>
          <span class="font-headline text-[11px] font-black text-on-surface uppercase tracking-wider">${profile.name}</span>
          <span class="text-[9px] font-bold text-on-surface-variant/80">· 3D</span>
        </div>
      ` : ''}
    </div>

  </div>
  `;
}

export function initBoss3DViewer(canvasId, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // Cleanup prior instance if re-rendering
  if (activeBossInstances.has(canvasId)) {
    activeBossInstances.get(canvasId).destroy();
    activeBossInstances.delete(canvasId);
  }

  let controller = null;
  try {
    controller = new Boss3DInteractiveCanvas(canvas, {
      bossId: options.bossId || canvas.getAttribute('data-boss-id') || 'sugar_bandit',
      ...options
    });
    activeBossInstances.set(canvasId, controller);
  } catch (err) {
    console.warn(`[Boss3DViewer] WebGL/Canvas 3D initialization failed for ${canvasId}, using fallback:`, err);
    const fallback = document.getElementById(`${canvasId}-fallback`);
    if (fallback) fallback.classList.remove('hidden');
    canvas.classList.add('hidden');
    return null;
  }

  return controller;
}

export function getActiveBoss3DInstance(canvasId = 'boss-3d-canvas') {
  return activeBossInstances.get(canvasId) || null;
}
