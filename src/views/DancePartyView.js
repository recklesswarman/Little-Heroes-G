import { store } from '../state/store.js';
import { PETS_DATABASE } from '../data/petsData.js';
import { ADVENTURE_GAMES, getGameChallenges } from '../data/learningGamesData.js';
import { MOVEMENT_ROUTINES, getMovementRoutine } from '../data/movementRoutinesData.js';
import { movementSynth } from '../audio/movementAudioSynthesizer.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import { voicePrompts } from '../utils/voicePrompts.js';

// Helper to reliably get the pet's graphic
export function getPetDisplayAvatar(pet) {
  if (!pet) return PETS_DATABASE[0].avatar;
  if (pet.stage >= 3 && pet.evolvedAvatar) return pet.evolvedAvatar;
  return pet.avatar || pet.image || PETS_DATABASE[0].avatar;
}

// -------------------------------------------------------------
// State Machine for Movement Hub & Mini-Games
// -------------------------------------------------------------
let arcadeMode = 'hub'; // 'hub', 'movement_session', 'treat_catch', 'memory_match', 'learning_game', 'disco_party'

// 1. Movement Routine Session State
let activeRoutine = null;
let currentPoseIdx = 0;
let poseTimeLeft = 20;
let totalRoutineTimeLeft = 90;
let routineTimer = null;
let grooveCombo = 0; // 0 to 100%
let feverBurstsCount = 0;
let isFeverActive = false;
let isFreezeActive = false;
let routineCompleted = false;
let routineRewards = null;
let isMusicMuted = false;

// 2. Treat Popper State (Berry Popper)
let treatScore = 0;
let treatTimeLeft = 20;
let treatTimer = null;
let treatItems = [];
let treatGameActive = false;

// 3. Memory Match State
let memoryCards = [];
let flippedCardIdxs = [];
let matchedCardIds = [];
let memoryWon = false;

// 4. Learning Academy State (Legacy / Quick-Quest)
let selectedLearningGame = null;
let currentChallengeIdx = 0;
let learningScore = 0;

// 5. Disco Party State
let isDancing = false;
let discoStep = 0;

// 6. Pet Companion Interaction State
let petMood = 'Happy';
let petSpeech = 'Hi Hero! Pick a movement routine to stretch, dance, and earn Evolution Sparks together! ⚡';
let petAnimation = 'animate-bounce-slow';
let petHearts = false;

