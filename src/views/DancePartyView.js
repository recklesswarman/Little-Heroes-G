import { store } from '../state/store.js';
import { PETS_DATABASE } from '../data/petsData.js';
import { ADVENTURE_GAMES, getGameChallenges } from '../data/learningGamesData.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import { voicePrompts } from '../utils/voicePrompts.js';

// Helper to reliably get the pet's graphic
export function getPetDisplayAvatar(pet) {
  if (!pet) return PETS_DATABASE[0].avatar;
  if (pet.stage >= 3 && pet.evolvedAvatar) return pet.evolvedAvatar;
  return pet.avatar || pet.image || PETS_DATABASE[0].avatar;
}

// Arcade State Machine
let arcadeMode = 'hub'; // 'hub', 'treat_catch', 'memory_match', 'learning_game', 'disco_party'

// 1. Treat Popper State
let treatScore = 0;
let treatTimeLeft = 20;
let treatTimer = null;
let treatItems = [];
let treatGameActive = false;

// 2. Memory Match State
let memoryCards = [];
let flippedCardIdxs = [];
let matchedCardIds = [];
let memoryWon = false;

// 3. Learning Academy State
let selectedLearningGame = null;
let currentChallengeIdx = 0;
let learningScore = 0;

// 4. Disco Party State
let isDancing = false;
let discoStep = 0;

// Pet Companion Interaction State
let petMood = 'Happy';
let petSpeech = 'Hi Hero! Tap me or pick a game below to play and level up together!';
let petAnimation = 'animate-bounce-slow';
let petHearts = false;

