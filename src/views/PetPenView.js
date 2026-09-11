import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { speakRex } from '../services/voiceService.js';
import confetti from 'canvas-confetti';
import { PETS_DATABASE } from '../data/petsData.js';

let hasSpokenPenGreeting = false;
let selectedRadialPetId = null;

const PET_BANTER = [
  "Yum! That picnic fruit looks so delicious! 🍎",
  "Ready to stomp up some chores and earn sparks! ⚡",
  "The Bubble Bath Lagoon water is warm and bubbly! 🛁",
  "Look at all the magical butterflies in Sunny Meadow! 🦋",
  "Let's train together in the Arena! ⚔️",
  "I love hanging out in the Sanctuary with you! 💖",
  "Adventure time! High five, Little Hero! 🐾",
  "Hehehe, tickles! Hugs make me so energized! ✨"
];

export function renderPetPenView() {
  const state = store.getState();
  const hero = state.selectedHero;
  const hasPet = hero.hasChosenStarterPet && hero.unlockedPetIds && hero.unlockedPetIds.length > 0;
  const activePet = store.getActivePet();
  const currentAvatar = activePet.stage >= 3 && activePet.evolvedAvatar ? activePet.evolvedAvatar : activePet.avatar;
  const sparks = store.getPetSparks(activePet.id);
  const streakShield = store.getPetStreakShield();
  const isEvolutionReady = sparks >= 100;

  if (!hasPet) {
    return `
    <div class="max-w-5xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in select-none">
      
      <!-- Top Navigation & Roster Hub Link -->
      <div class="flex items-center justify-between">
        <div class="flex flex-col">
          <span class="text-[10px] font-black uppercase tracking-widest text-primary">Companion Sanctuary</span>
          <h1 class="font-headline text-2xl font-black text-inverse-surface text-shadow">Choose Your First Pet!</h1>
        </div>

        <div class="flex items-center gap-2">
          <button id="pen-view-roster-btn" class="bg-surface-container hover:bg-surface-bright text-primary font-headline text-xs font-black px-4 py-2.5 rounded-2xl border-2 border-primary/40 flex items-center gap-1.5 chunky-btn-sm">
            <span class="material-symbols-outlined text-base">grid_view</span> 24 Pet Roster
          </button>
        </div>
      </div>

      <!-- Summoning State -->
      <div class="relative bg-gradient-to-b from-[#16212b] via-[#121d26] to-[#09141e] rounded-3xl p-8 border-4 border-surface-container-highest min-h-[380px] card-shadow flex flex-col items-center justify-center gap-5 overflow-hidden text-center">
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

        <div id="pen-choose-starter-trigger" class="relative z-10 w-44 h-44 flex flex-col items-center justify-center cursor-pointer group my-2">
          <div class="w-36 h-36 rounded-full bg-gradient-to-tr from-primary/25 to-secondary/25 border-3 border-dashed border-primary flex items-center justify-center text-6xl text-primary animate-pulse shadow-xl group-hover:scale-105 transition-transform">
            <span class="material-symbols-outlined text-7xl" style="font-variation-settings: 'FILL' 1;">egg</span>
          </div>
          <span class="mt-2 text-[11px] font-black uppercase tracking-wider text-secondary">Tap to Choose Companion</span>
        </div>

        <div class="z-10">
          <button id="pen-choose-starter-btn" class="bg-gradient-to-r from-primary to-secondary text-on-primary font-headline text-sm sm:text-base font-black px-8 py-4 rounded-2xl chunky-btn shadow-chunky-sm flex items-center gap-2.5 hover:brightness-110 active:scale-95">
            <span class="material-symbols-outlined text-2xl">pets</span> CHOOSE YOUR FIRST COMPANION
          </button>
        </div>
      </div>

    </div>
    `;
  }

  // Get all roaming unlocked pets
  const unlockedIds = hero.unlockedPetIds || [activePet.id];
  const roamingPets = unlockedIds.map((pId) => {
    const pData = state.pets?.find((p) => p.id === pId) || PETS_DATABASE.find((p) => p.id === pId) || activePet;
    const stage = state.petStageMap?.[pId] || 1;
    const avatar = stage >= 3 && pData.evolvedAvatar ? pData.evolvedAvatar : pData.avatar;
    const gearSlots = store.getEquippedPetGearSlots(pId);
    return {
      ...pData,
      stage,
      avatar,
      gearSlots,
      isActiveCompanion: pId === activePet.id
    };
  });

  return `
    <div class="max-w-5xl mx-auto px-4 pt-3 pb-28 flex flex-col gap-5 animate-fade-in select-none">
      
      <!-- Top Navigation & Sanctuary Status Bar -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex flex-col">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-black uppercase tracking-widest text-primary">Companion Sanctuary</span>
            <span class="bg-surface-container-high px-2.5 py-0.5 rounded-full text-[10px] font-black text-secondary border border-surface-container-highest">
              ${roamingPets.length} ${roamingPets.length === 1 ? 'Companion' : 'Companions'} Roaming
            </span>
          </div>
          <h1 class="font-headline text-2xl font-black text-inverse-surface text-shadow">${activePet.name}'s Paradise</h1>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- 24 Pet Roster Button -->
          <button id="pen-view-roster-btn" class="bg-surface-container hover:bg-surface-bright text-primary font-headline text-xs font-black px-3.5 py-2 rounded-2xl border-2 border-primary/40 flex items-center gap-1.5 chunky-btn-sm">
            <span class="material-symbols-outlined text-base">grid_view</span> 24 Pet Roster
          </button>

          <!-- Group Treat Picnic Button -->
          <button id="pen-group-picnic-btn" class="bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-black font-headline text-xs font-black px-4 py-2 rounded-2xl border-2 border-amber-400 flex items-center gap-1.5 chunky-btn-sm shadow-md active:scale-95">
            <span class="material-symbols-outlined text-base">shopping_basket</span> 🧺 Group Picnic (15 🪙)
          </button>
        </div>
      </div>

      <!-- Evolution Sparks & Pet Streak Shield Banner -->
      <div class="bg-gradient-to-r from-surface-container-high via-surface-container to-surface-container-high rounded-3xl p-4 border-2 border-primary/40 card-shadow flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <!-- Left: Evolution Sparks Progress -->
        <div class="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div class="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/50 text-primary flex items-center justify-center text-2xl flex-shrink-0 ${isEvolutionReady ? 'animate-bounce' : ''}">
            <span class="material-symbols-outlined text-3xl">auto_awesome</span>
          </div>
          <div class="flex flex-col flex-1 max-w-sm">
            <div class="flex justify-between items-center text-xs font-black">
              <span class="text-inverse-surface flex items-center gap-1">
                <span>Evolution Sparks</span>
                <span class="text-primary font-black">⚡ ${sparks} / 100</span>
              </span>
              <span class="text-[10px] text-secondary font-bold">Stage ${activePet.stage}/4</span>
            </div>
            <div class="w-full h-3.5 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest mt-1">
              <div class="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500" style="width: ${Math.min(100, sparks)}%;"></div>
            </div>
          </div>
        </div>

        <!-- Right: Action & Streak Shield -->
        <div class="flex items-center gap-3 w-full sm:w-auto justify-end">
          <!-- Streak Shield Pill -->
          <div class="bg-surface-container-lowest/80 px-3 py-1.5 rounded-2xl border border-primary/30 flex items-center gap-1.5" title="Joyful pets shield your streak if 1 day is missed!">
            <span class="material-symbols-outlined text-primary text-base">shield</span>
            <div class="flex flex-col">
              <span class="text-[9px] font-black uppercase text-on-surface-variant">Streak Shield</span>
              <span class="text-[10px] font-black text-primary">${streakShield.isActive ? '🛡️ ACTIVE' : 'Cared For Today'}</span>
            </div>
          </div>

          <!-- Evolution Matrix Trigger -->
          <button id="pen-evolve-stage-btn" class="px-4 py-2.5 rounded-2xl font-headline text-xs font-black flex items-center gap-1.5 chunky-btn-sm transition-all ${
            isEvolutionReady
              ? 'bg-gradient-to-r from-primary to-primary-fixed text-on-primary border-2 border-primary-container shadow-chunky-sm animate-pulse-glow'
              : 'bg-surface-container-high hover:bg-surface-bright text-primary border-2 border-primary/40'
          }">
            <span class="material-symbols-outlined text-base">auto_awesome</span>
            <span>${isEvolutionReady ? 'READY TO EVOLVE!' : 'Evolution Matrix'}</span>
          </button>
        </div>

      </div>

      <!-- MULTI-HABITAT FREE-ROAMING SANCTUARY (4 Interactive Zones) -->
      <div class="relative bg-gradient-to-b from-[#14261e] via-[#10202a] to-[#0a141c] rounded-3xl p-5 sm:p-6 border-4 border-primary/30 card-shadow flex flex-col gap-4 overflow-hidden min-h-[460px]">
        
        <!-- Ambient Habitat Glow -->
        <div class="absolute inset-0 bg-radial from-primary/10 via-transparent to-transparent pointer-events-none"></div>

        <!-- 4 Themed Interactive Zones Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 flex-1">
          
          <!-- Zone 1: Sunny Meadow -->
          <div id="zone-meadow" class="bg-gradient-to-br from-[#1a3826]/80 to-[#122419]/80 rounded-2xl p-4 border-2 border-primary/30 relative overflow-hidden min-h-[200px] flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-black text-primary">
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-base">park</span> 🌿 Sunny Meadow
              </span>
              <span class="text-[10px] text-primary/80 font-bold">Free Play & Wildflowers</span>
            </div>
            <!-- Butterfly flying across meadow -->
            <div class="absolute top-6 right-8 text-2xl animate-butterfly pointer-events-none select-none">🦋</div>
            
            <!-- Roaming Pets in Meadow -->
            <div class="flex items-center justify-around gap-2 my-2 py-2">
              ${roamingPets.slice(0, 1).map((pet, idx) => renderRoamingPetCard(pet, idx)).join('')}
            </div>

            <div class="text-[10px] font-bold text-on-surface-variant flex items-center gap-1 justify-center">
              <span>🌸 Sweet dandelion breeze • Tap companion to care!</span>
            </div>
          </div>

          <!-- Zone 2: Bubble Bath Lagoon -->
          <div id="zone-lagoon" class="bg-gradient-to-br from-[#123040]/80 to-[#0c1f2b]/80 rounded-2xl p-4 border-2 border-tertiary/30 relative overflow-hidden min-h-[200px] flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-black text-tertiary">
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-base">water_drop</span> 🛁 Bubble Bath Lagoon
              </span>
              <button id="lagoon-quick-wash-btn" class="bg-tertiary/20 hover:bg-tertiary/30 text-tertiary px-2.5 py-1 rounded-xl text-[10px] font-black border border-tertiary/40 chunky-btn-sm flex items-center gap-1">
                <span class="material-symbols-outlined text-xs">bathtub</span> Wash Minigame
              </button>
            </div>
            <!-- Soap bubbles -->
            <div class="absolute top-8 right-14 text-xl animate-bubble-float pointer-events-none">🫧</div>
            <div class="absolute bottom-6 left-6 text-lg animate-bubble-float pointer-events-none" style="animation-delay: 1.2s;">🫧</div>

            <!-- Roaming Pets in Lagoon (or placeholder if only 1 pet) -->
            <div class="flex items-center justify-around gap-2 my-2 py-2">
              ${roamingPets.length > 1
                ? roamingPets.slice(1, 2).map((pet, idx) => renderRoamingPetCard(pet, idx + 1)).join('')
                : `
                  <div class="flex flex-col items-center justify-center p-3 text-center opacity-70">
                    <span class="text-3xl animate-bounce-slow">🫧</span>
                    <span class="text-xs font-bold text-tertiary mt-1">Warm Blueberry Suds Lagoon</span>
                    <span class="text-[10px] text-on-surface-variant">Adopt 2nd pet in Roster to splash here!</span>
                  </div>
                `
              }
            </div>

            <div class="text-[10px] font-bold text-on-surface-variant flex items-center gap-1 justify-center">
              <span>🧼 Sparkling clean water keeps companion energy high!</span>
            </div>
          </div>

          <!-- Zone 3: Treat Picnic Clearing -->
          <div id="zone-picnic" class="bg-gradient-to-br from-[#3b2d18]/80 to-[#261c0d]/80 rounded-2xl p-4 border-2 border-amber-500/30 relative overflow-hidden min-h-[200px] flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-black text-amber-400">
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-base">restaurant</span> 🍎 Treat Picnic Clearing
              </span>
              <span class="text-[10px] text-amber-300 font-bold">Chequered Blanket</span>
            </div>

            <!-- Roaming Pets in Picnic (or placeholder if only 1-2 pets) -->
            <div class="flex items-center justify-around gap-2 my-2 py-2">
              ${roamingPets.length > 2
                ? roamingPets.slice(2, 3).map((pet, idx) => renderRoamingPetCard(pet, idx + 2)).join('')
                : `
                  <div class="flex flex-col items-center justify-center p-3 text-center">
                    <span class="text-3xl animate-pulse">🧺🍎🍓</span>
                    <span class="text-xs font-bold text-amber-300 mt-1">Fresh Fruit & Treat Basket</span>
                    <span class="text-[10px] text-on-surface-variant">Use "Group Picnic" above to feed all companions!</span>
                  </div>
                `
              }
            </div>

            <div class="text-[10px] font-bold text-on-surface-variant flex items-center gap-1 justify-center">
              <span>🍉 Delicious treats restore fullness and grant sparks!</span>
            </div>
          </div>

          <!-- Zone 4: Training & Sparring Arena -->
          <div id="zone-arena" class="bg-gradient-to-br from-[#381c1c]/80 to-[#241010]/80 rounded-2xl p-4 border-2 border-secondary/30 relative overflow-hidden min-h-[200px] flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-black text-secondary">
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-base">sports_kabaddi</span> ⚔️ Training & Sparring Arena
              </span>
              <button id="arena-battle-btn" class="bg-secondary/20 hover:bg-secondary/30 text-secondary px-2.5 py-1 rounded-xl text-[10px] font-black border border-secondary/40 chunky-btn-sm flex items-center gap-1">
                <span class="material-symbols-outlined text-xs">swords</span> AR Battle
              </button>
            </div>

            <!-- Roaming Pets in Arena (or placeholder if only 1-3 pets) -->
            <div class="flex items-center justify-around gap-2 my-2 py-2">
              ${roamingPets.length > 3
                ? roamingPets.slice(3, 4).map((pet, idx) => renderRoamingPetCard(pet, idx + 3)).join('')
                : `
                  <div class="flex flex-col items-center justify-center p-3 text-center">
                    <span class="text-3xl animate-bounce-slow">🎯🛡️</span>
                    <span class="text-xs font-bold text-secondary mt-1">Heroic Target Dummy & Ring</span>
                    <span class="text-[10px] text-on-surface-variant">Companions spar and practice battle moves!</span>
                  </div>
                `
              }
            </div>

            <div class="text-[10px] font-bold text-on-surface-variant flex items-center gap-1 justify-center">
              <span>🥋 Practice here for Morning Toothbrush AR battles!</span>
            </div>
          </div>

        </div>

      </div>

      <!-- ACTIVE PET VITAL NEEDS BARS -->
      <section class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h2 class="font-headline text-xs font-black uppercase text-on-surface-variant tracking-wider">
            ${activePet.name}'s Vital Needs
          </h2>
          <span class="text-[10px] font-black text-secondary uppercase bg-surface-container-highest px-2 py-0.5 rounded-full">
            Active Companion
          </span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          <!-- Hunger Bar -->
          <div class="bg-surface-container-high p-3 rounded-2xl border border-surface-container-highest flex flex-col gap-1.5">
            <div class="flex justify-between items-center text-xs font-black">
              <span class="text-error flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">restaurant</span> Fullness
              </span>
              <span class="text-inverse-surface">${activePet.hunger}%</span>
            </div>
            <div class="w-full h-3 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
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
            <div class="w-full h-3 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
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
            <div class="w-full h-3 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
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
            <div class="w-full h-3 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
              <div class="h-full bg-primary rounded-full transition-all duration-300" style="width: ${activePet.joy}%;"></div>
            </div>
          </div>

        </div>
      </section>

      <!-- QUICK CARE ACTION DOCK (4 Toddler-Friendly Buttons) -->
      <section class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        
        <!-- Feed Snack -->
        <button id="pen-feed-btn" class="bg-surface-container hover:bg-surface-bright rounded-3xl p-4 border-2 border-surface-container-highest card-shadow flex flex-col items-center justify-center gap-2 chunky-btn text-center active:scale-95 group">
          <div class="w-13 h-13 rounded-2xl bg-secondary-container/20 text-secondary flex items-center justify-center text-3xl border border-secondary-container/40 group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-3xl">nutrition</span>
          </div>
          <div class="flex flex-col">
            <span class="font-headline text-sm font-black text-inverse-surface">Feed Snack (5 🪙)</span>
            <span class="text-[10px] font-bold text-on-surface-variant">+25 Fullness • +5 Sparks</span>
          </div>
        </button>

        <!-- Bathtub Wash -->
        <button id="pen-bath-btn" class="bg-surface-container hover:bg-surface-bright rounded-3xl p-4 border-2 border-surface-container-highest card-shadow flex flex-col items-center justify-center gap-2 chunky-btn text-center active:scale-95 group">
          <div class="w-13 h-13 rounded-2xl bg-tertiary-container/20 text-tertiary flex items-center justify-center text-3xl border border-tertiary-container/40 group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-3xl">bathtub</span>
          </div>
          <div class="flex flex-col">
            <span class="font-headline text-sm font-black text-inverse-surface">Bathtub Wash</span>
            <span class="text-[10px] font-bold text-on-surface-variant">Scrub & Blow Dry</span>
          </div>
        </button>

        <!-- Pet & Hug -->
        <button id="pen-play-btn" class="bg-surface-container hover:bg-surface-bright rounded-3xl p-4 border-2 border-surface-container-highest card-shadow flex flex-col items-center justify-center gap-2 chunky-btn text-center active:scale-95 group">
          <div class="w-13 h-13 rounded-2xl bg-primary-container/20 text-primary flex items-center justify-center text-3xl border border-primary-container/40 group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-3xl">favorite</span>
          </div>
          <div class="flex flex-col">
            <span class="font-headline text-sm font-black text-inverse-surface">Pet & Hug</span>
            <span class="text-[10px] font-bold text-primary font-black">+20 Joy • +5 Sparks</span>
          </div>
        </button>

        <!-- Pet Locker Dressing Room -->
        <button id="pen-locker-btn" class="bg-surface-container hover:bg-surface-bright rounded-3xl p-4 border-2 border-amber-500/40 card-shadow flex flex-col items-center justify-center gap-2 chunky-btn text-center active:scale-95 group">
          <div class="w-13 h-13 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl border border-amber-500/50 group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-3xl">checkroom</span>
          </div>
          <div class="flex flex-col">
            <span class="font-headline text-sm font-black text-inverse-surface">Pet Locker</span>
            <span class="text-[10px] font-bold text-amber-400">3-Slot Dressing Room</span>
          </div>
        </button>

      </section>

      <!-- Floating Hearts Layer for Pet & Hug animations -->
      <div id="pen-hearts-layer" class="fixed inset-0 pointer-events-none z-40 overflow-hidden"></div>

      <!-- RADIAL ACTION RING MODAL (When tapping any roaming companion) -->
      ${renderRadialActionRing(state)}

    </div>
  `;
}

