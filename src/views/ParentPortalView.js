import { store, KID_AVATARS } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { processProfilePhoto } from '../utils/photoUploader.js';
import { authenticateWithBiometrics } from '../utils/biometrics.js';
import { getTaskVisualSvg } from '../utils/taskVisuals.js';

let activeAdminTab = 'approvals'; // approvals, kids, tasks, rewards, pricing, studio, analytics, settings
let isAddKidModalOpen = false;
let editingKid = null;
let deletingKid = null;
let isNewHouseholdModalOpen = false;
let selectedAvatarUrl = KID_AVATARS[0].url;

export function renderParentPortalView() {
  const state = store.getState();
  const heroes = state.heroes;
  const pending = state.pendingApprovals;
  const taskForest = state.taskForest;
  const habitIslands = state.habitIslands;
  const realLifeRewards = state.realLifeRewards;
  const digitalGear = state.digitalGear;
  const settings = state.parentSettings;
  const logs = state.taskLedgerLogs;

  const tabs = [
    { id: 'approvals', label: 'Action Inbox', icon: 'inbox', count: pending.length },
    { id: 'kids', label: 'Kids & Household', icon: 'diversity_1', count: heroes.length },
    { id: 'tasks', label: 'Tasks & Routines', icon: 'checklist', count: 0 },
    { id: 'rewards', label: 'Real-Life Rewards', icon: 'card_giftcard', count: 0 },
    { id: 'pricing', label: 'Pricing Editor', icon: 'payments', count: 0 },
    { id: 'studio', label: 'AI Reward Studio', icon: 'auto_awesome', count: 0 },
    { id: 'analytics', label: 'Analytics & Ledger', icon: 'monitoring', count: 0 },
    { id: 'settings', label: 'Safety & Sliders', icon: 'tune', count: 0 }
  ];

  return `
    <div class="max-w-5xl mx-auto px-4 pt-4 pb-32 flex flex-col gap-6 animate-fade-in">
      
      <!-- Top Title & Navigation -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b-2 border-surface-container-highest pb-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center text-2xl shadow-md">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">shield_person</span>
          </div>
          <div>
            <h1 class="font-headline text-2xl sm:text-3xl font-black text-secondary">Parent Admin Portal</h1>
            <p class="text-xs text-on-surface-variant font-bold">Household: ${state.household.name} • Code: ${state.household.syncCode}</p>
          </div>
        </div>

        <!-- Lock & Return to Kids Button -->
        <div class="flex items-center gap-2">
          <button id="admin-lock-exit-btn" class="bg-error/20 hover:bg-error/30 text-error border-2 border-error/40 font-headline text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 chunky-btn-sm active:scale-95 shadow-sm" title="Lock Parent Dashboard and return to Kid Mode">
            <span class="material-symbols-outlined text-base">lock</span>
            <span>Lock & Exit to Kids</span>
          </button>
        </div>
      </div>

      <!-- Currency Policy Notice Banner -->
      <div class="bg-surface-container/70 border-2 border-secondary-container/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div class="flex flex-col gap-1">
          <span class="font-headline font-black text-secondary flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">account_balance_wallet</span>
            Verified Currency & Parent Approval System
          </span>
          <span class="text-on-surface-variant font-medium">
            <strong>Tokens (🪙):</strong> Auto-issued immediately to kids for digital gear.<br/>
            <strong>Points (⭐):</strong> Placed in this Action Inbox and <em>ONLY</em> credited upon parent approval.
          </span>
        </div>
        <div class="flex items-center gap-2 self-end sm:self-auto">
          <span class="bg-secondary/15 text-secondary px-3 py-1.5 rounded-xl font-black text-[11px] border border-secondary/30">
            ${pending.length} Pending Approval(s)
          </span>
        </div>
      </div>

      <!-- Admin Tab Navigation Pills -->
      <div class="flex overflow-x-auto gap-2 pb-1 hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        ${tabs
          .map((tab) => {
            const isTabActive = activeAdminTab === tab.id;
            return `
            <button data-admin-tab="${tab.id}" class="admin-tab-btn px-4 py-2.5 rounded-2xl font-headline text-xs font-black flex items-center gap-2 whitespace-nowrap transition-all ${
              isTabActive
                ? 'bg-secondary text-on-secondary chunky-btn-sm border-secondary-container shadow-sm'
                : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border border-surface-container-highest'
            }">
              <span class="material-symbols-outlined text-base">${tab.icon}</span>
              <span>${tab.label}</span>
              ${tab.count > 0 ? `<span class="bg-error text-on-error text-[10px] font-black px-1.5 py-0.2 rounded-full">${tab.count}</span>` : ''}
            </button>
          `;
          })
          .join('')}
      </div>

      <!-- TAB 1: Approval Queue & Action Inbox -->
      ${
        activeAdminTab === 'approvals'
          ? `
        <section class="flex flex-col gap-4 animate-fade-in">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 class="font-headline text-lg font-black text-inverse-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-secondary">inbox</span>
                Pending Sign-off Requests (${pending.length})
              </h2>
              <span class="text-xs font-bold text-on-surface-variant">Review task submissions & rewards</span>
            </div>

            <!-- Quick Action Toolbar -->
            <div class="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              ${
                pending.length > 0
                  ? `
                <button id="admin-approve-all-btn" class="flex-1 sm:flex-none bg-primary text-on-primary font-headline text-xs font-black px-4 py-2.5 rounded-xl border border-primary-container chunky-btn-sm active:scale-95 shadow-sm flex items-center gap-1.5 hover:brightness-110">
                  <span class="material-symbols-outlined text-base">done_all</span>
                  <span>Approve All (${pending.length})</span>
                </button>
              `
                  : ''
              }

              <button id="admin-clear-all-pending-btn" class="flex-1 sm:flex-none bg-surface-container-high hover:bg-error/20 text-error font-headline text-xs font-black px-4 py-2.5 rounded-xl border border-error/30 chunky-btn-sm active:scale-95 shadow-sm flex items-center gap-1.5" title="Clear all pending parent approval notifications off buttons">
                <span class="material-symbols-outlined text-base">cleaning_services</span>
                <span>Clear All Pending Button Notifications</span>
              </button>
            </div>
          </div>

          ${
            pending.length === 0
              ? `
            <div class="bg-surface-container rounded-3xl p-8 text-center border-2 border-surface-container-highest card-shadow flex flex-col items-center gap-3">
              <span class="material-symbols-outlined text-5xl text-primary">check_circle</span>
              <h3 class="font-headline text-lg font-black text-inverse-surface">Inbox is Clear!</h3>
              <p class="text-xs text-on-surface-variant">All completed chores have been verified and rewards signed off.</p>
              <div class="pt-2">
                <button id="admin-clear-all-pending-empty-btn" class="bg-surface-container-high hover:bg-error/20 text-error font-headline text-xs font-black px-4 py-2.5 rounded-xl border border-error/30 chunky-btn-sm active:scale-95 flex items-center gap-1.5 shadow-sm">
                  <span class="material-symbols-outlined text-base">cleaning_services</span>
                  <span>Clear All Pending Button Notifications</span>
                </button>
              </div>
            </div>
          `
              : `
            <div class="grid grid-cols-1 gap-4">
              ${pending
                .map((req) => {
                  const isTaskPointApproval = req.type === 'task_point_approval' || req.type === 'task';
                  const pointsAmount = req.pendingPoints || req.rewardPoints || 10;
                  const tokensAmount = req.tokensAwarded || req.rewardCoins || 20;

                  return `
                  <div class="bg-surface-container rounded-3xl p-5 border-2 ${isTaskPointApproval ? 'border-tertiary-container/80' : 'border-secondary-container/80'} card-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div class="flex items-center gap-3.5">
                      <div class="w-14 h-14 rounded-2xl ${isTaskPointApproval ? 'bg-tertiary-container/20 text-tertiary border-2 border-tertiary-container' : 'bg-secondary-container/20 text-secondary border-2 border-secondary-container'} flex items-center justify-center text-2xl flex-shrink-0">
                        <span class="material-symbols-outlined">${isTaskPointApproval ? 'stars' : 'card_giftcard'}</span>
                      </div>
                      <div class="flex flex-col">
                        <div class="flex items-center gap-2">
                          <span class="text-[10px] font-black uppercase text-secondary">${req.kidName}</span>
                          <span class="text-[10px] text-on-surface-variant font-bold">• ${req.date}</span>
                          <span class="text-[9px] font-black px-2 py-0.2 rounded-md ${isTaskPointApproval ? 'bg-tertiary/20 text-tertiary' : 'bg-secondary/20 text-secondary'}">
                            ${isTaskPointApproval ? 'Chore Point Request' : 'Reward Redemption'}
                          </span>
                        </div>
                        <h3 class="font-headline text-base font-black text-inverse-surface mt-0.5">${req.title}</h3>
                        
                        <div class="text-xs font-bold mt-1">
                          ${
                            isTaskPointApproval
                              ? `<span class="text-tertiary">⭐ Pending Approval: <strong>+${pointsAmount} Gold Points</strong></span> <span class="text-on-surface-variant font-medium">(Auto-issued +${tokensAmount} Tokens 🪙)</span>`
                              : `<span class="text-error">🎁 Redemption Cost: <strong>-${req.costPoints} Gold Points ⭐</strong></span>`
                          }
                        </div>
                      </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex items-center gap-2 w-full sm:w-auto">
                      <button data-reject-id="${req.id}" class="admin-reject-btn flex-1 sm:flex-none bg-surface-container-high hover:bg-error/20 text-error font-headline text-xs font-black px-4 py-3 rounded-xl border border-error/30 chunky-btn-sm active:scale-95">
                        ✕ Reject (0 Points)
                      </button>
                      
                      <button data-approve-id="${req.id}" class="admin-approve-btn flex-1 sm:flex-none ${isTaskPointApproval ? 'bg-tertiary text-on-tertiary border-tertiary-container' : 'bg-primary text-on-primary border-primary-container'} font-headline text-xs font-black px-5 py-3 rounded-xl chunky-btn shadow-sm hover:brightness-110 active:scale-95">
                        ${isTaskPointApproval ? `✓ Issue +${pointsAmount} Points ⭐` : `✓ Fulfill & Deduct (-${req.costPoints} ⭐)`}
                      </button>
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>
          `
          }
        </section>
      `
          : ''
      }

      <!-- TAB: Kids Roster & Household Management -->
      ${
        activeAdminTab === 'kids'
          ? `
        <section class="flex flex-col gap-6 animate-fade-in">
          
          <!-- Household Management Card -->
          <div class="bg-surface-container rounded-3xl p-5 sm:p-6 border-2 border-secondary-container card-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center text-2xl shadow flex-shrink-0">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">home</span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="font-headline text-lg font-black text-inverse-surface">${state.household.name}</h2>
                  <span class="bg-primary/20 text-primary text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-primary/30">Active</span>
                </div>
                <p class="text-xs text-on-surface-variant font-bold mt-0.5">
                  Sync Code: <span class="text-secondary font-black tracking-wider">${state.household.syncCode}</span> • ${state.household.linkedDevices || 1} Device(s) Linked
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button id="admin-create-household-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2.5 rounded-xl chunky-btn-sm border-secondary-container flex items-center gap-1.5 active:scale-95 hover:brightness-110 shadow-sm">
                <span class="material-symbols-outlined text-sm">add_home</span>
                Create New Household
              </button>
              <button id="admin-link-household-btn" class="bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-xs font-black px-3.5 py-2.5 rounded-xl border border-surface-container-highest flex items-center gap-1.5 active:scale-95">
                <span class="material-symbols-outlined text-sm">sync</span>
                Device Sync
              </button>
              <button id="admin-remove-test-data-btn" class="bg-surface-container-high hover:bg-error/20 hover:text-error text-on-surface-variant font-headline text-xs font-black px-3 py-2.5 rounded-xl border border-surface-container-highest flex items-center gap-1.5 active:scale-95 transition-colors" title="Remove all default test kids and start with fresh family">
                <span class="material-symbols-outlined text-sm">mop</span>
                Remove Test Kids
              </button>
            </div>
          </div>

          <!-- Kids Adventurers Roster Header -->
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 class="font-headline text-lg font-black text-inverse-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">diversity_1</span>
                Children & Adventurer Profiles (${heroes.length})
              </h2>
              <p class="text-xs text-on-surface-variant font-bold">Manage each child's name, role, avatar, learning difficulty, and reward balances.</p>
            </div>

            <button id="admin-open-add-kid-btn" class="bg-primary text-on-primary font-headline text-xs font-black px-4 py-2.5 rounded-xl chunky-btn border-primary-container flex items-center gap-1.5 active:scale-95 hover:brightness-110 shadow">
              <span class="material-symbols-outlined text-base">person_add</span>
              Add New Kid
            </button>
          </div>

          <!-- Kids Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            ${heroes.map(h => {
              const isActiveHero = state.selectedHero.id === h.id;
              const kidDiff = h.gameDifficulty || 'medium';
              return `
                <div class="bg-surface-container rounded-3xl p-5 border-2 ${isActiveHero ? 'border-primary shadow-[0_0_20px_rgba(84,233,138,0.25)] ring-2 ring-primary/40' : 'border-surface-container-highest'} card-shadow flex flex-col justify-between gap-4 transition-all">
                  
                  <!-- Top: Avatar & Info -->
                  <div class="flex items-start gap-3.5">
                    <div class="relative flex-shrink-0">
                      <div class="w-14 h-14 rounded-full overflow-hidden border-3 border-primary bg-surface-variant flex items-center justify-center shadow-inner">
                        <img class="w-full h-full object-cover" src="${h.avatar}" alt="${h.name}" />
                      </div>
                      ${isActiveHero ? `
                        <div class="absolute -bottom-1 -right-1 bg-primary text-on-primary text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full shadow">
                          Active
                        </div>
                      ` : ''}
                    </div>

                    <div class="flex flex-col flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-1">
                        <h3 class="font-headline text-base font-black text-inverse-surface truncate">${h.name}</h3>
                        <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                          kidDiff === 'easy' ? 'bg-primary/20 text-primary border border-primary/40' :
                          kidDiff === 'hard' ? 'bg-error/20 text-error border border-error/40' :
                          'bg-secondary/20 text-secondary border border-secondary/40'
                        }">
                          ${kidDiff === 'easy' ? '🟢 Toddler' : kidDiff === 'hard' ? '🔵 Hard' : '🟡 Medium'}
                        </span>
                      </div>
                      <span class="text-xs text-on-surface-variant font-bold truncate">${h.role}</span>
                      <span class="text-[10px] text-primary font-black mt-0.5">Level ${h.level} • ${h.streak || 1} Day Streak</span>
                    </div>
                  </div>

                  <!-- Middle: Coins & Points Stats -->
                  <div class="bg-surface-container-high rounded-2xl p-3 flex items-center justify-between border border-surface-container-highest text-xs font-black">
                    <div class="flex items-center gap-1.5 text-secondary">
                      <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">monetization_on</span>
                      <span>${(h.coins || 0).toLocaleString()} Tokens</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-tertiary">
                      <span class="material-symbols-outlined text-base">star</span>
                      <span>${h.points || 0} Points</span>
                    </div>
                  </div>

                  <!-- Bottom: Actions -->
                  <div class="pt-2 border-t border-surface-container-highest flex items-center justify-between gap-2">
                    ${isActiveHero ? `
                      <span class="text-primary text-xs font-black flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm">check_circle</span> Currently Playing
                      </span>
                    ` : `
                      <button data-switch-hero-id="${h.id}" class="admin-switch-hero-btn bg-surface-container-highest hover:bg-surface-bright text-inverse-surface font-headline text-[11px] font-black px-3 py-1.5 rounded-xl chunky-btn-sm active:scale-95">
                        Set Active
                      </button>
                    `}

                    <div class="flex items-center gap-1">
                      <button data-kid-id="${h.id}" class="admin-edit-kid-btn bg-surface-container-high hover:bg-surface-bright text-secondary font-headline text-xs font-black px-3 py-1.5 rounded-xl border border-surface-container-highest flex items-center gap-1 active:scale-95" title="Edit Kid Profile">
                        <span class="material-symbols-outlined text-sm">edit</span>
                        Edit
                      </button>
                      <button data-kid-id="${h.id}" class="admin-delete-kid-btn bg-surface-container-high hover:bg-error/20 text-error font-headline text-xs font-black px-2.5 py-1.5 rounded-xl border border-surface-container-highest flex items-center gap-1 active:scale-95" title="Delete Kid Profile">
                        <span class="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>

                </div>
              `;
            }).join('')}
          </div>

        </section>
      `
          : ''
      }

      <!-- TAB 3: Task & Routines Manager (With Add Task Form) -->
      ${
        activeAdminTab === 'tasks'
          ? `
        <section class="flex flex-col gap-6 animate-fade-in">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="font-headline text-lg font-black text-inverse-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">add_task</span>
                Task & Routines Manager
              </h2>
              <p class="text-xs text-on-surface-variant">Create and assign new chores, routines, and daily habits for your kids.</p>
            </div>
          </div>

          <!-- Create New Task Form Card -->
          <div class="bg-surface-container rounded-3xl p-6 border-2 border-primary-container card-shadow flex flex-col gap-4">
            <h3 class="font-headline text-base font-black text-primary flex items-center gap-2">
              <span class="material-symbols-outlined">playlist_add</span>
              Add New Task or Habit
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div class="sm:col-span-2">
                <label class="text-[10px] uppercase font-black text-on-surface-variant">Task / Routine Title</label>
                <input id="new-task-title" type="text" placeholder="e.g. Put Away Laundry & Clothes" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-inverse-surface focus:outline-none focus:border-primary" />
              </div>

              <div>
                <label class="text-[10px] uppercase font-black text-on-surface-variant">Zone Assignment</label>
                <select id="new-task-zone" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-inverse-surface focus:outline-none focus:border-primary">
                  <option value="Task Forest">Task Forest (Scheduled Chores)</option>
                  <option value="Habit Islands">Habit Islands (Daily Habits)</option>
                </select>
              </div>

              <div>
                <label class="text-[10px] uppercase font-black text-on-surface-variant">Time Window / Schedule</label>
                <input id="new-task-time" type="text" placeholder="e.g. Afternoon 4:00 PM" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-inverse-surface focus:outline-none focus:border-primary" />
              </div>

              <div>
                <label class="text-[10px] uppercase font-black text-on-surface-variant">Tokens (🪙 Auto-Issued)</label>
                <input id="new-task-tokens" type="number" value="25" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-secondary focus:outline-none focus:border-secondary" />
              </div>

              <div>
                <label class="text-[10px] uppercase font-black text-on-surface-variant">Points (⭐ Parent-Approved)</label>
                <input id="new-task-points" type="number" value="10" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-tertiary focus:outline-none focus:border-tertiary" />
              </div>

              <div class="sm:col-span-2 lg:col-span-2">
                <label class="text-[10px] uppercase font-black text-on-surface-variant">Description & Guidance</label>
                <input id="new-task-desc" type="text" placeholder="e.g. Fold shirts and put socks into drawer neatly." class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-inverse-surface focus:outline-none focus:border-primary" />
              </div>

              <div>
                <label class="text-[10px] uppercase font-black text-on-surface-variant">Icon Style</label>
                <select id="new-task-icon" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-inverse-surface focus:outline-none focus:border-primary">
                  <option value="checkroom">👕 Checkroom / Laundry</option>
                  <option value="menu_book">📚 Reading / Homework</option>
                  <option value="toys">🧸 Toys & Blocks</option>
                  <option value="park">🌳 Outdoor Play</option>
                  <option value="pets">🐶 Pet Feeding / Care</option>
                  <option value="music_note">🎵 Music / Instrument</option>
                  <option value="cleaning_services">🧹 Cleaning / Chores</option>
                </select>
              </div>
            </div>

            <button id="admin-create-task-btn" class="bg-primary text-on-primary font-headline text-xs font-black py-3.5 rounded-xl chunky-btn border-primary-container self-end px-8 mt-2 active:scale-95 hover:brightness-110">
              + Add Task to Kid Dashboard
            </button>
          </div>

          <!-- Existing Active Tasks & Chores -->
          <div class="flex flex-col gap-3">
            <h3 class="font-headline text-sm font-black text-inverse-surface">Currently Active Tasks (${habitIslands.length + taskForest.length})</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${[...habitIslands, ...taskForest]
                .map((t) => {
                  return `
                  <div class="bg-surface-container rounded-2xl p-4 border border-surface-container-highest flex items-center justify-between card-shadow">
                    <div class="flex items-center gap-3.5">
                      <div class="w-12 h-12 rounded-full bg-surface-container-high text-primary flex items-center justify-center text-2xl overflow-hidden p-1 border-2 border-primary/40 shadow-sm flex-shrink-0">
                        ${t.image ? `<img src="${t.image}" class="w-full h-full object-contain rounded-full" />` : getTaskVisualSvg(t.icon || t.id, 'blue')}
                      </div>
                      <div class="flex flex-col">
                        <span class="text-xs font-black text-inverse-surface">${t.title}</span>
                        <span class="text-[10px] text-on-surface-variant font-bold">${t.zone} • ${t.timeWindow || 'All Day'}</span>
                        <div class="flex items-center gap-2 text-[11px] font-black mt-0.5">
                          <span class="text-secondary">+${t.coins} 🪙</span>
                          <span class="text-tertiary">+${t.points} ⭐</span>
                        </div>
                      </div>
                    </div>

                    <button data-delete-task-id="${t.id}" data-delete-task-zone="${t.zone}" class="admin-delete-task-btn text-on-surface-variant hover:text-error p-2 rounded-xl border border-transparent hover:border-error/30 transition-colors">
                      <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                `;
                })
                .join('')}
            </div>
          </div>
        </section>
      `
          : ''
      }

      <!-- TAB 3: Real-Life Rewards Manager (With Working Add-To-Shop) -->
      ${
        activeAdminTab === 'rewards'
          ? `
        <section class="flex flex-col gap-6 animate-fade-in">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="font-headline text-lg font-black text-inverse-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-tertiary">card_giftcard</span>
                Real-Life Reward Privileges
              </h2>
              <p class="text-xs text-on-surface-variant">Create tangible real-world privileges that require Points (⭐) and your sign-off to redeem.</p>
            </div>
          </div>

          <!-- Create Custom Real-Life Reward Card -->
          <div class="bg-surface-container rounded-3xl p-6 border-2 border-tertiary-container card-shadow flex flex-col gap-4">
            <h3 class="font-headline text-base font-black text-tertiary flex items-center gap-2">
              <span class="material-symbols-outlined">add_circle</span>
              Add New Real-Life Privilege to Shop
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label class="text-[10px] uppercase font-black text-on-surface-variant">Reward Title</label>
                <input id="new-reward-title" type="text" placeholder="e.g. 1 Hour Trampoline Park" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-inverse-surface focus:outline-none focus:border-tertiary" />
              </div>

              <div>
                <label class="text-[10px] uppercase font-black text-on-surface-variant">Gold Points Cost (⭐)</label>
                <input id="new-reward-cost" type="number" placeholder="60" value="60" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-tertiary focus:outline-none focus:border-tertiary" />
              </div>

              <div>
                <label class="text-[10px] uppercase font-black text-on-surface-variant">Category</label>
                <select id="new-reward-category" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-inverse-surface focus:outline-none focus:border-tertiary">
                  <option value="Experience">Experience</option>
                  <option value="Outing">Outing</option>
                  <option value="Treat">Treat / Food</option>
                  <option value="Privilege">Privilege / Bedtime</option>
                </select>
              </div>

              <div class="sm:col-span-2">
                <label class="text-[10px] uppercase font-black text-on-surface-variant">Description & Terms</label>
                <input id="new-reward-desc" type="text" placeholder="e.g. Visit the local trampoline park on Saturday afternoon." class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-inverse-surface focus:outline-none focus:border-tertiary" />
              </div>

              <div>
                <label class="text-[10px] uppercase font-black text-on-surface-variant">3D Graphic Motif</label>
                <select id="new-reward-icon" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-inverse-surface focus:outline-none focus:border-tertiary">
                  <option value="park">🌳 Park / Adventure</option>
                  <option value="icecream">🍦 Ice Cream / Treat</option>
                  <option value="tv">🎮 Screen Time / Gaming</option>
                  <option value="movie">🍿 Movie Night</option>
                  <option value="hotel">🌙 Late Bedtime</option>
                  <option value="local_pizza">🍕 Pizza Night</option>
                  <option value="stars">⭐ Special Privilege</option>
                </select>
              </div>
            </div>

            <button id="admin-create-reward-btn" class="bg-tertiary text-on-tertiary font-headline text-xs font-black py-3.5 rounded-xl chunky-btn border-tertiary-container self-end px-8 mt-2 active:scale-95 hover:brightness-110">
              + Publish to Hero Shop
            </button>
          </div>

          <!-- Existing Real-Life Rewards List -->
          <div class="flex flex-col gap-3">
            <h3 class="font-headline text-sm font-black text-inverse-surface">Live Real-Life Rewards in Shop (${realLifeRewards.length})</h3>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              ${realLifeRewards
                .map((r) => {
                  return `
                  <div class="bg-surface-container rounded-2xl p-4 border border-surface-container-highest flex items-center justify-between card-shadow">
                    <div class="flex items-center gap-3.5">
                      <div class="w-12 h-12 rounded-xl bg-surface-container-high text-tertiary flex items-center justify-center text-2xl overflow-hidden p-1 border border-surface-container-highest">
                        ${r.image ? `<img src="${r.image}" class="w-full h-full object-contain" />` : `<span class="material-symbols-outlined">${r.icon}</span>`}
                      </div>
                      <div class="flex flex-col">
                        <span class="text-xs font-black text-inverse-surface">${r.title}</span>
                        <span class="text-[10px] text-on-surface-variant font-bold">${r.desc}</span>
                        <span class="text-xs font-black text-tertiary mt-0.5">${r.costPoints} Gold Points ⭐</span>
                      </div>
                    </div>

                    <button data-delete-reward-id="${r.id}" class="admin-delete-reward-btn text-on-surface-variant hover:text-error p-2 rounded-xl border border-transparent hover:border-error/30 transition-colors">
                      <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                `;
                })
                .join('')}
            </div>
          </div>
        </section>
      `
          : ''
      }

      <!-- TAB 4: Shop Pricing & Cost Editor for ALL Items -->
      ${
        activeAdminTab === 'pricing'
          ? `
        <section class="flex flex-col gap-6 animate-fade-in">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="font-headline text-lg font-black text-inverse-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-secondary">payments</span>
                Shop Pricing & Cost Editor
              </h2>
              <p class="text-xs text-on-surface-variant">Adjust prices for every Real-Life reward (Points ⭐) and Digital Goodie (Tokens 🪙).</p>
            </div>
            
            <button id="admin-save-pricing-btn" class="bg-primary text-on-primary font-headline text-xs font-black px-6 py-3 rounded-xl chunky-btn border-primary-container shadow-md active:scale-95 hover:brightness-110">
              💾 Save All Pricing
            </button>
          </div>

          <!-- Section 1: Real-Life Rewards Pricing (Points ⭐) -->
          <div class="bg-surface-container rounded-3xl p-5 border-2 border-tertiary-container/60 card-shadow flex flex-col gap-4">
            <h3 class="font-headline text-sm font-black text-tertiary flex items-center gap-2">
              <span class="material-symbols-outlined">star</span>
              Real-Life Privileges Pricing (Cost in Gold Points ⭐)
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              ${realLifeRewards
                .map(
                  (r) => `
                <div class="bg-surface-container-high rounded-xl p-3 border border-surface-container-highest flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2 truncate">
                    <span class="text-xs font-bold text-inverse-surface truncate">${r.title}</span>
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <input type="number" data-pricing-reallife-id="${r.id}" value="${r.costPoints}" class="w-16 bg-surface-container-lowest border border-tertiary/40 rounded-lg p-1.5 text-xs font-black text-tertiary text-center" />
                    <span class="text-xs text-tertiary font-bold">⭐</span>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- Section 2: Digital Goods Pricing & Stat Bonus Multipliers (Tokens 🪙) -->
          <div class="bg-surface-container rounded-3xl p-5 border-2 border-secondary-container/60 card-shadow flex flex-col gap-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 class="font-headline text-sm font-black text-secondary flex items-center gap-2">
                  <span class="material-symbols-outlined">monetization_on</span>
                  Digital Goodies & Gear (Pricing & Stat Bonus Multipliers)
                </h3>
                <p class="text-[11px] text-on-surface-variant font-bold">Configure token prices and stat bonus percentages for each digital gear item.</p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              ${digitalGear
                .map(
                  (g) => {
                    const bonusPercent = g.statBonusPercent !== undefined ? g.statBonusPercent : 15;
                    const bonusType = g.statBonusType || 'coin_boost';

                    return `
                <div class="bg-surface-container-high rounded-2xl p-4 border border-surface-container-highest flex flex-col justify-between gap-3 shadow-sm">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex flex-col truncate">
                      <span class="font-headline text-xs font-black text-inverse-surface truncate">${g.title}</span>
                      <span class="text-[10px] text-on-surface-variant line-clamp-1">${g.desc}</span>
                    </div>
                    <span class="text-[9px] font-black uppercase text-secondary bg-secondary/15 px-2 py-0.5 rounded-md flex-shrink-0">${g.category || 'Gear'}</span>
                  </div>

                  <!-- Price & Stat Bonus Settings -->
                  <div class="grid grid-cols-2 gap-2 pt-2 border-t border-surface-container-highest/60">
                    <!-- Price Input -->
                    <div class="flex flex-col gap-1">
                      <label class="text-[9px] font-black uppercase text-on-surface-variant">Price (🪙 Tokens)</label>
                      <div class="flex items-center gap-1">
                        <input type="number" data-pricing-digital-id="${g.id}" value="${g.costCoins}" min="1" max="5000" class="w-full bg-surface-container-lowest border border-secondary/40 rounded-lg p-1.5 text-xs font-black text-secondary text-center focus:border-secondary focus:outline-none" />
                        <span class="text-xs text-secondary font-bold">🪙</span>
                      </div>
                    </div>

                    <!-- Stat Bonus Percentage Input -->
                    <div class="flex flex-col gap-1">
                      <label class="text-[9px] font-black uppercase text-on-surface-variant">Stat Bonus (%)</label>
                      <div class="flex items-center gap-1">
                        <input type="number" data-statbonus-digital-id="${g.id}" value="${bonusPercent}" min="0" max="200" step="5" class="w-full bg-surface-container-lowest border border-tertiary/40 rounded-lg p-1.5 text-xs font-black text-tertiary text-center focus:border-tertiary focus:outline-none" />
                        <span class="text-xs text-tertiary font-bold">%</span>
                      </div>
                    </div>
                  </div>

                  <!-- Stat Boost Type Selector -->
                  <div class="flex flex-col gap-1">
                    <label class="text-[9px] font-black uppercase text-on-surface-variant">Bonus Benefit</label>
                    <select data-statbonus-type-id="${g.id}" class="w-full bg-surface-container-lowest border border-surface-container-highest rounded-lg p-1.5 text-[10px] font-bold text-inverse-surface focus:outline-none">
                      <option value="coin_boost" ${bonusType === 'coin_boost' ? 'selected' : ''}>🪙 Extra Token Drops</option>
                      <option value="xp_boost" ${bonusType === 'xp_boost' ? 'selected' : ''}>⭐ Adventure XP Multiplier</option>
                      <option value="defense_boost" ${bonusType === 'defense_boost' ? 'selected' : ''}>🛡️ Defense & Armor</option>
                      <option value="damage_boost" ${bonusType === 'damage_boost' ? 'selected' : ''}>⚔️ AR Toothbrush Damage</option>
                      <option value="speed_boost" ${bonusType === 'speed_boost' ? 'selected' : ''}>⚡ Quest Speed Haste</option>
                      <option value="joy_boost" ${bonusType === 'joy_boost' ? 'selected' : ''}>❤️ Happiness & Joy</option>
                      <option value="energy_boost" ${bonusType === 'energy_boost' ? 'selected' : ''}>🔋 Energy Regeneration</option>
                      <option value="hygiene_boost" ${bonusType === 'hygiene_boost' ? 'selected' : ''}>🫧 Cleanliness Recovery</option>
                    </select>
                  </div>

                </div>
              `;
                  }
                )
                .join('')}
            </div>
          </div>

          <!-- Section 3: Profile Themes Pricing (Tokens 🪙) -->
          <div class="bg-surface-container rounded-3xl p-5 border-2 border-primary/40 card-shadow flex flex-col gap-4">
            <h3 class="font-headline text-sm font-black text-primary flex items-center gap-2">
              <span class="material-symbols-outlined">palette</span>
              Kids Profile Themes Pricing (Cost in Habit Tokens 🪙)
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              ${(state.profileThemes || [])
                .map(
                  (t) => `
                <div class="bg-surface-container-high rounded-xl p-3 border border-surface-container-highest flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2 truncate">
                    <span class="material-symbols-outlined text-sm" style="color: ${t.primaryColor}">${t.badgeIcon}</span>
                    <span class="text-xs font-bold text-inverse-surface truncate">${t.name}</span>
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <input type="number" data-pricing-theme-id="${t.id}" value="${t.costCoins}" class="w-20 bg-surface-container-lowest border border-primary/40 rounded-lg p-1.5 text-xs font-black text-secondary text-center" />
                    <span class="text-xs text-secondary font-bold">🪙</span>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        </section>
      `
          : ''
      }

      <!-- TAB 5: AI Reward Studio with 3D Graphic Generator -->
      ${
        activeAdminTab === 'studio'
          ? `
        <section class="flex flex-col gap-5 animate-fade-in">
          <div class="bg-surface-container rounded-3xl p-6 border-2 border-secondary-container card-shadow flex flex-col gap-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center text-2xl shadow">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
              </div>
              <div>
                <h3 class="font-headline text-lg font-black text-inverse-surface">AI Reward Generator Studio</h3>
                <p class="text-xs text-on-surface-variant">Generate customized 3D items, weapons, and accessories live into the Hero Shop!</p>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label class="text-[10px] font-black uppercase text-on-surface-variant">Item Name</label>
                <input id="ai-asset-name" type="text" placeholder="e.g. Cyber Lightning Jetpack" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-inverse-surface focus:outline-none focus:border-secondary" />
              </div>
              
              <div>
                <label class="text-[10px] font-black uppercase text-on-surface-variant">Category</label>
                <select id="ai-asset-type" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-inverse-surface focus:outline-none focus:border-secondary">
                  <option value="gear">🛡️ Avatar & Pet Gear</option>
                  <option value="weapon">⚔️ Weapons</option>
                  <option value="badge">🏆 Badges & Trophies</option>
                  <option value="snack">🫐 Pet Snacks</option>
                  <option value="theme">🎨 Kids Profile Theme</option>
                </select>
              </div>

              <div class="sm:col-span-2">
                <label class="text-[10px] font-black uppercase text-on-surface-variant">Description & Lore</label>
                <input id="ai-asset-desc" type="text" placeholder="e.g. Emits electric sparks and doubles speed in learning adventures." class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-inverse-surface focus:outline-none focus:border-secondary" />
              </div>

              <div>
                <label class="text-[10px] font-black uppercase text-on-surface-variant">Habit Tokens Price (🪙)</label>
                <input id="ai-asset-price" type="number" placeholder="200" value="200" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-3 text-xs font-bold text-secondary focus:outline-none focus:border-secondary" />
              </div>
            </div>

            <button id="ai-generate-submit-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black py-3.5 rounded-xl chunky-btn border-secondary-container self-end px-8 mt-2 active:scale-95 hover:brightness-110 flex items-center gap-2">
              <span class="material-symbols-outlined text-base">auto_awesome</span>
              ✨ Generate Graphic & Publish to Shop
            </button>
          </div>
        </section>
      `
          : ''
      }

      <!-- TAB 6: Analytics & Ledger -->
      ${
        activeAdminTab === 'analytics'
          ? `
        <section class="flex flex-col gap-5 animate-fade-in">
          <h2 class="font-headline text-lg font-black text-inverse-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary">monitoring</span>
            Sibling Consistency & Activity Ledger
          </h2>

          <!-- Multi-Kid Performance Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            ${heroes
              .map((h) => {
                return `
                <div class="bg-surface-container rounded-3xl p-4 border-2 border-surface-container-highest card-shadow flex flex-col items-center text-center gap-2">
                  <img class="w-14 h-14 rounded-full border-2 border-primary object-cover" src="${h.avatar}" alt="${h.name}" />
                  <span class="font-headline text-base font-black text-inverse-surface">${h.name}</span>
                  <span class="text-[10px] font-black text-secondary bg-surface-container-high px-2 py-0.5 rounded-full">${h.role}</span>
                  
                  <div class="w-full grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-surface-container-highest text-xs font-black">
                    <div class="flex flex-col">
                      <span class="text-[9px] text-on-surface-variant uppercase">Points ⭐</span>
                      <span class="text-tertiary">${h.points}</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[9px] text-on-surface-variant uppercase">Tokens 🪙</span>
                      <span class="text-secondary">${h.coins}</span>
                    </div>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>

          <!-- Activity Ledger Log Table -->
          <div class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col gap-3">
            <h3 class="font-headline text-sm font-black text-inverse-surface">Verified Transaction History</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs font-bold">
                <thead>
                  <tr class="border-b border-surface-container-highest text-on-surface-variant text-[10px] uppercase">
                    <th class="py-2">Time</th>
                    <th class="py-2">Hero</th>
                    <th class="py-2">Action</th>
                    <th class="py-2 text-right">Value / Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-surface-container-highest/40">
                  ${logs
                    .map(
                      (log) => `
                    <tr class="hover:bg-surface-container-high/40 transition-colors">
                      <td class="py-2 text-on-surface-variant font-medium">${log.time}</td>
                      <td class="py-2 text-primary font-black">${log.kid}</td>
                      <td class="py-2 text-inverse-surface font-semibold">${log.action}</td>
                      <td class="py-2 text-right font-black ${log.payout?.includes('Points ⭐') ? 'text-tertiary' : 'text-secondary'}">${log.payout || log.status}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      `
          : ''
      }

      <!-- TAB 7: Sliders & Settings -->
      ${
        activeAdminTab === 'settings'
          ? `
        <section class="flex flex-col gap-6 animate-fade-in">
          
          <!-- Mini Games Difficulty Configuration Individually for Each Kid -->
          <div class="bg-surface-container rounded-3xl p-6 border-2 border-secondary-container card-shadow flex flex-col gap-5">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center text-2xl shadow">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">psychology</span>
              </div>
              <div>
                <h3 class="font-headline text-base sm:text-lg font-black text-inverse-surface">Mini Games Difficulty Levels (Configured Per Kid)</h3>
                <p class="text-xs text-on-surface-variant font-bold">Select individual learning levels for each child across all 6 Quest Map mini-games.</p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${heroes.map((h) => {
                const currentDiff = h.gameDifficulty || 'medium';
                return `
                  <div class="bg-surface-container-high rounded-2xl p-4 border-2 border-surface-container-highest flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2.5">
                        <img src="${h.avatar}" class="w-10 h-10 rounded-full border-2 border-primary object-cover" />
                        <div class="flex flex-col">
                          <span class="font-headline text-sm font-black text-inverse-surface">${h.name}</span>
                          <span class="text-[10px] text-on-surface-variant font-bold">${h.role}</span>
                        </div>
                      </div>
                      <span class="text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                        currentDiff === 'easy' ? 'bg-primary/20 text-primary border border-primary/40' :
                        currentDiff === 'hard' ? 'bg-error/20 text-error border border-error/40' :
                        'bg-secondary/20 text-secondary border border-secondary/40'
                      }">
                        ${currentDiff === 'easy' ? '🟢 Easy (Toddler 3-4)' : currentDiff === 'hard' ? '🔵 Hard (Kids 7-9)' : '🟡 Medium (Kids 5-6)'}
                      </span>
                    </div>

                    <!-- 3 Difficulty Toggle Buttons for this Child -->
                    <div class="grid grid-cols-3 gap-2 text-center">
                      <button data-kid-id="${h.id}" data-diff-level="easy" class="kid-diff-btn rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 border-2 transition-all ${
                        currentDiff === 'easy' ? 'bg-primary text-on-primary border-primary-container shadow-sm font-black' : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border-surface-container-highest'
                      }">
                        <span class="text-xs font-headline font-black">Easy</span>
                        <span class="text-[9px] leading-tight ${currentDiff === 'easy' ? 'text-on-primary/90' : 'text-on-surface-variant'}">Age 3–4 (Voice Prompts)</span>
                      </button>

                      <button data-kid-id="${h.id}" data-diff-level="medium" class="kid-diff-btn rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 border-2 transition-all ${
                        currentDiff === 'medium' ? 'bg-secondary text-on-secondary border-secondary-container shadow-sm font-black' : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border-surface-container-highest'
                      }">
                        <span class="text-xs font-headline font-black">Medium</span>
                        <span class="text-[9px] leading-tight ${currentDiff === 'medium' ? 'text-on-secondary/90' : 'text-on-surface-variant'}">Age 5–6 (Reading)</span>
                      </button>

                      <button data-kid-id="${h.id}" data-diff-level="hard" class="kid-diff-btn rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 border-2 transition-all ${
                        currentDiff === 'hard' ? 'bg-error text-on-error border-error-container shadow-sm font-black' : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border-surface-container-highest'
                      }">
                        <span class="text-xs font-headline font-black">Hard</span>
                        <span class="text-[9px] leading-tight ${currentDiff === 'hard' ? 'text-on-error/90' : 'text-on-surface-variant'}">Age 7–9 (Advanced)</span>
                      </button>
                    </div>

                    <div class="flex items-center justify-between pt-2 border-t border-surface-container-highest">
                      <p class="text-[10px] text-on-surface-variant italic">
                        ${currentDiff === 'easy' ? '✨ Realistic toddler voice narration.' : currentDiff === 'hard' ? '🧠 Advanced math & logic.' : '📚 Phonics & counting.'}
                      </p>
                      <div class="flex items-center gap-1">
                        <button data-kid-id="${h.id}" class="admin-edit-kid-btn bg-surface-container hover:bg-surface-bright text-secondary font-headline text-[10px] font-black px-2.5 py-1 rounded-lg border border-surface-container-highest flex items-center gap-1 active:scale-95" title="Edit Kid Profile">
                          <span class="material-symbols-outlined text-xs">edit</span> Edit
                        </button>
                        <button data-kid-id="${h.id}" class="admin-delete-kid-btn bg-surface-container hover:bg-error/20 text-error font-headline text-[10px] font-black px-2 py-1 rounded-lg border border-surface-container-highest flex items-center gap-1 active:scale-95" title="Delete Kid Profile">
                          <span class="material-symbols-outlined text-xs">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Toothbrush AR Battle Duration Slider -->
          <div class="bg-surface-container rounded-3xl p-6 border-2 border-surface-container-highest card-shadow flex flex-col gap-5">
            <h3 class="font-headline text-base font-black text-inverse-surface">Toothbrush AR Battle Duration Slider</h3>
            
            <div class="flex gap-3">
              <button data-duration="60" class="ar-duration-btn flex-1 py-3 rounded-xl font-headline text-xs font-black ${
                settings.arBattleDuration === 60 ? 'bg-primary text-on-primary chunky-btn-sm' : 'bg-surface-container-high text-on-surface-variant'
              }">1 Minute</button>
              <button data-duration="120" class="ar-duration-btn flex-1 py-3 rounded-xl font-headline text-xs font-black ${
                settings.arBattleDuration === 120 ? 'bg-primary text-on-primary chunky-btn-sm' : 'bg-surface-container-high text-on-surface-variant'
              }">2 Minutes (Recommended)</button>
              <button data-duration="180" class="ar-duration-btn flex-1 py-3 rounded-xl font-headline text-xs font-black ${
                settings.arBattleDuration === 180 ? 'bg-primary text-on-primary chunky-btn-sm' : 'bg-surface-container-high text-on-surface-variant'
              }">3 Minutes</button>
            </div>
          </div>

          <!-- Parental Security & Biometric Locking Settings -->
          <div class="bg-surface-container rounded-3xl p-6 border-2 border-secondary-container card-shadow flex flex-col gap-5">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-secondary/20 text-secondary border border-secondary/40 flex items-center justify-center text-2xl shadow-sm">
                  <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">security</span>
                </div>
                <div>
                  <h3 class="font-headline text-base sm:text-lg font-black text-inverse-surface">Parent Dashboard Security & Lock Settings</h3>
                  <p class="text-xs text-on-surface-variant font-bold">Turn on or off each of the 3 security gates to choose how you want to unlock adult access.</p>
                </div>
              </div>

              <!-- Quick Status Badge -->
              <span class="text-[10px] font-black uppercase px-3 py-1.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30 flex items-center gap-1.5 shadow-sm">
                <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                ${[settings.biometricsEnabled !== false ? 'Biometrics' : '', settings.pinLockEnabled !== false ? 'PIN' : '', settings.mathChallengeEnabled !== false ? 'Math' : ''].filter(Boolean).length} of 3 Gates Active
              </span>
            </div>

            <!-- 3 Lock Options Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <!-- OPTION 1: Biometric Authentication (Touch ID / Face ID / Windows Hello) -->
              <div class="bg-surface-container-high rounded-2xl p-4.5 border-2 ${
                settings.biometricsEnabled !== false
                  ? 'border-primary/60 bg-primary/5 shadow-sm'
                  : 'border-surface-container-highest opacity-70'
              } flex flex-col justify-between gap-4 transition-all">
                <div class="flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="font-headline text-sm font-black text-inverse-surface flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-base text-primary">fingerprint</span>
                      Biometric Gate
                    </span>
                    
                    <!-- Toggle Button -->
                    <button data-lock-toggle="biometrics" class="lock-option-toggle-btn px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all chunky-btn-sm ${
                      settings.biometricsEnabled !== false
                        ? 'bg-primary text-on-primary border-primary-container shadow-sm'
                        : 'bg-surface-container-lowest text-on-surface-variant border-surface-container'
                    }">
                      ${settings.biometricsEnabled !== false ? '✓ Active' : 'Off'}
                    </button>
                  </div>
                  <p class="text-xs text-on-surface-variant">Instant unlock via Touch ID, Face ID, fingerprint, or Windows Hello.</p>
                </div>

                <div class="flex flex-col gap-2 pt-2 border-t border-surface-container-highest/60">
                  <button id="test-biometric-btn" ${settings.biometricsEnabled === false ? 'disabled' : ''} class="w-full ${
                    settings.biometricsEnabled !== false
                      ? 'bg-primary/20 hover:bg-primary/30 text-primary border-primary/40 active:scale-95'
                      : 'bg-surface-container-lowest text-on-surface-variant/40 border-transparent cursor-not-allowed'
                  } font-headline text-xs font-black py-2.5 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-all">
                    <span class="material-symbols-outlined text-sm">fingerprint</span>
                    Register / Test Sensor
                  </button>
                  <span id="biometric-test-feedback" class="text-[9px] font-bold text-on-surface-variant text-center">Compatible with platform biometrics</span>
                </div>
              </div>

              <!-- OPTION 2: 4-Digit Security PIN -->
              <div class="bg-surface-container-high rounded-2xl p-4.5 border-2 ${
                settings.pinLockEnabled !== false
                  ? 'border-secondary/60 bg-secondary/5 shadow-sm'
                  : 'border-surface-container-highest opacity-70'
              } flex flex-col justify-between gap-4 transition-all">
                <div class="flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="font-headline text-sm font-black text-inverse-surface flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-base text-secondary">pin</span>
                      4-Digit PIN Gate
                    </span>
                    
                    <!-- Toggle Button -->
                    <button data-lock-toggle="pin" class="lock-option-toggle-btn px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all chunky-btn-sm ${
                      settings.pinLockEnabled !== false
                        ? 'bg-secondary text-on-secondary border-secondary-container shadow-sm'
                        : 'bg-surface-container-lowest text-on-surface-variant border-surface-container'
                    }">
                      ${settings.pinLockEnabled !== false ? '✓ Active' : 'Off'}
                    </button>
                  </div>
                  <p class="text-xs text-on-surface-variant">Require entering your custom secret PIN code to unlock adult dashboard.</p>
                </div>

                <div class="flex flex-col gap-2 pt-2 border-t border-surface-container-highest/60">
                  <div class="flex items-center gap-2">
                    <input type="text" id="parent-setting-pin-input" maxlength="8" value="${settings.pin || '1234'}" ${settings.pinLockEnabled === false ? 'disabled' : ''} class="w-full bg-surface-container border-2 border-surface-container-highest rounded-xl px-3 py-2 text-sm font-headline font-black text-secondary tracking-widest text-center focus:border-secondary focus:outline-none ${settings.pinLockEnabled === false ? 'opacity-50 cursor-not-allowed' : ''}" />
                    <button id="save-parent-pin-btn" ${settings.pinLockEnabled === false ? 'disabled' : ''} class="${
                      settings.pinLockEnabled !== false
                        ? 'bg-secondary text-on-secondary border-secondary-container active:scale-95'
                        : 'bg-surface-container-lowest text-on-surface-variant/40 border-transparent cursor-not-allowed'
                    } font-headline text-xs font-black px-3.5 py-2 rounded-xl chunky-btn-sm whitespace-nowrap">
                      Save PIN
                    </button>
                  </div>
                  <span id="pin-save-feedback" class="text-[9px] font-bold text-primary text-center hidden">✓ PIN updated!</span>
                </div>
              </div>

              <!-- OPTION 3: Adult Math Challenge -->
              <div class="bg-surface-container-high rounded-2xl p-4.5 border-2 ${
                settings.mathChallengeEnabled !== false
                  ? 'border-tertiary/60 bg-tertiary/5 shadow-sm'
                  : 'border-surface-container-highest opacity-70'
              } flex flex-col justify-between gap-4 transition-all">
                <div class="flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="font-headline text-sm font-black text-inverse-surface flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-base text-tertiary">calculate</span>
                      Math Challenge
                    </span>
                    
                    <!-- Toggle Button -->
                    <button data-lock-toggle="math" class="lock-option-toggle-btn px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all chunky-btn-sm ${
                      settings.mathChallengeEnabled !== false
                        ? 'bg-tertiary text-on-tertiary border-tertiary-container shadow-sm'
                        : 'bg-surface-container-lowest text-on-surface-variant border-surface-container'
                    }">
                      ${settings.mathChallengeEnabled !== false ? '✓ Active' : 'Off'}
                    </button>
                  </div>
                  <p class="text-xs text-on-surface-variant">Adult verification via randomized 2-digit multiplication or algebra equation.</p>
                </div>

                <div class="flex flex-col gap-1.5 pt-2 border-t border-surface-container-highest/60">
                  <div class="bg-surface-container p-2.5 rounded-xl border border-surface-container-highest text-center flex items-center justify-center gap-1.5">
                    <span class="material-symbols-outlined text-xs text-tertiary">psychology</span>
                    <span class="text-xs font-black text-tertiary">e.g. Solve: 8 × 9 = ?</span>
                  </div>
                  <span class="text-[9px] font-bold text-on-surface-variant text-center">Prevents younger kids from altering settings</span>
                </div>
              </div>

            </div>
          </div>

          <!-- Task & Button Diagnostics & Clearing Stuck Approvals -->
          <div class="bg-surface-container rounded-3xl p-6 border-2 border-secondary-container card-shadow flex flex-col gap-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center text-2xl shadow">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">cleaning_services</span>
              </div>
              <div>
                <h3 class="font-headline text-base sm:text-lg font-black text-inverse-surface">Task & Habit Button Reset Controls</h3>
                <p class="text-xs text-on-surface-variant font-bold">Clear all pending parent approval notifications off buttons if they ever get stuck showing.</p>
              </div>
            </div>

            <div class="bg-surface-container-high rounded-2xl p-4 border border-surface-container-highest flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 class="font-headline text-sm font-black text-inverse-surface">Clear Stuck Pending Approvals</h4>
                <p class="text-xs text-on-surface-variant font-medium">Instantly clears all pending approval badges off buttons and returns all habits and chores to ready status across all child accounts.</p>
              </div>
              <button id="admin-settings-clear-pending-btn" class="bg-error text-on-error font-headline text-xs font-black px-4 py-3 rounded-xl chunky-btn-sm active:scale-95 whitespace-nowrap shadow-sm flex items-center gap-1.5 hover:brightness-110">
                <span class="material-symbols-outlined text-base">mop</span>
                <span>Clear All Pending Approvals</span>
              </button>
            </div>
          </div>

        </section>
      `
          : ''
      }

      <!-- Modals for Kids & Household Management -->
      ${renderAddKidModal()}
      ${renderEditKidModal()}
      ${renderDeleteKidModal()}
      ${renderNewHouseholdModal()}

    </div>
  `;
}