export function renderDancePartyView() {
  const state = store.getState();
  const hero = state.selectedHero;
  const activePet = store.getActivePet();
  const hasPet = hero.unlockedPetIds && hero.unlockedPetIds.length > 0;
  const petAvatarUrl = getPetDisplayAvatar(activePet);
  const petName = hasPet ? activePet.name : 'Sparky (Arcade Guide)';

  // ROUTE SUB-GAMES
  if (arcadeMode === 'treat_catch') {
    return renderTreatCatchGame(hero, activePet, petAvatarUrl, petName);
  }
  if (arcadeMode === 'memory_match') {
    return renderMemoryMatchGame(hero, activePet, petAvatarUrl, petName);
  }
  if (arcadeMode === 'learning_game') {
    return renderLearningGame(hero, activePet, petAvatarUrl, petName);
  }
  if (arcadeMode === 'disco_party') {
    return renderDiscoParty(hero, activePet, petAvatarUrl, petName, state);
  }

  // MAIN ARCADE HUB
  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in select-none">
      
      <!-- Top Arcade Header -->
      <div class="flex items-center justify-between">
        <button id="arcade-back-dash-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-black px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">arrow_back</span> Quests
        </button>

        <div class="flex items-center gap-2">
          <div class="bg-surface-container-high px-3.5 py-1.5 rounded-full border-2 border-primary-container text-xs font-black text-primary flex items-center gap-1.5 shadow-sm">
            <span class="material-symbols-outlined text-base animate-pulse">sports_esports</span>
            <span>PET ARCADE</span>
          </div>
        </div>

        <div class="flex items-center gap-2 bg-surface-container-high px-3.5 py-1.5 rounded-full border-2 border-secondary-container shadow-sm">
          <span class="material-symbols-outlined text-secondary text-base animate-coin" style="font-variation-settings: 'FILL' 1;">monetization_on</span>
          <span class="font-headline text-xs font-black text-secondary">${hero.coins.toLocaleString()} 🪙</span>
        </div>
      </div>

      <!-- PET STAGE & INTERACTIVE SPOTLIGHT -->
      <section class="relative bg-gradient-to-b from-[#132230] via-[#0e1924] to-[#070f17] rounded-3xl p-5 sm:p-6 border-3 border-secondary/40 card-shadow flex flex-col items-center gap-5 overflow-hidden">
        
        <!-- Glowing Stage Spotlight Background -->
        <div class="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-secondary/15 pointer-events-none"></div>
        <div class="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/20 blur-3xl pointer-events-none"></div>

        <!-- Stage Header Badges -->
        <div class="w-full flex justify-between items-center z-10">
          <div class="flex items-center gap-2 bg-surface-container-highest/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-primary border border-primary/30">
            <span class="material-symbols-outlined text-sm">pets</span>
            <span>${petName}</span>
            <span class="text-secondary text-[10px] uppercase font-bold">• Stage ${activePet.stage || 1}</span>
          </div>

          <div class="flex items-center gap-1.5 bg-surface-container-highest/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-tertiary border border-tertiary/30">
            <span class="material-symbols-outlined text-sm text-error" style="font-variation-settings: 'FILL' 1;">favorite</span>
            <span class="font-black text-on-surface">Mood: ${petMood}</span>
          </div>
        </div>

        <!-- Center Pet Interactive Visual & Speech Bubble -->
        <div class="relative z-10 flex flex-col items-center gap-3 my-1">
          
          <!-- Speech Bubble -->
          <div class="relative bg-surface-container-high/95 text-inverse-surface border-2 border-secondary/60 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black text-center max-w-xs shadow-md animate-float">
            ${petSpeech}
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-container-high border-r-2 border-b-2 border-secondary/60 rotate-45"></div>
          </div>

          <!-- Pet Avatar / Visual -->
          <div id="arcade-pet-actor" class="relative cursor-pointer group select-none">
            <div class="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-gradient-to-b from-primary/20 to-surface-container-highest/80 border-4 border-primary p-2 flex items-center justify-center shadow-[0_0_30px_rgba(46,204,113,0.35)] transition-transform group-hover:scale-105 active:scale-95 ${petAnimation}">
              <img src="${petAvatarUrl}" alt="${petName}" class="w-full h-full object-contain drop-shadow-xl" />
            </div>

            <!-- Floating Hearts Effect -->
            ${
              petHearts
                ? `<div class="absolute -top-4 -right-2 text-2xl animate-bounce">💖</div>
                   <div class="absolute -top-2 -left-2 text-xl animate-pulse">✨</div>`
                : ''
            }

            <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-surface-container-high px-2.5 py-0.5 rounded-full border border-primary/40 text-[9px] font-black uppercase text-primary tracking-wider shadow">
              Tap to Pet!
            </div>
          </div>

          <!-- If child has not chosen starter pet, offer direct summon button -->
          ${!hasPet ? `
            <button id="arcade-choose-starter-btn" class="bg-primary text-on-primary font-headline text-xs font-black px-4 py-2 rounded-xl chunky-btn-sm border-primary-container shadow flex items-center gap-1.5 active:scale-95">
              <span>🥚</span> Choose Your First Pet Companion!
            </button>
          ` : ''}

          <!-- Pet Actions Bar -->
          <div class="flex flex-wrap items-center justify-center gap-2 pt-2 z-10">
            <button id="pet-play-ball-btn" class="bg-surface-container hover:bg-surface-bright text-secondary font-headline text-xs font-black px-3.5 py-2 rounded-xl border-2 border-secondary/40 chunky-btn-sm flex items-center gap-1.5 active:scale-95">
              <span>🎾</span> Play Catch
            </button>

            <button id="pet-feed-treat-btn" class="bg-surface-container hover:bg-surface-bright text-primary font-headline text-xs font-black px-3.5 py-2 rounded-xl border-2 border-primary/40 chunky-btn-sm flex items-center gap-1.5 active:scale-95">
              <span>🥩</span> Feed Snack
            </button>

            <button id="pet-talk-btn" class="bg-surface-container hover:bg-surface-bright text-tertiary font-headline text-xs font-black px-3.5 py-2 rounded-xl border-2 border-tertiary/40 chunky-btn-sm flex items-center gap-1.5 active:scale-95">
              <span>💬</span> Pet Talk
            </button>

            <button id="pet-dance-trick-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface font-headline text-xs font-black px-3.5 py-2 rounded-xl border-2 border-surface-container-highest chunky-btn-sm flex items-center gap-1.5 active:scale-95">
              <span>🪩</span> Dance Spin
            </button>
          </div>

        </div>

      </section>

      <!-- ARCADE MINI-GAMES GRID -->
      <section class="flex flex-col gap-3.5">
        <div class="flex justify-between items-center px-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary text-2xl" style="font-variation-settings: 'FILL' 1;">videogame_asset</span>
            <h2 class="font-headline text-xl font-black text-inverse-surface">Arcade Game Cabinets</h2>
          </div>
          <span class="text-xs font-bold text-secondary">Play & Learn Together</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <!-- CABINET 1: Pet Treat Popper -->
          <div class="tactile-card bg-surface-container rounded-3xl p-5 border-3 border-secondary-container/60 flex flex-col justify-between gap-4">
            <div class="flex items-start gap-4">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-700/20 border-3 border-secondary flex items-center justify-center text-3xl shadow-md flex-shrink-0">
                🎯
              </div>
              <div class="flex flex-col">
                <span class="text-[10px] font-black uppercase text-secondary tracking-wider">Fast Action & Reflexes</span>
                <h3 class="font-headline text-lg font-black text-inverse-surface leading-tight">Pet Berry Popper</h3>
                <p class="text-xs text-on-surface-variant mt-1">Pop floating fruit bubbles and feed treats to ${petName} before time runs out!</p>
              </div>
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-surface-container-highest">
              <div class="flex items-center gap-1.5 text-xs font-black text-secondary">
                <span class="material-symbols-outlined text-sm">monetization_on</span> Earn +20 Tokens 🪙
              </div>
              <button id="launch-treat-catch-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black px-6 py-2.5 rounded-xl chunky-btn border-secondary-container shadow-chunky-sm active:scale-95 hover:brightness-110">
                PLAY CATCH!
              </button>
            </div>
          </div>

          <!-- CABINET 2: Pet Memory Match -->
          <div class="tactile-card bg-surface-container rounded-3xl p-5 border-3 border-primary-container/60 flex flex-col justify-between gap-4">
            <div class="flex items-start gap-4">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-700/20 border-3 border-primary flex items-center justify-center text-3xl shadow-md flex-shrink-0">
                🃏
              </div>
              <div class="flex flex-col">
                <span class="text-[10px] font-black uppercase text-primary tracking-wider">Memory & Concentration</span>
                <h3 class="font-headline text-lg font-black text-inverse-surface leading-tight">Hero Memory Match</h3>
                <p class="text-xs text-on-surface-variant mt-1">Flip tactile wooden tiles to uncover matching pairs of companions and hero gear!</p>
              </div>
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-surface-container-highest">
              <div class="flex items-center gap-1.5 text-xs font-black text-primary">
                <span class="material-symbols-outlined text-sm">monetization_on</span> Earn +25 Tokens 🪙
              </div>
              <button id="launch-memory-match-btn" class="bg-primary text-on-primary font-headline text-xs font-black px-6 py-2.5 rounded-xl chunky-btn border-primary-container shadow-chunky-sm active:scale-95 hover:brightness-110">
                PLAY MATCH!
              </button>
            </div>
          </div>

          <!-- CABINET 3: Learning Academy (Phonics, Math, Colors) -->
          <div class="tactile-card bg-surface-container rounded-3xl p-5 border-3 border-tertiary-container/60 flex flex-col justify-between gap-4">
            <div class="flex items-start gap-4">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/30 to-blue-700/20 border-3 border-tertiary flex items-center justify-center text-3xl shadow-md flex-shrink-0">
                🧠
              </div>
              <div class="flex flex-col">
                <span class="text-[10px] font-black uppercase text-tertiary tracking-wider">Phonics, Numbers & Shapes</span>
                <h3 class="font-headline text-lg font-black text-inverse-surface leading-tight">Learning Academy</h3>
                <p class="text-xs text-on-surface-variant mt-1">Solve fun educational puzzles with ${petName}. 6 subjects with toddler & kid difficulty!</p>
              </div>
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-surface-container-highest">
              <div class="flex items-center gap-1.5 text-xs font-black text-tertiary">
                <span class="material-symbols-outlined text-sm">monetization_on</span> Earn +30 Tokens 🪙
              </div>
              <button id="launch-learning-academy-btn" class="bg-tertiary text-on-tertiary font-headline text-xs font-black px-6 py-2.5 rounded-xl chunky-btn border-tertiary-container shadow-chunky-sm active:scale-95 hover:brightness-110">
                START QUEST!
              </button>
            </div>
          </div>

          <!-- CABINET 4: Pet Disco Party -->
          <div class="tactile-card bg-surface-container rounded-3xl p-5 border-3 border-amber-500/40 flex flex-col justify-between gap-4">
            <div class="flex items-start gap-4">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/30 to-orange-700/20 border-3 border-yellow-400 flex items-center justify-center text-3xl shadow-md flex-shrink-0">
                🪩
              </div>
              <div class="flex flex-col">
                <span class="text-[10px] font-black uppercase text-yellow-400 tracking-wider">Rhythm & Celebration</span>
                <h3 class="font-headline text-lg font-black text-inverse-surface leading-tight">Disco Dance Party</h3>
                <p class="text-xs text-on-surface-variant mt-1">Tap glowing rhythm dance pads to the disco synth beat and launch confetti!</p>
              </div>
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-surface-container-highest">
              <div class="flex items-center gap-1.5 text-xs font-black text-yellow-400">
                <span class="material-symbols-outlined text-sm">celebration</span> Party Celebration!
              </div>
              <button id="launch-disco-party-btn" class="bg-gradient-to-r from-amber-500 to-yellow-400 text-[#1a1200] font-headline text-xs font-black px-6 py-2.5 rounded-xl chunky-btn border-amber-600 shadow-chunky-sm active:scale-95 hover:brightness-110">
                LET'S DANCE!
              </button>
            </div>
          </div>

        </div>
      </section>

    </div>
  `;
}

// -------------------------------------------------------------
// SUB-VIEW 1: PET BERRY POPPER (Action Treat Catch Game)
// -------------------------------------------------------------
function renderTreatCatchGame(hero, activePet, petAvatarUrl, petName) {
  return `
    <div class="max-w-2xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-5 animate-fade-in select-none">
      
      <!-- Top Bar -->
      <div class="flex items-center justify-between">
        <button id="game-exit-to-hub-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-black px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">arrow_back</span> Arcade
        </button>

        <div class="flex items-center gap-3">
          <div class="bg-surface-container-high px-4 py-1.5 rounded-full border-2 border-secondary text-xs font-black text-secondary flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">timer</span>
            <span>Time: <strong id="treat-timer-val" class="text-base">${treatTimeLeft}s</strong></span>
          </div>

          <div class="bg-surface-container-high px-4 py-1.5 rounded-full border-2 border-primary text-xs font-black text-primary flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">star</span>
            <span>Score: <strong id="treat-score-val" class="text-base">${treatScore}</strong></span>
          </div>
        </div>
      </div>

      <!-- Play Arena -->
      <div class="relative bg-gradient-to-b from-[#112435] via-[#0b1b29] to-[#040e17] rounded-3xl p-6 border-4 border-secondary/50 min-h-[420px] card-shadow flex flex-col justify-between items-center overflow-hidden">
        
        <!-- Background Bubble Glows -->
        <div class="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-secondary/15 pointer-events-none"></div>

        <!-- Instructions Banner -->
        <div class="z-10 bg-surface-container-highest/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-secondary/40 text-xs font-black text-secondary text-center shadow">
          Tap the floating bubbles to feed treats to ${petName}! 🍓 ⭐ 🪙
        </div>

        <!-- Floating Bubbles Playfield -->
        <div id="bubbles-field" class="w-full flex-1 relative my-4 min-h-[220px]">
          ${treatItems.map((item, idx) => `
            <button data-bubble-idx="${idx}" class="treat-bubble-btn absolute rounded-full bg-gradient-to-br from-surface-bright to-surface-container-high border-3 border-secondary/70 p-3 text-3xl sm:text-4xl shadow-lg flex items-center justify-center active:scale-125 transition-transform hover:scale-110" style="left: ${item.x}%; top: ${item.y}%;">
              ${item.icon}
            </button>
          `).join('')}
        </div>

        <!-- Pet at Bottom Waiting for Food -->
        <div class="z-10 flex flex-col items-center gap-2">
          <div id="treat-catcher-pet" class="w-24 h-24 rounded-full bg-surface-container-high border-3 border-primary p-2 flex items-center justify-center shadow-lg transition-transform ${petAnimation}">
            <img src="${petAvatarUrl}" alt="${petName}" class="w-full h-full object-contain drop-shadow" />
          </div>
          <span class="text-xs font-black text-primary uppercase">${petName} is hungry!</span>
        </div>

      </div>

      <!-- Start/Restart Controls -->
      <div class="flex items-center gap-3">
        ${!treatGameActive ? `
          <button id="start-treat-game-btn" class="flex-1 bg-secondary text-on-secondary font-headline text-sm font-black py-4 rounded-2xl chunky-btn border-secondary-container shadow-chunky-sm active:scale-95 hover:brightness-110">
            START BERRY POPPING! 🎯
          </button>
        ` : `
          <button id="stop-treat-game-btn" class="flex-1 bg-error text-on-error font-headline text-xs font-black py-3 rounded-2xl chunky-btn border-error-container active:scale-95">
            End Round Early
          </button>
        `}
      </div>

    </div>
  `;
}

// -------------------------------------------------------------
// SUB-VIEW 2: HERO MEMORY MATCH
// -------------------------------------------------------------
function renderMemoryMatchGame(hero, activePet, petAvatarUrl, petName) {
  return `
    <div class="max-w-2xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-5 animate-fade-in select-none">
      
      <!-- Top Bar -->
      <div class="flex items-center justify-between">
        <button id="game-exit-to-hub-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-black px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">arrow_back</span> Arcade
        </button>

        <div class="bg-surface-container-high px-4 py-1.5 rounded-full border-2 border-primary text-xs font-black text-primary flex items-center gap-1.5">
          <span class="material-symbols-outlined text-sm">psychology</span>
          <span>Matched: ${matchedCardIds.length / 2} / ${memoryCards.length / 2} Pairs</span>
        </div>

        <button id="reset-memory-game-btn" class="bg-surface-container hover:bg-surface-bright text-secondary font-headline text-xs font-black px-3.5 py-2 rounded-xl border border-secondary/40 chunky-btn-sm">
          Reset Tiles
        </button>
      </div>

      <!-- Memory Board Area -->
      <div class="bg-surface-container rounded-3xl p-6 border-3 border-primary-container/60 card-shadow flex flex-col items-center gap-6">
        
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full border-2 border-primary overflow-hidden p-1 bg-surface-container-high flex-shrink-0">
            <img src="${petAvatarUrl}" alt="${petName}" class="w-full h-full object-contain" />
          </div>
          <div>
            <h3 class="font-headline text-base font-black text-inverse-surface">${petName}'s Memory Quest</h3>
            <p class="text-xs text-on-surface-variant font-bold">Find all 4 matching pairs of adventure tokens!</p>
          </div>
        </div>

        <!-- 4x2 Grid of Chunky Wooden Tiles -->
        <div class="grid grid-cols-4 gap-3.5 w-full max-w-md">
          ${memoryCards.map((card, idx) => {
            const isFlipped = flippedCardIdxs.includes(idx) || matchedCardIds.includes(card.id);
            const isMatched = matchedCardIds.includes(card.id);

            return `
              <button data-memory-card-idx="${idx}" class="memory-card-btn h-24 sm:h-28 rounded-2xl border-3 flex items-center justify-center p-2 font-black transition-all chunky-btn active:scale-95 ${
                isMatched
                  ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(46,204,113,0.4)]'
                  : isFlipped
                  ? 'bg-surface-container-highest border-secondary text-secondary shadow-md'
                  : 'bg-gradient-to-b from-[#2e4053] to-[#1c2833] border-[#151f28] text-white shadow-chunky-sm hover:brightness-110'
              }">
                ${isFlipped ? card.content : '<span class="text-3xl sm:text-4xl">⭐</span>'}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Victory Banner -->
        ${memoryWon ? `
          <div class="w-full bg-primary/20 border-2 border-primary rounded-2xl p-4 text-center animate-bounce-slow">
            <h4 class="font-headline text-lg font-black text-primary">🎉 ALL PAIRS MATCHED!</h4>
            <p class="text-xs text-inverse-surface font-bold mt-1">+25 Coins auto-awarded to your hero wallet!</p>
          </div>
        ` : ''}

      </div>

    </div>
  `;
}

// -------------------------------------------------------------
// SUB-VIEW 3: LEARNING ACADEMY (Phonics, Math, Colors)
// -------------------------------------------------------------
function renderLearningGame(hero, activePet, petAvatarUrl, petName) {
  if (selectedLearningGame) {
    const diff = hero.gameDifficulty || 'medium';
    const challenges = getGameChallenges(selectedLearningGame, diff);
    const challenge = challenges[currentChallengeIdx] || challenges[0];

    return `
      <div class="max-w-2xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-5 animate-fade-in select-none">
        
        <!-- Header -->
        <div class="flex items-center justify-between">
          <button id="exit-learning-to-hub-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-black px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
            <span class="material-symbols-outlined text-base">arrow_back</span> Subjects
          </button>

          <div class="flex items-center gap-2">
            <span class="text-xs font-black uppercase text-tertiary">${selectedLearningGame.subject}</span>
            <span class="bg-surface-container-high px-3 py-1 rounded-full text-xs font-black text-primary border border-primary/40">
              Q ${currentChallengeIdx + 1} / ${challenges.length}
            </span>
          </div>
        </div>

        <!-- Challenge Play Arena -->
        <div class="bg-surface-container rounded-3xl p-6 border-3 border-tertiary-container/60 card-shadow flex flex-col gap-6 text-center">
          
          <!-- Pet Buddy Cheerleader -->
          <div class="flex items-center justify-center gap-3">
            <div class="w-14 h-14 rounded-full border-3 border-tertiary overflow-hidden p-1 bg-surface-container-high shadow flex-shrink-0">
              <img src="${petAvatarUrl}" alt="${petName}" class="w-full h-full object-contain" />
            </div>
            <div class="text-left">
              <span class="text-[10px] font-black uppercase text-tertiary">${selectedLearningGame.title}</span>
              <p class="text-xs text-on-surface-variant font-bold">${petName} is listening for your answer!</p>
            </div>
          </div>

          <!-- Question Box -->
          <div class="bg-surface-container-lowest rounded-2xl p-6 border-2 border-surface-container-highest shadow-inner">
            <p class="font-headline text-lg sm:text-xl font-black text-primary leading-snug">
              ${challenge.question}
            </p>
          </div>

          <!-- Options Grid -->
          <div class="grid grid-cols-1 gap-3">
            ${challenge.options.map((opt, idx) => `
              <button data-learn-opt-idx="${idx}" class="learn-opt-btn bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-base font-black py-4 px-6 rounded-2xl border-2 border-surface-container-highest chunky-btn flex items-center justify-between active:scale-98">
                <span>${opt}</span>
                <span class="material-symbols-outlined text-primary text-xl opacity-0 group-hover:opacity-100">check_circle</span>
              </button>
            `).join('')}
          </div>

        </div>

      </div>
    `;
  }

  // Subject Selection Grid
  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in select-none">
      
      <div class="flex items-center justify-between">
        <button id="game-exit-to-hub-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-black px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">arrow_back</span> Arcade
        </button>
        <h1 class="font-headline text-xl font-black text-inverse-surface">Learning Academy Quests</h1>
        <span class="bg-surface-container-high px-3 py-1 rounded-full text-xs font-bold text-tertiary border border-tertiary/40">
          6 Subjects
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${ADVENTURE_GAMES.map((game) => `
          <div class="tactile-card bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest flex flex-col justify-between gap-4">
            
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

            <div class="flex items-center justify-between pt-2 border-t border-surface-container-highest">
              <span class="text-primary text-xs font-black">+${game.rewardCoins} Tokens 🪙</span>
              <button data-select-game-id="${game.id}" class="select-learning-game-btn bg-primary text-on-primary font-headline text-xs font-black px-5 py-2.5 rounded-xl chunky-btn border-primary-container shadow-chunky-sm active:scale-95 hover:brightness-110">
                Play!
              </button>
            </div>

          </div>
        `).join('')}
      </div>

    </div>
  `;
}

// -------------------------------------------------------------
// SUB-VIEW 4: DISCO DANCE PARTY
// -------------------------------------------------------------
function renderDiscoParty(hero, activePet, petAvatarUrl, petName, state) {
  return `
    <div class="max-w-3xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-5 animate-fade-in select-none">
      
      <!-- Top Navigation -->
      <div class="flex items-center justify-between">
        <button id="game-exit-to-hub-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-black px-3.5 py-2 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">arrow_back</span> Arcade
        </button>
        <h1 class="font-headline text-xl font-black text-secondary text-shadow">Pet Disco Rhythm Groove</h1>
        <div class="bg-surface-container-high px-3 py-1 rounded-full text-xs font-black text-secondary border border-secondary-container/40 flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">music_note</span> Synth Mode
        </div>
      </div>

      <!-- Disco Dance Floor Arena -->
      <div id="disco-arena" class="relative bg-gradient-to-b from-[#131b26] via-[#10202e] to-[#09141e] rounded-3xl p-6 border-4 border-secondary/40 min-h-[380px] card-shadow flex flex-col justify-between items-center overflow-hidden">
        
        <div class="absolute inset-0 bg-gradient-to-t from-secondary/15 via-transparent to-primary/10 pointer-events-none"></div>

        <div class="w-full flex justify-between items-center z-10">
          <span class="bg-surface-container-highest/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-primary flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">speaker</span> Party Beat
          </span>
          <span class="bg-surface-container-highest/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-secondary flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">celebration</span> Streak: ${hero.streak} Days
          </span>
        </div>

        <!-- Dancing Duo Character Visuals -->
        <div class="relative my-4 z-10 flex items-center justify-center gap-6">
          
          <!-- Hero Dancing Avatar -->
          <div id="disco-hero-actor" class="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-primary-container/30 border-4 border-primary overflow-hidden flex items-center justify-center shadow-xl ${
            isDancing ? 'animate-bounce' : 'animate-float'
          }">
            <img src="${hero.avatar}" alt="${hero.name}" class="w-full h-full object-cover" />
          </div>

          <!-- Active Pet Dancing -->
          <div id="disco-pet-actor" class="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-tertiary-container/30 border-4 border-tertiary p-2 flex items-center justify-center shadow-2xl ${
            isDancing ? 'animate-bounce' : 'animate-float'
          }">
            <img src="${petAvatarUrl}" alt="${petName}" class="w-full h-full object-contain drop-shadow" />
          </div>

        </div>

        <!-- Interactive 3D Light-Up Dance Floor Pads -->
        <div class="w-full max-w-md grid grid-cols-3 gap-3 z-10 p-2 bg-surface-container-lowest/80 rounded-2xl border-2 border-surface-container-highest">
          <button data-dance-pad="green" class="dance-pad-btn h-14 rounded-xl bg-gradient-to-b from-[#2ecc71] to-[#1e8449] border-b-4 border-[#145a32] text-white font-headline text-xs font-black shadow-md active:translate-y-1 active:border-b-0 flex items-center justify-center gap-1">
            🟢 JUMP!
          </button>
          <button data-dance-pad="blue" class="dance-pad-btn h-14 rounded-xl bg-gradient-to-b from-[#3498db] to-[#21618c] border-b-4 border-[#154360] text-white font-headline text-xs font-black shadow-md active:translate-y-1 active:border-b-0 flex items-center justify-center gap-1">
            🔵 SPIN!
          </button>
          <button data-dance-pad="yellow" class="dance-pad-btn h-14 rounded-xl bg-gradient-to-b from-[#f1c40f] to-[#b7950b] border-b-4 border-[#7d6608] text-[#1a1200] font-headline text-xs font-black shadow-md active:translate-y-1 active:border-b-0 flex items-center justify-center gap-1">
            🟡 SHINE!
          </button>
        </div>

      </div>

      <!-- Party DJ Controls -->
      <section class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <button id="disco-toggle-music-btn" class="w-full sm:w-1/2 ${
          isDancing ? 'bg-error text-on-error border-error-container' : 'bg-primary text-on-primary border-primary-container'
        } font-headline font-black text-sm py-4 rounded-2xl chunky-btn flex items-center justify-center gap-2 active:scale-95">
          <span class="material-symbols-outlined text-2xl">${isDancing ? 'stop' : 'play_arrow'}</span>
          ${isDancing ? 'STOP DISCO BEAT' : 'START DISCO BEAT!'}
        </button>

        <button id="disco-fire-confetti-btn" class="w-full sm:w-1/2 bg-secondary text-on-secondary font-headline font-black text-sm py-4 rounded-2xl chunky-btn border-secondary-container flex items-center justify-center gap-2 active:scale-95">
          <span class="material-symbols-outlined text-2xl">celebration</span>
          FIRE CONFETTI!
        </button>

      </section>

    </div>
  `;
}

// -------------------------------------------------------------
// EVENT LISTENERS FOR ALL ARCADE MODES
// -------------------------------------------------------------
export function attachDancePartyListeners() {
  
  // Navigation: Back to Dashboard
  const backDashBtn = document.getElementById('arcade-back-dash-btn');
  if (backDashBtn) {
    backDashBtn.addEventListener('click', () => {
      cleanupTimers();
      store.navigate('dashboard');
    });
  }

  // Navigation: Back to Arcade Hub from any sub-game
  const exitToHubBtn = document.getElementById('game-exit-to-hub-btn');
  if (exitToHubBtn) {
    exitToHubBtn.addEventListener('click', () => {
      cleanupTimers();
      arcadeMode = 'hub';
      selectedLearningGame = null;
      store.notify();
    });
  }

  // Direct Starter Pet Unlock trigger from Arcade
  const chooseStarterBtn = document.getElementById('arcade-choose-starter-btn');
  if (chooseStarterBtn) {
    chooseStarterBtn.addEventListener('click', () => {
      store.openPetSelectionModal('starter');
    });
  }

  // Pet Stage Interactions
  const petActor = document.getElementById('arcade-pet-actor');
  if (petActor) {
    petActor.addEventListener('click', () => {
      Sound.chirp();
      petMood = 'Ecstatic! ❤️';
      petSpeech = 'Hehehe! That tickles! You are my favorite hero!';
      petHearts = true;
      petAnimation = 'animate-bounce';
      setTimeout(() => {
        petHearts = false;
        petAnimation = 'animate-bounce-slow';
        store.notify();
      }, 1500);
      store.notify();
    });
  }

  const playBallBtn = document.getElementById('pet-play-ball-btn');
  if (playBallBtn) {
    playBallBtn.addEventListener('click', () => {
      Sound.pop();
      petMood = 'Playful! 🎾';
      petSpeech = 'I caught the ball! Watch this somersault!';
      petAnimation = 'animate-bounce';
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 } });
      setTimeout(() => { petAnimation = 'animate-bounce-slow'; store.notify(); }, 1200);
      store.notify();
    });
  }

  const feedTreatBtn = document.getElementById('pet-feed-treat-btn');
  if (feedTreatBtn) {
    feedTreatBtn.addEventListener('click', () => {
      Sound.coin();
      petMood = 'Super Full! 🥩';
      petSpeech = 'Munch munch munch! YUM! Best snack ever!';
      petHearts = true;
      setTimeout(() => { petHearts = false; store.notify(); }, 1500);
      store.notify();
    });
  }

  const petTalkBtn = document.getElementById('pet-talk-btn');
  if (petTalkBtn) {
    petTalkBtn.addEventListener('click', () => {
      Sound.chirp();
      const phrases = [
        "Together we're unstoppable!",
        "Did you finish your quests today? You're doing amazing!",
        "My elemental powers grow stronger with every game we play!",
        "Let's win a million tokens at the arcade!"
      ];
      petSpeech = phrases[Math.floor(Math.random() * phrases.length)];
      store.notify();
    });
  }

  const danceTrickBtn = document.getElementById('pet-dance-trick-btn');
  if (danceTrickBtn) {
    danceTrickBtn.addEventListener('click', () => {
      Sound.laser();
      petSpeech = 'Look at my sweet spins and victory twirl!';
      petAnimation = 'animate-spin';
      setTimeout(() => { petAnimation = 'animate-bounce-slow'; store.notify(); }, 1000);
      store.notify();
    });
  }

  // --- LAUNCH GAME BUTTONS ---
  const launchTreatBtn = document.getElementById('launch-treat-catch-btn');
  if (launchTreatBtn) {
    launchTreatBtn.addEventListener('click', () => {
      arcadeMode = 'treat_catch';
      treatScore = 0;
      treatTimeLeft = 20;
      treatGameActive = true;
      generateTreatItems();
      startTreatTimer();
      Sound.click();
      store.notify();
    });
  }

  const launchMemoryBtn = document.getElementById('launch-memory-match-btn');
  if (launchMemoryBtn) {
    launchMemoryBtn.addEventListener('click', () => {
      arcadeMode = 'memory_match';
      initMemoryGame();
      Sound.click();
      store.notify();
    });
  }

  const launchLearningBtn = document.getElementById('launch-learning-academy-btn');
  if (launchLearningBtn) {
    launchLearningBtn.addEventListener('click', () => {
      arcadeMode = 'learning_game';
      selectedLearningGame = null;
      Sound.click();
      store.notify();
    });
  }

  const launchDiscoBtn = document.getElementById('launch-disco-party-btn');
  if (launchDiscoBtn) {
    launchDiscoBtn.addEventListener('click', () => {
      arcadeMode = 'disco_party';
      Sound.click();
      store.notify();
    });
  }

  // --- TREAT CATCH LISTENERS ---
  const startTreatBtn = document.getElementById('start-treat-game-btn');
  if (startTreatBtn) {
    startTreatBtn.addEventListener('click', () => {
      treatScore = 0;
      treatTimeLeft = 20;
      treatGameActive = true;
      generateTreatItems();
      startTreatTimer();
      Sound.fanfare();
      store.notify();
    });
  }

  const stopTreatBtn = document.getElementById('stop-treat-game-btn');
  if (stopTreatBtn) {
    stopTreatBtn.addEventListener('click', () => {
      cleanupTimers();
      treatGameActive = false;
      store.notify();
    });
  }

  document.querySelectorAll('.treat-bubble-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-bubble-idx'));
      Sound.pop();
      treatScore += 10;
      treatItems.splice(idx, 1);
      if (treatItems.length < 3) {
        generateTreatItems();
      }
      store.notify();
    });
  });

  // --- MEMORY MATCH LISTENERS ---
  document.querySelectorAll('.memory-card-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-memory-card-idx'));
      handleMemoryCardClick(idx);
    });
  });

  const resetMemoryBtn = document.getElementById('reset-memory-game-btn');
  if (resetMemoryBtn) {
    resetMemoryBtn.addEventListener('click', () => {
      initMemoryGame();
      Sound.click();
      store.notify();
    });
  }

  // --- LEARNING ACADEMY LISTENERS ---
  document.querySelectorAll('.select-learning-game-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gId = btn.getAttribute('data-select-game-id');
      selectedLearningGame = ADVENTURE_GAMES.find((g) => g.id === gId);
      currentChallengeIdx = 0;
      learningScore = 0;
      Sound.click();
      store.notify();

      if (store.isEasyMode() && selectedLearningGame) {
        const challenges = getGameChallenges(selectedLearningGame, 'easy');
        const challenge = challenges[0];
        if (challenge) {
          setTimeout(() => {
            voicePrompts.speakGuidance(selectedLearningGame.title, challenge.question);
          }, 350);
        }
      }
    });
  });

  const exitLearningBtn = document.getElementById('exit-learning-to-hub-btn');
  if (exitLearningBtn) {
    exitLearningBtn.addEventListener('click', () => {
      voicePrompts.stop();
      selectedLearningGame = null;
      store.notify();
    });
  }

  document.querySelectorAll('.learn-opt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const optIdx = parseInt(btn.getAttribute('data-learn-opt-idx'));
      handleLearningAnswer(optIdx);
    });
  });

  // --- DISCO PARTY LISTENERS ---
  const discoMusicBtn = document.getElementById('disco-toggle-music-btn');
  if (discoMusicBtn) {
    discoMusicBtn.addEventListener('click', () => {
      if (isDancing) {
        Sound.stopDisco();
        isDancing = false;
      } else {
        isDancing = true;
        Sound.startDisco((step) => {
          discoStep = step;
          const hActor = document.getElementById('disco-hero-actor');
          const pActor = document.getElementById('disco-pet-actor');
          if (hActor && pActor) {
            hActor.style.transform = step % 2 === 0 ? 'translateY(-12px) rotate(4deg)' : 'translateY(0px) rotate(-4deg)';
            pActor.style.transform = step % 2 === 0 ? 'translateY(-14px) rotate(-6deg)' : 'translateY(0px) rotate(6deg)';
          }
        });
      }
      store.notify();
    });
  }

  const discoConfettiBtn = document.getElementById('disco-fire-confetti-btn');
  if (discoConfettiBtn) {
    discoConfettiBtn.addEventListener('click', () => {
      Sound.fanfare();
      confetti({
        particleCount: 100,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#2ecc71', '#ffb961', '#3498db', '#f1c40f', '#ff5252']
      });
      store.getState().selectedHero.coins += 5;
      store.saveState(true);
    });
  }

  document.querySelectorAll('.dance-pad-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const padType = btn.getAttribute('data-dance-pad');
      if (padType === 'green') Sound.pop();
      else if (padType === 'blue') Sound.laser();
      else Sound.coin();

      confetti({ particleCount: 20, spread: 40, origin: { y: 0.7 } });
      const pActor = document.getElementById('disco-pet-actor');
      if (pActor) {
        pActor.style.transform = 'scale(1.25) rotate(180deg)';
        setTimeout(() => { pActor.style.transform = ''; }, 300);
      }
    });
  });
}

// -------------------------------------------------------------
// HELPER FUNCTIONS
// -------------------------------------------------------------
function cleanupTimers() {
  if (treatTimer) {
    clearInterval(treatTimer);
    treatTimer = null;
  }
  if (isDancing) {
    Sound.stopDisco();
    isDancing = false;
  }
}

function generateTreatItems() {
  const icons = ['🍎', '🍓', '🥩', '⭐', '🪙', '🍇', '🧁'];
  treatItems = [];
  for (let i = 0; i < 5; i++) {
    treatItems.push({
      icon: icons[Math.floor(Math.random() * icons.length)],
      x: 10 + Math.random() * 75,
      y: 10 + Math.random() * 65
    });
  }
}

function startTreatTimer() {
  if (treatTimer) clearInterval(treatTimer);
  treatTimer = setInterval(() => {
    if (treatTimeLeft > 1) {
      treatTimeLeft--;
      const el = document.getElementById('treat-timer-val');
      if (el) el.textContent = `${treatTimeLeft}s`;
    } else {
      clearInterval(treatTimer);
      treatTimer = null;
      treatGameActive = false;
      Sound.fanfare();
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      
      const coinsWon = Math.max(10, Math.floor(treatScore / 2));
      store.getState().selectedHero.coins += coinsWon;
      store.saveState();
      
      store.showReward(
        'Round Complete! 🎯',
        `You scored ${treatScore} points and earned +${coinsWon} Habit Tokens 🪙!`,
        coinsWon,
        25
      );
      store.notify();
    }
  }, 1000);
}

function initMemoryGame() {
  const activePet = store.getActivePet();
  const petAvatarUrl = getPetDisplayAvatar(activePet);

  const symbols = [
    { id: 'pet', content: `<img src="${petAvatarUrl}" class="w-14 h-14 object-contain drop-shadow" />` },
    { id: 'star', content: `<img src="https://lh3.googleusercontent.com/aida/AEtjO1V97aePfWQmnVShMtBQbima_UDU0i6-8HfQ2n8qhGdoWZLbB0i92sJK2agutlVgGgj3HAVeKGYApMLb1pekmHEwMkum3IwJUH4kInnyo5LBApPp19gD5ihwha1vyRfG_5DcQtw5IfYwtwF_GMpbfQe_LUwyYPZBWnYua0Y7r8WKi-bax1d06QI0zeSdnmNrDwzQi6nSmBkbPGLaL5iHGxpziVKKaZ155rUBdz8_jIVpxWQS0D3-Vpacbi8" class="w-14 h-14 object-contain drop-shadow" />` },
    { id: 'apple', content: `<img src="https://lh3.googleusercontent.com/aida/AEtjO1UuCPRIp3bcNODtjcuPUYCb1k8R-X-wt8M4SkdedZ2UK8gVYhXWdqlH4ec0QrR5LVQimn-_uMnv97sofFVP_bwtOabQeHT0SHtxVe59gKb1Qch1Id9HwPaHU7YYyQbnId78QZLhbJun88sn97HnxETpeh6fgMNmuextDnU3-fqKj7z6PsFQnV57jxpzaVtbulYuS9DNbp78rG73z_clyox8dQva9TbjJr4dzkiz-ytPCGJyopeRhjPTAts" class="w-14 h-14 object-contain drop-shadow" />` },
    { id: 'brush', content: `<img src="https://lh3.googleusercontent.com/aida/AEtjO1Xt9GeFqjAL58hS_PuyIhL5_ZJ68ze3DFHgw6czaVkv6UJsQjulgSW1SVNMN5R-83AzzqbFfTVTa4A3XBDHsR7ggE9m-inrmcjBUsbdqo4InwRTA2VU1ndafKJJx--9Vzt17F9tgoYWYwsDyOtf2V78XpSPNIMUWsSQI1pjREuzdqsCbyFXDBadq8CPlJrx2MeHIOsKCpfe0VbcWqtPhzKdzzmlIhcK4Xgujh-Msp9KagAkWDWYiClbQ-bk" class="w-14 h-14 object-contain drop-shadow" />` }
  ];

  const deck = [];
  symbols.forEach((sym) => {
    deck.push({ id: sym.id, content: sym.content });
    deck.push({ id: sym.id, content: sym.content });
  });

  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  memoryCards = deck;
  flippedCardIdxs = [];
  matchedCardIds = [];
  memoryWon = false;
}

function handleMemoryCardClick(idx) {
  if (flippedCardIdxs.length >= 2 || flippedCardIdxs.includes(idx)) return;
  const card = memoryCards[idx];
  if (matchedCardIds.includes(card.id)) return;

  Sound.click();
  flippedCardIdxs.push(idx);

  if (flippedCardIdxs.length === 2) {
    const card1 = memoryCards[flippedCardIdxs[0]];
    const card2 = memoryCards[flippedCardIdxs[1]];

    if (card1.id === card2.id) {
      // Matched!
      matchedCardIds.push(card1.id);
      flippedCardIdxs = [];
      Sound.coin();

      if (matchedCardIds.length === memoryCards.length) {
        memoryWon = true;
        Sound.fanfare();
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
        store.getState().selectedHero.coins += 25;
        store.saveState();
      }
      store.notify();
    } else {
      // Not matched - flip back after delay
      store.notify();
      setTimeout(() => {
        flippedCardIdxs = [];
        store.notify();
      }, 900);
    }
  } else {
    store.notify();
  }
}

function handleLearningAnswer(optIdx) {
  if (!selectedLearningGame) return;
  const diff = store.getState().selectedHero.gameDifficulty || 'medium';
  const challenges = getGameChallenges(selectedLearningGame, diff);
  const challenge = challenges[currentChallengeIdx];

  if (optIdx === challenge.answer) {
    Sound.fanfare();
    confetti({ particleCount: 40, spread: 50 });
    learningScore++;

    if (store.isEasyMode()) {
      voicePrompts.speakSuccess();
    }

    if (currentChallengeIdx + 1 < challenges.length) {
      currentChallengeIdx++;
      store.notify();

      if (store.isEasyMode()) {
        const nextChallenge = challenges[currentChallengeIdx];
        if (nextChallenge) {
          setTimeout(() => {
            voicePrompts.speakGuidance(selectedLearningGame.title, nextChallenge.question);
          }, 650);
        }
      }
    } else {
      // Completed all challenges!
      const rewardCoins = selectedLearningGame.rewardCoins || 30;
      const rewardXP = selectedLearningGame.rewardXP || 35;
      store.getState().selectedHero.coins += rewardCoins;
      store.addXP(rewardXP);
      store.saveState();

      store.showReward(
        `Academy Quest Complete! 🎓`,
        `You and your pet aced ${selectedLearningGame.title}!\n🪙 +${rewardCoins} Tokens & +${rewardXP} XP!`,
        rewardCoins,
        rewardXP
      );

      selectedLearningGame = null;
      currentChallengeIdx = 0;
      store.notify();
    }
  } else {
    Sound.hit();
    if (store.isEasyMode()) {
      voicePrompts.speakTryAgain();
    }
    store.notify();
  }
}
