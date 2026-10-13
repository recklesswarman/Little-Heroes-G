/**
 * DinoWorkoutView.js
 * 
 * Companion Hero Workout & Gross-Motor Training Studio
 * Features the 8 Dinosaur Gross-Motor Workouts with coach guidance,
 * duration tier selection (20s / 30s / 45s), 3-2-1 countdown, rhythmic metronome,
 * visual posture demo card, toddler-safe playback controls (Pause/Resume, Repeat Move),
 * and rewards: Evolution Sparks (+15), Pet Training XP, Coins, 100% Joy boost,
 * and 7-Day Workout Streak stamps.
 * Zero pink/purple palette (Electric Cyan, Emerald Mint, Solar Amber, Dark Slate).
 */

import { store } from '../state/store.js';
import { getPetById, getWorkoutById, getDailyRotatingPetCoach, DINO_WORKOUTS } from '../data/petsData.js';
import { PetSanctuaryCanvas } from '../components/PetSanctuaryCanvas.js';
import { speakCompanion } from '../services/voiceService.js';
import confetti from 'canvas-confetti';
import { registerActiveCanvas } from '../utils/activeViewCanvasRegistry.js';
import { Sound } from '../audio/sfx.js';
import { escapeHtml } from '../utils/escapeHtml.js';

let activeCanvasInstance = null;
let timerInterval = null;
let countdownInterval = null;
let isWorkingOut = false;
let isPaused = false;
let workoutPhase = 'idle'; // 'idle' | 'ready' | 'active' | 'finished'
let remainingTime = 30;
let totalDuration = 30;
let selectedDurationTier = 'medium'; // 'easy' (20s) | 'medium' (30s) | 'hard' (45s)
let hasSpokenMidpoint = false;

const DURATION_TIERS = {
  easy: { duration: 20, label: '20s Quick Hop', xp: 40, coins: 40 },
  medium: { duration: 30, label: '30s Hero Pacing', xp: 50, coins: 50 },
  hard: { duration: 45, label: '45s Titan Challenge', xp: 65, coins: 65 }
};