function renderRoamingPetCard(pet, idx) {
  const banter = PET_BANTER[idx % PET_BANTER.length];
  const hatEmoji = pet.gearSlots?.hat ? '🧙‍♂️' : '';
  const capeEmoji = pet.gearSlots?.cape ? '🦸' : '';

  return `
    <div data-open-radial-pet="${pet.id}" class="relative flex flex-col items-center cursor-pointer group transition-all duration-300 hover:scale-105 select-none">
      
      <!-- Speech Banter Bubble -->
      <div class="bg-surface-container-high/95 text-on-surface px-3 py-1.5 rounded-2xl text-[11px] font-bold border border-surface-container-highest shadow-md mb-1 max-w-[190px] text-center animate-bounce-slow">
        ${banter}
      </div>

      <!-- 3D Pet Avatar with Floating Effect -->
      <div id="roaming-pet-${pet.id}" class="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center animate-float">
        <img class="w-full h-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.8)] group-hover:scale-110 transition-transform" src="${pet.avatar}" alt="${pet.name}" />
        
        <!-- Equipped Hat Badge -->
        ${hatEmoji ? `
          <span class="absolute -top-1 -right-1 text-2xl drop-shadow animate-bounce" title="Equipped Hat">${hatEmoji}</span>
        ` : ''}

        <!-- Equipped Cape Badge -->
        ${capeEmoji ? `
          <span class="absolute bottom-2 -left-1 text-xl drop-shadow" title="Equipped Cape">${capeEmoji}</span>
        ` : ''}

        <!-- Active Companion Star Indicator -->
        ${pet.isActiveCompanion ? `
          <span class="absolute -bottom-1 bg-amber-500 text-black rounded-full px-2 py-0.5 text-[9px] font-black uppercase shadow-md flex items-center gap-0.5">
            <span class="material-symbols-outlined text-xs">star</span> Active
          </span>
        ` : ''}
      </div>

      <!-- Name & Stage Tag -->
      <div class="bg-surface-container-lowest/80 px-3 py-1 rounded-full border border-surface-container-highest flex items-center gap-1.5 mt-1 shadow-sm">
        <span class="font-headline text-xs font-black text-inverse-surface">${pet.name}</span>
        <span class="text-[9px] font-black text-secondary">Stage ${pet.stage}</span>
      </div>

      <span class="text-[9px] font-bold text-primary mt-0.5 opacity-90 group-hover:opacity-100">Tap for Care Ring ⭕</span>
    </div>
  `;
}