function renderAddKidModal() {
  if (!isAddKidModalOpen) return '';
  return `
    <div id="add-kid-modal-backdrop" class="fixed inset-0 bg-[#09141e]/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div class="bg-surface-container border-4 border-primary rounded-4xl p-6 max-w-lg w-full card-shadow-lg flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        
        <div class="flex justify-between items-center border-b-2 border-surface-container-highest pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-2xl">person_add</span>
            <h2 class="font-headline text-xl font-black text-inverse-surface">Add New Adventurer</h2>
          </div>
          <button id="add-kid-modal-close-btn" class="text-on-surface-variant hover:text-error text-2xl p-1">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Child's Name</label>
            <input type="text" id="new-kid-name" placeholder="e.g. Liam, Leo, Noah" class="w-full bg-surface-container-high border-2 border-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold text-inverse-surface focus:border-primary focus:outline-none" />
          </div>

          <div>
            <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Adventurer Title / Role</label>
            <input type="text" id="new-kid-role" placeholder="e.g. Dragon Explorer, Cyber Knight" value="Dragon Explorer" class="w-full bg-surface-container-high border-2 border-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold text-inverse-surface focus:border-primary focus:outline-none" />
          </div>

          <!-- Photo Upload Option -->
          <div class="flex items-center gap-3 p-3 bg-surface-container-high rounded-2xl border-2 border-surface-container-highest">
            <div class="w-14 h-14 rounded-full border-2 border-primary overflow-hidden flex-shrink-0 bg-surface-variant relative shadow-inner">
              <img id="new-kid-avatar-preview" src="${selectedAvatarUrl}" class="w-full h-full object-cover" />
            </div>
            <div class="flex flex-col flex-1 min-w-0">
              <span class="text-xs font-headline font-black text-inverse-surface">Upload Child's Photo</span>
              <span class="text-[10px] text-on-surface-variant font-bold">Upload a photo or pick an avatar below</span>
            </div>
            <label for="new-kid-photo-input" class="bg-primary text-on-primary font-headline text-xs font-black px-3.5 py-2.5 rounded-xl chunky-btn-sm border-primary-container cursor-pointer hover:brightness-110 active:scale-95 flex items-center gap-1.5 shadow-sm">
              <span class="material-symbols-outlined text-sm">photo_camera</span>
              Upload
            </label>
            <input type="file" id="new-kid-photo-input" accept="image/*" class="hidden" />
          </div>

          <div>
            <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Or Select 3D Preset Avatar</label>
            <div class="grid grid-cols-4 gap-2.5">
              ${KID_AVATARS.map((av) => `
                <button type="button" data-avatar-url="${av.url}" class="new-kid-avatar-choice rounded-2xl p-1.5 border-3 transition-all flex flex-col items-center gap-1 ${selectedAvatarUrl === av.url ? 'border-primary bg-primary/20 scale-102 ring-2 ring-primary' : 'border-surface-container-highest bg-surface-container-high hover:border-primary/50'}">
                  <img src="${av.url}" class="w-12 h-12 rounded-full object-cover" />
                  <span class="text-[9px] font-bold text-white truncate w-full text-center">${av.label}</span>
                </button>
              `).join('')}
            </div>
            <input type="hidden" id="new-kid-avatar-val" value="${selectedAvatarUrl}" />
          </div>

          <div>
            <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Learning Difficulty Level (Quest Map Games)</label>
            <div class="grid grid-cols-3 gap-2">
              <label class="flex flex-col items-center justify-center p-2.5 rounded-xl border-2 border-surface-container-highest bg-surface-container-high cursor-pointer text-center new-diff-choice-label hover:border-primary/60">
                <input type="radio" name="new-kid-diff" value="easy" class="hidden" />
                <span class="text-xs font-black text-primary">🟢 Easy</span>
                <span class="text-[9px] text-on-surface-variant font-bold">Age 3–4 (Voice)</span>
              </label>
              <label class="flex flex-col items-center justify-center p-2.5 rounded-xl border-2 border-secondary bg-secondary/15 cursor-pointer text-center new-diff-choice-label">
                <input type="radio" name="new-kid-diff" value="medium" class="hidden" checked />
                <span class="text-xs font-black text-secondary">🟡 Medium</span>
                <span class="text-[9px] text-on-surface-variant font-bold">Age 5–6 (Reading)</span>
              </label>
              <label class="flex flex-col items-center justify-center p-2.5 rounded-xl border-2 border-surface-container-highest bg-surface-container-high cursor-pointer text-center new-diff-choice-label hover:border-error/60">
                <input type="radio" name="new-kid-diff" value="hard" class="hidden" />
                <span class="text-xs font-black text-error">🔵 Hard</span>
                <span class="text-[9px] text-on-surface-variant font-bold">Age 7–9 (Math)</span>
              </label>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Starting Tokens 🪙</label>
              <input type="number" id="new-kid-coins" value="50" min="0" class="w-full bg-surface-container-high border-2 border-surface-container-highest rounded-xl px-4 py-2.5 text-sm font-bold text-secondary focus:border-secondary focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Starting Points ⭐</label>
              <input type="number" id="new-kid-points" value="0" min="0" class="w-full bg-surface-container-high border-2 border-surface-container-highest rounded-xl px-4 py-2.5 text-sm font-bold text-tertiary focus:border-tertiary focus:outline-none" />
            </div>
          </div>
        </div>

        <div class="flex gap-2.5 pt-3 border-t border-surface-container-highest">
          <button id="add-kid-cancel-btn" class="flex-1 bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-xs font-black py-3 rounded-xl border border-surface-container-highest chunky-btn-sm active:scale-95">
            Cancel
          </button>
          <button id="add-kid-submit-btn" class="flex-1 bg-primary text-on-primary font-headline text-xs font-black py-3 rounded-xl chunky-btn border-primary-container shadow hover:brightness-110 active:scale-95">
            Create Adventurer
          </button>
        </div>

      </div>
    </div>
  `;
}

