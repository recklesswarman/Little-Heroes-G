import { store } from '../state/store.js';

export function renderDashboardView() {
  const state = store.getState();
  const hero = state.selectedHero;
  const habitIslands = state.habitIslands;
  const taskForest = state.taskForest;
  const activePet = store.getActivePet();
  const pendingCount = state.pendingApprovals.filter(r => r.kidId === hero.id).length;

  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in">
      
      <!-- HERO STATUS BANNER & PET COMPANION WIDGET -->
      <section class="bg-surface-container rounded-3xl p-5 border-2 border-surface-bright card-shadow flex flex-col sm:flex-row items-center justify-between gap-5 relative overflow-hidden">
        <div class="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-primary/10 blur-2xl pointer-events-none"></div>

        <!-- Left: Kid Profile Info -->
        <div class="flex items-center gap-4 w-full sm:w-auto">
          <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-surface-container-high border-4 border-primary overflow-hidden flex items-center justify-center shadow-inner flex-shrink-0 relative">
            <img class="w-full h-full object-cover" src="${hero.avatar}" alt="${hero.name}" />
            <div class="absolute -bottom-1 -right-1 bg-secondary text-on-secondary font-headline text-[10px] font-black px-1.5 py-0.2 rounded-md shadow">
              LV ${hero.level}
            </div>
          </div>

          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <h1 class="font-headline text-2xl sm:text-3xl font-black text-inverse-surface">${hero.name}</h1>
              <span class="text-xs bg-secondary-container/40 text-secondary font-black px-2.5 py-0.5 rounded-full border border-secondary-container">
                🔥 ${hero.streak} Day Streak
              </span>
            </div>
            <span class="text-xs font-bold text-on-surface-variant">${hero.title}</span>

            <!-- Hero XP Progress Bar -->
            <div class="w-44 sm:w-56 bg-surface-container-lowest h-3 rounded-full overflow-hidden border border-surface-container-highest mt-2 relative shadow-inner">
              <div class="bg-gradient-to-r from-primary to-primary-container h-full rounded-full transition-all duration-500" style="width: ${(hero.xp / hero.xpNext) * 100}%;"></div>
            </div>
            <span class="text-[9px] text-on-surface-variant font-black mt-0.5">${hero.xp} / ${hero.xpNext} XP to Level ${hero.level + 1}</span>
          </div>
        </div>

        <!-- Right: Active Companion Pet Quick Vitals -->
        <div class="w-full sm:w-auto bg-surface-container-high p-3.5 rounded-2xl border-2 border-secondary-container/40 flex items-center justify-between sm:justify-start gap-4">
          <div class="w-14 h-14 rounded-2xl bg-surface-container overflow-hidden border-2 border-secondary flex items-center justify-center flex-shrink-0 relative cursor-pointer active:scale-95 transition-transform" id="dash-active-pet-trigger">
            <img class="w-full h-full object-contain p-1" src="${activePet.avatar}" alt="${activePet.name}" />
            <div class="absolute -top-1 -right-1 bg-primary text-on-primary text-[8px] font-black px-1 rounded">S${activePet.stage}</div>
          </div>

          <div class="flex flex-col">
            <span class="font-headline text-xs font-black text-secondary flex items-center gap-1">
              ${activePet.name}
              <span class="material-symbols-outlined text-xs text-primary">verified</span>
            </span>
            <span class="text-[10px] text-on-surface-variant font-bold">${activePet.title}</span>

            <div class="flex items-center gap-2 mt-1">
              <div class="flex items-center gap-0.5 text-[10px] font-bold text-on-surface-variant" title="Hunger">
                <span class="material-symbols-outlined text-xs text-tertiary">restaurant</span> ${activePet.hunger}%
              </div>
              <div class="flex items-center gap-0.5 text-[10px] font-bold text-on-surface-variant" title="Hygiene">
                <span class="material-symbols-outlined text-xs text-primary">soap</span> ${activePet.hygiene}%
              </div>
              <div class="flex items-center gap-0.5 text-[10px] font-bold text-on-surface-variant" title="Joy">
                <span class="material-symbols-outlined text-xs text-secondary">favorite</span> ${activePet.joy}%
              </div>
            </div>
          </div>

          <button id="dash-to-pen-btn" class="bg-primary text-on-primary font-headline text-xs font-black px-3 py-2 rounded-xl chunky-btn-sm border-primary-container ml-auto hover:brightness-110 active:scale-95">
            Pet Pen
          </button>
        </div>
      </section>

      <!-- Currency Explanation Helper -->
      <div class="bg-surface-container/60 border border-surface-container-highest px-4 py-2.5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs font-bold">
        <div class="flex items-center gap-3">
          <span class="text-secondary flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">monetization_on</span>
            Tokens (🪙): Auto-issued instantly!
          </span>
          <span class="text-tertiary flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">star</span>
            Points (⭐): Credited upon Parent Sign-off
          </span>
        </div>
        ${pendingCount > 0 ? `<span class="text-tertiary text-[11px] font-black bg-tertiary/15 px-2.5 py-0.5 rounded-full border border-tertiary/30">⭐ ${pendingCount} Task Point Request(s) Pending Review</span>` : ''}
      </div>

      <!-- ZONE 1: Habit Islands (Preset Positive Behaviors) -->
      <section class="flex flex-col gap-3.5">
        <div class="flex justify-between items-center px-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary text-2xl" style="font-variation-settings: 'FILL' 1;">island</span>
            <h2 class="font-headline text-xl font-black text-inverse-surface">Habit Islands</h2>
          </div>
          <span class="text-xs font-bold text-on-surface-variant">Daily Positive Habits</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          ${habitIslands
            .map((h) => {
              return `
              <div class="bg-surface-container rounded-3xl p-4 flex items-center justify-between border-2 border-surface-container-highest card-shadow transition-all ${
                h.completed ? 'opacity-75 bg-surface-container/70 border-primary/40' : ''
              }">
                <div class="flex items-center gap-3.5 flex-1 pr-3">
                  <div class="w-14 h-14 rounded-2xl bg-secondary-container/20 text-secondary border-b-4 border-secondary-container/40 flex items-center justify-center text-3xl shadow-sm flex-shrink-0">
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">${h.icon}</span>
                  </div>
                  <div class="flex flex-col">
                    <h3 class="font-headline text-base font-bold text-inverse-surface leading-snug ${
                      h.completed ? 'line-through text-on-surface-variant' : ''
                    }">${h.title}</h3>
                    <p class="text-xs text-on-surface-variant line-clamp-1 mt-0.5">${h.desc}</p>
                    
                    <div class="flex items-center gap-2.5 text-xs font-black mt-1">
                      <span class="text-secondary flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-sm">monetization_on</span> +${h.coins} Tokens
                      </span>
                      <span class="text-tertiary flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-sm">star</span> +${h.points} Points
                      </span>
                      ${
                        h.completed
                          ? `<span class="text-[9px] font-black uppercase px-2 py-0.2 rounded ${h.pointsApproved ? 'bg-primary/20 text-primary' : 'bg-tertiary/20 text-tertiary'}">
                               ${h.pointsApproved ? '⭐ Approved' : '⭐ Pending Sign-off'}
                             </span>`
                          : ''
                      }
                    </div>
                  </div>
                </div>

                <button data-habit-id="${h.id}" class="habit-check-btn ${
                h.completed
                  ? 'bg-surface-container-highest text-primary border-surface-container-low'
                  : 'bg-primary text-on-primary border-primary-container hover:brightness-110'
              } rounded-2xl w-14 h-14 chunky-btn flex items-center justify-center flex-shrink-0 shadow-chunky-sm active:scale-95">
                  <span class="material-symbols-outlined text-3xl font-black" style="font-variation-settings: 'FILL' 1;">
                    ${h.completed ? 'check_circle' : 'check'}
                  </span>
                </button>
              </div>
            `;
            })
            .join('')}
        </div>
      </section>

      <!-- ZONE 2: Task Forest (Daily Chores & Routines) -->
      <section class="flex flex-col gap-3.5">
        <div class="flex justify-between items-center px-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-2xl" style="font-variation-settings: 'FILL' 1;">forest</span>
            <h2 class="font-headline text-xl font-black text-inverse-surface">Task Forest</h2>
          </div>
          <span class="text-xs font-bold text-primary">Scheduled Chores & Routines</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          ${taskForest
            .map((t) => {
              return `
              <div class="bg-surface-container rounded-3xl p-4 flex items-center justify-between border-2 border-surface-container-highest card-shadow transition-all ${
                t.completed ? 'opacity-75 bg-surface-container/70 border-primary/40' : ''
              }">
                <div class="flex items-center gap-3.5 flex-1 pr-3">
                  <div class="w-14 h-14 rounded-2xl bg-primary-container/20 text-primary border-b-4 border-primary-container/40 flex items-center justify-center text-3xl shadow-sm flex-shrink-0">
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">${t.icon}</span>
                  </div>
                  <div class="flex flex-col">
                    <div class="flex items-center gap-1.5">
                      <span class="text-[9px] font-black uppercase text-secondary bg-surface-container-high px-2 py-0.5 rounded-md">${t.timeWindow}</span>
                      ${t.isAR ? `<span class="text-[9px] font-black uppercase text-error bg-error/15 px-2 py-0.5 rounded-md">AR Mode</span>` : ''}
                    </div>
                    <h3 class="font-headline text-base font-bold text-inverse-surface leading-snug mt-0.5 ${
                      t.completed ? 'line-through text-on-surface-variant' : ''
                    }">${t.title}</h3>
                    
                    <div class="flex items-center gap-2.5 text-xs font-black mt-1">
                      <span class="text-secondary flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-sm">monetization_on</span> +${t.coins} Tokens
                      </span>
                      <span class="text-tertiary flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-sm">star</span> +${t.points} Points
                      </span>
                      ${
                        t.completed
                          ? `<span class="text-[9px] font-black uppercase px-2 py-0.2 rounded ${t.pointsApproved ? 'bg-primary/20 text-primary' : 'bg-tertiary/20 text-tertiary'}">
                               ${t.pointsApproved ? '⭐ Approved' : '⭐ Pending Sign-off'}
                             </span>`
                          : ''
                      }
                    </div>
                  </div>
                </div>

                ${
                  t.isAR && !t.completed
                    ? `
                  <button data-task-ar-id="${t.id}" class="task-ar-launch-btn bg-error text-on-error font-headline text-xs font-black px-4 py-3 rounded-2xl chunky-btn border-error-container shadow-chunky-sm flex items-center gap-1 hover:brightness-110 active:scale-95">
                    <span class="material-symbols-outlined text-base">play_arrow</span> Battle
                  </button>
                `
                    : `
                  <button data-task-id="${t.id}" class="task-check-btn ${
                        t.completed
                          ? 'bg-surface-container-highest text-primary border-surface-container-low'
                          : 'bg-primary text-on-primary border-primary-container hover:brightness-110'
                      } rounded-2xl w-14 h-14 chunky-btn flex items-center justify-center flex-shrink-0 shadow-chunky-sm active:scale-95">
                    <span class="material-symbols-outlined text-3xl font-black" style="font-variation-settings: 'FILL' 1;">
                      ${t.completed ? 'check_circle' : 'check'}
                    </span>
                  </button>
                `
                }
              </div>
            `;
            })
            .join('')}
        </div>
      </section>

      <!-- MINI ADVENTURE MAP QUICK LAUNCHER -->
      <section class="bg-gradient-to-r from-surface-container to-surface-container-high rounded-3xl p-5 border-2 border-secondary-container flex items-center justify-between card-shadow">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center text-3xl shadow-md">
            <span class="material-symbols-outlined">map</span>
          </div>
          <div class="flex flex-col">
            <h3 class="font-headline text-lg font-black text-inverse-surface">Pet Learning Adventures</h3>
            <p class="text-xs text-on-surface-variant">Play Phonics, Math, and Memory games with your companion for extra Tokens!</p>
          </div>
        </div>

        <button id="dash-to-adventures-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black px-5 py-3 rounded-2xl chunky-btn border-secondary-container hover:brightness-110 active:scale-95">
          Play Map
        </button>
      </section>

    </div>
  `;
}

export function attachDashboardListeners() {
  document.querySelectorAll('.habit-check-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const habitId = btn.getAttribute('data-habit-id');
      store.toggleHabitIsland(habitId);
    });
  });

  document.querySelectorAll('.task-check-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const taskId = btn.getAttribute('data-task-id');
      store.toggleTaskForest(taskId);
    });
  });

  document.querySelectorAll('.task-ar-launch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.navigate('ar_battle');
    });
  });

  const toPenBtn = document.getElementById('dash-to-pen-btn');
  if (toPenBtn) {
    toPenBtn.addEventListener('click', () => store.navigate('pet_pen'));
  }

  const activePetTrigger = document.getElementById('dash-active-pet-trigger');
  if (activePetTrigger) {
    activePetTrigger.addEventListener('click', () => store.navigate('pet_pen'));
  }

  const toAdvBtn = document.getElementById('dash-to-adventures-btn');
  if (toAdvBtn) {
    toAdvBtn.addEventListener('click', () => store.navigate('quest_map'));
  }
}