function renderRadialActionRing(state) {
  if (!selectedRadialPetId) return '';

  const pet = state.pets?.find(p => p.id === selectedRadialPetId) || PETS_DATABASE.find(p => p.id === selectedRadialPetId);
  if (!pet) return '';

  const stage = state.petStageMap?.[pet.id] || 1;
  const avatar = stage >= 3 && pet.evolvedAvatar ? pet.evolvedAvatar : pet.avatar;
  const sparks = store.getPetSparks(pet.id);
  const isActive = pet.id === state.selectedHero?.activePetId;

  return `
    <div id="pet-radial-ring-overlay" class="fixed inset-0 bg-background/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div class="relative bg-surface-container border-4 border-primary/60 rounded-3xl p-6 max-w-sm w-full card-shadow-lg flex flex-col items-center gap-4 text-center">
        
        <!-- Close Button -->
        <button id="radial-close-btn" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center hover:bg-surface-bright">
          <span class="material-symbols-outlined">close</span>
        </button>

        <!-- Center Pet Avatar -->
        <div class="relative w-28 h-28 flex items-center justify-center animate-float my-1">
          <img class="w-full h-full object-contain drop-shadow-md" src="${avatar}" alt="${pet.name}" />
        </div>

        <div>
          <h3 class="font-headline text-lg font-black text-inverse-surface flex items-center justify-center gap-1.5">
            ${pet.name}
            <span class="text-xs text-primary font-black bg-primary/20 px-2 py-0.5 rounded-full">Stage ${stage}</span>
          </h3>
          <p class="text-xs font-bold text-on-surface-variant">⚡ ${sparks}/100 Evolution Sparks</p>
        </div>

        <!-- 4-Button Radial Action Ring Grid -->
        <div class="grid grid-cols-2 gap-3 w-full pt-1">
          
          <!-- 1. Pet / Hug -->
          <button id="radial-hug-btn" class="bg-gradient-to-r from-pink-500 to-rose-500 text-white font-headline text-xs font-black p-3.5 rounded-2xl chunky-btn flex flex-col items-center gap-1 hover:brightness-110 active:scale-95 shadow-md">
            <span class="material-symbols-outlined text-2xl">favorite</span>
            <span>Pet & Hug</span>
            <span class="text-[9px] font-bold text-pink-100">+20 Joy • +5 Sparks</span>
          </button>

          <!-- 2. Feed Munchies Treat -->
          <button id="radial-feed-btn" class="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-headline text-xs font-black p-3.5 rounded-2xl chunky-btn flex flex-col items-center gap-1 hover:brightness-110 active:scale-95 shadow-md">
            <span class="material-symbols-outlined text-2xl">nutrition</span>
            <span>Feed Snack (5 🪙)</span>
            <span class="text-[9px] font-bold text-black/80">+25 Fullness • +5 Sparks</span>
          </button>

          <!-- 3. Pet Locker -->
          <button id="radial-locker-btn" class="bg-surface-container-high hover:bg-surface-bright text-amber-400 font-headline text-xs font-black p-3.5 rounded-2xl border-2 border-amber-500/50 chunky-btn flex flex-col items-center gap-1 active:scale-95 shadow-sm">
            <span class="material-symbols-outlined text-2xl">checkroom</span>
            <span>Pet Locker</span>
            <span class="text-[9px] font-bold text-amber-300">Dress-Up Gear</span>
          </button>

          <!-- 4. Make Active Companion -->
          <button id="radial-active-btn" class="bg-surface-container-high hover:bg-surface-bright text-secondary font-headline text-xs font-black p-3.5 rounded-2xl border-2 border-secondary/50 chunky-btn flex flex-col items-center gap-1 active:scale-95 shadow-sm ${
            isActive ? 'opacity-50 cursor-default' : ''
          }">
            <span class="material-symbols-outlined text-2xl">star</span>
            <span>${isActive ? 'Active Now' : 'Set as Active'}</span>
            <span class="text-[9px] font-bold text-secondary-container">${isActive ? '★ In Quest' : 'Join Hero'}</span>
          </button>

        </div>

      </div>
    </div>
  `;
}

