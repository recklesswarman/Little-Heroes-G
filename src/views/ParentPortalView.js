import { store, KID_AVATARS } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { processProfilePhoto } from '../utils/photoUploader.js';
import { authenticateWithBiometrics } from '../utils/biometrics.js';
import { getTaskVisualSvg } from '../utils/taskVisuals.js';
import { firestoreSync } from '../services/firestoreSyncService.js';
import { cloudFunctionsService } from '../services/cloudFunctionsService.js';
import { aiDevelopmentalReportService } from '../services/aiDevelopmentalReportService.js';
import { PetSkeletalBodyCanvas, RUNWAY_POSES } from '../services/petSkeletalBodyService.js';
import { firebaseAI, SPLINE_3D_PRESETS } from '../services/firebaseAILogicService.js';
import { COLOR_DYES, formatStatBonusName } from '../data/petGearStudioData.js';
import { THREE_D_ASSETS, getThreeDAssetsByCategory, matchBestThreeDAsset } from '../data/threeDAssetCatalog.js';

let activeAdminTab = 'approvals'; // approvals, screentime, reports, kids, tasks, rewards, pricing, studio, analytics, settings
export function setActiveAdminTab(tab) {
  activeAdminTab = tab;
}
let isAddKidModalOpen = false;
let isAddParentModalOpen = false;
let editingKid = null;
let deletingKid = null;
let isNewHouseholdModalOpen = false;
let selectedAvatarUrl = KID_AVATARS[0].url;
let activeParentInsights = null;
let isLoadingInsights = false;

// Multi-Category 3D Studio & AI Crafting State
let studioActiveCategory = 'gear'; // 'gear', 'furniture', 'toy', 'boss'
let studioViewportMode = 'canvas'; // 'canvas', 'spline'
let studioActiveSplineUrl = '';
let studioSelectedPetId = 1;
let studioSelectedSocket = 'head';
let studioSelectedTheme = 'cyber';
let studioSelectedDye = '#06b6d4';
let studioItemName = 'Cyber Sentinel Visor';
let studioItemDesc = 'High-tech neon holographic HUD visor glowing with electric power!';
let studioItemArchetype = 'visor';
let studioItemAura = 'electric';
let studioStatType = 'damage_boost';
let studioStatPercent = 25;
let studioItemPrice = 150;
let studioPetVoiceLine = 'Zap! Ready for hyper-speed hero adventures!';

// Furniture State
let studioFurnitureType = 'bed';
let studioFurnitureZone = 'bedroom';
let studioFurnitureComfort = 25;

// Toy State
let studioToyType = 'trampoline';
let studioToyStat = 'joy';
let studioToyAmount = 30;

// 3D Pet Companion State
let studioPetArchetype = 'dragon'; // 'dino', 'dragon', 'beast', 'aquatic', 'robot', 'mystic'
let studioPetSynergy = 'dental';
let studioPetCheer = 'Whoosh! Sparkling clean smiles power up my flames!';
let studioPetSleep = 'Curling my tail into a warm sleep ball...';

// AR Boss State
let studioBossDomain = 'dental';
let studioBossHp = 250;
let studioBossCoins = 60;
let studioBossBattleDuration = 120; // 60s Toddler, 120s Standard, 180s Master
let studioBossAttackType = 'caramel_bomb'; // 'caramel_bomb', 'plaque_slime', 'acid_shard', 'sticky_taffy'
let studioBossFocusQuadrant = 'all'; // 'all', 'upper', 'lower'
let studioBossTaunt = 'You cannot defeat the Plaque Monster!';
let studioBossRally = 'Heroes, brush thoroughly to break its shield!';

let isStudioGenerating = false;
let studioActiveModelUrl = 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';
let studioActive3DAssetId = 'gear_cyber_visor';
let studioDeliveryMethod = 'instant_gift'; // 'instant_gift', 'hero_shop', 'habit_bounty'
let studioTargetChildProfile = 'all';
let studioBountyHabitId = 'brush_teeth';
let studioBountyStreakDays = 3;
let isRecordingVoice = false;
let studioUploadedImageBase64 = null;
let isChildEyePreviewOpen = false;
let studioSpeechRecognition = null;

let activeStudioCanvasInstance = null;
let activeStudioAnimFrame = null;


// Screen Time & Privileges Bank State
let selectedScreenTimeKidId = 'all';