function renderEditKidModal() {
  if (!editingKid) return '';
  return `
    <div id="edit-kid-modal-backdrop" class="fixed inset-0 bg-[#09141e]/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div class="bg-surface-container border-4 border-secondary rounded-4xl p-6 max-w-lg w-full card-shadow-lg flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        
        <div class="flex justify-between items-center border-b-2 border-surface-container-highest pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary text-2xl">edit</span>
            <h2 class="font-headline text-xl font-black text-inverse-surface">Edit ${editingKid.name}</h2>
          </div>
          <button id="edit-kid-modal-close-btn" class="text-on-surface-variant hover:text-error text-2xl p-1">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Child's Name</label>
            <input type="text" id="edit-kid-name" value="${editingKid.name}" class="w-full bg-surface-container-high border-2 border-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold text-inverse-surface focus:border-secondary focus:outline-none" />
          </div>

          <div>
            <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Adventurer Title / Role</label>
            <input type="text" id="edit-kid-role" value="${editingKid.role}" class="w-full bg-surface-container-high border-2 border-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold text-inverse-surface focus:border-secondary focus:outline-none" />
          </div>

          <!-- Photo Upload Option -->
          <div class="flex items-center gap-3 p-3 bg-surface-container-high rounded-2xl border-2 border-surface-container-highest">
            <div class="w-14 h-14 rounded-full border-2 border-secondary overflow-hidden flex-shrink-0 bg-surface-variant relative shadow-inner">
              <img id="edit-kid-avatar-preview" src="${editingKid.avatar}" class="w-full h-full object-cover" />
            </div>
            <div class="flex flex-col flex-1 min-w-0">
              <span class="text-xs font-headline font-black text-inverse-surface">Custom Profile Photo</span>
              <span class="text-[10px] text-on-surface-variant font-bold">Upload a photo of your child from this device</span>
            </div>
            <label for="edit-kid-photo-input" class="bg-secondary text-on-secondary font-headline text-xs font-black px-3.5 py-2.5 rounded-xl chunky-btn-sm border-secondary-container cursor-pointer hover:brightness-110 active:scale-95 flex items-center gap-1.5 shadow-sm">
              <span class="material-symbols-outlined text-sm">photo_camera</span>
              Upload
            </label>
            <input type="file" id="edit-kid-photo-input" accept="image/*" class="hidden" />
          </div>

          <div>
            <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Or Select 3D Preset Avatar</label>
            <div class="grid grid-cols-4 gap-2.5">
              ${KID_AVATARS.map((av) => `
                <button type="button" data-avatar-url="${av.url}" class="edit-kid-avatar-choice rounded-2xl p-1.5 border-3 transition-all flex flex-col items-center gap-1 ${editingKid.avatar === av.url ? 'border-secondary bg-secondary/20 scale-102 ring-2 ring-secondary' : 'border-surface-container-highest bg-surface-container-high hover:border-secondary/50'}">
                  <img src="${av.url}" class="w-12 h-12 rounded-full object-cover" />
                  <span class="text-[9px] font-bold text-white truncate w-full text-center">${av.label}</span>
                </button>
              `).join('')}
            </div>
            <input type="hidden" id="edit-kid-avatar-val" value="${editingKid.avatar}" />
          </div>

          <div>
            <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Learning Difficulty Level</label>
            <div class="grid grid-cols-3 gap-2">
              <label class="flex flex-col items-center justify-center p-2.5 rounded-xl border-2 cursor-pointer text-center edit-diff-choice-label ${editingKid.gameDifficulty === 'easy' ? 'border-primary bg-primary/20 text-primary' : 'border-surface-container-highest bg-surface-container-high text-on-surface-variant'}">
                <input type="radio" name="edit-kid-diff" value="easy" class="hidden" ${editingKid.gameDifficulty === 'easy' ? 'checked' : ''} />
                <span class="text-xs font-black">🟢 Easy</span>
                <span class="text-[9px] font-bold">Age 3–4 (Voice)</span>
              </label>
              <label class="flex flex-col items-center justify-center p-2.5 rounded-xl border-2 cursor-pointer text-center edit-diff-choice-label ${editingKid.gameDifficulty === 'medium' ? 'border-secondary bg-secondary/20 text-secondary' : 'border-surface-container-highest bg-surface-container-high text-on-surface-variant'}">
                <input type="radio" name="edit-kid-diff" value="medium" class="hidden" ${editingKid.gameDifficulty === 'medium' ? 'checked' : ''} />
                <span class="text-xs font-black">🟡 Medium</span>
                <span class="text-[9px] font-bold">Age 5–6 (Reading)</span>
              </label>
              <label class="flex flex-col items-center justify-center p-2.5 rounded-xl border-2 cursor-pointer text-center edit-diff-choice-label ${editingKid.gameDifficulty === 'hard' ? 'border-error bg-error/20 text-error' : 'border-surface-container-highest bg-surface-container-high text-on-surface-variant'}">
                <input type="radio" name="edit-kid-diff" value="hard" class="hidden" ${editingKid.gameDifficulty === 'hard' ? 'checked' : ''} />
                <span class="text-xs font-black">🔵 Hard</span>
                <span class="text-[9px] font-bold">Age 7–9 (Math)</span>
              </label>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Level ★</label>
              <input type="number" id="edit-kid-level" value="${editingKid.level}" min="1" class="w-full bg-surface-container-high border-2 border-surface-container-highest rounded-xl px-3 py-2 text-sm font-bold text-inverse-surface focus:border-secondary focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Tokens 🪙</label>
              <input type="number" id="edit-kid-coins" value="${editingKid.coins || 0}" min="0" class="w-full bg-surface-container-high border-2 border-surface-container-highest rounded-xl px-3 py-2 text-sm font-bold text-secondary focus:border-secondary focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Points ⭐</label>
              <input type="number" id="edit-kid-points" value="${editingKid.points || 0}" min="0" class="w-full bg-surface-container-high border-2 border-surface-container-highest rounded-xl px-3 py-2 text-sm font-bold text-tertiary focus:border-tertiary focus:outline-none" />
            </div>
          </div>
        </div>

        <div class="flex gap-2.5 pt-3 border-t border-surface-container-highest">
          <button id="edit-kid-cancel-btn" class="flex-1 bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-xs font-black py-3 rounded-xl border border-surface-container-highest chunky-btn-sm active:scale-95">
            Cancel
          </button>
          <button id="edit-kid-submit-btn" class="flex-1 bg-secondary text-on-secondary font-headline text-xs font-black py-3 rounded-xl chunky-btn border-secondary-container shadow hover:brightness-110 active:scale-95">
            Save Changes
          </button>
        </div>

      </div>
    </div>
  `;
}

