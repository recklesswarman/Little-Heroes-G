import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';

let bathStage = 'scrub'; // 'scrub' or 'dry'
let bubblesCount = 0;

export function renderPetBathView() {
  const state = store.getState();
  const activePet = store.getActivePet();
  const hygiene = activePet.hygiene || 60;

  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-5 animate-fade-in select-none">
      
      <!-- Top Navigation Bar -->
      <div class="flex items-center justify-between z-20">
        <button id="bath-exit-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm">
          <span class="material-symbols-outlined text-base">arrow_back</span> Back to Pen
        </button>

        <div class="flex items-center gap-3">
          <div class="bg-surface-container-high px-4 py-2 rounded-full border-2 border-tertiary-container flex items-center gap-2 shadow-md">
            <span class="material-symbols-outlined text-tertiary text-xl" style="font-variation-settings: 'FILL' 1;">water_drop</span>
            <span class="font-headline text-sm font-black text-tertiary">Hygiene: ${hygiene}%</span>
          </div>
        </div>
      </div>

      <!-- 3D Bathtub Interactive Stage -->
      <div class="relative bg-[#09141e] rounded-3xl border-4 border-tertiary/40 min-h-[420px] card-shadow flex flex-col justify-between items-center overflow-hidden">
        
        <!-- 3D Bathtub Scene Background Image -->
        <img class="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none z-0" src="https://lh3.googleusercontent.com/aida-public/AB6AXuChCspQJaFH62vAmvxMah1FV4FgomNnC8x3Tnh67gupQHMYn0IYswagfoUX4wVhG4PzCe6LiuaedtoZCzRE56GXk2W-pMRmjPBVBtyuv6EAmkHp8WsmHe9jR2dktxmxVOqHg4slRh8MPUpU6q8OMVQT4ON4aguf7H0uB0ekBz8nY7ZeOrxg2JjAWTWsSAR6PfsCaJr69gNykFdz99qlR4J50p3KlYhK1MiPDgaZWWFe4yq4b18oRRPlWA" alt="Bathtub Stage" />
        
        <!-- Ambient Vignette Overlay -->
        <div class="absolute inset-0 bg-gradient-to-t from-[#09141e] via-transparent to-[#09141e]/70 pointer-events-none z-0"></div>

        <!-- Hygiene Progress Bar Header -->
        <div class="w-full max-w-md z-10 pt-4 px-4 flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-xs font-black text-tertiary">
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined text-base">soap</span> Cleanliness Meter
            </span>
            <span>${hygiene}% Clean</span>
          </div>
          <div class="w-full h-5 bg-surface-container-lowest/90 rounded-full p-1 border-2 border-tertiary/40 overflow-hidden shadow-inner">
            <div class="h-full bg-gradient-to-r from-tertiary to-primary rounded-full transition-all duration-300 relative" style="width: ${hygiene}%;">
              <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
        </div>

        <!-- Central Pet in the Tub with Scrub/Dry Effects -->
        <div class="relative z-10 my-4 flex flex-col items-center">
          
          <!-- Pet Avatar in Tub -->
          <div id="bath-pet-target" class="w-48 h-48 flex items-center justify-center animate-float relative cursor-pointer active:scale-95 transition-transform">
            <img class="w-full h-full object-contain drop-shadow-[0_15px_20px_rgba(0,0,0,0.9)]" src="${activePet.avatar}" alt="${activePet.name}" />

            <!-- Bubble Suds Overlay -->
            ${
              bathStage === 'scrub'
                ? `
              <div class="absolute -top-3 -right-2 bg-tertiary/30 text-tertiary text-xs font-black px-2.5 py-1 rounded-full border border-tertiary animate-bounce">
                🫧 Suds +${bubblesCount}
              </div>
            `
                : `
              <div class="absolute -top-3 -right-2 bg-secondary/30 text-secondary text-xs font-black px-2.5 py-1 rounded-full border border-secondary animate-pulse">
                💨 Blow Drying!
              </div>
            `
            }
          </div>

          <!-- Whimsical Voice Caption Guide -->
          <div class="bg-surface-container-lowest/80 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-tertiary/40 flex items-center gap-2 shadow-lg mt-2 text-center">
            <span class="material-symbols-outlined text-tertiary text-lg">record_voice_over</span>
            <span class="text-xs font-bold text-inverse-surface">
              ${
                bathStage === 'scrub'
                  ? `Let's scrub all those bubbles clean! Tap Sparky to lather suds!`
                  : `Now blow dry with warm air to make Sparky fluffy & dry!`
              }
            </span>
          </div>
        </div>

        <!-- Bottom Tactile Action Buttons -->
        <div class="w-full z-10 pb-5 px-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          
          <!-- Stage 1: Big Scrub Button -->
          <button id="bath-scrub-btn" class="w-full sm:w-auto flex-1 max-w-xs bg-tertiary text-on-tertiary font-headline text-base font-black py-4 px-6 rounded-2xl chunky-btn border-tertiary-container shadow-chunky-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-2xl">cleaning_services</span>
            SCRUB SUDS!
          </button>

          <!-- Stage 2: Blow Dry Button -->
          <button id="bath-dry-btn" class="w-full sm:w-auto flex-1 max-w-xs bg-secondary text-on-secondary font-headline text-base font-black py-4 px-6 rounded-2xl chunky-btn border-secondary-container shadow-chunky-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-2xl">air</span>
            BLOW DRY!
          </button>

        </div>

      </div>

    </div>
  `;
}

export function attachPetBathListeners() {
  const exitBtn = document.getElementById('bath-exit-btn');
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate('pet_pen');
    });
  }

  const petTarget = document.getElementById('bath-pet-target');
  if (petTarget) {
    petTarget.addEventListener('click', () => {
      bubblesCount++;
      Sound.bubble();
      store.bathPetProgress(15);
    });
  }

  const scrubBtn = document.getElementById('bath-scrub-btn');
  if (scrubBtn) {
    scrubBtn.addEventListener('click', () => {
      bathStage = 'scrub';
      bubblesCount++;
      Sound.bubble();
      Sound.splash();
      store.bathPetProgress(20);
    });
  }

  const dryBtn = document.getElementById('bath-dry-btn');
  if (dryBtn) {
    dryBtn.addEventListener('click', () => {
      bathStage = 'dry';
      Sound.laser();
      Sound.fanfare();
      store.bathPetProgress(25);
    });
  }
}
