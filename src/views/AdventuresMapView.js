import { store } from '../state/store.js';
import { ADVENTURE_GAMES, getGameChallenges } from '../data/learningGamesData.js';
import { Sound } from '../audio/sfx.js';
import { geminiLiveService } from '../services/geminiLiveService.js';
import { renderRexAvatarSvg } from '../components/LiveRexWidget.js';
import { rexEngine } from '../services/rexCompanionEngine.js';
import { voicePrompts } from '../utils/voicePrompts.js';
import { speakRex } from '../services/voiceService.js';
import confetti from 'canvas-confetti';

let activeGame = null;
let currentChallengeIdx = 0;
let correctCount = 0;
let superMoveUsedForCurrentChallenge = false;
let victoryResults = null;

export function renderAdventuresMapView() {
  const state = store.getState();
  const hero = state.selectedHero;
  const activePet = store.getActivePet();
  const currentDiff = hero?.gameDifficulty || 'medium';

  // 1. VICTORY RESULTS OVERLAY
  if (victoryResults) {
    const { game, stars, coins, xp, sparks } = victoryResults;
    const stageAvatar = activePet.stage >= 3 && activePet.evolvedAvatar ? activePet.evolvedAvatar : activePet.avatar;

    return `
      <div class="max-w-md mx-auto px-4 pt-8 pb-28 flex flex-col items-center text-center gap-5 animate-fade-in select-none">
        
        <div class="bg-gradient-to-b from-[#16212b] to-[#09141e] border-4 border-amber-400 rounded-3xl p-6 sm:p-8 card-shadow-lg flex flex-col items-center gap-4 w-full relative overflow-hidden">
          
          <div class="absolute inset-0 bg-radial from-amber-400/20 via-primary/10 to-transparent pointer-events-none"></div>

          <!-- Stars Banner -->
          <div class="flex items-center gap-2 text-4xl sm:text-5xl text-amber-400 animate-bounce">
            ${[1, 2, 3].map(s => `
              <span class="drop-shadow-[0_4px_10px_rgba(241,196,15,0.7)] ${s <= stars ? 'opacity-100 scale-105' : 'opacity-30 grayscale'}">⭐</span>
            `).join('')}
          </div>

          <div class="flex flex-col gap-1 z-10">
            <span class="text-xs font-black uppercase text-amber-400 tracking-wider">Realm Mastered!</span>
            <h2 class="font-headline text-2xl sm:text-3xl font-black text-inverse-surface">${game.realm || game.title}</h2>
            <p class="text-xs font-bold text-on-surface-variant">Fantastic hero skills! You cleared all challenges!</p>
          </div>

          <!-- Companion Victory Render -->
          <div class="relative w-36 h-36 flex items-center justify-center animate-float my-1 z-10">
            <img class="w-full h-full object-contain drop-shadow-lg" src="${stageAvatar}" alt="${activePet.name}" />
          </div>

          <!-- Reward Pills -->
          <div class="grid grid-cols-3 gap-2 w-full z-10">
            <div class="bg-surface-container-high p-2 rounded-xl border border-surface-container-highest flex flex-col items-center">
              <span class="text-[9px] font-black text-on-surface-variant uppercase">Tokens</span>
              <span class="text-xs font-black text-secondary">+ ${coins} 🪙</span>
            </div>
            <div class="bg-surface-container-high p-2 rounded-xl border border-surface-container-highest flex flex-col items-center">
              <span class="text-[9px] font-black text-on-surface-variant uppercase">Hero XP</span>
              <span class="text-xs font-black text-primary">+ ${xp} ⭐</span>
            </div>
            <div class="bg-surface-container-high p-2 rounded-xl border border-surface-container-highest flex flex-col items-center">
              <span class="text-[9px] font-black text-on-surface-variant uppercase">Sparks</span>
              <span class="text-xs font-black text-amber-400">+ ${sparks} ⚡</span>
            </div>
          </div>

          <!-- Continue Button -->
          <button id="adv-victory-continue-btn" class="w-full bg-gradient-to-r from-primary to-primary-fixed text-on-primary font-headline text-base font-black py-4 rounded-2xl chunky-btn shadow-chunky-sm hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 z-10">
            <span class="material-symbols-outlined text-2xl">arrow_forward</span>
            CONTINUE ADVENTURES
          </button>

        </div>

      </div>
    `;
  }

  // 2. ACTIVE GAME CHALLENGE ARENA
  if (activeGame) {
    const challenges = getGameChallenges(activeGame, currentDiff);
    const challenge = challenges[currentChallengeIdx] || challenges[0];
    const companionAvatar = activePet.stage >= 3 && activePet.evolvedAvatar ? activePet.evolvedAvatar : activePet.avatar;
    const isToddler = currentDiff === 'easy';

    // Determine companion super move based on element
    const superMove = activePet.element?.toLowerCase().includes('earth') || activePet.name.toLowerCase().includes('rex')
      ? { title: "Titan Stomp", icon: "sports_kabaddi", desc: "Smashes 1 wrong choice!" }
      : activePet.element?.toLowerCase().includes('fire') || activePet.name.toLowerCase().includes('sparky')
      ? { title: "Blazing Insight", icon: "local_fire_department", desc: "Burns away 1 wrong choice!" }
      : { title: "Zen Breeze", icon: "air", desc: "Clears away 1 wrong choice!" };

    return `
      <div class="max-w-3xl mx-auto px-4 pt-3 pb-28 flex flex-col gap-4 animate-fade-in select-none">
        
        <!-- Game Top Bar -->
        <div class="flex items-center justify-between gap-2">
          <button id="game-exit-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
            <span class="material-symbols-outlined text-base">close</span> Exit
          </button>

          <!-- Difficulty Switcher Pills -->
          <div class="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-2xl border border-surface-container-highest">
            <button data-set-diff="easy" class="px-2.5 py-1 rounded-xl text-[10px] font-headline font-black transition-all ${
              currentDiff === 'easy' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }">
              🐣 Toddler (3-4)
            </button>
            <button data-set-diff="medium" class="px-2.5 py-1 rounded-xl text-[10px] font-headline font-black transition-all ${
              currentDiff === 'medium' ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }">
              🌟 Explorer (5-6)
            </button>
            <button data-set-diff="hard" class="px-2.5 py-1 rounded-xl text-[10px] font-headline font-black transition-all ${
              currentDiff === 'hard' ? 'bg-amber-500 text-black shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }">
              🚀 Master (7-9)
            </button>
          </div>

          <span class="bg-surface-container-high px-3 py-1.5 rounded-full text-xs font-black text-primary border border-surface-container-highest">
            ${currentChallengeIdx + 1} / ${challenges.length}
          </span>
        </div>

        <!-- INTEGRATED COMPANION & REX ARENA CO-PILOT -->
        <div class="bg-gradient-to-r from-emerald-500/15 via-surface-container to-amber-500/15 border-3 border-emerald-500/40 rounded-3xl p-4 flex flex-col gap-3 shadow-md relative overflow-hidden">
          
          <div class="flex items-center justify-between gap-3">
            
            <!-- Left: Companion & Co-Pilot Avatars -->
            <div class="flex items-center gap-3">
              <!-- Active Companion in Arena -->
              <div class="relative w-14 h-14 rounded-2xl bg-surface-container-high border-2 border-primary flex items-center justify-center p-1 shadow-md animate-float flex-shrink-0" title="${activePet.name} is helping!">
                <img class="w-full h-full object-contain" src="${companionAvatar}" alt="${activePet.name}" />
                <span class="absolute -bottom-1 -right-1 text-xs">⭐</span>
              </div>

              <!-- Rex Co-Pilot Face -->
              <div id="adv-arena-rex-face" class="w-12 h-12 rounded-2xl bg-surface-container-high border-2 border-emerald-400 flex items-center justify-center p-1 shadow-md relative flex-shrink-0 ${geminiLiveService.isSpeaking ? 'ring-4 ring-emerald-400' : ''}">
                ${renderRexAvatarSvg({ isListening: geminiLiveService.isListening, isSpeaking: geminiLiveService.isSpeaking, isThinking: false })}
              </div>

              <div class="flex flex-col text-left">
                <span class="font-headline text-xs font-black text-inverse-surface flex items-center gap-1.5">
                  ${activePet.name} & Rex
                  <span class="text-[9px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">Co-Pilots</span>
                </span>
                <p class="text-[11px] font-bold text-on-surface-variant">
                  ${isToddler ? 'Tap cards or use Super Move! Auto-read active.' : 'Work together to solve the challenge!'}
                </p>
              </div>
            </div>

            <!-- Companion Super Move Button -->
            <button id="companion-super-move-btn" class="px-3 py-2 rounded-2xl font-headline text-xs font-black flex items-center gap-1.5 chunky-btn-sm transition-all ${
              superMoveUsedForCurrentChallenge
                ? 'bg-surface-container text-on-surface-variant/40 border border-surface-container-highest cursor-default'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black border-2 border-amber-400 shadow-sm hover:brightness-110 active:scale-95 animate-pulse'
            }">
              <span class="material-symbols-outlined text-base">${superMove.icon}</span>
              <span>${superMove.title}</span>
            </button>

          </div>

          <!-- Dynamic Speech / Hint Bubble -->
          <div id="adv-rex-speech-bubble" class="bg-surface-container-lowest border-2 border-primary/30 rounded-2xl p-2.5 text-xs font-bold text-inverse-surface flex items-start gap-2 shadow-inner">
            <span class="text-base flex-shrink-0">💬</span>
            <span id="adv-rex-speech-text" class="flex-1">
              ${challenge.hint ? `Hint: ${challenge.hint}` : 'Rex says: You got this hero! Pick your best answer!'}
            </span>
          </div>

          <!-- Action Bar (Read Aloud & Rex Hint) -->
          <div class="flex items-center gap-2 pt-1 border-t border-surface-container-highest">
            <button id="adv-speak-question-btn" class="bg-surface-container-high hover:bg-surface-bright text-sky-400 font-headline text-xs font-black py-1.5 px-3 rounded-xl border border-sky-500/30 flex items-center gap-1 chunky-btn-sm active:scale-95">
              <span class="material-symbols-outlined text-sm">volume_up</span> Read Aloud
            </button>
            <button id="adv-rex-hint-btn" class="bg-surface-container-high hover:bg-surface-bright text-secondary font-headline text-xs font-black py-1.5 px-3 rounded-xl border border-secondary/30 flex items-center gap-1 chunky-btn-sm active:scale-95">
              <span class="text-sm">💡</span> Clue
            </button>
          </div>

        </div>

        <!-- Mini Game Play Arena -->
        <div class="bg-surface-container rounded-3xl p-5 sm:p-6 border-3 border-surface-container-highest card-shadow flex flex-col gap-5 text-center">
          
          <div class="flex items-center justify-center gap-2 text-secondary">
            <span class="material-symbols-outlined text-3xl">${activeGame.icon}</span>
            <h2 class="font-headline text-lg sm:text-xl font-black text-inverse-surface">${activeGame.title}</h2>
          </div>

          <!-- Question Box -->
          <div class="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border-2 border-surface-container-highest shadow-inner">
            <p class="font-headline text-lg sm:text-xl font-black text-primary leading-snug">
              ${challenge.question}
            </p>
          </div>

          <!-- Multiple Choice Options (Large, forgiving buttons) -->
          <div class="grid grid-cols-1 sm:grid-cols- ${challenge.options.length > 2 ? '3' : '2'} gap-3" id="adv-game-options-container">
            ${challenge.options
              .map((opt, idx) => {
                return `
                <button data-opt-idx="${idx}" class="game-opt-btn relative overflow-hidden bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-base sm:text-lg font-black py-4 sm:py-5 px-5 rounded-2xl border-2 border-surface-container-highest chunky-btn flex items-center justify-between active:scale-98 transition-all">
                  <span class="adv-opt-label text-left">${opt}</span>
                  <div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant font-black text-xs border border-surface-container-highest flex-shrink-0">
                    ${String.fromCharCode(65 + idx)}
                  </div>
                </button>
              `;
              })
              .join('')}
          </div>

        </div>

      </div>
    `;
  }

  // 3. ADVENTURES WORLD MAP (Realm Picker)
  // Filter to 5 primary realms for clean presentation
  const primaryRealms = ADVENTURE_GAMES.filter(g => ['phonics_forest', 'number_galaxy', 'shape_kingdom', 'emotion_safari', 'science_lab'].includes(g.id));

  return `
    <div class="max-w-5xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in select-none">
      
      <!-- Top Title & Companion Energy -->
      <div class="flex items-center justify-between">
        <button id="adv-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm">
          <span class="material-symbols-outlined text-base">arrow_back</span> Back to Pen
        </button>
        
        <div class="flex items-center gap-3">
          <!-- Companion Energy -->
          <div class="flex items-center gap-2 bg-surface-container-high px-3.5 py-1.5 rounded-full border-2 border-secondary-container shadow-sm">
            <span class="material-symbols-outlined text-secondary text-base" style="font-variation-settings: 'FILL' 1;">bolt</span>
            <span class="font-headline text-xs font-black text-secondary">${activePet.name}: ${activePet.energy}% Energy</span>
          </div>
        </div>
      </div>

      <!-- Header Hero Banner -->
      <div class="flex flex-col gap-1">
        <span class="text-[10px] font-black uppercase tracking-widest text-primary">Interactive Learning World</span>
        <h1 class="font-headline text-2xl sm:text-3xl font-black text-inverse-surface text-shadow">Pet Adventures Map</h1>
        <p class="text-xs font-bold text-on-surface-variant">
          5 Core Learning Realms • Earn Habit Tokens 🪙, Hero XP ⭐, and Evolution Sparks ⚡!
        </p>
      </div>

      <!-- 5 Learning Realms Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${primaryRealms.map((game) => {
          const mastery = store.getGameMastery(game.id);
          const stars = mastery.stars || 0;

          return `
            <div class="bg-surface-container rounded-3xl p-5 border-3 border-surface-container-highest card-shadow flex flex-col justify-between gap-4 hover:border-primary/40 transition-all">
              
              <div>
                <!-- Top Badge & Stars -->
                <div class="flex items-center justify-between pb-3 border-b border-surface-container-highest">
                  <span class="text-[10px] font-black uppercase text-secondary bg-surface-container-high px-2.5 py-0.5 rounded-full">
                    ${game.subject}
                  </span>
                  
                  <div class="flex items-center gap-0.5 text-sm text-amber-400">
                    ${[1, 2, 3].map(s => `
                      <span class="${s <= stars ? 'opacity-100 drop-shadow' : 'opacity-25 grayscale'}">⭐</span>
                    `).join('')}
                  </div>
                </div>

                <!-- Realm Header Info -->
                <div class="flex items-start gap-3.5 mt-3.5">
                  <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner border-2 border-surface-container-highest flex-shrink-0" style="background-color: ${game.color}20; color: ${game.color};">
                    <span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' 1;">${game.icon}</span>
                  </div>
                  <div class="flex flex-col">
                    <h3 class="font-headline text-base font-black text-inverse-surface leading-tight">${game.title}</h3>
                    <p class="text-xs text-on-surface-variant mt-1 line-clamp-2">${game.desc}</p>
                  </div>
                </div>
              </div>

              <!-- Energy & Play Action -->
              <div class="flex items-center justify-between pt-2 border-t border-surface-container-highest">
                <div class="flex items-center gap-2 text-xs font-black">
                  <span class="text-secondary flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-sm">bolt</span> ${game.energyCost}
                  </span>
                  <span class="text-primary flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-sm">monetization_on</span> +${game.rewardCoins}
                  </span>
                  <span class="text-amber-400 flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-sm">auto_awesome</span> +10⚡
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

  // Victory continue button
  const victoryBtn = document.getElementById('adv-victory-continue-btn');
  if (victoryBtn) {
    victoryBtn.addEventListener('click', () => {
      Sound.click();
      victoryResults = null;
      activeGame = null;
      store.notify();
    });
  }

  // Game exit button
  const exitBtn = document.getElementById('game-exit-btn');
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      voicePrompts.stop();
      activeGame = null;
      currentChallengeIdx = 0;
      correctCount = 0;
      superMoveUsedForCurrentChallenge = false;
      store.notify();
    });
  }

  // Difficulty Toggle in Game
  document.querySelectorAll('[data-set-diff]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const newDiff = btn.getAttribute('data-set-diff');
      store.setGameDifficulty(newDiff);
      currentChallengeIdx = 0;
      correctCount = 0;
      superMoveUsedForCurrentChallenge = false;
      store.notify();
    });
  });

  // Read Aloud button
  const readBtn = document.getElementById('adv-speak-question-btn');
  if (readBtn && activeGame) {
    readBtn.addEventListener('click', () => {
      const challenges = getGameChallenges(activeGame, store.getState().selectedHero?.gameDifficulty || 'medium');
      const challenge = challenges[currentChallengeIdx] || challenges[0];
      Sound.pop();
      speakRex(challenge.question);
    });
  }

  // Clue / Hint button
  const hintBtn = document.getElementById('adv-rex-hint-btn');
  if (hintBtn && activeGame) {
    hintBtn.addEventListener('click', () => {
      const challenges = getGameChallenges(activeGame, store.getState().selectedHero?.gameDifficulty || 'medium');
      const challenge = challenges[currentChallengeIdx] || challenges[0];
      Sound.chirp();
      speakRex(challenge.hint || "Look closely at the pictures and symbols!");
    });
  }

  // Companion Super Move Button (Removes a wrong option)
  const superMoveBtn = document.getElementById('companion-super-move-btn');
  if (superMoveBtn && activeGame) {
    superMoveBtn.addEventListener('click', () => {
      if (superMoveUsedForCurrentChallenge) return;
      superMoveUsedForCurrentChallenge = true;

      const challenges = getGameChallenges(activeGame, store.getState().selectedHero?.gameDifficulty || 'medium');
      const challenge = challenges[currentChallengeIdx] || challenges[0];
      const correctIdx = challenge.answer;

      const optBtns = Array.from(document.querySelectorAll('.game-opt-btn'));
      const wrongBtns = optBtns.filter((b) => {
        const idx = parseInt(b.getAttribute('data-opt-idx'), 10);
        return idx !== correctIdx && !b.classList.contains('pointer-events-none');
      });

      if (wrongBtns.length > 0) {
        Sound.hit();
        Sound.sparkle();
        const targetBtn = wrongBtns[0];
        targetBtn.classList.add('opacity-30', 'line-through', 'pointer-events-none');

        const bubbleText = document.getElementById('adv-rex-speech-text');
        if (bubbleText) {
          bubbleText.innerText = `${store.getActivePet().name} used their Super Move! That wrong choice is cleared! ✨`;
        }
        speakRex("Super Move power! That choice is out of the way!");
      }
      store.notify();
    });
  }

  // Play Game triggers from map
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

        // Deduct energy
        const hero = store.getState().selectedHero;
        const petId = hero?.activePetId || 1;
        if (store.getState().petStatsMap[petId]) {
          store.getState().petStatsMap[petId].energy = Math.max(0, (store.getState().petStatsMap[petId].energy || 50) - game.energyCost);
        }

        activeGame = game;
        currentChallengeIdx = 0;
        correctCount = 0;
        superMoveUsedForCurrentChallenge = false;
        Sound.click();
        store.notify();

        // Auto read-aloud for toddlers on initial load
        if (hero?.gameDifficulty === 'easy') {
          setTimeout(() => {
            const challenges = getGameChallenges(game, 'easy');
            if (challenges[0]) speakRex(challenges[0].question);
          }, 350);
        }
      }
    });
  });

  // Multiple Choice Option selection
  document.querySelectorAll('.game-opt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!activeGame) return;
      const challenges = getGameChallenges(activeGame, store.getState().selectedHero?.gameDifficulty || 'medium');
      const challenge = challenges[currentChallengeIdx] || challenges[0];
      const chosenIdx = parseInt(btn.getAttribute('data-opt-idx'), 10);
      const isToddler = (store.getState().selectedHero?.gameDifficulty || 'medium') === 'easy';

      if (chosenIdx === challenge.answer) {
        correctCount++;
        Sound.chirp();
        Sound.fanfare();
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });

        btn.classList.add('border-primary', 'bg-primary/20');

        setTimeout(() => {
          if (currentChallengeIdx + 1 < challenges.length) {
            currentChallengeIdx++;
            superMoveUsedForCurrentChallenge = false;
            store.notify();

            if (isToddler) {
              const nextChallenge = challenges[currentChallengeIdx];
              if (nextChallenge) speakRex(nextChallenge.question);
            }
          } else {
            // Completed all challenges in realm!
            const g = activeGame;
            const res = store.completeAdventureGame(g.id, correctCount, challenges.length);
            victoryResults = {
              game: g,
              stars: res.stars,
              coins: res.coins,
              xp: res.xp,
              sparks: res.sparks
            };
            activeGame = null;
            currentChallengeIdx = 0;
            correctCount = 0;
            superMoveUsedForCurrentChallenge = false;
            store.notify();
            speakRex(`Incredible job! You mastered ${g.realm || g.title}!`);
          }
        }, 500);

      } else {
        Sound.boing();
        btn.classList.add('border-error', 'text-error', 'animate-shake');
        setTimeout(() => btn.classList.remove('border-error', 'text-error', 'animate-shake'), 600);

        if (isToddler) {
          speakRex("Almost! Let's try another picture!");
        }
      }
    });
  });
}