// -------------------------------------------------------------
// MAIN VIEW ENTRYPOINT
// -------------------------------------------------------------
export function renderDancePartyView() {
  const state = store.getState();
  const hero = state.selectedHero;
  const activePet = store.getActivePet();
  const hasPet = hero.unlockedPetIds && hero.unlockedPetIds.length > 0;
  const petAvatarUrl = getPetDisplayAvatar(activePet);
  const petName = hasPet ? activePet.name : 'Sparky (Movement Coach)';

  // ROUTE SUB-MODES
  if (arcadeMode === 'movement_session' && activeRoutine) {
    return renderMovementSession(hero, activePet, petAvatarUrl, petName);
  }
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

  // MAIN HERO MOVEMENT HUB
  const movementStats = store.getMovementStats ? store.getMovementStats() : { totalMinutes: 0, totalSessions: 0 };

  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in select-none">
      
      <!-- Top Navigation Header -->
      <div class="flex items-center justify-between">
        <button id="arcade-back-dash-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-black px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">arrow_back</span> Quests
        </button>

        <div class="flex items-center gap-2">
          <div class="bg-surface-container-high px-4 py-1.5 rounded-full border-2 border-primary-container text-xs font-black text-primary flex items-center gap-1.5 shadow-sm">
            <span class="material-symbols-outlined text-base animate-pulse">fitness_center</span>
            <span>HERO MOVEMENT & DANCE</span>
          </div>
        </div>

        <div class="flex items-center gap-2 bg-surface-container-high px-3.5 py-1.5 rounded-full border-2 border-secondary-container shadow-sm">
          <span class="material-symbols-outlined text-secondary text-base animate-coin" style="font-variation-settings: 'FILL' 1;">monetization_on</span>
          <span class="font-headline text-xs font-black text-secondary">${(hero.coins || 0).toLocaleString()} 🪙</span>
        </div>
      </div>

      <!-- PET DANCE PARTNER SPOTLIGHT -->
      <section class="relative bg-gradient-to-b from-[#152233] via-[#0f1b29] to-[#07111b] rounded-3xl p-5 sm:p-6 border-3 border-secondary/40 card-shadow flex flex-col items-center gap-5 overflow-hidden">
        
        <!-- Glowing Background -->
        <div class="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-secondary/15 pointer-events-none"></div>
        <div class="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/20 blur-3xl pointer-events-none"></div>

        <!-- Header Badges -->
        <div class="w-full flex justify-between items-center z-10">
          <div class="flex items-center gap-2 bg-surface-container-highest/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-primary border border-primary/30">
            <span class="material-symbols-outlined text-sm">pets</span>
            <span>${petName}</span>
            <span class="text-secondary text-[10px] uppercase font-bold">• Dance Duo</span>
          </div>

          <div class="flex items-center gap-1.5 bg-surface-container-highest/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-amber-400 border border-amber-500/30">
            <span class="material-symbols-outlined text-sm text-amber-400" style="font-variation-settings: 'FILL' 1;">bolt</span>
            <span class="font-black text-on-surface">Active Play: ${movementStats.totalMinutes} Mins</span>
          </div>
        </div>

        <!-- Center Pet Visual & Speech Bubble -->
        <div class="relative z-10 flex flex-col items-center gap-3 my-1">
          <div class="relative bg-surface-container-high/95 text-inverse-surface border-2 border-secondary/60 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black text-center max-w-sm shadow-md animate-float">
            ${petSpeech}
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-container-high border-r-2 border-b-2 border-secondary/60 rotate-45"></div>
          </div>

          <!-- Pet Avatar Actor -->
          <div id="arcade-pet-actor" class="relative cursor-pointer group select-none">
            <div class="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-gradient-to-b from-primary/20 to-surface-container-highest/80 border-4 border-primary p-2 flex items-center justify-center shadow-[0_0_30px_rgba(46,204,113,0.35)] transition-transform group-hover:scale-105 active:scale-95 ${petAnimation}">
              <img src="${petAvatarUrl}" alt="${petName}" class="w-full h-full object-contain drop-shadow-xl" />
            </div>

            ${
              petHearts
                ? `<div class="absolute -top-4 -right-2 text-2xl animate-bounce">💖</div>
                   <div class="absolute -top-2 -left-2 text-xl animate-pulse">✨</div>`
                : ''
            }

            <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-surface-container-high px-2.5 py-0.5 rounded-full border border-primary/40 text-[9px] font-black uppercase text-primary tracking-wider shadow">
              Tap to Warm Up!
            </div>
          </div>

          <!-- Quick Warmup Actions -->
          <div class="flex flex-wrap items-center justify-center gap-2 pt-2 z-10">
            <button id="pet-warmup-stretch-btn" class="bg-surface-container hover:bg-surface-bright text-amber-400 font-headline text-xs font-black px-3.5 py-2 rounded-xl border-2 border-amber-500/40 chunky-btn-sm flex items-center gap-1.5 active:scale-95">
              <span>🧘</span> Morning Stretch
            </button>
            <button id="pet-dance-spin-btn" class="bg-surface-container hover:bg-surface-bright text-primary font-headline text-xs font-black px-3.5 py-2 rounded-xl border-2 border-primary/40 chunky-btn-sm flex items-center gap-1.5 active:scale-95">
              <span>🌪️</span> Tornado Spin
            </button>
            <button id="pet-high-five-btn" class="bg-surface-container hover:bg-surface-bright text-secondary font-headline text-xs font-black px-3.5 py-2 rounded-xl border-2 border-secondary/40 chunky-btn-sm flex items-center gap-1.5 active:scale-95">
              <span>🐾</span> Hero High-Five
            </button>
          </div>
        </div>

      </section>

      <!-- 4 PEDIATRIC GUIDED MOVEMENT ROUTINES -->
      <section class="flex flex-col gap-4">
        <div class="flex justify-between items-center px-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary text-2xl" style="font-variation-settings: 'FILL' 1;">directions_run</span>
            <h2 class="font-headline text-xl font-black text-inverse-surface">Guided Movement Quests</h2>
          </div>
          <span class="text-xs font-bold text-secondary">+10 Evolution Sparks ⚡ per Routine</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${MOVEMENT_ROUTINES.map((routine) => `
            <div class="tactile-card bg-surface-container rounded-3xl p-5 border-3 ${routine.accentBg} flex flex-col justify-between gap-4 shadow-md hover:scale-[1.01] transition-transform">
              
              <div class="flex items-start gap-4">
                <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner border-2 border-surface-container-highest flex-shrink-0" style="background-color: ${routine.color}25; color: ${routine.color};">
                  <span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' 1;">${routine.icon}</span>
                </div>
                <div class="flex flex-col">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md text-white font-headline" style="background-color: ${routine.color};">${routine.badge}</span>
                    <span class="text-[10px] font-bold text-on-surface-variant">• 2 Mins</span>
                  </div>
                  <h3 class="font-headline text-lg font-black text-inverse-surface leading-tight mt-1">${routine.title}</h3>
                  <p class="text-xs text-on-surface-variant mt-1 line-clamp-2">${routine.pediatricDesc}</p>
                </div>
              </div>

              <!-- Pose Preview Icons -->
              <div class="flex items-center gap-2 bg-surface-container-low/70 px-3 py-2 rounded-2xl border border-surface-container-highest">
                <span class="text-[11px] font-bold text-on-surface-variant">Poses:</span>
                <div class="flex items-center gap-1.5 flex-wrap">
                  ${routine.poses.map(p => `
                    <span class="text-sm bg-surface-container px-2 py-0.5 rounded-lg border border-surface-container-highest shadow-sm" title="${p.name}">${p.emoji} ${p.name.split(' ')[0]}</span>
                  `).join('')}
                </div>
              </div>

              <!-- Footer Rewards & Launch Button -->
              <div class="flex items-center justify-between pt-3 border-t border-surface-container-highest">
                <div class="flex items-center gap-2 text-xs font-black text-secondary">
                  <span>+40 🪙</span>
                  <span>•</span>
                  <span>+60 XP ⭐</span>
                  <span>•</span>
                  <span class="text-amber-400 font-bold">+10 ⚡ Sparks</span>
                </div>
                <button data-launch-routine-id="${routine.id}" class="launch-routine-btn ${routine.buttonClass} font-headline text-xs font-black px-6 py-2.5 rounded-xl chunky-btn shadow-chunky-sm active:scale-95 hover:brightness-110">
                  LET'S MOVE!
                </button>
              </div>

            </div>
          `).join('')}
        </div>
      </section>

      <!-- CLASSIC PET ARCADE CABINETS ACCORDION -->
      <section class="flex flex-col gap-3.5 pt-2">
        <div class="flex justify-between items-center px-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-2xl" style="font-variation-settings: 'FILL' 1;">sports_esports</span>
            <h2 class="font-headline text-lg font-black text-inverse-surface">Classic Mini-Game Cabinets</h2>
          </div>
          <span class="text-xs font-bold text-on-surface-variant">Quick Fun & High Scores</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          <!-- Berry Popper -->
          <button id="launch-treat-catch-btn" class="bg-surface-container hover:bg-surface-bright rounded-2xl p-4 border-2 border-secondary/40 flex items-center gap-3 text-left chunky-btn-sm active:scale-95">
            <div class="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-2xl flex-shrink-0">
              🎯
            </div>
            <div class="flex flex-col">
              <span class="font-headline text-xs font-black text-inverse-surface">Berry Popper</span>
              <span class="text-[11px] text-on-surface-variant">Pop fruit bubbles & feed pet</span>
            </div>
          </button>

          <!-- Memory Match -->
          <button id="launch-memory-match-btn" class="bg-surface-container hover:bg-surface-bright rounded-2xl p-4 border-2 border-primary/40 flex items-center gap-3 text-left chunky-btn-sm active:scale-95">
            <div class="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-2xl flex-shrink-0">
              🃏
            </div>
            <div class="flex flex-col">
              <span class="font-headline text-xs font-black text-inverse-surface">Memory Match</span>
              <span class="text-[11px] text-on-surface-variant">Pair companion cards</span>
            </div>
          </button>

          <!-- Freestyle Disco Dance Floor -->
          <button id="launch-disco-party-btn" class="bg-surface-container hover:bg-surface-bright rounded-2xl p-4 border-2 border-cyan-500/40 flex items-center gap-3 text-left chunky-btn-sm active:scale-95">
            <div class="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-2xl flex-shrink-0">
              🪩
            </div>
            <div class="flex flex-col">
              <span class="font-headline text-xs font-black text-inverse-surface">Disco Floor</span>
              <span class="text-[11px] text-on-surface-variant">Rhythm pads & confetti DJ</span>
            </div>
          </button>

        </div>
      </section>

    </div>
  `;
}

// -------------------------------------------------------------
// SUB-VIEW: GUIDED MOVEMENT ROUTINE SESSION ARENA
// -------------------------------------------------------------
function renderMovementSession(hero, activePet, petAvatarUrl, petName) {
  const routine = activeRoutine || MOVEMENT_ROUTINES[0];
  const poses = routine.poses || [];
  const currentPose = poses[currentPoseIdx] || poses[0];

  // If completed, show celebration screen
  if (routineCompleted) {
    return `
      <div class="max-w-2xl mx-auto px-4 pt-6 pb-28 flex flex-col items-center text-center gap-6 animate-fade-in select-none">
        <div class="w-24 h-24 rounded-3xl bg-amber-500/20 border-4 border-amber-500 flex items-center justify-center text-5xl shadow-[0_0_40px_rgba(245,158,11,0.4)] animate-bounce">
          🏆
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-xs font-black uppercase text-amber-400 tracking-wider">Gross Motor Milestone Achieved!</span>
          <h1 class="font-headline text-3xl font-black text-inverse-surface">${routine.title} Mastered!</h1>
          <p class="text-sm text-on-surface-variant max-w-md">${routine.pediatricMarker} practiced! Your body and brain are strong, balanced, and energized!</p>
        </div>

        <!-- Reward Breakdown Card -->
        <div class="w-full bg-surface-container rounded-3xl p-6 border-3 border-primary/40 flex flex-col gap-4 shadow-lg">
          <h3 class="font-headline text-sm font-black text-primary uppercase">Movement Quest Rewards</h3>
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-surface-container-high p-3 rounded-2xl border border-surface-container-highest flex flex-col items-center">
              <span class="text-2xl">🪙</span>
              <span class="font-headline text-base font-black text-secondary mt-1">+40 Tokens</span>
              <span class="text-[10px] text-on-surface-variant">Coins Earned</span>
            </div>
            <div class="bg-surface-container-high p-3 rounded-2xl border border-surface-container-highest flex flex-col items-center">
              <span class="text-2xl">⭐</span>
              <span class="font-headline text-base font-black text-primary mt-1">+60 XP</span>
              <span class="text-[10px] text-on-surface-variant">Adventure XP</span>
            </div>
            <div class="bg-surface-container-high p-3 rounded-2xl border border-amber-500/50 flex flex-col items-center bg-amber-500/10">
              <span class="text-2xl animate-pulse">⚡</span>
              <span class="font-headline text-base font-black text-amber-400 mt-1">+10 Sparks</span>
              <span class="text-[10px] text-amber-300">Evolution Sparks</span>
            </div>
          </div>

          <div class="text-xs text-on-surface-variant flex items-center justify-center gap-2 pt-2 border-t border-surface-container-highest">
            <span>🐾 ${petName}: +25 Joy & +20 Energy</span>
            <span>•</span>
            <span>Fever Bursts: ${feverBurstsCount} 💥</span>
          </div>
        </div>

        <button id="movement-exit-to-hub-btn" class="w-full bg-primary text-on-primary font-headline text-base font-black py-4 rounded-2xl chunky-btn border-primary-container shadow-chunky active:scale-95">
          BACK TO MOVEMENT HUB 🌟
        </button>
      </div>
    `;
  }

  return `
    <div class="max-w-3xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-5 animate-fade-in select-none">
      
      <!-- Top Session Bar -->
      <div class="flex items-center justify-between">
        <button id="movement-exit-to-hub-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-black px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">arrow_back</span> Hub
        </button>

        <div class="flex items-center gap-2">
          <span class="font-headline text-xs sm:text-sm font-black text-secondary px-3 py-1 bg-surface-container rounded-full border border-secondary/40">
            ${routine.badge}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <!-- Audio Mute Toggle -->
          <button id="movement-toggle-audio-btn" class="bg-surface-container hover:bg-surface-bright px-3 py-1.5 rounded-xl border border-surface-container-highest text-xs font-black flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">${isMusicMuted ? 'volume_off' : 'volume_up'}</span>
            <span>${isMusicMuted ? 'Muted' : 'Music ON'}</span>
          </button>

          <!-- Countdown Timer -->
          <div class="bg-surface-container-high px-3.5 py-1.5 rounded-full border-2 border-primary text-xs font-black text-primary flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">timer</span>
            <span id="movement-total-timer-val">${totalRoutineTimeLeft}s</span>
          </div>
        </div>
      </div>

      <!-- MAIN INTERACTIVE ARENA -->
      <div class="relative bg-gradient-to-b from-[#132233] via-[#0c1a26] to-[#040e17] rounded-3xl p-5 sm:p-7 border-4 ${isFreezeActive ? 'border-cyan-400 shadow-[0_0_35px_rgba(34,211,238,0.5)]' : 'border-secondary/40'} min-h-[460px] card-shadow flex flex-col justify-between items-center overflow-hidden transition-all duration-300">
        
        <!-- Ambient Stage Glow -->
        <div class="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-secondary/15 pointer-events-none"></div>

        <!-- FREEZE DANCE OVERLAY (Active only during freeze moments) -->
        ${isFreezeActive ? `
          <div class="absolute inset-0 bg-cyan-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div class="w-24 h-24 rounded-full bg-cyan-400/30 border-4 border-cyan-300 flex items-center justify-center text-5xl mb-3 animate-pulse shadow-[0_0_50px_rgba(34,211,238,0.7)]">
              🧊
            </div>
            <h2 class="font-headline text-3xl font-black text-cyan-200 tracking-wider animate-bounce">FREEZE LIKE ICE!</h2>
            <p class="text-sm font-bold text-cyan-100 mt-2 max-w-xs">Don't move a single muscle! Hold your hero pose until Rex says GO!</p>
            <button id="freeze-resume-btn" class="mt-4 bg-cyan-400 text-cyan-950 font-headline text-xs font-black px-6 py-2.5 rounded-xl chunky-btn shadow active:scale-95">
              UNFREEZE & DANCE! ⚡
            </button>
          </div>
        ` : ''}

        <!-- Top Progress Header -->
        <div class="w-full flex justify-between items-center z-10">
          <div class="flex items-center gap-2">
            <span class="bg-surface-container-highest/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-secondary border border-secondary/30">
              Pose ${currentPoseIdx + 1} of ${poses.length}
            </span>
            <span class="text-[10px] font-bold text-on-surface-variant bg-surface-container/80 px-2 py-0.5 rounded-md">
              ${currentPose.targetPillar}
            </span>
          </div>

          <div class="flex items-center gap-1.5 bg-surface-container-highest/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-amber-400 border border-amber-400/30">
            <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">bolt</span>
            <span>Groove Combo: ${grooveCombo}%</span>
          </div>
        </div>

        <!-- Pose Instruction Hero Card -->
        <div class="relative z-10 w-full max-w-md bg-surface-container-high/95 backdrop-blur-md border-3 border-secondary/60 rounded-2xl p-4 text-center shadow-lg my-2">
          <div class="flex items-center justify-center gap-2">
            <span class="text-3xl">${currentPose.emoji}</span>
            <h2 class="font-headline text-lg sm:text-xl font-black text-inverse-surface">${currentPose.name}</h2>
          </div>
          <p class="text-xs sm:text-sm font-bold text-on-surface-variant mt-1.5">${currentPose.instruction}</p>
          
          <!-- Pose Countdown Bar -->
          <div class="w-full bg-surface-container-lowest h-2.5 rounded-full overflow-hidden mt-3 border border-surface-container-highest">
            <div class="bg-gradient-to-r from-amber-400 to-orange-500 h-full transition-all duration-300 rounded-full" style="width: ${Math.max(5, (poseTimeLeft / (currentPose.duration || 20)) * 100)}%;"></div>
          </div>
          <span class="text-[10px] font-black text-amber-400 uppercase tracking-wider block mt-1">Pose Timer: ${poseTimeLeft}s</span>
        </div>

        <!-- DUAL DANCING AVATARS STAGE -->
        <div class="relative z-10 flex items-center justify-center gap-8 sm:gap-14 my-3 w-full">
          
          <!-- Hero Dancing Actor -->
          <div class="flex flex-col items-center gap-2">
            <div id="movement-hero-actor" class="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-primary-container/30 border-4 border-primary overflow-hidden flex items-center justify-center shadow-xl transition-transform duration-200 ${isFreezeActive ? '' : 'animate-bounce'}">
              <img src="${hero.avatar}" alt="${hero.name}" class="w-full h-full object-cover" />
            </div>
            <span class="text-xs font-black text-on-surface font-headline">${hero.name}</span>
          </div>

          <!-- Sparkle / Sync Connector -->
          <div class="flex flex-col items-center">
            <span class="text-2xl animate-pulse">${isFeverActive ? '💥' : '⚡'}</span>
            <span class="text-[10px] font-black uppercase text-secondary tracking-widest">${isFeverActive ? 'FEVER!' : 'IN SYNC'}</span>
          </div>

          <!-- Companion Dancing Actor -->
          <div class="flex flex-col items-center gap-2">
            <div id="movement-pet-actor" class="w-26 h-26 sm:w-30 sm:h-30 rounded-full bg-tertiary-container/30 border-4 border-secondary p-2 flex items-center justify-center shadow-2xl transition-transform duration-200 ${isFreezeActive ? '' : 'animate-bounce-slow'}">
              <img src="${petAvatarUrl}" alt="${petName}" class="w-full h-full object-contain drop-shadow" />
            </div>
            <span class="text-xs font-black text-secondary font-headline">${petName}</span>
          </div>

        </div>

        <!-- GROOVE COMBO & FEVER BURST METER -->
        <div class="w-full max-w-md z-10 flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-xs font-black px-1">
            <span class="text-secondary flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">electric_bolt</span> Groove Energy
            </span>
            <span class="${isFeverActive ? 'text-amber-400 font-extrabold animate-pulse' : 'text-on-surface-variant'}">
              ${isFeverActive ? '🔥 FEVER BURST ACTIVE! +10 SPARKS!' : `${grooveCombo}% / 100%`}
            </span>
          </div>
          <div class="w-full bg-surface-container-lowest h-4 rounded-full overflow-hidden border-2 border-surface-container-highest p-0.5">
            <div class="${isFeverActive ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-500 animate-pulse' : 'bg-gradient-to-r from-primary to-secondary'} h-full rounded-full transition-all duration-300" style="width: ${grooveCombo}%;"></div>
          </div>
        </div>

        <!-- 4 TACTILE RHYTHM BEAT PADS -->
        <div class="w-full max-w-lg grid grid-cols-4 gap-2 sm:gap-3 z-10 pt-3">
          <button data-rhythm-pad="bounce" class="rhythm-pad-btn h-14 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-700 border-b-4 border-emerald-900 text-white font-headline text-xs font-black shadow-md active:translate-y-1 active:border-b-0 flex flex-col items-center justify-center">
            <span class="text-base">🟢</span>
            <span>BOUNCE</span>
          </button>
          
          <button data-rhythm-pad="spin" class="rhythm-pad-btn h-14 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 border-b-4 border-blue-900 text-white font-headline text-xs font-black shadow-md active:translate-y-1 active:border-b-0 flex flex-col items-center justify-center">
            <span class="text-base">🔵</span>
            <span>TWIRL</span>
          </button>
          
          <button data-rhythm-pad="pose" class="rhythm-pad-btn h-14 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 border-b-4 border-amber-800 text-amber-950 font-headline text-xs font-black shadow-md active:translate-y-1 active:border-b-0 flex flex-col items-center justify-center">
            <span class="text-base">🟡</span>
            <span>POSE</span>
          </button>

          <button data-rhythm-pad="fever" class="rhythm-pad-btn h-14 rounded-2xl bg-gradient-to-b from-purple-500 to-purple-700 border-b-4 border-purple-900 text-white font-headline text-xs font-black shadow-md active:translate-y-1 active:border-b-0 flex flex-col items-center justify-center">
            <span class="text-base animate-pulse">⚡</span>
            <span>FEVER!</span>
          </button>
        </div>

      </div>

      <!-- Coach Prompts & Manual Pose Skip Controls -->
      <div class="flex items-center justify-between bg-surface-container rounded-2xl p-4 border border-surface-container-highest">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl">
            🦖
          </div>
          <span class="text-xs font-bold text-on-surface leading-tight max-w-xs sm:max-w-md">
            Rex Coach: "${currentPose.coachSpeech}"
          </span>
        </div>

        <button id="movement-next-pose-btn" class="bg-surface-container-high hover:bg-surface-bright text-primary font-headline text-xs font-black px-4 py-2.5 rounded-xl border border-primary/40 chunky-btn-sm active:scale-95 flex items-center gap-1">
          <span>Next</span> <span class="material-symbols-outlined text-sm">skip_next</span>
        </button>
      </div>

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
          <span class="material-symbols-outlined text-base">arrow_back</span> Movement Hub
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
        
        <div class="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-secondary/15 pointer-events-none"></div>

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
        </div>

      </div>

      <!-- Footer Controls -->
      <div class="flex items-center justify-between gap-4">
        <button id="start-treat-game-btn" class="flex-1 bg-primary text-on-primary font-headline text-xs font-black py-3 rounded-2xl chunky-btn border-primary-container shadow-chunky-sm active:scale-95">
          ${treatGameActive ? 'RESTART ROUND' : 'START ROUND (20s)'}
        </button>
      </div>

    </div>
  `;
}

// -------------------------------------------------------------
// SUB-VIEW 2: HERO MEMORY MATCH GAME
// -------------------------------------------------------------
function renderMemoryMatchGame(hero, activePet, petAvatarUrl, petName) {
  return `
    <div class="max-w-2xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-5 animate-fade-in select-none">
      
      <!-- Top Bar -->
      <div class="flex items-center justify-between">
        <button id="game-exit-to-hub-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-black px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">arrow_back</span> Movement Hub
        </button>

        <h1 class="font-headline text-lg font-black text-inverse-surface">Memory Match</h1>

        <button id="reset-memory-game-btn" class="bg-surface-container-high text-primary font-headline text-xs font-black px-3 py-1.5 rounded-xl border border-primary/40 active:scale-95">
          Reset 🔄
        </button>
      </div>

      <!-- Memory Grid -->
      <div class="bg-gradient-to-b from-[#131b26] to-[#0a111a] rounded-3xl p-6 border-3 border-primary/40 card-shadow flex flex-col items-center gap-4">
        
        <div class="w-full text-center text-xs font-black text-primary bg-surface-container-highest/80 px-4 py-2 rounded-xl">
          ${memoryWon ? '🎉 All Pairs Matched! +25 Tokens Awarded!' : 'Find all 4 matching pairs of companion heroes!'}
        </div>

        <div class="grid grid-cols-4 gap-3 w-full max-w-md my-2">
          ${memoryCards.map((card, idx) => {
            const isFlipped = flippedCardIdxs.includes(idx) || matchedCardIds.includes(card.id);
            return `
              <button data-memory-card-idx="${idx}" class="memory-card-btn h-20 sm:h-24 rounded-2xl border-3 ${
                isFlipped ? 'bg-surface-container-high border-secondary text-3xl sm:text-4xl' : 'bg-surface-container border-surface-container-highest text-xl text-primary font-black'
              } flex items-center justify-center shadow-md active:scale-95 transition-transform">
                ${isFlipped ? card.icon : '❓'}
              </button>
            `;
          }).join('')}
        </div>

      </div>

    </div>
  `;
}

// -------------------------------------------------------------
// SUB-VIEW 3: LEARNING ACADEMY (Legacy Adapter)
// -------------------------------------------------------------
function renderLearningGame(hero, activePet, petAvatarUrl, petName) {
  return `
    <div class="max-w-2xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-5 animate-fade-in select-none">
      <div class="flex items-center justify-between">
        <button id="game-exit-to-hub-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-black px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">arrow_back</span> Movement Hub
        </button>
        <h1 class="font-headline text-lg font-black text-inverse-surface">Learning Adventures</h1>
        <div></div>
      </div>

      <div class="bg-surface-container rounded-3xl p-6 border-3 border-secondary/40 text-center flex flex-col items-center gap-4">
        <span class="text-5xl">🧭</span>
        <h2 class="font-headline text-xl font-black text-inverse-surface">Full Learning Realms Available!</h2>
        <p class="text-xs text-on-surface-variant max-w-sm">Explore the 5 comprehensive curriculum realms with 3-Star Mastery on the Adventures Map!</p>
        <button id="open-adventures-map-btn" class="bg-primary text-on-primary font-headline text-xs font-black px-6 py-3 rounded-2xl chunky-btn border-primary-container shadow active:scale-95">
          OPEN ADVENTURES MAP 🚀
        </button>
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
          <span class="material-symbols-outlined text-base">arrow_back</span> Movement Hub
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
            <span class="material-symbols-outlined text-sm">celebration</span> Streak: ${hero.streak || 1} Days
          </span>
        </div>

        <!-- Dancing Duo Character Visuals -->
        <div class="relative my-4 z-10 flex items-center justify-center gap-6">
          <div id="disco-hero-actor" class="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-primary-container/30 border-4 border-primary overflow-hidden flex items-center justify-center shadow-xl ${
            isDancing ? 'animate-bounce' : 'animate-float'
          }">
            <img src="${hero.avatar}" alt="${hero.name}" class="w-full h-full object-cover" />
          </div>

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
        } font-headline text-xs font-black py-3 rounded-2xl chunky-btn shadow-chunky-sm active:scale-95 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-base">${isDancing ? 'pause' : 'play_arrow'}</span>
          <span>${isDancing ? 'PAUSE DISCO BEAT' : 'START PARTY MUSIC!'}</span>
        </button>

        <button id="disco-fire-confetti-btn" class="w-full sm:w-1/2 bg-surface-container-highest hover:bg-surface-bright text-on-surface font-headline text-xs font-black py-3 rounded-2xl border-2 border-surface-container-highest chunky-btn-sm active:scale-95 flex items-center justify-center gap-2">
          <span>🎉</span> <span>BLAST CONFETTI (+5 🪙)</span>
        </button>
      </section>

    </div>
  `;
}

// -------------------------------------------------------------
// EVENT LISTENERS & LIFECYCLE CONTROLS
// -------------------------------------------------------------
export function attachDancePartyEvents() {
  // Navigation Back to Dash
  const backDashBtn = document.getElementById('arcade-back-dash-btn');
  if (backDashBtn) {
    backDashBtn.addEventListener('click', () => {
      cleanupMovementSession();
      cleanupTimers();
      store.setView('dashboard');
    });
  }

  // Navigation Back to Movement Hub
  const exitToHubBtn = document.getElementById('game-exit-to-hub-btn');
  if (exitToHubBtn) {
    exitToHubBtn.addEventListener('click', () => {
      cleanupMovementSession();
      cleanupTimers();
      arcadeMode = 'hub';
      store.notify();
    });
  }

  const movementExitBtn = document.getElementById('movement-exit-to-hub-btn');
  if (movementExitBtn) {
    movementExitBtn.addEventListener('click', () => {
      cleanupMovementSession();
      arcadeMode = 'hub';
      store.notify();
    });
  }

  const openAdvMapBtn = document.getElementById('open-adventures-map-btn');
  if (openAdvMapBtn) {
    openAdvMapBtn.addEventListener('click', () => {
      cleanupMovementSession();
      store.setView('adventures_map');
    });
  }

  // --- WARMUP PET INTERACTIONS ---
  const petActor = document.getElementById('arcade-pet-actor');
  if (petActor) {
    petActor.addEventListener('click', () => {
      Sound.chirp();
      petMood = 'Ecstatic! ❤️';
      petSpeech = 'Hehehe! That tickles! Let\'s stretch our superhero muscles!';
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

  const warmupStretchBtn = document.getElementById('pet-warmup-stretch-btn');
  if (warmupStretchBtn) {
    warmupStretchBtn.addEventListener('click', () => {
      Sound.chirp();
      petSpeech = 'Big stretch up high! ☀️ Waking up our hero energy!';
      petAnimation = 'animate-bounce';
      confetti({ particleCount: 25, spread: 40, origin: { y: 0.6 } });
      setTimeout(() => { petAnimation = 'animate-bounce-slow'; store.notify(); }, 1200);
      store.notify();
    });
  }

  const danceSpinBtn = document.getElementById('pet-dance-spin-btn');
  if (danceSpinBtn) {
    danceSpinBtn.addEventListener('click', () => {
      Sound.laser();
      petSpeech = 'Tornado Spin! Whoooosh! Look at that rotation!';
      petAnimation = 'animate-spin';
      setTimeout(() => { petAnimation = 'animate-bounce-slow'; store.notify(); }, 1000);
      store.notify();
    });
  }

  const highFiveBtn = document.getElementById('pet-high-five-btn');
  if (highFiveBtn) {
    highFiveBtn.addEventListener('click', () => {
      Sound.coin();
      petSpeech = 'Hero High-Five! 🐾 You and me are the ultimate team!';
      petHearts = true;
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
      setTimeout(() => { petHearts = false; store.notify(); }, 1200);
      store.notify();
    });
  }

  // --- LAUNCH GUIDED MOVEMENT ROUTINES ---
  document.querySelectorAll('.launch-routine-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const routineId = btn.getAttribute('data-launch-routine-id');
      startMovementRoutine(routineId);
    });
  });

  // --- MOVEMENT SESSION INTERACTIONS ---
  const toggleAudioBtn = document.getElementById('movement-toggle-audio-btn');
  if (toggleAudioBtn) {
    toggleAudioBtn.addEventListener('click', () => {
      isMusicMuted = !isMusicMuted;
      if (isMusicMuted) {
        movementSynth.setVolume(0);
      } else {
        movementSynth.setVolume(0.4);
      }
      Sound.click();
      store.notify();
    });
  }

  const nextPoseBtn = document.getElementById('movement-next-pose-btn');
  if (nextPoseBtn) {
    nextPoseBtn.addEventListener('click', () => {
      advanceNextPose();
    });
  }

  const freezeResumeBtn = document.getElementById('freeze-resume-btn');
  if (freezeResumeBtn) {
    freezeResumeBtn.addEventListener('click', () => {
      isFreezeActive = false;
      movementSynth.unfreezeMusic();
      advanceNextPose();
    });
  }

  // Rhythm Pads (Bounce, Spin, Pose, Fever)
  document.querySelectorAll('.rhythm-pad-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const padType = btn.getAttribute('data-rhythm-pad');
      handleRhythmPadPress(padType);
    });
  });

  // --- LAUNCH CLASSIC ARCADE CABINETS ---
  const launchTreatBtn = document.getElementById('launch-treat-catch-btn');
  if (launchTreatBtn) {
    launchTreatBtn.addEventListener('click', () => {
      cleanupMovementSession();
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
      cleanupMovementSession();
      arcadeMode = 'memory_match';
      initMemoryGame();
      Sound.click();
      store.notify();
    });
  }

  const launchDiscoBtn = document.getElementById('launch-disco-party-btn');
  if (launchDiscoBtn) {
    launchDiscoBtn.addEventListener('click', () => {
      cleanupMovementSession();
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

export const attachDancePartyListeners = attachDancePartyEvents;

// -------------------------------------------------------------
// MOVEMENT ROUTINE ENGINE CONTROLS
// -------------------------------------------------------------
function startMovementRoutine(routineId) {
  cleanupMovementSession();
  activeRoutine = getMovementRoutine(routineId);
  currentPoseIdx = 0;
  totalRoutineTimeLeft = activeRoutine.durationSec || 90;
  grooveCombo = 0;
  feverBurstsCount = 0;
  isFeverActive = false;
  isFreezeActive = false;
  routineCompleted = false;
  routineRewards = null;
  arcadeMode = 'movement_session';

  const firstPose = activeRoutine.poses[0];
  poseTimeLeft = firstPose ? firstPose.duration : 20;

  // Start Procedural Web Audio Music Track
  if (!isMusicMuted) {
    movementSynth.setVolume(0.4);
    movementSynth.startMusic(activeRoutine.musicTheme || 'sunshine_funk', activeRoutine.bpm || 112);
  }

  // Voice Prompts for first pose
  if (firstPose) {
    voicePrompts.speak(firstPose.coachSpeech);
  }

  // Master Timer Loop
  routineTimer = setInterval(() => {
    if (isFreezeActive) return; // Freeze pauses the timers

    if (totalRoutineTimeLeft > 0) {
      totalRoutineTimeLeft--;
      const el = document.getElementById('movement-total-timer-val');
      if (el) el.textContent = `${totalRoutineTimeLeft}s`;
    }

    if (poseTimeLeft > 1) {
      poseTimeLeft--;
      store.notify();
    } else {
      advanceNextPose();
    }

    if (totalRoutineTimeLeft <= 0) {
      finishMovementRoutine();
    }
  }, 1000);

  Sound.click();
  store.notify();
}

function advanceNextPose() {
  if (!activeRoutine) return;
  const poses = activeRoutine.poses || [];

  if (currentPoseIdx < poses.length - 1) {
    currentPoseIdx++;
    const nextP = poses[currentPoseIdx];
    poseTimeLeft = nextP.duration || 20;

    // Check for Freeze Dance
    if (nextP.actionType === 'freeze') {
      isFreezeActive = true;
      movementSynth.freezeMusic();
      voicePrompts.speak("FREEZE! Hold still like an ice statue!");
    } else {
      isFreezeActive = false;
      voicePrompts.speak(nextP.coachSpeech);
    }

    Sound.pop();
  } else {
    finishMovementRoutine();
  }
  store.notify();
}

function handleRhythmPadPress(padType) {
  if (isFreezeActive && padType !== 'fever') {
    Sound.chirp();
    return;
  }

  if (padType === 'bounce') Sound.pop();
  else if (padType === 'spin') Sound.laser();
  else if (padType === 'pose') Sound.coin();
  else Sound.chirp();

  // Animate dancing actors
  const hActor = document.getElementById('movement-hero-actor');
  const pActor = document.getElementById('movement-pet-actor');
  if (hActor && pActor) {
    hActor.style.transform = 'scale(1.15) translateY(-8px)';
    pActor.style.transform = 'scale(1.2) rotate(15deg)';
    setTimeout(() => {
      if (hActor) hActor.style.transform = '';
      if (pActor) pActor.style.transform = '';
    }, 250);
  }

  // Increment Groove Combo
  grooveCombo = Math.min(100, grooveCombo + 15);
  if (grooveCombo >= 100 && !isFeverActive) {
    triggerFeverBurst();
  }

  store.notify();
}

function triggerFeverBurst() {
  isFeverActive = true;
  feverBurstsCount++;
  movementSynth.playFeverFanfare();
  voicePrompts.speak("FEVER BURST! Look at that rhythm power!");

  confetti({
    particleCount: 150,
    spread: 120,
    origin: { y: 0.5 },
    colors: ['#f39c12', '#e74c3c', '#9b59b6', '#2ecc71', '#00bcd4']
  });

  setTimeout(() => {
    isFeverActive = false;
    grooveCombo = 20;
    store.notify();
  }, 4500);
}

function finishMovementRoutine() {
  if (routineCompleted) return;
  cleanupMovementSession();
  routineCompleted = true;

  const durationMinutes = Math.max(1, Math.round((activeRoutine.durationSec || 90) / 60));
  const posesCompleted = (activeRoutine.poses || []).length;

  // Award rewards through store and sync with Parent Portal
  routineRewards = store.completeMovementRoutine(
    activeRoutine.id,
    durationMinutes,
    posesCompleted,
    Math.max(1, feverBurstsCount)
  );

  voicePrompts.speak(`Incredible job, Little Hero! You mastered ${activeRoutine.title}!`);
  store.notify();
}

function cleanupMovementSession() {
  if (routineTimer) {
    clearInterval(routineTimer);
    routineTimer = null;
  }
  movementSynth.stopMusic();
  voicePrompts.stop();
  isFreezeActive = false;
  isFeverActive = false;
}

// -------------------------------------------------------------
// TREAT CATCH & MEMORY MATCH HELPERS
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
      store.saveState(true);
      store.notify();
    }
  }, 1000);
}

function initMemoryGame() {
  const icons = ['🐉', '🦖', '🐢', '🦄', '⭐', '🛡️', '⚡', '👑'];
  const deck = [];
  for (let i = 0; i < 4; i++) {
    deck.push({ id: i, icon: icons[i] });
    deck.push({ id: i, icon: icons[i] });
  }
  memoryCards = deck.sort(() => Math.random() - 0.5);
  flippedCardIdxs = [];
  matchedCardIds = [];
  memoryWon = false;
}

function handleMemoryCardClick(idx) {
  if (flippedCardIdxs.length >= 2 || flippedCardIdxs.includes(idx)) return;
  const card = memoryCards[idx];
  if (matchedCardIds.includes(card.id)) return;

  Sound.pop();
  flippedCardIdxs.push(idx);

  if (flippedCardIdxs.length === 2) {
    const card1 = memoryCards[flippedCardIdxs[0]];
    const card2 = memoryCards[flippedCardIdxs[1]];

    if (card1.id === card2.id) {
      Sound.chirp();
      matchedCardIds.push(card1.id);
      flippedCardIdxs = [];
      if (matchedCardIds.length === 4) {
        memoryWon = true;
        Sound.fanfare();
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        store.getState().selectedHero.coins += 25;
        store.saveState(true);
      }
    } else {
      setTimeout(() => {
        flippedCardIdxs = [];
        store.notify();
      }, 900);
    }
  }
  store.notify();
}