function renderDeleteKidModal() {
  if (!deletingKid) return '';
  return `
    <div id="delete-kid-modal-backdrop" class="fixed inset-0 bg-[#09141e]/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div class="bg-surface-container border-4 border-error rounded-4xl p-6 max-w-md w-full card-shadow-lg flex flex-col items-center text-center gap-4 animate-scale-up">
        
        <div class="w-16 h-16 rounded-3xl bg-error/20 text-error flex items-center justify-center text-3xl border-2 border-error/40 shadow">
          <span class="material-symbols-outlined text-4xl">delete_forever</span>
        </div>

        <div>
          <h2 class="font-headline text-xl font-black text-inverse-surface">Delete ${deletingKid.name}?</h2>
          <p class="text-xs text-on-surface-variant font-bold mt-1.5 leading-relaxed">
            Are you sure you want to remove <strong>${deletingKid.name}</strong> from the family roster? Their quest records, level, and coin balances will be removed.
          </p>
        </div>

        <div class="flex gap-2.5 w-full pt-2">
          <button id="delete-kid-cancel-btn" class="flex-1 bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-xs font-black py-3 rounded-xl border border-surface-container-highest chunky-btn-sm active:scale-95">
            Keep Kid
          </button>
          <button id="delete-kid-confirm-btn" class="flex-1 bg-error text-on-error font-headline text-xs font-black py-3 rounded-xl chunky-btn border-error-container shadow hover:brightness-110 active:scale-95">
            Yes, Delete
          </button>
        </div>

      </div>
    </div>
  `;
}

