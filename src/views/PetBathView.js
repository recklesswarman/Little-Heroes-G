import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import { speakRex } from '../services/voiceService.js';

let hasSpokenBathIntro = false;

let washProgress = 0; // 0 to 100
let dryProgress = 0; // 0 to 100
let isScrubbing = false;
let isBlowingDry = false;
let poppedBubblesCount = 0;
let isRewardClaimed = false;

export function renderPetBathView() {
  const state = store.getState();
  const activePet = store.getActivePet();
  const hygiene = activePet.hygiene || 60;
  const isFullyWashed = washProgress >= 100;
  const isFullyDried = dryProgress >= 100;
  const isBathComplete = isFullyWashed && isFullyDried;

  // Foam size calculations based on wash progress
  const foamOpacity = isFullyDried ? 0 : Math.min(1, washProgress / 60);
  const foamScale = isFullyDried ? 0.3 : Math.min(1.2, 0.4 + washProgress / 100);

  // Sparkle gleam for clean & dry pet
  const sparkleCount = isFullyDried ? 6 : Math.floor(dryProgress / 20);

  return `
    <div class="max-w-4xl mx-auto px-4 pt-3 pb-24 flex flex-col gap-4 animate-fade-in select-none">
      
      <!-- Top Navigation & Status Bar -->
      <div class="flex items-center justify-between z-20">
        <button id="bath-exit-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95 shadow-sm">
          <span class="material-symbols-outlined text-base">arrow_back</span>
          <span>Back to Pen</span>
        </button>

        <div class="flex items-center gap-2.5">
          <div class="bg-surface-container-high px-4 py-2 rounded-full border-2 border-primary/50 flex items-center gap-2 shadow-md">
            <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1;">water_drop</span>
            <span class="font-headline text-xs font-black text-inverse-surface">Hygiene: ${hygiene}%</span>
          </div>
          ${
            isBathComplete
              ? `<span class="bg-primary/20 text-primary border border-primary/50 text-xs font-black px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
                   <span class="material-symbols-outlined text-sm">stars</span> Squeaky Clean & Fluffy!
                 </span>`
              : ''
          }
        </div>
      </div>

      <!-- Two-Stage Washing & Drying Meters -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 z-10">
        
        <!-- Meter 1: Suds & Wash -->
        <div class="bg-surface-container rounded-2xl p-3 border-2 ${
          isFullyWashed ? 'border-primary/80 bg-primary/10' : 'border-tertiary/50'
        } card-shadow flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-xs font-black">
            <span class="flex items-center gap-1.5 ${isFullyWashed ? 'text-primary' : 'text-tertiary'}">
              <span class="material-symbols-outlined text-base">soap</span>
              <span>1. Wash & Scrub Suds</span>
            </span>
            <span class="font-headline font-black ${isFullyWashed ? 'text-primary' : 'text-tertiary'}">
              ${isFullyWashed ? '100% Washed! ✓' : `${washProgress}%`}
            </span>
          </div>
          <div class="w-full h-3.5 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest shadow-inner">
            <div class="h-full bg-gradient-to-r from-tertiary via-cyan-400 to-primary rounded-full transition-all duration-300 relative" style="width: ${washProgress}%;">
              <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
        </div>

        <!-- Meter 2: Blow Dry -->
        <div class="bg-surface-container rounded-2xl p-3 border-2 ${
          isFullyDried
            ? 'border-primary/80 bg-primary/10'
            : isFullyWashed
            ? 'border-secondary/80'
            : 'border-surface-container-highest opacity-70'
        } card-shadow flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-xs font-black">
            <span class="flex items-center gap-1.5 ${isFullyDried ? 'text-primary' : 'text-secondary'}">
              <span class="material-symbols-outlined text-base">air</span>
              <span>2. Warm Blow Dry</span>
            </span>
            <span class="font-headline font-black ${isFullyDried ? 'text-primary' : 'text-secondary'}">
              ${isFullyDried ? '100% Fluffy Dry! ✓' : `${dryProgress}%`}
            </span>
          </div>
          <div class="w-full h-3.5 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest shadow-inner">
            <div class="h-full bg-gradient-to-r from-secondary via-sky-400 to-primary rounded-full transition-all duration-300 relative" style="width: ${dryProgress}%;">
              <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
        </div>

      </div>

      <!-- 3D Bathtub Interactive Stage -->
      <div class="relative bg-[#09141e] rounded-3xl border-4 ${
        isBathComplete ? 'border-primary/70' : 'border-tertiary/40'
      } min-h-[440px] sm:min-h-[480px] card-shadow flex flex-col justify-between items-center overflow-hidden">
        
        <!-- 3D Bathtub Scene Background -->
        <img class="absolute inset-0 w-full h-full object-cover opacity-75 pointer-events-none z-0" src="https://lh3.googleusercontent.com/aida-public/AB6AXuChCspQJaFH62vAmvxMah1FV4FgomNnC8x3Tnh67gupQHMYn0IYswagfoUX4wVhG4PzCe6LiuaedtoZCzRE56GXk2W-pMRmjPBVBtyuv6EAmkHp8WsmHe9jR2dktxmxVOqHg4slRh8MPUpU6q8OMVQT4ON4aguf7H0uB0ekBz8nY7ZeOrxg2JjAWTWsSAR6PfsCaJr69gNykFdz99qlR4J50p3KlYhK1MiPDgaZWWFe4yq4b18oRRPlWA" alt="Bathtub Stage" />
        
        <!-- Vignette & Water Ambient Glow -->
        <div class="absolute inset-0 bg-gradient-to-t from-[#09141e] via-transparent to-[#09141e]/60 pointer-events-none z-0"></div>

        <!-- Animated Water Ripples at the bottom of the tub -->
        <div class="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-cyan-600/35 via-blue-500/20 to-transparent border-t-2 border-cyan-400/30 pointer-events-none z-1 animate-water-ripple"></div>

        <!-- Interactive Floating Bath Toys -->
        <!-- 1. Squeaky Rubber Ducky -->
        <button id="bath-ducky-btn" class="absolute bottom-12 left-6 sm:left-12 z-20 w-16 h-16 flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-transform" title="Tap to Squeak Ducky!">
          <span class="text-4xl filter drop-shadow-[0_8px_10px_rgba(0,0,0,0.7)] select-none animate-bounce">🐥</span>
        </button>

        <!-- 2. Floating Soap Bar -->
        <button id="bath-soap-btn" class="absolute bottom-10 right-6 sm:right-12 z-20 w-14 h-14 flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-transform" title="Tap for Extra Suds!">
          <span class="text-3xl filter drop-shadow-[0_8px_10px_rgba(0,0,0,0.7)] select-none animate-pulse">🧼</span>
        </button>

        <!-- 3. Floating Sponge -->
        <button id="bath-sponge-btn" class="absolute bottom-28 right-8 sm:right-16 z-20 w-12 h-12 flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-transform" title="Sponge Scrub!">
          <span class="text-2xl filter drop-shadow-[0_6px_8px_rgba(0,0,0,0.7)] select-none">🧽</span>
        </button>

        <!-- Top Guidance Banner / Whimsical Voice -->
        <div class="z-10 pt-4 px-4 w-full flex justify-center">
          <div class="bg-surface-container-lowest/85 backdrop-blur-md px-5 py-2 rounded-2xl border border-white/20 flex items-center gap-2 shadow-lg text-center max-w-md">
            <span class="material-symbols-outlined text-secondary text-lg">record_voice_over</span>
            <span id="bath-guidance-text" class="text-xs font-bold text-inverse-surface">
              ${
                isBathComplete
                  ? `Hooray! ${activePet.name} is 100% washed, blow-dried, and sparkling fresh! 🎉`
                  : isFullyWashed
                  ? `All lathered in bubbles! Now tap BLOW DRY to fluff up and warm ${activePet.name}! 💨`
                  : `Tap SCRUB SUDS or rub ${activePet.name} to lather soapy bubbles! 🫧`
              }
            </span>
          </div>
        </div>

        <!-- Central Stage: Pet Target & Interactive Effects -->
        <div class="relative z-10 my-auto flex flex-col items-center justify-center">
          
          <!-- Blow Dryer Appliance Tool Graphic (Active during dry) -->
          <div id="bath-dryer-tool" class="absolute -left-16 sm:-left-24 top-2 text-5xl z-30 transition-all duration-300 pointer-events-none ${
            isBlowingDry ? 'opacity-100 translate-x-2 scale-110' : 'opacity-0 -translate-x-4 scale-90'
          }">
            <div class="relative">
              <span class="filter drop-shadow-[0_0_15px_rgba(52,152,219,0.9)]">💨</span>
              <div class="absolute -top-1 -right-2 w-3 h-3 bg-amber-400 rounded-full animate-ping"></div>
            </div>
          </div>

          <!-- Dynamic Falling / Floating Bubbles Layer -->
          <div id="bath-bubbles-container" class="absolute inset-0 pointer-events-none z-20 overflow-visible">
            <!-- Dynamic bubbles injected via script -->
          </div>

          <!-- Dynamic Blow Dry Wind Stream Trails Layer -->
          <div id="bath-wind-container" class="absolute inset-0 pointer-events-none z-20 overflow-visible">
            <!-- Dynamic wind stream streaks injected via script -->
          </div>

          <!-- Interactive Pet Avatar in the Tub -->
          <div id="bath-pet-target" class="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center relative cursor-pointer active:scale-95 transition-transform ${
            isBlowingDry ? 'animate-pet-fluff' : 'animate-float'
          }">
            
            <!-- Glow effect when completely finished -->
            ${
              isBathComplete
                ? `<div class="absolute inset-0 bg-primary/25 rounded-full filter blur-xl animate-pulse pointer-events-none"></div>`
                : ''
            }

            <!-- Pet Avatar Image -->
            <img id="bath-pet-img" class="w-full h-full object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.9)] select-none transition-transform duration-200" src="${
              activePet.avatar || activePet.image
            }" alt="${activePet.name}" />

            <!-- Foamy Suds Overlay on Pet -->
            <div id="bath-pet-suds" class="absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-500" style="opacity: ${foamOpacity}; transform: scale(${foamScale});">
              <div class="relative w-full h-full flex items-center justify-center">
                <!-- Head Suds -->
                <div class="absolute -top-2 bg-white/90 backdrop-blur-xs text-blue-500 text-xs font-black px-3 py-1 rounded-full shadow-md border border-cyan-200 flex items-center gap-1 animate-suds-wobble">
                  <span>🫧</span>
                  <span class="text-[10px] uppercase font-black text-cyan-700">Suds ${washProgress}%</span>
                  <span>🧼</span>
                </div>
                <!-- Body Suds Clusters -->
                <span class="absolute top-1/4 -left-2 text-2xl filter drop-shadow animate-bounce">🫧</span>
                <span class="absolute top-1/3 -right-2 text-3xl filter drop-shadow animate-pulse">🫧</span>
                <span class="absolute bottom-4 left-4 text-2xl filter drop-shadow animate-bounce">🫧</span>
                <span class="absolute bottom-6 right-4 text-3xl filter drop-shadow animate-pulse">🫧</span>
              </div>
            </div>

            <!-- Sparkle Shine Gleams when clean -->
            ${
              isFullyDried
                ? `
              <div class="absolute inset-0 pointer-events-none">
                <span class="absolute -top-3 left-4 text-2xl animate-sparkle-spin select-none">✨</span>
                <span class="absolute top-2 -right-3 text-3xl animate-sparkle-spin select-none" style="animation-delay: 0.4s;">⭐</span>
                <span class="absolute bottom-6 -left-3 text-2xl animate-sparkle-spin select-none" style="animation-delay: 0.8s;">🌟</span>
                <span class="absolute -bottom-2 right-6 text-3xl animate-sparkle-spin select-none" style="animation-delay: 1.2s;">✨</span>
              </div>
            `
                : ''
            }

            <!-- Pet Tap Ripple Ripple Hint -->
            <div class="absolute -bottom-4 bg-surface-container-lowest/80 backdrop-blur-sm text-[10px] font-black text-white/90 px-2.5 py-0.5 rounded-full border border-white/20 shadow pointer-events-none">
              Tap Pet to ${isFullyWashed ? 'Fluff' : 'Scrub'}
            </div>
          </div>

        </div>

        <!-- Bottom Tactile Action Buttons -->
        <div class="w-full z-10 pb-5 px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          
          <!-- BUTTON 1: Scrub Suds (Step 1) -->
          <button id="bath-scrub-btn" class="w-full sm:w-auto flex-1 max-w-xs ${
            isFullyWashed
              ? 'bg-surface-container-high text-primary border-primary/50'
              : 'bg-tertiary text-on-tertiary border-tertiary-container shadow-chunky-md hover:brightness-110'
          } font-headline text-base font-black py-4 px-6 rounded-2xl chunky-btn active:scale-95 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-2xl" style="font-variation-settings: 'FILL' 1;">
              ${isFullyWashed ? 'check_circle' : 'cleaning_services'}
            </span>
            <span>${isFullyWashed ? 'WASH COMPLETE! ✓' : `SCRUB SUDS! (${washProgress}%)`}</span>
          </button>

          <!-- BUTTON 2: Blow Dry (Step 2) -->
          <button id="bath-dry-btn" class="w-full sm:w-auto flex-1 max-w-xs ${
            !isFullyWashed
              ? 'bg-surface-container text-on-surface-variant/60 border-surface-container-highest opacity-70 cursor-not-allowed'
              : isFullyDried
              ? 'bg-surface-container-high text-primary border-primary/50'
              : 'bg-secondary text-on-secondary border-secondary-container shadow-chunky-md hover:brightness-110 animate-pulse'
          } font-headline text-base font-black py-4 px-6 rounded-2xl chunky-btn active:scale-95 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-2xl" style="font-variation-settings: 'FILL' 1;">
              ${isFullyDried ? 'verified' : 'air'}
            </span>
            <span>${isFullyDried ? 'DRY COMPLETE! ✓' : `BLOW DRY! (${dryProgress}%)`}</span>
          </button>

          <!-- BUTTON 3: Wash Again (Only when finished) -->
          ${
            isBathComplete
              ? `
            <button id="bath-again-btn" class="w-full sm:w-auto bg-primary text-on-primary font-headline text-xs font-black py-4 px-5 rounded-2xl chunky-btn border-primary-container shadow-chunky-sm flex items-center justify-center gap-1.5 active:scale-95 hover:brightness-110 animate-bounce">
              <span class="material-symbols-outlined text-base">replay</span>
              <span>Wash Again</span>
            </button>
          `
              : ''
          }

        </div>

      </div>

    </div>
  `;
}

