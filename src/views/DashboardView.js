import { store } from '../state/store.js';
import { getTaskVisualSvg } from '../utils/taskVisuals.js';
import { speakRex } from '../services/voiceService.js';

export function renderDashboardView() {
  const state = store.getState();
  const hero = state.selectedHero;
  const habitIslands = state.habitIslands;
  const taskForest = state.taskForest;
  const activePet = store.getActivePet();
  const pendingCount = state.pendingApprovals.filter(r => r.kidId === hero.id).length;
  const isEasyMode = store.isEasyMode();

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

        <!-- Right: Active Companion Pet Quick Vitals / Adopt Prompt -->
        ${
          hero.hasChosenStarterPet && hero.unlockedPetIds && hero.unlockedPetIds.length > 0
            ? `
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
        `
            : `
        <div class="w-full sm:w-auto bg-surface-container-high p-3.5 rounded-2xl border-2 border-secondary-container/40 flex items-center justify-between sm:justify-start gap-4">
          <div class="w-14 h-14 rounded-2xl bg-secondary-container/20 border-2 border-secondary flex items-center justify-center flex-shrink-0 text-2xl animate-pulse cursor-pointer active:scale-95 transition-transform" id="dash-active-pet-trigger">
            <span class="material-symbols-outlined text-secondary text-3xl" style="font-variation-settings: 'FILL' 1;">pets</span>
          </div>

          <div class="flex flex-col">
            <span class="font-headline text-xs font-black text-secondary flex items-center gap-1">
              Pet Pen
              <span class="bg-primary/20 text-primary text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border border-primary/40">New!</span>
            </span>
            <span class="text-[10px] text-on-surface-variant font-bold">Select Pet Pen to adopt 1st pet</span>
          </div>

          <button id="dash-to-pen-btn" class="bg-gradient-to-r from-primary to-secondary text-on-primary font-headline text-xs font-black px-3.5 py-2.5 rounded-xl chunky-btn-sm border-primary-container ml-auto hover:brightness-110 active:scale-95 flex items-center gap-1">
            <span class="material-symbols-outlined text-base">pets</span> Pet Pen
          </button>
        </div>
        `
        }
      </section>

      <!-- Toddler Easy Mode (Age 3-4) Rex Voice Guide Banner -->
      ${
        isEasyMode
          ? `
      <div class="bg-gradient-to-r from-primary/15 via-secondary/15 to-transparent border-2 border-primary/40 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs animate-fade-in card-shadow">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center text-lg flex-shrink-0 shadow-sm">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">volume_up</span>
          </div>
          <div>
            <span class="font-headline font-black text-primary flex items-center gap-1">
              Rex Spoken Voice Guide Active (Age 3-4)
              <span class="bg-primary/20 text-primary text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Easy Mode</span>
            </span>
            <span class="text-[11px] text-on-surface-variant font-bold">Tap any quest card to hear Rex explain and guide you through it!</span>
          </div>
        </div>
        <button id="dash-voice-welcome-btn" class="bg-primary text-on-primary font-headline text-xs font-black px-3.5 py-2 rounded-xl chunky-btn-sm flex items-center gap-1 hover:brightness-110 active:scale-95 shadow flex-shrink-0" title="Listen to Rex's daily guidance">
          <span class="material-symbols-outlined text-sm">record_voice_over</span> Hear Rex
        </button>
      </div>
      `
          : ''
      }

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
          <div class="flex items-center gap-2.5">
            <span class="text-2xl leading-none flex items-center justify-center select-none drop-shadow-sm" role="img" aria-label="Habit Islands">🏝️</span>
            <h2 class="font-headline text-xl font-black text-inverse-surface">Habit Islands</h2>
          </div>
          <span class="text-xs font-bold text-on-surface-variant">Daily Positive Habits</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          ${habitIslands
            .map((h) => {
              const isApproved = h.completed && h.pointsApproved;
              const btnClass = isApproved
                ? 'tactile-check-approved'
                : 'tactile-check-ready';
              const checkIcon = isApproved ? 'verified' : 'check';
              const iconColor = 'text-white';

              return `
              <div data-habit-card-id="${h.id}" class="habit-card-item tactile-card bg-surface-container rounded-3xl p-4 flex items-center justify-between border-2 ${
                isApproved
                  ? 'border-primary/50 bg-surface-container'
                  : 'border-surface-container-highest bg-surface-container'
              } transition-all cursor-pointer">
                <div class="flex items-center gap-3.5 flex-1 pr-3">
                  <!-- Circular Graphical Habit Icon for Toddlers -->
                  <div class="w-16 h-16 sm:w-18 sm:h-18 rounded-full border-3 border-secondary/50 bg-gradient-to-b from-[#182838] to-[#0d1620] flex items-center justify-center p-1.5 shadow-md flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                    ${
                      h.image
                        ? `<img src="${h.image}" class="w-full h-full object-contain rounded-full drop-shadow-md" alt="${h.title}" />`
                        : getTaskVisualSvg(h.icon || h.id, 'yellow')
                    }
                  </div>
                  <div class="flex flex-col">
                    <h3 class="font-headline text-base font-bold text-inverse-surface leading-snug">${h.title}</h3>
                    <p class="text-xs text-on-surface-variant line-clamp-1 mt-0.5">${h.desc}</p>
                    
                    <div class="flex items-center gap-2.5 text-xs font-black mt-1">
                      <span class="text-secondary flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-sm">monetization_on</span> +${h.coins} Tokens
                      </span>
                      <span class="text-tertiary flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-sm">star</span> +${h.points} Points
                      </span>
                      ${
                        isApproved
                          ? `<span class="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 flex items-center gap-1 shadow-sm">
                               <span class="material-symbols-outlined text-[11px]">verified</span> Approved ⭐
                             </span>`
                          : ''
                      }
                    </div>
                  </div>
                </div>

                <button data-habit-id="${h.id}" class="habit-check-btn tactile-check-btn ${btnClass} rounded-2xl w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center flex-shrink-0 active:scale-95 shadow-chunky-sm" title="${isApproved ? 'Quest Approved' : 'Complete Habit'}">
                  <span class="material-symbols-outlined text-3xl font-black ${iconColor}" style="font-variation-settings: 'FILL' 1;">
                    ${checkIcon}
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
              const isApproved = t.completed && t.pointsApproved;
              const btnClass = isApproved
                ? 'tactile-check-approved'
                : 'tactile-check-ready';
              const checkIcon = isApproved ? 'verified' : 'check';
              const iconColor = 'text-white';

              return `
              <div data-task-card-id="${t.id}" class="task-card-item tactile-card bg-surface-container rounded-3xl p-4 flex items-center justify-between border-2 ${
                isApproved && !t.isAR
                  ? 'border-primary/50 bg-surface-container'
                  : 'border-surface-container-highest bg-surface-container'
              } transition-all cursor-pointer">
                <div class="flex items-center gap-3.5 flex-1 pr-3">
                  <!-- Circular Graphical Chore/Routine Icon for Toddlers -->
                  <div class="w-16 h-16 sm:w-18 sm:h-18 rounded-full border-3 border-primary/50 bg-gradient-to-b from-[#132c20] to-[#07160e] flex items-center justify-center p-1.5 shadow-md flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                    ${
                      t.image
                        ? `<img src="${t.image}" class="w-full h-full object-contain rounded-full drop-shadow-md" alt="${t.title}" />`
                        : getTaskVisualSvg(t.icon || t.id, 'blue')
                    }
                  </div>
                  <div class="flex flex-col">
                    <div class="flex items-center gap-1.5">
                      <span class="text-[9px] font-black uppercase text-secondary bg-surface-container-high px-2 py-0.5 rounded-md">${t.timeWindow}</span>
                      ${t.isAR ? `<span class="text-[9px] font-black uppercase text-error bg-error/15 px-2 py-0.5 rounded-md">AR Mode</span>` : ''}
                    </div>
                    <h3 class="font-headline text-base font-bold text-inverse-surface leading-snug mt-0.5">${t.title}</h3>
                    
                    <div class="flex items-center gap-2.5 text-xs font-black mt-1">
                      <span class="text-secondary flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-sm">monetization_on</span> +${t.coins} Tokens
                      </span>
                      <span class="text-tertiary flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-sm">star</span> +${t.points} Points
                      </span>
                      ${
                        isApproved && !t.isAR
                          ? `<span class="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 flex items-center gap-1 shadow-sm">
                               <span class="material-symbols-outlined text-[11px]">verified</span> Approved ⭐
                             </span>`
                          : ''
                      }
                    </div>
                  </div>
                </div>

                ${
                  t.isAR
                    ? `
                  <button data-task-ar-id="${t.id}" class="task-ar-launch-btn bg-error text-on-error font-headline text-xs font-black px-4 py-3 rounded-2xl chunky-btn border-error-container shadow-chunky-sm flex items-center gap-1.5 hover:brightness-110 active:scale-95" title="Launch Toothbrush AR Battle">
                    <span class="material-symbols-outlined text-base">play_arrow</span> Battle
                  </button>
                `
                    : `
                  <button data-task-id="${t.id}" class="task-check-btn tactile-check-btn ${btnClass} rounded-2xl w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center flex-shrink-0 active:scale-95 shadow-chunky-sm" title="${isApproved ? 'Quest Approved' : 'Complete Chore'}">
                    <span class="material-symbols-outlined text-3xl font-black ${iconColor}" style="font-variation-settings: 'FILL' 1;">
                      ${checkIcon}
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
          <div>
            <span class="text-[10px] font-black uppercase text-secondary tracking-wider">Educational Quests</span>
            <h3 class="font-headline text-base font-bold text-inverse-surface">Adventure Learning Map</h3>
            <p class="text-xs text-on-surface-variant">Phonics, counting, colors & geometry quests for bonus tokens!</p>
          </div>
        </div>
        <button id="dash-to-adventures-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black px-5 py-3 rounded-xl chunky-btn border-secondary-container shadow-chunky-sm hover:brightness-110 active:scale-95">
          Open Map
        </button>
      </section>

    </div>
  `;
}

let hasSpokenDashboardGreeting = false;

function triggerQuestVoice(title = '', id = '', desc = '') {
  const isEasy = store.isEasyMode();
  const t = (title + ' ' + id).toLowerCase();

  if (t.includes('brush') || t.includes('teeth') || t.includes('dentist')) {
    speakRex(isEasy
      ? "Time to brush our teeth and defeat the sugar villains! Scrub circles all over your teeth!"
      : "Time to brush our teeth and defeat the sugar villains!");
  } else if (t.includes('feed') || t.includes('snack') || t.includes('fruit') || t.includes('pet')) {
    speakRex(isEasy
      ? "Yummy snack time! Let's feed our pet companion delicious healthy food!"
      : "Yummy snack time! Let's feed our pet companion!");
  } else if (t.includes('toy') || t.includes('clean') || t.includes('tidy') || t.includes('bed')) {
    speakRex(isEasy
      ? "Toy cleanup time! Let's put our toys away together with super hero tidy power!"
      : "Toy cleanup time! Super hero tidy power!");
  } else if (t.includes('water') || t.includes('drink')) {
    speakRex("Gulp gulp! Super hero hydration power!");
  } else if (t.includes('hand') || t.includes('soap') || t.includes('wash')) {
    speakRex("Scrub scrub suds! Clean hands make us strong and healthy!");
  } else if (t.includes('kind') || t.includes('share') || t.includes('hug')) {
    speakRex("Super hero kindness makes the whole world brighter!");
  } else {
    speakRex(isEasy && desc
      ? `Quest time: ${title}! ${desc}. You can do it!`
      : `Awesome! Let's do this quest: ${title}!`);
  }
}

export function attachDashboardListeners() {
  const isEasy = store.isEasyMode();
  if (isEasy && !hasSpokenDashboardGreeting) {
    hasSpokenDashboardGreeting = true;
    setTimeout(() => {
      speakRex("Hi Little Hero! Let's do our quests today! Tap any chore to hear what to do!");
    }, 500);
  }

  const voiceWelcomeBtn = document.getElementById('dash-voice-welcome-btn');
  if (voiceWelcomeBtn) {
    voiceWelcomeBtn.addEventListener('click', () => {
      speakRex("Hi Little Hero! I am Rex the Dino! Tap any quest card to hear how to earn tokens and level up!");
    });
  }

  document.querySelectorAll('.habit-check-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const habitId = btn.getAttribute('data-habit-id');
      const habit = (store.getState().habitIslands || []).find((h) => h.id === habitId);
      triggerQuestVoice(habit?.title || '', habitId || '', habit?.desc || '');
      store.toggleHabitIsland(habitId);
    });
  });

  document.querySelectorAll('.habit-card-item').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const habitId = card.getAttribute('data-habit-card-id');
      const habit = (store.getState().habitIslands || []).find((h) => h.id === habitId);
      triggerQuestVoice(habit?.title || '', habitId || '', habit?.desc || '');
      if (habitId) store.toggleHabitIsland(habitId);
    });
  });

  document.querySelectorAll('.task-check-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.getAttribute('data-task-id');
      const task = (store.getState().taskForest || []).find((t) => t.id === taskId);
      triggerQuestVoice(task?.title || '', taskId || '', task?.desc || '');
      store.toggleTaskForest(taskId);
    });
  });

  document.querySelectorAll('.task-card-item').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const taskId = card.getAttribute('data-task-card-id');
      const task = (store.getState().taskForest || []).find((t) => t.id === taskId);
      triggerQuestVoice(task?.title || '', taskId || '', task?.desc || '');
      const isAR = card.querySelector('.task-ar-launch-btn');
      if (isAR) {
        store.navigate('ar_battle');
      } else if (taskId) {
        store.toggleTaskForest(taskId);
      }
    });
  });

  document.querySelectorAll('.task-ar-launch-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakRex("Time to brush our teeth and defeat the sugar villains!");
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
