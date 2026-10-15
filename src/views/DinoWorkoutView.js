/**
 * DinoWorkoutView.js
 * 
 * Completely Revamped Companion Hero Workout & Gross-Motor Training Studio
 * 
 * Features:
 * 1. Dual Training Modes:
 *    - "8-Minute Dino Circuit": Complete 8-move prehistoric journey (1 min per move + 10s water breaks)
 *    - "Quick Practice": Master any individual dinosaur workout for 1 minute (or 30s/45s/60s tiers)
 * 2. High-Performance Side-by-Side Articulated 3D Duo Stage (WorkoutHeroDuoCanvas):
 *    - Left: 3D Dinosaur Pet Coach
 *    - Right: Fully Articulated 3D Toddler Hero Character with complete skeletal hierarchy
 * 3. High-Energy Procedural Dino Workout Drum Beat (Sound.startWorkoutBeat):
 *    - Dynamic 120-140 BPM chiptune drum & synth rhythm with visual metronome pulsing
 *    - Audio & Voice toggles for parent control
 * 4. Continuous In-Depth Voice Coaching & Spoken Cadence Guidance:
 *    - Comprehensive instructional walkthroughs for all 8 workouts
 *    - Timed cadence cues called out every 8-10 seconds throughout the minute
 *    - Seamless 30s side-switch guidance and animation mirroring for The Diplodocus
 * 5. 10-Second Water Break & Rest Intermission Screen between circuit moves
 * 6. Guaranteed Rewards: Evolution Sparks (+15 to +120), Pet XP, Coins, Joy 100%, 7-Day Streak
 * 7. Zero pink/purple palette (Electric Cyan, Emerald Green, Solar Amber, Midnight Slate)
 */

import { store } from '../state/store.js';
import { getPetById, getWorkoutById, getDailyRotatingPetCoach, DINO_WORKOUTS } from '../data/petsData.js';
import { WorkoutHero3DStage } from '../components/WorkoutHero3DStage.js';
import { WorkoutHeroDuoCanvas } from '../components/WorkoutHeroDuoCanvas.js';
import { speakCompanion, stopRex, prewarmWorkoutAudio } from '../services/voiceService.js';
import confetti from 'canvas-confetti';
import { registerActiveCanvas } from '../utils/activeViewCanvasRegistry.js';
import { Sound } from '../audio/sfx.js';
import { escapeHtml } from '../utils/escapeHtml.js';

// Module-level persistent workout session state
let activeDuoCanvas = null;
let timerInterval = null;
let countdownInterval = null;
let restBreakInterval = null;

// Session Mode & Phase
let sessionMode = 'circuit'; // 'circuit' | 'practice'
let currentCircuitIndex = 0; // 0 to 7
let workoutPhase = 'idle'; // 'idle' | 'ready' | 'active' | 'rest_break' | 'finished' | 'circuit_complete'
let isPaused = false;

// Timing
let remainingTime = 60;
let totalDuration = 60;
let restRemainingTime = 10;
let selectedDurationTier = 'titan'; // 'toddler' (30s) | 'junior' (45s) | 'titan' (60s)

// Audio & Voice Preference Toggles
let isMusicEnabled = true;
let isVoiceEnabled = true;

// Cadence Tracking
let spokenTimelineSet = new Set();

const DURATION_TIERS = {
  toddler: { duration: 30, label: '30s Toddler Hop', xp: 45, coins: 40, sparks: 10 },
  junior: { duration: 45, label: '45s Junior Ranger', xp: 60, coins: 50, sparks: 15 },
  titan: { duration: 60, label: '60s Titan Champion', xp: 80, coins: 70, sparks: 20 }
};

