import { hanaBattle3DService } from '../services/hanaBattle3DService.js';
import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import confetti from 'canvas-confetti';
import { voicePrompts } from '../utils/voicePrompts.js';
import { HYGIENE_BOSSES, DENTAL_BADGES, DENTAL_QUADRANTS, getDentalQuadrant, SUGAR_ATTACK_HAZARDS, getSugarHazardById } from '../data/hygieneBossesData.js';
import { brushAudioAnalyzer } from '../audio/brushAudioAnalyzer.js';
import { brushVisionTracker } from '../services/brushVisionTracker.js';
import { DIGITAL_REWARDS_CATALOG } from '../data/digitalRewardsCatalog.js';
import { getBattleCoachAdvice } from '../services/heroAgentService.js';
import { resolvePublicAssetUrl } from '../utils/assetUrl.js';

const sugarVillainEscapedImg = new URL('../assets/sugar_villain_escaped.jpg', import.meta.url).href;

// Difficulty tiers reuse each kid's existing gameDifficulty
// (easy = Toddler 3-4, medium = Kids 5-6, hard = Kids 7-9): pacing only
// (how often bombs attack / how forgiving the auto-assist is) varies by
// tier. The battle's total countdown length never varies by kid -- it is
// always exactly the duration the parent selected in the Parent Panel.
const BATTLE_DIFFICULTY = {
  easy: { bombIntervalMs: 26000, autoAssistIdleMs: 1200 },
  medium: { bombIntervalMs: 18000, autoAssistIdleMs: 1800 },
  hard: { bombIntervalMs: 13000, autoAssistIdleMs: 2400 }
};
function getDifficultyTier(hero) {
  const tier = hero?.gameDifficulty;
  return ['easy', 'medium', 'hard'].includes(tier) ? tier : 'medium';
}

// Resolves the currently-selected kid's id the same way across every call
// site that needs it (reward crediting, hazard rotation, etc.) instead of
// each one re-deriving it slightly differently.
function getActiveHeroId() {
  const hero = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  return hero?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
}

// =========================================================================
// LIVE-ACTION 3D CARTOON TOOTHBRUSH BATTLE ARENA (100% HANDS-FREE ARCADE)
// =========================================================================

// Battle State Variables
export const ROTATING_VILLAINS = HYGIENE_BOSSES.map(b => b.id);
let hasExplicitBossSelection = false;
let sessionRotatedBossId = null;
let selectedBossId = 'sugar_bandit';
let battleTimer = null;
let bombTimer = null;
let secondsRemaining = 120;
let totalDuration = 120;
let battlePhase = 'brush'; // 'floss' (2-minute preliminary flossing battle) | 'brush' (toothbrush battle)
let lastSpokenQuadId = null;
let isBattleRunning = false;
let isBattlePaused = false;
let isConcludingVictory = false;
let isRhythmBeatActive = true;
let isIntroCountingDown = false;
let currentSugarHazard = null;

export function setExplicitBossSelection(val = true) {
  hasExplicitBossSelection = val;
  if (!val) sessionRotatedBossId = null;
}

// Helper to determine if current battle is a nighttime battle
export function isNighttimeBattle() {
  if (typeof store.isNighttimeToothbrushBattle === 'function') {
    return store.isNighttimeToothbrushBattle();
  }
  const hour = new Date().getHours();
  return hour >= 17 || hour < 5;
}

export function shouldRunFlossBattle() {
  const hero = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  const kidId = hero?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
  if (!kidId) return false;
  return store.shouldShowHygieneReminder(kidId, 'floss');
}

export function shouldShowMouthwashReminder() {
  const hero = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  const kidId = hero?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
  if (!kidId) return false;
  return store.shouldShowHygieneReminder
    ? store.shouldShowHygieneReminder(kidId, 'mouthwash')
    : store.isHygieneReminderActive(kidId, 'mouthwash');
}

// Hardware & Multi-Modal Sensors State (Single Atomic MediaStream)
let videoStream = null;
let isCameraActive = false;
let cameraError = null;
let cameraFacingMode = 'user';
let isCameraMotionDetected = false;
let motionCanvas = null;
let motionCtx = null;
let motionCheckInterval = null;
let sensorInitToken = 0;
let sensorAbortEpoch = 0;
let sensorMode = 'initializing'; // 'initializing' | 'vision' | 'audio' | 'fallback'
let isFallbackManualOverride = false;
let visionSnapshot = brushVisionTracker.getSnapshot();

// Acoustic Mic State
let micCadenceScore = 0;
let cadenceSamples = [];
let isMicActive = false;
let isMicScrubbing = false;

// Deflect Flurry & Shield State
let isDeflectFlurryActive = false;
let deflectFlurryTimer = null;
let introCountdownInterval = null;
let introCountdownFadeTimeout = null;
let mouthwashReminderTimeout = null;
let lastShieldActiveState = false;

// Cooldown-Gated Firing & Auto-Assist Fallback State
let lastScrubTimestamp = 0;
let lastCounterAttackAt = 0;
let volleyCount = 0;
let autoAssistInterval = null;
let isAutoAssistPulseActive = false;
let totalScrubHits = 0;
let currentCombo = 0;
let isPointerScrubbing = false;
let lastPointerScrubAt = 0;
let isFinaleSpeedActive = false;

// Overhaul Combat State (F1, F2, F3, F4, F5, F7)
let mintyShieldCharge = 0;
let mintyShieldActive = false;
let mintyShieldRemainingSec = 0;
let mintyShieldDurationSec = 5;
let mintyShieldActiveSeconds = 0;
let lastShieldScrubRefreshSec = -1;
let brushPhaseStartTimeMs = 0;
let tartarShellAgeSec = 0;
let tartarShellEverRecharged = false;
let shellShatteredBeforeRecharge = false;
let speedScrubMs = null;
let speedScrubMultiplier = 1;
let spritesSpawnedCount = 0;
let spritesClearedNoDamage = false;
let victoryBurstOnPhaseShift = false;
let lastPhaseShiftAtMs = 0;
let recentFoamBlastAtMs = 0;
let pointerDragMoveCount = 0;

// Voice Recognition & Companion TTS Echo Gating State (F3)
let battleSpeechRecognizer = null;
let isCompanionSpeakingNow = false;
let lastCompanionSpeechEndMs = 0;
let lastCompanionSpeechText = '';

function resetOverhaulCombatState() {
  mintyShieldCharge = 0;
  mintyShieldActive = false;
  mintyShieldRemainingSec = 0;
  const bonusSec = typeof store.getMintyShieldUpgradeBonusSec === 'function'
    ? (store.getMintyShieldUpgradeBonusSec(getActiveHeroId()) || 0)
    : 0;
  mintyShieldDurationSec = 5 + bonusSec;
  mintyShieldActiveSeconds = 0;
  lastShieldScrubRefreshSec = -1;
  brushPhaseStartTimeMs = Date.now();
  tartarShellAgeSec = 0;
  tartarShellEverRecharged = false;
  shellShatteredBeforeRecharge = false;
  speedScrubMs = null;
  speedScrubMultiplier = 1;
  spritesSpawnedCount = 0;
  spritesClearedNoDamage = false;
  victoryBurstOnPhaseShift = false;
  lastPhaseShiftAtMs = Date.now();
  recentFoamBlastAtMs = 0;
  pointerDragMoveCount = 0;
}

export function getBattleTelemetryState() {
  const stickyState = hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue;
  const shieldState = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
  return {
    isBattleRunning,
    isBattlePaused,
    battlePhase,
    secondsRemaining,
    totalDuration,
    sensorMode,
    isCameraActive,
    isMicActive,
    isMicScrubbing,
    isFallbackManualOverride,
    cameraError: cameraError ? { name: cameraError.name || 'Error', message: cameraError.message || '' } : null,
    visionSnapshot: { ...visionSnapshot },
    currentCombo,
    volleyCount,
    lastCounterAttackAt,
    totalScrubHits,
    quadrantCleanliness: { ...quadrantCleanliness },
    stickyResidueActive: Boolean(stickyState?.active),
    mintyShieldActive: Boolean(shieldState?.active || mintyShieldActive),
    mintyShieldCharge,
    mintyShieldRemainingSec: shieldState?.remainingSec ?? mintyShieldRemainingSec
  };
}

// Quadrant Cleanliness Progress (0% to 100% per zone)
let quadrantCleanliness = {
  q1: 0,
  q2: 0,
  q3: 0,
  q4: 0,
  q5: 0
};
let lastProgressTimestamp = {
  q1: 0,
  q2: 0,
  q3: 0,
  q4: 0,
  q5: 0
};

// Dynamic Companion Dialogue Text
let currentRexCoachText = 'Get ready! Scrub in gentle circles on your top right teeth!';

// Helper to retrieve boss data
export function getBattleBoss(bossId) {
  const currentSelectedId = bossId || selectedBossId || (store.getSelectedBossId ? store.getSelectedBossId() : 'sugar_bandit');
  const parentBosses = store.getParentCustomBosses ? store.getParentCustomBosses() : [];
  const foundCustom = parentBosses.find(b => b.id === currentSelectedId);
  if (foundCustom) {
    return {
      ...foundCustom,
      title: foundCustom.title || foundCustom.domain || 'Custom AR Villain',
      avatar: foundCustom.emoji || foundCustom.avatar || '👾',
      color: foundCustom.color || '#0284c7',
      accentBorder: foundCustom.accentBorder || 'border-cyan-500',
      gradient: foundCustom.gradient || 'from-cyan-950 via-slate-900 to-indigo-950',
      shieldName: foundCustom.shieldName || 'Biofilm Energy Shell',
      bombName: foundCustom.attackName || (foundCustom.attackType ? foundCustom.attackType.replace('_', ' ') : 'Sugar Slime Bomb'),
      trophyRelicId: foundCustom.trophyRelicId || 'trophy_sugar_bandit',
      rewardCoins: foundCustom.rewardCoins || 60,
      rewardXP: foundCustom.rewardXP || 120,
      rewardSparks: 20,
      cleansedTitle: `Friendly Cleansed ${foundCustom.name} 🌟`,
      battleDurationSec: foundCustom.battleDurationSec || 120,
      attackType: foundCustom.attackType || 'caramel_bomb'
    };
  }
  if (currentSelectedId === 'sugar_boss') {
    const bandit = HYGIENE_BOSSES.find(b => b.id === 'sugar_bandit') || HYGIENE_BOSSES[0];
    return {
      ...bandit,
      id: 'sugar_boss',
      meshType: 'sugar_bandit',
      title: 'Sugar Fortress Night Showdown',
      name: 'The Sugar Bandit King'
    };
  }
  const preset = HYGIENE_BOSSES.find(b => b.id === currentSelectedId);
  return preset || HYGIENE_BOSSES[0];
}

// Resolve the current hero's equipped weapon and battle buff
export function getActiveCombatWeapon() {
  let weapon = null;
  if (typeof store.getEquippedHeroWeaponObject === 'function') {
    weapon = store.getEquippedHeroWeaponObject();
  } else if (typeof store.getEquippedHeroWeapon === 'function') {
    const raw = store.getEquippedHeroWeapon(true);
    if (typeof raw === 'object' && raw !== null) {
      weapon = raw;
    } else if (typeof raw === 'string') {
      weapon = (store.getState().digitalGear || []).find(g => g.id === raw) ||
               DIGITAL_REWARDS_CATALOG.find(g => g.id === raw) ||
               { id: raw, title: raw === 'laser_toothbrush' ? 'Laser Toothbrush Saber' : raw, icon: '⚔️' };
    }
  }

  const hero = store.getState().selectedHero;
  if (!weapon && hero) {
    const weaponId = hero.equippedWeapon ||
      (Array.isArray(hero.equippedGear) && hero.equippedGear.find(g =>
        g === 'laser_toothbrush' ||
        (store.getState().digitalGear || []).some(dg => dg.id === g) ||
        DIGITAL_REWARDS_CATALOG.some(c => c.id === g)
      )) ||
      (Array.isArray(hero.equippedGear) && hero.equippedGear[0]);
    if (weaponId) {
      weapon = (store.getState().digitalGear || []).find(g => g.id === weaponId) ||
               DIGITAL_REWARDS_CATALOG.find(g => g.id === weaponId) ||
               { id: weaponId, title: weaponId === 'laser_toothbrush' ? 'Laser Toothbrush Saber' : weaponId, icon: '⚔️' };
    }
  }

  if (weapon) {
    let multiplier = 1.3;
    if (weapon.id === 'laser_toothbrush' || weapon.title?.toLowerCase().includes('laser toothbrush')) {
      multiplier = 1.3;
    } else if (weapon.statBonusPercent !== undefined) {
      multiplier = 1.0 + (weapon.statBonusPercent / 100);
    } else if (typeof weapon.statBonus === 'string') {
      const match = weapon.statBonus.match(/\+(\d+)%/);
      if (match) multiplier = 1.0 + (parseInt(match[1]) / 100);
    }
    const icon = weapon.icon || (weapon.category === 'Weapons' || weapon.id?.includes('saber') || weapon.id?.includes('toothbrush') ? '⚔️' : '⚡');
    const title = weapon.title || weapon.name || 'Laser Toothbrush Saber';
    return { weapon: { ...weapon, title, icon }, multiplier, hasWeapon: true };
  }

  const inEquipped = Array.isArray(hero?.equippedGear) && hero.equippedGear.includes('laser_toothbrush');
  const inHeroInv = Array.isArray(hero?.inventory) && hero.inventory.includes('laser_toothbrush');
  if (inEquipped || inHeroInv) {
    return { weapon: { id: 'laser_toothbrush', title: 'Laser Toothbrush Saber', icon: '⚔️' }, multiplier: 1.3, hasWeapon: true };
  }
  return { weapon: null, multiplier: 1.0, hasWeapon: false };
}

// Check if current hero owns/equipped the Laser Toothbrush or combat weapon
function checkLaserToothbrushEquipped() {
  return getActiveCombatWeapon().hasWeapon;
}