function renderNewHouseholdModal() {
  if (!isNewHouseholdModalOpen) return '';
  return `
    <div id="new-household-modal-backdrop" class="fixed inset-0 bg-[#09141e]/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div class="bg-surface-container border-4 border-secondary rounded-4xl p-6 max-w-md w-full card-shadow-lg flex flex-col gap-4 animate-scale-up">
        
        <div class="flex justify-between items-center border-b-2 border-surface-container-highest pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary text-2xl">add_home</span>
            <h2 class="font-headline text-xl font-black text-inverse-surface">Create New Household</h2>
          </div>
          <button id="new-household-close-btn" class="text-on-surface-variant hover:text-error text-2xl p-1">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="flex flex-col gap-3">
          <p class="text-xs text-on-surface-variant font-bold leading-relaxed">
            Creating a new household will generate a brand new unique family cloud sync code so you can link all your family's devices cleanly.
          </p>

          <div>
            <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Family Household Name</label>
            <input type="text" id="new-household-name-input" placeholder="e.g. The Miller Family" value="The Hero Family" class="w-full bg-surface-container-high border-2 border-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold text-inverse-surface focus:border-secondary focus:outline-none" />
          </div>
        </div>

        <div class="flex gap-2.5 pt-2 border-t border-surface-container-highest">
          <button id="new-household-cancel-btn" class="flex-1 bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-xs font-black py-3 rounded-xl border border-surface-container-highest chunky-btn-sm active:scale-95">
            Cancel
          </button>
          <button id="new-household-submit-btn" class="flex-1 bg-secondary text-on-secondary font-headline text-xs font-black py-3 rounded-xl chunky-btn border-secondary-container shadow hover:brightness-110 active:scale-95">
            Create Household
          </button>
        </div>

      </div>
    </div>
  `;
}