export function renderDinoWorkoutView() {
  const state = store.getState();
  const hero = state.selectedHero || {};
  
  // Resolve active workout based on circuit or practice mode
  let activeWorkoutId = state.activeWorkoutId;
  if (sessionMode === 'circuit') {
    activeWorkoutId = DINO_WORKOUTS[currentCircuitIndex]?.id || 'velociraptor_run';
  } else if (!activeWorkoutId) {
    activeWorkoutId = 'velociraptor_run';
  }

  const workout = getWorkoutById(activeWorkoutId);
  const coachPet = getPetById(workout.coachId) || store.getActivePet();
  const dailyCoach = getDailyRotatingPetCoach();
  const isDailyFeatured = dailyCoach.id === workout.coachId;

  const currentTier = DURATION_TIERS[selectedDurationTier] || DURATION_TIERS.titan;
  const xpMultiplier = isDailyFeatured ? 1.25 : 1.0;
  const finalXp = Math.round(currentTier.xp * xpMultiplier);

  return `
    <div class="p-3 sm:p-6 min-h-screen flex flex-col bg-surface-container-lowest text-on-background select-none font-body pb-28">
      
      <!-- Top Bar: Navigation, Mode Selector & Quick Toggles -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3 max-w-3xl mx-auto w-full">
        
        <!-- Title & Coach Identity -->
        <div class="flex items-center gap-3 w-full sm:w-auto">
          <div class="w-11 h-11 rounded-2xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 shadow-sm shrink-0">
            <span class="material-symbols-outlined text-2xl">fitness_center</span>
          </div>
          <div class="min-w-0">
            <h2 class="font-headline font-black text-xl sm:text-2xl text-on-surface truncate">Prehistoric Hero Workout</h2>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-amber-400">Coach ${escapeHtml(workout.coachName)}</span>
              <span class="text-xs text-on-surface-variant">•</span>
              <span class="text-xs font-semibold text-secondary">${escapeHtml(workout.signatureMove)}</span>
            </div>
          </div>
        </div>

        <!-- Mode Toggle & Sound Controls -->
        <div class="flex items-center gap-2 self-end sm:self-auto">
          
          <!-- Mode Tabs (Circuit vs Practice) -->
          <div class="flex items-center bg-surface-container rounded-2xl p-1 border border-surface-container-highest">
            <button 
              id="btn-mode-circuit"
              class="px-3 py-1.5 rounded-xl font-headline font-black text-xs transition-all flex items-center gap-1.5 ${sessionMode === 'circuit' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}"
              ${workoutPhase === 'active' ? 'disabled' : ''}
            >
              <span class="material-symbols-outlined text-base">route</span>
              <span>8-Min Circuit</span>
            </button>
            <button 
              id="btn-mode-practice"
              class="px-3 py-1.5 rounded-xl font-headline font-black text-xs transition-all flex items-center gap-1.5 ${sessionMode === 'practice' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}"
              ${workoutPhase === 'active' ? 'disabled' : ''}
            >
              <span class="material-symbols-outlined text-base">sports_gymnastics</span>
              <span>Practice Move</span>
            </button>
          </div>

          <!-- Music Toggle -->
          <button 
            id="btn-toggle-music" 
            class="w-10 h-10 rounded-2xl border-2 flex items-center justify-center shadow-xs active:scale-95 transition-all ${isMusicEnabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' : 'bg-surface-container text-on-surface-variant border-surface-container-highest'}"
            title="${isMusicEnabled ? 'Workout Music On' : 'Workout Music Muted'}"
            aria-label="Toggle Workout Music"
          >
            <span class="material-symbols-outlined text-xl">${isMusicEnabled ? 'music_note' : 'music_off'}</span>
          </button>

          <!-- Voice Coach Toggle -->
          <button 
            id="btn-toggle-voice" 
            class="w-10 h-10 rounded-2xl border-2 flex items-center justify-center shadow-xs active:scale-95 transition-all ${isVoiceEnabled ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-surface-container text-on-surface-variant border-surface-container-highest'}"
            title="${isVoiceEnabled ? 'Voice Guidance On' : 'Voice Guidance Muted'}"
            aria-label="Toggle Voice Guidance"
          >
            <span class="material-symbols-outlined text-xl">${isVoiceEnabled ? 'record_voice_over' : 'voice_over_off'}</span>
          </button>

          <!-- Exit Button -->
          <button 
            id="btn-close-workout" 
            class="w-10 h-10 rounded-2xl bg-surface-container hover:bg-surface-bright text-on-surface border-2 border-surface-container-highest flex items-center justify-center shadow-xs active:scale-95 transition-all" 
            aria-label="Exit Workout Studio"
          >
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      </div>

      <!-- 8-Minute Circuit Step Indicator (Circuit Mode Only) -->
      ${sessionMode === 'circuit' ? `
        <div class="max-w-3xl mx-auto w-full mb-3 bg-surface-container rounded-2xl p-2.5 border border-surface-container-highest flex items-center justify-between gap-2 overflow-x-auto shadow-inner">
          <div class="flex items-center gap-1.5 shrink-0 pl-1">
            <span class="material-symbols-outlined text-amber-400 text-sm">flag</span>
            <span class="text-xs font-black uppercase text-amber-300 tracking-wider">Circuit: Move ${currentCircuitIndex + 1}/8</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            ${DINO_WORKOUTS.map((w, idx) => {
              const isPast = idx < currentCircuitIndex;
              const isCurrent = idx === currentCircuitIndex;
              return `
                <button 
                  class="circuit-step-dot w-8 h-8 rounded-xl font-headline font-black text-xs flex items-center justify-center transition-all ${
                    isPast 
                      ? 'bg-emerald-500 text-slate-950 shadow-xs' 
                      : isCurrent 
                        ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-md scale-105' 
                        : 'bg-surface-container-high text-on-surface-variant opacity-70'
                  }"
                  data-index="${idx}"
                  ${workoutPhase === 'active' ? 'disabled' : ''}
                  title="Move ${idx + 1}: ${w.name}"
                >
                  ${isPast ? '<span class="material-symbols-outlined text-base font-black">check</span>' : idx + 1}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Quick Practice Move Selector Carousel (Practice Mode Only) -->
      ${sessionMode === 'practice' && workoutPhase === 'idle' ? `
        <div class="max-w-3xl mx-auto w-full mb-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          ${DINO_WORKOUTS.map(w => {
            const isSelected = w.id === activeWorkoutId;
            return `
              <button 
                class="practice-select-btn px-3 py-2 rounded-2xl font-headline font-black text-xs shrink-0 flex items-center gap-2 border-2 transition-all ${
                  isSelected 
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md scale-105' 
                    : 'bg-surface-container text-on-surface-variant border-surface-container-highest hover:text-on-surface'
                }"
                data-workout-id="${w.id}"
              >
                <span class="text-lg">${w.visualDemo}</span>
                <span>${w.name}</span>
              </button>
            `;
          }).join('')}
        </div>
      ` : ''}

      <!-- Main Stage Container -->
      <div class="max-w-3xl mx-auto w-full bg-surface-container rounded-3xl p-4 sm:p-6 flex-1 flex flex-col items-center justify-between border-2 border-surface-container-highest shadow-2xl relative overflow-hidden">
        
        <!-- Header Callout Banner: Move Name & Instructions -->
        <div class="w-full bg-surface-container-lowest/90 px-4 py-3 rounded-2xl border border-amber-400/40 mb-3 shadow-inner">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-surface-container border border-amber-400/50 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-inner">
                <img 
                  src="${coachPet.avatar || `assets/pets/${coachPet.key || 'rex'}.png`}" 
                  alt="${workout.coachName}" 
                  class="w-full h-full object-contain filter drop-shadow-sm"
                  onerror="this.onerror=null; this.outerHTML='<span class=\"text-2xl\">${workout.visualDemo || '🦖'}</span>';"
                >
              </div>
              <div class="flex flex-col text-left min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-black text-[10px] uppercase border border-amber-400/40">
                    Coach ${workout.coachName} • ${workout.coachTitle}
                  </span>
                  ${workout.hasHalfwaySideSwitch ? `
                    <span class="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 font-black text-[10px] uppercase border border-cyan-500/40">
                      30s Side Switch
                    </span>
                  ` : ''}
                </div>
                <h3 class="font-headline font-black text-base sm:text-lg text-on-surface mt-0.5">
                  ${workout.name}: ${workout.signatureMove}
                </h3>
              </div>
            </div>

            <!-- Tempo & Target Muscles Pill -->
            <div class="hidden sm:flex flex-col items-end shrink-0">
              <span class="text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                <span class="material-symbols-outlined text-xs">speed</span>
                <span>${workout.tempoBpm || 120} BPM</span>
              </span>
              <span class="text-[10px] font-bold text-on-surface-variant">Focus: ${workout.targetMuscles}</span>
            </div>
          </div>

          <!-- Exact Instructions Box -->
          <div class="mt-2.5 pt-2.5 border-t border-surface-container-highest/60">
            <p class="text-xs sm:text-sm font-medium text-on-surface leading-relaxed">
              "${escapeHtml(workout.instructions)}"
            </p>
            <p class="text-[11px] font-bold text-amber-300 mt-1 flex items-center gap-1">
              <span class="material-symbols-outlined text-xs">tips_and_updates</span>
              <span>Form Tip: ${escapeHtml(workout.formCues || workout.visualPose)}</span>
            </p>
          </div>
        </div>

        <!-- Duration Tier Selector (Practice Mode Only, Before Start) -->
        ${sessionMode === 'practice' ? `
          <div id="workout-duration-selector" class="flex items-center gap-2 mb-3 ${workoutPhase !== 'idle' ? 'hidden' : ''}">
            <span class="text-xs font-black text-on-surface-variant uppercase tracking-wider hidden sm:inline">Duration:</span>
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
        ` : ''}

        <!-- 3D SYNCHRONIZED DUO STAGE (Coach Dino on Left + Articulated Toddler Hero on Right) -->
        <div class="relative w-full h-56 sm:h-72 mx-auto bg-surface-container-lowest rounded-3xl border-4 border-primary shadow-2xl overflow-hidden flex items-center justify-center ring-4 ring-primary/20 transition-all ${workoutPhase === 'active' && !isPaused ? 'ring-8 ring-primary/40' : ''}" id="workout-stage-mount">
          
          <!-- Canvas Viewport Mount (High-performance 60FPS WebGL/2D Duo Engine) -->
          <div id="workout-canvas-container" class="w-full h-full absolute inset-0 flex items-center justify-center">
            <!-- WorkoutHeroDuoCanvas mounts here -->
          </div>

          <!-- Synchronized Metronome Pulse Ring Overlay -->
          <div id="metronome-pulse-ring" class="absolute inset-0 rounded-3xl pointer-events-none border-4 border-primary/0 transition-all duration-100"></div>

          <!-- Ready Countdown 3... 2... 1... GO! Overlay -->
          <div id="workout-ready-display" class="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center text-7xl sm:text-8xl font-headline font-black text-amber-400 font-mono tracking-wider animate-pulse hidden z-20">
            3
          </div>

          <!-- 10-Second Water Break & Rest Screen (Circuit Intermission) -->
          <div id="workout-rest-display" class="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center hidden z-30">
            <div class="w-16 h-16 rounded-3xl bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 mb-3 shadow-lg animate-bounce">
              <span class="material-symbols-outlined text-4xl">local_drink</span>
            </div>
            <h4 class="font-headline font-black text-2xl text-on-surface mb-1">Water Break & Deep Breaths!</h4>
            <p class="text-xs text-on-surface-variant max-w-sm mb-4">
              Phenomenal effort! Take a refreshing sip of water. Next up: Move ${currentCircuitIndex + 2} of 8!
            </p>
            <div class="text-5xl font-headline font-black text-cyan-400 font-mono mb-4" id="rest-timer-display">
              10
            </div>
            <button 
              id="btn-skip-break" 
              class="px-5 py-2.5 rounded-2xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-headline font-black text-xs uppercase tracking-wider border border-surface-container-highest shadow-sm active:scale-95"
            >
              Skip Break & Continue ⏭️
            </button>
          </div>
        </div>

        <!-- Active Timer Display & Dynamic Rhythm Indicator -->
        <div id="workout-active-controls" class="w-full flex flex-col items-center my-3 ${workoutPhase === 'active' ? '' : 'hidden'}">
          
          <div class="flex items-center justify-center gap-4">
            <!-- 1-Minute Clock Countdown -->
            <div class="flex flex-col items-center">
              <div id="workout-timer-display" class="text-6xl font-headline font-black text-primary font-mono tracking-wider drop-shadow-[0_0_15px_rgba(46,204,113,0.6)]">
                ${remainingTime}s
              </div>
              <span class="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                ${remainingTime > 30 ? 'High Energy Interval' : (workout.hasHalfwaySideSwitch ? 'Switched Sides • Push to Finish!' : 'Home Stretch • Keep Moving!')}
              </span>
            </div>
          </div>
          
          <!-- Animated Progress Bar -->
          <div class="w-full max-w-md h-3.5 bg-surface-container-lowest rounded-full overflow-hidden border border-surface-container-highest mt-3 shadow-inner">
            <div 
              id="workout-progress-bar"
              class="h-full bg-linear-to-r from-secondary via-amber-400 to-primary rounded-full transition-all duration-300"
              style="width: ${Math.round((remainingTime / totalDuration) * 100)}%"
            ></div>
          </div>

          <!-- Dynamic Rhythm Metronome Pill -->
          <div class="mt-2.5 px-4 py-1.5 rounded-2xl bg-surface-container-lowest border border-surface-container-highest text-xs font-mono font-black text-amber-300 flex items-center gap-2 shadow-xs">
            <span class="material-symbols-outlined text-sm ${!isPaused ? 'animate-spin' : ''}">music_note</span>
            <span id="tempo-indicator">${workout.tempoBpm || 120} BPM • ${workout.signatureMove} Rhythm</span>
          </div>

          <!-- Toddler-Safe Controls (Pause / Resume / Restart / Next) -->
          <div class="flex items-center gap-3 mt-4">
            <button 
              id="btn-pause-resume"
              class="px-5 py-2.5 rounded-2xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-headline font-black text-xs uppercase tracking-wider border border-surface-container-highest flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span class="material-symbols-outlined text-lg" id="pause-resume-icon">pause</span>
              <span id="pause-resume-text">Pause</span>
            </button>
            <button 
              id="btn-repeat-move"
              class="px-5 py-2.5 rounded-2xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-headline font-black text-xs uppercase tracking-wider border border-surface-container-highest flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span class="material-symbols-outlined text-lg">replay</span>
              <span>Restart Move</span>
            </button>
            ${sessionMode === 'circuit' ? `
              <button 
                id="btn-skip-next"
                class="px-5 py-2.5 rounded-2xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-headline font-black text-xs uppercase tracking-wider border border-surface-container-highest flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <span class="material-symbols-outlined text-lg">skip_next</span>
                <span>Next Move</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Guaranteed Rewards Banner -->
        <div class="flex flex-wrap items-center justify-center gap-2 sm:gap-4 bg-surface-container-lowest px-5 py-2.5 rounded-2xl border border-surface-container-highest my-2 shadow-xs w-full max-w-md">
          <span class="text-xs font-bold text-on-surface-variant">Rewards:</span>
          <span class="text-xs font-black text-emerald-400">+${currentTier.sparks} Sparks ✨</span>
          <span class="text-xs font-black text-cyan-300">+${finalXp} XP ⚡</span>
          <span class="text-xs font-black text-amber-300">+${currentTier.coins} Coins 🪙</span>
          <span class="text-xs font-black text-amber-400">Joy 100% 💖</span>
        </div>

        <!-- Primary Start / Finish Action Buttons -->
        <div class="w-full flex justify-center mt-2">
          
          <!-- START WORKOUT BUTTON -->
          <button 
            id="btn-start-workout" 
            class="w-full sm:w-80 py-4 px-8 rounded-2xl bg-linear-to-r from-primary to-emerald-400 hover:opacity-95 text-slate-950 font-headline font-black text-lg tracking-wider uppercase border-b-4 border-[#1b7a43] active:translate-y-1 active:border-b-0 transition-all shadow-xl flex items-center justify-center gap-2 ${workoutPhase !== 'idle' ? 'hidden' : ''}"
          >
            <span class="material-symbols-outlined text-2xl">play_arrow</span>
            <span>${sessionMode === 'circuit' ? `START 8-MIN CIRCUIT (MOVE 1/8)` : `START 1-MIN MOVE`}</span>
          </button>

          <!-- CLAIM MOVE REWARDS (Single Move Finish) -->
          <button 
            id="btn-finish-workout" 
            class="w-full sm:w-80 py-4 px-8 rounded-2xl bg-linear-to-r from-amber-400 to-yellow-300 hover:opacity-95 text-slate-950 font-headline font-black text-lg tracking-wider uppercase border-b-4 border-amber-600 active:translate-y-1 active:border-b-0 transition-all shadow-xl flex items-center justify-center gap-2 ${workoutPhase === 'finished' ? '' : 'hidden'}"
          >
            <span class="material-symbols-outlined text-2xl">military_tech</span>
            <span>CLAIM REWARDS</span>
          </button>

          <!-- CIRCUIT COMPLETE CELEBRATION -->
          <button 
            id="btn-finish-circuit" 
            class="w-full sm:w-96 py-4 px-8 rounded-2xl bg-linear-to-r from-emerald-400 via-cyan-300 to-amber-300 hover:opacity-95 text-slate-950 font-headline font-black text-lg tracking-wider uppercase border-b-4 border-emerald-700 active:translate-y-1 active:border-b-0 transition-all shadow-2xl flex items-center justify-center gap-2 ${workoutPhase === 'circuit_complete' ? '' : 'hidden'}"
          >
            <span class="material-symbols-outlined text-2xl">trophy</span>
            <span>CLAIM GRAND CIRCUIT TROPHY 🏆</span>
          </button>
        </div>

      </div>
    </div>
  `;
}

export function attachDinoWorkoutListeners() {
  const state = store.getState();
  let activeWorkoutId = state.activeWorkoutId;
  if (sessionMode === 'circuit') {
    activeWorkoutId = DINO_WORKOUTS[currentCircuitIndex]?.id || 'velociraptor_run';
  } else if (!activeWorkoutId) {
    activeWorkoutId = 'velociraptor_run';
  }

  const workout = getWorkoutById(activeWorkoutId);
  const coachPet = getPetById(workout.coachId) || store.getActivePet();
  const dailyCoach = getDailyRotatingPetCoach();
  const isDailyFeatured = dailyCoach.id === workout.coachId;

  // 1. MOUNT SIDE-BY-SIDE 3D DUO STAGE (With automatic 2D Canvas Fallback)
  const stageContainer = document.getElementById('workout-canvas-container');
  if (stageContainer) {
    if (activeDuoCanvas) {
      activeDuoCanvas.destroy();
      activeDuoCanvas = null;
    }
    activeDuoCanvas = new WorkoutHero3DStage(stageContainer, {
      workoutId: workout.id,
      coachId: workout.coachId || coachPet.id,
      tempoBpm: workout.tempoBpm || 120
    });
    activeDuoCanvas.setTimeRemaining(remainingTime);
    registerActiveCanvas(activeDuoCanvas);
  }

  // Prewarm cadence audio cues for instant zero-latency playback
  try {
    prewarmWorkoutAudio(activeWorkoutId, coachPet.id);
  } catch (err) {
    console.warn('Audio prewarm warning:', err);
  }

  // 2. MODE SELECTORS (Circuit vs Practice)
  const btnCircuit = document.getElementById('btn-mode-circuit');
  const btnPractice = document.getElementById('btn-mode-practice');

  if (btnCircuit) {
    btnCircuit.addEventListener('click', () => {
      Sound.bloop();
      sessionMode = 'circuit';
      currentCircuitIndex = 0;
      selectedDurationTier = 'titan'; // 60s standard for 8-min circuit
      store.setActiveWorkoutId(DINO_WORKOUTS[0].id);
      resetWorkoutState();
      try {
        prewarmWorkoutAudio(DINO_WORKOUTS[0].id, DINO_WORKOUTS[0].coachId);
      } catch (e) {}
      store.notify();
    });
  }

  if (btnPractice) {
    btnPractice.addEventListener('click', () => {
      Sound.bloop();
      sessionMode = 'practice';
      resetWorkoutState();
      store.notify();
    });
  }

  // Circuit Step Dots
  document.querySelectorAll('.circuit-step-dot').forEach(btn => {
    btn.addEventListener('click', () => {
      Sound.bloop();
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      if (!isNaN(idx) && idx >= 0 && idx < DINO_WORKOUTS.length) {
        currentCircuitIndex = idx;
        const w = DINO_WORKOUTS[idx];
        store.setActiveWorkoutId(w.id);
        resetWorkoutState();
        try {
          prewarmWorkoutAudio(w.id, w.coachId);
        } catch (e) {}
        store.notify();
      }
    });
  });

  // Practice Move Chips
  document.querySelectorAll('.practice-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Sound.bloop();
      const wId = btn.getAttribute('data-workout-id');
      if (wId) {
        const nextW = getWorkoutById(wId);
        store.setActiveWorkoutId(wId);
        resetWorkoutState();
        try {
          prewarmWorkoutAudio(wId, nextW?.coachId);
        } catch (e) {}
        store.notify();
      }
    });
  });

  // Duration tier selector
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

  // Audio & Voice Toggles
  const btnToggleMusic = document.getElementById('btn-toggle-music');
  const btnToggleVoice = document.getElementById('btn-toggle-voice');

  if (btnToggleMusic) {
    btnToggleMusic.addEventListener('click', () => {
      Sound.bloop();
      isMusicEnabled = !isMusicEnabled;
      if (!isMusicEnabled) {
        Sound.stopWorkoutBeat();
      } else if (workoutPhase === 'active' && !isPaused) {
        Sound.startWorkoutBeat(workout.tempoBpm || 120, () => {
          if (activeDuoCanvas) activeDuoCanvas.triggerBeat();
        });
      }
      store.notify();
    });
  }

  if (btnToggleVoice) {
    btnToggleVoice.addEventListener('click', () => {
      Sound.bloop();
      isVoiceEnabled = !isVoiceEnabled;
      if (!isVoiceEnabled) {
        stopRex();
      }
      store.notify();
    });
  }

  // Exit Workout Studio
  const btnClose = document.getElementById('btn-close-workout');
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      Sound.bloop();
      stopTimer();
      stopCountdownPhase();
      stopRestBreak();
      stopRex();
      Sound.stopWorkoutBeat();
      if (activeDuoCanvas) {
        activeDuoCanvas.destroy();
        activeDuoCanvas = null;
      }
      resetWorkoutState();
      store.navigate('pet_sanctuary');
    });
  }

  // START: Initiates 3-2-1 "Ready, Set, Go!" countdown
  const btnStart = document.getElementById('btn-start-workout');
  const readyDisplay = document.getElementById('workout-ready-display');
  const activeControls = document.getElementById('workout-active-controls');
  const timerDisplay = document.getElementById('workout-timer-display');
  const progressBar = document.getElementById('workout-progress-bar');
  const pulseRing = document.getElementById('metronome-pulse-ring');
  const btnPauseResume = document.getElementById('btn-pause-resume');
  const pauseResumeIcon = document.getElementById('pause-resume-icon');
  const pauseResumeText = document.getElementById('pause-resume-text');
  const btnRepeat = document.getElementById('btn-repeat-move');
  const btnSkipNext = document.getElementById('btn-skip-next');
  const btnFinish = document.getElementById('btn-finish-workout');
  const btnFinishCircuit = document.getElementById('btn-finish-circuit');

  if (btnStart) {
    btnStart.addEventListener('click', () => {
      Sound.fanfare();
      workoutPhase = 'ready';
      isPaused = false;
      spokenTimelineSet.clear();

      btnStart.classList.add('hidden');
      if (readyDisplay) {
        readyDisplay.classList.remove('hidden');
        readyDisplay.textContent = '3';
      }

      // Voice Intro: Announce move and form
      if (isVoiceEnabled) {
        const introText = workout.audioCues?.intro || `Coach ${workout.coachName} ready! Let's do ${workout.name}! ${workout.signatureMove}!`;
        try {
          speakCompanion(introText, coachPet.id);
        } catch (e) {}
      }

      let count = 3;
      countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
          Sound.click();
          if (readyDisplay) readyDisplay.textContent = count;
        } else if (count === 0) {
          Sound.whistle ? Sound.whistle() : Sound.fanfare();
          if (readyDisplay) readyDisplay.textContent = 'GO!';
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

  function checkCadenceCues(timeRemainingSec) {
    if (!isVoiceEnabled || !workout.cadenceTimeline) return;

    for (const cueItem of workout.cadenceTimeline) {
      // Direct timestamp match (60s, 50s, 40s, 30s, 20s, 10s, 3s)
      // or final wrap-up cue near 58s elapsed (2s remaining)
      const isMatch = (timeRemainingSec === cueItem.at) ||
                      (cueItem.at <= 3 && timeRemainingSec === 2);

      if (isMatch && !spokenTimelineSet.has(cueItem.at)) {
        spokenTimelineSet.add(cueItem.at);

        // For Diplodocus at 30s remaining, announce halfway side switch synchronously with pose mirror
        let cueText = cueItem.cue;
        if (cueItem.at === 30 && workout.hasHalfwaySideSwitch) {
          cueText = workout.audioCues?.halfway || cueItem.cue;
        }

        try {
          speakCompanion(cueText, coachPet.id);
        } catch (e) {
          console.warn('speakCompanion error:', e);
        }
        break;
      }
    }
  }

  function startActiveWorkoutTimer() {
    workoutPhase = 'active';
    isPaused = false;

    const tier = sessionMode === 'circuit' ? DURATION_TIERS.titan : (DURATION_TIERS[selectedDurationTier] || DURATION_TIERS.titan);
    totalDuration = tier.duration;
    remainingTime = tier.duration;

    if (activeControls) activeControls.classList.remove('hidden');
    if (timerDisplay) timerDisplay.textContent = `${remainingTime}s`;
    if (progressBar) progressBar.style.width = '100%';

    // Start 3D canvas animation & beat
    if (activeDuoCanvas) {
      activeDuoCanvas.setWorkout(workout.id, workout.coachId, workout.tempoBpm || 120);
      activeDuoCanvas.setTimeRemaining(remainingTime);
      activeDuoCanvas.startAnimation();
    }

    // Trigger initial cadence cue at 0s elapsed / 60s remaining so it is not skipped
    checkCadenceCues(remainingTime);

    // Start High-Energy Upbeat Music Beat
    if (isMusicEnabled) {
      Sound.startWorkoutBeat(workout.tempoBpm || 120, (step) => {
        if (activeDuoCanvas) activeDuoCanvas.triggerBeat();
        if (pulseRing) {
          pulseRing.classList.remove('border-primary/0');
          pulseRing.classList.add('border-primary', 'scale-102');
          setTimeout(() => {
            pulseRing.classList.remove('border-primary', 'scale-102');
            pulseRing.classList.add('border-primary/0');
          }, 110);
        }
      });
    }

    // Timer Loop
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (isPaused) return;

      remainingTime--;
      if (timerDisplay) timerDisplay.textContent = `${remainingTime}s`;
      if (activeDuoCanvas) {
        activeDuoCanvas.setTimeRemaining(remainingTime);
        if (workout.hasHalfwaySideSwitch && remainingTime <= 30) {
          activeDuoCanvas.isHalfwayFlipped = true;
        }
      }

      if (progressBar) {
        const pct = Math.max(0, Math.round((remainingTime / totalDuration) * 100));
        progressBar.style.width = `${pct}%`;
      }

      // Check Cadence Voice Prompts
      checkCadenceCues(remainingTime);

      // Final 5s countdown audio clicks
      if (remainingTime > 0 && remainingTime <= 5) {
        Sound.click();
      }

      // Move Complete!
      if (remainingTime <= 0) {
        handleMoveCompletion();
      }
    }, 1000);
  }

  function handleMoveCompletion() {
    stopTimer();
    Sound.fanfare();
    confetti({ particleCount: 80, spread: 80 });

    if (isVoiceEnabled) {
      const finishCue = workout.audioCues?.finalCheer || `Spectacular move with Coach ${workout.coachName}! You crushed it!`;
      try {
        speakCompanion(finishCue, coachPet.id);
      } catch (e) {}
    }

    if (sessionMode === 'circuit') {
      if (currentCircuitIndex < DINO_WORKOUTS.length - 1) {
        // Start 10s Water Break before next circuit move!
        startRestBreak();
      } else {
        // Grand 8-Minute Circuit Completed!
        workoutPhase = 'circuit_complete';
        if (activeControls) activeControls.classList.add('hidden');
        if (btnFinishCircuit) btnFinishCircuit.classList.remove('hidden');
      }
    } else {
      // Single Move Practice Finished
      workoutPhase = 'finished';
      if (activeControls) activeControls.classList.add('hidden');
      if (btnFinish) btnFinish.classList.remove('hidden');
    }
  }

  // 10-Second Water Break Rest Intermission
  function startRestBreak() {
    workoutPhase = 'rest_break';
    restRemainingTime = 10;
    if (activeControls) activeControls.classList.add('hidden');
    Sound.stopWorkoutBeat();

    const restDisplay = document.getElementById('workout-rest-display');
    const restTimer = document.getElementById('rest-timer-display');
    if (restDisplay) restDisplay.classList.remove('hidden');
    if (restTimer) restTimer.textContent = restRemainingTime;

    if (isVoiceEnabled) {
      try {
        speakCompanion("Great job! Grab a sip of water, shake out your arms and legs, and get ready for the next move!", coachPet.id);
      } catch (e) {}
    }

    if (restBreakInterval) clearInterval(restBreakInterval);
    restBreakInterval = setInterval(() => {
      restRemainingTime--;
      if (restTimer) restTimer.textContent = restRemainingTime;

      if (restRemainingTime <= 0) {
        stopRestBreak();
        advanceToNextCircuitMove();
      }
    }, 1000);
  }

  function stopRestBreak() {
    if (restBreakInterval) {
      clearInterval(restBreakInterval);
      restBreakInterval = null;
    }
    const restDisplay = document.getElementById('workout-rest-display');
    if (restDisplay) restDisplay.classList.add('hidden');
  }

  function advanceToNextCircuitMove() {
    currentCircuitIndex++;
    if (currentCircuitIndex >= DINO_WORKOUTS.length) {
      currentCircuitIndex = 0;
    }
    const nextWorkout = DINO_WORKOUTS[currentCircuitIndex];
    store.setActiveWorkoutId(nextWorkout.id);
    resetWorkoutState();
    try {
      prewarmWorkoutAudio(nextWorkout.id, nextWorkout.coachId);
    } catch (e) {}
    store.notify();
  }

  const btnSkipBreak = document.getElementById('btn-skip-break');
  if (btnSkipBreak) {
    btnSkipBreak.addEventListener('click', () => {
      Sound.bloop();
      stopRestBreak();
      advanceToNextCircuitMove();
    });
  }

  // PAUSE / RESUME Control
  if (btnPauseResume) {
    btnPauseResume.addEventListener('click', () => {
      Sound.bloop();
      isPaused = !isPaused;
      if (isPaused) {
        if (pauseResumeIcon) pauseResumeIcon.textContent = 'play_arrow';
        if (pauseResumeText) pauseResumeText.textContent = 'Resume';
        Sound.stopWorkoutBeat();
        if (activeDuoCanvas) activeDuoCanvas.pauseAnimation();
      } else {
        if (pauseResumeIcon) pauseResumeIcon.textContent = 'pause';
        if (pauseResumeText) pauseResumeText.textContent = 'Pause';
        if (isMusicEnabled) {
          Sound.startWorkoutBeat(workout.tempoBpm || 120, () => {
            if (activeDuoCanvas) activeDuoCanvas.triggerBeat();
          });
        }
        if (activeDuoCanvas) activeDuoCanvas.resumeAnimation();
      }
    });
  }

  // REPEAT / RESTART MOVE
  if (btnRepeat) {
    btnRepeat.addEventListener('click', () => {
      Sound.bloop();
      stopTimer();
      spokenTimelineSet.clear();
      isPaused = false;
      if (pauseResumeIcon) pauseResumeIcon.textContent = 'pause';
      if (pauseResumeText) pauseResumeText.textContent = 'Pause';
      startActiveWorkoutTimer();
    });
  }

  // SKIP TO NEXT CIRCUIT MOVE
  if (btnSkipNext) {
    btnSkipNext.addEventListener('click', () => {
      Sound.bloop();
      stopTimer();
      stopRestBreak();
      advanceToNextCircuitMove();
    });
  }

  // FINISH SINGLE MOVE: Claim Move Rewards
  if (btnFinish) {
    btnFinish.addEventListener('click', () => {
      Sound.fanfare();
      const tier = DURATION_TIERS[selectedDurationTier] || DURATION_TIERS.titan;
      const finalXp = Math.round(tier.xp * (isDailyFeatured ? 1.25 : 1.0));
      const finalCoins = tier.coins;
      const sparks = tier.sparks;

      const streak = store.recordWorkoutCompletion(workout.id, finalXp, finalCoins, sparks);
      confetti({ particleCount: 120, spread: 100 });

      store.showReward(
        'Coach Workout Complete! 🏅',
        `Tremendous workout with Coach ${workout.coachName}! Earned +${sparks} Evolution Sparks ✨, +${finalXp} Training XP ⚡, and +${finalCoins} Hero Coins 🪙! Streak: ${streak.currentStreak || 1} Days!`,
        finalCoins,
        0,
        null,
        'fitness_center'
      );

      teardownAndExit();
    });
  }

  // FINISH 8-MINUTE CIRCUIT: Grand Trophy Celebration
  if (btnFinishCircuit) {
    btnFinishCircuit.addEventListener('click', () => {
      Sound.fanfare();
      // Massive circuit rewards: 8 moves = +120 Sparks, +400 XP, +400 Coins
      const totalSparks = 120;
      const totalXp = 400;
      const totalCoins = 400;

      const streak = store.recordWorkoutCompletion('circuit_full', totalXp, totalCoins, totalSparks);
      confetti({ particleCount: 200, spread: 140 });

      store.showReward(
        'Grand 8-Minute Dino Circuit Master! 🏆',
        `Unbelievable dedication! You powered through all 8 Dinosaur Workouts! Earned +${totalSparks} Evolution Sparks ✨, +${totalXp} Training XP ⚡, and +${totalCoins} Hero Coins 🪙! Streak: ${streak.currentStreak || 1} Days!`,
        totalCoins,
        0,
        null,
        'trophy'
      );

      teardownAndExit();
    });
  }
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  Sound.stopWorkoutBeat();
  if (activeDuoCanvas) {
    activeDuoCanvas.stopAnimation();
  }
}

function resetWorkoutState() {
  stopTimer();
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (restBreakInterval) {
    clearInterval(restBreakInterval);
    restBreakInterval = null;
  }
  workoutPhase = 'idle';
  isPaused = false;
  remainingTime = 60;
  totalDuration = 60;
  spokenTimelineSet.clear();
}

function teardownAndExit() {
  resetWorkoutState();
  stopRex();
  Sound.stopWorkoutBeat();
  if (activeDuoCanvas) {
    activeDuoCanvas.destroy();
    activeDuoCanvas = null;
  }
  store.navigate('pet_sanctuary');
}

export function abandonDinoWorkoutIfRunning() {
  resetWorkoutState();
  stopRex();
  Sound.stopWorkoutBeat();
  if (activeDuoCanvas) {
    activeDuoCanvas.destroy();
    activeDuoCanvas = null;
  }
}
