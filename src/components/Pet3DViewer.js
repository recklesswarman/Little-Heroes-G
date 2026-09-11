// Pet3DViewer: Reusable Interactive 3D Companion Pet Component
// Embeds a responsive 3D pet canvas with orbit touch controls, head scratch reactions,
// tummy tickle backflips, snack feeding, and seamless 2D image fallbacks.

import { Pet3DInteractiveCanvas, getPet3DProfile } from '../services/pet3DService.js';
import { Sound } from '../audio/sfx.js';
import { speakRex } from '../services/voiceService.js';

// Cache active 3D instances by canvas ID
const activeInstances = new Map();

export function renderPet3DViewer({
  canvasId = 'pet-3d-canvas',
  petId = 'rex',
  stage = 1,
  mode = 'sanctuary',
  avatarFallback = '',
  petName = 'Rex',
  width = 320,
  height = 320,
  showControls = true
} = {}) {
  const profile = getPet3DProfile(petId);
  const stageData = profile.stages[stage] || profile.stages[1];

  return `
  <div class="pet-3d-viewer-wrapper relative flex flex-col items-center justify-center select-none w-full max-w-[${width}px] mx-auto group">
    
    <!-- 3D Perspective Glow Ring -->
    <div class="absolute -inset-3 bg-radial from-primary/20 via-secondary/10 to-transparent rounded-full blur-xl pointer-events-none transition-all duration-700 group-hover:scale-105"></div>

    <!-- Main 3D Canvas -->
    <div class="relative w-[${width}px] h-[${height}px] rounded-3xl overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing">
      <canvas 
        id="${canvasId}" 
        width="${width}" 
        height="${height}" 
        class="pet-3d-canvas w-full h-full object-contain touch-none"
        data-pet-id="${petId}"
        data-stage="${stage}"
        data-mode="${mode}"
      ></canvas>

      <!-- 2D Fallback Image (Hidden by default; shown if canvas fails or WebGL unsupported) -->
      <img 
        id="${canvasId}-fallback-img" 
        src="${avatarFallback || 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZfP7_Cwlp4sz41asI8ymuapAKvjmqHtvI4zcMAF_XwUmibj8IheGrS5cA5QD5gmXgVxEkZM9FlWJPRZnct3x6-9SQB7zJKqkEDjJ3m95tAy3zRqS-PbmcQ4kv_9pmIfm2Py4mh3Fw083hkDookz1w4_r50SBA1jc9igDaAPFLYBFgSP2aQBz7Q4jVE-DwhMOyUEHlxDkQk6Gwc2EAFCSKs1c0QuhUOi3tkrk5MXRARKqZcYVzyJe6gA'}" 
        alt="${petName}" 
        class="hidden w-4/5 h-4/5 object-contain pointer-events-none animate-idle-bob"
      />

      <!-- Drag to Rotate 3D Hint Badge -->
      <div class="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
        <span class="bg-black/50 backdrop-blur-sm text-white/90 text-[10px] font-headline font-black px-2.5 py-0.5 rounded-full border border-white/20 flex items-center gap-1 shadow">
          <span class="material-symbols-outlined text-[12px] animate-spin">360</span> Drag to rotate 3D
        </span>
      </div>

      <!-- Stage Badge Indicator -->
      <div class="absolute top-2 left-2 pointer-events-none">
        <span class="bg-primary/90 text-on-primary font-headline text-[10px] font-black px-2 py-0.5 rounded-full border border-white/30 shadow-md">
          Stage ${stage}: ${stageData.title.split(' ')[0]}
        </span>
      </div>
    </div>

    <!-- Tactile Micro-Interaction Quick Tray (Petting, Tickles, Treats) -->
    ${showControls ? `
      <div class="flex items-center gap-2 mt-3 z-10">
        <button id="${canvasId}-scratch-btn" class="bg-surface-container-high hover:bg-surface-bright text-pink-300 hover:text-pink-200 px-3 py-1.5 rounded-2xl font-headline text-xs font-black border border-pink-400/40 flex items-center gap-1 shadow transition-all active:scale-95 chunky-btn-sm" title="Scratch behind ears!">
          <span>❤️</span> Pet Head
        </button>

        <button id="${canvasId}-tickle-btn" class="bg-surface-container-high hover:bg-surface-bright text-amber-300 hover:text-amber-200 px-3 py-1.5 rounded-2xl font-headline text-xs font-black border border-amber-400/40 flex items-center gap-1 shadow transition-all active:scale-95 chunky-btn-sm" title="Tickle belly for backflip!">
          <span>🤸</span> Tickle Belly
        </button>

        <button id="${canvasId}-feed-btn" class="bg-surface-container-high hover:bg-surface-bright text-emerald-300 hover:text-emerald-200 px-3 py-1.5 rounded-2xl font-headline text-xs font-black border border-emerald-400/40 flex items-center gap-1 shadow transition-all active:scale-95 chunky-btn-sm" title="Feed a healthy treat!">
          <span>🍎</span> Feed Treat
        </button>
      </div>
    ` : ''}

  </div>
  `;
}

export function initPet3DViewer(canvasId, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // Cleanup prior instance if re-rendering
  if (activeInstances.has(canvasId)) {
    activeInstances.get(canvasId).destroy();
    activeInstances.delete(canvasId);
  }

  // Instantiate 3D Interactive Controller
  let controller = null;
  try {
    controller = new Pet3DInteractiveCanvas(canvas, {
      petId: options.petId || canvas.getAttribute('data-pet-id') || 'rex',
      stage: options.stage || parseInt(canvas.getAttribute('data-stage'), 10) || 1,
      mode: options.mode || canvas.getAttribute('data-mode') || 'sanctuary',
      onAction: (action, data) => {
        if (typeof options.onAction === 'function') {
          options.onAction(action, data);
        }
      }
    });

    activeInstances.set(canvasId, controller);
  } catch (err) {
    console.warn('Could not initialize 3D canvas; displaying 2D fallback image.', err);
    canvas.classList.add('hidden');
    const fallbackImg = document.getElementById(`${canvasId}-fallback-img`);
    if (fallbackImg) fallbackImg.classList.remove('hidden');
    return null;
  }

  // Hook Quick Tray Control Buttons
  const scratchBtn = document.getElementById(`${canvasId}-scratch-btn`);
  if (scratchBtn) {
    scratchBtn.addEventListener('click', () => {
      controller.triggerHeadScratch();
      speakRex(`*Happy purr!* Oh that feels so good! You are the best friend ever!`);
    });
  }

  const tickleBtn = document.getElementById(`${canvasId}-tickle-btn`);
  if (tickleBtn) {
    tickleBtn.addEventListener('click', () => {
      controller.triggerBellyTickle();
      speakRex(`*Happy giggle!* Tickles! WHEEEE! Look at this superhero flip!`);
    });
  }

  const feedBtn = document.getElementById(`${canvasId}-feed-btn`);
  if (feedBtn) {
    feedBtn.addEventListener('click', () => {
      controller.triggerFeedSnack('apple');
      speakRex(`*Crunch crunch!* Yum! Crisp sweet apple! My energy is 100%!`);
    });
  }

  return controller;
}

export function getActivePet3DInstance(canvasId) {
  return activeInstances.get(canvasId) || null;
}
