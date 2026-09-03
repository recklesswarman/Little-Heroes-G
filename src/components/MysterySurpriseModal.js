import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { speakRex } from '../services/voiceService.js';
import confetti from 'canvas-confetti';

let currentTaps = 0;
let isRevealed = false;
let hasPlayedRevealAudio = false;

export function renderMysterySurpriseModal() {
  const surprise = store.getState().mysterySurprise;
  if (!surprise || !surprise.isOpen) {
    currentTaps = 0;
    isRevealed = false;
    hasPlayedRevealAudio = false;
    return '';
  }

  const isEgg = surprise.type === 'egg';
  const remainingTaps = Math.max(0, 5 - currentTaps);
  const progressPercent = Math.min(100, Math.round((currentTaps / 5) * 100));

  // Visual crack intensity levels (0 to 5)
  const crackLevel = Math.min(5, currentTaps);

  return `
    <div id="mystery-surprise-backdrop" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-xl animate-fade-in select-none overflow-hidden">
      
      <!-- Magical Ambient Ray Lights & Aura -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div class="w-[600px] h-[600px] rounded-full ${
          isEgg ? 'bg-primary/20' : 'bg-secondary/25'
        } blur-3xl animate-pulse pointer-events-none"></div>
        <div class="absolute w-[350px] h-[350px] rounded-full ${
          isEgg ? 'bg-emerald-400/20' : 'bg-amber-400/25'
        } blur-2xl animate-spin" style="animation-duration: 20s;"></div>
      </div>

      <!-- Flash overlay on final crack -->
      <div id="mystery-crack-flash" class="absolute inset-0 bg-white opacity-0 pointer-events-none transition-opacity duration-300 z-40"></div>

      <!-- Modal Card -->
      <div class="relative z-20 w-full max-w-lg bg-surface-container rounded-3xl p-6 sm:p-8 border-4 ${
        isEgg ? 'border-primary' : 'border-secondary'
      } shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col items-center text-center gap-5">
        
        <!-- Header Badge -->
        <div class="flex flex-col items-center gap-1.5">
          <span class="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
            isEgg
              ? 'bg-primary/20 text-primary border border-primary/40'
              : 'bg-secondary/20 text-secondary border border-secondary/40'
          }">
            <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">
              ${isEgg ? 'egg' : 'inventory_2'}
            </span>
            ${isEgg ? 'Mystery Companion Egg' : 'Mystery Treasure Chest'}
          </span>

          <h2 class="font-headline text-2xl sm:text-3xl font-black text-inverse-surface text-shadow mt-1">
            ${
              isRevealed
                ? (isEgg ? 'Hatched Successfully! 🐣' : 'Treasure Unlocked! 💎')
                : (isEgg ? 'Tap to Hatch the Egg!' : 'Tap to Crack the Chest!')
            }
          </h2>

          <p class="text-xs sm:text-sm font-bold text-on-surface-variant max-w-xs">
            ${
              isRevealed
                ? (isEgg ? 'Your new companion has emerged and is ready for adventures!' : 'Your digital gear is ready to equip in your hero locker!')
                : 'Rapidly tap 5 times to crack it open with light bursts and magical energy!'
            }
          </p>
        </div>

        ${
          !isRevealed
            ? `
          <!-- UNOPENED STATE: INTERACTIVE MYSTERY TARGET -->
          <div class="flex flex-col items-center gap-4 my-2">
            
            <!-- Tap Counter Progress Indicators -->
            <div class="flex items-center gap-2">
              ${[1, 2, 3, 4, 5]
                .map(
                  (step) => `
                <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${
                  currentTaps >= step
                    ? (isEgg ? 'bg-primary text-on-primary scale-110 shadow-lg shadow-primary/40' : 'bg-secondary text-on-secondary scale-110 shadow-lg shadow-secondary/40')
                    : 'bg-surface-container-highest text-on-surface-variant/60 border border-surface-bright'
                }">
                  ${currentTaps >= step ? '✓' : step}
                </div>
              `
                )
                .join('')}
            </div>

            <div id="mystery-taps-hint" class="font-headline text-xs font-black uppercase tracking-wider ${
              isEgg ? 'text-primary' : 'text-secondary'
            } animate-pulse">
              ${remainingTaps} Tap${remainingTaps === 1 ? '' : 's'} Remaining!
            </div>

            <!-- Big Clickable Egg / Chest Object -->
            <div id="mystery-tap-target" class="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center cursor-pointer group active:scale-95 transition-transform duration-100">
              
              <!-- Radiant Aura Rings -->
              <div class="absolute inset-0 rounded-full ${
                isEgg ? 'bg-gradient-to-tr from-primary/30 to-cyan-400/20' : 'bg-gradient-to-tr from-secondary/30 to-amber-300/20'
              } blur-xl animate-pulse pointer-events-none"></div>

              <!-- Main Visual Icon / Graphic -->
              <div id="mystery-target-core" class="relative z-10 w-40 h-40 sm:w-48 sm:h-48 rounded-3xl ${
                isEgg
                  ? 'bg-gradient-to-b from-primary/35 via-emerald-950 to-primary/20 border-4 border-primary/60'
                  : 'bg-gradient-to-b from-secondary/35 via-amber-950 to-secondary/20 border-4 border-secondary/60'
              } flex flex-col items-center justify-center shadow-2xl transition-all duration-150 group-hover:scale-105 select-none">
                
                <span class="material-symbols-outlined ${
                  isEgg ? 'text-7xl sm:text-8xl text-primary' : 'text-7xl sm:text-8xl text-secondary'
                } drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)]" style="font-variation-settings: 'FILL' 1;">
                  ${isEgg ? 'egg' : 'inventory_2'}
                </span>

                <!-- Crack overlays based on crackLevel -->
                ${
                  crackLevel > 0
                    ? `
                  <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <svg class="w-full h-full p-4 drop-shadow-[0_0_8px_${isEgg ? 'rgba(84,233,138,0.9)' : 'rgba(255,185,97,0.9)'}]" viewBox="0 0 100 100" fill="none" stroke="${isEgg ? '#54e98a' : '#ffb961'}" stroke-width="${1.5 + crackLevel * 0.8}">
                      ${crackLevel >= 1 ? '<path d="M50 20 L48 35 L55 42 L50 55" stroke-linecap="round"/>' : ''}
                      ${crackLevel >= 2 ? '<path d="M55 42 L68 45 L72 60" stroke-linecap="round"/>' : ''}
                      ${crackLevel >= 3 ? '<path d="M48 35 L32 40 L28 58" stroke-linecap="round"/>' : ''}
                      ${crackLevel >= 4 ? '<path d="M50 55 L45 70 L55 85 M68 45 L80 50" stroke-linecap="round"/>' : ''}
                    </svg>
                  </div>
                `
                    : ''
                }

                <!-- Leaking Light Rays -->
                ${
                  crackLevel >= 3
                    ? `
                  <div class="absolute inset-0 bg-radial from-white/30 via-transparent to-transparent animate-ping pointer-events-none"></div>
                `
                    : ''
                }
              </div>

              <!-- Floating Action Prompt -->
              <div class="absolute -bottom-3 bg-inverse-surface text-inverse-on-surface font-headline text-[10px] sm:text-xs font-black uppercase px-3 py-1 rounded-full border-2 ${
                isEgg ? 'border-primary text-primary' : 'border-secondary text-secondary'
              } shadow-lg pointer-events-none flex items-center gap-1 animate-bounce">
                <span>👆</span> TAP RAPIDLY!
              </div>

            </div>

          </div>
        `
            : `
          <!-- REVEALED STATE: SHOW ITEM & EQUIP BUTTON -->
          <div class="flex flex-col items-center gap-5 w-full animate-fade-in my-2">
            
            <!-- Glowing Item Stage -->
            <div class="relative w-40 h-40 sm:w-48 sm:h-48 rounded-3xl bg-surface-container-high border-4 ${
              isEgg ? 'border-primary' : 'border-secondary'
            } flex items-center justify-center p-4 shadow-2xl relative overflow-hidden group">
              
              <!-- Sunburst Background -->
              <div class="absolute inset-0 bg-radial from-white/20 via-transparent to-transparent pointer-events-none animate-pulse"></div>

              ${
                surprise.image
                  ? `
                <img class="w-full h-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] animate-bounce" src="${surprise.image}" alt="${surprise.title}" />
              `
                  : `
                <span class="material-symbols-outlined text-7xl ${isEgg ? 'text-primary' : 'text-secondary'} animate-bounce" style="font-variation-settings: 'FILL' 1;">
                  ${surprise.icon || 'military_tech'}
                </span>
              `
              }
            </div>

            <!-- Item Details -->
            <div class="flex flex-col items-center gap-1.5 max-w-sm">
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-black uppercase ${isEgg ? 'text-primary' : 'text-secondary'} tracking-wider">
                  ${surprise.category || 'Digital Reward'}
                </span>
                ${
                  surprise.statBonusPercent
                    ? `
                  <span class="text-[10px] font-black uppercase text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                    +${surprise.statBonusPercent}% Boost
                  </span>
                `
                    : ''
                }
              </div>

              <h3 class="font-headline text-xl sm:text-2xl font-black text-inverse-surface leading-tight">
                ${surprise.title}
              </h3>

              <p class="text-xs text-on-surface-variant font-medium">
                ${surprise.desc || 'Equipped and unlocked in your hero collection!'}
              </p>
            </div>

            <!-- Claim / Equip Call to Action -->
            <button id="mystery-claim-reward-btn" class="w-full py-4 rounded-2xl font-headline text-base sm:text-lg font-black text-on-primary ${
              isEgg ? 'bg-primary text-on-primary hover:brightness-110' : 'bg-secondary text-on-secondary hover:brightness-110'
            } chunky-btn shadow-chunky flex items-center justify-center gap-2 active:scale-95 transition-all">
              <span class="material-symbols-outlined text-2xl">check_circle</span>
              CLAIM & EQUIP NOW!
            </button>

          </div>
        `
        }

      </div>
    </div>
  `;
}