function triggerPetHugExcitement(petId) {
  const container = document.getElementById('pen-hearts-layer');
  const activePet = store.getActivePet();
  const id = petId || activePet.id;

  // 1. Excited animation on roaming pet
  const petEl = document.getElementById(`roaming-pet-${id}`);
  const isFlip = Math.random() > 0.5;
  if (petEl) {
    petEl.classList.remove('animate-backflip', 'animate-giggle');
    void petEl.offsetWidth;
    petEl.classList.add(isFlip ? 'animate-backflip' : 'animate-giggle');
    setTimeout(() => petEl.classList.remove('animate-backflip', 'animate-giggle'), 800);
  }

  // 2. Rising hearts, stars, and spark emojis
  if (container) {
    const emojis = ['❤️', '💖', '🥰', '✨', '⚡', '🌟', '🐾'];
    for (let i = 0; i < 9; i++) {
      const heart = document.createElement('div');
      const startX = Math.floor(Math.random() * 60) + 20;
      const driftX = (Math.random() * 60 - 30).toFixed(0);
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];

      heart.className = 'absolute text-2xl sm:text-3xl select-none animate-heart-float z-50';
      heart.style.left = `${startX}%`;
      heart.style.bottom = '120px';
      heart.style.setProperty('--drift-x', `${driftX}px`);
      heart.style.animationDelay = `${(i * 0.08).toFixed(2)}s`;
      heart.textContent = emoji;

      container.appendChild(heart);
      setTimeout(() => heart.remove(), 2000);
    }
  }

  Sound.boing();
  Sound.chirp();
  confetti({
    particleCount: 35,
    spread: 60,
    origin: { y: 0.6 },
    colors: ['#2ecc71', '#f1c40f', '#e74c3c', '#3498db']
  });

  if (isFlip) {
    speakRex("Woohoo! Look at that awesome backflip! Super happy companion!");
  } else {
    speakRex("Hehehe! Tickles! Your companion feels loved and energized!");
  }

  store.petHugPet(id);
}

