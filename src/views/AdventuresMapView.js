import { store } from '../state/store.js';
import { ADVENTURE_GAMES } from '../data/learningGamesData.js';
import { Sound } from '../audio/sfx.js';

let activeGame = null;
let currentChallengeIdx = 0;

export function renderAdventuresMapView() {
  const state = store.getState();
  const activePet = store.getActivePet();

  if (activeGame) {
    const challenge = activeGame.challenges[currentChallengeIdx];
    return `
      <div class="max-w-2xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-5 animate-fade-in">
        
        <!-- Game Header -->
        <div class="flex items-center justify-between">
          <button id="game-exit-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm">
            <span class="material-symbols-outlined text-base">close</span> Exit Game
          </button>
          <div class="flex items-center gap-2">
            <span class="text-xs font-black uppercase text-secondary">${activeGame.subject}</span>
            <span class="bg-surface-container-high px-3 py-1 rounded-full text-xs font-bold text-primary">Challenge ${currentChallengeIdx + 1} / ${activeGame.challenges.length}</span>
          </div>
        </div>

        <!-- Mini Game Play Arena -->
        <div class="bg-surface-container rounded-3xl p-6 border-3 border-surface-container-highest card-shadow flex flex-col gap-6 text-center">
          
          <div class="flex items-center justify-center gap-2 text-secondary">
            <span class="material-symbols-outlined text-3xl">${activeGame.icon}</span>
            <h2 class="font-headline text-xl font-black text-inverse-surface">${activeGame.title}</h2>
          </div>

          <!-- Question Box -->
          <div class="bg-surface-container-lowest rounded-2xl p-6 border-2 border-surface-container-highest shadow-inner">
            <p class="font-headline text-lg sm:text-xl font-black text-primary leading-snug">
              ${challenge.question}
            </p>
          </div>

          <!-- Multiple Choice Options -->
          <div class="grid grid-cols-1 gap-3">
            ${challenge.options
              .map((opt, idx) => {
                return `
                <button data-opt-idx="${idx}" class="game-opt-btn bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-base font-black py-4 px-6 rounded-2xl border-2 border-surface-container-highest chunky-btn flex items-center justify-between active:scale-98">
                  <span>${opt}</span>
                  <span class="material-symbols-outlined text-primary text-xl opacity-0 group-hover:opacity-100">check_circle</span>
                </button>
              `;
              })
              .join('')}
          </div>

        </div>

      </div>
    `;
  }

  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in">
      
      <!-- Top Title & Pet Energy -->
      <div class="flex items-center justify-between">
        <button id="adv-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm">
          <span class="material-symbols-outlined text-base">arrow_back</span> Back to Pen
        </button>
        <div class="flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-full border-2 border-secondary-container">
          <span class="material-symbols-outlined text-secondary text-lg" style="font-variation-settings: 'FILL' 1;">bolt</span>
          <span class="font-headline text-xs font-black text-secondary">Pet Energy: ${activePet.energy}%</span>
        </div>
      </div>

      <div class="flex flex-col">
        <h1 class="font-headline text-2xl font-black text-inverse-surface text-shadow">Pet Adventures Map</h1>
        <p class="text-xs font-semibold text-on-surface-variant">6 Mini Learning Games (Phonics, Counting, Colors, Shapes, Memory, Words)</p>
      </div>

      <!-- 6 Games Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${ADVENTURE_GAMES.map((game) => {
          return `
            <div class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col justify-between gap-4">
              
              <div class="flex items-start gap-3.5">
                <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner border-2 border-surface-container-highest flex-shrink-0" style="background-color: ${game.color}20; color: ${game.color};">
                  <span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' 1;">${game.icon}</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-[10px] font-black uppercase text-secondary">${game.subject}</span>
                  <h3 class="font-headline text-base font-black text-inverse-surface leading-tight">${game.title}</h3>
                  <p class="text-xs text-on-surface-variant mt-1 line-clamp-2">${game.desc}</p>
                </div>
              </div>

              <!-- Energy & Play Action -->
              <div class="flex items-center justify-between pt-2 border-t border-surface-container-highest">
                <div class="flex items-center gap-2 text-xs font-black">
                  <span class="text-secondary flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-sm">bolt</span> ${game.energyCost} Energy
                  </span>
                  <span class="text-primary flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-sm">monetization_on</span> +${game.rewardCoins}
                  </span>
                </div>

                <button data-play-game-id="${game.id}" class="play-adventure-btn bg-primary text-on-primary font-headline text-xs font-black px-5 py-2.5 rounded-xl chunky-btn border-primary-container shadow-chunky-sm hover:brightness-110 active:scale-95">
                  Play!
                </button>
              </div>

            </div>
          `;
        }).join('')}
      </div>

    </div>
  `;
}

export function attachAdventuresMapListeners() {
  const backBtn = document.getElementById('adv-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => store.navigate('pet_pen'));
  }

  const exitBtn = document.getElementById('game-exit-btn');
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      activeGame = null;
      currentChallengeIdx = 0;
      store.notify();
    });
  }

  document.querySelectorAll('.play-adventure-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gId = btn.getAttribute('data-play-game-id');
      const game = ADVENTURE_GAMES.find((g) => g.id === gId);
      if (game) {
        const activePet = store.getActivePet();
        if (activePet.energy < game.energyCost) {
          Sound.hit();
          store.showReward('Pet Low on Energy!', 'Feed snacks or let your companion rest to restore energy!', 0, 0);
          return;
        }
        activeGame = game;
        currentChallengeIdx = 0;
        Sound.click();
        store.notify();
      }
    });
  });

  document.querySelectorAll('.game-opt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chosenIdx = parseInt(btn.getAttribute('data-opt-idx'));
      const challenge = activeGame.challenges[currentChallengeIdx];

      if (chosenIdx === challenge.answer) {
        Sound.fanfare();
        if (currentChallengeIdx + 1 < activeGame.challenges.length) {
          currentChallengeIdx++;
          store.notify();
        } else {
          // Finished all questions!
          const g = activeGame;
          activeGame = null;
          currentChallengeIdx = 0;
          store.playAdventureGame(g.id, true);
        }
      } else {
        Sound.hit();
        btn.classList.add('border-error', 'text-error');
        setTimeout(() => btn.classList.remove('border-error', 'text-error'), 400);
      }
    });
  });
}