export function renderDinoWorkoutView() {
  const state = store.getState();
  const hero = state.selectedHero || {};
  const activeWorkoutId = state.activeWorkoutId || 'trex_run';
  const workout = getWorkoutById(activeWorkoutId);
  const coachPet = getPetById(workout.coachId) || store.getActivePet();
  const dailyCoach = getDailyRotatingPetCoach();
  const isDailyFeatured = dailyCoach.id === workout.coachId;

  const currentTier = DURATION_TIERS[selectedDurationTier] || DURATION_TIERS.medium;
  const xpBonusMultiplier = isDailyFeatured ? 1.25 : 1.0;
  const finalXp = Math.round(currentTier.xp * xpBonusMultiplier);

  return `
    <div class="p-3 sm:p-6 min-h-screen flex flex-col bg-surface-container-lowest text-on-background select-none font-body pb-28">
      
      <!-- Top Bar: Title & Exit -->
      <div class="flex items-center justify-between mb-3 max-w-2xl mx-auto w-full">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 shadow-sm">
            <span class="material-symbols-outlined text-2xl">fitness_center</span>
          </div>
          <div>
            <h2 class="font-headline font-black text-xl sm:text-2xl text-on-surface">Dino Hero Workout</h2>
            <span class="text-xs font-bold text-secondary">Gross-Motor Training • Coach ${workout.coachName}</span>
          </div>
        </div>

        <button 
          id="btn-close-workout" 
          class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-surface-container hover:bg-surface-bright text-on-surface border-2 border-surface-container-highest flex items-center justify-center shadow-xs active:scale-95 transition-all" 
          aria-label="Exit Workout"
        >
          <span class="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      <!-- Main Workout Arena Stage -->
      <div class="max-w-2xl mx-auto w-full bg-surface-container rounded-3xl p-4 sm:p-6 flex-1 flex flex-col items-center justify-between border-2 border-surface-container-highest shadow-2xl relative overflow-hidden">
        
        <!-- Header Banner: Coach & Signature Move -->
        <div class="flex items-center justify-between bg-surface-container-lowest/80 px-4 py-2.5 rounded-2xl border border-amber-400/40 w-full mb-3 shadow-inner">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-12 h-12 rounded-xl bg-surface-container border border-amber-400/60 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-inner">
              <img 
                src="${coachPet.avatar || `assets/pets/${coachPet.key || 'rex'}.png`}" 
                alt="${workout.coachName}" 
                class="w-full h-full object-contain filter drop-shadow-sm"
                onerror="this.onerror=null; this.outerHTML='<span class=\"text-2xl\">${workout.visualDemo || '🦖'}</span>';"
              >
            </div>
            <div class="flex flex-col text-left min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-300 font-black text-[9px] uppercase border border-amber-400/40">
                  ${workout.coachTitle}
                </span>
                ${isDailyFeatured ? `
                  <span class="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 font-black text-[9px] uppercase border border-emerald-500/40 animate-pulse">
                    +25% XP
                  </span>
                ` : ''}
              </div>
              <h4 class="font-headline font-black text-sm sm:text-base text-on-surface truncate">
                ${workout.name}: ${workout.signatureMove}
              </h4>
              <span class="text-[11px] font-bold text-amber-300 flex items-center gap-1 truncate">
                <span class="material-symbols-outlined text-xs">speed</span>
                <span>Focus: ${workout.targetMuscles}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Duration Badges Selector (Visible Before Starting) -->
        <div id="workout-duration-selector" class="flex items-center gap-2 mb-3 ${workoutPhase !== 'idle' ? 'hidden' : ''}">
          <span class="text-xs font-black text-on-surface-variant uppercase tracking-wider hidden sm:inline">Pacing:</span>
          ${Object.entries(DURATION_TIERS).map(([tierKey, tier]) => {
            const isSelected = selectedDurationTier === tierKey;
            return `
              <button 
                class="duration-tier-btn px-3 py-1.5 rounded-xl font-headline font-black text-xs transition-all ${
                  isSelected 
                    ? 'bg-amber-400 text-slate-950 border-2 border-amber-300 shadow-sm' 
                    : 'bg-surface-container-high text-on-surface-variant border border-surface-container-highest hover:text-on-surface'
                }"
                data-tier="${tierKey}"
              >
                ${tier.label}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Instruction Prompt Callout -->
        <div class="text-center my-1 px-2">
          <p class="text-on-surface-variant text-xs sm:text-sm font-medium max-w-md mx-auto leading-relaxed">
            "${escapeHtml(workout.instructions)}"
          </p>
        </div>

        <!-- Two-Column Hero Stage: 3D Coach Pedestal & Visual Form Demo Card -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full my-3 items-center justify-center">
          
          <!-- 3D Mascot Showcase Pedestal with Rhythmic Metronome Glow -->
          <div class="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto aspect-square bg-surface-container-lowest rounded-full border-4 border-primary shadow-2xl overflow-hidden flex items-center justify-center ring-4 ring-primary/20 transition-all ${isWorkingOut && !isPaused ? 'animate-pulse ring-8 ring-primary/40' : ''}" id="workout-canvas-container">
            <!-- PetSanctuaryCanvas will mount here -->
          </div>

          <!-- Visual Demonstration Form Card (Silhouette & Visual Pose Instructions) -->
          <div class="flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-container-lowest border-2 border-surface-container-highest text-center shadow-inner h-44 sm:h-52">
            <span class="text-4xl sm:text-5xl mb-2 filter drop-shadow-md animate-bounce">${workout.visualDemo}</span>
            <span class="font-headline font-black text-xs uppercase tracking-wider text-secondary mb-1">
              Coach Move Demo
            </span>
            <p class="text-xs text-on-surface font-bold leading-snug">
              ${workout.visualPose}
            </p>
            <div class="mt-2.5 px-3 py-1 rounded-xl bg-surface-container border border-surface-container-highest text-[10px] font-black text-amber-300 flex items-center gap-1">
              <span class="material-symbols-outlined text-xs">music_note</span>
              <span id="tempo-indicator">${isWorkingOut && !isPaused ? 'Match Coach Stomp Rhythm 🎵' : 'Ready for Movement'}</span>
            </div>
          </div>
        </div>

        <!-- Ready Countdown (3... 2... 1... GO!) Overlay Display -->
        <div id="workout-ready-display" class="text-6xl font-headline font-black text-amber-400 my-2 hidden font-mono tracking-wider animate-ping">
          3
        </div>

        <!-- Active Workout Countdown Clock & Progress Bar -->
        <div id="workout-active-controls" class="w-full flex flex-col items-center my-2 ${workoutPhase === 'active' ? '' : 'hidden'}">
          <div id="workout-timer-display" class="text-5xl font-headline font-black text-primary font-mono tracking-wider drop-shadow-[0_0_15px_rgba(46,204,113,0.6)]">
            ${remainingTime}
          </div>
          
          <!-- Progress Bar -->
          <div class="w-full max-w-xs h-3 bg-surface-container-lowest rounded-full overflow-hidden border border-surface-container-highest mt-2">
            <div 
              id="workout-progress-bar"
              class="h-full bg-linear-to-r from-secondary to-primary rounded-full transition-all duration-300"
              style="width: ${Math.round((remainingTime / totalDuration) * 100)}%"
            ></div>
          </div>

          <!-- Toddler-Safe In-Workout Action Controls (Pause / Resume / Repeat Move) -->
          <div class="flex items-center gap-3 mt-3">
            <button 
              id="btn-pause-resume"
              class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-headline font-black text-xs uppercase tracking-wider border border-surface-container-highest flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span class="material-symbols-outlined text-base" id="pause-resume-icon">pause</span>
              <span id="pause-resume-text">Pause</span>
            </button>
            <button 
              id="btn-repeat-move"
              class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-headline font-black text-xs uppercase tracking-wider border border-surface-container-highest flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span class="material-symbols-outlined text-base">replay</span>
              <span>Restart Move</span>
            </button>
          </div>
        </div>

        <!-- Guaranteed Rewards Banner -->
        <div class="flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-surface-container-lowest px-4 py-2 rounded-2xl border border-surface-container-highest my-2 shadow-xs">
          <span class="text-xs font-bold text-on-surface-variant">Rewards:</span>
          <span class="text-xs font-black text-emerald-400">+15 Sparks ✨</span>
          <span class="text-xs font-black text-cyan-300">+${finalXp} XP ⚡</span>
          <span class="text-xs font-black text-amber-300">+${currentTier.coins} Coins 🪙</span>
          <span class="text-xs font-black text-amber-400">Joy 100% 💖</span>
        </div>

        <!-- Primary Action Trigger Buttons -->
        <div class="w-full flex justify-center mt-2">
          <button 
            id="btn-start-workout" 
            class="w-full sm:w-80 py-4 px-8 rounded-2xl bg-linear-to-r from-primary to-emerald-400 hover:opacity-95 text-slate-950 font-headline font-black text-lg tracking-wider uppercase border-b-4 border-[#1b7a43] active:translate-y-1 active:border-b-0 transition-all shadow-xl flex items-center justify-center gap-2 ${workoutPhase !== 'idle' ? 'hidden' : ''}"
          >
            <span class="material-symbols-outlined text-2xl">play_arrow</span>
            <span>START COACH WORKOUT</span>
          </button>

          <button 
            id="btn-finish-workout" 
            class="w-full sm:w-80 py-4 px-8 rounded-2xl bg-linear-to-r from-amber-400 to-yellow-300 hover:opacity-95 text-slate-950 font-headline font-black text-lg tracking-wider uppercase border-b-4 border-amber-600 active:translate-y-1 active:border-b-0 transition-all shadow-xl flex items-center justify-center gap-2 ${workoutPhase === 'finished' ? '' : 'hidden'}"
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
  const state = store.getState();
  const hero = state.selectedHero || {};
  const activeWorkoutId = state.activeWorkoutId || 'trex_run';
  const workout = getWorkoutById(activeWorkoutId);
  const coachPet = getPetById(workout.coachId) || store.getActivePet();
  const dailyCoach = getDailyRotatingPetCoach();
  const isDailyFeatured = dailyCoach.id === workout.coachId;

  // Mount 3D Pet Canvas Pedestal
  const container = document.getElementById('workout-canvas-container');
  if (container) {
    if (activeCanvasInstance) {
      activeCanvasInstance.destroy();
    }
    activeCanvasInstance = new PetSanctuaryCanvas(container, { petId: workout.coachId || coachPet.id });
    if (activeCanvasInstance.setWorkoutMode) {
      activeCanvasInstance.setWorkoutMode(workout.id);
    }
    registerActiveCanvas(activeCanvasInstance);
  }

  // Duration tier selector buttons
  document.querySelectorAll('.duration-tier-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Sound.bloop();
      const tierKey = btn.getAttribute('data-tier');
      if (DURATION_TIERS[tierKey]) {
        selectedDurationTier = tierKey;
        store.notify();
      }
    });
  });

  const btnClose = document.getElementById('btn-close-workout');
  const btnStart = document.getElementById('btn-start-workout');
  const btnFinish = document.getElementById('btn-finish-workout');
  const btnPauseResume = document.getElementById('btn-pause-resume');
  const btnRepeat = document.getElementById('btn-repeat-move');
  const readyDisplay = document.getElementById('workout-ready-display');
  const activeControls = document.getElementById('workout-active-controls');
  const timerDisplay = document.getElementById('workout-timer-display');
  const progressBar = document.getElementById('workout-progress-bar');
  const durationSelector = document.getElementById('workout-duration-selector');
  const pauseResumeIcon = document.getElementById('pause-resume-icon');
  const pauseResumeText = document.getElementById('pause-resume-text');

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      Sound.bloop();
      stopTimer();
      stopCountdownPhase();
      if (activeCanvasInstance) {
        activeCanvasInstance.destroy();
        activeCanvasInstance = null;
      }
      workoutPhase = 'idle';
      isWorkingOut = false;
      isPaused = false;
      store.navigate('pet_sanctuary');
    });
  }

  // START: Initiates 3-2-1 "Ready, Set, Go!" countdown sequence
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      Sound.fanfare();
      workoutPhase = 'ready';
      isWorkingOut = false;
      isPaused = false;
      hasSpokenMidpoint = false;

      btnStart.classList.add('hidden');
      if (durationSelector) durationSelector.classList.add('hidden');
      if (readyDisplay) {
        readyDisplay.classList.remove('hidden');
        readyDisplay.textContent = '3';
      }

      // Voice prompt: announce move
      try {
        speakCompanion(`Get ready for ${workout.name}! ${workout.signatureMove}! Ready...`, coachPet.id);
      } catch(e) {}

      let count = 3;
      countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
          Sound.click();
          if (readyDisplay) readyDisplay.textContent = count;
        } else if (count === 0) {
          Sound.whistle ? Sound.whistle() : Sound.fanfare();
          if (readyDisplay) readyDisplay.textContent = 'GO!';
          try {
            speakCompanion('Go, go, go! Follow the rhythm!', coachPet.id);
          } catch(e) {}
        } else {
          stopCountdownPhase();
          startActiveWorkoutTimer();
        }
      }, 1000);
    });
  }

  function stopCountdownPhase() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (readyDisplay) readyDisplay.classList.add('hidden');
  }

  function startActiveWorkoutTimer() {
    workoutPhase = 'active';
    isWorkingOut = true;
    isPaused = false;

    const currentTier = DURATION_TIERS[selectedDurationTier] || DURATION_TIERS.medium;
    totalDuration = currentTier.duration;
    remainingTime = currentTier.duration;

    if (activeControls) activeControls.classList.remove('hidden');
    if (timerDisplay) timerDisplay.textContent = remainingTime;
    if (progressBar) progressBar.style.width = '100%';

    if (activeCanvasInstance && activeCanvasInstance.startWorkoutAnimation) {
      activeCanvasInstance.startWorkoutAnimation();
    }

    timerInterval = setInterval(() => {
      if (isPaused) return;

      remainingTime--;
      if (timerDisplay) timerDisplay.textContent = remainingTime;
      if (progressBar) {
        const pct = Math.max(0, Math.round((remainingTime / totalDuration) * 100));
        progressBar.style.width = `${pct}%`;
      }

      // Midpoint encouraging coach audio reminder
      if (!hasSpokenMidpoint && remainingTime === Math.round(totalDuration / 2)) {
        hasSpokenMidpoint = true;
        try {
          speakCompanion(`Halfway there, little hero! Keep moving with Coach ${workout.coachName}!`, coachPet.id);
        } catch (e) {}
      }

      // Final 5s countdown tick
      if (remainingTime > 0 && remainingTime <= 5) {
        Sound.click();
      }

      if (remainingTime <= 0) {
        stopTimer();
        workoutPhase = 'finished';
        if (activeControls) activeControls.classList.add('hidden');
        if (btnFinish) btnFinish.classList.remove('hidden');
        Sound.fanfare();
        try {
          speakCompanion(`Victory! Phenomenal workout with Coach ${workout.coachName}!`, coachPet.id);
        } catch (e) {}
      }
    }, 1000);
  }

  // PAUSE / RESUME Control
  if (btnPauseResume) {
    btnPauseResume.addEventListener('click', () => {
      Sound.bloop();
      isPaused = !isPaused;
      if (isPaused) {
        if (pauseResumeIcon) pauseResumeIcon.textContent = 'play_arrow';
        if (pauseResumeText) pauseResumeText.textContent = 'Resume';
        if (activeCanvasInstance && activeCanvasInstance.stopWorkoutAnimation) {
          activeCanvasInstance.stopWorkoutAnimation();
        }
      } else {
        if (pauseResumeIcon) pauseResumeIcon.textContent = 'pause';
        if (pauseResumeText) pauseResumeText.textContent = 'Pause';
        if (activeCanvasInstance && activeCanvasInstance.startWorkoutAnimation) {
          activeCanvasInstance.startWorkoutAnimation();
        }
      }
    });
  }

  // REPEAT MOVE Control
  if (btnRepeat) {
    btnRepeat.addEventListener('click', () => {
      Sound.bloop();
      stopTimer();
      hasSpokenMidpoint = false;
      const currentTier = DURATION_TIERS[selectedDurationTier] || DURATION_TIERS.medium;
      remainingTime = currentTier.duration;
      totalDuration = currentTier.duration;
      isPaused = false;
      if (pauseResumeIcon) pauseResumeIcon.textContent = 'pause';
      if (pauseResumeText) pauseResumeText.textContent = 'Pause';
      if (timerDisplay) timerDisplay.textContent = remainingTime;
      if (progressBar) progressBar.style.width = '100%';
      startActiveWorkoutTimer();
    });
  }

  // FINISH: Claim Rewards & Update Progression
  if (btnFinish) {
    btnFinish.addEventListener('click', () => {
      Sound.fanfare();
      const currentTier = DURATION_TIERS[selectedDurationTier] || DURATION_TIERS.medium;
      const xpMultiplier = isDailyFeatured ? 1.25 : 1.0;
      const finalXp = Math.round(currentTier.xp * xpMultiplier);
      const finalCoins = currentTier.coins;
      const sparks = 15;

      // Update state: Sparks (+15), XP, Coins, Joy 100%, 7-Day Workout Streak
      const streak = store.recordWorkoutCompletion(workout.id, finalXp, finalCoins, sparks);

      confetti({ particleCount: 120, spread: 100 });

      store.showReward(
        'Coach Workout Complete! 🏅',
        `Tremendous workout with Coach ${workout.coachName}! Earned +${sparks} Evolution Sparks ✨, +${finalXp} Pet Training XP ⚡, and +${finalCoins} Hero Coins 🪙! Streak: ${streak.currentStreak || 1} Days!`,
        finalCoins,
        0,
        null,
        'fitness_center'
      );

      if (activeCanvasInstance) {
        activeCanvasInstance.destroy();
        activeCanvasInstance = null;
      }
      workoutPhase = 'idle';
      isWorkingOut = false;
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

export function abandonDinoWorkoutIfRunning() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  workoutPhase = 'idle';
  isWorkingOut = false;
}
