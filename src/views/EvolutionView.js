import { renderPet3DViewer, initPet3DViewer } from '../components/Pet3DViewer.js';
import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { speakRex } from '../services/voiceService.js';
import confetti from 'canvas-confetti';
import { PETS_DATABASE } from '../data/petsData.js';

let isCeremonyPlaying = false;
let ceremonyData = null;

export function renderEvolutionView() {
  const state = store.getState();
  const activePet = store.getActivePet();
  const currentStage = activePet.stage || 1;
  const sparks = store.getPetSparks(activePet.id);
  const isReady = sparks >= 100;

  // Retrieve authentic 4-stage titles from activePet.evolutionStages (or PETS_DATABASE fallback)
  const petDbEntry = state.pets?.find((p) => p.id === activePet.id) || PETS_DATABASE.find((p) => p.id === activePet.id) || activePet;
  const stageNames = petDbEntry?.evolutionStages || ["Mystic Egg", "Baby Hatchling", "Armored Guardian", "Titan Ascendant"];

  const stageIcons = ['egg', 'pets', 'shield', 'auto_awesome'];

  const stages = [1, 2, 3, 4].map((num) => ({
    num,
    name: stageNames[num - 1] || `Stage ${num}`,
    icon: stageIcons[num - 1] || 'pets'
  }));

  const nextStageName = currentStage < 4 ? stageNames[currentStage] : stageNames[3];

  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in select-none">
      
      <!-- Top Bar -->
      <div class="flex items-center justify-between">
        <button id="evolve-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm">
          <span class="material-symbols-outlined text-base">arrow_back</span> Back to Sanctuary
        </button>
        <div class="flex flex-col items-end">
          <h1 class="font-headline text-2xl font-black text-primary text-shadow">Big Evolution Matrix</h1>
          <span class="text-xs font-bold text-secondary">Harness Evolution Sparks to Ascend</span>
        </div>
      </div>

      <!-- Center 3D Pedestal Stage -->
      <div class="relative bg-gradient-to-b from-[#16212b] via-[#121d26] to-[#09141e] rounded-3xl p-6 border-4 border-primary/40 min-h-[340px] card-shadow flex flex-col items-center justify-between overflow-hidden">
        
        <!-- Glowing Aura Particles Background -->
        <div class="absolute inset-0 bg-radial from-primary/20 via-transparent to-transparent pointer-events-none"></div>

        <div class="w-full flex justify-between items-center text-xs font-black uppercase text-secondary z-10">
          <span>${activePet.name}</span>
          <span class="text-primary animate-pulse">Stage ${currentStage} / 4 • ${stageNames[currentStage - 1]}</span>
        </div>

        <!-- 3D Companion Interactive Model on Pedestal -->
        <div class="relative z-10 w-full flex items-center justify-center my-2">
          ${renderPet3DViewer({
            canvasId: 'evolution-pedestal-3d-canvas',
            petId: activePet.id,
            stage: currentStage,
            mode: 'evolution',
            avatarFallback: currentStage >= 3 && activePet.evolvedAvatar ? activePet.evolvedAvatar : activePet.avatar,
            petName: activePet.name,
            width: 290,
            height: 290,
            showControls: false
          })}
        </div>

        <!-- Pedestal Base -->
        <div class="w-52 h-6 bg-gradient-to-r from-surface-container-highest via-primary/40 to-surface-container-highest rounded-full border-2 border-primary/50 shadow-[0_0_30px_rgba(84,233,138,0.4)]"></div>

      </div>

      <!-- Evolution Sparks Status & Progress Meter -->
      <section class="bg-surface-container rounded-3xl p-5 border-2 border-primary/30 card-shadow flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-primary text-xl font-black material-symbols-outlined">auto_awesome</span>
            <h2 class="font-headline text-sm font-black text-inverse-surface">Evolution Sparks Accumulator</h2>
          </div>
          <span class="text-xs font-black text-primary bg-primary/20 px-3 py-1 rounded-full border border-primary/40">
            ⚡ ${sparks} / 100 Sparks
          </span>
        </div>

        <div class="w-full h-4 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
          <div class="h-full bg-gradient-to-r from-primary via-secondary to-primary rounded-full transition-all duration-500 ${isReady ? 'animate-pulse' : ''}" style="width: ${Math.min(100, sparks)}%;"></div>
        </div>

        <div class="flex justify-between items-center text-[11px] font-bold text-on-surface-variant pt-1">
          <span>🧹 Earn +15 Sparks per verified chore</span>
          <span>🪥 Earn +10 Sparks per Toothbrush AR battle</span>
          <span>🧺 +10 Sparks from Group Picnic</span>
        </div>
      </section>

      <!-- 4-Stage Authentic Pedestal Progression -->
      <section class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        ${stages
          .map((s) => {
            const isReached = currentStage >= s.num;
            const isCurrent = currentStage === s.num;

            return `
            <div class="bg-surface-container rounded-3xl p-4 border-2 ${
              isCurrent
                ? 'border-primary bg-surface-container-high shadow-[0_0_20px_rgba(84,233,138,0.3)]'
                : isReached
                ? 'border-surface-container-highest opacity-90'
                : 'border-surface-container-lowest opacity-40'
            } card-shadow flex flex-col items-center text-center gap-2">
              
              <div class="w-12 h-12 rounded-2xl ${
                isReached ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
              } flex items-center justify-center text-2xl shadow-inner">
                <span class="material-symbols-outlined">${s.icon}</span>
              </div>

              <span class="font-headline text-xs font-black text-inverse-surface">Stage ${s.num}</span>
              <span class="text-xs font-black text-secondary leading-tight line-clamp-2">${s.name}</span>

              ${
                isCurrent
                  ? `<span class="bg-primary/20 text-primary text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-primary/30">Active Form</span>`
                  : isReached
                  ? `<span class="text-primary text-xs font-black">✓ Unlocked</span>`
                  : `<span class="text-on-surface-variant text-[10px] font-bold">🔒 Locked</span>`
              }
            </div>
          `;
          })
          .join('')}
      </section>

      <!-- Evolution Action Trigger -->
      <div class="flex justify-center pt-2">
        ${
          currentStage < 4
            ? `
          <button id="trigger-big-evolution-btn" class="w-full max-w-lg bg-gradient-to-r from-primary to-primary-fixed text-on-primary font-headline text-base font-black py-4.5 px-6 rounded-2xl chunky-btn border-primary-container shadow-chunky-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2.5 ${
            isReady ? 'animate-pulse-glow' : ''
          }">
            <span class="material-symbols-outlined text-2xl">auto_awesome</span>
            TRIGGER BIG EVOLUTION TO ${nextStageName.toUpperCase()}!
          </button>
        `
            : `
          <div class="bg-surface-container-high text-secondary font-headline text-sm font-black px-8 py-4 rounded-2xl border-2 border-secondary flex items-center gap-2 shadow-sm">
            <span class="material-symbols-outlined text-2xl">military_tech</span>
            MAXIMUM ASCENDANT TITAN EVOLUTION REACHED!
          </div>
        `
        }
      </div>

      <!-- CINEMATIC EVOLUTION CEREMONY OVERLAY -->
      ${renderCeremonyOverlay()}

    </div>
  `;
}

function renderCeremonyOverlay() {
  if (!isCeremonyPlaying || !ceremonyData) return '';

  const { petName, nextStage, nextStageTitle, evolvedAvatar } = ceremonyData;

  return `
    <div id="ceremony-backdrop" class="fixed inset-0 bg-black/95 backdrop-blur-2xl z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      
      <!-- Converging Elemental Light Beams -->
      <div class="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <div class="w-[600px] h-[600px] bg-gradient-to-tr from-amber-400/20 via-primary/30 to-secondary/30 rounded-full filter blur-3xl animate-pulse"></div>
        <div class="absolute w-[400px] h-[400px] border-4 border-dashed border-primary/40 rounded-full animate-spin-slow"></div>
        <div class="absolute w-[520px] h-[520px] border-2 border-dashed border-secondary/30 rounded-full animate-spin-slow" style="animation-direction: reverse;"></div>
      </div>

      <!-- Central Ceremony Card -->
      <div class="relative z-10 bg-surface-container/95 border-4 border-primary rounded-3xl p-6 sm:p-8 max-w-md w-full card-shadow-lg flex flex-col items-center text-center gap-5">
        
        <!-- Header Sparkle Pill -->
        <div class="bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs font-black uppercase px-4 py-1 rounded-full shadow-md animate-bounce">
          ✨ GRAND EVOLUTION COMPLETE! ✨
        </div>

        <h2 class="font-headline text-2xl sm:text-3xl font-black text-inverse-surface">
          ${petName} Has Evolved!
        </h2>

        <!-- Evolved Pet on Golden Glowing Stage -->
        <div class="relative w-48 h-48 flex items-center justify-center animate-float my-2">
          <div class="absolute inset-0 bg-primary/20 rounded-full filter blur-xl animate-pulse"></div>
          <img class="w-full h-full object-contain drop-shadow-[0_20px_30px_rgba(84,233,138,0.5)] z-10" src="${evolvedAvatar}" alt="${petName}" />
        </div>

        <!-- Pedestal Base -->
        <div class="w-44 h-4 bg-gradient-to-r from-primary via-amber-400 to-primary rounded-full shadow-[0_0_25px_rgba(241,196,15,0.7)]"></div>

        <!-- Stage Title Reveal Banner -->
        <div class="flex flex-col items-center">
          <span class="text-xs font-black uppercase text-on-surface-variant">Now Ascended to Stage ${nextStage}</span>
          <span class="font-headline text-xl sm:text-2xl font-black text-primary text-shadow mt-0.5">
            "${nextStageTitle}"
          </span>
        </div>

        <!-- Rewards Badge -->
        <div class="flex items-center gap-4 bg-surface-container-high px-4 py-2 rounded-2xl border border-surface-container-highest">
          <div class="flex items-center gap-1.5 text-secondary font-headline text-xs font-black">
            <span class="material-symbols-outlined text-base">monetization_on</span> +100 Tokens
          </div>
          <div class="w-px h-4 bg-surface-container-highest"></div>
          <div class="flex items-center gap-1.5 text-primary font-headline text-xs font-black">
            <span class="material-symbols-outlined text-base">star</span> +100 Hero XP
          </div>
        </div>

        <!-- Continue Button -->
        <button id="ceremony-continue-btn" class="w-full bg-gradient-to-r from-primary to-primary-fixed text-on-primary font-headline text-base font-black py-4 rounded-2xl chunky-btn shadow-chunky-sm hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-2xl">pets</span>
          CONTINUE HERO ADVENTURE
        </button>

      </div>
    </div>
  `;
}

export function playEvolutionCeremony() {
  const activePet = store.getActivePet();
  const currentStage = activePet.stage || 1;
  if (currentStage >= 4) return;

  const state = store.getState();
  const petDbEntry = state.pets?.find((p) => p.id === activePet.id) || PETS_DATABASE.find((p) => p.id === activePet.id) || activePet;
  const stageNames = petDbEntry?.evolutionStages || ["Mystic Egg", "Baby Hatchling", "Armored Guardian", "Titan Ascendant"];
  const nextStage = currentStage + 1;
  const nextStageTitle = stageNames[nextStage - 1] || `Stage ${nextStage}`;

  // Advance stage in store
  store.evolvePetStage(activePet.id);

  // Play ascending harmonic chime & fanfare
  Sound.evolutionAscent();
  Sound.fanfare();
        evo3DController?.triggerEvolutionMorph(nextStage);

  // Burst confetti
  confetti({
    particleCount: 200,
    spread: 120,
    origin: { y: 0.5 },
    colors: ['#2ecc71', '#f1c40f', '#3498db', '#9b59b6', '#ff4757']
  });

  // Prepare ceremony overlay data
  const evolvedAvatar = nextStage >= 3 && activePet.evolvedAvatar ? activePet.evolvedAvatar : activePet.avatar;
  ceremonyData = {
    petName: activePet.name,
    nextStage,
    nextStageTitle,
    evolvedAvatar
  };
  isCeremonyPlaying = true;
  store.notify();

  // Rex celebratory voice announcement
  setTimeout(() => {
    speakRex(`INCREDIBLE! ${activePet.name} has evolved into ${nextStageTitle}! Look at that golden power!`);
  }, 600);
}

export function attachEvolutionListeners() {
  // Initialize 3D Pet on Evolution Pedestal
  const evo3DController = initPet3DViewer('evolution-pedestal-3d-canvas', {
    petId: store.getActivePet()?.id || 'rex',
    stage: store.getActivePet()?.stage || 1,
    mode: 'evolution'
  });

  const backBtn = document.getElementById('evolve-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate('pet_pen');
    });
  }

  const evolveTriggerBtn = document.getElementById('trigger-big-evolution-btn');
  if (evolveTriggerBtn) {
    evolveTriggerBtn.addEventListener('click', () => {
      playEvolutionCeremony();
    });
  }

  const ceremonyContinueBtn = document.getElementById('ceremony-continue-btn');
  if (ceremonyContinueBtn) {
    ceremonyContinueBtn.addEventListener('click', () => {
      Sound.click();
      isCeremonyPlaying = false;
      ceremonyData = null;
      store.navigate('pet_pen');
    });
  }
}