// Spawns visual cascading soap bubbles falling over the pet
function spawnFallingBubbles() {
  const container = document.getElementById('bath-bubbles-container');
  if (!container) return;

  const bubbleEmojis = ['🫧', '🧼', '🫧', '🫧', '💧'];
  for (let i = 0; i < 14; i++) {
    const bubble = document.createElement('div');
    const size = Math.floor(Math.random() * 26) + 24; // 24px to 50px
    const startX = Math.floor(Math.random() * 80) + 10; // 10% to 90%
    const driftX = (Math.random() * 60 - 30).toFixed(0);
    const duration = (Math.random() * 0.9 + 1.6).toFixed(2);
    const delay = (Math.random() * 0.4).toFixed(2);

    bubble.className = 'absolute animate-bubble-fall cursor-pointer pointer-events-auto select-none flex items-center justify-center z-30 transition-transform active:scale-125';
    bubble.style.left = `${startX}%`;
    bubble.style.top = `-20px`;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.setProperty('--drift-x', `${driftX}px`);
    bubble.style.animationDuration = `${duration}s`;
    bubble.style.animationDelay = `${delay}s`;

    // Iridescent soap bubble sphere visual
    bubble.innerHTML = `
      <div class="w-full h-full rounded-full border border-white/60 shadow-lg relative overflow-hidden backdrop-blur-[1px]" style="background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.9) 0%, rgba(165, 243, 252, 0.5) 40%, rgba(56, 189, 248, 0.6) 75%, rgba(255, 255, 255, 0.8) 100%); box-shadow: inset 0 2px 4px rgba(255,255,255,0.9), 0 4px 10px rgba(0, 191, 255, 0.4);">
        <div class="absolute top-1 left-1.5 w-2 h-1.5 bg-white rounded-full rotate-[-30deg]"></div>
      </div>
    `;

    // Interactive: kids can tap bubbles to pop them!
    bubble.addEventListener('click', (e) => {
      e.stopPropagation();
      Sound.pop();
      poppedBubblesCount++;
      bubble.style.transform = 'scale(1.4)';
      bubble.style.opacity = '0';
      setTimeout(() => bubble.remove(), 120);
    });

    container.appendChild(bubble);

    // Remove after animation finishes
    setTimeout(() => {
      if (bubble.parentNode) bubble.remove();
    }, parseFloat(duration) * 1000 + 500);
  }
}

