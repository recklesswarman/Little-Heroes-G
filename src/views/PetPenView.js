import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';

export function renderPetPenView() {
  const state = store.getState();
  const hero = state.selectedHero;
  const hasPet = hero.hasChosenStarterPet && hero.unlockedPetIds && hero.unlockedPetIds.length > 0;
  const activePet = store.getActivePet();
  const currentAvatar = activePet.stage >= 3 && activePet.evolvedAvatar ? activePet.evolvedAvatar : activePet.avatar;

  if (!hasPet) {
    return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in">
      
      <!-- Top Navigation & Roster Hub Link -->
      <div class="flex items-center justify-between">
        <div class="flex flex-col">
          <span class="text-[10px] font-black uppercase tracking-widest text-primary">Companion Sanctuary</span>
          <h1 class="font-headline text-2xl font-black text-inverse-surface text-shadow">Choose Your First Pet!</h1>
        </div>

        <div class="flex items-center gap-2">
          <!-- 24 Pet Roster Button -->
          <button id="pen-view-roster-btn" class="bg-surface-container hover:bg-surface-bright text-primary font-headline text-xs font-black px-4 py-2.5 rounded-2xl border-2 border-primary/40 flex items-center gap-1.5 chunky-btn-sm">
            <span class="material-symbols-outlined text-base">grid_view</span> 24 Pet Roster
          </button>
        </div>
      </div>

      <!-- Main 3D Pet Stage Pedestal (Empty / Summoning State) -->
      <div class="relative bg-gradient-to-b from-[#16212b] via-[#121d26] to-[#09141e] rounded-3xl p-8 border-4 border-surface-container-highest min-h-[380px] card-shadow flex flex-col items-center justify-center gap-5 overflow-hidden text-center">
        
        <!-- Glowing Ambient Lighting -->
        <div class="absolute inset-0 bg-radial from-primary/20 via-transparent to-transparent pointer-events-none"></div>

        <div class="z-10 flex flex-col items-center gap-2 max-w-md">
          <span class="bg-primary/20 text-primary text-xs font-black uppercase px-3.5 py-1 rounded-full border border-primary/40">
            Welcome to the Sanctuary! 🐾
          </span>
          <h2 class="font-headline text-2xl sm:text-3xl font-black text-inverse-surface">
            Your First Companion Awaits!
          </h2>
          <p class="text-sm text-on-surface-variant font-bold">
            Select your companion to hatch at Stage 1. They will adventure with you in daily quests and toothbrush battles!
          </p>
        </div>

        <!-- Central Summon Portal / Egg -->
        <div id="pen-choose-starter-trigger" class="relative z-10 w-44 h-44 flex flex-col items-center justify-center cursor-pointer group my-2">
          <div class="w-36 h-36 rounded-full bg-gradient-to-tr from-primary/25 to-secondary/25 border-3 border-dashed border-primary flex items-center justify-center text-6xl text-primary animate-pulse shadow-xl group-hover:scale-105 transition-transform">
            <span class="material-symbols-outlined text-7xl" style="font-variation-settings: 'FILL' 1;">egg</span>
          </div>
          <span class="mt-2 text-[11px] font-black uppercase tracking-wider text-secondary">Tap to Choose Companion</span>
        </div>

        <!-- Call to Action Button -->
        <div class="z-10">
          <button id="pen-choose-starter-btn" class="bg-gradient-to-r from-primary to-secondary text-on-primary font-headline text-sm sm:text-base font-black px-8 py-4 rounded-2xl chunky-btn shadow-chunky-sm flex items-center gap-2.5 hover:brightness-110 active:scale-95">
            <span class="material-symbols-outlined text-2xl">pets</span> CHOOSE YOUR FIRST COMPANION
          </button>
        </div>
      </div>

    </div>
    `;
  }

  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in">
      
      <!-- Top Navigation & Roster Hub Link -->
      <div class="flex items-center justify-between">
        <div class="flex flex-col">
          <span class="text-[10px] font-black uppercase tracking-widest text-primary">Companion Sanctuary</span>
          <h1 class="font-headline text-2xl font-black text-inverse-surface text-shadow">${activePet.name}</h1>
        </div>

        <div class="flex items-center gap-2">
          <!-- 24 Pet Roster Button -->
          <button id="pen-view-roster-btn" class="bg-surface-container hover:bg-surface-bright text-primary font-headline text-xs font-black px-4 py-2.5 rounded-2xl border-2 border-primary/40 flex items-center gap-1.5 chunky-btn-sm">
            <span class="material-symbols-outlined text-base">grid_view</span> 24 Pet Roster
          </button>

          <!-- Master Fuse Button -->
          <button id="pen-master-fuse-btn" class="bg-gradient-to-r from-secondary-container to-secondary text-on-secondary font-headline text-xs font-black px-4 py-2.5 rounded-2xl chunky-btn border-secondary-container shadow-sm flex items-center gap-1">
            <span class="material-symbols-outlined text-base">science</span> Master Fuse
          </button>
        </div>
      </div>

      <!-- Main 3D Pet Stage Pedestal -->
      <div class="relative bg-gradient-to-b from-[#16212b] via-[#121d26] to-[#09141e] rounded-3xl p-6 border-4 border-surface-container-highest min-h-[320px] card-shadow flex flex-col items-center justify-between overflow-hidden">
        
        <!-- Glowing Ambient Lighting -->
        <div class="absolute inset-0 bg-radial from-primary/15 via-transparent to-transparent pointer-events-none"></div>

        <!-- Top Stage Banner -->
        <div class="w-full flex justify-between items-center text-xs font-black uppercase text-on-surface-variant z-10">
          <span class="bg-surface-container-lowest/80 px-3 py-1 rounded-full border border-surface-container-highest text-secondary">
            ${activePet.element} Element
          </span>
          <button id="pen-evolve-stage-btn" class="bg-primary/20 hover:bg-primary/30 text-primary px-3.5 py-1 rounded-full border border-primary/40 flex items-center gap-1 chunky-btn-sm">
            <span class="material-symbols-outlined text-sm">auto_awesome</span> Stage ${activePet.stage}/4 • Big Evolution
          </button>
        </div>

        <!-- Central 3D Floating Pet -->
        <div id="pen-pet-character" class="relative z-10 w-52 h-52 flex items-center justify-center animate-float cursor-pointer group my-2">
          <img class="w-full h-full object-contain drop-shadow-[0_20px_25px_rgba(0,0,0,0.8)] group-hover:scale-105 transition-transform" src="${currentAvatar}" alt="${activePet.name}" />
        </div>

        <!-- Pedestal Base & Lore Badge -->
        <div class="z-10 flex flex-col items-center gap-2">
          <div class="w-48 h-5 bg-gradient-to-r from-surface-container-highest via-surface-bright to-surface-container-highest rounded-full border-2 border-primary/30 shadow-[0_0_20px_rgba(84,233,138,0.25)]"></div>
          <span class="text-xs font-bold text-on-surface-variant text-center">${activePet.habitBonus}</span>
        </div>
      </div>

      <!-- 4 Vital Need Bars (Hunger, Hygiene, Energy, Joy) -->
      <section class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col gap-3">
        <h2 class="font-headline text-xs font-black uppercase text-on-surface-variant tracking-wider">Companion Needs & Vitals</h2>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          <!-- Hunger Bar -->
          <div class="bg-surface-container-high p-3 rounded-2xl border border-surface-container-highest flex flex-col gap-1.5">
            <div class="flex justify-between items-center text-xs font-black">
              <span class="text-error flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">restaurant</span> Fullness
              </span>
              <span class="text-inverse-surface">${activePet.hunger}%</span>
            </div>
            <div class="w-full h-3.5 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
              <div class="h-full bg-error rounded-full transition-all duration-300" style="width: ${activePet.hunger}%;"></div>
            </div>
          </div>

          <!-- Hygiene Bar -->
          <div class="bg-surface-container-high p-3 rounded-2xl border border-surface-container-highest flex flex-col gap-1.5">
            <div class="flex justify-between items-center text-xs font-black">
              <span class="text-tertiary flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">water_drop</span> Cleanliness
              </span>
              <span class="text-inverse-surface">${activePet.hygiene}%</span>
            </div>
            <div class="w-full h-3.5 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
              <div class="h-full bg-tertiary rounded-full transition-all duration-300" style="width: ${activePet.hygiene}%;"></div>
            </div>
          </div>

          <!-- Energy Bar -->
          <div class="bg-surface-container-high p-3 rounded-2xl border border-surface-container-highest flex flex-col gap-1.5">
            <div class="flex justify-between items-center text-xs font-black">
              <span class="text-secondary flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">bolt</span> Energy
              </span>
              <span class="text-inverse-surface">${activePet.energy}%</span>
            </div>
            <div class="w-full h-3.5 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
              <div class="h-full bg-secondary rounded-full transition-all duration-300" style="width: ${activePet.energy}%;"></div>
            </div>
          </div>

          <!-- Joy Bar -->
          <div class="bg-surface-container-high p-3 rounded-2xl border border-surface-container-highest flex flex-col gap-1.5">
            <div class="flex justify-between items-center text-xs font-black">
              <span class="text-primary flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">mood</span> Happiness
              </span>
              <span class="text-inverse-surface">${activePet.joy}%</span>
            </div>
            <div class="w-full h-3.5 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
              <div class="h-full bg-primary rounded-full transition-all duration-300" style="width: ${activePet.joy}%;"></div>
            </div>
          </div>

        </div>
      </section>

      <!-- Pet Interaction Action Dock -->
      <section class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        
        <!-- Feed Snack -->
        <button id="pen-feed-btn" class="bg-surface-container hover:bg-surface-bright rounded-3xl p-4 border-2 border-surface-container-highest card-shadow flex flex-col items-center justify-center gap-2 chunky-btn text-center active:scale-95 group">
          <div class="w-14 h-14 rounded-2xl bg-secondary-container/20 text-secondary flex items-center justify-center text-3xl border border-secondary-container/40 group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-3xl">nutrition</span>
          </div>
          <div class="flex flex-col">
            <span class="font-headline text-sm font-black text-inverse-surface">Feed Snack</span>
            <span class="text-[10px] font-bold text-on-surface-variant">+25 Fullness</span>
          </div>
        </button>

        <!-- 3D Bathtub Minigame -->
        <button id="pen-bath-btn" class="bg-surface-container hover:bg-surface-bright rounded-3xl p-4 border-2 border-surface-container-highest card-shadow flex flex-col items-center justify-center gap-2 chunky-btn text-center active:scale-95 group">
          <div class="w-14 h-14 rounded-2xl bg-tertiary-container/20 text-tertiary flex items-center justify-center text-3xl border border-tertiary-container/40 group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-3xl">bathtub</span>
          </div>
          <div class="flex flex-col">
            <span class="font-headline text-sm font-black text-inverse-surface">Bathtub Wash</span>
            <span class="text-[10px] font-bold text-on-surface-variant">Scrub & Blow Dry</span>
          </div>
        </button>

        <!-- Pet & Play Joy -->
        <button id="pen-play-btn" class="bg-surface-container hover:bg-surface-bright rounded-3xl p-4 border-2 border-surface-container-highest card-shadow flex flex-col items-center justify-center gap-2 chunky-btn text-center active:scale-95 group">
          <div class="w-14 h-14 rounded-2xl bg-primary-container/20 text-primary flex items-center justify-center text-3xl border border-primary-container/40 group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-3xl">favorite</span>
          </div>
          <div class="flex flex-col">
            <span class="font-headline text-sm font-black text-inverse-surface">Pet & Hug</span>
            <span class="text-[10px] font-bold text-on-surface-variant">+20 Happiness</span>
          </div>
        </button>

        <!-- Pet Learning Adventures Map -->
        <button id="pen-adventures-btn" class="bg-surface-container hover:bg-surface-bright rounded-3xl p-4 border-2 border-surface-container-highest card-shadow flex flex-col items-center justify-center gap-2 chunky-btn text-center active:scale-95 group">
          <div class="w-14 h-14 rounded-2xl bg-secondary-container/20 text-secondary flex items-center justify-center text-3xl border border-secondary-container/40 group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-3xl">explore</span>
          </div>
          <div class="flex flex-col">
            <span class="font-headline text-sm font-black text-inverse-surface">Adventures</span>
            <span class="text-[10px] font-bold text-on-surface-variant">6 Learning Games</span>
          </div>
        </button>

      </section>

    </div>
  `;
}

export function attachPetPenListeners() {
  const hero = store.getState().selectedHero;
  const hasNoPet = !hero?.hasChosenStarterPet || !hero?.unlockedPetIds || hero.unlockedPetIds.length === 0;

  if (hasNoPet) {
    // When kid selects the pet pen for the first time, show choose your first companion popup screen!
    setTimeout(() => {
      if (!store.getState().petSelectionModal?.isOpen) {
        store.openPetSelectionModal('starter');
      }
    }, 250);
  }

  const chooseStarterBtn = document.getElementById('pen-choose-starter-btn');
  if (chooseStarterBtn) {
    chooseStarterBtn.addEventListener('click', () => {
      Sound.click();
      store.openPetSelectionModal('starter');
    });
  }

  const chooseStarterTrigger = document.getElementById('pen-choose-starter-trigger');
  if (chooseStarterTrigger) {
    chooseStarterTrigger.addEventListener('click', () => {
      Sound.click();
      store.openPetSelectionModal('starter');
    });
  }

  const rosterBtn = document.getElementById('pen-view-roster-btn');
  if (rosterBtn) {
    rosterBtn.addEventListener('click', () => store.navigate('pet_roster'));
  }

  const fuseBtn = document.getElementById('pen-master-fuse-btn');
  if (fuseBtn) {
    fuseBtn.addEventListener('click', () => store.navigate('master_fuse'));
  }

  const evolveBtn = document.getElementById('pen-evolve-stage-btn');
  if (evolveBtn) {
    evolveBtn.addEventListener('click', () => store.navigate('evolution'));
  }

  const petChar = document.getElementById('pen-pet-character');
  if (petChar) {
    petChar.addEventListener('click', () => {
      store.playWithPet();
    });
  }

  const feedBtn = document.getElementById('pen-feed-btn');
  if (feedBtn) {
    feedBtn.addEventListener('click', () => store.feedPet());
  }

  const bathBtn = document.getElementById('pen-bath-btn');
  if (bathBtn) {
    bathBtn.addEventListener('click', () => store.navigate('pet_bath'));
  }

  const playBtn = document.getElementById('pen-play-btn');
  if (playBtn) {
    playBtn.addEventListener('click', () => store.playWithPet());
  }

  const advBtn = document.getElementById('pen-adventures-btn');
  if (advBtn) {
    advBtn.addEventListener('click', () => store.navigate('quest_map'));
  }
}
