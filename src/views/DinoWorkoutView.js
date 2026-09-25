/**
 * DinoWorkoutView.js
 * 
 * Companion Hero Workout & Gross-Motor Training Studio
 * Features a Daily Rotating Pet Coach from the 24 companions.
 * Rewards Pet Training XP (Level 1-25) and Hero Coins.
 * Zero pink/purple palette (Electric Cyan, Emerald Mint, Solar Amber, Dark Slate).
 */

import { store } from '../state/store.js';
import { getPetById, getDailyRotatingPetCoach } from '../data/petsData.js';
import { PetSanctuaryCanvas } from '../components/PetSanctuaryCanvas.js';
import { speakCompanion } from '../services/voiceService.js';
import confetti from 'canvas-confetti';
import { registerActiveCanvas } from '../utils/activeViewCanvasRegistry.js';
import { Sound } from '../audio/sfx.js';

let activeCanvasInstance = null;
let timerInterval = null;
let isWorkingOut = false;
let countdown = 30;
let hasSpokenMidpoint = false;

// Difficulty tiers reuse each kid's existing gameDifficulty
// (easy = Toddler 3-4, medium = Kids 5-6, hard = Kids 7-9).
const WORKOUT_DIFFICULTY = {
  easy: { duration: 20, coins: 40, xp: 40 },
  medium: { duration: 30, coins: 50, xp: 50 },
  hard: { duration: 45, coins: 65, xp: 65 }
};
function getDifficultyTier(hero) {
  const tier = hero?.gameDifficulty;
  return ['easy', 'medium', 'hard'].includes(tier) ? tier : 'medium';
}
function isToddlerHero(hero) {
  return store.isEasyMode ? store.isEasyMode() : getDifficultyTier(hero) === 'easy';
}

export function renderDinoWorkoutView() {
  const hero = store.getState().selectedHero || {};
  const activePetId = hero?.activePetId || '1';
  const activePet = getPetById(activePetId) || store.getActivePet();
  const dailyCoach = getDailyRotatingPetCoach();

  // Prefer daily coach for instruction and mascot presentation
  const coach = dailyCoach || activePet;
  const signature = coach.signatureMove || 'Hero Stomp & Power Roar';
  const workoutDesc = coach.workoutDesc || 'Jump, march, and follow the coach rhythm!';
  const cfg = WORKOUT_DIFFICULTY[getDifficultyTier(hero)];

  return `
    <div class="p-4 sm:p-6 min-h-screen flex flex-col bg-surface-container-lowest text-on-background select-none font-body pb-28">
      
      <!-- Top Bar: Title & Exit -->
      <div class="flex items-center justify-between mb-4 max-w-xl mx-auto w-full">
        <div class="flex items-center gap-2.5">
          <div class="w-11 h-11 rounded-2xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-amber-300">
            <span class="material-symbols-outlined text-2xl">fitness_center</span>
          </div>
          <div>
            <h2 class="font-headline font-black text-2xl text-on-surface">Pet Coach Workout</h2>
            <span class="text-xs font-bold text-secondary">Gross-Motor Training • Daily Coach</span>
          </div>
        </div>

        <button 
          id="btn-close-workout" 
          class="w-11 h-11 rounded-2xl bg-surface-container hover:bg-surface-bright text-on-surface border-2 border-surface-container-highest flex items-center justify-center shadow-sm active:scale-95 transition-all" 
          aria-label="Exit Workout"
        >
          <span class="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      <!-- Main Workout Stage Card -->
      <div class="max-w-xl mx-auto w-full bg-surface-container rounded-3xl p-6 flex-1 flex flex-col items-center justify-between border-2 border-surface-container-highest shadow-2xl relative overflow-hidden">
        
        <!-- Daily Coach Header Banner -->
        <div class="flex items-center gap-3 bg-surface-container-lowest/80 px-4 py-2.5 rounded-2xl border border-amber-400/40 w-full mb-3 shadow-inner">
          <div class="w-12 h-12 rounded-xl bg-surface-container border border-amber-400/60 flex items-center justify-center p-1 flex-shrink-0">
            <img src="${coach.avatar || `assets/pets/${coach.key || 'rex'}.png`}" alt="${coach.name}" class="w-full h-full object-contain filter drop-shadow">
          </div>
          <div class="flex flex-col text-left min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-300 font-black text-[9px] uppercase border border-amber-400/40">Daily Coach</span>
              <span class="font-headline font-black text-sm text-on-surface truncate">Coach ${coach.name}</span>
            </div>
            <span class="text-xs font-bold text-secondary truncate">${coach.archetypeName || 'Prehistoric Dino'}</span>
          </div>
        </div>

        <!-- Exercise Title & Movement Instruction -->
        <div class="text-center my-2">
          <h3 class="font-headline font-black text-xl sm:text-2xl text-amber-300 mb-1.5 drop-shadow">
            ${signature}
          </h3>
          <p class="text-on-surface-variant text-sm font-medium max-w-sm mx-auto leading-relaxed">
            ${workoutDesc}
          </p>
        </div>

        <!-- 3D Mascot Showcase Pedestal -->
        <div class="relative w-48 h-48 sm:w-56 sm:h-56 max-w-full aspect-square my-3 bg-surface-container-lowest rounded-full border-4 border-primary shadow-2xl overflow-hidden flex items-center justify-center ring-4 ring-primary/20" id="workout-canvas-container">
          <!-- PetSanctuaryCanvas will mount here -->
        </div>

        <!-- Workout Countdown Clock -->
        <div id="workout-timer-display" class="text-5xl font-headline font-black text-primary my-2 hidden font-mono tracking-wider drop-shadow-[0_0_15px_rgba(46,204,113,0.6)]">
          ${cfg.duration}
        </div>

        <!-- Reward Teaser Pill -->
        <div class="flex items-center gap-3 bg-surface-container-lowest px-4 py-1.5 rounded-full border border-surface-container-highest my-2">
          <span class="text-xs font-bold text-on-surface-variant">Rewards:</span>
          <span class="text-xs font-black text-cyan-300">+${cfg.xp} Pet Training XP ⚡</span>
          <span class="text-xs font-black text-amber-300">+${cfg.coins} Coins 🪙</span>
        </div>

        <!-- Action Buttons -->
        <div class="w-full flex justify-center mt-2">
          <button 
            id="btn-start-workout" 
            class="w-full sm:w-80 py-4 px-8 rounded-2xl bg-gradient-to-r from-primary to-emerald-400 hover:opacity-95 text-slate-950 font-headline font-black text-lg tracking-wider uppercase border-b-4 border-[#1b7a43] active:translate-y-1 active:border-b-0 transition-all shadow-xl flex items-center justify-center gap-2"
          >
            <span class="material-symbols-outlined text-2xl">play_arrow</span>
            <span>START COACH WORKOUT</span>
          </button>

          <button 
            id="btn-finish-workout" 
            class="w-full sm:w-80 py-4 px-8 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-300 hover:opacity-95 text-slate-950 font-headline font-black text-lg tracking-wider uppercase border-b-4 border-amber-600 active:translate-y-1 active:border-b-0 transition-all shadow-xl hidden flex items-center justify-center gap-2"
          >
            <span class="material-symbols-outlined text-2xl">military_tech</span>
            <span>CLAIM WORKOUT REWARDS</span>
          </button>
        </div>

      </div>
    </div>
  `;
}