// Spawns sweeping wind gust streams blowing over the pet
function spawnWindGustStreams() {
  const container = document.getElementById('bath-wind-container');
  if (!container) return;

  for (let i = 0; i < 9; i++) {
    const stream = document.createElement('div');
    const startY = Math.floor(Math.random() * 70) + 15; // 15% to 85% vertical
    const duration = (Math.random() * 0.4 + 0.8).toFixed(2); // 0.8s to 1.2s
    const delay = (Math.random() * 0.35).toFixed(2);
    const height = Math.floor(Math.random() * 3) + 2; // 2px to 5px
    const width = Math.floor(Math.random() * 70) + 90; // 90px to 160px

    stream.className = 'absolute animate-wind-gust pointer-events-none z-30 select-none';
    stream.style.top = `${startY}%`;
    stream.style.left = `-50px`;
    stream.style.height = `${height}px`;
    stream.style.width = `${width}px`;
    stream.style.animationDuration = `${duration}s`;
    stream.style.animationDelay = `${delay}s`;

    // Glowing wind stream streak with warm breeze particles
    stream.innerHTML = `
      <div class="w-full h-full bg-gradient-to-r from-transparent via-cyan-200/90 to-transparent rounded-full filter blur-[0.4px] shadow-[0_0_12px_rgba(255,255,255,0.9)] flex items-center justify-end">
        <span class="text-[10px] text-white/80 filter drop-shadow">~</span>
      </div>
    `;

    container.appendChild(stream);

    setTimeout(() => {
      if (stream.parentNode) stream.remove();
    }, parseFloat(duration) * 1000 + 400);
  }
}

