import { store } from '../state/store.js';
import { getTaskVisualSvg } from '../utils/taskVisuals.js';
import { speakRex } from '../services/voiceService.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import { requestAutonomousMicroQuests, submitDailyQuest } from '../services/questService.js';
import { chorePhotoProofModal } from '../components/ChorePhotoProofModal.js';

export function renderDashboardView() {
  const state = store.getState();
  const hero = state.selectedHero;
  const habitIslands = state.habitIslands;
  const taskForest = state.taskForest;
  const aiQuests = store.getAiQuests();
  const activePet = store.getActivePet();
  const pendingCount = state.pendingApprovals.filter(r => r.kidId === hero.id).length;
  const isEasyMode = store.isEasyMode();

  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-6 animate-fade-in">
      
      <!-- HERO STATUS BANNER & PET COMPANION WIDGET -->
      <section class="bg-surface-container rounded-3xl p-5 border-2 border-surface-bright card-shadow flex flex-col sm:flex-row items-center justify-between gap-5 relative overflow-hidden">
        <div class="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-primary/10 blur-2xl pointer-events-none"></div>

        <!-- Left: Kid Profile Info -->
        <div class="flex items-center gap-4 w-full sm:w-auto relative">
          <!-- Playful Fluttering Butterfly -->
          <div class="absolute -top-3 -left-2 text-base animate-butterfly pointer-events-none select-none drop-shadow z-20" title="Fluttering Butterfly">🦋</div>

          <div id="dash-hero-avatar-trigger" class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-surface-container-high border-4 border-primary overflow-hidden flex items-center justify-center shadow-inner flex-shrink-0 relative cursor-pointer hover:scale-105 active:scale-95 transition-transform animate-idle-bob" title="Tap your hero to giggle or do a backflip!">
            <img id="dash-hero-avatar-img" class="w-full h-full object-cover select-none" src="${hero.avatar}" alt="${hero.name}" />
            <div class="absolute -bottom-1 -right-1 bg-secondary text-on-secondary font-headline text-[10px] font-black px-1.5 py-0.2 rounded-md shadow">
              LV ${hero.level}
            </div>
          </div>

          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <h1 class="font-headline text-2xl sm:text-3xl font-black text-inverse-surface">${hero.name}</h1>
              <span class="text-xs bg-secondary-container/40 text-secondary font-black px-2.5 py-0.5 rounded-full border border-secondary-container flex items-center gap-1">
                <span>🔥 ${hero.streak} Day Streak</span>
                ${store.getPetStreakShield().isActive ? '<span class="text-[9px] bg-primary/25 text-primary px-1.5 py-0.5 rounded-full border border-primary/40 font-black" title="Pet Streak Shield Active! Joyful companions protect your streak">🛡️ Shield</span>' : ''}
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
          <div class="w-14 h-14 rounded-2xl bg-surface-container overflow-hidden border-2 border-secondary flex items-center justify-center flex-shrink-0 relative cursor-pointer active:scale-95 transition-transform animate-idle-bob" id="dash-active-pet-trigger" title="Tap your pet to giggle or do a backflip!">
            <img id="dash-active-pet-img" class="w-full h-full object-contain p-1 select-none" src="${activePet.avatar}" alt="${activePet.name}" />
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
        <button id="dash-voice-welcome-btn" class="bg-gradient-to-r from-primary to-emerald-500 text-on-primary font-headline text-xs font-black px-4 py-2.5 rounded-xl chunky-btn flex items-center gap-1.5 hover:brightness-110 active:scale-95 shadow-md flex-shrink-0 animate-pulse border-2 border-primary-container" title="Listen to Rex's daily guidance">
          <span class="material-symbols-outlined text-base animate-bounce">record_voice_over</span> Hear Rex!
        </button>
      </div>
      `
          : ''
      }

      <!-- Screen Time Bank & Currency Status Bar -->
      <div class="bg-surface-container/70 border-2 ${hero.isScreenTimePaused ? 'border-amber-500/50 bg-amber-500/10' : 'border-surface-container-highest'} px-4 py-3 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs font-bold card-shadow">
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-secondary flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">monetization_on</span>
            Tokens: <strong>${hero.coins || 0} 🪙</strong>
          </span>
          <span class="text-tertiary flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">star</span>
            Points: <strong>${hero.points || 0} ⭐</strong>
          </span>
          <!-- Screen Time Bank Balance Pill -->
          <span class="flex items-center gap-1.5 ${hero.isScreenTimePaused ? 'text-amber-300 bg-amber-500/20 border-amber-500/40' : 'text-sky-300 bg-sky-500/15 border-sky-500/30'} px-3 py-1 rounded-xl border">
            <span class="material-symbols-outlined text-sm">${hero.isScreenTimePaused ? 'pause_circle' : 'schedule'}</span>
            Screen Time: <strong>${hero.screenTimeMinutes || 0}m</strong>
            ${hero.isScreenTimePaused ? '<span class="text-[9px] bg-amber-400 text-slate-900 uppercase px-1.5 py-0.2 rounded font-black">Locked</span>' : ''}
          </span>
        </div>

        <div class="flex items-center gap-2">
          ${pendingCount > 0 ? `<span class="text-tertiary text-[11px] font-black bg-tertiary/15 px-2.5 py-1 rounded-full border border-tertiary/30">⭐ ${pendingCount} Point Request(s) Pending</span>` : ''}
        </div>
      </div>

      <!-- Gentle Screen Time Pause / Bedtime Lockout Notice (Rex Toddler-Friendly) -->
      ${
        hero.isScreenTimePaused
          ? `
      <div class="bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-transparent border-2 border-amber-500/50 rounded-2xl p-4 flex items-center gap-3.5 animate-fade-in card-shadow">
        <div class="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center text-2xl flex-shrink-0">
          🦖🌙
        </div>
        <div class="flex flex-col">
          <span class="font-headline text-xs font-black text-amber-300 uppercase tracking-wide flex items-center gap-1">
            <span>Screen Time Curfew / Lock Active</span>
            <span class="material-symbols-outlined text-xs">bedtime</span>
          </span>
          <p class="text-xs sm:text-sm font-bold text-inverse-surface mt-0.5 leading-snug">
            ${hero.screenTimeLockMessage || 'Rex says: Great job today! Time to play outside or get cozy for bedtime! 🦖🌙'}
          </p>
        </div>
      </div>
      `
          : ''
      }

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
              const isPending = store.isTaskPendingApproval(h.id, hero.id);
              const completionsToday = store.getTaskCompletionsToday(h.id, hero.id);
              const completedTodayCount = completionsToday.length;

              let btnClass = 'tactile-check-ready';
              let checkIcon = 'check';
              let statusBadge = '';
              let btnTitle = 'Complete Habit';

              if (isPending) {
                btnClass = 'tactile-check-pending animate-pulse';
                checkIcon = 'hourglass_top';
                btnTitle = 'Waiting for Parent Approval';
                statusBadge = `
                  <span class="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                    <span class="material-symbols-outlined text-[11px] animate-spin">hourglass_empty</span> Pending Parent ⭐
                  </span>
                `;
              } else if (completedTodayCount > 0) {
                btnClass = 'tactile-check-ready';
                checkIcon = 'check';
                btnTitle = `Completed ${completedTodayCount}x today • Tap to complete again`;
                statusBadge = `
                  <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 flex items-center gap-1 shadow-sm">
                    <span class="material-symbols-outlined text-[11px]">verified</span> Done ${completedTodayCount}x today ⭐
                  </span>
                `;
              }

              return `
              <div data-habit-card-id="${h.id}" class="habit-card-item tactile-card bg-surface-container rounded-3xl p-4 flex items-center justify-between border-2 ${
                isPending
                  ? 'border-amber-500/50 bg-surface-container'
                  : completedTodayCount > 0
                  ? 'border-primary/40 bg-surface-container'
                  : 'border-surface-container-highest bg-surface-container'
              } transition-all cursor-pointer">
                <div class="flex items-center gap-3.5 flex-1 pr-3">
                  <!-- Dedicated Material Symbol Container -->
                  <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 text-amber-400 border border-slate-700/50 shadow-inner flex-shrink-0">
                    <span class="material-symbols-outlined text-2xl select-none" style="font-variation-settings: 'FILL' 1;">
                      ${h.icon || 'star'}
                    </span>
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
                      ${statusBadge}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 flex-shrink-0">
                  ${!isPending ? `
                    <button data-habit-proof-id="${h.id}" class="habit-proof-btn bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-headline text-[10px] font-black px-2.5 py-2 rounded-2xl flex flex-col items-center gap-0.5 active:scale-95 shadow-sm transition-all" title="Snap photo proof for +5 bonus tokens!">
                      <span class="material-symbols-outlined text-base">photo_camera</span>
                      <span class="text-[8px] leading-none">+5 🪙</span>
                    </button>
                  ` : ''}

                  <button data-habit-id="${h.id}" class="habit-check-btn tactile-check-btn ${btnClass} rounded-2xl w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center flex-shrink-0 active:scale-95 shadow-chunky-sm" title="${btnTitle}">
                    <span class="material-symbols-outlined text-3xl font-black text-white" style="font-variation-settings: 'FILL' 1;">
                      ${checkIcon}
                    </span>
                  </button>
                </div>
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
              const isPending = store.isTaskPendingApproval(t.id, hero.id);
              const completionsToday = store.getTaskCompletionsToday(t.id, hero.id);
              const completedTodayCount = completionsToday.length;

              let btnClass = 'tactile-check-ready';
              let checkIcon = 'check';
              let statusBadge = '';
              let btnTitle = 'Complete Chore';

              if (isPending) {
                btnClass = 'tactile-check-pending animate-pulse';
                checkIcon = 'hourglass_top';
                btnTitle = 'Waiting for Parent Approval';
                statusBadge = `
                  <span class="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                    <span class="material-symbols-outlined text-[11px] animate-spin">hourglass_empty</span> Pending Parent ⭐
                  </span>
                `;
              } else if (completedTodayCount > 0) {
                btnClass = 'tactile-check-ready';
                checkIcon = 'check';
                btnTitle = `Completed ${completedTodayCount}x today • Tap to complete again`;
                statusBadge = `
                  <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 flex items-center gap-1 shadow-sm">
                    <span class="material-symbols-outlined text-[11px]">verified</span> Done ${completedTodayCount}x today ⭐
                  </span>
                `;
              }

              return `
              <div data-task-card-id="${t.id}" class="task-card-item tactile-card bg-surface-container rounded-3xl p-4 flex items-center justify-between border-2 ${
                isPending
                  ? 'border-amber-500/50 bg-surface-container'
                  : completedTodayCount > 0 && !t.isAR
                  ? 'border-primary/40 bg-surface-container'
                  : 'border-surface-container-highest bg-surface-container'
              } transition-all cursor-pointer">
                <div class="flex items-center gap-3.5 flex-1 pr-3">
                  <!-- Dedicated Material Symbol Container -->
                  <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700/50 shadow-inner flex-shrink-0">
                    <span class="material-symbols-outlined text-2xl select-none" style="font-variation-settings: 'FILL' 1;">
                      ${t.icon || 'star'}
                    </span>
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
                      ${statusBadge}
                    </div>
                  </div>
                </div>

                ${
                  t.isAR
                    ? `
                  <button data-task-ar-id="${t.id}" class="task-ar-launch-btn ${isPending ? 'bg-amber-600 border-amber-800' : 'bg-error border-error-container'} text-white font-headline text-xs font-black px-4 py-3 rounded-2xl chunky-btn shadow-chunky-sm flex items-center gap-1.5 hover:brightness-110 active:scale-95" title="${isPending ? 'Toothbrush Battle Submitted (Pending Parent)' : 'Launch Toothbrush AR Battle'}">
                    <span class="material-symbols-outlined text-base">${isPending ? 'hourglass_top' : 'play_arrow'}</span> ${isPending ? 'Pending' : 'Battle'}
                  </button>
                `
                    : `
                  <div class="flex items-center gap-2 flex-shrink-0">
                    ${!isPending ? `
                      <button data-task-proof-id="${t.id}" class="task-proof-btn bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-headline text-[10px] font-black px-2.5 py-2 rounded-2xl flex flex-col items-center gap-0.5 active:scale-95 shadow-sm transition-all" title="Snap photo proof for +5 bonus tokens!">
                        <span class="material-symbols-outlined text-base">photo_camera</span>
                        <span class="text-[8px] leading-none">+5 🪙</span>
                      </button>
                    ` : ''}

                    <button data-task-id="${t.id}" class="task-check-btn tactile-check-btn ${btnClass} rounded-2xl w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center flex-shrink-0 active:scale-95 shadow-chunky-sm" title="${btnTitle}">
                      <span class="material-symbols-outlined text-3xl font-black text-white" style="font-variation-settings: 'FILL' 1;">
                        ${checkIcon}
                      </span>
                    </button>
                  </div>
                `
                }
              </div>
            `;
            })
            .join('')}
        </div>
      </section>
 
      <!-- ZONE 3: AI Spark Autonomous Micro-Quests (Powered by Gemini 2.5 Flash Subagents) -->
      <section class="flex flex-col gap-3.5">
        <div class="flex justify-between items-center px-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-tertiary text-2xl" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
            <h2 class="font-headline text-xl font-black text-inverse-surface">AI Spark Quests</h2>
            <span class="bg-tertiary/20 text-tertiary text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-tertiary/40">Subagent Powered</span>
          </div>
          <button id="dash-generate-ai-quests-btn" class="bg-gradient-to-r from-tertiary to-amber-500 text-slate-900 font-headline text-xs font-black px-3.5 py-1.5 rounded-xl chunky-btn-sm border border-tertiary shadow-sm hover:brightness-110 active:scale-95 flex items-center gap-1.5 transition-transform" title="Use Gemini 2.5 Flash to generate custom daily micro-quests tailored to your hero">
            <span id="ai-quest-btn-icon" class="material-symbols-outlined text-sm">sparkles</span>
            <span id="ai-quest-btn-text">Generate Quests</span>
          </button>
        </div>

        ${aiQuests.length === 0 ? `
          <div class="bg-surface-container/60 border-2 border-dashed border-tertiary/30 rounded-3xl p-5 text-center flex flex-col items-center gap-2.5">
            <div class="w-12 h-12 rounded-2xl bg-tertiary/20 text-tertiary flex items-center justify-center text-2xl">
              <span class="material-symbols-outlined text-2xl" style="font-variation-settings: 'FILL' 1;">psychology</span>
            </div>
            <h4 class="font-headline text-sm font-black text-inverse-surface">No Spark Quests Generated Yet</h4>
            <p class="text-xs text-on-surface-variant max-w-md">Tap "Generate Quests" above to let your companion subagent create custom micro-challenges adapted to your hero's age and habits!</p>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            ${aiQuests.map((q) => {
              const isPending = store.isTaskPendingApproval(q.id, hero.id);
              const completionsToday = store.getTaskCompletionsToday(q.id, hero.id);
              const isCompleted = q.completed || completionsToday.length > 0;

              let btnClass = 'tactile-check-ready';
              let checkIcon = 'check';
              let statusBadge = '';
              let btnTitle = 'Complete AI Quest';

              if (isPending) {
                btnClass = 'tactile-check-pending animate-pulse';
                checkIcon = 'hourglass_top';
                btnTitle = 'Waiting for Parent Approval';
                statusBadge = `
                  <span class="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                    <span class="material-symbols-outlined text-[11px] animate-spin">hourglass_empty</span> Pending Parent ⭐
                  </span>
                `;
              } else if (isCompleted) {
                btnClass = 'tactile-check-ready';
                checkIcon = 'check';
                btnTitle = 'Completed today • Tap to log again';
                statusBadge = `
                  <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 flex items-center gap-1 shadow-sm">
                    <span class="material-symbols-outlined text-[11px]">verified</span> Verified ⭐
                  </span>
                `;
              }

              return `
                <div data-ai-quest-card-id="${q.id}" class="ai-quest-card-item tactile-card bg-surface-container rounded-3xl p-4 flex items-center justify-between border-2 ${
                  isPending
                    ? 'border-amber-500/50 bg-surface-container'
                    : isCompleted
                    ? 'border-primary/40 bg-surface-container'
                    : 'border-tertiary/40 bg-surface-container'
                } transition-all cursor-pointer">
                  <div class="flex items-center gap-3.5 flex-1 pr-3">
                    <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 text-tertiary border border-slate-700/50 shadow-inner flex-shrink-0">
                      <span class="material-symbols-outlined text-2xl select-none" style="font-variation-settings: 'FILL' 1;">
                        ${q.icon || 'auto_awesome'}
                      </span>
                    </div>
                    <div class="flex flex-col">
                      <div class="flex items-center gap-1.5">
                        <span class="text-[9px] font-black uppercase text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-md border border-tertiary/20">${q.timeWindow || 'Daily'}</span>
                        <span class="text-[9px] font-bold text-on-surface-variant italic line-clamp-1">${q.petCheer || 'Let\'s do it!'}</span>
                      </div>
                      <h3 class="font-headline text-base font-bold text-inverse-surface leading-snug mt-0.5">${q.title}</h3>
                      <p class="text-xs text-on-surface-variant line-clamp-2 mt-0.5">${q.description}</p>
                      
                      <div class="flex items-center gap-2.5 text-xs font-black mt-1">
                        <span class="text-secondary flex items-center gap-0.5">
                          <span class="material-symbols-outlined text-sm">monetization_on</span> +${q.coinReward || 25} Tokens
                        </span>
                        <span class="text-tertiary flex items-center gap-0.5">
                          <span class="material-symbols-outlined text-sm">star</span> +${q.pointReward || 10} Points
                        </span>
                        ${statusBadge}
                      </div>
                    </div>
                  </div>

                  <button data-ai-quest-id="${q.id}" class="ai-quest-check-btn tactile-check-btn ${btnClass} rounded-2xl w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center flex-shrink-0 active:scale-95 shadow-chunky-sm" title="${btnTitle}">
                    <span class="material-symbols-outlined text-3xl font-black text-white" style="font-variation-settings: 'FILL' 1;">
                      ${checkIcon}
                    </span>
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        `}
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

let lastSpokenHeroId = null;

function triggerQuestVoice(title = '', id = '', desc = '') {
  const currentHeroId = store.getState().selectedHero?.id;
  if (id && store.isTaskPendingApproval(id, currentHeroId)) {
    speakRex("This quest is waiting for Parent to verify and approve your Gold Points in the Parent Portal!");
    return;
  }

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
  const currentHeroId = store.getState().selectedHero?.id;

  if (isEasy && lastSpokenHeroId !== currentHeroId) {
    lastSpokenHeroId = currentHeroId;
    setTimeout(() => {
      speakRex("Hi Little Hero! Let's do our quests today! Tap any chore to hear what to do!");
    }, 450);
  }

  const voiceWelcomeBtn = document.getElementById('dash-voice-welcome-btn');
  if (voiceWelcomeBtn) {
    voiceWelcomeBtn.addEventListener('click', () => {
      Sound.chirp();
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

  // Hero Character Tap Reaction (Backflip or Giggle)
  const heroAvatarTrigger = document.getElementById('dash-hero-avatar-trigger');
  const heroImg = document.getElementById('dash-hero-avatar-img');
  if (heroAvatarTrigger && heroImg) {
    heroAvatarTrigger.addEventListener('click', () => {
      const isFlip = Math.random() > 0.5;
      heroImg.classList.remove('animate-backflip', 'animate-giggle');
      void heroImg.offsetWidth;
      heroImg.classList.add(isFlip ? 'animate-backflip' : 'animate-giggle');

      Sound.boing();
      if (isFlip) {
        speakRex("Woohoo! Backflip power! Ready for adventure!");
      } else {
        speakRex("Hehehe! That tickles! Let's go Little Hero!");
      }

      confetti({
        particleCount: 20,
        spread: 45,
        origin: { y: 0.3 }
      });
    });
  }

  // Active Pet Character Tap Reaction (Backflip or Giggle)
  const activePetImg = document.getElementById('dash-active-pet-img');
  if (activePetImg) {
    activePetImg.addEventListener('click', (e) => {
      e.stopPropagation();
      const isFlip = Math.random() > 0.5;
      activePetImg.classList.remove('animate-backflip', 'animate-giggle');
      void activePetImg.offsetWidth;
      activePetImg.classList.add(isFlip ? 'animate-backflip' : 'animate-giggle');

      Sound.chirp();
      Sound.boing();

      if (isFlip) {
        speakRex("Woohoo! Look at that companion backflip! So talented!");
      } else {
        speakRex("Hehehe! That tickles! Your companion is so happy!");
      }

      confetti({
        particleCount: 25,
        spread: 60,
        origin: { y: 0.35 },
        colors: ['#ffb961', '#54e98a', '#ff7675']
      });
    });
  }

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

  // AI Spark Quests Generation Listener
  const generateQuestsBtn = document.getElementById('dash-generate-ai-quests-btn');
  if (generateQuestsBtn) {
    generateQuestsBtn.addEventListener('click', async () => {
      Sound.sparkle();
      const hero = store.getState().selectedHero;
      const activePet = store.getActivePet();
      const isEasy = store.isEasyMode();

      const btnIcon = document.getElementById('ai-quest-btn-icon');
      const btnText = document.getElementById('ai-quest-btn-text');
      if (btnIcon) btnIcon.classList.add('animate-spin');
      if (btnText) btnText.textContent = 'Sparking...';
      generateQuestsBtn.disabled = true;

      // Extract recently completed habit titles to inform personalized quest generation
      const logs = store.getState().taskCompletionLogs || [];
      const completedHabits = logs.slice(0, 10).map((l) => l.taskTitle).filter(Boolean);

      try {
        const res = await requestAutonomousMicroQuests({
          heroId: hero?.id || 'hero_1',
          heroName: hero?.name || 'Little Hero',
          childAge: isEasy ? 3 : 6,
          ageTier: isEasy ? 'toddler' : 'kid',
          petId: activePet?.id || 'rex',
          completedHabits
        });

        if (res?.quests && res.quests.length > 0) {
          store.setAiQuests(res.quests);
          Sound.fanfare();
          speakRex(`*Happy giggle!* Hooray! I created ${res.quests.length} new spark quests for you!`);
        }
      } catch (err) {
        console.warn("Failed to generate AI quests:", err);
      } finally {
        if (btnIcon) btnIcon.classList.remove('animate-spin');
        if (btnText) btnText.textContent = 'Generate Quests';
        generateQuestsBtn.disabled = false;
      }
    });
  }

  // AI Spark Quest Completion Listener
  document.querySelectorAll('.ai-quest-check-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const questId = btn.getAttribute('data-ai-quest-id');
      const quest = (store.getAiQuests() || []).find((q) => q.id === questId);
      if (!quest) return;

      const hero = store.getState().selectedHero;
      Sound.click();

      // Submit to Gemini subagent verification pipeline
      try {
        const result = await submitDailyQuest(
          hero.id,
          quest.title,
          `Completed AI Spark Quest: ${quest.description}`
        );
        store.completeAiQuest(questId, result);
        speakRex(result.petReaction || quest.petCheer || "Super job on your spark quest!");
      } catch (subagentErr) {
        console.warn("Subagent verification fallback:", subagentErr);
        store.completeAiQuest(questId);
        speakRex(quest.petCheer || "Awesome work completing your spark quest!");
      }
    });
  });

  // AI Spark Quest Card Voice Guidance on Click
  document.querySelectorAll('.ai-quest-card-item').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const questId = card.getAttribute('data-ai-quest-card-id');
      const quest = (store.getAiQuests() || []).find((q) => q.id === questId);
      if (quest) {
        triggerQuestVoice(quest.title, quest.id, quest.description);
      }
    });
  });

  // Chore Photo Proof Modal Triggers
  document.querySelectorAll('.task-proof-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.getAttribute('data-task-proof-id');
      const task = store.getState().taskForest.find((t) => t.id === taskId);
      if (task) {
        Sound.click();
        chorePhotoProofModal.open(task);
      }
    });
  });

  document.querySelectorAll('.habit-proof-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const habitId = btn.getAttribute('data-habit-proof-id');
      const habit = store.getState().habitIslands.find((h) => h.id === habitId);
      if (habit) {
        Sound.click();
        chorePhotoProofModal.open(habit);
      }
    });
  });
}
