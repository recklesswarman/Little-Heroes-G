import { store } from '../state/store.js';

export function renderEvolutionView() {
  const state = store.getState();
  const activePet = store.getActivePet();
  const currentStage = activePet.stage || 1;

  const stages = [
    { num: 1, name: 'Mystic Egg', title: 'Dormant Power', icon: 'egg' },
    { num: 2, name: 'Baby Hatchling', title: 'Playful Companion', icon: 'pets' },
    { num: 3, name: 'Armored Teen', title: 'Guardian Warrior', icon: 'shield' },
    { num: 4, name: 'Golden Titan', title: 'Ascendant Legend', icon: 'auto_awesome' }
  ];

  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in">
      
      <!-- Top Bar -->
      <div class="flex items-center justify-between">
        <button id="evolve-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm">
          <span class="material-symbols-outlined text-base">arrow_back</span> Back to Pen
        </button>
        <div class="flex flex-col items-end">
          <h1 class="font-headline text-2xl font-black text-primary text-shadow">Big Evolution Matrix</h1>
          <span class="text-xs font-bold text-secondary">Harness Hero XP to Evolve</span>
        </div>
      </div>

      <!-- Center 3D Pedestal Stage -->
      <div class="relative bg-gradient-to-b from-[#16212b] via-[#121d26] to-[#09141e] rounded-3xl p-6 border-4 border-primary/40 min-h-[340px] card-shadow flex flex-col items-center justify-between overflow-hidden">
        
        <!-- Glowing Aura Particles Background -->
        <div class="absolute inset-0 bg-radial from-primary/20 via-transparent to-transparent pointer-events-none"></div>

        <div class="w-full flex justify-between items-center text-xs font-black uppercase text-secondary z-10">
          <span>${activePet.name}</span>
          <span class="text-primary animate-pulse">Stage ${currentStage} / 4</span>
        </div>

        <!-- 3D Evolved Dragon Render -->
        <div class="relative z-10 w-56 h-56 flex items-center justify-center animate-float my-3">
          <img class="w-full h-full object-contain drop-shadow-[0_20px_25px_rgba(0,0,0,0.9)]" src="${
            currentStage >= 3 && activePet.evolvedAvatar ? activePet.evolvedAvatar : activePet.avatar
          }" alt="${activePet.name}" />
        </div>

        <!-- Pedestal Base -->
        <div class="w-52 h-6 bg-gradient-to-r from-surface-container-highest via-primary/40 to-surface-container-highest rounded-full border-2 border-primary/50 shadow-[0_0_30px_rgba(84,233,138,0.4)]"></div>

      </div>

      <!-- 4-Stage Pedestal Progression -->
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

              <span class="font-headline text-xs font-black text-inverse-surface">Stage ${s.num}: ${s.name}</span>
              <span class="text-[10px] font-bold text-on-surface-variant">${s.title}</span>

              ${
                isCurrent
                  ? `<span class="bg-primary/20 text-primary text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-primary/30">Active</span>`
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
          <button id="trigger-big-evolution-btn" class="w-full max-w-md bg-gradient-to-r from-primary to-primary-fixed text-on-primary font-headline text-base font-black py-4 rounded-2xl chunky-btn border-primary-container shadow-chunky-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-2xl">auto_awesome</span>
            TRIGGER BIG EVOLUTION TO STAGE ${currentStage + 1}!
          </button>
        `
            : `
          <div class="bg-surface-container-high text-secondary font-headline text-sm font-black px-8 py-4 rounded-2xl border-2 border-secondary flex items-center gap-2 shadow-sm">
            <span class="material-symbols-outlined text-2xl">military_tech</span>
            MAXIMUM ASCENDANT EVOLUTION REACHED!
          </div>
        `
        }
      </div>

    </div>
  `;
}

export function attachEvolutionListeners() {
  const backBtn = document.getElementById('evolve-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => store.navigate('pet_pen'));
  }

  const evolveTriggerBtn = document.getElementById('trigger-big-evolution-btn');
  if (evolveTriggerBtn) {
    evolveTriggerBtn.addEventListener('click', () => {
      store.evolvePet();
    });
  }
}