export function attachParentPortalListeners() {
  const lockExitBtn = document.getElementById('admin-lock-exit-btn');
  if (lockExitBtn) {
    lockExitBtn.addEventListener('click', () => {
      Sound.click();
      store.lockParentSession();
    });
  }

  const backDashBtn = document.getElementById('admin-back-dash-btn');
  if (backDashBtn) {
    backDashBtn.addEventListener('click', () => {
      Sound.click();
      store.lockParentSession();
    });
  }

  // Security & Biometric gate toggle settings
  document.querySelectorAll('.lock-option-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-lock-toggle');
      const settings = store.getState().parentSettings || {};
      
      const currentBio = settings.biometricsEnabled !== false;
      const currentPin = settings.pinLockEnabled !== false;
      const currentMath = settings.mathChallengeEnabled !== false;

      let newBio = currentBio;
      let newPin = currentPin;
      let newMath = currentMath;

      if (type === 'biometrics') newBio = !currentBio;
      if (type === 'pin') newPin = !currentPin;
      if (type === 'math') newMath = !currentMath;

      // Safety check: ensure at least 1 lock option remains active!
      if (!newBio && !newPin && !newMath) {
        Sound.hit();
        alert('At least one security gate (Biometrics, PIN, or Math Challenge) must remain active to protect the Parent Dashboard!');
        return;
      }

      Sound.click();
      store.updateParentSettings({
        biometricsEnabled: newBio,
        pinLockEnabled: newPin,
        mathChallengeEnabled: newMath
      });
    });
  });

  // Security PIN and Biometric tests
  const savePinBtn = document.getElementById('save-parent-pin-btn');
  const settingPinInput = document.getElementById('parent-setting-pin-input');
  const pinFeedback = document.getElementById('pin-save-feedback');
  if (savePinBtn && settingPinInput) {
    savePinBtn.addEventListener('click', () => {
      const newPin = settingPinInput.value.trim();
      if (newPin && newPin.length >= 4) {
        store.updateParentSettings({ pin: newPin });
        Sound.fanfare();
        if (pinFeedback) {
          pinFeedback.classList.remove('hidden');
          setTimeout(() => pinFeedback.classList.add('hidden'), 3000);
        }
      } else {
        alert('Please enter a PIN with at least 4 digits.');
      }
    });
  }

  const testBioBtn = document.getElementById('test-biometric-btn');
  const bioFeedback = document.getElementById('biometric-test-feedback');
  if (testBioBtn) {
    testBioBtn.addEventListener('click', async () => {
      Sound.click();
      try {
        const res = await authenticateWithBiometrics();
        if (res && res.success) {
          Sound.fanfare();
          if (bioFeedback) {
            bioFeedback.textContent = '✓ Biometric authentication successful on this device!';
            bioFeedback.className = 'text-[10px] font-black text-primary';
          }
        }
      } catch (err) {
        Sound.hit();
        if (bioFeedback) {
          bioFeedback.textContent = '✕ ' + (err.message || 'Biometric scan failed.');
          bioFeedback.className = 'text-[10px] font-bold text-error';
        }
      }
    });
  }

  document.querySelectorAll('.admin-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeAdminTab = btn.getAttribute('data-admin-tab');
      Sound.click();
      store.notify();
    });
  });

  // APPROVALS TAB
  const clearAllPendingBtn = document.getElementById('admin-clear-all-pending-btn');
  if (clearAllPendingBtn) {
    clearAllPendingBtn.addEventListener('click', () => {
      store.clearAllPendingApprovals();
    });
  }

  const clearAllPendingEmptyBtn = document.getElementById('admin-clear-all-pending-empty-btn');
  if (clearAllPendingEmptyBtn) {
    clearAllPendingEmptyBtn.addEventListener('click', () => {
      store.clearAllPendingApprovals();
    });
  }

  const settingsClearPendingBtn = document.getElementById('admin-settings-clear-pending-btn');
  if (settingsClearPendingBtn) {
    settingsClearPendingBtn.addEventListener('click', () => {
      store.clearAllPendingApprovals();
    });
  }

  const approveAllBtn = document.getElementById('admin-approve-all-btn');
  if (approveAllBtn) {
    approveAllBtn.addEventListener('click', () => {
      store.approveAllPendingRequests();
    });
  }

  document.querySelectorAll('.admin-approve-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-approve-id');
      store.approveParentRequest(id);
    });
  });

  document.querySelectorAll('.admin-reject-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-reject-id');
      store.rejectParentRequest(id);
    });
  });

  // TASKS TAB - Create Task
  const createTaskBtn = document.getElementById('admin-create-task-btn');
  if (createTaskBtn) {
    createTaskBtn.addEventListener('click', () => {
      const title = document.getElementById('new-task-title')?.value;
      const zone = document.getElementById('new-task-zone')?.value;
      const time = document.getElementById('new-task-time')?.value;
      const tokens = document.getElementById('new-task-tokens')?.value;
      const points = document.getElementById('new-task-points')?.value;
      const desc = document.getElementById('new-task-desc')?.value;
      const icon = document.getElementById('new-task-icon')?.value;

      if (title && title.trim()) {
        store.addNewTask({
          title: title.trim(),
          zone: zone || 'Task Forest',
          timeWindow: time || 'Daily',
          coins: tokens || 25,
          points: points || 10,
          desc: desc || '',
          icon: icon || 'checklist'
        });
      }
    });
  }

  document.querySelectorAll('.admin-delete-task-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-task-id');
      const zone = btn.getAttribute('data-delete-task-zone');
      store.deleteTask(id, zone);
    });
  });

  // REWARDS TAB - Create Real-Life Reward
  const createRewardBtn = document.getElementById('admin-create-reward-btn');
  if (createRewardBtn) {
    createRewardBtn.addEventListener('click', () => {
      const title = document.getElementById('new-reward-title')?.value;
      const cost = document.getElementById('new-reward-cost')?.value;
      const category = document.getElementById('new-reward-category')?.value;
      const desc = document.getElementById('new-reward-desc')?.value;
      const icon = document.getElementById('new-reward-icon')?.value;

      if (title && title.trim()) {
        store.addNewRealLifeReward({
          title: title.trim(),
          costPoints: cost || 50,
          category: category || 'Experience',
          desc: desc || '',
          icon: icon || 'card_giftcard'
        });
      }
    });
  }

  document.querySelectorAll('.admin-delete-reward-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-reward-id');
      store.deleteRealLifeReward(id);
    });
  });

  // PRICING TAB - Save All Pricing
  const savePricingBtn = document.getElementById('admin-save-pricing-btn');
  if (savePricingBtn) {
    savePricingBtn.addEventListener('click', () => {
      const realLifeMap = {};
      document.querySelectorAll('[data-pricing-reallife-id]').forEach((input) => {
        const id = input.getAttribute('data-pricing-reallife-id');
        realLifeMap[id] = input.value;
      });

      const digitalMap = {};
      document.querySelectorAll('[data-pricing-digital-id]').forEach((input) => {
        const id = input.getAttribute('data-pricing-digital-id');
        digitalMap[id] = input.value;
      });

      const themesMap = {};
      document.querySelectorAll('[data-pricing-theme-id]').forEach((input) => {
        const id = input.getAttribute('data-pricing-theme-id');
        themesMap[id] = input.value;
      });

      const statBonusMap = {};
      document.querySelectorAll('[data-statbonus-digital-id]').forEach((input) => {
        const id = input.getAttribute('data-statbonus-digital-id');
        const typeSelect = document.querySelector(`[data-statbonus-type-id="${id}"]`);
        statBonusMap[id] = {
          percent: parseInt(input.value) || 0,
          type: typeSelect?.value || 'coin_boost'
        };
      });

      store.updateAllPricing(realLifeMap, digitalMap, themesMap, statBonusMap);
    });
  }

  // KID MANAGEMENT LISTENERS
  const openAddKidBtn = document.getElementById('admin-open-add-kid-btn');
  if (openAddKidBtn) {
    openAddKidBtn.addEventListener('click', () => {
      isAddKidModalOpen = true;
      selectedAvatarUrl = KID_AVATARS[0].url;
      Sound.click();
      store.notify();
    });
  }

  const closeAddKidBtn = document.getElementById('add-kid-modal-close-btn');
  if (closeAddKidBtn) {
    closeAddKidBtn.addEventListener('click', () => {
      isAddKidModalOpen = false;
      Sound.click();
      store.notify();
    });
  }

  const cancelAddKidBtn = document.getElementById('add-kid-cancel-btn');
  if (cancelAddKidBtn) {
    cancelAddKidBtn.addEventListener('click', () => {
      isAddKidModalOpen = false;
      Sound.click();
      store.notify();
    });
  }

  const addKidBackdrop = document.getElementById('add-kid-modal-backdrop');
  if (addKidBackdrop) {
    addKidBackdrop.addEventListener('click', (e) => {
      if (e.target === addKidBackdrop) {
        isAddKidModalOpen = false;
        store.notify();
      }
    });
  }

  document.querySelectorAll('.new-kid-avatar-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedAvatarUrl = btn.getAttribute('data-avatar-url');
      const avatarInput = document.getElementById('new-kid-avatar-val');
      if (avatarInput) avatarInput.value = selectedAvatarUrl;
      const preview = document.getElementById('new-kid-avatar-preview');
      if (preview) preview.src = selectedAvatarUrl;
      document.querySelectorAll('.new-kid-avatar-choice').forEach((b) => {
        b.classList.remove('border-primary', 'bg-primary/20', 'scale-102', 'ring-2', 'ring-primary');
        b.classList.add('border-surface-container-highest', 'bg-surface-container-high');
      });
      btn.classList.remove('border-surface-container-highest', 'bg-surface-container-high');
      btn.classList.add('border-primary', 'bg-primary/20', 'scale-102', 'ring-2', 'ring-primary');
      Sound.click();
    });
  });

  const newKidPhotoInput = document.getElementById('new-kid-photo-input');
  if (newKidPhotoInput) {
    newKidPhotoInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await processProfilePhoto(file);
        selectedAvatarUrl = dataUrl;
        const avatarInput = document.getElementById('new-kid-avatar-val');
        if (avatarInput) avatarInput.value = dataUrl;
        const preview = document.getElementById('new-kid-avatar-preview');
        if (preview) preview.src = dataUrl;
        document.querySelectorAll('.new-kid-avatar-choice').forEach((b) => {
          b.classList.remove('border-primary', 'bg-primary/20', 'scale-102', 'ring-2', 'ring-primary');
          b.classList.add('border-surface-container-highest', 'bg-surface-container-high');
        });
        Sound.fanfare();
      } catch (err) {
        alert(err.message || 'Unable to upload photo.');
      }
    });
  }

  document.querySelectorAll('.new-diff-choice-label').forEach((label) => {
    label.addEventListener('click', () => {
      document.querySelectorAll('.new-diff-choice-label').forEach((l) => {
        l.classList.remove('border-primary', 'bg-primary/15', 'border-secondary', 'bg-secondary/15', 'border-error', 'bg-error/15');
        l.classList.add('border-surface-container-highest', 'bg-surface-container-high');
      });
      const input = label.querySelector('input');
      if (input) {
        input.checked = true;
        if (input.value === 'easy') label.classList.add('border-primary', 'bg-primary/15');
        else if (input.value === 'hard') label.classList.add('border-error', 'bg-error/15');
        else label.classList.add('border-secondary', 'bg-secondary/15');
      }
      Sound.click();
    });
  });

  const submitAddKidBtn = document.getElementById('add-kid-submit-btn');
  if (submitAddKidBtn) {
    submitAddKidBtn.addEventListener('click', () => {
      const name = document.getElementById('new-kid-name')?.value;
      const role = document.getElementById('new-kid-role')?.value;
      const avatar = document.getElementById('new-kid-avatar-val')?.value || selectedAvatarUrl;
      const diffInput = document.querySelector('input[name="new-kid-diff"]:checked');
      const diff = diffInput ? diffInput.value : 'medium';
      const coins = parseInt(document.getElementById('new-kid-coins')?.value || '50', 10);
      const points = parseInt(document.getElementById('new-kid-points')?.value || '0', 10);

      if (!name || !name.trim()) {
        const input = document.getElementById('new-kid-name');
        if (input) {
          input.classList.add('border-error');
          input.focus();
        }
        return;
      }

      store.addHero({
        name: name.trim(),
        role: role ? role.trim() : 'Dragon Explorer',
        avatar,
        gameDifficulty: diff,
        coins,
        points
      });

      isAddKidModalOpen = false;
      store.notify();
    });
  }

  // EDIT KID
  document.querySelectorAll('.admin-edit-kid-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const kidId = btn.getAttribute('data-kid-id');
      const kid = store.getState().heroes.find((h) => h.id === kidId);
      if (kid) {
        editingKid = { ...kid };
        Sound.click();
        store.notify();
      }
    });
  });

  const closeEditKidBtn = document.getElementById('edit-kid-modal-close-btn');
  if (closeEditKidBtn) {
    closeEditKidBtn.addEventListener('click', () => {
      editingKid = null;
      Sound.click();
      store.notify();
    });
  }

  const cancelEditKidBtn = document.getElementById('edit-kid-cancel-btn');
  if (cancelEditKidBtn) {
    cancelEditKidBtn.addEventListener('click', () => {
      editingKid = null;
      Sound.click();
      store.notify();
    });
  }

  const editKidBackdrop = document.getElementById('edit-kid-modal-backdrop');
  if (editKidBackdrop) {
    editKidBackdrop.addEventListener('click', (e) => {
      if (e.target === editKidBackdrop) {
        editingKid = null;
        store.notify();
      }
    });
  }

  document.querySelectorAll('.edit-kid-avatar-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-avatar-url');
      const avatarInput = document.getElementById('edit-kid-avatar-val');
      if (avatarInput) avatarInput.value = url;
      const preview = document.getElementById('edit-kid-avatar-preview');
      if (preview) preview.src = url;
      document.querySelectorAll('.edit-kid-avatar-choice').forEach((b) => {
        b.classList.remove('border-secondary', 'bg-secondary/20', 'scale-102', 'ring-2', 'ring-secondary');
        b.classList.add('border-surface-container-highest', 'bg-surface-container-high');
      });
      btn.classList.remove('border-surface-container-highest', 'bg-surface-container-high');
      btn.classList.add('border-secondary', 'bg-secondary/20', 'scale-102', 'ring-2', 'ring-secondary');
      Sound.click();
    });
  });

  const editKidPhotoInput = document.getElementById('edit-kid-photo-input');
  if (editKidPhotoInput && editingKid) {
    editKidPhotoInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await processProfilePhoto(file);
        editingKid.avatar = dataUrl;
        const avatarInput = document.getElementById('edit-kid-avatar-val');
        if (avatarInput) avatarInput.value = dataUrl;
        const preview = document.getElementById('edit-kid-avatar-preview');
        if (preview) preview.src = dataUrl;
        document.querySelectorAll('.edit-kid-avatar-choice').forEach((b) => {
          b.classList.remove('border-secondary', 'bg-secondary/20', 'scale-102', 'ring-2', 'ring-secondary');
          b.classList.add('border-surface-container-highest', 'bg-surface-container-high');
        });
        Sound.fanfare();
      } catch (err) {
        alert(err.message || 'Unable to upload photo.');
      }
    });
  }

  document.querySelectorAll('.edit-diff-choice-label').forEach((label) => {
    label.addEventListener('click', () => {
      document.querySelectorAll('.edit-diff-choice-label').forEach((l) => {
        l.classList.remove('border-primary', 'bg-primary/20', 'text-primary', 'border-secondary', 'bg-secondary/20', 'text-secondary', 'border-error', 'bg-error/20', 'text-error');
        l.classList.add('border-surface-container-highest', 'bg-surface-container-high', 'text-on-surface-variant');
      });
      const input = label.querySelector('input');
      if (input) {
        input.checked = true;
        if (input.value === 'easy') label.classList.add('border-primary', 'bg-primary/20', 'text-primary');
        else if (input.value === 'hard') label.classList.add('border-error', 'bg-error/20', 'text-error');
        else label.classList.add('border-secondary', 'bg-secondary/20', 'text-secondary');
        label.classList.remove('border-surface-container-highest', 'bg-surface-container-high', 'text-on-surface-variant');
      }
      Sound.click();
    });
  });

  const submitEditKidBtn = document.getElementById('edit-kid-submit-btn');
  if (submitEditKidBtn && editingKid) {
    submitEditKidBtn.addEventListener('click', () => {
      const name = document.getElementById('edit-kid-name')?.value;
      const role = document.getElementById('edit-kid-role')?.value;
      const avatar = document.getElementById('edit-kid-avatar-val')?.value;
      const diffInput = document.querySelector('input[name="edit-kid-diff"]:checked');
      const diff = diffInput ? diffInput.value : editingKid.gameDifficulty;
      const level = parseInt(document.getElementById('edit-kid-level')?.value || '1', 10);
      const coins = parseInt(document.getElementById('edit-kid-coins')?.value || '0', 10);
      const points = parseInt(document.getElementById('edit-kid-points')?.value || '0', 10);

      store.editHero(editingKid.id, {
        name: name || editingKid.name,
        role: role || editingKid.role,
        avatar: avatar || editingKid.avatar,
        gameDifficulty: diff,
        level,
        coins,
        points
      });

      editingKid = null;
      store.notify();
    });
  }

  // DELETE KID
  document.querySelectorAll('.admin-delete-kid-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const kidId = btn.getAttribute('data-kid-id');
      const kid = store.getState().heroes.find((h) => h.id === kidId);
      if (kid) {
        deletingKid = kid;
        Sound.click();
        store.notify();
      }
    });
  });

  const closeDeleteKidBtn = document.getElementById('delete-kid-cancel-btn');
  if (closeDeleteKidBtn) {
    closeDeleteKidBtn.addEventListener('click', () => {
      deletingKid = null;
      Sound.click();
      store.notify();
    });
  }

  const deleteKidBackdrop = document.getElementById('delete-kid-modal-backdrop');
  if (deleteKidBackdrop) {
    deleteKidBackdrop.addEventListener('click', (e) => {
      if (e.target === deleteKidBackdrop) {
        deletingKid = null;
        store.notify();
      }
    });
  }

  const confirmDeleteKidBtn = document.getElementById('delete-kid-confirm-btn');
  if (confirmDeleteKidBtn && deletingKid) {
    confirmDeleteKidBtn.addEventListener('click', () => {
      store.deleteHero(deletingKid.id);
      deletingKid = null;
      store.notify();
    });
  }

  // SWITCH HERO
  document.querySelectorAll('.admin-switch-hero-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const heroId = btn.getAttribute('data-switch-hero-id');
      store.switchHero(heroId);
      store.notify();
    });
  });

  // CREATE NEW HOUSEHOLD
  const openNewHouseholdBtn = document.getElementById('admin-create-household-btn');
  if (openNewHouseholdBtn) {
    openNewHouseholdBtn.addEventListener('click', () => {
      isNewHouseholdModalOpen = true;
      Sound.click();
      store.notify();
    });
  }

  const closeNewHouseholdBtn = document.getElementById('new-household-close-btn');
  if (closeNewHouseholdBtn) {
    closeNewHouseholdBtn.addEventListener('click', () => {
      isNewHouseholdModalOpen = false;
      Sound.click();
      store.notify();
    });
  }

  const cancelNewHouseholdBtn = document.getElementById('new-household-cancel-btn');
  if (cancelNewHouseholdBtn) {
    cancelNewHouseholdBtn.addEventListener('click', () => {
      isNewHouseholdModalOpen = false;
      Sound.click();
      store.notify();
    });
  }

  const newHouseholdBackdrop = document.getElementById('new-household-modal-backdrop');
  if (newHouseholdBackdrop) {
    newHouseholdBackdrop.addEventListener('click', (e) => {
      if (e.target === newHouseholdBackdrop) {
        isNewHouseholdModalOpen = false;
        store.notify();
      }
    });
  }

  const submitNewHouseholdBtn = document.getElementById('new-household-submit-btn');
  if (submitNewHouseholdBtn) {
    submitNewHouseholdBtn.addEventListener('click', () => {
      const name = document.getElementById('new-household-name-input')?.value;
      store.createNewHousehold(name || 'The Hero Family');
      isNewHouseholdModalOpen = false;
      store.notify();
    });
  }

  // LINK / DEVICE SYNC
  const linkHouseholdBtn = document.getElementById('admin-link-household-btn');
  if (linkHouseholdBtn) {
    linkHouseholdBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('open-household-modal'));
    });
  }

  // REMOVE TEST KIDS
  const removeTestDataBtn = document.getElementById('admin-remove-test-data-btn');
  if (removeTestDataBtn) {
    removeTestDataBtn.addEventListener('click', () => {
      store.removeTestKids();
      store.notify();
    });
  }

  // KID DIFFICULTY SELECTION (Settings Tab)
  document.querySelectorAll('.kid-diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kidId = btn.getAttribute('data-kid-id');
      const diff = btn.getAttribute('data-diff-level');
      store.setKidDifficulty(kidId, diff);
    });
  });

  // SLIDERS TAB
  document.querySelectorAll('.ar-duration-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dur = parseInt(btn.getAttribute('data-duration'));
      store.getState().parentSettings.arBattleDuration = dur;
      Sound.click();
      store.saveState();
    });
  });

  // AI STUDIO TAB - Publish Live Item
  const aiGenerateBtn = document.getElementById('ai-generate-submit-btn');
  if (aiGenerateBtn) {
    aiGenerateBtn.addEventListener('click', () => {
      const name = document.getElementById('ai-asset-name')?.value;
      const type = document.getElementById('ai-asset-type')?.value;
      const desc = document.getElementById('ai-asset-desc')?.value;
      const price = document.getElementById('ai-asset-price')?.value;

      if (name && name.trim()) {
        store.generateAIReward(name.trim(), type, desc, price);
      }
    });
  }
}
