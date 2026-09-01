import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';

let activeAdminTab = 'approvals'; // approvals, tasks, rewards, pricing, studio, analytics, settings

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

        <!-- Exit to Kid Mode Button -->
        <button id="admin-back-dash-btn" class="bg-surface-container hover:bg-surface-bright text-inverse-surface font-headline text-xs font-black px-4 py-2.5 rounded-xl border border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-sm">arrow_back</span>
          Return to Kid Mode
        </button>
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
          <div class="flex justify-between items-center">
            <h2 class="font-headline text-lg font-black text-inverse-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-secondary">inbox</span>
              Pending Sign-off Requests (${pending.length})
            </h2>
            <span class="text-xs font-bold text-on-surface-variant">Review task submissions & rewards</span>
          </div>

          ${
            pending.length === 0
              ? `
            <div class="bg-surface-container rounded-3xl p-8 text-center border-2 border-surface-container-highest card-shadow flex flex-col items-center gap-2">
              <span class="material-symbols-outlined text-5xl text-primary">check_circle</span>
              <h3 class="font-headline text-lg font-black text-inverse-surface">Inbox is Clear!</h3>
              <p class="text-xs text-on-surface-variant">All completed chores have been verified and rewards signed off.</p>
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

      <!-- TAB 2: Task & Routines Manager (With Add Task Form) -->
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
                      <div class="w-12 h-12 rounded-xl bg-surface-container-high text-primary flex items-center justify-center text-2xl overflow-hidden p-1 border border-surface-container-highest">
                        ${t.image ? `<img src="${t.image}" class="w-full h-full object-contain" />` : `<span class="material-symbols-outlined">${t.icon}</span>`}
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

          <!-- Section 2: Digital Goods Pricing (Tokens 🪙) -->
          <div class="bg-surface-container rounded-3xl p-5 border-2 border-secondary-container/60 card-shadow flex flex-col gap-4">
            <h3 class="font-headline text-sm font-black text-secondary flex items-center gap-2">
              <span class="material-symbols-outlined">monetization_on</span>
              Digital Goodies & Gear Pricing (Cost in Habit Tokens 🪙)
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              ${digitalGear
                .map(
                  (g) => `
                <div class="bg-surface-container-high rounded-xl p-3 border border-surface-container-highest flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2 truncate">
                    <span class="text-xs font-bold text-inverse-surface truncate">${g.title}</span>
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <input type="number" data-pricing-digital-id="${g.id}" value="${g.costCoins}" class="w-20 bg-surface-container-lowest border border-secondary/40 rounded-lg p-1.5 text-xs font-black text-secondary text-center" />
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
        <section class="flex flex-col gap-4 animate-fade-in">
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
        </section>
      `
          : ''
      }

    </div>
  `;
}

export function attachParentPortalListeners() {
  const backDashBtn = document.getElementById('admin-back-dash-btn');
  if (backDashBtn) {
    backDashBtn.addEventListener('click', () => store.navigate('dashboard'));
  }

  document.querySelectorAll('.admin-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeAdminTab = btn.getAttribute('data-admin-tab');
      Sound.click();
      store.notify();
    });
  });

  // APPROVALS TAB
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

      store.updateAllPricing(realLifeMap, digitalMap);
    });
  }

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