export function attachMysterySurpriseModalListeners() {
  const backdrop = document.getElementById('mystery-surprise-backdrop');
  if (!backdrop) return;

  const target = document.getElementById('mystery-tap-target');
  const claimBtn = document.getElementById('mystery-claim-reward-btn');

  // Handle rapid tap on egg/chest
  if (target && !isRevealed) {
    target.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      currentTaps++;

      const core = document.getElementById('mystery-target-core');
      const flash = document.getElementById('mystery-crack-flash');
      const surprise = store.getState().mysterySurprise;

      // Cartoon squash, shake & wobble on each tap
      if (core) {
        core.style.transform = `scale(1.15) rotate(${currentTaps % 2 === 0 ? '-6deg' : '6deg'})`;
        setTimeout(() => {
          if (core) core.style.transform = 'scale(1) rotate(0deg)';
        }, 120);
      }

      if (currentTaps < 5) {
        // Light bursts & sound feedback on taps 1-4
        if (currentTaps === 1) Sound.bloop();
        else if (currentTaps === 2) Sound.bubble();
        else if (currentTaps === 3) {
          Sound.boing();
          if (store.isEasyMode()) {
            speakRex("Keep tapping! It's cracking open!");
          }
        } else if (currentTaps === 4) {
          Sound.hit();
        }

        // Brief particle sparks on each tap
        confetti({
          particleCount: 15,
          spread: 45,
          origin: {
            x: e.clientX ? e.clientX / window.innerWidth : 0.5,
            y: e.clientY ? e.clientY / window.innerHeight : 0.5
          },
          colors: surprise?.type === 'egg' ? ['#54e98a', '#3498db', '#ffffff'] : ['#ffb961', '#f1c40f', '#ffffff']
        });

        // Re-render tap state
        store.notify();
      } else {
        // 5TH TAP: CRACK OPEN & REVEAL!
        isRevealed = true;

        // Visual white flash
        if (flash) {
          flash.style.opacity = '0.9';
          setTimeout(() => {
            if (flash) flash.style.opacity = '0';
          }, 350);
        }

        // Audio & Confetti burst
        Sound.taskCompleteFanfare();
        Sound.sparkle();
        Sound.coin();

        confetti({
          particleCount: 120,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#54e98a', '#ffb961', '#3498db', '#f1c40f', '#e74c3c']
        });

        // Rex celebration speech
        if (!hasPlayedRevealAudio) {
          hasPlayedRevealAudio = true;
          if (surprise?.type === 'egg') {
            speakRex("Hooray! The egg hatched! Welcome your new companion! Super hero power!");
          } else {
            speakRex("Yay! Mystery treasure unlocked! Look at that awesome gear! Super hero power!");
          }
        }

        store.notify();
      }
    });
  }

  // Claim button on revealed item
  if (claimBtn) {
    claimBtn.addEventListener('click', () => {
      Sound.sparkle();
      Sound.coin();
      store.closeMysterySurprise();
    });
  }
}
