import { store } from '../state/store.js';
import { getPetById } from '../data/petsData.js';
import { PetSanctuaryCanvas } from '../components/PetSanctuaryCanvas.js';
import { speakCompanion } from '../services/voiceService.js';
import confetti from 'canvas-confetti';

let activeCanvasInstance = null;
let timerInterval = null;
let isWorkingOut = false;
let countdown = 30;

export function renderDinoWorkoutView() {
  const hero = store.getState().selectedHero;
  const petId = hero?.activePetId || '1';
  const pet = getPetById(petId);
  
  const workoutId = store.getState().activeWorkoutId || pet.workoutId || 'trex_run';
  let workoutDetails = getWorkoutDetails(workoutId);

  return `
    <div class="p-6 h-full flex flex-col bg-slate-900 text-slate-100 overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-3xl font-black text-emerald-400 drop-shadow-md">Dino Workout!</h2>
        <button id="btn-close-workout" class="bg-slate-700 hover:bg-slate-600 text-white rounded-full w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center shadow active:scale-95 transition-all" aria-label="Close Workout">
          <span class="material-symbols-outlined text-2xl">close</span>
        </button>
      </div>
      
      <div class="bg-slate-800 rounded-2xl p-6 flex-1 flex flex-col items-center justify-center border-2 border-slate-700 shadow-xl text-center relative overflow-hidden">
        
        <h3 class="text-2xl font-bold text-amber-400 mb-2">${workoutDetails.name}</h3>
        <p class="text-slate-300 text-lg mb-6 max-w-md">${workoutDetails.instructions}</p>
        
        <div class="relative w-48 h-48 sm:w-64 sm:h-64 max-w-full aspect-square mb-6 bg-slate-900 rounded-full border-4 border-emerald-500 shadow-lg overflow-hidden flex items-center justify-center" id="workout-canvas-container">
          <!-- 3D Canvas goes here -->
        </div>

        <div id="workout-timer-display" class="text-5xl font-black text-white mb-6 hidden font-mono">30</div>
        
        <button id="btn-start-workout" class="bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 sm:py-4 px-8 sm:px-10 rounded-full text-xl sm:text-2xl shadow-lg min-h-[52px] transition-transform transform hover:scale-105 active:scale-95">
          START
        </button>

        <button id="btn-finish-workout" class="bg-amber-500 hover:bg-amber-400 text-white font-bold py-3.5 sm:py-4 px-8 sm:px-10 rounded-full text-xl sm:text-2xl shadow-lg hidden min-h-[52px]">
          FINISH
        </button>
      </div>
    </div>
  `;
}

function getWorkoutDetails(workoutId) {
  const workouts = {
    velociraptor_run: { name: 'Velociraptor Run', instructions: 'Run in place as fast as you can!' },
    stegosaurus_walks: { name: 'Stegosaurus Walks', instructions: 'On your hands & feet, hips high, walk forward and back, stomping loudly' },
    pterodactyl_takeoff: { name: 'Pterodactyl Take Off', instructions: 'Spread your arms wide and move them quickly in a circle, jump up and down as high as you can' },
    trex_run: { name: 'T-Rex Run', instructions: 'Put your elbows in your armpits and run in place lifting your knees as high as you can' },
    compsognathus_prance: { name: 'Compsognathus Prance', instructions: 'Jump left & right, crossing one leg behind the other as you move' },
    brachiosaurus_stretch: { name: 'Brachiosaurus Stretch', instructions: 'Stand up straight, stretch as tall as you can with your arms up standing on your tip toes. How far can you reach?' },
    diplodocus: { name: 'The Diplodocus', instructions: 'Start on your hands & knees, stretch your left leg behind you and your right arm in front of you. Move your leg up, down, left, & right. Then switch sides and repeat.' },
    spinosaurus_stretch: { name: 'Spinosaurus Stretch', instructions: "Draw your belly to your spine and round your back toward the ceiling. Your back should be in an arch-like shape, similar to the spines on the spinosaurus' back." }
  };
  return workouts[workoutId] || workouts.trex_run;
}

export function attachDinoWorkoutListeners() {
  const hero = store.getState().selectedHero;
  const petId = hero?.activePetId || '1';
  const pet = getPetById(petId);
  const workoutId = store.getState().activeWorkoutId || pet.workoutId || 'trex_run';

  const container = document.getElementById('workout-canvas-container');
  if (container) {
    if (activeCanvasInstance) {
      activeCanvasInstance.destroy();
    }
    activeCanvasInstance = new PetSanctuaryCanvas(container, { petId: petId });
    if (activeCanvasInstance.setWorkoutMode) {
      activeCanvasInstance.setWorkoutMode(workoutId);
    }
  }

  const btnClose = document.getElementById('btn-close-workout');
  const btnStart = document.getElementById('btn-start-workout');
  const btnFinish = document.getElementById('btn-finish-workout');
  const timerDisplay = document.getElementById('workout-timer-display');

  if (btnClose) {
    btnClose.addEventListener('click', () => {
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
      isWorkingOut = true;
      btnStart.classList.add('hidden');
      timerDisplay.classList.remove('hidden');
      
      try {
         const wId = store.getState().activeWorkoutId || getPetById(petId).workoutId || 'trex_run';
         speakCompanion(getWorkoutDetails(wId).instructions, petId);
      } catch(e) {}

      if (activeCanvasInstance && activeCanvasInstance.startWorkoutAnimation) {
         activeCanvasInstance.startWorkoutAnimation();
      }

      countdown = 30;
      timerDisplay.textContent = countdown;

      timerInterval = setInterval(() => {
        countdown--;
        timerDisplay.textContent = countdown;
        if (countdown <= 0) {
          stopTimer();
          timerDisplay.classList.add('hidden');
          btnFinish.classList.remove('hidden');
        }
      }, 1000);
    });
  }

  if (btnFinish) {
    btnFinish.addEventListener('click', () => {
      if (store.addEvolutionSparks) {
        store.addEvolutionSparks(petId, 15);
      }
      if (store.addCoins) {
        store.addCoins(25);
      }
      
      confetti({ particleCount: 100, spread: 90 });
      
      store.saveState(true);
      
      store.showReward('Workout Complete! 🦕', 'Amazing job! Your dino companion gained +15 Evolution Sparks and you earned +25 Hero Coins!', 25, 0, null, 'fitness_center');
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
