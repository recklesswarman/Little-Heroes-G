import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';

let isDancing = false;

export function renderDancePartyView() {
  const state = store.getState();

  return `
    <div class="max-w-3xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-5 animate-fade-in">
      
      <!-- Top Title & Navigation -->
      <div class="flex items-center justify-between">
        <button id="dance-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3 py-2 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1 chunky-btn-sm">
          <span class="material-symbols-outlined text-base">arrow_back</span> Back
        </button>
        <h1 class="font-headline text-xl font-black text-secondary text-shadow">Dance Party!</h1>
        <div class="bg-surface-container-high px-3 py-1 rounded-full text-xs font-black text-secondary border border-secondary-container/40 flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">music_note</span> Rhythm Mode
        </div>
      </div>

      <!-- Disco Dance Floor Arena -->
      <div id="dance-floor" class="relative bg-gradient-to-b from-[#131b26] via-[#10202e] to-[#09141e] rounded-3xl p-6 border-4 border-secondary/40 min-h-[380px] card-shadow flex flex-col justify-between items-center overflow-hidden select-none">
        
        <!-- Spotlights Overlay -->
        <div class="absolute inset-0 bg-gradient-to-t from-secondary/15 via-transparent to-primary/10 pointer-events-none"></div>

        <!-- Disco Grid Tiles -->
        <div class="w-full flex justify-between items-center z-10">
          <span class="bg-surface-container-highest/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-primary flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">speaker</span> Synth Beat Groove
          </span>
          <span class="bg-surface-container-highest/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-secondary flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">celebration</span> Party Streaks: ${state.selectedHero.streak} Days
          </span>
        </div>

        <!-- Dancing Duo Character Visuals -->
        <div class="relative my-4 z-10 flex items-center justify-center gap-6">
          
          <!-- Hero Dancing Silhouette / Avatar -->
          <div id="dancing-hero" class="w-24 h-24 rounded-3xl bg-primary-container/30 border-4 border-primary flex items-center justify-center text-4xl font-headline font-black text-on-primary shadow-xl ${
            isDancing ? 'animate-bounce' : 'animate-float'
          }">
            🕺
          </div>

          <!-- Dragon Pet Dancing -->
          <div id="dancing-pet" class="w-32 h-32 rounded-full bg-tertiary-container/30 border-4 border-tertiary flex items-center justify-center text-5xl shadow-2xl ${
            isDancing ? 'animate-bounce' : 'animate-float'
          }">
            🐉
          </div>

        </div>

        <!-- Disco Floor Light Grid -->
        <div class="w-full max-w-sm grid grid-cols-6 gap-2 z-10 p-2 bg-surface-container-lowest/80 rounded-2xl border-2 border-surface-container-highest">
          <div class="h-4 rounded-lg bg-primary animate-pulse"></div>
          <div class="h-4 rounded-lg bg-secondary animate-pulse" style="animation-delay: 100ms;"></div>
          <div class="h-4 rounded-lg bg-tertiary animate-pulse" style="animation-delay: 200ms;"></div>
          <div class="h-4 rounded-lg bg-error animate-pulse" style="animation-delay: 300ms;"></div>
          <div class="h-4 rounded-lg bg-primary-fixed animate-pulse" style="animation-delay: 400ms;"></div>
          <div class="h-4 rounded-lg bg-secondary-fixed animate-pulse" style="animation-delay: 500ms;"></div>
        </div>
      </div>

      <!-- Party DJ Controls -->
      <section class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <!-- Music Toggle -->
        <button id="dance-music-btn" class="w-full sm:w-1/2 ${
          isDancing ? 'bg-error text-on-error border-error-container' : 'bg-primary text-on-primary border-primary-container'
        } font-headline font-black text-sm py-4 rounded-2xl chunky-btn flex items-center justify-center gap-2 active:scale-95">
          <span class="material-symbols-outlined text-2xl">${isDancing ? 'stop' : 'play_arrow'}</span>
          ${isDancing ? 'STOP DISCO BEAT' : 'START DISCO BEAT!'}
        </button>

        <!-- Confetti Cannon -->
        <button id="dance-confetti-btn" class="w-full sm:w-1/2 bg-secondary text-on-secondary font-headline font-black text-sm py-4 rounded-2xl chunky-btn border-secondary-container flex items-center justify-center gap-2 active:scale-95">
          <span class="material-symbols-outlined text-2xl">celebration</span>
          FIRE CONFETTI!
        </button>

      </section>

    </div>
  `;
}

export function attachDancePartyListeners() {
  const backBtn = document.getElementById('dance-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      Sound.stopDisco();
      isDancing = false;
      store.navigate('dashboard');
    });
  }

  const musicBtn = document.getElementById('dance-music-btn');
  if (musicBtn) {
    musicBtn.addEventListener('click', () => {
      if (isDancing) {
        Sound.stopDisco();
        isDancing = false;
      } else {
        isDancing = true;
        Sound.startDisco((step) => {
          const hero = document.getElementById('dancing-hero');
          const pet = document.getElementById('dancing-pet');
          if (hero && pet) {
            hero.style.transform = step % 2 === 0 ? 'translateY(-12px) rotate(4deg)' : 'translateY(0px) rotate(-4deg)';
            pet.style.transform = step % 2 === 0 ? 'translateY(-14px) rotate(-6deg)' : 'translateY(0px) rotate(6deg)';
          }
        });
      }
      store.notify();
    });
  }

  const confettiBtn = document.getElementById('dance-confetti-btn');
  if (confettiBtn) {
    confettiBtn.addEventListener('click', () => {
      Sound.fanfare();
      confetti({
        particleCount: 100,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#2ecc71', '#ffb961', '#3498db', '#f1c40f', '#ff5252']
      });
      store.getState().selectedHero.coins += 5;
      store.saveState();
    });
  }
}