export function attachPetBathListeners() {
  if (!hasSpokenBathIntro && washProgress < 100) {
    hasSpokenBathIntro = true;
    speakRex("Splish splash! I'm all dirty! Pop the bubbles to clean me!");
  }

  // 1. Back to Pen Button
  const exitBtn = document.getElementById('bath-exit-btn');
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      hasSpokenBathIntro = false;
      Sound.click();
      store.navigate('pet_pen');
    });
  }

  // 2. Squeaky Rubber Ducky Toy
  const duckyBtn = document.getElementById('bath-ducky-btn');
  if (duckyBtn) {
    duckyBtn.addEventListener('click', () => {
      Sound.chirp();
      Sound.splash();
      confetti({
        particleCount: 15,
        spread: 40,
        origin: { y: 0.8, x: 0.25 },
        colors: ['#f1c40f', '#ffb961', '#3498db']
      });
      duckyBtn.classList.add('scale-125');
      setTimeout(() => duckyBtn.classList.remove('scale-125'), 180);
    });
  }

  // 3. Floating Soap Bar Toy
  const soapBtn = document.getElementById('bath-soap-btn');
  if (soapBtn) {
    soapBtn.addEventListener('click', () => {
      Sound.bubble();
      Sound.splash();
      spawnFallingBubbles();
      soapBtn.classList.add('rotate-12', 'scale-110');
      setTimeout(() => soapBtn.classList.remove('rotate-12', 'scale-110'), 200);
    });
  }

  // 4. Bath Sponge Toy
  const spongeBtn = document.getElementById('bath-sponge-btn');
  if (spongeBtn) {
    spongeBtn.addEventListener('click', () => {
      Sound.bubble();
      Sound.splash();
      spawnFallingBubbles();
      spongeBtn.classList.add('-rotate-12', 'scale-110');
      setTimeout(() => spongeBtn.classList.remove('-rotate-12', 'scale-110'), 200);
    });
  }

  // 5. Central Pet Interaction
  const petTarget = document.getElementById('bath-pet-target');
  if (petTarget) {
    petTarget.addEventListener('click', () => {
      if (washProgress < 100) {
        // Scrub lather
        handleScrubAction();
      } else if (dryProgress < 100) {
        // Blow dry fluff
        handleBlowDryAction();
      } else {
        // Pet is clean & happy
        Sound.chirp();
        Sound.fanfare();
        confetti({ particleCount: 25, spread: 50, origin: { y: 0.6 } });
      }
    });
  }

  // 6. SCRUB SUDS Action Button (Stage 1)
  const scrubBtn = document.getElementById('bath-scrub-btn');
  if (scrubBtn) {
    scrubBtn.addEventListener('click', () => {
      handleScrubAction();
    });
  }

  // 7. BLOW DRY Action Button (Stage 2)
  const dryBtn = document.getElementById('bath-dry-btn');
  if (dryBtn) {
    dryBtn.addEventListener('click', () => {
      handleBlowDryAction();
    });
  }

  // 8. Wash Again Button
  const againBtn = document.getElementById('bath-again-btn');
  if (againBtn) {
    againBtn.addEventListener('click', () => {
      hasSpokenBathIntro = false;
      washProgress = 0;
      dryProgress = 0;
      isRewardClaimed = false;
      Sound.click();
      store.notify();
    });
  }
}