// =========================================================================
// MAIN BATTLE VIEW RENDER FUNCTION: FULL-SCREEN VIBRANT 3D ARCADE VIEWPORT
// =========================================================================
export function renderBattleView() {
  const isExplicit = hasExplicitBossSelection || store.state?.hasExplicitBossSelection || store.state?.selectedBossId === 'sugar_boss';
  if (!isExplicit && !isBattleRunning && !store.getBossColosseumState()?.isVictoryModalOpen && !store.getBossColosseumState()?.isDefeatModalOpen) {
    if (!sessionRotatedBossId) {
      if (typeof store.drawNextHygieneBossId === 'function') {
        sessionRotatedBossId = store.drawNextHygieneBossId(getActiveHeroId());
      } else {
        const randomIndex = Math.floor(Math.random() * ROTATING_VILLAINS.length);
        sessionRotatedBossId = ROTATING_VILLAINS[randomIndex];
      }
    }
    selectedBossId = sessionRotatedBossId;
    if (store.state) store.state.selectedBossId = selectedBossId;
  } else {
    selectedBossId = store.getSelectedBossId ? store.getSelectedBossId() : (store.state?.selectedBossId || selectedBossId);
  }
  const currentBoss = getBattleBoss(selectedBossId);
  const colState = store.getBossColosseumState ? store.getBossColosseumState() : {};

  // If a battle is not currently actively running and no end-of-battle modal is open, initialize phase & durations based on floss status
  if (!isBattleRunning && !colState.isVictoryModalOpen && !colState.isDefeatModalOpen) {
    if (shouldRunFlossBattle()) {
      battlePhase = 'floss';
      secondsRemaining = 120;
      totalDuration = 120;
    } else {
      battlePhase = 'brush';
      const bossDuration = store.getState().parentSettings?.arBattleDuration || currentBoss.battleDurationSec || 120;
      secondsRemaining = bossDuration;
      totalDuration = bossDuration;
    }
  }

  if (!currentSugarHazard) {
    currentSugarHazard = getSugarHazardById(store.drawNextSugarHazardId(getActiveHeroId()));
  }

  const activeCombatWeapon = getActiveCombatWeapon();
  const hasLaserSword = activeCombatWeapon.hasWeapon;
  const activePet = store.getActivePet ? store.getActivePet() : { name: 'Rex', avatar: '🦖' };

  const elapsed = totalDuration - secondsRemaining;
  const progressRatio = Math.min(1, elapsed / totalDuration);
  const hpPercent = secondsRemaining <= 0
    ? 0
    : Math.max(1, Math.min(100, Math.round(((colState.currentHp || (1 - progressRatio) * 100) / (colState.maxHp || 100)) * 100)));

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
  const showPip = colState.showPipCam !== false;

  // Parent Panel's per-kid, per-day Floss/Mouthwash toggles (ParentPortalView's
  // "hygiene-reminder-toggle-btn" buttons) -- shown as a persistent badge for
  // the whole battle, not just the pre/post blocking reminder screens, so the
  // kid sees what's expected of them the entire time the timer is running.
  const hygieneKid = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  const hygieneKidId = hygieneKid?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
  const showFlossBadge = hygieneKidId ? store.isHygieneReminderActive(hygieneKidId, 'floss') : false;
  const showMouthwashBadge = hygieneKidId ? store.isHygieneReminderActive(hygieneKidId, 'mouthwash') : false;

  // List of primary hygiene bosses for bottom villain dock
  const availableVillains = HYGIENE_BOSSES.map(b => ({
    id: b.id,
    name: b.name.replace(/^The\s+/i, ''),
    emoji: b.emoji || b.avatar || '🍬',
    color: b.color || '#f59e0b'
  }));
  const parentBosses = store.getParentCustomBosses ? store.getParentCustomBosses() : [];
  parentBosses.forEach(pb => {
    if (!availableVillains.some(v => v.id === pb.id)) {
      availableVillains.push({
        id: pb.id,
        name: pb.name,
        emoji: pb.emoji || pb.avatar || '👾',
        color: pb.color || '#0284c7'
      });
    }
  });

  return `
    <div class="relative w-full h-[calc(100vh-64px)] min-h-[540px] overflow-hidden bg-linear-to-b from-[#0f172a] via-[#1e1b4b] to-[#081a2e] text-white font-headline select-none">
      
      <!-- ================= 1. FULL VIEWPORT 3D WEBGL ARENA CANVAS ================= -->
      <canvas id="battle-webgl-canvas" class="absolute inset-0 w-full h-full z-0 block cursor-crosshair"></canvas>

      <!-- ================= 2A. PROMINENT CENTERED FLOATING COUNTDOWN TIMER ================= -->
      <div class="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-35 pointer-events-auto">
        <div id="battle-timer-capsule" class="bg-slate-900/95 backdrop-blur-md px-3.5 sm:px-5 py-1 sm:py-1.5 rounded-full border-2 sm:border-3 ${battlePhase === 'floss' ? 'border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.65)]' : 'border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.65)]'} flex items-center gap-1.5 sm:gap-2">
          <span class="material-symbols-outlined ${battlePhase === 'floss' ? 'text-emerald-400' : 'text-amber-400'} text-lg sm:text-2xl animate-pulse">timer</span>
          <span id="battle-timer-display" class="font-headline text-xl sm:text-3xl font-black ${battlePhase === 'floss' ? 'text-emerald-300 drop-shadow-[0_0_12px_rgba(16,185,129,0.9)]' : 'text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]'} tracking-wider">
            ${timeStr}
          </span>
        </div>
      </div>

      <!-- ================= 2B. TOP FLANKING HUD BAR (MAP QUIT, BOSS HP & CONTROLS) ================= -->
      <div class="absolute top-2 sm:top-3 left-2 right-2 sm:left-4 sm:right-4 z-30 flex items-center justify-between gap-2 pointer-events-none">
        
        <!-- Left: Kid-friendly Map Exit Button & Boss Health Status -->
        <div class="pointer-events-auto flex items-center gap-1.5 sm:gap-2 min-w-0 max-w-[44%] sm:max-w-[40%]">
          <button id="battle-quit-btn" class="bg-linear-to-b from-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl border-2 sm:border-3 border-amber-200 shadow-[0_3px_0_0_#b45309] flex items-center gap-1 active:translate-y-0.5 active:shadow-none transition-all shrink-0 cursor-pointer" title="Return to Map">
            <span class="material-symbols-outlined text-base sm:text-lg font-black">arrow_back</span>
            <span class="hidden xs:inline">Map</span>
          </button>

          <!-- Boss Avatar & Health Heart Bar (or Floss Progress) -->
          <div class="bg-slate-900/90 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 rounded-2xl border-2 border-slate-700/80 flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 shadow-sm">
            ${battlePhase === 'floss' ? `
              <span class="text-xl sm:text-2xl filter drop-shadow-sm shrink-0">🧵</span>
              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-[9px] sm:text-[10px] font-black text-emerald-300 uppercase truncate">FLOSS BATTLE</span>
                <div class="w-full bg-slate-950 h-2 sm:h-2.5 rounded-full overflow-hidden border border-emerald-400/40 p-0.5 mt-0.5">
                  <div id="floss-progress-bar" class="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.8)]" style="width: ${Math.round(((120 - secondsRemaining) / 120) * 100)}%;"></div>
                </div>
              </div>
            ` : `
              <span class="text-xl sm:text-2xl filter drop-shadow-sm shrink-0">
                ${currentBoss.emoji || currentBoss.avatar || '🍬'}
              </span>
              <div class="flex flex-col min-w-0 flex-1">
                <div class="flex items-center justify-between text-[9px] sm:text-[10px] font-black text-amber-300 uppercase truncate">
                  <span id="battle-boss-name-hud" class="truncate">${escapeHtml(currentBoss.name)}</span>
                  <span class="text-[8px] sm:text-[9px] text-rose-300 font-bold ml-1">${hpPercent}%</span>
                </div>
                <div class="w-full bg-slate-950 h-2 sm:h-2.5 rounded-full overflow-hidden border border-white/20 p-0.5 mt-0.5 shadow-inner">
                  <div id="boss-hp-bar" class="h-full bg-linear-to-r from-rose-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.8)]" style="width: ${hpPercent}%;"></div>
                </div>
              </div>
            `}
          </div>
        </div>

        <!-- Right: Active Hazard Badge & Controls -->
        <div class="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
          ${currentSugarHazard ? `
            <span id="sugar-hazard-badge" class="hidden md:flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-amber-200 bg-amber-950/85 border border-amber-400/60 px-2 sm:px-2.5 py-1 rounded-full shadow-sm backdrop-blur-xs animate-pulse shrink-0">
              <span>${currentSugarHazard.emoji}</span>
              <span class="hidden lg:inline">Hazard:</span>
              <span>${currentSugarHazard.name}</span>
            </span>
          ` : ''}
          <button id="rhythm-toggle-btn" class="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-slate-900/90 border-2 border-slate-700 text-cyan-300 flex items-center justify-center hover:bg-slate-800 active:scale-95 shadow-sm cursor-pointer" title="Toggle Rhythm">
            <span class="material-symbols-outlined text-base sm:text-lg">${isRhythmBeatActive ? 'music_note' : 'music_off'}</span>
          </button>
          <button id="camera-flip-btn" class="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-slate-900/90 border-2 border-slate-700 text-amber-300 flex items-center justify-center hover:bg-slate-800 active:scale-95 shadow-sm cursor-pointer" title="Flip Camera">
            <span class="material-symbols-outlined text-base sm:text-lg">cameraswitch</span>
          </button>
        </div>

      </div>

      <!-- ================= 3. FLOATING MAGIC MIRROR PORTAL & AI VISION STATUS (TOP-LEFT) ================= -->
      <div id="pip-window" class="absolute top-16 sm:top-20 left-3 sm:left-6 z-20 flex flex-col items-start gap-1.5 pointer-events-none transition-all duration-300 ${showPip ? '' : 'opacity-0 w-px h-px overflow-hidden'}">
        <div class="w-24 h-28 sm:w-28 sm:h-32 bg-slate-950/90 border-3 border-amber-400 rounded-3xl p-1 shadow-[0_0_20px_rgba(251,191,36,0.5)] relative flex flex-col overflow-hidden">
          <div class="absolute top-1.5 left-2 flex items-center gap-1 z-10">
            <span id="vision-live-dot" class="w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400 animate-pulse'}"></span>
            <span class="text-[8px] sm:text-[9px] font-black text-amber-300 tracking-tighter uppercase">${isCameraActive ? 'MAGIC MIRROR ⭐' : 'HERO SHIELD ✨'}</span>
          </div>
          <div class="w-full h-full bg-slate-900 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
            <video id="ar-camera-feed" class="w-full h-full object-cover transform -scale-x-100 ${isCameraActive ? '' : 'hidden'}" autoplay playsinline muted></video>
            <div id="pip-placeholder" class="absolute inset-0 flex flex-col items-center justify-center p-1.5 text-center ${isCameraActive ? 'hidden' : ''}">
              <span class="text-2xl sm:text-3xl">🛡️</span>
              <span id="pip-fallback-label" class="text-[8px] font-black text-cyan-300 mt-1 leading-tight">HERO SHIELD AUTO-MODE ✨ (Tap or Scrub!)</span>
            </div>
          </div>
        </div>

        <div class="pointer-events-auto flex flex-col items-start gap-1 max-w-[165px]">
          <div id="vision-status-badge" class="bg-slate-900/90 border border-cyan-400/60 px-2 py-0.5 rounded-full text-[9px] font-black text-cyan-300 shadow-sm backdrop-blur-xs truncate max-w-full">
            ${isCameraActive ? 'AI VISION: READY 🪥' : ((isMicActive || sensorMode === 'audio') ? 'AUDIO SENSE: READY 🎙️' : 'HERO SHIELD AUTO-MODE ✨ (Tap or Scrub!)')}
          </div>
          <button id="vision-fallback-toggle-btn" class="bg-slate-900/90 hover:bg-slate-800 border border-slate-600 text-amber-300 text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm active:scale-95 transition-all cursor-pointer">
            ${isFallbackManualOverride || (!isCameraActive && sensorMode !== 'initializing') ? '📷 Enable Camera' : '🛡️ Non-Camera Mode'}
          </button>
        </div>
      </div>

      <!-- ================= 4. ACTIVE ZONE PROMPT / FLOSS BATTLE BANNER ================= -->
      ${battlePhase === 'floss' ? `
        <div id="floss-banner-container" class="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          <div id="floss-active-banner" class="bg-slate-900/95 border-2 border-emerald-400 px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center gap-2 animate-pulse">
            <span class="text-base">🧵</span>
            <span class="text-xs font-black text-emerald-300 uppercase tracking-wide">FLOSS BATTLE:</span>
            <span id="current-zone-status-text" class="text-xs font-black text-white">Clean between your teeth!</span>
          </div>
          <button id="battle-done-floss-btn" class="pointer-events-auto bg-linear-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:brightness-110 text-slate-950 font-headline font-black text-xs px-4 py-1.5 rounded-full shadow-lg border-2 border-white/40 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer">
            <span class="material-symbols-outlined text-sm font-black">check_circle</span> Done Flossing! 🪥
          </button>
        </div>
      ` : `
        <div id="active-zone-banner" class="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-20 bg-slate-900/95 border-2 border-cyan-400 px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-2 pointer-events-none transition-transform duration-300 animate-pulse">
          <span class="text-base">🪥</span>
          <span class="text-xs font-black text-cyan-300 uppercase tracking-wide">BRUSHING ZONE:</span>
          <span id="current-zone-status-text" class="text-xs font-black text-white">${activeQuad.name}</span>
          <span id="current-zone-badge" class="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/40">${activeQuad.zone}/5</span>
        </div>

        <!-- Boss Sugar Shield Banner (Shown during 75% & 25% shield milestones) -->
        <div id="boss-shield-banner" class="absolute top-26 sm:top-30 left-1/2 transform -translate-x-1/2 z-25 bg-amber-950/95 border-2 border-amber-400 px-3.5 py-1 rounded-full shadow-[0_0_18px_rgba(241,196,15,0.65)] flex items-center gap-1.5 pointer-events-none transition-all duration-300 ${colState.isShieldActive ? 'opacity-100 scale-100' : 'opacity-0 scale-90 hidden'}">
          <span class="text-sm">🛡️</span>
          <span class="text-[10px] sm:text-xs font-black text-amber-300 uppercase tracking-wide">SUGAR SHIELD! SCRUB TO CRACK IT!</span>
        </div>

        <!-- Parent-Set Floss / Mouthwash Reminder Badges -->
        ${(showFlossBadge || showMouthwashBadge) ? `
          <div id="hygiene-reminder-hud-badges" class="absolute top-34 sm:top-38 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-1.5 pointer-events-none">
            ${showFlossBadge ? `
              <span id="floss-reminder-hud-badge" class="flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-emerald-300 bg-emerald-950/80 border border-emerald-400/60 px-2 py-0.5 rounded-full shadow-sm backdrop-blur-xs">
                <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">health_and_safety</span>
                Floss Time! 🦷
              </span>
            ` : ''}
            ${showMouthwashBadge ? `
              <span id="mouthwash-reminder-hud-badge" class="flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-secondary bg-secondary/15 border border-secondary/50 px-2 py-0.5 rounded-full shadow-sm backdrop-blur-xs">
                <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">water_drop</span>
                Rinse with Mouthwash after!
              </span>
            ` : ''}
          </div>
        ` : ''}
      `}

      <!-- ================= 5. FOAM POWER / SUPERNOVA BAR & FALLBACK SCRUB TRIGGER ================= -->
      ${battlePhase === 'brush' ? `
        <div id="supernova-hud" class="absolute bottom-15 sm:bottom-17 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 pointer-events-auto">
          <div class="bg-slate-900/90 backdrop-blur-md border-2 border-cyan-400/60 rounded-full px-3 py-1 flex items-center gap-2 shadow-lg">
            <span class="text-[9px] font-black text-cyan-300 uppercase tracking-wider">MINTY FRESH BLAST</span>
            <div class="w-16 sm:w-24 h-2 bg-slate-950 rounded-full overflow-hidden border border-cyan-500/40">
              <div id="supernova-charge-bar" class="h-full bg-linear-to-r from-cyan-400 via-emerald-400 to-amber-300 rounded-full transition-all duration-300" style="width: ${Math.min(100, Math.round(colState.choreSupernovaCharge || 0))}%;"></div>
            </div>
            <button id="supernova-blast-btn" class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase transition-all cursor-pointer ${(colState.choreSupernovaCharge || 0) >= 40 ? 'bg-linear-to-r from-amber-400 to-emerald-400 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-slate-800 text-slate-400 cursor-not-allowed'}" ${(colState.choreSupernovaCharge || 0) >= 40 ? '' : 'disabled'}>
              MINTY FRESH BLAST! 🌟
            </button>
          </div>
          <button id="minty-shield-btn" data-active="${mintyShieldActive ? 'true' : 'false'}" class="px-3 py-1 rounded-full text-[10px] font-black uppercase border-2 transition-all ${mintyShieldActive ? 'bg-linear-to-r from-cyan-300 to-sky-400 text-slate-950 border-white shadow-[0_0_14px_rgba(56,189,248,0.85)]' : (mintyShieldCharge >= 40 ? 'bg-linear-to-r from-sky-400 to-cyan-400 text-slate-950 border-cyan-200 shadow-lg animate-pulse cursor-pointer' : 'bg-slate-900/90 text-slate-400 border-slate-700 cursor-not-allowed')}" ${(mintyShieldCharge >= 40 || mintyShieldActive) ? '' : 'disabled'}>
            ${mintyShieldActive ? `MINTY SHIELD ACTIVE (${Math.ceil(mintyShieldRemainingSec)}s) ❄️` : `MINTY SHIELD (${mintyShieldDurationSec}s) ❄️`}
          </button>
          <button id="fallback-scrub-btn" class="${isCameraActive ? 'hidden' : 'flex'} items-center gap-1 bg-linear-to-r from-cyan-400 to-emerald-400 text-slate-950 font-black text-[10px] sm:text-xs px-3 py-1.5 rounded-full border-2 border-white/60 shadow-lg active:scale-95 transition-all cursor-pointer">
            <span>🪥</span>
            <span>SCRUB!</span>
          </button>
        </div>
      ` : ''}

      <!-- ================= 6. DEFLECT FLURRY & SPOKEN /LEARN NOTIFICATION BANNERS ================= -->
      <div id="deflect-flurry-banner" class="absolute top-36 sm:top-40 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none transition-all duration-300 opacity-0 scale-90">
        <div class="bg-linear-to-r from-amber-500 via-rose-500 to-amber-500 text-slate-950 font-headline font-black text-xs sm:text-sm px-6 py-2.5 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.95)] border-3 border-white animate-bounce flex items-center gap-2.5">
          <span id="deflect-hazard-emoji" class="text-xl">${currentSugarHazard?.emoji || '🍬'}</span>
          <span id="deflect-hazard-text">${currentSugarHazard ? `${currentSugarHazard.name.toUpperCase()} INCOMING! DEFLECT!` : 'SUGAR HAZARD! SCRUB TO DEFLECT!'}</span>
          <span class="text-xl">🛡️</span>
        </div>
      </div>


      <!-- Comic Deflect Hit Popup -->
      <div id="comic-hit-badge" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 transition-all duration-300 z-35 text-center">
        <span class="bg-linear-to-r from-emerald-400 via-cyan-400 to-emerald-400 text-slate-950 font-headline text-base sm:text-lg font-black px-6 py-2.5 rounded-full shadow-2xl border-3 border-white scale-125">
          DEFLECTED! 🛡️✨
        </span>
      </div>



      <!-- ================= 8. IN-GAME 3D VILLAIN SWITCHER DOCK (BOTTOM-CENTER) ================= -->
      <div class="absolute bottom-3 sm:bottom-4 left-1/2 transform -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-3xl border-2 border-white/20 shadow-2xl">
        <span class="text-[9px] font-black text-slate-400 uppercase tracking-tight hidden sm:inline mr-1">Villain:</span>
        ${availableVillains.map(v => {
          const isSelected = v.id === selectedBossId;
          return `
            <button data-villain-id="${v.id}" class="villain-switch-btn flex items-center gap-1 px-2.5 py-1 rounded-2xl text-xs font-black transition-all ${isSelected ? 'bg-linear-to-r from-amber-400 to-amber-500 text-slate-950 shadow-[0_2px_0_0_#b45309] scale-105' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">
              <span>${v.emoji}</span>
              <span class="hidden xs:inline text-[10px]">${v.name}</span>
            </button>
          `;
        }).join('')}
      </div>

      <!-- ================= 9. COUNTDOWN INTRO OVERLAY ("3... 2... 1... BRUSH!") ================= -->
      <div id="battle-intro-countdown" class="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs pointer-events-none transition-opacity duration-500 opacity-0 hidden">
        <div id="intro-countdown-text" class="text-7xl sm:text-9xl font-black text-amber-300 drop-shadow-[0_0_40px_rgba(251,191,36,0.95)] animate-bounce">
          3
        </div>
      </div>

      <!-- ================= 10. CELEBRATORY VICTORY MODAL ================= -->
      ${renderVictoryModal(colState, currentBoss)}

      <!-- ================= 11. REWARD-FREE DEFEAT MODAL (QUIT BEFORE TIMER ENDS) ================= -->
      ${renderDefeatModal(colState)}

    </div>
  `;
}