export function attachDinoWorkoutListeners() {
  const hero = store.getState().selectedHero || {};
  const activePetId = hero?.activePetId || '1';
  const dailyCoach = getDailyRotatingPetCoach();
  const coach = dailyCoach || getPetById(activePetId) || store.getActivePet();
  const workoutId = coach.workoutId || 'trex_run';

  const container = document.getElementById('workout-canvas-container');
  if (container) {
    if (activeCanvasInstance) {
      activeCanvasInstance.destroy();
    }
    activeCanvasInstance = new PetSanctuaryCanvas(container, { petId: coach.id || activePetId });
    if (activeCanvasInstance.setWorkoutMode) {
      activeCanvasInstance.setWorkoutMode(workoutId);
    }
    registerActiveCanvas(activeCanvasInstance);
  }

  const btnClose = document.getElementById('btn-close-workout');
  const btnStart = document.getElementById('btn-start-workout');
  const btnFinish = document.getElementById('btn-finish-workout');
  const timerDisplay = document.getElementById('workout-timer-display');

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      Sound.bloop();
      stopTimer();
      if (activeCanvasInstance) {
        activeCanvasInstance.destroy();
        activeCanvasInstance = null;
      }
      store.navigate('pet_sanctuary');
    });
  }

  if (btnStart) {
    btnStart.addEventListener('click', () => {
      Sound.fanfare();
      isWorkingOut = true;
      hasSpokenMidpoint = false;
      btnStart.classList.add('hidden');
      timerDisplay.classList.remove('hidden');

      const cfg = WORKOUT_DIFFICULTY[getDifficultyTier(hero)];
      const toddler = isToddlerHero(hero);

      try {
        speakCompanion(`${coach.signatureMove || 'Hero workout time'}! ${coach.workoutDesc || 'March and stomp with me!'}`, coach.id);
      } catch(e) {}

      if (activeCanvasInstance && activeCanvasInstance.startWorkoutAnimation) {
        activeCanvasInstance.startWorkoutAnimation();
      }

      countdown = cfg.duration;
      timerDisplay.textContent = countdown;

      timerInterval = setInterval(() => {
        countdown--;
        timerDisplay.textContent = countdown;
        if (toddler && !hasSpokenMidpoint && countdown === Math.round(cfg.duration / 2)) {
          hasSpokenMidpoint = true;
          try {
            speakCompanion("You're doing great! Keep going, little hero!", coach.id);
          } catch (e) {}
        }
        if (countdown <= 0) {
          stopTimer();
          timerDisplay.classList.add('hidden');
          btnFinish.classList.remove('hidden');
          Sound.fanfare();
        }
      }, 1000);
    });
  }

  if (btnFinish) {
    btnFinish.addEventListener('click', () => {
      Sound.fanfare();
      const currentPet = store.getActivePet();
      const earnedPetId = currentPet?.id || activePetId;
      const cfg = WORKOUT_DIFFICULTY[getDifficultyTier(hero)];

      // Reward Pet Training XP (Level 1-25) & Hero Coins
      store.addPetTrainingXp(earnedPetId, cfg.xp);
      store.addCoins(cfg.coins);

      confetti({ particleCount: 100, spread: 90 });
      store.saveState(true);

      store.showReward(
        'Coach Workout Complete! 🏅',
        `Incredible training with Coach ${coach.name}! ${currentPet?.name || 'Your companion'} earned +${cfg.xp} Pet Training XP ⚡ and +${cfg.coins} Hero Coins 🪙!`,
        cfg.coins,
        0,
        null,
        'fitness_center'
      );

      if (activeCanvasInstance) {
        activeCanvasInstance.destroy();
        activeCanvasInstance = null;
      }
      store.navigate('pet_sanctuary');
    });
  }
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  isWorkingOut = false;
  if (activeCanvasInstance && activeCanvasInstance.stopWorkoutAnimation) {
    activeCanvasInstance.stopWorkoutAnimation();
  }
}