// 4-Pillar AI Developmental Reports State
let selectedReportKidId = 'all';
let selectedReportWeekOffset = 0;
let currentDevelopmentalReport = null;
let isLoadingReport = false;
let zoomedProofPhotoUrl = null;

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
  const completionLogs = state.taskCompletionLogs || [];

  const tabs = [
    { id: 'approvals', label: 'Action Inbox', icon: 'inbox', count: pending.length },
    { id: 'screentime', label: 'Screen Time Bank', icon: 'schedule', count: 0 },
    { id: 'reports', label: 'AI Growth Reports', icon: 'psychology', count: 0 },
    { id: 'kids', label: 'Kids & Household', icon: 'diversity_1', count: heroes.length },
    { id: 'tasks', label: 'Tasks & Routines', icon: 'checklist', count: 0 },
    { id: 'rewards', label: 'Real-Life Rewards', icon: 'card_giftcard', count: 0 },
    { id: 'pricing', label: 'Pricing Editor', icon: 'payments', count: 0 },
    { id: 'studio', label: '3D Studio & AI Crafting', icon: 'auto_awesome', count: 0 },
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
                  const kid = heroes.find(h => h.id === req.kidId) || heroes[0];
                  const earnedMinutes = pointsAmount * (kid?.screenTimeRate || 2);

                  return `
                  <div class="bg-surface-container rounded-3xl p-5 border-2 ${isTaskPointApproval ? 'border-tertiary-container/80' : 'border-secondary-container/80'} card-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div class="flex items-start gap-3.5 flex-1">
                      <div class="w-14 h-14 rounded-2xl ${isTaskPointApproval ? 'bg-tertiary-container/20 text-tertiary border-2 border-tertiary-container' : 'bg-secondary-container/20 text-secondary border-2 border-secondary-container'} flex items-center justify-center text-2xl flex-shrink-0 mt-0.5">
                        <span class="material-symbols-outlined">${isTaskPointApproval ? 'stars' : 'card_giftcard'}</span>
                      </div>
                      <div class="flex flex-col flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-[10px] font-black uppercase text-secondary">${req.kidName}</span>
                          <span class="text-[10px] text-on-surface-variant font-bold">• ${req.date}</span>
                          <span class="text-[9px] font-black px-2 py-0.2 rounded-md ${isTaskPointApproval ? 'bg-tertiary/20 text-tertiary' : 'bg-secondary/20 text-secondary'}">
                            ${isTaskPointApproval ? 'Chore Point Request' : 'Reward Redemption'}
                          </span>
                          ${req.hasPhotoProof || req.photoUrl ? `
                            <span class="text-[9px] font-black px-2 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <span class="material-symbols-outlined text-[11px]">photo_camera</span> Photo Proof
                            </span>
                          ` : ''}
                        </div>
                        <h3 class="font-headline text-base font-black text-inverse-surface mt-0.5">${req.title}</h3>
                        
                        <div class="text-xs font-bold mt-1">
                          ${
                            isTaskPointApproval
                              ? `<span class="text-tertiary">⭐ Pending Approval: <strong>+${pointsAmount} Gold Points</strong></span> &nbsp;•&nbsp; <span class="text-sky-300 font-black">⏱️ +${earnedMinutes}m Screen Time</span> <span class="text-on-surface-variant font-medium">(Auto-issued +${tokensAmount} Tokens 🪙)</span>`
                              : `<span class="text-error">🎁 Redemption Cost: <strong>-${req.costPoints} Gold Points ⭐</strong></span>`
                          }
                        </div>

                        <!-- Optional Chore Photo Proof & Gemini AI Vision Badge -->
                        ${
                          req.photoUrl
                            ? `
                        <div class="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-surface-container-high/60 p-3 rounded-2xl border border-secondary-container/30">
                          <div class="relative w-24 h-18 sm:w-28 sm:h-20 rounded-xl overflow-hidden border-2 border-primary/50 cursor-pointer hover:scale-105 active:scale-95 transition-transform flex-shrink-0 shadow-sm admin-proof-thumb" data-full-img="${req.photoUrl}" title="Click to view full photo proof">
                            <img src="${req.photoUrl}" alt="Proof Thumbnail" class="w-full h-full object-cover" />
                            <div class="absolute inset-0 bg-black/25 hover:bg-transparent flex items-center justify-center transition-colors">
                              <span class="material-symbols-outlined text-white text-base drop-shadow">zoom_in</span>
                            </div>
                          </div>

                          <div class="flex flex-col gap-1">
                            <div class="flex items-center gap-2 flex-wrap">
                              <span class="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                                <span class="material-symbols-outlined text-xs">auto_awesome</span>
                                ✨ AI Check: ${req.aiConfidence || 92}% Confidence
                              </span>
                              <span class="text-[10px] text-amber-300 font-bold bg-amber-400/15 px-2 py-0.5 rounded-full border border-amber-400/30">
                                +5 Extra 🪙 Photo Bonus
                              </span>
                            </div>
                            <p class="text-xs text-on-surface-variant font-medium leading-tight mt-0.5">
                              <span class="font-bold text-inverse-surface">AI Assessment:</span> <em>"${req.aiFeedback || 'Chore evidence verified with high confidence.'}"</em>
                            </p>
                          </div>
                        </div>
                        `
                            : ''
                        }
                      </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex items-center gap-2 w-full sm:w-auto">
                      <button data-reject-id="${req.id}" class="admin-reject-btn flex-1 sm:flex-none bg-surface-container-high hover:bg-error/20 text-error font-headline text-xs font-black px-4 py-3 rounded-xl border border-error/30 chunky-btn-sm active:scale-95">
                        ✕ Reject (0 Points)
                      </button>
                      
                      <button data-approve-id="${req.id}" class="admin-approve-btn flex-1 sm:flex-none ${isTaskPointApproval ? 'bg-tertiary text-on-tertiary border-tertiary-container' : 'bg-primary text-on-primary border-primary-container'} font-headline text-xs font-black px-5 py-3 rounded-xl chunky-btn shadow-sm hover:brightness-110 active:scale-95">
                        ${isTaskPointApproval ? `✓ Issue +${pointsAmount} ⭐ (+${earnedMinutes}m ⏱️)` : `✓ Fulfill & Deduct (-${req.costPoints} ⭐)`}
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

      <!-- TAB: Screen Time & Privileges Bank -->
      ${
        activeAdminTab === 'screentime'
          ? `
        <section class="flex flex-col gap-6 animate-fade-in">
          
          <!-- Header Banner -->
          <div class="bg-surface-container rounded-3xl p-5 sm:p-6 border-2 border-sky-500/40 card-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center text-2xl shadow flex-shrink-0">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">schedule</span>
              </div>
              <div>
                <h2 class="font-headline text-lg sm:text-xl font-black text-inverse-surface">Screen Time & Privileges Bank</h2>
                <p class="text-xs text-on-surface-variant font-bold">Reward verified habits with screen privileges, daily caps, and automated bedtime curfews</p>
              </div>
            </div>

            <!-- Currency Exchange Rule Badge -->
            <div class="bg-sky-500/10 text-sky-300 border border-sky-500/30 px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 self-stretch sm:self-auto justify-center">
              <span class="material-symbols-outlined text-sm">currency_exchange</span>
              <span>1 Habit Point ⭐ = 2 Minutes Screen Time</span>
            </div>
          </div>

          <!-- Multi-Kid Selector Pills -->
          <div class="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            <button data-screentime-kid="all" class="screentime-kid-pill px-4 py-2.5 rounded-2xl text-xs font-headline font-black transition-all ${
              selectedScreenTimeKidId === 'all'
                ? 'bg-sky-500 text-white chunky-btn-sm shadow-sm'
                : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border border-surface-container-highest'
            }">
              👨‍👩‍👧‍👦 All Kids (${heroes.length})
            </button>
            ${heroes
              .map(
                (h) => `
              <button data-screentime-kid="${h.id}" class="screentime-kid-pill px-4 py-2.5 rounded-2xl text-xs font-headline font-black transition-all flex items-center gap-2 ${
                selectedScreenTimeKidId === h.id
                  ? 'bg-sky-500 text-white chunky-btn-sm shadow-sm'
                  : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border border-surface-container-highest'
              }">
                <img src="${h.avatar}" class="w-5 h-5 rounded-full object-cover border border-white/40" />
                <span>${h.name}</span>
              </button>
            `
              )
              .join('')}
          </div>

          <!-- Kid Screen Time Bank Cards -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${heroes
              .filter((h) => selectedScreenTimeKidId === 'all' || h.id === selectedScreenTimeKidId)
              .map((h) => {
                const isPaused = h.isScreenTimePaused || false;
                const bankedMins = h.screenTimeMinutes !== undefined ? h.screenTimeMinutes : 45;
                const usedToday = h.screenTimeUsedToday !== undefined ? h.screenTimeUsedToday : 15;
                const dailyCap = h.dailyMaxScreenTime || 60;
                const rate = h.screenTimeRate || 2;
                const curfew = h.bedtimeCurfew || '20:00';
                const usagePercent = Math.min(100, Math.round((usedToday / dailyCap) * 100));

                return `
                <div class="bg-surface-container rounded-3xl p-5 border-2 ${
                  isPaused ? 'border-amber-500/50 bg-amber-500/5' : 'border-surface-container-highest'
                } card-shadow flex flex-col gap-4">
                  <!-- Kid Top Row -->
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <img src="${h.avatar}" class="w-12 h-12 rounded-2xl border-2 border-primary object-cover" />
                      <div>
                        <h3 class="font-headline text-base font-black text-inverse-surface">${h.name}</h3>
                        <span class="text-[10px] font-black uppercase text-secondary">${h.role}</span>
                      </div>
                    </div>

                    <span class="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      isPaused
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1'
                    }">
                      <span class="material-symbols-outlined text-xs">${isPaused ? 'pause_circle' : 'check_circle'}</span>
                      ${isPaused ? 'Locked / Paused' : 'Bank Active'}
                    </span>
                  </div>

                  <!-- Big Screen Time Vitals -->
                  <div class="grid grid-cols-3 gap-2 bg-surface-container-lowest/80 p-3.5 rounded-2xl border border-surface-container-highest text-center">
                    <div class="flex flex-col">
                      <span class="text-[9px] text-on-surface-variant font-black uppercase">Banked Balance</span>
                      <span class="font-headline text-2xl font-black text-sky-400">${bankedMins}m</span>
                    </div>
                    <div class="flex flex-col border-x border-surface-container-highest px-1">
                      <span class="text-[9px] text-on-surface-variant font-black uppercase">Daily Used</span>
                      <span class="font-headline text-2xl font-black text-inverse-surface">${usedToday}m</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[9px] text-on-surface-variant font-black uppercase">Daily Limit</span>
                      <span class="font-headline text-2xl font-black text-secondary">${dailyCap}m</span>
                    </div>
                  </div>

                  <!-- Daily Cap Progress Bar -->
                  <div class="flex flex-col gap-1">
                    <div class="flex justify-between text-[10px] font-bold text-on-surface-variant">
                      <span>Daily Cap Progress</span>
                      <span>${usedToday} / ${dailyCap} mins (${usagePercent}%)</span>
                    </div>
                    <div class="w-full bg-surface-container-lowest h-2.5 rounded-full overflow-hidden border border-surface-container-highest">
                      <div class="h-full rounded-full transition-all duration-500 ${
                        usagePercent >= 90 ? 'bg-error' : usagePercent >= 70 ? 'bg-amber-400' : 'bg-sky-400'
                      }" style="width: ${usagePercent}%;"></div>
                    </div>
                  </div>

                  <!-- Curfew & Conversion Rate Details -->
                  <div class="flex items-center justify-between text-xs font-bold text-on-surface-variant bg-surface-container-high/50 px-3.5 py-2 rounded-xl border border-surface-container-highest">
                    <span class="flex items-center gap-1">
                      <span class="material-symbols-outlined text-sm text-amber-400">bedtime</span>
                      Bedtime Curfew: <strong class="text-inverse-surface">${curfew}</strong>
                    </span>
                    <span class="flex items-center gap-1">
                      <span class="material-symbols-outlined text-sm text-tertiary">star</span>
                      Rate: <strong class="text-inverse-surface">1 pt = ${rate} min</strong>
                    </span>
                  </div>

                  <!-- Quick 1-Tap Parental Actions -->
                  <div class="grid grid-cols-3 gap-2 pt-1 border-t border-surface-container-highest">
                    <button data-screentime-bonus="${h.id}" class="admin-screentime-bonus-btn bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-headline text-xs font-black py-2 rounded-xl border border-emerald-500/40 active:scale-95 flex items-center justify-center gap-1 shadow-sm" title="Add 15 bonus minutes">
                      <span class="material-symbols-outlined text-sm">add_circle</span> +15m Bonus
                    </button>
                    <button data-screentime-deduct="${h.id}" class="admin-screentime-deduct-btn bg-error/15 hover:bg-error/25 text-error font-headline text-xs font-black py-2 rounded-xl border border-error/30 active:scale-95 flex items-center justify-center gap-1 shadow-sm" title="Deduct 15 minutes">
                      <span class="material-symbols-outlined text-sm">remove_circle</span> -15m
                    </button>
                    <button data-screentime-toggle="${h.id}" class="admin-screentime-toggle-btn ${
                      isPaused ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    } font-headline text-xs font-black py-2 rounded-xl border active:scale-95 flex items-center justify-center gap-1 shadow-sm" title="${isPaused ? 'Resume screen time' : 'Pause screen time'}">
                      <span class="material-symbols-outlined text-sm">${isPaused ? 'play_arrow' : 'lock'}</span> ${isPaused ? 'Resume' : 'Pause'}
                    </button>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>

          <!-- Screen Time Policy & Governance Customizer Card -->
          <div class="bg-surface-container rounded-3xl p-5 sm:p-6 border-2 border-secondary-container card-shadow flex flex-col gap-4">
            <div class="flex items-center justify-between border-b border-surface-container-highest pb-3">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-secondary text-2xl">tune</span>
                <h3 class="font-headline text-base font-black text-inverse-surface">Screen Time Governance Settings</h3>
              </div>
              <span class="text-xs font-bold text-on-surface-variant">Applies to: ${selectedScreenTimeKidId === 'all' ? 'All Kids' : heroes.find(h => h.id === selectedScreenTimeKidId)?.name || 'Selected Kid'}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <!-- Conversion Rate -->
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-black text-inverse-surface flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm text-tertiary">star</span>
                  Conversion Rate (Minutes per Point)
                </label>
                <select id="screentime-rate-select" class="bg-surface-container-lowest border-2 border-surface-container-highest rounded-xl px-3 py-2.5 text-xs font-bold text-inverse-surface focus:border-primary outline-none">
                  <option value="1">1 Point ⭐ = 1 Minute</option>
                  <option value="2" selected>1 Point ⭐ = 2 Minutes (Recommended)</option>
                  <option value="3">1 Point ⭐ = 3 Minutes</option>
                  <option value="5">1 Point ⭐ = 5 Minutes</option>
                </select>
              </div>

              <!-- Daily Maximum Cap -->
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-black text-inverse-surface flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm text-sky-400">timer</span>
                  Daily Maximum Cap
                </label>
                <select id="screentime-cap-select" class="bg-surface-container-lowest border-2 border-surface-container-highest rounded-xl px-3 py-2.5 text-xs font-bold text-inverse-surface focus:border-primary outline-none">
                  <option value="30">30 Minutes / Day</option>
                  <option value="45">45 Minutes / Day</option>
                  <option value="60" selected>60 Minutes / Day (Recommended)</option>
                  <option value="90">90 Minutes / Day</option>
                  <option value="120">120 Minutes / Day</option>
                </select>
              </div>

              <!-- Bedtime Curfew -->
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-black text-inverse-surface flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm text-amber-400">bedtime</span>
                  Bedtime Curfew Lock
                </label>
                <input type="time" id="screentime-curfew-input" value="20:00" class="bg-surface-container-lowest border-2 border-surface-container-highest rounded-xl px-3 py-2 text-xs font-bold text-inverse-surface focus:border-primary outline-none" />
              </div>
            </div>

            <!-- Gentle Rex Bedtime/Curfew Message -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-black text-inverse-surface flex items-center gap-1">
                <span class="material-symbols-outlined text-sm text-primary">chat_bubble</span>
                Rex Gentle Curfew & Pause Message (Shown to Child)
              </label>
              <input type="text" id="screentime-lockout-msg" value="Rex says: Great job today! Time to play outside or get cozy for bedtime! 🦖🌙" class="bg-surface-container-lowest border-2 border-surface-container-highest rounded-xl px-3.5 py-2.5 text-xs font-bold text-inverse-surface focus:border-primary outline-none" />
            </div>

            <div class="flex justify-end pt-2">
              <button id="screentime-save-settings-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black px-6 py-2.5 rounded-xl chunky-btn-sm active:scale-95 shadow-sm flex items-center gap-1.5 hover:brightness-110">
                <span class="material-symbols-outlined text-sm">save</span>
                <span>Save Screen Time Policy</span>
              </button>
            </div>
          </div>

        </section>
      `
          : ''
      }

      <!-- TAB: 4-Pillar Weekly AI Developmental Growth Reports -->
      ${
        activeAdminTab === 'reports'
          ? `
        <section class="flex flex-col gap-6 animate-fade-in printable-report-area">
          
          <!-- Header Banner -->
          <div class="bg-surface-container rounded-3xl p-5 sm:p-6 border-2 border-primary/40 card-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-2xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-2xl shadow flex-shrink-0">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">psychology</span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="font-headline text-lg sm:text-xl font-black text-inverse-surface">Weekly AI Developmental Summaries</h2>
                  <span class="bg-primary/20 text-primary text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-primary/40">Gemini 2.5 Flash</span>
                </div>
                <p class="text-xs text-on-surface-variant font-bold">Holistic 4-pillar evaluation: Independence, Cognitive Milestones, Emotional Wellness & Parenting Advice</p>
              </div>
            </div>

            <div class="flex items-center gap-2 w-full sm:w-auto">
              <button id="report-regenerate-btn" class="flex-1 sm:flex-none bg-primary text-on-primary font-headline text-xs font-black px-4 py-2.5 rounded-xl chunky-btn-sm border border-primary-container shadow-sm flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-95">
                <span class="material-symbols-outlined text-sm ${isLoadingReport ? 'animate-spin' : ''}">refresh</span>
                <span>${isLoadingReport ? 'Analyzing...' : 'Regenerate Analysis'}</span>
              </button>
              <button id="report-print-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-black px-3.5 py-2.5 rounded-xl border border-surface-container-highest active:scale-95 flex items-center gap-1" title="Export or print report">
                <span class="material-symbols-outlined text-sm">print</span>
                <span>Print / Export</span>
              </button>
            </div>
          </div>

          <!-- Controls: Kid Selector & Week Selector -->
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <!-- Multi-Kid Pills -->
            <div class="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar w-full sm:w-auto">
              <button data-report-kid="all" class="report-kid-pill px-4 py-2 rounded-2xl text-xs font-headline font-black transition-all ${
                selectedReportKidId === 'all'
                  ? 'bg-primary text-on-primary chunky-btn-sm shadow-sm'
                  : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border border-surface-container-highest'
              }">
                👨‍👩‍👧‍👦 All Kids
              </button>
              ${heroes
                .map(
                  (h) => `
                <button data-report-kid="${h.id}" class="report-kid-pill px-4 py-2 rounded-2xl text-xs font-headline font-black transition-all flex items-center gap-2 ${
                  selectedReportKidId === h.id
                    ? 'bg-primary text-on-primary chunky-btn-sm shadow-sm'
                    : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border border-surface-container-highest'
                }">
                  <img src="${h.avatar}" class="w-5 h-5 rounded-full object-cover border border-white/40" />
                  <span>${h.name}</span>
                </button>
              `
                )
                .join('')}
            </div>

            <!-- Week Selector -->
            <div class="flex items-center gap-2 self-end sm:self-auto">
              <label class="text-xs font-bold text-on-surface-variant">Timeframe:</label>
              <select id="report-week-select" class="bg-surface-container border border-surface-container-highest rounded-xl px-3 py-1.5 text-xs font-bold text-inverse-surface outline-none">
                <option value="0" ${selectedReportWeekOffset === 0 ? 'selected' : ''}>This Week (Current)</option>
                <option value="1" ${selectedReportWeekOffset === 1 ? 'selected' : ''}>Last Week</option>
                <option value="2" ${selectedReportWeekOffset === 2 ? 'selected' : ''}>2 Weeks Ago</option>
              </select>
            </div>
          </div>

          <!-- 4 Pillars Cards -->
          ${(() => {
            const reportHero = selectedReportKidId === 'all' ? null : heroes.find((h) => h.id === selectedReportKidId);
            const gameLogs = completionLogs.filter(l => l.zone === 'Adventure Learning Games');
            const totalGames = gameLogs.length;
            const totalGameStars = gameLogs.reduce((acc, l) => acc + (l.starsEarned || 1), 0);
            const uniqueSubjects = Array.from(new Set(gameLogs.map(l => l.subject).filter(Boolean)));

            const movementLogs = completionLogs.filter(l => l.zone === 'Gross Motor & Dance Party' || l.category === 'gross_motor');
            const totalMovementMinutes = movementLogs.reduce((acc, l) => acc + (l.durationMinutes || 2), 0);
            const totalMovementSessions = movementLogs.length;
            const feverBursts = movementLogs.reduce((acc, l) => acc + (l.feverBursts || 0), 0);

            const report = currentDevelopmentalReport || aiDevelopmentalReportService.formatFourPillarReport({
              childName: reportHero ? reportHero.name : 'The Little Heroes Household',
              weekKey: '2026-W37',
              weekLabel: selectedReportWeekOffset === 0 ? 'This Week (Current)' : selectedReportWeekOffset === 1 ? 'Last Week' : '2 Weeks Ago',
              totalChores: completionLogs.length || 14,
              approvedChores: completionLogs.filter(l => l.status === 'approved').length || 12,
              morningRoutines: 6,
              hygieneBattles: 10,
              totalGames,
              totalGameStars,
              uniqueSubjects,
              totalMovementMinutes,
              totalMovementSessions,
              feverBursts,
              petJoy: state.petStatsMap?.[1]?.joy || 88,
              petHygiene: state.petStatsMap?.[1]?.hygiene || 92
            });

            return `
            <!-- Overall Summary Banner -->
            <div class="bg-gradient-to-r from-secondary/15 via-surface-container to-primary/15 rounded-3xl p-5 border-2 border-secondary-container/60 card-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <span class="text-3xl">🌟</span>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-headline text-base font-black text-inverse-surface">${report.childName}</h3>
                    <span class="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                      ${report.overallRating}
                    </span>
                  </div>
                  <p class="text-xs text-on-surface-variant font-bold">${report.weekLabel} • Synthesized ${report.generatedAt}</p>
                </div>
              </div>

              <div class="flex items-center gap-3 bg-surface-container-high px-4 py-2 rounded-2xl border border-surface-container-highest self-end sm:self-auto">
                <span class="text-xs font-bold text-on-surface-variant">Overall Consistency:</span>
                <span class="font-headline text-lg font-black text-primary">${report.consistencyScore}%</span>
              </div>
            </div>

            <!-- 4 Pillar Cards Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${report.pillars.map((pillar) => `
                <div class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col justify-between gap-4">
                  <div class="flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center text-xl">
                          <span class="material-symbols-outlined">${pillar.icon}</span>
                        </div>
                        <h4 class="font-headline text-sm font-black text-inverse-surface">${pillar.name}</h4>
                      </div>
                      <span class="bg-secondary/15 text-secondary text-[10px] font-black px-2.5 py-0.5 rounded-full border border-secondary/30">
                        ${pillar.status}
                      </span>
                    </div>

                    <p class="text-xs text-on-surface-variant font-medium leading-relaxed">
                      ${pillar.summary}
                    </p>

                    ${pillar.metrics ? `
                      <div class="grid grid-cols-3 gap-2 bg-surface-container-lowest/80 p-2.5 rounded-2xl border border-surface-container-highest text-center">
                        ${pillar.metrics.map(m => `
                          <div class="flex flex-col">
                            <span class="text-[8px] text-on-surface-variant font-black uppercase">${m.label}</span>
                            <span class="font-headline text-xs font-black text-primary mt-0.5">${m.value}</span>
                          </div>
                        `).join('')}
                      </div>
                    ` : ''}

                    ${pillar.recommendations ? `
                      <div class="flex flex-col gap-1.5 pt-1">
                        <span class="text-[10px] font-black uppercase text-secondary tracking-wider">Parent Guidance Highlights</span>
                        <ul class="flex flex-col gap-1.5 text-xs text-on-surface-variant font-medium">
                          ${pillar.recommendations.map(r => `
                            <li class="flex items-start gap-1.5"><span class="text-sky-400">💡</span><span>${r}</span></li>
                          `).join('')}
                        </ul>
                      </div>
                    ` : ''}
                  </div>

                  ${pillar.recommendedReward ? `
                    <div class="bg-amber-400/10 border border-amber-400/30 p-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-amber-300">
                      <span class="text-xl">🎁</span>
                      <div class="flex flex-col">
                        <span class="text-[9px] uppercase font-black tracking-wider text-amber-400">Recommended Bonding Reward</span>
                        <span class="text-inverse-surface">${pillar.recommendedReward}</span>
                      </div>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
            `;
          })()}

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
              <button id="admin-sync-now-btn" class="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-headline text-xs font-black px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all shadow-sm" title="Perform a real-time data pull to verify device data is synced across all family devices">
                <span class="material-symbols-outlined text-sm">sync</span>
                Sync Now
              </button>
              <button id="admin-link-household-btn" class="bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-xs font-black px-3.5 py-2.5 rounded-xl border border-surface-container-highest flex items-center gap-1.5 active:scale-95">
                <span class="material-symbols-outlined text-sm">devices</span>
                Device Link
              </button>
              <button id="admin-remove-test-data-btn" class="bg-surface-container-high hover:bg-error/20 hover:text-error text-on-surface-variant font-headline text-xs font-black px-3 py-2.5 rounded-xl border border-surface-container-highest flex items-center gap-1.5 active:scale-95 transition-colors" title="Remove all default test kids and start with fresh family">
                <span class="material-symbols-outlined text-sm">mop</span>
                Remove Test Kids
              </button>
            </div>
          </div>

          <!-- Parent Administrators & Access Control Card -->
          <div class="bg-surface-container rounded-3xl p-5 sm:p-6 border-2 border-secondary-container card-shadow flex flex-col gap-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-surface-container-highest pb-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-secondary/20 text-secondary border border-secondary/40 flex items-center justify-center text-xl shadow-sm flex-shrink-0">
                  <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">shield_person</span>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-headline text-base sm:text-lg font-black text-inverse-surface">Parent Administrators (${(state.household.parents || []).length})</h3>
                    <span class="bg-secondary/20 text-secondary text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-secondary/30">Admins</span>
                  </div>
                  <p class="text-xs text-on-surface-variant font-bold">Authorized adult users who can approve quests, adjust ⭐ balances, and edit safety settings.</p>
                </div>
              </div>

              <button id="admin-add-parent-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2.5 rounded-xl chunky-btn-sm border-secondary-container flex items-center gap-1.5 active:scale-95 hover:brightness-110 shadow-sm">
                <span class="material-symbols-outlined text-sm">person_add</span>
                Add Parent User
              </button>
            </div>

            <!-- Parents List Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              ${(state.household.parents || []).map((p) => {
                const isCurrent = (state.household.parentUser?.email && p.email && state.household.parentUser.email.toLowerCase() === p.email.toLowerCase()) || (state.household.parentUser?.uid && p.uid && state.household.parentUser.uid === p.uid);
                const isOwner = p.role === 'owner';
                const canRemove = (state.household.parents || []).length > 1;
                return `
                  <div class="bg-surface-container-high rounded-2xl p-3.5 border-2 border-surface-container-highest flex items-center justify-between gap-3 shadow-inner">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-black text-sm flex-shrink-0 shadow-sm">
                        ${(p.displayName || p.email || 'P')[0].toUpperCase()}
                      </div>
                      <div class="flex flex-col min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="font-headline text-xs font-black text-inverse-surface truncate">${p.displayName || 'Parent Admin'}</span>
                          ${isCurrent ? `<span class="bg-primary/20 text-primary text-[9px] font-black px-1.5 py-0.2 rounded border border-primary/40">You</span>` : ''}
                        </div>
                        <span class="text-[10px] text-on-surface-variant truncate">${p.email || 'Admin'}</span>
                        <span class="text-[9px] font-bold text-secondary uppercase tracking-wider">${isOwner ? '👑 Household Owner' : '🛡️ Co-Parent Admin'}</span>
                      </div>
                    </div>

                    ${canRemove ? `
                      <button data-remove-parent="${p.uid || p.email}" class="remove-parent-btn text-on-surface-variant hover:text-error p-1.5 rounded-lg active:scale-95 transition-colors" title="Remove parent administrator access">
                        <span class="material-symbols-outlined text-base">delete</span>
                      </button>
                    ` : ''}
                  </div>
                `;
              }).join('')}
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
                      <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700/50 shadow-inner flex-shrink-0">
                        <span class="material-symbols-outlined text-2xl select-none" style="font-variation-settings: 'FILL' 1;">
                          ${t.icon || 'star'}
                        </span>
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

      <!-- TAB 5: Multi-Category 3D Studio & AI Crafting Engine -->
      ${
        activeAdminTab === 'studio'
          ? (() => {
              const publishedCustomGear = store.getParentCustomGear ? store.getParentCustomGear() : [];
              const publishedCustomFurniture = store.getParentCustomFurniture ? store.getParentCustomFurniture() : [];
              const publishedCustomToys = store.getParentCustomToys ? store.getParentCustomToys() : [];
              const publishedCustomBosses = store.getParentCustomBosses ? store.getParentCustomBosses() : [];
              const publishedCustomPets = store.getPetSanctuaryState ? (store.getPetSanctuaryState().unhatchedEggs || []) : [];

              const categoryTabs = [
                { id: 'gear', label: 'Pet Wearable Gear', emoji: '🛡️', count: publishedCustomGear.length, desc: 'Costumes, capes, boots & visors' },
                { id: 'furniture', label: 'Hero HQ Furniture', emoji: '🛋️', count: publishedCustomFurniture.length, desc: 'Beds, desks, lounges & rugs' },
                { id: 'toy', label: 'Pet Pen Toys', emoji: '🎾', count: publishedCustomToys.length, desc: 'Trampolines, balls & puzzles' },
                { id: 'boss', label: 'AR Quest Bosses', emoji: '👾', count: publishedCustomBosses.length, desc: 'Hygiene, dental & bedtime villains' },
                { id: 'pet', label: '3D Pet Companions', emoji: '🐾', count: publishedCustomPets.length, desc: '6 Archetypes, Habit Bond Perks & Magic Eggs' }
              ];

              const petModels = [
                { id: 1, name: 'Rex', emoji: '🦖' },
                { id: 2, name: 'Aqua', emoji: '🌊' },
                { id: 3, name: 'Bella', emoji: '🐰' },
                { id: 4, name: 'Barnaby', emoji: '🐻' },
                { id: 5, name: 'Pip', emoji: '🦅' }
              ];

              const gearThemes = [
                { key: 'cyber', label: '⚡ Cyber Neon', color: '#06b6d4', desc: 'Holographic visors & electric energy' },
                { key: 'fire', label: '🔥 Dragon Fire', color: '#f97316', desc: 'Molten embers & phoenix tiaras' },
                { key: 'rainbow', label: '🦄 Rainbow Sparkle', color: '#ec4899', desc: 'Starlight bands & magical confetti' },
                { key: 'space', label: '🚀 Deep Space', color: '#3b82f6', desc: 'Jetpack thrusters & cosmic cloaks' },
                { key: 'royal', label: '👑 Royal Fantasy', color: '#fbbf24', desc: 'Regal golden crowns & armor' },
                { key: 'ocean', label: '🌊 Ocean Glider', color: '#10b981', desc: 'Aero wings & hydro power harnesses' }
              ];

              const furnitureThemes = [
                { key: 'cozy_bed', label: '🛏️ Cozy Starlight Bed', type: 'bed', zone: 'bedroom', comfort: 30, desc: 'Super soft leaf canopy dream bed' },
                { key: 'gamer_desk', label: '🎮 Holo Gaming Station', type: 'desk', zone: 'command_deck', comfort: 25, desc: 'Neon RGB desk with mission hologram' },
                { key: 'throne_lounge', label: '👑 Royal Pet Throne', type: 'petLounge', zone: 'lounge', comfort: 35, desc: 'Velvet beanbag couch for royal pets' },
                { key: 'hero_rug', label: '🌈 Rainbow Portal Rug', type: 'rug', zone: 'lounge', comfort: 20, desc: 'Vibrant woven floor portal' },
                { key: 'trophy_stand', label: '🏆 Champion Trophy Pedestal', type: 'decor', zone: 'trophy_hall', comfort: 20, desc: 'Golden pedestal displaying heroic deeds' }
              ];

              const toyThemes = [
                { key: 'trampoline', label: '🎪 Anti-Gravity Trampoline', type: 'trampoline', stat: 'joy', amount: 35, desc: 'Super bouncy spring mat' },
                { key: 'ball_launcher', label: '🚀 Turbo Ball Cannon', type: 'ball', stat: 'energy', amount: 30, desc: 'Launches glowing tennis balls' },
                { key: 'laser_mouse', label: '✨ Starlight Laser Pointer', type: 'laser', stat: 'joy', amount: 25, desc: 'Dancing laser beam that pets chase' },
                { key: 'treat_puzzle', label: '🧩 Magic Treat Puzzle Box', type: 'puzzle', stat: 'hunger', amount: 40, desc: 'Brain game dispensing healthy snacks' },
                { key: 'agility_ramp', label: '⚡ Agility Loop Obstacle', type: 'agility', stat: 'all', amount: 25, desc: 'Fun obstacle course for speed practice' }
              ];

                            const petThemes = [
                { key: 'dino', label: '🦖 Emerald Rex', archetype: 'dino', color: '#2ecc71', desc: 'Armored plates & tough habit resilience' },
                { key: 'dragon', label: '🔥 Ember Drake', archetype: 'dragon', color: '#f39c12', desc: 'Miniature wings & +25% expedition fuel' },
                { key: 'beast', label: '🐻 Barnaby Pup', archetype: 'beast', color: '#ffb961', desc: 'Super soft ears & high treat joy' },
                { key: 'aquatic', label: '🌊 Hydro Turtle', archetype: 'aquatic', color: '#00d2d3', desc: 'Glowing shell & long Pearly Gleam' },
                { key: 'robot', label: '🤖 Byte Bot', archetype: 'robot', color: '#48dbfb', desc: 'LED visor & +30% Colosseum assist' },
                { key: 'mystic', label: '✨ Stella Fawn', archetype: 'mystic', color: '#2ecc71', desc: 'Starlight horns & +1 daily spark' }
              ];

              const bossThemes = [
                { key: 'sugar_monster', label: '🍬 Plaque Sugar King', domain: 'dental', hp: 280, coins: 65, desc: 'Villain made of sticky sugar cubes' },
                { key: 'bedtime_gremlin', label: '⏰ Bedtime Delay Gremlin', domain: 'bedtime', hp: 240, coins: 50, desc: 'Tries to keep kids up past bedtime' },
                { key: 'screen_slime', label: '📱 Screen Slime Fiend', domain: 'screens', hp: 320, coins: 75, desc: 'Zombie screen fiend that hypnotizes' },
                { key: 'veggie_dodger', label: '🥦 Brocc-O-Hater Ghoul', domain: 'nutrition', hp: 200, coins: 45, desc: 'Sneaks sweets to replace crunchy veggies' }
              ];

              const socketPills = [
                { key: 'head', label: 'Headgear', emoji: '👑' },
                { key: 'back', label: 'Cape / Back', emoji: '🦸' },
                { key: 'chest', label: 'Armor Plate', emoji: '🛡️' },
                { key: 'feet', label: 'Hero Boots', emoji: '⚡' }
              ];

              const presetsForCategory = SPLINE_3D_PRESETS[studioActiveCategory] || [];

              return `
        <section class="flex flex-col gap-6 animate-fade-in">
          
          <!-- Top Studio Header Banner -->
          <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 rounded-3xl p-6 border-2 border-amber-400/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white">
            <div class="flex items-center gap-3.5">
              <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center text-3xl shadow-lg border-2 border-white/20">
                ✨
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="font-headline text-xl sm:text-2xl font-black text-amber-300">3D Pet Gear & Prop Studio (Multi-Category 3D)</h2>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400/20 text-amber-300 border border-amber-400/40">Hybrid 3D Engine</span>
                </div>
                <p class="text-xs text-slate-300 mt-0.5">Design wearable gear, Hero HQ furniture, Pet Pen toys & AR Quest bosses with live procedural canvas + Spline 3D scenes!</p>
              </div>
            </div>

            <!-- Published Counts Summary Pill -->
            <div class="flex flex-wrap items-center gap-2 self-end sm:self-auto">
              <span class="px-3 py-1.5 rounded-xl bg-slate-800/90 text-amber-300 border border-amber-400/30 text-xs font-bold flex items-center gap-1.5 shadow">
                <span class="material-symbols-outlined text-sm">inventory_2</span>
                <span>${publishedCustomGear.length + publishedCustomFurniture.length + publishedCustomToys.length + publishedCustomBosses.length} Total Published Creations</span>
              </span>
            </div>
          </div>

          <!-- 4-Mode Category Navigation Switcher -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            ${categoryTabs.map(tab => {
              const isSelected = studioActiveCategory === tab.id;
              return `
              <button 
                class="studio-category-pill p-3.5 rounded-2xl font-headline text-xs font-black transition-all active:scale-95 flex flex-col items-center gap-1 border-2 text-center ${
                  isSelected 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-white shadow-lg scale-102 ring-2 ring-amber-400' 
                    : 'bg-surface-container hover:bg-surface-bright text-inverse-surface border-surface-container-highest'
                }"
                data-category="${tab.id}"
              >
                <div class="flex items-center gap-1.5 text-base">
                  <span>${tab.emoji}</span>
                  <span class="font-black">${tab.label}</span>
                </div>
                <span class="text-[10px] ${isSelected ? 'text-slate-900 font-black' : 'text-on-surface-variant font-medium'}">
                  ${tab.count} Published • ${tab.desc}
                </span>
              </button>
              `;
            }).join('')}
          </div>

          <!-- Quick Theme / Sparks Chips for Active Category -->
          <div class="bg-surface-container rounded-3xl p-4 border border-surface-container-highest shadow-sm">
            <div class="flex items-center justify-between mb-2.5">
              <span class="text-xs font-black uppercase text-on-surface-variant flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sm text-secondary">flash_on</span>
                <span>Quick Sparks Theme Wizard (${studioActiveCategory.toUpperCase()})</span>
              </span>
              <span class="text-[11px] text-on-surface-variant">Tap any spark to auto-inspire 3D models, stats & spoken voice lines</span>
            </div>
            
            <div class="flex flex-wrap items-center gap-2">
              ${studioActiveCategory === 'gear' ? 
                gearThemes.map(t => `
                  <button class="studio-spark-chip px-3.5 py-2 rounded-2xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 border-2 ${studioSelectedTheme === t.key ? 'bg-secondary text-on-secondary border-secondary-container shadow-md scale-102' : 'bg-surface-container-high hover:bg-surface-bright text-inverse-surface border-surface-container-highest'}" data-spark="${t.key}" data-category="gear" title="${t.desc}">
                    <span>${t.label}</span>
                  </button>
                `).join('')
              : studioActiveCategory === 'furniture' ?
                furnitureThemes.map(t => `
                  <button class="studio-spark-chip px-3.5 py-2 rounded-2xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 border-2 ${studioFurnitureType === t.type ? 'bg-secondary text-on-secondary border-secondary-container shadow-md scale-102' : 'bg-surface-container-high hover:bg-surface-bright text-inverse-surface border-surface-container-highest'}" data-spark="${t.key}" data-category="furniture" title="${t.desc}">
                    <span>${t.label}</span>
                  </button>
                `).join('')
              : studioActiveCategory === 'toy' ?
                toyThemes.map(t => `
                  <button class="studio-spark-chip px-3.5 py-2 rounded-2xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 border-2 ${studioToyType === t.type ? 'bg-secondary text-on-secondary border-secondary-container shadow-md scale-102' : 'bg-surface-container-high hover:bg-surface-bright text-inverse-surface border-surface-container-highest'}" data-spark="${t.key}" data-category="toy" title="${t.desc}">
                    <span>${t.label}</span>
                  </button>
                `).join('')
              :
                bossThemes.map(t => `
                  <button class="studio-spark-chip px-3.5 py-2 rounded-2xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 border-2 ${studioBossDomain === t.domain ? 'bg-secondary text-on-secondary border-secondary-container shadow-md scale-102' : 'bg-surface-container-high hover:bg-surface-bright text-inverse-surface border-surface-container-highest'}" data-spark="${t.key}" data-category="boss" title="${t.desc}">
                    <span>${t.label}</span>
                  </button>
                `).join('')
              }
            </div>
          </div>

          <!-- Studio Main Stage: 2-Column Responsive Layout -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            <!-- Left Column: Adaptive 3D Viewport & Preview Stage (5 cols) -->
            <div class="lg:col-span-5 bg-gradient-to-b from-slate-900/95 via-indigo-950/90 to-slate-900/95 rounded-3xl p-5 border-2 border-amber-400/40 shadow-2xl flex flex-col items-center gap-4 text-white">
              
              <!-- Viewport Mode Switcher & Category Status -->
              <div class="w-full flex items-center justify-between border-b border-amber-400/20 pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-black text-amber-300 uppercase tracking-wider">
                    ${studioActiveCategory === 'gear' ? 'Companion Catwalk' : studioActiveCategory === 'furniture' ? 'Hero HQ Room Stage' : studioActiveCategory === 'toy' ? 'Pet Pen Playstage' : 'AR Battle Colosseum'}
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${studioViewportMode === 'spline' ? 'bg-purple-500/30 text-purple-300 border border-purple-400/50' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}">
                    ${studioViewportMode === 'spline' ? '✨ Spline 3D' : '🎨 Procedural 3D'}
                  </span>
                </div>

                <!-- Triple Viewport Toggle Buttons -->
                <div class="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-white/10">
                  <button 
                    id="studio-mode-canvas-btn" 
                    class="px-2.5 py-1 rounded-lg text-xs font-black transition-all ${studioViewportMode === 'canvas' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-300 hover:text-white'}"
                    title="Switch to Procedural 3D Canvas"
                  >
                    Canvas
                  </button>
                  <button 
                    id="studio-mode-modelviewer-btn" 
                    class="px-2.5 py-1 rounded-lg text-xs font-black transition-all ${studioViewportMode === 'modelviewer' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-300 hover:text-white'}"
                    title="Switch to 3D GLB Model Viewer (with WebXR AR)"
                  >
                    3D GLB
                  </button>
                  <button 
                    id="studio-mode-spline-btn" 
                    class="px-2.5 py-1 rounded-lg text-xs font-black transition-all ${studioViewportMode === 'spline' ? 'bg-purple-500 text-white shadow' : 'text-slate-300 hover:text-white'}"
                    title="Switch to Spline 3D Scene View"
                  >
                    Spline
                  </button>
                </div>
              </div>

              <!-- Companion Switcher (When in Gear mode) -->
              ${studioActiveCategory === 'gear' ? `
                <div class="w-full flex items-center justify-between px-1">
                  <span class="text-[11px] text-slate-300 font-bold">Companion Model:</span>
                  <div class="flex items-center gap-1">
                    ${petModels.map(p => `
                      <button 
                        class="studio-pet-btn w-7 h-7 rounded-xl text-sm flex items-center justify-center transition-all active:scale-95 border ${studioSelectedPetId === p.id ? 'bg-amber-400 text-slate-950 font-black border-white shadow-md scale-110' : 'bg-slate-800/80 hover:bg-slate-700 text-white border-white/20'}"
                        data-pet-id="${p.id}"
                        title="${p.name}"
                      >
                        ${p.emoji}
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <!-- Adaptive 3D Viewport Container -->
              <div class="relative w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden bg-radial from-indigo-900/60 via-slate-900/90 to-black border-2 border-amber-400/30 shadow-2xl flex items-center justify-center group">
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.18)_0%,rgba(99,102,241,0.08)_50%,transparent_75%)] pointer-events-none"></div>

                <!-- 1. Procedural 3D Canvas -->
                <canvas 
                  id="parent-ai-preview-canvas" 
                  width="320" 
                  height="320" 
                  class="relative z-10 w-full h-full object-contain cursor-grab active:cursor-grabbing touch-none ${studioViewportMode === 'canvas' ? 'block' : 'hidden'}"
                  aria-label="Parent Multi-Category 3D Live Stage"
                ></canvas>

                <!-- 2. Google <model-viewer> 3D GLB Container -->
                <div 
                  id="parent-ai-model-viewer-container"
                  class="relative z-10 w-full h-full flex items-center justify-center ${studioViewportMode === 'modelviewer' ? 'block' : 'hidden'}"
                >
                  <model-viewer
                    id="parent-ai-model-viewer"
                    src="${studioActiveModelUrl}"
                    alt="${studioItemName || '3D Model'}"
                    auto-rotate
                    camera-controls
                    shadow-intensity="1.2"
                    ar
                    ar-modes="webxr scene-viewer quick-look"
                    style="width: 100%; height: 100%; background: transparent;"
                  >
                    <button slot="ar-button" class="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-lg hover:scale-105 transition-all">
                      📱 View in Room
                    </button>
                  </model-viewer>
                </div>

                <!-- 3. Spline 3D Interactive Scene Container -->
                <div 
                  id="parent-ai-spline-container" 
                  class="relative z-10 w-full h-full flex flex-col items-center justify-center p-3 text-center ${studioViewportMode === 'spline' ? 'block' : 'hidden'}"
                >
                  ${studioActiveSplineUrl ? `
                    <iframe 
                      src="${studioActiveSplineUrl}" 
                      class="w-full h-full rounded-2xl border-0" 
                      allow="fullscreen"
                      loading="lazy"
                      title="Spline 3D Scene View"
                    ></iframe>
                  ` : `
                    <div class="flex flex-col items-center justify-center gap-2 text-center p-4">
                      <div class="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center text-3xl border border-purple-400/40 animate-pulse">
                        🎨
                      </div>
                      <h4 class="font-headline text-sm font-black text-purple-300">Spline 3D Scene Viewer</h4>
                      <p class="text-[11px] text-slate-300 max-w-[240px]">
                        Select a curated preset below or paste any custom Spline scene URL to load the high-fidelity 3D model!
                      </p>
                    </div>
                  `}
                </div>

                <!-- Stage Floor Reflection line -->
                <div class="absolute bottom-4 left-1/2 -translate-x-1/2 w-44 h-2.5 rounded-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent blur-xs pointer-events-none"></div>
              </div>

              
              <!-- Curated 3D Asset Carousel from threeDAssetCatalog -->
              <div class="w-full p-3 bg-slate-800/80 rounded-2xl border border-amber-400/30 flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">view_in_ar</span>
                    <span>Curated 3D Asset Library (${studioActiveCategory.toUpperCase()})</span>
                  </span>
                  <span class="text-[10px] text-slate-400">PBR & WebXR AR</span>
                </div>
                <div class="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                  ${getThreeDAssetsByCategory(studioActiveCategory).map(asset => `
                    <button 
                      type="button"
                      class="studio-3d-asset-card p-2 rounded-xl text-left transition-all border ${studioActive3DAssetId === asset.id ? 'bg-amber-400/20 border-amber-400 shadow-sm' : 'bg-slate-900/80 border-slate-700 hover:border-slate-500'}"
                      data-asset-id="${asset.id}"
                      data-model-url="${asset.modelUrl || ''}"
                      data-spline-url="${asset.splineUrl || ''}"
                      data-asset-name="${asset.name}"
                    >
                      <div class="flex items-center gap-1.5 mb-1">
                        <span class="text-xl">${asset.emoji}</span>
                        <span class="text-xs font-black text-white truncate flex-1">${asset.name}</span>
                      </div>
                      <div class="flex items-center justify-between text-[10px] text-slate-400">
                        <span class="text-amber-300 font-bold">${asset.badge}</span>
                        <span>⚡ ${asset.defaultMultiplier ? `+${Math.round((asset.defaultMultiplier - 1) * 100)}%` : '3D'}</span>
                      </div>
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- Spline 3D Toolbar: Curated Presets & Custom URL Input -->
              <div class="w-full p-3 bg-slate-800/80 rounded-2xl border border-purple-400/30 flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">view_in_ar</span>
                    <span>Spline 3D Preset Library</span>
                  </span>
                  <span class="text-[10px] text-slate-400">Curated & Custom</span>
                </div>

                <!-- Presets Dropdown -->
                <select id="studio-spline-preset-select" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs font-bold text-amber-300 focus:outline-none focus:border-purple-400">
                  <option value="">Choose a Curated Spline 3D Preset...</option>
                  ${presetsForCategory.map(p => `
                    <option value="${p.splineUrl}" ${studioActiveSplineUrl === p.splineUrl ? 'selected' : ''}>
                      ${p.name}
                    </option>
                  `).join('')}
                </select>

                <!-- Custom Spline Scene URL Input & Test Button -->
                <div class="flex gap-1.5 mt-1">
                  <input 
                    id="studio-spline-url-input" 
                    type="url" 
                    value="${studioActiveSplineUrl}" 
                    placeholder="https://prod.spline.design/..." 
                    class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-purple-400"
                  />
                  <button 
                    id="studio-spline-load-btn" 
                    class="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black px-3 py-1.5 rounded-xl transition-all active:scale-95 shadow shrink-0"
                    title="Load Spline Scene"
                  >
                    Load 3D
                  </button>
                </div>
              </div>

              <!-- Category-Specific Stage Controls -->
              ${studioActiveCategory === 'gear' ? `
                <!-- Target Socket Selector -->
                <div class="w-full">
                  <p class="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-xs">extension</span>
                    <span>Target Attachment Socket</span>
                  </p>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    ${socketPills.map(s => `
                      <button 
                        class="studio-socket-btn px-2.5 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1 border ${studioSelectedSocket === s.key ? 'bg-amber-400 text-slate-950 border-white shadow-md scale-102' : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-white/20'}"
                        data-socket="${s.key}"
                      >
                        <span>${s.emoji}</span>
                        <span>${s.label}</span>
                      </button>
                    `).join('')}
                  </div>
                </div>

                <!-- Superhero Color Dye Palette -->
                <div class="w-full p-2.5 bg-slate-800/60 rounded-2xl border border-slate-700/60">
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                      <span class="material-symbols-outlined text-xs">palette</span>
                      <span>Superhero Dye Swatch</span>
                    </span>
                    <span class="text-[10px] text-slate-400">Live Tint</span>
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5">
                    ${COLOR_DYES.map(dye => {
                      const isDyeActive = studioSelectedDye === dye.hex;
                      return `
                      <button 
                        class="studio-dye-btn w-7 h-7 rounded-full border-2 transition-transform hover:scale-115 active:scale-95 shadow flex items-center justify-center ${isDyeActive ? 'border-white ring-2 ring-amber-400 scale-110' : 'border-white/30'}"
                        style="background-color: ${dye.hex};"
                        data-hex="${dye.hex}"
                        title="${dye.name}"
                      >
                        ${isDyeActive ? '<span class="text-white text-[10px] font-black drop-shadow">✓</span>' : ''}
                      </button>
                      `;
                    }).join('')}
                  </div>
                </div>

                <!-- Catwalk Poses -->
                <div class="w-full">
                  <p class="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-xs">sports_gymnastics</span>
                    <span>Test Heroic Catwalk Poses</span>
                  </p>
                  <div class="grid grid-cols-3 gap-1.5">
                    <button class="studio-pose-btn px-2 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 text-xs font-bold text-slate-200 transition-all active:scale-95 flex items-center justify-center gap-1" data-pose="hero_landing"><span>🦸</span><span>Landing</span></button>
                    <button class="studio-pose-btn px-2 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 text-xs font-bold text-slate-200 transition-all active:scale-95 flex items-center justify-center gap-1" data-pose="wing_flare"><span>✨</span><span>Flare</span></button>
                    <button class="studio-pose-btn px-2 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 text-xs font-bold text-slate-200 transition-all active:scale-95 flex items-center justify-center gap-1" data-pose="spin_360"><span>🔄</span><span>Spin</span></button>
                    <button class="studio-pose-btn px-2 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 text-xs font-bold text-slate-200 transition-all active:scale-95 flex items-center justify-center gap-1" data-pose="hero_salute"><span>🫡</span><span>Salute</span></button>
                    <button class="studio-pose-btn px-2 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 text-xs font-bold text-slate-200 transition-all active:scale-95 flex items-center justify-center gap-1" data-pose="runway_walk"><span>🚶</span><span>Strut</span></button>
                    <button class="studio-pose-btn px-2 py-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 text-xs font-bold text-slate-200 transition-all active:scale-95 flex items-center justify-center gap-1" data-pose="idle"><span>🧍</span><span>Idle</span></button>
                  </div>
                </div>
              ` : studioActiveCategory === 'furniture' ? `
                <!-- Target HQ Room Zone -->
                <div class="w-full">
                  <label class="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-2 block">Hero HQ Room Zone</label>
                  <div class="grid grid-cols-2 gap-2">
                    <button class="studio-zone-btn p-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${studioFurnitureZone === 'bedroom' ? 'bg-amber-400 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700'}" data-zone="bedroom">
                      <span>🛏️</span><span>Bedroom</span>
                    </button>
                    <button class="studio-zone-btn p-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${studioFurnitureZone === 'command_deck' ? 'bg-amber-400 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700'}" data-zone="command_deck">
                      <span>💻</span><span>Command Deck</span>
                    </button>
                    <button class="studio-zone-btn p-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${studioFurnitureZone === 'lounge' ? 'bg-amber-400 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700'}" data-zone="lounge">
                      <span>🛋️</span><span>Hero Lounge</span>
                    </button>
                    <button class="studio-zone-btn p-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${studioFurnitureZone === 'trophy_hall' ? 'bg-amber-400 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700'}" data-zone="trophy_hall">
                      <span>🏆</span><span>Trophy Hall</span>
                    </button>
                  </div>
                </div>
              ` : studioActiveCategory === 'toy' ? `
                <!-- Target Stat Refill Selector -->
                <div class="w-full">
                  <label class="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-2 block">Pet Need Refilled</label>
                  <div class="grid grid-cols-2 gap-2">
                    <button class="studio-toy-stat-btn p-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${studioToyStat === 'joy' ? 'bg-amber-400 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700'}" data-stat="joy">
                      <span>💖</span><span>Joy (+Happy)</span>
                    </button>
                    <button class="studio-toy-stat-btn p-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${studioToyStat === 'energy' ? 'bg-amber-400 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700'}" data-stat="energy">
                      <span>⚡</span><span>Energy (+Stamina)</span>
                    </button>
                    <button class="studio-toy-stat-btn p-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${studioToyStat === 'hunger' ? 'bg-amber-400 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700'}" data-stat="hunger">
                      <span>🍎</span><span>Snack / Fullness</span>
                    </button>
                    <button class="studio-toy-stat-btn p-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${studioToyStat === 'all' ? 'bg-amber-400 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700'}" data-stat="all">
                      <span>✨</span><span>All Stats Refill</span>
                    </button>
                  </div>
                </div>
              ` : `
                <!-- Boss Habit Domain -->
                <div class="w-full">
                  <label class="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-2 block">Habit & Routine Domain</label>
                  <div class="grid grid-cols-2 gap-2">
                    <button class="studio-boss-domain-btn p-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${studioBossDomain === 'dental' ? 'bg-amber-400 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700'}" data-domain="dental">
                      <span>🪥</span><span>Dental Care</span>
                    </button>
                    <button class="studio-boss-domain-btn p-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${studioBossDomain === 'bedtime' ? 'bg-amber-400 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700'}" data-domain="bedtime">
                      <span>🌙</span><span>Bedtime Routine</span>
                    </button>
                    <button class="studio-boss-domain-btn p-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${studioBossDomain === 'screens' ? 'bg-amber-400 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700'}" data-domain="screens">
                      <span>📱</span><span>Screen Limits</span>
                    </button>
                    <button class="studio-boss-domain-btn p-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${studioBossDomain === 'nutrition' ? 'bg-amber-400 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700'}" data-domain="nutrition">
                      <span>🥦</span><span>Healthy Nutrition</span>
                    </button>
                  </div>

                  <!-- Toothbrush Battle Dental Controls (When Dental Domain selected) -->
                  ${studioBossDomain === 'dental' ? `
                    <div class="mt-3 pt-3 border-t border-slate-700/60 flex flex-col gap-2.5">
                      <!-- Battle Duration -->
                      <div>
                        <label class="text-[10px] font-bold text-cyan-300 uppercase tracking-wider mb-1 block">Toothbrush Battle Timer Duration</label>
                        <div class="grid grid-cols-3 gap-1.5">
                          <button type="button" class="studio-boss-duration-btn p-1.5 rounded-lg text-[10px] font-black border transition-all ${studioBossBattleDuration === 60 ? 'bg-cyan-500 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'}" data-duration="60">
                            60s (Toddler)
                          </button>
                          <button type="button" class="studio-boss-duration-btn p-1.5 rounded-lg text-[10px] font-black border transition-all ${studioBossBattleDuration === 120 ? 'bg-cyan-500 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'}" data-duration="120">
                            120s (Standard)
                          </button>
                          <button type="button" class="studio-boss-duration-btn p-1.5 rounded-lg text-[10px] font-black border transition-all ${studioBossBattleDuration === 180 ? 'bg-cyan-500 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'}" data-duration="180">
                            180s (Master)
                          </button>
                        </div>
                      </div>

                      <!-- Attack Archetype -->
                      <div>
                        <label class="text-[10px] font-bold text-cyan-300 uppercase tracking-wider mb-1 block">Dental Attack Archetype</label>
                        <div class="grid grid-cols-2 gap-1.5">
                          <button type="button" class="studio-boss-attack-btn p-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 ${studioBossAttackType === 'caramel_bomb' ? 'bg-amber-500 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'}" data-attack="caramel_bomb">
                            <span>🍬</span><span>Caramel Bomb</span>
                          </button>
                          <button type="button" class="studio-boss-attack-btn p-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 ${studioBossAttackType === 'plaque_slime' ? 'bg-emerald-500 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'}" data-attack="plaque_slime">
                            <span>🦠</span><span>Plaque Slime</span>
                          </button>
                          <button type="button" class="studio-boss-attack-btn p-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 ${studioBossAttackType === 'acid_shard' ? 'bg-rose-500 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'}" data-attack="acid_shard">
                            <span>⚔️</span><span>Acid Shard</span>
                          </button>
                          <button type="button" class="studio-boss-attack-btn p-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 ${studioBossAttackType === 'sticky_taffy' ? 'bg-purple-500 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'}" data-attack="sticky_taffy">
                            <span>🕸️</span><span>Sticky Taffy</span>
                          </button>
                        </div>
                      </div>

                      <!-- Focus Quadrant -->
                      <div>
                        <label class="text-[10px] font-bold text-cyan-300 uppercase tracking-wider mb-1 block">Brushing Focus Zone</label>
                        <div class="grid grid-cols-3 gap-1.5">
                          <button type="button" class="studio-boss-focus-btn p-1 rounded-lg text-[10px] font-bold border transition-all ${studioBossFocusQuadrant === 'all' ? 'bg-cyan-500 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'}" data-focus="all">
                            🦷 All 4 Zones
                          </button>
                          <button type="button" class="studio-boss-focus-btn p-1 rounded-lg text-[10px] font-bold border transition-all ${studioBossFocusQuadrant === 'upper' ? 'bg-cyan-500 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'}" data-focus="upper">
                            ⬆️ Upper Molars
                          </button>
                          <button type="button" class="studio-boss-focus-btn p-1 rounded-lg text-[10px] font-bold border transition-all ${studioBossFocusQuadrant === 'lower' ? 'bg-cyan-500 text-slate-950 border-white shadow' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'}" data-focus="lower">
                            ⬇️ Lower Chew
                          </button>
                        </div>
                      </div>
                    </div>
                  ` : ''}
                </div>
              `}

            </div>

            <!-- Right Column: AI Crafting Form & Multiplier Engine (7 cols) -->
            <div class="lg:col-span-7 bg-surface-container rounded-3xl p-6 border-2 border-secondary-container card-shadow flex flex-col gap-5">
              
              <!-- Idea Prompt & AI Generation Trigger -->
              <div class="flex flex-col gap-2">
                <label class="text-xs font-black uppercase text-on-surface-variant flex items-center justify-between">
                  <span class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm text-secondary">psychology</span>
                    <span>Parent Creative Concept (${studioActiveCategory.toUpperCase()})</span>
                  </span>
                  <span class="text-[10px] text-secondary font-bold">Powered by Gemini 2.5 Flash Lite</span>
                </label>
                
                <!-- Multimodal Input Bar (Voice Dictation & Drawing Upload) -->
                <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-800/80 p-2.5 rounded-2xl border border-white/10 mb-3">
                  <div class="flex items-center gap-2">
                    <!-- Voice Dictation -->
                    <button 
                      type="button"
                      id="studio-voice-mic-btn"
                      class="px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${isRecordingVoice ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-700 hover:bg-slate-600 text-amber-300'}"
                      title="Dictate with microphone"
                    >
                      <span>🎙️</span>
                      <span>${isRecordingVoice ? 'Listening...' : 'Voice Dictate'}</span>
                    </button>

                    <!-- Child Drawing / Photo Upload Input -->
                    <label class="px-3 py-1.5 rounded-xl text-xs font-black bg-slate-700 hover:bg-slate-600 text-cyan-300 flex items-center gap-1.5 cursor-pointer transition-all">
                      <span>📷</span>
                      <span>Child Drawing / Photo</span>
                      <input type="file" id="studio-photo-upload" accept="image/*" class="hidden" />
                    </label>
                  </div>

                  ${studioUploadedImageBase64 ? `
                    <div class="flex items-center gap-2">
                      <img src="${studioUploadedImageBase64}" class="w-8 h-8 rounded-lg object-cover border border-cyan-400" alt="Drawing Preview" />
                      <button 
                        type="button"
                        id="studio-vision-generate-btn"
                        class="px-2.5 py-1 rounded-lg text-[10px] font-black bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 hover:scale-105 transition-all shadow"
                      >
                        ✨ Turn into 3D
                      </button>
                    </div>
                  ` : ''}
                </div>

                <div class="flex gap-2">
                  <input 
                    id="studio-ai-prompt" 
                    type="text" 
                    value="${studioItemName}"
                    placeholder="${studioActiveCategory === 'gear' ? 'e.g. Phoenix Flame Tiara or Cyber Jetpack...' : studioActiveCategory === 'furniture' ? 'e.g. Starlight Canopy Bed or Holo Gaming Desk...' : studioActiveCategory === 'toy' ? 'e.g. Super Trampoline or Laser Mouse...' : 'e.g. Sugar Plaque Overlord or Bedtime Gremlin...'}" 
                    class="flex-1 bg-surface-container-high border border-surface-container-highest rounded-2xl p-3 text-xs font-bold text-inverse-surface focus:outline-none focus:border-secondary shadow-inner"
                  />
                  <button 
                    id="studio-gear-ai-btn" 
                    data-studio-ai-btn="true"
                    class="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-headline text-xs font-black px-4 py-3 rounded-2xl shadow-md hover:brightness-110 active:scale-95 flex items-center gap-1.5 shrink-0 ${
                      isStudioGenerating ? 'opacity-70 cursor-wait' : ''
                    }"
                  >
                    <span class="material-symbols-outlined text-base">${isStudioGenerating ? 'progress_activity' : 'auto_awesome'}</span>
                    <span>${isStudioGenerating ? 'Designing 3D...' : '✨ Generate with AI'}</span>
                  </button>
                </div>
              </div>

              <!-- Item Specifications Grid -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <!-- Item Name -->
                <div>
                  <label class="text-[10px] font-black uppercase text-on-surface-variant">Name / Title</label>
                  <input 
                    id="studio-item-name" 
                    type="text" 
                    value="${studioItemName}"
                    class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-2.5 text-xs font-bold text-inverse-surface focus:outline-none focus:border-secondary" 
                  />
                </div>

                <!-- Category-Specific Dropdown -->
                ${studioActiveCategory === 'gear' ? `
                  <div>
                    <label class="text-[10px] font-black uppercase text-on-surface-variant">Mesh Archetype</label>
                    <select id="studio-gear-archetype" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-2.5 text-xs font-bold text-inverse-surface focus:outline-none focus:border-secondary">
                      ${studioSelectedSocket === 'head' ? `
                        <option value="visor" ${studioItemArchetype === 'visor' ? 'selected' : ''}>Cyber HUD Visor (Glow Bar)</option>
                        <option value="crown" ${studioItemArchetype === 'crown' ? 'selected' : ''}>Golden Horn Crown (Spikes)</option>
                        <option value="cowl" ${studioItemArchetype === 'cowl' ? 'selected' : ''}>Hero Cowl (Aerodynamic Mask)</option>
                        <option value="goggles" ${studioItemArchetype === 'goggles' ? 'selected' : ''}>Sky-Captain Goggles (Brass Lenses)</option>
                        <option value="tiara" ${studioItemArchetype === 'tiara' ? 'selected' : ''}>Phoenix Fire Tiara (Crest Gem)</option>
                      ` : studioSelectedSocket === 'back' ? `
                        <option value="wings" ${studioItemArchetype === 'wings' ? 'selected' : ''}>Meteor Glider Wings (Dual Thrusters)</option>
                        <option value="jetpack" ${studioItemArchetype === 'jetpack' ? 'selected' : ''}>Twin Turbo Jetpack (Exhaust Flares)</option>
                        <option value="cape" ${studioItemArchetype === 'cape' ? 'selected' : ''}>Fluttering Hero Cape (Spring Cloth)</option>
                        <option value="cloak" ${studioItemArchetype === 'cloak' ? 'selected' : ''}>Moonlight Star Cloak (Silky Cloth)</option>
                      ` : studioSelectedSocket === 'chest' ? `
                        <option value="collar" ${studioItemArchetype === 'collar' ? 'selected' : ''}>Titan Spiked Collar (Studded Band)</option>
                        <option value="crest_plate" ${studioItemArchetype === 'crest_plate' ? 'selected' : ''}>Golden Crest Plate (Hero Star)</option>
                        <option value="harness" ${studioItemArchetype === 'harness' ? 'selected' : ''}>Power Gem Harness (Prism Core)</option>
                      ` : `
                        <option value="speed_boots" ${studioItemArchetype === 'speed_boots' ? 'selected' : ''}>Neon Speed Boots (Winglet Tabs)</option>
                        <option value="starlight_bands" ${studioItemArchetype === 'starlight_bands' ? 'selected' : ''}>Starlight Ankle Bands (Glow Rings)</option>
                        <option value="lava_greaves" ${studioItemArchetype === 'lava_greaves' ? 'selected' : ''}>Lava Stomp Greaves (Molten Cracks)</option>
                      `}
                    </select>
                  </div>
                ` : studioActiveCategory === 'furniture' ? `
                  <div>
                    <label class="text-[10px] font-black uppercase text-on-surface-variant">Furniture Slot</label>
                    <select id="studio-furniture-type-select" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-2.5 text-xs font-bold text-inverse-surface focus:outline-none focus:border-secondary">
                      <option value="bed" ${studioFurnitureType === 'bed' ? 'selected' : ''}>🛏️ Hero Sleeping Bed</option>
                      <option value="desk" ${studioFurnitureType === 'desk' ? 'selected' : ''}>💻 Mission Study Desk</option>
                      <option value="petLounge" ${studioFurnitureType === 'petLounge' ? 'selected' : ''}>🛋️ Pet Lounge / Beanbag</option>
                      <option value="decor" ${studioFurnitureType === 'decor' ? 'selected' : ''}>🏆 Floor Decor / Trophy Stand</option>
                      <option value="rug" ${studioFurnitureType === 'rug' ? 'selected' : ''}>🌈 Room Adventure Rug</option>
                    </select>
                  </div>
                ` : studioActiveCategory === 'toy' ? `
                  <div>
                    <label class="text-[10px] font-black uppercase text-on-surface-variant">Toy Archetype</label>
                    <select id="studio-toy-type-select" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-2.5 text-xs font-bold text-inverse-surface focus:outline-none focus:border-secondary">
                      <option value="trampoline" ${studioToyType === 'trampoline' ? 'selected' : ''}>🎪 Anti-Gravity Trampoline</option>
                      <option value="ball" ${studioToyType === 'ball' ? 'selected' : ''}>🚀 Turbo Ball Launcher</option>
                      <option value="laser" ${studioToyType === 'laser' ? 'selected' : ''}>✨ Starlight Laser Pointer</option>
                      <option value="puzzle" ${studioToyType === 'puzzle' ? 'selected' : ''}>🧩 Treat Puzzle Box</option>
                      <option value="agility" ${studioToyType === 'agility' ? 'selected' : ''}>⚡ Agility Loop Obstacle</option>
                    </select>
                  </div>
                ` : `
                  <div>
                    <label class="text-[10px] font-black uppercase text-on-surface-variant">Boss Habit Domain</label>
                    <select id="studio-boss-domain-select" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-2.5 text-xs font-bold text-inverse-surface focus:outline-none focus:border-secondary">
                      <option value="dental" ${studioBossDomain === 'dental' ? 'selected' : ''}>🪥 Dental & Tooth Brushing</option>
                      <option value="bedtime" ${studioBossDomain === 'bedtime' ? 'selected' : ''}>🌙 Sleep & Bedtime Routine</option>
                      <option value="screens" ${studioBossDomain === 'screens' ? 'selected' : ''}>📱 Screen Time Management</option>
                      <option value="nutrition" ${studioBossDomain === 'nutrition' ? 'selected' : ''}>🥦 Healthy Eating & Veggies</option>
                    </select>
                  </div>
                `}

                <!-- Price Slider -->
                <div>
                  <div class="flex items-center justify-between">
                    <label class="text-[10px] font-black uppercase text-on-surface-variant">Token Cost</label>
                    <span id="studio-item-price-label" class="text-xs font-black text-secondary">🪙 ${studioItemPrice} Tokens</span>
                  </div>
                  <input 
                    id="studio-gear-price" 
                    type="range" 
                    min="25" 
                    max="500" 
                    step="25" 
                    value="${studioItemPrice}"
                    class="w-full accent-secondary mt-1.5" 
                  />
                </div>

                <!-- Elemental Particle Aura -->
                <div>
                  <label class="text-[10px] font-black uppercase text-on-surface-variant">Visual Aura Effect</label>
                  <select id="studio-item-aura" class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-2.5 text-xs font-bold text-inverse-surface focus:outline-none focus:border-secondary">
                    <option value="none" ${studioItemAura === 'none' ? 'selected' : ''}>None (Pure Metallic)</option>
                    <option value="electric" ${studioItemAura === 'electric' ? 'selected' : ''}>⚡ Electric Spark (Cyan)</option>
                    <option value="fire" ${studioItemAura === 'fire' ? 'selected' : ''}>🔥 Blazing Fire (Orange)</option>
                    <option value="stardust" ${studioItemAura === 'stardust' ? 'selected' : ''}>✨ Stardust Sparkles (Gold)</option>
                    <option value="cosmic" ${studioItemAura === 'cosmic' ? 'selected' : ''}>🌟 Cosmic Void (Purple)</option>
                    <option value="wind" ${studioItemAura === 'wind' ? 'selected' : ''}>💨 Gale Wind (Sky)</option>
                  </select>
                </div>

              </div>

              <!-- Category Functional Gameplay Stats Multiplier Box -->
              ${studioActiveCategory === 'gear' ? `
                <div class="p-4 bg-surface-container-high/70 rounded-2xl border-2 border-secondary/30 flex flex-col gap-3">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-black uppercase text-secondary flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-sm">trending_up</span>
                      <span>Functional Gameplay Stat Buff</span>
                    </span>
                    <span id="studio-stat-badge" class="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-amber-400 border border-amber-400/40">
                      +${studioStatPercent}% ${formatStatBonusName(studioStatType)}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="text-[10px] font-black uppercase text-on-surface-variant">Stat Bonus Category</label>
                      <select id="studio-gear-stat-type" class="w-full bg-surface-container border border-surface-container-highest rounded-xl p-2 text-xs font-bold text-inverse-surface focus:outline-none focus:border-secondary">
                        <option value="damage_boost" ${studioStatType === 'damage_boost' ? 'selected' : ''}>⚔️ +AR Boss Battle Damage</option>
                        <option value="coin_boost" ${studioStatType === 'coin_boost' ? 'selected' : ''}>🪙 +Habit & Chore Tokens</option>
                        <option value="xp_boost" ${studioStatType === 'xp_boost' ? 'selected' : ''}>✨ +Quest & Adventure XP</option>
                        <option value="speed_boost" ${studioStatType === 'speed_boost' ? 'selected' : ''}>⚡ +Runway & Habit Speed</option>
                        <option value="defense_boost" ${studioStatType === 'defense_boost' ? 'selected' : ''}>🛡️ +Pet Defense & Vitality</option>
                      </select>
                    </div>

                    <div>
                      <div class="flex items-center justify-between">
                        <label class="text-[10px] font-black uppercase text-on-surface-variant">Bonus Power Multiplier</label>
                        <span id="studio-stat-percent-label" class="text-xs font-black text-secondary">+${studioStatPercent}%</span>
                      </div>
                      <input 
                        id="studio-gear-stat-percent" 
                        type="range" 
                        min="10" 
                        max="50" 
                        step="5" 
                        value="${studioStatPercent}"
                        class="w-full accent-secondary mt-1.5" 
                      />
                    </div>
                  </div>
                </div>
              ` : studioActiveCategory === 'furniture' ? `
                <div class="p-4 bg-surface-container-high/70 rounded-2xl border-2 border-secondary/30 flex flex-col gap-3">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-black uppercase text-secondary flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-sm">bed</span>
                      <span>HQ Rest & Comfort Multiplier</span>
                    </span>
                    <span id="studio-comfort-badge" class="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-amber-400 border border-amber-400/40">
                      +${studioFurnitureComfort} Comfort XP
                    </span>
                  </div>

                  <div>
                    <div class="flex items-center justify-between">
                      <label class="text-[10px] font-black uppercase text-on-surface-variant">Comfort Level / Tap Rest Refill</label>
                      <span id="studio-comfort-val" class="text-xs font-black text-secondary">+${studioFurnitureComfort} Comfort</span>
                    </div>
                    <input 
                      id="studio-furniture-comfort-slider" 
                      type="range" 
                      min="10" 
                      max="50" 
                      step="5" 
                      value="${studioFurnitureComfort}"
                      class="w-full accent-secondary mt-1.5" 
                    />
                  </div>
                </div>
              ` : studioActiveCategory === 'toy' ? `
                <div class="p-4 bg-surface-container-high/70 rounded-2xl border-2 border-secondary/30 flex flex-col gap-3">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-black uppercase text-secondary flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-sm">toys</span>
                      <span>Pet Need Refill Potency</span>
                    </span>
                    <span id="studio-toy-badge" class="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-amber-400 border border-amber-400/40">
                      +${studioToyAmount} ${studioToyStat.toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <div class="flex items-center justify-between">
                      <label class="text-[10px] font-black uppercase text-on-surface-variant">Stat Boost per Play Session</label>
                      <span id="studio-toy-amount-val" class="text-xs font-black text-secondary">+${studioToyAmount} Points</span>
                    </div>
                    <input 
                      id="studio-toy-amount-slider" 
                      type="range" 
                      min="10" 
                      max="50" 
                      step="5" 
                      value="${studioToyAmount}"
                      class="w-full accent-secondary mt-1.5" 
                    />
                  </div>
                </div>
              ` : `
                <div class="p-4 bg-surface-container-high/70 rounded-2xl border-2 border-secondary/30 flex flex-col gap-3">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-black uppercase text-secondary flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-sm">swords</span>
                      <span>AR Quest Battle Parameters</span>
                    </span>
                    <span id="studio-boss-badge" class="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-amber-400 border border-amber-400/40">
                      HP: ${studioBossHp} • Reward: ${studioBossCoins} 🪙
                    </span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="text-[10px] font-black uppercase text-on-surface-variant">Boss Base Health (HP)</label>
                      <input 
                        id="studio-boss-hp-slider" 
                        type="range" 
                        min="100" 
                        max="500" 
                        step="25" 
                        value="${studioBossHp}"
                        class="w-full accent-secondary mt-1.5" 
                      />
                    </div>
                    <div>
                      <label class="text-[10px] font-black uppercase text-on-surface-variant">Victory Token Reward</label>
                      <input 
                        id="studio-boss-coins-slider" 
                        type="range" 
                        min="20" 
                        max="120" 
                        step="10" 
                        value="${studioBossCoins}"
                        class="w-full accent-secondary mt-1.5" 
                      />
                    </div>
                  </div>
                </div>
              `}

              <!-- Lore Description -->
              <div>
                <label class="text-[10px] font-black uppercase text-on-surface-variant">Lore & Encouraging Description</label>
                <input 
                  id="studio-item-desc" 
                  type="text" 
                  value="${studioItemDesc}"
                  placeholder="e.g. Forged from pure starlight to give brave heroes extra courage!"
                  class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-2.5 text-xs font-bold text-inverse-surface focus:outline-none focus:border-secondary" 
                />
              </div>

              <!-- Companion Spoken Reaction Voice Line / Boss Battle Rally -->
              <div>
                <label class="text-[10px] font-black uppercase text-on-surface-variant flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs text-secondary">record_voice_over</span>
                  <span>${studioActiveCategory === 'boss' ? 'Boss Taunt & Heroic Rally Call' : 'Companion Spoken Reaction Line (When Interacted)'}</span>
                </label>
                <input 
                  id="studio-item-voiceline" 
                  type="text" 
                  value="${studioActiveCategory === 'boss' ? studioBossTaunt : studioPetVoiceLine}"
                  placeholder="${studioActiveCategory === 'boss' ? 'e.g. You cannot defeat the Plaque Monster!' : 'e.g. Woohoo! Look at my new gear! Super hero power!'}"
                  class="w-full bg-surface-container-high border border-surface-container-highest rounded-xl p-2.5 text-xs font-bold text-secondary focus:outline-none focus:border-secondary" 
                />
              </div>

              <!-- Delivery Channels & Target Child Selector -->
              <div class="bg-slate-800/80 p-4 rounded-2xl border border-amber-400/30 flex flex-col gap-3 my-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">local_shipping</span>
                    <span>Delivery Channel & Child Target</span>
                  </span>
                </div>

                <!-- 3 Delivery Channels: Instant Gift vs Hero Shop vs Habit Bounty -->
                <div class="grid grid-cols-3 gap-2">
                  <label class="flex flex-col items-center gap-1 p-2.5 rounded-xl border cursor-pointer text-center transition-all ${studioDeliveryMethod === 'instant_gift' ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold' : 'bg-slate-900/60 border-slate-700 text-slate-400'}">
                    <input type="radio" name="studio-delivery-method" value="instant_gift" ${studioDeliveryMethod === 'instant_gift' ? 'checked' : ''} class="hidden studio-delivery-radio" />
                    <span class="text-xl">🎁</span>
                    <span class="text-[11px] font-black">Instant Gift</span>
                    <span class="text-[9px] text-slate-400">Surprise crate</span>
                  </label>

                  <label class="flex flex-col items-center gap-1 p-2.5 rounded-xl border cursor-pointer text-center transition-all ${studioDeliveryMethod === 'hero_shop' ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold' : 'bg-slate-900/60 border-slate-700 text-slate-400'}">
                    <input type="radio" name="studio-delivery-method" value="hero_shop" ${studioDeliveryMethod === 'hero_shop' ? 'checked' : ''} class="hidden studio-delivery-radio" />
                    <span class="text-xl">🪙</span>
                    <span class="text-[11px] font-black">Hero Shop</span>
                    <span class="text-[9px] text-slate-400">Token unlock</span>
                  </label>

                  <label class="flex flex-col items-center gap-1 p-2.5 rounded-xl border cursor-pointer text-center transition-all ${studioDeliveryMethod === 'habit_bounty' ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold' : 'bg-slate-900/60 border-slate-700 text-slate-400'}">
                    <input type="radio" name="studio-delivery-method" value="habit_bounty" ${studioDeliveryMethod === 'habit_bounty' ? 'checked' : ''} class="hidden studio-delivery-radio" />
                    <span class="text-xl">🎯</span>
                    <span class="text-[11px] font-black">Habit Bounty</span>
                    <span class="text-[9px] text-slate-400">Streak goal</span>
                  </label>
                </div>

                <!-- Target Child Profile -->
                <div class="flex items-center gap-2">
                  <span class="text-xs text-slate-300 font-bold">Target Hero:</span>
                  <select id="studio-target-child-select" class="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-1.5 text-xs font-bold text-amber-300">
                    <option value="all">🌟 All Children in Household</option>
                    ${(store.getState().heroes || []).map(h => `
                      <option value="${h.id}" ${studioTargetChildProfile === h.id ? 'selected' : ''}>🦸 ${h.name}</option>
                    `).join('')}
                  </select>
                </div>

                <!-- If Habit Bounty selected, choose habit & streak days -->
                ${studioDeliveryMethod === 'habit_bounty' ? `
                  <div class="flex flex-col gap-2 pt-2 border-t border-slate-700">
                    <div class="flex items-center justify-between text-xs text-slate-300 font-bold">
                      <span>Required Habit:</span>
                      <select id="studio-bounty-habit-select" class="bg-slate-900 border border-slate-700 rounded-xl p-1.5 text-xs text-amber-300 font-bold">
                        <option value="brush_teeth" ${studioBountyHabitId === 'brush_teeth' ? 'selected' : ''}>🪥 Brush Teeth (Morning or Night)</option>
                        <option value="drink_water" ${studioBountyHabitId === 'drink_water' ? 'selected' : ''}>💧 Drink Fresh Water</option>
                        <option value="tidy_toys" ${studioBountyHabitId === 'tidy_toys' ? 'selected' : ''}>🧸 Tidy Up Hero Toys</option>
                        <option value="eat_healthy_snack" ${studioBountyHabitId === 'eat_healthy_snack' ? 'selected' : ''}>🍎 Eat Healthy Snack</option>
                        <option value="make_bed" ${studioBountyHabitId === 'make_bed' ? 'selected' : ''}>🛏️ Make Hero Bed</option>
                        <option value="any" ${studioBountyHabitId === 'any' ? 'selected' : ''}>⭐ Any Daily Habit</option>
                      </select>
                    </div>
                    <div class="flex items-center justify-between text-xs text-slate-300 font-bold">
                      <span>Streak Target:</span>
                      <span id="studio-bounty-streak-val" class="text-amber-300 font-black">${studioBountyStreakDays} Days</span>
                    </div>
                    <input type="range" id="studio-bounty-streak-slider" min="1" max="7" value="${studioBountyStreakDays}" class="w-full accent-amber-400" />
                  </div>
                ` : ''}
              </div>

              <!-- Action Bar: Test as Child & Publish Live Buttons -->
              <div class="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-surface-container-highest">
                <button 
                  type="button" 
                  id="studio-test-as-child-btn"
                  class="w-full sm:w-auto py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-headline text-xs font-black shadow-lg hover:scale-102 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span>👀</span>
                  <span>Test as Child (Preview Simulator)</span>
                </button>

                <button 
                  id="studio-gear-publish-btn" 
                  data-studio-publish="true"
                  class="w-full sm:w-auto bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-slate-950 font-headline text-xs font-black py-3.5 px-6 rounded-2xl shadow-xl hover:shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-white/30"
                >
                  <span class="text-lg">🚀</span>
                  <span>Publish Live to ${studioActiveCategory === 'gear' ? 'Hero Shop' : studioActiveCategory === 'furniture' ? 'Hero HQ' : studioActiveCategory === 'toy' ? 'Pet Pen' : 'AR Quests'}</span>
                </button>
              </div>

            </div>

          </div>

          <!-- Published Custom Creations Galleries -->
          <div class="bg-surface-container rounded-3xl p-6 border border-surface-container-highest shadow-sm flex flex-col gap-6">
            <div class="flex items-center justify-between border-b border-surface-container-highest pb-3">
              <div>
                <h3 class="font-headline text-base sm:text-lg font-black text-inverse-surface flex items-center gap-2">
                  <span class="material-symbols-outlined text-amber-500">verified</span>
                  <span>Published Parent Creations Collection</span>
                </h3>
                <p class="text-xs text-on-surface-variant">All custom gear, furniture, toys and bosses crafted in the studio.</p>
              </div>
            </div>

            <!-- 1. Custom Gear Section -->
            <div class="flex flex-col gap-3">
              <h4 class="text-xs font-black text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <span>🛡️</span><span>Published Custom Pet Gear (${publishedCustomGear.length})</span>
              </h4>
              ${publishedCustomGear.length === 0 ? `
                <p class="text-xs text-on-surface-variant italic">No custom pet gear published yet.</p>
              ` : `
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  ${publishedCustomGear.map(item => `
                    <div class="p-3.5 rounded-2xl bg-surface-container-high border-2 border-amber-400/30 shadow-md flex flex-col justify-between gap-2.5">
                      <div class="flex items-start gap-3">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow shrink-0" style="background-color: ${item.primaryColor || '#06b6d4'};">
                          ${item.image ? `<img src="${item.image}" class="w-8 h-8 object-contain" />` : `<span class="material-symbols-outlined text-white">${item.icon || 'shield'}</span>`}
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-amber-400/20 text-amber-400 border border-amber-400/30">${item.socket}</span>
                            <span class="text-[9px] font-black uppercase text-secondary">🪙 ${item.costCoins} Tokens</span>
                          </div>
                          <h5 class="font-headline text-xs font-black text-inverse-surface truncate mt-0.5">${item.name}</h5>
                        </div>
                      </div>
                      <div class="flex items-center justify-between pt-1.5 border-t border-surface-container-highest">
                        <span class="text-[10px] font-black text-amber-400">${item.statBonusLabel || `+${item.statBonusPercent}% Boost`}</span>
                        <button class="delete-custom-gear-btn text-error hover:bg-error/15 p-1 rounded-lg" data-gear-id="${item.id}" title="Delete Gear">
                          <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- 2. Custom HQ Furniture Section -->
            <div class="flex flex-col gap-3 pt-3 border-t border-surface-container-highest">
              <h4 class="text-xs font-black text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <span>🛋️</span><span>Published HQ Furniture (${publishedCustomFurniture.length})</span>
              </h4>
              ${publishedCustomFurniture.length === 0 ? `
                <p class="text-xs text-on-surface-variant italic">No custom HQ furniture published yet.</p>
              ` : `
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  ${publishedCustomFurniture.map(item => `
                    <div class="p-3.5 rounded-2xl bg-surface-container-high border-2 border-emerald-400/30 shadow-md flex flex-col justify-between gap-2.5">
                      <div class="flex items-start gap-3">
                        <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center justify-center text-xl shadow shrink-0">
                          ${item.icon || '🛋️'}
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">${item.slot || 'Furniture'}</span>
                            <span class="text-[9px] font-black uppercase text-secondary">🪙 ${item.costCoins || 100}</span>
                          </div>
                          <h5 class="font-headline text-xs font-black text-inverse-surface truncate mt-0.5">${item.name}</h5>
                        </div>
                      </div>
                      <div class="flex items-center justify-between pt-1.5 border-t border-surface-container-highest">
                        <span class="text-[10px] font-black text-emerald-300">+${item.comfort || 25} Comfort XP</span>
                        <button class="delete-custom-furniture-btn text-error hover:bg-error/15 p-1 rounded-lg" data-furniture-id="${item.id}" title="Delete Furniture">
                          <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- 3. Custom Pet Pen Toys Section -->
            <div class="flex flex-col gap-3 pt-3 border-t border-surface-container-highest">
              <h4 class="text-xs font-black text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <span>🎾</span><span>Published Pet Pen Toys (${publishedCustomToys.length})</span>
              </h4>
              ${publishedCustomToys.length === 0 ? `
                <p class="text-xs text-on-surface-variant italic">No custom toys published yet.</p>
              ` : `
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  ${publishedCustomToys.map(item => `
                    <div class="p-3.5 rounded-2xl bg-surface-container-high border-2 border-purple-400/30 shadow-md flex flex-col justify-between gap-2.5">
                      <div class="flex items-start gap-3">
                        <div class="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/40 flex items-center justify-center text-xl shadow shrink-0">
                          ${item.emoji || '🎪'}
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-purple-400/20 text-purple-300 border border-purple-400/30">${item.toyType || 'Toy'}</span>
                            <span class="text-[9px] font-black uppercase text-secondary">🪙 ${item.costCoins || 50}</span>
                          </div>
                          <h5 class="font-headline text-xs font-black text-inverse-surface truncate mt-0.5">${item.name}</h5>
                        </div>
                      </div>
                      <div class="flex items-center justify-between pt-1.5 border-t border-surface-container-highest">
                        <span class="text-[10px] font-black text-purple-300">+${item.statRefillAmount || 30} ${item.statRefillTarget || 'Joy'}</span>
                        <button class="delete-custom-toy-btn text-error hover:bg-error/15 p-1 rounded-lg" data-toy-id="${item.id}" title="Delete Toy">
                          <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- 4. Custom AR Quest Bosses Section -->
            <div class="flex flex-col gap-3 pt-3 border-t border-surface-container-highest">
              <h4 class="text-xs font-black text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <span>👾</span><span>Published AR Quest Bosses (${publishedCustomBosses.length})</span>
              </h4>
              ${publishedCustomBosses.length === 0 ? `
                <p class="text-xs text-on-surface-variant italic">No custom quest bosses published yet.</p>
              ` : `
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  ${publishedCustomBosses.map(item => `
                    <div class="p-3.5 rounded-2xl bg-surface-container-high border-2 border-rose-400/30 shadow-md flex flex-col justify-between gap-2.5">
                      <div class="flex items-start gap-3">
                        <div class="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-400/40 flex items-center justify-center text-xl shadow shrink-0">
                          ${item.emoji || '👾'}
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-rose-400/20 text-rose-300 border border-rose-400/30">${item.domain || 'Villain'}</span>
                            <span class="text-[9px] font-black uppercase text-secondary">HP ${item.maxHp || 250}</span>
                          </div>
                          <h5 class="font-headline text-xs font-black text-inverse-surface truncate mt-0.5">${item.name}</h5>
                        </div>
                      </div>
                      <div class="flex items-center justify-between pt-1.5 border-t border-surface-container-highest">
                        <span class="text-[10px] font-black text-rose-300">Reward: ${item.rewardCoins || 50} 🪙</span>
                        <div class="flex items-center gap-1.5">
                          <button class="test-custom-boss-btn bg-primary text-on-primary px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 hover:brightness-110 active:scale-95 shadow-sm" data-boss-id="${item.id}" title="Test in Toothbrush Battle">
                            <span class="material-symbols-outlined text-xs">swords</span> Battle
                          </button>
                          <button class="delete-custom-boss-btn text-error hover:bg-error/15 p-1 rounded-lg" data-boss-id="${item.id}" title="Delete Boss">
                            <span class="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

          </div>

        </section>
              `;
            })()
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

          <!-- AI Pediatric Habit Insights & Coaching Card (Powered by Gemini) -->
          ${
            isLoadingInsights
              ? `
            <div class="bg-surface-container rounded-3xl p-6 border-2 border-primary/40 card-shadow flex flex-col items-center justify-center gap-3 text-center py-10 animate-pulse">
              <div class="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
              <span class="font-headline text-sm font-black text-primary">Gemini is analyzing family habits and sibling consistency...</span>
              <span class="text-xs text-on-surface-variant font-medium">Generating positive reinforcement and pediatric advice</span>
            </div>
          `
              : activeParentInsights
              ? `
            <div class="bg-gradient-to-br from-primary/15 via-surface-container to-secondary/10 rounded-3xl p-6 border-2 border-primary/50 card-shadow flex flex-col gap-4 animate-fade-in">
              <div class="flex items-center justify-between border-b border-surface-container-highest pb-3">
                <div class="flex items-center gap-2.5">
                  <span class="text-2xl">✨</span>
                  <div>
                    <h3 class="font-headline text-base font-black text-inverse-surface">AI Pediatric Habit Insights & Coaching</h3>
                    <p class="text-[11px] text-on-surface-variant font-bold">Personalized psychological feedback powered by Gemini 3.7 Flash</p>
                  </div>
                </div>
                <button id="admin-refresh-insights-btn" class="bg-surface-container-high hover:bg-surface-bright text-primary border border-primary/30 font-headline text-xs font-black px-3 py-1.5 rounded-xl chunky-btn-sm active:scale-95 flex items-center gap-1.5 shadow-sm">
                  <span class="material-symbols-outlined text-sm">refresh</span>
                  <span>Refresh Analysis</span>
                </button>
              </div>

              <!-- Executive Summary -->
              <div class="bg-surface-container-lowest/80 p-4 rounded-2xl border border-surface-container-highest">
                <span class="text-[10px] font-black uppercase text-secondary tracking-wider block mb-1">Family Momentum Summary</span>
                <p class="text-xs sm:text-sm font-bold text-inverse-surface leading-relaxed">${activeParentInsights.executiveSummary || 'Your little heroes are making steady progress!'}</p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <!-- Praise Highlights -->
                <div class="bg-surface-container-lowest/80 p-4 rounded-2xl border border-emerald-500/30 flex flex-col gap-2">
                  <span class="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">emoji_events</span>
                    <span>Praise & Celebrate</span>
                  </span>
                  <ul class="flex flex-col gap-1.5 text-xs font-semibold text-inverse-surface">
                    ${(activeParentInsights.praiseHighlights || ['Consistent daily habit completion']).map(p => `<li class="flex items-start gap-1.5"><span class="text-emerald-400">✓</span><span>${p}</span></li>`).join('')}
                  </ul>
                </div>

                <!-- Parent Coaching Tips -->
                <div class="bg-surface-container-lowest/80 p-4 rounded-2xl border border-sky-500/30 flex flex-col gap-2">
                  <span class="text-[10px] font-black uppercase text-sky-400 tracking-wider flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">lightbulb</span>
                    <span>Pediatric Advice</span>
                  </span>
                  <ul class="flex flex-col gap-1.5 text-xs font-semibold text-inverse-surface">
                    ${(activeParentInsights.parentTips || ['Praise small daily efforts']).map(t => `<li class="flex items-start gap-1.5"><span class="text-sky-400">💡</span><span>${t}</span></li>`).join('')}
                  </ul>
                </div>
              </div>

              <!-- Recommended Bonding Reward -->
              ${activeParentInsights.recommendedReward ? `
                <div class="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl flex items-center gap-3">
                  <span class="text-2xl">🎁</span>
                  <div class="flex flex-col">
                    <span class="text-[10px] font-black uppercase text-amber-400">Suggested Real-World Bonding Reward</span>
                    <span class="text-xs font-bold text-inverse-surface">${activeParentInsights.recommendedReward}</span>
                  </div>
                </div>
              ` : ''}
            </div>
          `
              : `
            <div class="bg-gradient-to-r from-primary/10 via-surface-container to-secondary/10 rounded-3xl p-6 border-2 border-primary/30 card-shadow flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="flex items-center gap-3.5">
                <div class="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-2xl shadow-inner">
                  <span class="material-symbols-outlined text-3xl">psychology</span>
                </div>
                <div>
                  <h3 class="font-headline text-base font-black text-inverse-surface">AI Pediatric Habit Insights</h3>
                  <p class="text-xs text-on-surface-variant font-bold">Generate real-time family momentum analysis, positive reinforcement coaching, and bonding ideas.</p>
                </div>
              </div>
              <button id="admin-generate-insights-btn" class="w-full sm:w-auto bg-primary text-on-primary font-headline text-xs font-black px-5 py-3 rounded-2xl chunky-btn shadow-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap">
                <span class="material-symbols-outlined text-base">auto_awesome</span>
                <span>Generate AI Insights</span>
              </button>
            </div>
          `
          }

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

          <!-- Task & Routine Completion Audit Log (Decoupled Repeatable History) -->
          <div class="bg-surface-container rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-headline text-sm font-black text-inverse-surface flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary text-base">history</span>
                  Routine & Task Completion Audit Log (${completionLogs.length})
                </h3>
                <p class="text-[11px] text-on-surface-variant font-bold">Every recurring cycle is recorded with an exact timestamp for parental review.</p>
              </div>
            </div>

            ${
              completionLogs.length === 0
                ? `
              <div class="p-6 text-center text-xs text-on-surface-variant">
                No routine completions logged yet. When kids complete chores or habits, individual records with timestamps appear here.
              </div>
            `
                : `
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs font-bold">
                  <thead>
                    <tr class="border-b border-surface-container-highest text-on-surface-variant text-[10px] uppercase">
                      <th class="py-2">Date & Time</th>
                      <th class="py-2">Hero</th>
                      <th class="py-2">Routine / Chore</th>
                      <th class="py-2">Zone</th>
                      <th class="py-2">Tokens 🪙</th>
                      <th class="py-2">Points ⭐ Status</th>
                      <th class="py-2 text-right">Signed Off</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-surface-container-highest/40">
                    ${completionLogs
                      .map((log) => {
                        const isApproved = log.status === 'approved';
                        const isPending = log.status === 'pending';
                        const statusPill = isApproved
                          ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-primary/20 text-primary border border-primary/30">✓ +${log.pointsAwarded} ⭐ Approved</span>`
                          : isPending
                          ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">⏳ +${log.pointsAwarded} ⭐ Pending</span>`
                          : `<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-error/20 text-error border border-error/30">✕ Declined</span>`;

                        const timeDisplay = log.timeString && log.dateString
                          ? `${log.dateString} ${log.timeString}`
                          : log.completedAt
                          ? new Date(log.completedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                          : 'Just now';

                        const approvedDisplay = log.approvedAt
                          ? new Date(log.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : isPending
                          ? 'Awaiting Sign-off'
                          : 'Declined';

                        return `
                        <tr class="hover:bg-surface-container-high/40 transition-colors">
                          <td class="py-2 text-on-surface-variant font-medium text-[11px] whitespace-nowrap">${timeDisplay}</td>
                          <td class="py-2 text-primary font-black whitespace-nowrap">${log.heroName || 'Hero'}</td>
                          <td class="py-2 text-inverse-surface font-bold">${log.taskTitle}</td>
                          <td class="py-2 text-on-surface-variant text-[11px]">${log.zone}</td>
                          <td class="py-2 text-secondary font-black">+${log.coinsAwarded}</td>
                          <td class="py-2">${statusPill}</td>
                          <td class="py-2 text-right font-medium text-on-surface-variant text-[11px] whitespace-nowrap">${approvedDisplay}</td>
                        </tr>
                      `;
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
            }
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

          <!-- Rex AI Companion Voice Persona & Live Settings -->
          <div class="bg-surface-container rounded-3xl p-6 border-2 border-primary/30 card-shadow flex flex-col gap-5">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-primary/20 text-primary border border-primary/40 flex items-center justify-center text-2xl shadow-sm">
                🦖
              </div>
              <div>
                <h3 class="font-headline text-base sm:text-lg font-black text-inverse-surface">Rex AI Companion Voice Persona</h3>
                <p class="text-xs text-on-surface-variant font-bold">Select Rex's voice tone for real-time voice coaching and Live audio quests.</p>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              ${[
                { id: 'Puck', label: 'Puck', desc: 'Playful & high energy (Default)', icon: 'sentiment_very_satisfied' },
                { id: 'Aoede', label: 'Aoede', desc: 'Nurturing & clear teacher tone', icon: 'school' },
                { id: 'Charon', label: 'Charon', desc: 'Deep & calm dino elder', icon: 'elderly' },
                { id: 'Fenrir', label: 'Fenrir', desc: 'Fast, bold & adventurous', icon: 'speed' },
                { id: 'Kore', label: 'Kore', desc: 'Gentle, soft & soothing', icon: 'spa' }
              ].map(v => {
                const currentVoice = state.liveRex?.voiceName || 'Puck';
                const isSelected = currentVoice.toLowerCase() === v.id.toLowerCase();
                return `
                  <button data-voice-id="${v.id}" class="rex-voice-select-btn rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 border-2 transition-all active:scale-95 ${
                    isSelected ? 'bg-primary text-on-primary border-primary-container shadow-sm font-black' : 'bg-surface-container-high hover:bg-surface-bright text-inverse-surface border-surface-container-highest'
                  }">
                    <span class="material-symbols-outlined text-2xl">${v.icon}</span>
                    <span class="font-headline text-xs font-black">${v.label}</span>
                    <span class="text-[9px] text-center leading-tight ${isSelected ? 'text-on-primary/90' : 'text-on-surface-variant'}">${v.desc}</span>
                  </button>
                `;
              }).join('')}
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

          <!-- Rex the Dino Live AI Voice Companion Settings (Gemini Live & Interactions API) -->
          <div class="bg-surface-container rounded-3xl p-6 border-2 border-primary/40 card-shadow flex flex-col gap-5">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-primary/20 text-primary border-2 border-primary flex items-center justify-center text-2xl shadow">
                  🦖
                </div>
                <div>
                  <h3 class="font-headline text-base sm:text-lg font-black text-inverse-surface">Rex the Dino Live AI Companion</h3>
                  <p class="text-xs text-on-surface-variant font-bold">Configure Google Gemini Live API & Interactions API for real-time toddler voice guidance.</p>
                </div>
              </div>

              <!-- Status Pill -->
              <span class="text-[10px] font-black uppercase px-3 py-1.5 rounded-full ${
                state.liveRex?.geminiApiKey || localStorage.getItem('gemini_api_key')
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'bg-secondary/20 text-secondary border border-secondary/40'
              } flex items-center gap-1.5 shadow-sm">
                <span class="w-2 h-2 rounded-full ${
                  state.liveRex?.geminiApiKey || localStorage.getItem('gemini_api_key') ? 'bg-primary animate-pulse' : 'bg-secondary'
                }"></span>
                ${state.liveRex?.geminiApiKey || localStorage.getItem('gemini_api_key') ? 'Custom Key Active' : 'Default Project Key Ready'}
              </span>
            </div>

            <!-- API Key Configuration Section -->
            <div class="bg-surface-container-high rounded-2xl p-4 border border-surface-container-highest flex flex-col gap-3">
              <div class="flex flex-col gap-1">
                <span class="font-headline text-xs font-black text-inverse-surface">Google Gemini API Key</span>
                <span class="text-[11px] text-on-surface-variant">Powers real-time voice recognition, live toddler conversation, quest assistance, and AI animations.</span>
              </div>
              <div class="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  id="admin-gemini-key-input"
                  placeholder="Paste Gemini API Key (e.g. AIzaSy...)"
                  value="${state.liveRex?.geminiApiKey || localStorage.getItem('gemini_api_key') || ''}"
                  class="flex-1 bg-surface-container-lowest border-2 border-surface-container-highest rounded-xl px-3.5 py-2.5 text-xs text-inverse-surface focus:outline-none focus:border-primary font-mono"
                />
                <button id="admin-save-gemini-key-btn" class="bg-primary text-on-primary font-headline text-xs font-black px-4 py-2.5 rounded-xl border border-primary-container chunky-btn-sm active:scale-95 shadow-sm hover:brightness-110 flex items-center justify-center gap-1.5">
                  <span class="material-symbols-outlined text-sm">save</span>
                  <span>Save Key</span>
                </button>
                <button id="admin-clear-gemini-key-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-black px-3.5 py-2.5 rounded-xl border border-surface-container-highest chunky-btn-sm active:scale-95 flex items-center justify-center gap-1">
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <!-- Prebuilt Voice Selection -->
            <div class="bg-surface-container-high rounded-2xl p-4 border border-surface-container-highest flex flex-col gap-3">
              <div class="flex flex-col gap-1">
                <span class="font-headline text-xs font-black text-inverse-surface">Rex the Dino Voice Character</span>
                <span class="text-[11px] text-on-surface-variant">Choose the live synthetic persona for Rex during voice quests.</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                ${[
                  { id: 'Puck', label: 'Puck (Recommended)', desc: 'Playful & Toddler Cartoon' },
                  { id: 'Charon', label: 'Charon', desc: 'Calm & Deep Roar' },
                  { id: 'Aoede', label: 'Aoede', desc: 'Gentle & Loving' },
                  { id: 'Fenrir', label: 'Fenrir', desc: 'Bold & Heroic' }
                ]
                  .map((v) => {
                    const currentVoice = state.liveRex?.voiceName || 'Puck';
                    const isSelected = currentVoice === v.id;
                    return `
                    <button data-rex-voice="${v.id}" class="rex-voice-select-btn rounded-xl p-3 flex flex-col items-center justify-center gap-1 border-2 transition-all ${
                      isSelected
                        ? 'bg-primary text-on-primary border-primary-container shadow-sm font-black'
                        : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border-surface-container-highest'
                    }">
                      <span class="text-xs font-headline font-black">${v.label}</span>
                      <span class="text-[9px] ${isSelected ? 'text-on-primary/90' : 'text-on-surface-variant'}">${v.desc}</span>
                    </button>
                  `;
                  })
                  .join('')}
              </div>
            </div>

            <!-- Auto-Listen During Quests Toggle -->
            <div class="bg-surface-container-high rounded-2xl p-4 border border-surface-container-highest flex items-center justify-between gap-3">
              <div class="flex flex-col gap-0.5">
                <span class="font-headline text-xs font-black text-inverse-surface">Auto-Wake Rex in Easy Mode</span>
                <span class="text-[11px] text-on-surface-variant">Automatically activates Rex's microphone & live voice when a toddler starts any Quest Map mini-game.</span>
              </div>
              <button id="admin-rex-autolisten-toggle" class="px-3.5 py-1.5 rounded-full text-xs font-black uppercase transition-all chunky-btn-sm ${
                state.liveRex?.autoListenInQuests !== false
                  ? 'bg-primary text-on-primary border-primary-container shadow-sm'
                  : 'bg-surface-container-lowest text-on-surface-variant border-surface-container'
              }">
                ${state.liveRex?.autoListenInQuests !== false ? '✓ Enabled' : 'Disabled'}
              </button>
            </div>

            <!-- DEDICATED PARENTAL CONTROLS SUITE (Bedtime, Tone, Chat Limits & Topic Restrictions) -->
            <div class="bg-surface-container-high rounded-2xl p-5 border-2 border-secondary-container/60 flex flex-col gap-4">
              <div class="flex items-center justify-between border-b border-surface-container-highest pb-3">
                <div class="flex items-center gap-2.5">
                  <span class="material-symbols-outlined text-secondary text-xl">tune</span>
                  <div>
                    <h4 class="font-headline text-sm font-black text-inverse-surface">Parental Rules & Screen-Time Guardrails</h4>
                    <p class="text-[10px] text-on-surface-variant font-bold">Enforced by Rex before every chat prompt</p>
                  </div>
                </div>
                <button id="admin-save-companion-rules-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2 rounded-xl chunky-btn-sm active:scale-95 shadow-sm hover:brightness-110 flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-sm">verified_user</span>
                  <span>Save Rules</span>
                </button>
              </div>

              <!-- 1. Bedtime Hour Selector -->
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-black text-inverse-surface flex items-center justify-between">
                  <span>🌙 Rex Bedtime Hour</span>
                  <span class="text-[10px] font-bold text-secondary">${settings.bedtimeHour || 20}:00 (${(settings.bedtimeHour || 20) > 12 ? (settings.bedtimeHour || 20) - 12 + ' PM' : (settings.bedtimeHour || 20) + ' AM'})</span>
                </label>
                <div class="grid grid-cols-4 gap-2">
                  ${[19, 20, 21, 22].map((hour) => {
                    const isSelected = (settings.bedtimeHour ?? 20) === hour;
                    const label = hour === 19 ? '7 PM' : hour === 20 ? '8 PM (Default)' : hour === 21 ? '9 PM' : '10 PM';
                    return `
                    <button data-companion-bedtime="${hour}" class="companion-bedtime-btn py-2 px-1 rounded-xl text-xs font-headline font-black transition-all border ${
                      isSelected
                        ? 'bg-secondary text-on-secondary border-secondary-container shadow-sm'
                        : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border-surface-container-highest'
                    }">
                      ${label}
                    </button>
                  `;
                  }).join('')}
                </div>
                <span class="text-[10px] text-on-surface-variant">After this hour, Rex rests in his cave until morning.</span>
              </div>

              <!-- 2. Companion Tone Style -->
              <div class="flex flex-col gap-1.5 pt-2 border-t border-surface-container-highest">
                <label class="text-xs font-black text-inverse-surface">🎭 Companion Tone & Personality</label>
                <div class="grid grid-cols-3 gap-2">
                  ${[
                    { id: 'energetic', label: '⚡ Energetic', desc: 'Bouncy & Adventurous' },
                    { id: 'gentle', label: '🌸 Gentle', desc: 'Soothing & Loving' },
                    { id: 'focused', label: '🎯 Focused', desc: 'Study & Habit Helper' }
                  ].map((t) => {
                    const isSelected = (settings.tone || 'energetic') === t.id;
                    return `
                    <button data-companion-tone="${t.id}" class="companion-tone-btn p-2 rounded-xl text-left border flex flex-col gap-0.5 transition-all ${
                      isSelected
                        ? 'bg-primary text-on-primary border-primary-container shadow-sm'
                        : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border-surface-container-highest'
                    }">
                      <span class="text-xs font-headline font-black">${t.label}</span>
                      <span class="text-[9px] ${isSelected ? 'text-on-primary/90' : 'text-on-surface-variant'}">${t.desc}</span>
                    </button>
                  `;
                  }).join('')}
                </div>
              </div>

              <!-- 3. Maximum Daily Chat Turns Limit -->
              <div class="flex flex-col gap-1.5 pt-2 border-t border-surface-container-highest">
                <label class="text-xs font-black text-inverse-surface">⏳ Daily Chat Turn Limit (Screen Time)</label>
                <div class="grid grid-cols-4 gap-2">
                  ${[10, 20, 30, 999].map((limit) => {
                    const isSelected = (settings.maxDailyTurns ?? 30) === limit;
                    const label = limit === 999 ? 'Unlimited' : `${limit} Turns`;
                    return `
                    <button data-companion-turns="${limit}" class="companion-turns-btn py-2 px-1 rounded-xl text-xs font-headline font-black transition-all border ${
                      isSelected
                        ? 'bg-secondary text-on-secondary border-secondary-container shadow-sm'
                        : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant border-surface-container-highest'
                    }">
                      ${label}
                    </button>
                  `;
                  }).join('')}
                </div>
              </div>

              <!-- 4. Focus Areas Checkable Tags -->
              <div class="flex flex-col gap-1.5 pt-2 border-t border-surface-container-highest">
                <label class="text-xs font-black text-inverse-surface">🌟 Priority Habit Focus Areas</label>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  ${[
                    { id: 'brushing_teeth', label: '🪥 Brushing Teeth' },
                    { id: 'cleaning_toys', label: '🧸 Cleaning Toys' },
                    { id: 'healthy_meals', label: '🥦 Healthy Veggies' },
                    { id: 'drinking_water', label: '💧 Drinking Water' },
                    { id: 'reading_homework', label: '📚 Reading & Stories' },
                    { id: 'bedtime_rest', label: '😴 Bedtime Routine' }
                  ].map((item) => {
                    const focusList = settings.focusAreas || ['brushing_teeth', 'cleaning_toys'];
                    const isChecked = focusList.includes(item.id);
                    return `
                    <button data-focus-area="${item.id}" class="companion-focus-tag-btn p-2 rounded-xl text-xs font-headline font-black border flex items-center justify-between transition-all ${
                      isChecked
                        ? 'bg-primary/20 text-primary border-primary/50 shadow-sm'
                        : 'bg-surface-container text-on-surface-variant border-surface-container-highest opacity-70'
                    }">
                      <span>${item.label}</span>
                      <span class="text-xs">${isChecked ? '✓' : '+'}</span>
                    </button>
                  `;
                  }).join('')}
                </div>
              </div>

              <!-- 5. Restricted Topics -->
              <div class="flex flex-col gap-1 pt-2 border-t border-surface-container-highest">
                <label class="text-xs font-black text-inverse-surface">🚫 Restricted / Forbidden Topics</label>
                <input
                  type="text"
                  id="admin-restricted-topics-input"
                  placeholder="e.g. scary monsters, sweets, sugar bugs"
                  value="${(settings.restrictedTopics || []).join(', ')}"
                  class="bg-surface-container-lowest border-2 border-surface-container-highest rounded-xl px-3.5 py-2.5 text-xs text-inverse-surface focus:outline-none focus:border-secondary font-medium"
                />
                <span class="text-[10px] text-on-surface-variant">Separate topics with commas. Rex is strictly prohibited from mentioning these.</span>
              </div>
            </div>

            <!-- Diagnostics / Test Button -->
            <div class="flex items-center justify-between pt-1">
              <span class="text-[11px] text-on-surface-variant italic">Test bidirectional voice audio to ensure microphone and speakers are functioning.</span>
              <button id="admin-test-rex-voice-btn" class="bg-secondary/20 hover:bg-secondary/30 text-secondary border border-secondary/40 font-headline text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 chunky-btn-sm active:scale-95 shadow-sm">
                <span class="material-symbols-outlined text-base">record_voice_over</span>
                <span>Test Live Rex Voice</span>
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
      ${renderAddParentModal()}
      ${renderPhotoProofZoomModal()}

    </div>
  `;
}

function renderPhotoProofZoomModal() {
  if (!zoomedProofPhotoUrl) return '';
  return `
    <div id="admin-proof-zoom-backdrop" class="fixed inset-0 bg-[#09141e]/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div class="bg-surface-container border-4 border-primary rounded-4xl max-w-xl w-full card-shadow-lg flex flex-col overflow-hidden animate-scale-up">
        <div class="bg-gradient-to-r from-primary to-emerald-600 p-4 text-white flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-xl">photo_camera</span>
            <h3 class="font-headline text-base font-black">Chore Proof Verification Photo</h3>
          </div>
          <button id="admin-proof-zoom-close-btn" class="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div class="p-4 bg-black flex items-center justify-center min-h-[300px]">
          <img src="${zoomedProofPhotoUrl}" class="max-h-[60vh] max-w-full object-contain rounded-xl shadow-inner" alt="Full Chore Proof Photo" />
        </div>

        <div class="p-4 bg-surface-container flex items-center justify-between border-t border-surface-container-highest">
          <span class="text-xs text-on-surface-variant font-bold">✨ High resolution proof captured by hero</span>
          <button id="admin-proof-zoom-dismiss-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black px-5 py-2.5 rounded-xl chunky-btn-sm active:scale-95 shadow">
            Done Inspecting
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderAddParentModal() {
  if (!isAddParentModalOpen) return '';
  return `
    <div id="add-parent-modal-backdrop" class="fixed inset-0 bg-[#09141e]/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div class="bg-surface-container border-4 border-secondary rounded-4xl p-6 max-w-md w-full card-shadow-lg flex flex-col gap-4">
        
        <div class="flex justify-between items-center border-b-2 border-surface-container-highest pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary text-2xl">person_add</span>
            <h2 class="font-headline text-xl font-black text-inverse-surface">Add Parent Administrator</h2>
          </div>
          <button id="add-parent-modal-close-btn" class="text-on-surface-variant hover:text-error text-2xl p-1">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Parent Email Address *</label>
            <input type="email" id="new-parent-email" placeholder="e.g. parent@family.com" class="w-full bg-surface-container-high border-2 border-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold text-inverse-surface focus:border-secondary focus:outline-none" />
            <span class="text-[10px] text-on-surface-variant font-medium mt-1 block">Used for Google Sign-In and adult authorization permissions</span>
          </div>

          <div>
            <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Parent Name / Nickname</label>
            <input type="text" id="new-parent-name" placeholder="e.g. Mom, Dad, Grandma" class="w-full bg-surface-container-high border-2 border-surface-container-highest rounded-xl px-4 py-3 text-sm font-bold text-inverse-surface focus:border-secondary focus:outline-none" />
          </div>

          <div>
            <label class="block text-xs font-black text-on-surface-variant uppercase mb-1">Administrator Role</label>
            <select id="new-parent-role" class="w-full bg-surface-container-high border-2 border-surface-container-highest rounded-xl px-4 py-2.5 text-sm font-bold text-inverse-surface focus:border-secondary focus:outline-none">
              <option value="admin">Co-Parent Admin (Approvals, Balances & Settings)</option>
              <option value="owner">Household Co-Owner (Full Authority)</option>
            </select>
          </div>
        </div>

        <div class="flex gap-2.5 pt-3 border-t border-surface-container-highest">
          <button id="add-parent-cancel-btn" class="flex-1 bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-xs font-black py-3 rounded-xl border border-surface-container-highest chunky-btn-sm active:scale-95">
            Cancel
          </button>
          <button id="add-parent-submit-btn" class="flex-1 bg-secondary text-on-secondary font-headline text-xs font-black py-3 rounded-xl chunky-btn border-secondary-container shadow hover:brightness-110 active:scale-95">
            Authorize Parent
          </button>
        </div>

      </div>
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

  // Rex the Dino Live AI Settings Listeners
  const geminiKeyInput = document.getElementById('admin-gemini-key-input');
  const saveGeminiKeyBtn = document.getElementById('admin-save-gemini-key-btn');
  const clearGeminiKeyBtn = document.getElementById('admin-clear-gemini-key-btn');

  if (saveGeminiKeyBtn && geminiKeyInput) {
    saveGeminiKeyBtn.addEventListener('click', () => {
      const key = geminiKeyInput.value.trim();
      store.setLiveRexApiKey(key);
      Sound.fanfare();
      alert('Google Gemini API Key saved successfully! Rex the Dino is ready for live voice interactions.');
    });
  }

  if (clearGeminiKeyBtn) {
    clearGeminiKeyBtn.addEventListener('click', () => {
      store.setLiveRexApiKey('');
      if (geminiKeyInput) geminiKeyInput.value = '';
      Sound.click();
      alert('Custom Gemini API Key cleared. Default project key will be used.');
    });
  }

  document.querySelectorAll('.rex-voice-select-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const voice = btn.getAttribute('data-rex-voice');
      if (voice) {
        Sound.click();
        store.setLiveRexVoice(voice);
      }
    });
  });

  const autoListenToggle = document.getElementById('admin-rex-autolisten-toggle');
  if (autoListenToggle) {
    autoListenToggle.addEventListener('click', () => {
      Sound.click();
      const current = store.getState().liveRex?.autoListenInQuests !== false;
      store.setLiveRexState({ autoListenInQuests: !current });
      store.saveState();
    });
  }

  const testRexBtn = document.getElementById('admin-test-rex-voice-btn');
  if (testRexBtn) {
    testRexBtn.addEventListener('click', () => {
      Sound.chirp();
      store.toggleLiveRexModal(true);
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

  // ACTION INBOX: Photo Proof Zoom Modal Listeners
  document.querySelectorAll('.admin-proof-thumb').forEach((thumb) => {
    thumb.addEventListener('click', (e) => {
      e.stopPropagation();
      zoomedProofPhotoUrl = thumb.getAttribute('data-full-img');
      Sound.click();
      store.notify();
    });
  });

  const zoomCloseBtn = document.getElementById('admin-proof-zoom-close-btn');
  if (zoomCloseBtn) {
    zoomCloseBtn.addEventListener('click', () => {
      zoomedProofPhotoUrl = null;
      Sound.click();
      store.notify();
    });
  }

  const zoomDismissBtn = document.getElementById('admin-proof-zoom-dismiss-btn');
  if (zoomDismissBtn) {
    zoomDismissBtn.addEventListener('click', () => {
      zoomedProofPhotoUrl = null;
      Sound.click();
      store.notify();
    });
  }

  const zoomBackdrop = document.getElementById('admin-proof-zoom-backdrop');
  if (zoomBackdrop) {
    zoomBackdrop.addEventListener('click', (e) => {
      if (e.target === zoomBackdrop) {
        zoomedProofPhotoUrl = null;
        Sound.click();
        store.notify();
      }
    });
  }

  // SCREEN TIME BANK: Multi-Kid Pills
  document.querySelectorAll('.screentime-kid-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      selectedScreenTimeKidId = pill.getAttribute('data-screentime-kid');
      Sound.click();
      store.notify();
    });
  });

  // SCREEN TIME BANK: Quick Overrides
  document.querySelectorAll('.admin-screentime-bonus-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kidId = btn.getAttribute('data-screentime-bonus');
      store.grantScreenTimeBonus(kidId, 15);
    });
  });

  document.querySelectorAll('.admin-screentime-deduct-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kidId = btn.getAttribute('data-screentime-deduct');
      store.deductScreenTime(kidId, 15);
    });
  });

  document.querySelectorAll('.admin-screentime-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kidId = btn.getAttribute('data-screentime-toggle');
      store.toggleScreenTimePause(kidId);
    });
  });

  // SCREEN TIME BANK: Save Settings
  const saveScreenTimeSettingsBtn = document.getElementById('screentime-save-settings-btn');
  if (saveScreenTimeSettingsBtn) {
    saveScreenTimeSettingsBtn.addEventListener('click', () => {
      const rateSelect = document.getElementById('screentime-rate-select');
      const capSelect = document.getElementById('screentime-cap-select');
      const curfewInput = document.getElementById('screentime-curfew-input');
      const lockoutMsgInput = document.getElementById('screentime-lockout-msg');

      store.updateScreenTimeSettings(selectedScreenTimeKidId, {
        screenTimeRate: rateSelect ? Number(rateSelect.value) : 2,
        dailyMaxScreenTime: capSelect ? Number(capSelect.value) : 60,
        bedtimeCurfew: curfewInput ? curfewInput.value : '20:00',
        screenTimeLockMessage: lockoutMsgInput ? lockoutMsgInput.value : 'Rex says: Great job today! Time to play outside or get cozy for bedtime! 🦖🌙'
      });

      Sound.fanfare();
      alert('Screen Time Governance Rules successfully updated!');
    });
  }

  // 4-PILLAR AI DEVELOPMENTAL REPORTS: Multi-Kid Pills
  document.querySelectorAll('.report-kid-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      selectedReportKidId = pill.getAttribute('data-report-kid');
      currentDevelopmentalReport = null;
      Sound.click();
      store.notify();
    });
  });

  // 4-PILLAR AI DEVELOPMENTAL REPORTS: Week Selector
  const reportWeekSelect = document.getElementById('report-week-select');
  if (reportWeekSelect) {
    reportWeekSelect.addEventListener('change', (e) => {
      selectedReportWeekOffset = Number(e.target.value);
      currentDevelopmentalReport = null;
      Sound.click();
      store.notify();
    });
  }

  // 4-PILLAR AI DEVELOPMENTAL REPORTS: Regenerate with Gemini
  const reportRegenerateBtn = document.getElementById('report-regenerate-btn');
  if (reportRegenerateBtn) {
    reportRegenerateBtn.addEventListener('click', async () => {
      if (isLoadingReport) return;
      isLoadingReport = true;
      Sound.click();
      store.notify();

      try {
        const state = store.getState();
        const hero = selectedReportKidId === 'all' ? null : state.heroes.find(h => h.id === selectedReportKidId);
        const report = await aiDevelopmentalReportService.getWeeklyReport({
          hero,
          heroes: state.heroes,
          completionLogs: state.taskCompletionLogs || [],
          petStats: state.petStatsMap?.[1] || { joy: 88, hygiene: 92 },
          weekOffset: selectedReportWeekOffset,
          forceRefresh: true
        });
        currentDevelopmentalReport = report;
        Sound.fanfare();
      } catch (err) {
        console.warn('Failed to regenerate report:', err);
      } finally {
        isLoadingReport = false;
        store.notify();
      }
    });
  }

  // 4-PILLAR AI DEVELOPMENTAL REPORTS: Print / Export
  const reportPrintBtn = document.getElementById('report-print-btn');
  if (reportPrintBtn) {
    reportPrintBtn.addEventListener('click', () => {
      Sound.click();
      window.print();
    });
  }

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

  // SYNC NOW (REAL-TIME DATA PULL & VERIFICATION)
  const syncNowBtn = document.getElementById('admin-sync-now-btn');
  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', async () => {
      syncNowBtn.disabled = true;
      syncNowBtn.innerHTML = `
        <span class="material-symbols-outlined text-sm animate-spin">sync</span>
        Verifying...
      `;
      const res = await firestoreSync.syncNow();
      syncNowBtn.disabled = false;

      if (res && res.verified) {
        Sound.fanfare();
        syncNowBtn.innerHTML = `
          <span class="material-symbols-outlined text-sm text-primary">check_circle</span>
          Verified In Sync!
        `;
        alert(`✅ Cloud Sync Verified!\n\nHousehold: ${res.householdName} (${res.code})\nKids Synced: ${res.kids?.join(', ') || res.kidCount + ' kid(s)'}\nConnected Devices: ${res.deviceCount}\n\nAll devices in this household are verified in real time.`);
      } else {
        Sound.hit();
        syncNowBtn.innerHTML = `
          <span class="material-symbols-outlined text-sm text-error">error</span>
          Sync Error
        `;
        alert(`Cloud Sync Note: ${res?.error || 'Local mode active.'}`);
      }

      setTimeout(() => {
        syncNowBtn.innerHTML = `
          <span class="material-symbols-outlined text-sm">sync</span>
          Sync Now
        `;
      }, 3000);
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

  // Rex AI Companion Voice Persona Selection
  document.querySelectorAll('.rex-voice-select-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const vId = btn.getAttribute('data-voice-id');
      if (vId) {
        Sound.click();
        store.setLiveRexVoice(vId);
      }
    });
  });

  // MULTI-CATEGORY 3D STUDIO & AI CRAFTING LISTENERS
  const studioCanvasEl = document.getElementById('parent-ai-preview-canvas');
  if (activeAdminTab === 'studio') {
    // 1. Cancel any active animation frame
    if (activeStudioAnimFrame) {
      cancelAnimationFrame(activeStudioAnimFrame);
      activeStudioAnimFrame = null;
    }

    // 2. Destroy prior skeletal canvas instance if present
    if (activeStudioCanvasInstance) {
      try {
        activeStudioCanvasInstance.destroy();
      } catch (e) {}
      activeStudioCanvasInstance = null;
    }

    // 3. Initialize Stage View based on active category
    if (studioCanvasEl && studioViewportMode === 'canvas') {
      if (studioActiveCategory === 'gear') {
        try {
          const equipped = store.getEquippedPetStudioGear(studioSelectedPetId);
          const dyes = store.getCustomGearDyes(studioSelectedPetId);
          equipped[studioSelectedSocket] = studioItemArchetype || (studioSelectedSocket === 'head' ? 'visor_cyber_tech' : studioSelectedSocket === 'back' ? 'wings_meteor' : studioSelectedSocket === 'chest' ? 'harness_power_gem' : 'boots_speed_neon');
          dyes[studioSelectedSocket] = studioSelectedDye;

          activeStudioCanvasInstance = new PetSkeletalBodyCanvas(studioCanvasEl, {
            petId: studioSelectedPetId,
            equippedGear: equipped,
            gearColors: dyes,
            pose: RUNWAY_POSES.HERO_LANDING
          });
          activeStudioCanvasInstance.setWind(2.0, -2.5);
        } catch (err) {
          console.warn('Parent studio canvas initialization fallback:', err);
        }
      } else {
        // High-performance procedural isometric 3D canvas stage for Furniture, Toy, and Boss
        const ctx = studioCanvasEl.getContext('2d');
        if (ctx) {
          let animAngle = 0;
          const drawIsometricStage = () => {
            animAngle += 0.025;
            const w = studioCanvasEl.width;
            const h = studioCanvasEl.height;
            ctx.clearRect(0, 0, w, h);

            // Ambient background glow
            const grad = ctx.createRadialGradient(w/2, h/2, 20, w/2, h/2, 160);
            grad.addColorStop(0, studioActiveCategory === 'furniture' ? 'rgba(16,185,129,0.25)' : studioActiveCategory === 'toy' ? 'rgba(168,85,247,0.25)' : 'rgba(239,68,68,0.3)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Isometric Ground Pedestal
            const cx = w / 2;
            const cy = h * 0.72;
            ctx.save();
            ctx.translate(cx, cy);

            // Outer ring
            ctx.beginPath();
            ctx.ellipse(0, 0, 110, 45, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#0f172a';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = studioActiveCategory === 'furniture' ? '#10b981' : studioActiveCategory === 'toy' ? '#a855f7' : '#ef4444';
            ctx.stroke();

            // Inner ring
            ctx.beginPath();
            ctx.ellipse(0, 0, 85, 32, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#1e293b';
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#fbbf24';
            ctx.stroke();
            ctx.restore();

            // Animated Object Floating Above Pedestal
            const floatY = cy - 60 + Math.sin(animAngle) * 10;
            ctx.save();
            ctx.translate(cx, floatY);

            if (studioActiveCategory === 'furniture') {
              // 3D Isometric Furniture Model
              ctx.fillStyle = '#334155';
              ctx.beginPath();
              ctx.moveTo(0, -25);
              ctx.lineTo(45, 0);
              ctx.lineTo(0, 25);
              ctx.lineTo(-45, 0);
              ctx.closePath();
              ctx.fillStyle = studioSelectedDye || '#10b981';
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.stroke();

              // Icon/Emoji badge
              ctx.font = '42px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(studioFurnitureType === 'bed' ? '🛏️' : studioFurnitureType === 'desk' ? '💻' : studioFurnitureType === 'petLounge' ? '🛋️' : studioFurnitureType === 'rug' ? '🌈' : '🏆', 0, -10);
            } else if (studioActiveCategory === 'toy') {
              // 3D Bouncing Toy Model with Springs
              const bounceY = Math.abs(Math.sin(animAngle * 1.5)) * 12;
              ctx.font = '48px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(studioToyType === 'trampoline' ? '🎪' : studioToyType === 'ball' ? '🚀' : studioToyType === 'laser' ? '✨' : studioToyType === 'puzzle' ? '🧩' : '⚡', 0, -15 - bounceY);

              // Spring coils below toy
              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(0, 15, 20 + bounceY * 0.5, 0, Math.PI);
              ctx.stroke();
            } else {
              // 3D AR Villain with Pulsing Corona & Horns
              ctx.font = '54px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(studioBossDomain === 'dental' ? '👾' : studioBossDomain === 'bedtime' ? '⏰' : studioBossDomain === 'screens' ? '📱' : '🥦', 0, -15);

              // Menacing Villain Health Bar Preview
              ctx.fillStyle = 'rgba(0,0,0,0.8)';
              ctx.fillRect(-50, 25, 100, 10);
              ctx.fillStyle = '#ef4444';
              ctx.fillRect(-48, 27, 96, 6);
              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 1;
              ctx.strokeRect(-50, 25, 100, 10);
            }

            ctx.restore();

            activeStudioAnimFrame = requestAnimationFrame(drawIsometricStage);
          };

          drawIsometricStage();
        }
      }
    }

    // Helper to refresh live preview on canvas
    const refreshStudioCanvas = () => {
      if (activeStudioCanvasInstance && studioActiveCategory === 'gear') {
        activeStudioCanvasInstance.setGear(studioSelectedSocket, studioItemArchetype);
        activeStudioCanvasInstance.setGearColor(studioSelectedSocket, studioSelectedDye);
      }
    };

    // 4. Category Switching Pills
    document.querySelectorAll('.studio-category-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-category');
        if (!cat || cat === studioActiveCategory) return;
        studioActiveCategory = cat;

        // Auto-configure category defaults
        if (cat === 'gear') {
          studioItemName = 'Cyber Sentinel Visor';
          studioItemDesc = 'High-tech neon holographic HUD visor glowing with electric power!';
          studioItemPrice = 150;
          studioPetVoiceLine = 'Zap! Ready for hyper-speed hero adventures!';
          studioActiveSplineUrl = '';
        } else if (cat === 'furniture') {
          studioItemName = 'Cozy Starlight Leaf Bed';
          studioItemDesc = 'Soft canopy bed designed for deep superhero sleep and sweet dreams!';
          studioItemPrice = 175;
          studioPetVoiceLine = 'Zzz... This cozy bed is the best spot in the whole Hero HQ!';
          studioFurnitureType = 'bed';
          studioFurnitureZone = 'bedroom';
          studioFurnitureComfort = 30;
          studioActiveSplineUrl = SPLINE_3D_PRESETS.furniture[0]?.splineUrl || '';
        } else if (cat === 'toy') {
          studioItemName = 'Anti-Gravity Trampoline';
          studioItemDesc = 'High-rebound trampoline mat that lets pets do backflips in the air!';
          studioItemPrice = 100;
          studioPetVoiceLine = 'WHEEEEE! Look how high I can bounce! Super flip!';
          studioToyType = 'trampoline';
          studioToyStat = 'joy';
          studioToyAmount = 35;
          studioActiveSplineUrl = SPLINE_3D_PRESETS.toy[0]?.splineUrl || '';
                } else if (cat === 'pet') {
          studioPetArchetype = sparkKey;
          const matched = petThemes.find(t => t.key === sparkKey);
          if (matched) {
            studioItemName = matched.label.split(' ').slice(1).join(' ');
            studioItemDesc = matched.desc;
            studioSelectedDye = matched.color;
            studioPetVoiceLine = 'Ready for adventures and chores!';
          }
        } else if (cat === 'boss') {
          studioItemName = 'Lord Plaque The Sticky';
          studioItemDesc = 'Sneaky tooth-decay overlord lurking in deep enamel crevices!';
          studioItemPrice = 60;
          studioBossTaunt = 'No toothbrush can breach my sticky sugar shield!';
          studioBossRally = 'Heroes, brush in high-speed circles to break the shield!';
          studioBossDomain = 'dental';
          studioBossHp = 300;
          studioBossCoins = 60;
          studioActiveSplineUrl = SPLINE_3D_PRESETS.boss[0]?.splineUrl || '';
        }

        Sound.click();
        store.notify();
      });
    });

    // 5. Dual Viewport Toggle (Canvas vs Spline)
    const canvasModeBtn = document.getElementById('studio-mode-canvas-btn');
    if (canvasModeBtn) {
      canvasModeBtn.addEventListener('click', () => {
        studioViewportMode = 'canvas';
        Sound.click();
        store.notify();
      });
    }

    const splineModeBtn = document.getElementById('studio-mode-spline-btn');
    if (splineModeBtn) {
      splineModeBtn.addEventListener('click', () => {
        studioViewportMode = 'spline';
        if (!studioActiveSplineUrl) {
          const presets = SPLINE_3D_PRESETS[studioActiveCategory] || [];
          if (presets.length > 0) {
            studioActiveSplineUrl = presets[0].splineUrl;
          }
        }
        Sound.sparkle();
        store.notify();
      });
    }

    // 6. Spline Presets Dropdown
    const splinePresetSelect = document.getElementById('studio-spline-preset-select');
    if (splinePresetSelect) {
      splinePresetSelect.addEventListener('change', (e) => {
        const url = e.target.value;
        if (url) {
          studioActiveSplineUrl = url;
          studioViewportMode = 'spline';
          Sound.sparkle();
          store.notify();
        }
      });
    }

    // 7. Custom Spline URL Load Button
    const splineLoadBtn = document.getElementById('studio-spline-load-btn');
    if (splineLoadBtn) {
      splineLoadBtn.addEventListener('click', () => {
        const input = document.getElementById('studio-spline-url-input');
        if (input && input.value.trim()) {
          studioActiveSplineUrl = input.value.trim();
          studioViewportMode = 'spline';
          Sound.sparkle();
          store.notify();
        }
      });
    }

    // 8. Quick Sparks Theme Chips
    document.querySelectorAll('.studio-spark-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const sparkKey = btn.getAttribute('data-spark');
        const cat = btn.getAttribute('data-category');
        if (!sparkKey) return;

        if (cat === 'gear') {
          studioSelectedTheme = sparkKey;
          if (sparkKey === 'cyber') {
            studioSelectedSocket = 'head';
            studioItemArchetype = 'visor';
            studioSelectedDye = '#06b6d4';
            studioItemAura = 'electric';
            studioStatType = 'damage_boost';
            studioStatPercent = 25;
            studioItemPrice = 150;
            studioItemName = 'Cyber Sentinel Visor';
            studioItemDesc = 'High-tech neon holographic HUD visor glowing with electric power!';
            studioPetVoiceLine = 'Zap! Ready for hyper-speed hero adventures!';
          } else if (sparkKey === 'fire') {
            studioSelectedSocket = 'head';
            studioItemArchetype = 'tiara';
            studioSelectedDye = '#f97316';
            studioItemAura = 'fire';
            studioStatType = 'damage_boost';
            studioStatPercent = 30;
            studioItemPrice = 200;
            studioItemName = 'Phoenix Fire Tiara';
            studioItemDesc = 'Flaming solar crest radiating blazing hero courage!';
            studioPetVoiceLine = 'Roar! Feel the blazing fire energy!';
          } else if (sparkKey === 'rainbow') {
            studioSelectedSocket = 'feet';
            studioItemArchetype = 'starlight_bands';
            studioSelectedDye = '#ec4899';
            studioItemAura = 'stardust';
            studioStatType = 'coin_boost';
            studioStatPercent = 25;
            studioItemPrice = 150;
            studioItemName = 'Starlight Sparkle Bands';
            studioItemDesc = 'Magical prism bands bursting with colorful confetti bursts!';
            studioPetVoiceLine = 'Sparkle sparkle! Every step is magical!';
          } else if (sparkKey === 'space') {
            studioSelectedSocket = 'back';
            studioItemArchetype = 'jetpack';
            studioSelectedDye = '#3b82f6';
            studioItemAura = 'cosmic';
            studioStatType = 'speed_boost';
            studioStatPercent = 30;
            studioItemPrice = 250;
            studioItemName = 'Cosmic Turbo Thrusters';
            studioItemDesc = 'High-velocity ion thrusters designed for deep space orbits!';
            studioPetVoiceLine = 'Blast off! To infinity and beyond!';
          } else if (sparkKey === 'royal') {
            studioSelectedSocket = 'head';
            studioItemArchetype = 'crown';
            studioSelectedDye = '#fbbf24';
            studioItemAura = 'stardust';
            studioStatType = 'coin_boost';
            studioStatPercent = 30;
            studioItemPrice = 200;
            studioItemName = 'Regal Sun King Crown';
            studioItemDesc = 'Polished golden crown with sovereign stardust crests!';
            studioPetVoiceLine = 'Bow before my regal superhero greatness!';
          } else if (sparkKey === 'ocean') {
            studioSelectedSocket = 'back';
            studioItemArchetype = 'wings';
            studioSelectedDye = '#10b981';
            studioItemAura = 'wind';
            studioStatType = 'speed_boost';
            studioStatPercent = 25;
            studioItemPrice = 175;
            studioItemName = 'Ocean Glider Wings';
            studioItemDesc = 'Hydro-aerodynamic wings built to glide through tidal storms!';
            studioPetVoiceLine = 'Splash! Gliding through the sky like an ocean wave!';
          }
        } else if (cat === 'furniture') {
          if (sparkKey === 'cozy_bed') {
            studioFurnitureType = 'bed';
            studioFurnitureZone = 'bedroom';
            studioFurnitureComfort = 30;
            studioItemName = 'Cozy Starlight Bed';
            studioItemDesc = 'Ultra-plush leaf canopy bed with soothing ambient starlight glow!';
            studioPetVoiceLine = 'Zzz... Sweet superhero dreams engaged!';
          } else if (sparkKey === 'gamer_desk') {
            studioFurnitureType = 'desk';
            studioFurnitureZone = 'command_deck';
            studioFurnitureComfort = 25;
            studioItemName = 'Holo Mission Battle Station';
            studioItemDesc = 'RGB battle station with 3D hologram projector of routine tasks!';
            studioPetVoiceLine = 'Mission table online! All systems operational!';
          } else if (sparkKey === 'throne_lounge') {
            studioFurnitureType = 'petLounge';
            studioFurnitureZone = 'lounge';
            studioFurnitureComfort = 35;
            studioItemName = 'Royal Velvet Pet Throne';
            studioItemDesc = 'Regal cushioned lounge where brave companions rest between quests!';
            studioPetVoiceLine = 'A throne fit for the champion of bedtime routines!';
          } else if (sparkKey === 'hero_rug') {
            studioFurnitureType = 'rug';
            studioFurnitureZone = 'lounge';
            studioFurnitureComfort = 20;
            studioItemName = 'Rainbow Starlight Rug';
            studioItemDesc = 'Braided starlight rug that tickles paws with every step!';
            studioPetVoiceLine = 'So soft! Like walking on a cozy cloud!';
          } else if (sparkKey === 'trophy_stand') {
            studioFurnitureType = 'decor';
            studioFurnitureZone = 'trophy_hall';
            studioFurnitureComfort = 20;
            studioItemName = 'Golden Champion Pedestal';
            studioItemDesc = 'Polished marble stand celebrating consistency and hygiene triumphs!';
            studioPetVoiceLine = 'Look at our gleaming badges! We did it!';
          }
        } else if (cat === 'toy') {
          if (sparkKey === 'trampoline') {
            studioToyType = 'trampoline';
            studioToyStat = 'joy';
            studioToyAmount = 35;
            studioItemName = 'Super Boing Trampoline';
            studioItemDesc = 'Anti-gravity bouncy pad designed for thrilling sky flips!';
            studioPetVoiceLine = 'BOING! Look how high I jumped! Super acrobatic flip!';
          } else if (sparkKey === 'ball_launcher') {
            studioToyType = 'ball';
            studioToyStat = 'energy';
            studioToyAmount = 30;
            studioItemName = 'Turbo Glow-Ball Launcher';
            studioItemDesc = 'High-velocity cannon firing bouncy starlight tennis balls!';
            studioPetVoiceLine = 'FETCH! Going at lightning speed!';
          } else if (sparkKey === 'laser_mouse') {
            studioToyType = 'laser';
            studioToyStat = 'joy';
            studioToyAmount = 25;
            studioItemName = 'Starlight Laser Mouse';
            studioItemDesc = 'Holographic darting stardust mouse that darts across the pen!';
            studioPetVoiceLine = 'I am gonna catch that red dot! Almost got it!';
          } else if (sparkKey === 'treat_puzzle') {
            studioToyType = 'puzzle';
            studioToyStat = 'hunger';
            studioToyAmount = 40;
            studioItemName = 'Enigma Treat Puzzle Box';
            studioItemDesc = 'Interactive slide-and-solve toy dispensing healthy fruit treats!';
            studioPetVoiceLine = 'Solved it! Delicious healthy snack unlocked!';
          } else if (sparkKey === 'agility_ramp') {
            studioToyType = 'agility';
            studioToyStat = 'all';
            studioToyAmount = 25;
            studioItemName = 'Sonic Agility Obstacle Ramp';
            studioItemDesc = 'Looping speed track testing reflexes, coordination and agility!';
            studioPetVoiceLine = 'Speed record broken! Hero stamina recharged!';
          }
        } else if (cat === 'boss') {
          if (sparkKey === 'sugar_monster') {
            studioBossDomain = 'dental';
            studioBossHp = 300;
            studioBossCoins = 65;
            studioItemName = 'Sticky Sugar King';
            studioItemDesc = 'Sweet-toothed villain spreading sticky acid plaque across teeth!';
            studioBossTaunt = 'Your toothbrush cannot break my sugary shield!';
            studioBossRally = 'Heroes, brush thoroughly in circular strokes to dissolve the sugar!';
          } else if (sparkKey === 'bedtime_gremlin') {
            studioBossDomain = 'bedtime';
            studioBossHp = 250;
            studioBossCoins = 50;
            studioItemName = 'Clock-Changer Gremlin';
            studioItemDesc = 'Mischievous imp who sneaks into clocks to delay bedtime!';
            studioBossTaunt = 'Just 5 more minutes! You will never get to sleep!';
            studioBossRally = 'Tuck in and power down! A well-rested hero is invincible!';
          } else if (sparkKey === 'screen_slime') {
            studioBossDomain = 'screens';
            studioBossHp = 350;
            studioBossCoins = 80;
            studioItemName = 'Zombie Screen Glitch';
            studioItemDesc = 'Static-infused goblin that locks eyes onto glowing screens!';
            studioBossTaunt = 'Keep staring at the screen forever!';
            studioBossRally = 'Close the screen, stretch out, and break the digital trance!';
          } else if (sparkKey === 'veggie_dodger') {
            studioBossDomain = 'nutrition';
            studioBossHp = 220;
            studioBossCoins = 45;
            studioItemName = 'Brocc-O-Hater Ghoul';
            studioItemDesc = 'Grumpy shadow that whispers excuses to skip nutritious vegetables!';
            studioBossTaunt = 'Green veggies are boring! Eat junk food!';
            studioBossRally = 'Crunch down on vitamins to unleash unstoppable superhero energy!';
          }
        }

        Sound.bloop();
        store.notify();
      });
    });

    // 9. Companion Pet Switcher (Gear)
    document.querySelectorAll('.studio-pet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = parseInt(btn.getAttribute('data-pet-id'), 10);
        if (!pId || pId === studioSelectedPetId) return;
        studioSelectedPetId = pId;
        Sound.click();
        store.notify();
      });
    });

    // 10. Target Socket Selector (Gear)
    document.querySelectorAll('.studio-socket-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const socket = btn.getAttribute('data-socket');
        if (!socket || socket === studioSelectedSocket) return;
        studioSelectedSocket = socket;
        if (socket === 'head') studioItemArchetype = 'visor';
        else if (socket === 'back') studioItemArchetype = 'wings';
        else if (socket === 'chest') studioItemArchetype = 'harness';
        else if (socket === 'feet') studioItemArchetype = 'speed_boots';
        Sound.click();
        store.notify();
      });
    });

    // 11. Color Dye Swatches (Gear)
    document.querySelectorAll('.studio-dye-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const hex = btn.getAttribute('data-hex');
        if (!hex) return;
        studioSelectedDye = hex;
        Sound.sparkle();
        if (activeStudioCanvasInstance && studioActiveCategory === 'gear') {
          activeStudioCanvasInstance.setGearColor(studioSelectedSocket, hex);
        }
        document.querySelectorAll('.studio-dye-btn').forEach(b => {
          b.classList.remove('border-white', 'ring-2', 'ring-amber-400', 'scale-110');
          b.classList.add('border-white/30');
          b.innerHTML = '';
        });
        btn.classList.remove('border-white/30');
        btn.classList.add('border-white', 'ring-2', 'ring-amber-400', 'scale-110');
        btn.innerHTML = '<span class="text-white text-[10px] font-black drop-shadow">✓</span>';
      });
    });

    // 12. Catwalk Poses (Gear)
    document.querySelectorAll('.studio-pose-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pose = btn.getAttribute('data-pose');
        if (!pose || !activeStudioCanvasInstance) return;
        activeStudioCanvasInstance.setPose(pose);
        Sound.click();
      });
    });

    // 13. Room Zone Buttons (Furniture)
    document.querySelectorAll('.studio-zone-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const zone = btn.getAttribute('data-zone');
        if (zone) {
          studioFurnitureZone = zone;
          Sound.click();
          store.notify();
        }
      });
    });

    // 14. Toy Stat Buttons (Toys)
    document.querySelectorAll('.studio-toy-stat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const stat = btn.getAttribute('data-stat');
        if (stat) {
          studioToyStat = stat;
          Sound.click();
          store.notify();
        }
      });
    });

    // 15. Boss Domain Buttons (Bosses)
    document.querySelectorAll('.studio-boss-domain-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dom = btn.getAttribute('data-domain');
        if (dom) {
          studioBossDomain = dom;
          Sound.click();
          store.notify();
        }
      });
    });

    // Boss Dental Battle Controls Listeners
    document.querySelectorAll('.studio-boss-duration-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dur = parseInt(btn.getAttribute('data-duration'), 10);
        if (dur) {
          studioBossBattleDuration = dur;
          Sound.click();
          store.notify();
        }
      });
    });

    document.querySelectorAll('.studio-boss-attack-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const atk = btn.getAttribute('data-attack');
        if (atk) {
          studioBossAttackType = atk;
          Sound.click();
          store.notify();
        }
      });
    });

    document.querySelectorAll('.studio-boss-focus-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const foc = btn.getAttribute('data-focus');
        if (foc) {
          studioBossFocusQuadrant = foc;
          Sound.click();
          store.notify();
        }
      });
    });

    // 16. Sliders & Input Syncs
    const archetypeSelect = document.getElementById('studio-gear-archetype');
    if (archetypeSelect) {
      archetypeSelect.addEventListener('change', (e) => {
        studioItemArchetype = e.target.value;
        refreshStudioCanvas();
      });
    }

    const furnitureTypeSelect = document.getElementById('studio-furniture-type-select');
    if (furnitureTypeSelect) {
      furnitureTypeSelect.addEventListener('change', (e) => {
        studioFurnitureType = e.target.value;
      });
    }

    const toyTypeSelect = document.getElementById('studio-toy-type-select');
    if (toyTypeSelect) {
      toyTypeSelect.addEventListener('change', (e) => {
        studioToyType = e.target.value;
      });
    }

    const bossDomainSelect = document.getElementById('studio-boss-domain-select');
    if (bossDomainSelect) {
      bossDomainSelect.addEventListener('change', (e) => {
        studioBossDomain = e.target.value;
      });
    }

    const auraSelect = document.getElementById('studio-item-aura');
    if (auraSelect) {
      auraSelect.addEventListener('change', (e) => {
        studioItemAura = e.target.value;
      });
    }

    const priceSlider = document.getElementById('studio-gear-price') || document.getElementById('studio-item-price');
    if (priceSlider) {
      priceSlider.addEventListener('input', (e) => {
        studioItemPrice = parseInt(e.target.value, 10) || 100;
        const priceLabel = document.getElementById('studio-item-price-label');
        if (priceLabel) priceLabel.textContent = `🪙 ${studioItemPrice} Tokens`;
      });
    }

    const statTypeSelect = document.getElementById('studio-gear-stat-type');
    if (statTypeSelect) {
      statTypeSelect.addEventListener('change', (e) => {
        studioStatType = e.target.value;
        const badge = document.getElementById('studio-stat-badge');
        if (badge) badge.textContent = `+${studioStatPercent}% ${formatStatBonusName(studioStatType)}`;
      });
    }

    const statPercentSlider = document.getElementById('studio-gear-stat-percent');
    if (statPercentSlider) {
      statPercentSlider.addEventListener('input', (e) => {
        studioStatPercent = parseInt(e.target.value, 10) || 25;
        const percentLabel = document.getElementById('studio-stat-percent-label');
        if (percentLabel) percentLabel.textContent = `+${studioStatPercent}%`;
        const badge = document.getElementById('studio-stat-badge');
        if (badge) badge.textContent = `+${studioStatPercent}% ${formatStatBonusName(studioStatType)}`;
      });
    }

    const comfortSlider = document.getElementById('studio-furniture-comfort-slider');
    if (comfortSlider) {
      comfortSlider.addEventListener('input', (e) => {
        studioFurnitureComfort = parseInt(e.target.value, 10) || 25;
        const val = document.getElementById('studio-comfort-val');
        if (val) val.textContent = `+${studioFurnitureComfort} Comfort`;
        const badge = document.getElementById('studio-comfort-badge');
        if (badge) badge.textContent = `+${studioFurnitureComfort} Comfort XP`;
      });
    }

    const toyAmountSlider = document.getElementById('studio-toy-amount-slider');
    if (toyAmountSlider) {
      toyAmountSlider.addEventListener('input', (e) => {
        studioToyAmount = parseInt(e.target.value, 10) || 30;
        const val = document.getElementById('studio-toy-amount-val');
        if (val) val.textContent = `+${studioToyAmount} Points`;
        const badge = document.getElementById('studio-toy-badge');
        if (badge) badge.textContent = `+${studioToyAmount} ${studioToyStat.toUpperCase()}`;
      });
    }

    const bossHpSlider = document.getElementById('studio-boss-hp-slider');
    const bossCoinsSlider = document.getElementById('studio-boss-coins-slider');
    const updateBossBadge = () => {
      const badge = document.getElementById('studio-boss-badge');
      if (badge) badge.textContent = `HP: ${studioBossHp} • Reward: ${studioBossCoins} 🪙`;
    };
    if (bossHpSlider) {
      bossHpSlider.addEventListener('input', (e) => {
        studioBossHp = parseInt(e.target.value, 10) || 250;
        updateBossBadge();
      });
    }
    if (bossCoinsSlider) {
      bossCoinsSlider.addEventListener('input', (e) => {
        studioBossCoins = parseInt(e.target.value, 10) || 50;
        updateBossBadge();
      });
    }

    // 17. Unified AI Generate Button (Gemini 2.5 + Offline Fallback)
    const studioAiBtn = document.getElementById('studio-gear-ai-btn') || document.getElementById('studio-ai-btn');
    if (studioAiBtn) {
      studioAiBtn.addEventListener('click', async () => {
        if (isStudioGenerating) return;
        isStudioGenerating = true;
        Sound.sparkle();
        store.notify();

        try {
          const promptInput = document.getElementById('studio-ai-prompt')?.value || studioSelectedTheme;
          const generated = await firebaseAI.generate3DContent({
            category: studioActiveCategory,
            promptText: promptInput,
            theme: studioSelectedTheme,
            socket: studioSelectedSocket,
            petId: studioSelectedPetId,
            furnitureType: studioFurnitureType,
            toyType: studioToyType,
            domain: studioBossDomain,
            defaultPrice: studioItemPrice
          });

          if (generated) {
            studioItemName = generated.name || studioItemName;
            studioItemDesc = generated.desc || studioItemDesc;
            studioItemPrice = generated.costCoins || generated.rewardCoins || studioItemPrice;
            if (generated.splineUrl) studioActiveSplineUrl = generated.splineUrl;

            if (studioActiveCategory === 'gear') {
              studioSelectedSocket = generated.socket || studioSelectedSocket;
              studioItemArchetype = generated.meshArchetype || studioItemArchetype;
              studioSelectedDye = generated.primaryColor || studioSelectedDye;
              studioItemAura = generated.aura || studioItemAura;
              studioStatType = generated.statBonusType || studioStatType;
              studioStatPercent = generated.statBonusPercent || studioStatPercent;
              studioPetVoiceLine = generated.petVoiceLine || studioPetVoiceLine;
            } else if (studioActiveCategory === 'furniture') {
              studioFurnitureType = generated.slot || studioFurnitureType;
              studioFurnitureComfort = generated.comfort || studioFurnitureComfort;
              studioPetVoiceLine = generated.petVoiceLine || studioPetVoiceLine;
            } else if (studioActiveCategory === 'toy') {
              studioToyType = generated.toyType || studioToyType;
              studioToyStat = generated.statRefillTarget || studioToyStat;
              studioToyAmount = generated.statRefillAmount || studioToyAmount;
              studioPetVoiceLine = generated.cheerVoiceLine || studioPetVoiceLine;
                    } else if (studioActiveCategory === 'pet') {
          const petToPublish = {
            id: `parent_pet_${Date.now()}`,
            name: nameVal.trim() || 'Hero Companion',
            archetype: studioPetArchetype || 'dragon',
            color: studioSelectedDye || '#2ecc71',
            accentColor: '#f39c12',
            desc: descVal.trim() || 'A loyal 3D companion crafted with love by parent!',
            cheerVoiceLine: voiceVal.trim() || 'Woohoo! Great job on your chores!',
            sleepVoiceLine: 'Zzz... peaceful dreams, little hero...',
            habitSynergy: studioPetSynergy || 'dental',
            splineUrl: studioActiveSplineUrl || undefined,
            isCustom: true
          };
          store.addCustomAIPet(petToPublish, studioDeliveryMode || 'magic_egg');
          Sound.fanfare();
        } else if (studioActiveCategory === 'boss') {
              studioBossHp = generated.maxHp || studioBossHp;
              studioBossCoins = generated.rewardCoins || studioBossCoins;
              studioBossTaunt = generated.taunt || studioBossTaunt;
              studioBossRally = generated.rallyCall || studioBossRally;
            }
          }
          Sound.fanfare();
        } catch (err) {
          console.warn("AI generation failed:", err);
        } finally {
          isStudioGenerating = false;
          store.notify();
        }
      });
    }

    // 18. Unified Publish Live Button
    const publishBtn = document.getElementById('studio-gear-publish-btn') || document.getElementById('studio-publish-btn');
    if (publishBtn) {
      publishBtn.addEventListener('click', () => {
        const nameVal = document.getElementById('studio-item-name')?.value || studioItemName;
        const descVal = document.getElementById('studio-item-desc')?.value || studioItemDesc;
        const voiceVal = document.getElementById('studio-item-voiceline')?.value || studioPetVoiceLine;

        if (studioActiveCategory === 'gear') {
          const gearToPublish = {
            id: `parent_gear_${Date.now()}`,
            name: nameVal.trim() || 'Hero Pet Gear',
            title: nameVal.trim() || 'Hero Pet Gear',
            desc: descVal.trim() || 'Legendary 3D superhero gear handcrafted by parent!',
            socket: studioSelectedSocket,
            meshArchetype: studioItemArchetype,
            defaultColor: studioSelectedDye,
            primaryColor: studioSelectedDye,
            secondaryColor: '#fbbf24',
            aura: studioItemAura,
            statBonusType: studioStatType,
            statBonusPercent: studioStatPercent,
            statBonusLabel: `+${studioStatPercent}% ${formatStatBonusName(studioStatType)}`,
            costCoins: studioItemPrice,
            petVoiceLine: voiceVal.trim(),
            splineUrl: studioActiveSplineUrl || undefined,
            category: 'Avatar & Pet Gear',
            icon: studioSelectedSocket === 'head' ? 'crown' : studioSelectedSocket === 'back' ? 'shield' : studioSelectedSocket === 'chest' ? 'security' : 'sprint'
          };
          store.publishCustomAIGear(gearToPublish);
        } else if (studioActiveCategory === 'furniture') {
          const furnitureToPublish = {
            id: `parent_furniture_${Date.now()}`,
            name: nameVal.trim() || 'Hero HQ Furniture',
            slot: studioFurnitureType,
            themeId: 'custom',
            zone: studioFurnitureZone,
            comfort: studioFurnitureComfort,
            costCoins: studioItemPrice,
            desc: descVal.trim() || 'Custom Hero HQ furniture handcrafted by parent!',
            petVoiceLine: voiceVal.trim(),
            splineUrl: studioActiveSplineUrl || undefined,
            icon: studioFurnitureType === 'bed' ? '🛏️' : studioFurnitureType === 'desk' ? '💻' : studioFurnitureType === 'petLounge' ? '🛋️' : studioFurnitureType === 'rug' ? '🌈' : '🏆',
            isCustom: true
          };
          store.publishCustomAIFurniture(furnitureToPublish);
        } else if (studioActiveCategory === 'toy') {
          const toyToPublish = {
            id: `parent_toy_${Date.now()}`,
            name: nameVal.trim() || 'Pet Pen Toy',
            toyType: studioToyType,
            statRefillTarget: studioToyStat,
            statRefillAmount: studioToyAmount,
            costCoins: studioItemPrice,
            desc: descVal.trim() || 'Interactive pet toy handcrafted by parent!',
            cheerVoiceLine: voiceVal.trim(),
            splineUrl: studioActiveSplineUrl || undefined,
            emoji: studioToyType === 'trampoline' ? '🎪' : studioToyType === 'ball' ? '🚀' : studioToyType === 'laser' ? '✨' : studioToyType === 'puzzle' ? '🧩' : '⚡',
            isCustom: true
          };
          store.publishCustomAIToy(toyToPublish);
        } else if (studioActiveCategory === 'boss') {
          const bossToPublish = {
            id: `parent_boss_${Date.now()}`,
            name: nameVal.trim() || 'Custom Quest Boss',
            domain: studioBossDomain,
            maxHp: studioBossHp,
            currentHp: studioBossHp,
            rewardCoins: studioBossCoins,
            desc: descVal.trim() || 'Custom quest boss created by parent for habit battles!',
            taunt: voiceVal.trim() || studioBossTaunt,
            rallyCall: studioBossRally,
            splineUrl: studioActiveSplineUrl || undefined,
            battleDurationSec: studioBossBattleDuration || 120,
            attackType: studioBossAttackType || 'caramel_bomb',
            focusQuadrant: studioBossFocusQuadrant || 'all',
            emoji: studioBossDomain === 'dental' ? '👾' : studioBossDomain === 'bedtime' ? '⏰' : studioBossDomain === 'screens' ? '📱' : '🥦',
            gradient: studioBossDomain === 'dental' ? 'from-purple-900 to-indigo-950' : studioBossDomain === 'bedtime' ? 'from-blue-900 to-slate-950' : studioBossDomain === 'screens' ? 'from-emerald-900 to-slate-950' : 'from-rose-900 to-amber-950',
            accentBorder: 'border-purple-500',
            isCustom: true
          };
          store.publishCustomAIBoss(bossToPublish);
        }
      });
    }
  }

  // 19. Delete Handlers across all 4 categories
  document.querySelectorAll('.delete-custom-gear-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const gearId = btn.getAttribute('data-gear-id');
      if (gearId) store.deleteCustomAIGear(gearId);
    });
  });

  document.querySelectorAll('.delete-custom-furniture-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const fId = btn.getAttribute('data-furniture-id');
      if (fId) store.deleteCustomAIFurniture(fId);
    });
  });

  document.querySelectorAll('.delete-custom-toy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const toyId = btn.getAttribute('data-toy-id');
      if (toyId) store.deleteCustomAIToy(toyId);
    });
  });

  document.querySelectorAll('.delete-custom-boss-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bossId = btn.getAttribute('data-boss-id');
      if (bossId) store.deleteCustomAIBoss(bossId);
    });
  });

  document.querySelectorAll('.test-custom-boss-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bossId = btn.getAttribute('data-boss-id');
      if (bossId) {
        if (store.setSelectedBossId) store.setSelectedBossId(bossId);
        Sound.tap();
        store.navigate('ar_battle');
      }
    });
  });

  // PARENT ADMINISTRATOR MANAGEMENT LISTENERS
  const addParentBtn = document.getElementById('admin-add-parent-btn');
  if (addParentBtn) {
    addParentBtn.addEventListener('click', () => {
      isAddParentModalOpen = true;
      Sound.click();
      store.notify();
    });
  }

  const closeAddParentBtn = document.getElementById('add-parent-modal-close-btn');
  if (closeAddParentBtn) {
    closeAddParentBtn.addEventListener('click', () => {
      isAddParentModalOpen = false;
      Sound.click();
      store.notify();
    });
  }

  const cancelAddParentBtn = document.getElementById('add-parent-cancel-btn');
  if (cancelAddParentBtn) {
    cancelAddParentBtn.addEventListener('click', () => {
      isAddParentModalOpen = false;
      Sound.click();
      store.notify();
    });
  }

  const addParentBackdrop = document.getElementById('add-parent-modal-backdrop');
  if (addParentBackdrop) {
    addParentBackdrop.addEventListener('click', (e) => {
      if (e.target === addParentBackdrop) {
        isAddParentModalOpen = false;
        store.notify();
      }
    });
  }

  const submitAddParentBtn = document.getElementById('add-parent-submit-btn');
  if (submitAddParentBtn) {
    submitAddParentBtn.addEventListener('click', () => {
      const email = document.getElementById('new-parent-email')?.value?.trim();
      const name = document.getElementById('new-parent-name')?.value?.trim();
      const role = document.getElementById('new-parent-role')?.value || 'admin';

      if (!email || !email.includes('@')) {
        alert('Please enter a valid email address for the parent user.');
        return;
      }

      const res = store.addParentUser({ email, displayName: name, role });
      if (res.success) {
        Sound.fanfare();
        isAddParentModalOpen = false;
        firestoreSync.pushStateToCloud(true);
        store.showReward('Parent Authorized!', `${name || email} has been authorized as a Parent Administrator for ${store.getState().household.name}!`, 0, 0);
        store.notify();
      } else {
        Sound.hit();
        alert(res.error || 'Failed to add parent user.');
      }
    });
  }

  document.querySelectorAll('.remove-parent-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = btn.getAttribute('data-remove-parent');
      if (!targetId) return;
      if (confirm('Are you sure you want to remove this parent administrator from the household?')) {
        const res = store.removeParentUser(targetId);
        if (res.success) {
          Sound.click();
          firestoreSync.pushStateToCloud(true);
          store.notify();
        } else {
          alert(res.error || 'Cannot remove parent.');
        }
      }
    });
  });

  // AI PEDIATRIC INSIGHTS GENERATION LISTENERS (Analytics Tab)
  const generateInsightsHandler = async () => {
    Sound.chirp();
    isLoadingInsights = true;
    store.notify();

    try {
      const state = store.getState();
      const payload = {
        householdName: state.household?.name || 'The Hero Family',
        heroes: (state.heroes || []).map((h) => ({
          name: h.name,
          level: h.level || 1,
          points: h.points || 0,
          coins: h.coins || 0,
          streak: h.streak || 1,
          difficulty: h.gameDifficulty || 'medium'
        })),
        completedHabitsCount: state.taskCompletionLogs?.length || 5,
        pendingApprovalsCount: state.pendingApprovals?.length || 0
      };

      const result = await cloudFunctionsService.getParentInsights(payload);
      if (result && result.insights) {
        activeParentInsights = result.insights;
        Sound.fanfare();
      }
    } catch (err) {
      console.warn('Could not generate AI insights:', err);
      activeParentInsights = {
        executiveSummary: 'Your little heroes are building strong daily habits and demonstrating great consistency across their routines!',
        praiseHighlights: ['Consistent daily task participation', 'Great enthusiasm for learning quests'],
        parentTips: ['Praise effort and consistency rather than perfection', 'Celebrate small milestones together'],
        recommendedReward: 'Family movie night or special weekend outing'
      };
    } finally {
      isLoadingInsights = false;
      store.notify();
    }
  };

  const genInsightsBtn = document.getElementById('admin-generate-insights-btn');
  if (genInsightsBtn) {
    genInsightsBtn.addEventListener('click', generateInsightsHandler);
  }

  const refreshInsightsBtn = document.getElementById('admin-refresh-insights-btn');
  if (refreshInsightsBtn) {
    refreshInsightsBtn.addEventListener('click', generateInsightsHandler);
  }

  // REX COMPANION PARENTAL CONTROLS LISTENERS (Settings Tab)
  document.querySelectorAll('.companion-bedtime-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hour = parseInt(btn.getAttribute('data-companion-bedtime'), 10);
      if (!isNaN(hour)) {
        store.getState().parentSettings.bedtimeHour = hour;
        Sound.click();
        store.saveState();
        store.notify();
      }
    });
  });

  document.querySelectorAll('.companion-tone-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tone = btn.getAttribute('data-companion-tone');
      if (tone) {
        store.getState().parentSettings.tone = tone;
        Sound.click();
        store.saveState();
        store.notify();
      }
    });
  });

  document.querySelectorAll('.companion-turns-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const turns = parseInt(btn.getAttribute('data-companion-turns'), 10);
      if (!isNaN(turns)) {
        store.getState().parentSettings.maxDailyTurns = turns;
        Sound.click();
        store.saveState();
        store.notify();
      }
    });
  });

  document.querySelectorAll('.companion-focus-tag-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const area = btn.getAttribute('data-focus-area');
      if (!area) return;
      if (!store.getState().parentSettings.focusAreas) {
        store.getState().parentSettings.focusAreas = ['brushing_teeth', 'cleaning_toys'];
      }
      const list = store.getState().parentSettings.focusAreas;
      const idx = list.indexOf(area);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(area);
      }
      Sound.click();
      store.saveState();
      store.notify();
    });
  });

  const saveCompanionRulesBtn = document.getElementById('admin-save-companion-rules-btn');
  if (saveCompanionRulesBtn) {
    saveCompanionRulesBtn.addEventListener('click', async () => {
      const restrictedInput = document.getElementById('admin-restricted-topics-input');
      if (restrictedInput) {
        const topics = restrictedInput.value
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        store.getState().parentSettings.restrictedTopics = topics;
      }

      store.saveState(true);
      firestoreSync.pushStateToCloud(true);

      const activeHero = store.getState().selectedHero;
      const heroId = activeHero?.name || activeHero?.id || 'hero_demo_1';
      await cloudFunctionsService.updateCompanionSettings({
        heroId,
        settings: store.getState().parentSettings
      });

      Sound.fanfare();
      store.showReward('Rules Saved!', 'Rex the Dino has updated his bedtime, tone, and topic restrictions!', 0, 0);
      store.notify();
    });
  }
}