function renderVictoryModal(colState, currentBoss) {
  if (!colState.isVictoryModalOpen) return '';

  const reward = colState.victoryReward || {
    bossName: currentBoss.name,
    cleansedTitle: currentBoss.cleansedTitle || 'Minty Friend 🍬',
    trophyId: currentBoss.trophyRelicId || 'trophy_sugar_bandit',
    coins: currentBoss.rewardCoins || 50,
    xp: currentBoss.rewardXP || 75,
    sparks: currentBoss.rewardSparks || 15
  };

  const trophyTitle = reward.trophyId === 'trophy_sugar_bandit'
    ? "Sugar Bandit's Golden Candy Crown"
    : reward.trophyId === 'trophy_plaque_kraken'
      ? "Plaque Kraken's Pearly Goblet"
      : "Shiny Hero Trophy";
  const hygieneKid = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  const hygieneKidId = hygieneKid?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
  const showMouthwashInModal = hygieneKidId && store.isHygieneReminderActive(hygieneKidId, 'mouthwash');
  const isMouthwashAcknowledged = hygieneKidId ? store.hasAcknowledgedHygieneReminderToday(hygieneKidId, 'mouthwash') : false;
  const unlockedBadgeIds = Array.isArray(reward.badgesUnlocked) && reward.badgesUnlocked.length > 0
    ? reward.badgesUnlocked
    : (Array.isArray(hygieneKid?.dentalBadges) ? hygieneKid.dentalBadges : (store.state?.dentalBadges || []));
  const unlockedBadgeObjects = DENTAL_BADGES.filter(b => unlockedBadgeIds.includes(b.id));
  const resolvedCleansedImage = currentBoss.cleansedImage ? resolvePublicAssetUrl(currentBoss.cleansedImage) : '';

  return `
    <div id="colosseum-victory-modal" class="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div class="w-full max-w-sm bg-[#0b1320] border-4 border-emerald-400 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col items-center text-center relative overflow-hidden">
        
        <!-- Transformed Cleansed Boss Hero Avatar with Animated Rainbow Aura -->
        <div class="relative mb-3 flex items-center justify-center">
          <div class="absolute -inset-3 rounded-full bg-linear-to-r from-pink-500 via-amber-400 via-emerald-400 via-cyan-400 to-purple-500 blur-md opacity-85 animate-pulse"></div>
          <div class="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-emerald-400 bg-slate-900/90 overflow-hidden shadow-[0_0_35px_rgba(52,211,153,0.8)] flex items-center justify-center">
            ${resolvedCleansedImage
              ? `<img src="${resolvedCleansedImage}" alt="${escapeHtml(reward.cleansedTitle)}" class="w-full h-full object-cover" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'text-5xl\\'>${currentBoss.cleansedAvatar || currentBoss.avatar || '✨'}</span>';" />`
              : `<span class="text-5xl animate-bounce">${currentBoss.cleansedAvatar || currentBoss.avatar || '✨'}</span>`
            }
          </div>
          <div class="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 rounded-full p-1 border-2 border-white text-xs font-black shadow-sm flex items-center justify-center">
            ✨
          </div>
        </div>

        <h2 class="font-headline font-black text-xl sm:text-2xl text-emerald-400 tracking-tight uppercase">
          VILLAIN CLEANSED! 🎉
        </h2>
        <p class="font-headline font-bold text-xs text-slate-300 mt-1">
          ${escapeHtml(reward.bossName)} transformed into ${escapeHtml(reward.cleansedTitle)}!
        </p>

        <div class="w-full bg-slate-950/90 rounded-2xl p-3 border-2 border-amber-400/50 flex flex-col items-center gap-1 my-3 shadow-inner">
          <span class="text-[9px] font-black uppercase text-amber-400 tracking-wider">🌟 UNLOCKED 3D HQ TROPHY RELIC</span>
          <span class="font-headline font-black text-xs sm:text-sm text-white">${trophyTitle}</span>
          <span class="text-[10px] text-slate-400">Permanently spotlighted in your Hero HQ hideout!</span>
        </div>

        ${unlockedBadgeObjects.length > 0 ? `
          <div class="w-full bg-slate-950/90 rounded-2xl p-2.5 border border-cyan-400/40 flex flex-wrap items-center justify-center gap-1.5 mb-3">
            ${unlockedBadgeObjects.map(b => `
              <span class="px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-400/50 text-[10px] font-black text-cyan-300 flex items-center gap-1">
                <span>${b.icon || '🏅'}</span>
                <span>${escapeHtml(b.title || b.name)}</span>
              </span>
            `).join('')}
          </div>
        ` : ''}

        <div class="w-full bg-slate-950/90 rounded-2xl p-2.5 border-2 border-slate-800 flex items-center justify-around mb-3 shadow-inner">
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-400 font-bold">COINS 🪙</span>
            <span class="font-headline font-black text-base text-amber-400">+${reward.coins}</span>
          </div>
          <div class="h-6 w-0.5 bg-slate-800"></div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-400 font-bold">XP ⭐</span>
            <span class="font-headline font-black text-base text-cyan-400">+${reward.xp}</span>
          </div>
          <div class="h-6 w-0.5 bg-slate-800"></div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-400 font-bold">SPARKS ⚡</span>
            <span class="font-headline font-black text-base text-emerald-400">+${reward.sparks}</span>
          </div>
        </div>

        ${showMouthwashInModal ? `
          <div id="mouthwash-victory-card" class="w-full bg-secondary/15 rounded-2xl p-3 border-2 border-secondary/50 flex flex-col items-center gap-1.5 mb-3 shadow-[0_0_20px_rgba(6,182,212,0.25)] animate-pulse">
            <div class="flex items-center gap-1.5 text-secondary font-headline font-black text-xs uppercase tracking-wider">
              <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">water_drop</span>
              DON'T FORGET TO WASHWASH LITTLE HERO! 💧🦖
            </div>
            <p class="text-[11px] font-bold text-slate-200">
              Swish your mouthwash for a fresh, sparkling clean smile!
            </p>
            <button id="mouthwash-modal-ack-btn" class="mt-1 px-4 py-1.5 rounded-xl ${isMouthwashAcknowledged ? 'bg-emerald-600 text-white cursor-default' : 'bg-secondary text-on-secondary cursor-pointer hover:brightness-110 active:scale-95'} font-headline font-black text-xs transition-all flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">check_circle</span> ${isMouthwashAcknowledged ? 'Rinsed ✓' : 'I Rinsed! 💧✨'}
            </button>
          </div>
        ` : ''}

        <div class="w-full flex flex-col gap-2">
          <button id="colosseum-visit-hq-btn" class="w-full py-3 min-h-[48px] rounded-2xl bg-emerald-500 text-slate-950 font-headline font-black text-sm uppercase tracking-wider shadow-[0_6px_0_0_#047857] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <span class="material-symbols-outlined text-lg font-bold">apartment</span> VIEW TROPHY IN HERO HQ
          </button>

          ${store.state?.previousView === 'bedtime_story' ? `
            <button id="colosseum-return-bedtime-btn" class="w-full py-3 min-h-[44px] rounded-2xl bg-linear-to-r from-[#00d2d3] to-[#0284c7] text-surface-container-lowest font-headline font-black text-xs uppercase tracking-wider shadow-[0_4px_0_0_#05253b] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-base">auto_stories</span> CONTINUE BEDTIME ROUTINE (STEP 2)
            </button>
          ` : store.state?.previousView === 'quest_map' ? `
            <button id="colosseum-return-map-btn" class="w-full py-2.5 min-h-[44px] rounded-2xl bg-slate-800 text-amber-400 border border-amber-400/40 font-headline font-bold text-xs uppercase hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer">
              <span class="material-symbols-outlined text-base">explore</span> RETURN TO WORLD MAP (QUEST 7)
            </button>
          ` : ''}
          
          <button id="colosseum-play-again-btn" class="w-full py-2.5 min-h-[44px] rounded-2xl bg-slate-800 text-cyan-400 border-2 border-slate-700 font-headline font-bold text-xs uppercase hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer">
            <span class="material-symbols-outlined text-base">replay</span> BATTLE AGAIN
          </button>
        </div>

      </div>
    </div>
  `;
}

// Reward-free modal shown when a kid quits/backs out of a battle before the
// timer finishes. Deliberately has no coins/xp/sparks/trophy row and never
// touches the task/approval system -- finishing the full brush routine is
// what earns those, matching the existing incentive messaging. Mirrors
// renderVictoryModal()'s card shell so the two feel like one cohesive flow.
function renderDefeatModal(colState) {
  if (!colState.isDefeatModalOpen) return '';

  const info = colState.defeatInfo || { bossName: 'The Hygiene Boss', bossAvatar: '🍬' };

  return `
    <div id="colosseum-defeat-modal" class="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div class="w-full max-w-sm bg-[#1a1207] border-4 border-amber-500 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col items-center text-center relative overflow-hidden">

        <div class="relative mb-3 flex items-center justify-center">
          <div class="absolute -inset-3 rounded-full bg-amber-500/30 blur-md"></div>
          <div class="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-amber-500 bg-slate-900/90 overflow-hidden shadow-[0_0_35px_rgba(245,158,11,0.5)] flex items-center justify-center">
            <img src="${sugarVillainEscapedImg}" alt="${info.bossName} escaped" class="w-full h-full object-cover" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'text-5xl\\'>${info.bossAvatar}</span>';" />
          </div>
        </div>

        <h2 class="font-headline font-black text-xl sm:text-2xl text-amber-400 tracking-tight uppercase">
          ${info.bossName} Escaped!
        </h2>
        <p class="font-headline font-bold text-xs text-slate-300 mt-1 mb-4">
          Brush for the full routine next time to cleanse the villain, earn your sparks, and unlock your 3D HQ trophy!
        </p>

        <div class="w-full flex flex-col gap-2">
          <button id="colosseum-defeat-return-btn" class="w-full py-3 min-h-[48px] rounded-2xl bg-amber-500 text-slate-950 font-headline font-black text-sm uppercase tracking-wider shadow-[0_6px_0_0_#b45309] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-lg font-bold">apartment</span> RETURN TO HERO HQ
          </button>

          <button id="colosseum-defeat-retry-btn" class="w-full py-2.5 min-h-[44px] rounded-2xl bg-slate-800 text-cyan-400 border-2 border-slate-700 font-headline font-bold text-xs uppercase hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-1">
            <span class="material-symbols-outlined text-base">replay</span> BATTLE AGAIN
          </button>
        </div>

      </div>
    </div>
  `;
}

// =========================================================================
// HARDWARE SENSORS (CAMERA + MIC FUSION + RESILIENT NON-CAMERA FALLBACK)
// =========================================================================
function updateVisionHudState() {
  if (typeof document === 'undefined') return;
  const video = document.getElementById('ar-camera-feed');
  const pipPlaceholder = document.getElementById('pip-placeholder');
  const statusBadge = document.getElementById('vision-status-badge');
  const toggleBtn = document.getElementById('vision-fallback-toggle-btn');
  const liveDot = document.getElementById('vision-live-dot');
  const fallbackScrubBtn = document.getElementById('fallback-scrub-btn');

  if (video) {
    if (isCameraActive) video.classList.remove('hidden');
    else video.classList.add('hidden');
  }
  if (pipPlaceholder) {
    if (isCameraActive) pipPlaceholder.classList.add('hidden');
    else pipPlaceholder.classList.remove('hidden');
  }
  if (fallbackScrubBtn) {
    if (isCameraActive) {
      fallbackScrubBtn.classList.add('hidden');
      fallbackScrubBtn.classList.remove('flex');
    } else {
      fallbackScrubBtn.classList.remove('hidden');
      fallbackScrubBtn.classList.add('flex');
    }
  }
  if (liveDot) {
    liveDot.className = isCameraActive
      ? (visionSnapshot.isBrushing ? 'w-2 h-2 rounded-full bg-emerald-400 animate-ping' : 'w-2 h-2 rounded-full bg-amber-400 animate-pulse')
      : 'w-2 h-2 rounded-full bg-cyan-400 animate-pulse';
  }
  if (statusBadge) {
    if (isCameraActive) {
      if (visionSnapshot.isBrushing) {
        statusBadge.textContent = `AI VISION: BRUSHING ${visionSnapshot.movementSpeed}% ⚡`;
        statusBadge.className = 'bg-slate-900/90 border border-emerald-400/80 px-2 py-0.5 rounded-full text-[9px] font-black text-emerald-300 shadow-sm backdrop-blur-xs truncate max-w-full';
      } else {
        statusBadge.textContent = 'AI VISION: READY (HOLDING) 🪥';
        statusBadge.className = 'bg-slate-900/90 border border-amber-400/70 px-2 py-0.5 rounded-full text-[9px] font-black text-amber-300 shadow-sm backdrop-blur-xs truncate max-w-full';
      }
    } else if (isMicActive || sensorMode === 'audio') {
      statusBadge.textContent = (isMicScrubbing || micCadenceScore > 15) ? `AUDIO SENSE: BRUSHING ${micCadenceScore}% 🎙️` : 'AUDIO SENSE: READY 🎙️';
      statusBadge.className = 'bg-slate-900/90 border border-cyan-400/70 px-2 py-0.5 rounded-full text-[9px] font-black text-cyan-300 shadow-sm backdrop-blur-xs truncate max-w-full';
    } else {
      statusBadge.textContent = 'HERO SHIELD AUTO-MODE ✨ (Tap or Scrub!)';
      statusBadge.className = 'bg-slate-900/90 border border-cyan-400/70 px-2 py-0.5 rounded-full text-[9px] font-black text-cyan-300 shadow-sm backdrop-blur-xs truncate max-w-full';
    }
  }
  if (toggleBtn) {
    toggleBtn.textContent = (isFallbackManualOverride || (!isCameraActive && sensorMode !== 'initializing'))
      ? '📷 Enable Camera'
      : '🛡️ Non-Camera Mode';
  }
}

function stopStreamTracks(stream) {
  if (stream && typeof stream.getTracks === 'function') {
    stream.getTracks().forEach(t => {
      try { t.stop(); } catch {}
    });
  }
}

function activateFallbackMode(reason = 'Camera unavailable') {
  isCameraActive = false;
  isCameraMotionDetected = false;
  const micListening = isMicActive || (typeof brushAudioAnalyzer?.isListening === 'function' && brushAudioAnalyzer.isListening());
  if (!micListening) {
    sensorMode = 'fallback';
    brushVisionTracker.setMode('fallback');
  } else {
    sensorMode = 'audio';
    brushVisionTracker.setMode('audio');
  }
  visionSnapshot = brushVisionTracker.getSnapshot();
  updateVisionHudState();
  return reason;
}

function setSensorIdleState(activeQuad) {
  const colState = store.getBossColosseumState ? store.getBossColosseumState() : {};
  const minFloor = store.getColosseumPhaseHpFloor
    ? store.getColosseumPhaseHpFloor(colState.maxHp || 100, secondsRemaining, totalDuration)
    : 1;
  hanaBattle3DService.updateState({
    bossHp: colState.currentHp,
    maxHp: colState.maxHp,
    minBossHpFloor: minFloor,
    shieldActive: colState.isShieldActive,
    activeQuadrant: activeQuad.id,
    hasLaser: checkLaserToothbrushEquipped(),
    combatWeapon: getActiveCombatWeapon(),
    cadenceScore: 0,
    combo: currentCombo,
    isScrubbing: false,
    quadrantCleanliness: quadrantCleanliness,
    sensorMode,
    movementSpeed: 0,
    visionConfidence: 0,
    isFinale: activeQuad.id === 'q5'
  });
  updateVisionHudState();
}

async function initSensors() {
  if (typeof document === 'undefined') return;
  const token = ++sensorInitToken;
  const isStaleInit = () => token !== sensorInitToken || !isBattleRunning || isFallbackManualOverride;
  const video = document.getElementById('ar-camera-feed');

  if (isFallbackManualOverride) {
    cameraError = null;
    activateFallbackMode('User selected Non-Camera Mode');
    return;
  }

  if (videoStream && videoStream.active && typeof videoStream.getVideoTracks === 'function' && videoStream.getVideoTracks().length > 0) {
    if (video) {
      video.srcObject = videoStream;
      video.classList.remove('hidden');
      if (typeof video.play === 'function') video.play().catch(() => {});
    }
    hanaBattle3DService.setVideoElement(video);
    isCameraActive = true;
    cameraError = null;
    sensorMode = 'vision';
    brushVisionTracker.setMode('vision');
    updateVisionHudState();
    startOpticalMotionTracker();
    if (typeof videoStream.getAudioTracks === 'function' && videoStream.getAudioTracks().length > 0) {
      brushAudioAnalyzer.startListening(handleCadenceUpdate, videoStream).then((ok) => {
        if (!isStaleInit()) {
          isMicActive = Boolean(ok && brushAudioAnalyzer.isListening());
        }
      }).catch(() => {});
    }
    return;
  }

  // Defensively stop any prior non-video stream (e.g. audioStream from 'audio' mode) before acquiring new sensors
  brushAudioAnalyzer.stopListening();
  if (videoStream) {
    stopStreamTracks(videoStream);
    videoStream = null;
  }
  isMicActive = false;
  isMicScrubbing = false;
  micCadenceScore = 0;

  if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    cameraError = { name: 'Unsupported', message: 'navigator.mediaDevices.getUserMedia unavailable' };
    activateFallbackMode('Camera API unavailable');
    return;
  }

  sensorMode = 'initializing';
  updateVisionHudState();

  let acquiredStream = null;
  let lastErr = null;

  // Step 1: Try atomic video + audio
  try {
    acquiredStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: cameraFacingMode },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
  } catch (err) {
    lastErr = err;
    console.warn('Atomic camera + mic failed, retrying video-only:', err?.name || err);
  }
  if (isStaleInit()) {
    stopStreamTracks(acquiredStream);
    return;
  }

  // Step 2: Try video-only with preferred facingMode
  if (!acquiredStream) {
    try {
      acquiredStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: cameraFacingMode }
      });
      lastErr = null;
    } catch (err) {
      lastErr = err;
      console.warn('Video-only facingMode failed, checking generic video fallback:', err?.name || err);
    }
    if (isStaleInit()) {
      stopStreamTracks(acquiredStream);
      return;
    }
  }

  // Step 3: If OverconstrainedError (or constraint mismatch), retry basic { video: true }
  if (!acquiredStream && lastErr && (lastErr.name === 'OverconstrainedError' || lastErr.name === 'ConstraintNotSatisfiedError')) {
    try {
      acquiredStream = await navigator.mediaDevices.getUserMedia({ video: true });
      lastErr = null;
    } catch (err) {
      lastErr = err;
    }
    if (isStaleInit()) {
      stopStreamTracks(acquiredStream);
      return;
    }
  }

  if (acquiredStream) {
    if (videoStream && videoStream !== acquiredStream) {
      brushAudioAnalyzer.stopListening();
      stopStreamTracks(videoStream);
    }
    videoStream = acquiredStream;
    isCameraActive = true;
    cameraError = null;
    sensorMode = 'vision';
    brushVisionTracker.reset();
    brushVisionTracker.setMode('vision');

    const liveVideo = typeof document !== 'undefined' ? document.getElementById('ar-camera-feed') : video;
    if (liveVideo) {
      liveVideo.srcObject = acquiredStream;
      liveVideo.classList.remove('hidden');
      if (typeof liveVideo.play === 'function') liveVideo.play().catch(() => {});
    }
    hanaBattle3DService.setVideoElement(liveVideo);
    updateVisionHudState();
    startOpticalMotionTracker();

    const audioTracks = typeof acquiredStream.getAudioTracks === 'function' ? acquiredStream.getAudioTracks() : [];
    if (audioTracks.length > 0) {
      brushAudioAnalyzer.startListening(handleCadenceUpdate, acquiredStream).then((ok) => {
        if (!isStaleInit()) {
          isMicActive = Boolean(ok && brushAudioAnalyzer.isListening());
        }
      }).catch(() => {});
    }
    return;
  }

  // Step 4: Camera failed (NotAllowedError, NotFoundError, etc.) — try audio-only mic, else explicit Non-Camera Fallback
  cameraError = lastErr || { name: 'NotAvailable', message: 'Camera unavailable' };
  isCameraActive = false;
  const currentVideoEl = typeof document !== 'undefined' ? document.getElementById('ar-camera-feed') : video;
  if (currentVideoEl) currentVideoEl.classList.add('hidden');

  let audioStream = null;
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (isStaleInit()) {
      stopStreamTracks(audioStream);
      return;
    }
    const started = await brushAudioAnalyzer.startListening(handleCadenceUpdate, audioStream);
    if (isStaleInit()) {
      brushAudioAnalyzer.stopListening();
      stopStreamTracks(audioStream);
      return;
    }
    if (!started) {
      stopStreamTracks(audioStream);
      videoStream = null;
      isMicActive = false;
      activateFallbackMode('Microphone analyzer unavailable');
      return;
    }
    if (videoStream && videoStream !== audioStream) {
      stopStreamTracks(videoStream);
    }
    videoStream = audioStream;
    isMicActive = Boolean(brushAudioAnalyzer.isListening());
    sensorMode = 'audio';
    brushVisionTracker.setMode('audio');
    updateVisionHudState();
  } catch (e) {
    stopStreamTracks(audioStream);
    if (isStaleInit()) return;
    console.warn('Microphone also unavailable; activating Non-Camera Hero Shield Mode.');
    activateFallbackMode(cameraError?.name || 'Camera & mic unavailable');
  }
}

function handleCadenceUpdate({ isScrubbing, cadenceScore }) {
  if (isBattlePaused || !isBattleRunning || battlePhase !== 'brush') return;
  const combatWeapon = getActiveCombatWeapon();
  const boostedCadence = Math.min(100, Math.round(cadenceScore * (combatWeapon.multiplier || 1.0)));
  isMicActive = typeof brushAudioAnalyzer?.isListening === 'function' ? brushAudioAnalyzer.isListening() : true;
  isMicScrubbing = Boolean(isScrubbing);
  micCadenceScore = isMicScrubbing ? boostedCadence : 0;
  const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);

  if (isScrubbing) {
    cadenceSamples.push(boostedCadence);
    visionSnapshot = brushVisionTracker.recordAudioSignal(
      { isScrubbing: true, cadenceScore: boostedCadence },
      activeQuad.id,
      Date.now()
    );
    handleScrubHit(activeQuad, 'acoustic', visionSnapshot);

    if (isDeflectFlurryActive && boostedCadence >= 45) {
      triggerDeflectSuccess();
    }
  } else if (!isCameraMotionDetected && (Date.now() - lastPointerScrubAt > 750)) {
    visionSnapshot = brushVisionTracker.tickIdleCheck(Date.now());
    if (!visionSnapshot.isBrushing) {
      setSensorIdleState(activeQuad);
    }
  }
}

async function flipCamera() {
  const prevFacing = cameraFacingMode;
  cameraFacingMode = (cameraFacingMode === 'user') ? 'environment' : 'user';
  isFallbackManualOverride = false;
  stopSensors();
  const abortEpoch = sensorAbortEpoch;
  await initSensors();
  if (abortEpoch !== sensorAbortEpoch || !isBattleRunning || isFallbackManualOverride) return;
  if (!isCameraActive && prevFacing === 'user') {
    cameraFacingMode = 'user';
    stopSensors();
    await initSensors();
  }
}

function stopSensors() {
  sensorInitToken++;
  sensorAbortEpoch++;
  stopBattleVoiceRecognition();
  brushAudioAnalyzer.stopListening();
  if (videoStream) {
    stopStreamTracks(videoStream);
    videoStream = null;
  }
  isCameraActive = false;
  isMicActive = false;
  isMicScrubbing = false;
  micCadenceScore = 0;
  if (motionCheckInterval) {
    clearInterval(motionCheckInterval);
    motionCheckInterval = null;
  }
  isCameraMotionDetected = false;
  brushVisionTracker.reset();
  visionSnapshot = brushVisionTracker.getSnapshot();
}

function normalizeSpeechPhrase(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function attachCompanionSpeechGateListeners() {
  if (typeof window === 'undefined') return;
  if (window._battleCompanionSpeechStartHandler) {
    window.removeEventListener('companion-speech-start', window._battleCompanionSpeechStartHandler);
  }
  if (window._battleCompanionSpeechEndHandler) {
    window.removeEventListener('companion-speech-end', window._battleCompanionSpeechEndHandler);
  }
  window._battleCompanionSpeechStartHandler = (e) => {
    isCompanionSpeakingNow = true;
    const txt = e?.detail?.text || '';
    if (txt) lastCompanionSpeechText = String(txt);
  };
  window._battleCompanionSpeechEndHandler = (e) => {
    isCompanionSpeakingNow = false;
    lastCompanionSpeechEndMs = Date.now();
    const txt = e?.detail?.text || '';
    if (txt) lastCompanionSpeechText = String(txt);
  };
  window.addEventListener('companion-speech-start', window._battleCompanionSpeechStartHandler);
  window.addEventListener('companion-speech-end', window._battleCompanionSpeechEndHandler);
}

function isVoiceCommandEchoGated(transcript) {
  const now = Date.now();
  if (isCompanionSpeakingNow) return true;
  if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) return true;
  if (lastCompanionSpeechEndMs > 0 && (now - lastCompanionSpeechEndMs) < 350) return true;

  const normTranscript = normalizeSpeechPhrase(transcript);
  if (!normTranscript) return true;
  const normRecent = normalizeSpeechPhrase(lastCompanionSpeechText);
  if (normRecent && normTranscript.length >= 12 && (normRecent.includes(normTranscript) || normTranscript.includes(normRecent))) {
    return true;
  }
  if (normRecent && normTranscript === normRecent && normTranscript !== 'blast' && normTranscript !== 'shield up') {
    return true;
  }
  return false;
}

function handleBattleVoiceTranscript(rawText) {
  if (!isBattleRunning || isBattlePaused || battlePhase !== 'brush') return false;
  const text = String(rawText || '').trim();
  if (!text) return false;
  if (isVoiceCommandEchoGated(text)) return false;

  const norm = normalizeSpeechPhrase(text);
  if (!norm) return false;

  if (/\bshield\s+up\b|\bshield\b/.test(norm)) {
    return activateMintyShield('voice');
  }
  if (/\bblast\b|\bminty\s+fresh\s+blast\b|\bfoam\s+blast\b/.test(norm)) {
    return triggerSupernovaBlast('voice');
  }
  return false;
}

function initBattleVoiceRecognition() {
  stopBattleVoiceRecognition();
  attachCompanionSpeechGateListeners();
  if (typeof window === 'undefined') return null;
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (typeof SpeechRec !== 'function') return null;

  try {
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (event) => {
      if (!event || !event.results) return;
      const startIdx = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
      for (let i = startIdx; i < event.results.length; i++) {
        const resItem = event.results[i];
        const alt = resItem && resItem[0];
        const transcript = alt?.transcript || '';
        if (transcript) {
          handleBattleVoiceTranscript(transcript);
        }
      }
    };
    rec.onerror = () => {
      // Silent fallback to brushing/HUD triggers on not-allowed or audio-capture error
    };
    battleSpeechRecognizer = rec;
    rec.start();
    return rec;
  } catch (e) {
    battleSpeechRecognizer = null;
    return null;
  }
}

function stopBattleVoiceRecognition() {
  if (battleSpeechRecognizer) {
    try {
      if (typeof battleSpeechRecognizer.stop === 'function') battleSpeechRecognizer.stop();
      else if (typeof battleSpeechRecognizer.abort === 'function') battleSpeechRecognizer.abort();
    } catch {}
    battleSpeechRecognizer = null;
  }
}

export function activateMintyShield(source = 'button') {
  if (!isBattleRunning || isBattlePaused || battlePhase !== 'brush') return false;
  const currentSt = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
  if (mintyShieldCharge < 40 && !mintyShieldActive && !currentSt?.active) {
    return false;
  }
  const bonusSec = typeof store.getMintyShieldUpgradeBonusSec === 'function'
    ? (store.getMintyShieldUpgradeBonusSec(getActiveHeroId()) || 0)
    : 0;
  mintyShieldDurationSec = 5 + bonusSec;
  mintyShieldRemainingSec = mintyShieldDurationSec;
  mintyShieldActive = true;
  lastShieldScrubRefreshSec = -1;

  if (source !== 'refresh') {
    mintyShieldCharge = 0;
  }

  hanaBattle3DService.setMintyShieldState?.({
    active: true,
    charge: mintyShieldCharge,
    integrity: 3,
    maxIntegrity: 3,
    remainingSec: mintyShieldRemainingSec,
    durationSec: mintyShieldDurationSec,
    attackBoostActive: true
  });

  if (source !== 'refresh') {
    showComicHit(`MINTY SHIELD ACTIVE (${mintyShieldDurationSec}s)! ❄️🛡️`);
  }
  syncCockpitHUD();
  return true;
}

function startOpticalMotionTracker() {
  if (motionCheckInterval) clearInterval(motionCheckInterval);

  if (!motionCanvas && typeof document !== 'undefined') {
    motionCanvas = document.createElement('canvas');
    motionCanvas.width = 64;
    motionCanvas.height = 48;
    motionCtx = motionCanvas.getContext('2d', { willReadFrequently: true });
  }

  motionCheckInterval = setInterval(() => {
    if (!isBattleRunning || isBattlePaused || !isCameraActive) return;

    const nowMs = Date.now();
    const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
    const sensitivity = store.getState().parentSettings?.motionSensitivity || 'medium';
    const video = typeof document !== 'undefined' ? document.getElementById('ar-camera-feed') : null;

    if (video && video.readyState >= 2 && !video.paused && motionCtx) {
      motionCtx.save();
      motionCtx.translate(64, 0);
      motionCtx.scale(-1, 1);
      motionCtx.drawImage(video, 0, 0, 64, 48);
      motionCtx.restore();

      const currentFrame = motionCtx.getImageData(0, 0, 64, 48);
      const data = currentFrame.data;

      visionSnapshot = brushVisionTracker.processFrame(data, 64, 48, activeQuad.id, sensitivity, nowMs);
      isCameraMotionDetected = visionSnapshot.isBrushing;

      if (visionSnapshot.isBrushing) {
        if (battlePhase === 'brush') {
          if (!isMicScrubbing && visionSnapshot.movementSpeed > 0) {
            const visionCadence = Math.max(40, Math.min(100, Math.round(visionSnapshot.movementSpeed * 0.6 + visionSnapshot.confidence * 0.4)));
            cadenceSamples.push(visionCadence);
          }
          handleScrubHit(activeQuad, 'optical', visionSnapshot);

          if (isDeflectFlurryActive && (visionSnapshot.motionRatio >= 0.14 || visionSnapshot.movementSpeed >= 65)) {
            triggerDeflectSuccess();
          }
        } else {
          setSensorIdleState(activeQuad);
        }
      } else if (!isMicScrubbing && (nowMs - lastPointerScrubAt > 750)) {
        setSensorIdleState(activeQuad);
      } else {
        updateVisionHudState();
      }
    } else {
      visionSnapshot = brushVisionTracker.tickIdleCheck(nowMs);
      isCameraMotionDetected = visionSnapshot.isBrushing;
      if (!visionSnapshot.isBrushing && !isMicScrubbing && (nowMs - lastPointerScrubAt > 750)) {
        setSensorIdleState(activeQuad);
      }
    }
  }, 100);
}

// =========================================================================
// DEFLECT FLURRY & SPOKEN /LEARN MICRO-CHALLENGE
// =========================================================================
function triggerDeflectFlurry() {
  if (isDeflectFlurryActive || !isBattleRunning || isBattlePaused || battlePhase !== 'brush') return;
  isDeflectFlurryActive = true;

  if (!currentSugarHazard) {
    currentSugarHazard = getSugarHazardById(store.drawNextSugarHazardId(getActiveHeroId()));
    hanaBattle3DService.setHazard(currentSugarHazard);
  }

  // One hazard bomb per flurry -- a trailing second bomb 450ms later made
  // every attack a rapid-fire double-hit, which read as overly fast pacing.
  hanaBattle3DService.spawnCaramelBomb(currentSugarHazard);

  const banner = document.getElementById('deflect-flurry-banner');
  if (banner) {
    const emojiEl = document.getElementById('deflect-hazard-emoji');
    const textEl = document.getElementById('deflect-hazard-text');
    if (emojiEl) emojiEl.textContent = currentSugarHazard.emoji;
    if (textEl) textEl.textContent = `${currentSugarHazard.name.toUpperCase()} INCOMING! DEFLECT!`;
    banner.classList.remove('opacity-0', 'scale-90');
    banner.classList.add('opacity-100', 'scale-100');
  }

  currentRexCoachText = currentSugarHazard.rexWarning || 'Sugar Hazard incoming! Scrub faster to raise your enamel shield!';
  updateRexDialogue();
  voicePrompts.speak(currentRexCoachText, null, null, { instant: true });

  // Query AGY Battle Coach for tactical counter-move
  const colState = store.getState().bossColosseum || {};
  const hpPercent = colState.maxHp > 0 ? (colState.currentHp / colState.maxHp) * 100 : 80;
  const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
  getBattleCoachAdvice(selectedBossId, hpPercent, activeQuad.number, micCadenceScore, getActiveCombatWeapon().id)
    .then(advice => {
      if (advice?.coach_text && isBattleRunning && !isBattlePaused && isDeflectFlurryActive) {
        currentRexCoachText = advice.coach_text;
        updateRexDialogue();
      }
    })
    .catch(() => {});

  if (deflectFlurryTimer) clearTimeout(deflectFlurryTimer);
  deflectFlurryTimer = setTimeout(() => {
    isDeflectFlurryActive = false;
    hideDeflectBanner();
    hanaBattle3DService.setDeflectActive(false);
  }, 2800);
}

function sync3DServiceFromStore(activeQuad = null, extra = {}) {
  const colState = store.getBossColosseumState ? store.getBossColosseumState() : {};
  const quad = activeQuad || getDentalQuadrant(secondsRemaining, totalDuration);
  const minFloor = store.getColosseumPhaseHpFloor
    ? store.getColosseumPhaseHpFloor(colState.maxHp || 100, secondsRemaining, totalDuration)
    : 1;
  hanaBattle3DService.updateState({
    bossHp: colState.currentHp,
    maxHp: colState.maxHp,
    minBossHpFloor: minFloor,
    shieldActive: colState.isShieldActive,
    activeQuadrant: quad.id,
    hasLaser: checkLaserToothbrushEquipped(),
    combatWeapon: getActiveCombatWeapon(),
    quadrantCleanliness: quadrantCleanliness,
    sensorMode,
    isFinale: quad.id === 'q5',
    ...extra
  });
}

function triggerDeflectSuccess() {
  if (!isDeflectFlurryActive) return;
  isDeflectFlurryActive = false;
  if (deflectFlurryTimer) clearTimeout(deflectFlurryTimer);
  hideDeflectBanner();

  const boss = getBattleBoss(selectedBossId);
  hanaBattle3DService.onDeflectRicochet();
  store.triggerColosseumDeflect(true);
  sync3DServiceFromStore(null);

  const hazardName = currentSugarHazard ? currentSugarHazard.shortName.toUpperCase() : 'SUGAR';
  showComicHit(`${hazardName} DEFLECTED! 🛡️✨`);
  if (typeof Sound?.fanfare === 'function') Sound.fanfare();
  currentRexCoachText = "ENAMEL POWER SURGE! You broke the sweet treat barrier!";
  updateRexDialogue();
  voicePrompts.speak(currentRexCoachText, null, null, { instant: true });
  syncCockpitHUD();
}

function hideDeflectBanner() {
  const banner = document.getElementById('deflect-flurry-banner');
  if (banner) {
    banner.classList.remove('opacity-100', 'scale-100');
    banner.classList.add('opacity-0', 'scale-90');
  }
}

// =========================================================================
// BATTLE LIFECYCLE CONTROLLERS
// =========================================================================

export function advanceToBrushPhase() {
  if (!isBattleRunning || battlePhase !== 'floss') return;
  battlePhase = 'brush';
  const currentBoss = getBattleBoss(selectedBossId);
  const bossDuration = store.getState().parentSettings?.arBattleDuration || currentBoss.battleDurationSec || 120;
  secondsRemaining = bossDuration;
  totalDuration = bossDuration;

  totalScrubHits = 0;
  currentCombo = 0;
  volleyCount = 0;
  lastCounterAttackAt = 0;
  lastPointerScrubAt = 0;
  isPointerScrubbing = false;
  isFinaleSpeedActive = false;
  lastShieldActiveState = false;
  isDeflectFlurryActive = false;
  if (deflectFlurryTimer) {
    clearTimeout(deflectFlurryTimer);
    deflectFlurryTimer = null;
  }
  cadenceSamples = [];
  lastScrubTimestamp = Date.now();
  lastSpokenQuadId = null;
  quadrantCleanliness = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };
  lastProgressTimestamp = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };
  resetOverhaulCombatState();

  store.initColosseumBattle(selectedBossId, bossDuration, true);

  hanaBattle3DService.resetBattleState?.();
  hanaBattle3DService.setBoss(currentBoss);
  if (!currentSugarHazard) {
    currentSugarHazard = getSugarHazardById(store.drawNextSugarHazardId(getActiveHeroId()));
  }
  hanaBattle3DService.setHazard(currentSugarHazard);
  hanaBattle3DService.setFinaleMode?.(false);
  if (typeof Sound?.speedUpBattleRhythm === 'function') Sound.speedUpBattleRhythm(false);

  const initialQuad = getDentalQuadrant(secondsRemaining, totalDuration);
  sync3DServiceFromStore(initialQuad, {
    cadenceScore: 0,
    combo: 0,
    isScrubbing: false
  });
  currentRexCoachText = initialQuad.coachMessage || 'Get ready! Scrub in gentle circles on your top right teeth!';
  lastSpokenQuadId = initialQuad.id;

  const kidId = getActiveHeroId();
  if (kidId) {
    store.acknowledgeHygieneReminder(kidId, 'floss');
  } else if (typeof store.notify === 'function') {
    store.notify();
  }

  Sound.fanfare();
  voicePrompts.speak("Flossing complete! Now 3, 2, 1, BRUSH!", null, null, { instant: true });
  playIntroCountdown();

  if (typeof document !== 'undefined') {
    const timerDisplay = document.getElementById('battle-timer-display');
    if (timerDisplay) {
      const mins = Math.floor(secondsRemaining / 60);
      const secs = secondsRemaining % 60;
      timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    // Fallback DOM cleanup for subscriberless unit tests
    const flossContainer = document.getElementById('floss-banner-container');
    if (flossContainer) {
      flossContainer.remove();
    }
    const zoneBanner = document.getElementById('active-zone-banner');
    if (zoneBanner) {
      zoneBanner.classList.remove('hidden');
    }
  }

  updateRexDialogue();
  syncCockpitHUD();
}

export function startBattle() {
  if (battleTimer) {
    clearInterval(battleTimer);
    battleTimer = null;
  }
  if (bombTimer) {
    clearInterval(bombTimer);
    bombTimer = null;
  }
  if (motionCheckInterval) {
    clearInterval(motionCheckInterval);
    motionCheckInterval = null;
  }
  if (autoAssistInterval) {
    clearInterval(autoAssistInterval);
    autoAssistInterval = null;
  }
  if (introCountdownInterval) {
    clearInterval(introCountdownInterval);
    introCountdownInterval = null;
  }
  if (introCountdownFadeTimeout) {
    clearTimeout(introCountdownFadeTimeout);
    introCountdownFadeTimeout = null;
  }
  if (mouthwashReminderTimeout) {
    clearTimeout(mouthwashReminderTimeout);
    mouthwashReminderTimeout = null;
  }
  isConcludingVictory = false;
  isFallbackManualOverride = false;
  sensorMode = 'initializing';
  isBattleRunning = true;
  isBattlePaused = false;
  isCompanionSpeakingNow = false;
  lastCompanionSpeechEndMs = 0;
  lastCompanionSpeechText = '';

  const isExplicit = hasExplicitBossSelection || store.state?.hasExplicitBossSelection || store.state?.selectedBossId === 'sugar_boss';
  if (!isExplicit) {
    if (!sessionRotatedBossId) {
      if (typeof store.drawNextHygieneBossId === 'function') {
        sessionRotatedBossId = store.drawNextHygieneBossId(getActiveHeroId());
      } else {
        const randomIndex = Math.floor(Math.random() * ROTATING_VILLAINS.length);
        sessionRotatedBossId = ROTATING_VILLAINS[randomIndex];
      }
    }
    selectedBossId = sessionRotatedBossId;
    if (store.state) store.state.selectedBossId = selectedBossId;
  } else {
    selectedBossId = store.getSelectedBossId ? store.getSelectedBossId() : (store.state?.selectedBossId || selectedBossId);
  }
  const currentBoss = getBattleBoss(selectedBossId);
  resetOverhaulCombatState();
  hanaBattle3DService.resetBattleState?.();
  hanaBattle3DService.setBoss(currentBoss);
  syncCockpitHUD();
  
  // Draw this battle's sugar hazard from the kid's weekly rotation (cycles
  // through all 7 before any repeat) instead of a flat random pick.
  currentSugarHazard = getSugarHazardById(store.drawNextSugarHazardId(getActiveHeroId()));
  hanaBattle3DService.setHazard(currentSugarHazard);

  const hero = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  const battleCfg = BATTLE_DIFFICULTY[getDifficultyTier(hero)];
  // The Parent Panel's "Toothbrush AR Battle Duration Slider" is the single
  // source of truth for every kid's timer, so it always wins over a
  // boss-specific default.
  const bossDuration = store.getState().parentSettings?.arBattleDuration || currentBoss.battleDurationSec || 120;
  
  const kidId = hero?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
  const needsFloss = kidId && store.shouldShowHygieneReminder(kidId, 'floss');

  if (needsFloss) {
    battlePhase = 'floss';
    secondsRemaining = 120; // 2-minute preliminary flossing battle
    totalDuration = 120;
  } else {
    battlePhase = 'brush';
    secondsRemaining = bossDuration;
    totalDuration = bossDuration;
  }

  totalScrubHits = 0;
  currentCombo = 0;
  volleyCount = 0;
  lastCounterAttackAt = 0;
  lastPointerScrubAt = 0;
  isPointerScrubbing = false;
  isFinaleSpeedActive = false;
  lastShieldActiveState = false;
  cadenceSamples = [];
  lastScrubTimestamp = Date.now();
  lastSpokenQuadId = null;

  quadrantCleanliness = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };
  lastProgressTimestamp = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };

  store.initColosseumBattle(selectedBossId, totalDuration, true);
  sync3DServiceFromStore(getDentalQuadrant(secondsRemaining, totalDuration), {
    cadenceScore: 0,
    combo: 0,
    isScrubbing: false
  });
  syncCockpitHUD();
  if (typeof Sound?.speedUpBattleRhythm === 'function') Sound.speedUpBattleRhythm(false);
  hanaBattle3DService.setFinaleMode?.(false);

  Sound.startBattleRhythm();
  initSensors();
  initBattleVoiceRecognition();

  if (battlePhase === 'floss') {
    currentRexCoachText = "Time to floss, Little Hero! Clean between those teeth so the sugar villains have nowhere to hide!";
    voicePrompts.speak(currentRexCoachText, null, null, { instant: true });
    updateRexDialogue();
  } else {
    // Trigger quick "3, 2, 1, BRUSH!" visual intro overlay
    playIntroCountdown();
    const initialQuad = getDentalQuadrant(secondsRemaining, totalDuration);
    currentRexCoachText = initialQuad.coachMessage || 'Get ready! Scrub in gentle circles on your top right teeth!';
    lastSpokenQuadId = initialQuad.id;
  }

  // Auto-Assist / Sensor Idle-Hold Supervisor (1 Hz)
  // - When camera or mic sensors are active, holds Tooth Defenders idle if motion stops.
  // - When in Non-Camera Fallback Mode, triggers gentle kid-friendly fallback cadence (~2s cooldown).
  if (autoAssistInterval) clearInterval(autoAssistInterval);
  autoAssistInterval = setInterval(() => {
    if (!isBattleRunning || isBattlePaused) return;
    const now = Date.now();
    const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);

    const micListening = isMicActive || (typeof brushAudioAnalyzer?.isListening === 'function' && brushAudioAnalyzer.isListening());
    if (isCameraActive || micListening) {
      const idleForMs = now - lastScrubTimestamp;
      if (idleForMs > 750 && (now - lastPointerScrubAt > 750)) {
        visionSnapshot = brushVisionTracker.tickIdleCheck(now);
        if (!visionSnapshot.isBrushing) {
          setSensorIdleState(activeQuad);
        }
      }
      return;
    }

    if (sensorMode !== 'fallback') {
      activateFallbackMode('Sensors inactive');
    }

    if (battlePhase !== 'brush') return;

    if (now - lastScrubTimestamp > battleCfg.autoAssistIdleMs) {
      isAutoAssistPulseActive = true;
      handleScrubHit(activeQuad, 'assist');
      setTimeout(() => { isAutoAssistPulseActive = false; }, 400);
    }
  }, 1000);

  // Periodic Caramel Bomb Attack Timer (active during brush phase)
  if (bombTimer) clearInterval(bombTimer);
  bombTimer = setInterval(() => {
    if (isBattleRunning && !isBattlePaused && battlePhase === 'brush' && secondsRemaining > 10) {
      triggerDeflectFlurry();
    }
  }, battleCfg.bombIntervalMs);

  // 1 Hz Countdown Battle Loop
  if (battleTimer) clearInterval(battleTimer);
  battleTimer = setInterval(() => {
    if (isBattlePaused) return;

    if (battlePhase === 'floss') {
      secondsRemaining--;

      const mins = Math.floor(secondsRemaining / 60);
      const secs = secondsRemaining % 60;
      const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      const timerDisplay = typeof document !== 'undefined' ? document.getElementById('battle-timer-display') : null;
      if (timerDisplay) timerDisplay.textContent = timeStr;

      const flossBar = typeof document !== 'undefined' ? document.getElementById('floss-progress-bar') : null;
      if (flossBar) {
        flossBar.style.width = `${Math.round(((120 - secondsRemaining) / 120) * 100)}%`;
      }

      if (secondsRemaining === 60) {
        currentRexCoachText = "Halfway through flossing! Make sure to get those back molars!";
        voicePrompts.speak(currentRexCoachText, null, null, { instant: true });
        updateRexDialogue();
      }

      if (secondsRemaining <= 0) {
        advanceToBrushPhase();
      }
      return;
    }

    // Phase 2: Toothbrush Countdown Loop
    secondsRemaining--;

    store.updateColosseumTimer(secondsRemaining, totalDuration);

    // F1. Minty Shield 1Hz Lifecycle & Uptime Tracking
    const liveShield = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    if (liveShield?.active && (liveShield.integrity ?? 1) > 0) {
      mintyShieldActive = true;
      mintyShieldActiveSeconds++;
      const brushedThisTick = (lastShieldScrubRefreshSec >= secondsRemaining);
      if (brushedThisTick) {
        mintyShieldRemainingSec = mintyShieldDurationSec;
        hanaBattle3DService.setMintyShieldState?.({
          active: true,
          remainingSec: mintyShieldRemainingSec,
          durationSec: mintyShieldDurationSec
        });
      } else {
        mintyShieldRemainingSec = Math.max(0, (liveShield.remainingSec ?? mintyShieldRemainingSec) - 1);
        mintyShieldActive = mintyShieldRemainingSec > 0 && (liveShield.integrity ?? 1) > 0;
        hanaBattle3DService.setMintyShieldState?.({
          active: mintyShieldActive,
          remainingSec: mintyShieldRemainingSec
        });
      }
    } else {
      mintyShieldActive = false;
      mintyShieldRemainingSec = 0;
    }

    // F4. Tartar Tyrant Armor Shell Hardening & Recharging Lifecycle
    if (selectedBossId === 'tartar_tyrant' || hanaBattle3DService.bossData?.id === 'tartar_tyrant') {
      const shell = hanaBattle3DService.tartarShellState || hanaBattle3DService.tartarShell;
      if (shell && shell.active && !shell.shattered) {
        tartarShellAgeSec++;
        const nextStage = tartarShellAgeSec >= 12 ? 3 : (tartarShellAgeSec >= 5 ? 2 : 1);
        const shouldRecharge = tartarShellAgeSec >= 8;
        if (shouldRecharge) {
          tartarShellEverRecharged = true;
        }
        hanaBattle3DService.setTartarShellState?.({
          active: true,
          hardeningStage: Math.max(shell.hardeningStage || 1, nextStage),
          recharging: Boolean(shell.recharging || shouldRecharge)
        });
      }
    }

    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const timerDisplay = typeof document !== 'undefined' ? document.getElementById('battle-timer-display') : null;
    if (timerDisplay) timerDisplay.textContent = timeStr;

    const colState = store.getBossColosseumState ? store.getBossColosseumState() : {};
    const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
    const isHalfwayMark = secondsRemaining > 0 && secondsRemaining === Math.floor(totalDuration / 2);
    const isZoneSwitch = activeQuad.id !== lastSpokenQuadId;
    if (isZoneSwitch) {
      lastPhaseShiftAtMs = Date.now();
    }

    if (secondsRemaining > 0) {
      sync3DServiceFromStore(activeQuad);
    }

    // Announce Sugar Shield activation once per shield phase and combine with zone/halfway cues if same-tick
    const boss = getBattleBoss(selectedBossId);
    const isShieldNewlyActive = Boolean(colState.isShieldActive && !lastShieldActiveState);
    if (isShieldNewlyActive) {
      lastShieldActiveState = true;
      showComicHit('SUGAR SHIELD! SCRUB TO CRACK IT! 🛡️');
    } else if (!colState.isShieldActive && lastShieldActiveState) {
      lastShieldActiveState = false;
    }

    // QuadPacer Zone Transition + Unified 60s Halfway Prompt + Same-Tick Shield Guard (prevents voice self-cancellation)
    if (isZoneSwitch) {
      lastSpokenQuadId = activeQuad.id;
      if (typeof Sound?.zoneChime === 'function') Sound.zoneChime();
      else if (typeof Sound?.picnicChime === 'function') Sound.picnicChime();

      if (typeof document !== 'undefined') {
        const zoneBanner = document.getElementById('active-zone-banner');
        if (zoneBanner) {
          zoneBanner.classList.add('scale-105', 'ring-2', 'ring-cyan-300');
          setTimeout(() => {
            zoneBanner.classList.remove('scale-105', 'ring-2', 'ring-cyan-300');
          }, 600);
        }
      }

      const baseCoach = activeQuad.coachMessage || `Brush your ${activeQuad.name}!`;
      const prefix = isHalfwayMark ? 'Halfway there Little Hero! ' : '';
      const shieldSuffix = isShieldNewlyActive
        ? ` ${boss.name} summoned a sugar shield! Keep scrubbing with power to smash through it!`
        : '';
      currentRexCoachText = `${prefix}${baseCoach}${shieldSuffix}`;
      voicePrompts.speak(currentRexCoachText, null, null, { instant: true });
      updateRexDialogue();
    } else if (isHalfwayMark) {
      const shieldSuffix = isShieldNewlyActive
        ? ` ${boss.name} summoned a sugar shield! Keep scrubbing with power to smash through it!`
        : '';
      currentRexCoachText = `Halfway there Little Hero! Keep up the awesome brushing!${shieldSuffix}`;
      voicePrompts.speak(currentRexCoachText, null, null, { instant: true });
      updateRexDialogue();
    } else if (isShieldNewlyActive) {
      if (typeof voicePrompts?.speakShieldActive === 'function') {
        voicePrompts.speakShieldActive(boss.name);
      }
    }

    // Q5 Final 10s Sparkle Finale (speed up battle rhythm & enable finale sparkle mode)
    if (activeQuad.id === 'q5' && !isFinaleSpeedActive) {
      isFinaleSpeedActive = true;
      if (typeof Sound?.speedUpBattleRhythm === 'function') Sound.speedUpBattleRhythm(true);
      hanaBattle3DService.setFinaleMode?.(true);
      showComicHit('FINAL SPARKLE FINALE! ✨');
    }

    // Auto-trigger Supernova milestone near the finale if kid hasn't tapped it yet
    if (secondsRemaining === 12 && (colState.choreSupernovaCharge || 0) >= 40) {
      triggerSupernovaBlast();
    }

    syncCockpitHUD();

    if (secondsRemaining <= 0) {
      concludeVictory();
    }
  }, 1000);
}

function playIntroCountdown() {
  if (typeof document === 'undefined') return;
  if (introCountdownInterval) {
    clearInterval(introCountdownInterval);
    introCountdownInterval = null;
  }
  if (introCountdownFadeTimeout) {
    clearTimeout(introCountdownFadeTimeout);
    introCountdownFadeTimeout = null;
  }
  const overlay = document.getElementById('battle-intro-countdown');
  const countText = document.getElementById('intro-countdown-text');
  if (!overlay || !countText) return;

  overlay.classList.remove('hidden', 'opacity-0');
  overlay.classList.add('opacity-100');

  let count = 3;
  countText.textContent = '3';
  if (typeof Sound?.tap === 'function') Sound.tap();

  introCountdownInterval = setInterval(() => {
    count--;
    if (count > 0) {
      countText.textContent = String(count);
      if (typeof Sound?.tap === 'function') Sound.tap();
    } else if (count === 0) {
      countText.textContent = 'BRUSH! 🪥';
      if (typeof Sound?.fanfare === 'function') Sound.fanfare();
    } else {
      if (introCountdownInterval) {
        clearInterval(introCountdownInterval);
        introCountdownInterval = null;
      }
      overlay.classList.add('opacity-0');
      introCountdownFadeTimeout = setTimeout(() => {
        introCountdownFadeTimeout = null;
        overlay.classList.add('hidden');
      }, 500);
    }
  }, 750);
}

function updateRexDialogue() {
  if (typeof document === 'undefined') return;
  const bubble = document.getElementById('rex-dialogue-bubble');
  if (bubble) bubble.textContent = currentRexCoachText;
}

function triggerSupernovaBlast() {
  if (!isBattleRunning || isBattlePaused || battlePhase !== 'brush') return false;
  const col = store.getBossColosseumState ? store.getBossColosseumState() : {};
  if ((col.choreSupernovaCharge || 0) < 40) return false;
  const res = store.unleashChoreSupernova ? store.unleashChoreSupernova(true) : null;
  if (res?.success) {
    recentFoamBlastAtMs = Date.now();
    const hadSprites = (hanaBattle3DService.sweetToothSprites || []).length;
    if (hadSprites > 0) {
      spritesSpawnedCount = Math.max(spritesSpawnedCount, hadSprites);
      spritesClearedNoDamage = true;
    }
    // F5. Minty Fresh Blast immediately cleanses Sticky Residue on release.
    hanaBattle3DService.setStickyResidueState?.({ active: false, intensity: 0 });
    sync3DServiceFromStore(null);
    if (typeof hanaBattle3DService.triggerMintyFreshBlast === 'function') {
      hanaBattle3DService.triggerMintyFreshBlast();
    } else {
      hanaBattle3DService.triggerSupernova?.();
    }
    if ((Date.now() - lastPhaseShiftAtMs) <= 8000 || col.isShieldActive) {
      victoryBurstOnPhaseShift = true;
      hanaBattle3DService.triggerVictoryBurst?.();
    }
    showComicHit('MINTY FRESH BLAST! 🌟🫧');
    syncCockpitHUD();
    return true;
  }
  return false;
}

// Scrub Hit Handler: Updates cleanliness, triggers 3D foam streams, enforces cooldown-gated pacing
function handleScrubHit(activeQuad, source = 'manual', vision = null) {
  if (isBattlePaused || !isBattleRunning || battlePhase !== 'brush') return;

  const now = Date.now();
  totalScrubHits++;
  lastScrubTimestamp = now;
  currentCombo = Math.min(50, currentCombo + 1);

  // F1. Charge & Refresh Minty Shield via continuous brushing
  mintyShieldCharge = Math.min(100, mintyShieldCharge + (source === 'assist' ? 8 : 15));
  const currentShieldState = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
  if (mintyShieldActive || currentShieldState?.active) {
    lastShieldScrubRefreshSec = secondsRemaining;
    mintyShieldRemainingSec = mintyShieldDurationSec;
    mintyShieldActive = true;
    hanaBattle3DService.setMintyShieldState?.({
      active: true,
      charge: mintyShieldCharge,
      remainingSec: mintyShieldRemainingSec,
      durationSec: mintyShieldDurationSec,
      attackBoostActive: true
    });
  } else {
    hanaBattle3DService.setMintyShieldState?.({
      charge: mintyShieldCharge
    });
  }

  // F4. Tartar Tyrant Calcified Armor Shell Scrubbing & Shatter
  if (selectedBossId === 'tartar_tyrant' || hanaBattle3DService.bossData?.id === 'tartar_tyrant') {
    const shell = hanaBattle3DService.tartarShellState || hanaBattle3DService.tartarShell;
    if (shell && shell.active && !shell.shattered) {
      const nextIntegrity = Math.max(0, (shell.integrity ?? 100) - (source === 'assist' ? 2 : 9));
      if (nextIntegrity <= 0) {
        const realElapsedMs = Math.max(500, now - (brushPhaseStartTimeMs || now));
        const timerElapsedMs = Math.max(500, ((totalDuration || 120) - secondsRemaining) * 1000);
        const elapsedMs = Math.min(realElapsedMs, timerElapsedMs);
        const bossObj = getBattleBoss('tartar_tyrant');
        const tripleMs = bossObj?.armorShell?.speedScrubThresholds?.tripleMs || 6000;
        const doubleMs = bossObj?.armorShell?.speedScrubThresholds?.doubleMs || 11000;
        speedScrubMs = elapsedMs;
        speedScrubMultiplier = elapsedMs <= tripleMs ? 3 : (elapsedMs <= doubleMs ? 2 : 1);
        shellShatteredBeforeRecharge = !tartarShellEverRecharged && !shell.recharging;
        hanaBattle3DService.setTartarShellState?.({
          active: true,
          integrity: 0,
          shattered: true,
          recharging: false,
          flashTimer: 1.5,
          vulnerable: true
        });
        showComicHit(`TARTAR SHELL SHATTERED! (${speedScrubMultiplier}x SPEED SCRUB!) 💥`);
      } else {
        hanaBattle3DService.setTartarShellState?.({
          active: true,
          integrity: nextIntegrity
        });
      }
    }
  }

  // F5. Cleanse Sticky Residue when rapid scrubbing follows Minty Fresh Blast
  const stickyState = hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue;
  if (stickyState?.active && recentFoamBlastAtMs > 0 && (now - recentFoamBlastAtMs) <= 10000) {
    hanaBattle3DService.setStickyResidueState?.({ active: false, intensity: 0 });
  }

  const combatWeapon = getActiveCombatWeapon();
  const hasLaser = combatWeapon.hasWeapon;
  const scrubMultiplier = Math.min(1.5, Math.max(1.0, combatWeapon.multiplier || 1.0));

  const hero = store.getState().selectedHero;
  const activePet = store.getActivePet ? store.getActivePet() : null;
  const petId = activePet?.id || hero?.activePetId || 1;
  const petBuffs = store.getActivePetGearBuffs ? store.getActivePetGearBuffs(petId) : { damage_boost: 0, defense_boost: 0 };
  const damageBoost = petBuffs.damage_boost || 0;

  const zoneId = activeQuad.id;
  if (quadrantCleanliness[zoneId] !== undefined) {
    const prevClean = quadrantCleanliness[zoneId];
    const lastT = lastProgressTimestamp[zoneId] || 0;
    const dur = Math.max(30, totalDuration || 120);
    const baseTargetSec = zoneId === 'q5'
      ? Math.max(5, dur * 0.075)
      : dur * 0.25;

    if (source === 'assist') {
      const dtSec = lastT > 0 ? Math.min(1.0, Math.max(0.05, (now - lastT) / 1000)) : 0.8;
      lastProgressTimestamp[zoneId] = now;
      const ratePerSec = 100 / Math.max(20, baseTargetSec * 1.1);
      const inc = ratePerSec * dtSec;
      quadrantCleanliness[zoneId] = Math.min(100, Number((quadrantCleanliness[zoneId] + inc).toFixed(4)));
    } else {
      // Unified elapsed-time accumulator across active inputs (manual, optical, acoustic, voice)
      const dtSec = lastT > 0 ? Math.min(0.35, Math.max(0, (now - lastT) / 1000)) : 0.25;
      lastProgressTimestamp[zoneId] = now;
      if (dtSec > 0) {
        const ratePerSec = 100 / baseTargetSec;
        const inc = ratePerSec * dtSec;
        quadrantCleanliness[zoneId] = Math.min(100, Number((quadrantCleanliness[zoneId] + inc).toFixed(4)));
      }
    }

    // When zone hits 100% clean: trigger 3D candy armor deconstruction!
    if (prevClean < 100 && quadrantCleanliness[zoneId] >= 100) {
      if (typeof Sound?.sparkle === 'function') Sound.sparkle();
      else if (typeof Sound?.fanfare === 'function') Sound.fanfare();
      showComicHit(`${activeQuad.name.toUpperCase()} 100% CLEAN! ✨`);
      hanaBattle3DService.onArmorFracture(zoneId);
    }
  }

  // Fire 3D foam / laser beam in WebGL scene (scaled by vision speed or mic cadence)
  const activeSpeedScore = vision?.movementSpeed || micCadenceScore || 50;
  const intensity = Math.min(1.8, Math.max(0.6, activeSpeedScore / 55));
  hanaBattle3DService.onFoamStream(intensity, hasLaser, Math.min(25, damageBoost));

  // Cooldown-gated single-source counter-attack firing & duration-normalized boss damage
  const isOverdrive = activeQuad.id === 'q5' || (vision?.movementSpeed >= 75) || (micCadenceScore >= 75);
  const fireCooldownMs = source === 'assist' ? 2000 : (isOverdrive ? 600 : 750);

  if ((now - lastCounterAttackAt) >= fireCooldownMs) {
    lastCounterAttackAt = now;
    volleyCount++;

    const colState = store.getBossColosseumState ? store.getBossColosseumState() : {};
    const maxHp = colState.maxHp || 100;
    const dur = Math.max(30, totalDuration || 120);
    const rawMult = scrubMultiplier * (1 + (damageBoost / 100));
    const cappedMult = Math.min(1.5, Math.max(1.0, rawMult));
    const shieldSt = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    const shieldAttackBoost = (mintyShieldActive || shieldSt?.active || shieldSt?.attackBoostActive) ? 1.35 : 1.0;
    const activeSprites = (hanaBattle3DService.sweetToothSprites || []).length;
    if (activeSprites > 0) {
      spritesSpawnedCount = Math.max(spritesSpawnedCount, activeSprites);
    }
    const stickyActive = Boolean((hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue)?.active);
    const stickyPenalty = stickyActive ? 0.65 : 1.0;
    let shotDamage = Number(((maxHp / (dur * 0.95)) * cappedMult * shieldAttackBoost * stickyPenalty).toFixed(2));
    if (activeSprites > 0) {
      shotDamage = 0.25;
    }

    const shotRes = store.fireColosseumBlaster ? store.fireColosseumBlaster(shotDamage, source === 'assist' ? 2 : 5, true) : null;
    if (shotRes?.shieldBroken) {
      hanaBattle3DService.onArmorFracture('shield');
      showComicHit('SUGAR SHIELD SHATTERED! 💥');
      if (recentFoamBlastAtMs > 0 && (now - recentFoamBlastAtMs) <= 8000) {
        victoryBurstOnPhaseShift = true;
        hanaBattle3DService.triggerVictoryBurst?.();
      }
    }

    hanaBattle3DService.triggerWarriorCounterAttack(currentCombo, {
      damage: shotDamage,
      allowCaptainBonus: volleyCount % 5 === 0,
      maxProjectiles: 6
    });
  }

  // Sync state with 3D engine (no auto-firing inside updateState)
  const colState = store.getBossColosseumState ? store.getBossColosseumState() : {};
  const minFloor = store.getColosseumPhaseHpFloor
    ? store.getColosseumPhaseHpFloor(colState.maxHp || 100, secondsRemaining, totalDuration)
    : 1;
  hanaBattle3DService.updateState({
    bossHp: colState.currentHp,
    maxHp: colState.maxHp,
    minBossHpFloor: minFloor,
    shieldActive: colState.isShieldActive,
    activeQuadrant: activeQuad.id,
    hasLaser: hasLaser,
    combatWeapon: combatWeapon,
    cadenceScore: activeSpeedScore,
    combo: currentCombo,
    isScrubbing: true,
    quadrantCleanliness: quadrantCleanliness,
    sensorMode,
    movementSpeed: vision?.movementSpeed || activeSpeedScore,
    visionConfidence: vision?.confidence || 0,
    isFinale: activeQuad.id === 'q5'
  });

  if (source === 'manual') {
    const weaponTitle = combatWeapon.weapon?.title || 'Weapon';
    showComicHit(hasLaser ? `${weaponTitle.toUpperCase()} BLAST! ⚡` : 'MINTY BLAST! 🫧');
  }

  syncCockpitHUD();
}

function syncCockpitHUD() {
  if (typeof document === 'undefined') return;
  const colState = store.getBossColosseumState();
  const hpPercent = secondsRemaining <= 0
    ? 0
    : Math.max(1, Math.min(100, Math.round((colState.currentHp / colState.maxHp) * 100)));

  const hpBar = document.getElementById('boss-hp-bar');
  if (hpBar) hpBar.style.width = `${hpPercent}%`;

  const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);

  const zoneStatusText = document.getElementById('current-zone-status-text');
  if (zoneStatusText) {
    zoneStatusText.textContent = `${activeQuad.name}`;
  }
  const zoneBadge = document.getElementById('current-zone-badge');
  if (zoneBadge) {
    zoneBadge.textContent = `${activeQuad.zone}/5`;
  }

  const shieldBanner = document.getElementById('boss-shield-banner');
  if (shieldBanner) {
    if (colState.isShieldActive) {
      shieldBanner.classList.remove('hidden', 'opacity-0', 'scale-90');
      shieldBanner.classList.add('opacity-100', 'scale-100');
    } else {
      shieldBanner.classList.add('opacity-0', 'scale-90', 'hidden');
      shieldBanner.classList.remove('opacity-100', 'scale-100');
    }
  }

  const novaBar = document.getElementById('supernova-charge-bar');
  const novaCharge = Math.min(100, Math.round(colState.choreSupernovaCharge || 0));
  if (novaBar) novaBar.style.width = `${novaCharge}%`;

  const novaBtn = document.getElementById('supernova-blast-btn');
  if (novaBtn) {
    if (novaCharge >= 40) {
      novaBtn.disabled = false;
      novaBtn.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase transition-all cursor-pointer bg-linear-to-r from-amber-400 to-emerald-400 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse';
    } else {
      novaBtn.disabled = true;
      novaBtn.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase transition-all bg-slate-800 text-slate-400 cursor-not-allowed';
    }
  }

  const shieldBtn = document.getElementById('minty-shield-btn');
  if (shieldBtn) {
    const st = hanaBattle3DService.mintyShieldState || hanaBattle3DService.mintyShield;
    const isActive = Boolean(mintyShieldActive || (st?.active && (st?.remainingSec ?? 0) > 0 && (st?.integrity ?? 1) > 0));
    const remSec = Math.max(1, Math.ceil(st?.remainingSec || mintyShieldRemainingSec || mintyShieldDurationSec || 5));
    shieldBtn.dataset.active = isActive ? 'true' : 'false';
    if (isActive) {
      shieldBtn.disabled = false;
      shieldBtn.textContent = `MINTY SHIELD ACTIVE (${remSec}s) ❄️`;
      shieldBtn.className = 'px-3 py-1 rounded-full text-[10px] font-black uppercase border-2 transition-all bg-linear-to-r from-cyan-300 to-sky-400 text-slate-950 border-white shadow-[0_0_14px_rgba(56,189,248,0.85)] cursor-pointer';
    } else if (mintyShieldCharge >= 40) {
      shieldBtn.disabled = false;
      shieldBtn.textContent = `MINTY SHIELD (${mintyShieldDurationSec}s) ❄️`;
      shieldBtn.className = 'px-3 py-1 rounded-full text-[10px] font-black uppercase border-2 transition-all bg-linear-to-r from-sky-400 to-cyan-400 text-slate-950 border-cyan-200 shadow-lg animate-pulse cursor-pointer';
    } else {
      shieldBtn.disabled = true;
      shieldBtn.textContent = `MINTY SHIELD (${Math.round(mintyShieldCharge)}%) ❄️`;
      shieldBtn.className = 'px-3 py-1 rounded-full text-[10px] font-black uppercase border-2 transition-all bg-slate-900/90 text-slate-400 border-slate-700 cursor-not-allowed';
    }
  }

  updateVisionHudState();
}

function concludeVictory() {
  isConcludingVictory = true;
  try {
    if (battleTimer) {
      clearInterval(battleTimer);
      battleTimer = null;
    }
    if (bombTimer) {
      clearInterval(bombTimer);
      bombTimer = null;
    }
    if (motionCheckInterval) {
      clearInterval(motionCheckInterval);
      motionCheckInterval = null;
    }
    if (autoAssistInterval) {
      clearInterval(autoAssistInterval);
      autoAssistInterval = null;
    }
    if (deflectFlurryTimer) {
      clearTimeout(deflectFlurryTimer);
      deflectFlurryTimer = null;
    }
    if (introCountdownInterval) {
      clearInterval(introCountdownInterval);
      introCountdownInterval = null;
    }
    if (introCountdownFadeTimeout) {
      clearTimeout(introCountdownFadeTimeout);
      introCountdownFadeTimeout = null;
    }
    if (mouthwashReminderTimeout) {
      clearTimeout(mouthwashReminderTimeout);
      mouthwashReminderTimeout = null;
    }

    Sound.stopBattleRhythm();
    if (typeof Sound?.speedUpBattleRhythm === 'function') Sound.speedUpBattleRhythm(false);
    isFinaleSpeedActive = false;
    brushAudioAnalyzer.stopListening();
    stopSensors();
    secondsRemaining = 0;
    isBattlePaused = true;
    isBattleRunning = false;

    // Trigger 3D Cleanse Victory Transformation Sequence
    hanaBattle3DService.onCleanseVictory();
    confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });

    const boss = getBattleBoss(selectedBossId);
    const avgCadence = cadenceSamples.length > 0
      ? Math.round(cadenceSamples.reduce((a, b) => a + b, 0) / cadenceSamples.length)
      : 85;

    voicePrompts.speakBossDefeated(boss.name);

    store.updateColosseumTimer(0, totalDuration);

    const cleanZonesCount = ['q1', 'q2', 'q3', 'q4'].filter(q => (quadrantCleanliness[q] || 0) >= 80).length;
    const shieldUptimePass = mintyShieldActiveSeconds >= Math.max(3, Math.floor((totalDuration || 120) * 0.75));
    const isTartarTyrant = selectedBossId === 'tartar_tyrant' || hanaBattle3DService.bossData?.id === 'tartar_tyrant';
    const shellState = hanaBattle3DService.tartarShellState || hanaBattle3DService.tartarShell;
    const didShatterBeforeRecharge = Boolean(
      shellShatteredBeforeRecharge ||
      (isTartarTyrant && shellState?.shattered)
    );

    // Directly complete the toothbrush battle: records task in pendingApprovals for parent issuance,
    // awards sparks/XP/badges, opens victory modal, and saves state to Cloud Firestore immediately.
    store.completeToothbrushBattle(selectedBossId, totalDuration, avgCadence, {
      spritesSpawned: spritesSpawnedCount,
      spritesClearedNoDamage: Boolean(spritesSpawnedCount > 0 && (spritesClearedNoDamage || (hanaBattle3DService.sweetToothSprites || []).length === 0)),
      shellShatteredBeforeRecharge: didShatterBeforeRecharge,
      speedScrubMs: didShatterBeforeRecharge ? (speedScrubMs || 3500) : speedScrubMs,
      speedScrubMultiplier: didShatterBeforeRecharge ? Math.max(2, speedScrubMultiplier || 2) : (speedScrubMultiplier || 1),
      mintyShieldFullBattleUptime: shieldUptimePass,
      victoryBurstOnPhaseShift: Boolean(victoryBurstOnPhaseShift || hanaBattle3DService.victoryBurstTriggered),
      flawlessZones: cleanZonesCount,
      weeklyChallengeCompleted: true
    });

    // When Mouthwash reminder is active for this kid, Rex reminds them in the victory modal
    const hygieneKid = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
    const kidId = hygieneKid?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
    if (kidId && shouldShowMouthwashReminder()) {
      mouthwashReminderTimeout = setTimeout(() => {
        mouthwashReminderTimeout = null;
        voicePrompts.speakMouthwashReminder();
      }, 1200);
    }
  } finally {
    isConcludingVictory = false;
  }
}

// Stops every running timer/timeout, releases the camera+mic, and tears down
// the 3D battle scene. Shared by the explicit Quit button and by the
// automatic in-app-navigation guard below -- neither leaves this module's
// setInterval/rhythm loop orphaned and running behind a different screen.
function stopBattleSensorsAndTimers() {
  if (battleTimer) {
    clearInterval(battleTimer);
    battleTimer = null;
  }
  if (bombTimer) {
    clearInterval(bombTimer);
    bombTimer = null;
  }
  if (motionCheckInterval) {
    clearInterval(motionCheckInterval);
    motionCheckInterval = null;
  }
  if (autoAssistInterval) {
    clearInterval(autoAssistInterval);
    autoAssistInterval = null;
  }
  if (deflectFlurryTimer) {
    clearTimeout(deflectFlurryTimer);
    deflectFlurryTimer = null;
  }
  if (introCountdownInterval) {
    clearInterval(introCountdownInterval);
    introCountdownInterval = null;
  }
  if (introCountdownFadeTimeout) {
    clearTimeout(introCountdownFadeTimeout);
    introCountdownFadeTimeout = null;
  }
  if (mouthwashReminderTimeout) {
    clearTimeout(mouthwashReminderTimeout);
    mouthwashReminderTimeout = null;
  }

  Sound.stopBattleRhythm();
  if (typeof Sound?.speedUpBattleRhythm === 'function') Sound.speedUpBattleRhythm(false);
  isFinaleSpeedActive = false;
  isPointerScrubbing = false;
  mintyShieldActive = false;
  mintyShieldRemainingSec = 0;
  hanaBattle3DService.setStickyResidueState?.({ active: false, intensity: 0 });
  hanaBattle3DService.setMintyShieldState?.({ active: false, remainingSec: 0 });
  brushAudioAnalyzer.stopListening();
  stopSensors();
  hanaBattle3DService.destroy();
}

export function quitBattle() {
  const wasMidBattle = isBattleRunning && secondsRemaining > 0;
  stopBattleSensorsAndTimers();
  isBattleRunning = false;
  isBattlePaused = false;
  isFallbackManualOverride = false;
  hasExplicitBossSelection = false;
  // The synced store-side flag (set by setSelectedBossId whenever a boss is
  // explicitly chosen from the Quest Map or a waypoint) never resets on its
  // own and otherwise permanently overrides the rotating-villain system for
  // every future casual battle launch, on every device, once set even once.
  if (store.state) store.state.hasExplicitBossSelection = false;
  sessionRotatedBossId = null;
  battlePhase = 'brush';
  if (wasMidBattle) {
    // Don't clear activeWaypointChoreKey here -- the kid hasn't actually
    // left the waypoint's battle yet, just hit the defeat modal. Tapping
    // "Try Again" (defeatRetryBtn) re-launches the SAME waypoint battle via
    // startBattle(), which needs this breadcrumb intact or the eventual
    // victory falls back to the wall-clock guess and mislabels it. Only
    // clear it if they actually leave via "Give Up" (defeatReturnBtn).
    // Show a real defeat modal (reward-free -- quitting early stays an
    // incentive to finish, same as before) instead of a toast that
    // immediately dumped the kid back to the dashboard. The modal's own
    // button handles navigation once the kid is ready to leave.
    Sound.hit();
    const currentBoss = getBattleBoss(selectedBossId);
    // Stop the 3D render loop now, same as every other end-of-battle path
    // (victory/retry) already does. Without this the old animation-frame
    // chain keeps ticking behind the modal on a now-detached canvas while
    // the next render creates a fresh one, and the two can overlap for a
    // frame -- producing a stray stale timestamp that makes dt briefly go
    // negative and crashes the shockwave-ring renderer (negative arc radius).
    hanaBattle3DService.destroy();
    store.openColosseumDefeatModal({ bossId: currentBoss.id, bossName: currentBoss.name, bossAvatar: currentBoss.emoji || currentBoss.avatar });
    store.notify();
    return;
  }

  // Not mid-battle, so there's no defeat/retry modal pending -- this is a
  // genuine exit with no chance of a "Try Again" reusing the breadcrumb.
  if (store.state) store.state.activeWaypointChoreKey = null;

  const targetView = (store.state && store.state.previousView === 'quest_map')
    ? 'quest_map'
    : (store.state && store.state.previousView === 'bedtime_story')
      ? 'bedtime_story'
      : 'dashboard';
  store.navigate(targetView);
}

// Called by main.js the instant the app navigates away from the Battle view
// to somewhere else (bottom nav, quest map, a reward popup, etc.) without the
// player ever tapping Quit. Without this, battleTimer/bombTimer/autoAssistInterval
// and the rhythm music are module-level state with no DOM/view lifecycle tied
// to them, so they kept ticking and playing forever behind whatever screen the
// player navigated to, and the camera/mic stayed open. This performs the same
// stop-everything cleanup as quitBattle() but has no store side effects (no
// reward popup, no navigate -- a navigation is already in flight), so it is
// safe to call synchronously from inside the render/notify cycle.
export function abandonBattleIfRunning() {
  stopBattleSensorsAndTimers();
  isBattleRunning = false;
  isBattlePaused = false;
  isConcludingVictory = false;
  isFallbackManualOverride = false;
  hasExplicitBossSelection = false;
  // The synced store-side flag (set by setSelectedBossId whenever a boss is
  // explicitly chosen from the Quest Map or a waypoint) never resets on its
  // own and otherwise permanently overrides the rotating-villain system for
  // every future casual battle launch, on every device, once set even once.
  if (store.state) {
    store.state.hasExplicitBossSelection = false;
    // Same stale-breadcrumb risk as quitBattle() -- clearing it is not a
    // reward/notify/navigate side effect, just resetting transient routing
    // state, so it stays safe to call synchronously from the render cycle.
    store.state.activeWaypointChoreKey = null;
  }
  sessionRotatedBossId = null;
  battlePhase = 'brush';
  const col = store.getBossColosseumState ? store.getBossColosseumState() : store.state?.bossColosseum;
  if (col) {
    col.isVictoryModalOpen = false;
    col.isDefeatModalOpen = false;
    col.hasAwardedVictory = false;
    col.victoryReward = null;
    col.defeatInfo = null;
  }
}

function showComicHit(text) {
  const badge = document.getElementById('comic-hit-badge');
  if (!badge) return;

  const innerSpan = badge.querySelector('span');
  if (innerSpan) innerSpan.textContent = text;

  badge.style.opacity = '1';
  badge.style.transform = 'translate(-50%, -50%) scale(1.15) rotate(' + (Math.random() * 8 - 4) + 'deg)';

  setTimeout(() => {
    badge.style.opacity = '0';
    badge.style.transform = 'translate(-50%, -50%) scale(0.8)';
  }, 650);
}

// =========================================================================
// EVENT LISTENERS & ATTACHMENT
// =========================================================================
export function attachBattleListeners() {
  const colState = store.getBossColosseumState ? store.getBossColosseumState() : {};

  // Auto-launch battle immediately upon entering view if not running & no end-of-battle modal is open
  const mountedCanvas = typeof document !== 'undefined' ? document.getElementById('battle-webgl-canvas') : null;
  if (!isBattleRunning && !isConcludingVictory && !colState.isVictoryModalOpen && !colState.isDefeatModalOpen && !colState.hasAwardedVictory) {
    startBattle();
    if (typeof document !== 'undefined' && document.getElementById('battle-webgl-canvas') !== mountedCanvas) {
      return;
    }
  }

  // Seamlessly reconnect active video stream if view re-rendered (only when camera video tracks are active)
  const video = document.getElementById('ar-camera-feed');
  const hasActiveVideoTracks = Boolean(
    videoStream &&
    videoStream.active &&
    isCameraActive &&
    typeof videoStream.getVideoTracks === 'function' &&
    videoStream.getVideoTracks().length > 0
  );
  if (video && hasActiveVideoTracks) {
    video.srcObject = videoStream;
    if (typeof video.play === 'function') video.play().catch(() => {});
    hanaBattle3DService.setVideoElement(video);
    const placeholder = document.getElementById('pip-placeholder');
    if (placeholder) placeholder.classList.add('hidden');
    video.classList.remove('hidden');
  }

  // 1. Map Quit Button
  const quitBtn = document.getElementById('battle-quit-btn');
  if (quitBtn) {
    quitBtn.addEventListener('click', quitBattle);
  }

  // 2. Audio Rhythm Toggle
  const rhythmBtn = document.getElementById('rhythm-toggle-btn');
  if (rhythmBtn) {
    rhythmBtn.addEventListener('click', () => {
      isRhythmBeatActive = !isRhythmBeatActive;
      Sound.click();
      if (isRhythmBeatActive) {
        Sound.startBattleRhythm();
      } else {
        Sound.stopBattleRhythm();
      }
      const icon = rhythmBtn.querySelector('span');
      if (icon) icon.textContent = isRhythmBeatActive ? 'music_note' : 'music_off';
    });
  }

  // 3. Camera Flip Button
  const cameraFlipBtn = document.getElementById('camera-flip-btn');
  if (cameraFlipBtn) {
    cameraFlipBtn.addEventListener('click', flipCamera);
  }

  // 4. In-Game 3D Villain Switcher Buttons
  document.querySelectorAll('.villain-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const vId = btn.getAttribute('data-villain-id');
      if (vId && vId !== selectedBossId) {
        hasExplicitBossSelection = true;
        sessionRotatedBossId = vId;
        selectedBossId = vId;
        if (store.state) store.state.selectedBossId = vId;
        Sound.tap();
        const boss = getBattleBoss(vId);
        const currentCol = store.getBossColosseumState ? store.getBossColosseumState() : {};
        currentCol.activeBossId = vId;
        hanaBattle3DService.setBoss({
          ...boss,
          maxHp: currentCol.maxHp || boss.maxHp || 100,
          currentHp: currentCol.currentHp
        }, quadrantCleanliness);
        if (currentSugarHazard) {
          hanaBattle3DService.setHazard(currentSugarHazard);
        }
        syncCockpitHUD();
        document.querySelectorAll('.villain-switch-btn').forEach(b => {
          const isActive = b.getAttribute('data-villain-id') === vId;
          b.classList.toggle('ring-4', isActive);
          b.classList.toggle('ring-amber-400', isActive);
          b.classList.toggle('scale-105', isActive);
        });
        const bossNameEl = document.getElementById('battle-boss-name-hud');
        if (bossNameEl) bossNameEl.textContent = boss.name;
      }
    });
  });

  // 5. Interactive Canvas Tap & Pointer-Drag Scrubbing (Sugar attack deflection & Non-Camera Scrubbing)
  const canvas = document.getElementById('battle-webgl-canvas');
  if (canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      if (isBattleRunning && !isBattlePaused && battlePhase === 'brush') {
        isPointerScrubbing = true;
        pointerDragMoveCount = 0;
        lastPointerScrubAt = Date.now();
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / (rect.width || 1);
        const scaleY = canvas.height / (rect.height || 1);
        const tapX = e.clientX ? (e.clientX - rect.left) * scaleX : (canvas.width * 0.5);
        const tapY = e.clientY ? (e.clientY - rect.top) * scaleY : (canvas.height * 0.5);

        // Check if user tapped on or near any falling sugar attack with generous 55px hitbox
        const deflected = hanaBattle3DService.checkAndDeflectBombAt ? hanaBattle3DService.checkAndDeflectBombAt(tapX, tapY) : false;
        if (deflected) {
          if (typeof Sound?.tap === 'function') Sound.tap();
          if (typeof Sound?.sparkle === 'function') Sound.sparkle();
          showComicHit('TAPPED & DEFLECTED! 🛡️✨');

          if (isDeflectFlurryActive) {
            triggerDeflectSuccess();
          } else {
            currentCombo += 2;
            const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
            const manualSnap = brushVisionTracker.recordManualInput(activeQuad.id, Date.now());
            handleScrubHit(activeQuad, 'manual', manualSnap);
          }
          return;
        }

        const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
        const manualSnap = brushVisionTracker.recordManualInput(activeQuad.id, Date.now());
        handleScrubHit(activeQuad, 'manual', manualSnap);
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!isPointerScrubbing || !isBattleRunning || isBattlePaused || battlePhase !== 'brush') return;
      pointerDragMoveCount++;
      if (pointerDragMoveCount >= 2 && typeof hanaBattle3DService.registerCircularScrubSweep === 'function') {
        const rect = canvas.getBoundingClientRect();
        const scaleX = (hanaBattle3DService.width || canvas.width || 600) / (rect.width || 600);
        const scaleY = (hanaBattle3DService.height || canvas.height || 420) / (rect.height || 420);
        const cx = typeof e.clientX === 'number' ? (e.clientX - (rect.left || 0)) * scaleX : 300;
        const cy = typeof e.clientY === 'number' ? (e.clientY - (rect.top || 0)) * scaleY : 260;
        const beforeSprites = (hanaBattle3DService.sweetToothSprites || []).length;
        if (beforeSprites > 0) {
          spritesSpawnedCount = Math.max(spritesSpawnedCount, beforeSprites);
        }
        const cleared = hanaBattle3DService.registerCircularScrubSweep(cx, cy, 85);
        if (Array.isArray(cleared) && cleared.length > 0 && (hanaBattle3DService.sweetToothSprites || []).length === 0) {
          spritesClearedNoDamage = true;
        }
        // F5. Sticky Residue applies on contact with any sprite/trail the
        // circular sweep didn't just clear.
        if (beforeSprites > 0 && typeof hanaBattle3DService.applyStickyResidueContactAt === 'function') {
          const contacted = hanaBattle3DService.applyStickyResidueContactAt(cx, cy);
          if (contacted) {
            spritesClearedNoDamage = false;
          }
        }
      }
      const stickyNow = hanaBattle3DService.stickyResidueState || hanaBattle3DService.stickyResidue;
      const scrubThrottleMs = stickyNow?.active
        ? 65 + Math.round(55 * Math.min(1.5, stickyNow.intensity || 1))
        : 65;
      const now = Date.now();
      if (now - lastPointerScrubAt < scrubThrottleMs) return;
      lastPointerScrubAt = now;
      const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
      const manualSnap = brushVisionTracker.recordManualInput(activeQuad.id, now);
      handleScrubHit(activeQuad, 'manual', manualSnap);
    });

    const stopPointerScrub = () => {
      isPointerScrubbing = false;
      pointerDragMoveCount = 0;
    };
    canvas.addEventListener('pointerup', stopPointerScrub);
    canvas.addEventListener('pointercancel', stopPointerScrub);
    canvas.addEventListener('pointerleave', stopPointerScrub);

    const currentBoss = getBattleBoss(selectedBossId);
    const activeCombatWeapon = getActiveCombatWeapon();
    const latestColState = store.getBossColosseumState ? store.getBossColosseumState() : colState;
    hanaBattle3DService.init(canvas, {
      bossData: {
        ...currentBoss,
        maxHp: latestColState.maxHp || currentBoss.maxHp || 100,
        currentHp: latestColState.currentHp !== undefined ? latestColState.currentHp : (currentBoss.maxHp || 100)
      },
      hazard: currentSugarHazard,
      splineUrl: currentBoss.splineUrl || null,
      combatWeapon: activeCombatWeapon,
      hasLaserEquipped: checkLaserToothbrushEquipped(),
      videoElement: document.getElementById('ar-camera-feed'),
      preserveBattleState: Boolean(isBattleRunning || latestColState.isVictoryModalOpen || latestColState.isDefeatModalOpen),
      isVictory: Boolean(latestColState.isVictoryModalOpen || latestColState.hasAwardedVictory),
      quadrantCleanliness: quadrantCleanliness
    });
  }

  // 5b. Vision / Non-Camera Fallback Mode Toggle & Supernova / Fallback Scrub Buttons
  const fallbackToggleBtn = document.getElementById('vision-fallback-toggle-btn');
  if (fallbackToggleBtn) {
    fallbackToggleBtn.addEventListener('click', async () => {
      Sound.tap();
      const wantsEnableCamera = sensorMode !== 'initializing' && (!isCameraActive || isFallbackManualOverride);
      if (wantsEnableCamera) {
        isFallbackManualOverride = false;
        sensorMode = 'initializing';
        updateVisionHudState();
        await initSensors();
      } else {
        isFallbackManualOverride = true;
        stopSensors();
        activateFallbackMode('Switched to Non-Camera Mode');
      }
      updateVisionHudState();
    });
  }

  const novaBlastBtn = document.getElementById('supernova-blast-btn');
  if (novaBlastBtn) {
    novaBlastBtn.addEventListener('click', () => {
      triggerSupernovaBlast();
    });
  }

  const mintyShieldBtn = document.getElementById('minty-shield-btn');
  if (mintyShieldBtn) {
    mintyShieldBtn.addEventListener('click', () => {
      activateMintyShield('button');
    });
  }

  const fallbackScrubBtn = document.getElementById('fallback-scrub-btn');
  if (fallbackScrubBtn) {
    fallbackScrubBtn.addEventListener('click', () => {
      if (!isBattleRunning || isBattlePaused || battlePhase !== 'brush') return;
      lastPointerScrubAt = Date.now();
      const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
      const manualSnap = brushVisionTracker.recordManualInput(activeQuad.id, lastPointerScrubAt);
      handleScrubHit(activeQuad, 'manual', manualSnap);
    });
  }

  // 6. Floss Phase: Done Flossing Early Advance
  const doneFlossBtn = document.getElementById('battle-done-floss-btn');
  if (doneFlossBtn) {
    doneFlossBtn.addEventListener('click', () => {
      advanceToBrushPhase();
    });
  }

  // 7. Victory Modal Actions & Mouthwash Acknowledgment
  const mouthwashAckBtn = document.getElementById('mouthwash-modal-ack-btn');
  if (mouthwashAckBtn) {
    mouthwashAckBtn.addEventListener('click', () => {
      const hero = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
      const kidId = hero?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
      if (mouthwashAckBtn.dataset.acknowledged === 'true') return;
      if (kidId && (!store.hasAcknowledgedHygieneReminderToday || !store.hasAcknowledgedHygieneReminderToday(kidId, 'mouthwash'))) {
        mouthwashAckBtn.dataset.acknowledged = 'true';
        mouthwashAckBtn.disabled = true;
        mouthwashAckBtn.className = 'mt-1 px-4 py-1.5 rounded-xl bg-emerald-600 text-white cursor-default font-headline font-black text-xs transition-all flex items-center gap-1';
        mouthwashAckBtn.innerHTML = '<span class="material-symbols-outlined text-sm">check_circle</span> Rinsed ✓';
        if (typeof Sound?.fanfare === 'function') Sound.fanfare();
        store.acknowledgeHygieneReminder(kidId, 'mouthwash');
      }
    });
  }

  const visitHqBtn = document.getElementById('colosseum-visit-hq-btn');
  if (visitHqBtn) {
    visitHqBtn.addEventListener('click', () => {
      if (visitHqBtn.dataset.submitting === 'true') return;
      visitHqBtn.dataset.submitting = 'true';
      Sound.tap();
      if (mouthwashReminderTimeout) {
        clearTimeout(mouthwashReminderTimeout);
        mouthwashReminderTimeout = null;
      }
      isBattleRunning = false;
      battlePhase = 'brush';
      hasExplicitBossSelection = false;
      if (store.state) store.state.hasExplicitBossSelection = false;
      sessionRotatedBossId = null;
      hanaBattle3DService.destroy();

      // NOTE: completing the battle (coins/XP/sparks auto-awarded, the
      // toothbrush_adventure_battle habit marked done, and the parent-
      // configured points submitted for approval) already happened the
      // instant the timer hit zero, in concludeVictory() -> store.
      // completeToothbrushBattle() (guarded by col.hasAwardedVictory so it
      // can never double-fire). This button only needs to close the modal
      // and navigate -- it used to also re-run all of that reward logic
      // inline, which silently double-credited coins and submitted a second,
      // duplicate pending-approval entry to the Parent Portal every time a
      // kid clicked it.
      store.closeColosseumVictoryModal(true);
      store.navigate('hero_hq');
    });
  }

  const returnBedtimeBtn = document.getElementById('colosseum-return-bedtime-btn');
  if (returnBedtimeBtn) {
    returnBedtimeBtn.addEventListener('click', () => {
      if (returnBedtimeBtn.dataset.submitting === 'true') return;
      returnBedtimeBtn.dataset.submitting = 'true';
      Sound.tap();
      if (mouthwashReminderTimeout) {
        clearTimeout(mouthwashReminderTimeout);
        mouthwashReminderTimeout = null;
      }
      isBattleRunning = false;
      battlePhase = 'brush';
      hasExplicitBossSelection = false;
      if (store.state) store.state.hasExplicitBossSelection = false;
      sessionRotatedBossId = null;
      hanaBattle3DService.destroy();
      store.closeColosseumVictoryModal(true);
      store.navigate('bedtime_story');
    });
  }

  const returnMapBtn = document.getElementById('colosseum-return-map-btn');
  if (returnMapBtn) {
    returnMapBtn.addEventListener('click', () => {
      if (returnMapBtn.dataset.submitting === 'true') return;
      returnMapBtn.dataset.submitting = 'true';
      Sound.tap();
      if (mouthwashReminderTimeout) {
        clearTimeout(mouthwashReminderTimeout);
        mouthwashReminderTimeout = null;
      }
      isBattleRunning = false;
      battlePhase = 'brush';
      hasExplicitBossSelection = false;
      if (store.state) store.state.hasExplicitBossSelection = false;
      sessionRotatedBossId = null;
      hanaBattle3DService.destroy();
      store.closeColosseumVictoryModal(true);
      store.navigate('quest_map');
    });
  }

  const playAgainBtn = document.getElementById('colosseum-play-again-btn');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      if (playAgainBtn.dataset.submitting === 'true') return;
      playAgainBtn.dataset.submitting = 'true';
      Sound.tap();
      if (mouthwashReminderTimeout) {
        clearTimeout(mouthwashReminderTimeout);
        mouthwashReminderTimeout = null;
      }
      isBattleRunning = false;
      battlePhase = 'brush';
      hanaBattle3DService.destroy();
      const col = store.getBossColosseumState ? store.getBossColosseumState() : null;
      if (col) {
        col.hasAwardedVictory = false;
        col.victoryReward = null;
      }
      if (store.state?.rewardModal) {
        store.closeColosseumVictoryModal(true);
        store.closeReward();
      } else {
        store.closeColosseumVictoryModal(false);
      }
      if (!isBattleRunning) {
        startBattle();
      }
    });
  }

  const defeatReturnBtn = document.getElementById('colosseum-defeat-return-btn');
  if (defeatReturnBtn) {
    defeatReturnBtn.addEventListener('click', () => {
      if (defeatReturnBtn.dataset.submitting === 'true') return;
      defeatReturnBtn.dataset.submitting = 'true';
      Sound.tap();
      if (mouthwashReminderTimeout) {
        clearTimeout(mouthwashReminderTimeout);
        mouthwashReminderTimeout = null;
      }
      hanaBattle3DService.destroy();
      // This is the real "give up" decision quitBattle() deferred -- clear
      // the waypoint breadcrumb now that there's no retry coming.
      if (store.state) store.state.activeWaypointChoreKey = null;
      store.closeColosseumDefeatModal(true);
      const targetView = (store.state && store.state.previousView === 'quest_map')
        ? 'quest_map'
        : (store.state && store.state.previousView === 'bedtime_story')
          ? 'bedtime_story'
          : 'dashboard';
      store.navigate(targetView);
    });
  }

  const defeatRetryBtn = document.getElementById('colosseum-defeat-retry-btn');
  if (defeatRetryBtn) {
    defeatRetryBtn.addEventListener('click', () => {
      if (defeatRetryBtn.dataset.submitting === 'true') return;
      defeatRetryBtn.dataset.submitting = 'true';
      Sound.tap();
      if (mouthwashReminderTimeout) {
        clearTimeout(mouthwashReminderTimeout);
        mouthwashReminderTimeout = null;
      }
      isBattleRunning = false;
      battlePhase = 'brush';
      hanaBattle3DService.destroy();
      const col = store.getBossColosseumState ? store.getBossColosseumState() : null;
      if (col) {
        col.hasAwardedVictory = false;
      }
      store.closeColosseumDefeatModal(false);
      if (!isBattleRunning) {
        startBattle();
      }
    });
  }

  // 7. Live Rex Battle Voice Commands
  if (typeof window !== 'undefined') {
    if (window._rexBattleFoamHandler) {
      window.removeEventListener('rex-battle-foam', window._rexBattleFoamHandler);
    }
    if (window._rexBattleShieldHandler) {
      window.removeEventListener('rex-battle-shield', window._rexBattleShieldHandler);
    }

    window._rexBattleFoamHandler = (e) => {
      if (isBattleRunning && !isBattlePaused && battlePhase === 'brush') {
        const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
        handleScrubHit(activeQuad, 'voice');
        showComicHit('DINO FOAM CANNON! 🫧🦖');
        if (typeof hanaBattle3DService.triggerLaserBurst === 'function') {
          hanaBattle3DService.triggerLaserBurst();
        }
      }
    };

    window._rexBattleShieldHandler = (e) => {
      if (isBattleRunning && !isBattlePaused && battlePhase === 'brush') {
        if (mintyShieldCharge >= 40 || mintyShieldActive) {
          activateMintyShield('voice');
        } else if (isDeflectFlurryActive) {
          triggerDeflectSuccess();
        } else {
          showComicHit('HERO BUBBLE SHIELD! 🛡️✨');
          hanaBattle3DService.onDeflectRicochet();
          store.triggerColosseumDeflect(true);
          sync3DServiceFromStore(null);
        }
      }
    };

    window.addEventListener('rex-battle-foam', window._rexBattleFoamHandler);
    window.addEventListener('rex-battle-shield', window._rexBattleShieldHandler);
  }
}