export function attachPetPenListeners() {
  const isEasy = store.isEasyMode();
  const hero = store.getState().selectedHero;
  const hasNoPet = !hero?.hasChosenStarterPet || !hero?.unlockedPetIds || hero.unlockedPetIds.length === 0;

  if (isEasy && !hasSpokenPenGreeting && !hasNoPet) {
    hasSpokenPenGreeting = true;
    setTimeout(() => {
      speakRex("Welcome to the Companion Sanctuary! Tap any roaming pet to care for them!");
    }, 400);
  }

  if (hasNoPet) {
    setTimeout(() => {
      if (!store.getState().petSelectionModal?.isOpen) {
        speakRex("Pick your first companion! They can't wait to meet you!");
        store.openPetSelectionModal('starter');
      }
    }, 250);
  }

  // Choose starter triggers
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

  // 24 Pet Roster
  const rosterBtn = document.getElementById('pen-view-roster-btn');
  if (rosterBtn) {
    rosterBtn.addEventListener('click', () => {
      if (isEasy) speakRex("Look at all the 24 magical companions you can unlock on your adventure!");
      store.navigate('pet_roster');
    });
  }

  // Group Treat Picnic Button
  const groupPicnicBtn = document.getElementById('pen-group-picnic-btn');
  if (groupPicnicBtn) {
    groupPicnicBtn.addEventListener('click', () => {
      store.feedAllPetsPicnic();
      speakRex("Picnic time! All your companions are enjoying delicious snacks together!");
    });
  }

  // Evolution Matrix Button
  const evolveBtn = document.getElementById('pen-evolve-stage-btn');
  if (evolveBtn) {
    evolveBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate('evolution');
    });
  }

  // Lagoon Quick Wash Button
  const lagoonWashBtn = document.getElementById('lagoon-quick-wash-btn');
  if (lagoonWashBtn) {
    lagoonWashBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate('pet_bath');
    });
  }

  // Arena Battle Button
  const arenaBattleBtn = document.getElementById('arena-battle-btn');
  if (arenaBattleBtn) {
    arenaBattleBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate('ar_battle');
    });
  }

  // Quick Action Dock Buttons
  const feedBtn = document.getElementById('pen-feed-btn');
  if (feedBtn) {
    feedBtn.addEventListener('click', () => {
      store.feedSinglePet(store.getActivePet().id);
    });
  }

  const bathBtn = document.getElementById('pen-bath-btn');
  if (bathBtn) {
    bathBtn.addEventListener('click', () => {
      store.navigate('pet_bath');
    });
  }

  const playBtn = document.getElementById('pen-play-btn');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      triggerPetHugExcitement(store.getActivePet().id);
    });
  }

  const lockerBtn = document.getElementById('pen-locker-btn');
  if (lockerBtn) {
    lockerBtn.addEventListener('click', () => {
      Sound.click();
      store.openPetLockerModal(store.getActivePet().id);
    });
  }

  // Roaming Pet Cards (Opens Radial Ring)
  const petCards = document.querySelectorAll('[data-open-radial-pet]');
  petCards.forEach((card) => {
    card.addEventListener('click', () => {
      const petId = parseInt(card.getAttribute('data-open-radial-pet'));
      Sound.click();
      selectedRadialPetId = petId;
      store.notify();
    });
  });

  // Radial Ring Overlay Listeners
  const radialOverlay = document.getElementById('pet-radial-ring-overlay');
  if (radialOverlay) {
    radialOverlay.addEventListener('click', (e) => {
      if (e.target === radialOverlay) {
        selectedRadialPetId = null;
        store.notify();
      }
    });
  }

  const radialCloseBtn = document.getElementById('radial-close-btn');
  if (radialCloseBtn) {
    radialCloseBtn.addEventListener('click', () => {
      Sound.click();
      selectedRadialPetId = null;
      store.notify();
    });
  }

  const radialHugBtn = document.getElementById('radial-hug-btn');
  if (radialHugBtn && selectedRadialPetId) {
    radialHugBtn.addEventListener('click', () => {
      const petId = selectedRadialPetId;
      selectedRadialPetId = null;
      store.notify();
      triggerPetHugExcitement(petId);
    });
  }

  const radialFeedBtn = document.getElementById('radial-feed-btn');
  if (radialFeedBtn && selectedRadialPetId) {
    radialFeedBtn.addEventListener('click', () => {
      const petId = selectedRadialPetId;
      selectedRadialPetId = null;
      store.notify();
      store.feedSinglePet(petId);
    });
  }

  const radialLockerBtn = document.getElementById('radial-locker-btn');
  if (radialLockerBtn && selectedRadialPetId) {
    radialLockerBtn.addEventListener('click', () => {
      const petId = selectedRadialPetId;
      selectedRadialPetId = null;
      store.openPetLockerModal(petId);
    });
  }

  const radialActiveBtn = document.getElementById('radial-active-btn');
  if (radialActiveBtn && selectedRadialPetId) {
    radialActiveBtn.addEventListener('click', () => {
      const petId = selectedRadialPetId;
      selectedRadialPetId = null;
      store.setActivePet(petId);
    });
  }
}