// Handler for Scrubbing with bubbles & suds
function handleScrubAction() {
  if (washProgress >= 100) {
    // Already fully washed: guide kid to blow dry
    Sound.click();
    const guidance = document.getElementById('bath-guidance-text');
    if (guidance) {
      guidance.textContent = 'Sparky is 100% soaped up! Tap BLOW DRY to dry the fur and fluff up! 💨';
    }
    return;
  }

  isScrubbing = true;
  Sound.bubble();
  Sound.splash();
  spawnFallingBubbles();

  // Progress wash by 25% increments
  washProgress = Math.min(100, washProgress + 25);
  store.bathPetProgress(10); // incrementally raise hygiene stat

  // Gentle wiggle animation on pet
  const petImg = document.getElementById('bath-pet-img');
  if (petImg) {
    petImg.classList.add('rotate-3', 'scale-105');
    setTimeout(() => petImg.classList.remove('rotate-3', 'scale-105'), 180);
  }

  if (washProgress >= 100) {
    Sound.fanfare();
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#2ecc71', '#3498db', '#f1c40f']
    });
  }

  // Re-render UI state cleanly
  store.notify();
}

// Handler for Blow Drying with wind effect
function handleBlowDryAction() {
  if (washProgress < 100) {
    // Child must wash first!
    Sound.hit();
    const guidance = document.getElementById('bath-guidance-text');
    if (guidance) {
      guidance.textContent = 'Lather up with SCRUB SUDS first! Get the bubbles all over Sparky! 🧼';
    }
    return;
  }

  if (dryProgress >= 100) {
    Sound.click();
    return;
  }

  isBlowingDry = true;
  Sound.wind();
  spawnWindGustStreams();

  // Progress dry by 25% increments
  dryProgress = Math.min(100, dryProgress + 25);

  const dryerTool = document.getElementById('bath-dryer-tool');
  if (dryerTool) {
    dryerTool.classList.remove('opacity-0', '-translate-x-4');
    dryerTool.classList.add('opacity-100', 'translate-x-2');
  }

  // Check if fully washed AND fully dried: REWARD ISSUANCE
  if (washProgress >= 100 && dryProgress >= 100 && !isRewardClaimed) {
    isRewardClaimed = true;
    isBlowingDry = false;
    speakRex("All clean! Thank you, friend!");
    const activePet = store.getActivePet();
    // Issue reward ONLY now!
    store.completePetBathReward(activePet.id);
  } else {
    setTimeout(() => {
      isBlowingDry = false;
      store.notify();
    }, 450);
  }

  store.notify();
}
